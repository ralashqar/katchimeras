const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-manual-journal-'));
function transpile(relative, name) {
  const output = ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const target = path.join(temp, name);
  fs.writeFileSync(target, output);
  return target;
}

const registryPath = transpile('utils/manual-journal-registry.ts', 'registry.js');
const mutationPath = transpile('game/days/mutations/manual-journal.ts', 'mutation.js');
const emptyPath = path.join(temp, 'empty.js');
const evidencePath = path.join(temp, 'evidence.js');
const classificationPath = path.join(temp, 'classification.js');
fs.writeFileSync(emptyPath, '');
fs.writeFileSync(evidencePath, `
  exports.buildNoteEvidence = () => ({ id: 'evidence' });
  exports.upsertEvidence = (existing = [], incoming = []) => [...existing, ...incoming];
`);
fs.writeFileSync(classificationPath, `
  exports.buildManualJournalClassifiedMemory = (input) => ({ id: input.entryId, facets: [] });
  exports.applyManualJournalFacets = (memory) => memory;
  exports.upsertClassifiedMemory = (existing = [], incoming = []) => [...existing, ...incoming];
`);

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === '@/utils/manual-journal-registry') return registryPath;
  if (request === '@/utils/intelligence/evidence') return evidencePath;
  if (request === '@/utils/intelligence/classification') return classificationPath;
  if (request === '@/types/home' || request === '@/components/ui/icon-symbol') return emptyPath;
  return originalResolve.call(this, request, parent, ...rest);
};

const { withManualJournalEntry } = require(mutationPath);
const now = new Date('2026-07-13T12:00:00.000Z');
const base = { manualJournalEntries: [], classifiedMemories: [], evidence: [], confirmedPlaces: [] };
const submission = (flowId, categoryId, overrides = {}) => ({
  flowId,
  path: [flowId, categoryId],
  categoryId,
  canonicalQualityIds: [],
  fields: { specific: null, context: null },
  feeling: null,
  note: null,
  ...overrides,
});

let failures = 0;
function check(label, condition) {
  if (condition) console.log(`  ok  ${label}`);
  else { failures += 1; console.log(`FAIL  ${label}`); }
}

const place = withManualJournalEntry(base, submission('went_somewhere', 'park', {
  fields: { specific: 'Victoria Park', context: 'day_out' }, feeling: 'calm',
}), now);
check('manual place creates canonical confirmed-place data', place.confirmedPlaces?.[0]?.category === 'park' && place.confirmedPlaces[0].label === 'Victoria Park');

const movement = withManualJournalEntry(base, submission('movement', 'run', {
  fields: { specific: 'Morning 5k', context: null }, feeling: 'exciting',
}), now);
check('manual movement creates the Journey interpretation', movement.stepsInterpretation?.movement === 'run' && movement.stepsInterpretation?.label === 'Morning 5k');

const sport = withManualJournalEntry(base, submission('movement', 'sport', {
  fields: { specific: null, context: 'football' },
}), now);
check('manual sport maps safely into the movement taxonomy', sport.stepsInterpretation?.movement === 'workout' && sport.stepsInterpretation?.subtype === 'football');

Module._resolveFilename = originalResolve;
fs.rmSync(temp, { recursive: true, force: true });
console.log(failures ? `\n${failures} manual-journal mutation check(s) FAILED.` : '\nAll manual-journal mutation checks passed.');
process.exit(failures ? 1 : 0);
