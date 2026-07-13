const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-photo-journal-'));
function transpile(source, name) {
  const output = ts.transpileModule(fs.readFileSync(path.join(root, source), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const target = path.join(temp, name); fs.writeFileSync(target, output); return target;
}
const studio = transpile('utils/studio-detect.ts', 'studio.js');
const routingPath = transpile('utils/intelligence/photo-journal-routing.ts', 'routing.js');
const original = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request === '@/utils/studio-detect') return studio;
  if (request === '@/types/home' || request === '@/utils/scene-classify') return path.join(temp, 'empty.js');
  return original.call(this, request, ...args);
};
fs.writeFileSync(path.join(temp, 'empty.js'), '');
const routing = require(routingPath);
let failures = 0;
function check(label, condition, detail) { if (condition) console.log(`  ok  ${label}`); else { failures += 1; console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`); } }
function memory(observations, facets = []) { return { observations, facets, photoAnalysis: null }; }

const laptop = memory([
  { value: 'screen content', confidence: 0.78, provider: 'appleVision', raw: 'screen content' },
  { value: 'device_laptop', confidence: 0.57, provider: 'appleVision', raw: 'laptop' },
  { value: 'book', confidence: 0.55, provider: 'deterministic', raw: 'For vlctory for the little g' },
]);
check('deterministic OCR book cannot become a journal route', !routing.photoJournalRouteProposals(laptop).some((item) => item.choiceId === 'book'), JSON.stringify(routing.photoJournalRouteProposals(laptop)));

const physicalBook = memory([{ value: 'book', confidence: 0.86, provider: 'appleVision', raw: 'book cover' }]);
check('visual book proposes the Book editor', routing.photoJournalRouteProposals(physicalBook)[0]?.id === 'studio.book');
check('strong single proposal gets targeted confirmation wording', /looks like a book/i.test(routing.photoJournalQuestion(routing.photoJournalRouteProposals(physicalBook))));

const titleSuggestions = routing.photoJournalSuggestions({
  route: routing.photoJournalRouteProposals(physicalBook)[0],
  rawVision: { documentDetected: true, text: ['FRANK HERBERT', 'DUNE'], recognizedText: [{ text: 'DUNE', confidence: 0.92 }] },
  vision: { textTokens: ['FRANK HERBERT', 'DUNE'], documentCoverage: 1 },
  scene: null,
});
check('clean cover OCR becomes an editable prefill suggestion', titleSuggestions.some((item) => item.prefill && /dune/i.test(item.value)), JSON.stringify(titleSuggestions));

const badSuggestions = routing.photoJournalSuggestions({
  route: routing.photoJournalRouteProposals(physicalBook)[0],
  rawVision: { documentDetected: true, text: ['IIIiMIiii', 'that I wanted was to see'] },
  vision: { textTokens: ['IIIiMIiii', 'that I wanted was to see'], documentCoverage: 1 },
  scene: null,
});
check('subtitle-like OCR is rejected as a title suggestion', badSuggestions.length === 0, JSON.stringify(badSuggestions));

const suppliedLaptopSubtitleSuggestions = routing.photoJournalSuggestions({
  route: { id: 'studio.film', flowId: 'studio', choiceId: 'film', label: 'Film', confidence: 1, reasons: [], confirmedFacets: [] },
  rawVision: {
    documentDetected: true,
    text: ['IIIiMIiii', 'Illli,', 'for vlctory for the Ilttle g', 'that I wanted was to see', 's. All'],
    recognizedText: [
      { text: 'for vlctory for the Ilttle g', confidence: 0.5 },
      { text: 'that I wanted was to see', confidence: 0.5 },
    ],
  },
  vision: {
    textTokens: ['IIIiMIiii', 'Illli,', 'for vlctory for the Ilttle g', 'that I wanted was to see', 's. All'],
    documentCoverage: 1,
    representation: { kind: 'screen_content', confidence: 0.78, reasons: [] },
  },
  scene: null,
});
check('supplied laptop subtitle OCR is not promoted into the title field', suppliedLaptopSubtitleSuggestions.length === 0, JSON.stringify(suppliedLaptopSubtitleSuggestions));

const meal = memory([{ value: 'food', confidence: 0.91, provider: 'appleVision', raw: 'food' }]);
check('food routes to the shared Meal editor', routing.photoJournalRouteProposals(meal)[0]?.id === 'food.meal');
check('confirmed device gaming routes directly to the Game editor', routing.photoJournalRouteForConfirmation('device_activity', 'gaming')?.id === 'studio.game');
check('people routes never generate OCR suggestions', routing.photoJournalSuggestions({ route: { id: 'people.someone_else', flowId: 'people', choiceId: 'someone_else', label: 'Someone', confidence: 1, reasons: [], confirmedFacets: [] }, vision: { textTokens: ['JOHN SMITH'] } }).length === 0);

if (failures) { console.log(`\n${failures} photo-journal routing check(s) FAILED.`); process.exit(1); }
console.log('\nAll photo-journal routing checks passed.');
