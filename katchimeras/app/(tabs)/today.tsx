import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { MomentPromptSheet, type PromptMenuSection } from '@/components/katchadeck/home/moment-prompt-sheet';
import { ManualJournalSheet } from '@/components/katchadeck/home/manual-journal-sheet';
import { CreatureHero } from '@/components/katchadeck/home/creature-hero';
import { DailyCard, resolveCompactDailyCardSize } from '@/components/katchadeck/cards/daily-card';
import { HatchReveal } from '@/components/katchadeck/home/hatch-reveal';
import { HatchCheckInSheet } from '@/components/katchadeck/home/hatch-check-in-sheet';
import { LanternEgg } from '@/components/katchadeck/home/lantern-egg';
import { currentLanternColour } from '@/utils/cosmetics-storage';
import { HatchCountdown } from '@/components/katchadeck/home/hatch-countdown';
import { TodayDeckCarousel } from '@/components/katchadeck/home/today-deck-carousel';
import { MemoryPostcard } from '@/components/katchadeck/home/memory-postcard';
import { DayPromptStrip } from '@/components/katchadeck/home/day-prompt-strip';
import { EggFeedOverlay } from '@/components/katchadeck/home/egg-feed-overlay';
import { TodayCategoryRing, type TodayCategoryRingItem } from '@/components/katchadeck/home/today-category-ring';
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
import { DiscoveryReveal } from '@/components/katchadeck/world/discovery-reveal';
import { useEggFeedController } from '@/features/today/use-egg-feed-controller';
import { usePromptSheetController } from '@/features/today/use-prompt-sheet-controller';
import { useMicrocopy } from '@/features/today/use-microcopy';
import { useMomentFollowUpController } from '@/features/today/use-moment-follow-up-controller';
import { useTodaySheetController } from '@/features/today/use-today-sheet-controller';
import { useTodayActionRouter } from '@/features/today/use-today-action-router';
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
import { MemoryClarificationSheet } from '@/components/katchadeck/world/memory-clarification-sheet';
import type { ClassifiedMemory, HomeDayRecord } from '@/types/home';
import { consumeQuestActionIntent } from '@/utils/quest-action-signal';
import { consumeCompanionNavigationIntent } from '@/utils/companion-navigation-intent';
import { planContextualPrompts } from '@/utils/intelligence/prompt-planner';
import { noteRoutesForSignals, noteSuggestedSpecific } from '@/utils/journal-input-adapters';
import { journalNoteRouteNeedsConfirmation } from '@/utils/journal-routing';
import { runAfterNativeModalDismiss } from '@/utils/native-modal-navigation';
import { hatchCheckInEligibility } from '@/utils/hatch-check-in';

// Hatched-day extras, parked so the numbers card stays at its usual anchor
// (same pattern as the photos/timeline sections in day-journal-sections).
const SHOW_HATCHED_ACTION_DOCK = false;
const SHOW_HATCHED_REFLECTION_CARD = false;
const HERO_CARD_LIFT = 26;

