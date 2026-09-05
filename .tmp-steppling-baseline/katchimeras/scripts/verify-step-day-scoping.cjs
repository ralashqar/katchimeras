const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-step-scope-'));

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

transpileTo('game/days/geo.ts', 'game/days/geo.js');
const activityPath = transpileTo('game/days/mutations/activity.ts', 'game/days/mutations/activity.js');

const stubs = {
  '@/types/home': emptyModulePath,
};
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request in stubs) return stubs[request];
  return originalResolve.call(this, request, parent, ...rest);
};

const { withDayStepCount } = require(activityPath);

let failures = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok  ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

function day(isoDate, overrides = {}) {
  return {
    id: `day-${isoDate}`,
    isoDate,
    state: 'forming',
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
    ...overrides,
  };
}

const tomorrow = day('2026-07-08');
const yesterdayReading = { stepsCount: 9400, dayId: '2026-07-07', observedAt: '2026-07-07T23:20:00.000Z' };
const rejectedTomorrow = withDayStepCount(tomorrow, yesterdayReading);
check('wrong-day step reading does not populate tomorrow', rejectedTomorrow === tomorrow);
check('tomorrow remains zero after wrong-day reading', rejectedTomorrow.stepsCount === 0, String(rejectedTomorrow.stepsCount));

const promotedBadDay = day('2026-07-08', { stepsCount: 9400 });
const resetPromoted = withDayStepCount(promotedBadDay, {
  stepsCount: 0,
  dayId: '2026-07-08',
  observedAt: '2026-07-08T00:05:00.000Z',
});
check('missing step provenance resets stale promoted count', resetPromoted.stepsCount === 0, String(resetPromoted.stepsCount));
check('reset records current step day id', resetPromoted.stepsCountDayId === '2026-07-08', resetPromoted.stepsCountDayId);

const sameDay = day('2026-07-08', { stepsCount: 2200, stepsCountDayId: '2026-07-08' });
const lowerSameDay = withDayStepCount(sameDay, {
  stepsCount: 1800,
  dayId: '2026-07-08',
  observedAt: '2026-07-08T12:00:00.000Z',
});
check('same-day pedometer updates stay monotonic', lowerSameDay.stepsCount === 2200, String(lowerSameDay.stepsCount));

const higherSameDay = withDayStepCount(sameDay, {
  stepsCount: 3100,
  dayId: '2026-07-08',
  observedAt: '2026-07-08T13:00:00.000Z',
});
check('same-day higher pedometer reading is accepted', higherSameDay.stepsCount === 3100, String(higherSameDay.stepsCount));

console.log(failures === 0 ? '\nAll step day-scoping checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
