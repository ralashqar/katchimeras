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
const studioDetectPath = transpile('utils/studio-detect.ts', 'studio-detect.js');
const mediaMomentsPath = transpile('game/days/mutations/media-moments.ts', 'media-moments.js');
const typesPath = path.join(tempDir, 'types-home.js');
fs.writeFileSync(typesPath, '');
const classificationPath = path.join(tempDir, 'classification.js');
fs.writeFileSync(classificationPath, 'exports.buildNoteClassifiedMemory = () => ({}); exports.upsertClassifiedMemory = (existing) => existing || [];');

const stubs = {
  '@/types/home': typesPath,
  '@/utils/food-detect': foodDetectPath,
  '@/utils/studio-detect': studioDetectPath,
  '@/utils/intelligence/classification': classificationPath,
};
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request in stubs) return stubs[request];
  return originalResolve.call(this, request, parent, ...rest);
};

const food = require(foodDetectPath);
const studio = require(studioDetectPath);
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
check('dessert detection returns an emoji, not an internal token', food.detectFoodInText('Cake after dinner').emoji === '🍰');
check('legacy food emoji tokens normalize', food.normalizeFoodEmoji('dessert') === '🍰');

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

const bookDetection = studio.detectStudioInVision({
  concepts: [{ name: 'book', salience: 0.34, coverage: 1, count: 1, peakConfidence: 0.34 }],
  details: ['book', 'document'],
  textTokens: ['KAZUO ISHIGURO', 'KLARA AND THE SUN', 'A NOVEL'],
  maxFaceCount: 0,
  faceCoverage: 0,
  analyzedPhotoCount: 1,
  dominantSubjectCoverage: 0.58,
  documentCoverage: 1,
});
const bookMoment = media.buildAutoStudioMoment(bookDetection, {
  source: 'photo',
  sourceId: 'book-cover-photo',
  now: new Date('2026-07-07T13:00:00.000Z'),
});
check('prominent book cover becomes a Studio/Inspo record', bookMoment.mediaType === 'book' && bookMoment.source === 'photo', JSON.stringify(bookMoment));
check('Studio/Inspo record keeps the OCR title', bookMoment.label === 'Klara and the Sun', bookMoment.label);

console.log(failures === 0 ? '\nAll food cuisine checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
