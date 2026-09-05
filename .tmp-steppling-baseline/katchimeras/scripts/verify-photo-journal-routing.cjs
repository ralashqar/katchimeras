const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-photo-journal-'));
function transpile(source, name) {
  const output = ts.transpileModule(fs.readFileSync(path.join(root, source), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
  }).outputText;
  const target = path.join(temp, name);
  fs.writeFileSync(target, output);
  return target;
}

const registry = transpile('utils/manual-journal-registry.ts', 'registry.js');
const catalog = transpile('utils/journal-classification-catalog.ts', 'catalog.js');
const studio = transpile('utils/studio-detect.ts', 'studio.js');
const journalRouting = transpile('utils/journal-routing.ts', 'journal-routing.js');
const journalModelFlow = transpile('utils/journal-model-flow.ts', 'journal-model-flow.js');
const evidencePath = transpile('utils/photo-journal-evidence.ts', 'evidence.js');
const semanticPath = transpile('utils/photo-semantic-frame.ts', 'semantic.js');
const analysisPath = transpile('utils/photo-journal-analysis.ts', 'analysis.js');
const foundationStub = path.join(temp, 'foundation.js');
const empty = path.join(temp, 'empty.js');
fs.writeFileSync(empty, '');
fs.writeFileSync(foundationStub, `
exports.classifyPhotoJournalEnumOnDevice = async () => {
  global.__enumCalls = (global.__enumCalls || 0) + 1;
  return global.__enumRaw ?? null;
};
exports.refinePhotoSemanticFrameOnDevice = async (frame) => {
  global.__topCalls = (global.__topCalls || 0) + 1;
  const primaryEvidenceKey = frame.primaryEvidenceKeys[0];
  const confidence = global.__topConfidence ?? 'high';
  return {
    primaryEvidenceKey, topLevel: global.__topLevel ?? 'food', confidence,
    rawResponse: { primaryEvidenceKey, topLevel: global.__topLevel ?? 'food', confidence },
    durationMs: 5,
  };
};
exports.retryPhotoTopLevelOnDevice = exports.refinePhotoSemanticFrameOnDevice;
exports.enrichPhotoJournalOnDevice = async () => null;
exports.FOUNDATION_PHOTO_SCHEMA_VERSION = 17;
exports.foundationSceneAvailability = () => ({ available: true, reason: 'available', photoSchemaVersion: 14, structuredBridgeVersion: 1 });
exports.supportsFoundationPhotoJournalSchema = () => true;
`);

const original = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request === '@/utils/manual-journal-registry') return registry;
  if (request === '@/utils/journal-classification-catalog') return catalog;
  if (request === '@/utils/studio-detect') return studio;
  if (request === '@/utils/journal-routing') return journalRouting;
  if (request === '@/utils/journal-model-flow') return journalModelFlow;
  if (request === '@/utils/photo-journal-evidence') return evidencePath;
  if (request === '@/utils/photo-semantic-frame') return semanticPath;
  if (request === '@/utils/foundation-scene') return foundationStub;
  if (request === '@/types/home' || request === '@/components/ui/icon-symbol') return empty;
  return original.call(this, request, ...args);
};

