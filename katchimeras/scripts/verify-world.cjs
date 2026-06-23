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

const { deriveArchetypes } = require(path.join(tempDir, 'world-archetype.js'));
const { generatePatch } = require(path.join(tempDir, 'world-patch-engine.js'));
const { buildWorld } = require(path.join(tempDir, 'world-build.js'));
const { spiralCoord } = require(path.join(tempDir, 'world-iso.js'));
const { layoutWorld } = require(path.join(tempDir, 'world-scene.js'));

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
const anchorSprite = scene.sprites.find((s) => s.kind === 'anchor');
check('anchor sprite frame == one tile', anchorSprite && anchorSprite.size >= 120 && anchorSprite.size <= 130, anchorSprite && String(anchorSprite.size));

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

console.log(failures === 0 ? '\nAll world checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
