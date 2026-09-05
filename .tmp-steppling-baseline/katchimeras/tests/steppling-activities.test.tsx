import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { emptyCompanionBondState } from '../utils/companion-bond';
import { claimStepplingMilestone, nextStepplingMilestone } from '../utils/steppling-activities';
import { STEPPLING_STEP_MILESTONES, STEPPLING_TRAIL_CHATS, STEPPLING_TRAIL_CONVERSATIONS } from '../constants/steppling-activities';
import { loadNativeModule, nativeViews, nativeMotionHarness } from './helpers/native-motion-harness';
import { createConversationSession, answerConversation, continueConversation } from '../utils/companion-conversation';
import type { ConversationSession } from '../types/companion-conversation';
import type { KatchimeraActionOrigin } from '../types/relationship-progression';
import { emptyRelationshipProgressState } from '../game/katchimeras/relationship-progression';
import { commitActionCompletion, actionCommandFromOrigin, attachActionRewardReceipt } from '../game/katchimeras/action-runtime';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
test('Steppling milestones require real progress, pay once in order, grow rewards and reset daily', () => {
  let state = emptyCompanionBondState();
  assert.equal(claimStepplingMilestone(state, '2026-09-04', 500, 499), null);
  assert.equal(claimStepplingMilestone(state, '2026-09-04', 500, NaN), null);
  assert.equal(claimStepplingMilestone(state, '2026-09-04', 2000, 10000), null);
  let previousReward = 0;
  for (const goal of STEPPLING_STEP_MILESTONES) {
    assert.equal(nextStepplingMilestone(state, '2026-09-04')?.steps, goal.steps);
    const result = claimStepplingMilestone(state, '2026-09-04', goal.steps, 10000)!;
    assert.ok(result.awarded); assert.ok(result.points > previousReward);
    previousReward = result.points; state = result.state;
    assert.equal(claimStepplingMilestone(state, '2026-09-04', goal.steps, 10000), null);
  }
  assert.equal(nextStepplingMilestone(state, '2026-09-04'), null);
  assert.equal(nextStepplingMilestone(state, '2026-09-05')?.steps, 500);
  assert.equal(state.pendingCelebrations?.length, 5);
});

