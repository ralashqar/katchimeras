const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-v8-migration-'));
const source = fs.readFileSync(path.join(root, 'game/days/migrations.ts'), 'utf8');
const migrationPath = path.join(temp, 'migrations.js');
const qualityRegistryPath = path.join(temp, 'quality-registry.js');
function transpile(relativeSourcePath, outName) {
  const input = fs.readFileSync(path.join(root, relativeSourcePath), 'utf8');
  const outPath = path.join(temp, outName);
  fs.writeFileSync(outPath, ts.transpileModule(input, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText);
  return outPath;
}
const lifeAspectsPath = transpile('constants/life-aspects.ts', 'life-aspects.js');
const katchimeraSkinsPath = transpile('constants/katchimera-skins.ts', 'katchimera-skins.js');
const katchimeraIdentityPath = transpile('utils/katchimera-identity.ts', 'katchimera-identity.js');
fs.writeFileSync(migrationPath, ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText);
const qualitySource = fs.readFileSync(path.join(root, 'utils/intelligence/quality-registry.ts'), 'utf8');
fs.writeFileSync(qualityRegistryPath, ts.transpileModule(qualitySource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText);
const typesPath = path.join(temp, 'types.js');
const locationsPath = path.join(temp, 'locations.js');
const questionsPath = path.join(temp, 'questions.js');
const dailyCardPath = path.join(temp, 'daily-card.js');
const daySkyPath = path.join(temp, 'day-sky.js');
fs.writeFileSync(typesPath, '');
fs.writeFileSync(locationsPath, 'exports.createFallbackLocationsForStoredDay = () => [];');
fs.writeFileSync(questionsPath, 'exports.QUESTION_PLANNER_VERSION = 2; exports.questionIdForGraphNode = (graphId, nodeId) => graphId && nodeId ? `${graphId}.${nodeId}` : null;');
fs.writeFileSync(dailyCardPath, 'exports.buildDailyCreatureCard = (day, creature, options) => ({ id: `card:${day.id}`, dayId: day.id, creatureId: creature.id, rarity: creature.rarity, provenance: options.mode });');
fs.writeFileSync(daySkyPath, `
const derive = (day) => ({ intensity: 0, mood: "neutral", seed: 407, version: 1, weather: day.weather?.condition === "fog" ? "foggy" : "clear" });
exports.deriveDaySkySnapshot = derive;
exports.reconcileDaySkySnapshot = (day) => {
  if (day.state !== "hatched" || !day.creature) return day;
  const skyPolicy = day.skyPolicy
    ?? (day.card?.provenance === "live_hatch" ? "live_frozen" : "historical_adaptive");
  if (skyPolicy === "live_frozen") {
    return { ...day, sky: day.sky ?? derive(day), skyPolicy };
  }
  if (day.creature.reflectionSource !== "generated") {
    return { ...day, sky: undefined, skyPolicy };
  }
  return { ...day, sky: derive(day), skyPolicy };
};`);
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === '@/types/home') return typesPath;
  if (request === '@/utils/intelligence/quality-registry') return qualityRegistryPath;
  if (request === '@/utils/intelligence/question-registry') return questionsPath;
  if (request === '@/utils/daily-card') return dailyCardPath;
  if (request === '@/utils/day-sky') return daySkyPath;
  if (request === '@/constants/life-aspects') return lifeAspectsPath;
  if (request === '@/constants/katchimera-skins') return katchimeraSkinsPath;
  if (request === '@/utils/katchimera-identity') return katchimeraIdentityPath;
  if (request === '@/data/intelligence/memory-qualities.json') return path.join(root, 'data/intelligence/memory-qualities.json');
  if (request === './locations' && parent?.filename === migrationPath) return locationsPath;
  return originalResolve.call(this, request, parent, ...rest);
};

