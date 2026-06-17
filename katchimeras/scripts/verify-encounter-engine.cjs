// Node-only verification harness for the encounter engine (no test runner in
// this project). Transpiles the pure modules with the TypeScript compiler and
// runs the M1 acceptance scenarios. Usage: node scripts/verify-encounter-engine.cjs
const fs = require('fs');
const path = require('path');
const Module = require('module');
const os = require('os');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-verify-'));

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
  'waglet', 'whiskit', 'snuglet', 'driftkin', 'duskle',
  'crustling', 'nigirimp', 'noodloo', 'sundael', 'bobaloo',
  'pagelet', 'hooplet', 'serveling', 'petalimp', 'fernip',
  'drizzlet', 'amberleaf', 'blossle', 'peakle', 'stillo', 'twinklet', 'feastle',
  'museling', 'tasklet', 'cheerlet', 'voyagle', 'skylo', 'flexel',
];
const homeCreatureVisualsStub = Object.fromEntries(
  visualKeys.map((key) => [key, { source: 0, accentColor: '#FFFFFF' }])
);

const castPath = transpileToTemp('constants/encounter-cast.ts', 'encounter-cast.js');
const livingRarityPath = transpileToTemp('utils/living-rarity.ts', 'living-rarity.js');
const bondPath = transpileToTemp('utils/bond.ts', 'bond.js');
const visionSignalsPath = transpileToTemp('utils/vision-signals.ts', 'vision-signals.js');
const enginePath = transpileToTemp('utils/encounter-engine.ts', 'encounter-engine.js');
const hatchPastPath = transpileToTemp('utils/hatch-your-past.ts', 'hatch-your-past.js');

const stubs = {
  '@/constants/encounter-cast': castPath,
  '@/constants/home-mvp': { homeCreatureVisuals: homeCreatureVisualsStub },
  '@/constants/katchimera-encounter-profiles': { katchimeraEncounterProfiles: encounterProfiles },
  '@/utils/living-rarity': livingRarityPath,
  '@/utils/bond': bondPath,
  '@/utils/vision-signals': visionSignalsPath,
  '@/utils/encounter-engine': enginePath,
  '@/types/home': {},
  '@/types/katchimera': {},
};

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request in stubs) {
    const stub = stubs[request];
    if (typeof stub === 'string') {
      return stub;
    }
    const stubFile = path.join(tempDir, `${request.replace(/[@/]/g, '_')}.js`);
    if (!fs.existsSync(stubFile)) {
      fs.writeFileSync(stubFile, `module.exports = ${JSON.stringify(stub)};`);
    }
    return stubFile;
  }
  return originalResolve.call(this, request, ...rest);
};

const engine = require(enginePath);
const hatchPast = require(hatchPastPath);

function makeDay(overrides = {}) {
  return {
    id: 'day-2026-06-12',
    isoDate: '2026-06-12',
    state: 'ready_to_hatch',
    stepsCount: 0,
    visitedPlaceCount: 0,
    newPlaceCount: 0,
    locationSampleCount: 0,
    shareReadyAt: null,
    moments: [],
    locations: [],
    healthRouteImport: null,
    exactRouteSegments: [],
    selectedPathId: null,
    promptAnswers: [],
    heroPhoto: null,
    creature: null,
    ...overrides,
  };
}

function makeMoment(type, index = 0) {
  return {
    id: `m-${type}-${index}`,
    type,
    label: type,
    icon: 'sparkles',
    accentColor: '#FFF',
    createdAt: '2026-06-12T10:00:00.000Z',
    source: 'quick_tag',
    metadata: null,
  };
}

function makePromptAnswer(kind, choiceIds, labels, semanticTags, scoreBias = {}, encounterSeedBias = []) {
  return {
    id: `prompt-${kind}-${choiceIds.join('-')}`,
    kind,
    choiceIds,
    labels,
    createdAt: '2026-06-12T18:00:00.000Z',
    source: 'prompt_chip',
    semanticTags,
    scoreBias,
    encounterSeedBias,
  };
}

let failures = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok  ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

