// Node-only verification harness for the World patch engine.
// Usage: node scripts/verify-world.cjs
const fs = require('fs');
const path = require('path');
const os = require('os');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-world-'));

// Rewire the app's `@/` path-alias requires to the flat temp filenames we emit.
const SPECIFIER_MAP = {
  '@/constants/world': './world-const',
  '@/utils/world-iso': './world-iso',
  '@/utils/world-archetype': './world-archetype',
  '@/utils/world-patch-engine': './world-patch-engine',
  '@/utils/world-build': './world-build',
  '@/utils/today-patch-engine': './today-patch-engine',
  '@/utils/daily-seeds-engine': './daily-seeds-engine',
};

function transpile(rel, out) {
  const source = fs.readFileSync(path.join(projectRoot, rel), 'utf8');
  let output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  for (const [from, to] of Object.entries(SPECIFIER_MAP)) {
    output = output.split(`"${from}"`).join(`"${to}"`).split(`'${from}'`).join(`'${to}'`);
  }
  fs.writeFileSync(path.join(tempDir, out), output);
}

// Order matters only for filenames; require() resolves lazily at call time.
transpile('constants/world.ts', 'world-const.js');
transpile('utils/world-iso.ts', 'world-iso.js');
transpile('utils/world-archetype.ts', 'world-archetype.js');
transpile('utils/world-patch-engine.ts', 'world-patch-engine.js');
transpile('utils/world-build.ts', 'world-build.js');
transpile('utils/world-scene.ts', 'world-scene.js');
transpile('utils/daily-seeds-engine.ts', 'daily-seeds-engine.js');
transpile('utils/note-meaning.ts', 'note-meaning.js');
transpile('utils/today-patch-engine.ts', 'today-patch-engine.js');

const { deriveArchetypes } = require(path.join(tempDir, 'world-archetype.js'));
const { generatePatch } = require(path.join(tempDir, 'world-patch-engine.js'));
const { buildWorld } = require(path.join(tempDir, 'world-build.js'));
const { spiralCoord } = require(path.join(tempDir, 'world-iso.js'));
const { layoutWorld } = require(path.join(tempDir, 'world-scene.js'));
const { deriveTodayPatch, computeCells } = require(path.join(tempDir, 'today-patch-engine.js'));
const { selectDailySeeds, earnedSeeds, seedCompletionRatio } = require(path.join(tempDir, 'daily-seeds-engine.js'));
const { interpretNoteText } = require(path.join(tempDir, 'note-meaning.js'));

