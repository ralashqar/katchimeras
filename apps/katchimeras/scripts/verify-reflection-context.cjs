const {contentPath, assetSpecifier, readVerificationSource} = require('@incubator/art-pipeline/context');
// Node-only verification harness for the reflection context engine (mood +
// bond depth + temporal read). No test runner in this project: transpile the
// pure module with the TypeScript compiler and run the Bedrotte stress-test
// scenarios. Usage: node scripts/verify-reflection-context.cjs
const fs = require('fs');
const path = require('path');
const Module = require('module');
const os = require('os');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-rc-'));

function transpileToTemp(relativeSourcePath, outName) {
  const source = readVerificationSource(contentPath(projectRoot, relativeSourcePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const outPath = path.join(tempDir, outName);
  fs.writeFileSync(outPath, output);
  return outPath;
}

const livingRarityPath = transpileToTemp('utils/living-rarity.ts', 'living-rarity.js');
const visionSignalsPath = transpileToTemp('utils/vision-signals.ts', 'vision-signals.js');
const photoRealityPath = transpileToTemp('utils/photo-reality.ts', 'photo-reality.js');
const taxonomyPath = transpileToTemp('utils/intelligence/taxonomy.ts', 'intelligence-taxonomy.js');
const classificationPolicyPath = path.join(tempDir, 'intelligence-classification-policy.js');
fs.writeFileSync(classificationPolicyPath, 'exports.visionSignalIsRejected = () => false;');
const dayWeatherPath = transpileToTemp('utils/day-weather.ts', 'day-weather.js');
const contextPath = transpileToTemp('utils/reflection-context.ts', 'reflection-context.js');

const stubs = {
  '@/utils/living-rarity': livingRarityPath,
  '@/utils/vision-signals': visionSignalsPath,
  '@/utils/photo-reality': photoRealityPath,
  '@/utils/intelligence/taxonomy': taxonomyPath,
  '@/utils/intelligence/classification-policy': classificationPolicyPath,
  '@/utils/day-weather': dayWeatherPath,
  '@/components/ui/icon-symbol': {},
  '@/types/home': {},
};

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request in stubs) {
    const stub = stubs[request];
    if (typeof stub === 'string') return stub;
    const stubFile = path.join(tempDir, `${request.replace(/[@/]/g, '_')}.js`);
    if (!fs.existsSync(stubFile)) {
      fs.writeFileSync(stubFile, `module.exports = ${JSON.stringify(stub)};`);
    }
    return stubFile;
  }
  return originalResolve.call(this, request, ...rest);
};

const rc = require(contextPath);
const dw = require(dayWeatherPath);

// Two stay-put points ~50m apart so computeDaySpanMeters reads "home".
const HOME_POINTS = [
  { id: 'p1', lat: 40.0, lng: -73.0, capturedAt: '', type: 'home', hasPhoto: false, source: 'foreground' },
  { id: 'p2', lat: 40.0004, lng: -73.0, capturedAt: '', type: 'home', hasPhoto: false, source: 'foreground' },
];
// Two far points ~30km apart → a roaming day.
const FAR_POINTS = [
  { id: 'p1', lat: 40.0, lng: -73.0, capturedAt: '', type: 'unknown', hasPhoto: false, source: 'foreground' },
  { id: 'p2', lat: 40.27, lng: -73.0, capturedAt: '', type: 'unknown', hasPhoto: false, source: 'foreground' },
];

function vision(conceptNames, analyzed = conceptNames.length || 1) {
  return {
    concepts: conceptNames.map((name) => ({ name, salience: 1, coverage: 1, count: 1, peakConfidence: 0.9 })),
    details: [],
    maxFaceCount: 0,
    faceCoverage: 0,
    textTokens: [],
    analyzedPhotoCount: analyzed,
  };
}

function makeDay(overrides = {}) {
  return {
    id: `day-${overrides.isoDate ?? '2026-06-14'}`,
    isoDate: '2026-06-14', // a Sunday
    state: 'hatched',
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
    creature: { encounterProfileId: 'location_home_evening_bedrotte', name: 'Bedrotte', rarity: 'common', bondVisitCount: 1, repeatDepth: 0 },
    ...overrides,
  };
}

// Build a run of prior Bedrotte home days on the calendar days before `beforeIso`.
function priorBedrotteDays(beforeIso, count, conceptsPerDay = null) {
  const days = [];
  const base = new Date(`${beforeIso}T12:00:00`);
  for (let i = 1; i <= count; i += 1) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    days.push(
      makeDay({
        id: `day-${iso}`,
        isoDate: iso,
        locations: HOME_POINTS,
        stepsCount: 1200,
        vision: conceptsPerDay ? vision(conceptsPerDay) : undefined,
      })
    );
  }
  return days;
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

// --- Mood scenarios (from the Bedrotte stress test) ---

// Rainy Sunday, low steps, a tea photo → cozy (rain "did the deciding").
const rainyTea = makeDay({ locations: HOME_POINTS, stepsCount: 900, vision: vision(['rain', 'coffee']) });
check('rainy Sunday tea day reads cozy', rc.classifyMood(rainyTea) === 'cozy', rc.classifyMood(rainyTea));

