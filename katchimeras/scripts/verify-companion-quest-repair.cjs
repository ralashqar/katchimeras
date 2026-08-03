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

const definitionsPath = path.join(tempDir, 'definitions.js');
fs.writeFileSync(definitionsPath, `
const familyByQuestId = {
  'quest-mossprout-green-photo': 'mossprout',
  'quest-mossprout-memory': 'mossprout',
  'quest-mossprout-tend': 'mossprout',
};
exports.questDefinition = (questId) => {
  const familyId = familyByQuestId[questId];
  if (questId === 'quest-mossprout-memory') return { id: questId, familyId, lane: 'mini_game' };
  return familyId ? { id: questId, familyId, lane: 'real_life' } : null;
};
`);

const devSettingsPath = transpile('utils/dev-settings.ts', 'dev-settings.js');
const questOfferOrderPath = transpile('utils/quest-offer-order.ts', 'quest-offer-order.js');
const questsPath = transpile('utils/katchimera-quests.ts', 'katchimera-quests.js');

const stubs = {
  '@/utils/app-storage': storagePath,
  '@/utils/quests/runtime': runtimePath,
  '@/utils/quests/evaluate': evaluatePath,
  '@/utils/quests/definitions': definitionsPath,
  '@/utils/dev-settings': devSettingsPath,
  '@/utils/quest-offer-order': questOfferOrderPath,
};

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request in stubs) return stubs[request];
  return originalResolve.call(this, request, parent, ...rest);
};

const { setQuestLoopAfterCompleteEnabled } = require(devSettingsPath);
const { acceptGameHubQuest, acceptQuest, completeInteractiveQuest, completeQuest, evaluateCompanionQuests, gameHubQuestFor, hasCompanionQuestForDay, isQuestCompletedForDay, migrateCompanionQuestIdentity, questFor, questOffersForDay, reconcileActiveQuestPool, reconcileCompanionQuestOffer, startQuestAttempt } = require(questsPath);

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

const staleNatureCycle = {
  schemaVersion: 2,
  quests: [],
  submissions: [],
  attempts: [],
  offerCycles: [{
    creatureId: 'companion:nature-outdoors',
    dayId: '2026-07-21',
    offerIds: ['quest-visit-beach', 'quest-photo-water'],
    index: 0,
  }],
};
const mossproutOffers = [
  { id: 'quest-mossprout-green-photo', weight: 5 },
  { id: 'quest-mossprout-memory', weight: 3 },
];
const refreshedNatureOffers = questOffersForDay(
  staleNatureCycle,
  'companion:nature-outdoors',
  '2026-07-21',
  mossproutOffers,
  mossproutOffers.length
);
check(
  'rebuilds a cached daily order when the companion quest pool changes',
  refreshedNatureOffers.length === mossproutOffers.length
    && refreshedNatureOffers.every((offer) => mossproutOffers.some((candidate) => candidate.id === offer.id)),
  JSON.stringify(refreshedNatureOffers)
);
const staleActiveNatureQuest = {
  ...staleNatureCycle,
  quests: [{
    questId: 'quest-visit-beach',
    creatureId: 'companion:mossprout',
    title: 'To the shore',
    hint: 'Spend time by the beach.',
    acceptedAt: 100,
  }],
};
const repairedActiveNatureQuest = reconcileActiveQuestPool(
  staleActiveNatureQuest,
  'companion:mossprout',
  mossproutOffers
);
check(
  'removes a stale active quest that is outside the companion current pool',
  questFor(repairedActiveNatureQuest, 'companion:mossprout') === null
);
const staleMossproutWateringQuest = {
  ...staleNatureCycle,
  quests: [{
    questId: 'quest-mossprout-tend',
    creatureId: 'companion:mossprout',
    title: 'Tend Mossprout’s patch',
    hint: 'Water the patch.',
    acceptedAt: 100,
  }],
};
const repairedMossproutWateringQuest = reconcileActiveQuestPool(
  staleMossproutWateringQuest,
  'companion:mossprout',
  mossproutOffers
);
check(
  'retires an already-active Mossprout watering game so the garden matcher can be chosen',
  questFor(repairedMossproutWateringQuest, 'companion:mossprout') === null
);

