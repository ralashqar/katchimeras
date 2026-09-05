// Node-only verification harness for the day-tag field (utils/day-tags.ts) and
// the Dex (utils/dex.ts). Usage: node scripts/verify-day-systems.cjs
const fs = require('fs');
const path = require('path');
const Module = require('module');
const os = require('os');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-daysys-'));

function transpileToTemp(relativeSourcePath, outName) {
  const source = fs.readFileSync(path.join(projectRoot, relativeSourcePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const outPath = path.join(tempDir, outName);
  fs.writeFileSync(outPath, output);
  return outPath;
}

const encounterProfiles = JSON.parse(
  fs.readFileSync(path.join(projectRoot, 'data/katchimeras/encounter-katchimeras.json'), 'utf8')
).map((profile) => ({ ...profile, displayName: profile.name }));

const visualKeys = [
  'voltstep', 'hearthsip', 'glimmuse', 'skysette', 'creamalume', 'pulsepounce', 'gatherglow',
  'mossprout', 'lattelet', 'sprintail', 'neonpoko', 'crumbun', 'hayhorn', 'ironette',
  'bedrotte', 'steppling', 'errandimp', 'quietome', 'relicoon', 'shellio', 'flickerbun', 'baristabbit',
  'waglet', 'whiskit', 'snuglet', 'driftkin', 'duskle', 'crustling', 'nigirimp', 'noodloo', 'sundael',
  'bobaloo', 'pagelet', 'hooplet', 'serveling', 'petalimp', 'fernip', 'drizzlet', 'amberleaf', 'blossle',
  'peakle', 'stillo', 'twinklet', 'feastle', 'museling', 'tasklet', 'cheerlet', 'voyagle', 'skylo', 'flexel',
  'mendle', 'pixooka',
  'snoozle', 'encora', 'vesperitt', 'dawnle', 'tempesto', 'mistle',
];
const homeMomentOptions = {
  photo: { id: 'photo', label: 'Photo', icon: 'camera.fill', accentColor: '#F1D4B4', scoreBias: { exploration: 0.14, social: 0.1, calm: 0.06 } },
  inspiration: { id: 'inspiration', label: 'Inspiration', icon: 'sparkles', accentColor: '#E1C0FF', scoreBias: { calm: 0.04, focus: 0.04 } },
  coffee: { id: 'coffee', label: 'Coffee', icon: 'cup.and.saucer.fill', accentColor: '#F3B788', scoreBias: { energy: 0.14, calm: 0.12 } },
  walk: { id: 'walk', label: 'Walk', icon: 'figure.walk', accentColor: '#92D7FF', scoreBias: { energy: 0.26 } },
  new_place: { id: 'new_place', label: 'New place', icon: 'mappin.and.ellipse', accentColor: '#9DDCB8', scoreBias: { exploration: 0.28 } },
  social: { id: 'social', label: 'Social', icon: 'bubble.left.and.bubble.right.fill', accentColor: '#F2C2A8', scoreBias: { social: 0.28 } },
  calm: { id: 'calm', label: 'Calm', icon: 'moon.stars.fill', accentColor: '#B4BCFF', scoreBias: { calm: 0.28 } },
  focus: { id: 'focus', label: 'Focus', icon: 'bolt.fill', accentColor: '#A0B4FF', scoreBias: { focus: 0.28 } },
};
const homeCreatureVisualsStub = Object.fromEntries(visualKeys.map((key) => [key, { source: 0, accentColor: '#FFFFFF' }]));

const castPath = transpileToTemp('constants/encounter-cast.ts', 'encounter-cast.js');
const livingRarityPath = transpileToTemp('utils/living-rarity.ts', 'living-rarity.js');
const bondPath = transpileToTemp('utils/bond.ts', 'bond.js');
const visionSignalsPath = transpileToTemp('utils/vision-signals.ts', 'vision-signals.js');
const photoRealityPath = transpileToTemp('utils/photo-reality.ts', 'photo-reality.js');
const taxonomyPath = transpileToTemp('utils/intelligence/taxonomy.ts', 'intelligence-taxonomy.js');
const classificationPath = path.join(tempDir, 'intelligence-classification.js');
fs.writeFileSync(classificationPath, 'exports.assignmentSignals = () => [];');
const journalContributionsPath = path.join(tempDir, 'journal-hatch-contributions.js');
fs.writeFileSync(journalContributionsPath, 'exports.aggregateJournalHatchSignals = () => [];');
const classificationPolicyPath = path.join(tempDir, 'intelligence-classification-policy.js');
fs.writeFileSync(classificationPolicyPath, 'exports.visionSignalIsRejected = () => false;');
const photoSubjectProjectionPath = transpileToTemp('utils/intelligence/photo-subject-projection.ts', 'photo-subject-projection.js');
const photoPlaceGameplayPath = transpileToTemp('utils/photo-place-gameplay.ts', 'photo-place-gameplay.js');
const lifeAspectsPath = transpileToTemp('constants/life-aspects.ts', 'life-aspects.js');
const katchimeraSkinsPath = transpileToTemp('constants/katchimera-skins.ts', 'katchimera-skins.js');
const katchimeraIdentityPath = transpileToTemp('utils/katchimera-identity.ts', 'katchimera-identity.js');
const enginePath = transpileToTemp('utils/encounter-engine.ts', 'encounter-engine.js');
const dayTagsPath = transpileToTemp('utils/day-tags.ts', 'day-tags.js');
const dexPath = transpileToTemp('utils/dex.ts', 'dex.js');

const stubs = {
  '@/constants/encounter-cast': castPath,
  '@/constants/home-mvp': { homeCreatureVisuals: homeCreatureVisualsStub, homeMomentOptions },
  '@/constants/katchimera-encounter-profiles': { katchimeraEncounterProfiles: encounterProfiles },
  '@/constants/life-aspects': lifeAspectsPath,
  '@/constants/katchimera-skins': katchimeraSkinsPath,
  '@/utils/living-rarity': livingRarityPath,
  '@/utils/bond': bondPath,
  '@/utils/vision-signals': visionSignalsPath,
  '@/utils/photo-reality': photoRealityPath,
  '@/utils/intelligence/taxonomy': taxonomyPath,
  '@/utils/intelligence/classification': classificationPath,
  '@/utils/journal-hatch-contributions': journalContributionsPath,
  '@/utils/intelligence/classification-policy': classificationPolicyPath,
  '@/utils/intelligence/photo-subject-projection': photoSubjectProjectionPath,
  '@/utils/photo-place-gameplay': photoPlaceGameplayPath,
  '@/utils/katchimera-identity': katchimeraIdentityPath,
  '@/utils/encounter-engine': enginePath,
  '@/utils/day-tags': dayTagsPath,
  '@/utils/dex': dexPath,
  '@/types/home': {},
  '@/types/katchimera': {},
};

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request in stubs) {
    const stub = stubs[request];
    if (typeof stub === 'string') return stub;
    const stubFile = path.join(tempDir, `${request.replace(/[@/]/g, '_')}.js`);
    if (!fs.existsSync(stubFile)) fs.writeFileSync(stubFile, `module.exports = ${JSON.stringify(stub)};`);
    return stubFile;
  }
  return originalResolve.call(this, request, ...rest);
};

