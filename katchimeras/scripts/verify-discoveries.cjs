// Node-only verification harness for the Discoveries engine (Phase 0). No test
// runner in this project: transpile the pure modules with TypeScript and run
// scenarios. Usage: node scripts/verify-discoveries.cjs
const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-disc-'));

function transpileToTemp(relativeSourcePath, outName) {
  const source = fs.readFileSync(path.join(projectRoot, relativeSourcePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const outPath = path.join(tempDir, outName);
  fs.writeFileSync(outPath, output);
  return outPath;
}

// engine imports @/utils/discoveries-catalog at runtime; alias it to the transpiled
// catalog. (context + catalog have only type imports → erased → no other stubs.)
const catalogPath = transpileToTemp('utils/discoveries-catalog.ts', 'discoveries-catalog.js');
const stubs = { '@/utils/discoveries-catalog': catalogPath };
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request in stubs) return stubs[request];
  return originalResolve.call(this, request, ...rest);
};

const { buildDiscoveryContext } = require(transpileToTemp('utils/discoveries-context.ts', 'discoveries-context.js'));
const { evaluateDiscoveries, passingDiscoveryIds } = require(transpileToTemp('utils/discoveries-engine.ts', 'discoveries-engine.js'));
const { DISCOVERY_CATALOG } = require(catalogPath);
const artefacts = require(transpileToTemp('utils/discoveries-artefacts.ts', 'discoveries-artefacts.js'));

let failures = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok  ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

const NOW = new Date('2026-06-25T12:00:00Z');
const CALM = { calm: 0.7, energy: 0.1, social: 0.1, exploration: 0.1, focus: 0.1 };
const FLAT = { calm: 0.2, energy: 0.5, social: 0.1, exploration: 0.1, focus: 0.1 };

function day(overrides = {}) {
  return {
    id: overrides.isoDate ? `day-${overrides.isoDate}` : 'day-x',
    isoDate: '2026-06-20',
    state: 'forming',
    stepsCount: 0,
    scores: FLAT,
    confirmedPlaces: [],
    capturedMeanings: [],
    heroPhoto: null,
    notes: [],
    foodMoments: [],
    bigMoments: [],
    promptAnswers: [],
    moments: [],
    creature: null,
    ...overrides,
  };
}

const ctx = (days, health) => buildDiscoveryContext(days, NOW, health);
const passes = (days, id) => passingDiscoveryIds(ctx(days)).includes(id);

// helpers
const place = (category) => ({ id: `n-${Math.round(Math.random() * 1e9)}`, category, archetype: 'calm', label: category, confirmedAt: '' });
const consecutive = (n, overrides) =>
  Array.from({ length: n }, (_, i) => day({ isoDate: `2026-06-${String(i + 1).padStart(2, '0')}`, ...overrides }));

// ───────────────────────── context counting ─────────────────────────
const empty = ctx([]);
check('empty history → zero aggregates', empty.dayCount === 0 && empty.photoCount === 0 && empty.uniquePlaceCount === 0);
check('empty history unlocks nothing', passingDiscoveryIds(empty).length === 0);

const twoMuseums = [day({ confirmedPlaces: [place('museum')] }), day({ confirmedPlaces: [place('museum')] })];
const mc = ctx(twoMuseums);
check('place category counted', mc.placeCategoryCounts.museum === 2, JSON.stringify(mc.placeCategoryCounts));
check('uniquePlaceCount sums confirmed places', mc.uniquePlaceCount === 2, String(mc.uniquePlaceCount));

check('photoCount = capturedMeanings + heroPhoto', ctx([day({ capturedMeanings: [{}, {}], heroPhoto: { assetId: 'a' } })]).photoCount === 3);
check('voiceMemoryCount counts only voice notes', ctx([day({ notes: [{ kind: 'voice' }, { kind: 'text' }, { kind: 'voice' }] })]).voiceMemoryCount === 2);
check('foodMemoryCount sums food moments', ctx([day({ foodMoments: [{}, {}] })]).foodMemoryCount === 2);
check(
  'meaningfulMomentCount sums meaning-tagged entries',
  ctx([day({ capturedMeanings: [{}], confirmedPlaces: [place('cafe')], foodMoments: [{}], bigMoments: [{ type: 'trip' }], notes: [{ kind: 'voice' }] })]).meaningfulMomentCount === 5
);
check('bigMomentTypes collects types', ctx([day({ bigMoments: [{ type: 'birthday' }] })]).bigMomentTypes.has('birthday'));
check('maxStepsInADay takes the peak', ctx([day({ stepsCount: 8000 }), day({ stepsCount: 21000 })]).maxStepsInADay === 21000);
check('reflectionCount ignores dismissed + non-reflection kinds', ctx([day({ promptAnswers: [{ kind: 'feeling' }, { kind: 'feeling', dismissed: true }, { kind: 'meaningful_photo' }] })]).reflectionCount === 1);
check('calm day = dominant calm facet', ctx([day({ scores: CALM }), day({ scores: FLAT })]).calmDayCount === 1);
check('hatched days count as finalised patches', ctx([day({ state: 'hatched' }), day({ state: 'forming' })]).finalisedPatchCount === 1);
check('legendary creature counted', ctx([day({ state: 'hatched', creature: { rarity: 'legendary' } })]).legendaryPatchCount === 1);

// walking streak
check('7 consecutive walking days → streak 7', ctx(consecutive(7, { stepsCount: 6000 })).walkingStreak === 7);
check('6 consecutive walking days → streak 6', ctx(consecutive(6, { stepsCount: 6000 })).walkingStreak === 6);
check(
  'a gap breaks the streak',
  ctx([day({ isoDate: '2026-06-01', stepsCount: 6000 }), day({ isoDate: '2026-06-03', stepsCount: 6000 })]).walkingStreak === 1
);
check('low-step day is not a walking day', ctx([day({ stepsCount: 1000 })]).walkingStreak === 0);
check('a walk moment counts as a walking day', ctx([day({ stepsCount: 0, moments: [{ type: 'walk' }] })]).walkingStreak === 1);

