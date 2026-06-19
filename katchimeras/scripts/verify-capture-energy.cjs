// Node-only verification for the camera capture energy mapping. Transpiles the
// pure modules and checks meaning + subject → score deltas.
// Usage: node scripts/verify-capture-energy.cjs
const fs = require('fs');
const path = require('path');
const Module = require('module');
const os = require('os');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-capture-'));

function transpileToTemp(rel, out) {
  const source = fs.readFileSync(path.join(projectRoot, rel), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const outPath = path.join(tempDir, out);
  fs.writeFileSync(outPath, output);
  return outPath;
}

const categoryPath = transpileToTemp('utils/photo-category.ts', 'photo-category.js');
const energyPath = transpileToTemp('utils/capture-energy.ts', 'capture-energy.js');
const foundationPath = transpileToTemp('utils/foundation-meaning.ts', 'foundation-meaning.js');

// expo-modules-core isn't available in Node; stub requireOptionalNativeModule so
// the foundation-meaning module imports cleanly (native module reads as absent).
const emcStub = path.join(tempDir, 'expo-modules-core.js');
fs.writeFileSync(emcStub, 'module.exports = { requireOptionalNativeModule: () => null };');

const stubs = {
  '@/utils/photo-category': categoryPath,
  '@/components/ui/icon-symbol': {},
  '@/types/home': {},
  'expo-modules-core': emcStub,
};
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request in stubs) {
    const stub = stubs[request];
    if (typeof stub === 'string') return stub;
    const stubFile = path.join(tempDir, `${request.replace(/[@/]/g, '_')}.js`);
    if (!fs.existsSync(stubFile)) fs.writeFileSync(stubFile, `module.exports = ${JSON.stringify(stub)};`);
    return stubFile;
  }
  return originalResolve.call(this, request, ...rest);
};

const { buildCaptureEnergy, mergeCaptureEnergy, CAPTURE_MEANINGS, selectCaptureMeanings } = require(energyPath);
const { mapFoundationMeanings } = require(foundationPath);

function vision(conceptNames, maxFaceCount = 0) {
  return {
    concepts: conceptNames.map((name) => ({ name, salience: 1, coverage: 1, count: 1, peakConfidence: 0.9 })),
    details: [],
    maxFaceCount,
    faceCoverage: maxFaceCount > 0 ? 1 : 0,
    textTokens: [],
    analyzedPhotoCount: 1,
  };
}

