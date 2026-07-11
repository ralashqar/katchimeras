// Node-only verification for evidence-backed quest criteria.
const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-quest-evidence-'));

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
const intelligenceEvidencePath = transpileToTemp('utils/intelligence/evidence.ts', 'intelligence-evidence.js');
const scoringPath = transpileToTemp('utils/quests/evidence-scoring.ts', 'evidence-scoring.js');
const factsPath = transpileToTemp('utils/signals/facts.ts', 'facts.js');
const definitionsPath = transpileToTemp('utils/quests/definitions.ts', 'definitions.js');
const evaluatePath = transpileToTemp('utils/quests/evaluate.ts', 'evaluate.js');
const typesPath = path.join(tempDir, 'types-home.js');
const qualityRegistryPath = path.join(tempDir, 'quality-registry.js');
fs.writeFileSync(typesPath, '');
fs.writeFileSync(qualityRegistryPath, "exports.qualityDefinition = id => ({ id, aliases: [id.split('.').pop()] }); exports.qualityMatchesText = (q, value) => q.aliases.some(a => value.toLowerCase().includes(a)); exports.qualityThresholds = () => ({ ready: 0.72, review: 0.3 });");

const stubs = {
  '@/types/home': typesPath,
  '@/utils/intelligence/taxonomy': taxonomyPath,
  '@/utils/quests/evidence-scoring': scoringPath,
  '@/utils/signals/facts': factsPath,
  '@/utils/intelligence/quality-registry': qualityRegistryPath,
};
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request in stubs) return stubs[request];
  if (request === './definitions' && parent?.filename === evaluatePath) return definitionsPath;
  return originalResolve.call(this, request, parent, ...rest);
};

const evaluate = require(evaluatePath);
const intelligenceEvidence = require(intelligenceEvidencePath);

let failures = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok  ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

function photoEvidence(id, key, confidence) {
  return {
    id: `photo:${id}`,
    sourceType: 'photo',
    sourceId: id,
    observedAt: '2026-07-07T12:00:00.000Z',
    provider: 'appleVision',
    confidence,
    signals: [{ key, confidence, provider: 'appleVision', source: 'vision' }],
  };
}

const strongParkFacts = {
  'places.categories': ['park'],
  'evidence.items': [photoEvidence('asset-park', 'park', 0.81)],
};
const weakParkFacts = {
  'places.categories': ['park'],
  'evidence.items': [photoEvidence('asset-park', 'park', 0.4)],
};
const dogFacts = {
  'evidence.items': [photoEvidence('asset-dog', 'dog', 0.9)],
};
const bananaEvidence = intelligenceEvidence.buildPhotoEvidence({
  sourceId: 'live-banana',
  observedAt: '2026-07-07T12:30:00.000Z',
  thumbnailUri: 'file://banana.jpg',
  vision: {
    concepts: [{ name: 'banana', salience: 1, coverage: 1, count: 1, peakConfidence: 0.88 }],
    details: ['banana'],
    maxFaceCount: 0,
    faceCoverage: 0,
    textTokens: [],
    analyzedPhotoCount: 1,
  },
  scene: {
    type: 'food',
    label: 'Food',
    detail: 'Fruit',
    food: { detected: true, label: 'Fruit', emoji: 'fruit' },
    source: 'rules',
  },
});
const bananaFacts = {
  'evidence.items': [bananaEvidence],
};
const noEvidenceFacts = {
  'evidence.items': [],
};

check('new park quest passes with confirmed park and matching photo evidence', evaluate.isQuestComplete('quest-new-park', strongParkFacts));
check('new park quest fails when photo evidence is low confidence', !evaluate.isQuestComplete('quest-new-park', weakParkFacts));
check('dog photo quest passes from photo evidence', evaluate.isQuestComplete('quest-photo-dog', dogFacts));
check('banana live photo passes food photo quest', evaluate.isQuestComplete('quest-photo-food', bananaFacts), JSON.stringify(bananaEvidence));
check('dog photo quest fails without evidence', !evaluate.isQuestComplete('quest-photo-dog', noEvidenceFacts));

const status = evaluate.questCriteriaStatus('quest-photo-dog', noEvidenceFacts)[0];
check('missing evidence exposes a reason', status.done === false && typeof status.reason === 'string' && status.reason.includes('dog'), JSON.stringify(status));
const matched = evaluate.questCriteriaStatus('quest-photo-dog', dogFacts)[0];
check('matched evidence exposes ids', matched.done === true && matched.evidenceIds.includes('photo:asset-dog'), JSON.stringify(matched));

console.log(failures === 0 ? '\nAll quest evidence checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