const splitAspectCases = [
  ['food-cooking', 'feastle', 'quest-feastle-merge', 'quest-cuisine-italian'],
  ['movement-fitness', 'steppling', 'quest-steppling-stride', 'quest-flexel-training-detail'],
  ['rest-sleep', 'sleep-rest', 'quest-bedrotte-breathe', 'quest-late-capture'],
  ['social-connection', 'gatherglow', 'quest-gatherglow-pattern', 'quest-snap-today'],
  ['parenting-caregiving', 'snuglet', 'quest-snuglet-care-detail', 'quest-snap-today'],
  ['pet-companionship', 'waglet', 'quest-waglet-care-detail', 'quest-whiskit-enrichment-detail'],
  ['life-admin', 'errandimp', 'quest-errandimp-sort', 'quest-snap-today'],
  ['learning-culture', 'pagelet', 'quest-pagelet-word-paths', 'quest-relicoon-match'],
  ['hobbies-creativity', 'flickerbun', 'quest-film-trivia', 'quest-encora-rhythm'],
  ['nature-outdoors', 'mossprout', 'quest-mossprout-memory', 'quest-visit-beach'],
  ['weather-atmosphere', 'mistle', 'quest-weather-fog', 'quest-weather-storm'],
  ['travel-exploration', 'skylo', 'quest-skylo-city-trivia', 'quest-snap-today'],
  ['milestones-chapters', 'cheerlet', 'quest-cheerlet-block-party', 'quest-snap-today'],
];
for (const [aspectId, familyId, validQuestId, staleQuestId] of splitAspectCases) {
  const creatureId = `companion:${familyId}`;
  const state = {
    ...staleNatureCycle,
    offerCycles: [],
    quests: [{
      questId: staleQuestId,
      creatureId,
      title: 'Stale merged-aspect quest',
      hint: 'This belongs to another family.',
      acceptedAt: 100,
    }],
  };
  const repaired = reconcileActiveQuestPool(state, creatureId, [{ id: validQuestId }]);
  check(
    `${aspectId} split family rejects a stale sibling quest`,
    questFor(repaired, creatureId) === null
  );
}

const familyOwnedMigration = migrateCompanionQuestIdentity(
  {
    ...staleNatureCycle,
    quests: [{
      questId: 'quest-mossprout-memory',
      creatureId: 'companion:nature-outdoors',
      title: 'Mossprout’s garden pairs',
      hint: 'Match the plants.',
      acceptedAt: 100,
      completedAt: 200,
    }],
    submissions: [{
      id: 'submission-1',
      questId: 'quest-mossprout-memory',
      creatureId: 'companion:nature-outdoors',
      dayId: '2026-07-21',
      sourceType: 'mini_game',
      sourceId: 'attempt-1',
      submittedAt: 200,
    }],
    attempts: [{
      id: 'attempt-1',
      questId: 'quest-mossprout-memory',
      creatureId: 'companion:nature-outdoors',
      dayId: '2026-07-21',
      status: 'succeeded',
      startedAt: 100,
      endedAt: 200,
    }],
    offerCycles: [{
      creatureId: 'companion:nature-outdoors',
      dayId: '2026-07-21',
      offerIds: ['quest-mossprout-green-photo', 'quest-mossprout-memory', 'quest-snap-today'],
      index: 0,
    }],
  },
  () => 'companion:shellio'
);
check(
  'family-owned quest history survives a broad-aspect split under the correct companion',
  familyOwnedMigration.quests[0].creatureId === 'companion:mossprout'
    && familyOwnedMigration.submissions[0].creatureId === 'companion:mossprout'
    && familyOwnedMigration.attempts[0].creatureId === 'companion:mossprout'
    && familyOwnedMigration.offerCycles[0].creatureId === 'companion:mossprout',
  JSON.stringify(familyOwnedMigration)
);

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
const legacySubmissionOnly = {
  quests: [],
  submissions: [{
    id: 'legacy-submission',
    questId: 'quest-watch-film',
    creatureId: 'location_cinema_flickerbun',
    dayId: '2026-07-07',
    sourceType: 'photo',
    sourceId: 'legacy-photo',
    submittedAt: new Date('2026-07-07T21:00:00').getTime(),
  }],
  offerCycles: [],
  attempts: [],
};
check('a retained submission restores a completion whose old quest row was deleted', isQuestCompletedForDay(legacySubmissionOnly, 'location_cinema_flickerbun', 'quest-watch-film', '2026-07-07'));
check('a retained real-life submission blocks same-day reaccept', acceptQuest(
  legacySubmissionOnly,
  {
    questId: 'quest-watch-film',
    creatureId: 'location_cinema_flickerbun',
    title: 'Roll the reel',
    hint: 'Log a film.',
    dayId: '2026-07-07',
  },
  new Date('2026-07-07T22:00:00').getTime()
) === null);
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

