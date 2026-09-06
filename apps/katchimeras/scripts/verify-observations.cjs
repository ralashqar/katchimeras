const {contentPath, assetSpecifier, readVerificationSource} = require('@incubator/art-pipeline/context');
// Node-only verification harness for the Observatory observations engine.
// Usage: node scripts/verify-observations.cjs
const fs = require('fs');
const path = require('path');
const os = require('os');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-observations-'));

const SPECIFIER_MAP = {
  '@/utils/continuity-engine': './continuity-engine',
  '@/utils/memory-roles-engine': './memory-roles-engine',
  '@/utils/memory-display': './memory-display',
  '@/utils/studio-detect': './studio-detect',
};

function transpile(rel, out) {
  const source = readVerificationSource(contentPath(projectRoot, rel), 'utf8');
  let output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  for (const [from, to] of Object.entries(SPECIFIER_MAP)) {
    output = output.split(`"${from}"`).join(`"${to}"`).split(`'${from}'`).join(`'${to}'`);
  }
  fs.writeFileSync(path.join(tempDir, out), output);
}

transpile('utils/studio-detect.ts', 'studio-detect.js');
transpile('utils/memory-display.ts', 'memory-display.js');
transpile('utils/memory-roles-engine.ts', 'memory-roles-engine.js');
transpile('utils/continuity-engine.ts', 'continuity-engine.js');
transpile('utils/observations-engine.ts', 'observations-engine.js');

const { deriveContinuityMotifs } = require(path.join(tempDir, 'continuity-engine.js'));
const { deriveObservations } = require(path.join(tempDir, 'observations-engine.js'));

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
check('single quiet day produces no fake observation', deriveObservations({ days: quiet }).length === 0);

const cafeDays = [
  day(1, { confirmedPlaces: [{ id: 'p1', category: 'cafe', label: 'Cafe', archetype: 'calm', confirmedAt: '' }] }),
  day(2, { confirmedPlaces: [{ id: 'p2', category: 'cafe', label: 'Cafe', archetype: 'focus', confirmedAt: '' }] }),
];
const cafeObservations = deriveObservations({ days: cafeDays, motifs: deriveContinuityMotifs(cafeDays, 6) });
check('repeated cafe produces routine observation', cafeObservations.some((item) => item.kind === 'routine'));
check('routine observation keeps related day ids', cafeObservations.some((item) => item.kind === 'routine' && item.relatedDayIds.length === 2));

const movementDays = [
  day(1, { stepsCount: 6200 }),
  day(2, { stepsCount: 7100 }),
  day(3, { stepsCount: 9000 }),
];
check('three active recent days produce movement observation', deriveObservations({ days: movementDays }).some((item) => item.kind === 'movement'));

const moodDays = [
  day(1, { scores: { calm: 0.8, energy: 0, social: 0, exploration: 0, focus: 0 } }),
  day(2, { scores: { calm: 0.7, energy: 0, social: 0, exploration: 0, focus: 0 } }),
  day(3, { scores: { calm: 0.6, energy: 0, social: 0, exploration: 0, focus: 0 } }),
];
check('dominant recent mood produces mood observation', deriveObservations({ days: moodDays }).some((item) => item.kind === 'mood'));

const selected = day(4, {
  newPlaceCount: 1,
  visitedPlaceCount: 1,
  stepsCount: 12000,
  promptAnswers: [{ id: 'a1', kind: 'feeling', labels: ['Clear'], dismissed: false }],
  bigMoments: [{ id: 'b1', type: 'achievement', label: 'Goal achieved', subject: null, noteId: null, createdAt: '' }],
});
const selectedObservations = deriveObservations({ days: [selected], selectedDay: selected });
check('selected day new place produces place observation', selectedObservations.some((item) => item.id === 'day:day-4:new-place'));
check('selected day big moment produces life observation', selectedObservations.some((item) => item.kind === 'life'));
check('selected day observations include reflection prompt', selectedObservations.some((item) => item.kind === 'reflection' && item.prompt));

console.log(failures === 0 ? '\nAll observation checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
