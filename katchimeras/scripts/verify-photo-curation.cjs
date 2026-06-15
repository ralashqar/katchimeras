// Node-only verification harness for the photo curation module (no test runner
// in this project). Transpiles the pure module and runs acceptance scenarios.
// Usage: node scripts/verify-photo-curation.cjs
const fs = require('fs');
const path = require('path');
const os = require('os');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-curation-'));

function transpileToTemp(relativeSourcePath, outName) {
  const source = fs.readFileSync(path.join(projectRoot, relativeSourcePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const outPath = path.join(tempDir, outName);
  fs.writeFileSync(outPath, output);
  return outPath;
}

const { curatePhotos } = require(transpileToTemp('utils/photo-curation.ts', 'photo-curation.js'));

const BASE = new Date('2026-06-12T10:00:00.000Z').getTime();
function photo(id, overrides = {}) {
  return { id, createdAt: BASE, width: 3000, height: 2000, ...overrides };
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

// 1. Screenshots are dropped.
const r1 = curatePhotos([
  photo('a', { createdAt: BASE }),
  photo('shot', { createdAt: BASE + 60_000, isScreenshot: true }),
]);
check('screenshot dropped', r1.keepers.map((p) => p.id).join(',') === 'a', JSON.stringify(r1.keepers.map((p) => p.id)));
check('screenshot counted', r1.summary.screenshots === 1, JSON.stringify(r1.summary));

// 2. A burst collapses to one keeper (highest resolution wins).
const burst = curatePhotos([
  photo('b1', { createdAt: BASE, width: 3000, height: 2000, latitude: 40, longitude: -74 }),
  photo('b2', { createdAt: BASE + 2_000, width: 4000, height: 3000, latitude: 40.0001, longitude: -74.0001 }),
  photo('b3', { createdAt: BASE + 4_000, width: 3000, height: 2000, latitude: 40.0001, longitude: -74.0001 }),
]);
check('burst collapses to one', burst.keepers.length === 1, JSON.stringify(burst.keepers.map((p) => p.id)));
check('highest-resolution keeper wins', burst.keepers[0]?.id === 'b2', burst.keepers[0]?.id);
check('burst duplicates counted', burst.summary.burstDuplicates === 2, JSON.stringify(burst.summary));

// 3. Photos far apart in time are NOT a burst, even at the same spot.
const spaced = curatePhotos([
  photo('s1', { createdAt: BASE }),
  photo('s2', { createdAt: BASE + 120_000 }),
]);
check('time-separated photos both kept', spaced.keepers.length === 2, JSON.stringify(spaced.keepers.map((p) => p.id)));

// 3b. Without a visual signal, the pure-time window is tight: ~10s apart is no
// longer treated as a burst (we don't collapse on time alone past a few sec).
const slowNoHash = curatePhotos([
  photo('w1', { createdAt: BASE, latitude: 40, longitude: -74 }),
  photo('w2', { createdAt: BASE + 10_000, latitude: 40, longitude: -74 }),
]);
check('10s gap without hash keeps both', slowNoHash.keepers.length === 2, JSON.stringify(slowNoHash.keepers.map((p) => p.id)));

// 3c. Similarity is primary: look-alikes (matching hash) collapse across a wide
// gap; the same wide gap WITHOUT hashes keeps both.
const hashed = curatePhotos([
  photo('h1', { createdAt: BASE, latitude: 40, longitude: -74, similarityHash: 'ffff0000ffff0000' }),
  photo('h2', { createdAt: BASE + 90_000, latitude: 40, longitude: -74, similarityHash: 'ffff0000ffff0001' }),
]);
check('hash look-alikes collapse over wide gap', hashed.keepers.length === 1, JSON.stringify(hashed.keepers.map((p) => p.id)));
const unhashedWide = curatePhotos([
  photo('n1', { createdAt: BASE, latitude: 40, longitude: -74 }),
  photo('n2', { createdAt: BASE + 90_000, latitude: 40, longitude: -74 }),
]);
check('no-hash wide gap keeps both', unhashedWide.keepers.length === 2, JSON.stringify(unhashedWide.keepers.map((p) => p.id)));

// 3d. Similarity overrides time: two DIFFERENT-looking frames seconds apart at
// the same spot are both kept (distinct subjects, not a burst).
const differentClose = curatePhotos([
  photo('d1', { createdAt: BASE, latitude: 40, longitude: -74, similarityHash: 'ffffffffffffffff' }),
  photo('d2', { createdAt: BASE + 3_000, latitude: 40, longitude: -74, similarityHash: '0000000000000000' }),
]);
check('different-looking frames kept despite time proximity', differentClose.keepers.length === 2, JSON.stringify(differentClose.keepers.map((p) => p.id)));

// 3e. Slightly-different look-alikes (within Hamming threshold) still collapse.
const nearAlike = curatePhotos([
  photo('a1', { createdAt: BASE, latitude: 40, longitude: -74, similarityHash: 'abcdef0123456789' }),
  photo('a2', { createdAt: BASE + 20_000, latitude: 40, longitude: -74, similarityHash: 'abcdef0123456788' }),
]);
check('near-identical hashes collapse', nearAlike.keepers.length === 1, JSON.stringify(nearAlike.keepers.map((p) => p.id)));

// 4. Close in time but far apart in space are NOT a burst (different places).
const apart = curatePhotos([
  photo('p1', { createdAt: BASE, latitude: 40.0, longitude: -74.0 }),
  photo('p2', { createdAt: BASE + 3_000, latitude: 40.5, longitude: -74.0 }),
]);
check('distant photos both kept', apart.keepers.length === 2, JSON.stringify(apart.keepers.map((p) => p.id)));

// 5. Tiny throwaways are dropped; real photos are kept.
const tiny = curatePhotos([
  photo('real', { createdAt: BASE, width: 3000, height: 2000 }),
  photo('junk', { createdAt: BASE + 60_000, width: 80, height: 80 }),
]);
check('low-resolution dropped', tiny.keepers.map((p) => p.id).join(',') === 'real', JSON.stringify(tiny.keepers.map((p) => p.id)));
check('low-resolution counted', tiny.summary.lowResolution === 1, JSON.stringify(tiny.summary));

// 6. Unknown dimensions are never dropped on a guess.
const unknown = curatePhotos([{ id: 'u1', createdAt: BASE }, { id: 'u2', createdAt: BASE + 60_000 }]);
check('unknown dimensions kept', unknown.keepers.length === 2, JSON.stringify(unknown.summary));

// 7. Original ordering is preserved in the kept set.
const order = curatePhotos([
  photo('z', { createdAt: BASE + 60_000 }),
  photo('y', { createdAt: BASE + 120_000 }),
  photo('x', { createdAt: BASE + 180_000 }),
]);
check('caller ordering preserved', order.keepers.map((p) => p.id).join(',') === 'z,y,x', JSON.stringify(order.keepers.map((p) => p.id)));

// 8. Empty input is handled.
const empty = curatePhotos([]);
check('empty input handled', empty.keepers.length === 0 && empty.summary.total === 0, JSON.stringify(empty.summary));

console.log(failures === 0 ? '\nAll photo-curation checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
