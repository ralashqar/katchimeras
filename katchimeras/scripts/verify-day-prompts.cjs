// Node-only verification harness for the daily prompt selector. No test runner
// in this project: transpile pure modules with TypeScript and run the product
// selection scenarios. Usage: node scripts/verify-day-prompts.cjs
const fs = require('fs');
const path = require('path');
const Module = require('module');
const os = require('os');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-prompts-'));

function transpileToTemp(relativeSourcePath, outName) {
  const source = fs.readFileSync(path.join(projectRoot, relativeSourcePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const outPath = path.join(tempDir, outName);
  fs.writeFileSync(outPath, output);
  return outPath;
}

const promptsPath = transpileToTemp('constants/day-prompts.ts', 'day-prompts.js');
const enginePath = transpileToTemp('utils/day-prompt-engine.ts', 'day-prompt-engine.js');

const stubs = {
  '@/constants/day-prompts': promptsPath,
  '@/types/home': {},
};

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request in stubs) {
    const stub = stubs[request];
    if (typeof stub === 'string') return stub;
    const stubFile = path.join(tempDir, `${request.replace(/[@/]/g, '_')}.js`);
    if (!fs.existsSync(stubFile)) {
      fs.writeFileSync(stubFile, `module.exports = ${JSON.stringify(stub)};`);
    }
    return stubFile;
  }
  return originalResolve.call(this, request, ...rest);
};

const promptEngine = require(enginePath);
const dayPrompts = require(promptsPath);