let failures = 0;
function check(label, cond, detail) {
  if (cond) console.log(`  ok  ${label}`);
  else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

check('4 meaning options', CAPTURE_MEANINGS.length === 4);
check('calm → calm delta', buildCaptureEnergy('calm', null).calm > 0);
check('energy → energy delta', buildCaptureEnergy('energy', null).energy > 0);
check('together → social delta', buildCaptureEnergy('together', null).social > 0);

// "meaningful" deepens the day's dominant axis.
const dom = buildCaptureEnergy('meaningful', null, { energy: 0.1, calm: 0.1, social: 0.8, exploration: 0.1, focus: 0.1 });
check('meaningful lifts dominant axis (social)', (dom.social ?? 0) > 0, JSON.stringify(dom));

// Subject context adds a second axis.
const landmark = buildCaptureEnergy('meaningful', vision(['city']), { energy: 0, calm: 0.5, social: 0, exploration: 0, focus: 0 });
check('landmark photo adds exploration', (landmark.exploration ?? 0) > 0, JSON.stringify(landmark));
const food = buildCaptureEnergy('calm', vision(['food']));
check('food photo nudges calm further', (food.calm ?? 0) > 0.26, JSON.stringify(food));
const faces = buildCaptureEnergy('calm', vision(['food'], 2));
check('faces in frame add social', (faces.social ?? 0) > 0, JSON.stringify(faces));

// --- Essence-aware meaning options (no LLM) ---
const labelsOf = (v) => selectCaptureMeanings(v).map((m) => m.label);
check('null vision → generic 4 meanings', selectCaptureMeanings(null) === CAPTURE_MEANINGS);
check('food photo → contextual food meanings', labelsOf(vision(['food'])).includes('A treat') && labelsOf(vision(['food'])).includes('Shared'), labelsOf(vision(['food'])).join(','));
check('people photo → togetherness meanings', labelsOf(vision([], 2)).includes('Time together'), labelsOf(vision([], 2)).join(','));
check('dog photo → companion meanings', labelsOf(vision(['dog'])).includes('My companion'), labelsOf(vision(['dog'])).join(','));
check('active photo → effort meanings', labelsOf(vision(['gym'])).includes('Strong'), labelsOf(vision(['gym'])).join(','));
check('sunset photo → light meanings', labelsOf(vision(['sunset'])).includes('Serene'), labelsOf(vision(['sunset'])).join(','));
check('unknown concept → generic fallback', selectCaptureMeanings(vision(['totally_unknown'])) === CAPTURE_MEANINGS);

// Broad keyword coverage over concepts + raw detail labels.
check('laptop → work meanings', labelsOf(vision(['laptop'])).includes('Productive'), labelsOf(vision(['laptop'])).join(','));
check('gaming → games meanings', labelsOf(vision(['gaming'])).includes('Gaming'), labelsOf(vision(['gaming'])).join(','));
check('guitar → music meanings', labelsOf(vision(['guitar'])).includes('Vibing'), labelsOf(vision(['guitar'])).join(','));
check('television → watching meanings', labelsOf(vision(['television'])).includes('Unwinding'), labelsOf(vision(['television'])).join(','));
check('book → reading meanings', labelsOf(vision(['book'])).includes('Absorbed'), labelsOf(vision(['book'])).join(','));
check('mall → shopping meanings', labelsOf(vision(['mall'])).includes('A find'), labelsOf(vision(['mall'])).join(','));
check('car → commute meanings', labelsOf(vision(['car'])).includes('On the move'), labelsOf(vision(['car'])).join(','));
check('couch → home meanings', labelsOf(vision(['couch'])).includes('Cozy'), labelsOf(vision(['couch'])).join(','));

// Raw detail labels are scanned too (not just canonical concepts).
const detailVision = { concepts: [{ name: 'outdoor', salience: 1, coverage: 1, count: 1, peakConfidence: 0.9 }], details: ['laptop'], maxFaceCount: 0, faceCoverage: 0, textTokens: [], analyzedPhotoCount: 1 };
check('raw detail label (laptop) is matched', selectCaptureMeanings(detailVision).some((m) => m.label === 'Productive'), JSON.stringify(selectCaptureMeanings(detailVision).map((m) => m.label)));

// Ambiguous device → the mixed TECH options (the user's exact case).
check('electronic device → work/games/watch/scroll', labelsOf(vision(['electronic device'])).includes('Gaming') && labelsOf(vision(['electronic device'])).includes('Working'), labelsOf(vision(['electronic device'])).join(','));

// A SPECIFIC device read (high-confidence laptop) beats the ambiguous tech tag.
const laptopBag = { concepts: [{ name: 'focus_work', salience: 1, coverage: 1, count: 1, peakConfidence: 0.92 }], details: ['electronic device', 'screen'], maxFaceCount: 0, faceCoverage: 0, textTokens: [], analyzedPhotoCount: 1 };
check('specific laptop read beats ambiguous tech', selectCaptureMeanings(laptopBag).some((m) => m.label === 'Productive') && !selectCaptureMeanings(laptopBag).some((m) => m.label === 'Working'), JSON.stringify(selectCaptureMeanings(laptopBag).map((m) => m.label)));

// Holistic: a noisy bag where the meaningful tag isn't first still reads right.
const noisyBag = { concepts: [{ name: 'indoor', salience: 1, coverage: 1, count: 1, peakConfidence: 0.8 }, { name: 'furniture', salience: 1, coverage: 1, count: 1, peakConfidence: 0.6 }, { name: 'gaming', salience: 1, coverage: 1, count: 1, peakConfidence: 0.85 }], details: [], maxFaceCount: 0, faceCoverage: 0, textTokens: [], analyzedPhotoCount: 1 };
check('noisy bag still finds the meaningful tag (gaming)', selectCaptureMeanings(noisyBag).some((m) => m.label === 'Gaming'), JSON.stringify(selectCaptureMeanings(noisyBag).map((m) => m.label)));

check('every contextual option maps to a valid energy archetype', ['food', 'people', 'dog', 'gym', 'sunset', 'museum', 'beach', 'city', 'laptop', 'gaming', 'guitar', 'television', 'book', 'mall', 'car', 'couch'].every((c) => selectCaptureMeanings(vision([c], c === 'people' ? 2 : 0)).every((m) => ['calm', 'energy', 'together', 'meaningful'].includes(m.id))));

// --- Foundation Models output mapping (validates untrusted model output) ---
const goodRaw = [
  { label: 'Comfort', archetype: 'calm' },
  { label: 'A treat', archetype: 'energy' },
  { label: 'Shared', archetype: 'together' },
  { label: 'Worth savoring', archetype: 'meaningful' },
];
const mapped = mapFoundationMeanings(goodRaw);
check('maps a valid model response to 4 meanings', mapped && mapped.length === 4 && mapped[0].id === 'calm' && mapped[0].label === 'Comfort' && typeof mapped[0].emoji === 'string', JSON.stringify(mapped));
check('mapped options use valid energy archetypes', mapped.every((m) => ['calm', 'energy', 'together', 'meaningful'].includes(m.id)));
check('drops invalid archetype + dedups, falls back when <3 survive', mapFoundationMeanings([{ label: 'X', archetype: 'happy' }, { label: 'Y', archetype: 'calm' }, { label: 'Z', archetype: 'calm' }]) === null);
check('drops empty + overlong labels', (() => { const r = mapFoundationMeanings([{ label: '', archetype: 'calm' }, { label: 'x'.repeat(40), archetype: 'energy' }, { label: 'Together', archetype: 'together' }, { label: 'Special', archetype: 'meaningful' }, { label: 'Calm', archetype: 'calm' }]); return r && r.length === 3 && !r.some((m) => m.label === ''); })());
check('garbage response → null (falls back to rules)', mapFoundationMeanings([{ foo: 1 }, { label: 5, archetype: {} }]) === null);

// merge sums + clamps to 1.
const merged = mergeCaptureEnergy({ calm: 0.6 }, { calm: 0.6, energy: 0.2 });
check('merge sums energy', (merged.energy ?? 0) === 0.2);
check('merge clamps calm to 1', merged.calm === 1, String(merged.calm));

Module._resolveFilename = originalResolve;
fs.rmSync(tempDir, { recursive: true, force: true });
console.log(failures === 0 ? '\nAll capture-energy checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