// 1. Coffee day hatches Baristabbit with the unlock line on first encounter.
const coffeeDay = makeDay({ moments: [makeMoment('coffee', 0), makeMoment('coffee', 1)], stepsCount: 1600 });
const coffeeCreature = engine.buildEncounterCreature(coffeeDay, {}, 'calm', 'energy');
check('coffee day matches Baristabbit', coffeeCreature?.name === 'Baristabbit', JSON.stringify(coffeeCreature));
check('first encounter uses unlock line', /revealed Baristabbit/.test(coffeeCreature?.highlight ?? ''), coffeeCreature?.highlight);
check('encounter profile id recorded', coffeeCreature?.encounterProfileId === 'location_coffee_shop_baristabbit');
check('no deck language in copy', !/deck/i.test(`${coffeeCreature?.highlight} ${coffeeCreature?.reflection}`),
  `${coffeeCreature?.highlight} | ${coffeeCreature?.reflection}`);

// 2. Determinism: same day + history twice -> identical creature.
const coffeeCreatureAgain = engine.buildEncounterCreature(coffeeDay, {}, 'calm', 'energy');
check('hatch is deterministic', JSON.stringify(coffeeCreature) === JSON.stringify(coffeeCreatureAgain));

// 3. Repeat encounter switches to repeat copy and carries repeatDepth.
const history = { location_coffee_shop_baristabbit: { count: 2, lastSeenIsoDate: '2026-06-10' } };
const repeatCreature = engine.buildEncounterCreature(coffeeDay, history, 'calm', 'energy');
check('repeat depth carried', repeatCreature?.repeatDepth === 2, String(repeatCreature?.repeatDepth));
check('repeat copy differs from unlock copy', repeatCreature?.highlight !== coffeeCreature?.highlight, repeatCreature?.highlight);
check('repeat copy deck-free', !/deck/i.test(repeatCreature?.highlight ?? ''), repeatCreature?.highlight);

// 4. Thin recovery day hatches Bedrotte with restorative copy.
const thinDay = makeDay({ stepsCount: 700, locationSampleCount: 2 });
const thinCreature = engine.buildEncounterCreature(thinDay, {}, 'calm', 'focus');
check('thin day matches Bedrotte', thinCreature?.name === 'Bedrotte', JSON.stringify(thinCreature));
check('thin day copy deck-free', !/deck/i.test(`${thinCreature?.highlight} ${thinCreature?.reflection}`),
  `${thinCreature?.highlight} | ${thinCreature?.reflection}`);

// 5. Run workout beats step count: Sprintail.
const runDay = makeDay({
  stepsCount: 9800,
  exactRouteSegments: [{ id: 'r1', workoutId: 'w1', activityType: 'running', startedAt: '', endedAt: '', coordinates: [] }],
});
const runCreature = engine.buildEncounterCreature(runDay, {}, 'energy', 'focus');
check('run day matches Sprintail', runCreature?.name === 'Sprintail', JSON.stringify(runCreature));

// 6. High-steps day without a workout matches the walking character.
const stepsDay = makeDay({ stepsCount: 9000 });
const stepsCreature = engine.buildEncounterCreature(stepsDay, {}, 'energy', 'calm');
check('high-steps day matches Steppling', stepsCreature?.name === 'Steppling', JSON.stringify(stepsCreature));

// 7. Repeat favoring: park walk + single coffee with deep park history -> Mossprout.
const mixedDay = makeDay({ moments: [makeMoment('coffee', 0), makeMoment('walk', 1)], stepsCount: 3600 });
const parkHistory = { location_park_mossprout: { count: 3, lastSeenIsoDate: '2026-06-11' } };
const mixedCreature = engine.buildEncounterCreature(mixedDay, parkHistory, 'energy', 'calm');
check('repeat history favors returning character', mixedCreature?.name === 'Mossprout', JSON.stringify(mixedCreature?.name));

// 8. Social moments hatch Gatherglow.
const socialDay = makeDay({ moments: [makeMoment('social', 0)], stepsCount: 3000 });
const socialCreature = engine.buildEncounterCreature(socialDay, {}, 'social', 'calm');
check('social day matches Gatherglow', socialCreature?.name === 'Gatherglow', JSON.stringify(socialCreature?.name));

// 8b. Multi-stop day without a workout or big steps hatches Errandimp.
const errandDay = makeDay({ stepsCount: 3400, visitedPlaceCount: 4 });
const errandCreature = engine.buildEncounterCreature(errandDay, {}, 'energy', 'focus');
check('errand day matches Errandimp', errandCreature?.name === 'Errandimp', JSON.stringify(errandCreature?.name));