// Home all day but 6,000 steps (pacing, chores) → restless.
const pacing = makeDay({ locations: HOME_POINTS, stepsCount: 6000 });
check('home + high steps reads restless', rc.classifyMood(pacing) === 'restless', rc.classifyMood(pacing));

// Beautiful weekend, stayed home by choice, pet photos, no forcing weather → defiant.
const chosenIn = makeDay({ locations: HOME_POINTS, stepsCount: 2000, vision: vision(['dog']) });
check('chosen weekend-in with pet photos reads defiant', rc.classifyMood(chosenIn) === 'defiant', rc.classifyMood(chosenIn));

// Wednesday, very low steps, no photos → tender (the gentle default).
const sickish = makeDay({ isoDate: '2026-06-17', locations: HOME_POINTS, stepsCount: 600 });
check('thin ambiguous weekday reads tender', rc.classifyMood(sickish) === 'tender', rc.classifyMood(sickish));

// Far roaming, somewhere new → defiant (bold, out in the world).
const boldOut = makeDay({ locations: FAR_POINTS, stepsCount: 11000, newPlaceCount: 1 });
check('far roaming new-place day reads defiant', rc.classifyMood(boldOut) === 'defiant', rc.classifyMood(boldOut));

// --- Bond depth scenarios ---

check('visit 1, no streak → fresh', rc.classifyBondDepth(1, 1) === 'fresh');
check('5 in a row forces knowing even at low lifetime count', rc.classifyBondDepth(5, 5) === 'knowing', rc.classifyBondDepth(5, 5));
check('lifetime 12 visits → deep', rc.classifyBondDepth(12, 1) === 'deep', rc.classifyBondDepth(12, 1));
check('lifetime 4 visits → familiar', rc.classifyBondDepth(4, 1) === 'familiar', rc.classifyBondDepth(4, 1));
check('2-day streak elevates fresh to familiar', rc.classifyBondDepth(1, 2) === 'familiar', rc.classifyBondDepth(1, 2));

// --- Temporal context: streak ---
// Day 1 home vs day 5 home produce different bond depth by construction.
const day1 = makeDay({ locations: HOME_POINTS, stepsCount: 1000, vision: vision(['coffee']) });
const day1ctx = rc.buildReflectionContext(day1, []);
check('day-1 home is fresh', day1ctx.bondDepth === 'fresh', JSON.stringify(day1ctx));
check('day-1 consecutive is 1', day1ctx.consecutiveDays === 1, String(day1ctx.consecutiveDays));

const day5 = makeDay({ isoDate: '2026-06-14', locations: HOME_POINTS, stepsCount: 1000, vision: vision(['coffee']), creature: { encounterProfileId: 'location_home_evening_bedrotte', name: 'Bedrotte', rarity: 'common', bondVisitCount: 5, repeatDepth: 4 } });
const day5ctx = rc.buildReflectionContext(day5, priorBedrotteDays('2026-06-14', 4));
check('5 consecutive home days counted', day5ctx.consecutiveDays === 5, String(day5ctx.consecutiveDays));
check('day-5 home reads knowing (anti-staleness)', day5ctx.bondDepth === 'knowing', JSON.stringify(day5ctx));

// --- Temporal context: recovery after a busy stretch ---
function busyDay(iso) {
  return makeDay({ id: `day-${iso}`, isoDate: iso, locations: FAR_POINTS, stepsCount: 12000, newPlaceCount: 2, visitedPlaceCount: 4, creature: { encounterProfileId: 'activity_high_steps_day_steppling', name: 'Steppling', rarity: 'common', bondVisitCount: 1, repeatDepth: 0 } });
}
const busyBefore = ['2026-06-12', '2026-06-13'].map(busyDay);
const restToday = makeDay({ isoDate: '2026-06-14', locations: HOME_POINTS, stepsCount: 800 });
const recoveryCtx = rc.buildReflectionContext(restToday, busyBefore);
check('recovery-after-busy detected', recoveryCtx.recoveryAfterBusy === true, JSON.stringify({ b: recoveryCtx.busyDaysBefore, r: recoveryCtx.recoveryAfterBusy }));
check('busy days before counted', recoveryCtx.busyDaysBefore >= 2, String(recoveryCtx.busyDaysBefore));
check('previous day creature surfaced', recoveryCtx.previousDayCreature === 'Steppling', String(recoveryCtx.previousDayCreature));

// --- Prior-visit memory: weekday + subject available for "the fourth rainy Sunday" ---
const sundayHistory = priorBedrotteDays('2026-06-14', 3, ['rain']); // 3 prior Bedrotte days, each rainy
const sundayCtx = rc.buildReflectionContext(makeDay({ locations: HOME_POINTS, stepsCount: 900, vision: vision(['rain']) }), sundayHistory);
check('prior visits captured', sundayCtx.priorVisits.length === 3, String(sundayCtx.priorVisits.length));
check('prior visit carries a subject', sundayCtx.priorVisits[0]?.subject === 'rain', JSON.stringify(sundayCtx.priorVisits[0]));
check('prior visit carries a weekday', typeof sundayCtx.priorVisits[0]?.weekday === 'string' && sundayCtx.priorVisits[0].weekday.length > 0);

