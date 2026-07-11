const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-classification-'));
function transpile(source, name) {
  const output = ts.transpileModule(fs.readFileSync(path.join(root, source), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const target = path.join(temp, name);
  fs.writeFileSync(target, output);
  return target;
}

const taxonomyPath = transpile('utils/intelligence/taxonomy.ts', 'taxonomy.js');
const foodDetectPath = transpile('utils/food-detect.ts', 'food-detect.js');
const studioDetectPath = transpile('utils/studio-detect.ts', 'studio-detect.js');
const photoRealityPath = transpile('utils/photo-reality.ts', 'photo-reality.js');
const peopleDetectPath = transpile('utils/people-detect.ts', 'people-detect.js');
const classificationPolicyPath = transpile('utils/intelligence/classification-policy.ts', 'classification-policy.js');
const qualityRegistryPath = transpile('utils/intelligence/quality-registry.ts', 'quality-registry.js');
const photoDescriptorPath = transpile('utils/intelligence/photo-descriptor.ts', 'photo-descriptor.js');
const classificationPath = transpile('utils/intelligence/classification.ts', 'classification.js');
const clarificationPath = transpile('utils/intelligence/clarification.ts', 'clarification.js');
const promptPlannerPath = transpile('utils/intelligence/prompt-planner.ts', 'prompt-planner.js');
const stubs = {
  '@/types/home': path.join(temp, 'types.js'),
  '@/utils/intelligence/taxonomy': taxonomyPath,
  '@/utils/intelligence/classification': classificationPath,
  '@/utils/intelligence/classification-policy': classificationPolicyPath,
  '@/utils/food-detect': foodDetectPath,
  '@/utils/studio-detect': studioDetectPath,
  '@/utils/photo-reality': photoRealityPath,
  '@/utils/people-detect': peopleDetectPath,
  '@/utils/intelligence/quality-registry': qualityRegistryPath,
  '@/utils/intelligence/photo-descriptor': photoDescriptorPath,
  '@/data/intelligence/memory-qualities.json': path.join(root, 'data/intelligence/memory-qualities.json'),
};
fs.writeFileSync(stubs['@/types/home'], '');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request === './quality-registry') return qualityRegistryPath;
  if (request === './photo-descriptor') return photoDescriptorPath;
  return request in stubs ? stubs[request] : resolve.call(this, request, ...args);
};

const classification = require(classificationPath);
const clarification = require(clarificationPath);
const promptPlanner = require(promptPlannerPath);
const classificationPolicy = require(classificationPolicyPath);
const studioDetect = require(studioDetectPath);
let failures = 0;
function check(name, condition, detail) {
  if (condition) console.log(`  ok  ${name}`);
  else { failures += 1; console.log(`FAIL  ${name}${detail ? ` -- ${detail}` : ''}`); }
}
function summary(concepts, faces = 0) {
  return {
    concepts: concepts.map((name) => ({ name, salience: 1, coverage: 1, count: 1, peakConfidence: 0.82 })),
    details: [], maxFaceCount: faces, faceCoverage: faces ? 1 : 0, textTokens: [], analyzedPhotoCount: 1,
  };
}

const dog = classification.buildPhotoClassifiedMemory({
  sourceId: 'dog', observedAt: '2026-07-10T12:00:00.000Z', vision: summary(['dog']),
  scene: { type: 'pet', label: 'A furry friend', source: 'rules' },
});
check('dog ownership stays pending', dog.promptState.graphId === 'animal-relationship');
check('unconfirmed dog does not assign Waglet', !dog.assignments.some((item) => item.seedId === 'dog_companion'));
const dogRoot = clarification.currentClarificationNode(dog);
const myPet = dogRoot.options.find((item) => item.id === 'my_pet');
const dogConfirmed = clarification.answerClarification(dog, dogRoot, myPet, new Date('2026-07-10T12:01:00.000Z'));
check('confirmed pet assigns Waglet', dogConfirmed.assignments.some((item) => item.seedId === 'dog_companion' && item.confirmed));
const rememberedPet = classification.rememberPersonalContext([], dogConfirmed, new Date('2026-07-10T12:02:00.000Z'));
check('confirmed pet creates local personal context', rememberedPet.entities[0]?.kind === 'pet' && rememberedPet.memory.entityIds[0] === rememberedPet.entities[0].id);