// 8d. Resolved place categories hatch the dormant cast: a bakery visit wakes Crumbun.
const bakeryDay = makeDay({ stepsCount: 2100, placeCategorySeeds: ['bakery'] });
const bakeryCreature = engine.buildEncounterCreature(bakeryDay, {}, 'calm', 'social');
check('resolved bakery place matches Crumbun', bakeryCreature?.name === 'Crumbun', JSON.stringify(bakeryCreature?.name));

// 8e. A food market visit wakes Hayhorn.
const marketDay = makeDay({ stepsCount: 2600, placeCategorySeeds: ['farm'] });
const marketCreature = engine.buildEncounterCreature(marketDay, {}, 'calm', 'energy');
check('resolved market place matches Hayhorn', marketCreature?.name === 'Hayhorn', JSON.stringify(marketCreature?.name));

// 8g. Resolved institutions hatch the new cast: a library afternoon wakes Quietome.
const libraryDay = makeDay({ stepsCount: 1900, placeCategorySeeds: ['library'] });
const libraryCreature = engine.buildEncounterCreature(libraryDay, {}, 'focus', 'calm');
check('resolved library place matches Quietome', libraryCreature?.name === 'Quietome', JSON.stringify(libraryCreature?.name));

// 8h. A cinema evening wakes Flickerbun.
const cinemaDay = makeDay({ stepsCount: 2400, placeCategorySeeds: ['cinema'] });
const cinemaCreature = engine.buildEncounterCreature(cinemaDay, {}, 'social', 'calm');
check('resolved cinema place matches Flickerbun', cinemaCreature?.name === 'Flickerbun', JSON.stringify(cinemaCreature?.name));

// 8f. A resolved place outranks a manual tag (place evidence is stronger).
const placeVsTagDay = makeDay({
  moments: [makeMoment('coffee', 0)],
  stepsCount: 1800,
  placeCategorySeeds: ['park'],
});
const placeVsTagCreature = engine.buildEncounterCreature(placeVsTagDay, {}, 'calm', 'energy');
check('resolved place outranks manual tag', placeVsTagCreature?.name === 'Mossprout', JSON.stringify(placeVsTagCreature?.name));

// 8c. Day with no signals at all (moments the cast does not cover, no GPS
// shape) still falls back to null for the trait generator.
const focusDay = makeDay({ moments: [makeMoment('focus', 0)], stepsCount: 3000 });
check('uncovered day returns null (trait fallback)', engine.buildEncounterCreature(focusDay, {}, 'focus', 'calm') === null);

// 8i. Passive home read: a quiet, stay-put day with only a photo (no calm tag,
// no resolved place) still hatches the home-evening companion — tagging is
// optional for the common quiet day. (makeLocation is defined below.)
const quietStayPutDay = makeDay({
  moments: [makeMoment('photo', 0)],
  stepsCount: 1500,
  locations: [makeStayPutLocation(0), makeStayPutLocation(1)],
});
const quietCreature = engine.buildEncounterCreature(quietStayPutDay, {}, 'calm', 'focus');
check('quiet stay-put day hatches Bedrotte passively', quietCreature?.name === 'Bedrotte', JSON.stringify(quietCreature?.name));

// 8j. A resolved place still outranks the passive home read on a stay-put day.
const stayPutCafeDay = makeDay({
  stepsCount: 1200,
  placeCategorySeeds: ['coffee_shop'],
  locations: [makeStayPutLocation(0), makeStayPutLocation(1)],
});
const stayPutCafeCreature = engine.buildEncounterCreature(stayPutCafeDay, {}, 'calm', 'energy');
check('resolved place beats passive home read', stayPutCafeCreature?.name === 'Baristabbit', JSON.stringify(stayPutCafeCreature?.name));

// 8k. A high-movement stay-put-ish day is not forced into the home read.
const busyDay = makeDay({ stepsCount: 9000, locations: [makeStayPutLocation(0), makeStayPutLocation(1)] });
const busyCreature = engine.buildEncounterCreature(busyDay, {}, 'energy', 'calm');
check('busy day is not pulled into home read', busyCreature?.name === 'Steppling', JSON.stringify(busyCreature?.name));

