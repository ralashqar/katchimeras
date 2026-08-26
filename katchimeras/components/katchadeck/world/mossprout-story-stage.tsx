import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Pressable, StyleSheet, View, type View as ViewType } from 'react-native';
import type { GestureType } from 'react-native-gesture-handler';
import Animated, { FadeIn } from 'react-native-reanimated';

import { PersistentMergeItemArt } from '@/components/katchadeck/games/feastle-persistent-merge-board';
import {
  DayActionCardSurface,
  DayActionIcon,
  DayActionRewardChip,
} from '@/components/katchadeck/ui/day-action-card';
import { DayActionActiveRow, DayActionCompletedRow, type DayActionSourceRect } from '@/components/katchadeck/ui/day-action-row';
import { DayActionGoalRow } from '@/components/katchadeck/ui/day-action-goal-row';
import { GameSurface } from '@/components/katchadeck/ui/game-surface';
import { QuickGoalActionModal } from '@/components/katchadeck/goals/quick-goal-action-modal';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { GAME_CURRENCY_ART } from '@/constants/game-currency-art';
import { katchimeraActionArt } from '@/constants/katchimera-action-art';
import { Meadow } from '@/constants/meadow-theme';
import { composeMossproutVisibleActions, mossproutActionOrigin, mossproutGoalArtKey, resolveMossproutDayActions, type MossproutActionGardenRequest } from '@/game/katchimeras/mossprout-home';
import { mossproutJourneyDayNumber } from '@/game/katchimeras/mossprout-journey-handoff';
import {
  acknowledgeKatchimeraDayActionOutro,
  beginMossproutJourneyReturn,
  completeMossproutJourneyConversation,
  makeMossproutResolutionAvailable,
  isMossproutFtueRoutineActionId,
  mossproutDailyActionDeck,
  mossproutJourneyForDay,
  mossproutJourneyRuntimeDayId,
  mossproutStory,
  reconcileMossproutDayOneChoices,
  recordKatchimeraActionCompletion,
  recordHandledKatchimeraActionCompletion,
  skipKatchimeraDayAction,
  startMossproutJourneyActivity,
  startMossproutJourneyDay,
} from '@/game/katchimeras/relationship-progression';
import { useOptionalMergeWorldState } from '@/features/merge-world/merge-world-provider';
import { useGameScreenTransition } from '@/features/navigation/game-screen-transition';
import { useKatchimeraActionStackTransition } from '@/hooks/use-katchimera-action-transition';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';
import type { CompanionQuestOfferViewModel } from '@/types/companion-interaction';
import type { KatchimeraActionOrigin, KatchimeraDayAction, RelationshipProgressState } from '@/types/relationship-progression';
import type { ConversationSession } from '@/types/companion-conversation';
import type { MergeWorldState } from '@/types/merge-world';
import type { CompanionQuickGoalCompletionReceipt } from '@/hooks/use-companion-quick-goals';
import type { CompanionQuickGoalCompletion, CompanionQuickGoalForDay } from '@/utils/companion-quick-goals';
import { acquireLifecycleResource } from '@/utils/lifecycle-performance';
import { loadMergeWorldState, subscribeMergeWorldSnapshots } from '@/utils/merge-world/repository';
import { localDayId } from '@/utils/world-identity';
import { isJourneyQuickModeEnabled } from '@/utils/dev-settings';
import { mossproutCampaignEpisodeByBeatId } from '@/constants/mossprout-campaign';
import { RESIDENT_CARD_DEFINITION_ID } from '@/constants/resident-card-discovery';

import type { CompanionChatStarter } from './companion-chat-lobby';
import { KatchimeraBottomDock } from './katchimera-bottom-dock';
import { KatchimeraJourneyStatusPlaque } from './katchimera-journey-status-plaque';
import { MossproutJourneyRequestPanel } from './mossprout-journey-request-panel';

const MAX_ORDER_ART_ITEMS = 3;
const MAX_VISIBLE_ACTIONS = 3;
const ACTION_STACK_HEIGHT = 212;
const ACTION_TRAY_HEIGHT = 284;
const JOURNEY_REQUEST_TRAY_HEIGHT = 348;
const RESIDENT_PARCEL_REQUESTS = [{
  id: 'mossprout:resident-parcel',
  title: 'A veiled parcel',
  description: 'A sealed resident card is waiting inside.',
  definitionIds: [RESIDENT_CARD_DEFINITION_ID],
}] as const;

function useMossproutMergeWorldState() {
  const providedMergeWorld = useOptionalMergeWorldState();
  const [storedState, setStoredState] = useState<MergeWorldState | null>(null);
  const [storedStateReady, setStoredStateReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    const adopt = (nextState: MergeWorldState) => {
      if (!mounted) return;
      setStoredState((current) => !current || nextState.revision > current.revision ? nextState : current);
      setStoredStateReady(true);
    };
    const release = acquireLifecycleResource('store_subscription', 'mossprout:merge-world-snapshots');
    const unsubscribe = subscribeMergeWorldSnapshots(adopt);
    void loadMergeWorldState().then(adopt).catch((error) => {
      console.warn('Could not load Mossprout Garden orders', error);
      if (mounted) setStoredStateReady(true);
    });
    return () => {
      mounted = false;
      unsubscribe();
      release();
    };
  }, []);

  const providedState = providedMergeWorld?.state ?? null;
  const state = providedState && (!storedState || providedState.revision >= storedState.revision)
    ? providedState
    : storedState;
  return { ready: Boolean(providedState) || storedStateReady, state };
}