test('Steppling keeps the claimed row through its flight, restores Garden navigation and removes completed chats', async () => {
  let bond = emptyCompanionBondState();
  let relationships = emptyRelationshipProgressState();
  const sessions: ConversationSession[] = [];
  let origin: KatchimeraActionOrigin;
  let definitionId = '';
  const bondListeners = new Set<() => void>();
  let steps = 499;
  let flights = 0;
  let arrived = 0;
  let finishFlight: () => void = () => {};
  const opened: string[] = [];
  const panel = { backgroundColor: 'legacy-dark' };
  const subscribe = (listeners: Set<() => void>, fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); };
  const module = loadNativeModule('components/katchadeck/world/steppling-actions.tsx', {
    'react-native': { ...nativeViews, ScrollView: 'ScrollView', Pressable: 'Pressable', AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } },
    'expo-image': { Image: 'Image' },
    'expo-sensors': { Pedometer: { isAvailableAsync: async () => true, getPermissionsAsync: async () => ({ granted: true }), getStepCountAsync: async () => ({ steps }) } },
    '@/constants/katchimera-action-art': { katchimeraActionArt: () => 1 },
    '@/constants/katcha-ui': { KatchaUI: { companionScenePanel: { ink: '#fff' }, type: { body: {} } } },
    '@/components/themed-text': { ThemedText: 'Text' },
    '@/components/katchadeck/progress-bar': { ProgressBar: 'ProgressBar' },
    '@/components/katchadeck/ui/day-action-row': { DayActionActiveRow: 'ActiveRow', DayActionCompletedRow: 'CompletedRow', DayActionReplacementSlot: 'ReplacementSlot', DAY_ACTION_MOTION: { entryBaseDelayMs: 55, entryStaggerMs: 45 } },
    '@/components/katchadeck/ui/day-action-goal-row': { DayActionGoalRow: 'GoalRow' },
    '@/components/katchadeck/ui/day-action-card': { DayActionCardSurface: 'Card', DayActionRewardChip: 'Reward' },
    '@/storage/repositories/home-repository': { homeRepository: { load: () => null, subscribe: () => () => {} } },
    '@/utils/companion-bond-storage': { loadCompanionBondState: () => bond, saveCompanionBondState: (state: typeof bond) => { bond = state; bondListeners.forEach((fn) => fn()); }, subscribeCompanionBondState: (fn: () => void) => subscribe(bondListeners, fn) },
    '@/utils/companion-life-storage': { loadCompanionLife: () => ({ entries: [] }) },
    '@/utils/companion-content-storage': { loadCompanionContentState: () => ({ conversationSessions: sessions }) },
    '@/hooks/use-relationship-progression': { useRelationshipProgression: () => relationships },
    '@/storage/repositories/relationship-progression-repository': { relationshipProgressionRepository: { update: (work: (state: typeof relationships) => typeof relationships) => { relationships = work(relationships); } } },
    '@/utils/world-identity': { localDayId: () => '2026-09-04' },
    './companion-garden-action': { CompanionGardenAction: ({ children, ...props }: { children: (card: React.ReactNode) => React.ReactNode }) => children(React.createElement('GardenCard', props)) },
    '@/hooks/use-daily-companion-conversation': { useDailyCompanionConversation: () => STEPPLING_TRAIL_CHATS[0] },
    './companion-merge-request-tray': { CompanionMergeRequestTray: 'Tray', COMPANION_MERGE_REQUEST_PALETTE: {}, COMPANION_STORY_PANEL_STYLE: panel },
  }, { setInterval, clearInterval });
  const Cards = module.StepplingActions as React.ComponentType<Record<string, unknown>>;
  let tree: ReactTestRenderer;
  let reaction = '';
  const props = { onReaction: (text: string) => { reaction = text; }, onOpenConversation: (id: string, actionOrigin: KatchimeraActionOrigin) => { definitionId = id; origin = actionOrigin; }, requests: [{ id: 'order-one', title: 'A garden path', definitionIds: ['trail'], badge: '+8 Glow · 5 min sooner' }], onOpenMerge: (id: string) => opened.push(id), onBondRewardRequest: (_source: unknown, arrive: () => void, receipt: { points: number }) => { flights++; assert.ok([5, 8].includes(receipt.points)); finishFlight = arrive; } };
  await act(async () => { tree = create(<Cards {...props} />); });
  const row = () => tree!.root.findByType('GoalRow' as React.ElementType);
  const press = async (label: string) => act(async () => { tree!.root.findAllByType('Pressable' as React.ElementType).find((item) => item.props.accessibilityLabel === label)!.props.onPress(); });
  assert.equal(row().props.completeOnPress, false);
  assert.equal(row().props.highlighted, false);
  assert.equal(row().props.progress.props.children.props.current, 499);
  assert.equal(row().props.progress.props.children.props.total, 500);
  assert.equal(row().props.hideCompletionControl, true);
  steps = 2500;
  await act(async () => { row().props.onOpen(); });
  assert.equal(tree!.root.findAllByType('GoalRow' as React.ElementType).length, 1, 'unfinished steps only speak and keep the card visible');
  assert.equal(tree!.root.findAllByType('Choices' as React.ElementType).length, 0, 'steps never open a submenu');
  assert.equal(flights, 0, 'unfinished steps do not start the reward sequence');
  assert.equal(row().props.completeOnPress, true);
  assert.equal(row().props.highlighted, true);
  assert.equal(bond.events.length, 0, 'reaching the target does not claim until tapped');
  assert.match(reaction, /1 more step to/);
  await act(async () => row().props.onBeginCompletion());
  await act(async () => row().props.onCompletionRequest({ x: 1, y: 1, width: 30, height: 30 }, () => arrived++));
  assert.equal(flights, 1); assert.equal(arrived, 0);
  assert.equal(row().props.title, 'Walk 500 steps');
  await act(async () => { finishFlight(); row().props.onFinished(); });
  assert.equal(arrived, 1);
  assert.match(reaction, /500 steps!/);
  assert.equal(row().props.title, 'Walk 2,000 steps');
  assert.equal(row().props.reward.props.reward.amount, 8);
  const garden = tree!.root.findByType('GardenCard' as React.ElementType);
  assert.equal(garden.props.familyId, 'steppling');
  assert.equal(garden.props.storyRequests[0].id, 'order-one');
  await act(async () => garden.props.onOpenMerge('order-one'));
  assert.deepEqual(opened, ['order-one']);
  for (const chat of STEPPLING_TRAIL_CHATS.slice(0, 1)) {
    await press(chat.title);
    assert.equal(tree!.root.findAllByType('Choices' as React.ElementType).length, 0, 'no bespoke chat panel');
    const definition = STEPPLING_TRAIL_CONVERSATIONS.find((item) => item.id === definitionId)!;
    let session = createConversationSession({ definition, dayId: '2026-09-04', formId: 'steppling' as never, actionOrigin: origin! });
    session = answerConversation(session, definition, chat.options[0].id).session;
    session = continueConversation(session, definition);
    assert.equal(session.currentNodeId, 'insight');
    assert.equal(session.insightResult?.summary, chat.options[0].insight);
    assert.equal(session.status, 'active');
    session = continueConversation(session, definition);
    assert.equal(session.currentNodeId, 'finish');
    assert.equal(session.status, 'completed', 'the normal end page owns the return to the action board');
    session = continueConversation(session, definition);
    assert.equal(session.status, 'completed');
    sessions.push(session);
    relationships = commitActionCompletion(relationships, actionCommandFromOrigin(origin!, Date.now()));
    const completion = relationships.actionCompletions.at(-1)!;
    const rewardReceipt = { ...bond.pendingCelebrations![0], id: definitionId, eventId: definitionId, points: 8 };
    relationships = attachActionRewardReceipt(relationships, completion.id, rewardReceipt);
    await act(async () => tree!.update(<Cards {...props} />));
    const outro = tree!.root.findByType('CompletedRow' as React.ElementType);
    assert.equal(outro.props.title, chat.title);
    assert.equal(tree!.root.findByType('ReplacementSlot' as React.ElementType).props.concealed, true);
    await act(async () => outro.props.onRewardRequest({ x: 0, y: 0, width: 30, height: 30 }, () => {}));
    await act(async () => { finishFlight(); outro.props.onFinished(); });
    assert.equal(relationships.actionPresentations.at(-1)?.status, 'dismissed');
    await act(async () => new Promise((resolve) => setTimeout(resolve, 380)));
  }
  assert.equal(tree!.root.findAllByType('Card' as React.ElementType).some((card) => card.props.title === STEPPLING_TRAIL_CHATS[0].title), false);
  await act(async () => { tree!.unmount(); tree = create(<Cards {...props} />); });
  assert.equal(tree!.root.findAllByType('Card' as React.ElementType).some((card) => card.props.title === STEPPLING_TRAIL_CHATS[0].title), false, 'completed conversation stays gone after reopening');
  assert.equal(row().props.title, 'Walk 2,000 steps');
  await act(async () => tree!.unmount());
});


