import { gameNow } from '@/utils/game-clock';
import type { ReactNode } from 'react';
import { conversationUsesNarrativeOverlay } from '@/utils/conversation-presentation';
import { ftueDialoguePages } from '@/features/onboarding/ftue-dialogue-pages';
import { useCompanionDestinationMotion } from '@/hooks/use-companion-destination-motion';
import { CompanionEnvironmentGestureContext } from './companion-environment-gesture-context';
import { CompanionFirstRestCards } from './companion-first-rest-cards';
import * as Haptics from 'expo-haptics';
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type View as ViewType,
} from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExplorationEnvironmentProgressionProvider } from '@/components/katchadeck/home/exploration-environment-progression-context';
import { ThemedText } from '@/components/themed-text';
import { KatchaUI } from '@/constants/katcha-ui';
import { katchimeraSkinById } from '@/constants/katchimera-skins';
import { companionInteractionAvailability, katchimeraMeditationRecord, mossproutJourneyForDay, startMossproutJourneyActivity } from '@/game/katchimeras/relationship-progression';
import { useCompanionExperienceController } from '@/features/companion/use-companion-experience-controller';
import { useCompanionConversationFlow } from '@/features/companion/use-companion-conversation-flow';
import { useGameFeedback } from '@/features/ui/game-feedback-provider';
import { useRelationshipProgression } from '@/hooks/use-relationship-progression';
import type { HomeVisualKey } from '@/types/home';
import type { CompanionChatStarter, CompanionDestination } from '@/types/companion-interaction';
import { deriveTomorrowDayRecord, getCreatureVisual } from '@/game/days';
import { companionInitialConversationCompletionReady, companionViewportResetKey } from '@/utils/companion-interaction';
import { CompanionCinematicStage } from './companion-cinematic-stage';
import { useCompanionEnvironmentPan } from './use-companion-environment-pan';
import { CompanionPrimaryAction, CompanionSecondaryAction } from './companion-interaction-primitives';
import { CompanionDestinationHeader, CompanionDestinationSurface, CompanionSheetShell } from './companion-ui-primitives';
import { companionBondProgressForTotal, type CompanionBondAwardReceipt, type CompanionBondProgress } from '@/utils/companion-bond';
import { acquireLifecycleResource } from '@/utils/lifecycle-performance';
import type { CompanionMemory } from '@/utils/companion-content';
import { CompanionSkinsThread } from './companion-skins-thread';
import type { KatchimeraFamilyId, KatchimeraSkinId } from '@/types/katchimera';
import type { ConversationDefinition, ConversationMode, ConversationNode, ConversationSession } from '@/types/companion-conversation';
import type { KatchimeraActionOrigin } from '@/types/relationship-progression';
import type { KingdomSkinOption } from '@/utils/katchimera-wardrobe';
import { CompanionJourneyQuestionnairePage } from './companion-journey-thread';
import type { CompanionJourneyConversationNode, CompanionJourneyDefinition } from '@/constants/companion-journeys';
import type { CompanionJourneyConversationSession, CompanionJourneyGoal } from '@/utils/companion-journey';
import { CompanionQuickGoalPicker } from '@/components/katchadeck/goals/companion-quick-goals';
import type { CompanionQuickGoal, CompanionQuickGoalCadence, CompanionQuickGoalCompletion, CompanionQuickGoalState } from '@/utils/companion-quick-goals';
import { quickGoalsForDay } from '@/utils/companion-quick-goals';
import type { TodayAtmosphereBackground } from '@/utils/day-background-scene';
import type { TodayExplorationBackgroundKey } from '@/utils/today-exploration-backgrounds';
import { companionHubHeroSpacer } from '@/utils/companion-home-layout';
import type { CompanionQuickGoalCompletionReceipt } from '@/hooks/use-companion-quick-goals';
import type { GoalTaskSourceRect } from '@/components/katchadeck/goals/goal-task-row';
import { BondRewardFlightOverlay } from '@/components/katchadeck/goals/bond-reward-overlay';
import { CompanionFtueCoachmark } from '@/components/katchadeck/onboarding/companion-ftue-coachmark';
import { MossproutFtueStoryStage } from './mossprout-ftue-story-stage';
import { CompanionMeditationStage, journeyForeshadowLine } from './companion-meditation-stage';
import { CompanionJourneyCycleStage } from './companion-journey-cycle-stage';
import { isAuthoredCohortFamily, loadAuthoredCohortStory } from '@/utils/companion-story-storage';
import { MossproutStoryStage } from './mossprout-story-stage';
import { CompanionConversationScene, conversationSpeechLine } from './companion-conversation-scene';
import { isHatchableCompanion } from '@/constants/hatchable-companions/registry';
import { useAllDays } from '@/hooks/use-all-days';
import { mergeJournalRewardPreview } from '@/utils/merge-world/economy-policy';
import { homeRepository } from '@/storage/repositories/home-repository';
import { loadOnboardingProfile } from '@/utils/onboarding-state';
import { useGameSurfaceReadiness } from '@/features/navigation/game-screen-transition';
import { localDayId } from '@/utils/world-identity';
import { mossproutCampaignEpisodeByOpeningId } from '@/constants/mossprout-campaign';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';
import { MOSSPROUT_BOND_SHARE_PROMPTS, MOSSPROUT_SUPPORT_STYLE_OPTIONS, mossproutBondSharePrompt, mossproutBondShareSelection, mossproutFirstSeedForIntent } from '@/features/onboarding/mossprout-bond-share';
import { mossproutGardenIntroBeat } from '@/features/onboarding/mossprout-garden-intro';
import { MOSSPROUT_FTUE_COPY, MOSSPROUT_GREETING_OPTIONS, mossproutSeedIntroduction } from '@/features/onboarding/mossprout-ftue-copy';
import { recordMossproutOnboardingAnswer } from '@/features/onboarding/mossprout-profile';

const LazyCompanionTrophyRoomScreen = lazy(async () => {
  const module = await import('./companion-trophy-room-screen');
  return { default: module.CompanionTrophyRoomScreen };
});

/**
 * The companion page: the cinematic stage with the friend and their speech,
 * the stage's cards (the journey stage for every hatchable friend and for
 * Mossprout's open cycle, Mossprout's own story stage otherwise), the shared
 * conversation scene, the small-goal picker, Mossprout's nature-direction
 * questionnaire, and two side pages (forms, trophy room). Only Mossprout and
 * the hatchable friends reach this sheet.
 */
