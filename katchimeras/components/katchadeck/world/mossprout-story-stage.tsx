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
import { KatchaUI } from '@/constants/katcha-ui';
import { katchimeraActionArt } from '@/constants/katchimera-action-art';
import { Meadow } from '@/constants/meadow-theme';
import { composeMossproutVisibleActions, mossproutGoalArtKey, resolveMossproutDayActions, type MossproutActionGardenRequest } from '@/game/katchimeras/mossprout-home';
import { mossproutJourneyDayNumber } from '@/game/katchimeras/mossprout-journey-handoff';
import {
  acknowledgeKatchimeraExternalActionOutro,
  acknowledgeMossproutJourneyActionOutro,
  beginMossproutJourneyReturn,
  makeMossproutResolutionAvailable,
  mossproutDailyActionDeck,
  mossproutJourneyForDay,
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
import type { KatchimeraDayAction, RelationshipProgressState } from '@/types/relationship-progression';
import type { ConversationSession } from '@/types/companion-conversation';
import type { MergeWorldState } from '@/types/merge-world';
import type { CompanionQuickGoalCompletionReceipt } from '@/hooks/use-companion-quick-goals';
import type { CompanionQuickGoalCompletion, CompanionQuickGoalForDay } from '@/utils/companion-quick-goals';
import { acquireLifecycleResource } from '@/utils/lifecycle-performance';
import { loadMergeWorldState, subscribeMergeWorldSnapshots } from '@/utils/merge-world/repository';
import { localDayId } from '@/utils/world-identity';

import type { CompanionChatStarter } from './companion-chat-lobby';

const MAX_ORDER_ART_ITEMS = 3;
const MAX_VISIBLE_ACTIONS = 3;
const ACTION_STACK_HEIGHT = 212;
const ACTION_TRAY_HEIGHT = 273;

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
  onOpenFocusDirection,
  onOpenMerge,
  onOpenQuestDirect,
  onBondRewardRequest,
  dayOneActionChoiceActive = false,
  actionStackTargetRef,
  tutorialInteractionLocked = false,
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
  onOpenConversation: (definitionId: string) => void;
  onOpenFocusDirection: () => void;
  onOpenMerge: (orderId?: string | null) => void;
  onOpenQuestDirect: (questId: string, originActionId: string) => void;
  onBondRewardRequest: (source: DayActionSourceRect, onArrive: () => void) => void;
  dayOneActionChoiceActive?: boolean;
  actionStackTargetRef?: RefObject<ViewType | null>;
  tutorialInteractionLocked?: boolean;
  motionReady: boolean;
  swipeExternalGesture?: GestureType;
}) {
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [selfCompletingGoalAction, setSelfCompletingGoalAction] = useState<KatchimeraDayAction | null>(null);
  const selectedGoalCompletionRef = useRef<(() => void) | null>(null);
  const { phase: screenTransitionPhase } = useGameScreenTransition();
  const { ready: mergeWorldReady, state: mergeWorldState } = useMossproutMergeWorldState();
  const dayId = localDayId();
  const journey = mossproutJourneyForDay(relationships, dayId);
  const journeyDayNumber = mossproutJourneyDayNumber(relationships, dayId);
  const story = mossproutStory(relationships);
  const storyComplete = story.activeBeatId === 'heartwood:complete';
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
    const orderId = journey?.activity?.mergeOrderId;
    return orderId ? mossproutOrders.find((order) => order.id === orderId) ?? null : null;
  }, [journey?.activity?.mergeOrderId, mossproutOrders]);

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
    gardenRequests,
    goals: goals.map((item) => ({ id: item.goal.id, templateId: item.goal.templateId, title: item.goal.title, completed: Boolean(item.completion) })),
    hasActiveFocus,
    journey,
    journeyDayNumber,
    journeyGardenRequest,
    offers,
    skippedActionIds: relationships.skippedActionIds,
    slotSequences: mossproutDailyActionDeck(relationships, dayId).slotSequences,
    storyComplete,
  }), [activeQuestId, conversations, dayId, gardenRequests, goals, hasActiveFocus, journey, journeyDayNumber, journeyGardenRequest, offers, relationships, storyComplete]);
  // Tutorials may spotlight or lock this stack, but must never replace the
  // normal resolver or decide which actions the player is allowed to see.
  const presentedActionCandidates = actions;

  useEffect(() => {
    relationshipProgressionRepository.update((current) => goals.reduce((state, item) => {
      if (!item.completion) return state;
      const actionId = `mossprout:goal:${item.goal.id}`;
      if (state.completedActionOutros.some((record) => record.dayId === dayId && record.actionId === actionId)) return state;
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
      if (state.completedActionOutros.some((record) => record.dayId === dayId && record.actionId === actionId)) return state;
      const sequence = mossproutDailyActionDeck(state, dayId).slotSequences.field;
      return recordKatchimeraActionCompletion(state, {
        dayId, familyId: 'mossprout', actionId, instanceId: `${dayId}:field:${sequence}:${actionId}`, slotId: 'field', sequence, kind: photo ? 'photo_request' : 'note_request',
        title: offer.title, subtitle: photo ? 'Nature moment captured' : 'Nature note remembered',
        icon: photo ? 'camera.fill' : 'square.and.pencil', artKey: photo ? 'today:photo' : 'today:reflection', artworkDefinitionIds: [],
        reward: { kind: 'bond', amount: offer.bondReward }, completedAt: Date.now(),
      });
    }, current));
  }, [dayId, offers]);

  const externalCompletions = useMemo(() => relationships.completedActionOutros
    .filter((record) => record.familyId === 'mossprout'
      && record.dayId === dayId
      && !relationships.acknowledgedActionOutroIds.includes(record.id))
    .map((record) => ({
      id: record.actionId, kind: record.kind, title: record.title, subtitle: record.subtitle, icon: record.icon, artKey: record.artKey,
      instanceId: record.instanceId, slotId: record.slotId, sequence: record.sequence,
      artworkDefinitionId: record.artworkDefinitionIds[0], artworkDefinitionIds: record.artworkDefinitionIds,
      required: false, disabled: true, status: 'completed' as const, reward: record.reward,
      destination: { kind: 'journey' as const }, completedAt: record.completedAt, outroAcknowledgedAt: null,
    } satisfies KatchimeraDayAction)),
  [dayId, relationships.acknowledgedActionOutroIds, relationships.completedActionOutros]);

  const completingAction = useMemo(() => {
    const byPresentationId = new Map<string, KatchimeraDayAction>();
    for (const action of [...presentedActionCandidates.filter((candidate) => candidate.status === 'completed'), ...externalCompletions]) {
      byPresentationId.set(action.instanceId ?? action.id, action);
    }
    const slotOrder = { together: 0, field: 1, garden: 2 } as const;
    return [...byPresentationId.values()].sort((left, right) =>
      (left.completedAt ?? Number.MAX_SAFE_INTEGER) - (right.completedAt ?? Number.MAX_SAFE_INTEGER)
      || slotOrder[left.slotId ?? 'together'] - slotOrder[right.slotId ?? 'together']
      || (left.instanceId ?? left.id).localeCompare(right.instanceId ?? right.id)
    )[0] ?? null;
  }, [externalCompletions, presentedActionCandidates]);

  const resolvedVisibleActions = composeMossproutVisibleActions(presentedActionCandidates, completingAction, MAX_VISIBLE_ACTIONS);
  const actionId = useCallback((action: KatchimeraDayAction) => `${dayId}:${action.instanceId ?? action.id}`, [dayId]);
  const sourceActions = useMemo(() => {
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
  }, [actionId, resolvedVisibleActions, selfCompletingGoalAction]);

  const finishActionOutro = useCallback((action: KatchimeraDayAction) => {
    relationshipProgressionRepository.update((current) => {
      const belongsToJourney = Boolean(journey?.actions.some((candidate) => candidate.id === action.id));
      return belongsToJourney
        ? acknowledgeMossproutJourneyActionOutro(current, dayId, action.id)
        : acknowledgeKatchimeraExternalActionOutro(current, dayId, action.instanceId ?? action.id);
    });
  }, [dayId, journey?.actions]);
  const actionTransition = useKatchimeraActionStackTransition({
    acknowledgeCompletion: finishActionOutro,
    getId: actionId,
    isCompleted: (action: KatchimeraDayAction) => action.status === 'completed',
    items: sourceActions,
    ready: motionReady && mergeWorldReady && screenTransitionPhase === 'idle',
  });

  const openJourney = () => {
    if (!journey) {
      const activeDayCount = mergeWorldState?.mossproutBoardProgression.activeDayIds.length ?? 0;
      const started = relationshipProgressionRepository.update((current) => startMossproutJourneyDay(current, dayId, Date.now(), activeDayCount).state);
      const opening = mossproutJourneyForDay(started, dayId)?.openingConversationId;
      if (opening) onOpenConversation(opening);
      else onOpenMerge('mossprout:chapter-0:first-sprout');
      return;
    }
    if (journey.status === 'opening' && journey.openingConversationId) return onOpenConversation(journey.openingConversationId);
    if (journey.status === 'profile_available' && journey.profileConversationId) return onOpenConversation(journey.profileConversationId);
    if (journey.status === 'activity_available') {
      relationshipProgressionRepository.update((current) => startMossproutJourneyActivity(current, dayId));
      return onOpenMerge(journey.activity?.mergeOrderId);
    }
    if (journey.status === 'activity_in_progress') return onOpenMerge(journey.activity?.mergeOrderId ?? 'mossprout:chapter-0:first-sprout');
    if (journey.status === 'return_available') {
      const next = relationshipProgressionRepository.update((current) => beginMossproutJourneyReturn(current, dayId));
      const returning = mossproutJourneyForDay(next, dayId);
      if (returning?.returnConversationId) onOpenConversation(returning.returnConversationId);
      return;
    }
    if (journey.status === 'resolution_ready' && journey.returnConversationId) return onOpenConversation(journey.returnConversationId);
    if (journey.status === 'living') {
      const next = relationshipProgressionRepository.update((current) => makeMossproutResolutionAvailable(current, dayId, { force: new Date().getHours() >= 21 }));
      const returning = mossproutJourneyForDay(next, dayId);
      if (returning?.returnConversationId) onOpenConversation(returning.returnConversationId);
    }
  };

  const openAction = (action: KatchimeraDayAction) => {
    if (action.disabled || action.status === 'completed') return;
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    if (action.destination.kind === 'journey') return openJourney();
    if (action.destination.kind === 'focus_questionnaire') return onOpenFocusDirection();
    if (action.destination.kind === 'conversation') return onOpenConversation(action.destination.definitionId);
    if (action.destination.kind === 'garden') {
      if (journey?.status === 'activity_available') {
        relationshipProgressionRepository.update((current) => startMossproutJourneyActivity(current, dayId));
      }
      return onOpenMerge(action.destination.orderId);
    }
    if (action.destination.kind === 'quest') return onOpenQuestDirect(action.destination.questId, action.id);
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

  return <View style={styles.stage}>
    {journey?.status === 'complete' && !storyComplete ? (
      <View accessibilityLabel={`Journey Day ${journeyDayNumber} complete. Journey Day ${journeyDayNumber + 1} begins tomorrow.`} style={styles.journeyStatus}>
        <IconSymbol color={Meadow.goldDeep} name="leaf.fill" size={13} />
        <ThemedText style={styles.journeyStatusText} lightColor={Meadow.ink} darkColor={Meadow.ink}>
          Journey Day {journeyDayNumber} complete · Day {journeyDayNumber + 1} tomorrow
        </ThemedText>
      </View>
    ) : null}
    <View ref={actionStackTargetRef} accessibilityLabel="Mossprout Journey Day actions" style={styles.actionStack}>
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
            onRewardRequest={presentedAction.reward?.kind === 'bond' ? onBondRewardRequest : undefined}
            reward={presentedAction.reward ? <ActionRewardChip reward={presentedAction.reward} /> : undefined}
            rewardAnimationId={presentedAction.instanceId ?? presentedAction.id}
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
    </View>

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

    <View accessibilityLabel="Mossprout navigation" style={styles.dock}>
      <DockAction icon="square.grid.2x2.fill" label="Garden" onPress={() => onOpenMerge(journey?.activity?.mergeOrderId)} />
      <View style={styles.dockDivider} />
      <DockAction icon="map.fill" label="Journey" onPress={openJourney} />
      <View style={styles.dockDivider} />
      <DockAction icon="sparkles" label="Discoveries" onPress={onDashboard} />
    </View>
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

function DockAction({ icon, label, onPress }: {
  icon: React.ComponentProps<typeof IconSymbol>['name'];
  label: string;
  onPress: () => void;
}) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.dockAction, pressed && styles.pressed]}>
    <IconSymbol color={Meadow.goldDeep} name={icon} size={17} />
    <ThemedText style={styles.dockLabel} lightColor={Meadow.ink} darkColor={Meadow.ink}>{label}</ThemedText>
  </Pressable>;
}