const film = classification.buildNoteClassifiedMemory({
  noteId: 'film', kind: 'text', observedAt: '2026-07-10T13:00:00.000Z', text: 'Watched a film',
  provider: 'appleFoundation', mediaType: 'film',
});
check('film note assigns Flickerbun', film.assignments[0]?.seedId === 'cinema', JSON.stringify(film.assignments));
const watchedFootball = studioDetect.detectStudioInText('I watched the football game tonight');
check('watched football is retained as other media', watchedFootball.detected && watchedFootball.mediaType === 'other' && /football/i.test(watchedFootball.label), JSON.stringify(watchedFootball));
check('watching a child play football is not misfiled as media', studioDetect.detectStudioInText('I watched my son play football').detected === false);
check('watched news is retained as other media', studioDetect.detectStudioInText('Watched the news after dinner').mediaType === 'other');
check('listened-to podcast is retained as other media', studioDetect.detectStudioInText('I listened to a podcast on the train').mediaType === 'other');
const footballNote = classification.buildNoteClassifiedMemory({
  noteId: 'football-note', kind: 'text', observedAt: '2026-07-10T13:05:00.000Z', text: 'I watched the football game tonight',
  provider: 'deterministic', mediaType: watchedFootball.mediaType,
});
check('other-media note remains in the media domain', footballNote.dominantDomain === 'media');
check('other-media classified memory can create a Studio record', classificationPolicy.studioDetectionForClassifiedMemory(footballNote).detected === true);
const rejectedFilm = classification.withMemoryConfirmation(
  film,
  { promptId: 'media-context.root', optionId: 'not_media', label: 'Not media', facetKey: 'media_type', facetValue: 'other', createdAt: '2026-07-10T13:00:01.000Z' },
  'root', null
);
check('not-media removes Flickerbun assignment', !rejectedFilm.assignments.some((item) => item.seedId === 'cinema'));
check('not-media suppresses Studio suggestions', classificationPolicy.acceptedStudioDetection({ classifiedMemories: [rejectedFilm], vision: summary(['cinema']) }).detected === false);

const meal = classification.buildNoteClassifiedMemory({
  noteId: 'meal', kind: 'voice', observedAt: '2026-07-10T14:00:00.000Z', text: 'A lovely dinner',
  provider: 'appleFoundation', food: 'dinner',
});
check('food note assigns Feastle', meal.assignments[0]?.seedId === 'feast', JSON.stringify(meal.assignments));

const dessert = classification.buildPhotoClassifiedMemory({
  sourceId: 'dessert-photo', observedAt: '2026-07-10T14:05:00.000Z', vision: summary(['dessert']),
  scene: { type: 'food', label: 'Food', source: 'rules', food: { detected: true, label: 'Dessert', emoji: 'dessert' } },
});
const dessertNode = clarification.currentClarificationNode(dessert);
const notFood = dessertNode.options.find((item) => item.id === 'incidental');
const rejectedDessert = clarification.answerClarification(dessert, dessertNode, notFood, new Date('2026-07-10T14:05:01.000Z'));
check('not-about-food removes every food assignment', !rejectedDessert.assignments.some((item) => ['feast', 'dessert_shop'].includes(item.seedId)), JSON.stringify(rejectedDessert.assignments));
check('legacy stale assignments are filtered at consumption', classification.assignmentSignals([{ ...rejectedDessert, assignments: [{ seedId: 'dessert_shop', role: 'primary', score: 0.9, reasons: ['legacy'], confirmed: false }] }]).length === 0);
check('not-about-food changes the dominant domain', rejectedDessert.dominantDomain === 'other', rejectedDessert.dominantDomain);
check('rejected dessert is not suggested from aggregate Vision', classificationPolicy.acceptedFoodDetection({ classifiedMemories: [rejectedDessert], vision: summary(['dessert']) }).detected === false);
check('rejected dessert is hidden from semantic Vision consumers', classificationPolicy.visionSignalIsRejected({ classifiedMemories: [rejectedDessert] }, 'dessert') === true);
const prunedDessert = classificationPolicy.pruneRejectedDerivedMoments({
  foodMoments: [{ id: 'food-1', label: 'Dessert', emoji: 'dessert', meaning: 'treat', source: 'photo', sourceId: 'dessert-photo', createdAt: '2026-07-10T14:05:00.000Z' }],
  studioMoments: [],
}, rejectedDessert);
check('rejecting food removes its derived auto record', prunedDessert.foodMoments.length === 0);

