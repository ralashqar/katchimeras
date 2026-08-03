import * as Haptics from 'expo-haptics';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Keyboard,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInLeft, FadeInRight, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KatchaDialog } from '@/components/katchadeck/ui/katcha-dialog';
import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';
import { useCompanionExperienceController } from '@/features/companion/use-companion-experience-controller';
import type { HomeVisualKey, MemoryQualityScore } from '@/types/home';
import type {
  CompanionDestination,
  CompanionInsight,
  CompanionQuestOfferViewModel,
  CompanionReflectionDraft,
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
import { CompanionHomeScene } from './companion-home-scene';
import { CompanionCinematicStage } from './companion-cinematic-stage';
import { CompanionGameBackdrop } from './companion-game-backdrop';
import { CompanionInsightThread } from './companion-insight-thread';
import { CompanionPrimaryAction } from './companion-interaction-primitives';
import {
  CompanionBackAction,
  CompanionDestinationHeader,
  CompanionDestinationSurface,
  CompanionSection,
  CompanionSheetShell,
} from './companion-ui-primitives';
import { CompanionQuestChoices, CompanionQuestThread } from './companion-quest-thread';
import type { InteractiveQuestExecution, QuestResult } from '@/utils/quests/experiences/types';
import type { CompanionBondProgress } from '@/utils/companion-bond';
import type { CompanionDailyInvitation } from '@/utils/companion-content';
import { CompanionSkinsThread } from './companion-skins-thread';
import type { KatchimeraFamilyId, KatchimeraSkinId } from '@/types/katchimera';
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
  dailyInvitation: CompanionDailyInvitation | null;
  onOpenDailyInvitation: () => void;
  onSkipDailyInvitation: () => void;
  onExperienceActiveChange?: (active: boolean) => void;
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
  onStartJourneyConversation: () => void;
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
  onCompleteQuickGoal: (goalId: string) => CompanionQuickGoalCompletion | null;
  onSkipQuickGoal: (goalId: string) => boolean;
  onSnoozeQuickGoal: (goalId: string) => boolean;
  onUndoQuickGoal: (goalId: string) => boolean;
  onRememberQuickGoal: (completion: CompanionQuickGoalCompletion, goal: CompanionQuickGoal) => void;
  quickGoalSuggestionIds: readonly string[];
  onAddQuickGoalSuggestions: (templateIds: readonly string[]) => readonly string[];
  onDismissQuickGoalSuggestions: () => void;
};

