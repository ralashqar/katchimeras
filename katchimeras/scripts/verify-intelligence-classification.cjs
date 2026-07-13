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
const photoHierarchyPath = transpile('utils/intelligence/photo-hierarchy.ts', 'photo-hierarchy.js');
const deviceActivityPath = transpile('utils/intelligence/device-activity.ts', 'device-activity.js');
const photoDescriptorPath = transpile('utils/intelligence/photo-descriptor.ts', 'photo-descriptor.js');
const questionRegistryPath = transpile('utils/intelligence/question-registry.ts', 'question-registry.js');
const consistencyPath = transpile('utils/intelligence/consistency.ts', 'consistency.js');
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
  '@/utils/intelligence/photo-hierarchy': photoHierarchyPath,
  '@/utils/intelligence/device-activity': deviceActivityPath,
  '@/utils/intelligence/question-registry': questionRegistryPath,
  '@/utils/intelligence/clarification': clarificationPath,
  '@/data/intelligence/memory-qualities.json': path.join(root, 'data/intelligence/memory-qualities.json'),
};
fs.writeFileSync(stubs['@/types/home'], '');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request === './quality-registry') return qualityRegistryPath;
  if (request === './photo-descriptor') return photoDescriptorPath;
  if (request === './photo-hierarchy') return photoHierarchyPath;
  if (request === './question-registry') return questionRegistryPath;
  if (request === './device-activity') return deviceActivityPath;
  return request in stubs ? stubs[request] : resolve.call(this, request, ...args);
};

const classification = require(classificationPath);
const clarification = require(clarificationPath);
const promptPlanner = require(promptPlannerPath);
const classificationPolicy = require(classificationPolicyPath);
const studioDetect = require(studioDetectPath);
const questionRegistry = require(questionRegistryPath);
const consistency = require(consistencyPath);
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

const questionIds = questionRegistry.QUESTION_REGISTRY.map((item) => item.id);
check('question registry ids are unique', new Set(questionIds).size === questionIds.length);
check('every question targets a live graph node', questionRegistry.QUESTION_REGISTRY.every((item) => {
  const graph = clarification.clarificationGraphForMemory({ promptState: { graphId: item.graphId } });
  return !!graph?.nodes?.[item.nodeId];
}));

const dog = classification.buildPhotoClassifiedMemory({
  sourceId: 'dog', observedAt: '2026-07-10T12:00:00.000Z', vision: summary(['dog']),
  scene: { type: 'pet', label: 'A furry friend', source: 'rules' },
});
check('dog ownership stays pending', dog.promptState.graphId === 'animal-relationship');
check('new memories retain a bounded scored decision trace', dog.promptState.plannerVersion === 3 && dog.promptState.candidateTrace.length <= 5 && dog.promptState.currentQuestionId === 'animal.ownership', JSON.stringify(dog.promptState));
check('question scoring is deterministic', JSON.stringify(questionRegistry.planNextQuestion(dog)) === JSON.stringify(questionRegistry.planNextQuestion(dog)));
const plannerStartedAt = Date.now();
for (let index = 0; index < 2_000; index += 1) questionRegistry.planNextQuestion(dog);
check('question planning stays comfortably off the interaction budget', Date.now() - plannerStartedAt < 500);

function deviceSummary(entries, details = []) {
  return {
    concepts: entries.map(([name, confidence]) => ({ name, salience: 1, coverage: 1, count: 1, peakConfidence: confidence })),
    details, maxFaceCount: 0, faceCoverage: 0, textTokens: [], analyzedPhotoCount: 1,
  };
}
function laptopMemory(id, entries, details = []) {
  return classification.buildPhotoClassifiedMemory({
    sourceId: id, observedAt: '2026-07-13T10:00:00.000Z',
    vision: deviceSummary([['laptop', 0.92], ...entries], details),
    scene: { type: 'screen', label: 'On a screen', detail: 'Digital content', source: 'rules' },
  });
}

const plainLaptop = laptopMemory('plain-laptop', []);
check('laptop remains a device rather than becoming work or media', plainLaptop.dominantDomain === 'other' && plainLaptop.photoAnalysis.subjects.find((item) => item.role === 'primary')?.canonicalValue === 'device_laptop', JSON.stringify(plainLaptop.photoAnalysis));
check('plain laptop asks for activity first', plainLaptop.promptState.graphId === 'device-activity' && clarification.currentClarificationNode(plainLaptop)?.question === 'What were you using it for?', JSON.stringify(plainLaptop.promptState));
check('plain laptop never starts with media identity or work feelings', !/book|movie|productive/i.test(clarification.currentClarificationNode(plainLaptop)?.question ?? ''), clarification.currentClarificationNode(plainLaptop)?.question);
const representationLaptop = {
  ...plainLaptop,
  promptState: { ...plainLaptop.promptState, graphId: 'representation-context', currentNodeId: 'root', currentQuestionId: 'representation.root', status: 'pending', questionCount: 0, answeredNodeIds: [], askedQuestionIds: [], resolvedGoalIds: [], completedGoalIds: [], skippedGoalIds: [] },
};
const representationNode = clarification.currentClarificationNode(representationLaptop);
const confirmedScreenLaptop = clarification.answerClarification(representationLaptop, representationNode, representationNode.options.find((item) => item.id === 'screen'));
check('confirming On a screen retains screen representation', confirmedScreenLaptop.photoAnalysis?.representation.kind === 'screen_content', JSON.stringify(confirmedScreenLaptop.photoAnalysis?.representation));
check('confirming On a screen continues to laptop activity instead of the journal root', confirmedScreenLaptop.promptState.graphId === 'device-activity' && clarification.currentClarificationNode(confirmedScreenLaptop)?.question === 'What were you using it for?', JSON.stringify(confirmedScreenLaptop.promptState));

