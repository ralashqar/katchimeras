import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { GestureType } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';

import { PersistentMergeItemArt } from '@/components/katchadeck/games/feastle-persistent-merge-board';
import {
  DayActionCardSurface,
  DayActionIcon,
  DayActionRewardChip,
} from '@/components/katchadeck/ui/day-action-card';
import { DayActionActiveRow, DayActionCompletedRow, type DayActionSourceRect } from '@/components/katchadeck/ui/day-action-row';
import { GameSurface } from '@/components/katchadeck/ui/game-surface';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { GAME_CURRENCY_ART } from '@/constants/game-currency-art';
import { KatchaUI } from '@/constants/katcha-ui';
import { Meadow } from '@/constants/meadow-theme';
import { resolveMossproutDayActions, type MossproutActionGardenRequest } from '@/game/katchimeras/mossprout-home';
import {
  acknowledgeKatchimeraExternalActionOutro,
  acknowledgeMossproutJourneyActionOutro,
  beginMossproutJourneyReturn,
  makeMossproutResolutionAvailable,
  mossproutDailyActionDeck,
  mossproutJourneyForDay,
  mossproutStory,
  recordKatchimeraActionCompletion,
  skipKatchimeraDayAction,
  startMossproutJourneyActivity,
  startMossproutJourneyDay,
} from '@/game/katchimeras/relationship-progression';
import { useOptionalMergeWorldState } from '@/features/merge-world/merge-world-provider';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';
import type { CompanionQuestOfferViewModel } from '@/types/companion-interaction';
import type { KatchimeraDayAction, RelationshipProgressState } from '@/types/relationship-progression';
import type { ConversationSession } from '@/types/companion-conversation';
import type { MergeWorldState } from '@/types/merge-world';
import { acquireLifecycleResource } from '@/utils/lifecycle-performance';
import { loadMergeWorldState, subscribeMergeWorldSnapshots } from '@/utils/merge-world/repository';
import { localDayId } from '@/utils/world-identity';

import type { CompanionChatStarter } from './companion-chat-lobby';

type MossproutGoalForDay = {
  goal: { id: string; title: string };
  completion: unknown | null;
};

const MAX_ORDER_ART_ITEMS = 3;

function useMossproutMergeWorldState() {
  const providedMergeWorld = useOptionalMergeWorldState();
  const [storedState, setStoredState] = useState<MergeWorldState | null>(null);

  useEffect(() => {
    let mounted = true;
    const adopt = (nextState: MergeWorldState) => {
      if (!mounted) return;
      setStoredState((current) => !current || nextState.revision > current.revision ? nextState : current);
    };
    const release = acquireLifecycleResource('store_subscription', 'mossprout:merge-world-snapshots');
    const unsubscribe = subscribeMergeWorldSnapshots(adopt);
    void loadMergeWorldState().then(adopt).catch((error) => {
      console.warn('Could not load Mossprout Garden orders', error);
    });
    return () => {
      mounted = false;
      unsubscribe();
      release();
    };
  }, []);

  const providedState = providedMergeWorld?.state ?? null;
  return providedState && (!storedState || providedState.revision >= storedState.revision)
    ? providedState
    : storedState;
}

