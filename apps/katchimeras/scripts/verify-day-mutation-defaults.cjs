const {contentPath, assetSpecifier, readVerificationSource} = require('@incubator/art-pipeline/context');
const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-mutation-defaults-'));

function transpileTo(relativeSourcePath, relativeOutPath) {
  const source = readVerificationSource(contentPath(projectRoot, relativeSourcePath), 'utf8');
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

transpileTo('game/days/geo.ts', 'game/days/geo.js');
const momentsPath = transpileTo('game/days/mutations/moments.ts', 'game/days/mutations/moments.js');
const activityPath = transpileTo('game/days/mutations/activity.ts', 'game/days/mutations/activity.js');

const stubs = {
  '@/types/home': emptyModulePath,
};
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request in stubs) return stubs[request];
  return originalResolve.call(this, request, parent, ...rest);
};

const { withDayForegroundLocationSample } = require(activityPath);
const { withAppendedMoment } = require(momentsPath);

let failures = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok  ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

const legacyDay = {
  id: 'day-2026-07-08',
  isoDate: '2026-07-08',
  state: 'forming',
  stepsCount: 0,
  visitedPlaceCount: 0,
  newPlaceCount: 0,
  locationSampleCount: 0,
  shareReadyAt: null,
  healthRouteImport: null,
  exactRouteSegments: [],
  selectedPathId: null,
  promptAnswers: [],
  heroPhoto: null,
  creature: null,
};

const momentDay = withAppendedMoment(legacyDay, {
  id: 'moment-1',
  type: 'coffee',
  label: 'Coffee',
  createdAt: '2026-07-08T09:00:00.000Z',
  scoreBias: { calm: 0.1 },
  metadata: {},
});
check('appending a moment defaults missing moments array', momentDay.moments.length === 1, String(momentDay.moments?.length));
check('appending a moment defaults missing locations array', Array.isArray(momentDay.locations), typeof momentDay.locations);

const locationDay = withDayForegroundLocationSample(legacyDay, {
  lat: 51.5,
  lng: -0.12,
  capturedAt: '2026-07-08T09:05:00.000Z',
});
check('foreground location defaults missing locations array', locationDay.locations.length === 1, String(locationDay.locations?.length));

console.log(failures === 0 ? '\nAll day mutation default checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