const subtitleLaptop = classification.buildPhotoClassifiedMemory({
  sourceId: 'subtitle-laptop', observedAt: '2026-07-13T11:56:37.768Z',
  rawVision: {
    labels: [
      { name: 'people', confidence: 0.796 }, { name: 'computer', confidence: 0.571 },
      { name: 'laptop', confidence: 0.571 }, { name: 'computer_keyboard', confidence: 0.404 },
    ],
    text: ['IIIiMIiii', 'for vlctory for the Ilttle g', 'that I wanted was to see'],
    faceCount: 1, humanCount: 1, animals: [], humans: [], faces: [], recognizedText: [],
    dominantSubject: { x: 0.09, y: 0.28, width: 0.83, height: 0.57, confidence: 0.61 },
    documentDetected: true, captureSource: 'camera',
  },
  vision: {
    ...deviceSummary([['people', 0.796], ['screen content', 0.78], ['computer', 0.571], ['laptop', 0.571], ['document', 0.42]], ['adult', 'screen content', 'document', 'computer', 'laptop']),
    textTokens: ['IIIiMIiii', 'for vlctory for the Ilttle g', 'that I wanted was to see'],
    dominantSubjectCoverage: 0.47, documentCoverage: 1,
    representation: { kind: 'screen_content', confidence: 0.78, reasons: ['screen/device evidence'] },
  },
  // Reproduce the stale deterministic scene read defensively as well as the
  // now-fixed classifier, so retained/cached analysis cannot revive the bug.
  scene: { type: 'media', label: 'An inspiration', detail: 'For Vlctory for the Ilttle G', source: 'rules', media: { mediaType: 'book', title: 'For Vlctory for the Ilttle G', creator: null } },
});
check(
  'laptop document OCR cannot manufacture a primary book subject',
  subtitleLaptop.photoAnalysis?.subjects.find((item) => item.role === 'primary')?.canonicalValue === 'device_laptop' &&
    subtitleLaptop.dominantDomain === 'other' &&
    subtitleLaptop.promptState.graphId === 'device-activity' &&
    clarification.currentClarificationNode(subtitleLaptop)?.question === 'What were you using it for?' &&
    !subtitleLaptop.facets.some((item) => item.key === 'media_type' && item.value === 'book') &&
    subtitleLaptop.photoAnalysis?.hierarchy?.container.kind === 'screen',
  JSON.stringify(subtitleLaptop)
);

const gameplayLaptop = laptopMemory('gameplay-laptop', [['gameplay', 0.91]], ['video game']);
check('strong gameplay asks for targeted confirmation', gameplayLaptop.promptState.currentNodeId === 'confirm' && clarification.currentClarificationNode(gameplayLaptop)?.question === 'Were you gaming?', JSON.stringify(gameplayLaptop.facets));
const spreadsheetLaptop = laptopMemory('spreadsheet-laptop', [['spreadsheet', 0.89]]);
check('strong spreadsheet asks whether the user was working', clarification.currentClarificationNode(spreadsheetLaptop)?.question === 'Were you working?', JSON.stringify(spreadsheetLaptop.facets));
const videoLaptop = laptopMemory('video-laptop', [['video player', 0.88]]);
check('strong player evidence asks whether the user was watching', clarification.currentClarificationNode(videoLaptop)?.question === 'Were you watching something?', JSON.stringify(videoLaptop.facets));
const ebookLaptop = laptopMemory('ebook-laptop', [['ebook', 0.88]]);
check('strong ebook evidence asks whether the user was reading', clarification.currentClarificationNode(ebookLaptop)?.question === 'Were you reading?', JSON.stringify(ebookLaptop.facets));
const conflictedLaptop = laptopMemory('conflicted-laptop', [['gameplay', 0.72], ['spreadsheet', 0.7]]);
check('weak conflicting activities use the broad activity question', conflictedLaptop.promptState.currentNodeId === 'root' && clarification.currentClarificationNode(conflictedLaptop)?.question === 'What were you using it for?', JSON.stringify(conflictedLaptop.facets));
const thresholdLaptop = laptopMemory('threshold-laptop', [['spreadsheet', 0.78], ['gameplay', 0.63]]);
check('activity acceptance includes the exact threshold and margin', clarification.currentClarificationNode(thresholdLaptop)?.question === 'Were you working?', JSON.stringify(thresholdLaptop.facets));
const narrowMarginLaptop = laptopMemory('narrow-margin-laptop', [['spreadsheet', 0.78], ['gameplay', 0.64]]);
check('activity lead below the minimum margin stays broad', clarification.currentClarificationNode(narrowMarginLaptop)?.question === 'What were you using it for?', JSON.stringify(narrowMarginLaptop.facets));

