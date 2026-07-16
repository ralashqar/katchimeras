const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-local-policy-'));
function transpile(relativePath, outputName) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  const target = path.join(temp, outputName);
  fs.writeFileSync(target, ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText);
  return target;
}
function stub(name, source) {
  const target = path.join(temp, name);
  fs.writeFileSync(target, source);
  return target;
}

const notePath = transpile('utils/note-interpret.ts', 'note-interpret.js');
const placePath = transpile('utils/place-categories.ts', 'place-categories.js');
const counter = stub('counter.js', 'exports.calls = 0;');
const foundationOnlyMode = stub('foundation-only-mode.js', 'exports.enabled = false; exports.isFoundationOnlyNoteRoutingEnabled = () => exports.enabled;');
const stubs = {
  'expo-file-system': stub('file.js', 'exports.File = class { async base64() { return "encoded"; } };'),
  '@/utils/foundation-note': stub('foundation.js', 'exports.interpretNoteOnDevice = async () => null;'),
  '@/utils/note-meaning': stub('meaning.js', 'exports.interpretNoteText = (text) => ({ archetype: "calm", label: text ? "Local note" : "A note" });'),
  '@/utils/speech-transcribe': stub('speech.js', 'exports.transcribeOnDevice = async () => "";'),
  '@/utils/studio-detect': stub('studio.js', 'exports.detectStudioInText = () => ({ detected: false }); exports.isGenericStudioLabel = () => true;'),
  '@/utils/intelligence/semantic-fallback': stub('semantic.js', 'exports.classifyNoteSemantically = async () => null; exports.semanticMedia = () => null;'),
  '@/utils/journal-routing': stub('journal-routing.js', 'exports.registryJournalRoutes = () => [];'),
  '@/utils/dev-settings': foundationOnlyMode,
  '@/types/home': stub('types.js', ''),
  '@/utils/day-map-engine': stub('day-map.js', 'exports.deriveDayMapSummary = () => ({ nodes: [{ id: "p1", latitude: 1, longitude: 2, startedAt: "2026-01-01T10:00:00Z", endedAt: "2026-01-01T10:30:00Z" }] });'),
  '@/utils/supabase': stub('supabase.js', `const counter = require(${JSON.stringify(counter)}); exports.supabase = { functions: { invoke: async () => { counter.calls += 1; return { data: { archetype: "energy", label: "Cloud note", categories: [{ clusterId: "p1", appleCategory: "Cafe" }] }, error: null }; } } };`),
};
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request in stubs) return stubs[request];
  return originalResolve.call(this, request, parent, ...rest);
};

const note = require(notePath);
const places = require(placePath);
const calls = require(counter);
const foundationOnly = require(foundationOnlyMode);
let failures = 0;
function check(label, condition) {
  if (condition) console.log(`  ok  ${label}`);
  else { failures += 1; console.log(`FAIL  ${label}`); }
}

(async () => {
  const local = await note.interpretNote({ text: 'A private note' });
  check('note defaults to local deterministic fallback', local.intelligenceProvider === 'deterministic');
  check('note makes no cloud call by default', calls.calls === 0);
  await note.transcribeAudioNote('file://voice.m4a');
  check('audio makes no cloud call by default', calls.calls === 0);
  const localPlaces = await places.resolvePlaceSeedsForDay({ locations: [], moments: [] }, []);
  check('place enrichment makes no cloud call by default', localPlaces.length === 0 && calls.calls === 0);
  const remote = await note.interpretNote({ text: 'An opted-in note' }, { allowRemote: true });
  check('explicit note opt-in permits cloud fallback', remote.intelligenceProvider === 'remoteLlm' && calls.calls === 1);
  const remotePlaces = await places.resolvePlaceSeedsForDay({ locations: [], moments: [] }, [], { allowRemote: true });
  check('explicit place action permits enrichment', remotePlaces[0] === 'coffee_shop' && calls.calls === 2);
  foundationOnly.enabled = true;
  const isolated = await note.interpretNote({ text: 'Foundation test' }, { allowRemote: true });
  check('Foundation-only dev mode blocks cloud and deterministic routes', isolated.journalRoutes.length === 0 && calls.calls === 2);
  console.log(failures ? `\n${failures} local-policy check(s) FAILED.` : '\nAll local intelligence policy checks passed.');
  process.exit(failures ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
