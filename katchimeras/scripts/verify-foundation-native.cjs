const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const swiftPath = path.join(root, 'modules', 'katchimera-foundation', 'ios', 'KatchimeraFoundationModule.swift');
const easPath = path.join(root, 'eas.json');
const foundationNotePath = path.join(root, 'utils', 'foundation-note.ts');
const intelligenceLabPath = path.join(root, 'app', 'intelligence-lab.tsx');
const manualJournalPath = path.join(root, 'components', 'katchadeck', 'home', 'manual-journal-sheet.tsx');
const foundationScenePath = path.join(root, 'utils', 'foundation-scene.ts');
const photoJournalAnalysisPath = path.join(root, 'utils', 'photo-journal-analysis.ts');
const generatedNotePath = path.join(root, 'modules', 'katchimera-foundation', 'ios', 'JournalNoteRoute.generated.swift');
const swift = fs.readFileSync(swiftPath, 'utf8');
const generatedNote = fs.readFileSync(generatedNotePath, 'utf8');
const allSwift = `${swift}\n${generatedNote}`;
const foundationNote = fs.readFileSync(foundationNotePath, 'utf8');
const intelligenceLab = fs.readFileSync(intelligenceLabPath, 'utf8');
const manualJournal = fs.readFileSync(manualJournalPath, 'utf8');
const foundationScene = fs.readFileSync(foundationScenePath, 'utf8');
const photoJournalAnalysis = fs.readFileSync(photoJournalAnalysisPath, 'utf8');
const lines = swift.split(/\r?\n/);

let failures = 0;
function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ok  ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

check(
  'photo Foundation stages allow a full 15 seconds before fallback',
  photoJournalAnalysis.includes('const MODEL_STAGE_TIMEOUT_MS = 15_000')
    && !photoJournalAnalysis.includes('const MODEL_TIMEOUT_MS = 5000')
);

function sourceForFoundationAvailability(enabled) {
  const stack = [];
  let active = true;
  const kept = [];
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed === '#if canImport(FoundationModels)') {
      stack.push({ active, line: index + 1 });
      active = active && enabled;
      return;
    }
    if (trimmed === '#endif') {
      if (stack.length === 0) throw new Error(`Unmatched #endif at line ${index + 1}`);
      active = stack.pop().active;
      return;
    }
    if (active) kept.push(line);
  });
  if (stack.length > 0) throw new Error(`Unclosed #if from line ${stack.at(-1).line}`);
  return kept.join('\n');
}

function stripStringsAndComments(source) {
  return source
    .replace(/"""[\s\S]*?"""/g, '')
    .replace(/"(?:\\.|[^"\\])*"/g, '')
    .replace(/\/\/.*$/gm, '');
}

function braceAudit(source) {
  const clean = stripStringsAndComments(source);
  let depth = 0;
  let minimum = 0;
  for (const character of clean) {
    if (character === '{') depth += 1;
    if (character === '}') depth -= 1;
    minimum = Math.min(minimum, depth);
  }
  return { depth, minimum };
}

let withoutFoundation = '';
let withFoundation = '';
try {
  withoutFoundation = sourceForFoundationAvailability(false);
  withFoundation = sourceForFoundationAvailability(true);
  check('conditional compilation directives are balanced', true);
} catch (error) {
  check('conditional compilation directives are balanced', false, error.message);
}

for (const [name, source] of [['without FoundationModels', withoutFoundation], ['with FoundationModels', withFoundation]]) {
  const result = braceAudit(source);
  check(`${name} braces are balanced`, result.depth === 0 && result.minimum === 0, JSON.stringify(result));
}
const generatedBraceResult = braceAudit(generatedNote);
check('generated note schema braces are balanced', generatedBraceResult.depth === 0 && generatedBraceResult.minimum === 0, JSON.stringify(generatedBraceResult));

