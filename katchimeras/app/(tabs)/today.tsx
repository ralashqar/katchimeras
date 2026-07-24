import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { MomentPromptSheet, type PromptMenuSection } from '@/components/katchadeck/home/moment-prompt-sheet';
import { ManualJournalSheet } from '@/components/katchadeck/home/manual-journal-sheet';
import { CreatureHero } from '@/components/katchadeck/home/creature-hero';
import { HatchCheckInSheet } from '@/components/katchadeck/home/hatch-check-in-sheet';
import { HatchCountdown } from '@/components/katchadeck/home/hatch-countdown';
import { LanternTimeline } from '@/components/katchadeck/home/lantern-timeline';
import { TodayHexNeighborhood } from '@/components/katchadeck/home/today-hex-neighborhood';
import type { TodayTileRenderMode } from '@/components/katchadeck/home/today-hex-neighborhood';
import {
  TodayKingdomEggAboveOverlay,
  TodayKingdomEggHero,
  TodayKingdomEggOverlay,
} from '@/components/katchadeck/home/today-kingdom-egg-hero';
import { TodaySceneBackdrop } from '@/components/katchadeck/home/today-scene-backdrop';
import { TodayTileHatchReveal } from '@/components/katchadeck/home/today-tile-hatch-reveal';
import { ResolvedAtmosphereLayer } from '@/components/katchadeck/world/atmosphere-layer';
import {
  TodayEnvironmentMotionProvider,
  useTodayEnvironmentMotion,
} from '@/components/katchadeck/home/today-environment-motion';
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
import todayScene from '@/data/today-scene.json';
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
import { QuickNoteComposer } from '@/components/katchadeck/home/quick-note-composer';
import { MemoryClarificationSheet } from '@/components/katchadeck/world/memory-clarification-sheet';
import type { ClassifiedMemory, HomeDayRecord, HomeTimelineDay } from '@/types/home';
import { consumeQuestActionIntent } from '@/utils/quest-action-signal';
import { consumeCompanionNavigationIntent } from '@/utils/companion-navigation-intent';
import { planContextualPrompts } from '@/utils/intelligence/prompt-planner';
import { noteRoutesForSignals, noteSuggestedSpecific } from '@/utils/journal-input-adapters';
import { journalNoteRouteNeedsConfirmation } from '@/utils/journal-routing';
import { runAfterNativeModalDismiss } from '@/utils/native-modal-navigation';
import { hatchCheckInEligibility } from '@/utils/hatch-check-in';
import { loadWorldIdentity } from '@/utils/world-identity';
import { TODAY_KINGDOM_STAGE_HEIGHT } from '@/utils/today-kingdom-hero-layout';
import { atmosphereSettingsForPlan, resolveDayAtmosphere } from '@/utils/day-atmosphere';
import { todayAtmosphereBackgroundForDay } from '@/utils/day-background-scene';
import { todayHatchShowsResident, todayHatchShowsTomorrow } from '@/utils/today-hatch-presentation';