const mealAtCinema = classification.buildPhotoClassifiedMemory({
  sourceId: 'meal-at-cinema', observedAt: '2026-07-10T14:10:00.000Z', vision: summary(['food', 'cinema']),
  scene: {
    type: 'food', label: 'Food', source: 'llm', food: { detected: true, label: 'Dinner' },
    media: { mediaType: 'film', title: 'A film', creator: null },
  },
});
check('meal at cinema makes Feastle primary', mealAtCinema.assignments[0]?.seedId === 'feast' && mealAtCinema.assignments[0]?.role === 'primary', JSON.stringify(mealAtCinema.assignments));
check('meal at cinema keeps Flickerbun supporting', mealAtCinema.assignments.some((item) => item.seedId === 'cinema' && item.role === 'supporting'), JSON.stringify(mealAtCinema.assignments));

const posterWithFood = classification.buildPhotoClassifiedMemory({
  sourceId: 'poster-with-food', observedAt: '2026-07-10T14:20:00.000Z', vision: summary(['food', 'cinema']),
  scene: {
    type: 'media', label: 'An inspiration', source: 'llm', food: { detected: true, label: 'Dinner' },
    media: { mediaType: 'film', title: 'A film', creator: null },
  },
});
check('movie poster makes Flickerbun primary', posterWithFood.assignments[0]?.seedId === 'cinema' && posterWithFood.assignments[0]?.role === 'primary', JSON.stringify(posterWithFood.assignments));
check('movie poster keeps Feastle supporting', posterWithFood.assignments.some((item) => item.seedId === 'feast' && item.role === 'supporting'), JSON.stringify(posterWithFood.assignments));

const correctedMedia = classification.withMemoryConfirmation(
  film,
  {
    promptId: 'media-context.root', optionId: 'game', label: 'Game', facetKey: 'media_type', facetValue: 'game',
    createdAt: '2026-07-10T13:01:00.000Z',
  },
  'root',
  null
);
const reloadedCorrection = JSON.parse(JSON.stringify(correctedMedia));
check('user correction overrides provider and survives reload', reloadedCorrection.assignments[0]?.seedId === 'gaming_session' && reloadedCorrection.assignments[0]?.confirmed, JSON.stringify(reloadedCorrection.assignments));

