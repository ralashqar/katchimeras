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
const foundationStub = path.join(tempDir, 'foundation-scene.js');
fs.writeFileSync(foundationStub, 'exports.classifySceneOnDevice = async () => null;\nexports.isFoundationSceneAvailable = () => false;\n');

const stubs = {
  '@/utils/food-detect': foodDetectPath,
  '@/utils/studio-detect': studioDetectPath,
  '@/utils/foundation-scene': foundationStub,
};
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request in stubs) return stubs[request];
  return originalResolve.call(this, request, ...rest);
};

const scene = require(transpileToTemp('utils/scene-classify.ts', 'scene-classify.js'));

let failures = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok  ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

function vision({ concepts = [], details = [], textTokens = [], maxFaceCount = 0 } = {}) {
  return {
    concepts: concepts.map((name) => (typeof name === 'string' ? { name, salience: 1 } : name)),
    details,
    textTokens,
    maxFaceCount,
  };
}

// --- top-level classification (priority + buckets) ---
const food = scene.classifyScene(vision({ concepts: ['coffee', 'table'] }));
check('food photo → food', food.type === 'food', food.type);
check('food carries a detection + label', food.food && food.food.detected && food.food.label === 'Coffee');

check('dog photo → pet', scene.classifyScene(vision({ concepts: ['dog', 'park'] })).type === 'pet');
check('tv photo → screen', scene.classifyScene(vision({ concepts: ['television', 'living room'] })).type === 'screen');
check('two faces → social', scene.classifyScene(vision({ concepts: ['portrait'], maxFaceCount: 2 })).type === 'social');
check('group term → social', scene.classifyScene(vision({ concepts: ['party', 'friends'] })).type === 'social');
check('beach photo → nature', scene.classifyScene(vision({ concepts: ['beach', 'ocean'] })).type === 'nature');
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

  // --- every label is defined for every type ---
  check('a label exists for each scene type', Object.keys(scene.SCENE_LABEL).every((t) => !!scene.SCENE_LABEL[t]));

  console.log(failures === 0 ? '\nAll scene-classify checks passed.' : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
})();
