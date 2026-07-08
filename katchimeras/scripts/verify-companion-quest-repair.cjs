const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-quest-repair-'));

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
fs.writeFileSync(storagePath, 'exports.getStoredJson = (_key, fallback) => fallback; exports.setStoredJson = () => {};');

const runtimePath = path.join(tempDir, 'runtime.js');
fs.writeFileSync(runtimePath, 'exports.evaluateQuestRuntime = () => ({ complete: false });');

const evaluatePath = path.join(tempDir, 'evaluate.js');
fs.writeFileSync(evaluatePath, 'exports.questCriteriaStatus = () => [];');

const questsPath = transpile('utils/katchimera-quests.ts', 'katchimera-quests.js');

const stubs = {
  '@/utils/app-storage': storagePath,
  '@/utils/quests/runtime': runtimePath,
  '@/utils/quests/evaluate': evaluatePath,
};

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request in stubs) return stubs[request];
  return originalResolve.call(this, request, parent, ...rest);
};

const { acceptQuest, completeQuest, hasCompanionQuestForDay, questFor, reconcileCompanionQuestOffer } = require(questsPath);

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

console.log(failures === 0 ? '\nAll companion quest repair checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
