import * as Haptics from 'expo-haptics';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Keyboard,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type View as ViewType,
} from 'react-native';
import Animated, { FadeIn, FadeInLeft, FadeInRight, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KatchaDialog } from '@/components/katchadeck/ui/katcha-dialog';
import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';
import { KatchaUI } from '@/constants/katcha-ui';
import { useCompanionExperienceController } from '@/features/companion/use-companion-experience-controller';
import type { HomeVisualKey, MemoryQualityScore } from '@/types/home';
import type {
  CompanionDestination,
  CompanionInsight,
  CompanionQuestOfferViewModel,
  CompanionReflectionDraft,
  CompanionVisitPlan,
  CompanionVisitResponse,
  CompanionConversationReceipt,
  QuestCaptureFeedback,
} from '@/types/companion-interaction';
import { getCreatureVisual } from '@/game/days';
import type { QuestSubmissionItem } from '@/utils/quests/report-back-evidence';
import type { QuestRuntimeStatus } from '@/utils/quests/runtime';
import type { QuestJournalCaptureMode } from '@/utils/quests/journal-templates';
import {
  buildCompanionQuestViewModel,
  companionQuestInlineNoteAction,
  companionQuestInlinePhotoAction,
  companionQuestPresentation,
  companionViewportResetKey,
} from '@/utils/companion-interaction';
import { CompanionCinematicStage } from './companion-cinematic-stage';
import { CompanionGameBackdrop } from './companion-game-backdrop';
import { CompanionInsightThread } from './companion-insight-thread';
import { CompanionPrimaryAction, CompanionSecondaryAction } from './companion-interaction-primitives';
import {
  CompanionBackAction,
  CompanionDestinationHeader,
  CompanionDestinationSurface,
  CompanionSection,
  CompanionSheetShell,
} from './companion-ui-primitives';
import { CompanionQuestChoices, CompanionQuestThread } from './companion-quest-thread';
import type { InteractiveQuestExecution, QuestResult } from '@/utils/quests/experiences/types';
import { companionBondProgressForTotal, type CompanionBondAwardReceipt, type CompanionBondProgress } from '@/utils/companion-bond';
import type {
  CompanionIntroductionAnswer,
  CompanionIntroductionRecord,
  CompanionVisitGreeting,
  CompanionMemory,
  CompanionInsightRecord,
} from '@/utils/companion-content';
import type {
  CompanionIntroductionDefinition,
  CompanionSupportStyle,
} from '@/constants/companion-introductions';
import { companionFormGreeting } from '@/utils/companion-dialogue';
import { CompanionSkinsThread } from './companion-skins-thread';
import type { KatchimeraFamilyId, KatchimeraSkinId } from '@/types/katchimera';
import type { ConversationDefinition, ConversationMode, ConversationNode, ConversationOutcomeDestination, ConversationSession, ConversationSignalKind } from '@/types/companion-conversation';
import type { KingdomSkinOption } from '@/utils/katchimera-wardrobe';
import { CompanionDiscoveryThread } from './companion-discovery-thread';
import {
  CompanionJourneyDiscoveryThread,
  CompanionJourneyQuestionnairePage,
} from './companion-journey-thread';
import type {
  CompanionDiscoveryPromptDefinition,
  KatchimeraRoleDefinition,
} from '@/constants/katchimera-roles';
import type { CompanionDiscoveryAnswer } from '@/utils/companion-discovery';
import type {
  CompanionJourneyConversationNode,
  CompanionJourneyDefinition,
  CompanionJourneyGoalStatus,
} from '@/constants/companion-journeys';
import type {
  CompanionGoalJourneyProgress,
  CompanionJourneyCheckIn,
  CompanionJourneyCheckInAnswer,
  CompanionJourneyConversationSession,
  CompanionJourneyGoal,
} from '@/utils/companion-journey';
import {
  CompanionQuickGoalPicker,
  CompanionQuickGoalsPanel,
} from '@/components/katchadeck/goals/companion-quick-goals';
import type {
  CompanionQuickGoal,
  CompanionQuickGoalCadence,
  CompanionQuickGoalCompletion,
  CompanionQuickGoalState,
} from '@/utils/companion-quick-goals';
import { quickGoalsForDay } from '@/utils/companion-quick-goals';
import { CompanionCheckInCard, CompanionCheckInPage } from './companion-check-in';
import type { TodayAtmosphereBackground } from '@/utils/day-background-scene';
import type { TodayExplorationBackgroundKey } from '@/utils/today-exploration-backgrounds';
import { companionQuestListSpacer } from '@/utils/companion-home-layout';
import type { CompanionQuickGoalCompletionReceipt } from '@/hooks/use-companion-quick-goals';
import type { GoalTaskSourceRect } from '@/components/katchadeck/goals/goal-task-row';
import { BondRewardFlightOverlay } from '@/components/katchadeck/goals/bond-reward-overlay';
import { CompanionIntroduction } from './companion-introduction';
import { CompanionTrophyRoomScreen } from './companion-trophy-room-screen';
import { CompanionVisitScene } from './companion-visit-scene';
import { CompanionDashboard } from './companion-dashboard';
import { FeastleStoryStage } from './feastle-story-stage';
import { beginFeastleStory, loadFeastleStory } from '@/utils/companion-story-storage';
import { CompanionSharedHistory } from './companion-shared-history';
import { completedVisitCopy } from '@/utils/companion-visit';
import { CompanionConversationScene, conversationSpeechLine } from './companion-conversation-scene';
import { CompanionChatLobby, type CompanionChatStarter } from './companion-chat-lobby';
import { isConversationV2Family } from '@/types/companion-conversation';
import { FEASTLE_FIRST_MEETING_DEFINITION_ID } from '@/constants/feastle-friendship-conversations';

const LazyQuestExperienceHost = lazy(async () => {
  const module = await import('./quests/quest-experience-host');
  return { default: module.QuestExperienceHost };
});

type Criterion = {
  label: string;
  done: boolean;
  reason?: string | null;
  progressRatio?: number | null;
  progressLabel?: string | null;
};