const styles = StyleSheet.create({
  stage: { alignSelf: 'stretch', gap: 8, height: ACTION_TRAY_HEIGHT, overflow: 'visible', paddingBottom: 3 },
  journeyStatus: { alignItems: 'center', alignSelf: 'center', backgroundColor: 'rgba(247,239,203,0.94)', borderColor: 'rgba(125,103,49,0.22)', borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 5, minHeight: 27, paddingHorizontal: 11, position: 'absolute', top: -34, zIndex: 6 },
  journeyStatusText: { fontSize: 9.5, fontWeight: '900', lineHeight: 12 },
  actionStack: { height: ACTION_STACK_HEIGHT },
  actionSlot: { gap: 7, height: ACTION_STACK_HEIGHT, justifyContent: 'flex-end', overflow: 'visible' },
  actionArtwork: { height: 46, width: 46 },
  quietContent: { alignItems: 'center', flexDirection: 'row', gap: 10, minHeight: 66, paddingHorizontal: 11, paddingVertical: 7 },
  quietCopy: { flex: 1, gap: 1 },
  quietTitle: { fontSize: 14, fontWeight: '900', lineHeight: 17 },
  quietBody: { fontSize: 10, lineHeight: 13 },
  dock: { alignItems: 'center', backgroundColor: '#E9D6B5', borderColor: KatchaUI.companionPanel.cardBorder, borderCurve: 'continuous', borderRadius: 17, borderWidth: 1, boxShadow: KatchaUI.companionPanel.cardShadow, flexDirection: 'row', minHeight: 50, padding: 3 },
  dockAction: { alignItems: 'center', borderRadius: 13, flex: 1, flexDirection: 'row', gap: 7, justifyContent: 'center', minHeight: 42 },
  dockDivider: { backgroundColor: KatchaUI.companionPanel.divider, height: 25, width: 1 },
  dockLabel: { fontSize: 9.5, fontWeight: '900' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.68 },
  comboArtwork: { height: 48, position: 'relative', width: 52 },
  comboArtworkWide: { width: 64 },
  comboItem: { left: 0, position: 'absolute', top: 5 },
  comboItemSecond: { left: 18, top: 1 },
  comboItemThird: { left: 34, top: 7 },
});
