// Node-only verification harness for the encounter engine (no test runner in
// this project). Transpiles the pure modules with the TypeScript compiler and
// runs the M1 acceptance scenarios. Usage: node scripts/verify-encounter-engine.cjs
const fs = require('fs');
const path = require('path');
const Module = require('module');
const os = require('os');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-verify-'));

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
];
const homeCreatureVisualsStub = Object.fromEntries(
  visualKeys.map((key) => [key, { source: 0, accentColor: '#FFFFFF' }])
);

const castPath = transpileToTemp('constants/encounter-cast.ts', 'encounter-cast.js');
const enginePath = transpileToTemp('utils/encounter-engine.ts', 'encounter-engine.js');

const stubs = {
  '@/constants/encounter-cast': castPath,
  '@/constants/home-mvp': { homeCreatureVisuals: homeCreatureVisualsStub },
  '@/constants/katchimera-encounter-profiles': { katchimeraEncounterProfiles: encounterProfiles },
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
    creature: null,
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

let failures = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok  ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

// 1. Coffee day hatches Lattelet with the unlock line on first encounter.
const coffeeDay = makeDay({ moments: [makeMoment('coffee', 0), makeMoment('coffee', 1)], stepsCount: 1600 });
const coffeeCreature = engine.buildEncounterCreature(coffeeDay, {}, 'calm', 'energy');
check('coffee day matches Lattelet', coffeeCreature?.name === 'Lattelet', JSON.stringify(coffeeCreature));
check('first encounter uses unlock line', /revealed Lattelet/.test(coffeeCreature?.highlight ?? ''), coffeeCreature?.highlight);
check('encounter profile id recorded', coffeeCreature?.encounterProfileId === 'location_coffee_shop_lattelet');
check('no deck language in copy', !/deck/i.test(`${coffeeCreature?.highlight} ${coffeeCreature?.reflection}`),
  `${coffeeCreature?.highlight} | ${coffeeCreature?.reflection}`);

// 2. Determinism: same day + history twice -> identical creature.
const coffeeCreatureAgain = engine.buildEncounterCreature(coffeeDay, {}, 'calm', 'energy');
check('hatch is deterministic', JSON.stringify(coffeeCreature) === JSON.stringify(coffeeCreatureAgain));

// 3. Repeat encounter switches to repeat copy and carries repeatDepth.
const history = { location_coffee_shop_lattelet: { count: 2, lastSeenIsoDate: '2026-06-10' } };
const repeatCreature = engine.buildEncounterCreature(coffeeDay, history, 'calm', 'energy');
check('repeat depth carried', repeatCreature?.repeatDepth === 2, String(repeatCreature?.repeatDepth));
check('repeat copy differs from unlock copy', repeatCreature?.highlight !== coffeeCreature?.highlight, repeatCreature?.highlight);
check('repeat copy deck-free', !/deck/i.test(repeatCreature?.highlight ?? ''), repeatCreature?.highlight);

// 4. Thin recovery day hatches Bedrotte with restorative copy.
const thinDay = makeDay({ stepsCount: 700, locationSampleCount: 2 });
const thinCreature = engine.buildEncounterCreature(thinDay, {}, 'calm', 'focus');
check('thin day matches Bedrotte', thinCreature?.name === 'Bedrotte', JSON.stringify(thinCreature));
check('thin day copy deck-free', !/deck/i.test(`${thinCreature?.highlight} ${thinCreature?.reflection}`),
  `${thinCreature?.highlight} | ${thinCreature?.reflection}`);

// 5. Run workout beats step count: Sprintail.
const runDay = makeDay({
  stepsCount: 9800,
  exactRouteSegments: [{ id: 'r1', workoutId: 'w1', activityType: 'running', startedAt: '', endedAt: '', coordinates: [] }],
});
const runCreature = engine.buildEncounterCreature(runDay, {}, 'energy', 'focus');
check('run day matches Sprintail', runCreature?.name === 'Sprintail', JSON.stringify(runCreature));

// 6. High-steps day without a workout matches the walking character.
const stepsDay = makeDay({ stepsCount: 9000 });
const stepsCreature = engine.buildEncounterCreature(stepsDay, {}, 'energy', 'calm');
check('high-steps day matches Steppling', stepsCreature?.name === 'Steppling', JSON.stringify(stepsCreature));

// 7. Repeat favoring: park walk + single coffee with deep park history -> Mossprout.
const mixedDay = makeDay({ moments: [makeMoment('coffee', 0), makeMoment('walk', 1)], stepsCount: 3600 });
const parkHistory = { location_park_mossprout: { count: 3, lastSeenIsoDate: '2026-06-11' } };
const mixedCreature = engine.buildEncounterCreature(mixedDay, parkHistory, 'energy', 'calm');
check('repeat history favors returning character', mixedCreature?.name === 'Mossprout', JSON.stringify(mixedCreature?.name));

// 8. Day with no signals at all (moments the cast does not cover) falls back to null.
const socialDay = makeDay({ moments: [makeMoment('social', 0)], stepsCount: 3000 });
check('uncovered day returns null (trait fallback)', engine.buildEncounterCreature(socialDay, {}, 'social', 'calm') === null);

// 9. History recording: increments once per day, idempotent for same day.
let h = engine.recordEncounterHatch({}, 'location_park_mossprout', '2026-06-12');
h = engine.recordEncounterHatch(h, 'location_park_mossprout', '2026-06-12');
check('history idempotent per day', h.location_park_mossprout.count === 1, JSON.stringify(h));
h = engine.recordEncounterHatch(h, 'location_park_mossprout', '2026-06-13');
check('history increments next day', h.location_park_mossprout.count === 2, JSON.stringify(h));

console.log(failures === 0 ? '\nAll encounter-engine checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