// ───────────────────────── thresholds fire correctly ─────────────────────────
check('first_museum fires at 1 museum', passes([day({ confirmedPlaces: [place('museum')] })], 'first_museum'));
check('first_museum does NOT fire at 0', !passes([day()], 'first_museum'));
check('museums_5 (hidden) fires at 5', passes([day({ confirmedPlaces: Array.from({ length: 5 }, () => place('museum')) })], 'museums_5'));
check('first_voice_memory fires', passes([day({ notes: [{ kind: 'voice' }] })], 'first_voice_memory'));
check('photos_100 fires at 100', passes([day({ capturedMeanings: Array.from({ length: 100 }, () => ({})) })], 'photos_100'));
check('steps_20k fires at 21k, steps_10k too', passingDiscoveryIds(ctx([day({ stepsCount: 21000 })])).includes('steps_20k'));
check('steps_20k does NOT fire at 12k', !passes([day({ stepsCount: 12000 })], 'steps_20k'));
check('walk_streak_7 fires on a 7-day streak', passes(consecutive(7, { stepsCount: 6000 }), 'walk_streak_7'));
check('calm_30 fires at 30 calm days', passes(consecutive(30, { scores: CALM }), 'calm_30'));
check('first_birthday fires only with a birthday', passes([day({ bigMoments: [{ type: 'birthday' }] })], 'big_birthday') && !passes([day({ bigMoments: [{ type: 'trip' }] })], 'big_birthday'));
check('first_patch fires on a hatched day', passes([day({ state: 'hatched' })], 'first_patch'));
check('first_legendary (hidden) fires on a legendary hatch', passes([day({ state: 'hatched', creature: { rarity: 'legendary' } })], 'first_legendary'));

// ───────────────────────── evaluate: diff + monotonicity ─────────────────────────
const museumCtx = ctx([day({ confirmedPlaces: [place('museum')] })]);
const fresh = evaluateDiscoveries(museumCtx, {});
check('evaluate reports a passing, not-yet-unlocked discovery', fresh.newlyUnlocked.some((d) => d.id === 'first_museum'));
const already = evaluateDiscoveries(museumCtx, { first_museum: { id: 'first_museum', unlockedAt: 1, sourceMomentIds: [], seenAnimation: true } });
check('evaluate does NOT re-report an already-unlocked discovery (monotonic)', !already.newlyUnlocked.some((d) => d.id === 'first_museum'));
check('evaluate on empty history yields nothing', evaluateDiscoveries(ctx([]), {}).newlyUnlocked.length === 0);

// ───────────────────────── catalog integrity ─────────────────────────
const ids = DISCOVERY_CATALOG.map((d) => d.id);
check('catalog ids are unique', new Set(ids).size === ids.length, `${ids.length} ids`);
const CATS = new Set(['exploration', 'memory', 'life', 'journey', 'reflection', 'world']);
const RAR = new Set(['common', 'rare', 'epic', 'legendary']);
check('every def has valid category + rarity', DISCOVERY_CATALOG.every((d) => CATS.has(d.category) && RAR.has(d.rarity)));
check('every def has a name, icon, and test fn', DISCOVERY_CATALOG.every((d) => !!d.name && !!d.icon && typeof d.test === 'function'));
check('all six categories are represented', CATS.size === new Set(DISCOVERY_CATALOG.map((d) => d.category)).size);
check('there are hidden discoveries', DISCOVERY_CATALOG.some((d) => d.hidden));
check('some discoveries grant a world reward', DISCOVERY_CATALOG.some((d) => !!d.worldRewardId));

// ───────────────────────── world artefacts (Phase 3) ─────────────────────────
const rewardIds = DISCOVERY_CATALOG.filter((d) => d.worldRewardId).map((d) => d.worldRewardId);
check(
  'every catalog worldRewardId has an ARTEFACT_DEF',
  rewardIds.every((id) => !!artefacts.ARTEFACT_DEFS[id]),
  rewardIds.filter((id) => !artefacts.ARTEFACT_DEFS[id]).join(',')
);
check('every ARTEFACT_DEF has a name + assetKey', Object.values(artefacts.ARTEFACT_DEFS).every((a) => !!a.name && !!a.assetKey));

const entriesFor = (unlockedIds) =>
  DISCOVERY_CATALOG.map((def) => ({
    def,
    record: unlockedIds.includes(def.id) ? { id: def.id, unlockedAt: 1, sourceMomentIds: [], seenAnimation: true } : null,
  }));
const collected = artefacts.collectUnlockedArtefacts(entriesFor(['first_museum', 'first_reflection']));
check('collectUnlockedArtefacts returns only rewarded + unlocked', collected.length === 1 && collected[0].rewardId === 'artefact_museum_banner', JSON.stringify(collected));
check('collectUnlockedArtefacts skips locked discoveries', artefacts.collectUnlockedArtefacts(entriesFor([])).length === 0);

const placed = artefacts.placeArtefacts(collected);
check('placeArtefacts assigns a ring slot', placed.length === 1 && typeof placed[0].col === 'number' && typeof placed[0].row === 'number');
check(
  'placeArtefacts caps to available ring slots',
  artefacts.placeArtefacts([...Object.values(artefacts.ARTEFACT_DEFS), ...Object.values(artefacts.ARTEFACT_DEFS)]).length <= artefacts.ARTEFACT_RING_SLOTS.length
);

console.log(failures === 0 ? '\nAll discovery checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
