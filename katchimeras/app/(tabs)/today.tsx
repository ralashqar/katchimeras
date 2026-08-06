import { useRouter } from 'expo-router';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import {
  ActivityIndicator,
  BackHandler,
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { MomentPromptSheet, type PromptMenuSection } from '@/components/katchadeck/home/moment-prompt-sheet';
import {
  TodayPhotoLibrarySheet,
  type TodayPhotoLibrarySheetContent,
} from '@/components/katchadeck/home/today-photo-library-sheet';
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
import {
  TodayExplorationBackground,
  TodayExplorationPageLayer,
  TodayExplorationSceneLayer,
  useTodayExplorationBackgroundMotion,
} from '@/components/katchadeck/home/today-exploration-background';
import { TodayTileHatchReveal } from '@/components/katchadeck/home/today-tile-hatch-reveal';
import { TodayHatchEnvironmentCrossfade } from '@/components/katchadeck/home/today-hatch-environment-crossfade';
import { ResolvedAtmosphereLayer } from '@/components/katchadeck/world/atmosphere-layer';
import {
  TodayEnvironmentMotionProvider,
  TodayEnvironmentViewportMotionLayer,
  useTodayEnvironmentMotion,
} from '@/components/katchadeck/home/today-environment-motion';
import { MemoryPostcard } from '@/components/katchadeck/home/memory-postcard';
import { DayPromptStrip } from '@/components/katchadeck/home/day-prompt-strip';
import { EggFeedOverlay } from '@/components/katchadeck/home/egg-feed-overlay';
import { TodayCategoryRing, type TodayCategoryRingItem } from '@/components/katchadeck/home/today-category-ring';
import { TodayBottomDock } from '@/components/katchadeck/home/today-bottom-dock';
import {
  TodayNurtureExperience,
} from '@/components/katchadeck/home/today-nurture-experience';
import {
  QuickGoalsSheet,
} from '@/components/katchadeck/goals/companion-quick-goals';
import { QuickGoalActionModal } from '@/components/katchadeck/goals/quick-goal-action-modal';
import { TodayGoalsExperience } from '@/components/katchadeck/goals/today-goals-experience';
import { DayComicOverlay } from '@/components/katchadeck/home/day-comic-overlay';
import { MicrocopyToast } from '@/components/katchadeck/home/microcopy-toast';
import { TodaySheetHost } from '@/components/katchadeck/home/today-sheet-host';
import { InlineVoiceNote } from '@/components/katchadeck/world/inline-voice-note';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { presenceEnter } from '@/components/katchadeck/motion';
import { ThemedText } from '@/components/themed-text';
import { hasQuickGoalTemplates } from '@/constants/companion-quick-goals';
import { AppFontFamilies, Lantern } from '@/constants/theme';
import { GROWTH_ENERGY_ART } from '@/constants/today-care-art';
import { HOME_SCENE_Y_OFFSET } from '@/constants/home-loop-layout';
import todayScene from '@/data/today-scene.json';
import { useHomeScreenState } from '@/hooks/use-home-screen-state';
import { homeRepository } from '@/storage/repositories/home-repository';
import { useAllDays } from '@/hooks/use-all-days';
import { useCompanionQuickGoals } from '@/hooks/use-companion-quick-goals';
import { useDevAllKatchimerasAvailable } from '@/hooks/use-dev-all-katchimeras-available';
import { useBackfillStatus } from '@/utils/backfill-status';
import { DiscoveryReveal } from '@/components/katchadeck/world/discovery-reveal';
import { CompanionAchievementCelebration } from '@/components/katchadeck/world/companion-achievement-celebration';
import { ProgressBackfillNotice } from '@/components/katchadeck/world/progress-backfill-notice';
import { useEggFeedController } from '@/features/today/use-egg-feed-controller';
import { usePromptSheetController } from '@/features/today/use-prompt-sheet-controller';
import { useMicrocopy } from '@/features/today/use-microcopy';
import { useTodaySheetController } from '@/features/today/use-today-sheet-controller';
import { useTodayActionRouter } from '@/features/today/use-today-action-router';
import { useObservatoryController } from '@/features/today/use-observatory-controller';
import { useDiscoveryRevealController } from '@/features/today/use-discovery-reveal-controller';
import { useCompanionAchievements } from '@/hooks/use-companion-achievements';
import { useNoteCaptureController } from '@/features/today/use-note-capture-controller';
import { useTodayMemoryWriters } from '@/features/today/use-today-memory-writers';
import { useTodayPromptAnswerController } from '@/features/today/use-today-prompt-answer-controller';
import { useTodayShareComicController } from '@/features/today/use-today-share-comic-controller';
import { useTodayCategoryModel } from '@/features/today/use-today-category-model';
import { useTodayNavigationController } from '@/features/today/use-today-navigation-controller';
import { useTodayHatchRevealController } from '@/features/today/use-today-hatch-reveal-controller';
import { useTodayEnergyLoop } from '@/features/today/use-today-energy-loop';
import { useTodayEnergyFrameProbe } from '@/features/today/use-today-energy-frame-probe';
import { TodayEnergyProfiler } from '@/features/today/today-energy-profiler';
import { resolveHomeLoopPresentation } from '@/features/today/home-loop-presentation';
import { QuickNoteComposer } from '@/components/katchadeck/home/quick-note-composer';
import { MemoryClarificationSheet } from '@/components/katchadeck/world/memory-clarification-sheet';
import type { ClassifiedMemory, HomeDayRecord, HomeTimelineDay, MemoryDomain } from '@/types/home';
import type { KatchimeraFamilyId } from '@/types/katchimera';
import { consumeQuestActionIntent } from '@/utils/quest-action-signal';
import { consumeCompanionNavigationIntent } from '@/utils/companion-navigation-intent';
import { planContextualPrompts } from '@/utils/intelligence/prompt-planner';
import { noteRoutesForSignals, noteSuggestedSpecific } from '@/utils/journal-input-adapters';
import { journalNoteRouteNeedsConfirmation } from '@/utils/journal-routing';
import { runAfterNativeModalDismiss } from '@/utils/native-modal-navigation';
import { hatchCheckInEligibility } from '@/utils/hatch-check-in';
import { loadWorldIdentity } from '@/utils/world-identity';
import {
  todayExplorationCreatureStageFrame,
  todayExplorationEggStageFrame,
  TODAY_EXPLORATION_HERO_STAGE_TOP_AFTER_SAFE_AREA,
  TODAY_KINGDOM_STAGE_HEIGHT,
} from '@/utils/today-kingdom-hero-layout';
import { atmosphereSettingsForPlan, resolveDayAtmosphere } from '@/utils/day-atmosphere';
import {
  todayAtmosphereBackgroundForDay,
  type TodayAtmosphereBackground,
} from '@/utils/day-background-scene';
import { todayHatchShowsResident, todayHatchShowsTomorrow } from '@/utils/today-hatch-presentation';
import { identityForCreature } from '@/utils/katchimera-identity';
import {
  todayKatchimeraExplorationBackgroundKeyForPresentation,
  type TodayExplorationBackgroundKey,
} from '@/utils/today-exploration-backgrounds';
import { companionIdForFamily, katchimeraFamilies } from '@/constants/katchimera-skins';
import { companionDestinationStageLift } from '@/utils/companion-home-layout';
import {
  journalFlowCompletesTodayCareAction,
  rankTodayCareActions,
  type RankedTodayCareAction,
  type TodayCareContextCategory,
} from '@/utils/today-care';
import {
  consumeTodayCareGameRoundCompletion,
  requestTodayCareGameRound,
} from '@/utils/today-care-game-round';
import { pendingGrowthAwards, TODAY_GROWTH_REWARDS, todayGrowthSummary } from '@/utils/today-growth';
import { selectTodayCareGame } from '@/utils/game-hub';
import { loadGameHubItemsForDays } from '@/utils/game-hub-state';
import { buildTodayPhotoRollSuggestion } from '@/utils/today-photo-roll-suggestion';
import { loadOnboardingProfile } from '@/utils/onboarding-state';
import { resolveHatchHour } from '@/game/days/lifecycle';
import type { CompanionQuickGoal, CompanionQuickGoalCompletion } from '@/utils/companion-quick-goals';
import {
  activeSemanticQuestPrompt,
  cancelSemanticNoteQuestCapture,
  completeSemanticNoteQuestCapture,
} from '@/utils/quests/semantic-note-capture';

// Hatched-day extras, parked so the numbers card stays at its usual anchor
// (same pattern as the photos/timeline sections in day-journal-sections).
const SHOW_HATCHED_ACTION_DOCK = true;
const SHOW_HATCHED_REFLECTION_CARD = false;

type TodayExplorationPageDescriptor = {
  backgroundKey: TodayExplorationBackgroundKey | null;
  fallbackBackground: TodayAtmosphereBackground | null;
  timelineDay: HomeTimelineDay;
};

type TodayExplorationTransitionSnapshot = {
  direction: -1 | 1;
  source: TodayExplorationPageDescriptor;
  target: TodayExplorationPageDescriptor;
};

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

export default function TodayRouteScreen() {
  const screenFocused = useIsFocused();
  if (!screenFocused) return <View style={styles.inactiveScreen} />;
  return <HomeScreen />;
}

function HomeScreen() {
  const router = useRouter();
  const screenFocused = useIsFocused();
  const [growthNow, setGrowthNow] = useState(() => new Date());
  useEffect(() => {
    if (!screenFocused) return;
    setGrowthNow(new Date());
    const timer = setInterval(() => setGrowthNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, [screenFocused]);
  const allKatchimerasAvailable = useDevAllKatchimerasAvailable();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [homeArchetypeId, setHomeArchetypeId] = useState(() => loadWorldIdentity().selectedHomeArchetypeId);
  const [heroStageTop, setHeroStageTop] = useState<number | null>(null);
  const [manualJournalOpen, setManualJournalOpen] = useState(false);
  const [quickGoalsOpen, setQuickGoalsOpen] = useState(false);
  const [quickGoalSheetMode, setQuickGoalSheetMode] = useState<'add' | 'manage' | null>(null);
  const [selectedCareGoalId, setSelectedCareGoalId] = useState<string | null>(null);
  const selectedCareGoalCompletionRef = useRef<(() => void) | null>(null);
  const [todayPhotoLibrarySheet, setTodayPhotoLibrarySheet] = useState<TodayPhotoLibrarySheetContent | null>(null);
  const incubationActivatedRef = useRef<boolean | null>(null);
  const {
    clearIntent: clearCareIntent,
    completionEvent: queuedCareCompletion,
    finishCompletion: finishCareCompletion,
    flowWasBusyRef: careFlowWasBusyRef,
    markDestinationOpen: markCareDestinationOpen,
    markDomainCommit: markCareDomainCommit,
    markRewardLaunch: markCareRewardLaunch,
    markTokenArrival: markCareTokenArrival,
    noteFlowBusy: noteCareFlowBusy,
    pendingIntent: pendingCareIntent,
    queueCompletion: queueCareCompletion,
    rewardAlreadyAnimated: careRewardAlreadyAnimated,
    startIntent: startCareIntent,
    status: energyLoopStatus,
  } = useTodayEnergyLoop();
  useTodayEnergyFrameProbe(
    energyLoopStatus === 'rewarding'
      || energyLoopStatus === 'entering',
  );
  const [quickGoalJournal, setQuickGoalJournal] = useState<{
    completion: CompanionQuickGoalCompletion;
    goal: CompanionQuickGoal;
  } | null>(null);
  const [hatchCheckInOpen, setHatchCheckInOpen] = useState(false);
  const [hatchAfterCheckIn, setHatchAfterCheckIn] = useState(false);
  const [manualJournalInitialFlowId, setManualJournalInitialFlowId] = useState<string | null>(null);
  const [manualJournalInitialChoiceId, setManualJournalInitialChoiceId] = useState<string | null>(null);
  const [manualJournalInitialContextId, setManualJournalInitialContextId] = useState<string | null>(null);
  const deferredJournalCareCompletionRef = useRef<string | null>(null);
  const deferredJournalCareTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openManualJournal = useCallback((flowId?: string, categoryId?: string, contextId?: string | null) => {
    setManualJournalInitialFlowId(flowId ?? null);
    setManualJournalInitialChoiceId(categoryId ?? null);
    setManualJournalInitialContextId(contextId ?? null);
    setManualJournalOpen(true);
  }, []);
  const closeManualJournal = useCallback(() => {
    setManualJournalOpen(false);
    setManualJournalInitialFlowId(null);
    setManualJournalInitialChoiceId(null);
    setManualJournalInitialContextId(null);
  }, []);
  const queueCareCompletionAfterJournalDismiss = useCallback((action: RankedTodayCareAction) => {
    if (deferredJournalCareTimerRef.current) clearTimeout(deferredJournalCareTimerRef.current);
    deferredJournalCareCompletionRef.current = action.instanceId;
    deferredJournalCareTimerRef.current = runAfterNativeModalDismiss(() => {
      deferredJournalCareTimerRef.current = null;
      deferredJournalCareCompletionRef.current = null;
      queueCareCompletion(action, false);
    });
  }, [queueCareCompletion]);
  useEffect(() => () => {
    if (deferredJournalCareTimerRef.current) clearTimeout(deferredJournalCareTimerRef.current);
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
    awardGrowth: awardTodayGrowth,
    completeEnergyAction,
    updateCareAction,
  } = useHomeScreenState();
  const {
    isHatching,
    presentation: hatchPresentation,
    handleHatchEnvironmentReady,
    handleHatchSubjectReady,
    handleReveal,
  } = useTodayHatchRevealController({
    selectedDay,
    triggerHatchIfReady,
  });
  const { days: allDays } = useAllDays();
  const isDay = selectedDay?.kind === 'day';
  const homeLoopPresentation = useMemo(() => resolveHomeLoopPresentation({
    activeDayPrompt,
    availableDayPrompts,
    isHatching,
    isTodayHatched,
    selectedDay,
    tomorrowActivePrompt,
    tomorrowAvailablePrompts,
    tomorrowDay,
  }), [
    activeDayPrompt,
    availableDayPrompts,
    isHatching,
    isTodayHatched,
    selectedDay,
    tomorrowActivePrompt,
    tomorrowAvailablePrompts,
    tomorrowDay,
  ]);
  const isFormingToday = homeLoopPresentation.mode === 'forming-today';
  const onTomorrowForming = homeLoopPresentation.mode === 'forming-tomorrow';
  const isForming = homeLoopPresentation.forming !== null;
  const formingTarget = homeLoopPresentation.forming?.target ?? 'today';
  const formingDay = homeLoopPresentation.forming?.day ?? null;
  const formingPrompts = homeLoopPresentation.forming?.prompts ?? availableDayPrompts;
  const formingActivePrompt = homeLoopPresentation.forming?.activePrompt ?? null;
  const todayCareGame = useMemo(() => {
    if (!formingDay) return null;
    const items = loadGameHubItemsForDays({
      allKatchimerasAvailable,
      dayId: formingDay.isoDate,
      days: allDays,
    });
    const excludedQuestIds = new Set(
      (formingDay.growth?.careActions ?? []).flatMap((action) => {
        const prefix = 'mini_game_round:';
        return action.definitionId.startsWith(prefix) && action.status !== 'active'
          ? [action.definitionId.slice(prefix.length)]
          : [];
      }),
    );
    return selectTodayCareGame(items, formingDay.isoDate, excludedQuestIds);
  }, [allDays, allKatchimerasAvailable, formingDay]);
  const quickGoalFamilyIds = useMemo(() => {
    if (allKatchimerasAvailable) {
      return katchimeraFamilies
        .filter((family) => family.anchorVisualKey && hasQuickGoalTemplates(family.id))
        .map((family) => family.id);
    }
    const ids = new Set<KatchimeraFamilyId>();
    for (const day of allDays) {
      if (!day.creature) continue;
      const familyId = identityForCreature(day.creature)?.familyId;
      if (familyId && hasQuickGoalTemplates(familyId)) ids.add(familyId);
    }
    return [...ids];
  }, [allDays, allKatchimerasAvailable]);
  const quickGoals = useCompanionQuickGoals({
    dayId: formingDay?.isoDate ?? null,
    availableFamilyIds: quickGoalFamilyIds,
  });
  useEffect(() => {
    if (!formingDay) return;
    for (const award of pendingGrowthAwards(formingDay)) awardTodayGrowth(award, formingTarget);
  }, [awardTodayGrowth, formingDay, formingTarget]);
  useEffect(() => {
    if (!formingDay) return;
    for (const item of quickGoals.goalsForToday) {
      if (!item.completion) continue;
      awardTodayGrowth({
        actionId: `quick-goal:${item.goal.id}`,
        amount: 8,
        source: 'quick_goal',
        sourceId: item.completion.id,
      }, formingTarget);
    }
  }, [awardTodayGrowth, formingDay, formingTarget, quickGoals.goalsForToday]);
  const [clarificationMemory, setClarificationMemory] = useState<ClassifiedMemory | null>(null);
  const reduceMotion = useReducedMotion();
  const goalsFocusProgress = useSharedValue(0);
  const backfillStatus = useBackfillStatus();
  const {
    eggFeed,
    eggFeedKey,
    eggFeedRewardRequestKey,
    eggTargetRef,
    heroStageRef,
    startEggFeed,
    handleEggFeedArrive,
    handleEnergyTokenArrive,
    pulseEgg,
    setNextEnergyCurrencySource,
  } = useEggFeedController();
  useEffect(() => {
    if (!pendingCareIntent) setNextEnergyCurrencySource(null);
  }, [pendingCareIntent, setNextEnergyCurrencySource]);
  const handleCareRewardFlight = useCallback((
    from: Parameters<typeof startEggFeed>[0],
    action: RankedTodayCareAction,
    onArrive: () => void,
  ) => {
    markCareRewardLaunch();
    startEggFeed(from, {
      currencyFrom: from,
      energyAmount: action.growthReward,
      energyOnly: true,
      imageSource: GROWTH_ENERGY_ART,
      tint: Lantern.ember300,
    }, onArrive);
  }, [markCareRewardLaunch, startEggFeed]);
  const handleEnergyArrival = useCallback((amount: number, index: number, count: number) => {
    markCareTokenArrival(index, count);
    handleEnergyTokenArrive(amount, index, count);
  }, [handleEnergyTokenArrive, markCareTokenArrival]);
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

  const isHatched = isDay && selectedDay.state === 'hatched' && selectedDay.creature;
  const selectedHatchedCompanionId = isDay && selectedDay.state === 'hatched' && selectedDay.creature
    ? identityForCreature(selectedDay.creature)?.companionId ?? null
    : null;
  const selectedKatchimeraExplorationKey =
    isDay && selectedDay.state === 'hatched' && selectedDay.creature
      ? todayKatchimeraExplorationBackgroundKeyForPresentation({
          creature: selectedDay.creature,
          environmentVisualKey: selectedDay.card?.scene?.environment?.visualKey,
        })
      : null;
  const explorationBackgroundKey: TodayExplorationBackgroundKey | null = isForming
    ? 'home'
    : selectedKatchimeraExplorationKey;
  const explorationBackgroundActive = explorationBackgroundKey != null && !isHatching;
  // LanternTimeline's visual row is ~85dp tall. This estimate gives the egg a
  // correct first frame; onLayout replaces it with the measured stage y.
  const resolvedHeroStageTop =
    heroStageTop
    ?? insets.top + TODAY_EXPLORATION_HERO_STAGE_TOP_AFTER_SAFE_AREA;
  const explorationEggFrame = todayExplorationEggStageFrame(
    windowWidth,
    windowHeight,
    resolvedHeroStageTop,
  );
  const explorationCreatureFrame =
    selectedKatchimeraExplorationKey
    && isDay
    && selectedDay.state === 'hatched'
    && selectedDay.creature
      ? todayExplorationCreatureStageFrame(
          windowWidth,
          windowHeight,
          resolvedHeroStageTop,
          selectedDay.creature.visualKey,
        )
      : null;
  const explorationSubjectFrame = explorationCreatureFrame ?? explorationEggFrame;
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
  const explorationTransitionPages = useMemo(() => {
    const selectedIndex = timelineDays.findIndex(
      (day) => day.id === selectedDayId,
    );
    const pageAt = (direction: -1 | 1) => {
      if (selectedIndex < 0) return null;
      const target = timelineDays[selectedIndex + direction];
      if (!target) return null;
      if (target.kind === 'tomorrow' && !isTodayHatched) return null;

      const resolvedDay = target.kind === 'day' ? target : tomorrowDay;
      let backgroundKey: TodayExplorationBackgroundKey | null = null;
      if (target.kind === 'tomorrow') {
        backgroundKey = 'home';
      } else if (
        resolvedDay?.isToday
        && resolvedDay.state !== 'hatched'
      ) {
        backgroundKey = 'home';
      } else if (
        resolvedDay?.state === 'hatched'
        && resolvedDay.creature
      ) {
        backgroundKey =
          todayKatchimeraExplorationBackgroundKeyForPresentation({
            creature: resolvedDay.creature,
            environmentVisualKey:
              resolvedDay.card?.scene?.environment?.visualKey,
          });
      }

      return {
        backgroundKey,
        fallbackBackground: backgroundKey
          ? null
          : todayAtmosphereBackgroundForDay(resolvedDay, allDays),
        timelineDay: target,
      };
    };

    return {
      next: pageAt(1),
      previous: pageAt(-1),
    };
  }, [
    allDays,
    isTodayHatched,
    selectedDayId,
    timelineDays,
    tomorrowDay,
  ]);
  const currentExplorationPage = useMemo<TodayExplorationPageDescriptor | null>(
    () => selectedDay
      ? {
          backgroundKey: explorationBackgroundKey,
          fallbackBackground: explorationBackgroundKey ? null : dayBackground,
          timelineDay: selectedDay,
        }
      : null,
    [
      dayBackground,
      explorationBackgroundKey,
      selectedDay,
    ],
  );
  const [
    explorationTransitionSnapshot,
    setExplorationTransitionSnapshot,
  ] = useState<TodayExplorationTransitionSnapshot | null>(null);
  const explorationTransitionTargetIdRef = useRef<string | null>(null);
  const beginExplorationTransition = useCallback((direction: -1 | 1) => {
    const target = direction === -1
      ? explorationTransitionPages.previous
      : explorationTransitionPages.next;
    if (!currentExplorationPage || !target) return;
    explorationTransitionTargetIdRef.current = target.timelineDay.id;
    setExplorationTransitionSnapshot({
      direction,
      source: currentExplorationPage,
      target,
    });
  }, [currentExplorationPage, explorationTransitionPages]);
  const displayedExplorationCurrent =
    explorationTransitionSnapshot?.source ?? currentExplorationPage;
  const displayedExplorationPrevious = explorationTransitionSnapshot
    ? explorationTransitionSnapshot.direction === -1
      ? explorationTransitionSnapshot.target
      : null
    : explorationTransitionPages.previous;
  const displayedExplorationNext = explorationTransitionSnapshot
    ? explorationTransitionSnapshot.direction === 1
      ? explorationTransitionSnapshot.target
      : null
    : explorationTransitionPages.next;
  const explorationTargetCommitted = Boolean(
    explorationTransitionSnapshot
    && explorationTransitionSnapshot.target.timelineDay.id === selectedDayId,
  );
  const explorationPresentationActive =
    explorationBackgroundActive || explorationTransitionSnapshot != null;
  const goalRingItems = useMemo<TodayCategoryRingItem[]>(() => {
    if (!isDay || !selectedDay.isToday || !quickGoalFamilyIds.length) return [];
    const goalCount = quickGoals.goalsForToday.length;
    const remainingCount = quickGoals.goalsForToday.filter((item) => !item.completion).length;
    return [{
      id: 'goals',
      label: 'Goals',
      icon: 'list.clipboard.fill',
      count: goalCount,
      countLabel: `${remainingCount}`,
      hasContent: goalCount > 0,
      needsAttention: remainingCount > 0,
    }];
  }, [isDay, quickGoalFamilyIds.length, quickGoals.goalsForToday, selectedDay]);

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
      // Today is intentionally unmounted behind the full-screen camera. Make
      // every completed check-in/energy write durable before that boundary so
      // a camera cancellation (or memory-pressure route reload) cannot revive
      // an older empty day from native storage.
      void homeRepository.flush().then(() => {
        router.push({ pathname: '/moment-capture', params: { target: formingTarget, questId: questId ?? undefined } });
      });
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
  const [quickNoteInitialMode, setQuickNoteInitialMode] = useState<'text' | 'voice'>('text');
  const openQuickNoteOverlay = useCallback((input: 'text' | 'voice' = 'text') => {
    setQuickNoteInitialMode(input);
    navigateAfterTodayModalCloses(() => setQuickNoteOpen(true));
  }, [navigateAfterTodayModalCloses, setQuickNoteOpen]);

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
    deferRewardToCare: pendingCareIntent?.completionKey === 'reflection',
    startEggFeed,
  });
  const todayPhotoRollSuggestion = useMemo(() => {
    if (!formingDay || !photoPrompt) return null;
    return buildTodayPhotoRollSuggestion(formingDay, photoPrompt.photoCandidates);
  }, [formingDay, photoPrompt]);
  const semanticQuestPrompt = quickNoteOpen ? activeSemanticQuestPrompt() : null;
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
  const {
    celebrateDiscovery,
    markDiscoverySeen,
    discoveryProgress,
    discoveryBackfillCount,
    dismissDiscoveryBackfill,
  } = useDiscoveryRevealController(formingDay);
  const companionAchievements = useCompanionAchievements();

  const {
    handleAddFood,
    handleAddStudio,
    handlePickBigMoment,
    handleConfirmMood,
    handleSetSleep,
    handleConfirmSteps,
  } = useTodayMemoryWriters({
    formingTarget,
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
    handleQuickCategory,
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
    openQuickNote: openQuickNoteOverlay,
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
  const nurtureGrowth = useMemo(() => {
    if (!formingDay) return null;
    return todayGrowthSummary(
      formingDay,
      resolveHatchHour(loadOnboardingProfile()),
      growthNow,
      onTomorrowForming
        ? { incubationNotBefore: new Date(`${formingDay.isoDate}T00:00:00`) }
        : undefined,
    );
  }, [formingDay, growthNow, onTomorrowForming]);
  useEffect(() => {
    if (!nurtureGrowth) {
      incubationActivatedRef.current = null;
      return;
    }
    if (incubationActivatedRef.current === false && nurtureGrowth.isActivated) {
      setMicrocopy('Incubation started');
    }
    incubationActivatedRef.current = nurtureGrowth.isActivated;
  }, [nurtureGrowth, setMicrocopy]);
  const careContextualCategories = useMemo(() => {
    const result = new Set<TodayCareContextCategory>();
    const categoryMap: Partial<Record<(typeof categories)[number]['id'], TodayCareContextCategory>> = {
      photos: 'photo',
      places: 'place',
      journey: 'movement',
      food: 'food',
      studio: 'studio',
    };
    const memoryCategoryMap: Partial<Record<MemoryDomain, TodayCareContextCategory>> = {
      people: 'people',
      food: 'food',
      media: 'studio',
      movement: 'movement',
      place: 'place',
      work: 'work',
    };
    for (const category of categories) {
      const careCategory = categoryMap[category.id];
      if (careCategory && category.needsAttention) result.add(careCategory);
    }
    for (const memory of formingDay?.classifiedMemories ?? []) {
      const careCategory = memoryCategoryMap[memory.dominantDomain];
      if (careCategory) result.add(careCategory);
    }
    return [...result];
  }, [categories, formingDay?.classifiedMemories]);
  const nurtureCare = useMemo(() => {
    if (!formingDay) {
      return { active: [], completed: [] };
    }
    return rankTodayCareActions({
      day: formingDay,
      memoryQuests,
      reflectionAvailable: formingPrompts.some((prompt) =>
        ['gratitude', 'highlight', 'meaning', 'day_word', 'inner_weather'].includes(prompt.id)
      ),
      quickGoals: quickGoals.goalsForToday.map((item) => ({
        id: item.goal.id,
        title: item.goal.title,
        familyId: item.goal.familyId,
        completed: Boolean(item.completion),
      })),
      miniGameSuggestion: todayCareGame ? {
        companionName: todayCareGame.displayCompanionName,
        familyId: todayCareGame.familyId,
        questId: todayCareGame.questId,
        title: todayCareGame.title,
      } : null,
      photoRollSuggestion: todayPhotoRollSuggestion,
      contextualCategories: careContextualCategories,
      rotatingLimit: 3,
      now: new Date(),
    });
  }, [careContextualCategories, formingDay, formingPrompts, memoryQuests, quickGoals.goalsForToday, todayCareGame, todayPhotoRollSuggestion]);
  const selectedCareGoal = selectedCareGoalId
    ? quickGoals.goalsForToday.find((item) => item.goal.id === selectedCareGoalId) ?? null
    : null;
  const handleCareNotToday = useCallback((action: RankedTodayCareAction) => {
    const timestamp = new Date().toISOString();
    if (action.destination.kind === 'quick_goal') {
      quickGoals.skipGoal(action.destination.goalId);
    }
    updateCareAction({
      instanceId: action.instanceId,
      definitionId: action.id,
      sourceId: action.sourceId ?? null,
      status: 'not_today',
      deferredUntil: null,
      completedAt: null,
      dismissedAt: timestamp,
    }, formingTarget);
    if (pendingCareIntent?.instanceId === action.instanceId) clearCareIntent('not_today');
    setMicrocopy('Set aside for today');
  }, [clearCareIntent, formingTarget, pendingCareIntent, quickGoals, setMicrocopy, updateCareAction]);
  const handleCareStart = useCallback((action: RankedTodayCareAction, rewardFrom: Parameters<typeof startEggFeed>[0]) => {
    if (action.completionMode === 'artifact' || action.completionMode === 'external_activity') {
      startCareIntent(action, eggFeedRewardRequestKey);
      setNextEnergyCurrencySource(rewardFrom);
    }
    markCareDestinationOpen();
    switch (action.destination.kind) {
      case 'quick_goal':
        setSelectedCareGoalId(action.destination.goalId);
        return;
      case 'memory_quest':
        void handleQuest(action.destination.questType);
        return;
      case 'reflection': {
        const reflection = formingPrompts.find((prompt) =>
          ['gratitude', 'highlight', 'meaning', 'day_word', 'inner_weather'].includes(prompt.id)
        );
        if (reflection) openPromptSheet(reflection);
        else openManualJournal();
        return;
      }
      case 'quick_category':
        void handleQuickCategory(action.destination.category);
        return;
      case 'photo_roll': {
        if (!photoPrompt) {
          clearCareIntent('photo_prompt_unavailable');
          return;
        }
        const eligibleIds = new Set(action.destination.assetIds);
        const candidates = photoPrompt.photoCandidates.filter((candidate) => eligibleIds.has(candidate.assetId));
        if (!candidates.length) {
          clearCareIntent('photo_candidates_unavailable');
          return;
        }
        setTodayPhotoLibrarySheet({
          candidates,
          ...(action.destination.placeName ? { placeName: action.destination.placeName } : {}),
          ...(action.destination.placeAddress ? { placeAddress: action.destination.placeAddress } : {}),
          ...(action.destination.startedAt ? { startedAt: action.destination.startedAt } : {}),
          ...(action.destination.endedAt ? { endedAt: action.destination.endedAt } : {}),
        });
        return;
      }
      case 'mini_game':
        requestTodayCareGameRound(action);
        router.navigate('/games');
        return;
      case 'inline_mood':
      case 'inline_sleep':
        return;
    }
  }, [clearCareIntent, eggFeedRewardRequestKey, formingPrompts, handleQuest, handleQuickCategory, markCareDestinationOpen, openManualJournal, openPromptSheet, photoPrompt, router, setNextEnergyCurrencySource, startCareIntent]);
  const handleNurtureMood = useCallback((
    choiceId: Parameters<typeof handleConfirmMood>[0],
    label: string,
    from: Parameters<typeof startEggFeed>[0],
    imageSource: number,
    accent: string,
    currencyFrom: Parameters<typeof startEggFeed>[0],
  ) => {
    const action = nurtureCare.active.find((candidate) => candidate.id === 'mood');
    if (action) startCareIntent(action, eggFeedRewardRequestKey);
    handleConfirmMood(choiceId, label, from, imageSource, accent, currencyFrom);
  }, [eggFeedRewardRequestKey, handleConfirmMood, nurtureCare.active, startCareIntent]);
  const handleNurtureSleep = useCallback((
    quality: Parameters<typeof handleSetSleep>[0],
    label: string,
    from: Parameters<typeof startEggFeed>[0],
    imageSource: number,
    accent: string,
    currencyFrom: Parameters<typeof startEggFeed>[0],
  ) => {
    const action = nurtureCare.active.find((candidate) => candidate.id === 'sleep');
    if (action) startCareIntent(action, eggFeedRewardRequestKey);
    handleSetSleep(quality, label, from, imageSource, accent, currencyFrom);
  }, [eggFeedRewardRequestKey, handleSetSleep, nurtureCare.active, startCareIntent]);
  const handleNurtureAddJournal = useCallback(() => openManualJournal(), [openManualJournal]);
  const handleNurtureAddTextNote = useCallback(() => openQuickNoteOverlay('text'), [openQuickNoteOverlay]);
  const handleNurtureCompleteGoal = useCallback((goalId: string) => {
    const receipt = quickGoals.completeGoal(goalId);
    if (receipt.newlyCompleted) setMicrocopy('+8 Growth Energy');
    return receipt;
  }, [quickGoals, setMicrocopy]);
  const handleNurtureOpenGoal = useCallback((goalId: string, completeFromOrigin: () => void) => {
    selectedCareGoalCompletionRef.current = completeFromOrigin;
    setSelectedCareGoalId(goalId);
  }, []);

  useFocusEffect(useCallback(() => {
    const completion = consumeTodayCareGameRoundCompletion();
    if (!completion) return;
    if (!formingDay) return;
    if (!completion.action.instanceId.startsWith(`care:${formingDay.isoDate}:`)) return;
    const completedAt = new Date(completion.completedAt).toISOString();
    if (!pendingCareIntent) startCareIntent(completion.action, eggFeedRewardRequestKey);
    completeEnergyAction({
      growth: {
        actionId: completion.action.id,
        source: 'mini_game',
        sourceId: completion.attemptId,
      },
      careAction: {
        instanceId: completion.action.instanceId,
        definitionId: completion.action.id,
        sourceId: completion.attemptId,
        deferredUntil: null,
        completedAt,
        dismissedAt: null,
      },
    }, formingTarget);
    markCareDomainCommit();
    setMicrocopy(`+${completion.action.growthReward} Growth Energy`);
  }, [completeEnergyAction, eggFeedRewardRequestKey, formingDay, formingTarget, markCareDomainCommit, pendingCareIntent, setMicrocopy, startCareIntent]));

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
    explorationFramingOverride?: boolean,
  ) => {
    const active = mode === 'active';
    // The forming nurture experience renders its own centered egg above this
    // timeline scene and owns the payout destination. Sharing one ref across
    // that egg plus current/neighbor timeline eggs lets an off-screen page win
    // the ref race, sending Energy toward the left or right edge.
    const ownsEggRewardTarget = active
      && !isForming
      && timelineDay.id === selectedDayId;
    const pageUsesExplorationFraming =
      explorationFramingOverride
      ?? (active && explorationBackgroundActive);
    if (active && isHatching && hatchPresentation.dayId === timelineDay.id) {
      return (
        <TodayTileHatchReveal
          homeArchetypeId={homeArchetypeId}
          onAssetsReady={handleHatchSubjectReady}
          presentation={hatchPresentation}
        />
      );
    }
    const day = timelineDay.kind === 'day' ? timelineDay : tomorrowDay;
    if (day?.state === 'hatched' && day.creature) {
      const dayExplorationKey =
        todayKatchimeraExplorationBackgroundKeyForPresentation({
          creature: day.creature,
          environmentVisualKey: day.card?.scene?.environment?.visualKey,
        });
      const usesExplorationFraming =
        pageUsesExplorationFraming && dayExplorationKey != null;
      return (
        <CreatureHero
          artLod={active ? 'medium' : 'thumb'}
          compact
          creature={day.creature}
          environmentVisualKey={day.card?.scene?.environment?.visualKey}
          explorationStageTop={usesExplorationFraming
            ? resolvedHeroStageTop
            : undefined}
          hideCompactCard={!active}
          hideKingdomEnvironmentArt={usesExplorationFraming}
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
        explorationStageTop={pageUsesExplorationFraming
          ? resolvedHeroStageTop
          : undefined}
        feedbackKey={active ? eggFeedKey : 0}
        hideKingdomEnvironmentArt={pageUsesExplorationFraming}
        homeArchetypeId={homeArchetypeId}
        isReady={active && day?.state === 'ready_to_hatch'}
        onEggPress={active && day?.canAddMoments ? () => openManualJournal() : undefined}
        pinchStrength={active ? 1 : todayScene.homeEnvironment.motion.neighborPinchStrength}
        targetRef={ownsEggRewardTarget ? eggTargetRef : undefined}
      />
    );
  }, [
    eggFeedKey,
    eggTargetRef,
    explorationBackgroundActive,
    handleHatchSubjectReady,
    hatchPresentation,
    homeArchetypeId,
    isHatching,
    isForming,
    openManualJournal,
    resolvedHeroStageTop,
    selectedDayId,
    tomorrowDay,
  ]);

  const renderTimelineOverlay = useCallback((timelineDay: HomeTimelineDay, active: boolean) => {
    if (
      !active ||
      isHatching ||
      quickGoalsOpen ||
      timelineDay.kind !== 'day' ||
      !timelineDay.isToday ||
      timelineDay.state === 'hatched'
    ) {
      return null;
    }
    const countdown = <HatchCountdown isReady={timelineDay.state === 'ready_to_hatch'} />;
    return explorationBackgroundActive ? (
      <TodayKingdomEggAboveOverlay
        aboveEggClearance={52}
        explorationStageTop={resolvedHeroStageTop}
        homeArchetypeId={homeArchetypeId}>
        {countdown}
      </TodayKingdomEggAboveOverlay>
    ) : (
      <TodayKingdomEggOverlay homeArchetypeId={homeArchetypeId}>
        {countdown}
      </TodayKingdomEggOverlay>
    );
  }, [explorationBackgroundActive, homeArchetypeId, isHatching, quickGoalsOpen, resolvedHeroStageTop]);

  const {
    cameraProgress,
    goToAdjacentDay,
    navigateToDay,
    renderedIndices,
    swipeGesture,
  } = useTodayNavigationController({
    windowWidth,
    windowHeight,
    selectedDayId,
    timelineDays,
    isTodayHatched,
    isHatching,
    promptSheetOpen: promptSheetOpen || hatchCheckInOpen || quickGoalsOpen,
    comicOpen: Boolean(comicGen),
    deferCaptureRewardToCare: pendingCareIntent?.completionKey === 'photo',
    selectTimelineDay,
    startEggFeed,
  });
  const commitExplorationTransition = useCallback((direction: -1 | 1) => {
    const targetId = explorationTransitionTargetIdRef.current;
    if (targetId) {
      navigateToDay(targetId);
      return;
    }
    goToAdjacentDay(direction);
  }, [goToAdjacentDay, navigateToDay]);
  // A discovery reveal waits until nothing else is mid-flow: no sheet, prompt,
  // follow-up, recording, or hatch on screen. It then celebrates the
  // highest-rarity pending unlock first (same order as the World page).
  const flowBusy =
    !screenFocused ||
    isHatching ||
    quickGoalsOpen ||
    quickGoalSheetMode !== null ||
    quickGoalJournal !== null ||
    selectedCareGoalId !== null ||
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
    todayPhotoLibrarySheet !== null ||
    clarificationMemory !== null ||
    !!comicGen ||
    voiceNote.phase !== 'idle';
  useLayoutEffect(() => {
    if (!pendingCareIntent) return;
    if (deferredJournalCareCompletionRef.current === pendingCareIntent.instanceId) return;
    const completedPhotoAssetId = pendingCareIntent.destination.kind === 'photo_roll'
      && formingDay
      ? pendingCareIntent.destination.assetIds.find((assetId) =>
          formingDay.heroPhoto?.assetId === assetId || formingDay.usedPhotoAssetIds?.includes(assetId)
        ) ?? null
      : null;
    const completed = Boolean(completedPhotoAssetId)
      || nurtureCare.completed.some((action) => action.instanceId === pendingCareIntent.instanceId);
    if (!completed) return;
    if (completedPhotoAssetId) {
      const completedAt = new Date().toISOString();
      completeEnergyAction({
        growth: {
          actionId: pendingCareIntent.id,
          source: pendingCareIntent.growthSource,
          sourceId: completedPhotoAssetId,
          amount: pendingCareIntent.growthReward,
        },
        careAction: {
          instanceId: pendingCareIntent.instanceId,
          definitionId: pendingCareIntent.id,
          sourceId: completedPhotoAssetId,
          deferredUntil: null,
          completedAt,
          dismissedAt: null,
        },
      }, formingTarget);
    }
    markCareDomainCommit();
    queueCareCompletion(
      pendingCareIntent,
      careRewardAlreadyAnimated(eggFeedRewardRequestKey),
    );
  }, [careRewardAlreadyAnimated, completeEnergyAction, eggFeedRewardRequestKey, formingDay, formingTarget, markCareDomainCommit, nurtureCare.completed, pendingCareIntent, queueCareCompletion]);
  useEffect(() => {
    if (!pendingCareIntent) {
      return;
    }
    if (flowBusy) {
      noteCareFlowBusy(true);
      return;
    }
    if (!careFlowWasBusyRef.current) return;
    const timer = setTimeout(() => {
      const completed = nurtureCare.completed.some((action) => action.instanceId === pendingCareIntent.instanceId);
      if (!completed) clearCareIntent('flow_closed_without_completion');
      careFlowWasBusyRef.current = false;
    }, 240);
    return () => clearTimeout(timer);
  }, [careFlowWasBusyRef, clearCareIntent, flowBusy, noteCareFlowBusy, nurtureCare.completed, pendingCareIntent]);
  const explorationMotion = useTodayExplorationBackgroundMotion({
    activeKey: selectedDayId,
    canSwipeNext: explorationTransitionPages.next != null,
    canSwipePrevious: explorationTransitionPages.previous != null,
    enabled: explorationBackgroundActive && !flowBusy,
    onQuickSwipe: commitExplorationTransition,
    onTransitionStart: beginExplorationTransition,
    pageTransitionEnabled: true,
  });
  const resetExplorationAfterCommit = explorationMotion.resetAfterCommit;
  useEffect(() => {
    if (!explorationTransitionSnapshot) return;
    const sourceId = explorationTransitionSnapshot.source.timelineDay.id;
    const targetId = explorationTransitionSnapshot.target.timelineDay.id;
    if (selectedDayId === sourceId) return;
    if (selectedDayId !== targetId) {
      resetExplorationAfterCommit();
      explorationTransitionTargetIdRef.current = null;
      setExplorationTransitionSnapshot(null);
      return;
    }

    // Keep the captured target centered while the live selected-day tree is
    // rebased behind it, then let that identical live target take over.
    resetExplorationAfterCommit();
    let handoffFrame: number | null = null;
    const rebaseFrame = requestAnimationFrame(() => {
      handoffFrame = requestAnimationFrame(() => {
        explorationTransitionTargetIdRef.current = null;
        setExplorationTransitionSnapshot((current) => (
          current?.target.timelineDay.id === targetId ? null : current
        ));
      });
    });
    return () => {
      cancelAnimationFrame(rebaseFrame);
      if (handoffFrame != null) cancelAnimationFrame(handoffFrame);
    };
  }, [
    explorationTransitionSnapshot,
    resetExplorationAfterCommit,
    selectedDayId,
  ]);
  const { environmentGesture, environmentMotion } = useTodayEnvironmentMotion({
    enabled: !flowBusy,
    hoverEnabled: !explorationPresentationActive,
    maxPinchScale: explorationPresentationActive
      ? todayScene.homeEnvironment.motion.explorationMaxPinchScale
      : todayScene.homeEnvironment.motion.maxPinchScale,
    pinchSoftLimitRange: explorationPresentationActive
      ? todayScene.homeEnvironment.motion.explorationPinchSoftLimitRange
      : 0,
  });
  const pageGesture = explorationPresentationActive
    ? Gesture.Simultaneous(explorationMotion.gesture, environmentGesture)
    : Gesture.Simultaneous(swipeGesture, environmentGesture);
  const handleHeroStageLayout = useCallback((event: LayoutChangeEvent) => {
    const nextTop = event.nativeEvent.layout.y;
    setHeroStageTop((current) => (
      current == null || Math.abs(current - nextTop) > 0.5 ? nextTop : current
    ));
  }, []);
  useEffect(() => {
    goalsFocusProgress.value = reduceMotion
      ? quickGoalsOpen ? 1 : 0
      : withTiming(quickGoalsOpen ? 1 : 0, {
          duration: 280,
          easing: Easing.out(Easing.cubic),
        });
  }, [goalsFocusProgress, quickGoalsOpen, reduceMotion]);
  useEffect(() => {
    if (!quickGoalsOpen) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (quickGoalSheetMode) {
        setQuickGoalSheetMode(null);
      } else {
        setQuickGoalsOpen(false);
      }
      return true;
    });
    return () => subscription.remove();
  }, [quickGoalSheetMode, quickGoalsOpen]);
  const goalsLift = companionDestinationStageLift(windowHeight);
  const goalsSceneLiftStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -goalsLift * goalsFocusProgress.value }],
  }));
  const goalsChromeStyle = useAnimatedStyle(() => ({
    opacity: 1 - goalsFocusProgress.value,
  }));
  const goalsListTop = Math.max(
    insets.top + 248,
    Math.min(390, windowHeight * (windowHeight < 735 ? 0.4 : 0.43)),
  );
  return (
    <TodayEnvironmentMotionProvider motion={environmentMotion}>
    <GestureDetector gesture={pageGesture}>
    <View style={styles.screen}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, goalsSceneLiftStyle]}>
      {isHatching ? (
        <TodayHatchEnvironmentCrossfade
          imageSize={Math.max(windowHeight, windowWidth)}
          onDestinationReady={handleHatchEnvironmentReady}
          presentation={hatchPresentation}
        />
      ) : explorationPresentationActive ? (
        <View
          pointerEvents="none"
          style={styles.explorationBackgroundPlane}>
          <TodayEnvironmentViewportMotionLayer
            focusY={resolvedHeroStageTop + explorationSubjectFrame.centerY}
            viewportHeight={windowHeight}>
          {displayedExplorationPrevious ? (
            <TodayExplorationPageLayer
              baseOffsetX={-windowWidth}
              holdCentered={
                explorationTargetCommitted
                && explorationTransitionSnapshot?.direction === -1
              }
              pageDirection={-1}
              key={`exploration-background-${displayedExplorationPrevious.timelineDay.id}`}
              transitionDirection={explorationMotion.transitionDirection}
              transitionProgress={explorationMotion.transitionProgress}
              transitionRole="incoming"
              translateX={explorationMotion.translateX}>
              {displayedExplorationPrevious.backgroundKey ? (
                <TodayExplorationBackground
                  backgroundKey={displayedExplorationPrevious.backgroundKey}
                  imageSize={explorationMotion.imageSize}
                  verticalOffset={HOME_SCENE_Y_OFFSET}
                />
              ) : displayedExplorationPrevious.fallbackBackground ? (
                <TodaySceneBackdrop
                  background={displayedExplorationPrevious.fallbackBackground}
                  scene={null}
                />
              ) : null}
            </TodayExplorationPageLayer>
          ) : null}
          {displayedExplorationCurrent ? (
            <TodayExplorationPageLayer
              key={`exploration-background-${displayedExplorationCurrent.timelineDay.id}`}
              transitionProgress={explorationMotion.transitionProgress}
              transitionRole="current"
              translateX={explorationMotion.translateX}>
              {displayedExplorationCurrent.backgroundKey ? (
                <TodayExplorationBackground
                  backgroundKey={displayedExplorationCurrent.backgroundKey}
                  imageSize={explorationMotion.imageSize}
                  verticalOffset={HOME_SCENE_Y_OFFSET}
                />
              ) : displayedExplorationCurrent.fallbackBackground ? (
                <TodaySceneBackdrop
                  background={displayedExplorationCurrent.fallbackBackground}
                  scene={null}
                />
              ) : null}
            </TodayExplorationPageLayer>
          ) : null}
          {displayedExplorationNext ? (
            <TodayExplorationPageLayer
              baseOffsetX={windowWidth}
              holdCentered={
                explorationTargetCommitted
                && explorationTransitionSnapshot?.direction === 1
              }
              pageDirection={1}
              key={`exploration-background-${displayedExplorationNext.timelineDay.id}`}
              transitionDirection={explorationMotion.transitionDirection}
              transitionProgress={explorationMotion.transitionProgress}
              transitionRole="incoming"
              translateX={explorationMotion.translateX}>
              {displayedExplorationNext.backgroundKey ? (
                <TodayExplorationBackground
                  backgroundKey={displayedExplorationNext.backgroundKey}
                  imageSize={explorationMotion.imageSize}
                  verticalOffset={HOME_SCENE_Y_OFFSET}
                />
              ) : displayedExplorationNext.fallbackBackground ? (
                <TodaySceneBackdrop
                  background={displayedExplorationNext.fallbackBackground}
                  scene={null}
                />
              ) : null}
            </TodayExplorationPageLayer>
          ) : null}
          </TodayEnvironmentViewportMotionLayer>
        </View>
      ) : (
        <TodaySceneBackdrop
          background={dayBackground}
          scene={null}
        />
      )}
      </Animated.View>
      {/* Today is a FIXED composition — no page scrolling; everything anchors.
          (Readers/sheets keep their own scrolling.) The ScrollView shell stays
          for layout parity but is locked. */}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
        contentInsetAdjustmentBehavior="never"
        style={styles.contentPlane}
        scrollEnabled={false}
        bounces={false}
        showsVerticalScrollIndicator={false}>
        <Animated.View
          entering={presenceEnter(20)}
          pointerEvents={quickGoalsOpen ? 'none' : 'auto'}
          style={[styles.timelineLayer, goalsChromeStyle]}>
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
          onLayout={handleHeroStageLayout}
          style={[styles.heroStage, goalsSceneLiftStyle]}>
          {explorationPresentationActive && selectedDay ? (
            <>
              {displayedExplorationPrevious ? (
                <TodayExplorationSceneLayer
                  baseOffsetX={-windowWidth}
                  holdCentered={
                    explorationTargetCommitted
                    && explorationTransitionSnapshot?.direction === -1
                  }
                  pageDirection={-1}
                  key={`exploration-subject-${displayedExplorationPrevious.timelineDay.id}`}
                  transitionDirection={explorationMotion.transitionDirection}
                  transitionProgress={explorationMotion.transitionProgress}
                  transitionRole="incoming"
                  translateX={explorationMotion.translateX}>
                  {renderTimelineHero(
                    displayedExplorationPrevious.timelineDay,
                    'active',
                    displayedExplorationPrevious.backgroundKey != null,
                  )}
                </TodayExplorationSceneLayer>
              ) : null}
              <TodayExplorationSceneLayer
                hidden={explorationTargetCommitted}
                interactive={explorationTransitionSnapshot == null}
                key={`exploration-subject-${displayedExplorationCurrent?.timelineDay.id ?? selectedDay.id}`}
                transitionProgress={explorationMotion.transitionProgress}
                transitionRole="current"
                translateX={explorationMotion.translateX}>
                {renderTimelineHero(
                  displayedExplorationCurrent?.timelineDay ?? selectedDay,
                  'active',
                  displayedExplorationCurrent?.backgroundKey != null,
                )}
                {renderTimelineOverlay(selectedDay, true)}
                {voiceNote.phase !== 'idle' && !quickNoteOpen ? (
                  <TodayKingdomEggAboveOverlay
                    explorationStageTop={resolvedHeroStageTop}
                    homeArchetypeId={homeArchetypeId}>
                    <InlineVoiceNote
                      elapsed={voiceNote.elapsed}
                      phase={voiceNote.phase}
                    />
                  </TodayKingdomEggAboveOverlay>
                ) : null}
                {!hasActivePrompt && !quickGoalsOpen ? (
                  <TodayCategoryRing
                    categories={goalRingItems}
                    onPress={() => setQuickGoalsOpen(true)}
                    anchorHeight={TODAY_KINGDOM_STAGE_HEIGHT}
                    centerOffsetY={
                      explorationSubjectFrame.centerY
                        - TODAY_KINGDOM_STAGE_HEIGHT / 2
                    }
                    singleItemLeftOfAnchorWidth={explorationSubjectFrame.width}
                  />
                ) : null}
              </TodayExplorationSceneLayer>
              {displayedExplorationNext ? (
                <TodayExplorationSceneLayer
                  baseOffsetX={windowWidth}
                  holdCentered={
                    explorationTargetCommitted
                    && explorationTransitionSnapshot?.direction === 1
                  }
                  pageDirection={1}
                  key={`exploration-subject-${displayedExplorationNext.timelineDay.id}`}
                  transitionDirection={explorationMotion.transitionDirection}
                  transitionProgress={explorationMotion.transitionProgress}
                  transitionRole="incoming"
                  translateX={explorationMotion.translateX}>
                  {renderTimelineHero(
                    displayedExplorationNext.timelineDay,
                    'active',
                    displayedExplorationNext.backgroundKey != null,
                  )}
                </TodayExplorationSceneLayer>
              ) : null}
            </>
          ) : (
            <>
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
              {voiceNote.phase !== 'idle' && !quickNoteOpen ? (
                <TodayKingdomEggAboveOverlay homeArchetypeId={homeArchetypeId}>
                  <InlineVoiceNote
                    elapsed={voiceNote.elapsed}
                    phase={voiceNote.phase}
                  />
                </TodayKingdomEggAboveOverlay>
              ) : null}
              {/* The same category ring circles the hatched creature when
                  revisiting a day, anchored to the shared art stage. */}
              {(isForming || isHatched) && !isHatching && !hasActivePrompt && !quickGoalsOpen ? (
                <TodayCategoryRing
                  categories={goalRingItems}
                  onPress={() => setQuickGoalsOpen(true)}
                  anchorHeight={TODAY_KINGDOM_STAGE_HEIGHT}
                  centerOffsetY={24}
                />
              ) : null}
            </>
          )}
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

      {isForming && formingDay && nurtureGrowth && !isHatching ? (
        <TodayEnergyProfiler>
          <TodayNurtureExperience
          actionTransitionActive={
            energyLoopStatus === 'rewarding'
          }
          actions={nurtureCare.active}
          bottomInset={insets.bottom}
          completionEvent={queuedCareCompletion?.action.category === 'check_in' ? queuedCareCompletion : flowBusy ? null : queuedCareCompletion}
          day={formingDay}
          eggTargetRef={eggTargetRef}
          feedbackKey={eggFeedKey}
          growth={nurtureGrowth}
          homeArchetypeId={homeArchetypeId}
          onAddJournal={handleNurtureAddJournal}
          onAddTextNote={handleNurtureAddTextNote}
          onAddPhoto={openMomentCapture}
          onCareNotToday={handleCareNotToday}
          onCareStart={handleCareStart}
          onCompleteQuickGoal={handleNurtureCompleteGoal}
          onCompletionAnimationEnd={finishCareCompletion}
          onOpenQuickGoal={handleNurtureOpenGoal}
          onChooseMood={handleNurtureMood}
          onChooseSleep={handleNurtureSleep}
          onReveal={handleRevealPress}
          onRewardFlight={handleCareRewardFlight}
          onSelectDay={navigateToDay}
          careSwipeExternalGesture={explorationMotion.gesture}
          sceneTranslateX={explorationMotion.translateX}
          timelineDays={timelineDays}
          topInset={insets.top}
          />
        </TodayEnergyProfiler>
      ) : null}

      {/* Bottom dock — the +/camera/mic row (or hatch CTA) with the category/
          stats panel beneath, PINNED above the tab bar (absolute, not flow) so
          content above can never push it around. Hidden while a prompt has the
          page collapsed and during the hatch reveal. The panel also shows on
          the TOMORROW view once today has hatched (viewedDay resolves it);
          before the hatch, tomorrow stays a locked egg with no panel. */}
      {!isFormingToday && !isHatching && !quickGoalsOpen && !hasActivePrompt ? (
        <Pressable
          accessibilityLabel={`Discoveries. ${discoveryProgress.unlocked} of ${discoveryProgress.total} found`}
          accessibilityRole="button"
          onPress={() => router.push('/discoveries')}
          style={({ pressed }) => [styles.discoveriesShortcut, { top: insets.top + 70 }, pressed && styles.discoveriesShortcutPressed]}>
          <IconSymbol color="#FFF3D0" name="star.fill" size={15} />
          <ThemedText style={styles.discoveriesShortcutLabel} lightColor="#FFF3D0" darkColor="#FFF3D0">
            {discoveryProgress.unlocked}/{discoveryProgress.total}
          </ThemedText>
        </Pressable>
      ) : null}
      {quickGoalsOpen && selectedDay?.kind === 'day' && selectedDay.isToday ? (
        <TodayGoalsExperience
          actions={{
            onCompleteGoal: quickGoals.completeGoal,
            onUndoGoal: quickGoals.undoGoal,
            onSnoozeGoal: quickGoals.snoozeGoal,
            onSkipGoal: quickGoals.skipGoal,
          }}
          dayId={selectedDay.isoDate}
          familyIds={quickGoalFamilyIds}
          headerTop={insets.top + 10}
          listTop={goalsListTop}
          onAdd={() => setQuickGoalSheetMode('add')}
          onBack={() => setQuickGoalsOpen(false)}
          onManage={() => setQuickGoalSheetMode('manage')}
          onRemember={(completion, goal) => {
            setQuickGoalsOpen(false);
            setQuickGoalJournal({ completion, goal });
          }}
          state={quickGoals.state}
        />
      ) : null}
      {!isForming && (!isHatching || hatchShowsResident) && !hasActivePrompt && !quickGoalsOpen ? (
        <TodayBottomDock
          canHatch={isDay ? selectedDay.canHatch : false}
          isForming={isForming}
          isHatched={Boolean(isHatched)}
          viewedDay={viewedDay}
          showHatchedActionDock={SHOW_HATCHED_ACTION_DOCK && Boolean(isDay && selectedDay.isToday)}
          showHatchedReflectionCard={SHOW_HATCHED_REFLECTION_CARD}
          showCompanionInvitation={Boolean(isDay && selectedDay.isToday && selectedHatchedCompanionId)}
          companionName={isHatched ? selectedDay.creature?.name : undefined}
          onOpenCompanion={selectedHatchedCompanionId ? () => {
            router.push({
              pathname: '/katchimera/[creatureId]',
              params: { creatureId: selectedHatchedCompanionId },
            });
          } : undefined}
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

      <EggFeedOverlay
        feed={eggFeed}
        onArrive={handleEggFeedArrive}
        onEnergyTokenArrive={handleEnergyArrival}
      />

      {/* Cinematic egg and Katchimera scenes bypass TodayHexNeighborhood, whose
          foreground slot normally owns rain, snow, motes, petals, and other
          authored atmosphere. Restore that plane across the full viewport,
          above the page composition while remaining touch-through. */}
      {explorationPresentationActive ? (
        <ResolvedAtmosphereLayer
          plane="foreground"
          settings={dayAtmosphereSettings}
          style={styles.explorationAtmosphere}
          target="today"
        />
      ) : null}

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
        <QuickNoteComposer
          initialMode={quickNoteInitialMode}
          onClose={() => setQuickNoteOpen(false)}
          onCancel={() => {
            cancelSemanticNoteQuestCapture();
            setQuickNoteOpen(false);
          }}
          onSubmit={handleQuickNoteSubmit}
          onVoiceStart={voiceNote.start}
          onVoiceStop={() => {
            void voiceNote.stop();
          }}
          voiceElapsed={voiceNote.elapsed}
          voicePhase={voiceNote.phase}
          contextTitle={semanticQuestPrompt?.title}
          contextBody={semanticQuestPrompt?.request}
        />
      ) : null}

      {promptSheetOpen ? (
        <MomentPromptSheet
          prompts={popupPrompts.filter((prompt) => prompt.id === 'meaningful_photo')}
          initialPrompt={initialPrompt}
          suggestions={suggestedPromptActions}
          quickCategories={QUICK_PROMPT_CATEGORIES}
          onQuickCategory={handleQuickCategory}
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
      {todayPhotoLibrarySheet ? (
        <TodayPhotoLibrarySheet
          content={todayPhotoLibrarySheet}
          onClose={() => setTodayPhotoLibrarySheet(null)}
          onSelect={(photo, from) => {
            setTodayPhotoLibrarySheet(null);
            handleSelectHeroPhoto(photo, from);
          }}
        />
      ) : null}
      {manualJournalOpen ? (
        <ManualJournalSheet
          allowRemoteIntelligence={cloudIntelligenceEnabled}
          dayLocationPoints={formingDay?.locations}
          initialFlowId={manualJournalInitialFlowId}
          initialChoiceId={manualJournalInitialChoiceId}
          initialContext={manualJournalInitialContextId}
          hapticOnSave={!pendingCareIntent}
          onClose={closeManualJournal}
          onSave={(submission) => {
            const completingCareAction = pendingCareIntent
              && journalFlowCompletesTodayCareAction(submission.flowId, pendingCareIntent.completionKey)
              ? pendingCareIntent
              : null;
            const deferRewardToCareRow = completingCareAction != null;
            if (completingCareAction) {
              queueCareCompletionAfterJournalDismiss(completingCareAction);
            }
            addManualJournalEntry(submission, formingTarget);
            closeManualJournal();
            const hasPhotoText = submission.sourceType === 'photo'
              && Boolean(submission.note?.trim() || Object.values(submission.fields).some((value) => Array.isArray(value) ? value.length > 0 : Boolean(value)));
            const energyAmount = submission.sourceType === 'photo'
              ? hasPhotoText ? 25 : TODAY_GROWTH_REWARDS.photo
              : submission.linkedNote?.kind === 'voice'
                ? TODAY_GROWTH_REWARDS.voice_note
                : TODAY_GROWTH_REWARDS.journal;
            if (!deferRewardToCareRow) {
              startEggFeed({ h: 54, w: 54, x: windowWidth / 2 - 27, y: windowHeight - 190 }, {
                energyAmount,
                energyOnly: true,
                imageSource: GROWTH_ENERGY_ART,
                tint: Lantern.ember300,
              }, () => {});
            }
            setMicrocopy('Added to today');
          }}
        />
      ) : null}
      {quickGoalSheetMode && selectedDay?.kind === 'day' && selectedDay.isToday ? (
        <QuickGoalsSheet
          actions={{
            onAddTemplate: quickGoals.addTemplate,
            onAddCustom: quickGoals.addCustom,
            onEditGoal: quickGoals.editGoal,
            onCompleteGoal: quickGoals.completeGoal,
            onUndoGoal: quickGoals.undoGoal,
            onSnoozeGoal: quickGoals.snoozeGoal,
            onSkipGoal: quickGoals.skipGoal,
          }}
          dayId={selectedDay.isoDate}
          familyIds={quickGoalFamilyIds}
          initialMode={quickGoalSheetMode}
          onClose={() => setQuickGoalSheetMode(null)}
          onRemember={(completion, goal) => {
            setQuickGoalSheetMode(null);
            setQuickGoalsOpen(false);
            setQuickGoalJournal({ completion, goal });
          }}
          state={quickGoals.state}
        />
      ) : null}
      {selectedCareGoal ? (
        <QuickGoalActionModal
          item={selectedCareGoal}
          onComplete={() => quickGoals.completeGoal(selectedCareGoal.goal.id)}
          onCompleteFromOrigin={() => {
            const completeFromOrigin = selectedCareGoalCompletionRef.current;
            selectedCareGoalCompletionRef.current = null;
            requestAnimationFrame(() => completeFromOrigin?.());
          }}
          onDismiss={() => {
            selectedCareGoalCompletionRef.current = null;
            setSelectedCareGoalId(null);
          }}
          onRemember={() => {
            const completion = quickGoals.state.completions.find((candidate) =>
              candidate.goalId === selectedCareGoal.goal.id
              && candidate.dayId === (selectedDay?.kind === 'day' ? selectedDay.isoDate : '')
            ) ?? selectedCareGoal.completion;
            setSelectedCareGoalId(null);
            if (completion) setQuickGoalJournal({ completion, goal: selectedCareGoal.goal });
          }}
          onSkip={() => quickGoals.skipGoal(selectedCareGoal.goal.id)}
          onSnooze={() => quickGoals.snoozeGoal(selectedCareGoal.goal.id)}
          onUndo={() => quickGoals.undoGoal(selectedCareGoal.goal.id)}
        />
      ) : null}
      {quickGoalJournal ? (
        <ManualJournalSheet
          allowRemoteIntelligence={cloudIntelligenceEnabled}
          dayLocationPoints={formingDay?.locations}
          initialNote={`I completed: ${quickGoalJournal.goal.title}`}
          initialNoteExpanded
          initialSpecific={quickGoalJournal.goal.title}
          journalSource={{
            kind: 'text_note',
            sourceId: quickGoalJournal.completion.id,
            origin: {
              kind: 'quick_goal_completion',
              creatureId: companionIdForFamily(quickGoalJournal.goal.familyId),
              familyId: quickGoalJournal.goal.familyId,
              goalId: quickGoalJournal.goal.id,
              completionId: quickGoalJournal.completion.id,
              goalTitle: quickGoalJournal.goal.title,
            },
          }}
          onClose={() => setQuickGoalJournal(null)}
          onSave={(submission) => {
            addManualJournalEntry(submission, 'today');
            quickGoals.markJournaled(quickGoalJournal.completion.id);
            setQuickGoalJournal(null);
            pulseEgg();
            setMicrocopy('Remembered in today');
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
          onClose={() => {
            cancelSemanticNoteQuestCapture();
            clearPendingJournalNote();
          }}
          onSave={async (submission) => {
            addManualJournalEntry(submission, formingTarget);
            const result = await completeSemanticNoteQuestCapture({
              sourceId: pendingJournalNote.captureId,
              sourceType: pendingJournalNote.kind === 'voice' ? 'voice_note' : 'text_note',
              text: pendingJournalNote.text,
              target: formingTarget,
            });
            clearPendingJournalNote();
            pulseEgg();
            if (result.handled) {
              refreshState();
              setMicrocopy(result.message ?? 'Added to today');
            } else {
              setMicrocopy('Added to today');
            }
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
        memoryQuests={memoryQuests}
        recentAvgSteps={recentAvgSteps}
        observations={observations}
        travelMemory={travelMemory}
        cloudIntelligenceEnabled={cloudIntelligenceEnabled}
        setCloudIntelligenceEnabled={setCloudIntelligenceEnabled}
        onOpenIntelligenceLab={() => router.push('/intelligence-lab')}
        setObservatoryOpen={setObservatoryOpen}
        onCapturePhoto={openMomentCapture}
        onCaptureNote={openQuickNoteOverlay}
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
        setMicrocopy={setMicrocopy}
        setDayName={setDayName}
      />
      <MicrocopyToast message={microcopy} />

      {celebrateDiscovery && !flowBusy ? (
        <DiscoveryReveal discovery={celebrateDiscovery} onDismiss={() => markDiscoverySeen(celebrateDiscovery.id)} />
      ) : null}
      {screenFocused && !celebrateDiscovery && companionAchievements.pending.length > 0 && !flowBusy ? (
        <CompanionAchievementCelebration
          achievements={companionAchievements.pending}
          onAchievementSeen={(id) => companionAchievements.markSeen([id])}
        />
      ) : null}
      {!celebrateDiscovery && companionAchievements.pending.length === 0 && !flowBusy && (companionAchievements.backfillCount > 0 || discoveryBackfillCount > 0) ? (
        <ProgressBackfillNotice
          achievementCount={companionAchievements.backfillCount}
          discoveryCount={discoveryBackfillCount}
          onDismiss={() => {
            companionAchievements.dismissBackfill();
            dismissDiscoveryBackfill();
          }}
        />
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
  inactiveScreen: { backgroundColor: '#11131B', flex: 1 },
  screen: {
    backgroundColor: Lantern.ink950,
    flex: 1,
  },
  explorationBackgroundPlane: {
    ...StyleSheet.absoluteFillObject,
    isolation: 'isolate',
    overflow: 'hidden',
    zIndex: 0,
  },
  contentPlane: {
    position: 'relative',
    zIndex: 10,
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
  explorationAtmosphere: {
    zIndex: 55,
  },
  heroStage: {
    alignItems: 'center',
    height: TODAY_KINGDOM_STAGE_HEIGHT,
    isolation: 'isolate',
    justifyContent: 'center',
    marginTop: 26 + HOME_SCENE_Y_OFFSET,
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
  discoveriesShortcut: {
    alignItems: 'center',
    backgroundColor: 'rgba(31,28,23,0.78)',
    borderColor: 'rgba(255,226,145,0.24)',
    borderRadius: 14,
    borderWidth: 1,
    boxShadow: '0 5px 14px rgba(22,16,10,0.22)',
    flexDirection: 'row',
    gap: 6,
    minHeight: 38,
    paddingHorizontal: 10,
    position: 'absolute',
    right: 14,
    zIndex: 54,
  },
  discoveriesShortcutPressed: { opacity: 0.84, transform: [{ scale: 0.98 }] },
  discoveriesShortcutLabel: { fontSize: 10.5, fontWeight: '900', fontVariant: ['tabular-nums'] },
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