// 8l. Vision read: a day whose photos saw the beach hatches Shellio with no
// place resolution and no tag — the camera's evidence routes the encounter.
const beachVisionDay = makeDay({
  stepsCount: 3000,
  vision: {
    concepts: [{ name: 'beach', salience: 1.8, coverage: 0.9, count: 2, peakConfidence: 0.92 }],
    maxFaceCount: 0,
    faceCoverage: 0,
    textTokens: [],
    analyzedPhotoCount: 2,
  },
});
const beachCreature = engine.buildEncounterCreature(beachVisionDay, {}, 'calm', 'energy');
check('vision beach labels match Shellio', beachCreature?.name === 'Shellio', JSON.stringify(beachCreature?.name));

// 8m. Face count closes the social gap passive sensors can't: faces in frame
// hatch the time-together companion, no manual tag.
const facesDay = makeDay({
  stepsCount: 2600,
  vision: { concepts: [], maxFaceCount: 3, faceCoverage: 1, textTokens: [], analyzedPhotoCount: 4 },
});
const facesCreature = engine.buildEncounterCreature(facesDay, {}, 'social', 'calm');
check('vision face count matches Gatherglow', facesCreature?.name === 'Gatherglow', JSON.stringify(facesCreature?.name));

// 8m-spec. A specific scene (museum in the photos) beats a high-steps day — what
// the day was ABOUT outranks how much you moved (so a museum visit isn't Steppling).
const museumWalkDay = makeDay({
  stepsCount: 12000,
  vision: {
    concepts: [{ name: 'museum', salience: 1.6, coverage: 0.7, count: 3, peakConfidence: 0.85 }],
    maxFaceCount: 0,
    faceCoverage: 0,
    textTokens: [],
    analyzedPhotoCount: 4,
  },
});
const museumWalkCreature = engine.buildEncounterCreature(museumWalkDay, {}, 'energy', 'calm');
check(
  'specific vision (museum) beats a high-steps day',
  museumWalkCreature?.visualKey === 'relicoon',
  JSON.stringify({ name: museumWalkCreature?.name, visualKey: museumWalkCreature?.visualKey })
);

// 8m-avoid. avoidProfileId demotes the day-before's creature when another is
// competitive (variety across consecutive backfilled days), but a steps-only day
// still hatches its walker when there's no alternative.
const twoSignalDay = makeDay({ moments: [makeMoment('coffee', 0)], stepsCount: 1800, placeCategorySeeds: ['park'] });
const normalPick = engine.buildEncounterCreature(twoSignalDay, {}, 'calm', 'energy');
const avoidedPick = engine.buildEncounterCreature(twoSignalDay, {}, 'calm', 'energy', {
  avoidProfileId: 'location_park_mossprout',
});
check(
  'avoidProfileId picks a different creature when one is competitive',
  normalPick?.name === 'Mossprout' && avoidedPick != null && avoidedPick.name !== 'Mossprout',
  JSON.stringify({ normal: normalPick?.name, avoided: avoidedPick?.name })
);
const stepsAvoidedCreature = engine.buildEncounterCreature(stepsDay, {}, 'energy', 'calm', {
  avoidProfileId: 'activity_high_steps_day_steppling',
});
check(
  'avoid still hatches the only candidate (steps-only stays Steppling)',
  stepsAvoidedCreature?.name === 'Steppling',
  JSON.stringify(stepsAvoidedCreature?.name)
);

// 8o. Subject creature: a day whose photos were full of a dog hatches Waglet —
// the new "what was with you" axis, from vision alone.
const dogDay = makeDay({
  stepsCount: 3200,
  vision: {
    concepts: [{ name: 'dog', salience: 2.4, coverage: 0.8, count: 4, peakConfidence: 0.9 }],
    maxFaceCount: 0,
    faceCoverage: 0,
    textTokens: [],
    analyzedPhotoCount: 5,
  },
});
const dogCreature = engine.buildEncounterCreature(dogDay, {}, 'calm', 'social');
check('dog-filled day hatches Waglet (subject creature)', dogCreature?.name === 'Waglet', JSON.stringify(dogCreature?.name));
check('Waglet carries its profile + cue', dogCreature?.encounterProfileId === 'subject_dog_companion_waglet', JSON.stringify(dogCreature?.encounterProfileId));