export function CompanionInteractionSheet(props: CompanionInteractionSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: viewportHeight } = useWindowDimensions();
  const onExperienceActiveChange = props.onExperienceActiveChange;
  const experience = useCompanionExperienceController({
    creatureId: props.creatureId,
    initialDestination: props.initialDestination,
    onClose: props.onClose,
    onSelectDestination: props.onSelectDestination,
  });
  const {
    activeAttemptId,
    checkInOpen,
    destination,
    direction,
    experienceInstance,
    journeyQuestionnaireOpen,
    journeyQuestionnaireSessionId,
    resetQuestExperience,
    questExperienceOpen,
    quickGoalPickerOpen,
    reviewItem: setReviewItem,
    reviewItemId,
    syncJourneySession,
    route,
  } = experience;
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
    if (route.kind === 'home' && !hasShownHome) {
      setHasShownHome(true);
    }
  }, [hasShownHome, route.kind]);

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
  const openDailyInvitation = () => {
    const invitation = props.dailyInvitation;
    if (!invitation) return;
    props.onOpenDailyInvitation();
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (invitation.destination === 'quest') {
      if (invitation.questId) props.onSelectOffer(invitation.questId);
      selectDestination('quest');
      return;
    }
    selectDestination('discovery');
    if (invitation.kind === 'focus_setup' || invitation.kind === 'resume_focus') {
      experience.openJourneyQuestionnaire(props.journeyConversation?.id);
      if (!props.journeyConversation) props.onStartJourneyConversation();
      return;
    }
    const checkIn = props.journeyCheckIn ?? props.onStartJourneyCheckIn();
    if (!checkIn) return;
    setActiveCheckIn(checkIn);
    experience.openCheckIn(checkIn.id);
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
      : destination === 'insight' && props.insight.action
        ? <CompanionPrimaryAction label={props.insight.action.label} icon={props.insight.action.icon} onPress={props.onInsightAction} />
      : null;
  const visibleFooter = quickGoalPickerOpen || questionnaireExperience ? null : actionFooter;
  const entering = reduceMotion ? FadeIn.duration(100) : direction > 0 ? FadeInRight.duration(210) : FadeInLeft.duration(210);
  const destinationLabel =
    destination === 'quest'
      ? 'Quests'
      : destination === 'discovery'
        ? 'You'
        : destination === 'goals'
          ? 'Goals'
          : destination === 'insight'
            ? 'Insight'
            : 'Skins';
  const questStatus = props.activeQuest
    ? 'Quest in progress'
    : props.offers.length
      ? `${props.offers.length} available`
      : 'All quiet for now';
  const youStatus = props.journeyCheckIn?.completedAt
    ? 'Today’s check-in saved'
    : props.journeyConversation
      ? 'Continue your questions'
      : 'Ready when you are';
  const goalStatus = !props.quickGoalsEnabled
    ? 'Coming soon'
    : goalsRemaining
      ? `${goalsRemaining} to-do`
      : goalsToday.length
        ? 'All done today'
        : 'Choose a small step';
  const destinationHeroTitle = destination === 'quest'
    ? props.activeQuest
      ? 'Ready to keep going?'
      : 'Ready for a little adventure?'
    : destination === 'discovery'
      ? props.journeyConversation
        ? 'Let’s pick up where we left off.'
        : !activeJourneyFocus
          ? 'What would you like to shape?'
          : props.journeyCheckIn?.completedAt
            ? 'I’ll keep today in mind.'
            : 'How did today feel?'
      : destination === 'goals'
        ? 'What feels doable today?'
        : destination === 'insight'
          ? 'Here’s what I noticed.'
          : 'Which form feels like me?';
  const destinationHeroBody = destination === 'discovery'
    ? activeJourneyFocus
      ? 'Check in for today, or adjust the focus you are working on together.'
      : `A few quick choices help ${props.name} understand what would be useful right now.`
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
        ) : (route.kind === 'destination' || quickGoalPickerOpen) && !questionnaireExperience ? (
          <CompanionCinematicStage
            bubbleBody={quickGoalPickerOpen ? 'Choose one for today, or make a small goal of your own.' : destinationHeroBody}
            bubbleVariant={destination === 'discovery' || quickGoalPickerOpen ? 'questionnaire' : 'default'}
            creature={visual.source}
            environmentKey={props.homeEnvironmentKey ?? null}
            lifted
            name={props.name}
            showSpeechBubble
            title={quickGoalPickerOpen ? 'Which small step feels right?' : destinationHeroTitle}
            visualKey={props.visualKey}
          />
        ) : null}
        {route.kind === 'home' ? (
          <CompanionHomeScene
            animateEntrance={!hasShownHome}
            bondProgress={props.bondProgress}
            creature={visual.source}
            dailyInvitation={props.dailyInvitation?.status === 'offered' || props.dailyInvitation?.status === 'opened'
              ? props.dailyInvitation
              : null}
            environmentKey={props.homeEnvironmentKey ?? null}
            goalStatus={goalStatus}
            name={props.name}
            onClose={props.onClose}
            onOpenDailyInvitation={openDailyInvitation}
            onSkipDailyInvitation={props.onSkipDailyInvitation}
            onSelectDestination={selectDestination}
            questStatus={questStatus}
            showSkins={props.skins.length > 1}
            visualKey={props.visualKey}
            youStatus={youStatus}
          />
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
        {(route.kind === 'destination' || quickGoalPickerOpen) && !questGameVisible && !questionnaireExperience ? (
          <CompanionDestinationHeader
            backLabel={quickGoalPickerOpen ? 'Goals' : destination === 'quest' && canReturnToQuestList ? 'Quest list' : 'Home'}
            label={destinationLabel}
            onBack={
              quickGoalPickerOpen
                ? experience.returnToDestination
                : destination === 'quest' && canReturnToQuestList
                ? () => setLeaveQuestOpen(true)
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
              {(route.kind === 'destination' || quickGoalPickerOpen) && !questionnaireExperience ? (
                <View
                  accessibilityElementsHidden
                  pointerEvents="none"
                  style={[
                    styles.destinationStageSpacer,
                    destination === 'discovery' && styles.youStageSpacer,
                    destination === 'quest' && {
                      minHeight: companionQuestListSpacer(viewportHeight),
                    },
                  ]}
                />
              ) : null}
              {checkInOpen && activeCheckIn ? (
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
                  <ThemedText style={styles.savedBody} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>{props.name} will remember that with you.</ThemedText>
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
              ) : destination === 'discovery' ? (
                <View style={styles.youStack}>
                {props.journeyDefinition && (!activeJourneyFocus || props.journeyConversation) ? (
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
                    emphasized={Boolean(activeJourneyFocus && !props.journeyConversation)}
                    onOpen={() => {
                      if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
                      const checkIn = props.journeyCheckIn ?? props.onStartJourneyCheckIn();
                      if (!checkIn) return;
                      setActiveCheckIn(checkIn);
                      experience.openCheckIn(checkIn.id);
                    }}
                  />
                {props.journeyDefinition && activeJourneyFocus && !props.journeyConversation ? (
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
              ) : destination === 'goals' ? (
                quickGoalPanel ?? (
                  <CompanionSection
                    description="Small goals will appear here when this companion supports them."
                    label="Goals are coming soon">
                    <View />
                  </CompanionSection>
                )
              ) : destination === 'insight' ? (
                <CompanionInsightThread insight={props.insight} />
              ) : destination === 'skins' ? (
                <CompanionSkinsThread
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
  quickGoalStack: { gap: 8, marginBottom: 12 },
  youStack: {
    backgroundColor: '#211A13',
    borderColor: 'rgba(248,220,165,0.2)',
    borderCurve: 'continuous',
    borderRadius: 30,
    borderWidth: 1,
    boxShadow: '0 18px 42px rgba(31,20,10,0.34), inset 0 1px 0 rgba(255,255,255,0.06)',
    gap: 14,
    padding: 18,
    paddingBottom: 20,
  },
  footer: { backgroundColor: 'transparent', paddingBottom: 2, paddingHorizontal: 2, paddingTop: 7 },
  saved: { alignItems: 'center', gap: 8, justifyContent: 'center', minHeight: 220, paddingHorizontal: 24 },
  savedTitle: { fontSize: 24, fontWeight: '900' },
  savedBody: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
});