export type CompanionInteractionSheetProps = {
  active?: boolean;
  creatureId: string;
  name: string;
  visualKey: HomeVisualKey;
  accentColor: string;
  questionnaireBackground: TodayAtmosphereBackground;
  homeEnvironmentKey?: TodayExplorationBackgroundKey | null;
  homeEnvironmentStage?: number | null;
  houseLevel?: number;
  initialDestination?: CompanionDestination | null;
  initialConversationDefinitionId?: string;
  worldEventAction?: ReactNode;
  onInitialConversationComplete?: (session: ConversationSession) => void | Promise<void>;
  onCompletedConversationExit?: (definitionId: string) => boolean | Promise<boolean>;
  ftueOrderPreviewActive?: boolean;
  ftueProfileStep?: 'intro_action' | 'nickname' | 'bond' | 'bond_choice' | 'garden_intro' | 'water_together' | 'first_grow' | 'notice_bond' | 'water_response' | 'first_insight' | 'meditating' | 'resident_result' | null;
  ftueBondSpotlightActive?: boolean;
  ftueDayOneActionActive?: boolean;
  ftueDayOneActionAnswerId?: string | null;
  ftueResidentHandoffActive?: boolean;
  ftueResidentMatchResultActive?: boolean;
  ftueResidentStoryResume?: boolean;
  ftueNavigationLocked?: boolean;
  /** Active FTUE owns this companion surface; normal dashboard must fail closed. */
  ftueCompanionSurfaceOwned?: boolean;
  onFtueBondSpotlightComplete?: () => void | Promise<void>;
  onFtueOpenMerge?: () => void;
  onFtueProfileContinue?: (nickname?: string) => void;
  /** Retained for host compatibility; meditation now uses ordinary daily actions. */
  onFtueMeditationAction?: (action: 'tend_together' | 'share_moment', optionId?: string) => void;
  onFtueOpenResidentParcel?: () => void;
  onSelectDestination?: (destination: CompanionDestination | null) => void;
  onClose: () => void;
  onOpenMerge?: (orderId?: string | null, familyId?: KatchimeraFamilyId) => void;
  onJournalFood: () => void;
  onOpenTodayGoals: () => void;
  embedded?: boolean;
  /** Draw the canonical companion environment while retaining a transparent FTUE shell. */
  renderRegularStage?: boolean;
  /** Render only the requested narrative overlay when hosted over another world target. */
  hostedNarrativeOnly?: boolean;
  /** Prevent the hosted companion speech layer from painting over a nature island. */
  suppressWorldSpeech?: boolean;
  reuseUnderlyingStage?: boolean;
  /** Mirrors reward feedback onto a creature rendered by an underlying host. */
  onVisibleCreatureRewardPulse?: () => void;
  bondProgress: CompanionBondProgress;
  pendingBondCelebration: CompanionBondAwardReceipt | null;
  onBondCelebrationComplete: (receipt: CompanionBondAwardReceipt) => void;
  skins: readonly KingdomSkinOption[];
  onEquipSkin: (skinId: KatchimeraSkinId) => void;
  /** Mossprout's nature-direction questionnaire: his journey definition and the session it drives. */
  journeyDefinition: CompanionJourneyDefinition | null;
  journeyGoals: readonly CompanionJourneyGoal[];
  journeyConversation: CompanionJourneyConversationSession | null;
  journeyNode: CompanionJourneyConversationNode | null;
  onStartJourneyConversation: (actionOrigin?: KatchimeraActionOrigin) => void;
  onAnswerJourneyConversation: (sessionId: string, value: string) => readonly string[];
  onCompleteJourneyQuestionnaire: (sessionId: string | null) => void;
  familyId: KatchimeraFamilyId;
  quickGoalDayId: string;
  quickGoalState: CompanionQuickGoalState;
  onAddQuickGoalTemplate: (templateId: string) => { added: boolean; reason: string | null };
  onAddCustomQuickGoal: (
    familyId: KatchimeraFamilyId,
    title: string,
    cadence: CompanionQuickGoalCadence
  ) => { added: boolean; reason: string | null };
  onCompleteQuickGoal: (goalId: string) => CompanionQuickGoalCompletionReceipt;
  onSkipQuickGoal: (goalId: string) => boolean;
  onSnoozeQuickGoal: (goalId: string) => boolean;
  onUndoQuickGoal: (goalId: string) => boolean;
  onRememberQuickGoal: (completion: CompanionQuickGoalCompletion, goal: CompanionQuickGoal) => void;
  quickGoalSuggestionIds: readonly string[];
  onAddQuickGoalSuggestions: (templateIds: readonly string[]) => readonly string[];
  onDismissQuickGoalSuggestions: () => void;
  conversationSession: ConversationSession | null;
  conversationDefinition: ConversationDefinition | null;
  mossproutActionCandidates: readonly CompanionChatStarter[];
  onAnswerConversation: (optionId: string) => void;
  onContinueConversation: () => void;
  onStartConversation: (input?: { definitionId?: string; mode?: ConversationMode; poolId?: string; actionOrigin?: KatchimeraActionOrigin }) => void;
  onKeepTalkingConversation: (poolId?: string) => void;
  onMemoryConversationDecision: (remember: boolean, summary: string) => void;
  onGoalConversationDecision: (selectedTemplateIds: readonly string[] | null, node: Extract<ConversationNode, { kind: 'goal_proposal' }>) => void;
  onQuickGoalConversationDecision: (accept: boolean, node: Extract<ConversationNode, { kind: 'quick_goal_proposal' }>) => void;
  onJournalConversationHandoff: (open: boolean, node: Extract<ConversationNode, { kind: 'journal_handoff' }>) => void;
  onDismissConversationOutcome: () => void;
  memories: readonly CompanionMemory[];
  onUpdateMemory: (input: { memoryId: string; status: 'confirmed' | 'rejected' | 'forgotten'; summary?: string }) => void;
  onInsightConversationDecision: (accept: boolean, node: Extract<ConversationNode, { kind: 'insight_reveal' }>) => void;
};

