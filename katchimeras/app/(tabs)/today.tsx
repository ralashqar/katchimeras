import { useRouter } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useEffect, useMemo } from 'react';

import { MomentPromptSheet } from '@/components/katchadeck/home/moment-prompt-sheet';
import { CreatureHero } from '@/components/katchadeck/home/creature-hero';
import { HatchReveal } from '@/components/katchadeck/home/hatch-reveal';
import { LanternEgg } from '@/components/katchadeck/home/lantern-egg';
import { currentLanternColour } from '@/utils/cosmetics-storage';
import { HatchCountdown } from '@/components/katchadeck/home/hatch-countdown';
import { LanternTimeline } from '@/components/katchadeck/home/lantern-timeline';
import { MemoryPostcard } from '@/components/katchadeck/home/memory-postcard';
import { DayPromptStrip } from '@/components/katchadeck/home/day-prompt-strip';
import { EggFeedOverlay } from '@/components/katchadeck/home/egg-feed-overlay';
import { TodayCategoryRing } from '@/components/katchadeck/home/today-category-ring';
import { TodayBottomDock } from '@/components/katchadeck/home/today-bottom-dock';
import { DayComicOverlay } from '@/components/katchadeck/home/day-comic-overlay';
import { MicrocopyToast } from '@/components/katchadeck/home/microcopy-toast';
import { TodaySheetHost } from '@/components/katchadeck/home/today-sheet-host';
import { InlineVoiceNote } from '@/components/katchadeck/world/inline-voice-note';
import type { IconSymbolName } from '@/components/ui/icon-symbol';
import { presenceEnter } from '@/components/katchadeck/motion';
import { ThemedText } from '@/components/themed-text';
import { AppFontFamilies, Lantern } from '@/constants/theme';
import { useHomeScreenState } from '@/hooks/use-home-screen-state';
import { useAllDays } from '@/hooks/use-all-days';
import { useBackfillStatus } from '@/utils/backfill-status';
import { findUnconfirmedPlace } from '@/utils/today-categories';
import { DiscoveryReveal } from '@/components/katchadeck/world/discovery-reveal';
import { useEggFeedController } from '@/features/today/use-egg-feed-controller';
import { usePromptSheetController } from '@/features/today/use-prompt-sheet-controller';
import { useMicrocopy } from '@/features/today/use-microcopy';
import { useMomentFollowUpController } from '@/features/today/use-moment-follow-up-controller';
import { useTodaySheetController } from '@/features/today/use-today-sheet-controller';
import { useTodayActionRouter } from '@/features/today/use-today-action-router';
import { usePlacePromptController } from '@/features/today/use-place-prompt-controller';
import { useMorningPromptController } from '@/features/today/use-morning-prompt-controller';
import { useObservatoryController } from '@/features/today/use-observatory-controller';
import { useDiscoveryRevealController } from '@/features/today/use-discovery-reveal-controller';
import { useNoteCaptureController } from '@/features/today/use-note-capture-controller';
import { useTodayMemoryWriters } from '@/features/today/use-today-memory-writers';
import { useTodayPromptAnswerController } from '@/features/today/use-today-prompt-answer-controller';
import { useTodayShareComicController } from '@/features/today/use-today-share-comic-controller';
import { useTodayCategoryModel } from '@/features/today/use-today-category-model';
import { useTodayNavigationController } from '@/features/today/use-today-navigation-controller';
import { useTodayHatchRevealController } from '@/features/today/use-today-hatch-reveal-controller';
import { MeadowSceneBackdrop, todayEggFraming } from '@/components/katchadeck/home/meadow-scene-backdrop';
import { QuickNoteComposer } from '@/components/katchadeck/home/quick-note-composer';
import type { HomeDayRecord, HomeMoment } from '@/types/home';

// Hatched-day extras, parked so the numbers card stays at its usual anchor
// (same pattern as the photos/timeline sections in day-journal-sections).
const SHOW_HATCHED_ACTION_DOCK = false;
const SHOW_HATCHED_REFLECTION_CARD = false;

