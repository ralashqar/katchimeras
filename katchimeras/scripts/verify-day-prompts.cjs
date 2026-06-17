// Node-only verification harness for the daily prompt selector. No test runner
// in this project: transpile pure modules with TypeScript and run the product
// selection scenarios. Usage: node scripts/verify-day-prompts.cjs
const fs = require('fs');
const path = require('path');
const Module = require('module');
const os = require('os');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-prompts-'));

function transpileToTemp(relativeSourcePath, outName) {
  const source = fs.readFileSync(path.join(projectRoot, relativeSourcePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const outPath = path.join(tempDir, outName);
  fs.writeFileSync(outPath, output);
  return outPath;
}

const promptsPath = transpileToTemp('constants/day-prompts.ts', 'day-prompts.js');
const enginePath = transpileToTemp('utils/day-prompt-engine.ts', 'day-prompt-engine.js');

const stubs = {
  '@/constants/day-prompts': promptsPath,
  '@/types/home': {},
};

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request in stubs) {
    const stub = stubs[request];
    if (typeof stub === 'string') return stub;
    const stubFile = path.join(tempDir, `${request.replace(/[@/]/g, '_')}.js`);
    if (!fs.existsSync(stubFile)) {
      fs.writeFileSync(stubFile, `module.exports = ${JSON.stringify(stub)};`);
    }
    return stubFile;
  }
  return originalResolve.call(this, request, ...rest);
};

const promptEngine = require(enginePath);

function makeDay(overrides = {}) {
  return {
    id: 'day-2026-06-17',
    isoDate: '2026-06-17',
    state: 'forming',
    stepsCount: 0,
    visitedPlaceCount: 0,
    newPlaceCount: 0,
    locationSampleCount: 0,
    shareReadyAt: null,
    moments: [],
    locations: [],
    healthRouteImport: null,
    exactRouteSegments: [],
    selectedPathId: null,
    promptAnswers: [],
    heroPhoto: null,
    creature: null,
    ...overrides,
  };
}

function promptAnswer(kind, dismissed = false) {
  return {
    id: `prompt-${kind}`,
    kind,
    choiceIds: dismissed ? [] : ['x'],
    labels: dismissed ? [] : ['X'],
    createdAt: '2026-06-17T12:00:00.000Z',
    dismissed,
    source: 'prompt_chip',
    semanticTags: [],
    scoreBias: {},
    encounterSeedBias: [],
  };
}

function photoPoint(index, dayIsoDate = '2026-06-17', source = 'day_record') {
  return {
    id: `camera-roll-photo-asset-${index}`,
    lat: 51,
    lng: -0.1,
    capturedAt: `${dayIsoDate}T1${index}:00:00.000Z`,
    dayIsoDate,
    type: 'unknown',
    hasPhoto: true,
    source: 'photo_attachment',
    candidateSource: source,
    momentId: null,
    thumbnailUri: `file:///photo-${index}.jpg`,
  };
}

function photoCandidate(index, dayIsoDate = '2026-06-17', source = 'camera_roll') {
  return {
    assetId: `recent-photo-${index}`,
    capturedAt: `${dayIsoDate}T1${index}:00:00.000Z`,
    dayIsoDate,
    localUri: `file:///recent-${index}.jpg`,
    source,
    thumbnailUri: `file:///recent-thumb-${index}.jpg`,
  };
}

let failures = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok  ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

check(
  'morning selects feeling first',
  promptEngine.selectActiveDayPrompt(makeDay(), new Date('2026-06-17T08:00:00'))?.id === 'feeling'
);
check(
  'midday selects activity first',
  promptEngine.selectActiveDayPrompt(makeDay(), new Date('2026-06-17T13:00:00'))?.id === 'activity'
);
check(
  'evening selects day word when no photo candidates',
  promptEngine.selectActiveDayPrompt(makeDay(), new Date('2026-06-17T19:00:00'))?.id === 'day_word'
);

const noRepeatDay = makeDay({ promptAnswers: [promptAnswer('feeling')] });
check(
  'does not repeat answered prompt in one day',
  promptEngine.selectActiveDayPrompt(noRepeatDay, new Date('2026-06-17T08:00:00'))?.id !== 'feeling'
);

const dismissedDay = makeDay({ promptAnswers: [promptAnswer('activity', true)] });
check(
  'dismiss prevents resurfacing that day',
  promptEngine.selectActiveDayPrompt(dismissedDay, new Date('2026-06-17T13:00:00'))?.id !== 'activity'
);

const onePhotoDay = makeDay({ locations: [photoPoint(0)] });
check(
  'no photo prompt when same-day photos are below threshold',
  promptEngine.selectActiveDayPrompt(onePhotoDay, new Date('2026-06-17T19:00:00'))?.id !== 'meaningful_photo'
);

