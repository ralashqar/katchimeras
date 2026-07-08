const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-quest-repair-'));
global.__DEV__ = true;

function transpile(relativeSourcePath, outName) {
  const source = fs.readFileSync(path.join(projectRoot, relativeSourcePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const outPath = path.join(tempDir, outName);
  fs.writeFileSync(outPath, output);
  return outPath;
}

const storagePath = path.join(tempDir, 'app-storage.js');
fs.writeFileSync(storagePath, `
const store = new Map();
exports.getStoredJson = (key, fallback) => store.has(key) ? store.get(key) : fallback;
exports.setStoredJson = (key, value) => store.set(key, value);
`);

const runtimePath = path.join(tempDir, 'runtime.js');
fs.writeFileSync(runtimePath, 'exports.evaluateQuestRuntime = () => ({ complete: global.__QUEST_RUNTIME_COMPLETE__ === true });');

const evaluatePath = path.join(tempDir, 'evaluate.js');
fs.writeFileSync(evaluatePath, 'exports.questCriteriaStatus = () => [];');

const devSettingsPath = transpile('utils/dev-settings.ts', 'dev-settings.js');
const questsPath = transpile('utils/katchimera-quests.ts', 'katchimera-quests.js');

const stubs = {
  '@/utils/app-storage': storagePath,
  '@/utils/quests/runtime': runtimePath,
  '@/utils/quests/evaluate': evaluatePath,
  '@/utils/dev-settings': devSettingsPath,
};

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request in stubs) return stubs[request];
  return originalResolve.call(this, request, parent, ...rest);
};

const { setQuestLoopAfterCompleteEnabled } = require(devSettingsPath);
const { acceptQuest, completeQuest, evaluateCompanionQuests, hasCompanionQuestForDay, questFor, reconcileCompanionQuestOffer } = require(questsPath);

