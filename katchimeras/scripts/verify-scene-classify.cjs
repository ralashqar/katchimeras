// Node-only verification harness for the hierarchical scene classifier (rule
// layer). No test runner in this project: transpile the pure modules with
// TypeScript and run scenarios. Usage: node scripts/verify-scene-classify.cjs
const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-scene-'));

function transpileToTemp(relativeSourcePath, outName) {
  const source = fs.readFileSync(path.join(projectRoot, relativeSourcePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const outPath = path.join(tempDir, outName);
  fs.writeFileSync(outPath, output);
  return outPath;
}

// scene-classify imports the real food-detect (pure) + foundation-scene (native →
// stub it so resolveSceneRead falls back to the rule classifier in Node).
const foodDetectPath = transpileToTemp('utils/food-detect.ts', 'food-detect.js');
const studioDetectPath = transpileToTemp('utils/studio-detect.ts', 'studio-detect.js');
const photoRealityPath = transpileToTemp('utils/photo-reality.ts', 'photo-reality.js');
const peopleDetectPath = transpileToTemp('utils/people-detect.ts', 'people-detect.js');
const intelligenceTypesPath = transpileToTemp('utils/intelligence/types.ts', 'intelligence-types.js');
const foundationStub = path.join(tempDir, 'foundation-scene.js');
fs.writeFileSync(foundationStub, 'exports.classifySceneOnDevice = async () => null;\nexports.readSceneOnDevice = async () => global.__foundationSceneRead ?? null;\nexports.isFoundationSceneAvailable = () => false;\nexports.foundationSceneAvailability = () => ({ available: false, reason: "native_module_missing" });\n');
const intelligenceRunStub = path.join(tempDir, 'intelligence-run.js');
fs.writeFileSync(
  intelligenceRunStub,
  `exports.runIntelligenceTask = async ({ input, providers }) => {
    for (const provider of providers) {
      if (await provider.canRun(input)) {
        const value = await provider.run(input);
        if (value != null) return { value, provider: provider.id };
      }
    }
    return null;
  };\n`
);

const stubs = {
  '@/utils/food-detect': foodDetectPath,
  '@/utils/studio-detect': studioDetectPath,
  '@/utils/foundation-scene': foundationStub,
  '@/utils/intelligence/run': intelligenceRunStub,
  '@/utils/intelligence/types': intelligenceTypesPath,
  '@/utils/photo-reality': photoRealityPath,
  '@/utils/people-detect': peopleDetectPath,
};
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request in stubs) return stubs[request];
  return originalResolve.call(this, request, ...rest);
};

const scene = require(transpileToTemp('utils/scene-classify.ts', 'scene-classify.js'));
const sceneSource = fs.readFileSync(path.join(projectRoot, 'utils/scene-classify.ts'), 'utf8');
const foundationSource = fs.readFileSync(path.join(projectRoot, 'utils/foundation-scene.ts'), 'utf8');

let failures = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok  ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

function vision({
  concepts = [], details = [], textTokens = [], maxFaceCount = 0,
  dominantSubjectCoverage = 0, documentCoverage = 0,
} = {}) {
  return {
    concepts: concepts.map((name) => (typeof name === 'string' ? { name, salience: 1 } : name)),
    details,
    textTokens,
    maxFaceCount,
    dominantSubjectCoverage,
    documentCoverage,
  };
}

// --- top-level classification (priority + buckets) ---
const food = scene.classifyScene(vision({ concepts: ['coffee', 'table'] }));
check('food photo → food', food.type === 'food', food.type);
check('food carries a detection + label', food.food && food.food.detected && food.food.label === 'Coffee');

const screenshotEgg = scene.classifyScene(vision({ concepts: ['dessert'], details: ['screen content', 'cartoon egg'] }));
check('screen-content egg cannot classify as food', screenshotEgg.type === 'screen', screenshotEgg.type);
const gameEgg = scene.classifyScene(vision({ concepts: ['gaming', 'dessert'], details: ['screen content', 'video game'] }));
check('game screenshot routes to media instead of food', gameEgg.type === 'media' && gameEgg.media?.mediaType === 'game', JSON.stringify(gameEgg));