export function MossproutStoryStage({
  activeQuestId,
  conversations,
  goals,
  offers,
  relationships,
  onCompleteGoal,
  onDashboard,
  onOpenConversation,
  onOpenMerge,
  onOpenQuestDirect,
  onBondRewardRequest,
  swipeExternalGesture,
}: {
  activeQuestId?: string | null;
  conversationSession: ConversationSession | null;
  conversations: readonly CompanionChatStarter[];
  goals: readonly MossproutGoalForDay[];
  offers: CompanionQuestOfferViewModel[];
  relationships: RelationshipProgressState;
  onCompleteGoal: (goalId: string) => { newlyCompleted: boolean };
  onDashboard: () => void;
  onOpenConversation: (definitionId: string) => void;
  onOpenMerge: (orderId?: string | null) => void;
  onOpenQuestDirect: (questId: string, originActionId: string) => void;
  onBondRewardRequest: (source: DayActionSourceRect, onArrive: () => void) => void;
  swipeExternalGesture?: GestureType;
}) {
  const mergeWorldState = useMossproutMergeWorldState();
  const dayId = localDayId();
  const journey = mossproutJourneyForDay(relationships, dayId);
  const story = mossproutStory(relationships);
  const storyComplete = story.activeBeatId === 'dry-pond:complete';
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
    if (journey?.status !== 'living' || (journey.resolutionAvailableAt ?? Infinity) > Date.now()) return;
    relationshipProgressionRepository.update((current) => makeMossproutResolutionAvailable(current, dayId));
  }, [dayId, journey?.resolutionAvailableAt, journey?.status]);

  const actions = useMemo(() => resolveMossproutDayActions({
    activeQuestId,
    conversations,
    consumedActionIds: mossproutDailyActionDeck(relationships, dayId).consumedActionIds,
    dayId,
    gardenRequests,
    goals: goals.map((item) => ({ id: item.goal.id, title: item.goal.title, completed: Boolean(item.completion) })),
    journey,
    journeyGardenRequest,
    offers,
    skippedActionIds: relationships.skippedActionIds,
    slotSequences: mossproutDailyActionDeck(relationships, dayId).slotSequences,
    storyComplete,
  }), [activeQuestId, conversations, dayId, gardenRequests, goals, journey, journeyGardenRequest, offers, relationships, storyComplete]);

  useEffect(() => {
    relationshipProgressionRepository.update((current) => goals.reduce((state, item) => {
      if (!item.completion) return state;
      const actionId = `mossprout:goal:${item.goal.id}`;
      if (state.completedActionOutros.some((record) => record.dayId === dayId && record.actionId === actionId)) return state;
      const sequence = mossproutDailyActionDeck(state, dayId).slotSequences.together;
      return recordKatchimeraActionCompletion(state, {
        dayId, familyId: 'mossprout', actionId, instanceId: `${dayId}:together:${sequence}:${actionId}`, slotId: 'together', sequence, kind: 'goal_checkoff',
        title: item.goal.title, subtitle: 'A small promise kept', icon: 'checkmark.circle.fill', artworkDefinitionIds: [],
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
        icon: photo ? 'camera.fill' : 'square.and.pencil', artworkDefinitionIds: [],
        reward: { kind: 'bond', amount: offer.bondReward }, completedAt: Date.now(),
      });
    }, current));
  }, [dayId, offers]);

  const externalCompletion = useMemo(() => {
    const record = relationships.completedActionOutros.find((item) =>
      item.familyId === 'mossprout'
      && item.dayId === dayId
      && !relationships.acknowledgedActionOutroIds.includes(item.id)
    );
    if (!record) return null;
    return {
      id: record.actionId, kind: record.kind, title: record.title, subtitle: record.subtitle, icon: record.icon,
      instanceId: record.instanceId, slotId: record.slotId, sequence: record.sequence,
      artworkDefinitionId: record.artworkDefinitionIds[0], artworkDefinitionIds: record.artworkDefinitionIds,
      required: false, disabled: true, status: 'completed' as const, reward: record.reward,
      destination: { kind: 'journey' as const }, completedAt: record.completedAt, outroAcknowledgedAt: null,
    } satisfies KatchimeraDayAction;
  }, [dayId, relationships.acknowledgedActionOutroIds, relationships.completedActionOutros]);

  const journeyCompletion = actions.find((action) => action.status === 'completed') ?? null;
  const completingAction = journeyCompletion ?? externalCompletion;
  const visibleActions = (['together', 'field', 'garden'] as const).flatMap((slotId) => {
    if (completingAction?.slotId === slotId) return [completingAction];
    const action = actions.find((candidate) => candidate.slotId === slotId);
    return action ? [action] : [];
  });

  const finishActionOutro = (action: KatchimeraDayAction) => {
    relationshipProgressionRepository.update((current) => {
      const belongsToJourney = Boolean(journey?.actions.some((candidate) => candidate.id === action.id));
      return belongsToJourney
        ? acknowledgeMossproutJourneyActionOutro(current, dayId, action.id)
        : acknowledgeKatchimeraExternalActionOutro(current, dayId, action.instanceId ?? action.id);
    });
  };

  const openJourney = () => {
    if (!journey) {
      const started = relationshipProgressionRepository.update((current) => startMossproutJourneyDay(current, dayId).state);
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
    if (action.destination.kind === 'conversation') return onOpenConversation(action.destination.definitionId);
    if (action.destination.kind === 'garden') {
      if (journey?.status === 'activity_available') {
        relationshipProgressionRepository.update((current) => startMossproutJourneyActivity(current, dayId));
      }
      return onOpenMerge(action.destination.orderId);
    }
    if (action.destination.kind === 'quest') return onOpenQuestDirect(action.destination.questId, action.id);
    if (action.destination.kind === 'goal') onCompleteGoal(action.destination.goalId);
  };

  return <Animated.View entering={FadeInUp.duration(220)} style={styles.stage}>
    <View accessibilityLabel="Mossprout Journey Day actions" style={styles.actionStack}>
      {visibleActions.map((action, index) => action.status === 'completed' ? (
        <DayActionCompletedRow
          artwork={<MossproutActionArtwork action={action} />}
          key={action.instanceId ?? action.id}
          onFinished={() => finishActionOutro(action)}
          onRewardRequest={action.reward?.kind === 'bond' ? onBondRewardRequest : undefined}
          reward={action.reward ? <ActionRewardChip reward={action.reward} /> : undefined}
          rewardAnimationId={action.instanceId ?? action.id}
          title={action.title}
        />
      ) : (
        <DayActionActiveRow
          disabled={action.disabled}
          entryDelayMs={index * 55}
          externalGesture={swipeExternalGesture}
          key={action.instanceId ?? action.id}
          label={action.title}
          onSkip={!action.required && !action.disabled ? () => {
            relationshipProgressionRepository.update((current) => skipKatchimeraDayAction(current, dayId, action));
          } : undefined}>
          <Pressable
            accessibilityActions={!action.required && !action.disabled ? [{ label: 'Skip for today', name: 'skip' }] : undefined}
            accessibilityHint={!action.required && !action.disabled ? 'Double tap to start. Swipe right to reveal Skip, or swipe left to close it.' : undefined}
            accessibilityRole="button"
            accessibilityState={{ disabled: action.disabled }}
            disabled={action.disabled}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === 'skip') {
                relationshipProgressionRepository.update((current) => skipKatchimeraDayAction(current, dayId, action));
              }
            }}
            onPress={() => openAction(action)}
            style={({ pressed }) => [action.disabled && styles.disabled, pressed && styles.pressed]}>
            <DayActionCardSurface
              artwork={<MossproutActionArtwork action={action} />}
              reward={action.reward ? <ActionRewardChip reward={action.reward} /> : undefined}
              title={action.title}
              trailing={action.disabled ? <IconSymbol color={Meadow.inkFaint} name="lock.fill" size={15} /> : undefined}
            />
          </Pressable>
        </DayActionActiveRow>
      ))}

      {!visibleActions.length ? <Animated.View entering={FadeIn.duration(180)}>
        <GameSurface contentStyle={styles.quietContent} tone="cream">
          <DayActionIcon icon="leaf.fill" />
          <View style={styles.quietCopy}>
            <ThemedText style={styles.quietTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>Everything is caught up</ThemedText>
            <ThemedText style={styles.quietBody} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>The Garden is open if you want to keep merging.</ThemedText>
          </View>
        </GameSurface>
      </Animated.View> : null}
    </View>

    <View accessibilityLabel="Mossprout navigation" style={styles.dock}>
      <DockAction icon="square.grid.2x2.fill" label="Garden" onPress={() => onOpenMerge(journey?.activity?.mergeOrderId)} />
      <View style={styles.dockDivider} />
      <DockAction icon="circle.grid.2x2.fill" label="Dashboard" onPress={onDashboard} />
    </View>
  </Animated.View>;
}

