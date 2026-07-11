// Node-only verification harness for Hatch Engine v2 (utils/hatch-selection.ts).
// Transpiles the pure modules with the TypeScript compiler and runs the
// probabilistic-draw acceptance scenarios. Usage:
//   node scripts/verify-hatch-selection.cjs
const fs = require('fs');
const path = require('path');
const Module = require('module');
const os = require('os');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-hatch-'));

function transpileToTemp(relativeSourcePath, outName) {
  const source = fs.readFileSync(path.join(projectRoot, relativeSourcePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const outPath = path.join(tempDir, outName);
  fs.writeFileSync(outPath, output);
  return outPath;
}

const encounterProfiles = JSON.parse(
  fs.readFileSync(path.join(projectRoot, 'data/katchimeras/encounter-katchimeras.json'), 'utf8')
).map((profile) => ({ ...profile, displayName: profile.name }));

const visualKeys = [
  'voltstep', 'hearthsip', 'glimmuse', 'skysette', 'creamalume', 'pulsepounce', 'gatherglow',
  'mossprout', 'lattelet', 'sprintail', 'neonpoko', 'crumbun', 'hayhorn', 'ironette',
  'bedrotte', 'steppling', 'errandimp', 'quietome', 'relicoon', 'shellio', 'flickerbun', 'baristabbit',
  'waglet', 'whiskit', 'snuglet', 'driftkin', 'duskle',
  'crustling', 'nigirimp', 'noodloo', 'sundael', 'bobaloo',
  'pagelet', 'hooplet', 'serveling', 'petalimp', 'fernip',
  'drizzlet', 'amberleaf', 'blossle', 'peakle', 'stillo', 'twinklet', 'feastle',
  'museling', 'tasklet', 'cheerlet', 'voyagle', 'skylo', 'flexel',
  'mendle', 'pixooka',
  'snoozle', 'encora', 'vesperitt', 'dawnle', 'tempesto', 'mistle',
];
const homeCreatureVisualsStub = Object.fromEntries(
  visualKeys.map((key) => [key, { source: 0, accentColor: '#FFFFFF' }])
);

const castPath = transpileToTemp('constants/encounter-cast.ts', 'encounter-cast.js');
const livingRarityPath = transpileToTemp('utils/living-rarity.ts', 'living-rarity.js');
const bondPath = transpileToTemp('utils/bond.ts', 'bond.js');
const visionSignalsPath = transpileToTemp('utils/vision-signals.ts', 'vision-signals.js');
const photoRealityPath = transpileToTemp('utils/photo-reality.ts', 'photo-reality.js');
const taxonomyPath = transpileToTemp('utils/intelligence/taxonomy.ts', 'intelligence-taxonomy.js');
const classificationPath = path.join(tempDir, 'intelligence-classification.js');
fs.writeFileSync(classificationPath, 'exports.assignmentSignals = () => [];');
const enginePath = transpileToTemp('utils/encounter-engine.ts', 'encounter-engine.js');
const selectionPath = transpileToTemp('utils/hatch-selection.ts', 'hatch-selection.js');

const stubs = {
  '@/constants/encounter-cast': castPath,
  '@/constants/home-mvp': { homeCreatureVisuals: homeCreatureVisualsStub },
  '@/constants/katchimera-encounter-profiles': { katchimeraEncounterProfiles: encounterProfiles },
  '@/utils/living-rarity': livingRarityPath,
  '@/utils/bond': bondPath,
  '@/utils/vision-signals': visionSignalsPath,
  '@/utils/photo-reality': photoRealityPath,
  '@/utils/intelligence/taxonomy': taxonomyPath,
  '@/utils/intelligence/classification': classificationPath,
  '@/utils/encounter-engine': enginePath,
  '@/utils/hatch-selection': selectionPath,
  '@/types/home': {},
  '@/types/katchimera': {},
};

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request in stubs) {
    const stub = stubs[request];
    if (typeof stub === 'string') {
      return stub;
    }
    const stubFile = path.join(tempDir, `${request.replace(/[@/]/g, '_')}.js`);
    if (!fs.existsSync(stubFile)) {
      fs.writeFileSync(stubFile, `module.exports = ${JSON.stringify(stub)};`);
    }
    return stubFile;
  }
  return originalResolve.call(this, request, ...rest);
};