const documentBook = classification.buildPhotoClassifiedMemory({
  sourceId: 'document-book',
  observedAt: '2026-07-10T13:30:00.000Z',
  vision: { ...summary(['document', 'book']), details: ['book cover'], textTokens: [] },
  scene: { type: 'document', label: 'Something noted', detail: 'Book cover', source: 'rules' },
});
const documentBookRoot = clarification.currentClarificationNode(documentBook);
const documentBookAnswer = clarification.answerClarification(
  documentBook,
  documentBookRoot,
  documentBookRoot.options.find((item) => item.id === 'book' || item.id === 'confirm_book'),
  new Date('2026-07-10T13:31:00.000Z')
);
check('choosing Book in document flow does not ask the media type again', clarification.currentClarificationNode(documentBookAnswer)?.question === 'How did it land?', clarification.currentClarificationNode(documentBookAnswer)?.question);
const unnamedOcrBook = classification.buildPhotoClassifiedMemory({
  sourceId: 'ocr-only-book',
  observedAt: '2026-07-10T13:30:30.000Z',
  vision: { ...summary(['blue sky']), textTokens: ['INTERNAfioNAL 8ESTSELLER', 'STEPHEN', 'HAWKING', 'BRIFF', 'STO', 'TIME'] },
  scene: { type: 'media', label: 'An inspiration', source: 'rules', media: { mediaType: 'book', title: null, creator: null } },
});
check('unnamed OCR book asks for book confirmation', clarification.currentClarificationNode(unnamedOcrBook)?.question === 'Is this a book?', clarification.currentClarificationNode(unnamedOcrBook)?.question);
const signLabelledCover = classification.buildPhotoClassifiedMemory({
  sourceId: 'sign-labelled-cover',
  observedAt: '2026-07-11T00:13:55.594Z',
  rawVision: {
    labels: [{ name: 'structure', confidence: 0.41 }, { name: 'sign', confidence: 0.41 }],
    text: ['THE PHENOMENAL', 'INTERNATIONAL BESTSELLER', 'STEPHEN', 'HAWKING', 'A BRIEF', 'HISTORY', 'OF TIME', 'FROM THE BIG BANG', 'TO BLACK HOLES'],
    recognizedText: [], faceCount: 0, dominantSubject: { x: 0.09, y: 0.28, width: 0.66, height: 0.61, confidence: 0.69 },
  },
  vision: {
    ...summary(['sign']),
    concepts: [{ name: 'sign', salience: 0.41, coverage: 1, count: 1, peakConfidence: 0.41 }],
    details: ['sign'],
    textTokens: ['THE PHENOMENAL', 'INTERNATIONAL BESTSELLER', 'STEPHEN', 'HAWKING', 'A BRIEF', 'HISTORY', 'OF TIME', 'FROM THE BIG BANG', 'TO BLACK HOLES'],
    dominantSubjectCoverage: 0.4,
  },
  scene: { memoryDomain: 'place', type: 'place', label: 'A place', detail: 'bookstore', source: 'llm', supportingSubjects: ['sign'], representation: 'real_world' },
});
check('salient OCR book cover outranks an inferred bookstore place', signLabelledCover.dominantDomain === 'media', signLabelledCover.dominantDomain);
check('OCR-only cover becomes a first-class book subject', signLabelledCover.photoAnalysis?.subjects.some((item) => item.canonicalValue === 'book' && item.role === 'primary'), JSON.stringify(signLabelledCover.photoAnalysis?.subjects));
check('OCR-only cover retains its recovered title', signLabelledCover.facets.some((item) => item.key === 'media_title' && /brief history of time/i.test(item.value)), JSON.stringify(signLabelledCover.facets));
check('OCR-only cover asks for book confirmation, not place purpose', clarification.currentClarificationNode(signLabelledCover)?.question === 'Is this a book?', clarification.currentClarificationNode(signLabelledCover)?.question);
const distantBrianBook = classification.buildPhotoClassifiedMemory({
  sourceId: 'distant-brian-book',
  observedAt: '2026-07-11T00:20:00.000Z',
  vision: {
    ...summary(['book', 'park']),
    textTokens: ['BRIAN'],
    dominantSubjectCoverage: 0.42,
  },
  scene: { memoryDomain: 'place', type: 'place', label: 'A place', detail: 'park', source: 'llm', representation: 'real_world' },
});
check('a titled background book cannot replace the central place', distantBrianBook.dominantDomain === 'place', distantBrianBook.dominantDomain);
check('a background book cannot create an automatic Studio detection', classificationPolicy.studioDetectionForClassifiedMemory(distantBrianBook).detected === false);
const staleBrianMoment = { id: 'brian', label: 'Brian', mediaType: 'book', emoji: 'book', rating: 'liked', source: 'photo', sourceId: 'distant-brian-book', createdAt: distantBrianBook.createdAt };
const brianDay = classificationPolicy.pruneRejectedDerivedMoments({ foodMoments: [], studioMoments: [staleBrianMoment] }, distantBrianBook);
check('normalization removes a stale source-linked Brian Studio moment', brianDay.studioMoments.length === 0);
const titledDocumentBook = {
  ...documentBook,
  facets: [...documentBook.facets, { key: 'media_title', value: 'The Left Hand of Darkness', confidence: 0.78, sensitive: false, confirmed: false }],
};
const titledBookQuestion = clarification.currentClarificationNode(titledDocumentBook);
check(
  'prominent OCR cover asks whether it is a book once',
  titledBookQuestion?.question === 'Is this a book?' && titledBookQuestion?.options.some((item) => item.id === 'confirm_book'),
  titledBookQuestion?.question
);
const titledBookTypeAnswer = clarification.answerClarification(
  titledDocumentBook,
  titledBookQuestion,
  titledBookQuestion.options.find((item) => item.id === 'confirm_book'),
  new Date('2026-07-10T13:31:00.000Z')
);
const titleConfirmationQuestion = clarification.currentClarificationNode(titledBookTypeAnswer);
check('accepting Book advances to OCR title validation', titleConfirmationQuestion?.question.includes('The Left Hand of Darkness'), titleConfirmationQuestion?.question);
const titledBookAnswer = clarification.answerClarification(
  titledBookTypeAnswer,
  titleConfirmationQuestion,
  titleConfirmationQuestion.options.find((item) => item.id === 'confirm_title'),
  new Date('2026-07-10T13:32:00.000Z')
);
const titledBookReaction = clarification.currentClarificationNode(titledBookAnswer);
check('confirmed title names the reaction question', titledBookReaction?.question.includes('The Left Hand of Darkness'), titledBookReaction?.question);
const completedTitledBook = clarification.answerClarification(
  titledBookAnswer,
  titledBookReaction,
  titledBookReaction.options.find((item) => item.id === 'loved'),
  new Date('2026-07-10T13:33:00.000Z')
);
const savedBookMoment = {
  id: 'studio-book', label: 'The Left Hand of Darkness', mediaType: 'book', emoji: 'book', rating: 'loved',
  source: 'photo', sourceId: completedTitledBook.sourceId, createdAt: completedTitledBook.createdAt,
};
check(
  'in-photo book reaction suppresses the duplicate post-save follow-up',
  classificationPolicy.derivedMomentHasConfirmedFacet(savedBookMoment, [completedTitledBook], 'media_rating') === true
);
check(
  'a different photo with the same book title remains eligible for clarification',
  classificationPolicy.derivedMomentHasConfirmedFacet({ ...savedBookMoment, sourceId: 'another-photo' }, [completedTitledBook], 'media_rating') === false
);

