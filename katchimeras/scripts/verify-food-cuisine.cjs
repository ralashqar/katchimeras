const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-food-cuisine-'));

function transpile(relativeSourcePath, outName) {
  const source = fs.readFileSync(path.join(projectRoot, relativeSourcePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const outPath = path.join(tempDir, outName);
  fs.writeFileSync(outPath, output);
  return outPath;
}

const foodDetectPath = transpile('utils/food-detect.ts', 'food-detect.js');
const mediaMomentsPath = transpile('game/days/mutations/media-moments.ts', 'media-moments.js');
const typesPath = path.join(tempDir, 'types-home.js');
fs.writeFileSync(typesPath, '');

const stubs = {
  '@/types/home': typesPath,
  '@/utils/food-detect': foodDetectPath,
};
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request in stubs) return stubs[request];
  return originalResolve.call(this, request, parent, ...rest);
};

const food = require(foodDetectPath);
const media = require(mediaMomentsPath);

let failures = 0;
function check(label, condition, detail) {
  if (condition) console.log(`  ok  ${label}`);
  else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

check('sushi note maps to Japanese cuisine', food.detectFoodInText('Had sushi for dinner').cuisine === 'japanese');
check('ramen note maps to Japanese cuisine', food.detectFoodInText('Lunch was a bowl of ramen').cuisine === 'japanese');
check('pizza note maps to Italian cuisine', food.detectFoodInText('Pizza after work').cuisine === 'italian');

const visionDetection = food.detectFoodInVision({
  concepts: [{ name: 'sushi', salience: 0.8, coverage: 1, count: 1, peakConfidence: 0.9 }],
  details: [],
  maxFaceCount: 0,
  faceCoverage: 0,
  textTokens: [],
  analyzedPhotoCount: 1,
});
check('sushi photo maps to Japanese cuisine', visionDetection.cuisine === 'japanese');

const moment = media.buildAutoFoodMoment(visionDetection, {
  source: 'photo',
  now: new Date('2026-07-07T12:00:00.000Z'),
});
check('auto food moment persists cuisine', moment.cuisine === 'japanese');

console.log(failures === 0 ? '\nAll food cuisine checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
