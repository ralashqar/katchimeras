const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-runtime-'));

function transpile(relativeSourcePath, outName) {
  const source = fs.readFileSync(path.join(projectRoot, relativeSourcePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const outPath = path.join(tempDir, outName);
  fs.writeFileSync(outPath, output);
  return outPath;
}

const taxonomyPath = transpile('utils/intelligence/taxonomy.ts', 'taxonomy.js');
const scoringPath = transpile('utils/quests/evidence-scoring.ts', 'evidence-scoring.js');
const capsPath = transpile('utils/capabilities/quest-capabilities.ts', 'quest-capabilities.js');
const factsPath = transpile('utils/signals/facts.ts', 'facts.js');
const definitionsPath = transpile('utils/quests/definitions.ts', 'definitions.js');
const runtimePath = transpile('utils/quests/runtime.ts', 'runtime.js');
const typesPath = path.join(tempDir, 'types-home.js');
fs.writeFileSync(typesPath, '');

const stubs = {
  '@/types/home': typesPath,
  '@/utils/intelligence/taxonomy': taxonomyPath,
  '@/utils/quests/evidence-scoring': scoringPath,
  '@/utils/capabilities/quest-capabilities': capsPath,
  '@/utils/signals/facts': factsPath,
};
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request in stubs) return stubs[request];
  if (request === './definitions' && parent?.filename === runtimePath) return definitionsPath;
  return originalResolve.call(this, request, parent, ...rest);
};

const caps = require(capsPath);
const runtime = require(runtimePath);

let failures = 0;
function check(label, condition, detail) {
  if (condition) console.log(`  ok  ${label}`);
  else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

function photoEvidence(id, key, confidence) {
  return {
    id,
    sourceType: 'photo',
    sourceId: id,
    observedAt: '2026-07-07T12:00:00.000Z',
    provider: 'appleVision',
    confidence,
    signals: [{ key, confidence, provider: 'appleVision', source: 'vision' }],
  };
}

const completeDog = runtime.evaluateQuestRuntime({
  questId: 'quest-photo-dog',
  facts: { 'evidence.items': [photoEvidence('photo:dog', 'dog', 0.9)] },
});
check('photo evidence is ready for explicit submission', completeDog.state === 'ready_to_submit', completeDog.state);
check('photo evidence does not auto-complete before submission', completeDog.complete === false, String(completeDog.complete));
check('complete runtime exposes matched evidence id', completeDog.matchedEvidenceIds.includes('photo:dog'));

const incompleteDog = runtime.evaluateQuestRuntime({
  questId: 'quest-photo-dog',
  facts: { 'evidence.items': [photoEvidence('photo:cat', 'cat', 0.9)] },
});
check('wrong evidence stays in progress', incompleteDog.state === 'in_progress', incompleteDog.state);
check('photo quest suggests taking a photo', incompleteDog.nextAction === 'take_photo', incompleteDog.nextAction);

const blockedCaps = caps.defaultQuestCapabilities();
blockedCaps['camera.capture'] = { ...blockedCaps['camera.capture'], status: 'denied' };
const blockedDog = runtime.evaluateQuestRuntime({
  questId: 'quest-photo-dog',
  facts: { 'evidence.items': [] },
  capabilities: blockedCaps,
});
check('denied required capability blocks quest', blockedDog.state === 'blocked_permission', blockedDog.state);
check('blocked quest points to camera action', blockedDog.nextAction === 'enable_camera', blockedDog.nextAction);

const unavailableCaps = caps.defaultQuestCapabilities();
unavailableCaps['health.steps'] = { ...unavailableCaps['health.steps'], status: 'unavailable' };
const unavailableWalk = runtime.evaluateQuestRuntime({
  questId: 'quest-long-walk',
  facts: { 'steps.count': 0 },
  capabilities: unavailableCaps,
});
check('unavailable required capability marks quest unavailable', unavailableWalk.state === 'unavailable', unavailableWalk.state);

const unknownStepCaps = caps.defaultQuestCapabilities();
const partialWalk = runtime.evaluateQuestRuntime({
  questId: 'quest-long-walk',
  day: {
    id: 'day-2026-07-07',
    isoDate: '2026-07-07',
    state: 'forming',
    stepsCount: 4321,
    stepsCountDayId: '2026-07-07',
    stepsUpdatedAt: '2026-07-07T12:00:00.000Z',
  },
  facts: { 'steps.count': 4321 },
  capabilities: unknownStepCaps,
});
check('recorded steps bypass movement permission prompt', partialWalk.state === 'in_progress', partialWalk.state);
check('recorded steps do not point back to Health setup', partialWalk.nextAction === 'none', partialWalk.nextAction);
check('movement runtime exposes step progress label', partialWalk.progress[0]?.progressLabel === '4,321 / 8,000 steps today', partialWalk.progress[0]?.progressLabel);
check('movement runtime exposes step progress ratio', Math.abs((partialWalk.progress[0]?.progressRatio ?? 0) - 4321 / 8000) < 0.001);

const completeWalk = runtime.evaluateQuestRuntime({
  questId: 'quest-long-walk',
  facts: { 'steps.count': 9000 },
  capabilities: unknownStepCaps,
});
check('meeting step target completes even when capability status is stale unknown', completeWalk.state === 'complete', completeWalk.state);

const cheerletIncomplete = runtime.evaluateQuestRuntime({
  questId: 'quest-celebrate-note',
  facts: { 'notes.voiceAdded': 0 },
  capabilities: caps.defaultQuestCapabilities(),
});
check('celebration voice quest blocks when microphone is unknown', cheerletIncomplete.state === 'blocked_permission', cheerletIncomplete.state);
check('celebration voice quest missing microphone points to recording permission', cheerletIncomplete.nextAction === 'record_voice', cheerletIncomplete.nextAction);

const grantedMicCaps = caps.questCapabilitiesWithMicrophone(caps.defaultQuestCapabilities(), { granted: true, status: 'granted' });
const cheerletGrantedIncomplete = runtime.evaluateQuestRuntime({
  questId: 'quest-celebrate-note',
  facts: { 'notes.voiceAdded': 0 },
  capabilities: grantedMicCaps,
});
check('celebration voice quest is in progress when microphone is granted', cheerletGrantedIncomplete.state === 'in_progress', cheerletGrantedIncomplete.state);

const cheerletComplete = runtime.evaluateQuestRuntime({
  questId: 'quest-celebrate-note',
  facts: { 'notes.voiceAdded': 1 },
  capabilities: grantedMicCaps,
});
check('celebration voice note is ready for explicit submission', cheerletComplete.state === 'ready_to_submit', cheerletComplete.state);
check('celebration voice note does not auto-complete before submission', cheerletComplete.complete === false, String(cheerletComplete.complete));

const noteComplete = runtime.evaluateQuestRuntime({
  questId: 'quest-goal-note',
  facts: { 'notes.added': 1 },
  capabilities: caps.defaultQuestCapabilities(),
});
check('manual note quest keeps add-note action while awaiting submission', noteComplete.nextAction === 'add_note', noteComplete.nextAction);

console.log(failures === 0 ? '\nAll quest runtime checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