// Mood + Sleep entries in the "+" menu — they open their own sheets instead of
// the retired strip prompts (accents match those sheets' tiles).
const QUICK_PROMPT_CATEGORIES: { id: string; title: string; icon: IconSymbolName; accent: string }[] = [
  { id: 'mood', title: 'Mood', icon: 'face.smiling', accent: '#F5AFC6' },
  { id: 'sleep', title: 'Sleep', icon: 'bed.double.fill', accent: '#AAB2FF' },
];



// Short "h:mm am – h:mm pm" dwell window for a place picked from the reader
// (same manual format as World, no Intl dependency).
function fmtTime(iso?: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours %= 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes} ${ampm}`;
}
function formatTimeRange(start?: string, end?: string): string | null {
  const startLabel = fmtTime(start);
  const endLabel = fmtTime(end);
  if (startLabel && endLabel && startLabel !== endLabel) return `${startLabel} – ${endLabel}`;
  return startLabel ?? endLabel ?? null;
}

export default function HomeScreen() {
  const router = useRouter();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Egg + membrane framing from data/today-scene.json (neutral by default) —
  // shared with onboarding/Hatch Your Past via meadow-scene-backdrop.
  const eggFraming = todayEggFraming();
  const {
    activeDayPrompt,
    availableDayPrompts,
    answerDayPrompt,
    answerPhotoMeaning,
    dismissDayPrompt,
    addNote,
    confirmPlace,
    markBigMoment,
    setSleep,
    setStepsInterpretation,
    addFoodMoment,
    addStudioMoment,
    setFoodMomentMeaning,
    setStudioMomentRating,
    setDayName,
    isTodayHatched,
    tomorrowDay,
    tomorrowActivePrompt,
    tomorrowAvailablePrompts,
    selectedDay,
    selectedDayId,
    selectTimelineDay,
    timelineDays,
    triggerHatchIfReady,
    refreshState,
  } = useHomeScreenState();
  const { days: allDays } = useAllDays();
  const tabBarHeight = useBottomTabBarHeight();
  const backfillStatus = useBackfillStatus();
  const { eggFeed, eggFeedKey, heroStageRef, startEggFeed, handleEggFeedArrive, pulseEgg } = useEggFeedController();
  const { promptSheetOpen, initialPrompt, openPromptSheet, closePromptSheet } = usePromptSheetController();

  const shareableDay =
    selectedDay?.kind === 'day' && selectedDay.state === 'hatched' && selectedDay.creature
      ? (selectedDay as HomeDayRecord & { creature: NonNullable<HomeDayRecord['creature']> })
      : null;
  const {
    sharingDayId,
    comicGen,
    postcardRef,
    comicShotRef,
    closeComic,
    handleShareDay,
    handleMakeComic,
    handleRetryComic,
    handleShareGeneratedComic,
  } = useTodayShareComicController({ shareableDay });

  useEffect(() => {
    closePromptSheet();
  }, [closePromptSheet, selectedDayId]);

  // Each time a background backfill reflection is written, pull it into view so
  // the day's specific quote appears without the user re-opening Home.
  useEffect(() => {
    if (backfillStatus.completedVersion > 0) {
      refreshState();
    }
  }, [backfillStatus.completedVersion, refreshState]);

  const { isHatching, hatchingEgg, handleReveal, handleHatchComplete } = useTodayHatchRevealController({
    selectedDay,
    triggerHatchIfReady,
    refreshState,
  });
  function handleOpenDayMap(dayId: string) {
    router.push({
      pathname: '/day-map/[dayId]',
      params: { dayId },
    });
  }

  const isDay = selectedDay?.kind === 'day';
  const isHatched = isDay && selectedDay.state === 'hatched' && selectedDay.creature;
  const isFormingToday = isDay && selectedDay.isToday && selectedDay.state !== 'hatched';

  // Once today has hatched, the Tomorrow page becomes a forming egg the user can
  // pre-feed (moments / prompts / camera) until the rollover. The forming target
  // + which day/prompts to use are unified here so the same UI drives both.
  const onTomorrowForming = selectedDay?.kind === 'tomorrow' && isTodayHatched;
  const isForming = isFormingToday || onTomorrowForming;
  // Cosmetic lantern-colour override (Discovery-unlocked), read from storage so the
  // today page reflects the same choice as the World tab. Undefined = natural.
  const lanternColour = currentLanternColour();
  const formingTarget = onTomorrowForming ? 'tomorrow' : 'today';
  const formingDay = onTomorrowForming ? tomorrowDay : isFormingToday ? selectedDay : null;
  const formingPrompts = onTomorrowForming ? tomorrowAvailablePrompts : availableDayPrompts;
  const formingActivePrompt = onTomorrowForming ? tomorrowActivePrompt : activeDayPrompt;
  // While a prompt is showing, the page collapses to just the egg + prompt: the
  // forming quote and the add/camera buttons hide until it's answered/dismissed.
  const hasActivePrompt = isForming && Boolean(formingActivePrompt);

  // The day the page is LOOKING AT — the forming day while it forms, or a
  // hatched day being revisited. Sheets/readers bind to this; write handlers
  // only exist while it's forming.
  const viewedDay: HomeDayRecord | null = isDay ? selectedDay : onTomorrowForming ? (tomorrowDay ?? null) : null;
  const viewedIsForming = isForming;

  // --- Today-as-daily-hub: category ring, sheets, capture actions ---
  // (the same daily intelligence the World patch had, orbiting the egg instead)

  const { microcopy, setMicrocopy } = useMicrocopy();

  const sheets = useTodaySheetController();
  const {
    memoryVaultOpen,
    setMemoryVaultOpen,
    memoryVaultTab,
    setMemoryVaultTab,
    foodPickerOpen,
    setFoodPickerOpen,
    foodVaultOpen,
    setFoodVaultOpen,
    studioPickerOpen,
    setStudioPickerOpen,
    studioVaultOpen,
    setStudioVaultOpen,
    sanctuaryOpen,
    setSanctuaryOpen,
    moodSheetOpen,
    setMoodSheetOpen,
    sleepSheetOpen,
    setSleepSheetOpen,
    questBoardOpen,
    setQuestBoardOpen,
    bigMomentPickerOpen,
    setBigMomentPickerOpen,
    placePromptOpen,
    setPlacePromptOpen,
    placesVaultOpen,
    setPlacesVaultOpen,
    stepsSheetOpen,
    setStepsSheetOpen,
    journeySheetOpen,
    setJourneySheetOpen,
    nameSheetOpen,
    setNameSheetOpen,
  } = sheets;

  // Quick TEXT note (tap the mic): an inline text box over the page — enter
  // interprets on-device and commits straight away, no full-screen flow.
  const { quickNoteOpen, setQuickNoteOpen, handleQuickNoteSubmit, voiceNote } = useNoteCaptureController({
    formingTarget,
    windowWidth,
    windowHeight,
    addNote,
    startEggFeed,
    pulseEgg,
    setMicrocopy,
  });

  const {
    photoPrompt,
    handledPhotoSig,
    dismissPhotoAlert,
    popupPrompts,
    handleAnswerDayPrompt,
    handleSelectHeroPhoto,
  } = useTodayPromptAnswerController({
    formingDay,
    formingTarget,
    formingPrompts,
    formingActivePrompt,
    answerDayPrompt,
    answerPhotoMeaning,
    closePromptSheet,
    startEggFeed,
  });
  const { recentAvgSteps, memoryQuests, categories } = useTodayCategoryModel({
    allDays,
    formingDay,
    viewedDay,
    viewedIsForming,
    formingPrompts,
    handledPhotoSig,
  });
  // Places: the first detected-but-unconfirmed stop, plus manual "add this place".
  const unconfirmedPlace = useMemo(() => (formingDay ? findUnconfirmedPlace(formingDay) : null), [formingDay]);
  const {
    activePlace,
    placePreset,
    handleAddCurrentPlace,
    closePlacePrompt,
    handleConfirmPlaceFromVault,
    handleConfirmPlace,
  } = usePlacePromptController({
    formingDay,
    formingTarget,
    unconfirmedPlace,
    confirmPlace,
    setPlacePromptOpen,
    setPlacesVaultOpen,
    pulseEgg,
    setMicrocopy,
    formatTimeRange,
  });

  // Morning sequence — the ONLY auto prompts, as their real sheets: sleep
  // first (Apple Health answers it silently when it can), then mood, exactly
  // as if the user tapped the Sleep then Mood tiles. Keyed on the day's
  // INSTANCE (id + storedNonce) so "reset today" re-arms the sequence while a
  // plain dismiss doesn't nag.
  const { todayHasMood } = useMorningPromptController({
    timelineDays,
    setSleep,
    setMoodSheetOpen,
    setSleepSheetOpen,
  });

  // The Observatory (what Katchimera has noticed) + Travel Memory controls —
  // reached through the Crossroads reader until it gets its own Kingdom home.
  const { observatoryOpen, setObservatoryOpen, observations, travelMemory } = useObservatoryController({
    allDays,
    formingDay,
    refreshState,
    setMicrocopy,
  });

  // Discoveries (life milestones): whatever is added on Today re-evaluates the
  // catalog right away, and a fresh unlock plays its reveal here too — but only
  // once the current flow is done, never on top of an open prompt/sheet.
  const { celebrateDiscovery, markDiscoverySeen } = useDiscoveryRevealController(formingDay);

  const { foodFollowUp, studioFollowUp, clearFoodFollowUp, clearStudioFollowUp } = useMomentFollowUpController({
    formingDay,
    blocked: promptSheetOpen || isHatching,
  });

  const {
    foodSuggestion,
    studioSuggestion,
    handleAddFood,
    handleAddStudio,
    handlePickBigMoment,
    handleConfirmMood,
    handleSetSleep,
    handleConfirmSteps,
  } = useTodayMemoryWriters({
    formingDay,
    formingTarget,
    isFormingToday: Boolean(isFormingToday),
    todayHasMood,
    addFoodMoment,
    addStudioMoment,
    markBigMoment,
    setSleep,
    setStepsInterpretation,
    answerDayPrompt,
    setFoodPickerOpen,
    setStudioPickerOpen,
    setBigMomentPickerOpen,
    setMoodSheetOpen,
    setSleepSheetOpen,
    setStepsSheetOpen,
    startEggFeed,
    pulseEgg,
    setMicrocopy,
  });

  const {
    ringCategories,
    panelCategories,
    categoryById,
    statAttention,
    handleQuest,
    handleStatPress,
    handleCategoryPress,
    handleCameraPress,
    handleQuickCategory,
  } = useTodayActionRouter({
    categories,
    viewedIsForming,
    formingDay,
    formingPrompts,
    photoPrompt,
    unconfirmedPlace,
    sheets,
    openPromptSheet,
    closePromptSheet,
    openCapture: () => router.push('/moment-capture'),
    openNoteCapture: () => router.push('/note-capture'),
    openDayMap: handleOpenDayMap,
    addCurrentPlace: () => {
      void handleAddCurrentPlace();
    },
  });

  const { swipeGesture } = useTodayNavigationController({
    windowWidth,
    windowHeight,
    selectedDayId,
    timelineDays,
    isTodayHatched,
    isHatching,
    promptSheetOpen,
    comicOpen: Boolean(comicGen),
    selectTimelineDay,
    startEggFeed,
  });
  // A discovery reveal waits until nothing else is mid-flow: no sheet, prompt,
  // follow-up, recording, or hatch on screen. It then celebrates the
  // highest-rarity pending unlock first (same order as the World page).
  const flowBusy =
    isHatching ||
    hasActivePrompt ||
    promptSheetOpen ||
    memoryVaultOpen ||
    foodPickerOpen ||
    foodVaultOpen ||
    studioPickerOpen ||
    studioVaultOpen ||
    sanctuaryOpen ||
    moodSheetOpen ||
    sleepSheetOpen ||
    questBoardOpen ||
    bigMomentPickerOpen ||
    placePromptOpen ||
    placesVaultOpen ||
    observatoryOpen ||
    stepsSheetOpen ||
    journeySheetOpen ||
    nameSheetOpen ||
    !!foodFollowUp ||
    !!studioFollowUp ||
    !!comicGen ||
    voiceNote.phase !== 'idle';
  return (
    <GestureDetector gesture={swipeGesture}>
    <View style={styles.screen}>
      {/* The Meadow scene — the shared golden-hour backdrop (also behind
          onboarding + Hatch Your Past, so the egg's world never changes). */}
      <MeadowSceneBackdrop />
      {/* Today is a FIXED composition — no page scrolling; everything anchors.
          (Readers/sheets keep their own scrolling.) The ScrollView shell stays
          for layout parity but is locked. */}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
        contentInsetAdjustmentBehavior="never"
        scrollEnabled={false}
        bounces={false}
        showsVerticalScrollIndicator={false}>
        <Animated.View entering={presenceEnter(20)}>
          <LanternTimeline days={timelineDays} onSelect={selectTimelineDay} selectedId={selectedDayId} />
        </Animated.View>

        <Animated.View ref={heroStageRef} entering={presenceEnter(70)} style={styles.heroStage}>
          {isHatching && hatchingEgg ? (
            <HatchReveal
              creature={selectedDay?.kind === 'day' ? selectedDay.creature ?? null : null}
              egg={hatchingEgg}
              lanternColor={lanternColour}
              onComplete={handleHatchComplete}
            />
          ) : isDay ? (
            isHatched ? (
              <CreatureHero creature={selectedDay.creature!} compact />
            ) : (
              <LanternEgg
                egg={selectedDay.egg}
                onPress={selectedDay.canAddMoments ? () => openPromptSheet() : undefined}
                reactionKey={selectedDay.moments.length}
                isReady={selectedDay.state === 'ready_to_hatch'}
                feedKey={eggFeedKey}
                lanternColor={lanternColour}
                scale={eggFraming.scale}
              offsetY={eggFraming.offsetY}
              membraneScale={eggFraming.membraneScale}
              membraneOffsetY={eggFraming.membraneOffsetY}
              shellScale={0.72}
              shellOffsetY={0}
              />
            )
          ) : onTomorrowForming ? (
            <LanternEgg
              egg={tomorrowDay.egg}
              onPress={() => openPromptSheet()}
              reactionKey={tomorrowDay.moments.length}
              feedKey={eggFeedKey}
              lanternColor={lanternColour}
              scale={eggFraming.scale}
              offsetY={eggFraming.offsetY}
              membraneScale={eggFraming.membraneScale}
              membraneOffsetY={eggFraming.membraneOffsetY}
              shellScale={0.72}
              shellOffsetY={0}
            />
          ) : (
            <LanternEgg
              egg={{
                accentColor: '#A78BFA',
                haloColor: '#A78BFA',
                coreColor: 'rgba(201,194,232,0.3)',
                intensity: 0.26,
                shimmer: true,
                swirl: 0.2,
                label: 'Not yet formed',
              }}
              scale={eggFraming.scale}
              offsetY={eggFraming.offsetY}
              membraneScale={eggFraming.membraneScale}
              membraneOffsetY={eggFraming.membraneOffsetY}
              shellScale={0.72}
              shellOffsetY={0}
            />
          )}
          {/* The same category ring circles the hatched creature when revisiting
              a day — read-only doors into that day's memories. Anchored to the
              258px art box so egg and creature days match exactly. */}
          {(isForming || isHatched) && !isHatching && !hasActivePrompt ? (
            <TodayCategoryRing categories={ringCategories} onPress={handleCategoryPress} anchorHeight={258} centerOffsetY={24} />
          ) : null}
          {isFormingToday && !isHatching ? (
            <HatchCountdown
              isReady={selectedDay.kind === 'day' && selectedDay.state === 'ready_to_hatch'}
              style={styles.heroCountdown}
            />
          ) : null}
        </Animated.View>

        {isHatching ? null : isHatched ? (
          null
        ) : (
          <Animated.View entering={presenceEnter(120)} style={styles.formingCopy}>
            {/* The forming quote AND tomorrow's one-liner are hidden — the week
                strip's egg orb + the panel below already tell the story. */}
            {isForming && formingDay && formingDay.moments.length > 0 ? (
              <View style={styles.chipRow}>
                {dedupeMoments(formingDay.moments).map((moment) => (
                  <View key={moment.id} style={styles.chip}>
                    <View
                      style={[
                        styles.chipDot,
                        { backgroundColor: moment.accentColor, boxShadow: `0 0 12px ${moment.accentColor}AA` },
                      ]}
                    />
                    <ThemedText style={styles.chipLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                      {moment.label}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ) : null}
            {isForming ? (
              <DayPromptStrip
                onAnswer={handleAnswerDayPrompt}
                onDismiss={(kind) => dismissDayPrompt(kind, formingTarget)}
                onSelectHeroPhoto={handleSelectHeroPhoto}
                prompt={formingActivePrompt}
              />
            ) : null}
          </Animated.View>
        )}

      </ScrollView>

      {/* Bottom dock — the +/camera/mic row (or hatch CTA) with the category/
          stats panel beneath, PINNED above the tab bar (absolute, not flow) so
          content above can never push it around. Hidden while a prompt has the
          page collapsed and during the hatch reveal. The panel also shows on
          the TOMORROW view once today has hatched (viewedDay resolves it);
          before the hatch, tomorrow stays a locked egg with no panel. */}
      {!isHatching && !hasActivePrompt ? (
        <TodayBottomDock
          canHatch={isDay ? selectedDay.canHatch : false}
          isForming={isForming}
          isHatched={Boolean(isHatched)}
          viewedDay={viewedDay}
          showHatchedActionDock={SHOW_HATCHED_ACTION_DOCK}
          showHatchedReflectionCard={SHOW_HATCHED_REFLECTION_CARD}
          recording={voiceNote.isRecording}
          cameraBadge={categoryById.get('photos')?.needsAttention ? Math.max(1, photoPrompt?.photoCandidates.length ?? 1) : undefined}
          sharingBusy={isDay ? sharingDayId === selectedDay.id : false}
          comicBusy={comicGen?.status === 'generating'}
          statAttention={isFormingToday ? statAttention : undefined}
          categories={panelCategories}
          onReveal={handleReveal}
          onCamera={handleCameraPress}
          onMicTap={() => {
            if (voiceNote.phase === 'idle') setQuickNoteOpen(true);
          }}
          onMicPressIn={voiceNote.start}
          onMicPressOut={() => {
            void voiceNote.stop();
          }}
          onAdd={openPromptSheet}
          onOpenMap={() => {
            if (isDay) handleOpenDayMap(selectedDay.id);
          }}
          onShareDay={handleShareDay}
          onMakeComic={handleMakeComic}
          onStatPress={handleStatPress}
          onCategoryPress={handleCategoryPress}
        />
      ) : null}

      <EggFeedOverlay feed={eggFeed} onArrive={handleEggFeedArrive} />

      {quickNoteOpen ? (
        <QuickNoteComposer onClose={() => setQuickNoteOpen(false)} onSubmit={handleQuickNoteSubmit} />
      ) : null}

      {promptSheetOpen ? (
        <MomentPromptSheet
          prompts={popupPrompts}
          initialPrompt={initialPrompt}
          // Mood + Sleep stay in the menu but open their OWN sheets (the old
          // strip prompts for both are retired).
          quickCategories={QUICK_PROMPT_CATEGORIES}
          onQuickCategory={handleQuickCategory}
          onAnswer={handleAnswerDayPrompt}
          onSelectHeroPhoto={handleSelectHeroPhoto}
          onPromptDismiss={(promptId) => {
            // "Later" on the photos prompt clears the camera/tile badge until
            // NEW photos arrive (sig-based re-arm).
            if (promptId === 'meaningful_photo') dismissPhotoAlert();
          }}
          onClose={closePromptSheet}
        />
      ) : null}

      <TodaySheetHost
        viewedDay={viewedDay}
        viewedIsForming={viewedIsForming}
        formingTarget={formingTarget}
        memoryVaultOpen={memoryVaultOpen}
        memoryVaultTab={memoryVaultTab}
        foodPickerOpen={foodPickerOpen}
        foodVaultOpen={foodVaultOpen}
        studioPickerOpen={studioPickerOpen}
        studioVaultOpen={studioVaultOpen}
        sanctuaryOpen={sanctuaryOpen}
        moodSheetOpen={moodSheetOpen}
        sleepSheetOpen={sleepSheetOpen}
        questBoardOpen={questBoardOpen}
        bigMomentPickerOpen={bigMomentPickerOpen}
        stepsSheetOpen={stepsSheetOpen}
        journeySheetOpen={journeySheetOpen}
        placesVaultOpen={placesVaultOpen}
        observatoryOpen={observatoryOpen}
        placePromptOpen={placePromptOpen}
        nameSheetOpen={nameSheetOpen}
        foodSuggestion={foodSuggestion}
        studioSuggestion={studioSuggestion}
        foodFollowUp={foodFollowUp}
        studioFollowUp={studioFollowUp}
        memoryQuests={memoryQuests}
        recentAvgSteps={recentAvgSteps}
        activePlace={activePlace}
        placePreset={placePreset}
        observations={observations}
        travelMemory={travelMemory}
        setMemoryVaultOpen={setMemoryVaultOpen}
        setMemoryVaultTab={setMemoryVaultTab}
        setFoodPickerOpen={setFoodPickerOpen}
        setFoodVaultOpen={setFoodVaultOpen}
        setStudioPickerOpen={setStudioPickerOpen}
        setStudioVaultOpen={setStudioVaultOpen}
        setSanctuaryOpen={setSanctuaryOpen}
        setMoodSheetOpen={setMoodSheetOpen}
        setSleepSheetOpen={setSleepSheetOpen}
        setQuestBoardOpen={setQuestBoardOpen}
        setBigMomentPickerOpen={setBigMomentPickerOpen}
        setStepsSheetOpen={setStepsSheetOpen}
        setJourneySheetOpen={setJourneySheetOpen}
        setPlacesVaultOpen={setPlacesVaultOpen}
        setObservatoryOpen={setObservatoryOpen}
        setNameSheetOpen={setNameSheetOpen}
        onCapturePhoto={() => router.push('/moment-capture')}
        onCaptureNote={() => router.push('/note-capture')}
        openPromptSheet={openPromptSheet}
        handleAddCurrentPlace={handleAddCurrentPlace}
        handleOpenDayMap={handleOpenDayMap}
        handleAddFood={handleAddFood}
        handleAddStudio={handleAddStudio}
        handlePickBigMoment={handlePickBigMoment}
        handleConfirmMood={handleConfirmMood}
        handleSetSleep={handleSetSleep}
        handleConfirmSteps={handleConfirmSteps}
        handleQuest={handleQuest}
        handleConfirmPlaceFromVault={handleConfirmPlaceFromVault}
        handleConfirmPlace={handleConfirmPlace}
        closePlacePrompt={closePlacePrompt}
        setFoodMomentMeaning={setFoodMomentMeaning}
        setStudioMomentRating={setStudioMomentRating}
        clearFoodFollowUp={clearFoodFollowUp}
        clearStudioFollowUp={clearStudioFollowUp}
        pulseEgg={pulseEgg}
        setMicrocopy={setMicrocopy}
        setDayName={setDayName}
      />
      {voiceNote.phase !== 'idle' ? (
        <InlineVoiceNote
          phase={voiceNote.phase}
          elapsed={voiceNote.elapsed}
          result={voiceNote.result}
          markBig={voiceNote.markBig}
          onToggleBig={voiceNote.toggleMarkBig}
          onAccept={voiceNote.accept}
          onDiscard={voiceNote.discard}
          bottom={tabBarHeight}
        />
      ) : null}

      <MicrocopyToast message={microcopy} />

      {celebrateDiscovery && !flowBusy ? (
        <DiscoveryReveal discovery={celebrateDiscovery} onDismiss={() => markDiscoverySeen(celebrateDiscovery.id)} />
      ) : null}
      {backfillStatus.active ? (
        <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(220)} pointerEvents="none" style={styles.backfillTag}>
          <ActivityIndicator color={Lantern.ember300} size="small" />
          <ThemedText style={styles.backfillTagLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            {backfillStatus.remaining > 0
              ? `Polishing ${backfillStatus.remaining} day${backfillStatus.remaining === 1 ? '' : 's'}…`
              : 'Polishing your days…'}
          </ThemedText>
        </Animated.View>
      ) : null}
      {shareableDay ? (
        <View pointerEvents="none" style={styles.captureCardWrap}>
          <MemoryPostcard day={shareableDay} ref={postcardRef} />
        </View>
      ) : null}

      <DayComicOverlay
        comic={comicGen}
        selectedDayId={selectedDay?.id ?? null}
        comicShotRef={comicShotRef}
        canRetry={Boolean(shareableDay)}
        onClose={closeComic}
        onRetry={handleRetryComic}
        onShare={handleShareGeneratedComic}
      />
    </View>
    </GestureDetector>
  );
}

function dedupeMoments(moments: HomeMoment[]) {
  const seen = new Set<string>();
  return moments.filter((moment) => {
    if (seen.has(moment.type)) return false;
    seen.add(moment.type);
    return true;
  }).slice(0, 4);
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: Lantern.ink950,
    flex: 1,
  },
  content: {
    flexGrow: 1,
    // Fixed page (no scroll): the anchored card ends just above the floating
    // tab bar (top edge ~96 from the screen bottom) with breathing room.
    paddingBottom: 116,
    paddingHorizontal: 24,
  },
  eggPedestal: {
    // 4:3 squat pedestal — wider than the egg so the nest cradles it.
    alignSelf: 'center',
    height: 218,
    position: 'absolute',
    top: 100,
    width: 290,
  },
  heroStage: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 26,
  },
  heroCountdown: {
    marginTop: -32,
  },
  sectionGap: {
    gap: 16,
    // 'auto' absorbs free space above, pinning the card just over the tab bar
    // (paddingBottom on the scroll content sets the standoff).
    marginTop: 'auto',
    paddingTop: 12,
  },
  formingCopy: {
    alignItems: 'center',
    gap: 12,
    marginTop: 2,
  },
  formingTitle: {
    fontFamily: AppFontFamilies.instrumentSerif,
    fontSize: 23,
    lineHeight: 29,
    maxWidth: 320,
    textAlign: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  chip: {
    alignItems: 'center',
    backgroundColor: Lantern.dusk700,
    borderCurve: 'continuous',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipDot: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
  },
  spacer: {
    height: 6,
  },
  captureCardWrap: {
    left: -2000,
    position: 'absolute',
    top: -2000,
  },
  backfillTag: {
    alignItems: 'center',
    backgroundColor: 'rgba(12, 10, 20, 0.86)',
    borderColor: 'rgba(255, 195, 107, 0.28)',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    position: 'absolute',
    right: 16,
    top: 60,
    zIndex: 40,
  },
  backfillTagLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
});