test('shared conversation completion awards Steppling once and preserves Mossprout’s deck', () => {
  let relationships = emptyRelationshipProgressState();
  let bond = emptyCompanionBondState();
  const module = loadNativeModule('game/katchimeras/action-completion.ts', {
    '@/storage/repositories/relationship-progression-repository': { relationshipProgressionRepository: { load: () => relationships, update: (work: (value: typeof relationships) => typeof relationships) => { relationships = work(relationships); return relationships; } } },
    '@/storage/repositories/home-repository': { homeRepository: { load: () => null } },
    '@/utils/katchimera-identity': { companionIdResolverForHomeState: () => (id: string) => id },
    '@/utils/katchimera-quests': { loadCompanionQuests: () => undefined },
    '@/utils/companion-bond-storage': { loadCompanionBondState: () => bond, saveCompanionBondState: (value: typeof bond) => { bond = value; } },
    '@/features/content-flow/content-flow-director': { publishContentFlowDomainEvent: async () => {}, submitActiveContentFlowScene: async () => {} },
  });
  const definition = STEPPLING_TRAIL_CONVERSATIONS[0];
  const origin: KatchimeraActionOrigin = { dayId: '2026-09-04', familyId: 'steppling', actionId: definition.id, instanceId: definition.id,
    sourceSlotId: 'together', slotId: 'together', sequence: 0, kind: 'fun_chat', title: definition.title, subtitle: '', icon: 'leaf.fill',
    artworkDefinitionIds: [], reward: { kind: 'bond', amount: 8 }, rotationEffect: 'preserve', presentation: 'action_card' };
  const active = createConversationSession({ definition, formId: 'steppling' as never, dayId: origin.dayId, actionOrigin: origin });
  const commit = module.commitKatchimeraActionCompletion as (input: { definition: typeof definition; session: ConversationSession }) => { rewardReceipt: { creatureId: string; points: number } | null };
  assert.equal(commit({ definition, session: active }).rewardReceipt, null);
  const completed = { ...active, status: 'completed' as const, completedAt: Date.now() };
  const first = commit({ definition, session: completed });
  const second = commit({ definition, session: completed });
  assert.equal(first.rewardReceipt?.points, 8);
  assert.equal(second.rewardReceipt?.points, 8);
  assert.match(first.rewardReceipt!.creatureId, /steppling/);
  assert.equal(bond.events.length, 1);
  assert.equal(bond.pendingCelebrations?.length, 0, 'only the original action-card presentation owns the reward flight');
  assert.equal(relationships.actionPresentations.length, 1);
  assert.equal(relationships.mossproutDailyActionDecks.length, 0);
});


