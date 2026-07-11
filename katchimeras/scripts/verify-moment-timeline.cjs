const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-moment-timeline-'));

function transpile(relativePath, outName) {
  const source = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const outPath = path.join(tempDir, outName);
  fs.writeFileSync(outPath, output);
  return outPath;
}

const promptsPath = transpile('constants/day-prompts.ts', 'day-prompts.js');
const studioPath = transpile('utils/studio-detect.ts', 'studio-detect.js');
const displayPath = transpile('utils/memory-display.ts', 'memory-display.js');
const timelinePath = transpile('utils/moment-timeline.ts', 'moment-timeline.js');
const typesPath = path.join(tempDir, 'types.js');
fs.writeFileSync(typesPath, '');

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === '@/constants/day-prompts') return promptsPath;
  if (request === '@/utils/studio-detect') return studioPath;
  if (request === '@/utils/memory-display') return displayPath;
  if (request === '@/types/home' || request === '@/components/ui/icon-symbol') return typesPath;
  return originalResolve.call(this, request, ...rest);
};

const { buildMomentTimeline } = require(timelinePath);
const at = (minute) => `2026-07-10T12:${String(minute).padStart(2, '0')}:00.000Z`;
const day = {
  id: 'day-2026-07-10',
  isoDate: '2026-07-10',
  moments: [],
  promptAnswers: [{
    id: 'activity', kind: 'activity', choiceIds: ['work'], labels: ['Work'], createdAt: at(1),
    dismissed: false, semanticTags: [], scoreBias: {}, encounterSeedBias: [],
  }],
  capturedMeanings: [{ archetype: 'meaningful', label: 'A photo', thumbnailUri: 'photo', sourceId: 'p1', createdAt: at(2) }],
  notes: [{ id: 'n1', kind: 'text', archetype: 'calm', label: 'A note', text: 'hello', audioUri: null, createdAt: at(3) }],
  foodMoments: [
    { id: 'f1', label: 'Lunch', emoji: '🍽', meaning: 'fuel', cuisine: 'japanese', source: 'manual', createdAt: at(4) },
    { id: 'f-auto', label: 'Detected cake', emoji: '🍰', meaning: 'treat', source: 'photo', createdAt: at(4) },
  ],
  studioMoments: [
    { id: 's1', label: 'A film', emoji: '🎬', mediaType: 'film', rating: 'liked', source: 'manual', createdAt: at(5) },
    { id: 's-auto', label: 'Detected show', emoji: '📺', mediaType: 'show', rating: 'liked', source: 'photo', createdAt: at(5) },
  ],
  confirmedPlaces: [{ id: 'place', label: 'Café', meaningLabel: 'Caught up', confirmedAt: at(6) }],
  stepsInterpretation: { movement: 'transit', label: 'Just transit', emoji: '🚇', createdAt: at(7) },
  bigMoments: [{ id: 'big', type: 'milestone', label: 'A milestone', subject: null, noteId: null, createdAt: at(8) }],
  sleep: { quality: 'good', source: 'manual', recordedAt: at(9) },
};

let failures = 0;
function check(label, condition, detail) {
  if (condition) console.log(`  ok  ${label}`);
  else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

const timeline = buildMomentTimeline(day);
const categories = new Set(timeline.map((entry) => entry.category));
for (const category of ['Activity', 'Photo', 'Written note', 'Food & drink', 'Watch, read, listen', 'Place', 'Movement', 'Life event', 'Sleep']) {
  check(`manual + ${category} appears`, categories.has(category), JSON.stringify(timeline));
}
check('unconfirmed automatic food is not shown as a user moment', !timeline.some((entry) => entry.id === 'food:f-auto'));
check('unconfirmed automatic media is not shown as a user moment', !timeline.some((entry) => entry.id === 'studio:s-auto'));
check('timeline is chronological', timeline.every((entry, index) => index === 0 || timeline[index - 1].time <= entry.time));
check('timeline promotes cuisine over generic food label', timeline.some((entry) => entry.id === 'food:f1' && entry.label === 'Japanese'));
check('legacy manual sleep without a timestamp still appears', buildMomentTimeline({ ...day, sleep: { quality: 'normal', source: 'manual' } }).some((entry) => entry.id === 'sleep:2026-07-10'));

const heroDay = {
  ...day,
  promptAnswers: [{
    id: 'meaning', kind: 'meaning', choiceIds: ['meaningful'], labels: ['Worth keeping'], createdAt: at(10),
    dismissed: false, semanticTags: [], scoreBias: {}, encounterSeedBias: [],
  }],
  heroPhoto: {
    assetId: 'hero', thumbnailUri: 'hero', selectedAt: at(10), meaningChoiceIds: ['meaningful'], meaningLabels: ['Worth keeping'],
  },
};
check('hero meaning is not duplicated by its prompt answer', buildMomentTimeline(heroDay).filter((entry) => entry.label === 'Worth keeping').length === 1);

const todayCategoriesSource = fs.readFileSync(path.join(projectRoot, 'utils/today-categories.ts'), 'utf8');
const journalSource = fs.readFileSync(path.join(projectRoot, 'components/katchadeck/home/day-journal-sections.tsx'), 'utf8');
const sanctuarySource = fs.readFileSync(path.join(projectRoot, 'components/katchadeck/world/sanctuary-sheet.tsx'), 'utf8');
check('Moments badge uses the shared projection', todayCategoriesSource.includes('buildMomentTimeline(day).length'));
check('Today timeline uses the shared projection', journalSource.includes('buildMomentTimeline(day).map'));
check('pressed Moments reader uses the shared projection', sanctuarySource.includes('buildMomentTimeline(day).map'));

Module._resolveFilename = originalResolve;
fs.rmSync(tempDir, { recursive: true, force: true });
console.log(failures === 0 ? '\nAll moment-timeline checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