export function CompanionInteractionSheet(props: CompanionInteractionSheetProps) {
  const gameFeedback = useGameFeedback();
  const shownFtueMemoryNoticeRef = useRef<string | null>(null);
  const shownFtueBondMemoryNoticeRef = useRef<string | null>(null);
  const relationships = useRelationshipProgression();
  const storedMeditation = katchimeraMeditationRecord(relationships, props.familyId);
  const meditationAvailableAt = storedMeditation?.availableAt;
  const [meditationNow, setMeditationNow] = useState(gameNow());
  const [actionSubmenuOpen, setActionSubmenuOpen] = useState(false);
  const [actionNarration, setActionNarration] = useState<string | null>(null);
  const [journeyNarration, setJourneyNarration] = useState<string | null>(null);
  // The FTUE's closing beat remains an explicit interaction until the player
  // chooses Tend the Garden, even if its wake timer elapsed while the app was
  // closed. Outside FTUE, an elapsed meditation naturally restores actions.
  const interactionAvailability = companionInteractionAvailability(relationships, props.familyId, meditationNow);
  const meditation = props.ftueProfileStep === 'meditating'
    ? storedMeditation
    : interactionAvailability.kind === 'meditating'
      ? interactionAvailability
      : null;
  useEffect(() => {
    setMeditationNow(gameNow());
    if (!meditationAvailableAt || meditationAvailableAt <= gameNow()) return;
    const timer = setInterval(() => setMeditationNow(gameNow()), 1_000);
    return () => clearInterval(timer);
  }, [meditationAvailableAt, props.familyId]);
  const mossproutJourney = props.familyId === 'mossprout'
    ? mossproutJourneyForDay(relationships, localDayId())
    : null;
  const ftueDayOneLessonCompleted = Boolean(relationships.milestones.dayOneLessonCompletedAt);
  const [ftueBondQuestionId, setFtueBondQuestionId] = useState<string | null>(null);
  const ftueBondQuestion = mossproutBondSharePrompt(ftueBondQuestionId);
  const ftueBondShare = mossproutBondShareSelection(props.ftueDayOneActionAnswerId);
  const ftueGardenStoryBeat = mossproutGardenIntroBeat(0);

  useEffect(() => {
    if (props.ftueProfileStep !== 'bond_choice') setFtueBondQuestionId(null);
  }, [props.ftueProfileStep]);
  const [transitionBackgroundReady, setTransitionBackgroundReady] = useState(false);
  const [transitionCreatureReady, setTransitionCreatureReady] = useState(false);
  const initialConversationContentReady = !props.initialConversationDefinitionId || (
    props.conversationSession?.definitionId === props.initialConversationDefinitionId
    && props.conversationDefinition?.id === props.initialConversationDefinitionId
    && (props.conversationSession.status === 'active' || props.conversationSession.status === 'completed')
  );
  useEffect(() => {
    const session = props.conversationSession;
    if (
      !props.active
      || props.familyId !== 'mossprout'
      || !session?.definitionId.startsWith('mossprout:ftue:first-meeting:')
      || session.currentNodeId !== 'remembered'
    ) return;
    const noticeId = `${session.id}:answers-remembered`;
    if (shownFtueMemoryNoticeRef.current === noticeId) return;
    shownFtueMemoryNoticeRef.current = noticeId;
    gameFeedback.show({
      durationMs: 2_400,
      icon: 'sparkles',
      id: noticeId,
      message: 'Mossprout remembers your answers',
      placement: 'middle',
    });
  }, [gameFeedback, props.active, props.conversationSession, props.familyId]);
  useEffect(() => {
    const answerId = props.ftueDayOneActionAnswerId;
    if (!props.active || props.familyId !== 'mossprout' || !answerId) return;
    if (shownFtueBondMemoryNoticeRef.current === answerId) return;
    shownFtueBondMemoryNoticeRef.current = answerId;
    gameFeedback.show({
      durationMs: 2_400,
      icon: 'leaf.fill',
      id: `mossprout-bond-memory:${answerId}`,
      message: 'Mossprout will remember this',
      placement: 'middle',
    });
  }, [gameFeedback, props.active, props.familyId, props.ftueDayOneActionAnswerId]);
  useGameSurfaceReadiness('companion', {
    background: transitionBackgroundReady,
    data: initialConversationContentReady,
    foreground: transitionCreatureReady,
    layout: transitionBackgroundReady && transitionCreatureReady && initialConversationContentReady,
  }, props.active !== false);
  useEffect(() => {
    if (!props.active) return;
    return acquireLifecycleResource('companion_sheet', `companion-sheet:${props.creatureId}`);
  }, [props.active, props.creatureId]);
  const { days: journalRewardDays } = useAllDays();
  const journalMergeEnergyPreview = useMemo(() => {
    const now = new Date();
    const homeState = homeRepository.load();
    const targetDay = homeState?.today.state === 'hatched'
      ? deriveTomorrowDayRecord(homeState, loadOnboardingProfile(), now)
      : null;
    const rewardDays = targetDay
      ? [...journalRewardDays.filter((day) => day.id !== targetDay.id), targetDay]
      : journalRewardDays;
    return mergeJournalRewardPreview(rewardDays, {
      companion: true,
      now,
      targetDayId: targetDay?.isoDate ?? homeState?.today.isoDate,
    }).totalEnergy;
  }, [journalRewardDays]);
  const insets = useSafeAreaInsets();
  const { height: viewportHeight, width: viewportWidth } = useWindowDimensions();
  const onInitialConversationComplete = props.onInitialConversationComplete;
  const onCompletedConversationExit = props.onCompletedConversationExit;
  const unifiedJourneyActive = !props.ftueCompanionSurfaceOwned && !props.ftueProfileStep && (
    // Every friend with a chapter lives on the journey stage: the hatchable friends, and Mossprout once his first session is over.
    isHatchableCompanion(props.familyId) || props.familyId === 'mossprout'
  );
  const onBondCelebrationComplete = props.onBondCelebrationComplete;
  const bondRewardTargetRef = useRef<ViewType | null>(null);
  const ftueBondTargetRef = useRef<ViewType | null>(null);
  const ftueActionTargetRef = useRef<ViewType | null>(null);
  const [bondReward, setBondReward] = useState<{
    from: GoalTaskSourceRect;
    receipt: CompanionBondAwardReceipt;
    to: GoalTaskSourceRect;
  } | null>(null);
  const [rewardPulseKey, setRewardPulseKey] = useState(0);
  const [rewardSourceVersion, setRewardSourceVersion] = useState(0);
  const [displayedBondTotal, setDisplayedBondTotal] = useState<number | null>(null);
  const pendingRewardSourceRef = useRef<GoalTaskSourceRect | null>(null);
  const pendingStoryRewardArrivalRef = useRef<(() => void) | null>(null);
  const [storyRewardReceipt, setStoryRewardReceipt] = useState<CompanionBondAwardReceipt | null>(null);
  const rewardLaunchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rewardFinishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestStoryReward = useCallback((source: GoalTaskSourceRect, onArrive: () => void, receipt?: CompanionBondAwardReceipt) => {
    pendingRewardSourceRef.current = source;
    pendingStoryRewardArrivalRef.current = onArrive;
    if (receipt) setStoryRewardReceipt(receipt);
    setRewardSourceVersion((current) => current + 1);
  }, []);
  const displayedBondProgress = useMemo(
    () => displayedBondTotal == null ? props.bondProgress : companionBondProgressForTotal(displayedBondTotal),
    [displayedBondTotal, props.bondProgress]
  );
  useEffect(() => {
    if (rewardFinishTimerRef.current) clearTimeout(rewardFinishTimerRef.current);
    rewardFinishTimerRef.current = null;
    setDisplayedBondTotal(null);
    setBondReward(null);
    setStoryRewardReceipt(null);
    pendingRewardSourceRef.current = null;
    pendingStoryRewardArrivalRef.current = null;
  }, [props.creatureId]);

  useEffect(() => {
    const receipt = storyRewardReceipt ?? props.pendingBondCelebration;
    if (!props.active || !receipt || bondReward) return;
    if (props.familyId === 'mossprout' && !pendingRewardSourceRef.current) return;
    setDisplayedBondTotal(receipt.beforeTotal);
    let cancelled = false;
    const launch = (attempt = 0) => {
      if (cancelled) return;
      if (!pendingRewardSourceRef.current && attempt < 4) {
        rewardLaunchTimerRef.current = setTimeout(() => launch(attempt + 1), 50);
        return;
      }
      const targetView = bondRewardTargetRef.current;
      if (!targetView) {
        if (attempt < 1) {
          rewardLaunchTimerRef.current = setTimeout(() => launch(attempt + 1), 50);
        } else {
          const target = { height: 54, width: 54, x: viewportWidth / 2 - 96, y: insets.top + 2 };
          const fallback = { height: 52, width: 104, x: viewportWidth / 2 - 52, y: viewportHeight - 150 };
          setBondReward({ from: pendingRewardSourceRef.current ?? fallback, receipt, to: target });
          pendingRewardSourceRef.current = null;
        }
        return;
      }
      targetView.measureInWindow((x, y, width, height) => {
        if (cancelled) return;
        if ((!width || !height) && attempt < 1) {
          rewardLaunchTimerRef.current = setTimeout(() => launch(attempt + 1), 50);
          return;
        }
        const target = { height, width, x, y };
        const fallback = { height: 52, width: 104, x: viewportWidth / 2 - 52, y: viewportHeight - 150 };
        setBondReward({ from: pendingRewardSourceRef.current ?? fallback, receipt, to: target });
        pendingRewardSourceRef.current = null;
      });
    };
    launch();
    return () => {
      cancelled = true;
      if (rewardLaunchTimerRef.current) clearTimeout(rewardLaunchTimerRef.current);
      rewardLaunchTimerRef.current = null;
    };
  }, [bondReward, insets.top, props.active, props.familyId, props.pendingBondCelebration, rewardSourceVersion, storyRewardReceipt, viewportHeight, viewportWidth]);

  useEffect(() => {
    if (props.active !== false) return;
    if (rewardLaunchTimerRef.current) clearTimeout(rewardLaunchTimerRef.current);
    if (rewardFinishTimerRef.current) clearTimeout(rewardFinishTimerRef.current);
    rewardLaunchTimerRef.current = null;
    rewardFinishTimerRef.current = null;
    setBondReward(null);
    setStoryRewardReceipt(null);
    setDisplayedBondTotal(null);
    pendingStoryRewardArrivalRef.current = null;
  }, [props.active]);

  useEffect(() => () => {
    if (rewardLaunchTimerRef.current) clearTimeout(rewardLaunchTimerRef.current);
    if (rewardFinishTimerRef.current) clearTimeout(rewardFinishTimerRef.current);
  }, []);
  useEffect(() => {
    if (!bondReward) return;
    if (rewardFinishTimerRef.current) clearTimeout(rewardFinishTimerRef.current);
    rewardFinishTimerRef.current = setTimeout(() => {
      setDisplayedBondTotal(bondReward.receipt.afterTotal);
      onBondCelebrationComplete(bondReward.receipt);
      setBondReward(null);
      setStoryRewardReceipt(null);
      rewardFinishTimerRef.current = null;
    }, 2_800);
    return () => {
      if (rewardFinishTimerRef.current) clearTimeout(rewardFinishTimerRef.current);
      rewardFinishTimerRef.current = null;
    };
  }, [bondReward, onBondCelebrationComplete]);
  const experience = useCompanionExperienceController({
    creatureId: props.creatureId,
    initialDestination: props.initialDestination,
    initialConversation: Boolean(props.initialConversationDefinitionId),
    onClose: props.onClose,
    onSelectDestination: props.onSelectDestination,
  });
  const showConversation = experience.showConversation;
  const showStoryHome = experience.showHome;
  const pendingStoryConversationRef = useRef<string | null>(null);
  const openedStoryConversationRef = useRef<string | null>(null);
  const routedInitialConversationRef = useRef<string | null>(null);
  const initialConversationDefinitionRef = useRef<string | null>(null);
  const completedInitialConversationRef = useRef<string | null>(null);
  const completedConversationExitRef = useRef<string | null>(null);
  const initialConversationObservedActiveRef = useRef(false);
  const {
    destination,
    direction,
    journeyQuestionnaireOpen,
    journeyQuestionnaireSessionId,
    quickGoalPickerOpen,
    syncJourneySession,
    route,
  } = experience;
  const residentFtueDashboard = props.familyId === 'mossprout'
    && Boolean(props.ftueResidentHandoffActive);
  const residentResultFtueDashboard = props.familyId === 'mossprout'
    && Boolean(props.ftueResidentMatchResultActive);
  const residentStoryResumeDashboard = residentFtueDashboard
    && Boolean(props.ftueResidentStoryResume);
  // The companion route is reused across the affinity conversation and its
  // resident handoff. Never let that completed conversation subroute outrank
  // the authored parcel or Continue Story dashboard.
  const dashboardRouteActive = route.kind === 'dashboard'
    || residentFtueDashboard
    || residentResultFtueDashboard
    || Boolean(props.ftueCompanionSurfaceOwned && route.kind !== 'conversation');
  const mossproutActionDashboard = dashboardRouteActive && props.familyId === 'mossprout';
  const residentParcelGardenPanelActive = props.ftueResidentHandoffActive
    && !props.ftueResidentStoryResume;
  const initialConversationHandoffPending = Boolean(
    props.initialConversationDefinitionId
    && !initialConversationObservedActiveRef.current
    && !(props.conversationSession?.definitionId === props.initialConversationDefinitionId && props.conversationSession.status === 'completed')
    && (!initialConversationContentReady || route.kind !== 'conversation')
  );
  const startConversation = props.onStartConversation;
  const requestStoryConversation = useCallback((definitionId: string, actionOrigin?: KatchimeraActionOrigin) => {
    if (
      props.conversationSession?.definitionId === definitionId
      && props.conversationSession.status === 'active'
      && props.conversationDefinition?.id === definitionId
    ) {
      pendingStoryConversationRef.current = null;
      // An explicit tap must reopen an unfinished conversation even if this
      // retained screen has already shown it and returned to the dashboard.
      openedStoryConversationRef.current = definitionId;
      showConversation();
      return;
    }
    openedStoryConversationRef.current = null;
    pendingStoryConversationRef.current = definitionId;
    startConversation({ definitionId, actionOrigin });
  }, [props.conversationDefinition?.id, props.conversationSession?.definitionId, props.conversationSession?.status, showConversation, startConversation]);
  const autoOpenedJourneyProfileRef = useRef<string | null>(null);
  useEffect(() => {
    const definitionId = mossproutJourney?.status === 'profile_available'
      ? mossproutJourney.profileConversationId
      : null;
    if (!props.active || props.familyId !== 'mossprout' || props.ftueResidentHandoffActive || !definitionId) {
      if (!definitionId) autoOpenedJourneyProfileRef.current = null;
      return;
    }
    // Let the Bond reward finish cleanly. Once its FTUE step advances, launch
    // the questionnaire directly instead of briefly restoring the action list.
    if (props.ftueBondSpotlightActive || props.ftueDayOneActionActive) return;
    const requestId = `${mossproutJourney?.id ?? 'mossprout'}:${definitionId}`;
    if (autoOpenedJourneyProfileRef.current === requestId) return;
    autoOpenedJourneyProfileRef.current = requestId;
    requestStoryConversation(definitionId);
  }, [mossproutJourney?.id, mossproutJourney?.profileConversationId, mossproutJourney?.status, props.active, props.familyId, props.ftueBondSpotlightActive, props.ftueDayOneActionActive, props.ftueResidentHandoffActive, requestStoryConversation]);
  useEffect(() => {
    if (!props.active || (!residentFtueDashboard && !residentResultFtueDashboard)) return;
    pendingStoryConversationRef.current = null;
    openedStoryConversationRef.current = null;
    initialConversationDefinitionRef.current = null;
    showStoryHome();
  }, [props.active, residentFtueDashboard, residentResultFtueDashboard, showStoryHome]);
  useLayoutEffect(() => {
    const definitionId = props.initialConversationDefinitionId;
    if (!definitionId) {
      routedInitialConversationRef.current = null;
      return;
    }
    if (!props.active || routedInitialConversationRef.current === definitionId) return;
    // An FTUE step can promote this already-mounted sheet from its action
    // dashboard into a deep-linked conversation. Claim the conversation route
    // before the native frame is painted so the dashboard cannot flash between
    // the card press and session hydration.
    routedInitialConversationRef.current = definitionId;
    if (route.kind !== 'conversation') showConversation();
  }, [props.active, props.initialConversationDefinitionId, route.kind, showConversation]);
  useEffect(() => {
    const definitionId = props.initialConversationDefinitionId;
    if (!definitionId) {
      initialConversationDefinitionRef.current = null;
      initialConversationObservedActiveRef.current = false;
      completedInitialConversationRef.current = null;
      return;
    }
    if (initialConversationDefinitionRef.current !== definitionId) {
      initialConversationDefinitionRef.current = definitionId;
      initialConversationObservedActiveRef.current = false;
      completedInitialConversationRef.current = null;
    }
    if (!props.active) return;
    if (
      props.conversationSession?.definitionId === definitionId
      && props.conversationSession.status === 'active'
    ) {
      initialConversationObservedActiveRef.current = true;
      return;
    }
    if (
      props.conversationSession?.definitionId === definitionId
      && props.conversationSession.status === 'completed'
    ) {
      if (props.conversationSession.outcomePresentation) {
        // A restored FTUE result still belongs to the active conversation.
        // Keep it pending until the player presses its explicit action.
        initialConversationObservedActiveRef.current = true;
        return;
      }
      if (initialConversationObservedActiveRef.current) return;
      // A restored completed session still needs to run the completion effect
      // below. Marking it handled here strands the sheet on its passive
      // "Returning to Mossprout" presentation until an unrelated tap calls
      // advance manually.
      return;
    }
    // This prop is a one-shot deep-link request, not permanent ownership of
    // the conversation route. Once its session has appeared, an explicit
    // player action must be free to replace it without this effect relaunching
    // the Journey conversation and swallowing the new action.
    if (initialConversationObservedActiveRef.current) return;
    requestStoryConversation(definitionId);
  }, [props.active, props.conversationSession?.definitionId, props.conversationSession?.id, props.conversationSession?.outcomePresentation, props.conversationSession?.status, props.initialConversationDefinitionId, requestStoryConversation]);
  useEffect(() => {
    const definitionId = props.initialConversationDefinitionId;
    const session = props.conversationSession;
    if (!session || !companionInitialConversationCompletionReady(session, definitionId)) return;
    if (props.ftueResidentMatchResultActive) return;
    if (session.dialoguePresentation && !session.dialogueAcknowledgedAt) return;
    if (completedInitialConversationRef.current === session.id) return;
    completedInitialConversationRef.current = session.id;
    void Promise.resolve(onInitialConversationComplete?.(session))
      .catch((error) => console.warn('Could not finish the companion return handoff', error))
      .then(showStoryHome);
  }, [onInitialConversationComplete, props.conversationSession, props.ftueResidentMatchResultActive, props.initialConversationDefinitionId, showStoryHome]);
  useEffect(() => {
    const definitionId = pendingStoryConversationRef.current;
    if (
      !definitionId
      || props.conversationSession?.definitionId !== definitionId
      || props.conversationSession.status !== 'active'
      || props.conversationDefinition?.id !== definitionId
    ) return;
    pendingStoryConversationRef.current = null;
    if (openedStoryConversationRef.current === definitionId) return;
    openedStoryConversationRef.current = definitionId;
    showConversation();
  }, [props.conversationDefinition?.id, props.conversationSession?.definitionId, props.conversationSession?.status, showConversation]);
  // A friend's authored story chapter left mid-conversation opens again on arrival.
  useEffect(() => {
    if (!isAuthoredCohortFamily(props.familyId)) return;
    const story = loadAuthoredCohortStory(props.familyId);
    if (story.status !== 'conversation_active' || !story.pendingConversationId) return;
    if (openedStoryConversationRef.current === story.pendingConversationId) return;
    requestStoryConversation(story.pendingConversationId);
  }, [props.familyId, requestStoryConversation]);
  const contentRef = useRef<ScrollView>(null);
  const reduceMotion = useReducedMotion();
  const visual = getCreatureVisual(props.visualKey, 'grown');
  const goalsToday = quickGoalsForDay(
    props.quickGoalState,
    props.quickGoalDayId,
    props.familyId
  );
  const activeJourneyFocus = props.journeyGoals.find((goal) => goal.status === 'active' && goal.isPrimary)
    ?? props.journeyGoals.find((goal) => goal.status === 'active')
    ?? null;
  const viewportResetKey = `${companionViewportResetKey({
    creatureId: props.creatureId,
    destination,
    // Keep the immersive questionnaire scene mounted between questions.
    // Only the answer choices should transition; remounting this ScrollView
    // reloads the background/creature and replays every entrance animation.
    journeyNodeId: journeyQuestionnaireOpen ? undefined : props.journeyNode?.id,
  })}:quick-goal-picker:${quickGoalPickerOpen}:journey-questionnaire:${journeyQuestionnaireOpen}`;

  const resetViewport = useCallback(() => {
    if (route.kind === 'dashboard') {
      contentRef.current?.scrollToEnd({ animated: false });
      return;
    }
    contentRef.current?.scrollTo({ x: 0, y: 0, animated: false });
  }, [route.kind]);

  useEffect(() => {
    if (mossproutActionDashboard) return;
    Keyboard.dismiss();
    resetViewport();
    const frame = requestAnimationFrame(resetViewport);
    // KeyboardAvoidingView and the animated thread swap settle on separate
    // native layout passes. Reset once more after both have finished so a
    // longer previous thread cannot strand a shorter page above the viewport.
    const settled = setTimeout(resetViewport, 260);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settled);
    };
  }, [mossproutActionDashboard, resetViewport, viewportResetKey]);

  useEffect(() => {
    if (journeyQuestionnaireOpen && props.journeyConversation) {
      syncJourneySession(props.journeyConversation.id);
    }
  }, [journeyQuestionnaireOpen, props.journeyConversation, syncJourneySession]);

  const requestClose = () => {
    if (props.ftueNavigationLocked) return;
    if (journeyQuestionnaireOpen) {
      Keyboard.dismiss();
      if (journeyQuestionnaireSessionId && !props.journeyConversation) {
        props.onDismissQuickGoalSuggestions();
        props.onCompleteJourneyQuestionnaire(journeyQuestionnaireSessionId);
      }
    }
    experience.requestBack();
    resetViewport();
  };
  const selectDestination = (nextDestination: CompanionDestination) => {
    if (props.ftueNavigationLocked) return;
    Keyboard.dismiss();
    resetViewport();
    experience.selectDestination(nextDestination);
  };
  const questionnaireExperience = Boolean(journeyQuestionnaireOpen && props.journeyDefinition);
  const hostedFtueInteraction = Boolean(
    props.ftueNavigationLocked
    || props.ftueCompanionSurfaceOwned
    || props.ftueProfileStep
    || props.ftueOrderPreviewActive
    || props.ftueResidentHandoffActive
    || props.ftueResidentMatchResultActive
    || props.initialConversationDefinitionId?.includes(':ftue:')
  );
  const hostedSwipeDismiss = props.reuseUnderlyingStage && !hostedFtueInteraction
    ? requestClose
    : undefined;
  const environmentPan = useCompanionEnvironmentPan({
    activeKey: `${props.creatureId}:${props.homeEnvironmentKey ?? 'none'}`,
    dismissOnSwipe: hostedSwipeDismiss,
    enabled: props.active !== false && (
      Boolean(hostedSwipeDismiss)
      || (!questionnaireExperience && Boolean(props.homeEnvironmentKey))
    ),
    panVisuals: !props.reuseUnderlyingStage,
    visualKey: props.visualKey,
  });
  const destinationMotion = useCompanionDestinationMotion(direction);
  const destinationLabel = destination === 'achievements' ? 'Trophy room' : 'Skins';
  const homeGreeting = 'Where shall we begin today?';
  const conversationExperience = props.conversationSession && props.conversationDefinition
    ? { session: props.conversationSession, definition: props.conversationDefinition }
    : null;
  // A retained session is not a visible conversation. Dashboard feedback must
  // remain available after returning from a multi-choice interaction.
  const narrativeOverlayVisible = Boolean(conversationExperience
    && route.kind === 'conversation'
    && !residentFtueDashboard && !initialConversationHandoffPending
    && props.active !== false
    && conversationUsesNarrativeOverlay(conversationExperience.definition));
  // A friend's authored story chapter (Steppling's, Baristabbit's) plays as a flow, not a chat.
  const authoredStoryFlow = Boolean(
    conversationExperience
    && isAuthoredCohortFamily(props.familyId)
    && !conversationExperience.session.preview
    && /^(?:baristabbit|steppling):story:(?:first-meeting|[678])$/.test(conversationExperience.definition.id)
  );
  const authoredStoryFinale = /^(?:baristabbit|steppling):story:8$/.test(conversationExperience?.definition.id ?? '');
  const journeyOpeningEpisode = conversationExperience
    ? mossproutCampaignEpisodeByOpeningId.get(conversationExperience.definition.id)
    : null;
  const journeyTaskRequests = journeyOpeningEpisode?.mergeOrders.map((order, index, orders) => ({
    id: order.id,
    badge: orders.length > 1 ? `${index + 1} OF ${orders.length}` : undefined,
    title: order.title,
    description: order.description,
    definitionIds: order.requirements.map((requirement) => requirement.definitionId),
    quantity: order.requirements.length === 1 ? order.requirements[0]?.quantity : undefined,
  })) ?? [];
  const onMemoryConversationDecision = props.onMemoryConversationDecision;
  const onInsightConversationDecision = props.onInsightConversationDecision;
  const onDismissConversationOutcome = props.onDismissConversationOutcome;
  const commitConversationMemory = useCallback((summary: string) => {
    onMemoryConversationDecision(true, summary);
  }, [onMemoryConversationDecision]);
  const commitConversationInsight = useCallback((node: Extract<ConversationNode, { kind: 'insight_reveal' }>) => {
    onInsightConversationDecision(true, node);
  }, [onInsightConversationDecision]);
  const dismissConversationOutcome = useCallback(() => {
    onDismissConversationOutcome();
  }, [onDismissConversationOutcome]);
  const conversationFamilyId = props.familyId;
  const openConversationMerge = props.onOpenMerge;
  const completeConversation = useCallback(() => {
    const session = conversationExperience?.session;
    const episode = session
      ? mossproutCampaignEpisodeByOpeningId.get(session.definitionId)
      : null;
    if (
      conversationFamilyId !== 'mossprout'
      || !session
      || session.preview
    ) {
      showStoryHome();
      return;
    }

    const relationships = relationshipProgressionRepository.load();
    const journey = [...relationships.journeyDays].reverse().find((candidate) => (
      candidate.familyId === 'mossprout'
      && (candidate.openingConversationId === session.definitionId
        || candidate.profileConversationId === session.definitionId
        || candidate.returnConversationId === session.definitionId
        || candidate.actions.some((action) => action.definitionId === session.definitionId))
    ));
    const orderId = journey?.activity?.mergeOrderIds?.find((candidate) => (
      !journey.activity?.servedOrderIds?.includes(candidate)
    )) ?? journey?.activity?.mergeOrderId;

    // Reaching this callback in an ordinary Journey requires the player to
    // press the visible Garden request button. Send that explicit handoff
    // straight to Merge just like FTUE; do not bounce through Mossprout home.
    if (episode && journey && orderId && openConversationMerge) {
      relationshipProgressionRepository.update((current) => startMossproutJourneyActivity(current, journey.dayId));
      openConversationMerge(orderId, 'mossprout');
      return;
    }
    showStoryHome();
  }, [conversationExperience?.session, conversationFamilyId, openConversationMerge, showStoryHome]);
  const completedConversationDefinitionId = conversationExperience?.definition.id;
  const completedConversationSessionId = conversationExperience?.session.id;
  const completedConversationStatus = conversationExperience?.session.status;
  const exitCompletedConversation = useCallback(() => {
    // Completion is an explicit route boundary, not another conversation
    // action. Clear retained launch bookkeeping and return straight to the
    // companion dashboard even when this route was restored from Merge.
    pendingStoryConversationRef.current = null;
    openedStoryConversationRef.current = null;
    if (completedConversationDefinitionId && completedConversationStatus === 'completed' && completedConversationSessionId) {
      if (completedConversationExitRef.current === completedConversationSessionId) return;
      completedConversationExitRef.current = completedConversationSessionId;
      void Promise.resolve(onCompletedConversationExit?.(completedConversationDefinitionId) ?? false)
        .then((handled) => handled || completedConversationDefinitionId !== 'mossprout:game:form-finder'
          ? undefined
          : conversationExperience?.session ? onInitialConversationComplete?.(conversationExperience.session) : undefined)
        .then(showStoryHome, (error) => {
          completedConversationExitRef.current = null;
          console.warn('Could not finish the completed conversation exit', error);
        });
      return;
    }
    showStoryHome();
  }, [completedConversationDefinitionId, completedConversationSessionId, completedConversationStatus, conversationExperience?.session, onCompletedConversationExit, onInitialConversationComplete, showStoryHome]);
  const conversationFlow = useCompanionConversationFlow({
    manualDialogue: true,
    definition: conversationExperience?.definition ?? null,
    onCommitInsight: commitConversationInsight,
    onCommitMemory: commitConversationMemory,
    onComplete: completeConversation,
    onContinue: props.onContinueConversation,
    onDismissOutcome: dismissConversationOutcome,
    outcomeRequiresManualAdvance: props.familyId === 'mossprout',
    reduceMotion,
    session: conversationExperience?.session ?? null,
    // FTUE keeps its directed handoff. Ordinary Journey Days wait on the
    // visible mission card and let the player decide when to enter the Garden.
    skipCompletedTransition: props.familyId === 'mossprout' && Boolean(props.ftueNavigationLocked),
  });
  const visitStageSpeech = conversationExperience
    ? conversationSpeechLine(conversationExperience.session, conversationExperience.definition)
    : homeGreeting;
  // Mossprout's nature direction: three questions, then small ideas to keep.
  const openJourneyFocus = (actionOrigin?: KatchimeraActionOrigin) => {
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    // Always pass the origin. If a questionnaire session already exists, the
    // domain attaches it to that durable session instead of losing ownership.
    props.onStartJourneyConversation(actionOrigin);
    experience.openFocusQuestionnaire(props.journeyConversation?.id);
  };
  const destinationHeroTitle = destination === 'achievements'
    ? 'Look what we’ve achieved together!'
    : 'Which form feels like me?';

  const ftueProfile = loadOnboardingProfile().mossproutAnswers;
  const ftueGreeting = MOSSPROUT_GREETING_OPTIONS.find((option) => option.id === ftueProfile.firstGreetingId)?.reply;
  const mossproutFtueSpeechTitle = props.familyId === 'mossprout'
    ? props.ftueProfileStep === 'intro_action'
      ? 'Let’s get to know each other.'
      : props.ftueProfileStep === 'nickname'
      ? 'What should I call you?'
      : props.ftueProfileStep === 'bond'
        ? `Nice to meet you, ${loadOnboardingProfile().playerNickname || 'friend'}! We are friends now.`
        : props.ftueProfileStep === 'bond_choice'
          ? MOSSPROUT_SUPPORT_STYLE_OPTIONS.find((option) => option.id === loadOnboardingProfile().mossproutAnswers.supportStyleId)?.reply
            ?? (ftueBondShare ? 'What kind of help do you usually want when something feels stuck?' : null)
            ?? ftueBondShare?.answer.reply
            ?? ftueBondShare?.prompt.reply
            ?? ftueBondQuestion?.prompt
            ?? MOSSPROUT_BOND_SHARE_PROMPTS[0].prompt
        : props.ftueProfileStep === 'garden_intro'
          ? [ftueGreeting, mossproutSeedIntroduction(ftueProfile.growthIntentId)].filter(Boolean).join('\n\n')
          : props.ftueProfileStep === 'water_together'
            ? MOSSPROUT_FTUE_COPY.waterQuestion
          : props.ftueProfileStep === 'water_response'
            ? ftueDialoguePages(MOSSPROUT_FTUE_COPY.farewell)[0]
          : props.ftueProfileStep === 'first_insight'
            ? `${mossproutFirstSeedForIntent(loadOnboardingProfile().mossproutAnswers.growthIntentId).message} Did I get that right?`
          : props.ftueProfileStep === 'resident_result'
            ? `I think ${katchimeraSkinById.get(loadOnboardingProfile().matchedResidentId as KatchimeraSkinId)?.displayName ?? 'this resident'} is your closest match right now.`
          : props.ftueOrderPreviewActive
            ? 'Let\'s make this little corner welcoming again.'
            : null
    : null;
  // Meditation is the creature's persistent visual state, not a navigation
  // lock. Once an action opens a conversation, its prompt must reclaim the
  // speech bubble while the meditating artwork remains in the world.
  const meditationDashboardActive = Boolean((!props.ftueCompanionSurfaceOwned || props.ftueProfileStep === 'meditating') && !quickGoalPickerOpen && !unifiedJourneyActive && meditation && route.kind !== 'conversation');
  const companionSpeechTitle = dashboardRouteActive && actionNarration ? actionNarration : dashboardRouteActive && !quickGoalPickerOpen && unifiedJourneyActive && journeyNarration ? journeyNarration : meditationDashboardActive ? MOSSPROUT_FTUE_COPY.meditation : mossproutFtueSpeechTitle;
  // FTUE handoffs have no default greeting. Only fresh stage narration or
  // the explicit meditation state can bring speech back after an overlay.
  const ftueHasIntentionalSpeech = !props.ftueCompanionSurfaceOwned && !props.ftueProfileStep
    || meditationDashboardActive
    || Boolean(dashboardRouteActive && (actionNarration || (!quickGoalPickerOpen && unifiedJourneyActive && journeyNarration)))
    || ['intro_action', 'nickname', 'bond', 'first_insight', 'resident_result'].includes(props.ftueProfileStep ?? '');
  const ftueActionDockVisible = !props.hostedNarrativeOnly && dashboardRouteActive && props.familyId === 'mossprout'
    && Boolean(props.ftueProfileStep && props.onFtueProfileContinue)
    && !meditation && !quickGoalPickerOpen && !questionnaireExperience;
  // The cinematic creature is positioned in full-screen coordinates, while
  // this overlay lives inside the surface below the safe-area page header.
  // Convert the desired screen-space position into that local coordinate so
  // restoring the Bond/back header cannot push the timer beneath the cards.
  const meditationTimerScreenTop = Math.max(390, Math.min(510, viewportHeight * 0.58));
  const meditationTimerSurfaceTop = Math.max(
    0,
    meditationTimerScreenTop - (insets.top + 58 + KatchaUI.spacing.xs),
  );
  const mossproutStage = (extra: { meditationMode?: boolean; visibleActionCount?: 2 | 3; ftueStage?: boolean }) => (
    <MossproutStoryStage
      onActionNarration={setActionNarration}
      onSubmenuChange={setActionSubmenuOpen}
      onAddTask={() => experience.openQuickGoalPicker()}
      onVisitSeed={props.onClose}
      {...(extra.visibleActionCount ? { visibleActionCount: extra.visibleActionCount } : {})}
      conversationSession={props.conversationSession}
      conversations={props.mossproutActionCandidates}
      goals={goalsToday}
      hasActiveFocus={Boolean(activeJourneyFocus)}
      {...(extra.meditationMode ? { meditationMode: true } : {})}
      relationships={relationships}
      onCompleteGoal={props.onCompleteQuickGoal}
      onRememberGoal={props.onRememberQuickGoal}
      onSkipGoal={props.onSkipQuickGoal}
      onSnoozeGoal={props.onSnoozeQuickGoal}
      onUndoGoal={props.onUndoQuickGoal}
      onOpenConversation={(definitionId, actionOrigin) => {
        pendingStoryConversationRef.current = null;
        openedStoryConversationRef.current = null;
        requestStoryConversation(definitionId, actionOrigin);
      }}
      onOpenCards={() => selectDestination('skins')}
      onOpenFocusDirection={openJourneyFocus}
      onOpenMerge={(orderId) => {
        if (extra.meditationMode && props.ftueProfileStep === 'meditating') props.onFtueProfileContinue?.();
        else props.onOpenMerge?.(orderId, props.familyId);
      }}
      onOpenTrophies={() => selectDestination('achievements')}
      onBondRewardRequest={requestStoryReward}
      navigationLocked={props.ftueNavigationLocked}
      swipeExternalGesture={environmentPan.gesture}
      {...(extra.ftueStage ? {
        actionStackTargetRef: ftueActionTargetRef,
        dayOneActionChoiceActive: props.ftueBondSpotlightActive || props.ftueDayOneActionActive,
        tutorialInteractionLocked: props.ftueBondSpotlightActive,
        residentParcelHandoffActive: residentParcelGardenPanelActive,
        residentStoryResumeActive: props.ftueResidentStoryResume,
        residentStoryResumeTitle: 'Continue story',
        onResumeResidentStory: props.onFtueOpenResidentParcel,
      } : {})}
    />
  );

  return (
    <ExplorationEnvironmentProgressionProvider stage={props.homeEnvironmentStage ?? null}>
      <>
        <CompanionSheetShell
          background={props.reuseUnderlyingStage ? undefined : props.questionnaireBackground}
          entranceMotion={props.reuseUnderlyingStage ? 'fade' : 'sheet'}
          fullBleed
          keyboardAvoiding
          onRequestClose={requestClose}
          portal={!props.embedded}
          showClose={false}
          surface="parchment"
          transparent={Boolean(props.reuseUnderlyingStage)}>
        <CompanionEnvironmentGestureContext.Provider value={environmentPan.gesture}>
        <GestureDetector gesture={environmentPan.gesture}>
        <View style={styles.environmentPanFrame}>
        {!questionnaireExperience && !props.hostedNarrativeOnly ? (
          <CompanionCinematicStage
            bubbleBody={companionSpeechTitle
              ? undefined
              : residentStoryResumeDashboard
                ? undefined
                : quickGoalPickerOpen ? 'Choose one for today, or make a small goal of your own.' : undefined}
            bubbleVariant={quickGoalPickerOpen && !companionSpeechTitle ? 'questionnaire' : 'default'}
            celebrate={Boolean(!residentStoryResumeDashboard && route.kind === 'conversation' && conversationExperience?.session.outcomePresentation?.celebrate)}
            creature={visual.source}
            environmentKey={props.homeEnvironmentKey ?? null}
            houseLevel={props.houseLevel}
            lifted
            meditating={Boolean(meditation)}
            name={props.name}
            onBackgroundReady={() => setTransitionBackgroundReady(true)}
            onBackdropPress={props.reuseUnderlyingStage && dashboardRouteActive ? requestClose : undefined}
            onCreatureReady={() => setTransitionCreatureReady(true)}
            rewardPulseKey={rewardPulseKey}
            sceneTranslateX={props.reuseUnderlyingStage ? undefined : environmentPan.translateX}
            onSpeechBubblePress={(!meditation || route.kind === 'conversation') && !residentStoryResumeDashboard && conversationExperience
              && !conversationFlow.requiresManualAdvance
              && conversationFlow.phase !== 'awaiting_choice'
              && conversationFlow.phase !== 'committing'
              ? conversationFlow.advance
              : undefined}
            showSpeechBubble={!props.suppressWorldSpeech && ftueHasIntentionalSpeech && !narrativeOverlayVisible
              && props.ftueProfileStep !== 'garden_intro'
              && !(conversationExperience?.definition.id.startsWith('mossprout:ftue:first-meeting:') && conversationExperience.session.status === 'completed' && route.kind === 'conversation')
              && props.ftueProfileStep !== 'bond_choice' && props.ftueProfileStep !== 'notice_bond' && !initialConversationHandoffPending && (Boolean(companionSpeechTitle) || !residentParcelGardenPanelActive)}
            showNameplate={route.kind === 'dashboard' && props.familyId !== 'mossprout'}
            stagePresentation={props.reuseUnderlyingStage && !props.renderRegularStage ? 'speech-only' : 'full'}
            title={companionSpeechTitle ?? (residentStoryResumeDashboard
              ? 'What should we do together?'
              : quickGoalPickerOpen
              ? 'Which small step feels right?'
              : route.kind === 'conversation'
                ? visitStageSpeech
                : route.kind === 'dashboard'
                  ? 'What should we do together?'
                  : destinationHeroTitle)}
            visualKey={props.visualKey}
          />
        ) : null}
        {props.hostedNarrativeOnly && (!conversationExperience || route.kind !== 'conversation')
          ? null
          : initialConversationHandoffPending ? null : route.kind === 'conversation' && !residentFtueDashboard ? (
          conversationExperience && props.active !== false ? <CompanionConversationScene
            bondIconTargetRef={bondRewardTargetRef}
            bondProgress={displayedBondProgress}
            bondRewardPulseKey={rewardPulseKey}
            definition={conversationExperience.definition}
            hasActiveFocus={Boolean(activeJourneyFocus)}
            journalMergeEnergyPreview={journalMergeEnergyPreview}
            journeyTaskHandoff={mossproutCampaignEpisodeByOpeningId.has(conversationExperience.definition.id)}
            journeyTaskRequests={journeyTaskRequests}
            journeyTaskTitle={journeyOpeningEpisode?.title}
            navigationLocked={props.ftueNavigationLocked}
            name={props.name}
            flowPhase={conversationFlow.phase}
            onAdvance={conversationFlow.advance}
            onAnswer={(optionId) => {
              if (conversationExperience?.definition.id.startsWith('mossprout:ftue:first-meeting:')) {
                recordMossproutOnboardingAnswer(optionId.startsWith('life:') ? 'companion.life_followup' : 'companion.greeting', optionId);
              }
              if (conversationExperience?.definition.id.includes('quiet-patch:pond-knock') && optionId.startsWith('support-')) {
                const support = optionId.slice('support-'.length);
                recordMossproutOnboardingAnswer('companion.choose_support_style', support === 'tiny' ? 'tiny_step' : support);
              }
              props.onAnswerConversation(optionId);
            }}
            onClose={experience.showHome}
            onCompletedExit={exitCompletedConversation}
            onContinue={props.onContinueConversation}
            onEquipForm={conversationExperience.session.preview ? () => undefined : props.onEquipSkin}
            onGoalDecision={props.onGoalConversationDecision}
            onInsightDecision={(accept, node) => {
              props.onInsightConversationDecision(accept, node);
            }}
            onKeepTalking={props.onKeepTalkingConversation}
            onDismissOutcome={dismissConversationOutcome}
            onOpenOutcomeDestination={(outcomeDestination) => {
              props.onDismissConversationOutcome();
              if (outcomeDestination === 'goals' && authoredStoryFlow) {
                props.onOpenTodayGoals();
                return;
              }
              // The outcome's old side pages are gone: every outcome returns to the stage.
              experience.showHome();
            }}
            onQuickGoalDecision={props.onQuickGoalConversationDecision}
            onJournalHandoff={props.onJournalConversationHandoff}
            onMemoryDecision={(remember, summary) => {
              props.onMemoryConversationDecision(remember, summary);
            }}
            memories={props.memories}
            onStoryComplete={experience.showHome}
            onUpdateMemory={props.onUpdateMemory}
            session={conversationExperience.session}
            skins={props.skins}
            storyFlow={authoredStoryFlow}
            storyFinale={authoredStoryFinale}
            requiresManualAdvance={conversationFlow.requiresManualAdvance}
          /> : <View accessibilityLiveRegion="polite" style={styles.conversationRecovery}>
            <ActivityIndicator color="#75450A" size="small" />
            <ThemedText selectable style={styles.conversationRecoveryTitle} lightColor="#3B2C20" darkColor="#3B2C20">{props.name} is finding the next page…</ThemedText>
            <ThemedText selectable style={styles.conversationRecoveryBody} lightColor="#64513B" darkColor="#64513B">Your served order is safe. If the story does not appear, try opening this part again.</ThemedText>
            <CompanionPrimaryAction
              icon="arrow.clockwise"
              label="Open the story again"
              onPress={() => {
                const definitionId = isAuthoredCohortFamily(props.familyId)
                  ? loadAuthoredCohortStory(props.familyId).pendingConversationId
                  : null;
                if (!definitionId) { experience.showHome(); return; }
                pendingStoryConversationRef.current = null;
                openedStoryConversationRef.current = null;
                requestStoryConversation(definitionId);
              }}
            />
            <CompanionSecondaryAction icon="chevron.left" label={`Back to ${props.name}`} onPress={experience.showHome} />
          </View>
        ) : (
          <>
        {(route.kind === 'destination' || dashboardRouteActive || quickGoalPickerOpen) && !questionnaireExperience ? (
          <CompanionDestinationHeader
            backLabel={quickGoalPickerOpen ? 'Back' : dashboardRouteActive ? 'Kingdom' : 'Dashboard'}
            bondIconTargetRef={bondRewardTargetRef}
            bondProgress={displayedBondProgress}
            bondRewardPulseKey={rewardPulseKey}
            bondTargetRef={dashboardRouteActive && props.familyId === 'mossprout' ? ftueBondTargetRef : undefined}
            compactHub={dashboardRouteActive}
            hideTitle={dashboardRouteActive}
            hideBack={props.familyId === 'mossprout' && (props.ftueProfileStep === 'first_grow' || props.ftueProfileStep === 'notice_bond' || props.ftueProfileStep === 'water_together')}
            navigationLocked={props.ftueNavigationLocked}
            label={dashboardRouteActive ? 'Dashboard' : destinationLabel}
            titleTone={destination === 'achievements' ? 'gold' : 'default'}
            onBack={quickGoalPickerOpen
              ? experience.showHome
              : dashboardRouteActive
                ? requestClose
                : experience.showHome}
          />
        ) : null}
        <CompanionDestinationSurface
          fullWidth={dashboardRouteActive}
          immersive={questionnaireExperience}>
        <View key="interaction-content" style={styles.contentFrame}>
          {dashboardRouteActive && !quickGoalPickerOpen && unifiedJourneyActive ? (
            <View style={[styles.meditationActionsOverlay, {
              bottom: Math.max(8, insets.bottom + 4),
              left: Math.max(KatchaUI.layout.phoneGutter, insets.left),
              right: Math.max(KatchaUI.layout.phoneGutter, insets.right),
            }]}>
                <CompanionJourneyCycleStage
                  cardsActive={props.active !== false && route.kind !== 'conversation'}
                  routineSubmenuOpen={actionSubmenuOpen}
                  onOpenConversation={requestStoryConversation}
                  onBondRewardRequest={requestStoryReward}
                  externalGesture={environmentPan.gesture}
                  familyId={props.familyId}
                  onNarration={setJourneyNarration}
                  onVisitSeed={props.onClose}
                  fallback={props.familyId === 'mossprout' ? mossproutStage({}) : undefined}
                  routineActions={mossproutStage({ meditationMode: true, visibleActionCount: meditation ? 2 : 3 })}
                  onOpenMerge={(orderId) => props.onOpenMerge?.(orderId, props.familyId)}
                  onMore={() => selectDestination('achievements')}
                  onJournal={props.onJournalFood}
                  onGoal={() => experience.openQuickGoalPicker()}
                />
            </View>
          ) : null}

          {meditationDashboardActive && meditation ? (
            <>
              {props.ftueProfileStep !== 'meditating' ? <View
                pointerEvents="box-none"
                style={[
                  styles.meditationWorldTimer,
                  {
                    left: KatchaUI.layout.phoneGutter + 4,
                    right: KatchaUI.layout.phoneGutter + 4,
                    top: meditationTimerSurfaceTop,
                  },
                ]}>
                <CompanionMeditationStage
                  onPress={() => setActionNarration(journeyForeshadowLine(props.familyId))}
                  availableAt={meditation.availableAt}
                  companionName={props.name}
                  now={meditationNow}
                  settledMs={meditation.settledMs}
                  startedAt={meditation.startedAt}
                />
              </View> : null}
              <View
                style={[
                  styles.meditationActionsOverlay,
                  {
                    bottom: Math.max(8, insets.bottom + 4),
                    left: KatchaUI.layout.phoneGutter + 4,
                    right: KatchaUI.layout.phoneGutter + 4,
                  },
                ]}>
                {props.ftueProfileStep === 'meditating' ? <CompanionFirstRestCards
                  availableAt={meditation.availableAt} startedAt={meditation.startedAt} settledMs={meditation.settledMs} now={meditationNow}
                  onExplore={() => props.onFtueProfileContinue?.()}
                /> : mossproutStage({ meditationMode: true })}
              </View>
            </>
          ) : null}
          <ScrollView
            collapsable={false}
            ref={contentRef}
            automaticallyAdjustContentInsets={false}
            automaticallyAdjustKeyboardInsets={false}
            bounces={!mossproutActionDashboard || Boolean(meditation)}
            contentContainerStyle={[
              styles.scrollContent,
              dashboardRouteActive && styles.dashboardScrollContent,
              mossproutActionDashboard && styles.mossproutActionScrollContent,
              meditation && styles.meditationScrollContent,
              dashboardRouteActive && { paddingBottom: Math.max(12, insets.bottom + 8) },
              questionnaireExperience && [
                styles.questionnaireScrollContent,
              ],
            ]}
            contentInsetAdjustmentBehavior="never"
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={route.kind === 'dashboard' && !mossproutActionDashboard ? resetViewport : undefined}
            onLayout={route.kind === 'dashboard' && !mossproutActionDashboard ? resetViewport : undefined}
            overScrollMode={mossproutActionDashboard && !meditation ? 'never' : 'auto'}
            scrollEnabled={!(dashboardRouteActive && unifiedJourneyActive) && !questionnaireExperience && !meditationDashboardActive && (!mossproutActionDashboard || Boolean(meditation))}
            style={mossproutActionDashboard ? styles.mossproutActionViewport : undefined}
            showsVerticalScrollIndicator={false}>
            <Animated.View
              key={destination ?? route.kind}
              collapsable={false}
              entering={destinationMotion.entering}
              exiting={destinationMotion.exiting}
              style={[
                questionnaireExperience ? styles.activeExperience : undefined,
                dashboardRouteActive && styles.dashboardExperience,
                mossproutActionDashboard && styles.mossproutActionExperience,
                meditation && styles.meditationExperience,
              ]}>
              {(route.kind === 'destination' || dashboardRouteActive || quickGoalPickerOpen) && !questionnaireExperience ? (
                <View
                  accessibilityElementsHidden
                  pointerEvents="none"
                  style={[
                    styles.destinationStageSpacer,
                    dashboardRouteActive && {
                      minHeight: companionHubHeroSpacer(viewportHeight),
                    },
                    dashboardRouteActive && styles.dashboardStageSpacer,
                    mossproutActionDashboard && styles.mossproutActionStageSpacer,
                  ]}
                />
              ) : null}
              {dashboardRouteActive && !props.ftueCompanionSurfaceOwned ? props.worldEventAction : null}
              {questionnaireExperience && props.journeyDefinition ? (
                <CompanionJourneyQuestionnairePage
                  accentColor={props.accentColor}
                  background={props.questionnaireBackground}
                  bondIconTargetRef={bondRewardTargetRef}
                  bondProgress={displayedBondProgress}
                  bondRewardPulseKey={rewardPulseKey}
                  companionName={props.name}
                  conversation={props.journeyConversation}
                  creature={visual.source}
                  definition={props.journeyDefinition}
                  environmentKey={props.homeEnvironmentKey ?? null}
                  goals={props.journeyGoals}
                  node={props.journeyNode}
                  onAddTasks={props.onAddQuickGoalSuggestions}
                  onAnswer={props.onAnswerJourneyConversation}
                  onBack={requestClose}
                  onDone={() => {
                    props.onCompleteJourneyQuestionnaire(journeyQuestionnaireSessionId);
                    experience.showHome();
                  }}
                  onDismissTasks={props.onDismissQuickGoalSuggestions}
                  presentation="conversation"
                  quickGoalSuggestionIds={props.quickGoalSuggestionIds}
                  resultReady={Boolean(journeyQuestionnaireSessionId && !props.journeyConversation)}
                  visualKey={props.visualKey}
                />
              ) : quickGoalPickerOpen ? (
                <CompanionQuickGoalPicker
                  dayId={props.quickGoalDayId}
                  familyId={props.familyId}
                  onAddCustom={props.onAddCustomQuickGoal}
                  onAddTemplate={props.onAddQuickGoalTemplate}
                  state={props.quickGoalState}
                />
              ) : dashboardRouteActive && unifiedJourneyActive ? (
                null
              ) : meditation ? null : dashboardRouteActive && props.familyId === 'mossprout' && props.ftueProfileStep && props.onFtueProfileContinue ? (
                null
              ) : dashboardRouteActive && props.familyId === 'mossprout' && props.ftueOrderPreviewActive && props.onFtueOpenMerge ? (
                <MossproutFtueStoryStage onOpenMerge={props.onFtueOpenMerge} />
              ) : dashboardRouteActive
                && props.familyId === 'mossprout'
                && (!props.ftueCompanionSurfaceOwned || residentFtueDashboard) ? (
                mossproutStage({ ftueStage: true })
              ) : destination === 'achievements' ? (
                <Suspense fallback={<View accessibilityLabel="Loading achievements" accessibilityLiveRegion="polite" style={styles.deepLoading}><ActivityIndicator color={KatchaUI.companionPanel.ink} size="small" /></View>}>
                  <LazyCompanionTrophyRoomScreen creatureId={props.creatureId} embedded />
                </Suspense>
              ) : destination === 'skins' ? (
                  <CompanionSkinsThread
                    companionName={props.name}
                    familyId={props.familyId}
                    showHeading={false}
                  />
              ) : null}
            </Animated.View>
          </ScrollView>
        </View>
        </CompanionDestinationSurface>
        </>
        )}
        {ftueActionDockVisible ? <View collapsable={false} style={[
          styles.ftueActionDock,
          { bottom: Math.max(12, insets.bottom + 8) },
        ]}>
          <MossproutFtueStoryStage
            actionStackTargetRef={ftueActionTargetRef}
            activeBondQuestionId={ftueBondQuestionId}
            mode={props.ftueProfileStep ?? undefined}
            nickname={loadOnboardingProfile().playerNickname}
            onNarration={setActionNarration}
            onBondQuestionChange={setFtueBondQuestionId}
            onBondRewardRequest={requestStoryReward}
            onContinue={props.ftueProfileStep === 'garden_intro' ? props.onFtueOpenMerge : props.onFtueProfileContinue}
            pendingBondCelebration={props.pendingBondCelebration}
            gardenStoryActionIcon={ftueGardenStoryBeat.icon}
            gardenStoryActionLabel={ftueGardenStoryBeat.actionLabel}
          />
        </View> : null}
        {props.active !== false && !props.hostedNarrativeOnly && bondReward ? (
          <BondRewardFlightOverlay
            from={bondReward.from}
            onFinish={() => {
              if (rewardFinishTimerRef.current) clearTimeout(rewardFinishTimerRef.current);
              setDisplayedBondTotal(bondReward.receipt.afterTotal);
              pendingStoryRewardArrivalRef.current?.();
              pendingStoryRewardArrivalRef.current = null;
              rewardFinishTimerRef.current = setTimeout(() => {
                onBondCelebrationComplete(bondReward.receipt);
                setBondReward(null);
                setStoryRewardReceipt(null);
                rewardFinishTimerRef.current = null;
              // The completed row needs 475ms to leave and its replacement
              // needs another 320ms to enter. Do not cover that handoff with
              // the Journey celebration before the tray has visibly settled.
              }, reduceMotion ? 120 : 900);
            }}
            onTokenArrive={(amount) => {
              setDisplayedBondTotal((total) => Math.min(
                bondReward.receipt.afterTotal,
                (total ?? bondReward.receipt.beforeTotal) + amount
              ));
              setRewardPulseKey((key) => key + 1);
              props.onVisibleCreatureRewardPulse?.();
            }}
            points={bondReward.receipt.points}
            to={bondReward.to}
          />
        ) : null}
        {props.active !== false && !props.hostedNarrativeOnly && mossproutActionDashboard && props.ftueBondSpotlightActive ? (
          <CompanionFtueCoachmark
            buttonLabel={props.ftueProfileStep === 'notice_bond' ? 'Continue' : 'Try a Bond action'}
            message={props.ftueProfileStep === 'notice_bond' ? [
              { text: 'That little moment grew your ' },
              { emphasis: true, text: 'Bond.' },
              { text: ' Sharing everyday moments brings you and Mossprout closer.' },
            ] : [
              { text: 'This is your ' },
              { emphasis: true, text: 'Bond.' },
              { text: ' It grows when you share things and spend time with Mossprout.' },
            ]}
            onContinue={props.onFtueBondSpotlightComplete}
            placement="below"
            targetRef={ftueBondTargetRef}
          />
        ) : null}
        {props.active !== false && !props.hostedNarrativeOnly && mossproutActionDashboard && props.ftueDayOneActionActive && !ftueBondQuestionId && !props.ftueDayOneActionAnswerId && !ftueDayOneLessonCompleted ? (
          <CompanionFtueCoachmark
            message={[
              { text: 'Pick ' },
              { emphasis: true, text: 'one card' },
              { text: ' to share something about you. One is enough.' },
            ]}
            placement="above"
            showFinger={false}
            targetRef={ftueActionTargetRef}
          />
        ) : null}
        </View>
        </GestureDetector>
        </CompanionEnvironmentGestureContext.Provider>
        </CompanionSheetShell>
      </>
    </ExplorationEnvironmentProgressionProvider>
  );
}