const gamingNode = clarification.currentClarificationNode(gameplayLaptop);
const confirmedGaming = clarification.answerClarification(gameplayLaptop, gamingNode, gamingNode.options.find((item) => item.id === 'confirm_gaming'));
check('confirmed gaming drives media and assignment routing', confirmedGaming.dominantDomain === 'media' && confirmedGaming.facets.some((item) => item.key === 'media_type' && item.value === 'game' && item.confirmed) && confirmedGaming.assignments.some((item) => item.seedId === 'gaming_session' && item.confirmed), JSON.stringify({ domain: confirmedGaming.dominantDomain, facets: confirmedGaming.facets, assignments: confirmedGaming.assignments }));

const workNode = clarification.currentClarificationNode(spreadsheetLaptop);
const confirmedWork = clarification.answerClarification(spreadsheetLaptop, workNode, workNode.options.find((item) => item.id === 'confirm_working'));
check('confirmed working drives focus routing before feelings', confirmedWork.dominantDomain === 'work' && confirmedWork.assignments.some((item) => item.seedId === 'focus_day' && item.confirmed) && clarification.currentClarificationNode(confirmedWork)?.question === 'What kind of work was it?', JSON.stringify({ domain: confirmedWork.dominantDomain, assignments: confirmedWork.assignments, prompt: confirmedWork.promptState }));

const laptopWithBook = laptopMemory('laptop-with-book', [['book', 0.5]]);
const laptopWithBookNode = clarification.currentClarificationNode(laptopWithBook);
const withoutDevice = clarification.answerClarification(laptopWithBook, laptopWithBookNode, laptopWithBookNode.options.find((item) => item.id === 'not_about_device'));
check('not-about-device promotes and replans around the next subject', withoutDevice.photoAnalysis.subjects.find((item) => item.role === 'primary')?.canonicalValue === 'book' && withoutDevice.promptState.graphId === 'media-context', JSON.stringify({ subjects: withoutDevice.photoAnalysis.subjects, prompt: withoutDevice.promptState }));

const balancedDeviceBook = classification.buildPhotoClassifiedMemory({
  sourceId: 'balanced-device-book', observedAt: '2026-07-13T10:05:00.000Z',
  rawVision: {
    labels: [{ name: 'laptop', confidence: 0.86 }, { name: 'book', confidence: 0.84 }],
    regionClassifications: [
      { region: { x: 0.05, y: 0.2, width: 0.42, height: 0.5, confidence: 0.86 }, labels: [{ name: 'laptop', confidence: 0.86 }] },
      { region: { x: 0.53, y: 0.2, width: 0.42, height: 0.5, confidence: 0.84 }, labels: [{ name: 'book', confidence: 0.84 }] },
    ],
    text: [], faceCount: 0, humanCount: 0, animals: [], humans: [], faces: [], recognizedText: [],
    dominantSubject: { x: 0.05, y: 0.2, width: 0.42, height: 0.5, confidence: 0.86 },
    documentDetected: false, captureSource: 'camera',
  },
  vision: deviceSummary([['laptop', 0.86], ['book', 0.84]]),
  scene: { type: 'screen', label: 'On a screen', detail: 'Digital content', source: 'rules' },
});
check('comparable laptop and book regions resolve subject focus before activity', balancedDeviceBook.promptState.graphId === 'subject-focus' && clarification.currentClarificationNode(balancedDeviceBook)?.options.some((item) => item.facetValue === 'device_laptop') && clarification.currentClarificationNode(balancedDeviceBook)?.options.some((item) => item.facetValue === 'book'), JSON.stringify({ subjects: balancedDeviceBook.photoAnalysis.subjects, prompt: balancedDeviceBook.promptState }));

