const {contentPath, assetSpecifier, readVerificationSource} = require('@incubator/art-pipeline/context');
// Node-only verification harness for the Chronicle generator. No test runner in
// this project: transpile the pure module with TypeScript and run scenarios.
// Usage: node scripts/verify-chronicle.cjs
const fs = require('fs');
const path = require('path');
const os = require('os');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-chronicle-'));

function transpileToTemp(relativeSourcePath, outName) {
  const source = readVerificationSource(contentPath(projectRoot, relativeSourcePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const outPath = path.join(tempDir, outName);
  fs.writeFileSync(outPath, output);
  return outPath;
}

const originalResolveFilename = require('module')._resolveFilename;
const studioDetectPath = transpileToTemp('utils/studio-detect.ts', 'studio-detect.js');
const memoryDisplayPath = transpileToTemp('utils/memory-display.ts', 'memory-display.js');
require('module')._resolveFilename = function resolveVerificationModule(request, parent, isMain, options) {
  if (request === '@/utils/studio-detect') return studioDetectPath;
  if (request === '@/utils/memory-display') return memoryDisplayPath;
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const engine = require(transpileToTemp('utils/chronicle-engine.ts', 'chronicle-engine.js'));

let failures = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok  ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

function day(overrides = {}) {
  return {
    isoDate: '2026-06-17',
    scores: { calm: 0, energy: 0, social: 0, exploration: 0, focus: 0 },
    capturedMeanings: [],
    heroPhoto: null,
    notes: [],
    bigMoments: [],
    confirmedPlaces: [],
    visitedPlaceCount: 0,
    newPlaceCount: 0,
    stepsCount: 0,
    creature: null,
    ...overrides,
  };
}

// --- empty day ---
const empty = engine.deriveDayChronicle(day());
check('an empty day is "A Quiet Day"', empty.title === 'A Quiet Day', empty.title);
check('an empty day has no story', empty.hasStory === false);

// --- big moment drives the title ---
const bday = engine.deriveDayChronicle(day({ bigMoments: [{ id: 'b', type: 'birthday', label: 'Birthday', subject: 'son', createdAt: '2026-06-17T18:00:00' }] }));
check('a birthday → "A Day to Celebrate"', bday.title === 'A Day to Celebrate', bday.title);
check('a big moment gives the day a story', bday.hasStory === true);
check('the big moment is in "what shaped this day"', bday.shaped.some((s) => s.includes('Birthday')));

// --- facets from mood scores ---
const social = engine.deriveDayChronicle(day({ scores: { calm: 0.1, energy: 0.8, social: 0.9, exploration: 0.1, focus: 0.1 }, visitedPlaceCount: 1 }));
check('top two mood facets form the title', social.title === 'A Day of Connection & Motion', social.title);

// --- meaningful capture prepends Meaning ---
const meaningful = engine.deriveDayChronicle(day({ capturedMeanings: [{ archetype: 'meaningful', label: 'Worth it', thumbnailUri: null, createdAt: '2026-06-17T10:00:00' }], scores: { calm: 0.7, energy: 0.1, social: 0.1, exploration: 0.1, focus: 0.1 } }));
check('a meaningful capture leads the title with Meaning', meaningful.title.startsWith('A Day of Meaning'), meaningful.title);

// --- summary + shaped ---
const rich = engine.deriveDayChronicle(
  day({
    confirmedPlaces: [{ id: 'p1' }, { id: 'p2' }],
    capturedMeanings: [{ archetype: 'calm', label: 'A slow sip', thumbnailUri: null, createdAt: '2026-06-17T09:30:00' }],
    notes: [{ id: 'n', kind: 'voice', label: 'Evening thought', archetype: 'calm', createdAt: '2026-06-17T20:00:00' }],
  })
);
check('summary reads as a story, not stats', rich.summary.startsWith('Today was shaped by'), rich.summary);
check('shaped lists places', rich.shaped.some((s) => s.includes('2 places')));
check('shaped lists memories', rich.shaped.some((s) => s.includes('memory') || s.includes('memories')));

// --- timeline buckets by time of day, sorted ---
check('timeline has the morning capture first', rich.timeline[0]?.timeOfDay === 'morning', rich.timeline[0]?.timeOfDay);
check('timeline includes the evening note', rich.timeline.some((item) => item.timeOfDay === 'evening'));

// --- hatch alone is enough of a story ---
const hatched = engine.deriveDayChronicle(day({ creature: { name: 'Wanderleaf' } }));
check('a hatched creature gives the day a story', hatched.hasStory === true);

// --- calendar events shape the Chronicle ---
const cal = engine.deriveDayChronicle(day(), [
  { id: '1', title: 'Dentist', startTime: new Date('2026-06-17T09:00:00').getTime(), endTime: new Date('2026-06-17T09:30:00').getTime(), category: 'care' },
  { id: '2', title: 'Dinner with Sarah', startTime: new Date('2026-06-17T19:00:00').getTime(), endTime: new Date('2026-06-17T21:00:00').getTime(), category: 'connection' },
]);
check('calendar events shape the title', cal.title === 'A Day of Care & Connection', cal.title);
check('calendar events appear in "what shaped this day"', cal.shaped.some((s) => s.includes('Dentist')) && cal.shaped.some((s) => s.includes('Dinner with Sarah')));
check('calendar events give the day a story', cal.hasStory === true);
check('calendar events join the timeline, time-bucketed', cal.timeline.some((i) => i.label === 'Dentist' && i.timeOfDay === 'morning') && cal.timeline.some((i) => i.label === 'Dinner with Sarah' && i.timeOfDay === 'evening'));

console.log(failures === 0 ? '\nAll chronicle checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
