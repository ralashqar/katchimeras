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
const dayPrompts = require(promptsPath);

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
  'morning open surfaces sleep first',
  promptEngine.selectActiveDayPrompt(makeDay(), new Date('2026-06-17T08:00:00'))?.id === 'sleep',
  promptEngine.selectActiveDayPrompt(makeDay(), new Date('2026-06-17T08:00:00'))?.id
);
check(
  'midday selects activity first',
  promptEngine.selectActiveDayPrompt(makeDay(), new Date('2026-06-17T13:00:00'))?.id === 'activity'
);
check(
  'evening selects day word when no photo candidates',
  promptEngine.selectActiveDayPrompt(makeDay(), new Date('2026-06-17T19:00:00'))?.id === 'day_word'
);

// --- Reactive surfacing: time of day + tracked behaviour ---
check(
  'a travelled day pushes the activity question up at midday',
  promptEngine.selectActiveDayPrompt(makeDay({ newPlaceCount: 2 }), new Date('2026-06-17T13:00:00'))?.id === 'activity'
);
// Travel ranks activity above the usual midday baseline (sleep/feeling/hobby).
const travelRank = promptEngine.rankPromptKinds(makeDay({ newPlaceCount: 2 }), new Date('2026-06-17T13:00:00'), 0);
check('travel ranks activity at the very top', travelRank[0] === 'activity', travelRank.join(','));
check(
  'before bed surfaces a reflection (day word)',
  promptEngine.selectActiveDayPrompt(makeDay(), new Date('2026-06-17T22:30:00'))?.id === 'day_word',
  promptEngine.selectActiveDayPrompt(makeDay(), new Date('2026-06-17T22:30:00'))?.id
);
// Stacking: the "Add to today" menu is ordered by the same relevance, so the
// most relevant sits first and the rest stack behind it.
const morningMenu = promptEngine.listAvailableDayPrompts(makeDay(), new Date('2026-06-17T08:00:00')).map((p) => p.id);
check('menu stacks by relevance (sleep before feeling in the morning)', morningMenu.indexOf('sleep') < morningMenu.indexOf('feeling'), morningMenu.join(','));

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
  'a single same-day photo now surfaces the photo prompt',
  promptEngine.selectActiveDayPrompt(onePhotoDay, new Date('2026-06-17T19:00:00'))?.id === 'meaningful_photo',
  promptEngine.selectActiveDayPrompt(onePhotoDay, new Date('2026-06-17T19:00:00'))?.id
);

// Same-day gating still holds: photos only from yesterday don't trigger today.
const yesterdayOnlyPhotoDay = makeDay({ locations: [photoPoint(0, '2026-06-16'), photoPoint(1, '2026-06-16')] });
check(
  'yesterday-only photos do not trigger the photo prompt today',
  promptEngine.selectActiveDayPrompt(yesterdayOnlyPhotoDay, new Date('2026-06-17T19:00:00'))?.id !== 'meaningful_photo'
);

const photoRichDay = makeDay({ locations: [photoPoint(0), photoPoint(1), photoPoint(2), photoPoint(3)] });
check(
  'photo prompt appears on photo-rich evenings',
  promptEngine.selectActiveDayPrompt(photoRichDay, new Date('2026-06-17T19:00:00'))?.id === 'meaningful_photo'
);

const photoPrompt = promptEngine.selectActiveDayPrompt(photoRichDay, new Date('2026-06-17T19:00:00'));
check('photo prompt carries candidates', photoPrompt?.photoCandidates.length === 4, String(photoPrompt?.photoCandidates.length));