// Mood + Sleep entries in the "+" menu — they open their own sheets instead of
// the retired strip prompts (accents match those sheets' tiles).
const QUICK_PROMPT_CATEGORIES: {
  id: string;
  title: string;
  icon: IconSymbolName;
  accent: string;
  section: PromptMenuSection;
}[] = [
  { id: 'photo', title: 'Photo', icon: 'camera.fill', accent: '#92D7FF', section: 'capture' },
  { id: 'voice_note', title: 'Voice note', icon: 'mic.fill', accent: '#7DE8CD', section: 'capture' },
  { id: 'written_note', title: 'Written note', icon: 'square.and.pencil', accent: '#9DDCB8', section: 'capture' },
  { id: 'manual_journal', title: 'Log something', icon: 'plus.circle.fill', accent: '#FFC36B', section: 'context' },
  { id: 'mood', title: 'Mood', icon: 'face.smiling', accent: '#F5AFC6', section: 'more' },
  { id: 'sleep', title: 'Sleep', icon: 'bed.double.fill', accent: '#AAB2FF', section: 'more' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const heroVerticalOffset = Math.min(34, Math.max(12, Math.round((windowHeight - 680) * 0.16)));
  const maxTodayCardHeight = Math.max(
    260,
    windowHeight - (insets.top + 24 + heroVerticalOffset) - 240
  );
  const todayCardSize = resolveCompactDailyCardSize(windowWidth, maxTodayCardHeight);
  const [manualJournalOpen, setManualJournalOpen] = useState(false);
  const [hatchCheckInOpen, setHatchCheckInOpen] = useState(false);
  const [hatchAfterCheckIn, setHatchAfterCheckIn] = useState(false);
  const [manualJournalInitialFlowId, setManualJournalInitialFlowId] = useState<string | null>(null);
  const openManualJournal = useCallback((flowId?: string) => {
    setManualJournalInitialFlowId(flowId ?? null);
    setManualJournalOpen(true);
  }, []);
  const closeManualJournal = useCallback(() => {
    setManualJournalOpen(false);
    setManualJournalInitialFlowId(null);
  }, []);
  // Egg + membrane framing from data/today-scene.json (neutral by default) —
  // shared with onboarding/Hatch Your Past via meadow-scene-backdrop.
  const eggFraming = todayEggFraming();
  const {
    activeDayPrompt,
    availableDayPrompts,
    answerDayPrompt,
    startHatchCheckIn,
    answerHatchCheckIn,
    finishHatchCheckIn,
    answerPhotoMeaning,
    dismissDayPrompt,
    addNote,
    addManualJournalEntry,
    saveDayPlace,
    enrichDayPlace,
    removeDayPlace,
    dismissPlaceCandidate,
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
    requestMicrophonePermission,
    cloudIntelligenceEnabled,
    setCloudIntelligenceEnabled,
    updateClassifiedMemory,
    locationPermission,
    setLocationPermission,
  } = useHomeScreenState();
  const { days: allDays } = useAllDays();
  const [clarificationMemory, setClarificationMemory] = useState<ClassifiedMemory | null>(null);
  const tabBarHeight = useBottomTabBarHeight();
  const backfillStatus = useBackfillStatus();
  const { eggFeed, eggFeedKey, heroStageRef, startEggFeed, handleEggFeedArrive, pulseEgg } = useEggFeedController();
  const { promptSheetOpen, initialPrompt, openPromptSheet, closePromptSheet } = usePromptSheetController();

  const shareableDay =
    selectedDay?.kind === 'day' && selectedDay.state === 'hatched' && selectedDay.creature && selectedDay.card
      ? (selectedDay as HomeDayRecord & {
          creature: NonNullable<HomeDayRecord['creature']>;
          card: NonNullable<HomeDayRecord['card']>;
        })
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
  const handleRevealPress = useCallback(() => {
    if (selectedDay?.kind !== 'day' || !selectedDay.canHatch) return;
    const reason = hatchCheckInEligibility(selectedDay);
    if (reason) {
      if (!selectedDay.hatchCheckIn) startHatchCheckIn(selectedDay.id, reason);
      setHatchCheckInOpen(true);
      return;
    }
    void handleReveal();
  }, [handleReveal, selectedDay, startHatchCheckIn]);

  useEffect(() => {
    if (!hatchAfterCheckIn || selectedDay?.kind !== 'day') return;
    const status = selectedDay.hatchCheckIn?.status;
    if (!status || status === 'in_progress') return;
    setHatchAfterCheckIn(false);
    void handleReveal();
  }, [handleReveal, hatchAfterCheckIn, selectedDay]);

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
  const mapRingItems = useMemo<TodayCategoryRingItem[]>(() => {
    if (!isDay) return [];
    const pinCount = selectedDay.dayMap?.nodes.length ?? 0;
    return [{
      id: 'map',
      label: 'Map',
      icon: 'map.fill',
      count: pinCount,
      countLabel: pinCount > 0 ? `${pinCount}` : undefined,
      hasContent: pinCount > 0,
      needsAttention: false,
    }];
  }, [isDay, selectedDay]);

  // --- Today-as-daily-hub: category ring, sheets, capture actions ---
  // (the same daily intelligence the World patch had, orbiting the egg instead)

  const { microcopy, setMicrocopy } = useMicrocopy();

  const sheets = useTodaySheetController();
  const {
    memoryVaultOpen,
    setMemoryVaultOpen,
    setMemoryVaultTab,
    foodPickerOpen,
    setFoodPickerOpen,
    foodVaultOpen,
    studioPickerOpen,
    setStudioPickerOpen,
    studioVaultOpen,
    sanctuaryOpen,
    moodSheetOpen,
    setMoodSheetOpen,
    sleepSheetOpen,
    setSleepSheetOpen,
    questBoardOpen,
    bigMomentPickerOpen,
    setBigMomentPickerOpen,
    placesVaultOpen,
    setPlacesVaultOpen,
    stepsSheetOpen,
    setStepsSheetOpen,
    journeySheetOpen,
    setJourneySheetOpen,
    nameSheetOpen,
  } = sheets;

  const pendingCaptureNavigationRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (pendingCaptureNavigationRef.current) clearTimeout(pendingCaptureNavigationRef.current);
  }, []);

  const navigateAfterTodayModalCloses = useCallback((navigate: () => void) => {
    const nativeModalWasOpen = promptSheetOpen || sheets.activeSurface !== null;
    closePromptSheet();
    sheets.closeAllSheets();
    if (pendingCaptureNavigationRef.current) clearTimeout(pendingCaptureNavigationRef.current);
    if (nativeModalWasOpen) {
      pendingCaptureNavigationRef.current = runAfterNativeModalDismiss(() => {
        pendingCaptureNavigationRef.current = null;
        navigate();
      });
      return;
    }
    navigate();
  }, [closePromptSheet, promptSheetOpen, sheets]);

  const openMomentCapture = useCallback((questId?: string | null) => {
    navigateAfterTodayModalCloses(() => {
      router.push({ pathname: '/moment-capture', params: { target: formingTarget, questId: questId ?? undefined } });
    });
  }, [formingTarget, navigateAfterTodayModalCloses, router]);
  const openNoteCapture = useCallback(() => {
    navigateAfterTodayModalCloses(() => {
      router.push({ pathname: '/note-capture', params: { target: formingTarget } });
    });
  }, [formingTarget, navigateAfterTodayModalCloses, router]);

  // Quick TEXT note (tap the mic): an inline text box over the page — enter
  // interprets on-device and commits straight away, no full-screen flow.
  const { quickNoteOpen, setQuickNoteOpen, handleQuickNoteSubmit, voiceNote, pendingJournalNote, clearPendingJournalNote } = useNoteCaptureController({
    allowRemote: cloudIntelligenceEnabled,
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
  const pendingNoteRoutes = useMemo(() => pendingJournalNote ? noteRoutesForSignals(pendingJournalNote) : [], [pendingJournalNote]);
  const pendingNoteRoute = journalNoteRouteNeedsConfirmation(pendingNoteRoutes) ? null : pendingNoteRoutes[0] ?? null;
  const { recentAvgSteps, memoryQuests, categories } = useTodayCategoryModel({
    allDays,
    formingDay,
    viewedDay,
    viewedIsForming,
    formingPrompts,
    handledPhotoSig,
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

  const anyManualSheetOpen =
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
    placesVaultOpen ||
    stepsSheetOpen ||
    journeySheetOpen ||
    nameSheetOpen ||
    observatoryOpen ||
    manualJournalOpen ||
    quickNoteOpen ||
    clarificationMemory !== null;

  const { foodFollowUp, studioFollowUp, clearFoodFollowUp, clearStudioFollowUp } = useMomentFollowUpController({
    formingDay,
    blocked: promptSheetOpen || isHatching || anyManualSheetOpen,
    suppressFoodFollowUp: anyManualSheetOpen,
    suppressStudioFollowUp: anyManualSheetOpen,
  });

  const {
    handleAddFood,
    handleAddStudio,
    handlePickBigMoment,
    handleConfirmMood,
    handleSetSleep,
    handleConfirmSteps,
  } = useTodayMemoryWriters({
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
    panelCategories,
    categoryById,
    statAttention,
    handleQuest,
    handleStatPress,
    handleCategoryPress,
    handleCameraPress,
    handleQuestActionIntent,
  } = useTodayActionRouter({
    categories,
    viewedIsForming,
    formingPrompts,
    photoPrompt,
    sheets,
    openPromptSheet,
    closePromptSheet,
    openCapture: openMomentCapture,
    openNoteCapture,
    openQuickNote: () => setQuickNoteOpen(true),
    openObservatory: () => setObservatoryOpen(true),
    openManualJournal,
    requestMicrophonePermission,
  });
  const suggestedPromptActions = useMemo(
    () => {
      const intelligent = formingDay
        ? planContextualPrompts(formingDay).map((suggestion) => {
            const category = QUICK_PROMPT_CATEGORIES.find((item) =>
              item.id === (suggestion.actionId === 'note' ? 'written_note' : suggestion.actionId)
            );
            return {
              // A day can have more than one unresolved memory with the same
              // action (for example two photos). Preserve the planner's
              // memory-specific identity so React and dismissal state do not
              // collapse those suggestions into one item.
              id: suggestion.id,
              actionId: suggestion.actionId,
              title: suggestion.title,
              icon: category?.icon ?? 'sparkles',
              accent: category?.accent ?? Lantern.auroraTeal,
              sourceMemoryId: suggestion.sourceMemoryId,
            };
          })
        : [];
      const fallback = categories
        .filter((category) => category.needsAttention)
        .map((category) => {
          switch (category.id) {
            case 'photos': return { id: 'photo', actionId: 'photo', title: 'Take a photo', icon: category.icon, accent: category.accent };
            case 'places': return { id: 'place', actionId: 'place', title: 'Add this place', icon: category.icon, accent: category.accent };
            case 'journey': return { id: 'movement', actionId: 'movement', title: 'How did you move?', icon: category.icon, accent: category.accent };
            case 'food': return { id: 'food', actionId: 'food', title: 'Add food or drink', icon: category.icon, accent: category.accent };
            case 'studio': return { id: 'studio', actionId: 'studio', title: 'Add watch / read', icon: category.icon, accent: category.accent };
            case 'mood': return { id: 'mood', actionId: 'mood', title: 'How does it feel?', icon: category.icon, accent: category.accent };
            case 'sleep': return { id: 'sleep', actionId: 'sleep', title: 'How was sleep?', icon: category.icon, accent: category.accent };
            default: return null;
          }
        })
        .filter((item): item is { id: string; actionId: string; title: string; icon: IconSymbolName; accent: string } => item != null);
      return [
        ...intelligent,
        ...fallback.filter((item) => !intelligent.some((candidate) => candidate.actionId === item.actionId)),
      ].slice(0, 2);
    },
    [categories, formingDay]
  );

  useFocusEffect(
    useCallback(() => {
      const intent = consumeQuestActionIntent();
      if (intent) {
        void handleQuestActionIntent(intent);
      }
      const companionIntent = consumeCompanionNavigationIntent();
      if (!companionIntent) return;
      if (companionIntent.kind === 'journal_flow') openManualJournal(companionIntent.flowId);
      else if (companionIntent.kind === 'memory_vault') {
        setMemoryVaultTab(companionIntent.tab);
        setMemoryVaultOpen(true);
      } else if (companionIntent.kind === 'places') setPlacesVaultOpen(true);
      else if (companionIntent.kind === 'movement') setJourneySheetOpen(true);
      else if (companionIntent.kind === 'rest') setSleepSheetOpen(true);
    }, [handleQuestActionIntent, openManualJournal, setJourneySheetOpen, setMemoryVaultOpen, setMemoryVaultTab, setPlacesVaultOpen, setSleepSheetOpen])
  );

  useTodayNavigationController({
    windowWidth,
    windowHeight,
    selectedDayId,
    timelineDays,
    selectTimelineDay,
    startEggFeed,
  });
  // A discovery reveal waits until nothing else is mid-flow: no sheet, prompt,
  // follow-up, recording, or hatch on screen. It then celebrates the
  // highest-rarity pending unlock first (same order as the World page).
  const flowBusy =
    isHatching ||
    hatchCheckInOpen ||
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
    placesVaultOpen ||
    observatoryOpen ||
    stepsSheetOpen ||
    journeySheetOpen ||
    nameSheetOpen ||
    manualJournalOpen ||
    quickNoteOpen ||
    clarificationMemory !== null ||
    !!foodFollowUp ||
    !!studioFollowUp ||
    !!comicGen ||
    voiceNote.phase !== 'idle';
  return (
    <View style={styles.screen}>
      {/* The Meadow scene — the shared golden-hour backdrop (also behind
          onboarding + Hatch Your Past, so the egg's world never changes). */}
      <MeadowSceneBackdrop />
      {/* Today is a FIXED composition — no page scrolling; everything anchors.
          (Readers/sheets keep their own scrolling.) The ScrollView shell stays
          for layout parity but is locked. */}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]}
        contentInsetAdjustmentBehavior="never"
        scrollEnabled={false}
        bounces={false}
        showsVerticalScrollIndicator={false}>
        <Animated.View
          ref={heroStageRef}
          entering={presenceEnter(70)}
          style={[styles.heroStage, { marginTop: heroVerticalOffset - HERO_CARD_LIFT }]}>
          <TodayDeckCarousel
            activeContent={
              isHatching && hatchingEgg ? (
                <HatchReveal
                  card={selectedDay?.kind === 'day' ? selectedDay.card ?? null : null}
                  creature={selectedDay?.kind === 'day' ? selectedDay.creature ?? null : null}
                  embedded
                  egg={hatchingEgg}
                  hideCaption
                  lanternColor={lanternColour}
                  onComplete={handleHatchComplete}
                />
              ) : isDay ? (
                isHatched ? (
                  selectedDay.card ? (
                    <DailyCard
                      card={selectedDay.card}
                      compact
                      onPress={() => router.push({ pathname: '/card/[cardId]', params: { cardId: selectedDay.card!.id } })}
                    />
                  ) : (
                    <CreatureHero creature={selectedDay.creature!} compact />
                  )
                ) : (
                  <LanternEgg
                    egg={selectedDay.egg}
                    onPress={selectedDay.canAddMoments ? () => openManualJournal() : undefined}
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
                  onPress={() => openManualJournal()}
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
              )
            }
            days={timelineDays}
            disabled={isHatching || promptSheetOpen || hatchCheckInOpen || Boolean(comicGen)}
            frameActive={isHatching || !isHatched}
            maxCardHeight={maxTodayCardHeight}
            onSelect={selectTimelineDay}
            selectedId={selectedDayId}
          />
          {/* The same category ring circles the hatched creature when revisiting
              a day — read-only doors into that day's memories. Anchored to the
              258px art box so egg and creature days match exactly. */}
          {(isForming || isHatched) && !isHatching && !hasActivePrompt ? (
            <TodayCategoryRing
              categories={mapRingItems}
              onPress={() => {
                if (isDay) handleOpenDayMap(selectedDay.id);
              }}
              anchorHeight={todayCardSize.height}
              centerOffsetY={(286 + 385) * todayCardSize.scale - todayCardSize.height / 2}
              radius={Math.min(134, 835 * todayCardSize.scale * 0.5 + 18)}
            />
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
          onReveal={handleRevealPress}
          onCamera={handleCameraPress}
          onMicTap={() => {
            if (voiceNote.phase === 'idle') setQuickNoteOpen(true);
          }}
          onMicPressIn={voiceNote.start}
          onMicPressOut={() => {
            void voiceNote.stop();
          }}
          onAdd={() => openManualJournal()}
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

      {hatchCheckInOpen && selectedDay?.kind === 'day' && selectedDay.hatchCheckIn?.status === 'in_progress' ? (
        <HatchCheckInSheet
          day={selectedDay}
          onAnswer={(input) => {
            answerHatchCheckIn(selectedDay.id, input);
            pulseEgg();
          }}
          onClose={() => setHatchCheckInOpen(false)}
          onComplete={() => {
            finishHatchCheckIn(selectedDay.id, 'completed');
            setHatchCheckInOpen(false);
            setHatchAfterCheckIn(true);
          }}
          onHatchNow={() => {
            finishHatchCheckIn(selectedDay.id, 'partial');
            setHatchCheckInOpen(false);
            setHatchAfterCheckIn(true);
          }}
        />
      ) : null}

      {quickNoteOpen ? (
        <QuickNoteComposer onClose={() => setQuickNoteOpen(false)} onSubmit={handleQuickNoteSubmit} />
      ) : null}

      {promptSheetOpen ? (
        <MomentPromptSheet
          prompts={popupPrompts.filter((prompt) => prompt.id === 'meaningful_photo')}
          initialPrompt={initialPrompt}
          suggestions={suggestedPromptActions}
          onSelectSuggestion={(suggestion) => {
            if (!suggestion.sourceMemoryId || !formingDay) return false;
            const memory = formingDay.classifiedMemories?.find((candidate) => candidate.id === suggestion.sourceMemoryId);
            if (!memory) return false;
            setClarificationMemory(memory);
            closePromptSheet();
            return true;
          }}
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
      {manualJournalOpen ? (
        <ManualJournalSheet
          allowRemoteIntelligence={cloudIntelligenceEnabled}
          dayLocationPoints={formingDay?.locations}
          initialFlowId={manualJournalInitialFlowId}
          onClose={closeManualJournal}
          onSave={(submission) => {
            addManualJournalEntry(submission, formingTarget);
            closeManualJournal();
            pulseEgg();
            setMicrocopy('Added to today');
          }}
        />
      ) : null}
      {pendingJournalNote ? (
        <ManualJournalSheet
          allowRemoteIntelligence={cloudIntelligenceEnabled}
          dayLocationPoints={formingDay?.locations}
          initialFlowId={pendingNoteRoute?.flowId}
          initialChoiceId={pendingNoteRoute?.choiceId}
          initialSpecific={pendingNoteRoute && (
            pendingJournalNote.journalClassification?.kind === 'categorized' ||
            pendingJournalNote.journalClassification?.kind === 'generic' ||
            (pendingJournalNote.intelligenceProvider === 'appleFoundation' && pendingJournalNote.llmClassified && pendingJournalNote.media)
          )
            ? noteSuggestedSpecific(pendingJournalNote)
            : null}
          initialContext={pendingJournalNote.journalClassification?.fields.context}
          initialFeeling={pendingJournalNote.journalClassification?.feeling}
          initialNote={pendingJournalNote.text}
          initialLinkedNote={{ kind: pendingJournalNote.kind, text: pendingJournalNote.text, audioUri: pendingJournalNote.audioUri ?? null, durationMs: pendingJournalNote.durationMs ?? null }}
          initialConfirmedFacets={pendingNoteRoute?.confirmedFacets}
          suggestedRoutes={pendingNoteRoute ? undefined : pendingNoteRoutes}
          journalSource={pendingJournalNote.kind === 'voice'
            ? { kind: 'voice_note', sourceId: pendingJournalNote.captureId, audioUri: pendingJournalNote.audioUri ?? null, durationMs: pendingJournalNote.durationMs ?? null }
            : { kind: 'text_note', sourceId: pendingJournalNote.captureId }}
          onClose={clearPendingJournalNote}
          onSave={(submission) => {
            addManualJournalEntry(submission, formingTarget);
            clearPendingJournalNote();
            pulseEgg();
            setMicrocopy('Added to today');
          }}
        />
      ) : null}

      {clarificationMemory ? (
        <MemoryClarificationSheet
          memory={clarificationMemory}
          onResolve={(memory) => updateClassifiedMemory(memory, formingTarget)}
          onClose={() => setClarificationMemory(null)}
        />
      ) : null}

      <TodaySheetHost
        viewedDay={viewedDay}
        viewedIsForming={viewedIsForming}
        formingTarget={formingTarget}
        sheets={sheets}
        observatoryOpen={observatoryOpen}
        foodFollowUp={foodFollowUp}
        studioFollowUp={studioFollowUp}
        suppressFollowUps={promptSheetOpen || hatchCheckInOpen || isHatching || quickNoteOpen || clarificationMemory !== null}
        memoryQuests={memoryQuests}
        recentAvgSteps={recentAvgSteps}
        observations={observations}
        travelMemory={travelMemory}
        cloudIntelligenceEnabled={cloudIntelligenceEnabled}
        setCloudIntelligenceEnabled={setCloudIntelligenceEnabled}
        onOpenIntelligenceLab={() => router.push('/intelligence-lab')}
        setObservatoryOpen={setObservatoryOpen}
        onCapturePhoto={openMomentCapture}
        onCaptureNote={openNoteCapture}
        openPromptSheet={openPromptSheet}
        openManualJournal={openManualJournal}
        handleOpenDayMap={handleOpenDayMap}
        handleAddFood={handleAddFood}
        handleAddStudio={handleAddStudio}
        handlePickBigMoment={handlePickBigMoment}
        handleConfirmMood={handleConfirmMood}
        handleSetSleep={handleSetSleep}
        handleConfirmSteps={handleConfirmSteps}
        handleQuest={handleQuest}
        locationPermission={locationPermission}
        saveDayPlace={saveDayPlace}
        enrichDayPlace={enrichDayPlace}
        removeDayPlace={removeDayPlace}
        dismissPlaceCandidate={dismissPlaceCandidate}
        setLocationPermission={setLocationPermission}
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
          onChooseSemantic={voiceNote.chooseSemantic}
          semanticChoiceMade={voiceNote.semanticChoiceMade}
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
  );
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
    marginHorizontal: -24,
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