// 8o-prompt. Explicit prompt answers are weak but useful encounter signals:
// enough to rescue thin social/celebration days, not enough to beat clear
// passive/manual evidence.
const lowHomePromptDay = makeDay({
  stepsCount: 700,
  locationSampleCount: 2,
  promptAnswers: [
    makePromptAnswer('feeling', ['low'], ['Low'], ['feeling:low', 'tender_day'], { calm: 0.18 }),
  ],
});
const lowHomeCreature = engine.buildEncounterCreature(lowHomePromptDay, {}, 'calm', 'focus');
check('low feeling + home day keeps Bedrotte', lowHomeCreature?.name === 'Bedrotte', JSON.stringify(lowHomeCreature?.name));

const familyPromptDay = makeDay({
  stepsCount: 900,
  promptAnswers: [
    makePromptAnswer(
      'people',
      ['family'],
      ['Family'],
      ['people:family'],
      { social: 0.26, calm: 0.08 },
      [{ seedId: 'social_gathering', intensity: 0.42 }]
    ),
  ],
});
const familyPromptCreature = engine.buildEncounterCreature(familyPromptDay, {}, 'social', 'calm');
check('family prompt boosts people-led signal', familyPromptCreature?.name === 'Gatherglow', JSON.stringify(familyPromptCreature?.name));

const celebrationPromptDay = makeDay({
  stepsCount: 1400,
  promptAnswers: [
    makePromptAnswer(
      'meaning',
      ['celebration'],
      ['Celebration'],
      ['meaning:celebration'],
      { social: 0.18, energy: 0.08 },
      [{ seedId: 'celebration', intensity: 0.42 }]
    ),
  ],
});
const celebrationPromptCreature = engine.buildEncounterCreature(celebrationPromptDay, {}, 'social', 'energy');
check('celebration meaning can lift Cheerlet', celebrationPromptCreature?.name === 'Cheerlet', JSON.stringify(celebrationPromptCreature?.name));

const coffeeWithPromptDay = makeDay({
  moments: [makeMoment('coffee', 0)],
  promptAnswers: [
    makePromptAnswer(
      'people',
      ['family'],
      ['Family'],
      ['people:family'],
      { social: 0.26 },
      [{ seedId: 'social_gathering', intensity: 0.34 }]
    ),
  ],
});
const coffeeWithPromptCreature = engine.buildEncounterCreature(coffeeWithPromptDay, {}, 'calm', 'social');
check('prompt does not overpower clear coffee evidence', coffeeWithPromptCreature?.name === 'Baristabbit', JSON.stringify(coffeeWithPromptCreature?.name));

// 8p. The rest of the subject set hatches from its concept.
function subjectDay(concept) {
  return makeDay({
    stepsCount: 2800,
    vision: {
      concepts: [{ name: concept, salience: 2.2, coverage: 0.75, count: 3, peakConfidence: 0.88 }],
      maxFaceCount: 0,
      faceCoverage: 0,
      textTokens: [],
      analyzedPhotoCount: 4,
    },
  });
}
check('cat day hatches Whiskit', engine.buildEncounterCreature(subjectDay('cat'), {}, 'calm', 'social')?.name === 'Whiskit');
check('baby day hatches Snuglet', engine.buildEncounterCreature(subjectDay('baby'), {}, 'calm', 'social')?.name === 'Snuglet');
check('snow day hatches Driftkin (rare)', (() => { const c = engine.buildEncounterCreature(subjectDay('snow'), {}, 'calm', 'energy'); return c?.name === 'Driftkin' && c?.rarity === 'rare'; })());
check('sunset day hatches Duskle', engine.buildEncounterCreature(subjectDay('sunset'), {}, 'calm', 'energy')?.name === 'Duskle');

// 8q. Wave A — activated place creatures hatch from their vision concept.
[
  ['pizza', 'Crustling'], ['sushi', 'Nigirimp'], ['ramen', 'Noodloo'], ['dessert', 'Sundael'],
  ['bubble_tea', 'Bobaloo'], ['bookstore', 'Pagelet'], ['basketball', 'Hooplet'],
  ['tennis', 'Serveling'], ['garden', 'Petalimp'], ['forest', 'Fernip'],
].forEach(([concept, name]) => {
  const creature = engine.buildEncounterCreature(subjectDay(concept), {}, 'calm', 'energy');
  check(`${concept} day hatches ${name}`, creature?.name === name, JSON.stringify(creature?.name));
});