const { upgradeStoredHomeState } = require(migrationPath);
const day = {
  id: 'day-2026-07-09', isoDate: '2026-07-09', state: 'hatched', stepsCount: 5432,
  visitedPlaceCount: 2, newPlaceCount: 1, locationSampleCount: 1, shareReadyAt: null,
  moments: [{ id: 'm1', type: 'coffee' }], locations: [{ id: 'loc-1', lat: 1, lng: 2 }],
  healthRouteImport: null, exactRouteSegments: [], selectedPathId: null,
  promptAnswers: [{ id: 'p1', kind: 'feeling', choiceIds: ['calm'] }],
  heroPhoto: { assetId: 'photo-1' },
  evidence: [{ id: 'ev-1', sourceType: 'photo', signals: [{ key: 'dog' }] }],
  classifiedMemories: [{
    id: 'memory-photo-1', sourceType: 'photo', sourceId: 'photo-1', dominantDomain: 'place',
    observations: [{ key: 'signal', value: 'place', raw: 'city skyline', confidence: 0.9, provider: 'appleFoundation' }],
    facets: [], confirmations: [], entityIds: [], assignments: [],
    promptState: { graphId: null, currentNodeId: null, answeredNodeIds: [], skipped: false, completed: true },
    schemaVersion: 1, createdAt: '2026-07-09T12:00:00.000Z', updatedAt: '2026-07-09T12:00:00.000Z',
  }],
  vision: { concepts: [{ name: 'dog', peakConfidence: 0.9 }] },
  creature: { id: 'waglet', visualKey: 'waglet', encounterProfileId: 'subject_dog_companion_waglet', repeatDepth: 1 },
};
const oldState = {
  version: 9, locationPermission: 'granted', activityPermission: 'granted', healthPermission: 'denied',
  personalEntities: [], cloudIntelligenceEnabled: false,
  encounterHistory: { subject_dog_waglet: { count: 1, lastSeenIsoDate: '2026-07-09' } },
  archivedDays: [day], today: { ...day, id: 'day-2026-07-10', isoDate: '2026-07-10', state: 'forming' },
};
const upgraded = upgradeStoredHomeState(oldState);
const upgradedFromV10 = upgradeStoredHomeState({ ...oldState, version: 10 });
const upgradedFromV11 = upgradeStoredHomeState({
  ...oldState,
  version: 11,
  today: {
    ...oldState.today,
    manualJournalEntries: [{ id: 'legacy-journal', flowId: 'studio', flowVersion: 1, path: ['studio', 'book'], categoryId: 'book', canonicalQualityIds: ['media.book'], fields: { specific: 'Dune' }, feeling: 'loved', sourceType: 'manual', createdAt: '2026-07-10T12:00:00.000Z' }],
    notes: [{ id: 'legacy-note', kind: 'text', text: 'A note', audioUri: null, durationMs: null, archetype: 'calm', label: 'A note', createdAt: '2026-07-10T13:00:00.000Z' }],
  },
});
const currentState = upgradeStoredHomeState({
  ...oldState,
  version: 12,
  archivedDays: [{
    ...day,
    classifiedMemories: day.classifiedMemories.map((memory) => ({ ...memory, schemaVersion: 6 })),
  }],
});
let failures = 0;
function check(label, condition) {
  if (condition) console.log(`  ok  ${label}`);
  else { failures += 1; console.log(`FAIL  ${label}`); }
}
check('v9 upgrades to v17', upgraded.version === 17);
check('v10 upgrades losslessly to v17', upgradedFromV10.version === 17 && upgradedFromV10.today.id === oldState.today.id && upgradedFromV10.archivedDays.length === oldState.archivedDays.length);
check('v11 journals migrate to canonical records', upgradedFromV11.version === 17 && upgradedFromV11.today.journalRecords.length === 2);
check('legacy creatures gain stable family identity',
  upgraded.archivedDays[0].creature.aspectId === 'pet-companionship'
    && upgraded.archivedDays[0].creature.familyId === 'waglet'
    && upgraded.archivedDays[0].creature.companionId === 'companion:waglet');
check('cloud intelligence remains opt-in', upgraded.cloudIntelligenceEnabled === false);
check('personal entities initialize locally', Array.isArray(upgraded.personalEntities) && upgraded.personalEntities.length === 0);
check('days are preserved', upgraded.archivedDays.length === 1 && upgraded.today.id === 'day-2026-07-10');
check('legacy vision survives', upgraded.archivedDays[0].vision.concepts[0].name === 'dog');
check('evidence survives', upgraded.archivedDays[0].evidence[0].id === 'ev-1');
check('legacy memories gain canonical qualities', upgraded.archivedDays[0].classifiedMemories[0].qualities.some((quality) => quality.qualityId === 'place.city'));
check('legacy memories upgrade to canonical-confidence schema v5', upgraded.archivedDays[0].classifiedMemories[0].schemaVersion === 5);
check('current classified-memory schema is never downgraded', currentState.archivedDays[0].classifiedMemories[0].schemaVersion === 6);
check('legacy prompt state gains adaptive budget', upgraded.archivedDays[0].classifiedMemories[0].promptState.maxQuestions === 3);
check('legacy prompt state gains planner metadata', upgraded.archivedDays[0].classifiedMemories[0].promptState.plannerVersion === 2 && Array.isArray(upgraded.archivedDays[0].classifiedMemories[0].promptState.askedQuestionIds));
check('creature survives', upgraded.archivedDays[0].creature.id === 'waglet');
check('hatched days gain a card', upgraded.archivedDays[0].card?.creatureId === 'waglet');
check('legacy hatch waits for enrichment before storing sky', upgraded.archivedDays[0].sky === undefined && upgraded.archivedDays[0].skyPolicy === 'historical_adaptive');
check('prompt answer survives', upgraded.archivedDays[0].promptAnswers[0].choiceIds[0] === 'calm');
check('location survives', upgraded.archivedDays[0].locations[0].id === 'loc-1');

console.log(failures ? `\n${failures} v17 migration check(s) FAILED.` : '\nAll v17 migration checks passed.');
process.exit(failures ? 1 : 0);