const { buildDayTags } = require(dayTagsPath);
const { buildDex } = require(dexPath);
const { encounterLiveCast } = require(castPath);

function makeDay(overrides = {}) {
  return {
    id: 'day-2026-06-12', isoDate: '2026-06-12', state: 'ready_to_hatch', stepsCount: 0,
    visitedPlaceCount: 0, newPlaceCount: 0, locationSampleCount: 0, shareReadyAt: null,
    moments: [], locations: [], healthRouteImport: null, exactRouteSegments: [],
    selectedPathId: null, promptAnswers: [], heroPhoto: null, creature: null, ...overrides,
  };
}
function makeMoment(type, index = 0) {
  return { id: `m-${type}-${index}`, type, label: type, icon: 'sparkles', accentColor: '#FFF', createdAt: '2026-06-12T10:00:00.000Z', source: 'quick_tag', metadata: null };
}

let failures = 0;
function check(label, condition, detail) {
  if (condition) console.log(`  ok  ${label}`);
  else { failures += 1; console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`); }
}

// === Day tags ==============================================================
const mixedDay = makeDay({
  moments: [makeMoment('coffee', 0), makeMoment('walk', 1)],
  stepsCount: 8200,
  placeCategorySeeds: ['museum'],
  vision: { concepts: [{ name: 'museum', salience: 1.6, coverage: 0.8, count: 3, peakConfidence: 0.85 }], details: [], maxFaceCount: 0, faceCoverage: 0, textTokens: [], analyzedPhotoCount: 4 },
});
const tags = buildDayTags(mixedDay);
check('day tags are produced from every source', tags.length >= 5, `count=${tags.length}`);
check('tags are sorted by weight desc', tags.every((tag, i) => i === 0 || tags[i - 1].weight >= tag.weight), JSON.stringify(tags.map((t) => t.weight)));
check('all weights are within 0..1', tags.every((tag) => tag.weight >= 0 && tag.weight <= 1), JSON.stringify(tags.map((t) => t.weight)));
const sources = new Set(tags.map((tag) => tag.source));
check('tags span moment/place/vision/steps sources', sources.has('moment') && sources.has('place') && sources.has('vision') && sources.has('steps'), JSON.stringify([...sources]));
const coffeeTag = tags.find((tag) => tag.label === 'coffee');
check('a coffee moment tag feeds the coffee species', coffeeTag && coffeeTag.feedsSpecies.includes('location_coffee_shop_baristabbit'), JSON.stringify(coffeeTag));
const stepsTag = tags.find((tag) => tag.source === 'steps');
check('a high-steps tag feeds the walking species', stepsTag && stepsTag.feedsSpecies.includes('activity_high_steps_day_steppling'), JSON.stringify(stepsTag));
const visionTag = tags.find((tag) => tag.source === 'vision');
check('a museum vision tag feeds the museum species', visionTag && visionTag.feedsSpecies.includes('location_museum_relicoon'), JSON.stringify(visionTag));
check('an empty day yields no tags', buildDayTags(makeDay()).length === 0);

// === Dex ===================================================================
const history = {
  baristabbit: { count: 12, lastSeenIsoDate: '2026-06-11' },
  relicoon: { count: 1, lastSeenIsoDate: '2026-06-05' },
};
const hatchedDays = [
  makeDay({ isoDate: '2026-06-05', creature: { encounterProfileId: 'location_museum_relicoon', visualKey: 'relicoon', rarity: 'epic' } }),
  makeDay({ isoDate: '2026-06-11', creature: { encounterProfileId: 'location_coffee_shop_baristabbit', visualKey: 'baristabbit', rarity: 'common' } }),
  makeDay({ isoDate: '2026-06-09', creature: { encounterProfileId: 'location_coffee_shop_baristabbit', visualKey: 'baristabbit', rarity: 'rare' } }),
];
const dex = buildDex(history, hatchedDays);
check('dex lists one companion per life-area family', dex.total === 25, `total=${dex.total}`);
check('collected counts only met families', dex.collected === 2, `collected=${dex.collected}`);
const baristabbit = dex.entries.find((entry) => entry.familyId === 'baristabbit');
check('met family is unlocked', baristabbit && baristabbit.locked === false, JSON.stringify(baristabbit));
check('bond stage reflects visit count', baristabbit && baristabbit.bondStage === 1, String(baristabbit?.bondStage));
check('highest rarity seen is the max across days', baristabbit && baristabbit.highestRaritySeen === 'rare', String(baristabbit?.highestRaritySeen));
check('first hatched date is the earliest', baristabbit && baristabbit.firstHatchedDate === '2026-06-09', String(baristabbit?.firstHatchedDate));
check('encountered visual forms are nested under the family', baristabbit && baristabbit.forms.length === 4 && baristabbit.forms.some((form) => form.skinId === 'baristabbit' && form.unlocked), JSON.stringify(baristabbit?.forms));
const locked = dex.entries.find((entry) => entry.familyId === 'waglet');
check('unmet family stays locked with no rarity', locked && locked.locked === true && locked.highestRaritySeen === null, JSON.stringify(locked));
const dailyLife = dex.categories.find((cat) => cat.category === 'daily-life');
check('category summaries report collected/total', dailyLife && dailyLife.collected === 1 && dailyLife.total > 2, JSON.stringify(dailyLife));
const world = dex.categories.find((cat) => cat.category === 'world');
check('world aspects form their own category', world && world.total >= 3, JSON.stringify(world));

console.log(failures === 0 ? '\nAll day-systems checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