const televisionMemory = classification.buildPhotoClassifiedMemory({
  sourceId: 'football-tv',
  observedAt: '2026-07-10T13:40:00.000Z',
  vision: summary(['television', 'consumer electronics', 'machine']),
  scene: { type: 'media', label: 'An inspiration', source: 'rules', media: { mediaType: 'show', title: null, creator: null } },
});
const televisionQuestion = clarification.currentClarificationNode(televisionMemory);
check('television gets a watching question instead of a work question', televisionQuestion?.question === 'What were you watching?', televisionQuestion?.question);
check(
  'television question offers generic live sport without assuming football',
  televisionQuestion?.options.some((item) => item.id === 'live_sport' && item.label === 'Live sport') &&
    !televisionQuestion?.options.some((item) => /football/i.test(item.label)),
  JSON.stringify(televisionQuestion?.options)
);

const foundationShow = classification.buildPhotoClassifiedMemory({
  sourceId: 'foundation-show',
  observedAt: '2026-07-10T13:41:00.000Z',
  vision: summary(['television', 'consumer electronics']),
  scene: { type: 'media', label: 'An inspiration', detail: 'a television programme', source: 'llm', media: { mediaType: 'show', title: null, creator: null } },
});
check(
  'Foundation-known media type skips redundant watching classification',
  clarification.currentClarificationNode(foundationShow)?.question === 'How did it land?',
  clarification.currentClarificationNode(foundationShow)?.question
);

const cityWithIncidentalTelevision = classification.buildPhotoClassifiedMemory({
  sourceId: 'city-with-incidental-tv',
  observedAt: '2026-07-10T13:41:30.000Z',
  vision: summary(['city', 'stars', 'television']),
  scene: { memoryDomain: 'place', type: 'place', label: 'A place', detail: 'cityscape', source: 'llm', representation: 'real_world' },
});
check(
  'incidental television label cannot override Foundation city prompt',
  cityWithIncidentalTelevision.promptState.graphId === 'place-context' && clarification.currentClarificationNode(cityWithIncidentalTelevision)?.question !== 'What were you watching?',
  JSON.stringify(cityWithIncidentalTelevision.promptState)
);