const evidence = require(evidencePath);
const semantic = require(semanticPath);
const analysis = require(analysisPath);
let failures = 0;
function check(label, condition, detail) {
  if (condition) console.log(`  ok  ${label}`);
  else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

function photo(labels, ocrLines = []) {
  return {
    vision: {
      concepts: labels.map(([name, score]) => ({ name, peakConfidence: score })),
      details: labels.map(([name]) => name),
      maxFaceCount: 0,
      dominantSubjectCoverage: 0.72,
      representation: { kind: 'real_world', confidence: 0.88, reasons: ['test'] },
    },
    raw: {
      labels: labels.map(([name, confidence]) => ({ name, confidence })),
      faceCount: 0,
      humanCount: 0,
      documentDetected: false,
      regionClassifications: [],
      recognizedText: ocrLines.map((text) => ({ text, confidence: 0.95 })),
      text: ocrLines,
    },
  };
}

function resolvedFrame(packet, topLevel = 'food', confidence = 'high') {
  const base = semantic.buildPhotoSemanticFrame(packet);
  const primaryEvidenceKey = base.primaryEvidenceKeys[0];
  return semantic.reconcilePhotoSemanticFrame(base, {
    primaryEvidenceKey,
    topLevel,
    confidence,
    rawResponse: { primaryEvidenceKey, topLevel, confidence },
    durationMs: 5,
  });
}

(async () => {
  const apple = photo([['apple', 0.97], ['fruit', 0.96], ['food', 0.95]], ['APPLE SALE']);
  const packet = evidence.buildPhotoJournalEvidence(apple.vision, apple.raw);
  const frame = semantic.buildPhotoSemanticFrame(packet);
  const routingEvidence = semantic.photoTopLevelEvidenceText(frame);
  check(
    'OCR is excluded from both photo routing stages',
    routingEvidence.includes('OCR and unfiltered raw labels excluded') && !routingEvidence.includes('APPLE SALE'),
    routingEvidence
  );

  const locked = resolvedFrame(packet);
  const exact = analysis.normalizePhotoJournalEnumRoute(
    {
      stage: 'enum_route',
      routeKey: 'food.snack',
      confidence: 'high',
      photoSchemaVersion: 16,
      verificationStatus: 'completed',
      verificationVerdict: 'supported',
      verificationEvidenceKey: locked.classificationEvidenceKeys[0],
      verificationConfidence: 'high',
    },
    packet,
    locked
  );
  check(
    'independently grounded high child confidence routes without top-level score promotion',
    exact.kind === 'exact' && exact.selected?.id === 'food.snack'
      && exact.topLevelConfidence === 'high' && exact.subcategoryConfidence === 'high',
    JSON.stringify(exact)
  );

  const review = analysis.normalizePhotoJournalEnumRoute(
    { stage: 'enum_route', routeKey: 'food.snack', confidence: 'medium', photoSchemaVersion: 16 },
    packet,
    locked
  );
  check(
    'medium child confidence opens the locked broad flow without suggesting a child',
    review.kind === 'flow_only' && review.selected === null && review.selectedFlowId === 'food'
      && review.candidates.every((candidate) => candidate.route === null),
    JSON.stringify(review)
  );

  const ungrounded = analysis.normalizePhotoJournalEnumRoute(
    {
      stage: 'enum_route',
      routeKey: 'food.snack',
      confidence: 'high',
      photoSchemaVersion: 16,
      verificationStatus: 'completed',
      verificationVerdict: 'not_distinguishable',
      verificationEvidenceKey: 'none',
      verificationConfidence: 'high',
    },
    packet,
    locked
  );
  check(
    'a high child guess without sibling-distinguishing evidence opens only the broad flow',
    ungrounded.kind === 'flow_only'
      && ungrounded.selected === null
      && ungrounded.selectedFlowId === 'food'
      && ungrounded.reason === 'foundation_child_not_visually_distinguishable',
    JSON.stringify(ungrounded)
  );

  const explicitlyUndetermined = analysis.normalizePhotoJournalEnumRoute(
    {
      stage: 'enum_route',
      routeKey: 'undetermined',
      confidence: 'high',
      photoSchemaVersion: 16,
      verificationStatus: 'skipped',
      verificationVerdict: 'not_distinguishable',
      verificationEvidenceKey: 'none',
      verificationConfidence: 'high',
    },
    packet,
    locked
  );
  check(
    'an explicitly undetermined child opens the locked broad flow',
    explicitlyUndetermined.kind === 'flow_only'
      && explicitlyUndetermined.selected === null
      && explicitlyUndetermined.selectedFlowId === 'food'
      && explicitlyUndetermined.navigationAction === 'open_flow',
    JSON.stringify(explicitlyUndetermined)
  );

  const escaped = analysis.normalizePhotoJournalEnumRoute(
    { stage: 'enum_route', routeKey: 'studio.book', confidence: 'high', photoSchemaVersion: 16 },
    packet,
    locked
  );
  check(
    'child route cannot escape the selected top-level flow',
    escaped.kind === 'flow_only' && escaped.reason === 'semantic_child_route_escaped_locked_flow',
    JSON.stringify(escaped)
  );

  const cluttered = photo([
    ['book', 0.32],
    ['device monitor', 0.49],
    ['computer', 0.49],
    ['cabinet', 0.63],
    ['focus work', 0.44],
    ['computer monitor', 0.49],
    ['desk', 0.44],
    ['toy', 0.36],
  ]);
  const clutteredPacket = evidence.buildPhotoJournalEvidence(cluttered.vision, cluttered.raw);
  const clutteredFrame = semantic.buildPhotoSemanticFrame(clutteredPacket);
  const principalCluster = clutteredPacket.signals.find((signal) => signal.id === clutteredFrame.primaryEvidenceKeys[0]);
  check(
    'corroborated lexical variants beat a stronger isolated observation without category bonuses',
    principalCluster?.memberLabels.includes('device monitor')
      && principalCluster.memberLabels.includes('computer monitor')
      && principalCluster.memberLabels.includes('computer')
      && principalCluster.salience > (clutteredPacket.signals.find((signal) => signal.name === 'cabinet')?.salience ?? 1),
    JSON.stringify(clutteredPacket.signals)
  );
  check(
    'the prompt locks exactly the highest-salience cluster as principal',
    semantic.photoTopLevelEvidenceText(clutteredFrame).includes(`Locked principal evidence: ${principalCluster?.id}.`)
      && semantic.photoTopLevelEvidenceText(clutteredFrame).includes('role locked_principal'),
    semantic.photoTopLevelEvidenceText(clutteredFrame)
  );
  const mediaFrame = resolvedFrame(clutteredPacket, 'media');
  const unsupportedMediaChild = analysis.normalizePhotoJournalEnumRoute(
    {
      stage: 'enum_route',
      routeKey: 'studio.book',
      confidence: 'high',
      photoSchemaVersion: 16,
      verificationStatus: 'completed',
      verificationVerdict: 'not_distinguishable',
      verificationEvidenceKey: 'none',
      verificationConfidence: 'high',
    },
    clutteredPacket,
    mediaFrame
  );
  check(
    'ambiguous visual media opens Watched, read or listened instead of guessing a child type',
    unsupportedMediaChild.kind === 'flow_only'
      && unsupportedMediaChild.selected === null
      && unsupportedMediaChild.selectedFlowId === 'studio'
      && unsupportedMediaChild.categoryId === null,
    JSON.stringify(unsupportedMediaChild)
  );

  const televisionPhoto = photo([
    ['toy', 0.716],
    ['stuffed animals', 0.716],
    ['cabinet', 0.574],
    ['television', 0.561],
    ['computer', 0.265],
    ['device monitor', 0.265],
    ['computer monitor', 0.265],
    ['person', 0.320],
  ]);
  const televisionPacket = evidence.buildPhotoJournalEvidence(televisionPhoto.vision, televisionPhoto.raw);
  const televisionFrame = resolvedFrame(televisionPacket, 'media');
  const contradictedBook = analysis.normalizePhotoJournalEnumRoute(
    {
      stage: 'enum_route',
      routeKey: 'studio.book',
      confidence: 'high',
      photoSchemaVersion: 16,
      verificationStatus: 'completed',
      verificationVerdict: 'supported',
      verificationEvidenceKey: 'vision:toy',
      verificationConfidence: 'high',
    },
    televisionPacket,
    televisionFrame
  );
  check(
    'television evidence prevents a contradictory Book auto-route even when the verifier supports it',
    contradictedBook.kind === 'flow_only'
      && contradictedBook.selected === null
      && contradictedBook.selectedFlowId === 'studio'
      && contradictedBook.reason === 'foundation_child_contradicted_by_visible_sibling',
    JSON.stringify(contradictedBook)
  );

  const tracedDisplayVision = {
    concepts: [
      { name: 'computer', peakConfidence: 0.492 },
      { name: 'device monitor', peakConfidence: 0.492 },
      { name: 'textile', peakConfidence: 0.647 },
      { name: 'document', peakConfidence: 0.616 },
      { name: 'book', peakConfidence: 0.616 },
    ],
    details: ['wood processed', 'computer monitor', 'textile', 'document', 'book', 'machine'],
    maxFaceCount: 0,
    dominantSubjectCoverage: 0.61,
    representation: { kind: 'real_world', confidence: 0.88, reasons: ['test'] },
  };
  const tracedDisplayRaw = {
    labels: [
      { name: 'structure', confidence: 0.8 },
      { name: 'wood processed', confidence: 0.787 },
      { name: 'computer', confidence: 0.492 },
      { name: 'device monitor', confidence: 0.492 },
      { name: 'computer monitor', confidence: 0.492 },
      { name: 'material', confidence: 0.647 },
      { name: 'textile', confidence: 0.647 },
      { name: 'document', confidence: 0.616 },
      { name: 'book', confidence: 0.616 },
      { name: 'machine', confidence: 0.519 },
    ],
    faceCount: 0,
    humanCount: 0,
    humans: [],
    faces: [],
    documentDetected: true,
    regionClassifications: [],
    recognizedText: [],
  };
  const tracedDisplayPacket = evidence.buildPhotoJournalEvidence(tracedDisplayVision, tracedDisplayRaw);
  const tracedDisplayFrame = semantic.buildPhotoSemanticFrame(tracedDisplayPacket);
  const tracedDisplayPrincipal = tracedDisplayPacket.signals.find(
    (signal) => signal.id === tracedDisplayFrame.primaryEvidenceKeys[0]
  );
  check(
    'a corroborated aggregate cluster outranks higher-confidence raw-only scene labels',
    tracedDisplayPrincipal?.memberLabels.includes('computer')
      && tracedDisplayPrincipal.memberLabels.includes('device monitor')
      && tracedDisplayPrincipal.sourceReliability === 1
      && (tracedDisplayPacket.signals.find((signal) => signal.name === 'structure')?.sourceReliability ?? 1) < 1,
    JSON.stringify(tracedDisplayPacket.signals)
  );
  const tracedDisplayEssence = evidence.photoJournalEssenceLabels(tracedDisplayPacket);
  const tracedDisplayPromptEvidence = semantic.photoTopLevelEvidenceText(tracedDisplayFrame);
  check(
    'generic raw labels are filtered out of the visible Essence tags',
    !tracedDisplayEssence.includes('structure')
      && !tracedDisplayEssence.includes('wood processed')
      && !tracedDisplayEssence.includes('material')
      && !tracedDisplayEssence.includes('textile')
      && !tracedDisplayEssence.includes('machine'),
    JSON.stringify(tracedDisplayEssence)
  );
  check(
    'the LLM evidence envelope is a filtered Essence extension of the visible tags',
    tracedDisplayFrame.classificationEvidenceKeys.length <= 8
      && tracedDisplayFrame.primaryEvidenceKeys.every(
        (key, index) => key === tracedDisplayFrame.classificationEvidenceKeys[index]
      )
      && !tracedDisplayPromptEvidence.includes('vision:structure')
      && !tracedDisplayPromptEvidence.includes('wood processed')
      && !tracedDisplayPromptEvidence.includes('vision:material')
      && !tracedDisplayPromptEvidence.includes('vision:textile')
      && !tracedDisplayPromptEvidence.includes('vision:machine'),
    tracedDisplayPromptEvidence
  );

  const expandedEssence = photo([
    ['apple', 0.95],
    ['coffee', 0.92],
    ['dog', 0.9],
    ['beach', 0.88],
    ['bicycle', 0.86],
    ['guitar', 0.84],
    ['cake', 0.82],
    ['flower', 0.8],
    ['book', 0.78],
    ['structure', 0.99],
  ]);
  const expandedPacket = evidence.buildPhotoJournalEvidence(expandedEssence.vision, expandedEssence.raw);
  const expandedFrame = semantic.buildPhotoSemanticFrame(expandedPacket);
  check(
    'Foundation receives up to eight filtered Essence clusters while the visible prefix stays bounded',
    expandedFrame.primaryEvidenceKeys.length === 4
      && expandedFrame.classificationEvidenceKeys.length === 8
      && expandedFrame.primaryEvidenceKeys.every(
        (key, index) => key === expandedFrame.classificationEvidenceKeys[index]
      )
      && expandedFrame.classificationEvidenceKeys.every((key) => key !== 'vision:structure'),
    JSON.stringify({
      visible: expandedFrame.primaryEvidenceKeys,
      foundation: expandedFrame.classificationEvidenceKeys,
    })
  );

  const humanSubject = {
    vision: {
      concepts: [{ name: 'parking lot', peakConfidence: 0.86 }, { name: 'vehicle', peakConfidence: 0.8 }],
      details: ['structure', 'outdoor'],
      maxFaceCount: 1,
      dominantSubjectCoverage: 0.52,
      representation: { kind: 'real_world', confidence: 0.94, reasons: ['test'] },
    },
    raw: {
      labels: [{ name: 'structure', confidence: 0.92 }, { name: 'parking lot', confidence: 0.86 }, { name: 'vehicle', confidence: 0.8 }],
      faceCount: 1,
      humanCount: 1,
      faces: [{ x: 0.42, y: 0.38, width: 0.18, height: 0.2, confidence: 0.99 }],
      humans: [{ x: 0.3, y: 0.15, width: 0.4, height: 0.72, confidence: 0.98 }],
      documentDetected: false,
      regionClassifications: [],
      recognizedText: [],
    },
  };
  const humanPacket = evidence.buildPhotoJournalEvidence(humanSubject.vision, humanSubject.raw);
  const humanFrame = semantic.buildPhotoSemanticFrame(humanPacket);
  const humanPrincipal = humanPacket.signals.find((signal) => signal.id === humanFrame.primaryEvidenceKeys[0]);
  check(
    'dedicated human and face observations participate as first-class principal evidence',
    humanPrincipal?.name === 'person'
      && humanPrincipal.sources.includes('human')
      && humanPrincipal.sources.includes('face')
      && humanPrincipal.salience > (humanPacket.signals.find((signal) => signal.name === 'structure')?.salience ?? 1),
    JSON.stringify(humanPacket.signals)
  );

  const televisionWithDepictedPerson = {
    vision: {
      concepts: [
        { name: 'person', peakConfidence: 0.862 },
        { name: 'television', peakConfidence: 0.721 },
        { name: 'cabinet', peakConfidence: 0.656 },
        { name: 'document', peakConfidence: 0.530 },
        { name: 'book', peakConfidence: 0.530 },
      ],
      details: ['television', 'cabinet', 'document'],
      maxFaceCount: 0,
      dominantSubjectCoverage: 0.37,
      representation: { kind: 'real_world', confidence: 0.9, reasons: ['test'] },
    },
    raw: {
      labels: [
        { name: 'television', confidence: 0.721 },
        { name: 'cabinet', confidence: 0.656 },
        { name: 'carton', confidence: 0.548 },
        { name: 'document', confidence: 0.530 },
        { name: 'book', confidence: 0.530 },
      ],
      faceCount: 0,
      humanCount: 0,
      faces: [],
      humans: [],
      documentDetected: false,
      regionClassifications: [],
      recognizedText: [],
    },
  };
  const depictedPersonPacket = evidence.buildPhotoJournalEvidence(televisionWithDepictedPerson.vision, televisionWithDepictedPerson.raw);
  const depictedPersonFrame = semantic.buildPhotoSemanticFrame(depictedPersonPacket);
  const depictedPersonSignal = depictedPersonPacket.signals.find((signal) => signal.id === 'vision:person');
  check(
    'aggregate-only person cannot displace a television without face or human geometry',
    depictedPersonSignal?.salience > 0.8
      && !depictedPersonFrame.primaryEvidenceKeys.includes('vision:person')
      && !depictedPersonFrame.classificationEvidenceKeys.includes('vision:person')
      && depictedPersonFrame.primaryEvidenceKeys[0] === 'vision:television'
      && semantic.photoTopLevelEvidenceText(depictedPersonFrame).includes('Locked principal evidence: vision:television.'),
    JSON.stringify({ signals: depictedPersonPacket.signals, frame: depictedPersonFrame })
  );
  const peopleFrame = resolvedFrame(humanPacket, 'people');
  const injectedRelationship = analysis.normalizePhotoJournalEnumRoute(
    {
      stage: 'enum_route',
      routeKey: 'people.my_child',
      confidence: 'high',
      photoSchemaVersion: 16,
      verificationStatus: 'completed',
      verificationVerdict: 'supported',
      verificationEvidenceKey: peopleFrame.classificationEvidenceKeys[0],
      verificationConfidence: 'high',
    },
    humanPacket,
    peopleFrame
  );
  check(
    'People never accepts a child route, even if an injected model result claims high verified support',
    injectedRelationship.kind === 'flow_only'
      && injectedRelationship.selected === null
      && injectedRelationship.selectedFlowId === 'people'
      && injectedRelationship.categoryId === null
      && injectedRelationship.reason === 'photo_people_subcategory_requires_user_selection',
    JSON.stringify(injectedRelationship)
  );

  const bookWithFalseHuman = {
    vision: {
      concepts: [
        { name: 'document', peakConfidence: 0.557 },
        { name: 'book', peakConfidence: 0.557 },
        { name: 'sign', peakConfidence: 0.324 },
      ],
      details: ['document', 'book', 'sign'],
      maxFaceCount: 0,
      dominantSubjectCoverage: 0.43,
      representation: { kind: 'real_world', confidence: 0.9, reasons: ['test'] },
    },
    raw: {
      labels: [
        { name: 'document', confidence: 0.557 },
        { name: 'book', confidence: 0.557 },
        { name: 'sign', confidence: 0.324 },
      ],
      faceCount: 0,
      humanCount: 1,
      faces: [],
      humans: [{ x: 0.1, y: 0.046, width: 0.8, height: 0.908, confidence: 0.566 }],
      documentDetected: true,
      regionClassifications: [],
      recognizedText: [],
    },
  };
  const bookFalseHumanPacket = evidence.buildPhotoJournalEvidence(bookWithFalseHuman.vision, bookWithFalseHuman.raw);
  const bookFalseHumanFrame = semantic.buildPhotoSemanticFrame(bookFalseHumanPacket);
  const bookFalseHumanPrincipal = bookFalseHumanPacket.signals.find(
    (signal) => signal.id === bookFalseHumanFrame.primaryEvidenceKeys[0]
  );
  const falseHumanSignal = bookFalseHumanPacket.signals.find((signal) => signal.name === 'person');
  check(
    'an uncorroborated moderate human rectangle cannot override book and document evidence',
    (bookFalseHumanPrincipal?.name === 'book' || bookFalseHumanPrincipal?.name === 'document')
      && falseHumanSignal?.sourceReliability === 0.8
      && falseHumanSignal.salience < bookFalseHumanPrincipal.salience,
    JSON.stringify(bookFalseHumanPacket.signals)
  );
  check(
    'the model-facing top-level taxonomy uses clear semantic enum names',
    JSON.stringify([
      'went_somewhere', 'food', 'studio', 'movement', 'people', 'work', 'big_event', 'general',
    ].map(semantic.photoModelFlowIdForSemanticFlow)) === JSON.stringify([
      'place', 'food', 'media', 'movement', 'people', 'work', 'event', 'other',
    ])
      && semantic.photoTopLevelForSemanticFlow('place') === 'place'
      && semantic.photoTopLevelForSemanticFlow('media') === 'media'
      && semantic.photoTopLevelForSemanticFlow('event') === 'event'
      && semantic.photoTopLevelForSemanticFlow('other') === 'ordinary'
      && semantic.photoSemanticFlowForTopLevel('media') === 'studio',
    JSON.stringify({
      modelIds: [
        'went_somewhere', 'food', 'studio', 'movement', 'people', 'work', 'big_event', 'general',
      ].map(semantic.photoModelFlowIdForSemanticFlow),
    })
  );

  global.__enumCalls = 0;
  global.__topConfidence = 'high';
  global.__topLevel = 'food';
  global.__enumRaw = {
    stage: 'enum_route',
    routeKey: 'food.snack',
    confidence: 'high',
    photoSchemaVersion: 16,
    verificationStatus: 'completed',
    verificationVerdict: 'supported',
    verificationEvidenceKey: locked.classificationEvidenceKeys[0],
    verificationConfidence: 'high',
  };
  const highProgressive = analysis.preparePhotoJournalAnalysis(apple.vision, apple.raw);
  const highResult = await highProgressive.refinement;
  check(
    'high top confidence runs the separate child pass',
    global.__enumCalls === 1 && highResult?.selected?.id === 'food.snack',
    JSON.stringify(highResult)
  );

  global.__enumCalls = 0;
  global.__topLevel = 'people';
  const peopleProgressive = analysis.preparePhotoJournalAnalysis(humanSubject.vision, humanSubject.raw);
  const peopleResult = await peopleProgressive.refinement;
  check(
    'high-confidence People stops after the top-level pass and opens the People picker',
    global.__enumCalls === 0
      && peopleResult?.kind === 'flow_only'
      && peopleResult.selectedFlowId === 'people'
      && peopleResult.selected === null
      && peopleResult.reason === 'photo_people_subcategory_requires_user_selection',
    JSON.stringify(peopleResult)
  );

  global.__enumCalls = 0;
  global.__topConfidence = 'medium';
  global.__topLevel = 'food';
  const mediumProgressive = analysis.preparePhotoJournalAnalysis(apple.vision, apple.raw);
  const mediumResult = await mediumProgressive.refinement;
  check(
    'medium top confidence stops before child classification and requests the full top-level picker',
    global.__enumCalls === 0 && mediumResult?.kind === 'ambiguous'
      && mediumResult.selectedFlowId === null
      && mediumResult.navigationAction === 'manual'
      && mediumResult.topLevelConfidence === 'medium',
    JSON.stringify(mediumResult)
  );

  global.__enumCalls = 0;
  global.__topConfidence = 'high';
  global.__topLevel = 'ambiguous';
  const undeterminedTopProgressive = analysis.preparePhotoJournalAnalysis(apple.vision, apple.raw);
  const undeterminedTopResult = await undeterminedTopProgressive.refinement;
  check(
    'an undetermined top-level result requests the full journal picker without running a child pass',
    global.__enumCalls === 0
      && undeterminedTopResult?.selected === null
      && undeterminedTopResult?.selectedFlowId === null
      && undeterminedTopResult?.navigationAction === 'manual',
    JSON.stringify(undeterminedTopResult)
  );

  const foundationSource = fs.readFileSync(path.join(root, 'utils/foundation-scene.ts'), 'utf8');
  check(
    'top and child structured tasks use greedy sampling',
    (foundationSource.match(/sampling: 'greedy'/g) || []).length >= 2
  );
  check(
    'child classification and independent grounding remain generic and evidence-bounded',
    (() => {
      const childSource = foundationSource.slice(
        foundationSource.indexOf('export async function classifyPhotoJournalEnumOnDevice'),
        foundationSource.indexOf('function hasRouteDecision')
      );
      return childSource.includes("runGenericRouteTask('photo.child-route.v5')")
        && childSource.includes("taskId: 'photo.child-route-verifier.v1'")
        && childSource.includes("'undetermined'")
        && childSource.includes("name: 'confidence'")
        && childSource.includes("name: 'evidenceKey'")
        && childSource.includes("values: ['none', ...semanticFrame.classificationEvidenceKeys]")
        && childSource.includes("'A broad subject observation that fits several sibling routes does not distinguish the proposal.'")
        && !/\b(television|screen|monitor|TV show|fruit|meal)\b/i.test(childSource);
    })()
  );
  check(
    'top model can choose only a registry flow and confidence, never the principal evidence',
    (() => {
      const topSource = foundationSource.slice(
        foundationSource.indexOf('async function runPhotoSemanticFrameTask'),
        foundationSource.indexOf('function topLevelFailure')
      );
      const fieldSource = topSource.slice(topSource.indexOf('const fields:'), topSource.indexOf('const modelRequest'));
      return fieldSource.includes("name: 'flowId'")
        && fieldSource.includes("name: 'confidence'")
        && topSource.includes("'undetermined'")
        && !fieldSource.includes("name: 'primaryEvidenceKey'")
        && !fieldSource.includes("name: 'topLevel'")
        && topSource.includes('lockedPrincipalEvidenceKey = frame.primaryEvidenceKeys[0]')
        && topSource.includes('photoModelFlowIdForSemanticFlow(flow.id)')
        && !/\b(television|screen|monitor|book|fruit|meal)\b/i.test(topSource);
    })()
  );
  const evidenceSource = fs.readFileSync(path.join(root, 'utils/photo-journal-evidence.ts'), 'utf8');
  check(
    'salience ranking has no category-specific display or object bonuses',
    !evidenceSource.includes('DISPLAY_SPECIFICITY')
      && !evidenceSource.includes('foundationSignalGroup')
      && evidenceSource.includes('corroboratedConfidence')
      && evidenceSource.includes('sourceAdjustedConfidence')
      && evidenceSource.includes('spatialContribution')
  );
  const devTraceSource = fs.readFileSync(path.join(root, 'utils/dev-photo-analysis.ts'), 'utf8');
  const intelligenceLabSource = fs.readFileSync(path.join(root, 'app/intelligence-lab.tsx'), 'utf8');
  check(
    'development trace persists both exact assembled Foundation requests',
    foundationSource.includes('const modelRequest = { taskId, instructions, prompt, fields')
      && devTraceSource.includes('foundationRoutingPrompts')
      && devTraceSource.includes('topLevel: modelRequestFrom')
      && devTraceSource.includes('subcategory: modelRequestFrom')
  );
  check(
    'Intelligence Lab renders top-level and subcategory prompt snapshots',
    intelligenceLabSource.includes('Assembled top-level Foundation prompt')
      && intelligenceLabSource.includes('Assembled subcategory Foundation prompt')
  );
  const essenceReviewSource = fs.readFileSync(path.join(root, 'components/katchadeck/capture/essence-review.tsx'), 'utf8');
  const refinementCacheIndex = essenceReviewSource.indexOf('cacheDevelopmentAnalysis(analysis, vision, rawVision)');
  const refinementUiGuardIndex = essenceReviewSource.indexOf('if (journalRequestRef.current === requestId', refinementCacheIndex);
  check(
    'completed photo analysis is cached before save, confirmation, or UI-state checks',
    essenceReviewSource.includes('cacheDevelopmentAnalysis(progressive.initial, vision, rawVision)')
      && refinementCacheIndex >= 0
      && refinementUiGuardIndex > refinementCacheIndex
      && essenceReviewSource.includes('saveDevLastPhotoAnalysis({')
  );
  check(
    'photo ambiguity opens the picker at the narrowest grounded level',
    essenceReviewSource.includes("analysis.navigationAction === 'manual'")
      && essenceReviewSource.includes('setJournalFlowId(null)')
      && essenceReviewSource.includes("analysis.kind === 'flow_only' && analysis.selectedFlowId")
      && essenceReviewSource.includes('setJournalFlowId(analysis.selectedFlowId)')
  );

  if (failures) {
    console.error(`\n${failures} photo journal verification check(s) failed.`);
    process.exit(1);
  }
  console.log('\nPhoto journal routing verification passed.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