function MossproutActionArtwork({ action }: { action: KatchimeraDayAction }) {
  const definitions = action.artworkDefinitionIds?.length
    ? action.artworkDefinitionIds
    : action.artworkDefinitionId ? [action.artworkDefinitionId] : [];
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
    art: reward.kind === 'coins' ? GAME_CURRENCY_ART.coins : undefined,
    icon: reward.kind === 'bond' ? 'heart.fill' : undefined,
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
  stage: { alignSelf: 'stretch', gap: 8, maxHeight: 276, overflow: 'visible', paddingBottom: 3 },
  actionStack: { gap: 7 },
  quietContent: { alignItems: 'center', flexDirection: 'row', gap: 10, minHeight: 66, paddingHorizontal: 11, paddingVertical: 7 },
  quietCopy: { flex: 1, gap: 1 },
  quietTitle: { fontSize: 14, fontWeight: '900', lineHeight: 17 },
  quietBody: { fontSize: 10, lineHeight: 13 },
  dock: { alignItems: 'center', backgroundColor: '#E9D6B5', borderColor: KatchaUI.companionPanel.cardBorder, borderCurve: 'continuous', borderRadius: 17, borderWidth: 1, boxShadow: KatchaUI.companionPanel.cardShadow, flexDirection: 'row', minHeight: 50, padding: 3 },
  dockAction: { alignItems: 'center', borderRadius: 13, flex: 1, flexDirection: 'row', gap: 7, justifyContent: 'center', minHeight: 42 },
  dockDivider: { backgroundColor: KatchaUI.companionPanel.divider, height: 25, width: 1 },
  dockLabel: { fontSize: 10.5, fontWeight: '900' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.68 },
  comboArtwork: { height: 48, position: 'relative', width: 52 },
  comboArtworkWide: { width: 64 },
  comboItem: { left: 0, position: 'absolute', top: 5 },
  comboItemSecond: { left: 18, top: 1 },
  comboItemThird: { left: 34, top: 7 },
});
