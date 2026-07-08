// Node-only verification for the shared intelligence taxonomy/evidence layer.
const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-intelligence-'));

function transpileToTemp(relativeSourcePath, outName) {
  const source = fs.readFileSync(path.join(projectRoot, relativeSourcePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const outPath = path.join(tempDir, outName);
  fs.writeFileSync(outPath, output);
  return outPath;
}

const taxonomyPath = transpileToTemp('utils/intelligence/taxonomy.ts', 'taxonomy.js');
const typesPath = path.join(tempDir, 'types-home.js');
fs.writeFileSync(typesPath, '');

const stubs = {
  '@/types/home': typesPath,
  '@/utils/intelligence/taxonomy': taxonomyPath,
};
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request in stubs) return stubs[request];
  return originalResolve.call(this, request, ...rest);
};

const taxonomy = require(taxonomyPath);
const evidence = require(transpileToTemp('utils/intelligence/evidence.ts', 'evidence.js'));

let failures = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok  ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

check('park synonyms canonicalize', taxonomy.canonicalizeSignal('green space') === 'park');
check('dog synonyms canonicalize', taxonomy.canonicalizeSignal('golden retriever') === 'dog');
check('generic labels are ignored', taxonomy.canonicalizeSignal('outdoor') === null);

const rawSignals = taxonomy.visionResultToSignals({
  labels: [
    { name: 'park', confidence: 0.82 },
    { name: 'outdoor', confidence: 0.99 },
    { name: 'dog', confidence: 0.2 },
  ],
  text: [],
  faceCount: 0,
});
check('vision result keeps quest-safe concepts', rawSignals.some((signal) => signal.key === 'park' && signal.confidence === 0.82));
check('vision result drops generic labels', !rawSignals.some((signal) => signal.key === 'outdoor'));

const photoEvidence = evidence.buildPhotoEvidence({
  sourceId: 'asset-1',
  observedAt: '2026-07-07T12:00:00.000Z',
  rawVision: {
    labels: [{ name: 'park', confidence: 0.84 }],
    text: [],
    faceCount: 0,
  },
});
check('photo evidence has stable id', photoEvidence.id === 'photo:asset-1', photoEvidence.id);
check('photo evidence carries confidence', photoEvidence.signals.some((signal) => signal.key === 'park' && signal.confidence >= 0.84));

const noteEvidence = evidence.buildNoteEvidence({
  noteId: 'note-1',
  kind: 'voice',
  observedAt: '2026-07-07T12:01:00.000Z',
  text: 'Had sushi in the park',
  provider: 'appleFoundation',
  food: 'sushi',
});
check('voice note evidence keeps voice source type', noteEvidence.sourceType === 'voice_note', noteEvidence.sourceType);
check('note evidence detects text concepts', noteEvidence.signals.some((signal) => signal.key === 'sushi'));
check('note evidence adds explicit food signal', noteEvidence.signals.some((signal) => signal.key === 'food'));

console.log(failures === 0 ? '\nAll intelligence taxonomy checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);