// 8r. Wave B — moments & seasons; `flowers` reuses the live garden creature.
[
  ['rain', 'Drizzlet'], ['autumn', 'Amberleaf'], ['blossom', 'Blossle'], ['mountains', 'Peakle'],
  ['water', 'Stillo'], ['stars', 'Twinklet'], ['food', 'Feastle'], ['flowers', 'Petalimp'],
].forEach(([concept, name]) => {
  const creature = engine.buildEncounterCreature(subjectDay(concept), {}, 'calm', 'energy');
  check(`${concept} day hatches ${name}`, creature?.name === name, JSON.stringify(creature?.name));
});

// 8s. Wave C + capstone.
[
  ['creative', 'Museling'], ['focus_work', 'Tasklet'], ['celebration', 'Cheerlet'], ['travel', 'Voyagle'],
  ['city', 'Skylo'], ['gym', 'Flexel'],
].forEach(([concept, name]) => {
  const creature = engine.buildEncounterCreature(subjectDay(concept), {}, 'calm', 'energy');
  check(`${concept} day hatches ${name}`, creature?.name === name, JSON.stringify(creature?.name));
});

// 8n. A real run still outranks an incidental vision label (intensity ordering).
const runWithVisionDay = makeDay({
  stepsCount: 9800,
  exactRouteSegments: [{ id: 'r1', workoutId: 'w1', activityType: 'running', startedAt: '', endedAt: '', coordinates: [] }],
  vision: {
    concepts: [{ name: 'park', salience: 0.5, coverage: 0.5, count: 1, peakConfidence: 0.5 }],
    maxFaceCount: 0,
    faceCoverage: 0,
    textTokens: [],
    analyzedPhotoCount: 2,
  },
});
const runWithVisionCreature = engine.buildEncounterCreature(runWithVisionDay, {}, 'energy', 'focus');
check('run outranks incidental vision label', runWithVisionCreature?.name === 'Sprintail', JSON.stringify(runWithVisionCreature?.name));

// 9. History recording: increments once per day, idempotent for same day.
let h = engine.recordEncounterHatch({}, 'location_park_mossprout', '2026-06-12');
h = engine.recordEncounterHatch(h, 'location_park_mossprout', '2026-06-12');
check('history idempotent per day', h.location_park_mossprout.count === 1, JSON.stringify(h));
h = engine.recordEncounterHatch(h, 'location_park_mossprout', '2026-06-13');
check('history increments next day', h.location_park_mossprout.count === 2, JSON.stringify(h));

// --- Rarity-from-living and bond (the two-axis mechanic) ---
function makeLocation(lat, lng, capturedAt = '2026-06-12T10:00:00.000Z') {
  return {
    id: `loc-${lat}-${lng}`,
    lat,
    lng,
    capturedAt,
    type: 'unknown',
    hasPhoto: false,
    source: 'foreground',
    momentId: null,
  };
}

// Two points ~60m apart — a tight, stay-put cluster well inside the spread
// threshold the passive home read uses.
function makeStayPutLocation(index) {
  return makeLocation(40.0 + index * 0.0005, -74.0 + index * 0.0003, `2026-06-12T1${index}:00:00.000Z`);
}

// 10. An ordinary day is common, and bond starts at the first visit.
check('ordinary day is common', coffeeCreature?.rarity === 'common', String(coffeeCreature?.rarity));
check('rarity does not react to intensity', coffeeCreature?.rarityReason == null, String(coffeeCreature?.rarityReason));
check('first visit is bond stage 0', coffeeCreature?.bondStage === 0 && coffeeCreature?.bondVisitCount === 1,
  JSON.stringify({ stage: coffeeCreature?.bondStage, count: coffeeCreature?.bondVisitCount }));

// 11. Living conditions lift rarity above the species floor: a day whose map
// spans far past the usual edges makes even a cafe creature rare.
const farDay = makeDay({
  moments: [makeMoment('coffee', 0)],
  stepsCount: 1600,
  locations: [makeLocation(40.0, -74.0), makeLocation(40.5, -74.0)],
});
const farCreature = engine.buildEncounterCreature(farDay, {}, 'calm', 'energy');
check('far-from-routine day lifts rarity', farCreature?.rarity === 'rare', String(farCreature?.rarity));
check('rarity carries a living reason', /far/.test(farCreature?.rarityReason ?? ''), farCreature?.rarityReason);
check('living factors recorded', (farCreature?.livingFactors ?? []).includes('far_from_routine'),
  JSON.stringify(farCreature?.livingFactors));

