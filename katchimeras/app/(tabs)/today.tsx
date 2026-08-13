import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { TodayTopHud } from '@/components/katchadeck/home/today-top-hud';
import {
  TodayKingdomEggAboveOverlay,
  TodayKingdomEggHero,
  TodayKingdomEggOverlay,
} from '@/components/katchadeck/home/today-kingdom-egg-hero';
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
import { WispDiscoveryReveal } from '@/components/katchadeck/wisps/wisp-discovery-reveal';
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
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { hasQuickGoalTemplates } from '@/constants/companion-quick-goals';
import { AppFontFamilies, KatchaDeckUI, Lantern } from '@/constants/theme';
import { GAME_CURRENCY_ART } from '@/constants/game-currency-art';
import { dayPromptRegistry } from '@/constants/day-prompts';
import { HOME_SCENE_Y_OFFSET } from '@/constants/home-loop-layout';
import { MERGE_CHARACTER_NAMES } from '@/constants/merge-world-catalog';
import type { MergeCharacterId } from '@/types/merge-world';
import todayScene from '@/data/today-scene.json';
import { useHomeScreenState } from '@/hooks/use-home-screen-state';
import { homeRepository } from '@/storage/repositories/home-repository';
import { useAllDays } from '@/hooks/use-all-days';
import { useCompanionQuickGoals } from '@/hooks/use-companion-quick-goals';
import { useDevAllKatchimerasAvailable } from '@/hooks/use-dev-all-katchimeras-available';
import { useBackfillStatus } from '@/utils/backfill-status';
import { DiscoveryReveal } from '@/components/katchadeck/world/discovery-reveal';
import { CompanionAchievementCelebration } from '@/components/katchadeck/world/companion-achievement-celebration';
import { DayCapturedCelebration } from '@/components/katchadeck/streak/day-captured-celebration';
import { StreakRepairSheet } from '@/components/katchadeck/streak/streak-repair-sheet';
import { StreakMilestoneCelebration } from '@/components/katchadeck/streak/streak-milestone-celebration';
import { ProgressBackfillNotice } from '@/components/katchadeck/world/progress-backfill-notice';
import { useEggFeedController } from '@/features/today/use-egg-feed-controller';
import { usePromptSheetController } from '@/features/today/use-prompt-sheet-controller';
import { useMicrocopy } from '@/features/today/use-microcopy';
import { useTodaySheetController } from '@/features/today/use-today-sheet-controller';
import { useTodayActionRouter } from '@/features/today/use-today-action-router';
import { useObservatoryController } from '@/features/today/use-observatory-controller';
import { useDiscoveryRevealController } from '@/features/today/use-discovery-reveal-controller';
import { useCompanionAchievements } from '@/hooks/use-companion-achievements';
import { useStreak } from '@/hooks/use-streak';
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
import { useAppActivity } from '@/features/performance/app-activity';
import { beginFtueAction, commitFtueAction, updateFtueRun, useFtueRun } from '@/features/onboarding/ftue-runtime';
import { FTUE_MOSSPROUT_CREATURE } from '@/features/onboarding/mossprout-ftue-creature';
import { mossproutFtueStep } from '@/features/onboarding/mossprout-ftue-script';
import type { FtueActionDefinition, FtueChoiceOption } from '@/features/onboarding/ftue-types';
import { useWisps } from '@/features/wisps/wisp-provider';
import { resolveHomeLoopPresentation } from '@/features/today/home-loop-presentation';
import { acquireLifecycleResource, scheduleForegroundLifecycleAudit } from '@/utils/lifecycle-performance';
import { QuickNoteComposer } from '@/components/katchadeck/home/quick-note-composer';
import { MemoryClarificationSheet } from '@/components/katchadeck/world/memory-clarification-sheet';
import type { ClassifiedMemory, DayInputTarget, HomeDayRecord, HomeTimelineDay, MemoryDomain } from '@/types/home';
import type { KatchimeraFamilyId } from '@/types/katchimera';
import { consumeQuestActionIntent } from '@/utils/quest-action-signal';
import { consumeCompanionNavigationIntent } from '@/utils/companion-navigation-intent';
import { planContextualPrompts } from '@/utils/intelligence/prompt-planner';
import { noteRoutesForSignals, noteSuggestedSpecific } from '@/utils/journal-input-adapters';
import { journalNoteRouteNeedsConfirmation } from '@/utils/journal-routing';
import { runAfterNativeModalDismiss } from '@/utils/native-modal-navigation';
import { trackStreakEvent } from '@/utils/streak-sync';
import { defaultStreakCaptureTarget } from '@/utils/streak-engine';
import { hatchCheckInEligibility } from '@/utils/hatch-check-in';
import { loadWorldIdentity } from '@/utils/world-identity';
import {
  todayExplorationCreatureStageFrame,
  todayExplorationEggStageFrame,
  TODAY_EXPLORATION_HERO_STAGE_TOP_AFTER_SAFE_AREA,
  TODAY_KINGDOM_STAGE_HEIGHT,
} from '@/utils/today-kingdom-hero-layout';
import { atmosphereSettingsForPlan, resolveDayAtmosphere } from '@/utils/day-atmosphere';
import { todayHatchOwnsSurface, todayHatchRunsInPlace, todayHatchShowsDashboard, todayHatchShowsResident, todayHatchShowsWorldShift } from '@/utils/today-hatch-presentation';
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
import { buildAboutTodayPrompt } from '@/utils/day-prompt-engine';
import { buildTodayPhotoRollSuggestion } from '@/utils/today-photo-roll-suggestion';
import { loadOnboardingProfile } from '@/utils/onboarding-state';
import { resolveHatchHour } from '@/game/days/lifecycle';
import type { CompanionQuickGoal, CompanionQuickGoalCompletion } from '@/utils/companion-quick-goals';
import type { GameHubItem } from '@/utils/game-hub';
import type { CompanionJournalHandoff } from '@/utils/companion-journal-handoff';
import {
  cancelCompanionJournalHandoff,
  completeCompanionJournalHandoff,
  loadCompanionJournalHandoff,
  loadPendingCompanionJournalHandoff,
} from '@/utils/companion-journal-handoff';
import { journalIdempotencyKey, journalRecordId } from '@/utils/journal-domain';
import { mergeJournalRewardPreview, type MergeJournalRewardPreview } from '@/utils/merge-world/economy-policy';
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
  backgroundKey: TodayExplorationBackgroundKey;
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
  useEffect(() => {
    if (!screenFocused) return;
    scheduleForegroundLifecycleAudit('today');
    return acquireLifecycleResource('today_scene', 'today-home-screen');
  }, [screenFocused]);
  if (!screenFocused) return <View style={styles.inactiveScreen} />;
  return <HomeScreen />;
}