const styles = StyleSheet.create({
  environmentPanFrame: { flex: 1, minHeight: 0 },
  contentFrame: { flex: 1, minHeight: 0 },
  ftueActionDock: { position: 'absolute', left: KatchaUI.layout.phoneGutter + 4, right: KatchaUI.layout.phoneGutter + 4, zIndex: 25 },
  destinationStageSpacer: { minHeight: 244 },
  scrollContent: { paddingBottom: 12, paddingHorizontal: 4 },
  // The dashboard owns card gutters for every family; the outer surface adds none.
  dashboardScrollContent: { flexGrow: 1, paddingHorizontal: KatchaUI.layout.phoneGutter + 4 },
  mossproutActionScrollContent: { overflow: 'hidden' },
  meditationScrollContent: { overflow: 'visible', paddingBottom: 28 },
  meditationActionsOverlay: { position: 'absolute', zIndex: 25 },
  meditationWorldTimer: { position: 'absolute', zIndex: 24 },
  mossproutActionExperience: { flex: 1, minHeight: 0 },
  meditationExperience: { flex: 0, minHeight: undefined },
  mossproutActionStageSpacer: { flex: 1, minHeight: 0 },
  mossproutActionViewport: { flex: 1 },
  dashboardExperience: { flexGrow: 1 },
  dashboardStageSpacer: { flexGrow: 1 },
  questionnaireScrollContent: { flexGrow: 1, paddingHorizontal: 0 },
  activeExperience: { flex: 1 },
  deepLoading: { alignItems: 'center', minHeight: 220, justifyContent: 'center' },
  conversationRecovery: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,249,224,0.94)',
    borderColor: 'rgba(139,96,29,0.24)',
    borderCurve: 'continuous',
    borderRadius: 24,
    borderWidth: 1,
    boxShadow: '0 10px 28px rgba(92,57,24,0.16)',
    gap: 10,
    maxWidth: 360,
    padding: 18,
    width: '92%',
  },
  conversationRecoveryTitle: { fontSize: 18, fontWeight: '900', lineHeight: 23, textAlign: 'center' },
  conversationRecoveryBody: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