const forbiddenXcode26Tokens = [
  ['Attachment(', 'direct image attachments require a newer SDK'],
  ['samplingMode:', 'Xcode 26 expects the older GenerationOptions API'],
  ['@available(iOS 27', 'iOS 27-only source must not be compiled by the Xcode 26 profile'],
  ['readMemoryImageAsync', 'the removed image API must not remain registered natively'],
];
for (const [token, reason] of forbiddenXcode26Tokens) {
  check(`Xcode 26 source excludes ${token}`, !swift.includes(token), reason);
}

const requiredExports = [
  'isAvailable',
  'availabilityInfo',
  'generateStructuredAsync',
  'suggestMeaningsAsync',
  'interpretNoteAsync',
  'classifyNoteRouteAsync',
  'classifyPhotoRouteAsync',
  'interpretPhotoSemanticsAsync',
  'readMemoryAsync',
  'readMemoryV2Async',
  'classifyPhotoAnchorAsync',
  'enrichPhotoOcrAsync',
  'rankPhotoJournalCandidatesAsync',
  'enrichPhotoJournalAsync',
  'readSceneAsync',
  'classifySceneAsync',
];
for (const name of requiredExports) {
  check(`native export ${name} is registered`, swift.includes(`("${name}")`));
}

const requiredTypes = [
  'MemoryRead',
  'MeaningOptionList',
  'NoteRead',
  'PhotoVisualAnchor',
  'PhotoOcrEnrichment',
  'PhotoJournalCandidateDecision',
  'PhotoJournalFieldEnrichment',
  'PhotoJournalBookFieldEnrichment',
  'SceneDeepRead',
  'SceneClassification',
];
for (const name of requiredTypes) {
  check(`generated type ${name} exists`, new RegExp(`(?:struct|class)\\s+${name}\\b`).test(allSwift));
}

check('NoteRead remains a small enrichment response',
  ['title', 'feeling', 'mediaKind', 'mediaTitle', 'mediaCreator', 'food'].every((field) => new RegExp(`let\\s+${field}:\\s+String`).test(generatedNote))
    && !/struct NoteRead[\s\S]*?let routeKey: String[\s\S]*?\n}/.test(generatedNote));
check('availability diagnostics expose split-call note schema v5', swift.includes('"noteSchemaVersion": JournalNoteRouteCatalog.schemaVersion') && generatedNote.includes('schemaVersion = "5"'));
check('route-only decision constrains atomic routes from every flow', ['went_somewhere.museum', 'food.meal', 'studio.film', 'movement.workout', 'people.my_child', 'work.learning', 'big_event.newHome', 'general.gratitude'].every((id) => generatedNote.includes(`"${id}"`)));
check('focused retry uses the same generated taxonomy', swift.includes('classifyNoteRoute(transcript:') && swift.includes('JournalNoteRouteCatalog.promptTaxonomy'));
check('focused route returns the generated journal field text',
  /struct NoteRouteDecision[\s\S]*?let specific: String[\s\S]*?\n}/.test(generatedNote)
    && swift.includes('"specific": response.content.specific'));
check('note routing uses two bounded Foundation tasks before the legacy focused call',
  foundationNote.includes("taskId: 'note.flow.v1'")
    && foundationNote.includes("taskId: 'note.child-route.v1'")
    && foundationNote.includes('Compatibility only for native clients predating the generic structured'));
check('the split Foundation route supersedes retired combined routing fields',
  foundationNote.includes('focusedAtomic ? null : firstAtomic')
    && foundationNote.includes('focusedAtomic,\n      { includeRegistryEvidence'));
check('note navigation is resolved before optional rich enrichment',
  foundationNote.indexOf('classifyNoteRouteOnDevice(text') < foundationNote.indexOf('nativeFoundation.interpretNoteAsync(text)')
    && foundationNote.includes('foundation_note_read_skipped_after_route'));
