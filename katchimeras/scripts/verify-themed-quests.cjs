const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-themed-'));

function transpile(relativeSourcePath, outName) {
  const source = fs.readFileSync(path.join(projectRoot, relativeSourcePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const outPath = path.join(tempDir, outName);
  fs.writeFileSync(outPath, output);
  return outPath;
}

const factsPath = transpile('utils/signals/facts.ts', 'facts.js');
const capsPath = transpile('utils/capabilities/quest-capabilities.ts', 'quest-capabilities.js');
const scoringPath = transpile('utils/quests/evidence-scoring.ts', 'evidence-scoring.js');
const taxonomyPath = transpile('utils/intelligence/taxonomy.ts', 'taxonomy.js');
const journalTemplatesPath = transpile('utils/quests/journal-templates.ts', 'journal-templates.js');
const definitionsPath = transpile('utils/quests/definitions.ts', 'definitions.js');
const themedPath = transpile('utils/quests/themed.ts', 'themed.js');
const engagementPath = transpile('utils/katchimera-engagement.ts', 'katchimera-engagement.js');
const lifeAspectsPath = transpile('constants/life-aspects.ts', 'life-aspects.js');
const typesPath = path.join(tempDir, 'types-home.js');
const qualityRegistryPath = path.join(tempDir, 'quality-registry.js');
fs.writeFileSync(typesPath, '');
fs.writeFileSync(qualityRegistryPath, "exports.qualityDefinition = id => ({ id, aliases: [id.split('.').pop()] }); exports.qualityMatchesText = (q, value) => q.aliases.some(a => value.toLowerCase().includes(a)); exports.qualityThresholds = () => ({ ready: 0.72, review: 0.3 });");

const stubs = {
  '@/types/home': typesPath,
  '@/utils/signals/facts': factsPath,
  '@/utils/capabilities/quest-capabilities': capsPath,
  '@/utils/quests/evidence-scoring': scoringPath,
  '@/utils/intelligence/taxonomy': taxonomyPath,
  '@/utils/quests/themed': themedPath,
  '@/utils/intelligence/quality-registry': qualityRegistryPath,
  '@/utils/quests/journal-templates': journalTemplatesPath,
  '@/constants/life-aspects': lifeAspectsPath,
};
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request in stubs) return stubs[request];
  if (request === './definitions' && parent?.filename === themedPath) return definitionsPath;
  if (request === '../data/katchimeras/encounter-katchimeras.json' && parent?.filename === engagementPath) {
    return path.join(projectRoot, 'data/katchimeras/encounter-katchimeras.json');
  }
  return originalResolve.call(this, request, parent, ...rest);
};

const themed = require(themedPath);
const definitions = require(definitionsPath);
const engagement = require(engagementPath);

let failures = 0;
function check(label, condition, detail) {
  if (condition) console.log(`  ok  ${label}`);
  else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

check('dog subtype offers dog photo quest', themed.themedQuestOffer('dog', 'memory').id === 'quest-photo-dog');
check('park subtype offers park quest', themed.themedQuestOffer('park', 'places').id === 'quest-new-park');
check('food archetype falls back to food quest', themed.themedQuestOffer('', 'food').id === 'quest-new-cafe');
check('unknown theme falls back to snap today', themed.themedQuestOffer('unknown', 'unknown').id === 'quest-snap-today');

const dogQuest = definitions.questDefinition('quest-photo-dog');
const parkQuest = definitions.questDefinition('quest-new-park');
const voiceQuest = definitions.questDefinition('quest-celebrate-note');

check('photo quest metadata requires camera', dogQuest.requiresCapabilities.includes('camera.capture'));
check('photo quest metadata includes vision assist', dogQuest.optionalCapabilities.includes('appleVision'));
check('photo quest metadata suggests camera action', dogQuest.suggestedActions.includes('take_photo'));
check('Mossprout park quest is explicitly camera-first', parkQuest.family === 'photo' && parkQuest.suggestedActions.includes('take_photo'));
check('Mossprout park quest requires camera, not location', parkQuest.requiresCapabilities.includes('camera.capture') && !parkQuest.requiresCapabilities.includes('location.foreground'), JSON.stringify(parkQuest.requiresCapabilities));
check('Mossprout park quest uses only the canonical park photo quality', parkQuest.criteria.length === 1 && parkQuest.criteria[0].qualityId === 'place.park', JSON.stringify(parkQuest.criteria));
check('celebration journal quest does not require microphone', !voiceQuest.requiresCapabilities.includes('microphone'), JSON.stringify(voiceQuest.requiresCapabilities));
check('celebration journal quest keeps speech transcription optional', voiceQuest.optionalCapabilities.includes('speech.transcription'));
check('celebration journal quest uses exact linked journal evidence', voiceQuest.criteria.some((criterion) => criterion.fact === 'evidence.items' && criterion.op === 'questJournalMatch'));

const kingdom = {
  totals: { foodMoments: 0, steps: 0, places: 0, bigMoments: 0, notes: 0, studioMoments: 0, photos: 0, daysHatched: 0 },
};
check('Flickerbun subtype resolves to cinema', engagement.subtypeForCreature('location_cinema_flickerbun', 'Flickerbun flickerbun') === 'cinema');
check('Flickerbun visual fallback resolves to cinema', engagement.subtypeForCreature('legacy-flicker-id', 'Flickerburn flickerbun') === 'cinema');
check('Flickerbun offers film quest', engagement.companionUnit('culture', kingdom, 'cinema').quest.id === 'quest-watch-film');
check('Mossprout offers park quest', engagement.companionUnit('places', kingdom, 'park').quest.id === 'quest-new-park');

console.log(failures === 0 ? '\nAll themed quest checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
