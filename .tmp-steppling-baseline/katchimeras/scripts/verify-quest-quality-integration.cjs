require('tsx/cjs');

const { buildPhotoIntelligence } = require('../utils/intelligence/photo-intelligence.ts');
const { withQualityConfirmation } = require('../utils/intelligence/classification.ts');
const { questDefinition } = require('../utils/quests/definitions.ts');
const { evaluateQuestRuntime } = require('../utils/quests/runtime.ts');
const { resolveFactsForDay } = require('../utils/signals/resolve.ts');
const { refreshQuestFacts } = require('../utils/quests/facts.ts');

let failures = 0;
function check(label, condition, detail) {
  if (condition) console.log(`  ok  ${label}`);
  else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

function photoVision(details = []) {
  return {
    concepts: [{ name: 'architecture', salience: 1, coverage: 1, count: 1, peakConfidence: 0.8 }],
    details,
    maxFaceCount: 0,
    faceCoverage: 0,
    textTokens: [],
    analyzedPhotoCount: 1,
  };
}

function cityVision(details = []) {
  const vision = photoVision(details);
  return { ...vision, concepts: [...vision.concepts, { name: 'city skyline', salience: 0.86, coverage: 1, count: 1, peakConfidence: 0.86 }] };
}

function dayFor(intelligence) {
  return {
    id: 'day-2026-07-10',
    isoDate: '2026-07-10',
    state: 'forming',
    moments: [],
    evidence: [intelligence.evidence],
    classifiedMemories: [intelligence.memory],
  };
}

const cityQuest = questDefinition('quest-photo-city');
check('Skylo city quest uses the canonical quality fact', cityQuest?.criteria[0]?.fact === 'memory.qualities');
check('Skylo city quest requests place.city', cityQuest?.criteria[0]?.value === 'place.city');

const city = buildPhotoIntelligence({
  sourceId: 'city-high',
  observedAt: '2026-07-10T12:00:00.000Z',
  thumbnailUri: 'file://city-high.jpg',
  vision: cityVision(),
  scene: { type: 'place', label: 'City', detail: 'a city skyline', source: 'llm' },
});
check('visually corroborated Foundation scene detail survives as place.city', city.memory.qualities.some((quality) => quality.qualityId === 'place.city'));
const ready = evaluateQuestRuntime({
  questId: 'quest-photo-city',
  day: dayFor(city),
  facts: resolveFactsForDay(dayFor(city)),
});
check('high-confidence Today photo is ready in quest UI', ready.readyToSubmit && ready.matchedEvidenceIds.includes('photo:city-high'));
check('matching a photo never auto-completes the quest', ready.complete === false && ready.submissionMode === 'manual');

const staleFacts = resolveFactsForDay({ ...dayFor(city), evidence: [], classifiedMemories: [] });
const staleRuntime = evaluateQuestRuntime({
  questId: 'quest-photo-city',
  day: dayFor(city),
  facts: staleFacts,
});
check('pre-capture fact snapshot does not contain the new city photo', !staleRuntime.readyToSubmit);
const refreshedRuntime = evaluateQuestRuntime({
  questId: 'quest-photo-city',
  day: dayFor(city),
  facts: refreshQuestFacts(staleFacts, dayFor(city)),
});
check(
  'quest return refreshes stale facts from the persisted classified photo',
  refreshedRuntime.readyToSubmit && refreshedRuntime.matchedEvidenceIds.includes('photo:city-high')
);

const mediumMemory = {
  ...city.memory,
  sourceId: 'city-medium',
  id: 'classified:photo:city-medium',
  qualities: city.memory.qualities.map((quality) => quality.qualityId === 'place.city' ? { ...quality, score: 0.55 } : quality),
};
const medium = {
  memory: mediumMemory,
  evidence: { ...city.evidence, id: 'photo:city-medium', sourceId: 'city-medium', thumbnailUri: 'file://city-medium.jpg' },
};
const possible = evaluateQuestRuntime({
  questId: 'quest-photo-city',
  day: dayFor(medium),
  facts: resolveFactsForDay(dayFor(medium)),
});
check('medium-confidence Today photo is a possible match', !possible.readyToSubmit && possible.possibleEvidenceIds.includes('photo:city-medium'));

const confirmedMemory = withQualityConfirmation(mediumMemory, 'place.city', true, new Date('2026-07-10T12:01:00.000Z'));
const confirmedDay = dayFor({ ...medium, memory: confirmedMemory });
const confirmed = evaluateQuestRuntime({
  questId: 'quest-photo-city',
  day: confirmedDay,
  facts: resolveFactsForDay(confirmedDay),
});
check('quest-UI confirmation promotes supported evidence to ready', confirmed.readyToSubmit && confirmed.matchedEvidenceIds.includes('photo:city-medium'));

const screen = buildPhotoIntelligence({
  sourceId: 'city-screen',
  observedAt: '2026-07-10T13:00:00.000Z',
  vision: cityVision(['screen_content']),
  scene: { type: 'place', label: 'City', detail: 'a city skyline', source: 'llm' },
});
check('screen content cannot satisfy a physical city quality', !screen.memory.qualities.some((quality) => quality.qualityId === 'place.city'));

console.log(failures ? `\n${failures} quest-quality check(s) FAILED.` : '\nAll quest-quality integration checks passed.');
process.exit(failures ? 1 : 0);
