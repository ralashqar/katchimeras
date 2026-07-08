const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-evidence-scoring-'));

function transpile(relativeSourcePath, outName) {
  const source = fs.readFileSync(path.join(projectRoot, relativeSourcePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const outPath = path.join(tempDir, outName);
  fs.writeFileSync(outPath, output);
  return outPath;
}

const taxonomyPath = transpile('utils/intelligence/taxonomy.ts', 'taxonomy.js');
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

const scoring = require(transpile('utils/quests/evidence-scoring.ts', 'evidence-scoring.js'));

let failures = 0;
function check(label, condition, detail) {
  if (condition) console.log(`  ok  ${label}`);
  else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

function evidence(id, provider, confidence, sourceType = 'photo') {
  return {
    id,
    sourceType,
    observedAt: '2026-07-07T12:00:00.000Z',
    signals: [{ key: 'park', confidence, provider, source: 'vision' }],
  };
}

check('high-confidence direct match passes', scoring.scoreEvidenceMatch([evidence('photo:1', 'appleVision', 0.9)], { value: 'park', sourceTypes: ['photo'] }).matched);
check('low-confidence match fails', !scoring.scoreEvidenceMatch([evidence('photo:1', 'appleVision', 0.4)], { value: 'park', sourceTypes: ['photo'] }).matched);
check('source type filters evidence', !scoring.scoreEvidenceMatch([evidence('note:1', 'deterministic', 0.9, 'text_note')], { value: 'park', sourceTypes: ['photo'] }).matched);
check('date window filters stale evidence', !scoring.scoreEvidenceMatch([evidence('photo:1', 'appleVision', 0.9)], { value: 'park', sourceTypes: ['photo'], withinIsoDate: '2026-07-08' }).matched);

console.log(failures === 0 ? '\nAll evidence scoring checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);