const engine = require(enginePath);
const selection = require(selectionPath);
const { selectHatch, makeSeededRng } = selection;

function makeDay(overrides = {}) {
  return {
    id: 'day-2026-06-12',
    isoDate: '2026-06-12',
    state: 'ready_to_hatch',
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
    storedNonce: 'nonce-test',
    ...overrides,
  };
}

function makeMoment(type, index = 0) {
  return {
    id: `m-${type}-${index}`,
    type,
    label: type,
    icon: 'sparkles',
    accentColor: '#FFF',
    createdAt: '2026-06-12T10:00:00.000Z',
    source: 'quick_tag',
    metadata: null,
  };
}

function makePromptAnswer(kind, choiceIds, labels, semanticTags, scoreBias = {}, encounterSeedBias = []) {
  return {
    id: `prompt-${kind}-${choiceIds.join('-')}`,
    kind,
    choiceIds,
    labels,
    createdAt: '2026-06-12T18:00:00.000Z',
    source: 'prompt_chip',
    semanticTags,
    scoreBias,
    encounterSeedBias,
  };
}

// A vision concept with directly-controlled coverage/peak so candidate
// intensities are exact (vision intensity = 0.4 + 0.35*coverage + 0.1*peak).
function visionConcept(name, coverage, peak) {
  return { name, salience: coverage * 2, coverage, count: Math.round(coverage * 4), peakConfidence: peak };
}
function visionDay(concepts, overrides = {}) {
  return makeDay({
    stepsCount: 2000,
    vision: { concepts, details: [], maxFaceCount: 0, faceCoverage: 0, textTokens: [], analyzedPhotoCount: 4 },
    ...overrides,
  });
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

const DOG = 'subject_dog_companion_waglet';
const CAT = 'subject_cat_companion_whiskit';

function probOf(result, profileId) {
  const row = result.probabilities.find((entry) => entry.profileId === profileId);
  return row ? row.probability : 0;
}

// --- 1. Purity / reproducibility -------------------------------------------
const reproDay = visionDay([visionConcept('dog', 0.9, 0.9), visionConcept('cat', 0.3, 0.6)]);
const reproA = selectHatch({ day: reproDay, history: {}, rng: makeSeededRng('seed-xyz') });
const reproB = selectHatch({ day: reproDay, history: {}, rng: makeSeededRng('seed-xyz') });
check('same (day, seed) is reproducible',
  JSON.stringify(reproA) === JSON.stringify(reproB),
  JSON.stringify({ a: reproA?.creature?.name, b: reproB?.creature?.name }));
check('selection returns a creature with v2 fields',
  reproA?.creature?.pickProbability != null && Array.isArray(reproA?.creature?.fieldEchoes) && Array.isArray(reproA?.creature?.birthSignals),
  JSON.stringify({ p: reproA?.creature?.pickProbability, echoes: reproA?.creature?.fieldEchoes?.length }));

// --- 2. Probabilistic distribution: leader wins 70-85% at tau=0.18 ---------
// dog (cov .9 peak .9 -> 0.805 + novelty .22 = 1.025) vs cat (cov .3 peak .6 ->
// 0.565 + .22 = 0.785). gap 0.24 -> p_dog ~= 0.79.
const distDay = visionDay([visionConcept('dog', 0.9, 0.9), visionConcept('cat', 0.3, 0.6)]);
const TRIALS = 4000;
let dogWins = 0;
for (let i = 0; i < TRIALS; i += 1) {
  const result = selectHatch({ day: distDay, history: {}, rng: makeSeededRng(`run-${i}`) });
  if (result.creature.encounterProfileId === DOG) dogWins += 1;
}
const dogRate = dogWins / TRIALS;
check('leader wins between 70% and 85% (probabilistic, not argmax)',
  dogRate >= 0.7 && dogRate <= 0.85, `dog win rate=${dogRate.toFixed(3)}`);
check('the underdog still wins sometimes (true sampling)',
  dogWins < TRIALS && dogWins > 0, `dogWins=${dogWins}/${TRIALS}`);

// --- 3. Single-candidate day is consistent with the legacy builder ---------
const coffeeDay = makeDay({ moments: [makeMoment('coffee', 0), makeMoment('coffee', 1)], stepsCount: 1600 });
const coffeeSel = selectHatch({ day: coffeeDay, history: {}, rng: makeSeededRng('c'), primaryTrait: 'calm', secondaryTrait: 'energy' });
const coffeeLegacy = engine.buildEncounterCreature(coffeeDay, {}, 'calm', 'energy');
check('single-candidate pickProbability is 1', coffeeSel?.creature?.pickProbability === 1, String(coffeeSel?.creature?.pickProbability));
check('single-candidate matches legacy identity',
  coffeeSel?.creature?.encounterProfileId === coffeeLegacy?.encounterProfileId &&
  coffeeSel?.creature?.name === coffeeLegacy?.name &&
  coffeeSel?.creature?.rarity === coffeeLegacy?.rarity &&
  coffeeSel?.creature?.id === coffeeLegacy?.id,
  JSON.stringify({ sel: coffeeSel?.creature?.name, legacy: coffeeLegacy?.name }));
check('birthSignals records the winning seed',
  JSON.stringify(coffeeSel?.creature?.birthSignals) === JSON.stringify(['coffee_shop']),
  JSON.stringify(coffeeSel?.creature?.birthSignals));
check('single-candidate day has no echoes', coffeeSel?.echoes?.length === 0, String(coffeeSel?.echoes?.length));

// --- 4. Variety: recency + avoid-previous suppress a just-hatched species ---
// Two equal-base candidates (both seen, no novelty); cat was hatched yesterday
// AND is yesterday's creature, so recency + avoidPrev must drop its probability.
const equalDay = visionDay([visionConcept('dog', 0.8, 0.85), visionConcept('cat', 0.8, 0.85)]);
const recencyHistory = {
  [DOG]: { count: 3, lastSeenIsoDate: '2026-06-01' }, // 11 days ago -> no recency
  [CAT]: { count: 3, lastSeenIsoDate: '2026-06-11' }, // yesterday -> recency
};
const recencyResult = selectHatch({
  day: equalDay, history: recencyHistory, yesterdayProfileId: CAT, rng: makeSeededRng('r'),
});
check('recency + avoidPrev lower yesterday\'s species below the alternative',
  probOf(recencyResult, CAT) < probOf(recencyResult, DOG),
  JSON.stringify({ dog: probOf(recencyResult, DOG), cat: probOf(recencyResult, CAT) }));
check('the suppressed species is materially less likely',
  probOf(recencyResult, CAT) < 0.3,
  String(probOf(recencyResult, CAT)));

// Recency in isolation (both seen, equal bond, only last-seen differs).
const recencyOnly = selectHatch({
  day: equalDay,
  history: { [DOG]: { count: 3, lastSeenIsoDate: '2026-06-01' }, [CAT]: { count: 3, lastSeenIsoDate: '2026-06-11' } },
  rng: makeSeededRng('r2'),
});
check('recency alone shifts probability toward the less-recent species',
  probOf(recencyOnly, DOG) > probOf(recencyOnly, CAT),
  JSON.stringify({ dog: probOf(recencyOnly, DOG), cat: probOf(recencyOnly, CAT) }));

// --- 5. Novelty: a never-seen species is favored over an equally-strong seen one
const noveltyResult = selectHatch({
  day: equalDay,
  history: { [CAT]: { count: 1, lastSeenIsoDate: '2026-05-01' } }, // dog novel, cat seen (no recency)
  rng: makeSeededRng('n'),
});
check('novelty favors the unseen species',
  probOf(noveltyResult, DOG) > probOf(noveltyResult, CAT),
  JSON.stringify({ dogNovel: probOf(noveltyResult, DOG), catSeen: probOf(noveltyResult, CAT) }));

// --- 6. Bond: a deeper-history species (both seen, no recency) is favored ----
const bondResult = selectHatch({
  day: equalDay,
  history: { [DOG]: { count: 4, lastSeenIsoDate: '2026-05-01' }, [CAT]: { count: 1, lastSeenIsoDate: '2026-05-01' } },
  rng: makeSeededRng('b'),
});
check('bond reward favors the more-returned species',
  probOf(bondResult, DOG) > probOf(bondResult, CAT),
  JSON.stringify({ dogDeep: probOf(bondResult, DOG), catShallow: probOf(bondResult, CAT) }));

// --- 7. Intent + specificity beat a generic high-steps day ------------------
const familyPromptDay = makeDay({
  stepsCount: 7000,
  promptAnswers: [
    makePromptAnswer('people', ['family'], ['Family'], ['people:family'], { social: 0.26 }, [{ seedId: 'social_gathering', intensity: 0.42 }]),
  ],
});
const familyResult = selectHatch({ day: familyPromptDay, history: {}, rng: makeSeededRng('f') });
const familyLeader = familyResult.probabilities[0];
check('explicit family tag outranks the generic high-steps day',
  familyLeader.profileId === 'activity_social_gathering_gatherglow' && familyLeader.probability > 0.6,
  JSON.stringify(familyResult.probabilities.map((p) => ({ n: p.name, p: p.probability }))));

const museumWalkDay = visionDay([visionConcept('museum', 0.7, 0.85)], { stepsCount: 12000 });
const museumResult = selectHatch({ day: museumWalkDay, history: {}, rng: makeSeededRng('m') });
const museumLeader = museumResult.probabilities[0];
check('a specific museum read outranks a high-steps day',
  museumLeader.profileId === 'location_museum_relicoon' && museumLeader.probability > 0.6,
  JSON.stringify(museumResult.probabilities.map((p) => ({ n: p.name, p: p.probability }))));

// --- 8. Echoes: the winner carries the candidates it beat -------------------
const echoDay = visionDay([visionConcept('dog', 0.9, 0.9), visionConcept('cat', 0.5, 0.7)]);
const echoResult = selectHatch({ day: echoDay, history: {}, rng: makeSeededRng('echo-1') });
check('winner records at least one echo', echoResult.creature.fieldEchoes.length >= 1, JSON.stringify(echoResult.creature.fieldEchoes));
check('echoes are distinct species from the winner',
  echoResult.creature.fieldEchoes.every((echo) => echo.speciesId !== echoResult.creature.encounterProfileId),
  JSON.stringify(echoResult.creature.fieldEchoes.map((e) => e.speciesId)));
check('each echo carries a probability and rarity',
  echoResult.creature.fieldEchoes.every((echo) => typeof echo.probability === 'number' && typeof echo.rarity === 'string'),
  JSON.stringify(echoResult.creature.fieldEchoes));

// --- 9. Rarity stays a living property (independent of the draw) ------------
const farDay = visionDay([visionConcept('dog', 0.9, 0.9)], {
  locations: [
    { id: 'l1', lat: 40.0, lng: -74.0, capturedAt: '2026-06-12T09:00:00.000Z', type: 'unknown', hasPhoto: false, source: 'foreground', momentId: null },
    { id: 'l2', lat: 40.5, lng: -74.0, capturedAt: '2026-06-12T15:00:00.000Z', type: 'unknown', hasPhoto: false, source: 'foreground', momentId: null },
  ],
});
const farResult = selectHatch({ day: farDay, history: {}, rng: makeSeededRng('far') });
check('living conditions lift rarity at hatch', farResult.creature.rarity !== 'common', String(farResult.creature.rarity));
check('rarity carries its living reason', /far|never|moved|distance|small hours|first light|stops/.test(farResult.creature.rarityReason ?? ''), farResult.creature.rarityReason);

// --- 10. Seeded RNG is deterministic and seed-sensitive ---------------------
const rngA = makeSeededRng('alpha');
const rngB = makeSeededRng('alpha');
check('same seed yields the same RNG sequence', rngA() === rngB() && rngA() === rngB(), 'mismatch');
check('different seeds diverge', makeSeededRng('alpha')() !== makeSeededRng('beta')(), 'collision');

// --- 11. No candidates -> null (trait fallback path) ------------------------
const emptyDay = makeDay({ moments: [makeMoment('focus', 0)], stepsCount: 3000 });
check('uncovered day returns null', selectHatch({ day: emptyDay, history: {}, rng: makeSeededRng('e') }) === null);

console.log(failures === 0 ? '\nAll hatch-selection checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