const televisedAdult = classification.buildPhotoClassifiedMemory({
  sourceId: 'adult-on-tv',
  observedAt: '2026-07-10T13:42:00.000Z',
  rawVision: {
    labels: [
      { name: 'people', confidence: 0.9 },
      { name: 'adult', confidence: 0.9 },
      { name: 'computer_monitor', confidence: 0.64 },
      { name: 'television', confidence: 0.55 },
    ],
    text: ['iJi'], faceCount: 1, humanCount: 0, animals: [], humans: [], faces: [],
    recognizedText: [], dominantSubject: null, documentDetected: false, captureSource: 'camera',
  },
  vision: summary(['adult', 'focus_work', 'television'], 1),
  scene: { type: 'screen', label: 'On a screen', source: 'rules' },
});
const televisedAdultQuestion = clarification.currentClarificationNode(televisedAdult);
check('a face depicted on television does not become a relationship facet', !televisedAdult.facets.some((item) => item.key === 'people_present' || item.key === 'person_subject'), JSON.stringify(televisedAdult.facets));
check('television outranks generic adult and work labels', televisedAdult.dominantDomain === 'media' && televisedAdult.photoAnalysis?.subjects.find((item) => item.role === 'primary')?.canonicalValue === 'television', JSON.stringify(televisedAdult.photoAnalysis));
check('adult on television asks what was watched', televisedAdultQuestion?.question === 'What were you watching?', televisedAdultQuestion?.question);

const movement = classification.buildMovementClassifiedMemory({
  sourceId: 'today', observedAt: '2026-07-10T18:00:00.000Z', movement: 'transit', subtype: 'train',
});
check('confirmed transit assigns Signalhop seed', movement.assignments[0]?.seedId === 'transit_commute');

const people = classification.buildPhotoClassifiedMemory({
  sourceId: 'people', observedAt: '2026-07-10T15:00:00.000Z', vision: summary(['child'], 1),
  scene: { type: 'social', label: 'Time with people', source: 'rules' },
});
const peopleRoot = clarification.currentClarificationNode(people);
const child = peopleRoot.options.find((item) => item.id === 'my_child');
const childStep = clarification.answerClarification(people, peopleRoot, child, new Date('2026-07-10T15:01:00.000Z'));
check('my child requires role follow-up', childStep.promptState.currentNodeId === 'child-role');
const roleNode = clarification.currentClarificationNode(childStep);
const privateRole = roleNode.options.find((item) => item.id === 'private');
const parented = clarification.answerClarification(childStep, roleNode, privateRole, new Date('2026-07-10T15:02:00.000Z'));
check('parent confirmation assigns Nestkin', parented.assignments.some((item) => item.seedId === 'parenting_care' && item.confirmed));
check('graph ends within two answers', parented.promptState.status === 'answered' && parented.promptState.answeredNodeIds.length === 2);

const adultPerson = classification.buildPhotoClassifiedMemory({
  sourceId: 'adult-person', observedAt: '2026-07-10T15:05:00.000Z', vision: summary(['adult', 'person'], 1),
  scene: { type: 'social', label: 'Time with people', source: 'rules' },
});
const adultPersonRoot = clarification.currentClarificationNode(adultPerson);
check('generic real-world person still offers My child', adultPersonRoot.options.some((item) => item.id === 'my_child'), JSON.stringify(adultPersonRoot.options));