// Photos already added to the vault (usedPhotoAssetIds) drop out of candidates —
// only NEW photos keep prompting. photoPoint(i) → candidate assetId `asset-i`.
const usedPhotosDay = makeDay({
  locations: [photoPoint(0), photoPoint(1), photoPoint(2), photoPoint(3), photoPoint(4)],
  usedPhotoAssetIds: ['asset-0'],
});
const usedPhotoPrompt = promptEngine.selectActiveDayPrompt(usedPhotosDay, new Date('2026-06-17T19:00:00'));
check(
  'already-vaulted photos are excluded from candidates',
  usedPhotoPrompt?.photoCandidates.length === 4 &&
    usedPhotoPrompt.photoCandidates.every((c) => c.assetId !== 'asset-0'),
  String(usedPhotoPrompt?.photoCandidates.length)
);
check(
  'no photo prompt once every photo is already vaulted',
  promptEngine.selectActiveDayPrompt(
    makeDay({
      locations: [photoPoint(0), photoPoint(1), photoPoint(2)],
      usedPhotoAssetIds: ['asset-0', 'asset-1', 'asset-2'],
    }),
    new Date('2026-06-17T19:00:00')
  )?.id !== 'meaningful_photo'
);

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
  'meaning is no longer a standalone surfaced prompt (asked in-flow on photo-essence)',
  promptEngine.selectActiveDayPrompt(heroPhotoDay, new Date('2026-06-17T19:00:00'))?.id !== 'meaning'
);

// --- "Add to today" menu: listAvailableDayPrompts + buildDayPromptByKind ---

// Daypart-independent: a launched, unanswered prompt is available even outside
// its daypart window so the menu can offer it.
const menuDay = makeDay();
const menuKinds = promptEngine.listAvailableDayPrompts(menuDay, new Date('2026-06-17T08:00:00')).map((p) => p.id);
check('menu lists multiple categories', menuKinds.length >= 2, menuKinds.join(','));
check('menu excludes non-launched prompts', !menuKinds.includes('intention'), menuKinds.join(','));

// --- Daylio-style expansion: new categories + icon coverage ---
check('menu offers Sleep and Hobby', menuKinds.includes('sleep') && menuKinds.includes('hobby'), menuKinds.join(','));
const launched = dayPrompts.launchedDayPrompts;
check('sleep + hobby are launched', launched.some((p) => p.id === 'sleep') && launched.some((p) => p.id === 'hobby'), launched.map((p) => p.id).join(','));
check(
  'every launched prompt has a category icon',
  launched.every((p) => typeof p.categoryIcon === 'string' && p.categoryIcon.length > 0),
  launched.filter((p) => !p.categoryIcon).map((p) => p.id).join(',')
);
check(
  'every launched option carries an icon',
  launched.every((p) => p.options.every((o) => typeof o.icon === 'string' && o.icon.length > 0)),
  launched.flatMap((p) => p.options.filter((o) => !o.icon).map((o) => `${p.id}:${o.id}`)).join(',')
);
// The hobby options carry their encounter seeds (movie → cinema, reading →
// bookstore, sport → gym) so a logged hobby can hatch its creature.
const hobby = launched.find((p) => p.id === 'hobby');
const hobbySeed = (id) => hobby.options.find((o) => o.id === id)?.encounterSeedBias?.[0]?.seedId;
check(
  'hobby options map to encounter seeds (incl. gaming + live music)',
  hobbySeed('movie') === 'cinema' &&
    hobbySeed('reading') === 'bookstore' &&
    hobbySeed('gaming') === 'gaming_session' &&
    hobbySeed('music') === 'live_music',
  JSON.stringify(hobby.options.map((o) => ({ id: o.id, seed: o.encounterSeedBias?.[0]?.seedId })))
);
const sleep = launched.find((p) => p.id === 'sleep');
const sleepSeed = (id) => sleep.options.find((o) => o.id === id)?.encounterSeedBias?.[0]?.seedId;
check(
  'sleep maps great→well_rested and barely→tender_day',
  sleepSeed('great') === 'well_rested' && sleepSeed('barely') === 'tender_day',
  JSON.stringify(sleep.options.map((o) => ({ id: o.id, seed: o.encounterSeedBias?.[0]?.seedId })))
);

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