function makeDay(overrides = {}) {
  return {
    id: 'day-2026-06-17',
    isoDate: '2026-06-17',
    state: 'forming',
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

function promptAnswer(kind, dismissed = false) {
  return {
    id: `prompt-${kind}`,
    kind,
    choiceIds: dismissed ? [] : ['x'],
    labels: dismissed ? [] : ['X'],
    createdAt: '2026-06-17T12:00:00.000Z',
    dismissed,
    source: 'prompt_chip',
    semanticTags: [],
    scoreBias: {},
    encounterSeedBias: [],
  };
}

function photoPoint(index, dayIsoDate = '2026-06-17', source = 'day_record') {
  return {
    id: `camera-roll-photo-asset-${index}`,
    lat: 51,
    lng: -0.1,
    capturedAt: `${dayIsoDate}T1${index}:00:00.000Z`,
    dayIsoDate,
    type: 'unknown',
    hasPhoto: true,
    source: 'photo_attachment',
    candidateSource: source,
    momentId: null,
    thumbnailUri: `file:///photo-${index}.jpg`,
  };
}

function photoCandidate(index, dayIsoDate = '2026-06-17', source = 'camera_roll') {
  return {
    assetId: `recent-photo-${index}`,
    capturedAt: `${dayIsoDate}T1${index}:00:00.000Z`,
    dayIsoDate,
    localUri: `file:///recent-${index}.jpg`,
    source,
    thumbnailUri: `file:///recent-thumb-${index}.jpg`,
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

check(
  'morning open surfaces no generic strip prompt',
  promptEngine.selectActiveDayPrompt(makeDay(), new Date('2026-06-17T08:00:00')) === null,
  promptEngine.selectActiveDayPrompt(makeDay(), new Date('2026-06-17T08:00:00'))?.id
);
check(
  'midday surfaces no generic strip prompt',
  promptEngine.selectActiveDayPrompt(makeDay(), new Date('2026-06-17T13:00:00')) === null
);
check(
  'evening surfaces no prompt when there are no photo candidates',
  promptEngine.selectActiveDayPrompt(makeDay(), new Date('2026-06-17T19:00:00')) === null
);

// --- Reactive surfacing: time of day + tracked behaviour ---
check(
  'a travelled day does not auto-surface the activity strip prompt',
  promptEngine.selectActiveDayPrompt(makeDay({ newPlaceCount: 2 }), new Date('2026-06-17T13:00:00')) === null
);
// Travel ranks activity above the usual midday baseline (sleep/feeling/hobby).
const travelRank = promptEngine.rankPromptKinds(makeDay({ newPlaceCount: 2 }), new Date('2026-06-17T13:00:00'), 0);
check('travel ranks activity at the very top', travelRank[0] === 'activity', travelRank.join(','));
check(
  'before bed surfaces no generic strip prompt',
  promptEngine.selectActiveDayPrompt(makeDay(), new Date('2026-06-17T22:30:00')) === null,
  promptEngine.selectActiveDayPrompt(makeDay(), new Date('2026-06-17T22:30:00'))?.id
);
const morningMenu = promptEngine.listAvailableDayPrompts(makeDay(), new Date('2026-06-17T08:00:00')).map((p) => p.id);
check('manual add menu starts with ordinary action categories', morningMenu[0] === 'activity' && morningMenu[1] === 'hobby', morningMenu.join(','));

const legacyShapedDay = {
  id: 'day-legacy',
  isoDate: '2026-06-17',
  state: 'forming',
  stepsCount: 0,
  visitedPlaceCount: 0,
  newPlaceCount: 0,
  locationSampleCount: 0,
  shareReadyAt: null,
  healthRouteImport: null,
  exactRouteSegments: [],
  selectedPathId: null,
  heroPhoto: null,
  creature: null,
};
check(
  'legacy-shaped day without arrays does not crash prompt selection',
  promptEngine.selectActiveDayPrompt(legacyShapedDay, new Date('2026-06-17T19:00:00')) === null
);
check(
  'legacy-shaped day without arrays still builds add menu',
  promptEngine.listAvailableDayPrompts(legacyShapedDay, new Date('2026-06-17T19:00:00')).length > 0
);

const noRepeatDay = makeDay({ promptAnswers: [promptAnswer('feeling')] });
check(
  'does not repeat answered prompt in one day',
  promptEngine.selectActiveDayPrompt(noRepeatDay, new Date('2026-06-17T08:00:00'))?.id !== 'feeling'
);

const dismissedDay = makeDay({ promptAnswers: [promptAnswer('activity', true)] });
check(
  'dismiss prevents resurfacing that day',
  promptEngine.selectActiveDayPrompt(dismissedDay, new Date('2026-06-17T13:00:00'))?.id !== 'activity'
);

const onePhotoDay = makeDay({ locations: [photoPoint(0)] });
check(
  'a single same-day photo now surfaces the photo prompt',
  promptEngine.selectActiveDayPrompt(onePhotoDay, new Date('2026-06-17T19:00:00'))?.id === 'meaningful_photo',
  promptEngine.selectActiveDayPrompt(onePhotoDay, new Date('2026-06-17T19:00:00'))?.id
);

// Same-day gating still holds: photos only from yesterday don't trigger today.
const yesterdayOnlyPhotoDay = makeDay({ locations: [photoPoint(0, '2026-06-16'), photoPoint(1, '2026-06-16')] });
check(
  'yesterday-only photos do not trigger the photo prompt today',
  promptEngine.selectActiveDayPrompt(yesterdayOnlyPhotoDay, new Date('2026-06-17T19:00:00'))?.id !== 'meaningful_photo'
);

const photoRichDay = makeDay({ locations: [photoPoint(0), photoPoint(1), photoPoint(2), photoPoint(3)] });
check(
  'photo prompt appears on photo-rich evenings',
  promptEngine.selectActiveDayPrompt(photoRichDay, new Date('2026-06-17T19:00:00'))?.id === 'meaningful_photo'
);

const photoPrompt = promptEngine.selectActiveDayPrompt(photoRichDay, new Date('2026-06-17T19:00:00'));
check('photo prompt carries candidates', photoPrompt?.photoCandidates.length === 4, String(photoPrompt?.photoCandidates.length));

// Photos already added to the vault (usedPhotoAssetIds) drop out of candidates —
// only NEW photos keep prompting. photoPoint(i) → candidate assetId `asset-i`.
const usedPhotosDay = makeDay({
  locations: [photoPoint(0), photoPoint(1), photoPoint(2), photoPoint(3), photoPoint(4)],
  usedPhotoAssetIds: ['asset-0'],
});
const usedPhotoPrompt = promptEngine.selectActiveDayPrompt(usedPhotosDay, new Date('2026-06-17T19:00:00'));
check(
  'already-vaulted photos are excluded from candidates',
  usedPhotoPrompt?.photoCandidates.length === 4 &&
    usedPhotoPrompt.photoCandidates.every((c) => c.assetId !== 'asset-0'),
  String(usedPhotoPrompt?.photoCandidates.length)
);
check(
  'no photo prompt once every photo is already vaulted',
  promptEngine.selectActiveDayPrompt(
    makeDay({
      locations: [photoPoint(0), photoPoint(1), photoPoint(2)],
      usedPhotoAssetIds: ['asset-0', 'asset-1', 'asset-2'],
    }),
    new Date('2026-06-17T19:00:00')
  )?.id !== 'meaningful_photo'
);

const devForcedDay = makeDay();
const devForcedPrompt = promptEngine.selectActiveDayPrompt(devForcedDay, new Date('2026-06-17T09:00:00'), {
  forceMeaningfulPhoto: true,
  photoCandidates: [
    photoCandidate(0, '2026-06-14', 'dev_override'),
    photoCandidate(1, '2026-06-15', 'dev_override'),
    photoCandidate(2, '2026-06-16', 'dev_override'),
  ],
});
check('dev override can force recent-photo prompt outside evening', devForcedPrompt?.id === 'meaningful_photo');

const heroPhotoDay = makeDay({
  heroPhoto: { assetId: 'asset-1', thumbnailUri: 'file:///photo.jpg', selectedAt: '2026-06-17T19:00:00.000Z', meaningChoiceIds: [], meaningLabels: [] },
});
check(
  'meaning is no longer a standalone surfaced prompt (asked in-flow on photo-essence)',
  promptEngine.selectActiveDayPrompt(heroPhotoDay, new Date('2026-06-17T19:00:00'))?.id !== 'meaning'
);

// --- "Add to today" menu: listAvailableDayPrompts + buildDayPromptByKind ---

// Daypart-independent: a launched, unanswered prompt is available even outside
// its daypart window so the menu can offer it.
const menuDay = makeDay();
const menuKinds = promptEngine.listAvailableDayPrompts(menuDay, new Date('2026-06-17T08:00:00')).map((p) => p.id);
check('menu lists multiple categories', menuKinds.length >= 2, menuKinds.join(','));
check('menu excludes non-launched prompts', !menuKinds.includes('intention'), menuKinds.join(','));

// --- Daylio-style expansion: launched categories + icon coverage ---
check('menu offers launched Activity and Hobby categories', menuKinds.includes('activity') && menuKinds.includes('hobby'), menuKinds.join(','));
const launched = dayPrompts.launchedDayPrompts;
check('hobby is launched and sleep is retired from strip prompts', !launched.some((p) => p.id === 'sleep') && launched.some((p) => p.id === 'hobby'), launched.map((p) => p.id).join(','));
check(
  'every launched prompt has a category icon',
  launched.every((p) => typeof p.categoryIcon === 'string' && p.categoryIcon.length > 0),
  launched.filter((p) => !p.categoryIcon).map((p) => p.id).join(',')
);
check(
  'every launched option carries an icon',
  launched.every((p) => p.options.every((o) => typeof o.icon === 'string' && o.icon.length > 0)),
  launched.flatMap((p) => p.options.filter((o) => !o.icon).map((o) => `${p.id}:${o.id}`)).join(',')
);
// The hobby options carry their encounter seeds (movie → cinema, reading →
// bookstore, sport → gym) so a logged hobby can hatch its creature.
const hobby = launched.find((p) => p.id === 'hobby');
const hobbySeed = (id) => hobby.options.find((o) => o.id === id)?.encounterSeedBias?.[0]?.seedId;
check(
  'hobby options map to encounter seeds (incl. gaming + live music)',
  hobbySeed('movie') === 'cinema' &&
    hobbySeed('reading') === 'bookstore' &&
    hobbySeed('gaming') === 'gaming_session' &&
    hobbySeed('music') === 'live_music',
  JSON.stringify(hobby.options.map((o) => ({ id: o.id, seed: o.encounterSeedBias?.[0]?.seedId })))
);
const sleep = dayPrompts.dayPromptRegistry.sleep;
const sleepSeed = (id) => sleep.options.find((o) => o.id === id)?.encounterSeedBias?.[0]?.seedId;
check(
  'sleep maps great→well_rested and barely→tender_day',
  sleepSeed('great') === 'well_rested' && sleepSeed('barely') === 'tender_day',
  JSON.stringify(sleep.options.map((o) => ({ id: o.id, seed: o.encounterSeedBias?.[0]?.seedId })))
);

// No photos → no Photo option in the menu.
check('no Photo option without photo candidates', !menuKinds.includes('meaningful_photo'), menuKinds.join(','));

// "Photo meaning" is never a standalone menu button — even with a hero photo
// set (which would otherwise make it answerable), it stays out of the menu
// because it only follows a photo pick as a paired sequence.
const heroMenu = promptEngine
  .listAvailableDayPrompts(
    makeDay({ heroPhoto: { assetId: 'a', thumbnailUri: 'file:///h.jpg', selectedAt: '2026-06-17T12:00:00.000Z', meaningChoiceIds: [], meaningLabels: [] } }),
    new Date('2026-06-17T19:00:00')
  )
  .map((p) => p.id);
check('menu never includes Photo meaning (meaning)', !heroMenu.includes('meaning'), heroMenu.join(','));

// With enough recent photo candidates, the Photo option appears.
const photoMenu = promptEngine
  .listAvailableDayPrompts(menuDay, new Date('2026-06-17T19:00:00'), {
    photoCandidates: [photoCandidate(1), photoCandidate(2), photoCandidate(3)],
    forceMeaningfulPhoto: true,
  })
  .map((p) => p.id);
check('Photo option appears with photo candidates', photoMenu.includes('meaningful_photo'), photoMenu.join(','));
const forcedOldPhotoMenu = promptEngine
  .listAvailableDayPrompts(menuDay, new Date('2026-06-17T19:00:00'), {
    photoCandidates: [photoCandidate(1, '2026-06-16'), photoCandidate(2, '2026-06-16')],
    forceMeaningfulPhoto: true,
  })
  .map((p) => p.id);
check('manual add menu ignores forced old photo candidates', !forcedOldPhotoMenu.includes('meaningful_photo'), forcedOldPhotoMenu.join(','));

// Testing mode: answered categories stay in the menu (re-answerable) — the
// once-per-day restriction is intentionally off for now.
const answeredMenu = promptEngine
  .listAvailableDayPrompts(makeDay({ promptAnswers: [promptAnswer('activity')] }), new Date('2026-06-17T08:00:00'))
  .map((p) => p.id);
check('menu keeps answered category (restriction off)', answeredMenu.includes('activity'), answeredMenu.join(','));

// buildDayPromptByKind returns the requested kind (and null when answered).
check('buildDayPromptByKind returns the kind', promptEngine.buildDayPromptByKind(menuDay, 'activity')?.id === 'activity');
check(
  'buildDayPromptByKind null for answered kind',
  promptEngine.buildDayPromptByKind(makeDay({ promptAnswers: [promptAnswer('activity')] }), 'activity') === null
);
check(
  'buildDayPromptByKind null for photo without candidates',
  promptEngine.buildDayPromptByKind(menuDay, 'meaningful_photo') === null
);

const stripSource = fs.readFileSync(path.join(projectRoot, 'components/katchadeck/home/day-prompt-strip.tsx'), 'utf8');
const momentSheetSource = fs.readFileSync(path.join(projectRoot, 'components/katchadeck/home/moment-prompt-sheet.tsx'), 'utf8');
check('DayPromptStrip guards missing prompt options', stripSource.includes('prompt.options ?? []'));
check('DayPromptStrip guards missing photo candidates', stripSource.includes('prompt.photoCandidates ?? []'));
check('manual strip flows label their escape action Back', momentSheetSource.includes('dismissLabel="Back"'));
check(
  'every launched option set fits its visible cap',
  dayPrompts.launchedDayPrompts.every((prompt) => prompt.options.length <= prompt.maxOptions),
  dayPrompts.launchedDayPrompts.map((prompt) => `${prompt.id}:${prompt.options.length}/${prompt.maxOptions}`).join(',')
);
const actionStackSource = fs.readFileSync(path.join(projectRoot, 'components/katchadeck/world/world-action-stack.tsx'), 'utf8');
check('Add button does not pass press event as prompt', actionStackSource.includes('onPress={() => onAdd()}'));
const promptControllerSource = fs.readFileSync(path.join(projectRoot, 'features/today/use-prompt-sheet-controller.ts'), 'utf8');
check('Prompt sheet controller rejects non-prompt initial values', promptControllerSource.includes('isActiveDayPrompt(prompt) ? prompt : null'));
const todaySheetHostSource = fs.readFileSync(path.join(projectRoot, 'components/katchadeck/home/today-sheet-host.tsx'), 'utf8');
check('manual Food & drink starts by asking what it was', !todaySheetHostSource.includes('suggested={foodSuggestion}'));
check('manual Watch / read starts by asking what it was', !todaySheetHostSource.includes('suggested={studioSuggestion}'));
check('automatic food follow-up cannot overlay any manual flow', todaySheetHostSource.includes('foodFollowUp && !blockingSheetOpen && !suppressFollowUps'));
check('automatic studio follow-up cannot overlay any manual flow', todaySheetHostSource.includes('studioFollowUp && !blockingSheetOpen && !suppressFollowUps'));
const todaySource = fs.readFileSync(path.join(projectRoot, 'app/(tabs)/today.tsx'), 'utf8');
const momentCaptureSource = fs.readFileSync(path.join(projectRoot, 'app/moment-capture.tsx'), 'utf8');
check('all manual surfaces cancel pending food follow-up', todaySource.includes('suppressFoodFollowUp: anyManualSheetOpen'));
check('all manual surfaces cancel pending studio follow-up', todaySource.includes('suppressStudioFollowUp: anyManualSheetOpen'));
check('voice and written notes have distinct menu actions', todaySource.includes("id: 'voice_note'") && todaySource.includes("id: 'written_note'") && !todaySource.includes("title: 'Voice & note'"));
check('manual menu is grouped into capture, context, and more', ['capture', 'context', 'more'].every((section) => todaySource.includes(`section: '${section}'`)));
const actionRouterSource = fs.readFileSync(path.join(projectRoot, 'features/today/use-today-action-router.ts'), 'utf8');
check('every quick action closes state-backed sheets before opening', actionRouterSource.includes('sheets.closeAllSheets();'));
check('manual quick actions deep-link to their hierarchical flows', [
  "id === 'place') openManualJournal('went_somewhere')",
  "id === 'food') openManualJournal('food')",
  "id === 'studio') openManualJournal('studio')",
  "id === 'movement') openManualJournal('movement')",
  "id === 'life_event') openManualJournal('big_event')",
].every((fragment) => actionRouterSource.includes(fragment)));
check('empty Food category opens the hierarchical food journal flow', actionRouterSource.includes("else openManualJournal('food')"));
check('memory quest logging uses the same hierarchical flows', ['went_somewhere', 'big_event', 'food', 'studio'].every((flowId) => actionRouterSource.includes(`openManualJournal('${flowId}')`)));
const manualJournalSource = fs.readFileSync(path.join(projectRoot, 'components/katchadeck/home/manual-journal-sheet.tsx'), 'utf8');
const katchaSheetSource = fs.readFileSync(path.join(projectRoot, 'components/katchadeck/ui/katcha-sheet.tsx'), 'utf8');
check('manual journal supports opening directly at a requested flow', manualJournalSource.includes("initialFlow ? 'category' : 'flow'") && manualJournalSource.includes('manualJournalFlow(initialFlowId)'));
check('manual journal can prefill an editable media title', manualJournalSource.includes('initialChoiceId') && manualJournalSource.includes("useState(initialSpecific ?? '')"));
check('manual journal uses the adaptive tall sheet', manualJournalSource.includes('size="tall"'));
check('tall sheets stay between the device safe-area insets', katchaSheetSource.includes('useSafeAreaInsets') && katchaSheetSource.includes('insets.top + 8') && katchaSheetSource.includes('availableTallHeight'));
check('manual journal groups top-level destinations', manualJournalSource.includes('SECTION_ORDER') && manualJournalSource.includes('Culture & progress'));
check('manual journal has a persistent three-step header', manualJournalSource.includes('Step ${step + 1} of 3') && manualJournalSource.includes('progressStepActive'));
check('manual journal keeps Save memory outside the scrolling content', manualJournalSource.indexOf('</ScrollView>') < manualJournalSource.indexOf('style={styles.footer}') && manualJournalSource.includes('Save memory'));
check('manual journal keeps notes inline', !manualJournalSource.includes("type Stage = 'flow' | 'category' | 'details' | 'note'") && manualJournalSource.includes('noteExpanded'));
check('manual journal protects dirty drafts from accidental dismissal', manualJournalSource.includes('Discard this draft?') && manualJournalSource.includes('if (dirty) setDiscardOpen(true)'));
check('manual journal exposes selected state to assistive technology', manualJournalSource.includes('accessibilityState={{ selected }}'));
check('named Other media remains in the two-column category grid',
  manualJournalSource.includes('function isCatchAllChoice')
    && manualJournalSource.includes('/^(something else|somewhere else|other)$/i')
    && !manualJournalSource.includes("choice.id.startsWith('other')"));
check('photo Book title field has a trailing accessible enrichment spinner',
  manualJournalSource.includes('liveSpecificLoading?: boolean')
    && manualJournalSource.includes("choice?.id === 'book'")
    && manualJournalSource.includes('Reading book title from photo')
    && manualJournalSource.includes('styles.inputActivity'));
const essenceReviewSource = fs.readFileSync(path.join(projectRoot, 'components/katchadeck/capture/essence-review.tsx'), 'utf8');
const photoJournalAnalysisSource = fs.readFileSync(path.join(projectRoot, 'utils/photo-journal-analysis.ts'), 'utf8');
const photoJournalCommitSource = fs.readFileSync(path.join(projectRoot, 'utils/intelligence/photo-journal-commit.ts'), 'utf8');
check('every photo route opens the shared editable journal flow', essenceReviewSource.includes('preparePhotoJournalAnalysis') && essenceReviewSource.includes('initialFlowId={journalRoute.flowId}') && essenceReviewSource.includes('onRouteResolved={handleJournalRouteResolved}'));
const resolvedRouteHandler = essenceReviewSource.match(/const handleJournalRouteResolved[\s\S]*?\n  };/)?.[0] ?? '';
check('photo category selection advances in the existing sheet instead of replacing it', resolvedRouteHandler.includes('setJournalRoute(route)') && !resolvedRouteHandler.includes('openJournalRoute(route)') && !resolvedRouteHandler.includes('setJournalPickerOpen(false)'));
check('manual photo category selection does not mount a duplicate route sheet', essenceReviewSource.includes("state === 'essence' && journalRoute && !journalPickerOpen"));
check('route-locked photo text can prefill a pristine editor without alternative chips', essenceReviewSource.includes('liveSpecific={journalSpecific}') && manualJournalSource.includes('!specificEditedRef.current') && !manualJournalSource.includes('initialSpecificSuggestions'));
check('Book OCR pending state reaches the title field and clears after enrichment',
  essenceReviewSource.includes("setJournalSpecificLoading(route.id === 'studio.book')")
    && essenceReviewSource.includes('liveSpecificLoading={journalSpecificLoading}')
    && essenceReviewSource.includes('setJournalSpecificLoading(false)'));
check('accepted enrichment is retained before the optional prefill gate',
  essenceReviewSource.indexOf('setJournalEnrichment(proposal)') < essenceReviewSource.indexOf('if (proposal.prefill) setJournalSpecific(proposal.value)'));
check('machine title suggestions are confirmed only when the journal is saved', essenceReviewSource.includes('handleJournalSave') && photoJournalCommitSource.includes("{ key: 'media_title', value: specific }"));
check('OCR enrichment runs only after a final journal route is selected', essenceReviewSource.includes('enrichPhotoJournalRoute(route') && essenceReviewSource.includes('openJournalRoute'));
check('photo classification failure offers ordinary or manual actions without a false timeout claim', essenceReviewSource.includes("We couldn't auto-classify this") && essenceReviewSource.includes('Something ordinary') && essenceReviewSource.includes('Classify manually') && !essenceReviewSource.includes('Apple Intelligence took too long'));
check('photo review has no TV-only disambiguation branch', !photoJournalAnalysisSource.includes('television_media_type_requires_confirmation') && !essenceReviewSource.includes('What were you watching?') && !essenceReviewSource.includes('televisionConfirmation'));
check('Today releases native sheets before opening full-screen capture', todaySource.includes('navigateAfterTodayModalCloses') && todaySource.includes('runAfterNativeModalDismiss') && todaySource.includes('sheets.closeAllSheets()'));
check('capture cancellation uses modal dismissal and is idempotent', momentCaptureSource.includes('safeDismissModal(router)') && momentCaptureSource.includes('if (closingRef.current) return'));
check('journal note control supports tap-to-type and hold-to-record', manualJournalSource.includes('delayLongPress={350}') && manualJournalSource.includes('Tap to type · hold to speak'));
check('photo essence tags and prompts share one ordered scroll-safe layout', essenceReviewSource.includes('style={styles.reviewScroll}') && essenceReviewSource.indexOf('style={styles.tagSection}') < essenceReviewSource.indexOf('style={styles.captured}'));
check('photo Essence renders the selected top-four keys without a second confidence cutoff', essenceReviewSource.includes('semanticFrame?.primaryEvidenceKeys') && !essenceReviewSource.includes('item.score >= 0.35'));
check('photo prompt is no longer an independent absolute bottom overlay', essenceReviewSource.includes("captured: { alignItems: 'center', gap: 8, width: '100%' }"));
const foodSheetSource = fs.readFileSync(path.join(projectRoot, 'components/katchadeck/world/food-vault-sheet.tsx'), 'utf8');
check('vault add buttons deep-link to Food and Studio flows', todaySheetHostSource.includes("openManualJournal('food')") && todaySheetHostSource.includes("openManualJournal('studio')"));
check('Places and Journey add actions deep-link to their hierarchical flows', todaySheetHostSource.includes("openManualJournal('went_somewhere')") && todaySheetHostSource.includes("openManualJournal('movement')"));
check('manual food has no forced third question', !foodSheetSource.includes('· what kind?'));
check('meal refinements remain optional on the meaning screen', foodSheetSource.includes('Meal detail · optional'));
const placeSheetSource = fs.readFileSync(path.join(projectRoot, 'components/katchadeck/world/place-prompt-sheet.tsx'), 'utf8');
const lifeEventSheetSource = fs.readFileSync(path.join(projectRoot, 'components/katchadeck/world/big-moment-picker-sheet.tsx'), 'utf8');
check('long place options are scrollable', placeSheetSource.includes('<ScrollView'));
check('long life-event options are scrollable', lifeEventSheetSource.includes('<ScrollView'));
check('People includes explicit My child context', dayPrompts.dayPromptRegistry.people.options.some((option) => option.id === 'my_child'));

Module._resolveFilename = originalResolve;
fs.rmSync(tempDir, { recursive: true, force: true });

console.log(failures === 0 ? '\nAll day-prompt checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
