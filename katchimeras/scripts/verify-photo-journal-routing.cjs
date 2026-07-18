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
  const target = path.join(temp, name); fs.writeFileSync(target, output); return target;
}
const registry = transpile('utils/manual-journal-registry.ts', 'registry.js');
const catalog = transpile('utils/journal-classification-catalog.ts', 'catalog.js');
const studio = transpile('utils/studio-detect.ts', 'studio.js');
const journalRouting = transpile('utils/journal-routing.ts', 'journal-routing.js');
const evidencePath = transpile('utils/photo-journal-evidence.ts', 'evidence.js');
const semanticPath = transpile('utils/photo-semantic-frame.ts', 'semantic.js');
const analysisPath = transpile('utils/photo-journal-analysis.ts', 'analysis.js');
const foundationStub = path.join(temp, 'foundation.js');
const empty = path.join(temp, 'empty.js');
fs.writeFileSync(empty, '');
fs.writeFileSync(foundationStub, `
exports.classifyPhotoJournalEnumOnDevice = async () => { global.__enumCalls = (global.__enumCalls || 0) + 1; return global.__enumRaw ?? null; };
exports.refinePhotoSemanticFrameOnDevice = async () => { global.__semanticCalls = (global.__semanticCalls || 0) + 1; return global.__semanticRaw ?? null; };
exports.retryPhotoTopLevelOnDevice = async () => { global.__technicalRetryCalls = (global.__technicalRetryCalls || 0) + 1; return global.__topLevelRetryRaw ?? null; };
exports.repairPhotoSemanticFrameOnDevice = async (...args) => { global.__repairCalls = (global.__repairCalls || 0) + 1; global.__repairArgs = args; return global.__repairRaw ?? null; };
exports.resolvePhotoTopLevelAmbiguityOnDevice = async () => { global.__ambiguityCalls = (global.__ambiguityCalls || 0) + 1; return global.__ambiguityRaw ?? null; };
exports.enrichPhotoJournalOnDevice = async () => { global.__enrichmentCalls = (global.__enrichmentCalls || 0) + 1; return global.__enrichmentRaw ?? null; };
exports.FOUNDATION_PHOTO_SCHEMA_VERSION = 13;
exports.foundationSceneAvailability = () => ({ available: global.__foundationPhotoAvailable === true, reason: global.__foundationPhotoAvailable === true ? 'available' : 'native_module_missing' });
exports.supportsFoundationPhotoJournalSchema = () => global.__photoSchemaReady === true;
`);
const original = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request === '@/utils/manual-journal-registry') return registry;
  if (request === '@/utils/journal-classification-catalog') return catalog;
  if (request === '@/utils/studio-detect') return studio;
  if (request === '@/utils/journal-routing') return journalRouting;
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
  else { failures += 1; console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`); }
}
function photo(labels, representation = 'real_world', documentDetected = false, faces = 0, humans = 0, ocrLines = []) {
  return {
    vision: {
      concepts: labels.map(([name, score]) => ({ name, peakConfidence: score })),
      details: labels.map(([name]) => name), maxFaceCount: faces,
      dominantSubjectCoverage: 0.72,
      representation: { kind: representation, confidence: 0.88, reasons: ['test'] },
    },
    raw: {
      labels: labels.map(([name, confidence]) => ({ name, confidence })),
      faceCount: faces, humanCount: humans, documentDetected, regionClassifications: [],
      recognizedText: ocrLines.map((line) => typeof line === 'string' ? { text: line, confidence: 0.95 } : line),
      text: ocrLines.map((line) => typeof line === 'string' ? line : line.text),
    },
  };
}
function semanticResult(primaryEvidenceKey, topLevel) {
  return {
    primaryEvidenceKey, topLevel,
    rawResponse: { primaryEvidenceKey, topLevel }, durationMs: 5,
  };
}

const apple = photo([['food', 0.98], ['apple', 0.97], ['fruit', 0.96], ['hand', 0.62]]);
const applePacket = evidence.buildPhotoJournalEvidence(apple.vision, apple.raw);
const appleEssence = evidence.photoJournalEssenceLabels(applePacket);
const appleFrame = semantic.buildPhotoSemanticFrame(applePacket);
check('Essence and eligible-primary evidence are the same ranked labels',
  JSON.stringify(appleEssence) === JSON.stringify(appleFrame.primaryEvidenceKeys.map((id) => applePacket.signals.find((item) => item.id === id).name)),
  `${JSON.stringify(appleEssence)} / ${JSON.stringify(appleFrame.primaryEvidenceKeys)}`);
check('clear apple evidence is eligible and generic machinery is not invented', appleEssence.includes('apple') && appleEssence.includes('fruit') && !appleEssence.includes('book'), JSON.stringify(appleEssence));
check('photos without OCR pass no fabricated OCR context', applePacket.ocr.status === 'none' && applePacket.ocr.lines.length === 0 && semantic.photoTopLevelEvidenceText(appleFrame).includes('no OCR text supplied'), JSON.stringify(applePacket.ocr));

const appleResolved = semantic.reconcilePhotoSemanticFrame(appleFrame, semanticResult('vision:apple', 'food'));
check('semantic LLM can lock a clear apple to the Food flow without a subject dictionary', appleResolved.stage === 'foundation_reconciled' && appleResolved.flowKey === 'food' && appleResolved.primarySubject === 'apple', JSON.stringify(appleResolved));
const appleRoute = analysis.normalizePhotoJournalEnumRoute({
  stage: 'enum_route', routeKey: 'food.snack', photoSchemaVersion: '13',
  specificEvidenceKey: 'vision:apple', specificEvidenceRole: 'concrete_subject',
}, applePacket, appleResolved);
check('validated Food child pass classifies a ready-to-eat apple as Snack', appleRoute.kind === 'exact' && appleRoute.selected?.id === 'food.snack', JSON.stringify(appleRoute));
check('Apple receives a grounded editable visual prefill',
  appleRoute.selected?.prefilledSpecific === 'Apple'
    && appleRoute.specificEvidence?.accepted === true
    && appleRoute.specificEvidence?.evidenceKey === 'vision:apple',
  JSON.stringify(appleRoute.specificEvidence));

const banana = photo([
  ['food', 0.984], ['banana', 0.984], ['fruit', 0.984], ['document', 0.365],
  ['book', 0.365], ['bookshelf', 0.3], ['library', 0.27],
], 'real_world', true);
const bananaPacket = evidence.buildPhotoJournalEvidence(banana.vision, banana.raw);
const bananaFrame = semantic.buildPhotoSemanticFrame(bananaPacket);
const bananaResolved = semantic.reconcilePhotoSemanticFrame(bananaFrame, semanticResult('vision:food', 'food'));
check('the lightweight top-level pass locks a dominant banana to Food',
  bananaResolved.stage === 'foundation_reconciled'
    && bananaResolved.foundation.status === 'used'
    && bananaResolved.flowKey === 'food'
    && bananaResolved.container.kind === 'none'
    && bananaResolved.unresolvedFacet === 'none',
  JSON.stringify(bananaResolved));
const bananaRoute = analysis.normalizePhotoJournalEnumRoute({
  stage: 'enum_route', routeKey: 'food.snack', photoSchemaVersion: '13',
  specificEvidenceKey: 'vision:banana', specificEvidenceRole: 'concrete_subject',
}, bananaPacket, bananaResolved);
check('repaired banana frame proceeds to the Food child pass and selects Snack', bananaRoute.kind === 'exact' && bananaRoute.selected?.id === 'food.snack', JSON.stringify(bananaRoute));
check('Banana receives a grounded editable visual prefill', bananaRoute.selected?.prefilledSpecific === 'Banana', JSON.stringify(bananaRoute.specificEvidence));

const bookCover = photo([
  ['tableware', 0.905], ['utensil', 0.905], ['sign', 0.559], ['document', 0.468],
  ['book', 0.468], ['chopsticks', 0.3], ['chalkboard', 0.3],
], 'real_world', true, 0, 0, [
  'THE PHENOMENAL', 'INTERNATIONAL BESTSELLER', 'STEPHEN HAWKING',
  'A BRIEF HISTORY OF TIME', 'FROM THE BIG BANG TO BLACK HOLES',
]);
const bookPacket = evidence.buildPhotoJournalEvidence(bookCover.vision, bookCover.raw);
const bookFrame = semantic.buildPhotoSemanticFrame(bookPacket);
check('top-level classification receives up to eight ranked visual observations while UI Essence remains four',
  bookFrame.primaryEvidenceKeys.length === 4
    && bookFrame.classificationEvidenceKeys.length > bookFrame.primaryEvidenceKeys.length
    && bookFrame.classificationEvidenceKeys.length <= 8,
  JSON.stringify({ visible: bookFrame.primaryEvidenceKeys, classification: bookFrame.classificationEvidenceKeys }));
check('coherent cover OCR is included only as bounded supporting evidence',
  bookPacket.ocr.status === 'included'
    && bookPacket.ocr.lines.some((line) => line.text === 'INTERNATIONAL BESTSELLER')
    && bookPacket.ocr.lines.length <= 12
    && bookPacket.ocr.includedCharacterCount <= 800
    && semantic.photoTopLevelEvidenceText(bookFrame).includes('never a primary evidence key'),
  JSON.stringify(bookPacket.ocr));
check('a Book primary paired with People is rejected instead of opening People & time',
  semantic.photoTopLevelDecisionIssue(bookFrame, semanticResult('vision:book', 'people'))?.includes('conflicts with explicit media evidence') === true,
  semantic.photoTopLevelDecisionIssue(bookFrame, semanticResult('vision:book', 'people')));
const recoveredBook = semantic.reconcilePhotoSemanticFrame(bookFrame, semanticResult('vision:book', 'media'));
check('the top-level pass may select a visible Book despite noisy higher-confidence labels',
  recoveredBook.stage === 'foundation_reconciled'
    && recoveredBook.primaryConceptKey === 'vision:book'
    && recoveredBook.domain === 'media'
    && recoveredBook.flowKey === 'studio'
    && recoveredBook.unresolvedFacet === 'none',
  JSON.stringify(recoveredBook));
const recoveredBookRoute = analysis.normalizePhotoJournalEnumRoute({
  stage: 'enum_route', routeKey: 'studio.book', photoSchemaVersion: '13',
  specificEvidenceKey: 'none', specificEvidenceRole: 'not_applicable',
}, bookPacket, recoveredBook);
check('the repaired Book frame continues through the locked Studio child pass',
  recoveredBookRoute.kind === 'exact' && recoveredBookRoute.selected?.id === 'studio.book',
  JSON.stringify(recoveredBookRoute));

for (const [label, routeKey, expected] of [
  ['pizza', 'food.meal', 'Pizza'],
  ['cake', 'food.dessert', 'Cake'],
  ['coffee', 'food.coffee', 'Coffee'],
]) {
  const itemPhoto = photo([['food', 0.95], [label, 0.91], ['meal', 0.72]]);
  const itemPacket = evidence.buildPhotoJournalEvidence(itemPhoto.vision, itemPhoto.raw);
  const itemFrame = semantic.reconcilePhotoSemanticFrame(
    semantic.buildPhotoSemanticFrame(itemPacket),
    semanticResult(`vision:${label}`, 'food')
  );
  const result = analysis.normalizePhotoJournalEnumRoute({
    stage: 'enum_route', routeKey, photoSchemaVersion: '13',
    specificEvidenceKey: `vision:${label}`, specificEvidenceRole: 'concrete_subject',
  }, itemPacket, itemFrame);
  check(`${expected} receives a dictionary-free visual prefill`, result.selected?.prefilledSpecific === expected, JSON.stringify(result.specificEvidence));
}

for (const [key, role] of [['vision:fruit', 'generic_class'], ['vision:hand', 'container']]) {
  const result = analysis.normalizePhotoJournalEnumRoute({
    stage: 'enum_route', routeKey: 'food.snack', photoSchemaVersion: '13',
    specificEvidenceKey: key, specificEvidenceRole: role,
  }, applePacket, appleResolved);
  check(`${role} evidence remains blank`, !result.selected?.prefilledSpecific && result.specificEvidence?.accepted === false, JSON.stringify(result.specificEvidence));
}

const cupPhoto = photo([['drink', 0.84], ['cup', 0.82], ['tableware', 0.74]]);
const cupPacket = evidence.buildPhotoJournalEvidence(cupPhoto.vision, cupPhoto.raw);
const cupFrame = semantic.reconcilePhotoSemanticFrame(semantic.buildPhotoSemanticFrame(cupPacket), semanticResult('vision:cup', 'food'));
const cupRoute = analysis.normalizePhotoJournalEnumRoute({
  stage: 'enum_route', routeKey: 'food.drink', photoSchemaVersion: '13',
  specificEvidenceKey: 'vision:cup', specificEvidenceRole: 'container',
}, cupPacket, cupFrame);
check('a cup can route within Food but never becomes the editable drink name', cupRoute.selected?.id === 'food.drink' && !cupRoute.selected?.prefilledSpecific, JSON.stringify(cupRoute.specificEvidence));

const absentSpecific = analysis.normalizePhotoJournalEnumRoute({
  stage: 'enum_route', routeKey: 'food.snack', photoSchemaVersion: '13',
  specificEvidenceKey: 'vision:pizza', specificEvidenceRole: 'concrete_subject',
}, applePacket, appleResolved);
check('absent specific evidence is rejected', !absentSpecific.selected?.prefilledSpecific && absentSpecific.specificEvidence?.reason === 'evidence_not_visible_or_eligible', JSON.stringify(absentSpecific.specificEvidence));

const backgroundSpecific = analysis.normalizePhotoJournalEnumRoute({
  stage: 'enum_route', routeKey: 'food.snack', photoSchemaVersion: '13',
  specificEvidenceKey: 'vision:document', specificEvidenceRole: 'concrete_subject',
}, bananaPacket, bananaResolved);
check('background-only specific evidence is rejected', !backgroundSpecific.selected?.prefilledSpecific && backgroundSpecific.specificEvidence?.reason === 'evidence_not_visible_or_eligible', JSON.stringify(backgroundSpecific.specificEvidence));

const weakFood = photo([['food', 0.95], ['apple', 0.59], ['fruit', 0.58]]);
const weakPacket = evidence.buildPhotoJournalEvidence(weakFood.vision, weakFood.raw);
const weakFrame = semantic.reconcilePhotoSemanticFrame(semantic.buildPhotoSemanticFrame(weakPacket), semanticResult('vision:food', 'food'));
const weakSpecific = analysis.normalizePhotoJournalEnumRoute({
  stage: 'enum_route', routeKey: 'food.snack', photoSchemaVersion: '13',
  specificEvidenceKey: 'vision:apple', specificEvidenceRole: 'concrete_subject',
}, weakPacket, weakFrame);
check('low-confidence specific evidence is rejected', !weakSpecific.selected?.prefilledSpecific && weakSpecific.specificEvidence?.reason === 'evidence_confidence_below_threshold', JSON.stringify(weakSpecific.specificEvidence));

const hallucinatedBook = semantic.reconcilePhotoSemanticFrame(appleFrame, semanticResult('vision:book', 'media'));
check('semantic pass rejects a Book primary absent from visible Essence evidence', hallucinatedBook.foundation.status === 'rejected' && hallucinatedBook.stage === 'evidence_prepared', JSON.stringify(hallucinatedBook.foundation));
const escapedFlow = analysis.normalizePhotoJournalEnumRoute({
  stage: 'enum_route', routeKey: 'studio.book', photoSchemaVersion: '13',
  specificEvidenceKey: 'vision:apple', specificEvidenceRole: 'concrete_subject',
}, applePacket, appleResolved);
check('child route can never escape the semantic pass locked flow', escapedFlow.kind === 'flow_only' && escapedFlow.selectedFlowId === 'food' && escapedFlow.reason === 'semantic_child_route_escaped_locked_flow', JSON.stringify(escapedFlow));
check('visual prefill is rejected when the child route escapes the locked flow', escapedFlow.specificEvidence?.accepted === false && escapedFlow.specificEvidence?.reason === 'child_route_escaped_locked_flow', JSON.stringify(escapedFlow.specificEvidence));

const city = photo([['outdoor', 0.97], ['city', 0.96], ['building', 0.96], ['skyscraper', 0.95], ['sky', 0.76]]);
const cityPacket = evidence.buildPhotoJournalEvidence(city.vision, city.raw);
const cityFrame = semantic.buildPhotoSemanticFrame(cityPacket);
const cityResolved = semantic.reconcilePhotoSemanticFrame(cityFrame, semanticResult('vision:city', 'place'));
const cityRoute = analysis.normalizePhotoJournalEnumRoute({
  stage: 'enum_route', routeKey: 'went_somewhere.city', photoSchemaVersion: '13',
  specificEvidenceKey: 'vision:city', specificEvidenceRole: 'concrete_subject',
}, cityPacket, cityResolved);
check('city requires the semantic pass and then opens only a city child', cityRoute.kind === 'exact' && cityRoute.selected?.id === 'went_somewhere.city', JSON.stringify(cityRoute));
check('visual text autofill stays disabled outside Food', !cityRoute.selected?.prefilledSpecific && cityRoute.specificEvidence?.reason === 'visual_prefill_not_enabled_for_flow', JSON.stringify(cityRoute.specificEvidence));

const television = photo([['screen content', 0.82], ['television', 0.59], ['computer monitor', 0.48]], 'screen_content', false, 0, 0, ['BREAKING NEWS', 'NEW YORK']);
const tvPacket = evidence.buildPhotoJournalEvidence(television.vision, television.raw);
const tvFrame = semantic.buildPhotoSemanticFrame(tvPacket);
check('lower-confidence Television remains visible beside screen content', evidence.photoJournalEssenceLabels(tvPacket).includes('television'), JSON.stringify(evidence.photoJournalEssenceLabels(tvPacket)));
check('screen OCR is supporting context without restoring a screen-specific child path', tvPacket.ocr.status === 'included' && tvPacket.ocr.reason === 'relevant_text_support', JSON.stringify(tvPacket.ocr));
const tvResolved = semantic.reconcilePhotoSemanticFrame(tvFrame, semanticResult('vision:television', 'media'));
const invalidTvPeople = semanticResult('vision:television', 'people');
check('an explicit Television primary can never be accepted with the People top level',
  semantic.photoTopLevelDecisionIssue(tvFrame, invalidTvPeople)?.includes('conflicts with explicit media evidence') === true
    && semantic.reconcilePhotoSemanticFrame(tvFrame, invalidTvPeople).foundation.status === 'rejected',
  semantic.photoTopLevelDecisionIssue(tvFrame, invalidTvPeople));
const tvQuestion = analysis.normalizePhotoJournalEnumRoute({ stage: 'enum_route', routeKey: 'studio.book', photoSchemaVersion: '13', specificEvidenceKey: 'none', specificEvidenceRole: 'not_applicable' }, tvPacket, tvResolved);
check('television uses the same broad Media section as every other media subject',
  tvQuestion.kind === 'flow_only' && tvQuestion.selectedFlowId === 'studio' && tvQuestion.candidates.length === 1,
  JSON.stringify(tvQuestion));

const peoplePhoto = photo([['person', 0.92], ['child', 0.86]], 'real_world', false, 1, 1);
const peoplePacket = evidence.buildPhotoJournalEvidence(peoplePhoto.vision, peoplePhoto.raw);
const peopleFrame = semantic.buildPhotoSemanticFrame(peoplePacket);
const peopleResolved = semantic.reconcilePhotoSemanticFrame(peopleFrame, semanticResult('vision:child', 'people'));
const peopleResult = analysis.normalizePhotoJournalEnumRoute({ stage: 'enum_route', routeKey: 'people.my_child', photoSchemaVersion: '13', specificEvidenceKey: 'none', specificEvidenceRole: 'not_applicable' }, peoplePacket, peopleResolved);
check('physical people remain a relationship chooser rather than an inferred relationship', peopleResult.kind === 'flow_only' && peopleResult.selectedFlowId === 'people', JSON.stringify(peopleResult));

const childWithShirtText = {
  vision: {
    concepts: [
      { name: 'child', peakConfidence: 0.9497 },
      { name: 'footwear', peakConfidence: 0.361 },
    ],
    details: ['child', 'document', 'clothing', 'footwear'],
    maxFaceCount: 1,
    dominantSubjectCoverage: 0.289,
    representation: { kind: 'real_world', confidence: 0.82, reasons: ['test'] },
  },
  raw: {
    labels: [
      { name: 'people', confidence: 0.9497 },
      { name: 'child', confidence: 0.9497 },
      { name: 'clothing', confidence: 0.361 },
      { name: 'footwear', confidence: 0.361 },
    ],
    text: ['PLAT', 'SAN', 'THE AMAZING'],
    recognizedText: [{ text: 'THE AMAZING', confidence: 1 }],
    faceCount: 1, humanCount: 1, humans: [{ x: 0.2, y: 0, width: 0.5, height: 0.8, confidence: 0.61 }],
    documentDetected: true, regionClassifications: [],
  },
};
const childPacket = evidence.buildPhotoJournalEvidence(childWithShirtText.vision, childWithShirtText.raw);
const childFrame = semantic.buildPhotoSemanticFrame(childPacket);
check('shirt OCR is suppressed when a real person is decisively dominant', childPacket.ocr.status === 'suppressed' && childPacket.ocr.reason === 'dominant_human_subject' && childPacket.ocr.lines.length === 0, JSON.stringify(childPacket.ocr));
check('detail-only document evidence is supporting-only and cannot become a primary subject',
  !childFrame.primaryEvidenceKeys.includes('vision:document')
    && childFrame.backgroundEvidenceKeys.includes('vision:document')
    && childFrame.hypotheses.find((item) => item.conceptKey === 'vision:document')?.primaryEligible === false,
  JSON.stringify(childFrame));
const resolvedChild = semantic.reconcilePhotoSemanticFrame(childFrame, semanticResult('vision:child', 'people'));
check('an explicit Child primary can never be accepted with a non-People top level',
  semantic.photoTopLevelDecisionIssue(childFrame, semanticResult('vision:child', 'place'))?.includes('conflicts with explicit people evidence') === true,
  semantic.photoTopLevelDecisionIssue(childFrame, semanticResult('vision:child', 'place')));
check('the shared top-level pass sends a strong child to People and leaves relationship unresolved',
  resolvedChild?.flowKey === 'people'
    && resolvedChild?.primarySubject === 'child'
    && resolvedChild?.container.kind === 'none'
    && resolvedChild?.representation.kind === 'physical_scene'
    && resolvedChild?.unresolvedFacet === 'relationship'
    && resolvedChild?.foundation.status === 'used',
  JSON.stringify(resolvedChild));

const printedPersonBook = photo([['book', 0.9], ['document', 0.88], ['person', 0.82]], 'real_world', true, 1, 1);
const printedPersonBookFrame = semantic.buildPhotoSemanticFrame(evidence.buildPhotoJournalEvidence(printedPersonBook.vision, printedPersonBook.raw));
check('printed-person context remains available to the top-level model as grounded Essence evidence',
  printedPersonBookFrame.primaryEvidenceKeys.includes('vision:book') && printedPersonBookFrame.primaryEvidenceKeys.includes('vision:person'),
  JSON.stringify(printedPersonBookFrame.primaryEvidenceKeys));
const personHoldingBook = photo([['person', 0.9], ['book', 0.8], ['document', 0.77]], 'real_world', true, 1, 1);
const personHoldingBookFrame = semantic.buildPhotoSemanticFrame(evidence.buildPhotoJournalEvidence(personHoldingBook.vision, personHoldingBook.raw));
check('a person and comparably supported book are both eligible for the separate ambiguity pass',
  personHoldingBookFrame.primaryEvidenceKeys.includes('vision:person') && personHoldingBookFrame.primaryEvidenceKeys.includes('vision:book'),
  JSON.stringify(personHoldingBookFrame.primaryEvidenceKeys));
const personBesideSign = photo([['person', 0.93], ['sign', 0.8], ['street', 0.62]], 'real_world', false, 1, 1, ['WELCOME TO YORK']);
const personBesideSignPacket = evidence.buildPhotoJournalEvidence(personBesideSign.vision, personBesideSign.raw);
check('background sign OCR cannot override a dominant real person', personBesideSignPacket.ocr.status === 'suppressed' && personBesideSignPacket.ocr.reason === 'dominant_human_subject', JSON.stringify(personBesideSignPacket.ocr));
const televisedPerson = photo([['person', 0.94], ['television', 0.83], ['screen content', 0.82]], 'screen_content', false, 1, 1);
const televisedPersonFrame = semantic.buildPhotoSemanticFrame(evidence.buildPhotoJournalEvidence(televisedPerson.vision, televisedPerson.raw));
check('screen representation is supplied alongside visible Essence so a televised person can be classified as Media',
  semantic.photoTopLevelEvidenceText(televisedPersonFrame).includes('screen_content'),
  semantic.photoTopLevelEvidenceText(televisedPersonFrame));
check('Person evidence may resolve to Media when a depiction container is also grounded',
  semantic.photoTopLevelDecisionIssue(televisedPersonFrame, semanticResult('vision:person', 'media')) === null
    && semantic.reconcilePhotoSemanticFrame(televisedPersonFrame, semanticResult('vision:person', 'media')).flowKey === 'studio',
  semantic.photoTopLevelDecisionIssue(televisedPersonFrame, semanticResult('vision:person', 'media')));
check('a secondary Person behind leading Television evidence cannot open People without substantial physical-human geometry',
  semantic.photoTopLevelDecisionIssue(televisedPersonFrame, semanticResult('vision:person', 'people'))?.includes('likely depicted inside the dominant media container') === true,
  semantic.photoTopLevelDecisionIssue(televisedPersonFrame, semanticResult('vision:person', 'people')));
const televisionRoom = photo([['television', 0.91], ['person', 0.84], ['cabinet', 0.52], ['conveyance', 0.41]], 'real_world', false, 0, 0);
const televisionRoomFrame = semantic.buildPhotoSemanticFrame(evidence.buildPhotoJournalEvidence(televisionRoom.vision, televisionRoom.raw));
const groundedTelevisionFallback = semantic.groundedPhotoTopLevelFallback(televisionRoomFrame, 'test invalid People result');
check('a failed model answer can recover only the first-ranked explicit Television anchor as Media',
  groundedTelevisionFallback?.primaryEvidenceKey === 'vision:television'
    && groundedTelevisionFallback?.topLevel === 'media',
  JSON.stringify(groundedTelevisionFallback));

const mixedFoodBook = photo([['food', 0.78], ['banana', 0.76], ['book', 0.72], ['document', 0.71]], 'real_world', true);
const mixedFoodBookSemantic = semanticResult('vision:food', 'ambiguous');
const mixedFoodBookAmbiguity = {
  primaryEvidenceKey: 'vision:food', primaryTopLevel: 'food',
  alternativeEvidenceKey: 'vision:book', alternativeTopLevel: 'media',
  rawResponse: { primaryEvidenceKey: 'vision:food', primaryTopLevel: 'food', alternativeEvidenceKey: 'vision:book', alternativeTopLevel: 'media' },
  durationMs: 5,
};

const semanticSource = fs.readFileSync(path.join(root, 'utils/photo-semantic-frame.ts'), 'utf8');
const foundationSource = fs.readFileSync(path.join(root, 'utils/foundation-scene.ts'), 'utf8');
const topLevelTaskSource = foundationSource.slice(
  foundationSource.indexOf('async function runPhotoSemanticFrameTask'),
  foundationSource.indexOf('function topLevelFailure')
);
const analysisSource = fs.readFileSync(path.join(root, 'utils/photo-journal-analysis.ts'), 'utf8');
const essenceReviewSource = fs.readFileSync(path.join(root, 'components/katchadeck/capture/essence-review.tsx'), 'utf8');
check('top-level routing derives flows from a constrained lightweight enum', semanticSource.includes('photoSemanticFlowForTopLevel') && foundationSource.includes("name: 'topLevel'"));
check('Foundation semantic primary is constrained to explicit eligible evidence ids', foundationSource.includes('frame.primaryEvidenceKeys') && foundationSource.includes('primaryEvidenceKey'));
check('the first Foundation pass cannot emit container, route, OCR, or supporting fields',
  topLevelTaskSource.includes("{ name: 'primaryEvidenceKey'")
    && topLevelTaskSource.includes("{ name: 'topLevel'")
    && !/name: '(container|routeKey|supportingEvidenceKey|specific|ocr)'/.test(topLevelTaskSource));
check('generic OCR values are rejected unless grounded in declared OCR indexes', foundationSource.includes('validateGenericJournalOcr') && foundationSource.includes('ocr_value_not_grounded_in_declared_indexes'));
check('route pass receives only children of the locked flow', foundationSource.includes("filter((entry) => entry.flowId === semanticFrame.flowKey)"));
check('photo routing never calls the note-prose classifier', !foundationSource.includes('classifyNoteRouteAsync(input)'));
check('live photo analysis contains no numeric candidate mapping', !/candidateIndex|classifyPhotoJournalFlow|classifyPhotoJournalCategory/.test(analysisSource));
check('live photo analysis stops after top-level classification and never invokes the child-route model', !analysisSource.includes('classifyPhotoJournalEnumOnDevice'));
check('photo review contains no screen-only confirmation path', !essenceReviewSource.includes('televisionConfirmation') && !essenceReviewSource.includes('What were you watching?'));
check('back from a detected section enters journal top level before returning to the photo', !essenceReviewSource.includes('returnToOriginOnBack={!!journalFlowId}'));
check('top-level prompt treats detector confidence as recognition rather than semantic priority', topLevelTaskSource.includes('detector recognition confidence') && topLevelTaskSource.includes('A physical book or document'));
check('top-level prompt labels OCR as untrusted supporting-only image text', topLevelTaskSource.includes('Raw OCR may be supplied') && topLevelTaskSource.includes('never a primary subject') && topLevelTaskSource.includes('Use OCR only to explain or reconcile'));
check('top-level prompt distinguishes outer real-world capture from people depicted inside media', topLevelTaskSource.includes('real_world can still contain a television') && topLevelTaskSource.includes('Resolve containment before subject identity') && topLevelTaskSource.includes('A person depicted on media is not a People memory'));
check('top-level diagnostics record visual and OCR envelope decisions', topLevelTaskSource.includes('evidenceEnvelope') && topLevelTaskSource.includes('ocrStatus') && topLevelTaskSource.includes('ocrReason') && topLevelTaskSource.includes('ocrLineCount'));
check('top-level bridge rejects semantically inconsistent field pairs before reconciliation', topLevelTaskSource.includes('photoTopLevelDecisionIssue(frame, decision)') && topLevelTaskSource.includes("topLevelFailure('invalid_output'"));
check('grounded cross-flow ambiguity has user-facing question copy', essenceReviewSource.includes('What is this photo mainly about?'));

void (async () => {
  global.__foundationPhotoAvailable = true;
  global.__photoSchemaReady = true;
  global.__semanticCalls = 0;
  global.__enumCalls = 0;
  global.__semanticRaw = semanticResult('vision:apple', 'food');
  global.__enumRaw = { stage: 'enum_route', routeKey: 'food.snack', photoSchemaVersion: '13', specificEvidenceKey: 'vision:apple', specificEvidenceRole: 'concrete_subject' };
  const endToEndApple = await analysis.analyzePhotoJournal(apple.vision, apple.raw);
  check('every supported photo stops after one semantic top-level pass', global.__semanticCalls === 1 && global.__enumCalls === 0 && endToEndApple.kind === 'flow_only' && endToEndApple.selectedFlowId === 'food' && endToEndApple.selected === null, JSON.stringify(endToEndApple));

  global.__enrichmentCalls = 0;
  await analysis.enrichPhotoJournalRoute(appleRoute.selected, appleRoute.visualSubject, apple.vision, apple.raw);
  check('accepted Food visual prefill skips OCR enrichment', global.__enrichmentCalls === 0, String(global.__enrichmentCalls));

  global.__enrichmentRaw = { disposition: 'use', specific: 'Soup of the day', confidence: '0.8', lockedRouteKey: 'food.snack' };
  const foodWithoutVisualPrefill = { ...appleRoute.selected };
  delete foodWithoutVisualPrefill.prefilledSpecific;
  const foodOcrFallback = await analysis.enrichPhotoJournalRoute(foodWithoutVisualPrefill, appleRoute.visualSubject, apple.vision, apple.raw);
  check('Food without an accepted visual value retains route-locked OCR enrichment', global.__enrichmentCalls === 1 && foodOcrFallback?.value === 'Soup of the day', JSON.stringify(foodOcrFallback));

  global.__enrichmentRaw = { disposition: 'used', specific: 'The Phenomenal', confidence: '1', lockedRouteKey: 'food.snack' };
  const mismatchedBookEnrichment = await analysis.enrichPhotoJournalRoute(recoveredBookRoute.selected, 'book', bookCover.vision, bookCover.raw);
  check('OCR enrichment from a different locked route can never populate a Book field', mismatchedBookEnrichment === null, JSON.stringify(mismatchedBookEnrichment));

  global.__enrichmentRaw = {
    disposition: 'used', specific: 'A Brief History of Time', confidence: '0.62',
    lockedRouteKey: 'studio.book', semanticRole: 'official_book_title', usedOcrIndexes: '2,3,4',
  };
  const groundedLowConfidenceBookTitle = await analysis.enrichPhotoJournalRoute(recoveredBookRoute.selected, 'book', bookCover.vision, bookCover.raw);
  check('a validated official Book title is editable prefill even below the generic confidence threshold',
    groundedLowConfidenceBookTitle?.value === 'A Brief History of Time'
      && groundedLowConfidenceBookTitle?.prefill === true,
    JSON.stringify(groundedLowConfidenceBookTitle));

  global.__semanticRaw = {
    failureKind: 'technical', durationMs: 3,
    rawResponse: { status: 'failed', errorCode: 'generation_failed', errorDescription: 'temporary model failure' },
    reason: 'generation_failed: temporary model failure',
  };
  global.__topLevelRetryRaw = semanticResult('vision:book', 'media');
  global.__enumRaw = { stage: 'enum_route', routeKey: 'studio.book', photoSchemaVersion: '13', specificEvidenceKey: 'none', specificEvidenceRole: 'not_applicable' };
  global.__technicalRetryCalls = 0;
  global.__repairCalls = 0;
  global.__ambiguityCalls = 0;
  const retriedBook = await analysis.analyzePhotoJournal(bookCover.vision, bookCover.raw);
  check('a technical top-level failure retries the same task and still opens an obvious grounded Book',
    global.__technicalRetryCalls === 1
      && global.__repairCalls === 0
      && global.__ambiguityCalls === 0
      && global.__enumCalls === 0
      && retriedBook.kind === 'flow_only'
      && retriedBook.selectedFlowId === 'studio'
      && retriedBook.selected === null,
    JSON.stringify(retriedBook));
  global.__topLevelRetryRaw = null;

  global.__semanticRaw = {
    failureKind: 'invalid_output', durationMs: 4,
    rawResponse: { primaryEvidenceKey: 'vision:book', topLevel: 'people' },
    reason: 'Foundation top level people conflicts with explicit media evidence vision:book',
  };
  global.__repairRaw = semanticResult('vision:book', 'media');
  global.__repairCalls = 0;
  global.__repairArgs = null;
  global.__enumCalls = 0;
  const repairedBookPeopleMismatch = await analysis.analyzePhotoJournal(bookCover.vision, bookCover.raw);
  check('an inconsistent Book plus People result is repaired with Book locked and opens only Media',
    global.__repairCalls === 1
      && global.__repairArgs?.[3] === 'vision:book'
      && global.__enumCalls === 0
      && repairedBookPeopleMismatch.kind === 'flow_only'
      && repairedBookPeopleMismatch.selectedFlowId === 'studio',
    JSON.stringify(repairedBookPeopleMismatch));
  global.__repairRaw = null;

  global.__semanticRaw = {
    failureKind: 'invalid_output', durationMs: 4,
    rawResponse: { primaryEvidenceKey: 'vision:person', topLevel: 'people' },
    reason: 'Foundation selected People for person evidence likely depicted inside the dominant media container',
  };
  global.__repairRaw = {
    failureKind: 'invalid_output', durationMs: 4,
    rawResponse: { primaryEvidenceKey: 'vision:person', topLevel: 'people' },
    reason: 'Foundation selected People for person evidence likely depicted inside the dominant media container',
  };
  global.__repairCalls = 0;
  global.__repairArgs = null;
  const recoveredTelevisionRoom = await analysis.analyzePhotoJournal(televisionRoom.vision, televisionRoom.raw);
  check('a televised Person rejection lets repair reconsider the primary and cannot regress to unclassified',
    global.__repairCalls === 1
      && global.__repairArgs?.[3] === null
      && recoveredTelevisionRoom.kind === 'flow_only'
      && recoveredTelevisionRoom.selectedFlowId === 'studio'
      && recoveredTelevisionRoom.semanticFrame?.foundation.attempts.some((attempt) => attempt.kind === 'grounded_fallback' && attempt.status === 'used'),
    JSON.stringify(recoveredTelevisionRoom));
  global.__repairRaw = null;

  global.__semanticRaw = mixedFoodBookSemantic;
  global.__ambiguityRaw = mixedFoodBookAmbiguity;
  global.__ambiguityCalls = 0;
  global.__repairRaw = null;
  global.__enumCalls = 0;
  const genuineAmbiguity = await analysis.analyzePhotoJournal(mixedFoodBook.vision, mixedFoodBook.raw);
  check('genuinely close Food and Book evidence becomes a grounded cross-flow question',
    genuineAmbiguity.kind === 'ambiguous'
      && genuineAmbiguity.reason === 'grounded_semantic_cross_flow_ambiguity'
      && JSON.stringify(genuineAmbiguity.candidates.map((candidate) => [candidate.label, candidate.flowId])) === JSON.stringify([['Food', 'food'], ['Book', 'studio']]),
    JSON.stringify(genuineAmbiguity));
  check('accepted cross-flow ambiguity uses one separate grounded pass and stops before either child-route pass', global.__ambiguityCalls === 1 && global.__enumCalls === 0, `${global.__ambiguityCalls}/${global.__enumCalls}`);

  global.__semanticRaw = semanticResult('vision:child', 'people');
  global.__repairRaw = null;
  global.__semanticCalls = 0;
  global.__repairCalls = 0;
  global.__ambiguityCalls = 0;
  global.__enumCalls = 0;
  const recoveredChild = await analysis.analyzePhotoJournal(childWithShirtText.vision, childWithShirtText.raw);
  check('a decisive child uses the same lightweight semantic pass, skips child routing, and opens People',
    global.__semanticCalls === 1
      && global.__repairCalls === 0
      && global.__ambiguityCalls === 0
      && global.__enumCalls === 0
      && recoveredChild.kind === 'flow_only'
      && recoveredChild.selectedFlowId === 'people'
      && recoveredChild.selected === null
      && recoveredChild.semanticFrame?.foundation.status === 'used'
      && recoveredChild.semanticFrame?.subjectAnchor?.topLevel === 'people',
    JSON.stringify(recoveredChild));
  global.__enrichmentCalls = 0;
  const peopleRoute = require(registry).manualJournalFlow('people').choices.find((item) => item.id === 'my_child');
  const peopleProposal = { id: 'people.my_child', flowId: 'people', choiceId: peopleRoute.id, label: peopleRoute.label, confidence: 1, reasons: [], confirmedFacets: [] };
  const peopleOcr = await analysis.enrichPhotoJournalRoute(peopleProposal, 'child', childWithShirtText.vision, childWithShirtText.raw);
  const ordinaryProposal = { id: 'general.ordinary', flowId: 'general', choiceId: 'ordinary', label: 'An ordinary moment', confidence: 1, reasons: [], confirmedFacets: [] };
  const ordinaryOcr = await analysis.enrichPhotoJournalRoute(ordinaryProposal, 'child', childWithShirtText.vision, childWithShirtText.raw);
  check('People and ordinary routes never run OCR or copy shirt slogans into the journal field',
    global.__enrichmentCalls === 0 && peopleOcr === null && ordinaryOcr === null,
    String(global.__enrichmentCalls));

  global.__foundationPhotoAvailable = false;
  global.__semanticCalls = 0;
  global.__enumCalls = 0;
  const unavailable = await analysis.analyzePhotoJournal(city.vision, city.raw);
  check('semantic-model unavailability preserves Essence and falls back manually instead of guessing', unavailable.kind === 'unrouted' && unavailable.reason === 'semantic_frame_unavailable' && global.__semanticCalls === 0 && global.__enumCalls === 0, JSON.stringify(unavailable));

  global.__foundationPhotoAvailable = true;
  global.__semanticRaw = semanticResult('vision:city', 'place');
  global.__enumCalls = 0;
  const routeFailure = await analysis.analyzePhotoJournal(city.vision, city.raw);
  check('Place stops at its locked broad section without running a child pass', routeFailure.kind === 'flow_only' && routeFailure.selectedFlowId === 'went_somewhere' && global.__enumCalls === 0, JSON.stringify(routeFailure));

  if (failures) { console.log(`\n${failures} photo-journal routing check(s) FAILED.`); process.exit(1); }
  console.log('\nAll photo-journal routing checks passed.');
})().catch((error) => { console.error(error); process.exit(1); });