export type CompanionInteractionSheetProps = {
  active?: boolean;
  creatureId: string;
  name: string;
  visualKey: HomeVisualKey;
  accentColor: string;
  questionnaireBackground: TodayAtmosphereBackground;
  homeEnvironmentKey?: TodayExplorationBackgroundKey | null;
  houseLevel?: number;
  initialDestination?: CompanionDestination | null;
  onSelectDestination?: (destination: CompanionDestination | null) => void;
  onClose: () => void;
  onOpenMerge?: (orderId?: string | null) => void;
  onJournalFood: () => void;
  onOpenTodayGoals: () => void;
  embedded?: boolean;
  activeQuest: { questId: string; title: string; hint: string; semanticInput?: boolean; journalInput?: boolean; journalFallback?: boolean; assistedJournalInput?: boolean; execution?: InteractiveQuestExecution | null; resolvedConfig?: Record<string, unknown>; offerSeed?: string } | null;
  questComplete: boolean;
  questRuntime: QuestRuntimeStatus | null;
  questCaptureFeedback: QuestCaptureFeedback | null;
  submissionItems: QuestSubmissionItem[];
  offers: CompanionQuestOfferViewModel[];
  selectedOfferId: string | null;
  onSelectOffer: (offerId: string) => void;
  criteria: Criterion[];
  onAccept: (offerId?: string) => void;
  onCashIn: () => void;
  onChooseAnotherQuest: () => void;
  onSubmitQuest: (item: QuestSubmissionItem) => void;
  onClarifyQuestMatch: (item: QuestSubmissionItem, answer: MemoryQualityScore['centrality'] | 'rejected') => void;
  onQuestAction: (mode?: QuestJournalCaptureMode) => void;
  recentTriviaQuestionIds?: string[];
  recentWordPuzzleIds?: string[];
  recentWordPathPuzzleIds?: string[];
  recentSortingItemIds?: string[];
  sortingBestDurationMs?: number | null;
  matchingBestDurationMs?: number | null;
  recentMatchingContentIds?: string[];
  recentMergeOrderIds?: string[];
  mergeBest?: { movesUsed: number; durationMs: number } | null;
  blockJamBest?: { movesUsed: number; durationMs: number } | null;
  onStartQuestAttempt?: (config: Record<string, unknown>) => string;
  onCancelQuestAttempt?: (attemptId: string) => void;
  onCompleteInteractiveQuest?: (attemptId: string, result: QuestResult) => void;
  onOpenQuestGame?: (questId: string) => void;
  insight: CompanionInsight;
  onInsightAction: () => void;
  memorySaved?: boolean;
  bondProgress: CompanionBondProgress;
  pendingBondCelebration: CompanionBondAwardReceipt | null;
  onBondCelebrationComplete: (receipt: CompanionBondAwardReceipt) => void;
  introductionDefinition: CompanionIntroductionDefinition | null;
  introductionRecord: CompanionIntroductionRecord | null;
  introductionShouldAutoOpen: boolean;
  visitGreeting: CompanionVisitGreeting;
  onDeferIntroduction: (preference?: CompanionIntroductionAnswer) => void;
  onCompleteIntroduction: (
    preference: CompanionIntroductionAnswer,
    supportStyle: CompanionSupportStyle
  ) => void;
  onExperienceActiveChange?: (active: boolean) => void;
  achievementProgress: { earned: number; total: number; unseen: number };
  skins: readonly KingdomSkinOption[];
  equippedSkinId: KatchimeraSkinId | null;
  onEquipSkin: (skinId: KatchimeraSkinId) => void;
  role: KatchimeraRoleDefinition | null;
  discoveryPrompts: readonly CompanionDiscoveryPromptDefinition[];
  discoveryAnswers: readonly CompanionDiscoveryAnswer[];
  onAnswerDiscovery: (prompt: CompanionDiscoveryPromptDefinition, value: string) => void;
  onRemoveDiscoveryAnswer: (promptId: string) => void;
  onSetDiscoveryGoalStatus: (promptId: string, status: 'active' | 'completed' | 'paused') => void;
  journeyDefinition: CompanionJourneyDefinition | null;
  journeyGoals: readonly CompanionJourneyGoal[];
  journeyConversation: CompanionJourneyConversationSession | null;
  journeyNode: CompanionJourneyConversationNode | null;
  journeyProgress: CompanionGoalJourneyProgress | null;
  journeyMomentLoggedToday: boolean;
  questAdvancesJourneyGoal: boolean;
  onStartJourneyConversation: (preference?: CompanionIntroductionAnswer) => void;
  onAnswerJourneyConversation: (sessionId: string, value: string) => readonly string[];
  onLogJourneyMoment: (kindId: string, note?: string) => void;
  onSetJourneyGoalStatus: (goalId: string, status: CompanionJourneyGoalStatus) => void;
  onSetPrimaryJourneyGoal: (goalId: string) => void;
  journeyCheckIn: CompanionJourneyCheckIn | null;
  onStartJourneyCheckIn: () => CompanionJourneyCheckIn | null;
  onAnswerJourneyCheckIn: (
    checkInId: string,
    answer: Omit<CompanionJourneyCheckInAnswer, 'answeredAt'>
  ) => CompanionJourneyCheckIn | null;
  onBackJourneyCheckIn: (checkInId: string) => void;
  onEditJourneyCheckIn: (checkInId: string) => void;
  onSetJourneyCheckInTaskStatus: (checkInId: string, status: 'added' | 'dismissed') => void;
  onSaveJourneyCheckIn: (checkIn: CompanionJourneyCheckIn, note: CompanionReflectionDraft | null) => void;
  familyId: KatchimeraFamilyId;
  quickGoalsEnabled: boolean;
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
  conversationRecommendation: { definitionId: string; sourceKind: ConversationSignalKind } | null;
  conversationStarters: readonly CompanionChatStarter[];
  idealSkinDefinitionId: string | null;
  idealSkinOnboardingRequired: boolean;
  conversationQuestOffer: { id: string; title: string; hint: string } | null;
  onAnswerConversation: (optionId: string) => void;
  onContinueConversation: () => void;
  onStartConversation: (input?: { definitionId?: string; mode?: ConversationMode; poolId?: string; recommendation?: boolean }) => void;
  onKeepTalkingConversation: (poolId?: string) => void;
  onMemoryConversationDecision: (remember: boolean, summary: string) => void;
  onGoalConversationDecision: (selectedTemplateIds: readonly string[] | null, node: Extract<ConversationNode, { kind: 'goal_proposal' }>) => void;
  onQuickGoalConversationDecision: (accept: boolean, node: Extract<ConversationNode, { kind: 'quick_goal_proposal' }>) => void;
  onJournalConversationHandoff: (open: boolean, node: Extract<ConversationNode, { kind: 'journal_handoff' }>) => void;
  onQuestConversationHandoff: (accept: boolean, node: Extract<ConversationNode, { kind: 'quest_handoff' }>) => void;
  onDismissConversationOutcome: () => void;
  onPreviewConversation: (definitionId: string) => void;
  onExitConversationPreview: () => void;
  visitPlan: CompanionVisitPlan | null;
  visitReceipt: CompanionConversationReceipt | null;
  memories: readonly CompanionMemory[];
  insights: readonly CompanionInsightRecord[];
  onRemoveInsight: (insightId: string) => void;
  onRetakeInsight: (definitionId: string) => void;
  historyIsPlus: boolean;
  hasOlderHistory: boolean;
  onRespondVisit: (response: CompanionVisitResponse) => void;
  onSayMoreVisit: () => void;
  onUpdateMemory: (input: { memoryId: string; status: 'confirmed' | 'rejected' | 'forgotten'; summary?: string }) => void;
  onInsightConversationDecision: (accept: boolean, node: Extract<ConversationNode, { kind: 'insight_reveal' }>) => void;
  onResetMemory?: () => void;
  onSharedHistoryOpened: () => void;
};