let failures = 0;
function check(label, condition, detail) {
  if (condition) console.log(`  ok  ${label}`);
  else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

function rngFrom(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function input(overrides = {}) {
  return {
    dayId: 'd1',
    isoDate: '2026-06-20',
    nonce: 'nonce-d1',
    signals: { scores: { energy: 0.2, calm: 0.9, social: 0.5, exploration: 0.1, focus: 0.2 }, rarity: 'rare', livingFactorCount: 1, meaningfulCount: 0 },
    creatureId: 'c1',
    creatureVisualKey: 'hearthsip',
    creatureName: 'Hearthsip',
    rarity: 'rare',
    heroPhotoThumb: 'file://photo.jpg',
    heroMeaningLabel: 'A slow sip',
    primaryPlaceLabel: 'Cafe',
    newPlaceCount: 1,
    stepsCount: 1200,
    socialCount: 2,
    isMeaningful: false,
    timeLabel: 'Jun 20',
    ...overrides,
  };
}

// 1. Archetype derivation maps existing scores onto the six axes.
const calm = deriveArchetypes({ scores: { energy: 0.2, calm: 0.9, social: 0.3, exploration: 0.1, focus: 0.2 }, rarity: null, livingFactorCount: 0, meaningfulCount: 0 });
check('a calm day reads as Calm', calm.primary === 'calm', calm.primary);
const active = deriveArchetypes({ scores: { energy: 0.95, calm: 0.1, social: 0.2, exploration: 0.3, focus: 0.1 }, rarity: null, livingFactorCount: 0, meaningfulCount: 0 });
check('a high-energy day reads as Active', active.primary === 'active', active.primary);
const meaningful = deriveArchetypes({ scores: { energy: 0.2, calm: 0.3, social: 0.2, exploration: 0.1, focus: 0.2 }, rarity: 'legendary', livingFactorCount: 3, meaningfulCount: 2 });
check('a rare reflective day reads as Meaningful', meaningful.primary === 'meaningful', meaningful.primary);

// 2. A secondary archetype only appears when a real runner-up exists.
const dual = deriveArchetypes({ scores: { energy: 0.2, calm: 0.9, social: 0.85, exploration: 0.1, focus: 0.1 }, rarity: null, livingFactorCount: 0, meaningfulCount: 0 });
check('a balanced day gets a secondary', dual.secondary === 'social', String(dual.secondary));
const flat = deriveArchetypes({ scores: { energy: 0.1, calm: 0.9, social: 0.1, exploration: 0.05, focus: 0.05 }, rarity: null, livingFactorCount: 0, meaningfulCount: 0 });
check('a single-note day has no secondary', flat.secondary === null, String(flat.secondary));

// 3. A generated patch obeys the structural invariants.
const patch = generatePatch(input(), rngFrom(123));
const anchors = patch.objects.filter((o) => o.kind === 'anchor');
const creatures = patch.objects.filter((o) => o.kind === 'creature');
check('exactly one anchor', anchors.length === 1, String(anchors.length));
check('anchor matches the primary archetype', anchors[0].assetKey.startsWith('calm_'), anchors[0].assetKey);
check('exactly one creature placed', creatures.length === 1, String(creatures.length));
check('creature carries the day visual key', creatures[0].assetKey === 'creature:hearthsip', creatures[0].assetKey);
check('16 ground tiles', patch.tiles.length === 16, String(patch.tiles.length));
check('patch named', typeof patch.name === 'string' && patch.name.length > 0, patch.name);

// 4. Every placed cell is inside the 4×4 grid.
const allCells = [...patch.objects, ...patch.memoryNodes];
const inBounds = allCells.every((c) => c.col >= 0 && c.col < 4 && c.row >= 0 && c.row < 4);
check('all objects within the 4×4 grid', inBounds, JSON.stringify(allCells.map((c) => [c.col, c.row])));

// 5. No two objects/memories share a cell (anchor footprint aside).
const singleCells = allCells.filter((c) => (c.footprint ?? 1) === 1).map((c) => `${c.col},${c.row}`);
check('no single-tile slot collisions', new Set(singleCells).size === singleCells.length, singleCells.join(' '));

// 6. Memory nodes carry retrieval payloads from the real day.
const bloom = patch.memoryNodes.find((m) => m.kind === 'photo_bloom');
check('photo day yields a Photo Bloom', !!bloom, JSON.stringify(patch.memoryNodes.map((m) => m.kind)));
check('Photo Bloom stores the photo + meaning', bloom && bloom.photoThumbnailUri === 'file://photo.jpg' && bloom.meaningLabel === 'A slow sip', JSON.stringify(bloom));

// 7. Generation is deterministic for a fixed input + seed.
const a = JSON.stringify(generatePatch(input(), rngFrom(999)));
const b = JSON.stringify(generatePatch(input(), rngFrom(999)));
check('same input + seed → identical patch', a === b);

// 8. A day with no photo/new-place still generates, with fewer memory nodes.
const bare = generatePatch(input({ heroPhotoThumb: null, newPlaceCount: 0, stepsCount: 0, socialCount: 0, isMeaningful: false }), rngFrom(7));
check('a quiet day still gets a valid patch', bare.objects.filter((o) => o.kind === 'anchor').length === 1);
check('a quiet day has no forced memory nodes', bare.memoryNodes.length === 0, String(bare.memoryNodes.length));

// 9. buildWorld folds hatched days in, skips un-hatched, is idempotent, spirals out.
function day(id, isoDate, hatched) {
  return {
    id,
    isoDate,
    state: hatched ? 'hatched' : 'forming',
    dateLabel: 'Jun 20',
    stepsCount: 3000,
    newPlaceCount: 0,
    scores: { energy: 0.3, calm: 0.8, social: 0.4, exploration: 0.2, focus: 0.2 },
    creature: hatched ? { id: `cr-${id}`, name: 'Mossprout', visualKey: 'mossprout', rarity: 'common', livingFactors: [] } : null,
    moments: [],
    promptAnswers: [],
    capturedMeanings: [],
    locations: [],
    heroPhoto: null,
    dayMap: null,
    storedNonce: `nonce-${id}`,
  };
}
const empty = { version: 1, patches: [], builtDayIds: [] };
const w1 = buildWorld(empty, [day('d1', '2026-06-18', true), day('d2', '2026-06-19', false), day('d3', '2026-06-20', true)]);
check('only hatched days become patches', w1.patches.length === 2, String(w1.patches.length));
check('built day ids tracked', w1.builtDayIds.length === 2 && w1.builtDayIds.includes('d1') && w1.builtDayIds.includes('d3'));
check('patches placed oldest-first', w1.patches[0].dayId === 'd1' && w1.patches[1].dayId === 'd3');
const c0 = spiralCoord(0);
check('first patch sits at the origin cell', w1.patches[0].gridCol === c0.gridCol && w1.patches[0].gridRow === c0.gridRow);
check('second patch sits on a different cell', w1.patches[1].gridCol !== w1.patches[0].gridCol || w1.patches[1].gridRow !== w1.patches[0].gridRow);
const w2 = buildWorld(w1, [day('d1', '2026-06-18', true), day('d3', '2026-06-20', true)]);
check('re-running does not duplicate patches', w2.patches.length === 2, String(w2.patches.length));
const w3 = buildWorld(w2, [day('d4', '2026-06-21', true)]);
check('a new hatched day appends one patch', w3.patches.length === 3 && w3.patches[2].dayId === 'd4');
// Unified model: finalized world patches are cell-based with the creature placed.
const finalizedPatch = w3.patches[0];
check('finalized patches carry the four cells', Array.isArray(finalizedPatch.cells) && finalizedPatch.cells.length === 4, finalizedPatch.cells && String(finalizedPatch.cells.length));
check('finalized patch is hatched', finalizedPatch.status === 'hatched', finalizedPatch.status);
check('finalized patch seats the creature on the front corner tile', finalizedPatch.objects.some((o) => o.kind === 'creature' && o.col === 3 && o.row === 3));
check('a finalized day shows no ghost cells', layoutWorld([finalizedPatch]).ghosts.length === 0, String(layoutWorld([finalizedPatch]).ghosts.length));

// 10. Scene layout (renderer core) produces sane, finite geometry.
const scene = layoutWorld(w3.patches);
check('scene has a slab per patch', scene.slabs.length === w3.patches.length, String(scene.slabs.length));
check('scene size is positive', scene.width > 0 && scene.height > 0, `${scene.width}x${scene.height}`);
const finite = scene.sprites.every((s) => Number.isFinite(s.x) && Number.isFinite(s.y) && s.size > 0);
check('all sprites have finite, sized geometry', finite);
const positive = scene.sprites.every((s) => s.x >= 0 && s.y >= 0);
check('scene normalised to positive coords', positive);
const sorted = scene.sprites.every((s, i) => i === 0 || scene.sprites[i - 1].depth <= s.depth);
check('sprites painter-sorted back-to-front', sorted);
// Objects are 1:2 frames = one slot (2 stacked cells) of the 4x4 line grid; the
// frame width == one grid column == one tile.
const propSprite = scene.sprites.find((s) => s.kind === 'prop');
check('a cell object frame == one tile', propSprite && propSprite.size >= 120 && propSprite.size <= 130, propSprite && String(propSprite.size));

// 11. Every catalog key the engine can emit has a real bundled cutout on disk.
const { ARCHETYPE_ANCHORS, PROP_POOL, MEMORY_NODE_ASSET, ARCHETYPE_THEME } = require(path.join(tempDir, 'world-const.js'));
const assetsRoot = path.join(projectRoot, 'assets', 'images', 'katchimeras', 'world');
function assetExists(folder, key) {
  return fs.existsSync(path.join(assetsRoot, folder, `${key}.png`));
}
const anchorKeys = Object.values(ARCHETYPE_ANCHORS).flat().map((a) => a.key);
const missingAnchors = anchorKeys.filter((k) => !assetExists('anchors', k));
check('every anchor key has art', missingAnchors.length === 0, missingAnchors.join(', '));
const missingProps = PROP_POOL.map((p) => p.key).filter((k) => !assetExists('props', k));
check('every prop key has art', missingProps.length === 0, missingProps.join(', '));
const missingMemories = Object.values(MEMORY_NODE_ASSET).map((m) => m.key).filter((k) => !assetExists('memory-nodes', k));
check('every memory-node key has art', missingMemories.length === 0, missingMemories.join(', '));
const decalKeys = [...new Set(Object.values(ARCHETYPE_THEME).flatMap((t) => [t.groundTile, ...t.decals]))];
const missingDecals = decalKeys.filter((k) => !assetExists('decals', k));
check('every ground + accent tile has art', missingDecals.length === 0, missingDecals.join(', '));
const missingVariants = decalKeys.filter((k) => !assetExists('decals', `${k}_2`));
check('every decal has a _2 variant', missingVariants.length === 0, missingVariants.join(', '));
check('decal sprite atlas exists', fs.existsSync(path.join(assetsRoot, 'decals', '_atlas.png')));
check('fence strip art exists', fs.existsSync(path.join(assetsRoot, 'props', 'fence_strip.png')));

// 12. Scene decals (if the sampled world produced any) are finite + positioned.
check('scene exposes a decals layer', Array.isArray(scene.decals));
const decalsOk = scene.decals.every((d) => Number.isFinite(d.x) && Number.isFinite(d.y) && d.size > 0 && d.x >= 0 && d.y >= 0);
check('all decals have finite, sized geometry', decalsOk, String(scene.decals.length));

// 13. Today (live) patch engine — grows monotonically through the day.
const EGG = '1,1';
function tday(overrides = {}) {
  return {
    id: 'today-1',
    isoDate: '2026-06-24',
    state: 'forming',
    dateLabel: 'Jun 24',
    stepsCount: 0,
    newPlaceCount: 0,
    scores: { energy: 0.04, calm: 0.05, social: 0.03, exploration: 0.02, focus: 0.02 },
    creature: null,
    moments: [],
    promptAnswers: [],
    capturedMeanings: [],
    locations: [],
    heroPhoto: null,
    dayMap: null,
    storedNonce: 'today-nonce',
    egg: { accentColor: '#A78BFA', haloColor: '#A78BFA', coreColor: '#fff', intensity: 0.2, shimmer: false, swirl: 0.1, label: 'Still forming' },
    ...overrides,
  };
}

const cellOf = (patch, type) => patch.cells.find((c) => c.type === type);

// Bare morning: four EMPTY cells (ghost spots), egg only, neutral ground.
const morning = deriveTodayPatch(tday(), null);
check('morning patch has no objects', morning.objects.length === 0, String(morning.objects.length));
check('morning patch is forming', morning.status === 'forming', morning.status);
check('forming patch is named Today', morning.name === 'Today', morning.name);
check('today patch carries the egg visual', morning.eggVisual && morning.eggVisual.label === 'Still forming');
check('morning patch has the 4 capsule cells', morning.cells && morning.cells.length === 4, morning.cells && String(morning.cells.length));
check('the four cells are memory/places/journey/reflection', ['memory', 'places', 'journey', 'reflection'].every((t) => morning.cells.some((c) => c.type === t)));
check('every morning cell is empty (level 0)', morning.cells.every((c) => c.level === 0));

// Forming ground is uniform; empty cells render as ghost spots (egg has none).
const morningScene = layoutWorld([morning]);
check('forming plot uses one fixed decal on every tile', morningScene.decals.length > 0 && morningScene.decals.every((d) => d.decal === 'grass'), [...new Set(morningScene.decals.map((d) => d.decal))].join(','));
check('morning scene shows 4 ghost cells', morningScene.ghosts.length === 4, String(morningScene.ghosts.length));
const cellAt = (t) => morning.cells.find((c) => c.type === t);
check(
  'chests line the back-right row (memory/places/journey on row 0, steps far corner)',
  cellAt('memory').col === 0 && cellAt('memory').row === 0 &&
    cellAt('places').col === 2 && cellAt('places').row === 0 &&
    cellAt('journey').col === 3 && cellAt('journey').row === 0
);
check('the egg front-corner tile (3,3) is free of cells', morning.cells.every((c) => !(c.col === 3 && c.row === 3)));

// Memory Vault levels up with captured media; a fuller vault shows a richer asset.
const onePhoto = deriveTodayPatch(tday({ heroPhoto: { thumbnailUri: 'file://p.jpg' }, capturedMeanings: [{ archetype: 'calm', label: 'x' }] }), null);
check('captured media levels the Memory Vault', cellOf(onePhoto, 'memory').level >= 1, String(cellOf(onePhoto, 'memory').level));
check('Memory Vault grows a memory-tree object', onePhoto.objects.some((o) => o.category === 'memory' && /memory_tree_/.test(o.assetKey)));
check('Memory Vault badge counts the media', cellOf(onePhoto, 'memory').count === 2, String(cellOf(onePhoto, 'memory').count));
check('the vault object carries its badge count', onePhoto.objects.find((o) => o.category === 'memory').badge === 2);
const fullVault = computeCells(tday({ capturedMeanings: [{ archetype: 'calm' }, { archetype: 'calm' }, { archetype: 'calm' }, { archetype: 'calm' }] }));
check('more media → a higher Memory Vault level + asset', fullVault.find((c) => c.type === 'memory').level >= 3 && fullVault.find((c) => c.type === 'memory').assetKey === 'memory_tree_3');

// Places — a new place raises the cell to a watchtower.
const newPlaceDay = deriveTodayPatch(tday({ visitedPlaceCount: 1, newPlaceCount: 1 }), null);
check('a new place lifts Places to a watchtower', cellOf(newPlaceDay, 'places').assetKey === 'exploration_tower', cellOf(newPlaceDay, 'places').assetKey);

// Journey — a big walk reads as a bridge; no steps reads as a restful (level 0) cell.
const bigWalk = deriveTodayPatch(tday({ stepsCount: 8000 }), null);
check('a big walk levels the Journey cell', cellOf(bigWalk, 'journey').level >= 3, String(cellOf(bigWalk, 'journey').level));
check('Journey badge is the raw step count', cellOf(bigWalk, 'journey').count === 8000, String(cellOf(bigWalk, 'journey').count));
check('a still day leaves Journey empty', cellOf(deriveTodayPatch(tday(), null), 'journey').level === 0);

// Reflection — mood drives the cell's object (calm pond vs social campfire).
const calmDay = deriveTodayPatch(tday({ capturedMeanings: [{ archetype: 'calm', label: 'Quiet' }] }), null);
check('a calm day reflects as a pond', cellOf(calmDay, 'reflection').assetKey === 'calm_pond', cellOf(calmDay, 'reflection').assetKey);
const socialDay = deriveTodayPatch(tday({ capturedMeanings: [{ archetype: 'together', label: 'Friends' }, { archetype: 'together', label: 'More' }] }), null);
check('a social day reflects as a campfire', cellOf(socialDay, 'reflection').assetKey === 'social_campfire', cellOf(socialDay, 'reflection').assetKey);

// Every grown object is tagged with its cell and carries a "built from" line.
const richDay = deriveTodayPatch(tday({ heroPhoto: { thumbnailUri: 'file://p.jpg' }, capturedMeanings: [{ archetype: 'calm', label: 'x' }], visitedPlaceCount: 1, stepsCount: 8000 }), null);
check('objects are tagged with their cell type', richDay.objects.every((o) => ['memory', 'places', 'journey', 'reflection'].includes(o.category)));
check('grown objects are traceable (carry a source)', richDay.objects.every((o) => !!o.sourceLabel));
check('at most four cell objects', richDay.objects.length <= 4, String(richDay.objects.length));
check('no object sits on the egg cell', ![...richDay.objects].some((c) => `${c.col},${c.row}` === EGG));

// Monotonic: as the day accumulates, no cell ever drops a level.
const steps = [
  tday({ capturedMeanings: [{ archetype: 'calm', label: 'a' }] }),
  tday({ capturedMeanings: [{ archetype: 'calm', label: 'a' }], heroPhoto: { thumbnailUri: 'file://p.jpg' }, stepsCount: 3200 }),
  tday({ capturedMeanings: [{ archetype: 'calm', label: 'a' }, { archetype: 'calm', label: 'b' }], heroPhoto: { thumbnailUri: 'file://p.jpg' }, stepsCount: 12500, visitedPlaceCount: 1, newPlaceCount: 1 }),
];
const snaps = steps.map((d) => computeCells(d));
let monotonic = true;
for (const type of ['memory', 'places', 'journey', 'reflection']) {
  for (let i = 1; i < snaps.length; i += 1) {
    const prevLvl = snaps[i - 1].find((c) => c.type === type).level;
    const curLvl = snaps[i].find((c) => c.type === type).level;
    if (curLvl < prevLvl) monotonic = false;
  }
}
check('cell levels never decrease as the day grows', monotonic);

// ready_to_hatch propagates to the patch status.
const ready = deriveTodayPatch(tday({ state: 'ready_to_hatch', capturedMeanings: [{ archetype: 'calm', label: 'x' }] }), null);
check('ready_to_hatch day → readyToHatch patch', ready.status === 'readyToHatch', ready.status);

// The live patch is layout-able by the same scene engine the world uses.
const todayScene = layoutWorld([richDay]);
check('today patch lays out into a scene', todayScene.slabs.length === 1 && todayScene.width > 0 && todayScene.height > 0);

// 14. Daily Seeds — micro-actions that CONTRIBUTE to a cell's level.
const seedsOffered = selectDailySeeds(tday());
check('offers at most 3 daily seeds', seedsOffered.length <= 3, String(seedsOffered.length));
check('offered seeds are stable per day', JSON.stringify(selectDailySeeds(tday())) === JSON.stringify(seedsOffered));

// Passive seed: a short walk (>=1000 steps) is earned automatically.
const walked = earnedSeeds(tday({ stepsCount: 1500 }));
check('a short walk earns the movement seed', walked.some((s) => s.id === 'movement'), walked.map((s) => s.id).join(','));
check('a still day earns no passive seeds', earnedSeeds(tday()).length === 0);

// A completed seed contributes to its cell (social → Reflection, water → Journey).
const socialSeed = deriveTodayPatch(tday({ seedCompletions: ['social'] }), null);
check('a social seed lifts the Reflection cell', cellOf(socialSeed, 'reflection').level >= 1, String(cellOf(socialSeed, 'reflection').level));
const waterSeed = deriveTodayPatch(tday({ seedCompletions: ['water'] }), null);
check('a water seed lifts the Journey cell', cellOf(waterSeed, 'journey').level >= 1, String(cellOf(waterSeed, 'journey').level));
check('a filled cell drops its ghost', layoutWorld([socialSeed]).ghosts.length === 3, String(layoutWorld([socialSeed]).ghosts.length));

// New cutouts are on disk (others reuse existing world art).
check('water-lily seed asset has art', assetExists('props', 'seed_water_lily'));
check('Memory tree stages have art', ['memory_tree_1', 'memory_tree_2', 'memory_tree_3', 'memory_tree_4'].every((k) => assetExists('props', k)));

// Completion ratio rises as offered seeds are earned.
check('completion ratio is 0 on a still morning', seedCompletionRatio(tday()) === 0);
check('completion ratio rises once an offered seed is earned', seedCompletionRatio(tday({ seedCompletions: [seedsOffered[0].id] })) > 0, String(seedsOffered[0] && seedsOffered[0].id));

// 15. Notes + Big Moments (Today Patch V3).
const bday = interpretNoteText("It's my son's birthday today");
check('a birthday note is a Big Moment', bday.bigMoment && bday.bigMoment.type === 'birthday', JSON.stringify(bday.bigMoment));
check('the birthday note names the subject', bday.bigMoment && bday.bigMoment.subject === 'son', bday.bigMoment && String(bday.bigMoment.subject));
check('the birthday note labels it nicely', /birthday/i.test(bday.label), bday.label);
check('a plain calm note is no Big Moment', !interpretNoteText('a calm quiet morning').bigMoment);
check('a plain calm note reads as calm', interpretNoteText('a calm quiet morning').archetype === 'calm');
check('an achievement note is detected', interpretNoteText('I finally got the promotion at work').bigMoment?.type === 'achievement');

// A note grows a SEPARATE notes object (not the photos tree) + lifts Reflection.
const noteDay = deriveTodayPatch(tday({ notes: [{ id: 'n1', kind: 'text', text: 'x', audioUri: null, durationMs: null, archetype: 'calm', label: 'A calm note', createdAt: '' }] }), null);
const notesObj = noteDay.objects.find((o) => o.category === 'notes');
check('a note grows a separate notes object', !!notesObj && notesObj.assetKey === 'notes_journal_1', notesObj && notesObj.assetKey);
check('the notes object has a count + pencil badge', !!notesObj && notesObj.badge === 1 && notesObj.badgeIcon === 'square.and.pencil');
check('a text note does NOT fill the photos tree', cellOf(noteDay, 'memory').level === 0, String(cellOf(noteDay, 'memory').level));
check('a note lifts the Reflection cell', cellOf(noteDay, 'reflection').level >= 1, String(cellOf(noteDay, 'reflection').level));

// More notes level the journaling family up (one family for text + voice).
const manyNotes = deriveTodayPatch(tday({ notes: Array.from({ length: 5 }, (_, i) => ({ id: `n${i}`, kind: 'text', text: 'x', audioUri: null, durationMs: null, archetype: 'calm', label: 'note', createdAt: '' })) }), null);
check('more notes raise the journaling level', manyNotes.objects.find((o) => o.category === 'notes')?.assetKey === 'notes_journal_3', manyNotes.objects.find((o) => o.category === 'notes')?.assetKey);
check('the notes family has art', ['notes_journal_1', 'notes_journal_2', 'notes_journal_3', 'notes_journal_4'].every((k) => assetExists('props', k)));

// Big Moment landmark art per type.
const anniv = deriveTodayPatch(tday({ bigMoments: [{ id: 'a1', type: 'anniversary', label: 'Anniversary', subject: null, noteId: null, createdAt: '' }] }), null);
check('an anniversary grows the golden arch', anniv.objects.find((o) => o.kind === 'landmark')?.assetKey === 'landmark_arch');
const trip = deriveTodayPatch(tday({ bigMoments: [{ id: 't1', type: 'trip', label: 'A trip', subject: null, noteId: null, createdAt: '' }] }), null);
check('a trip grows the travel gate', trip.objects.find((o) => o.kind === 'landmark')?.assetKey === 'landmark_gate');
check('new Slice-4 assets have art', ['vault_crystal_archive', 'landmark_arch', 'landmark_gate'].every((k) => assetExists('props', k)));

// A confirmed Big Moment grows a centre landmark, leaving the four cells intact.
const bmDay = deriveTodayPatch(tday({ bigMoments: [{ id: 'b1', type: 'birthday', label: "Son's birthday", subject: 'son', noteId: 'n1', createdAt: '' }] }), null);
const landmark = bmDay.objects.find((o) => o.kind === 'landmark');
check('a Big Moment grows the festival landmark', !!landmark && landmark.assetKey === 'landmark_festival', landmark && landmark.assetKey);
check('the landmark sits in a centre tile', !!landmark && (landmark.col === 1 || landmark.col === 2) && (landmark.row === 1 || landmark.row === 2));
check('the four cells survive alongside the landmark', bmDay.cells.length === 4);
check('the festival landmark asset has art', assetExists('props', 'landmark_festival'));

console.log(failures === 0 ? '\nAll world checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