check('note child routing receives only children of the locked flow',
  foundationNote.includes('JOURNAL_CLASSIFICATION_CATALOG.filter((entry) => entry.flowId === flow.id)')
    && foundationNote.includes('The broad journal section ${flow.id} is already selected and immutable'));
check('note child routing cannot author the editable field',
  foundationNote.includes("fields: [{ name: 'routeKey', description: `Best route inside the locked ${flow.id} section`")
    && foundationNote.includes('Choose one route.`'));
check('note field extraction runs after the journal composer opens',
  foundationNote.includes('export async function extractNoteSpecificOnDevice(')
    && manualJournal.includes('void extractNoteSpecificOnDevice(transcript')
    && manualJournal.includes('setNoteSpecificLoading(true)')
    && manualJournal.includes('specificEditedRef.current'));
check('an empty enrichment response can retain a successful Foundation route',
  foundationNote.includes('if (!richResponseValid && !journalClassification) return null')
    && foundationNote.includes('missing_or_invalid_label_or_archetype')
    && foundationNote.includes('_split_route_used'));
check('older note builds receive route-locked Foundation field enrichment',
  foundationNote.includes("taskId: 'note.specific.v1'")
    && foundationNote.includes('The supplied journal route is already selected and immutable')
    && foundationNote.includes('never the whole note'));
check('availability diagnostics expose generic-bridge photo schema v13', swift.includes('"photoSchemaVersion": JournalNoteRouteCatalog.photoSchemaVersion') && generatedNote.includes('photoSchemaVersion = "13"') && swift.includes('"structuredBridgeVersion": "1"'));
check('generic native bridge accepts bounded runtime string and enum schemas',
  swift.includes('AsyncFunction("generateStructuredAsync")')
    && swift.includes('request.fields.count <= 16')
    && swift.includes('DynamicGenerationSchema(type: String.self)')
    && swift.includes('field.kind == "enum"')
    && swift.includes('requestJson.utf8.count <= 64_000'));
check('active photo passes use the generic bridge with specialized compatibility fallbacks',
  foundationScene.includes("mode === 'primary' ? 'photo.top-level.v2' : mode === 'retry' ? 'photo.top-level.retry.v2' : 'photo.top-level.repair.v2'")
    && foundationScene.includes("name: 'topLevel'")
    && foundationScene.includes("taskId: 'photo.top-level-ambiguity.v1'")
    && foundationScene.includes("compatibilityFallback: 'interpretPhotoSemanticsAsync'")
    && !foundationScene.includes("name: 'flowKey', description: 'Broad journal flow for primary subject'")
    && foundationScene.includes("runGenericRouteTask(evidence, 'photo.child-route.v1')")
    && foundationScene.includes("'photo.book-ocr.v1'")
    && foundationScene.includes('generateStructuredTask('));
check('photo journal bridge receives taxonomy and prompts dynamically', swift.includes('taskInstructions: String') && swift.includes('candidateIds: [String]') && swift.includes('candidateDescriptions: [String]'));
check('live photo routing uses the generic task bridge with a bounded route enum', foundationScene.includes('runGenericRouteTask') && foundationScene.includes("name: 'routeKey'") && foundationScene.includes("outputSchema: 'PhotoRouteDecision.routeKey'"));
check('photo route schema is restricted at runtime to evidence-supported route keys', swift.includes('DynamicGenerationSchema(name: "routeKey", anyOf: allowedRouteKeys)') && swift.includes('JournalNoteRouteCatalog.routeKeys.contains(cleanKey)'));
const photoRouteMethod = swift.slice(swift.indexOf('private static func classifyPhotoRoute'), swift.indexOf('private static func suggest'));
check('photo route prompt treats input as visual evidence rather than note prose', photoRouteMethod.includes('The input is') && photoRouteMethod.includes('visual evidence, never journal prose') && !photoRouteMethod.includes('The note says:'));
check('photo route output contains no model-authored confidence fields', !photoRouteMethod.includes('routeConfidence'));
check('photo route v10 constrains editable values to supplied visible Essence evidence IDs',
  photoRouteMethod.includes('specificEvidenceKeys: [String]')
    && photoRouteMethod.includes('anyOf: allowedSpecificEvidenceKeys')
    && photoRouteMethod.includes('specificEvidenceRole')
    && photoRouteMethod.includes('concrete_subject')
    && photoRouteMethod.includes('generic_class')
    && photoRouteMethod.includes('container'));