// 12. New ground earns rarity and a reason of its own.
const newGroundDay = makeDay({ moments: [makeMoment('coffee', 0)], stepsCount: 1600, newPlaceCount: 2 });
const newGroundCreature = engine.buildEncounterCreature(newGroundDay, {}, 'calm', 'energy');
check('new places earn rarity', newGroundCreature?.rarity === 'rare', String(newGroundCreature?.rarity));
check('new-place reason mentions never', /never/.test(newGroundCreature?.rarityReason ?? ''), newGroundCreature?.rarityReason);

// 13. Bond is a separate axis: deep return history advances the stage while
// rarity stays put (the day itself was ordinary).
const deepHistory = { location_coffee_shop_baristabbit: { count: 30, lastSeenIsoDate: '2026-06-11' } };
const bondedCreature = engine.buildEncounterCreature(coffeeDay, deepHistory, 'calm', 'energy');
check('deep bond advances to stage 2', bondedCreature?.bondStage === 2 && bondedCreature?.bondVisitCount === 31,
  JSON.stringify({ stage: bondedCreature?.bondStage, count: bondedCreature?.bondVisitCount }));
check('bond does not change rarity', bondedCreature?.rarity === 'common', String(bondedCreature?.rarity));

// --- Hatch Your Past (onboarding reveal) ---
function pastDay(iso, overrides = {}) {
  return makeDay({ isoDate: iso, ...overrides });
}

// HP1. Repeat days bond into ONE creature with an accumulating visit count.
const repeatPast = hatchPast.buildHatchYourPast([
  pastDay('2026-06-10', { placeCategorySeeds: ['coffee_shop'] }),
  pastDay('2026-06-11', { placeCategorySeeds: ['coffee_shop'] }),
  pastDay('2026-06-12', { placeCategorySeeds: ['coffee_shop'] }),
]);
check('HP: repeat days bond into one creature', repeatPast.creatures.length === 1 && repeatPast.creatures[0].name === 'Baristabbit', JSON.stringify(repeatPast.creatures.map((c) => c.name)));
check('HP: bond visit count accumulates', repeatPast.creatures[0].visitCount === 3, String(repeatPast.creatures[0]?.visitCount));
check('HP: days hatched counted', repeatPast.daysHatched === 3, String(repeatPast.daysHatched));

// HP2. Varied days yield distinct creatures.
const variedPast = hatchPast.buildHatchYourPast([
  pastDay('2026-06-10', { placeCategorySeeds: ['coffee_shop'] }),
  pastDay('2026-06-11', { placeCategorySeeds: ['park'] }),
  pastDay('2026-06-12', { stepsCount: 9000 }),
]);
check('HP: varied days yield unique creatures', variedPast.creatures.length === 3, JSON.stringify(variedPast.creatures.map((c) => c.name)));

// HP3. No days → empty collection.
check('HP: no days yields empty collection', hatchPast.buildHatchYourPast([]).creatures.length === 0);

// HP4. Reveal is capped at 6.
const manyPast = hatchPast.buildHatchYourPast(
  ['coffee_shop', 'park', 'bakery', 'farm', 'library', 'museum', 'beach', 'cinema'].map((seed, index) =>
    pastDay(`2026-06-0${index + 1}`, { placeCategorySeeds: [seed] })
  )
);
check('HP: reveal capped at six', manyPast.creatures.length === 6, String(manyPast.creatures.length));

// HP5. The rarest creature is revealed last (the climax).
const rarePast = hatchPast.buildHatchYourPast([
  pastDay('2026-06-11', { placeCategorySeeds: ['coffee_shop'] }),
  pastDay('2026-06-12', { placeCategorySeeds: ['park'], newPlaceCount: 2 }),
]);
const climax = rarePast.creatures[rarePast.creatures.length - 1];
check('HP: rarer creature revealed last', climax.rarity !== 'common', JSON.stringify(rarePast.creatures.map((c) => ({ n: c.name, r: c.rarity }))));

console.log(failures === 0 ? '\nAll encounter-engine checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
