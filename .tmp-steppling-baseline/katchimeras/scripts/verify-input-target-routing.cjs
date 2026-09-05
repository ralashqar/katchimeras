const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-input-target-'));

function transpileTo(relativeSourcePath, relativeOutPath) {
  const source = fs.readFileSync(path.join(projectRoot, relativeSourcePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const outPath = path.join(tempDir, relativeOutPath);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, output);
  return outPath;
}

const emptyModulePath = path.join(tempDir, 'empty.js');
fs.writeFileSync(emptyModulePath, '');
const photoCurationPath = path.join(tempDir, 'photo-curation.js');
fs.writeFileSync(photoCurationPath, 'exports.curatePhotos = (photos) => ({ keepers: photos });\n');
const evidencePath = path.join(tempDir, 'evidence.js');
fs.writeFileSync(
  evidencePath,
  [
    'exports.buildPhotoEvidence = (input) => ({ id: input.sourceId, signals: [], sourceType: "photo" });',
    'exports.upsertEvidence = (existing, incoming) => [...(existing || []), ...incoming];',
  ].join('\n')
);
const visionSignalsPath = path.join(tempDir, 'vision-signals.js');
fs.writeFileSync(visionSignalsPath, 'exports.aggregatePhotoVision = () => null;\n');
const classificationPath = path.join(tempDir, 'classification.js');
fs.writeFileSync(
  classificationPath,
  'exports.buildPhotoClassifiedMemory = (input) => ({ id: `classified:${input.sourceId}` });\nexports.upsertClassifiedMemory = (existing, incoming) => [...(existing || []), ...incoming];\n'
);
const photoIntelligencePath = path.join(tempDir, 'photo-intelligence.js');
fs.writeFileSync(photoIntelligencePath, 'exports.buildPhotoIntelligence = (input) => ({ memory: { id: `classified:${input.sourceId}` }, evidence: { id: input.sourceId, signals: [], sourceType: "photo" } });\n');
const photoLocationPath = transpileTo('utils/photo-location.ts', 'utils/photo-location.js');

transpileTo('game/days/date.ts', 'game/days/date.js');
const recordsPath = transpileTo('game/days/records.ts', 'game/days/records.js');
const photoLocationsPath = transpileTo('game/days/photo-locations.ts', 'game/days/photo-locations.js');

const stubs = {
  '@/types/home': emptyModulePath,
  '@/utils/intelligence/evidence': evidencePath,
  '@/utils/intelligence/classification': classificationPath,
  '@/utils/intelligence/photo-intelligence': photoIntelligencePath,
  '@/utils/photo-curation': photoCurationPath,
  '@/utils/photo-location': photoLocationPath,
  '@/utils/vision-signals': visionSignalsPath,
};
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request in stubs) return stubs[request];
  return originalResolve.call(this, request, parent, ...rest);
};

const records = require(recordsPath);
const photoLocations = require(photoLocationsPath);

let failures = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok  ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

function day(isoDate, state = 'forming') {
  return {
    id: `day-${isoDate}`,
    isoDate,
    state,
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
    creature: state === 'hatched' ? { id: 'hatched' } : null,
  };
}

const profile = {};
const now = new Date('2026-07-07T22:30:00.000Z');
const hatchedState = {
  version: 7,
  locationPermission: 'unknown',
  activityPermission: 'unknown',
  healthPermission: 'unknown',
  encounterHistory: {},
  archivedDays: [],
  today: day('2026-07-07', 'hatched'),
};

const routedDay = records.readInputDay(hatchedState, 'today', profile, now);
check('hatched today redirects stale today input to tomorrow', routedDay.isoDate === '2026-07-08', routedDay.isoDate);

const writtenDay = { ...routedDay, moments: [{ id: 'm1', type: 'inspiration', label: 'A late movie' }] };
const writtenState = records.writeInputDay(hatchedState, 'today', writtenDay);
check('writeInputDay leaves hatched today untouched', writtenState.today.moments.length === 0);
check('writeInputDay stores stale today input on tomorrow', writtenState.tomorrow?.moments.length === 1);

const formingState = { ...hatchedState, today: day('2026-07-07', 'forming') };
const formingWrite = records.writeInputDay(formingState, 'today', {
  ...formingState.today,
  moments: [{ id: 'm2', type: 'coffee', label: 'Coffee' }],
});
check('forming today still accepts today input', formingWrite.today.moments.length === 1);
check('forming today does not create tomorrow', !formingWrite.tomorrow);

const seededState = photoLocations.withSeededPhotoLocationsByDay(
  hatchedState,
  [
    {
      createdAt: now.getTime(),
      height: 1600,
      id: 'late-photo',
      latitude: 51.5,
      longitude: -0.12,
      thumbnailUri: 'file://late-photo.jpg',
      uri: 'file://late-photo.jpg',
      width: 1200,
    },
  ],
  { todayPhotoTarget: routedDay }
);
check('today-dated photo signal does not mutate hatched today', seededState.today.locations.length === 0);
check('today-dated photo signal seeds tomorrow after hatch', seededState.tomorrow?.locations.length === 1);
check(
  'redirected photo keeps observed capture time',
  seededState.tomorrow?.locations[0]?.capturedAt === '2026-07-07T22:30:00.000Z',
  seededState.tomorrow?.locations[0]?.capturedAt
);

console.log(failures === 0 ? '\nAll input target routing checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