function HomeScreen() {
  const router = useRouter();
  const ftueRun = useFtueRun();
  const ftueStep = ftueRun?.status === 'active' ? mossproutFtueStep(ftueRun.stepId) : null;
  const ftueTodayStep = ftueStep?.surface === 'today' ? ftueStep : null;
  const ftueOpeningFocus = Boolean(ftueRun?.status === 'active' && ftueRun.stepId.startsWith('egg.'));
  const discoveryHatchActive = Boolean(ftueRun?.status === 'active' && (ftueRun.stepId.startsWith('egg.') || ftueRun.stepId === 'hatch.reveal'));
  const { memoryDayId, memoryRecordId, memorySourceKind, onboardingCapture } = useLocalSearchParams<{
    memoryDayId?: string;
    memoryRecordId?: string;
    memorySourceKind?: string;
    onboardingCapture?: string;
  }>();
  const { beginCriticalInteraction, criticalInteractionActive } = useAppActivity();
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
  const streak = useStreak();
  const pendingStreakMilestone = streak.snapshot.pendingMilestones.length > 0
    ? [...streak.snapshot.pendingMilestones].sort((left, right) => right.days - left.days)[0]
    : null;
  const [homeArchetypeId, setHomeArchetypeId] = useState(() => loadWorldIdentity().selectedHomeArchetypeId);
  const [heroStageTop, setHeroStageTop] = useState<number | null>(null);
  const [manualJournalOpen, setManualJournalOpen] = useState(false);
  const [ftueActionBusy, setFtueActionBusy] = useState(false);
  const [onboardingEnergyReady, setOnboardingEnergyReady] = useState<number | null>(null);
  const openedOnboardingCaptureRef = useRef(false);
  useEffect(() => {
    setFtueActionBusy(false);
  }, [ftueRun?.runId, ftueRun?.stepId]);
  const [quickGoalsOpen, setQuickGoalsOpen] = useState(false);
  const [quickGoalSheetMode, setQuickGoalSheetMode] = useState<'add' | 'manage' | null>(null);
  const [selectedCareGoalId, setSelectedCareGoalId] = useState<string | null>(null);
  const selectedCareGoalCompletionRef = useRef<(() => void) | null>(null);
  const [todayPhotoLibrarySheet, setTodayPhotoLibrarySheet] = useState<TodayPhotoLibrarySheetContent | null>(null);
  const incubationActivatedRef = useRef<boolean | null>(null);
  const acceleratedHatchReadyRef = useRef(false);
  const {
    clearIntent: clearCareIntent,
    completionEvent: queuedCareCompletion,
    finishCompletion: finishCareCompletion,
    finishRewardOnly: finishCareRewardOnly,
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
  const energyLoopBusy = energyLoopStatus !== 'idle';
  useEffect(() => {
    if (!energyLoopBusy) return;
    return beginCriticalInteraction();
  }, [beginCriticalInteraction, energyLoopBusy]);
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
  const [manualJournalTarget, setManualJournalTarget] = useState<DayInputTarget | null>(null);
  const [companionJournalHandoff, setCompanionJournalHandoff] = useState<CompanionJournalHandoff | null>(null);
  const [feastleJournalReward, setFeastleJournalReward] = useState<(CompanionJournalHandoff & { mergeReward: MergeJournalRewardPreview }) | null>(null);
  const handledCompanionJournalHandoffIdRef = useRef<string | null>(null);
  const handledMergeMemoryIdRef = useRef<string | null>(null);
  const deferredJournalCareCompletionRef = useRef<string | null>(null);
  const deferredJournalCareTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openManualJournal = useCallback((flowId?: string, categoryId?: string, contextId?: string | null, target?: DayInputTarget) => {
    const captureTarget = defaultStreakCaptureTarget(new Date(), streak.snapshot.recentDays.at(-2)?.state);
    setManualJournalInitialFlowId(flowId ?? null);
    setManualJournalInitialChoiceId(categoryId ?? null);
    setManualJournalInitialContextId(contextId ?? null);
    setManualJournalTarget(target ?? (captureTarget === 'yesterday' ? 'yesterday' : null));
    setManualJournalOpen(true);
  }, [streak.snapshot.recentDays]);
  const closeManualJournal = useCallback(() => {
    setManualJournalOpen(false);
    setManualJournalInitialFlowId(null);
    setManualJournalInitialChoiceId(null);
    setManualJournalInitialContextId(null);
    setManualJournalTarget(null);
  }, []);
  useEffect(() => {
    if (onboardingCapture !== '1' || ftueRun?.stepId !== 'energy.capture' || openedOnboardingCaptureRef.current) return;
    openedOnboardingCaptureRef.current = true;
  }, [ftueRun?.stepId, onboardingCapture]);
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
    completeInlineEnergyAction,
    updateCareAction,
  } = useHomeScreenState({
    pauseInteractiveServices: criticalInteractionActive,
  });
  const {
    isHatching,
    presentation: hatchPresentation,
    handleHatchEnvironmentReady,
    handleHatchSubjectError,
    handleHatchSubjectReady,
    handleReveal,
    handleDiscoveryReveal,
    restoreDiscoveryReveal,
  } = useTodayHatchRevealController({
    selectedDay,
    triggerHatchIfReady,
    acceleratedReadyRef: acceleratedHatchReadyRef,
    allowDailyHatch: !discoveryHatchActive,
    onDiscoveryAnimationComplete: () => {
      commitFtueAction({ actionId: 'egg.hatch', evidenceRef: 'discovery-hatch:mossprout' });
    },
  });
  const dailyHatchActive = todayHatchOwnsSurface(hatchPresentation);
  const discoveryHatchInPlace = todayHatchRunsInPlace(hatchPresentation);
  const { days: allDays } = useAllDays();
  const legacyDiscoveryPersonalLine = useMemo(() => {
    const today = allDays.find((day) => day.isToday);
    const activity = today?.promptAnswers.find((answer) => answer.kind === 'activity' && !answer.dismissed)?.labels[0];
    const mood = today?.promptAnswers.find((answer) => answer.kind === 'feeling' && !answer.dismissed)?.labels[0];
    if (activity === 'Outdoors') return 'You were outside today? I think we’re going to get along.';
    if (activity === 'Family') return 'You spent time with your people today? I like that.';
    if (activity === 'Friends') return 'Friends were part of today? That sounds like a day worth keeping.';
    if (activity === 'Resting') return 'A quieter day can still grow something. We can start small.';
    if (activity === 'Work') return 'You had work on your mind today. Let’s make a small place to breathe.';
    if (mood === 'Drained' || mood === 'Low') return 'Sounds like today took something out of you. We can start small.';
    return mood ? `You felt ${mood.toLowerCase()} today. Thank you for letting me know.` : 'I felt those little pieces of your day reach me.';
  }, [allDays]);
  const { equippedWispId: activeWispId, syncFromDays: syncWispsFromDays, pendingDiscoveryId, dismissDiscovery } = useWisps();
  useEffect(() => { syncWispsFromDays(allDays); }, [allDays, syncWispsFromDays]);
  const isDay = selectedDay?.kind === 'day';
  useEffect(() => {
    if (ftueRun?.stepId !== 'hatch.reveal' || hatchPresentation.phase !== 'idle') return;
    restoreDiscoveryReveal(FTUE_MOSSPROUT_CREATURE);
  }, [ftueRun?.stepId, hatchPresentation.phase, restoreDiscoveryReveal]);
  const talkToMossprout = useCallback(() => {
    commitFtueAction({ actionId: 'hatch.talk_to_mossprout' });
    router.push({
      pathname: '/katchimera/[creatureId]',
      params: { creatureId: 'companion:mossprout', ftue: '1' },
    });
  }, [router]);
  const companionResumeStartedRef = useRef(false);
  useEffect(() => {
    if (ftueRun?.stepId !== 'companion.first_meeting') {
      companionResumeStartedRef.current = false;
      return;
    }
    if (!screenFocused || companionResumeStartedRef.current) return;
    companionResumeStartedRef.current = true;
    router.push({
      pathname: '/katchimera/[creatureId]',
      params: { creatureId: 'companion:mossprout', ftue: '1' },
    });
  }, [ftueRun?.stepId, router, screenFocused]);
  const returnToMossprout = useCallback(() => {
    setOnboardingEnergyReady(null);
    commitFtueAction({ actionId: 'energy.return' });
    router.push({ pathname: '/(tabs)/games', params: { familyId: 'mossprout' } });
  }, [router]);
  const homeLoopPresentation = useMemo(() => resolveHomeLoopPresentation({
    activeDayPrompt,
    availableDayPrompts,
    hatchOwnership: dailyHatchActive ? 'daily_surface' : discoveryHatchInPlace ? 'discovery_in_place' : 'none',
    isTodayHatched,
    selectedDay,
    tomorrowActivePrompt,
    tomorrowAvailablePrompts,
    tomorrowDay,
  }), [
    activeDayPrompt,
    availableDayPrompts,
    dailyHatchActive,
    discoveryHatchInPlace,
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
  const journalMergeReward = useMemo(() => {
    if (!formingDay || manualJournalTarget === 'yesterday') return null;
    const rewardDays = [...allDays.filter((day) => day.id !== formingDay.id), formingDay];
    return mergeJournalRewardPreview(rewardDays, {
      companion: companionJournalHandoff != null,
      targetDayId: formingDay.isoDate,
    });
  }, [allDays, companionJournalHandoff, formingDay, manualJournalTarget]);
  const journalMergeRewardNotice = useMemo(() => {
    if (!journalMergeReward || !formingDay) return undefined;
    const eggLabel = formingTarget === 'tomorrow' ? 'Tomorrow’s Egg' : 'Today’s Egg';
    if (journalMergeReward.totalEnergy <= 0) return {
      detail: `${eggLabel} has already granted its journal${companionJournalHandoff ? ' and companion' : ''} Energy for this date. Your entry still adds Growth.`,
      status: 'collected' as const,
      title: 'Journal Energy already collected',
    };
    const rewards = [
      journalMergeReward.dailyJournalEnergy > 0 ? `Journal +${journalMergeReward.dailyJournalEnergy}` : null,
      journalMergeReward.companionEnergy > 0 ? `Companion bonus +${journalMergeReward.companionEnergy}` : null,
    ].filter(Boolean).join(' · ');
    const collected = journalMergeReward.dailyJournalEnergy === 0
      ? ' Daily journal Energy was already collected; this is the companion bonus.'
      : journalMergeReward.companionEnergy === 0 && companionJournalHandoff
        ? ' The companion bonus was already collected.'
        : '';
    return {
      detail: `${rewards} Merge Energy when this entry is saved.${collected}`,
      status: 'available' as const,
      title: `Earn +${journalMergeReward.totalEnergy} Merge Energy`,
    };
  }, [companionJournalHandoff, formingDay, formingTarget, journalMergeReward]);
  useEffect(() => {
    if (ftueRun?.stepId === 'energy.awarded') setOnboardingEnergyReady(ftueRun.awardedMergeEnergy ?? 10);
  }, [ftueRun?.awardedMergeEnergy, ftueRun?.stepId]);
  useEffect(() => {
    if (ftueRun?.stepId !== 'energy.capture' || !formingDay) return;
    const pending = ftueRun.receipts.find((receipt) => receipt.stepId === 'energy.capture' && receipt.status === 'pending');
    if (!pending) return;
    if (pending.actionId !== 'energy.photo') return;
    const sources = new Set(['photo']);
    const evidence = [...(formingDay.growth?.events ?? [])]
      .reverse()
      .find((event) => sources.has(event.source) && event.awardedAt >= pending.startedAt);
    if (!evidence) return;
    const amount = ftueRun.awardedMergeEnergy ?? (pending.actionId === 'energy.photo' ? 20 : 10);
    commitFtueAction({ actionId: pending.actionId, evidenceRef: evidence.sourceId });
    setOnboardingEnergyReady(amount);
  }, [formingDay, ftueRun]);
  const formingPrompts = homeLoopPresentation.forming?.prompts ?? availableDayPrompts;
  const formingActivePrompt = homeLoopPresentation.forming?.activePrompt ?? null;
  // Signature mini-games are archived behind Merge World. Historical active
  // actions remain completable, but Today no longer creates new mini-game
  // recommendations in the primary care rotation.
  const todayCareGame = useMemo<GameHubItem | null>(() => null, []);
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
    energyHudPulseNonce,
    energyHudTargetRef,
    eggTargetRef,
    heroStageRef,
    startEggFeed,
    handleEggFeedArrive,
    handleEnergyTokenArrive,
    handleMergeEnergyTokenArrive,
    pulseEgg,
    setNextEnergyCurrencySource,
  } = useEggFeedController();
  const deferredCareMergeEnergyRef = useRef(0);
  useEffect(() => {
    if (!pendingCareIntent) setNextEnergyCurrencySource(null);
  }, [pendingCareIntent, setNextEnergyCurrencySource]);
  const handleCareRewardFlight = useCallback((
    from: Parameters<typeof startEggFeed>[0],
    action: RankedTodayCareAction,
    onArrive: () => void,
  ) => {
    markCareRewardLaunch();
    const mergeEnergyAmount = deferredCareMergeEnergyRef.current;
    deferredCareMergeEnergyRef.current = 0;
    startEggFeed(from, {
      currencyFrom: from,
      energyAmount: action.growthReward,
      energyOnly: true,
      imageSource: GAME_CURRENCY_ART.energy,
      mergeEnergyAmount,
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
    if (discoveryHatchActive) {
      if (ftueRun?.stepId === 'egg.ready') {
        beginFtueAction('egg.hatch');
        handleDiscoveryReveal(FTUE_MOSSPROUT_CREATURE);
      }
      // Discovery onboarding owns Hatch completely. Earlier Egg steps must
      // never fall through to the normal daily hatch and select another pet.
      return;
    }
    if (
      selectedDay?.kind !== 'day'
      || (!selectedDay.canHatch && !acceleratedHatchReadyRef.current)
    ) return;
    const reason = discoveryHatchActive ? null : hatchCheckInEligibility(selectedDay);
    if (reason) {
      if (!selectedDay.hatchCheckIn) startHatchCheckIn(selectedDay.id, reason);
      setHatchCheckInOpen(true);
      return;
    }
    void handleReveal();
  }, [discoveryHatchActive, ftueRun?.stepId, handleDiscoveryReveal, handleReveal, selectedDay, startHatchCheckIn]);

  useEffect(() => {
    if (!hatchAfterCheckIn || selectedDay?.kind !== 'day') return;
    if (discoveryHatchActive) {
      setHatchAfterCheckIn(false);
      return;
    }
    const status = selectedDay.hatchCheckIn?.status;
    if (!status || status === 'in_progress') return;
    setHatchAfterCheckIn(false);
    void handleReveal();
  }, [discoveryHatchActive, handleReveal, hatchAfterCheckIn, selectedDay]);

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
  const explorationBackgroundKey: TodayExplorationBackgroundKey = isForming
    ? 'home'
    : selectedKatchimeraExplorationKey ?? 'home';
  const explorationBackgroundActive = !dailyHatchActive || todayHatchShowsWorldShift(hatchPresentation);
  // The compact HUD provides the first layout estimate; onLayout replaces it
  // with the measured stage y.
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
  // Contextual photo suggestions still populate the legacy prompt model, but
  // the nurture experience does not auto-mount that strip. Only a prompt that
  // is actually presented may disable gestures or defer completion animation.
  // Treating the hidden forming prompt as visible is what locked the page as
  // soon as the background Photo Library scan finished after Mood + Sleep.
  const hasVisibleLegacyPrompt = !isForming && Boolean(formingActivePrompt);

  // The day the page is LOOKING AT — the forming day while it forms, or a
  // hatched day being revisited. Sheets/readers bind to this; write handlers
  // only exist while it's forming.
  const viewedDay: HomeDayRecord | null = isDay ? selectedDay : onTomorrowForming ? (tomorrowDay ?? null) : null;
  const viewedIsForming = isForming;
  const hatchShowsResident = todayHatchShowsResident(hatchPresentation.phase);
  const hatchShowsDashboard = todayHatchShowsDashboard(hatchPresentation);
  const atmosphereDay = isHatching && !hatchShowsResident
    ? hatchPresentation.daySnapshot
    : viewedDay;
  const dayAtmosphere = useMemo(() => resolveDayAtmosphere(atmosphereDay), [atmosphereDay]);
  const dayAtmosphereSettings = useMemo(
    () => atmosphereSettingsForPlan(dayAtmosphere),
    [dayAtmosphere],
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
      let backgroundKey: TodayExplorationBackgroundKey = 'home';
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
          }) ?? 'home';
      }

      return {
        backgroundKey,
        timelineDay: target,
      };
    };

    return {
      next: pageAt(1),
      previous: pageAt(-1),
    };
  }, [
    isTodayHatched,
    selectedDayId,
    timelineDays,
    tomorrowDay,
  ]);
  const currentExplorationPage = useMemo<TodayExplorationPageDescriptor | null>(
    () => selectedDay
      ? {
          backgroundKey: explorationBackgroundKey,
          timelineDay: selectedDay,
        }
      : null,
    [
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
    : null;
  const displayedExplorationNext = explorationTransitionSnapshot
    ? explorationTransitionSnapshot.direction === 1
      ? explorationTransitionSnapshot.target
      : null
    : null;
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

  useEffect(() => {
    if (!memoryDayId || !memoryRecordId || handledMergeMemoryIdRef.current === memoryRecordId) return;
    const target = timelineDays.find((day) => day.kind === 'day' && day.isoDate === memoryDayId);
    if (target && selectedDayId !== target.id) {
      selectTimelineDay(target.id);
      return;
    }
    if (selectedDay?.kind !== 'day' || selectedDay.isoDate !== memoryDayId) return;
    handledMergeMemoryIdRef.current = memoryRecordId;
    setMemoryVaultTab(memorySourceKind === 'photo' ? 'photos' : memorySourceKind === 'voice_note' ? 'voice' : 'notes');
    setMemoryVaultOpen(true);
  }, [memoryDayId, memoryRecordId, memorySourceKind, selectTimelineDay, selectedDay, selectedDayId, setMemoryVaultOpen, setMemoryVaultTab, timelineDays]);

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
    deferRewardToCare: pendingCareIntent?.completionKey === 'reflection'
      || pendingCareIntent?.completionKey.startsWith('reflection:') === true,
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
    const natural = todayGrowthSummary(
      formingDay,
      resolveHatchHour(loadOnboardingProfile()),
      growthNow,
      onTomorrowForming
        ? { incubationNotBefore: new Date(`${formingDay.isoDate}T00:00:00`) }
        : undefined,
    );
    if (discoveryHatchActive && formingTarget === 'today' && natural.qualifyingActionCount >= 3) {
      return { ...natural, effectiveHatchAt: growthNow, isReady: true, progress: 100 as const };
    }
    return natural;
  }, [discoveryHatchActive, formingDay, formingTarget, growthNow, onTomorrowForming]);
  useEffect(() => {
    setGrowthNow(new Date());
  }, [formingDay]);
  acceleratedHatchReadyRef.current = Boolean(isFormingToday && nurtureGrowth?.isReady);
  useEffect(() => {
    if (!nurtureGrowth?.isActivated || nurtureGrowth.isReady || !isFormingToday) return;
    const remainingMs = nurtureGrowth.effectiveHatchAt.getTime() - Date.now();
    const timer = setTimeout(() => {
      setGrowthNow(new Date());
      refreshState(true);
    }, Math.max(0, remainingMs) + 40);
    return () => clearTimeout(timer);
  }, [isFormingToday, nurtureGrowth, refreshState]);
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
  const onboardingMoodAnswered = Boolean(formingDay?.promptAnswers.some((answer) => answer.kind === 'feeling' && !answer.dismissed));
  const ftueMoodCareAction = useMemo(() => {
    const mood = [...nurtureCare.active, ...nurtureCare.completed].find((action) => action.id === 'mood');
    return mood ?? null;
  }, [nurtureCare.active, nurtureCare.completed]);
  const onboardingActivityAnswered = Boolean(formingDay?.promptAnswers.some((answer) => answer.kind === 'activity' && !answer.dismissed));
  const onboardingActivityAnswer = formingDay?.promptAnswers.find((answer) => answer.kind === 'activity' && !answer.dismissed) ?? null;
  const onboardingActivityAction = useMemo<RankedTodayCareAction | null>(() => formingDay ? ({
    id: 'onboarding:activity',
    instanceId: `${formingDay.isoDate}:onboarding:activity`,
    title: 'What was part of today?',
    description: 'Work, family, friends, outside, resting — choose what fits.',
    icon: 'leaf.fill',
    artKey: 'reflection',
    category: 'memory',
    completionKey: 'reflection:activity',
    completionMode: 'artifact',
    destination: { kind: 'reflection', promptId: 'activity' },
    growthSource: 'reflection',
    growthReward: TODAY_GROWTH_REWARDS.reflection,
    priority: 100,
    eligibleTimeOfDay: ['morning', 'midday', 'afternoon', 'evening'],
    journalFocused: true,
    canReplaceSkipped: false,
    aiGenerated: false,
    source: 'system',
    completed: onboardingActivityAnswered,
    completedAt: onboardingActivityAnswer?.createdAt ?? null,
  }) : null, [formingDay, onboardingActivityAnswer?.createdAt, onboardingActivityAnswered]);
  const ftuePanelCareAction = ftueMoodCareAction ?? onboardingActivityAction;
  const nurtureCompletedActions = useMemo(() => (
    discoveryHatchActive && onboardingActivityAction?.completed
      ? [...nurtureCare.completed, onboardingActivityAction]
      : nurtureCare.completed
  ), [discoveryHatchActive, nurtureCare.completed, onboardingActivityAction]);
  const presentedNurtureActions = useMemo(() => {
    if (ftueRun?.status === 'active') return [];
    if (!discoveryHatchActive || !formingDay) return nurtureCare.active;
    if (!onboardingMoodAnswered) {
      const mood = nurtureCare.active.find((action) => action.id === 'mood');
      return mood ? [{ ...mood, title: 'How are you feeling?', description: 'Choose one answer. The Egg is listening.' }] : [];
    }
    if (!onboardingActivityAnswered) {
      return onboardingActivityAction ? [onboardingActivityAction] : [];
    }
    return [];
  }, [discoveryHatchActive, formingDay, ftueRun?.status, nurtureCare.active, onboardingActivityAction, onboardingActivityAnswered, onboardingMoodAnswered]);
  const legacyOnboardingGuide = useMemo(() => {
    if (!discoveryHatchActive) return null;
    if (!onboardingMoodAnswered) return {
      eyebrow: 'A tiny spark',
      title: 'Something is waiting.',
      body: 'Share one piece of today.',
    };
    if (!onboardingActivityAnswered) return {
      eyebrow: 'It felt that',
      title: 'The Egg is stirring.',
      body: 'Give it one more piece.',
    };
    return {
      eyebrow: 'A new beginning',
      title: "It's ready to meet you.",
      body: 'Your day woke the Egg.',
    };
  }, [discoveryHatchActive, onboardingActivityAnswered, onboardingMoodAnswered]);
  void legacyOnboardingGuide;
  void legacyDiscoveryPersonalLine;
  const onboardingGuide = ftueTodayStep?.guide ?? null;
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
        const reflection = action.destination.promptId
          ? buildAboutTodayPrompt(action.destination.promptId)
            ?? (action.id === 'onboarding:activity'
              ? { ...dayPromptRegistry.activity, title: 'What has been part of your day?', photoCandidates: [] }
              : null)
          : formingPrompts.find((prompt) =>
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
  const handleFtueChoice = useCallback((
    action: FtueActionDefinition,
    option: FtueChoiceOption,
    from: Parameters<typeof startEggFeed>[0],
  ) => {
    if (ftueActionBusy || !action.promptKind || !action.growthSource) return;
    const receipt = beginFtueAction(action.id);
    if (!receipt || receipt.status !== 'pending') return;
    setFtueActionBusy(true);
    const reward = action.growthReward ?? TODAY_GROWTH_REWARDS.reflection;
    const sourceId = option.private ? receipt.clientEventId : option.domainChoiceId ?? option.id;
    startEggFeed(from, {
      currencyFrom: from,
      energyAmount: reward,
      energyOnly: true,
      imageSource: GAME_CURRENCY_ART.energy,
      label: option.private ? 'Kept private' : option.label,
      tint: option.private ? Lantern.dusk700 : Lantern.ember300,
    }, () => {
      try {
        const completedAt = new Date().toISOString();
        completeInlineEnergyAction({
          artifact: option.private
            ? { kind: 'private' }
            : { kind: 'prompt', promptKind: action.promptKind!, choiceId: option.domainChoiceId ?? option.id },
          completion: {
            growth: { actionId: action.id, amount: reward, source: action.growthSource!, sourceId },
            careAction: {
              instanceId: `${formingDay?.isoDate ?? 'today'}:${action.id}`,
              definitionId: action.id,
              sourceId,
              deferredUntil: null,
              completedAt,
              dismissedAt: null,
            },
          },
        }, formingTarget);
        commitFtueAction({
          actionId: action.id,
          optionId: option.id,
          optionLabel: option.label,
          private: option.private,
          evidenceRef: sourceId,
        });
        setMicrocopy(option.private ? 'The Egg felt the moment, without saving an answer.' : `${option.label} reached the Egg`);
      } catch (error) {
        console.error('[ftue] Could not commit scripted Egg answer', error);
      } finally {
        setFtueActionBusy(false);
      }
    });
  }, [completeInlineEnergyAction, formingDay?.isoDate, formingTarget, ftueActionBusy, setMicrocopy, startEggFeed]);

  const handleFtueAction = useCallback((action: FtueActionDefinition) => {
    if (ftueActionBusy) return;
    if (action.handlerId === 'discovery_hatch') {
      handleRevealPress();
      return;
    }
    if (!action.handlerId.startsWith('journal_')) return;
    const receipt = beginFtueAction(action.id);
    if (!receipt || receipt.status !== 'pending') return;
    updateFtueRun({ awardedMergeEnergy: action.handlerId === 'journal_photo' ? 20 : journalMergeReward?.totalEnergy ?? 10 });
    if (action.handlerId === 'journal_photo') openMomentCapture();
    else if (action.handlerId === 'journal_people') openManualJournal(undefined, 'people', null, 'today');
    else if (action.handlerId === 'journal_place') openManualJournal(undefined, 'place', null, 'today');
    else openManualJournal(undefined, undefined, null, 'today');
  }, [ftueActionBusy, handleRevealPress, journalMergeReward?.totalEnergy, openManualJournal, openMomentCapture]);

  const handleNurtureMood = useCallback((
    choiceId: Parameters<typeof handleConfirmMood>[0],
    label: string,
    from: Parameters<typeof startEggFeed>[0],
    imageSource: number,
    accent: string,
    currencyFrom: Parameters<typeof startEggFeed>[0],
  ) => {
    const action = nurtureCare.active.find((candidate) => candidate.id === 'mood');
    if (!action) {
      handleConfirmMood(choiceId, label, from, imageSource, accent, currencyFrom);
      return;
    }
    startCareIntent(action, eggFeedRewardRequestKey);
    startEggFeed(from, {
      currencyFrom,
      energyAmount: action.growthReward,
      framelessImage: true,
      imageSource,
      label,
      tint: accent,
    }, () => {
      const completedAt = new Date().toISOString();
      completeInlineEnergyAction({
        artifact: { kind: 'mood', choiceId },
        completion: {
          growth: {
            actionId: action.id,
            amount: action.growthReward,
            source: action.growthSource,
            sourceId: choiceId,
          },
          careAction: {
            instanceId: action.instanceId,
            definitionId: action.id,
            sourceId: choiceId,
            deferredUntil: null,
            completedAt,
            dismissedAt: null,
          },
        },
      }, formingTarget);
      setMicrocopy(`Mood noted: ${label}`);
    });
  }, [completeInlineEnergyAction, eggFeedRewardRequestKey, formingTarget, handleConfirmMood, nurtureCare.active, setMicrocopy, startCareIntent, startEggFeed]);
  const handleNurtureSleep = useCallback((
    quality: Parameters<typeof handleSetSleep>[0],
    label: string,
    from: Parameters<typeof startEggFeed>[0],
    imageSource: number,
    accent: string,
    currencyFrom: Parameters<typeof startEggFeed>[0],
  ) => {
    const action = nurtureCare.active.find((candidate) => candidate.id === 'sleep');
    if (!action) {
      handleSetSleep(quality, label, from, imageSource, accent, currencyFrom);
      return;
    }
    startCareIntent(action, eggFeedRewardRequestKey);
    startEggFeed(from, {
      currencyFrom,
      energyAmount: action.growthReward,
      framelessImage: true,
      imageSource,
      label,
      tint: accent,
    }, () => {
      const completedAt = new Date().toISOString();
      completeInlineEnergyAction({
        artifact: { kind: 'sleep', sleep: { quality, source: 'manual' } },
        completion: {
          growth: {
            actionId: action.id,
            amount: action.growthReward,
            source: action.growthSource,
            sourceId: quality,
          },
          careAction: {
            instanceId: action.instanceId,
            definitionId: action.id,
            sourceId: quality,
            deferredUntil: null,
            completedAt,
            dismissedAt: null,
          },
        },
      }, formingTarget);
      setMicrocopy('Your morning, remembered');
    });
  }, [completeInlineEnergyAction, eggFeedRewardRequestKey, formingTarget, handleSetSleep, nurtureCare.active, setMicrocopy, startCareIntent, startEggFeed]);
  const handleNurtureAddJournal = useCallback(() => openManualJournal(), [openManualJournal]);
  const handleNurtureAddTextNote = useCallback(() => openQuickNoteOverlay('text'), [openQuickNoteOverlay]);
  const handleNurtureCompleteGoal = useCallback((goalId: string) => {
    const receipt = quickGoals.completeGoal(goalId);
    if (receipt.newlyCompleted) setMicrocopy('+8 Growth Energy');
    finishCareRewardOnly();
    return receipt;
  }, [finishCareRewardOnly, quickGoals, setMicrocopy]);
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
      const journalHandoff = companionIntent?.kind === 'journal_handoff'
        ? loadCompanionJournalHandoff(companionIntent.handoffId)
        : !companionIntent ? loadPendingCompanionJournalHandoff() : null;
      if (journalHandoff?.status === 'pending') {
        // useFocusEffect may re-subscribe while the screen remains focused when
        // one of its dependencies changes. Loading persisted JSON returns a new
        // object each time, so setting the same handoff again would otherwise
        // create a render -> focus effect -> setState loop.
        if (handledCompanionJournalHandoffIdRef.current !== journalHandoff.id) {
          handledCompanionJournalHandoffIdRef.current = journalHandoff.id;
          setCompanionJournalHandoff(journalHandoff);
        }
        const todayTimelineId = timelineDays.find((day) => day.kind === 'day' && day.isToday)?.id;
        const targetTimelineId = journalHandoff.target === 'tomorrow' ? 'tomorrow' : todayTimelineId;
        if (targetTimelineId && selectedDayId !== targetTimelineId) selectTimelineDay(targetTimelineId);
        return;
      }
      if (!companionIntent) return;
      if (companionIntent.kind === 'journal_flow') openManualJournal(companionIntent.flowId);
      else if (companionIntent.kind === 'quick_goals') setQuickGoalsOpen(true);
      else if (companionIntent.kind === 'memory_vault') {
        setMemoryVaultTab(companionIntent.tab);
        setMemoryVaultOpen(true);
      } else if (companionIntent.kind === 'places') setPlacesVaultOpen(true);
      else if (companionIntent.kind === 'movement') setJourneySheetOpen(true);
      else if (companionIntent.kind === 'rest') setSleepSheetOpen(true);
    }, [handleQuestActionIntent, openManualJournal, selectTimelineDay, selectedDayId, setJourneySheetOpen, setMemoryVaultOpen, setMemoryVaultTab, setPlacesVaultOpen, setSleepSheetOpen, timelineDays])
  );

  useEffect(() => {
    if (!companionJournalHandoff || companionJournalHandoff.status !== 'pending' || manualJournalOpen) return;
    const selectedTarget = companionJournalHandoff.target === 'tomorrow'
      ? selectedDay?.kind === 'tomorrow'
      : selectedDay?.kind === 'day' && selectedDay.isToday;
    if (!selectedTarget) return;
    openManualJournal(companionJournalHandoff.flowId, undefined, null, companionJournalHandoff.target);
  }, [companionJournalHandoff, manualJournalOpen, openManualJournal, selectedDay]);

  const renderTimelineHero = useCallback((
    timelineDay: HomeTimelineDay,
    mode: 'active' | 'neighbor',
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
      const usesExplorationFraming = pageUsesExplorationFraming;
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
        companionWispId={active && !isHatching ? activeWispId : null}
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
    activeWispId,
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
    goToAdjacentDay,
    navigateToDay,
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
    hasVisibleLegacyPrompt ||
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
    feastleJournalReward !== null ||
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
      || nurtureCompletedActions.some((action) => action.instanceId === pendingCareIntent.instanceId);
    if (!completed) return;
    const completedOnboardingActivity = pendingCareIntent.id === 'onboarding:activity'
      ? onboardingActivityAnswer
      : null;
    if (completedPhotoAssetId || completedOnboardingActivity) {
      const completedAt = new Date().toISOString();
      const sourceId = completedPhotoAssetId ?? completedOnboardingActivity?.choiceIds[0] ?? 'activity';
      completeEnergyAction({
        growth: {
          actionId: pendingCareIntent.id,
          source: pendingCareIntent.growthSource,
          sourceId,
          amount: pendingCareIntent.growthReward,
        },
        careAction: {
          instanceId: pendingCareIntent.instanceId,
          definitionId: pendingCareIntent.id,
          sourceId,
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
  }, [careRewardAlreadyAnimated, completeEnergyAction, eggFeedRewardRequestKey, formingDay, formingTarget, markCareDomainCommit, nurtureCompletedActions, onboardingActivityAnswer, pendingCareIntent, queueCareCompletion]);
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
      const completed = nurtureCompletedActions.some((action) => action.instanceId === pendingCareIntent.instanceId);
      if (!completed) clearCareIntent('flow_closed_without_completion');
      careFlowWasBusyRef.current = false;
    }, 240);
    return () => clearTimeout(timer);
  }, [careFlowWasBusyRef, clearCareIntent, flowBusy, noteCareFlowBusy, nurtureCompletedActions, pendingCareIntent]);
  const explorationMotion = useTodayExplorationBackgroundMotion({
    activeKey: selectedDayId,
    canSwipeNext: explorationTransitionPages.next != null,
    canSwipePrevious: explorationTransitionPages.previous != null,
    enabled: explorationBackgroundActive && !flowBusy,
    frozen: discoveryHatchInPlace,
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
    frozen: discoveryHatchInPlace,
    hoverEnabled: !explorationPresentationActive,
    maxPinchScale: explorationPresentationActive
      ? todayScene.homeEnvironment.motion.explorationMaxPinchScale
      : todayScene.homeEnvironment.motion.maxPinchScale,
    pinchSoftLimitRange: explorationPresentationActive
      ? todayScene.homeEnvironment.motion.explorationPinchSoftLimitRange
      : 0,
  });
  const pageGesture = useMemo(
    () => explorationPresentationActive
      ? Gesture.Simultaneous(explorationMotion.gesture, environmentGesture)
      : Gesture.Simultaneous(swipeGesture, environmentGesture),
    [environmentGesture, explorationMotion.gesture, explorationPresentationActive, swipeGesture],
  );
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
      {!isForming ? (
      <>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, goalsSceneLiftStyle]}>
      {dailyHatchActive ? (
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
              <TodayExplorationBackground
                backgroundKey={displayedExplorationPrevious.backgroundKey}
                imageSize={explorationMotion.imageSize}
                verticalOffset={HOME_SCENE_Y_OFFSET}
              />
            </TodayExplorationPageLayer>
          ) : null}
          {displayedExplorationCurrent ? (
            <TodayExplorationPageLayer
              key={`exploration-background-${displayedExplorationCurrent.timelineDay.id}`}
              transitionProgress={explorationMotion.transitionProgress}
              transitionRole="current"
              translateX={explorationMotion.translateX}>
              <TodayExplorationBackground
                backgroundKey={displayedExplorationCurrent.backgroundKey}
                imageSize={explorationMotion.imageSize}
                verticalOffset={HOME_SCENE_Y_OFFSET}
              />
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
              <TodayExplorationBackground
                backgroundKey={displayedExplorationNext.backgroundKey}
                imageSize={explorationMotion.imageSize}
                verticalOffset={HOME_SCENE_Y_OFFSET}
              />
            </TodayExplorationPageLayer>
          ) : null}
          </TodayEnvironmentViewportMotionLayer>
        </View>
      ) : null}
      </Animated.View>
      {/* Today is a FIXED composition — no page scrolling; everything anchors.
          (Readers/sheets keep their own scrolling.) The ScrollView shell stays
          for layout parity but is locked. */}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
        contentInsetAdjustmentBehavior="never"
        pointerEvents="auto"
        style={styles.contentPlane}
        scrollEnabled={false}
        bounces={false}
        showsVerticalScrollIndicator={false}>
        <Animated.View
          entering={presenceEnter(20)}
          pointerEvents={quickGoalsOpen ? 'none' : 'auto'}
          style={[styles.topHudLayer, goalsChromeStyle]}>
          <TodayTopHud
            days={timelineDays}
            energyPulseNonce={energyHudPulseNonce}
            energyTargetRef={energyHudTargetRef}
            interactionLocked={isHatching}
            onSelectDay={navigateToDay}
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
                {!hasVisibleLegacyPrompt && !quickGoalsOpen ? (
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
      </>
      ) : null}

      {isForming && formingDay && nurtureGrowth && (!isHatching || hatchPresentation.policy === 'ftue_discovery') ? (
        <TodayEnergyProfiler>
          <TodayNurtureExperience
          actionListLocked={
            ftueActionBusy
            || energyLoopStatus === 'launching'
            || energyLoopStatus === 'awaiting_completion'
            || energyLoopStatus === 'rewarding'
          }
          actionListHidden={feastleJournalReward !== null || (isHatching && hatchPresentation.policy === 'ftue_discovery')}
          actionTransitionActive={
            energyLoopStatus === 'rewarding'
            || energyLoopStatus === 'entering'
          }
          actions={presentedNurtureActions}
          bottomInset={insets.bottom}
          completionEvent={queuedCareCompletion?.action.category === 'check_in' ? queuedCareCompletion : flowBusy ? null : queuedCareCompletion}
          companionWispId={activeWispId}
          day={formingDay}
          eggTargetRef={eggTargetRef}
          energyHudPulseNonce={energyHudPulseNonce}
          energyHudTargetRef={energyHudTargetRef}
          feedbackKey={eggFeedKey}
          focusMode={false}
          growth={nurtureGrowth}
          hatchPresentation={isHatching && hatchPresentation.policy === 'ftue_discovery' ? hatchPresentation : null}
          homeArchetypeId={homeArchetypeId}
          microcopy={microcopy}
          onboardingGuide={onboardingGuide}
          onboardingFocus={ftueOpeningFocus || (isHatching && hatchPresentation.policy === 'ftue_discovery')}
          scriptedActions={ftueTodayStep?.actions.filter((action) => action.presentation === 'inline_choice' || action.presentation === 'route_action' || action.presentation === 'cta_action') ?? []}
          scriptedPanelCareAction={ftuePanelCareAction}
          onScriptedAction={handleFtueAction}
          onScriptedChoice={handleFtueChoice}
          onAddJournal={handleNurtureAddJournal}
          onAddTextNote={handleNurtureAddTextNote}
          onAddPhoto={openMomentCapture}
          onCareNotToday={handleCareNotToday}
          onCareStart={handleCareStart}
          onCompleteQuickGoal={handleNurtureCompleteGoal}
          onCompletionAnimationEnd={finishCareCompletion}
          onOpenQuickGoal={handleNurtureOpenGoal}
          onHatchAssetsReady={handleHatchSubjectReady}
          onHatchAssetsError={handleHatchSubjectError}
          onChooseMood={handleNurtureMood}
          onChooseSleep={handleNurtureSleep}
          onReveal={handleRevealPress}
          onRewardFlight={handleCareRewardFlight}
          onSelectDay={navigateToDay}
          careSwipeExternalGesture={explorationMotion.gesture}
          environmentGesture={environmentGesture}
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
      {!isFormingToday && !isHatching && !quickGoalsOpen && !hasVisibleLegacyPrompt ? (
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
      {!isForming && (!isHatching || hatchShowsDashboard) && !hasVisibleLegacyPrompt && !quickGoalsOpen ? (
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
        onMergeEnergyTokenArrive={handleMergeEnergyTokenArrive}
      />

      {/* The cinematic background is the only environment renderer. Atmosphere
          remains a separate touch-through foreground plane. */}
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
          allowedChoiceIds={companionJournalHandoff?.allowedChoiceIds}
          promptTitle={companionJournalHandoff
            ? `${companionJournalHandoff.target === 'tomorrow' ? 'Tomorrow’s' : 'Today’s'} Egg · ${companionJournalHandoff.title}`
            : undefined}
          promptBody={companionJournalHandoff?.body}
          rewardNotice={journalMergeRewardNotice}
          saveLabel={companionJournalHandoff?.saveLabel}
          journalSource={companionJournalHandoff ? {
            kind: 'manual',
            sourceId: companionJournalHandoff.id,
            origin: {
              kind: 'companion_reflection',
              creatureId: companionJournalHandoff.creatureId,
              familyId: companionJournalHandoff.familyId,
              promptId: companionJournalHandoff.nodeId ?? 'feastle:optional-food-journal',
              promptText: companionJournalHandoff.prompt,
              answerIds: companionJournalHandoff.answerIds,
              reflectionMode: companionJournalHandoff.mode,
            },
          } : undefined}
          hapticOnSave={!pendingCareIntent}
          dateTarget={!companionJournalHandoff && (manualJournalTarget === 'yesterday' || new Date().getHours() < 3)
            ? (manualJournalTarget === 'yesterday' ? 'yesterday' : 'today')
            : undefined}
          onDateTargetChange={companionJournalHandoff ? undefined : (target) => setManualJournalTarget(target)}
          returnToOriginOnBack={Boolean(companionJournalHandoff)}
          onBackFromInitial={() => {
            if (!companionJournalHandoff) return;
            cancelCompanionJournalHandoff(companionJournalHandoff.id);
            const creatureId = companionJournalHandoff.creatureId;
            setCompanionJournalHandoff(null);
            closeManualJournal();
            router.push({ pathname: '/katchimera/[creatureId]', params: { creatureId } });
          }}
          onClose={() => {
            if (!companionJournalHandoff) {
              closeManualJournal();
              return;
            }
            cancelCompanionJournalHandoff(companionJournalHandoff.id);
            const creatureId = companionJournalHandoff.creatureId;
            setCompanionJournalHandoff(null);
            closeManualJournal();
            router.push({ pathname: '/katchimera/[creatureId]', params: { creatureId } });
          }}
          onSave={(submission) => {
            const mergeRewardPreview = companionJournalHandoff ? journalMergeReward : null;
            const completingCareAction = pendingCareIntent
              && journalFlowCompletesTodayCareAction(submission.flowId, pendingCareIntent.completionKey)
              ? pendingCareIntent
              : null;
            const deferRewardToCareRow = completingCareAction != null;
            if (completingCareAction) {
              deferredCareMergeEnergyRef.current = journalMergeReward?.totalEnergy ?? 0;
              queueCareCompletionAfterJournalDismiss(completingCareAction);
            }
            const target = companionJournalHandoff?.target ?? manualJournalTarget ?? formingTarget;
            addManualJournalEntry(submission, target);
            if (companionJournalHandoff) {
              const source = submission.journalSource ?? { kind: 'manual' as const, sourceId: companionJournalHandoff.id };
              const recordId = journalRecordId(journalIdempotencyKey(
                source,
                submission.sessionId ?? companionJournalHandoff.id,
              ));
              completeCompanionJournalHandoff(companionJournalHandoff.id, recordId);
              setFeastleJournalReward({
                ...companionJournalHandoff,
                journalRecordId: recordId,
                mergeReward: mergeRewardPreview ?? { dailyJournalEnergy: 0, companionEnergy: 0, totalEnergy: 0 },
                status: 'saved',
              });
            }
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
                imageSource: GAME_CURRENCY_ART.energy,
                mergeEnergyAmount: journalMergeReward?.totalEnergy ?? 0,
                tint: Lantern.ember300,
              }, () => {
                const pendingFtueCapture = ftueRun?.stepId === 'energy.capture'
                  ? ftueRun.receipts.find((receipt) => receipt.stepId === 'energy.capture' && receipt.status === 'pending')
                  : null;
                if (!pendingFtueCapture) return;
                const amount = ftueRun?.awardedMergeEnergy ?? journalMergeReward?.totalEnergy ?? 10;
                commitFtueAction({ actionId: pendingFtueCapture.actionId, evidenceRef: submission.sessionId ?? `journal:${formingDay?.isoDate ?? 'today'}` });
                setOnboardingEnergyReady(amount);
              });
            }
            setCompanionJournalHandoff(null);
            setMicrocopy(target === 'tomorrow' ? 'Added to Tomorrow’s Egg' : 'Added to Today’s Egg');
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
        focusedMemoryId={handledMergeMemoryIdRef.current === memoryRecordId ? memoryRecordId : undefined}
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
      <MicrocopyToast message={isForming && formingDay && nurtureGrowth && !isHatching ? null : microcopy} />
      {feastleJournalReward ? (
        <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(180)} style={styles.feastleRewardWrap}>
          <View style={styles.feastleRewardCard}>
            <View style={styles.feastleRewardHeading}>
              <View style={styles.feastleRewardIcon}><IconSymbol color="#FFF7DF" name="sparkles" size={18} /></View>
              <View style={{ flex: 1, gap: 2 }}>
                <ThemedText style={styles.feastleRewardEyebrow} lightColor="#8B672E" darkColor="#8B672E">
                  {feastleJournalReward.target === 'tomorrow' ? 'TOMORROW’S EGG' : 'TODAY’S EGG'}
                </ThemedText>
                <ThemedText style={styles.feastleRewardTitle} lightColor="#3B2C20" darkColor="#3B2C20">Your moment is safe</ThemedText>
              </View>
            </View>
            <ThemedText style={styles.feastleRewardBody} lightColor="#64513B" darkColor="#64513B">
              The Egg received +{feastleJournalReward.rewardGrowth} Growth. {feastleJournalReward.mergeReward.totalEnergy > 0
                ? `${MERGE_CHARACTER_NAMES[feastleJournalReward.familyId as MergeCharacterId] ?? 'Your Katchimera'} sent +${feastleJournalReward.mergeReward.totalEnergy} Energy to Merge World (${[
                    feastleJournalReward.mergeReward.dailyJournalEnergy > 0 ? `Journal +${feastleJournalReward.mergeReward.dailyJournalEnergy}` : null,
                    feastleJournalReward.mergeReward.companionEnergy > 0 ? `Companion +${feastleJournalReward.mergeReward.companionEnergy}` : null,
                  ].filter(Boolean).join(', ')}).`
                : `${feastleJournalReward.target === 'tomorrow' ? 'Tomorrow’s' : 'Today’s'} Egg had already granted its journal and companion Merge Energy for this date.`} Your reflection also sends a companion-matched Life Parcel to Merge World. Its memory stays safely in your journal. {feastleJournalReward.mode === 'story' ? 'A first story reflection sends starter supplies too.' : ''}
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                const familyId = feastleJournalReward.familyId;
                setFeastleJournalReward(null);
                router.navigate({ pathname: '/games', params: { familyId } });
              }}
              style={({ pressed }) => [styles.feastleRewardButton, pressed && { opacity: 0.82 }]}>
              <ThemedText style={styles.feastleRewardButtonLabel} lightColor="#FFF9E9" darkColor="#FFF9E9">Take it to Merge</ThemedText>
              <IconSymbol color="#FFF9E9" name="arrow.right" size={16} />
            </Pressable>
          </View>
        </Animated.View>
      ) : null}
      {streak.celebration && !flowBusy ? (
        <DayCapturedCelebration
          days={streak.celebration.result.snapshot.currentStreak}
          onDismiss={streak.dismissCelebration}
        />
      ) : null}
      {!streak.celebration && pendingStreakMilestone && !flowBusy ? (
        <StreakMilestoneCelebration
          milestone={pendingStreakMilestone}
          onDismiss={() => {
            streak.markMilestoneSeen(pendingStreakMilestone.days);
            void trackStreakEvent('streak_milestone_reached', { days: pendingStreakMilestone.days });
          }}
        />
      ) : null}
      {screenFocused
        && streak.snapshot.repairableDate
        && !manualJournalOpen
        && !flowBusy
        && !streak.celebration
        && !pendingStreakMilestone ? (
          <StreakRepairSheet
            currentStreak={streak.snapshot.repairableStreak}
            onAddYesterday={() => openManualJournal(undefined, undefined, null, 'yesterday')}
            onDecline={() => streak.declineRepair(streak.snapshot.repairableDate!)}
            onRepair={() => streak.repair(streak.snapshot.repairableDate!)}
            repairsAvailable={streak.snapshot.repairsAvailable}
          />
        ) : null}

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
      {pendingDiscoveryId && !isHatching ? <WispDiscoveryReveal id={pendingDiscoveryId} onDismiss={() => dismissDiscovery(pendingDiscoveryId)} /> : null}
      {hatchPresentation.policy === 'ftue_discovery' && hatchPresentation.phase === 'awaiting_interaction' ? (
        <Animated.View entering={presenceEnter(120)} style={[styles.discoveryInteractionCta, { bottom: insets.bottom + 34 }]}>
          <ThemedText selectable style={styles.discoveryInteractionHint} lightColor="#FFF6DE" darkColor="#FFF6DE">
            Mossprout is waiting for you.
          </ThemedText>
          <KatchaButton
            fullWidth
            glow
            label="Talk to Mossprout"
            labelStyle={KatchaDeckUI.typography.ftuePanelTitle}
            onPress={talkToMossprout}
          />
        </Animated.View>
      ) : null}
      <KatchaSheet
        footer={<KatchaButton fullWidth glow label="Help Mossprout" onPress={returnToMossprout} />}
        header={{ eyebrow: 'Your memory became Energy', title: `+${onboardingEnergyReady ?? 0} Merge Energy` }}
        onRequestClose={() => {}}
        open={onboardingEnergyReady != null}
        showClose={false}
        surface="parchment">
        <View style={styles.discoveryIntroBody}>
          <ThemedText style={styles.discoveryIntroQuote} lightColor={Lantern.ink900} darkColor={Lantern.ink900}>Your life just gave you more ways to play.</ThemedText>
          <ThemedText style={styles.discoveryIntroProblem} lightColor={Lantern.dusk700} darkColor={Lantern.dusk700}>The Energy has been added to the real Merge board. Spend it now to finish Mossprout’s home.</ThemedText>
        </View>
      </KatchaSheet>
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
  feastleRewardWrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,15,9,0.18)',
    justifyContent: 'flex-end',
    paddingBottom: 94,
    paddingHorizontal: 18,
    zIndex: 300,
  },
  feastleRewardCard: {
    backgroundColor: '#FFF5D8',
    borderColor: 'rgba(215,169,86,0.72)',
    borderRadius: 24,
    borderWidth: 1,
    boxShadow: '0 14px 34px rgba(18,12,6,0.34)',
    gap: 12,
    padding: 16,
  },
  feastleRewardHeading: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  feastleRewardIcon: { alignItems: 'center', backgroundColor: '#806040', borderRadius: 999, height: 36, justifyContent: 'center', width: 36 },
  feastleRewardEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.05 },
  feastleRewardTitle: { fontSize: 19, fontWeight: '900', lineHeight: 24 },
  feastleRewardBody: { fontSize: 13.5, lineHeight: 20 },
  feastleRewardButton: { alignItems: 'center', backgroundColor: '#7A4C19', borderRadius: 16, flexDirection: 'row', justifyContent: 'center', gap: 8, minHeight: 48, paddingHorizontal: 16 },
  feastleRewardButtonLabel: { fontSize: 14, fontWeight: '900' },
  topHudLayer: {
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
  discoveryIntroBody: {
    gap: 14,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  discoveryIntroQuote: {
    fontFamily: AppFontFamilies.instrumentSerif,
    fontSize: 23,
    lineHeight: 29,
  },
  discoveryIntroProblem: {
    fontFamily: AppFontFamilies.manrope,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
  },
  discoveryInteractionCta: {
    alignSelf: 'center',
    backgroundColor: 'rgba(28, 31, 24, 0.9)',
    borderColor: 'rgba(255, 241, 198, 0.36)',
    borderCurve: 'continuous',
    borderRadius: 24,
    borderWidth: 1,
    boxShadow: '0 12px 32px rgba(7, 10, 8, 0.35)',
    gap: 10,
    left: 24,
    padding: 14,
    position: 'absolute',
    right: 24,
    zIndex: 90,
  },
  discoveryInteractionHint: {
    ...KatchaDeckUI.typography.ftuePanelBody,
    textAlign: 'center',
  },
});