const prominentBookCover = scene.classifyScene(vision({
  concepts: [
    { name: 'book', salience: 0.34, coverage: 1, count: 1, peakConfidence: 0.34 },
    { name: 'dessert', salience: 0.31, coverage: 1, count: 1, peakConfidence: 0.31 },
  ],
  details: ['book', 'cake'],
  textTokens: ['KAZUO ISHIGURO', 'KLARA AND THE SUN', 'A NOVEL'],
  dominantSubjectCoverage: 0.58,
  documentCoverage: 1,
}));
check('prominent typographic book cover routes to media', prominentBookCover.type === 'media' && prominentBookCover.media?.mediaType === 'book', JSON.stringify(prominentBookCover));
check('book-cover OCR extracts a usable title', prominentBookCover.media?.title === 'Klara and the Sun', prominentBookCover.media?.title);
check('food illustrated on a confirmed cover cannot outrank the book', prominentBookCover.type !== 'food', prominentBookCover.type);

const lowConfidenceNorwegianWood = scene.classifyScene(vision({
  concepts: [
    { name: 'textile', salience: 0.35, coverage: 1, count: 1, peakConfidence: 0.35 },
    { name: 'document', salience: 0.197, coverage: 1, count: 1, peakConfidence: 0.197 },
    { name: 'book', salience: 0.197, coverage: 1, count: 1, peakConfidence: 0.197 },
  ],
  details: ['textile', 'document', 'book'],
  textTokens: ['MURAKAMI', 'NORWEGIAN', 'WOOD', 'VINTAGE'],
  dominantSubjectCoverage: 0.53,
  documentCoverage: 1,
}));
check('large structured cover beats higher-scored background textile', lowConfidenceNorwegianWood.type === 'media' && lowConfidenceNorwegianWood.media?.mediaType === 'book', JSON.stringify(lowConfidenceNorwegianWood));
check('low-confidence structured cover retains OCR title', lowConfidenceNorwegianWood.media?.title === 'Norwegian Wood', lowConfidenceNorwegianWood.media?.title);

const ocrStructuredCoverWithoutBookLabel = scene.classifyScene(vision({
  concepts: ['textile', 'utensil', 'tableware'],
  details: ['textile', 'utensil', 'tableware'],
  textTokens: ['MURAKAMI', 'NORWEGIAN', 'WOOD', 'VINTAGE'],
  dominantSubjectCoverage: 0.53,
  documentCoverage: 1,
}));
check('strong OCR document can recover a cover without a book classifier label', ocrStructuredCoverWithoutBookLabel.type === 'media' && ocrStructuredCoverWithoutBookLabel.media?.mediaType === 'book', JSON.stringify(ocrStructuredCoverWithoutBookLabel));

const ocrOnlyBook = scene.classifyScene(vision({
  concepts: ['conveyance', 'portal', 'window', 'blue sky'],
  details: ['conveyance', 'portal', 'window', 'blue sky'],
  textTokens: ['HE PHENOMENAL', 'INTERNAfioNAL 8ESTSELLER', 'STEPHEN', 'HAWKING', 'BRIFF', 'STO', 'TIME', 'FROMTHE BIG BANG', 'ID BLACK HOL'],
}));
check('corrupted bestseller OCR outranks weak nature labels as an unnamed book', ocrOnlyBook.type === 'media' && ocrOnlyBook.media?.mediaType === 'book' && ocrOnlyBook.media?.title === null, JSON.stringify(ocrOnlyBook));

const childWithCake = scene.classifyScene(vision({
  concepts: [
    { name: 'child', salience: 0.84, coverage: 1, count: 1, peakConfidence: 0.84 },
    { name: 'dessert', salience: 0.72, coverage: 1, count: 1, peakConfidence: 0.72 },
  ],
  details: ['child', 'birthday cake'],
  maxFaceCount: 1,
  dominantSubjectCoverage: 0.54,
}));
check('prominent child outranks generic co-occurring food', childWithCake.type === 'social' && childWithCake.detail === 'A child', JSON.stringify(childWithCake));

const backgroundChildAtMeal = scene.classifyScene(vision({
  concepts: [
    { name: 'food', salience: 0.92, coverage: 1, count: 1, peakConfidence: 0.92 },
    { name: 'dessert', salience: 0.82, coverage: 1, count: 1, peakConfidence: 0.82 },
    { name: 'tableware', salience: 0.7, coverage: 1, count: 1, peakConfidence: 0.7 },
    { name: 'child', salience: 0.4, coverage: 1, count: 1, peakConfidence: 0.4 },
  ],
  details: ['meal', 'tableware', 'child'],
  maxFaceCount: 1,
  dominantSubjectCoverage: 0.08,
}));
check('low-ranked background child does not hijack a meal', backgroundChildAtMeal.type === 'food', JSON.stringify(backgroundChildAtMeal));

