// Node-only verification harness for the vision-signals module (no test runner
// in this project). Transpiles the pure module and runs acceptance scenarios.
// Usage: node scripts/verify-vision-signals.cjs
const fs = require('fs');
const path = require('path');
const os = require('os');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-vision-'));

function transpileToTemp(relativeSourcePath, outName) {
  const source = fs.readFileSync(path.join(projectRoot, relativeSourcePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const outPath = path.join(tempDir, outName);
  fs.writeFileSync(outPath, output);
  return outPath;
}

const { aggregatePhotoVision, buildVisionSignals } = require(
  transpileToTemp('utils/vision-signals.ts', 'vision-signals.js')
);

let failures = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok  ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

function seedsOf(vision) {
  return buildVisionSignals(vision).map((signal) => signal.seedId).sort();
}

// 1. Aggregation: averages label confidence, takes max face count, unions text.
const summary = aggregatePhotoVision([
  { labels: [{ name: 'Coffee', confidence: 0.8 }], text: ['ESPRESSO'], faceCount: 1 },
  { labels: [{ name: 'coffee', confidence: 0.6 }], text: ['Latte'], faceCount: 4 },
]);
check('label names normalized + averaged', summary.labels[0]?.name === 'coffee' && Math.abs(summary.labels[0].confidence - 0.7) < 1e-9, JSON.stringify(summary.labels));
check('max face count taken', summary.maxFaceCount === 4, String(summary.maxFaceCount));
check('text tokens lowercased + unioned', summary.textTokens.includes('espresso') && summary.textTokens.includes('latte'), JSON.stringify(summary.textTokens));
check('analyzed count tracked', summary.analyzedPhotoCount === 2, String(summary.analyzedPhotoCount));

// 2. A scene label maps to its location seed.
check('beach label -> beach seed', seedsOf({ labels: [{ name: 'sandy beach', confidence: 0.9 }], maxFaceCount: 0, textTokens: [], analyzedPhotoCount: 1 }).includes('beach'));
check('library label -> library seed', seedsOf({ labels: [{ name: 'bookshelf', confidence: 0.7 }], maxFaceCount: 0, textTokens: [], analyzedPhotoCount: 1 }).includes('library'));

// 3. Face count >= 2 yields the social seed; a lone face does not.
check('two faces -> social_gathering', seedsOf({ labels: [], maxFaceCount: 2, textTokens: [], analyzedPhotoCount: 1 }).includes('social_gathering'));
check('one face -> no social seed', !seedsOf({ labels: [], maxFaceCount: 1, textTokens: [], analyzedPhotoCount: 1 }).includes('social_gathering'));

// 4. OCR corroboration lifts the matching seed's intensity above a bare label.
const labelOnly = buildVisionSignals({ labels: [{ name: 'cinema', confidence: 0.5 }], maxFaceCount: 0, textTokens: [], analyzedPhotoCount: 1 })
  .find((signal) => signal.seedId === 'cinema');
const labelPlusText = buildVisionSignals({ labels: [{ name: 'cinema', confidence: 0.5 }], maxFaceCount: 0, textTokens: ['now showing'], analyzedPhotoCount: 1 })
  .find((signal) => signal.seedId === 'cinema');
check('OCR corroboration raises intensity', (labelPlusText?.intensity ?? 0) > (labelOnly?.intensity ?? 0), JSON.stringify({ labelOnly, labelPlusText }));

// 5. Empty vision yields no signals.
check('empty vision -> no signals', buildVisionSignals({ labels: [], maxFaceCount: 0, textTokens: [], analyzedPhotoCount: 0 }).length === 0);

// 6. One seed per kind (no duplicate beach signals from two beach labels).
const dupes = buildVisionSignals({
  labels: [{ name: 'beach', confidence: 0.9 }, { name: 'ocean', confidence: 0.8 }],
  maxFaceCount: 0,
  textTokens: [],
  analyzedPhotoCount: 2,
});
check('no duplicate seed signals', dupes.filter((signal) => signal.seedId === 'beach').length === 1, JSON.stringify(dupes));

console.log(failures === 0 ? '\nAll vision-signals checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