const titledVideoLaptop = classification.buildPhotoClassifiedMemory({
  sourceId: 'titled-video-laptop', observedAt: '2026-07-13T10:06:00.000Z',
  vision: { ...deviceSummary([['laptop', 0.92], ['video player', 0.89]]), textTokens: ['Interstellar'] },
  scene: { type: 'media', label: 'An inspiration', detail: 'Interstellar', media: { mediaType: 'film', title: 'Interstellar', creator: null }, source: 'llm', confidence: 0.86, representation: 'screen_content' },
});
const titledWatchConfirm = clarification.currentClarificationNode(titledVideoLaptop);
const watchingTitled = clarification.answerClarification(titledVideoLaptop, titledWatchConfirm, titledWatchConfirm.options.find((item) => item.id === 'confirm_watching'));
const watchKindNode = clarification.currentClarificationNode(watchingTitled);
const movieSelected = clarification.answerClarification(watchingTitled, watchKindNode, watchKindNode.options.find((item) => item.id === 'movie'));
check('watching flow confirms OCR title before reaction', movieSelected.promptState.currentNodeId === 'title' && clarification.currentClarificationNode(movieSelected)?.question === 'Is this “Interstellar”?', JSON.stringify(movieSelected.promptState));
const titleNode = clarification.currentClarificationNode(movieSelected);
const titleConfirmed = clarification.answerClarification(movieSelected, titleNode, titleNode.options.find((item) => item.id === 'confirm_title'));
check('device media title proceeds to reaction last', clarification.currentClarificationNode(titleConfirmed)?.question === 'How did it land?', JSON.stringify(titleConfirmed.promptState));

const legacyLaptop = {
  ...plainLaptop,
  dominantDomain: 'work', schemaVersion: 5,
  observations: plainLaptop.observations.map((item) => item.value === 'device_laptop' ? { ...item, value: 'focus_work', raw: 'laptop' } : item),
  photoAnalysis: {
    ...plainLaptop.photoAnalysis,
    dominantSubjectId: 'subject:focus_work',
    subjects: plainLaptop.photoAnalysis.subjects.map((item) => item.canonicalValue === 'device_laptop' ? { ...item, id: 'subject:focus_work', canonicalValue: 'focus_work', domain: 'work', label: 'laptop' } : item),
  },
  promptState: { ...plainLaptop.promptState, graphId: 'work-context', currentNodeId: 'root', currentQuestionId: 'work.context', maxQuestions: 3, plannerVersion: 2 },
};
const migratedLaptop = classification.recalibrateClassifiedMemory(legacyLaptop);
check('unanswered legacy laptop prompts migrate to device activity', migratedLaptop.schemaVersion === 6 && migratedLaptop.promptState.graphId === 'device-activity' && migratedLaptop.photoAnalysis.subjects.find((item) => item.role === 'primary')?.canonicalValue === 'device_laptop', JSON.stringify({ subjects: migratedLaptop.photoAnalysis.subjects, prompt: migratedLaptop.promptState }));

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
check('unnamed OCR book does not create a book confirmation without visual support', clarification.currentClarificationNode(unnamedOcrBook)?.question !== 'Is this a book?', clarification.currentClarificationNode(unnamedOcrBook)?.question);
const unsupportedFoundationFood = classification.buildPhotoClassifiedMemory({
  sourceId: 'foundation-food-without-visual-food',
  observedAt: '2026-07-10T13:30:31.000Z',
  vision: summary(['computer', 'laptop']),
  scene: { type: 'food', memoryDomain: 'food', label: 'A meal', detail: 'Pasta', source: 'llm', food: { detected: true, label: 'Pasta' } },
});
check('Foundation food text cannot create a photo category without visual food support', unsupportedFoundationFood.dominantDomain !== 'food' && !unsupportedFoundationFood.facets.some((facet) => facet.key === 'food_item'), JSON.stringify(unsupportedFoundationFood.facets));
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
check('OCR-only cover cannot outrank a visually inferred place', signLabelledCover.dominantDomain === 'place', signLabelledCover.dominantDomain);
check('OCR-only cover does not manufacture a book subject', !signLabelledCover.photoAnalysis?.subjects.some((item) => item.canonicalValue === 'book'), JSON.stringify(signLabelledCover.photoAnalysis?.subjects));
check('OCR-only cover does not persist a title facet', !signLabelledCover.facets.some((item) => item.key === 'media_title'), JSON.stringify(signLabelledCover.facets));
check('OCR-only cover follows the visual place question', clarification.currentClarificationNode(signLabelledCover)?.question === 'What kind of place was this?', clarification.currentClarificationNode(signLabelledCover)?.question);
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
check('OCR title validation uses the micro-question budget', completedTitledBook.promptState.questionCount === 2 && completedTitledBook.promptState.microQuestionCount === 1, JSON.stringify(completedTitledBook.promptState));
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