const photoSemanticMethod = swift.slice(swift.indexOf('private static func interpretPhotoSemantics'), swift.indexOf('private static func suggest'));
check('semantic pass constrains the primary to direct visible evidence ids', photoSemanticMethod.includes('anyOf: primaryEvidenceKeys') && photoSemanticMethod.includes('confidence and no atomic child route') && !photoSemanticMethod.includes('name: "routeKey"'));
check('semantic pass cannot author confidence', !photoSemanticMethod.includes('name: "confidence"') && !photoSemanticMethod.includes('"confidence":'));
check('semantic pass preserves unresolved media and relationship facets', photoSemanticMethod.includes('media_type') && photoSemanticMethod.includes('device_activity') && photoSemanticMethod.includes('relationship'));
check('semantic pass exposes only a grounded visible cross-flow alternative',
  photoSemanticMethod.includes('name: "alternativeEvidenceKey"')
    && photoSemanticMethod.includes('anyOf: allowedAlternativeEvidence')
    && photoSemanticMethod.includes('name: "alternativeDomain"')
    && photoSemanticMethod.includes('name: "alternativeFlowKey"')
    && photoSemanticMethod.includes('dominant corroborated cluster such as food + banana + fruit'));
check('stable photo bridge accepts the complete catalog without another taxonomy rebuild', generatedNote.includes('.range(0...127)') && swift.includes('candidateIds.count <= 128'));
check('photo journal output uses one stable bounded-index schema', generatedNote.includes('struct PhotoJournalCandidateDecision') && generatedNote.includes('let candidateIndex: Int') && !generatedNote.includes('PhotoJournalFlowDecision') && !generatedNote.includes('CategoryDecision'));
check('photo journal repair sees broken indexed output without vision evidence', swift.includes('Invalid object: \\(broken)') && swift.includes('Repair only this object') && swift.includes('Valid candidate indexes'));
check('photo journal failures return a typed envelope instead of an empty dictionary', swift.includes('"status": "technical_failure"') && swift.includes('errorCode') && swift.includes('attemptsJson'));
check('photo journal retries are bounded and error-aware', swift.includes('simplifiedPhotoJournalRetry') && swift.includes('photoJournalErrorIsRetryable') && swift.includes('code == "decoding_failure"'));
check('photo journal bridge maps validated indexes back to app candidate IDs', swift.includes('candidateIds[index]') && swift.includes('candidateCount: candidateIds.count'));
check('photo journal confidence policy is delegated to JavaScript', swift.includes('"status": "ranked"') && !swift.includes('candidateScore >= 0.82'));
for (const helper of ['photoJournalNoEvidence', 'photoJournalFailure']) {
  check(`iOS 26 catalog helper ${helper} carries an availability guard`, new RegExp(`@available\\(iOS 26\\.0, \\*\\)\\s+private static func ${helper}\\b`).test(swift));
}
check('photo journal OCR schema cannot change the selected route', swift.includes('Locked journal route: \\(routeKey)') && !/struct PhotoJournalFieldEnrichment\s*\{[\s\S]*?let\s+routeKey\s*:/.test(swift));
check('photo journal OCR tuning is supplied dynamically by JavaScript', swift.includes('App-supplied field rules:') && foundationScene.includes('Prefer the official main title or named subject'));
check(
  'book OCR separates title, author, and marketing copy before selecting the field',
  swift.includes('generating: PhotoJournalBookFieldEnrichment.self')
    && swift.includes('routeKey == "media.book"')
    && swift.includes('routeKey == "studio.book"')
    && swift.includes('let marketingCopy: String')
    && swift.includes('let usedTitleOcrIndexes: String')
    && foundationScene.includes('Separate the cover text into: official book title, optional subtitle, author, and endorsement or marketing copy')
);
check(
  'book OCR regression rejects bestseller copy in favor of the supported work title',
  foundationScene.includes('international bestseller')
    && foundationScene.includes('return “A Brief History of Time”')
    && swift.includes('bookTitleLooksLikeMarketing')
    && swift.includes('title_indexes_overlap_author_subtitle_or_marketing')
    && swift.includes('photo-journal-book-ocr-v5-ios26-repair')
);
check('journal OCR responses carry the immutable route identity',
  swift.includes('"lockedRouteKey": routeKey')
    && photoJournalAnalysis.includes('lockedRouteKey !== route.id')
    && photoJournalAnalysis.includes('routeKey: route.id'));
check(
  'photo visual anchor withholds OCR',
  swift.includes('OCR is intentionally withheld')
    && swift.includes('classifyPhotoAnchor(')
    && swift.includes('ocrPurpose')
);
check(
  'photo OCR enrichment receives a locked route',
  swift.includes('Locked route: \\(routeKey)')
    && swift.includes('Enrich without reclassifying')
    && !/struct PhotoOcrEnrichment\s*\{[\s\S]*?let\s+routeKey\s*:/.test(swift)
);
check(
  'photo anchor enforces the visual people gate',
  swift.includes('content.routeKey == "people" && faceCount == 0 && humanCount == 0 && !hasHumanRegion')
);

for (const token of ['saveDevLastNoteAnalysis', "'timeout'", 'rawResponse', 'normalizedClassification']) {
  check(`note diagnostics capture ${token}`, foundationNote.includes(token));
}
for (const token of ['loadDevLastNoteAnalysis', 'Last note analysis', 'Share note JSON']) {
  check(`Intelligence Lab exposes ${token}`, intelligenceLab.includes(token));
}
check(
  'uncertain note routes render ranked journal suggestions',
  manualJournal.includes('Suggested for this note')
    && manualJournal.includes('const suggestions = useMemo')
    && manualJournal.includes('[...voiceRoutes, ...suggestedRoutes]')
    && manualJournal.includes('.slice(0, 3)')
);

const staticDeclarations = [...withFoundation.matchAll(/private static func\s+(\w+)/g)].map((match) => match[1]);
const expectedStaticDeclarations = [
  'classifyPhotoAnchor',
  'enrichPhotoOcr',
  'rankPhotoJournalCandidates',
  'enrichPhotoJournal',
  'runPhotoJournalStage',
  'simplifiedPhotoJournalRetry',
  'photoJournalDecisionIssue',
  'photoJournalStageResult',
  'photoJournalFailure',
  'photoAnchorValidationIssue',
  'photoAnchorResult',
  'ocrValueIsSupported',
  'normalizedOcrComparisonValue',
  'readMemory',
  'memoryResult',
  'interpretNote',
  'classifyNoteRoute',
  'classifyPhotoRoute',
  'interpretPhotoSemantics',
  'suggest',
  'readScene',
  'classifyScene',
];
check(
  'all expected private methods remain inside the module source',
  expectedStaticDeclarations.every((name) => staticDeclarations.includes(name)),
  staticDeclarations.join(', ')
);

const eas = JSON.parse(fs.readFileSync(easPath, 'utf8'));
check(
  'development builds pin the Xcode 26 image',
  eas?.build?.development?.ios?.image === 'macos-sequoia-15.6-xcode-26.0',
  String(eas?.build?.development?.ios?.image)
);

if (failures > 0) {
  console.error(`\n${failures} Foundation native preflight check(s) failed.`);
  process.exit(1);
}
console.log('\nFoundation native preflight checks passed.');