export function MossproutStoryStage({
  activeQuestId,
  conversationSession,
  conversations,
  goals,
  hasActiveFocus,
  offers,
  relationships,
  onCompleteGoal,
  onRememberGoal,
  onSkipGoal,
  onSnoozeGoal,
  onUndoGoal,
  onDashboard,
  onOpenConversation,
  onOpenCards,
  onOpenFocusDirection,
  onOpenMerge,
  onOpenQuestDirect,
  onOpenTrophies,
  onBondRewardRequest,
  dayOneActionChoiceActive = false,
  dayOneLessonCompleted = false,
  actionStackTargetRef,
  navigationLocked = false,
  tutorialInteractionLocked = false,
  residentParcelHandoffActive = false,
  residentStoryResumeActive = false,
  residentStoryResumeTitle = 'Continue story',
  onResumeResidentStory,
  motionReady,
  swipeExternalGesture,
}: {
  activeQuestId?: string | null;
  conversationSession: ConversationSession | null;
  conversations: readonly CompanionChatStarter[];
  goals: readonly CompanionQuickGoalForDay[];
  hasActiveFocus: boolean;
  offers: CompanionQuestOfferViewModel[];
  relationships: RelationshipProgressState;
  onCompleteGoal: (goalId: string) => CompanionQuickGoalCompletionReceipt;
  onRememberGoal: (completion: CompanionQuickGoalCompletion, goal: CompanionQuickGoalForDay['goal']) => void;
  onSkipGoal: (goalId: string) => boolean;
  onSnoozeGoal: (goalId: string) => boolean;
  onUndoGoal: (goalId: string) => boolean;
  onDashboard: () => void;
  onOpenConversation: (definitionId: string, actionOrigin?: KatchimeraActionOrigin) => void;
  onOpenCards: () => void;
  onOpenFocusDirection: () => void;
  onOpenMerge: (orderId?: string | null) => void;
  onOpenQuestDirect: (questId: string, originActionId: string) => void;
  onOpenTrophies: () => void;
  onBondRewardRequest: (source: DayActionSourceRect, onArrive: () => void, receipt?: NonNullable<KatchimeraDayAction['rewardReceipt']>) => void;
  dayOneActionChoiceActive?: boolean;
  dayOneLessonCompleted?: boolean;
  actionStackTargetRef?: RefObject<ViewType | null>;
  navigationLocked?: boolean;
  tutorialInteractionLocked?: boolean;
  residentParcelHandoffActive?: boolean;
  residentStoryResumeActive?: boolean;
  residentStoryResumeTitle?: string;
  onResumeResidentStory?: () => void;
  motionReady: boolean;
  swipeExternalGesture?: GestureType;
}) {
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [selfCompletingGoalAction, setSelfCompletingGoalAction] = useState<KatchimeraDayAction | null>(null);
  const selectedGoalCompletionRef = useRef<(() => void) | null>(null);
  const actionSlotDebugRef = useRef('');
  const { phase: screenTransitionPhase } = useGameScreenTransition();
  const { ready: mergeWorldReady, state: mergeWorldState } = useMossproutMergeWorldState();
  const quickMode = isJourneyQuickModeEnabled();
  const dayId = mossproutJourneyRuntimeDayId(relationships, localDayId(), quickMode);
  const journey = mossproutJourneyForDay(relationships, dayId);
  const journeyExclusive = Boolean(journey && journey.status !== 'complete');
  const journeyDayNumber = mossproutJourneyDayNumber(relationships, dayId);
  const story = mossproutStory(relationships);
  const storyComplete = story.activeBeatId === 'heartwood:complete';
  const dayOneChoiceActionIds = useMemo(() => journey?.beatId === 'quiet-patch:first-flower'
    ? journey.actions.filter((action) => action.kind !== 'journey').map((action) => action.id)
    : [], [journey?.actions, journey?.beatId]);
  const mossproutOrders = useMemo(() => (mergeWorldState?.activeOrders ?? [])
    .filter((order) => order.characterId === 'mossprout')
    .map((order): MossproutActionGardenRequest => ({
      id: order.id,
      title: order.title,
      description: order.description ?? (order.requirements.length > 1 ? 'Make this little combination for the Garden.' : 'Mossprout found a place for this.'),
      difficulty: order.difficulty,
      requirements: order.requirements,
      coins: order.reward.coins,
      storyStep: order.storyStep,
      storyStepCount: order.storyStepCount,
    })), [mergeWorldState?.activeOrders]);
  const gardenRequests = useMemo(() => mossproutOrders.filter((order) => (
    mergeWorldState?.activeOrders.find((candidate) => candidate.id === order.id)?.storyArcId === 'mossprout:casual-garden'
  )), [mergeWorldState?.activeOrders, mossproutOrders]);
  const journeyGardenRequest = useMemo(() => {
    const orderIds = journey?.activity?.mergeOrderIds ?? (journey?.activity ? [journey.activity.mergeOrderId] : []);
    return orderIds.length ? mossproutOrders.find((order) => orderIds.includes(order.id)) ?? null : null;
  }, [journey?.activity, mossproutOrders]);
  const journeyMergeActive = journey?.status === 'activity_available' || journey?.status === 'activity_in_progress';
  const journeyEpisode = journey ? mossproutCampaignEpisodeByBeatId.get(journey.beatId) : null;
  const journeyRequestPreviews = useMemo(() => {
    if (!journeyMergeActive || !journeyEpisode) return [];
    const servedOrderIds = new Set(journey?.activity?.servedOrderIds ?? []);
    return journeyEpisode.mergeOrders.map((order, index, orders) => ({
      id: order.id,
      badge: orders.length > 1 ? `${index + 1} OF ${orders.length}` : undefined,
      title: order.title,
      description: order.description,
      definitionIds: order.requirements.map((requirement) => requirement.definitionId),
      quantity: order.requirements.length === 1 ? order.requirements[0]?.quantity : undefined,
      served: servedOrderIds.has(order.id),
    }));
  }, [journey?.activity?.servedOrderIds, journeyEpisode, journeyMergeActive]);

  useEffect(() => {
    if (!dayOneActionChoiceActive || journey?.beatId !== 'quiet-patch:first-flower') return;
    relationshipProgressionRepository.update(reconcileMossproutDayOneChoices);
  }, [dayOneActionChoiceActive, journey?.beatId, journey?.id, journey?.actions.length]);

  useEffect(() => {
    if (journey?.status !== 'living' || (journey.resolutionAvailableAt ?? Infinity) > Date.now()) return;
    relationshipProgressionRepository.update((current) => makeMossproutResolutionAvailable(current, dayId));
  }, [dayId, journey?.resolutionAvailableAt, journey?.status]);

  const actions = useMemo(() => resolveMossproutDayActions({
    activeQuestId,
    conversations,
    consumedActionIds: mossproutDailyActionDeck(relationships, dayId).consumedActionIds,
    dayId,
    dayOneLessonCompleted,
    gardenRequests,
    goals: goals.map((item) => ({ id: item.goal.id, templateId: item.goal.templateId, title: item.goal.title, completed: Boolean(item.completion) })),
    hasActiveFocus,
    includeActionIds: dayOneActionChoiceActive ? dayOneChoiceActionIds : undefined,
    journey,
    journeyDayNumber,
    journeyGardenRequest,
    offers,
    skippedActionIds: relationships.skippedActionIds,
    slotSequences: mossproutDailyActionDeck(relationships, dayId).slotSequences,
    storyComplete,
  }), [activeQuestId, conversations, dayId, dayOneActionChoiceActive, dayOneChoiceActionIds, dayOneLessonCompleted, gardenRequests, goals, hasActiveFocus, journey, journeyDayNumber, journeyGardenRequest, offers, relationships, storyComplete]);
  // The Day 1 Bond lesson temporarily scopes the normal resolver to its three
  // authored relationship choices. Coin-only requests remain in the Garden
  // and return to this rotation after FTUE completes.
  const presentedActionCandidates = actions;

  useEffect(() => {
    relationshipProgressionRepository.update((current) => goals.reduce((state, item) => {
      if (!item.completion) return state;
      const actionId = `mossprout:goal:${item.goal.id}`;
      if (state.actionCompletionEvents.some((event) => event.source.dayId === dayId && event.source.actionId === actionId)) return state;
      const slotId = 'together';
      const sequence = mossproutDailyActionDeck(state, dayId).slotSequences[slotId];
      const instanceId = `${dayId}:${slotId}:${sequence}:${actionId}`;
      return recordKatchimeraActionCompletion(state, {
        dayId, familyId: 'mossprout', actionId, instanceId, slotId, sequence, kind: 'goal_checkoff',
        title: item.goal.title, subtitle: 'A small promise kept', icon: 'checkmark.circle.fill', artKey: mossproutGoalArtKey(item.goal.templateId), artworkDefinitionIds: [],
        reward: { kind: 'bond', amount: 5 }, completedAt: Date.now(),
      });
    }, current));
  }, [dayId, goals]);

  useEffect(() => {
    relationshipProgressionRepository.update((current) => offers.reduce((state, offer) => {
      if (!offer.completedToday || !['quest-mossprout-green-photo', 'quest-mossprout-nature-note'].includes(offer.id)) return state;
      const photo = offer.family === 'photo';
      const actionId = `mossprout:quest:${offer.id}`;
      if (state.actionCompletionEvents.some((event) => event.source.dayId === dayId && event.source.actionId === actionId)) return state;
      const sequence = mossproutDailyActionDeck(state, dayId).slotSequences.field;
      return recordKatchimeraActionCompletion(state, {
        dayId, familyId: 'mossprout', actionId, instanceId: `${dayId}:field:${sequence}:${actionId}`, slotId: 'field', sequence, kind: photo ? 'photo_request' : 'note_request',
        title: offer.title, subtitle: photo ? 'Nature moment captured' : 'Nature note remembered',
        icon: photo ? 'camera.fill' : 'square.and.pencil', artKey: photo ? 'today:photo' : 'today:reflection', artworkDefinitionIds: [],
        reward: { kind: 'bond', amount: offer.bondReward }, completedAt: Date.now(),
      });
    }, current));
  }, [dayId, offers]);

  const externalCompletions = useMemo(() => relationships.actionCompletionEvents
    .filter((event) => event.source.familyId === 'mossprout'
      && !event.acknowledgedAt
      && !isMossproutFtueRoutineActionId(event.source.actionId)
      && event.source.presentation === 'action_card')
    .sort((left, right) => left.completedAt - right.completedAt || left.id.localeCompare(right.id))
    .map((event) => ({
      id: event.source.actionId, kind: event.source.kind, title: event.source.title, subtitle: event.source.subtitle,
      icon: event.source.icon, artKey: event.source.artKey, instanceId: event.source.instanceId,
      sourceSlotId: event.source.sourceSlotId, slotId: event.source.slotId, sequence: event.source.sequence,
      artworkDefinitionId: event.source.artworkDefinitionIds[0], artworkDefinitionIds: event.source.artworkDefinitionIds,
      required: false, disabled: true, status: 'completed' as const, reward: event.source.reward,
      destination: { kind: 'journey' as const }, completedAt: event.completedAt, outroAcknowledgedAt: null,
      completionEventId: event.id, rewardReceipt: event.rewardReceipt,
    } satisfies KatchimeraDayAction)),
  [relationships.actionCompletionEvents]);

  const completingAction = useMemo(() => {
    const byPresentationId = new Map<string, KatchimeraDayAction>();
    // Journey exclusivity hides optional actions, but must not erase the
    // completion/reward sequence for an action the player explicitly ran
    // through developer tooling or another direct launch path.
    for (const action of externalCompletions) {
      byPresentationId.set(action.instanceId ?? action.id, action);
    }
    const slotOrder = { together: 0, field: 1, garden: 2 } as const;
    return [...byPresentationId.values()].sort((left, right) =>
      (left.completedAt ?? Number.MAX_SAFE_INTEGER) - (right.completedAt ?? Number.MAX_SAFE_INTEGER)
      || slotOrder[left.slotId ?? 'together'] - slotOrder[right.slotId ?? 'together']
      || (left.instanceId ?? left.id).localeCompare(right.instanceId ?? right.id)
    )[0] ?? null;
  }, [externalCompletions]);

  const resolvedVisibleActions = composeMossproutVisibleActions(presentedActionCandidates, completingAction, MAX_VISIBLE_ACTIONS);
  const residentResumeAction = useMemo(() => ({
    id: 'mossprout:resident-story-resume',
    instanceId: 'mossprout:resident-story-resume',
    slotId: 'together' as const,
    sequence: 0,
    kind: 'story_chat' as const,
    title: residentStoryResumeTitle,
    subtitle: 'Return to the resident waiting in the Garden',
    icon: 'sparkles' as const,
    artKey: 'mossprout:journey' as const,
    required: true,
    disabled: false,
    status: 'active' as const,
    reward: null,
    destination: { kind: 'garden' as const, orderId: null },
    completedAt: null,
    outroAcknowledgedAt: null,
  } satisfies KatchimeraDayAction), [residentStoryResumeTitle]);
  const actionId = useCallback((action: KatchimeraDayAction) => action.completionEventId ?? action.instanceId ?? `${dayId}:${action.id}`, [dayId]);
  const sourceActions = useMemo(() => {
    if (residentStoryResumeActive) return [residentResumeAction];
    if (journeyExclusive) return resolvedVisibleActions;
    if (!selfCompletingGoalAction) return resolvedVisibleActions;
    const selfId = actionId(selfCompletingGoalAction);
    if (resolvedVisibleActions.some((action) => actionId(action) === selfId)) {
      return resolvedVisibleActions.map((action) => actionId(action) === selfId ? selfCompletingGoalAction : action);
    }
    const replacementIndex = resolvedVisibleActions.findIndex((action) => action.slotId === selfCompletingGoalAction.slotId);
    if (replacementIndex >= 0) {
      return resolvedVisibleActions.map((action, index) => index === replacementIndex ? selfCompletingGoalAction : action);
    }
    const insertionIndex = Math.min(
      resolvedVisibleActions.length,
      selfCompletingGoalAction.slotId === 'field' ? 1 : selfCompletingGoalAction.slotId === 'garden' ? 2 : 0,
    );
    return [
      ...resolvedVisibleActions.slice(0, insertionIndex),
      selfCompletingGoalAction,
      ...resolvedVisibleActions.slice(insertionIndex),
    ].slice(0, MAX_VISIBLE_ACTIONS);
  }, [actionId, journeyExclusive, residentResumeAction, residentStoryResumeActive, resolvedVisibleActions, selfCompletingGoalAction]);

  const finishActionOutro = useCallback((action: KatchimeraDayAction) => {
    relationshipProgressionRepository.update((current) => acknowledgeKatchimeraDayActionOutro(current, dayId, action));
  }, [dayId]);
  const actionTransition = useKatchimeraActionStackTransition({
    acknowledgeCompletion: finishActionOutro,
    getId: actionId,
    isCompleted: (action: KatchimeraDayAction) => action.status === 'completed',
    items: sourceActions,
    ready: motionReady && mergeWorldReady && screenTransitionPhase === 'idle',
  });

  const openJourney = (sourceAction?: KatchimeraDayAction) => {
    if (!journey) {
      const activeDayCount = mergeWorldState?.mossproutBoardProgression.activeDayIds.length ?? 0;
      const started = relationshipProgressionRepository.update((current) => startMossproutJourneyDay(current, dayId, Date.now(), activeDayCount, quickMode).state);
      const startedJourney = mossproutJourneyForDay(started, dayId);
      if (!startedJourney) return;
      const opening = startedJourney.openingConversationId;
      const mainAction = startedJourney.actions.find((candidate) => candidate.kind === 'journey');
      const origin = sourceAction && mainAction
        ? mossproutActionOrigin({ ...sourceAction, id: mainAction.id }, dayId, startedJourney)
        : undefined;
      if (opening) onOpenConversation(opening, origin);
      return;
    }
    if (journey.status === 'opening' && journey.openingConversationId) {
      // A completed opening can briefly outlive its relationship handoff when
      // the player returns home immediately. Repair that handoff here instead
      // of explicitly launching the once-only opening a second time.
      if (
        conversationSession?.definitionId === journey.openingConversationId
        && conversationSession.status === 'completed'
      ) {
        const repaired = relationshipProgressionRepository.update((current) => completeMossproutJourneyConversation(
          current,
          conversationSession,
          conversationSession.completedAt ?? conversationSession.updatedAt,
        ));
        const repairedJourney = mossproutJourneyForDay(repaired, dayId);
        if (repairedJourney?.status === 'activity_available') {
          relationshipProgressionRepository.update((current) => startMossproutJourneyActivity(current, dayId));
          return onOpenMerge(journeyGardenRequest?.id ?? repairedJourney.activity?.mergeOrderId);
        }
      }
      return onOpenConversation(journey.openingConversationId, sourceAction ? mossproutActionOrigin(sourceAction, dayId, journey) : undefined);
    }
    if (journey.status === 'profile_available' && journey.profileConversationId) return onOpenConversation(journey.profileConversationId, sourceAction ? mossproutActionOrigin(sourceAction, dayId, journey) : undefined);
    if (journey.status === 'activity_available') {
      relationshipProgressionRepository.update((current) => startMossproutJourneyActivity(current, dayId));
      return onOpenMerge(journeyGardenRequest?.id ?? journey.activity?.mergeOrderId);
    }
    if (journey.status === 'activity_in_progress') return onOpenMerge(journeyGardenRequest?.id ?? journey.activity?.mergeOrderId ?? 'mossprout:chapter-0:first-sprout');
    if (journey.status === 'return_available') {
      const next = relationshipProgressionRepository.update((current) => beginMossproutJourneyReturn(current, dayId));
      const returning = mossproutJourneyForDay(next, dayId);
      if (returning?.returnConversationId) onOpenConversation(returning.returnConversationId, sourceAction ? mossproutActionOrigin(sourceAction, dayId, returning) : undefined);
      return;
    }
    if (journey.status === 'resolution_ready' && journey.returnConversationId) return onOpenConversation(journey.returnConversationId, sourceAction ? mossproutActionOrigin(sourceAction, dayId, journey) : undefined);
    if (journey.status === 'living') {
      const next = relationshipProgressionRepository.update((current) => makeMossproutResolutionAvailable(current, dayId, { force: new Date().getHours() >= 21 }));
      const returning = mossproutJourneyForDay(next, dayId);
      if (returning?.returnConversationId) onOpenConversation(returning.returnConversationId, sourceAction ? mossproutActionOrigin(sourceAction, dayId, returning) : undefined);
    }
  };

  const openAction = (action: KatchimeraDayAction) => {
    if (action.disabled || action.status === 'completed') return;
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    if (residentStoryResumeActive && action.id === residentResumeAction.id) return onResumeResidentStory?.();
    if (action.destination.kind === 'journey') return openJourney(action);
    if (action.destination.kind === 'focus_questionnaire') return onOpenFocusDirection();
    if (action.destination.kind === 'conversation') return onOpenConversation(action.destination.definitionId, mossproutActionOrigin(action, dayId, journey));
    if (action.destination.kind === 'garden') {
      if (journey?.status === 'activity_available') {
        relationshipProgressionRepository.update((current) => startMossproutJourneyActivity(current, dayId));
      }
      return onOpenMerge(action.destination.orderId);
    }
    if (action.destination.kind === 'quest') return onOpenQuestDirect(action.destination.questId, action.id);
  };
  const openJourneyGarden = () => {
    if (!journey?.activity) return;
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    if (journey.status === 'activity_available') {
      relationshipProgressionRepository.update((current) => startMossproutJourneyActivity(current, dayId));
    }
    const orderId = journey.activity.mergeOrderIds?.find((candidate) => (
      !journey.activity?.servedOrderIds?.includes(candidate)
    )) ?? journey.activity.mergeOrderId;
    onOpenMerge(orderId);
  };

  const completeGoalAction = useCallback((
    action: KatchimeraDayAction,
    source: DayActionSourceRect | null,
    onRewardArrive: () => void,
  ) => {
    if (action.destination.kind !== 'goal') return;
    const goalId = action.destination.goalId;
    const goal = goals.find((item) => item.goal.id === goalId)?.goal;
    const receipt = onCompleteGoal(goalId);
    if (goal) relationshipProgressionRepository.update((current) => {
      const slotId = action.slotId ?? 'together';
      const sequence = action.sequence ?? mossproutDailyActionDeck(current, dayId).slotSequences[slotId];
      const instanceId = action.instanceId ?? `${dayId}:${slotId}:${sequence}:${action.id}`;
      return recordHandledKatchimeraActionCompletion(current, {
        dayId,
        familyId: 'mossprout',
        actionId: action.id,
        instanceId,
        slotId,
        sequence,
        kind: 'goal_checkoff',
        title: action.title,
        subtitle: 'A small promise kept',
        icon: 'checkmark.circle.fill',
        artKey: mossproutGoalArtKey(goal.templateId),
        artworkDefinitionIds: [],
        reward: action.reward,
        completedAt: Date.now(),
      });
    });
    if (receipt.bondAward && source) onBondRewardRequest(source, onRewardArrive);
    else onRewardArrive();
  }, [dayId, goals, onBondRewardRequest, onCompleteGoal]);

  const selectedGoal = selectedGoalId
    ? goals.find((item) => item.goal.id === selectedGoalId) ?? null
    : null;
  const presentedActions = actionTransition.items;
  const stackInteractionLocked = tutorialInteractionLocked || actionTransition.interactionLocked || Boolean(selfCompletingGoalAction);

  useEffect(() => {
    if (typeof __DEV__ === 'undefined' || !__DEV__) return;
    const summarizeAction = (action: KatchimeraDayAction, index?: number) => ({
      ...(index == null ? {} : { index }),
      id: action.id,
      instanceId: action.instanceId ?? null,
      kind: action.kind,
      sourceSlotId: action.sourceSlotId ?? null,
      slotId: action.slotId ?? null,
      sequence: action.sequence ?? null,
      status: action.status,
      disabledByAction: action.disabled,
      disabledWhenRendered: action.disabled || stackInteractionLocked,
      destination: action.destination.kind,
      completionEventId: action.completionEventId ?? null,
    });
    const deck = mossproutDailyActionDeck(relationships, dayId);
    const snapshot = {
      source: 'action-stage',
      dayId,
      ftue: {
        dayOneActionChoiceActive,
        dayOneLessonCompleted,
      },
      readiness: {
        motionReady,
        mergeWorldReady,
        screenTransitionPhase,
      },
      locks: {
        navigationLocked,
        tutorialInteractionLocked,
        transitionInteractionLocked: actionTransition.interactionLocked,
        stackInteractionLocked,
        selfCompletingGoalActionId: selfCompletingGoalAction?.id ?? null,
      },
      journey: journey ? {
        id: journey.id,
        beatId: journey.beatId,
        status: journey.status,
        exclusive: journeyExclusive,
        actions: journey.actions.map((action) => ({
          id: action.id,
          definitionId: action.definitionId,
          kind: action.kind,
          status: action.status,
          outroAcknowledged: Boolean(action.outroAcknowledgedAt),
        })),
      } : null,
      resolverInput: {
        hasActiveFocus,
        unfinishedGoalIds: goals.filter((goal) => !goal.completion).map((goal) => goal.goal.id),
        includedActionIds: dayOneActionChoiceActive ? dayOneChoiceActionIds : [],
        conversationCandidates: conversations.map((conversation) => ({
          definitionId: conversation.definitionId,
          mode: conversation.mode,
          actionKind: conversation.actionKind ?? null,
        })),
        gardenRequestIds: gardenRequests.map((request) => request.id),
        offerIds: offers.map((offer) => offer.id),
        consumedActionIds: deck.consumedActionIds,
        slotSequences: deck.slotSequences,
        skippedActionIds: relationships.skippedActionIds,
      },
      pipeline: {
        resolved: actions.map((action) => summarizeAction(action)),
        externalCompletions: externalCompletions.map((action) => summarizeAction(action)),
        completingAction: completingAction ? summarizeAction(completingAction) : null,
        visible: resolvedVisibleActions.map((action) => summarizeAction(action)),
        source: sourceActions.map((action) => summarizeAction(action)),
        transitionPhase: actionTransition.phase,
        rendered: presentedActions.map((action, index) => summarizeAction(action, index)),
      },
    };
    const serialized = JSON.stringify(snapshot);
    if (serialized === actionSlotDebugRef.current) return;
    actionSlotDebugRef.current = serialized;
    console.info('[mossprout-action-slots]', serialized);
  }, [
    actionTransition.interactionLocked,
    actionTransition.phase,
    actions,
    completingAction,
    conversations,
    dayId,
    dayOneActionChoiceActive,
    dayOneChoiceActionIds,
    dayOneLessonCompleted,
    externalCompletions,
    gardenRequests,
    goals,
    hasActiveFocus,
    journey,
    journeyExclusive,
    mergeWorldReady,
    motionReady,
    navigationLocked,
    offers,
    presentedActions,
    relationships,
    resolvedVisibleActions,
    screenTransitionPhase,
    selfCompletingGoalAction,
    sourceActions,
    stackInteractionLocked,
    tutorialInteractionLocked,
  ]);

  return <View style={[
    styles.stage,
    residentParcelHandoffActive
      ? styles.residentParcelStage
      : journeyMergeActive && !residentStoryResumeActive
        ? styles.journeyRequestStage
        : styles.actionStage,
  ]}>
    {journey && !storyComplete && !journeyMergeActive && !residentParcelHandoffActive && !residentStoryResumeActive ? (
      <KatchimeraJourneyStatusPlaque
        dayNumber={journeyDayNumber}
        revealKey={journey.id}
        status={journey.status === 'complete' ? 'complete' : 'in_progress'}
      />
    ) : null}
    {residentParcelHandoffActive ? <View ref={actionStackTargetRef} style={styles.residentParcelPanel}>
      <MossproutJourneyRequestPanel
        actionLabel="Go to the Garden"
        animateEntrance={false}
        countLabel="1 parcel"
        disabled={tutorialInteractionLocked}
        eyebrow="GARDEN PARCEL"
        fitContent
        onAction={onResumeResidentStory}
        requests={RESIDENT_PARCEL_REQUESTS}
        standalone
        title="Someone answered from the Garden"
      />
    </View> : journeyMergeActive && journeyEpisode && !residentStoryResumeActive ? <View ref={actionStackTargetRef} style={styles.journeyRequestPanel}>
      <MossproutJourneyRequestPanel
        actionLabel={journey.status === 'activity_available' ? 'Go to the Garden' : 'Continue in the Garden'}
        animateEntrance={false}
        disabled={navigationLocked || tutorialInteractionLocked}
        onAction={openJourneyGarden}
        requests={journeyRequestPreviews}
        standalone
        title={journeyEpisode.title}
      />
    </View> : <View ref={actionStackTargetRef} accessibilityLabel="Mossprout Journey Day actions" style={styles.actionStack}>
      <View style={styles.actionSlot}>
      {presentedActions.map((presentedAction) => {
        const presentedActionKey = actionId(presentedAction);
        const entering = actionTransition.isEntering(presentedActionKey);
        if (presentedAction.status === 'completed') return (
          <DayActionCompletedRow
            animateLayout
            artwork={<MossproutActionArtwork action={presentedAction} />}
            enteringEnabled={entering}
            key={presentedActionKey}
            onFinished={() => actionTransition.onCompletedExit(presentedActionKey)}
            onRewardRequest={presentedAction.reward?.kind === 'bond'
              ? presentedAction.rewardReceipt
                ? (source, onArrive) => onBondRewardRequest(source, onArrive, presentedAction.rewardReceipt!)
                : onBondRewardRequest
              : undefined}
            reward={presentedAction.reward ? <ActionRewardChip reward={presentedAction.reward} /> : undefined}
            start={actionTransition.isStartingCompletion(presentedActionKey)}
            title={presentedAction.title}
          />
        );
        if (presentedAction.destination.kind === 'goal') {
          const goalId = presentedAction.destination.goalId;
          return (
          <DayActionGoalRow
            animateLayout
            artwork={<MossproutActionArtwork action={presentedAction} />}
            disabled={stackInteractionLocked}
            enteringEnabled={entering}
            entryDelayMs={0}
            externalGesture={swipeExternalGesture}
            key={presentedActionKey}
            label={presentedAction.title}
            onBeginCompletion={() => setSelfCompletingGoalAction(presentedAction)}
            onCompletionRequest={(source, onRewardArrive) => completeGoalAction(presentedAction, source, onRewardArrive)}
            onFinished={() => setSelfCompletingGoalAction((current) => current?.id === presentedAction.id ? null : current)}
            onOpen={(completeFromOrigin) => {
              selectedGoalCompletionRef.current = completeFromOrigin;
              setSelectedGoalId(goalId);
            }}
            onSkip={!presentedAction.required && !stackInteractionLocked ? () => {
              relationshipProgressionRepository.update((current) => skipKatchimeraDayAction(current, dayId, presentedAction));
            } : undefined}
            reward={presentedAction.reward ? <ActionRewardChip reward={presentedAction.reward} /> : undefined}
            title={presentedAction.title}
          />
          );
        }
        return (
          <DayActionActiveRow
            animateLayout
            disabled={presentedAction.disabled || stackInteractionLocked}
            enteringEnabled={entering}
            entryDelayMs={0}
            externalGesture={swipeExternalGesture}
            key={presentedActionKey}
            label={presentedAction.title}
            onSkip={!presentedAction.required && !presentedAction.disabled && !stackInteractionLocked ? () => {
              relationshipProgressionRepository.update((current) => skipKatchimeraDayAction(current, dayId, presentedAction));
            } : undefined}>
            <Pressable
              accessibilityActions={!presentedAction.required && !presentedAction.disabled && !stackInteractionLocked ? [{ label: 'Skip for today', name: 'skip' }] : undefined}
              accessibilityHint={!presentedAction.required && !presentedAction.disabled && !stackInteractionLocked ? 'Double tap to start. Swipe right to reveal Skip, or swipe left to close it.' : undefined}
              accessibilityRole="button"
              accessibilityState={{ disabled: presentedAction.disabled || stackInteractionLocked }}
              disabled={presentedAction.disabled || stackInteractionLocked}
              onAccessibilityAction={(event) => {
                if (event.nativeEvent.actionName === 'skip') {
                  relationshipProgressionRepository.update((current) => skipKatchimeraDayAction(current, dayId, presentedAction));
                }
              }}
              onPress={() => openAction(presentedAction)}
              style={({ pressed }) => [(presentedAction.disabled || stackInteractionLocked) && styles.disabled, pressed && styles.pressed]}>
              <DayActionCardSurface
                artwork={<MossproutActionArtwork action={presentedAction} />}
                reward={presentedAction.reward ? <ActionRewardChip reward={presentedAction.reward} /> : undefined}
                title={presentedAction.title}
                trailing={presentedAction.disabled ? <IconSymbol color={Meadow.inkFaint} name="lock.fill" size={15} /> : undefined}
              />
            </Pressable>
          </DayActionActiveRow>
        );
      })}

      {!presentedActions.length && actionTransition.phase === 'resting' ? <Animated.View entering={FadeIn.duration(180)}>
        <GameSurface contentStyle={styles.quietContent} tone="cream">
          <DayActionIcon icon="leaf.fill" />
          <View style={styles.quietCopy}>
            <ThemedText style={styles.quietTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>Everything is caught up</ThemedText>
            <ThemedText style={styles.quietBody} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>The Garden is open if you want to keep merging.</ThemedText>
          </View>
        </GameSurface>
      </Animated.View> : null}
      </View>
    </View>}

    {selectedGoal ? (
      <QuickGoalActionModal
        item={selectedGoal}
        onComplete={() => onCompleteGoal(selectedGoal.goal.id)}
        onCompleteFromOrigin={() => {
          const completeFromOrigin = selectedGoalCompletionRef.current;
          selectedGoalCompletionRef.current = null;
          requestAnimationFrame(() => completeFromOrigin?.());
        }}
        onDismiss={() => {
          selectedGoalCompletionRef.current = null;
          setSelectedGoalId(null);
        }}
        onRemember={() => {
          if (selectedGoal.completion) onRememberGoal(selectedGoal.completion, selectedGoal.goal);
          setSelectedGoalId(null);
        }}
        onSkip={() => { onSkipGoal(selectedGoal.goal.id); }}
        onSnooze={() => { onSnoozeGoal(selectedGoal.goal.id); }}
        onUndo={() => onUndoGoal(selectedGoal.goal.id)}
      />
    ) : null}

    {!residentParcelHandoffActive && !residentStoryResumeActive ? <KatchimeraBottomDock
      disabled={navigationLocked}
      featuredId="garden"
      items={[
        { id: 'garden', label: 'Garden', onPress: () => onOpenMerge(journey?.activity?.mergeOrderId) },
        { id: 'discoveries', label: 'Discoveries', onPress: onDashboard },
        { id: 'skins', label: 'Skins', onPress: onOpenCards },
        { id: 'trophies', label: 'Trophies', onPress: onOpenTrophies },
      ]}
    /> : null}
  </View>;
}

function MossproutActionArtwork({ action }: { action: KatchimeraDayAction }) {
  const definitions = action.artworkDefinitionIds?.length
    ? action.artworkDefinitionIds
    : action.artworkDefinitionId ? [action.artworkDefinitionId] : [];
  const art = katchimeraActionArt(action.artKey);
  if (!definitions.length && art) return <Image accessibilityIgnoresInvertColors contentFit="contain" source={art} style={styles.actionArtwork} transition={0} />;
  if (!definitions.length) return <DayActionIcon completed={action.status === 'completed'} icon={action.icon} />;
  if (definitions.length === 1) return <PersistentMergeItemArt definitionId={definitions[0]!} size={48} />;
  const visibleDefinitions = definitions.slice(0, MAX_ORDER_ART_ITEMS);
  const itemSize = visibleDefinitions.length > 2 ? 32 : 38;
  return <View style={[styles.comboArtwork, visibleDefinitions.length > 2 && styles.comboArtworkWide]}>
    {visibleDefinitions.map((definitionId, index) => <View key={`${definitionId}:${index}`} style={[styles.comboItem, index === 1 && styles.comboItemSecond, index === 2 && styles.comboItemThird]}>
      <PersistentMergeItemArt definitionId={definitionId} size={itemSize} />
    </View>)}
  </View>;
}

function ActionRewardChip({ reward }: {
  reward: NonNullable<KatchimeraDayAction['reward']>;
}) {
  return <DayActionRewardChip reward={{
    amount: reward.amount,
    art: reward.kind === 'coins' ? GAME_CURRENCY_ART.coins : reward.kind === 'bond' ? GAME_CURRENCY_ART.bond : undefined,
    kind: reward.kind,
  }} />;
}

const styles = StyleSheet.create({
  stage: { alignSelf: 'stretch', gap: 8, overflow: 'visible', paddingBottom: 3 },
  actionStage: { height: ACTION_TRAY_HEIGHT },
  journeyRequestStage: { height: JOURNEY_REQUEST_TRAY_HEIGHT },
  residentParcelStage: { justifyContent: 'flex-end' },
  actionStack: { height: ACTION_STACK_HEIGHT },
  journeyRequestPanel: { flex: 1 },
  residentParcelPanel: { alignSelf: 'stretch' },
  actionSlot: { gap: 7, height: ACTION_STACK_HEIGHT, justifyContent: 'flex-end', overflow: 'visible' },
  actionArtwork: { height: 46, width: 46 },
  quietContent: { alignItems: 'center', flexDirection: 'row', gap: 10, minHeight: 66, paddingHorizontal: 11, paddingVertical: 7 },
  quietCopy: { flex: 1, gap: 1 },
  quietTitle: { fontSize: 14, fontWeight: '900', lineHeight: 17 },
  quietBody: { fontSize: 10, lineHeight: 13 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.68 },
  comboArtwork: { height: 48, position: 'relative', width: 52 },
  comboArtworkWide: { width: 64 },
  comboItem: { left: 0, position: 'absolute', top: 5 },
  comboItemSecond: { left: 18, top: 1 },
  comboItemThird: { left: 34, top: 7 },
});
