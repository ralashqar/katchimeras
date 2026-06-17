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

const stubs = {
  '@/utils/photo-category': categoryPath,
  '@/components/ui/icon-symbol': {},
  '@/types/home': {},
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

const { buildCaptureEnergy, mergeCaptureEnergy, CAPTURE_MEANINGS } = require(energyPath);

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

// merge sums + clamps to 1.
const merged = mergeCaptureEnergy({ calm: 0.6 }, { calm: 0.6, energy: 0.2 });
check('merge sums energy', (merged.energy ?? 0) === 0.2);
check('merge clamps calm to 1', merged.calm === 1, String(merged.calm));

Module._resolveFilename = originalResolve;
fs.rmSync(tempDir, { recursive: true, force: true });
console.log(failures === 0 ? '\nAll capture-energy checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
