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

const { aggregatePhotoVision, buildVisionSignals, mergeDayVision, pickProminentTags } = require(
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

function photo(labels, faceCount = 0, text = []) {
  return { labels: labels.map(([name, confidence]) => ({ name, confidence })), faceCount, text };
}
function summary(concepts, extra = {}) {
  return {
    concepts,
    maxFaceCount: 0,
    faceCoverage: 0,
    textTokens: [],
    analyzedPhotoCount: 5,
    ...extra,
  };
}

// --- Aggregation: grouping, salience, coverage ---

// 1. Synonyms collapse to one canonical concept; a photo contributes it once.
const grouped = aggregatePhotoVision([photo([['dog', 0.9], ['golden_retriever', 0.8]])]);
check('synonyms collapse to one concept', grouped.concepts.length === 1 && grouped.concepts[0].name === 'dog', JSON.stringify(grouped.concepts));
check('within-photo concept counts once at peak', grouped.concepts[0].count === 1 && Math.abs(grouped.concepts[0].salience - 0.9) < 1e-9, JSON.stringify(grouped.concepts[0]));

// 2. Frequency beats a single lucky close-up: 4 medium beach shots > 1 strong coffee.
const themed = aggregatePhotoVision([
  photo([['beach', 0.5]]),
  photo([['ocean', 0.5]]),
  photo([['beach', 0.5]]),
  photo([['seaside', 0.5]]),
  photo([['coffee', 0.95]]),
]);
check('frequent theme outranks single high-confidence', themed.concepts[0].name === 'beach', JSON.stringify(themed.concepts.map((c) => c.name)));
check('coverage = share of photos', Math.abs(themed.concepts.find((c) => c.name === 'beach').coverage - 0.8) < 1e-9, JSON.stringify(themed.concepts.find((c) => c.name === 'beach')));

// 3. Generic labels never become concepts.
const generics = aggregatePhotoVision([photo([['outdoor', 0.9], ['person', 0.95], ['dog', 0.6]])]);
check('generics dropped, subject kept', generics.concepts.length === 1 && generics.concepts[0].name === 'dog', JSON.stringify(generics.concepts));

// 3b. Specific raw labels are kept as `details` (un-canonicalised) even as they
// collapse into a broad concept for matching.
const museum = aggregatePhotoVision([
  photo([['art gallery', 0.8], ['marble sculpture', 0.7]]),
  photo([['oil painting', 0.6]]),
]);
check('concepts collapse to museum', museum.concepts[0].name === 'museum', JSON.stringify(museum.concepts.map((c) => c.name)));
check('details keep the specific raw labels', museum.details.includes('art gallery') && museum.details.includes('marble sculpture'), JSON.stringify(museum.details));
check('details drop generics', !aggregatePhotoVision([photo([['outdoor', 0.9], ['painting', 0.6]])]).details.includes('outdoor'));

// 4. Face coverage tracks how much of the day had people in frame.
const faces = aggregatePhotoVision([photo([], 3), photo([], 0), photo([], 4)]);
check('max face count taken', faces.maxFaceCount === 4, String(faces.maxFaceCount));
check('face coverage = social photos / total', Math.abs(faces.faceCoverage - 2 / 3) < 1e-9, String(faces.faceCoverage));

// --- Signals: frequency-aware encounters ---

// 5. A scene concept maps to its seed; coverage raises intensity.
const dominant = buildVisionSignals(summary([{ name: 'beach', salience: 2, coverage: 0.8, count: 4, peakConfidence: 0.6 }]));
const oneOff = buildVisionSignals(summary([{ name: 'beach', salience: 0.6, coverage: 0.1, count: 1, peakConfidence: 0.6 }], { analyzedPhotoCount: 10 }));
const dominantBeach = dominant.find((s) => s.seedId === 'beach');
const oneOffBeach = oneOff.find((s) => s.seedId === 'beach');
check('scene concept maps to seed', Boolean(dominantBeach), JSON.stringify(dominant));
check('coverage raises hatch intensity', dominantBeach.intensity > oneOffBeach.intensity, JSON.stringify({ dominantBeach, oneOffBeach }));

// 6. Faces produce the social encounter; a lone face does not.
check('faces -> social_gathering encounter', buildVisionSignals(summary([], { maxFaceCount: 3, faceCoverage: 0.8 })).some((s) => s.seedId === 'social_gathering'));
check('a lone face is not social', !buildVisionSignals(summary([], { maxFaceCount: 1, faceCoverage: 0 })).some((s) => s.seedId === 'social_gathering'));
const manyPeople = buildVisionSignals(summary([], { maxFaceCount: 2, faceCoverage: 1 })).find((s) => s.seedId === 'social_gathering');
const fewPeople = buildVisionSignals(summary([], { maxFaceCount: 2, faceCoverage: 0.1, analyzedPhotoCount: 10 })).find((s) => s.seedId === 'social_gathering');
check('more people-frames raise social intensity', manyPeople.intensity > fewPeople.intensity, JSON.stringify({ manyPeople, fewPeople }));

// 7. OCR corroboration lifts a matching concept's intensity.
const labelOnly = buildVisionSignals(summary([{ name: 'cinema', salience: 0.5, coverage: 0.3, count: 1, peakConfidence: 0.5 }])).find((s) => s.seedId === 'cinema');
const withText = buildVisionSignals(summary([{ name: 'cinema', salience: 0.5, coverage: 0.3, count: 1, peakConfidence: 0.5 }], { textTokens: ['now showing'] })).find((s) => s.seedId === 'cinema');
check('OCR corroboration raises intensity', withText.intensity > labelOnly.intensity, JSON.stringify({ labelOnly, withText }));

// 8. Dog now maps to its creature's seed (Waglet); a subject still without a
// creature (cat) produces no encounter signal yet.
check('dog concept maps to dog_companion seed', buildVisionSignals(summary([{ name: 'dog', salience: 1.5, coverage: 0.6, count: 3, peakConfidence: 0.8 }])).some((s) => s.seedId === 'dog_companion'));
check('unmapped concept (bicycle) has no seed', buildVisionSignals(summary([{ name: 'bicycle', salience: 1.5, coverage: 0.6, count: 3, peakConfidence: 0.8 }])).length === 0);

// --- Prominent tags for the nightly line ---

const tagSummary = aggregatePhotoVision([
  photo([['dog', 0.9], ['golden_retriever', 0.8]]),
  photo([['dog', 0.7]]),
  photo([['coffee', 0.6]]),
]);
check('prominent tags lead with the salient concept', pickProminentTags(tagSummary, 2)[0] === 'dog', JSON.stringify(tagSummary.concepts.map((c) => c.name)));
check('prominent tags respect limit', pickProminentTags(tagSummary, 1).length === 1);
check('low-confidence concept excluded from tags', pickProminentTags(summary([{ name: 'haze', salience: 0.2, coverage: 1, count: 1, peakConfidence: 0.1 }])).length === 0);

// --- Edges ---
const empty = aggregatePhotoVision([]);
check('empty aggregation handled', empty.concepts.length === 0 && empty.analyzedPhotoCount === 0 && empty.faceCoverage === 0, JSON.stringify(empty));
check('empty vision -> no signals', buildVisionSignals(empty).length === 0);

// --- mergeDayVision: a snapped photo folds into the running day vision ---
const existingDay = aggregatePhotoVision([photo([['coffee', 0.9]]), photo([['coffee', 0.8]])]);
const snapped = aggregatePhotoVision([photo([['pizza', 0.95]])]);
const merged = mergeDayVision(existingDay, snapped);
check('merge sums photo count', merged.analyzedPhotoCount === 3, String(merged.analyzedPhotoCount));
check('merge keeps existing concept', merged.concepts.some((c) => c.name === 'coffee'));
check('merge adds new concept', merged.concepts.some((c) => c.name === 'pizza'));
check('merge into empty returns incoming', mergeDayVision(undefined, snapped) === snapped);

console.log(failures === 0 ? '\nAll vision-signals checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
