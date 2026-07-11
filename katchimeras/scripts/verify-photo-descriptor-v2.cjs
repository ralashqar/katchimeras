require('tsx/cjs');

const { buildPhotoClassifiedMemory, repairUrbanPhotoCentrality } = require('../utils/intelligence/classification.ts');
const { answerClarification, currentClarificationNode } = require('../utils/intelligence/clarification.ts');
const { buildPhotoIntelligence } = require('../utils/intelligence/photo-intelligence.ts');
const { shouldUpgradePassivePhoto } = require('../utils/intelligence/passive-photo-policy.ts');
const { evaluateQuestRuntime } = require('../utils/quests/runtime.ts');

let failures = 0;
function check(label, condition, detail) {
  if (condition) console.log(`  ok  ${label}`);
  else { failures += 1; console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`); }
}

function summary(concepts, overrides = {}) {
  return {
    concepts: concepts.map(([name, confidence]) => ({ name, salience: confidence, coverage: 1, count: 1, peakConfidence: confidence })),
    details: [], maxFaceCount: 0, faceCoverage: 0, textTokens: [], analyzedPhotoCount: 1,
    dominantSubjectCoverage: 0.42, documentCoverage: 0, ...overrides,
  };
}

const mixed = buildPhotoClassifiedMemory({
  sourceId: 'mixed', observedAt: '2026-07-10T12:00:00.000Z',
  vision: summary([['child', 0.92], ['sushi', 0.83], ['city', 0.8]], { maxFaceCount: 1 }),
  scene: { type: 'social', label: 'People', detail: 'A child', supportingSubjects: ['sushi', 'city skyline'], source: 'llm' },
});
const primarySubjects = mixed.photoAnalysis.subjects.filter((subject) => subject.role === 'primary');
check('descriptor v2 chooses exactly one dominant subject', primarySubjects.length === 1 && primarySubjects[0].canonicalValue === 'child');
check('mixed scene retains food and city as supporting subjects', mixed.photoAnalysis.subjects.some((subject) => subject.canonicalValue === 'sushi' && subject.role === 'supporting') && mixed.photoAnalysis.subjects.some((subject) => subject.canonicalValue === 'city' && subject.role === 'supporting'));
check('sensitive unresolved subject blocks inferred primary assignment', mixed.assignments.every((assignment) => assignment.role === 'supporting'));

const peopleNode = currentClarificationNode(mixed);
const notAboutPeople = peopleNode.options.find((option) => option.facetValue === 'incidental');
const replanned = answerClarification(mixed, peopleNode, notAboutPeople, new Date('2026-07-10T12:01:00.000Z'));
check('rejecting the dominant person replans to food', replanned.promptState.graphId === 'food-context' && currentClarificationNode(replanned)?.question === 'What was the food part?');
check('replanning promotes the next subject', replanned.photoAnalysis.subjects.find((subject) => subject.canonicalValue === 'sushi')?.role === 'primary');

const family = peopleNode.options.find((option) => option.id === 'family');
const familyStep = answerClarification(mixed, peopleNode, family, new Date('2026-07-10T12:01:00.000Z'));
const familyRoleNode = currentClarificationNode(familyStep);
const niece = familyRoleNode.options.find((option) => option.id === 'niece_nephew');
const afterRole = answerClarification(familyStep, familyRoleNode, niece, new Date('2026-07-10T12:02:00.000Z'));
check('resolved relationship does not trigger a supporting-subject questionnaire', afterRole.promptState.questionCount === 2 && afterRole.promptState.status === 'answered');
const mealNode = currentClarificationNode(replanned);
const meal = mealNode.options.find((option) => option.id === 'meal');
const mealMeaningStep = answerClarification(replanned, mealNode, meal, new Date('2026-07-10T12:02:00.000Z'));
const foodMeaningNode = currentClarificationNode(mealMeaningStep);
const shared = foodMeaningNode.options.find((option) => option.id === 'shared');
const capped = answerClarification(mealMeaningStep, foodMeaningNode, shared, new Date('2026-07-10T12:03:00.000Z'));
check('hierarchical clarification remains capped at three questions', capped.promptState.questionCount === 3 && capped.promptState.status === 'answered');

const book = buildPhotoClassifiedMemory({
  sourceId: 'book', observedAt: '2026-07-10T13:00:00.000Z',
  vision: summary([['book cover', 0.91], ['publication', 0.75]], { textTokens: ['NORWEGIAN WOOD'], documentCoverage: 1 }),
  scene: { type: 'media', label: 'Inspiration', detail: 'Norwegian Wood', media: { mediaType: 'book', title: 'Norwegian Wood', creator: 'Haruki Murakami' }, source: 'llm' },
});
check('prominent book cover becomes the dominant media subject', book.photoAnalysis.subjects.some((subject) => subject.canonicalValue === 'book' && subject.role === 'primary'));
check('book title is retained as a title candidate', book.photoAnalysis.selectedOcr.some((item) => item.text === 'NORWEGIAN WOOD' && item.purpose === 'title_candidate'));
const bookTypeQuestion = currentClarificationNode(book);
check('known book cover first asks Book once', bookTypeQuestion?.question === 'Is this a book?', bookTypeQuestion?.question);
const confirmedBookType = answerClarification(
  book,
  bookTypeQuestion,
  bookTypeQuestion.options.find((option) => option.id === 'confirm_book'),
  new Date('2026-07-10T13:01:00.000Z')
);
check('known media title is validated after Book', currentClarificationNode(confirmedBookType)?.question.includes('Norwegian Wood'));

const bookMisreadAsPlace = buildPhotoClassifiedMemory({
  sourceId: 'book-misread-as-place', observedAt: '2026-07-10T13:05:00.000Z',
  vision: summary([['book', 0.86], ['document', 0.78], ['wood processed', 0.42]], {
    details: ['book cover', 'document'],
    textTokens: ['THE PHENOMENAL INTERNATIONAL BESTSELLER', 'STEPHEN HAWKING', 'A BRIEF HISTORY OF TIME'],
    documentCoverage: 0.72,
    dominantSubjectCoverage: 0.48,
  }),
  scene: { memoryDomain: 'place', type: 'place', label: 'A place', detail: 'living room', source: 'llm', representation: 'real_world' },
});
check(
  'prominent book anchor overrides a generic place scene',
  bookMisreadAsPlace.dominantDomain === 'media' &&
    bookMisreadAsPlace.photoAnalysis.subjects.some((subject) => subject.canonicalValue === 'book' && subject.role === 'primary'),
  JSON.stringify({ domain: bookMisreadAsPlace.dominantDomain, subjects: bookMisreadAsPlace.photoAnalysis.subjects })
);
check(
  'book-place disagreement chooses the book prompt',
  bookMisreadAsPlace.promptState.graphId === 'media-context' && currentClarificationNode(bookMisreadAsPlace)?.question === 'Is this a book?',
  JSON.stringify(bookMisreadAsPlace.promptState)
);

const bookMisreadAsWork = buildPhotoClassifiedMemory({
  sourceId: 'book-misread-as-work', observedAt: '2026-07-10T13:06:00.000Z',
  vision: summary([['sign', 0.82], ['textile', 0.8], ['document', 0.78], ['book', 0.76]], {
    details: ['document', 'book'],
    textTokens: [],
    documentCoverage: 0.55,
    dominantSubjectCoverage: 0.45,
  }),
  scene: { memoryDomain: 'work', type: 'activity', label: 'An activity', detail: 'focus work', source: 'llm', representation: 'real_world' },
});
const workBookQuestion = currentClarificationNode(bookMisreadAsWork);
check(
  'document plus book outranks generic work without OCR',
  bookMisreadAsWork.dominantDomain === 'media' &&
    bookMisreadAsWork.promptState.graphId === 'media-context' &&
    workBookQuestion?.question === 'Is this a book?',
  JSON.stringify({ domain: bookMisreadAsWork.dominantDomain, prompt: bookMisreadAsWork.promptState, question: workBookQuestion?.question })
);
const workBookConfirmed = answerClarification(
  bookMisreadAsWork,
  workBookQuestion,
  workBookQuestion.options.find((option) => option.id === 'confirm_book'),
  new Date('2026-07-10T13:07:00.000Z')
);
check('user Book confirmation canonically overrides work', workBookConfirmed.dominantDomain === 'media');

const screen = buildPhotoIntelligence({
  sourceId: 'screen', observedAt: '2026-07-10T14:00:00.000Z',
  vision: summary([['gameplay', 0.9], ['egg', 0.8], ['city', 0.75]], { details: ['screen_content', 'video game'] }),
  scene: { type: 'media', label: 'Inspiration', detail: 'A video game', media: { mediaType: 'game', title: null, creator: null }, source: 'rules' },
});
check('screen representation is retained in descriptor', screen.memory.photoAnalysis.representation.kind === 'screen_content');
check('screen content cannot create physical city or food qualities', !screen.memory.qualities.some((quality) => quality.qualityId === 'place.city' || quality.qualityId === 'subject.food'));

check('document photos qualify for passive Foundation upgrade', shouldUpgradePassivePhoto(summary([['book cover', 0.8]], { documentCoverage: 1 })));
check('ambiguous domains qualify for passive Foundation upgrade', shouldUpgradePassivePhoto(summary([['city', 0.7], ['food', 0.62]])));

const skyline = buildPhotoIntelligence({
  sourceId: 'skyline', observedAt: '2026-07-10T20:27:17.000Z',
  vision: summary([['city', 0.793], ['blue sky', 0.576], ['land', 0.569], ['grass', 0.569], ['apartment', 0.343]], {
    details: ['skyscraper', 'blue sky', 'land', 'grass', 'apartment'],
    representation: { kind: 'real_world', confidence: 0.88, reasons: ['Captured with the in-app camera'] },
  }),
  scene: { type: 'place', label: 'A place', detail: 'city', source: 'rules' },
});
const skylineCityQuality = skyline.memory.qualities.find((quality) => quality.qualityId === 'place.city');
check('strong skyline makes city the primary subject', skyline.memory.photoAnalysis.subjects.find((subject) => subject.canonicalValue === 'city')?.role === 'primary', JSON.stringify(skyline.memory.photoAnalysis.subjects));
check('primary Apple Vision city reaches the ready threshold', skylineCityQuality?.score >= 0.72 && skylineCityQuality?.centrality === 'primary', JSON.stringify(skylineCityQuality));
const skylineQuest = evaluateQuestRuntime({ questId: 'quest-photo-city', facts: { 'memory.qualities': [skyline.evidence] } });
check('Skylo accepts the captured skyline regression case', skylineQuest.readyToSubmit, JSON.stringify(skylineQuest));

const legacySkyline = buildPhotoClassifiedMemory({
  sourceId: 'legacy-skyline', observedAt: '2026-07-10T20:27:17.000Z',
  vision: summary([['city', 0.793], ['blue sky', 0.576], ['land', 0.569], ['grass', 0.569], ['apartment', 0.343]]),
  scene: { type: 'nature', label: 'Out in nature', source: 'rules' },
});
const repairedSkyline = repairUrbanPhotoCentrality(legacySkyline);
const repairedCityQuality = repairedSkyline.qualities.find((quality) => quality.qualityId === 'place.city');
check('stored skyline memories are repaired without another capture', repairedSkyline.dominantDomain === 'place' && repairedCityQuality?.centrality === 'primary' && repairedCityQuality?.score >= 0.72, JSON.stringify(repairedSkyline));

const supportingCity = buildPhotoIntelligence({
  sourceId: 'city-beside-nature', observedAt: '2026-07-10T20:30:00.000Z',
  vision: summary([['blue sky', 0.86], ['city', 0.8], ['grass', 0.7]]),
  scene: { type: 'nature', label: 'Out in nature', detail: 'blue sky', source: 'rules' },
});
const supportingCityQuality = supportingCity.memory.qualities.find((quality) => quality.qualityId === 'place.city');
check('supporting subjects retain independent presence confidence', supportingCityQuality?.centrality === 'supporting' && supportingCityQuality?.score >= 0.72, JSON.stringify(supportingCityQuality));
const supportingCityQuest = evaluateQuestRuntime({ questId: 'quest-photo-city', facts: { 'memory.qualities': [supportingCity.evidence] } });
check('quest can accept a clear supporting subject without making it dominant', supportingCityQuest.readyToSubmit, JSON.stringify(supportingCityQuest));

function qualityEvidence(centrality) {
  return [{ id: `photo:city-${centrality}`, sourceType: 'photo', sourceId: `city-${centrality}`, observedAt: '2026-07-10T12:00:00.000Z', provider: 'appleVision', confidence: 0.9, signals: [{ key: 'place.city', confidence: 0.9, provider: 'appleVision', source: 'aggregate', centrality }] }];
}
const incidentalQuest = evaluateQuestRuntime({ questId: 'quest-photo-city', facts: { 'memory.qualities': qualityEvidence('incidental') } });
const supportingQuest = evaluateQuestRuntime({ questId: 'quest-photo-city', facts: { 'memory.qualities': qualityEvidence('supporting') } });
check('incidental city evidence cannot satisfy a supporting-centrality quest', !incidentalQuest.readyToSubmit);
check('supporting city evidence can become ready for explicit submission', supportingQuest.readyToSubmit && !supportingQuest.complete);

console.log(failures ? `\n${failures} descriptor-v2 check(s) FAILED.` : '\nAll descriptor-v2 checks passed.');
process.exit(failures ? 1 : 0);