const backgroundBook = scene.classifyScene(vision({
  concepts: [
    { name: 'park', salience: 0.92, coverage: 1, count: 1, peakConfidence: 0.92 },
    { name: 'dog', salience: 0.81, coverage: 1, count: 1, peakConfidence: 0.81 },
    { name: 'bench', salience: 0.7, coverage: 1, count: 1, peakConfidence: 0.7 },
    { name: 'book', salience: 0.62, coverage: 1, count: 1, peakConfidence: 0.62 },
  ],
  details: ['park', 'dog', 'bench', 'book'],
  textTokens: ['DUNE'],
  dominantSubjectCoverage: 0.5,
  documentCoverage: 0,
}));
check('low-ranked background book does not hijack the real subject', backgroundBook.type !== 'media', JSON.stringify(backgroundBook));

check('dog photo → pet', scene.classifyScene(vision({ concepts: ['dog', 'park'] })).type === 'pet');
check('tv photo → screen', scene.classifyScene(vision({ concepts: ['television', 'living room'] })).type === 'screen');
check('two faces → social', scene.classifyScene(vision({ concepts: ['portrait'], maxFaceCount: 2 })).type === 'social');
check('group term → social', scene.classifyScene(vision({ concepts: ['party', 'friends'] })).type === 'social');
check('beach photo → nature', scene.classifyScene(vision({ concepts: ['beach', 'ocean'] })).type === 'nature');
const skylineWithSky = scene.classifyScene(vision({
  concepts: ['city', 'blue sky', 'land', 'grass', 'apartment'],
  details: ['skyscraper', 'blue sky', 'grass'],
}));
check('strong skyline beats generic sky and grass', skylineWithSky.type === 'place' && skylineWithSky.detail === 'city', JSON.stringify(skylineWithSky));
check('concert → activity', scene.classifyScene(vision({ concepts: ['concert', 'stage'] })).type === 'activity');
check('menu → document', scene.classifyScene(vision({ concepts: ['menu', 'text'] })).type === 'document');
check('building → place', scene.classifyScene(vision({ concepts: ['building', 'architecture'] })).type === 'place');
check('unknown → other', scene.classifyScene(vision({ concepts: ['abstract'] })).type === 'other');
check('null vision → other', scene.classifyScene(null).type === 'other');

// --- priority: food beats people-present ---
const dinnerWithFriends = scene.classifyScene(vision({ concepts: ['pasta', 'wine'], maxFaceCount: 3 }));
check('a meal with people still reads as food', dinnerWithFriends.type === 'food', dinnerWithFriends.type);

// --- social detail carries face count ---
check('social detail names the people count', scene.classifyScene(vision({ concepts: ['portrait'], maxFaceCount: 4 })).detail === '4 people');

// --- resolveSceneRead falls back to rules when the LLM is unavailable ---
(async () => {
  const resolved = await scene.resolveSceneRead(vision({ concepts: ['pizza'] }));
  check('resolveSceneRead falls back to the rule classifier', resolved.type === 'food' && resolved.source === 'rules', `${resolved.type}/${resolved.source}`);
  const none = await scene.resolveSceneRead(null);
  check('resolveSceneRead handles null vision', none.type === 'other');
  global.__foundationSceneRead = {
    memoryDomain: 'work', type: 'activity', subject: 'consumer electronics', mediaKind: null,
    title: null, creator: null, representation: 'real_world', supportingSubjects: [], promptVersion: 'test',
  };
  const televisedMatch = await scene.resolveSceneRead(vision({ concepts: ['television', 'consumer electronics', 'machine'] }));
  check('generic Foundation work read cannot outrank a television', televisedMatch.type === 'screen' && televisedMatch.source === 'rules', JSON.stringify(televisedMatch));
  global.__foundationSceneRead = null;
  check('capture Foundation read is not cut off by the generic three-second timeout', sceneSource.includes('timeoutMs: 12000'));
  check('OCR-only cover reads can still reach Foundation Models', foundationSource.includes('(tags.length === 0 && ocrLines.length === 0)'));

  // --- every label is defined for every type ---
  check('a label exists for each scene type', Object.keys(scene.SCENE_LABEL).every((t) => !!scene.SCENE_LABEL[t]));

  console.log(failures === 0 ? '\nAll scene-classify checks passed.' : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
})();
