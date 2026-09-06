const {contentPath, assetSpecifier, readVerificationSource} = require('@incubator/art-pipeline/context');
// Node-only verification harness for the life-map aggregator.
// Usage: node scripts/verify-life-map.cjs
const fs = require('fs');
const path = require('path');
const os = require('os');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-lifemap-'));

function transpileToTemp(rel, out) {
  const source = readVerificationSource(contentPath(projectRoot, rel), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const outPath = path.join(tempDir, out);
  fs.writeFileSync(outPath, output);
  return outPath;
}

const { buildLifeMap } = require(transpileToTemp('utils/life-map-engine.ts', 'life-map-engine.js'));

let failures = 0;
function check(label, condition, detail) {
  if (condition) console.log(`  ok  ${label}`);
  else { failures += 1; console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`); }
}

function loc(lat, lng, hasPhoto = false) {
  return { id: `l-${lat}-${lng}`, lat, lng, capturedAt: '2026-06-12T10:00:00Z', type: 'unknown', hasPhoto, source: 'foreground', momentId: null };
}
function day(id, isoDate, locations, creature = null) {
  return { id, isoDate, state: creature ? 'hatched' : 'forming', stepsCount: 0, visitedPlaceCount: 0, newPlaceCount: 0, locationSampleCount: locations.length, shareReadyAt: null, moments: [], locations, healthRouteImport: null, exactRouteSegments: [], selectedPathId: null, creature };
}
const baristabbit = { name: 'Baristabbit', visualKey: 'baristabbit', accentColor: '#E3B68C', rarity: 'rare' };

// 1. One pin per day that has a location, ordered oldest → newest.
const map = buildLifeMap([
  day('d3', '2026-06-14', [loc(40.2, -74.0)], baristabbit),
  day('d1', '2026-06-12', [loc(40.0, -74.0, true)]),
  day('d2', '2026-06-13', [loc(40.1, -74.0)]),
]);
check('a pin per located day', map.pins.length === 3, JSON.stringify(map.pins.length));
check('pins ordered by date', map.pins.map((p) => p.isoDate).join(',') === '2026-06-12,2026-06-13,2026-06-14');

// 2. Hatched days carry the creature; un-hatched do not.
const hatchedPin = map.pins.find((p) => p.dayId === 'd3');
const formingPin = map.pins.find((p) => p.dayId === 'd1');
check('hatched pin carries creature', hatchedPin.hatched && hatchedPin.creatureName === 'Baristabbit' && hatchedPin.creatureVisualKey === 'baristabbit' && hatchedPin.rarity === 'rare');
check('un-hatched pin has no creature', !formingPin.hatched && formingPin.creatureVisualKey === null && formingPin.rarity === null);
check('date label formatted', formingPin.dateLabel === 'Jun 12', formingPin.dateLabel);

// 3. The photographed spot is preferred as the day's coordinate.
check('photo spot wins as coordinate', formingPin.latitude === 40.0 && formingPin.longitude === -74.0);

// 4. With no photo, the centroid of the day's locations is used.
const centroidMap = buildLifeMap([day('c1', '2026-06-12', [loc(40.0, -74.0), loc(42.0, -76.0)])]);
check('centroid used without a photo', Math.abs(centroidMap.pins[0].latitude - 41.0) < 1e-9 && Math.abs(centroidMap.pins[0].longitude - -75.0) < 1e-9, JSON.stringify(centroidMap.pins[0]));

// 5. Days with no location are skipped.
const sparse = buildLifeMap([day('x', '2026-06-12', []), day('y', '2026-06-13', [loc(40, -74)])]);
check('locationless days skipped', sparse.pins.length === 1 && sparse.pins[0].dayId === 'y');

// 6. Viewport frames all pins; null when empty.
check('viewport centers on the pins', map.viewport && Math.abs(map.viewport.latitude - 40.1) < 1e-9, JSON.stringify(map.viewport));
check('empty input yields null viewport', buildLifeMap([]).viewport === null && buildLifeMap([]).pins.length === 0);

console.log(failures === 0 ? '\nAll life-map checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