const mixedDatePhotoDay = makeDay({ locations: [photoPoint(0), photoPoint(1), photoPoint(2, '2026-06-16')] });
check(
  'regular photo prompt requires three valid photos from today',
  promptEngine.selectActiveDayPrompt(mixedDatePhotoDay, new Date('2026-06-17T19:00:00'))?.id !== 'meaningful_photo'
);

const photoRichDay = makeDay({ locations: [photoPoint(0), photoPoint(1), photoPoint(2), photoPoint(3)] });
check(
  'photo prompt appears on photo-rich evenings',
  promptEngine.selectActiveDayPrompt(photoRichDay, new Date('2026-06-17T19:00:00'))?.id === 'meaningful_photo'
);

const photoPrompt = promptEngine.selectActiveDayPrompt(photoRichDay, new Date('2026-06-17T19:00:00'));
check('photo prompt carries candidates', photoPrompt?.photoCandidates.length === 4, String(photoPrompt?.photoCandidates.length));

const devForcedDay = makeDay();
const devForcedPrompt = promptEngine.selectActiveDayPrompt(devForcedDay, new Date('2026-06-17T09:00:00'), {
  forceMeaningfulPhoto: true,
  photoCandidates: [
    photoCandidate(0, '2026-06-14', 'dev_override'),
    photoCandidate(1, '2026-06-15', 'dev_override'),
    photoCandidate(2, '2026-06-16', 'dev_override'),
  ],
});
check('dev override can force recent-photo prompt outside evening', devForcedPrompt?.id === 'meaningful_photo');

const heroPhotoDay = makeDay({
  heroPhoto: { assetId: 'asset-1', thumbnailUri: 'file:///photo.jpg', selectedAt: '2026-06-17T19:00:00.000Z', meaningChoiceIds: [], meaningLabels: [] },
});
check(
  'hero photo selection surfaces meaning follow-up',
  promptEngine.selectActiveDayPrompt(heroPhotoDay, new Date('2026-06-17T19:00:00'))?.id === 'meaning'
);

// --- "Add to today" menu: listAvailableDayPrompts + buildDayPromptByKind ---

// Daypart-independent: a launched, unanswered prompt is available even outside
// its daypart window so the menu can offer it.
const menuDay = makeDay();
const menuKinds = promptEngine.listAvailableDayPrompts(menuDay, new Date('2026-06-17T08:00:00')).map((p) => p.id);
check('menu lists multiple categories', menuKinds.length >= 2, menuKinds.join(','));
check('menu excludes non-launched prompts', !menuKinds.includes('intention'), menuKinds.join(','));

// No photos → no Photo option in the menu.
check('no Photo option without photo candidates', !menuKinds.includes('meaningful_photo'), menuKinds.join(','));

// "Photo meaning" is never a standalone menu button — even with a hero photo
// set (which would otherwise make it answerable), it stays out of the menu
// because it only follows a photo pick as a paired sequence.
const heroMenu = promptEngine
  .listAvailableDayPrompts(
    makeDay({ heroPhoto: { assetId: 'a', thumbnailUri: 'file:///h.jpg', selectedAt: '2026-06-17T12:00:00.000Z', meaningChoiceIds: [], meaningLabels: [] } }),
    new Date('2026-06-17T19:00:00')
  )
  .map((p) => p.id);
check('menu never includes Photo meaning (meaning)', !heroMenu.includes('meaning'), heroMenu.join(','));

// With enough recent photo candidates, the Photo option appears.
const photoMenu = promptEngine
  .listAvailableDayPrompts(menuDay, new Date('2026-06-17T19:00:00'), {
    photoCandidates: [photoCandidate(1), photoCandidate(2), photoCandidate(3)],
    forceMeaningfulPhoto: true,
  })
  .map((p) => p.id);
check('Photo option appears with photo candidates', photoMenu.includes('meaningful_photo'), photoMenu.join(','));

// Testing mode: answered categories stay in the menu (re-answerable) — the
// once-per-day restriction is intentionally off for now.
const answeredMenu = promptEngine
  .listAvailableDayPrompts(makeDay({ promptAnswers: [promptAnswer('feeling')] }), new Date('2026-06-17T08:00:00'))
  .map((p) => p.id);
check('menu keeps answered category (restriction off)', answeredMenu.includes('feeling'), answeredMenu.join(','));

// buildDayPromptByKind returns the requested kind (and null when answered).
check('buildDayPromptByKind returns the kind', promptEngine.buildDayPromptByKind(menuDay, 'feeling')?.id === 'feeling');
check(
  'buildDayPromptByKind null for answered kind',
  promptEngine.buildDayPromptByKind(makeDay({ promptAnswers: [promptAnswer('feeling')] }), 'feeling') === null
);
check(
  'buildDayPromptByKind null for photo without candidates',
  promptEngine.buildDayPromptByKind(menuDay, 'meaningful_photo') === null
);

Module._resolveFilename = originalResolve;
fs.rmSync(tempDir, { recursive: true, force: true });

console.log(failures === 0 ? '\nAll day-prompt checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
