// Node-only verification harness for the Memory Quests engine. No test runner in
// this project: transpile the pure module with TypeScript and run scenarios.
// Usage: node scripts/verify-memory-quests.cjs
const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-quests-'));

function transpileToTemp(relativeSourcePath, outName) {
  const source = fs.readFileSync(path.join(projectRoot, relativeSourcePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const outPath = path.join(tempDir, outName);
  fs.writeFileSync(outPath, output);
  return outPath;
}

// memory-quests-engine imports @/utils/food-detect; transpile + alias it.
const foodDetectPath = transpileToTemp('utils/food-detect.ts', 'food-detect.js');
const stubs = { '@/utils/food-detect': foodDetectPath };
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request in stubs) return stubs[request];
  return originalResolve.call(this, request, ...rest);
};

const engine = require(transpileToTemp('utils/memory-quests-engine.ts', 'memory-quests-engine.js'));

let failures = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok  ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

const morning = new Date('2026-06-17T09:00:00');
const evening = new Date('2026-06-17T19:00:00');

function day(overrides = {}) {
  return {
    isoDate: '2026-06-17',
    notes: [],
    capturedMeanings: [],
    heroPhoto: null,
    moments: [],
    promptAnswers: [],
    confirmedPlaces: [],
    visitedPlaceCount: 0,
    bigMoments: [],
    foodMoments: [],
    ...overrides,
  };
}

const lunch = new Date('2026-06-17T12:30:00');
const lateNight = new Date('2026-06-17T22:30:00');

const meaning = { archetype: 'calm', label: 'A slow sip', thumbnailUri: null, createdAt: '' };

// --- generation ---
const empty = engine.selectMemoryQuests(day(), morning);
check('an empty day offers Capture', empty.some((q) => q.type === 'captureMoment'));
check('an empty day offers Reflection', empty.some((q) => q.type === 'answerReflection'));
check('never more than 3 quests', empty.length <= 3, String(empty.length));
check('a late evening offers a voice memory', engine.selectMemoryQuests(day(), lateNight).some((q) => q.type === 'recordVoiceMemory'));
check('meal time offers a food memory', engine.selectMemoryQuests(day(), lunch).some((q) => q.type === 'saveFoodMemory'));
check('no food quest outside meal times', !engine.selectMemoryQuests(day(), lateNight).some((q) => q.type === 'saveFoodMemory'));
check(
  'detected food offers the food quest even off meal times',
  engine
    .selectMemoryQuests(day({ vision: { concepts: [{ name: 'coffee' }], details: [], textTokens: [] } }), lateNight)
    .some((q) => q.type === 'saveFoodMemory')
);
check('no Place quest until a place was visited', !engine.selectMemoryQuests(day(), evening).some((q) => q.type === 'markPlace'));
check(
  'Place quest appears once a place was visited',
  engine.selectMemoryQuests(day({ visitedPlaceCount: 1 }), evening).some((q) => q.type === 'markPlace')
);

// --- completion (derived from signals) ---
check('Capture completes with a captured meaning', engine.isQuestComplete('captureMoment', day({ capturedMeanings: [meaning] })));
check('Capture completes with a photo moment', engine.isQuestComplete('captureMoment', day({ moments: [{ type: 'photo' }] })));
check('Capture is incomplete on a bare day', !engine.isQuestComplete('captureMoment', day()));
check('Voice completes with a voice note', engine.isQuestComplete('recordVoiceMemory', day({ notes: [{ kind: 'voice' }] })));
check('Voice ignores a text note', !engine.isQuestComplete('recordVoiceMemory', day({ notes: [{ kind: 'text' }] })));
check('Reflection completes with a feeling answer', engine.isQuestComplete('answerReflection', day({ promptAnswers: [{ kind: 'feeling', dismissed: false }] })));
check('Reflection ignores a dismissed answer', !engine.isQuestComplete('answerReflection', day({ promptAnswers: [{ kind: 'feeling', dismissed: true }] })));
check('Place completes with a confirmed place', engine.isQuestComplete('markPlace', day({ confirmedPlaces: [{ id: 'p' }] })));
check('Big Moment completes once a big moment is marked', engine.isQuestComplete('markBigMoment', day({ bigMoments: [{ type: 'birthday' }] })));
check('Food completes once a food memory is saved', engine.isQuestComplete('saveFoodMemory', day({ foodMoments: [{ id: 'f', meaning: 'treat' }] })));
check('Big Moment is offered on a bare day', engine.selectMemoryQuests(day(), morning).some((q) => q.type === 'markBigMoment'));

// --- namePatch (Phase B) ---
check('namePatch completes once the day is named', engine.isQuestComplete('namePatch', day({ dayName: 'A slow Sunday' })));
check('namePatch is incomplete when unnamed', !engine.isQuestComplete('namePatch', day()));
check('namePatch is offered once the day has content', engine.selectMemoryQuests(day({ capturedMeanings: [meaning] }), morning, 7).some((q) => q.type === 'namePatch'));
check('namePatch is NOT offered on an empty day', !engine.selectMemoryQuests(day(), morning, 7).some((q) => q.type === 'namePatch'));
check('every quest carries an essence reward', engine.selectMemoryQuests(day({ capturedMeanings: [meaning] }), morning, 7).every((q) => typeof q.essenceReward === 'number' && q.essenceReward > 0));

// --- ordering: completed quests sink below incomplete ones ---
const mixed = engine.selectMemoryQuests(day({ capturedMeanings: [meaning] }), morning, 7);
check('a completed quest is marked completed', mixed.find((q) => q.type === 'captureMoment')?.completed === true);
const firstCompleted = mixed.findIndex((q) => q.completed);
check(
  'incomplete quests sort before completed ones',
  firstCompleted === -1 || mixed.slice(0, firstCompleted).every((q) => !q.completed)
);

console.log(failures === 0 ? '\nAll memory-quest checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