test('ready steps wait for a tap, then use the original row reward and exit sequence', async () => {
  const motion = nativeMotionHarness();
  const timers = new Map<number, { callback: () => void; delay: number }>();
  let timerId = 0;
  let began = 0;
  let rewards = 0;
  let finished = 0;
  let arrive = () => {};
  const module = loadNativeModule('components/katchadeck/ui/day-action-goal-row.tsx', {
    'react-native': { ...nativeViews, Pressable: 'Pressable' },
    'react-native-reanimated': { ...motion.animated, Easing: { ...motion.animated.Easing, back: () => (value: number) => value } },
    'expo-haptics': {},
    '@/components/katchadeck/goals/goal-completion-celebration': { GoalCompletionCelebration: 'Celebration' },
    './day-action-card': { DayActionCardSurface: 'Card', DayActionCompletedTick: 'Tick' },
    './day-action-row': { DayActionActiveRow: 'ActiveRow' },
  }, { process: { env: { EXPO_OS: 'web' } }, setTimeout: (callback: () => void, delay: number) => { timers.set(++timerId, { callback, delay }); return timerId; }, clearTimeout: (id: number) => timers.delete(id) });
  const Row = module.DayActionGoalRow as React.ComponentType<Record<string, unknown>>;
  const props = { animateLayout: true, entryDelayMs: 0, artwork: null, title: 'Walk 500 steps', label: 'Walk 500 steps', hideCompletionControl: true,
    onOpen: () => {}, onBeginCompletion: () => began++, onFinished: () => finished++,
    onCompletionRequest: (_source: unknown, onArrive: () => void) => { rewards++; arrive = onArrive; } };
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Row {...props} completeOnPress={false} />); });
  assert.equal(began, 0);
  await act(async () => tree!.update(<Row {...props} completeOnPress highlighted />));
  assert.equal(began, 0, 'readiness alone never claims the reward');
  await act(async () => tree!.root.findByType('Pressable' as React.ElementType).props.onPress());
  assert.equal(began, 1);
  await act(async () => tree!.update(<Row {...props} completeOnPress highlighted />));
  assert.equal(began, 1, 'repeated sensor updates cannot start duplicate completion');
  await act(async () => { [...timers.values()].find((timer) => timer.delay === 190)!.callback(); motion.advance(1000); });
  assert.equal(rewards, 1);
  assert.equal(finished, 0, 'replacement waits for the reward arrival');
  await act(async () => arrive());
  assert.equal(finished, 1);
  await act(async () => tree!.unmount());
  await act(async () => { tree = create(<Row {...props} completeOnPress
    onCompletionRequest={(_source: unknown, _arrive: () => void, fail: () => void) => fail()} />); });
  await act(async () => tree!.root.findByType('Pressable' as React.ElementType).props.onPress());
  await act(async () => [...timers.values()].find((timer) => timer.delay === 190)!.callback());
  assert.equal(timers.size, 0, 'failed saves cancel the success watchdog');
  await act(async () => motion.advance(4000));
  assert.equal(finished, 1, 'a failed save never finishes the completion presentation');
  assert.equal(tree!.root.findByType('Pressable' as React.ElementType).props.disabled, false, 'the same action can be retried');
  await act(async () => tree!.unmount());
});