// Hatched-day extras, parked so the numbers card stays at its usual anchor
// (same pattern as the photos/timeline sections in day-journal-sections).
const SHOW_HATCHED_ACTION_DOCK = false;
const SHOW_HATCHED_REFLECTION_CARD = false;

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
  const [homeArchetypeId, setHomeArchetypeId] = useState(() => loadWorldIdentity().selectedHomeArchetypeId);
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
  const backfillStatus = useBackfillStatus();
  const { eggFeed, eggFeedKey, heroStageRef, startEggFeed, handleEggFeedArrive, pulseEgg } = useEggFeedController();
  const { promptSheetOpen, initialPrompt, openPromptSheet, closePromptSheet } = usePromptSheetController();

  useFocusEffect(
    useCallback(() => {
      setHomeArchetypeId(loadWorldIdentity().selectedHomeArchetypeId);
    }, [])
  );

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
    postcardDay,
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

  const {
    isHatching,
    presentation: hatchPresentation,
    handleHatchAssetsReady,
    handleReveal,
  } = useTodayHatchRevealController({
    selectedDay,
    triggerHatchIfReady,
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
  const hatchShowsResident = todayHatchShowsResident(hatchPresentation.phase);
  const hatchShowsTomorrow = todayHatchShowsTomorrow(hatchPresentation.phase);
  const hatchIsCurrentToday = Boolean(hatchPresentation.daySnapshot?.isToday);
  const atmosphereDay = isHatching && !hatchShowsResident
    ? hatchPresentation.daySnapshot
    : viewedDay;
  const dayAtmosphere = useMemo(() => resolveDayAtmosphere(atmosphereDay), [atmosphereDay]);
  const dayAtmosphereSettings = useMemo(
    () => atmosphereSettingsForPlan(dayAtmosphere),
    [dayAtmosphere],
  );
  const dayBackground = useMemo(
    () => todayAtmosphereBackgroundForDay(atmosphereDay, allDays),
    [allDays, atmosphereDay],
  );
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
  useEffect(() => {
    if (hatchPresentation.error) setMicrocopy(hatchPresentation.error);
  }, [hatchPresentation.error, setMicrocopy]);

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
  const { recentAvgSteps, memoryQuests, categories, categoriesLoading } = useTodayCategoryModel({
    allDays,
    formingDay,
    viewedDay,
    viewedIsForming,
    formingPrompts,
    handledPhotoSig,
    timelineDays,
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

  const renderTimelineHero = useCallback((
    timelineDay: HomeTimelineDay,
    mode: TodayTileRenderMode,
  ) => {
    const active = mode === 'active';
    if (active && isHatching && hatchPresentation.dayId === timelineDay.id) {
      return (
        <TodayTileHatchReveal
          homeArchetypeId={homeArchetypeId}
          onAssetsReady={handleHatchAssetsReady}
          presentation={hatchPresentation}
        />
      );
    }
    const day = timelineDay.kind === 'day' ? timelineDay : tomorrowDay;
    if (day?.state === 'hatched' && day.creature) {
      return (
        <CreatureHero
          artLod={active ? 'medium' : 'thumb'}
          compact
          creature={day.creature}
          hideCompactCard={!active}
          kingdomEnvironment
          kingdomHomeArchetypeId={homeArchetypeId}
          pinchStrength={active ? 1 : todayScene.homeEnvironment.motion.neighborPinchStrength}
        />
      );
    }

    return (
      <TodayKingdomEggHero
        accentColor={day?.egg.accentColor}
        coreColor={day?.egg.coreColor}
        feedbackKey={active ? eggFeedKey : 0}
        homeArchetypeId={homeArchetypeId}
        isReady={active && day?.state === 'ready_to_hatch'}
        onEggPress={active && day?.canAddMoments ? () => openManualJournal() : undefined}
        pinchStrength={active ? 1 : todayScene.homeEnvironment.motion.neighborPinchStrength}
      />
    );
  }, [eggFeedKey, handleHatchAssetsReady, hatchPresentation, homeArchetypeId, isHatching, openManualJournal, tomorrowDay]);

  const renderTimelineOverlay = useCallback((timelineDay: HomeTimelineDay, active: boolean) => {
    if (
      !active ||
      isHatching ||
      timelineDay.kind !== 'day' ||
      !timelineDay.isToday ||
      timelineDay.state === 'hatched'
    ) {
      return null;
    }
    return (
      <TodayKingdomEggOverlay homeArchetypeId={homeArchetypeId}>
        <HatchCountdown isReady={timelineDay.state === 'ready_to_hatch'} />
      </TodayKingdomEggOverlay>
    );
  }, [homeArchetypeId, isHatching]);

  const { cameraProgress, navigateToDay, renderedIndices, swipeGesture } = useTodayNavigationController({
    windowWidth,
    windowHeight,
    selectedDayId,
    timelineDays,
    isTodayHatched,
    isHatching,
    promptSheetOpen: promptSheetOpen || hatchCheckInOpen,
    comicOpen: Boolean(comicGen),
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
  const { environmentGesture, environmentMotion } = useTodayEnvironmentMotion({
    enabled: !flowBusy,
  });
  const pageGesture = Gesture.Simultaneous(swipeGesture, environmentGesture);
  return (
    <TodayEnvironmentMotionProvider motion={environmentMotion}>
    <GestureDetector gesture={pageGesture}>
    <View style={styles.screen}>
      <TodaySceneBackdrop
        background={dayBackground}
        scene={null}
      />
      {/* Today is a FIXED composition — no page scrolling; everything anchors.
          (Readers/sheets keep their own scrolling.) The ScrollView shell stays
          for layout parity but is locked. */}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
        contentInsetAdjustmentBehavior="never"
        scrollEnabled={false}
        bounces={false}
        showsVerticalScrollIndicator={false}>
        <Animated.View entering={presenceEnter(20)} style={styles.timelineLayer}>
          <LanternTimeline
            days={timelineDays}
            hatchPresentation={hatchPresentation}
            interactionLocked={isHatching}
            onSelect={navigateToDay}
            selectedId={selectedDayId}
          />
        </Animated.View>

        <Animated.View
          ref={heroStageRef}
          entering={presenceEnter(70)}
          style={styles.heroStage}>
          <TodayHexNeighborhood
            allowTomorrow={
              isTodayHatched
              && (!isHatching || !hatchIsCurrentToday || hatchShowsTomorrow)
            }
            cameraProgress={cameraProgress}
            days={selectedDay && !timelineDays.some((day) => day.id === selectedDay.id)
              ? [selectedDay]
              : timelineDays}
            foreground={<ResolvedAtmosphereLayer plane="foreground" settings={dayAtmosphereSettings} target="today" />}
            interactionLocked={isHatching}
            onSelect={navigateToDay}
            renderedIndices={renderedIndices}
            selectedId={selectedDayId}
            renderDay={renderTimelineHero}
            renderDayOverlay={renderTimelineOverlay}
          />
          {voiceNote.phase !== 'idle' ? (
            <TodayKingdomEggAboveOverlay homeArchetypeId={homeArchetypeId}>
              <InlineVoiceNote
                elapsed={voiceNote.elapsed}
                phase={voiceNote.phase}
              />
            </TodayKingdomEggAboveOverlay>
          ) : null}
          {/* The same category ring circles the hatched creature when revisiting
              a day, anchored to the shared 258px egg/creature art stage. */}
          {(isForming || isHatched) && !isHatching && !hasActivePrompt ? (
            <TodayCategoryRing
              categories={mapRingItems}
              onPress={() => {
                if (isDay) handleOpenDayMap(selectedDay.id);
              }}
              anchorHeight={258}
              centerOffsetY={24}
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
          momentCount={categoryById.get('reflection')?.count}
          sharingBusy={isDay ? sharingDayId === selectedDay.id : false}
          comicBusy={comicGen?.status === 'generating'}
          statAttention={isFormingToday ? statAttention : undefined}
          categories={panelCategories}
          categoryDataLoading={categoriesLoading}
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
          initialFlowId={pendingNoteRoute?.flowId ?? (
            pendingJournalNote.topLevelConfidence === 'high' && pendingJournalNote.subcategoryConfidence !== 'high'
              ? pendingJournalNote.suggestedJournalFlowId
              : undefined
          )}
          initialChoiceId={pendingNoteRoute?.choiceId}
          suggestedFlowId={pendingJournalNote.topLevelConfidence !== 'high' ? pendingJournalNote.suggestedJournalFlowId : null}
          suggestedChoiceId={pendingJournalNote.topLevelConfidence === 'high' && pendingJournalNote.subcategoryConfidence !== 'high'
            ? pendingNoteRoutes[0]?.choiceId
            : null}
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
      {postcardDay ? (
        <View pointerEvents="none" style={styles.captureCardWrap}>
          <MemoryPostcard day={postcardDay} ref={postcardRef} />
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
    </TodayEnvironmentMotionProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: Lantern.ink950,
    flex: 1,
  },
  content: {
    flexGrow: 1,
    // Fixed page (no scroll): the hero and bottom dock retain their historical
    // anchors above the floating tab bar.
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
    height: TODAY_KINGDOM_STAGE_HEIGHT,
    isolation: 'isolate',
    justifyContent: 'center',
    marginTop: 26,
    overflow: 'visible',
    position: 'relative',
    // Keep the entire scenic neighborhood in one low stacking plane. UI
    // prompts below and above this node must never compete with tile/creature
    // z-indices internal to the neighborhood.
    zIndex: 0,
  },
  timelineLayer: {
    position: 'relative',
    zIndex: 20,
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
    elevation: 40,
    gap: 12,
    marginTop: 2,
    position: 'relative',
    zIndex: 40,
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
