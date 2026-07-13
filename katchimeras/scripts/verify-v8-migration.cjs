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
fs.writeFileSync(typesPath, '');
fs.writeFileSync(locationsPath, 'exports.createFallbackLocationsForStoredDay = () => [];');
fs.writeFileSync(questionsPath, 'exports.QUESTION_PLANNER_VERSION = 2; exports.questionIdForGraphNode = (graphId, nodeId) => graphId && nodeId ? `${graphId}.${nodeId}` : null;');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === '@/types/home') return typesPath;
  if (request === '@/utils/intelligence/quality-registry') return qualityRegistryPath;
  if (request === '@/utils/intelligence/question-registry') return questionsPath;
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
  creature: { id: 'waglet', encounterProfileId: 'subject_dog_waglet', repeatDepth: 1 },
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
check('v9 upgrades to v12', upgraded.version === 12);
check('v10 upgrades losslessly to v12', upgradedFromV10.version === 12 && upgradedFromV10.today.id === oldState.today.id && upgradedFromV10.archivedDays.length === oldState.archivedDays.length);
check('v11 journals migrate to canonical records', upgradedFromV11.version === 12 && upgradedFromV11.today.journalRecords.length === 2);
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
check('prompt answer survives', upgraded.archivedDays[0].promptAnswers[0].choiceIds[0] === 'calm');
check('location survives', upgraded.archivedDays[0].locations[0].id === 'loc-1');

console.log(failures ? `\n${failures} v12 migration check(s) FAILED.` : '\nAll v12 migration checks passed.');
process.exit(failures ? 1 : 0);