export function CompanionInteractionSheet(props: CompanionInteractionSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: viewportHeight, width: viewportWidth } = useWindowDimensions();
  const onExperienceActiveChange = props.onExperienceActiveChange;
  const [showFeastleDashboard, setShowFeastleDashboard] = useState(false);
  const onBondCelebrationComplete = props.onBondCelebrationComplete;
  const creatureRewardTargetRef = useRef<ViewType | null>(null);
  const [bondReward, setBondReward] = useState<{
    from: GoalTaskSourceRect;
    receipt: CompanionBondAwardReceipt;
    to: GoalTaskSourceRect;
  } | null>(null);
  const [rewardPulseKey, setRewardPulseKey] = useState(0);
  const [displayedBondTotal, setDisplayedBondTotal] = useState<number | null>(null);
  const pendingRewardSourceRef = useRef<GoalTaskSourceRect | null>(null);
  const rewardLaunchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rewardFinishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showQuickGoalReward = useCallback((
    receipt: CompanionQuickGoalCompletionReceipt,
    source: GoalTaskSourceRect | null
  ) => {
    if (!receipt.bondAward) return;
    pendingRewardSourceRef.current = source;
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
    pendingRewardSourceRef.current = null;
  }, [props.creatureId]);

  useEffect(() => {
    const receipt = props.pendingBondCelebration;
    if (!props.active || !receipt || bondReward) return;
    setDisplayedBondTotal(receipt.beforeTotal);
    let cancelled = false;
    const launch = (attempt = 0) => {
      if (cancelled) return;
      const targetView = creatureRewardTargetRef.current;
      if (!targetView) {
        if (attempt < 1) {
          rewardLaunchTimerRef.current = setTimeout(() => launch(attempt + 1), 50);
        } else {
          const target = { height: 160, width: 160, x: viewportWidth * 0.58, y: viewportHeight * 0.24 };
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
  }, [bondReward, props.active, props.pendingBondCelebration, viewportHeight, viewportWidth]);

  useEffect(() => {
    if (props.active !== false) return;
    if (rewardLaunchTimerRef.current) clearTimeout(rewardLaunchTimerRef.current);
    if (rewardFinishTimerRef.current) clearTimeout(rewardFinishTimerRef.current);
    rewardLaunchTimerRef.current = null;
    rewardFinishTimerRef.current = null;
    setBondReward(null);
    setDisplayedBondTotal(null);
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
    onClose: props.onClose,
    onSelectDestination: props.onSelectDestination,
  });
  const idealSkinDefinitionId = props.idealSkinDefinitionId;
  const idealSkinOnboardingRequired = props.idealSkinOnboardingRequired;
  const onboardingCreatureId = props.creatureId;
  const onboardingConversationDefinitionId = props.conversationSession?.definitionId;
  const onboardingConversationStatus = props.conversationSession?.status;
  const startConversation = props.onStartConversation;
  const showConversation = experience.showConversation;
  const showFeastleStoryHome = experience.showHome;
  const pendingStoryConversationRef = useRef<string | null>(null);
  const openedStoryConversationRef = useRef<string | null>(null);
  const completedFeastleIntroductionRef = useRef<string | null>(null);
  const {
    activeAttemptId,
    checkInOpen,
    destination,
    direction,
    experienceInstance,
    introductionOpen,
    journeyQuestionnaireOpen,
    journeyQuestionnaireSessionId,
    openSharedHistory,
    openIntroduction,
    selectDestination: selectExperienceDestination,
    resetQuestExperience,
    questExperienceOpen,
    quickGoalPickerOpen,
    reviewItem: setReviewItem,
    reviewItemId,
    syncJourneySession,
    route,
  } = experience;
  const requestStoryConversation = useCallback((definitionId: string) => {
    if (
      props.conversationSession?.definitionId === definitionId
      && props.conversationSession.status === 'active'
      && props.conversationDefinition?.id === definitionId
    ) {
      pendingStoryConversationRef.current = null;
      if (openedStoryConversationRef.current !== definitionId) {
        openedStoryConversationRef.current = definitionId;
        showConversation();
      }
      return;
    }
    pendingStoryConversationRef.current = definitionId;
    startConversation({ definitionId });
  }, [props.conversationDefinition?.id, props.conversationSession?.definitionId, props.conversationSession?.status, showConversation, startConversation]);
  const beginFeastleIntroduction = useCallback(() => {
    // The card press is the launch authority. Clear any request left behind by
    // a previous mount so a failed/pre-hydration attempt cannot swallow taps.
    pendingStoryConversationRef.current = null;
    openedStoryConversationRef.current = null;
    requestStoryConversation(FEASTLE_FIRST_MEETING_DEFINITION_ID);
  }, [requestStoryConversation]);
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
  useEffect(() => {
    if (props.familyId !== 'feastle') return;
    const story = loadFeastleStory();
    if (story.status !== 'conversation_active' || !story.pendingConversationId) return;
    if (openedStoryConversationRef.current === story.pendingConversationId) return;
    requestStoryConversation(story.pendingConversationId);
  }, [props.familyId, requestStoryConversation]);
  useEffect(() => {
    const session = props.conversationSession;
    if (
      props.familyId !== 'feastle'
      || !session
      || session.preview
      || session.definitionId !== FEASTLE_FIRST_MEETING_DEFINITION_ID
      || session.status !== 'completed'
      || completedFeastleIntroductionRef.current === session.id
      || !props.journeyDefinition
    ) return;
    const preferenceTurn = session.turns.find((turn) => turn.nodeId === 'table');
    const supportTurn = session.turns.find((turn) => turn.nodeId === 'pact');
    const firstNode = props.journeyDefinition.nodes.find((node) => node.id === props.journeyDefinition?.startNodeId);
    const preferenceOption = firstNode?.options?.find((option) => option.id === preferenceTurn?.optionId);
    const supportStyle = supportTurn?.optionId as CompanionSupportStyle | undefined;
    if (!preferenceTurn || !preferenceOption || !supportStyle) return;
    completedFeastleIntroductionRef.current = session.id;
    props.onCompleteIntroduction({
      nodeId: firstNode!.id,
      optionId: preferenceOption.id,
      label: preferenceOption.label,
    }, supportStyle);
    beginFeastleStory();
    showFeastleStoryHome();
  }, [props, showFeastleStoryHome]);
  const [endAttemptOpen, setEndAttemptOpen] = useState(false);
  const [leaveQuestOpen, setLeaveQuestOpen] = useState(false);
  const [activeCheckIn, setActiveCheckIn] = useState<CompanionJourneyCheckIn | null>(props.journeyCheckIn);
  const [hasShownHome, setHasShownHome] = useState(false);
  const contentRef = useRef<ScrollView>(null);
  const reduceMotion = useReducedMotion();
  const visual = getCreatureVisual(props.visualKey);
  const goalsToday = quickGoalsForDay(
    props.quickGoalState,
    props.quickGoalDayId,
    props.familyId
  );
  const goalsRemaining = goalsToday.filter((item) => !item.completion).length;
  const activeJourneyFocus = props.journeyGoals.find((goal) => goal.status === 'active' && goal.isPrimary)
    ?? props.journeyGoals.find((goal) => goal.status === 'active')
    ?? null;
  const selectedOffer = props.offers.find((offer) => offer.id === props.selectedOfferId) ?? props.offers[0];
  const quest = useMemo(() => buildCompanionQuestViewModel({
    activeQuest: props.activeQuest,
    offer: selectedOffer,
    runtime: props.questRuntime,
    questComplete: props.questComplete,
    captureFeedback: props.questCaptureFeedback,
    items: props.submissionItems,
    criteria: props.criteria,
  }), [props.activeQuest, props.criteria, props.questCaptureFeedback, props.questComplete, props.questRuntime, props.submissionItems, selectedOffer]);
  const reviewItem = props.submissionItems.find((item) => item.id === reviewItemId) ?? null;
  const viewportResetKey = `${companionViewportResetKey({
    creatureId: props.creatureId,
    destination,
    questMode: quest.mode,
    activeQuestTitle: props.activeQuest?.title,
    // Keep the immersive questionnaire scene mounted between questions.
    // Only the answer choices should transition; remounting this ScrollView
    // reloads the background/creature and replays every entrance animation.
    journeyNodeId: journeyQuestionnaireOpen ? undefined : props.journeyNode?.id,
    reviewItemId,
    activeAttemptId,
    memorySaved: props.memorySaved,
  })}:quick-goal-picker:${quickGoalPickerOpen}:quest-experience:${questExperienceOpen}:journey-questionnaire:${journeyQuestionnaireOpen}`;

  const resetViewport = useCallback(() => {
    contentRef.current?.scrollTo({ x: 0, y: 0, animated: false });
  }, []);

  useEffect(() => {
    Keyboard.dismiss();
    resetViewport();
    const frame = requestAnimationFrame(resetViewport);
    // KeyboardAvoidingView and the animated thread swap settle on separate
    // native layout passes. Reset once more after both have finished so a
    // longer previous thread cannot strand a shorter quest above the viewport.
    const settled = setTimeout(resetViewport, 260);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settled);
    };
  }, [resetViewport, viewportResetKey]);

  useEffect(() => {
    if (!activeAttemptId) return;
    let frame: number | null = null;
    let settled: ReturnType<typeof setTimeout> | null = null;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      frame = requestAnimationFrame(resetViewport);
      settled = setTimeout(resetViewport, 220);
    });
    return () => {
      subscription.remove();
      if (frame !== null) cancelAnimationFrame(frame);
      if (settled !== null) clearTimeout(settled);
    };
  }, [activeAttemptId, resetViewport]);

  useEffect(() => setActiveCheckIn(null), [props.creatureId]);

  useEffect(() => {
    setHasShownHome(false);
  }, [props.creatureId]);

  useEffect(() => {
    if (route.kind === 'dashboard' && !hasShownHome) {
      setHasShownHome(true);
    }
  }, [hasShownHome, route.kind]);

  const hasActiveIdealSkinQuestionnaire = Boolean(
    idealSkinDefinitionId
    && onboardingConversationDefinitionId === idealSkinDefinitionId
    && onboardingConversationStatus === 'active'
  );

  // Prepare first and navigate only once the matching questionnaire session
  // is observable. This avoids dispatching navigation during the same render
  // cycle that creates or hydrates the session.
  useEffect(() => {
    if (!idealSkinOnboardingRequired || !idealSkinDefinitionId) return;
    if (!hasActiveIdealSkinQuestionnaire) {
      startConversation({ definitionId: idealSkinDefinitionId });
    }
  }, [
    hasActiveIdealSkinQuestionnaire,
    idealSkinDefinitionId,
    idealSkinOnboardingRequired,
    onboardingCreatureId,
    startConversation,
  ]);

  useEffect(() => {
    if (!hasActiveIdealSkinQuestionnaire || route.kind === 'conversation') return;
    showConversation();
  }, [hasActiveIdealSkinQuestionnaire, route.kind, showConversation]);

  // A one-shot launch can be lost while persisted state is being reset or
  // hydrated. Keep ensuring until the matching active session is observable;
  // the idempotency guard prevents duplicate sessions between retries.
  useEffect(() => {
    if (!idealSkinOnboardingRequired || !idealSkinDefinitionId || hasActiveIdealSkinQuestionnaire) return;
    const retry = setInterval(() => {
      startConversation({ definitionId: idealSkinDefinitionId });
    }, 250);
    return () => clearInterval(retry);
  }, [
    hasActiveIdealSkinQuestionnaire,
    idealSkinDefinitionId,
    idealSkinOnboardingRequired,
    onboardingCreatureId,
    startConversation,
  ]);

  useEffect(() => {
    setActiveCheckIn(props.journeyCheckIn);
  }, [props.journeyCheckIn]);

  useEffect(() => {
    if (journeyQuestionnaireOpen && props.journeyConversation) {
      syncJourneySession(props.journeyConversation.id);
    }
  }, [journeyQuestionnaireOpen, props.journeyConversation, syncJourneySession]);

  const returnToQuest = () => {
    experience.returnToDestination();
    resetViewport();
  };
  const requestClose = () => {
    if (checkInOpen || journeyQuestionnaireOpen) {
      Keyboard.dismiss();
      if (journeyQuestionnaireSessionId && !props.journeyConversation) props.onDismissQuickGoalSuggestions();
    }
    const backAction = experience.requestBack();
    if (backAction === 'confirm_attempt_exit') setEndAttemptOpen(true);
    else resetViewport();
  };
  const selectDestination = (nextDestination: CompanionDestination) => {
    Keyboard.dismiss();
    resetViewport();
    experience.selectDestination(nextDestination);
  };
  const runPrimary = () => {
    const action = quest.primaryAction;
    if (!action) return;
    if (process.env.EXPO_OS === 'ios') {
      if (action.kind === 'accept') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      else void Haptics.selectionAsync();
    }
    if (action.kind === 'accept') props.onAccept(selectedOffer?.id);
    else if (action.kind === 'quest_action') props.onQuestAction();
    else if (action.kind === 'review_match') setReviewItem(action.item.id);
    else if (action.kind === 'submit') props.onSubmitQuest(action.item);
    else props.onCashIn();
  };
  const interactiveExecution = props.activeQuest?.execution ?? null;
  const questGameVisible = Boolean(
    destination === 'quest'
    && interactiveExecution
    && questExperienceOpen
    && props.onStartQuestAttempt
    && props.onCancelQuestAttempt
    && props.onCompleteInteractiveQuest
  );
  const questPresentation = companionQuestPresentation(interactiveExecution);
  const questGameFullBleed = questPresentation.layout === 'fullBleed';
  useEffect(() => {
    setEndAttemptOpen(false);
    setLeaveQuestOpen(false);
    resetQuestExperience();
  }, [props.activeQuest?.title, props.creatureId, resetQuestExperience]);
  const quickGoalPanel = props.quickGoalsEnabled ? (
    <View style={styles.quickGoalStack}>
      <CompanionQuickGoalsPanel
        dayId={props.quickGoalDayId}
        familyId={props.familyId}
        onCompleteGoal={props.onCompleteQuickGoal}
        onCompletionReward={showQuickGoalReward}
        onOpen={() => {
          if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
          experience.openQuickGoalPicker();
        }}
        onRemember={props.onRememberQuickGoal}
        onSkipGoal={props.onSkipQuickGoal}
        onSnoozeGoal={props.onSnoozeQuickGoal}
        onUndoGoal={props.onUndoQuickGoal}
        state={props.quickGoalState}
      />
    </View>
  ) : null;
  const questionnaireExperience = Boolean(
    introductionOpen ||
    (journeyQuestionnaireOpen && props.journeyDefinition) ||
    (checkInOpen && activeCheckIn)
  );
  useEffect(() => {
    onExperienceActiveChange?.(Boolean(activeAttemptId));
    return () => onExperienceActiveChange?.(false);
  }, [activeAttemptId, onExperienceActiveChange]);
  const canReturnToQuestList = Boolean(
    props.activeQuest &&
    !props.questComplete &&
    quest.mode !== 'complete' &&
    quest.mode !== 'analysing' &&
    !questExperienceOpen
  );
  const inlineQuestNoteAction = companionQuestInlineNoteAction(quest);
  const inlineQuestPhotoAction = companionQuestInlinePhotoAction(quest);
  const actionFooter = props.memorySaved
    ? null
    : destination === 'quest' && interactiveExecution
      ? null
    : destination === 'quest' && quest.mode === 'offer'
      ? null
    : destination === 'quest' && quest.primaryAction && !inlineQuestNoteAction && !inlineQuestPhotoAction
      ? reviewItem ? null : (
          <CompanionPrimaryAction label={quest.mode === 'offer' ? 'Accept selected quest' : quest.primaryAction.label} icon={quest.primaryAction.icon} onPress={runPrimary} disabled={quest.mode === 'analysing'} />
        )
      : destination === 'quest'
        ? null
      : null;
  const visibleFooter = quickGoalPickerOpen || questionnaireExperience ? null : actionFooter;
  const entering = reduceMotion ? FadeIn.duration(100) : direction > 0 ? FadeInRight.duration(210) : FadeInLeft.duration(210);
  const destinationLabel =
    destination === 'quest'
      ? 'Quests'
      : destination === 'goals'
          ? 'Goals'
          : destination === 'achievements'
            ? 'Trophy room'
            : destination === 'insight'
              ? 'Your insights'
              : 'Skins';
  const questStatus = props.activeQuest
    ? 'Quest in progress'
    : props.offers.length
      ? `${props.offers.length} available`
      : 'All quiet for now';
  const goalStatus = !props.quickGoalsEnabled
    ? 'Coming soon'
    : goalsRemaining
      ? `${goalsRemaining} to-do`
      : goalsToday.length
        ? 'All done today'
        : 'Choose a small step';
  const homeGreeting = props.introductionDefinition
    ? props.visitGreeting === 'returning'
      ? props.introductionDefinition.returnGreeting
      : props.visitGreeting === 'new_skin'
        ? companionFormGreeting(props.name)
        : props.introductionDefinition.homeGreeting
    : 'Where shall we begin today?';
  const visitPlan = props.visitPlan ?? {
    id: `companion-visit-plan:${props.familyId}:${props.quickGoalDayId}`,
    familyId: props.familyId,
    dayId: props.quickGoalDayId,
    subject: 'quiet' as const,
    eyebrow: 'JUST VISITING',
    opening: homeGreeting,
    helperText: 'Staying for a moment is enough.',
    responses: [
      { id: 'stay', label: 'Stay a moment', action: 'stay' as const },
      { id: 'later', label: 'Maybe later', action: 'defer' as const },
    ],
    evidenceRefs: [],
    createdAt: 0,
  };
  const visitCompletionKind = props.visitReceipt?.offerOutcome === 'deferred'
    ? 'deferred' as const
    : visitPlan.subject === 'quiet'
      ? 'quiet' as const
      : visitPlan.subject === 'memory_confirmation'
        ? 'remembered' as const
        : 'answered' as const;
  const visitSpeech = props.visitReceipt
    ? visitCompletionKind === 'deferred'
      ? 'That’s alright. We can leave it here for today.'
      : completedVisitCopy(visitPlan.subject)
    : visitPlan.opening;
  const conversationExperience = props.conversationSession && props.conversationDefinition
    ? { session: props.conversationSession, definition: props.conversationDefinition }
    : null;
  const feastleFirstMeetingActive = conversationExperience?.definition.id === FEASTLE_FIRST_MEETING_DEFINITION_ID;
  const feastleMergeStoryDefinition = conversationExperience?.definition.id === FEASTLE_FIRST_MEETING_DEFINITION_ID
    || /^feastle:friendship:[234]$/.test(conversationExperience?.definition.id ?? '');
  const feastleStoryFlow = Boolean(
    conversationExperience
    && props.familyId === 'feastle'
    && !conversationExperience.session.preview
    && feastleMergeStoryDefinition
  );
  const feastleStoryFinale = conversationExperience?.definition.id === 'feastle:friendship:4';
  const idealSkinPreparing = idealSkinOnboardingRequired && !conversationExperience;
  const visitStageSpeech = idealSkinPreparing
    ? 'Let’s find the form that feels most like you.'
    : conversationExperience
    ? conversationSpeechLine(conversationExperience.session, conversationExperience.definition)
    : visitSpeech;
  const respondToVisit = (response: CompanionVisitResponse) => {
    props.onRespondVisit(response);
    if (response.action === 'open_achievements') {
      selectDestination('achievements');
      return;
    }
    if (response.action === 'say_more') {
      props.onSayMoreVisit();
      return;
    }
    if (response.action === 'accept_quest') {
      props.onAccept(visitPlan.questId);
      return;
    }
    if (response.action === 'open_quest') {
      if (visitPlan.questId) props.onSelectOffer(visitPlan.questId);
      selectDestination('quest');
      return;
    }
    if (response.action === 'open_focus') {
      if (props.introductionRecord?.status !== 'completed' && props.introductionDefinition) {
        if (props.familyId === 'feastle') requestStoryConversation(FEASTLE_FIRST_MEETING_DEFINITION_ID);
        else openIntroduction();
        return;
      }
      if (props.journeyDefinition) {
        if (!props.journeyConversation) props.onStartJourneyConversation();
        experience.openJourneyQuestionnaire(props.journeyConversation?.id);
        return;
      }
      selectDestination('goals');
    }
  };
  const openHistory = () => {
    props.onSharedHistoryOpened();
    openSharedHistory();
  };
  const openChat = () => {
    if (
      props.introductionShouldAutoOpen
      && props.introductionDefinition
      && props.journeyDefinition
    ) {
      if (props.familyId === 'feastle') requestStoryConversation(FEASTLE_FIRST_MEETING_DEFINITION_ID);
      else openIntroduction();
      return;
    }
    if (isConversationV2Family(props.familyId)) experience.showChatLobby();
    else experience.showVisit();
  };
  const destinationHeroTitle = destination === 'quest'
    ? props.activeQuest
      ? 'Ready to keep going?'
      : 'Ready for a little adventure?'
    : destination === 'goals'
        ? activeJourneyFocus
          ? 'Your goals and next steps.'
          : 'What feels doable today?'
        : destination === 'achievements'
          ? 'Look what we’ve achieved together!'
          : destination === 'insight'
            ? 'Here’s what your Katchimeras have learned about you.'
            : 'Which form feels like me?';
  const destinationHeroBody = destination === 'goals'
    ? activeJourneyFocus
      ? 'See your plan, add a small step, or talk through what you want next.'
      : 'Choose a small step or answer four questions to find a useful direction.'
    : undefined;
  const questGameContent = questGameVisible
    && interactiveExecution
    && props.onStartQuestAttempt
    && props.onCancelQuestAttempt
    && props.onCompleteInteractiveQuest
    ? (
        <Suspense fallback={<View style={styles.gameLoading} />}>
        <LazyQuestExperienceHost
          key={experienceInstance}
          session={{
            execution: interactiveExecution,
            config: props.activeQuest?.resolvedConfig ?? {},
            seed: props.activeQuest?.offerSeed ?? `${props.creatureId}:${props.activeQuest?.title}`,
            startImmediately: questPresentation.startsImmediately,
          }}
          history={{
            recentQuestionIds: props.recentTriviaQuestionIds ?? [],
            recentPuzzleIds: props.recentWordPuzzleIds ?? [],
            recentWordPathPuzzleIds: props.recentWordPathPuzzleIds ?? [],
            recentSortingItemIds: props.recentSortingItemIds ?? [],
            sortingBestDurationMs: props.sortingBestDurationMs ?? null,
            matchingBestDurationMs: props.matchingBestDurationMs ?? null,
            recentMatchingContentIds: props.recentMatchingContentIds ?? [],
            recentMergeOrderIds: props.recentMergeOrderIds ?? [],
            mergeBest: props.mergeBest ?? null,
            blockJamBest: props.blockJamBest ?? null,
          }}
          handlers={{
            onAttemptStart: props.onStartQuestAttempt,
            onAttemptCancel: props.onCancelQuestAttempt,
            onComplete: (attemptId, result) => {
              props.onCompleteInteractiveQuest?.(attemptId, result);
              experience.setQuestAttempt(null);
              experience.returnToDestination();
              selectDestination('insight');
            },
            onRequestExit: () => {
              if (activeAttemptId) setEndAttemptOpen(true);
              else returnToQuest();
            },
            onRunningChange: (running, attemptId) => {
              if (running) experience.setQuestAttempt(attemptId ?? null);
              else returnToQuest();
            },
          }}
        />
        </Suspense>
      )
    : null;

  return (<>
        <CompanionSheetShell
          background={props.questionnaireBackground}
          fullBleed
          keyboardAvoiding={!questGameVisible}
          onRequestClose={requestClose}
          portal={!props.embedded}
          showClose={false}
          surface={questGameVisible ? 'night' : 'parchment'}>
        {questGameVisible ? (
          <CompanionGameBackdrop
            backgroundKey={props.homeEnvironmentKey ?? null}
            creature={visual.source}
            name={props.name}
            strong={questPresentation.backdrop === 'strong'}
            visualKey={props.visualKey}
          />
        ) : !questionnaireExperience ? (
          <CompanionCinematicStage
            bubbleBody={idealSkinPreparing
              ? 'A few quick choices will shape your closest skin match.'
              : quickGoalPickerOpen ? 'Choose one for today, or make a small goal of your own.' : destinationHeroBody}
            bubbleVariant={quickGoalPickerOpen ? 'questionnaire' : 'default'}
            celebrate={Boolean((route.kind === 'visit' || route.kind === 'conversation') && conversationExperience?.session.outcomePresentation?.celebrate)}
            creature={visual.source}
            creatureTargetRef={creatureRewardTargetRef}
            enterFromLifted={(route.kind === 'visit' || route.kind === 'conversation') && hasShownHome}
            environmentKey={props.homeEnvironmentKey ?? null}
            lifted
            name={props.name}
            rewardPulseKey={rewardPulseKey}
            showSpeechBubble
            title={quickGoalPickerOpen
              ? 'Which small step feels right?'
              : route.kind === 'chat_lobby'
                ? 'What are you in the mood for?'
              : route.kind === 'visit' || route.kind === 'conversation'
                ? visitStageSpeech
                : route.kind === 'shared_history'
                  ? 'Here is what I remember with you.'
                  : route.kind === 'dashboard'
                    ? 'What should we do together?'
                    : destinationHeroTitle}
            visualKey={props.visualKey}
          />
        ) : null}
        {idealSkinPreparing ? (
          <View accessibilityLabel="Preparing ideal skin questionnaire" accessibilityLiveRegion="polite" style={styles.onboardingLoading}>
            <ActivityIndicator color="#75450A" size="small" />
            <ThemedText selectable style={styles.onboardingLoadingText} lightColor="#4F3A25" darkColor="#4F3A25">
              Preparing your first question…
            </ThemedText>
          </View>
        ) : null}
        {route.kind === 'chat_lobby' && isConversationV2Family(props.familyId) ? (
          <CompanionChatLobby
            activeSession={props.conversationSession?.status === 'active' ? props.conversationSession : null}
            familyId={props.familyId}
            name={props.name}
            onBack={experience.showHome}
            onOpenConversation={experience.showConversation}
            onOpenHistory={openHistory}
            onStart={props.onStartConversation}
            recommendation={props.conversationRecommendation}
            starters={props.conversationStarters}
          />
        ) : route.kind === 'visit' || route.kind === 'conversation' ? (
          conversationExperience ? <CompanionConversationScene
            definition={conversationExperience.definition}
            hasActiveFocus={Boolean(activeJourneyFocus)}
            name={props.name}
            onAnswer={props.onAnswerConversation}
            onClose={props.idealSkinOnboardingRequired
              ? props.onClose
              : route.kind === 'conversation' && !feastleFirstMeetingActive && !feastleStoryFlow ? experience.showChatLobby : experience.showHome}
            onContinue={props.onContinueConversation}
            onEquipForm={conversationExperience.session.preview ? () => undefined : props.onEquipSkin}
            onGoalDecision={props.onGoalConversationDecision}
            onInsightDecision={(accept, node) => {
              props.onInsightConversationDecision(accept, node);
              if (accept && !conversationExperience.session.preview) selectExperienceDestination('insight');
            }}
            onKeepTalking={props.onKeepTalkingConversation}
            onDismissOutcome={props.onDismissConversationOutcome}
            onOpenOutcomeDestination={(outcomeDestination: ConversationOutcomeDestination) => {
              props.onDismissConversationOutcome();
              if (outcomeDestination === 'goals' && feastleStoryFlow) {
                props.onOpenTodayGoals();
                return;
              }
              if (outcomeDestination === 'memory') {
                openHistory();
                return;
              }
              selectExperienceDestination(outcomeDestination);
            }}
            onQuickGoalDecision={props.onQuickGoalConversationDecision}
            onJournalHandoff={props.onJournalConversationHandoff}
            onQuestHandoff={props.onQuestConversationHandoff}
            onMemoryDecision={(remember, summary) => {
              const currentNode = conversationExperience.definition.nodes.find(
                (candidate) => candidate.id === conversationExperience.session.currentNodeId
              );
              props.onMemoryConversationDecision(remember, summary);
              if (
                remember
                && !conversationExperience.session.preview
                && currentNode?.kind === 'memory_proposal'
                && currentNode.memoryKey.includes(':form-match')
              ) selectExperienceDestination('insight');
            }}
            memories={props.memories}
            onOpenMore={experience.showHome}
            onStoryComplete={experience.showHome}
            onUpdateMemory={props.onUpdateMemory}
            session={conversationExperience.session}
            skins={props.skins}
            storyFlow={feastleStoryFlow}
            storyFinale={feastleStoryFinale}
            questOffer={props.conversationQuestOffer}
          /> : idealSkinOnboardingRequired ? null : (route.kind === 'visit' ? <CompanionVisitScene
            bondProgress={displayedBondProgress}
            completed={Boolean(props.visitReceipt)}
            completionKind={visitCompletionKind}
            memoryCount={props.memories.filter((memory) => memory.status === 'confirmed').length}
            name={props.name}
            onClose={experience.showHome}
            onOpenHistory={openHistory}
            onOpenMore={experience.showHome}
            onRespond={respondToVisit}
            plan={visitPlan}
          /> : <View accessibilityLiveRegion="polite" style={styles.conversationRecovery}>
            <ActivityIndicator color="#75450A" size="small" />
            <ThemedText selectable style={styles.conversationRecoveryTitle} lightColor="#3B2C20" darkColor="#3B2C20">Feastle is finding the next page…</ThemedText>
            <ThemedText selectable style={styles.conversationRecoveryBody} lightColor="#64513B" darkColor="#64513B">Your served order is safe. If the story does not appear, try opening this part again.</ThemedText>
            <CompanionPrimaryAction
              icon="arrow.clockwise"
              label="Open the story again"
              onPress={() => {
                const definitionId = loadFeastleStory().pendingConversationId;
                if (!definitionId) { experience.showHome(); return; }
                pendingStoryConversationRef.current = null;
                openedStoryConversationRef.current = null;
                requestStoryConversation(definitionId);
              }}
            />
            <CompanionSecondaryAction icon="chevron.left" label="Back to Feastle" onPress={experience.showHome} />
          </View>)
        ) : (
          <>
        {questGameVisible && !questGameFullBleed ? (
          <View style={[styles.gameBackPosition, { top: insets.top + 10 }]}>
            <CompanionBackAction
              label="Quest list"
              onPress={() => {
                if (activeAttemptId) setEndAttemptOpen(true);
                else returnToQuest();
              }}
              tone="night"
            />
          </View>
        ) : null}
        {idealSkinPreparing ? (
          <View style={[styles.gameBackPosition, { top: insets.top + 10 }]}>
            <CompanionBackAction label="Kingdom" onPress={props.onClose} />
          </View>
        ) : null}
        {(route.kind === 'destination' || route.kind === 'dashboard' || route.kind === 'shared_history' || quickGoalPickerOpen) && !questGameVisible && !questionnaireExperience ? (
          <CompanionDestinationHeader
            backLabel={quickGoalPickerOpen ? 'Goals' : destination === 'quest' && canReturnToQuestList ? 'Quest list' : route.kind === 'dashboard' ? 'Kingdom' : 'Dashboard'}
            label={route.kind === 'dashboard' ? 'Dashboard' : route.kind === 'shared_history' ? props.familyId === 'feastle' ? 'Recipe Book' : 'Shared history' : destinationLabel}
            titleTone={destination === 'achievements' ? 'gold' : 'default'}
            onBack={
              quickGoalPickerOpen
                ? experience.returnToDestination
                : destination === 'quest' && canReturnToQuestList
                ? () => setLeaveQuestOpen(true)
                : route.kind === 'dashboard'
                  ? requestClose
                  : experience.showHome
            }
          />
        ) : null}
        <CompanionDestinationSurface immersive={Boolean(questGameVisible || questionnaireExperience)}>
        <View key="interaction-content" style={styles.contentFrame}>
          {questGameContent ? (
            <View
              style={[
                styles.gameExperienceFrame,
                !questGameFullBleed && {
                  paddingBottom: Math.max(10, insets.bottom + 8),
                  paddingHorizontal: 14,
                  paddingTop: insets.top + 64,
                },
              ]}>
              {questGameContent}
            </View>
          ) : (
          <ScrollView
            key={viewportResetKey}
            ref={contentRef}
            automaticallyAdjustContentInsets={false}
            automaticallyAdjustKeyboardInsets={false}
            bounces={!activeAttemptId}
            contentContainerStyle={[
              styles.scrollContent,
              activeAttemptId && styles.activeScrollContent,
              questionnaireExperience && [
                styles.questionnaireScrollContent,
              ],
            ]}
            contentInsetAdjustmentBehavior="never"
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={activeAttemptId ? resetViewport : undefined}
            onLayout={activeAttemptId ? resetViewport : undefined}
            overScrollMode={activeAttemptId ? 'never' : 'auto'}
            scrollEnabled={!activeAttemptId && !questionnaireExperience}
            showsVerticalScrollIndicator={false}>
            <Animated.View
              key={destination ?? route.kind}
              entering={entering}
              exiting={FadeOut.duration(100)}
              style={activeAttemptId || questionnaireExperience ? styles.activeExperience : undefined}>
              {(route.kind === 'destination' || route.kind === 'dashboard' || route.kind === 'shared_history' || quickGoalPickerOpen) && !questionnaireExperience ? (
                <View
                  accessibilityElementsHidden
                  pointerEvents="none"
                  style={[
                    styles.destinationStageSpacer,
                    destination === 'quest' && {
                      minHeight: companionQuestListSpacer(viewportHeight),
                    },
                  ]}
                />
              ) : null}
              {introductionOpen && props.introductionDefinition && props.journeyDefinition ? (
                <CompanionIntroduction
                  accentColor={props.accentColor}
                  background={props.questionnaireBackground}
                  companionName={props.name}
                  creature={visual.source}
                  definition={props.journeyDefinition}
                  environmentKey={props.homeEnvironmentKey ?? null}
                  introduction={props.introductionDefinition}
                  onComplete={(preference, supportStyle) => {
                    props.onCompleteIntroduction(preference, supportStyle);
                    if (props.familyId === 'feastle') {
                      beginFeastleStory();
                      experience.showHome();
                    } else experience.showHome();
                  }}
                  onDefer={(preference) => {
                    props.onDeferIntroduction(preference);
                    experience.showHome();
                  }}
                  onStartFocus={(preference, supportStyle) => {
                    props.onCompleteIntroduction(preference, supportStyle);
                    if (isConversationV2Family(props.familyId)) {
                      props.onStartConversation({ mode: 'plan' });
                      experience.showConversation();
                    } else {
                      props.onStartJourneyConversation(preference);
                      experience.openJourneyQuestionnaire(null);
                    }
                  }}
                  storyMode={props.familyId === 'feastle'}
                  visualKey={props.visualKey}
                />
              ) : checkInOpen && activeCheckIn ? (
                <CompanionCheckInPage
                  accentColor={props.accentColor}
                  background={props.questionnaireBackground}
                  checkIn={activeCheckIn}
                  companionName={props.name}
                  creature={visual.source}
                  definition={props.journeyDefinition}
                  environmentKey={props.homeEnvironmentKey ?? null}
                  goal={activeCheckIn.goalId
                    ? props.journeyGoals.find((goal) => goal.id === activeCheckIn.goalId) ?? null
                    : null}
                  onAddTasks={props.onAddQuickGoalSuggestions}
                  onAnswer={(checkInId, answer) => {
                    const updated = props.onAnswerJourneyCheckIn(checkInId, answer);
                    if (updated) setActiveCheckIn(updated);
                    return updated;
                  }}
                  onBack={requestClose}
                  onBackQuestion={(checkInId) => {
                    props.onBackJourneyCheckIn(checkInId);
                    setActiveCheckIn((current) => current && current.id === checkInId
                      ? { ...current, answers: current.answers.slice(0, -1) }
                      : current);
                  }}
                  onEdit={(checkInId) => {
                    props.onEditJourneyCheckIn(checkInId);
                    setActiveCheckIn((current) => current && current.id === checkInId
                      ? {
                          ...current,
                          answers: [],
                          suggestedQuickGoalIds: [],
                          taskSuggestionStatus: null,
                          completedAt: undefined,
                        }
                      : current);
                  }}
                  onSaveNote={props.onSaveJourneyCheckIn}
                  onSetTaskStatus={(checkInId, status) => {
                    props.onSetJourneyCheckInTaskStatus(checkInId, status);
                    setActiveCheckIn((current) => current && current.id === checkInId
                      ? { ...current, taskSuggestionStatus: status }
                      : current);
                  }}
                  role={props.role}
                  supportStyle={props.introductionRecord?.supportStyle}
                  visualKey={props.visualKey}
                />
              ) : questionnaireExperience && props.journeyDefinition ? (
                <CompanionJourneyQuestionnairePage
                  accentColor={props.accentColor}
                  background={props.questionnaireBackground}
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
                  onDismissTasks={props.onDismissQuickGoalSuggestions}
                  onViewTasks={() => {
                    props.onDismissQuickGoalSuggestions();
                    experience.returnToDestination();
                    selectDestination('goals');
                  }}
                  quickGoalSuggestionIds={props.quickGoalSuggestionIds}
                  resultReady={Boolean(journeyQuestionnaireSessionId && !props.journeyConversation)}
                  visualKey={props.visualKey}
                />
              ) : idealSkinOnboardingRequired ? null : route.kind === 'dashboard' && props.familyId === 'feastle' && !showFeastleDashboard ? (
                <FeastleStoryStage
                  onBeginIntroduction={beginFeastleIntroduction}
                  onJournalFood={props.onJournalFood}
                  onMore={() => setShowFeastleDashboard(true)}
                  onOpenConversation={(definitionId) => {
                    pendingStoryConversationRef.current = null;
                    openedStoryConversationRef.current = null;
                    requestStoryConversation(definitionId);
                  }}
                  onOpenMerge={(orderId) => props.onOpenMerge?.(orderId)}
                />
              ) : route.kind === 'dashboard' ? (
                <CompanionDashboard
                  companionName={props.name}
                  onChat={openChat}
                  onOpenHistory={openHistory}
                  onSelect={selectDestination}
                  statuses={{
                    quest: questStatus,
                    goals: goalStatus,
                    achievements: `${props.achievementProgress.earned} of ${props.achievementProgress.total} earned`,
                    insight: props.insights.length ? `${props.insights.length} insight${props.insights.length === 1 ? '' : 's'} discovered` : 'Discover something about yourself',
                    skins: `${props.skins.filter((skin) => skin.unlocked).length} of ${props.skins.length} forms available`,
                  }}
                />
              ) : route.kind === 'shared_history' ? (
                <CompanionSharedHistory
                  activeFocusTitle={activeJourneyFocus?.title}
                  activePlus={props.historyIsPlus}
                  hasOlderHistory={props.hasOlderHistory}
                  activeQuestTitle={props.activeQuest?.title}
                  companionName={props.name}
                  insights={props.insights}
                  memories={props.memories}
                  onUpdateMemory={props.onUpdateMemory}
                  onResetMemory={props.onResetMemory}
                />
              ) : quickGoalPickerOpen ? (
                <CompanionQuickGoalPicker
                  dayId={props.quickGoalDayId}
                  familyId={props.familyId}
                  onAddCustom={props.onAddCustomQuickGoal}
                  onAddTemplate={props.onAddQuickGoalTemplate}
                  state={props.quickGoalState}
                />
              ) : props.memorySaved ? (
                <View accessibilityLiveRegion="polite" style={styles.saved}>
                  <ThemedText style={styles.savedTitle} lightColor={Lantern.auroraTeal} darkColor={Lantern.auroraTeal}>Memory kept</ThemedText>
                  <ThemedText style={styles.savedBody} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>I’ll remember that with you.</ThemedText>
                </View>
              ) : destination === 'quest' && !props.activeQuest && props.offers.length ? (
                <View>
                  <CompanionQuestChoices
                    offers={props.offers}
                    selectedId={selectedOffer?.id ?? null}
                    onSelect={props.onSelectOffer}
                    onAccept={(offerId) => {
                      if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      props.onAccept(offerId);
                    }}
                  />
                </View>
              ) : destination === 'quest' ? (
                <View>
                  <CompanionQuestThread
                    model={quest}
                    reviewItem={reviewItem}
                    onAttemptInput={(mode) => {
                      if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
                      props.onQuestAction(mode);
                    }}
                    onAttemptPhoto={runPrimary}
                    onSelectReviewItem={(item) => setReviewItem(item?.id ?? null)}
                    onClarify={(item, answer) => {
                      props.onClarifyQuestMatch(item, answer);
                      setReviewItem(null);
                    }}
                  />
                  {interactiveExecution && !props.questComplete ? (
                    <View style={styles.openGameAction}>
                      <CompanionPrimaryAction
                        icon="play.fill"
                        label="Open mini-game"
                        onPress={() => {
                          if (
                            props.onOpenQuestGame
                            && props.activeQuest?.questId
                            && interactiveExecution?.kind === 'block_blast'
                          ) {
                            props.onOpenQuestGame(props.activeQuest.questId);
                            return;
                          }
                          experience.openQuestExperience();
                          resetViewport();
                        }}
                      />
                    </View>
                  ) : null}
                </View>
              ) : destination === 'goals' ? (
                <View style={styles.youStack}>
                {quickGoalPanel}
                {isConversationV2Family(props.familyId) ? (
                  <CompanionSection
                    description={activeJourneyFocus
                      ? 'Talk through what fits now and add concrete steps without replacing your current plan.'
                      : 'Answer four short questions to find a useful direction and choose optional next steps.'}
                    label={activeJourneyFocus ? 'Talk through your next direction' : 'Find a direction'}>
                    <CompanionPrimaryAction
                      icon="bubble.left.and.bubble.right.fill"
                      label={activeJourneyFocus ? 'Choose a Plan conversation' : 'Find a direction with me'}
                      onPress={experience.showChatLobby}
                    />
                  </CompanionSection>
                ) : null}
                {props.introductionRecord?.status === 'deferred' && props.introductionDefinition ? (
                  <CompanionSection
                    description="I can ask two short questions now, or wait until another day."
                    label={`Meet ${props.name}`}>
                    <CompanionPrimaryAction
                      icon="heart.fill"
                      label={`Meet ${props.name}`}
                      onPress={openIntroduction}
                    />
                  </CompanionSection>
                ) : null}
                {!isConversationV2Family(props.familyId) && props.journeyDefinition && (!activeJourneyFocus || props.journeyConversation) ? (
                  <CompanionJourneyDiscoveryThread
                    companionName={props.name}
                    conversation={props.journeyConversation}
                    definition={props.journeyDefinition}
                    goals={props.journeyGoals}
                    onSetGoalStatus={props.onSetJourneyGoalStatus}
                    onOpenQuestionnaire={() => {
                      if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
                      experience.openJourneyQuestionnaire(props.journeyConversation?.id);
                      if (!props.journeyConversation) props.onStartJourneyConversation();
                    }}
                    showHeading={false}
                  />
                ) : null}
                  <CompanionCheckInCard
                    checkIn={props.journeyCheckIn}
                    companionName={props.name}
                    emphasized={Boolean(activeJourneyFocus && !props.journeyConversation)
                      && props.introductionRecord?.supportStyle !== 'on_demand'}
                    onOpen={() => {
                      if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
                      const checkIn = props.journeyCheckIn ?? props.onStartJourneyCheckIn();
                      if (!checkIn) return;
                      setActiveCheckIn(checkIn);
                      experience.openCheckIn(checkIn.id);
                    }}
                    supportStyle={props.introductionRecord?.supportStyle}
                  />
                {!isConversationV2Family(props.familyId) && props.journeyDefinition && activeJourneyFocus && !props.journeyConversation ? (
                  <CompanionJourneyDiscoveryThread
                    companionName={props.name}
                    conversation={props.journeyConversation}
                    definition={props.journeyDefinition}
                    goals={props.journeyGoals}
                    onSetGoalStatus={props.onSetJourneyGoalStatus}
                    onOpenQuestionnaire={() => {
                      if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
                      experience.openJourneyQuestionnaire(props.journeyConversation?.id);
                      if (!props.journeyConversation) props.onStartJourneyConversation();
                    }}
                    showHeading={false}
                  />
                ) : !props.journeyDefinition ? (
                  <CompanionDiscoveryThread
                    answers={props.discoveryAnswers}
                    companionName={props.name}
                    onAnswer={props.onAnswerDiscovery}
                    onRemove={props.onRemoveDiscoveryAnswer}
                    onSetGoalStatus={props.onSetDiscoveryGoalStatus}
                    prompts={props.discoveryPrompts}
                    role={props.role}
                    showHeading={false}
                  />
                ) : null}
                </View>
              ) : destination === 'achievements' ? (
                <CompanionTrophyRoomScreen creatureId={props.creatureId} embedded />
              ) : destination === 'insight' ? (
                <CompanionInsightThread
                  currentFamilyId={props.familyId}
                  insight={props.insight}
                  insights={props.insights}
                  onRemoveInsight={props.onRemoveInsight}
                  onRetakeInsight={(definitionId) => {
                    props.onRetakeInsight(definitionId);
                    experience.showConversation();
                  }}
                />
              ) : destination === 'skins' ? (
                  <CompanionSkinsThread
                    activePlus={props.historyIsPlus}
                    companionName={props.name}
                  equippedSkinId={props.equippedSkinId}
                  onEquip={props.onEquipSkin}
                  showHeading={false}
                  skins={props.skins}
                />
              ) : null}
            </Animated.View>
          </ScrollView>
          )}
        </View>
        {visibleFooter ? <View style={styles.footer}>{visibleFooter}</View> : null}
        </CompanionDestinationSurface>
        </>
        )}
        <KatchaDialog
          body="This run will stop, but the quest stays active. You can reopen it from Do whenever you want."
          cancelLabel="Keep playing"
          confirmLabel="Exit game"
          onCancel={() => setEndAttemptOpen(false)}
          onConfirm={() => {
            const attemptId = activeAttemptId;
            setEndAttemptOpen(false);
            if (attemptId) props.onCancelQuestAttempt?.(attemptId);
            returnToQuest();
          }}
          open={endAttemptOpen}
          portal={false}
          surface="night"
          title="Exit this game?"
          tone="destructive"
        />
        <KatchaDialog
          body="This will leave the current quest and return to the full quest list. You can choose it again later."
          cancelLabel="Keep quest"
          confirmLabel="Back to quest list"
          onCancel={() => setLeaveQuestOpen(false)}
          onConfirm={() => {
            setLeaveQuestOpen(false);
            returnToQuest();
            props.onChooseAnotherQuest();
          }}
          open={leaveQuestOpen}
          portal={false}
          title="Leave this quest?"
          tone="destructive"
        />
        {props.active !== false && bondReward ? (
          <BondRewardFlightOverlay
            from={bondReward.from}
            onFinish={() => {
              if (rewardFinishTimerRef.current) clearTimeout(rewardFinishTimerRef.current);
              setDisplayedBondTotal(bondReward.receipt.afterTotal);
              setRewardPulseKey((key) => key + 1);
              rewardFinishTimerRef.current = setTimeout(() => {
                onBondCelebrationComplete(bondReward.receipt);
                setBondReward(null);
                rewardFinishTimerRef.current = null;
              }, reduceMotion ? 120 : 420);
            }}
            onTokenArrive={(amount) => {
              setDisplayedBondTotal((total) => Math.min(
                bondReward.receipt.afterTotal,
                (total ?? bondReward.receipt.beforeTotal) + amount
              ));
              setRewardPulseKey((key) => key + 1);
            }}
            points={bondReward.receipt.points}
            to={bondReward.to}
          />
        ) : null}
        </CompanionSheetShell>
  </>);
}