const prominentChild = classification.buildPhotoClassifiedMemory({
  sourceId: 'prominent-child', observedAt: '2026-07-10T15:10:00.000Z', vision: summary(['child', 'dessert'], 1),
  // Deliberately simulate a generic competing food read: prominence-aware
  // classification must still choose the specific relationship question.
  scene: { type: 'food', label: 'Food', source: 'rules', food: { detected: true, label: 'Dessert' } },
});
check('prominent child activates people clarification despite generic food', prominentChild.dominantDomain === 'people' && prominentChild.promptState.graphId === 'people-relationship', JSON.stringify(prominentChild));
const prominentChildRoot = clarification.currentClarificationNode(prominentChild);
check('prominent child gets the specific question', prominentChildRoot.question === 'Who is this child to you?', prominentChildRoot.question);
check('child root offers family and friend paths', prominentChildRoot.options.some((item) => item.id === 'family') && prominentChildRoot.options.some((item) => item.id === 'friends'));
const childFamilyStep = clarification.answerClarification(
  prominentChild,
  prominentChildRoot,
  prominentChildRoot.options.find((item) => item.id === 'family'),
  new Date('2026-07-10T15:11:00.000Z')
);
check('child family path asks for the family role', clarification.currentClarificationNode(childFamilyStep)?.id === 'young-family-role');
const childFamilyRole = clarification.currentClarificationNode(childFamilyStep);
check('child family fallback includes son and daughter', childFamilyRole.options.some((item) => item.id === 'son') && childFamilyRole.options.some((item) => item.id === 'daughter'), JSON.stringify(childFamilyRole.options));
const completedSonFallback = clarification.answerClarification(
  childFamilyStep,
  childFamilyRole,
  childFamilyRole.options.find((item) => item.id === 'son'),
  new Date('2026-07-10T15:12:00.000Z')
);
check('choosing My son through Family still assigns parenting care', completedSonFallback.assignments.some((item) => item.seedId === 'parenting_care' && item.confirmed), JSON.stringify(completedSonFallback.assignments));
const completedChildFamily = clarification.answerClarification(
  childFamilyStep,
  childFamilyRole,
  childFamilyRole.options.find((item) => item.id === 'niece_nephew'),
  new Date('2026-07-10T15:12:00.000Z')
);
check('child family branch ends without questioning supporting food', completedChildFamily.promptState.status === 'answered');
const childFriendStep = clarification.answerClarification(
  prominentChild,
  prominentChildRoot,
  prominentChildRoot.options.find((item) => item.id === 'friends'),
  new Date('2026-07-10T15:11:00.000Z')
);
check('child friend path asks for the connection', clarification.currentClarificationNode(childFriendStep)?.id === 'child-friend-role');
const childFriendRole = clarification.currentClarificationNode(childFriendStep);
const completedChildFriend = clarification.answerClarification(
  childFriendStep,
  childFriendRole,
  childFriendRole.options.find((item) => item.id === 'friends_child'),
  new Date('2026-07-10T15:12:00.000Z')
);
check('child friend branch ends without questioning supporting food', completedChildFriend.promptState.status === 'answered');
const childPrompt = promptPlanner.planContextualPrompts({ classifiedMemories: [prominentChild] })[0];
check('passive prompt keeps the child-specific wording', childPrompt?.title === 'Who is this child to you?', childPrompt?.title);
const notAboutChild = clarification.answerClarification(
  prominentChild,
  prominentChildRoot,
  prominentChildRoot.options.find((item) => item.id === 'not_about_person'),
  new Date('2026-07-10T15:11:00.000Z')
);
check('not-about-them does not assign parenting or social relationship seeds', !notAboutChild.assignments.some((item) => ['parenting_care', 'social_gathering'].includes(item.seedId)), JSON.stringify(notAboutChild.assignments));
check('rejecting the primary child can replan to the next visible subject', notAboutChild.promptState.status === 'pending' && notAboutChild.promptState.graphId === 'food-context', JSON.stringify(notAboutChild.promptState));

const skippedDog = clarification.dismissClarification(dog, new Date('2026-07-10T15:00:00.000Z'));
check('dismissed prompt enters cooldown', promptPlanner.planContextualPrompts({ classifiedMemories: [skippedDog] }, new Date('2026-07-11T15:00:00.000Z')).length === 0);
check('dismissed prompt may return after cooldown', promptPlanner.planContextualPrompts({ classifiedMemories: [skippedDog] }, new Date('2026-07-18T15:00:01.000Z')).length === 1);
check('passive planner highlights at most two', promptPlanner.planContextualPrompts({ classifiedMemories: [dog, people, mealAtCinema, posterWithFood] }).length <= 2);

console.log(failures ? `\n${failures} classification check(s) FAILED.` : '\nAll intelligence classification checks passed.');
process.exit(failures ? 1 : 0);
