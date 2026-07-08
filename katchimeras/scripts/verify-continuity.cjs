// Node-only verification harness for the Continuity engine.
// Usage: node scripts/verify-continuity.cjs
const fs = require('fs');
const path = require('path');
const os = require('os');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-continuity-'));

const SPECIFIER_MAP = {
  '@/utils/memory-roles-engine': './memory-roles-engine',
};

function transpile(rel, out) {
  const source = fs.readFileSync(path.join(projectRoot, rel), 'utf8');
  let output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  for (const [from, to] of Object.entries(SPECIFIER_MAP)) {
    output = output.split(`"${from}"`).join(`"${to}"`).split(`'${from}'`).join(`'${to}'`);
  }
  fs.writeFileSync(path.join(tempDir, out), output);
}

transpile('utils/memory-roles-engine.ts', 'memory-roles-engine.js');
transpile('utils/continuity-engine.ts', 'continuity-engine.js');

const { deriveContinuityMotifs, deriveWorldGuideMessage } = require(path.join(tempDir, 'continuity-engine.js'));

let failures = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok  ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

function day(index, overrides = {}) {
  const iso = `2026-06-${String(10 + index).padStart(2, '0')}`;
  return {
    id: `day-${index}`,
    isoDate: iso,
    dayLabel: `Day ${index}`,
    state: 'hatched',
    moments: [],
    promptAnswers: [],
    capturedMeanings: [],
    heroPhoto: null,
    confirmedPlaces: [],
    visitedPlaceCount: 0,
    newPlaceCount: 0,
    notes: [],
    bigMoments: [],
    foodMoments: [],
    studioMoments: [],
    stepsCount: 0,
    scores: { energy: 0, calm: 0, social: 0, exploration: 0, focus: 0 },
    ...overrides,
  };
}

const quiet = [day(1)];
check('single quiet day produces no motif', deriveContinuityMotifs(quiet).length === 0);

const cafeDays = [
  day(1, { confirmedPlaces: [{ id: 'p1', category: 'cafe', label: 'Cafe', archetype: 'calm', confirmedAt: '' }] }),
  day(2, { confirmedPlaces: [{ id: 'p2', category: 'cafe', label: 'Cafe', archetype: 'focus', confirmedAt: '' }] }),
];
check('repeated cafe becomes a routine motif', deriveContinuityMotifs(cafeDays).some((motif) => motif.kind === 'routine'));

const foodDays = [
  day(1, { foodMoments: [{ id: 'f1', label: 'Coffee', emoji: 'coffee', meaning: 'comfort', createdAt: '' }] }),
  day(2, { foodMoments: [{ id: 'f2', label: 'Coffee', emoji: 'coffee', meaning: 'comfort', createdAt: '' }] }),
];
check('repeated food becomes a food motif', deriveContinuityMotifs(foodDays).some((motif) => motif.kind === 'food'));

const studioDays = [
  day(1, { studioMoments: [{ id: 's1', label: 'Dune', mediaType: 'book', emoji: 'book', rating: 'liked', createdAt: '' }] }),
  day(2, { studioMoments: [{ id: 's2', label: 'Another book', mediaType: 'book', emoji: 'book', rating: 'inspired', createdAt: '' }] }),
];
check('repeated studio media type becomes a studio motif', deriveContinuityMotifs(studioDays).some((motif) => motif.kind === 'studio'));

const week = Array.from({ length: 7 }, (_, index) => day(index + 1));
check('seven hatched days produce first-week motif', deriveContinuityMotifs(week).some((motif) => motif.id === 'week:first-week-village'));

const forming = day(8, { state: 'forming' });
const guideQuest = deriveWorldGuideMessage({
  selectedDay: forming,
  days: [forming],
  motifs: [],
  quests: [{ id: 'q1', title: 'Capture a moment', completed: false }],
  chronicle: null,
  preferenceIds: ['cozy'],
});
check('guide prioritises open quest on forming day', guideQuest.actionType === 'openQuestBoard');

const guideChronicle = deriveWorldGuideMessage({
  selectedDay: day(1),
  days: [day(1)],
  motifs: [],
  quests: [],
  chronicle: { dateKey: '2026-06-11', title: 'A Day of Meaning', summary: 'Today was shaped by one memory.', timeline: [], shaped: ['memory'], hasStory: true },
});
check('guide opens chronicle when story exists', guideChronicle.actionType === 'openChronicle');

const guideStarter = deriveWorldGuideMessage({ selectedDay: null, days: [], motifs: [], quests: [], chronicle: null });
check('guide has starter fallback', guideStarter.actionType === 'addMoment');

console.log(failures === 0 ? '\nAll continuity checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