const miniAccepted = acceptQuest(
  { quests: [], submissions: [], offerCycles: [], attempts: [] },
  {
    questId: 'quest-mossprout-memory',
    creatureId: 'companion:mossprout',
    title: 'Mossprout’s garden pairs',
    hint: 'Match the garden cards.',
    dayId: '2026-07-07',
  },
  new Date('2026-07-07T18:00:00').getTime()
);
const miniCompleted = completeQuest(
  miniAccepted,
  'companion:mossprout',
  new Date('2026-07-07T18:05:00').getTime(),
  '2026-07-07'
);
const miniReplay = acceptQuest(
  miniCompleted,
  {
    questId: 'quest-mossprout-memory',
    creatureId: 'companion:mossprout',
    title: 'Mossprout’s garden pairs',
    hint: 'Match the garden cards.',
    dayId: '2026-07-07',
  },
  new Date('2026-07-07T18:10:00').getTime()
);
check('completed mini-game can be accepted again on the same day', !!miniReplay && Boolean(questFor(miniReplay, 'companion:mossprout')));

setQuestLoopAfterCompleteEnabled(true);
check('developer replay setting does not hide real-life completion history', hasCompanionQuestForDay(cashedIn, 'location_cinema_flickerbun', '2026-07-07'));
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
check('developer replay setting cannot reaccept a completed real-life quest that day', legacyCompletedRetry === null);

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
check('real-life completion remains persisted with developer replay enabled', loopComplete.quests.length === 1 && Boolean(loopComplete.quests[0].completedAt), JSON.stringify(loopComplete.quests));
check('persisted real-life completion keeps the same day locked', hasCompanionQuestForDay(loopComplete, 'location_cinema_flickerbun', '2026-07-07'));
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
check('same-day real-life retry stays blocked with developer replay enabled', loopRetry === null);

global.__QUEST_RUNTIME_COMPLETE__ = true;
const nextDayLoopAccepted = acceptQuest(
  loopComplete,
  {
    questId: 'quest-watch-film',
    creatureId: 'location_cinema_flickerbun',
    title: 'Roll the reel',
    hint: 'Log a film.',
    dayId: '2026-07-08',
  },
  new Date('2026-07-08T20:00:00').getTime()
);
const loopAuto = evaluateCompanionQuests(nextDayLoopAccepted, {}, new Date('2026-07-08T22:30:00').getTime(), null, '2026-07-08');
check('automatic completion still reports the newly completed quest', loopAuto.completed.length === 1, String(loopAuto.completed.length));
check('automatic real-life completion remains in history', loopAuto.state.quests.length === 2 && loopAuto.state.quests.every((quest) => Boolean(quest.completedAt)), JSON.stringify(loopAuto.state.quests));

const concurrentCompanion = acceptQuest(
  { schemaVersion: 4, quests: [], submissions: [], offerCycles: [], attempts: [] },
  { questId: 'quest-rest-note', creatureId: 'companion:sleep-rest', title: 'Keep a rest note', hint: 'Keep one detail.', dayId: '2026-08-03' },
  100
);
const concurrentHub = acceptGameHubQuest(concurrentCompanion, {
  questId: 'quest-bedrotte-breathe', creatureId: 'companion:sleep-rest', title: 'Breathe together', hint: 'Take a slow breath.',
  dayId: '2026-08-03', offerSeed: 'sleep-rest:round', resolvedConfig: { cycles: 4 },
}, 200);
check('hub acceptance preserves the companion quest', questFor(concurrentHub.state, 'companion:sleep-rest')?.questId === 'quest-rest-note');
check('hub acceptance creates a separately addressable run', gameHubQuestFor(concurrentHub.state, 'companion:sleep-rest')?.questId === 'quest-bedrotte-breathe');
const hubAttempt = startQuestAttempt(concurrentHub.state, {
  questId: 'quest-bedrotte-breathe', creatureId: 'companion:sleep-rest', dayId: '2026-08-03', seed: 'sleep-rest:round',
  executionKind: 'paced_breathing', configSnapshot: { cycles: 4 }, questRunId: concurrentHub.quest.questRunId,
}, 300);
const hubCompleted = completeInteractiveQuest(hubAttempt.state, {
  attemptId: hubAttempt.attempt.id, creatureId: 'companion:sleep-rest', dayId: '2026-08-03',
  result: { kind: 'paced_breathing', success: true, completedCycles: 4, durationMs: 40000 },
}, 400);
check('hub completion targets only its quest run', !questFor(hubCompleted, 'companion:sleep-rest')?.completedAt && hubCompleted.quests.find((quest) => quest.questRunId === concurrentHub.quest.questRunId)?.completedAt === 400);

console.log(failures === 0 ? '\nAll companion quest repair checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