const styles = StyleSheet.create({
  contentFrame: { flex: 1, minHeight: 0 },
  destinationStageSpacer: { minHeight: 244 },
  youStageSpacer: { minHeight: 188 },
  scrollContent: { paddingBottom: 12, paddingHorizontal: 4 },
  activeScrollContent: { flexGrow: 1, paddingBottom: 0, paddingHorizontal: 0 },
  questionnaireScrollContent: { flexGrow: 1, paddingHorizontal: 0 },
  activeExperience: { flex: 1 },
  gameExperienceFrame: { flex: 1, minHeight: 0, position: 'relative', zIndex: 3 },
  gameLoading: { flex: 1, backgroundColor: '#11131B' },
  gameBackPosition: {
    left: 14,
    position: 'absolute',
    zIndex: 80,
  },
  openGameAction: { paddingTop: 12 },
  onboardingLoading: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,249,224,0.9)',
    borderColor: 'rgba(255,255,255,0.78)',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    bottom: 34,
    flexDirection: 'row',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 18,
    position: 'absolute',
    zIndex: 92,
  },
  onboardingLoadingText: { fontFamily: 'Manrope', fontSize: 14, fontWeight: '800' },
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
  quickGoalStack: { gap: 8, marginBottom: 12 },
  youStack: {
    backgroundColor: KatchaUI.companionPanel.background,
    borderColor: KatchaUI.companionPanel.border,
    borderCurve: 'continuous',
    borderRadius: 30,
    borderWidth: 1,
    boxShadow: KatchaUI.companionPanel.shadow,
    gap: 14,
    padding: 14,
    paddingBottom: 16,
  },
  footer: { backgroundColor: 'transparent', paddingBottom: 2, paddingHorizontal: 2, paddingTop: 7 },
  saved: { alignItems: 'center', gap: 8, justifyContent: 'center', minHeight: 220, paddingHorizontal: 24 },
  savedTitle: { fontSize: 24, fontWeight: '900' },
  savedBody: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
});