const televisionMisreadAsWork = classification.buildPhotoClassifiedMemory({
  sourceId: 'tv-misread-as-work',
  observedAt: '2026-07-10T13:40:30.000Z',
  vision: summary(['television', 'consumer electronics', 'machine', 'focus_work']),
  scene: { memoryDomain: 'work', type: 'activity', label: 'Focused activity', detail: 'consumer electronics', source: 'llm', representation: 'real_world' },
});
check(
  'prominent television corrects a generic Foundation work read at the canonical layer',
  televisionMisreadAsWork.dominantDomain === 'media' &&
    televisionMisreadAsWork.photoAnalysis?.representation.kind === 'screen_content' &&
    clarification.currentClarificationNode(televisionMisreadAsWork)?.question === 'What were you watching?',
  JSON.stringify(televisionMisreadAsWork)
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
check('ordinary place prompt does not call every place a stop', clarification.currentClarificationNode(cityWithIncidentalTelevision)?.question === 'What kind of place was this?', clarification.currentClarificationNode(cityWithIncidentalTelevision)?.question);

const sofaInterior = classification.buildPhotoClassifiedMemory({
  sourceId: 'sofa-interior',
  observedAt: '2026-07-10T13:41:45.000Z',
  vision: summary(['sofa', 'conveyance']),
  scene: { memoryDomain: 'place', type: 'place', label: 'A place', detail: 'living room', source: 'llm', representation: 'real_world' },
});
const sofaQuestion = clarification.currentClarificationNode(sofaInterior);
check('sofa interior asks what kind of space it is', sofaQuestion?.question === 'What kind of space was this?', sofaQuestion?.question);
check('home-like space offers ownership and stay context', ['my_home', 'someone_home', 'place_staying'].every((id) => sofaQuestion?.options.some((item) => item.id === id)), JSON.stringify(sofaQuestion?.options));
const homeAnswer = clarification.answerClarification(
  sofaInterior,
  sofaQuestion,
  sofaQuestion.options.find((item) => item.id === 'my_home'),
  new Date('2026-07-10T13:41:46.000Z')
);
check('My home leads to a home-specific meaning question', clarification.currentClarificationNode(homeAnswer)?.question === 'What was happening at home?', clarification.currentClarificationNode(homeAnswer)?.question);
check('confirmed home space contributes home context', homeAnswer.assignments.some((item) => item.seedId === 'home_evening' && item.confirmed), JSON.stringify(homeAnswer.assignments));
const notPlace = clarification.answerClarification(
  sofaInterior,
  sofaQuestion,
  sofaQuestion.options.find((item) => item.id === 'not_about_space'),
  new Date('2026-07-10T13:41:46.000Z')
);
check('Not about the space rejects the inferred place domain', notPlace.dominantDomain !== 'place', notPlace.dominantDomain);

const stationPlace = classification.buildPhotoClassifiedMemory({
  sourceId: 'station-place', observedAt: '2026-07-10T13:41:50.000Z', vision: summary(['train station', 'platform']),
  scene: { memoryDomain: 'place', type: 'place', label: 'A place', detail: 'train station', source: 'llm', representation: 'real_world' },
});
check('journey wording is reserved for explicit transit places', clarification.currentClarificationNode(stationPlace)?.question === 'How did this place fit the journey?', JSON.stringify(stationPlace));

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
const televisedCandidates = questionRegistry.rankQuestionCandidates(televisedAdult);
check('screen representation hard-blocks relationship questions', televisedCandidates.some((item) => item.questionId === 'people.relationship' && !item.eligible && item.blockers.some((reason) => /representation|required subject/.test(reason))), JSON.stringify(televisedCandidates));
check('television outranks generic adult and work labels', televisedAdult.dominantDomain === 'media' && televisedAdult.photoAnalysis?.subjects.find((item) => item.role === 'primary')?.canonicalValue === 'television', JSON.stringify(televisedAdult.photoAnalysis));
check('adult on television asks what was watched', televisedAdultQuestion?.question === 'What were you watching?', televisedAdultQuestion?.question);

const televisionMisreadAsCraft = classification.buildPhotoClassifiedMemory({
  sourceId: 'tv-misread-as-craft', observedAt: '2026-07-10T13:43:00.000Z',
  vision: summary(['television', 'consumer electronics', 'craft']),
  scene: { memoryDomain: 'other', type: 'activity', label: 'An activity', detail: 'crafting', source: 'llm', representation: 'real_world' },
});
check('a primary television cannot fall through to craft meanings', televisionMisreadAsCraft.promptState.graphId === 'media-context' && clarification.currentClarificationNode(televisionMisreadAsCraft)?.question === 'What were you watching?', JSON.stringify(televisionMisreadAsCraft));

const bookAndTelevision = classification.buildPhotoClassifiedMemory({
  sourceId: 'book-and-tv', observedAt: '2026-07-12T14:16:27.000Z',
  vision: {
    concepts: [
      { name: 'screen content', salience: 0.78, coverage: 1, count: 1, peakConfidence: 0.78 },
      { name: 'wood processed', salience: 0.635, coverage: 1, count: 1, peakConfidence: 0.635 },
      { name: 'television', salience: 0.24, coverage: 1, count: 1, peakConfidence: 0.24 },
      { name: 'document', salience: 0.193, coverage: 1, count: 1, peakConfidence: 0.193 },
      { name: 'book', salience: 0.193, coverage: 1, count: 1, peakConfidence: 0.193 },
    ],
    details: ['screen content', 'document', 'wood processed', 'television', 'book'],
    maxFaceCount: 0, faceCoverage: 0,
    textTokens: ['161', 'MURAKAMI', 'NORWEGIAN', 'WOOD'], analyzedPhotoCount: 1,
    dominantSubjectCoverage: 0.44, documentCoverage: 1,
    representation: { kind: 'screen_content', confidence: 0.78, reasons: ['screen and document evidence'] },
  },
  scene: { type: 'media', label: 'An inspiration', detail: 'Norwegian Wood', source: 'rules', media: { mediaType: 'book', title: 'Norwegian Wood', creator: null } },
});
const bookTvFocus = clarification.currentClarificationNode(bookAndTelevision);
check('a clearly foreground book does not ask about the background television', bookAndTelevision.promptState.graphId === 'media-context' && bookTvFocus?.question === 'Is this a book?', JSON.stringify(bookAndTelevision));

const balancedBookAndPerson = classification.buildPhotoClassifiedMemory({
  sourceId: 'balanced-book-person', observedAt: '2026-07-12T14:20:00.000Z',
  rawVision: {
    labels: [{ name: 'adult', confidence: 0.78 }, { name: 'document', confidence: 0.77 }, { name: 'book', confidence: 0.76 }],
    text: ['NORWEGIAN WOOD'], recognizedText: [{ text: 'NORWEGIAN WOOD', confidence: 0.98 }],
    faceCount: 1, humanCount: 1,
    humans: [{ x: 0.52, y: 0.2, width: 0.42, height: 0.68, confidence: 0.8 }],
    faces: [{ x: 0.62, y: 0.26, width: 0.2, height: 0.2, confidence: 0.82 }], animals: [],
    dominantSubject: { x: 0.05, y: 0.15, width: 0.48, height: 0.72, confidence: 0.8 }, documentDetected: true,
  },
  vision: {
    concepts: [
      { name: 'adult', salience: 0.78, coverage: 1, count: 1, peakConfidence: 0.78 },
      { name: 'document', salience: 0.77, coverage: 1, count: 1, peakConfidence: 0.77 },
      { name: 'book', salience: 0.76, coverage: 1, count: 1, peakConfidence: 0.76 },
    ],
    details: ['adult', 'document', 'book'], maxFaceCount: 1, faceCoverage: 1,
    textTokens: ['NORWEGIAN WOOD'], analyzedPhotoCount: 1, dominantSubjectCoverage: 0.35, documentCoverage: 1,
  },
  scene: { type: 'social', label: 'Time together', detail: 'person', supportingSubjects: ['book'], source: 'llm' },
});
const balancedFocus = clarification.currentClarificationNode(balancedBookAndPerson);
check('balanced book and person evidence asks a generic focus question', balancedBookAndPerson.promptState.graphId === 'subject-focus' && balancedFocus?.question === 'What was this photo mainly about?', JSON.stringify(balancedBookAndPerson.photoAnalysis));
check('generic focus question offers both detected subjects', balancedFocus?.options.some((item) => item.facetValue === 'book') && balancedFocus?.options.some((item) => item.facetValue === 'person'), JSON.stringify(balancedFocus?.options));
const focusedBook = clarification.answerClarification(
  balancedBookAndPerson,
  balancedFocus,
  balancedFocus.options.find((item) => item.facetValue === 'book')
);
const focusedBookType = clarification.currentClarificationNode(focusedBook);
check('choosing Book focus continues to the real Book question', focusedBookType?.question === 'Is this a book?', JSON.stringify(focusedBook.promptState));
const confirmedFocusedBook = clarification.answerClarification(
  focusedBook,
  focusedBookType,
  focusedBookType.options.find((item) => item.id === 'confirm_book')
);
check('focused Book continues to OCR title validation', clarification.currentClarificationNode(confirmedFocusedBook)?.question.includes('Norwegian Wood'), JSON.stringify(confirmedFocusedBook.promptState));

const drinkingGlassFixture = {
  sourceId: 'hand-holding-drinking-glass', observedAt: '2026-07-13T13:11:34.090Z',
  rawVision: {
    labels: [
      { name: 'drinking_glass', confidence: 0.904296875 },
      { name: 'tableware', confidence: 0.904296875 },
      { name: 'utensil', confidence: 0.904296875 },
      { name: 'liquid', confidence: 0.14453423023223877 },
      { name: 'drink', confidence: 0.14453421533107758 },
      { name: 'wine', confidence: 0.14453330636024475 },
      { name: 'red_wine', confidence: 0.14453125 },
      { name: 'people', confidence: 0.12405402213335037 },
      { name: 'adult', confidence: 0.123291015625 },
    ],
    text: [], faceCount: 0, humanCount: 0, animals: [], humans: [], faces: [], recognizedText: [],
    dominantSubject: { x: 0.06195068359375, y: 0.2275390625, width: 0.74224853515625, height: 0.6263427734375, confidence: 0.5703125 },
    salientSubjects: [{ x: 0.06195068359375, y: 0.2275390625, width: 0.74224853515625, height: 0.6263427734375, confidence: 0.5703125 }],
    regionClassifications: [], documentDetected: false, captureSource: 'camera',
  },
  vision: {
    concepts: [
      ['drinking glass', 0.904296875], ['tableware', 0.904296875], ['utensil', 0.904296875],
      ['liquid', 0.14453423023223877], ['drink', 0.14453421533107758], ['wine', 0.14453330636024475],
      ['red wine', 0.14453125], ['person', 0.123291015625],
    ].map(([name, peakConfidence]) => ({ name, salience: peakConfidence, coverage: 1, count: 1, peakConfidence })),
    details: ['drinking glass', 'tableware', 'utensil', 'liquid', 'drink', 'wine', 'red wine', 'adult'],
    maxFaceCount: 0, faceCoverage: 0, textTokens: [], analyzedPhotoCount: 1,
    dominantSubjectCoverage: 0.46490200608968735, documentCoverage: 0,
    representation: { kind: 'real_world', confidence: 0.88, reasons: ['Captured with the in-app camera'] },
    analysisRegions: [{ x: 0.06195068359375, y: 0.2275390625, width: 0.74224853515625, height: 0.6263427734375, confidence: 0.5703125, kind: 'saliency' }],
  },
  scene: {
    memoryDomain: 'people', type: 'social', label: 'Time with people', detail: 'people', source: 'llm',
    supportingSubjects: ['drink'], representation: 'real_world', confidence: 1,
  },
};
const drinkingGlass = classification.buildPhotoClassifiedMemory(drinkingGlassFixture);
const drinkingGlassPrimary = drinkingGlass.photoAnalysis?.subjects.find((subject) => subject.role === 'primary');
check('drinking_glass preserves its original Vision confidence as canonical drink', drinkingGlass.observations.some((item) => item.value === 'drink' && item.provider === 'appleVision' && item.confidence >= 0.9), JSON.stringify(drinkingGlass.observations));
check('exact drinking-glass fixture classifies Drink as primary', drinkingGlass.dominantDomain === 'food' && drinkingGlassPrimary?.canonicalValue === 'drink' && drinkingGlassPrimary.score >= 0.9, JSON.stringify(drinkingGlass.photoAnalysis));
check('weak people labels without a face or human region do not create People', !drinkingGlass.photoAnalysis?.subjects.some((subject) => subject.domain === 'people' && subject.role !== 'incidental'), JSON.stringify(drinkingGlass.photoAnalysis));
check('uncorroborated Foundation Social is excluded', !drinkingGlass.observations.some((item) => item.provider === 'appleFoundation' && item.value === 'social'), JSON.stringify(drinkingGlass.observations));
check('drinking-glass fixture has no consistency warnings', consistency.classifiedMemoryConsistencyWarnings(drinkingGlass).length === 0, JSON.stringify(consistency.classifiedMemoryConsistencyWarnings(drinkingGlass)));

const comparablePersonAndDrink = classification.buildPhotoClassifiedMemory({
  sourceId: 'comparable-person-drink', observedAt: '2026-07-13T13:11:50.000Z',
  rawVision: {
    labels: [{ name: 'people', confidence: 0.84 }, { name: 'drinking_glass', confidence: 0.82 }, { name: 'tableware', confidence: 0.78 }],
    text: [], faceCount: 1, humanCount: 1, animals: [], recognizedText: [], documentDetected: false, captureSource: 'camera',
    humans: [{ x: 0.05, y: 0.16, width: 0.4, height: 0.66, confidence: 0.86 }],
    faces: [{ x: 0.16, y: 0.22, width: 0.14, height: 0.16, confidence: 0.88 }],
    dominantSubject: { x: 0.05, y: 0.16, width: 0.4, height: 0.66, confidence: 0.86 },
    salientSubjects: [
      { x: 0.05, y: 0.16, width: 0.4, height: 0.66, confidence: 0.86 },
      { x: 0.52, y: 0.2, width: 0.4, height: 0.62, confidence: 0.84 },
    ],
    regionClassifications: [{
      region: { x: 0.52, y: 0.2, width: 0.4, height: 0.62, confidence: 0.84 },
      labels: [{ name: 'drinking_glass', confidence: 0.82 }],
    }],
  },
  vision: {
    concepts: [
      { name: 'person', salience: 0.84, coverage: 1, count: 1, peakConfidence: 0.84 },
      { name: 'drinking glass', salience: 0.82, coverage: 1, count: 1, peakConfidence: 0.82 },
    ],
    details: ['people', 'drinking glass'], maxFaceCount: 1, faceCoverage: 0.0224,
    textTokens: [], analyzedPhotoCount: 1, dominantSubjectCoverage: 0.264, documentCoverage: 0,
  },
});
const personDrinkQuestion = clarification.currentClarificationNode(comparablePersonAndDrink);
check('comparable localized person and drink evidence asks subject focus', comparablePersonAndDrink.promptState.graphId === 'subject-focus' && personDrinkQuestion?.question === 'What was this photo mainly about?', JSON.stringify(comparablePersonAndDrink.photoAnalysis));
check('person/drink focus uses concrete labels', personDrinkQuestion?.options.some((item) => item.facetValue === 'drink' && item.label === 'The drink') && personDrinkQuestion?.options.some((item) => item.facetValue === 'person' && item.label === 'Me / the person'), JSON.stringify(personDrinkQuestion?.options));
const choseDrink = clarification.answerClarification(
  comparablePersonAndDrink,
  personDrinkQuestion,
  personDrinkQuestion.options.find((item) => item.facetValue === 'drink'),
  new Date('2026-07-13T13:11:55.000Z')
);
check('choosing Drink makes People incidental and replans to Food', choseDrink.dominantDomain === 'food' && choseDrink.photoAnalysis?.subjects.some((subject) => subject.domain === 'people' && subject.role === 'incidental') && choseDrink.promptState.graphId === 'food-context', JSON.stringify(choseDrink));

const architecturalGlass = classification.buildPhotoClassifiedMemory({
  sourceId: 'architectural-glass', observedAt: '2026-07-13T13:12:00.000Z',
  rawVision: {
    labels: [{ name: 'glass', confidence: 0.92 }, { name: 'window', confidence: 0.88 }, { name: 'building', confidence: 0.84 }, { name: 'material', confidence: 0.8 }],
    text: [], faceCount: 0, humanCount: 0, animals: [], humans: [], faces: [], recognizedText: [], dominantSubject: null,
    regionClassifications: [], documentDetected: false, captureSource: 'camera',
  },
  scene: { type: 'place', memoryDomain: 'place', label: 'A place', detail: 'building', source: 'rules' },
});
check('architectural glass never canonicalizes to Drink', !architecturalGlass.observations.some((item) => item.value === 'drink'), JSON.stringify(architecturalGlass.observations));

const replayedNotAboutPeople = classification.buildPhotoClassifiedMemory({
  ...drinkingGlassFixture,
  sourceId: 'replayed-not-about-people',
  rawVision: {
    ...drinkingGlassFixture.rawVision,
    labels: drinkingGlassFixture.rawVision.labels.map((item) => item.name === 'people' || item.name === 'adult' ? { ...item, confidence: 0.78 } : item),
    faceCount: 1, humanCount: 1,
    humans: [{ x: 0.6, y: 0.15, width: 0.32, height: 0.68, confidence: 0.82 }],
    faces: [{ x: 0.7, y: 0.2, width: 0.12, height: 0.14, confidence: 0.84 }],
  },
  vision: {
    ...drinkingGlassFixture.vision,
    concepts: drinkingGlassFixture.vision.concepts.map((item) => item.name === 'person' ? { ...item, salience: 0.78, peakConfidence: 0.78 } : item),
    maxFaceCount: 1, faceCoverage: 0.02,
  },
  confirmations: [{ promptId: 'people.relationship', optionId: 'not_about_people', label: 'Not about the people', facetKey: 'relationship', facetValue: 'incidental', createdAt: '2026-07-13T13:12:30.000Z' }],
});
const replayPrimary = replayedNotAboutPeople.photoAnalysis?.subjects.find((subject) => subject.role === 'primary');
check('retained Not about people confirmation promotes Drink during rebuild', replayedNotAboutPeople.dominantDomain === 'food' && replayPrimary?.canonicalValue === 'drink' && replayedNotAboutPeople.photoAnalysis?.subjects.some((subject) => subject.domain === 'people' && subject.role === 'incidental'), JSON.stringify(replayedNotAboutPeople));
check('replayed rejection has no primary/domain consistency warning', consistency.classifiedMemoryConsistencyWarnings(replayedNotAboutPeople).length === 0, JSON.stringify(consistency.classifiedMemoryConsistencyWarnings(replayedNotAboutPeople)));

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

const rearViewPerson = classification.buildPhotoClassifiedMemory({
  sourceId: 'rear-view-person', observedAt: '2026-07-10T15:01:00.000Z',
  vision: {
    ...summary(['furniture']),
    analysisRegions: [{ x: 0.2, y: 0.12, width: 0.5, height: 0.65, confidence: 0.88, kind: 'human' }],
    dominantSubjectCoverage: 0.33,
  },
  scene: { type: 'social', label: 'Time with people', source: 'rules', representation: 'real_world' },
});
check('a prominent rear-view body remains a people subject', rearViewPerson.dominantDomain === 'people' && rearViewPerson.photoAnalysis?.subjects.some((item) => item.role === 'primary' && item.domain === 'people'), JSON.stringify(rearViewPerson));
check('rear-view person asks relationship context', clarification.currentClarificationNode(rearViewPerson)?.question === 'Who is this person to you?', clarification.currentClarificationNode(rearViewPerson)?.question);
check('coherent rear-view memory has no consistency warnings', consistency.classifiedMemoryConsistencyWarnings(rearViewPerson).length === 0, JSON.stringify(consistency.classifiedMemoryConsistencyWarnings(rearViewPerson)));

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