// --- Weather helpers (utils/day-weather.ts) ---
check('WMO 0 -> clear', dw.weatherCodeToCondition(0) === 'clear');
check('WMO 2 -> partly_cloudy', dw.weatherCodeToCondition(2) === 'partly_cloudy');
check('WMO 3 -> cloudy', dw.weatherCodeToCondition(3) === 'cloudy');
check('WMO 45 -> fog', dw.weatherCodeToCondition(45) === 'fog');
check('WMO 61 -> rain', dw.weatherCodeToCondition(61) === 'rain');
check('WMO 71 -> snow', dw.weatherCodeToCondition(71) === 'snow');
check('WMO 95 -> storm', dw.weatherCodeToCondition(95) === 'storm');
check('vision rain -> weather', dw.deriveWeatherFromVision(vision(['rain']))?.condition === 'rain');
check('forcesIndoors(snow)', dw.forcesIndoors({ condition: 'snow', source: 'forecast' }) === true);
check('isFairWeather(clear)', dw.isFairWeather({ condition: 'clear', source: 'forecast' }) === true);

// --- Weather feeds mood: the same chosen-in weekend reads differently by sky ---
const baseChosen = { locations: HOME_POINTS, stepsCount: 2000, vision: vision(['dog']) };
const rainChosen = makeDay({ ...baseChosen, weather: { condition: 'rain', source: 'forecast' } });
check('rainy weekend-in reads cozy (weather forced the choice)', rc.classifyMood(rainChosen) === 'cozy', rc.classifyMood(rainChosen));
const clearChosen = makeDay({ ...baseChosen, weather: { condition: 'clear', source: 'forecast' } });
check('clear weekend-in reads defiant (chose to skip a fair day)', rc.classifyMood(clearChosen) === 'defiant', rc.classifyMood(clearChosen));

// --- Wake-time: a late start softens a chosen-in day toward cozy, not defiant ---
const latePoints = [
  { id: 'p1', lat: 40.0, lng: -73.0, capturedAt: '2026-06-14T11:30:00.000Z', type: 'home', hasPhoto: false, source: 'foreground' },
  { id: 'p2', lat: 40.0004, lng: -73.0, capturedAt: '2026-06-14T13:00:00.000Z', type: 'home', hasPhoto: false, source: 'foreground' },
];
const lateChosen = makeDay({ locations: latePoints, stepsCount: 2000, vision: vision(['dog']), weather: { condition: 'clear', source: 'forecast' } });
check('late-start fair weekend-in softens to cozy', rc.classifyMood(lateChosen) === 'cozy', rc.classifyMood(lateChosen));

// --- Explicit prompt feelings override ambiguous passive reads ---
function promptAnswer(kind, choiceIds, labels, semanticTags, scoreBias = {}) {
  return {
    id: `prompt-${kind}-${choiceIds.join('-')}`,
    kind,
    choiceIds,
    labels,
    createdAt: '2026-06-14T20:00:00.000Z',
    source: 'prompt_chip',
    semanticTags,
    scoreBias,
    encounterSeedBias: [],
  };
}

const explicitLow = makeDay({
  locations: HOME_POINTS,
  stepsCount: 6200,
  promptAnswers: [promptAnswer('feeling', ['low'], ['Low'], ['feeling:low', 'tender_day'])],
});
check('explicit low feeling reads tender', rc.classifyMood(explicitLow) === 'tender', rc.classifyMood(explicitLow));

const explicitDrained = makeDay({
  locations: HOME_POINTS,
  stepsCount: 500,
  promptAnswers: [promptAnswer('feeling', ['drained'], ['Drained'], ['feeling:drained', 'body:tired'])],
});
check('explicit drained feeling reads tender', rc.classifyMood(explicitDrained) === 'tender', rc.classifyMood(explicitDrained));

const explicitStressed = makeDay({
  locations: HOME_POINTS,
  stepsCount: 900,
  promptAnswers: [promptAnswer('feeling', ['stressed'], ['Stressed'], ['feeling:stressed', 'restless_day'])],
});
check('explicit stressed feeling reads restless', rc.classifyMood(explicitStressed) === 'restless', rc.classifyMood(explicitStressed));

const explicitLoved = makeDay({
  locations: HOME_POINTS,
  stepsCount: 900,
  promptAnswers: [promptAnswer('feeling', ['loved'], ['Loved'], ['feeling:loved'])],
});
check('explicit loved feeling reads cozy', rc.classifyMood(explicitLoved) === 'cozy', rc.classifyMood(explicitLoved));

const explicitCalm = makeDay({
  locations: HOME_POINTS,
  stepsCount: 900,
  promptAnswers: [promptAnswer('feeling', ['calm'], ['Calm'], ['feeling:calm'])],
});
check('explicit calm feeling reads cozy', rc.classifyMood(explicitCalm) === 'cozy', rc.classifyMood(explicitCalm));

Module._resolveFilename = originalResolve;
fs.rmSync(tempDir, { recursive: true, force: true });

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