let failures = 0;
function check(label, condition, detail) {
  if (condition) console.log(`  ok  ${label}`);
  else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

const staleState = {
  quests: [
    {
      questId: 'quest-new-park',
      creatureId: 'location_cinema_flickerbun',
      title: 'Find a new green corner',
      hint: 'Visit or log a park.',
      acceptedAt: 101,
    },
    {
      questId: 'quest-new-park',
      creatureId: 'location_park_mossprout',
      title: 'Find a new green corner',
      hint: 'Visit or log a park.',
      acceptedAt: 100,
      completedAt: 120,
    },
  ],
};

const repaired = reconcileCompanionQuestOffer(
  staleState,
  {
    questId: 'quest-watch-film',
    creatureId: 'location_cinema_flickerbun',
    title: 'Roll the reel',
    hint: 'Log a film, cinema trip, or movie note today.',
  },
  200
);
const active = questFor(repaired, 'location_cinema_flickerbun');

check('repairs Flickerbun active quest to cinema offer', active.questId === 'quest-watch-film', active.questId);
check('preserves original accepted time', active.acceptedAt === 101, String(active.acceptedAt));
check('records repaired-from quest id', active.repairedFromQuestId === 'quest-new-park', active.repairedFromQuestId);
check('records repaired timestamp', active.repairedAt === 200, String(active.repairedAt));
check('does not alter completed Mossprout history', repaired.quests[1].questId === 'quest-new-park' && repaired.quests[1].completedAt === 120);

const unchanged = reconcileCompanionQuestOffer(repaired, {
  questId: 'quest-watch-film',
  creatureId: 'location_cinema_flickerbun',
  title: 'Roll the reel',
  hint: 'Log a film, cinema trip, or movie note today.',
}, 300);
check('matching active quest returns same state object', unchanged === repaired);

const accepted = acceptQuest(
  { quests: [] },
  {
    questId: 'quest-watch-film',
    creatureId: 'location_cinema_flickerbun',
    title: 'Roll the reel',
    hint: 'Log a film.',
    dayId: '2026-07-07',
  },
  new Date('2026-07-07T20:00:00').getTime()
);
check('accept records the game day id', accepted.quests[0].acceptedDayId === '2026-07-07', accepted.quests[0].acceptedDayId);

const cashedIn = completeQuest(
  accepted,
  'location_cinema_flickerbun',
  new Date('2026-07-07T21:00:00').getTime(),
  '2026-07-07'
);
check('report-back completion is persisted', !!cashedIn.quests[0].completedAt);
check('completion records the game day id', cashedIn.quests[0].completedDayId === '2026-07-07', cashedIn.quests[0].completedDayId);
check(
  'completed quest blocks another offer that same game day',
  hasCompanionQuestForDay(cashedIn, 'location_cinema_flickerbun', '2026-07-07')
);
const sameDayRetry = acceptQuest(
  cashedIn,
  {
    questId: 'quest-watch-film',
    creatureId: 'location_cinema_flickerbun',
    title: 'Roll the reel',
    hint: 'Log a film.',
    dayId: '2026-07-07',
  },
  new Date('2026-07-07T22:00:00').getTime()
);
check('same-day reaccept is blocked', sameDayRetry === null);
const nextDayAccept = acceptQuest(
  cashedIn,
  {
    questId: 'quest-watch-film',
    creatureId: 'location_cinema_flickerbun',
    title: 'Roll the reel',
    hint: 'Log a film.',
    dayId: '2026-07-08',
  },
  new Date('2026-07-08T10:00:00').getTime()
);
check('next-day accept is allowed', !!nextDayAccept && questFor(nextDayAccept, 'location_cinema_flickerbun')?.acceptedDayId === '2026-07-08');

setQuestLoopAfterCompleteEnabled(true);
check('dev loop ignores already-completed quest history for same-day offer lock', !hasCompanionQuestForDay(cashedIn, 'location_cinema_flickerbun', '2026-07-07'));
const legacyCompletedRetry = acceptQuest(
  cashedIn,
  {
    questId: 'quest-watch-film',
    creatureId: 'location_cinema_flickerbun',
    title: 'Roll the reel',
    hint: 'Log a film.',
    dayId: '2026-07-07',
  },
  new Date('2026-07-07T22:10:00').getTime()
);
check('dev loop allows same-day reaccept from existing completed history', !!legacyCompletedRetry && questFor(legacyCompletedRetry, 'location_cinema_flickerbun')?.acceptedDayId === '2026-07-07');

const loopAccepted = acceptQuest(
  { quests: [] },
  {
    questId: 'quest-watch-film',
    creatureId: 'location_cinema_flickerbun',
    title: 'Roll the reel',
    hint: 'Log a film.',
    dayId: '2026-07-07',
  },
  new Date('2026-07-07T20:00:00').getTime()
);
const loopComplete = completeQuest(loopAccepted, 'location_cinema_flickerbun', new Date('2026-07-07T21:00:00').getTime(), '2026-07-07');
check('dev loop removes active quest instead of persisting completion', loopComplete.quests.length === 0, JSON.stringify(loopComplete.quests));
check('dev loop does not lock the katchimera for the same day', !hasCompanionQuestForDay(loopComplete, 'location_cinema_flickerbun', '2026-07-07'));
const loopRetry = acceptQuest(
  loopComplete,
  {
    questId: 'quest-watch-film',
    creatureId: 'location_cinema_flickerbun',
    title: 'Roll the reel',
    hint: 'Log a film.',
    dayId: '2026-07-07',
  },
  new Date('2026-07-07T22:00:00').getTime()
);
check('dev loop allows same-day reaccept', !!loopRetry && questFor(loopRetry, 'location_cinema_flickerbun')?.acceptedDayId === '2026-07-07');

global.__QUEST_RUNTIME_COMPLETE__ = true;
const loopAuto = evaluateCompanionQuests(loopRetry, {}, new Date('2026-07-07T22:30:00').getTime(), null, '2026-07-07');
check('dev loop auto-check still reports completion', loopAuto.completed.length === 1, String(loopAuto.completed.length));
check('dev loop auto-check clears active quest', loopAuto.state.quests.length === 0, JSON.stringify(loopAuto.state.quests));

console.log(failures === 0 ? '\nAll companion quest repair checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
