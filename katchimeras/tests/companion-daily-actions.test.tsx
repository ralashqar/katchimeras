import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { loadNativeModule, nativeViews } from './helpers/native-motion-harness';
import { addCompanionQuickGoal, completeCompanionQuickGoal, emptyCompanionQuickGoalState } from '../utils/companion-quick-goals';
import { emptyRelationshipProgressState } from '../game/katchimeras/relationship-progression';
import { createJourneyCycle, installJourneyCycle } from '../game/katchimeras/companion-journey-cycle';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

test('daily conversation stays through completion/reopening, rotates tomorrow, and carries unfinished work', async () => {
  let dayId = '2026-09-05';
  let storage: unknown = null;
  let completed = new Set<string>();
  const module = loadNativeModule('hooks/use-daily-companion-conversation.ts', {
    '@/utils/app-storage': { getStoredJson: () => storage, setStoredJson: (_key: string, value: unknown) => { storage = value; } },
    './use-companion-calendar-day': { useCompanionCalendarDay: () => dayId },
  });
  const useConversation = module.useDailyCompanionConversation as (family: string, candidates: { id: string }[], done: Set<string>) => { id: string } | null;
  const candidates = [{ id: 'one' }, { id: 'two' }];
  let selected: string | undefined;
  function Host() { selected = useConversation('steppling', candidates, completed)?.id; return null; }
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Host />); });
  assert.equal(selected, 'one');
  completed = new Set(['one']);
  await act(async () => tree!.update(<Host />));
  assert.equal(selected, 'one');
  await act(async () => tree!.unmount());
  await act(async () => { tree = create(<Host />); });
  assert.equal(selected, 'one');
  dayId = '2026-09-06';
  await act(async () => tree!.update(<Host />));
  assert.equal(selected, 'two');
  dayId = '2026-09-07';
  await act(async () => tree!.update(<Host />));
  assert.equal(selected, 'two', 'unfinished conversation resumes across midnight');
  completed = new Set(['one', 'two']);
  await act(async () => tree!.update(<Host />));
  dayId = '2026-09-08';
  await act(async () => tree!.update(<Host />));
  assert.equal(selected, undefined, 'exhaustion leaves only tracker and Garden');
  await act(async () => tree!.unmount());
});

test('water logs on tap, slides out before replacement, persists counts and awards once a day', async () => {
  let dayId = '2026-09-05';
  const counts = new Map<string, number>();
  let error = '';
  let goals = addCompanionQuickGoal(emptyCompanionQuickGoalState(), { familyId: 'mossprout', templateId: 'mossprout:drink-water', title: 'Drink a glass of water', cadence: { kind: 'daily' } }).state;
  let relationships = installJourneyCycle(emptyRelationshipProgressState(), createJourneyCycle({ id: 'water:rest', familyId: 'mossprout', episodeId: 'one', number: 1, chapterId: 'one', title: 'Garden', nextTitle: 'Pond', completedAt: Date.now() - 1000, finale: false }));
  let completions = 0;
  let failed = false;
  let failSave = true;
  const module = loadNativeModule('components/katchadeck/world/mossprout-water-action.tsx', {
    'react-native': { ...nativeViews, Pressable: 'Pressable' },
    'expo-image': { Image: 'Image' },
    '@/components/themed-text': { ThemedText: 'Text' },
    '@/components/katchadeck/ui/day-action-card': { DayActionCardSurface: 'Card', DayActionRewardChip: 'Reward' },
    '@/components/katchadeck/ui/day-action-goal-row': { DayActionGoalRow: 'GoalRow' },
    '@/utils/world-identity': { localDayId: () => dayId },
    '@/utils/app-storage': { getStoredJson: (key: string, fallback: number) => counts.get(key) ?? fallback, setStoredJson: (key: string, count: number) => counts.set(key, count) },
    '@/constants/katchimera-action-art': { katchimeraActionArt: () => 1 },
    '@/hooks/use-companion-calendar-day': { useCompanionCalendarDay: () => dayId },
    '@/hooks/use-companion-quick-goals': { useCompanionQuickGoals: () => ({ state: goals, refresh() {}, completeGoal: (id: string) => {
      if (failSave) throw new Error('Disk unavailable');
      const result = completeCompanionQuickGoal(goals, id, dayId);
      goals = result.state; completions += Number(result.completed);
      return { completion: result.completion, bondAward: null, newlyCompleted: result.completed };
    } }) },
    '@/utils/companion-quick-goal-storage': { loadCompanionQuickGoalState: () => goals, saveCompanionQuickGoalState: (state: typeof goals) => { goals = state; } },
    '@/storage/repositories/relationship-progression-repository': { relationshipProgressionRepository: { update: (reduce: (state: typeof relationships) => typeof relationships) => { relationships = reduce(relationships); return relationships; } } },
  });
  const Water = module.MossproutWaterAction as React.ComponentType<{ onError: (message: string) => void }>;
  const onError = (message: string) => { error = message; };
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Water onError={onError} />); });
  const row = () => tree!.root.findByType('GoalRow' as React.ElementType);
  const log = () => row().props.onCompletionRequest(null, () => {}, () => { failed = true; });
  assert.equal(row().props.completeOnPress, true);
  assert.equal(tree!.root.findAllByType('Pressable' as React.ElementType).length, 0, 'no inline confirmation controls');
  await act(async () => log());
  assert.equal(failed, true);
  assert.match(error, /could not be saved/);
  assert.equal(completions, 0);
  assert.equal(counts.size, 0);
  failSave = false;
  await act(async () => log());
  await act(async () => log());
  assert.equal(counts.get('companion:water-count:2026-09-05'), 1, 'replaying the same outgoing row cannot double-count');
  assert.equal(row().props.subtitle, 'Tap after you’ve had some water', 'outgoing card is unchanged until animation finishes');
  await act(async () => row().props.onFinished());
  assert.equal(row().props.subtitle, '1 glass logged today');
  assert.equal(row().props.reward, undefined);
  assert.equal(completions, 1);
  await act(async () => log());
  assert.equal(row().props.subtitle, '1 glass logged today');
  await act(async () => row().props.onFinished());
  assert.equal(row().props.subtitle, '2 glasses logged today');
  assert.equal(completions, 1, 'repeat logging does not re-award the daily goal');
  assert.equal(relationships.actionCompletions.length, 1);
  assert.ok(relationships.actionPresentations.every((item) => item.status === 'dismissed'));
  assert.equal(relationships.meditations![0].settledMs, 3600000);
  await act(async () => tree!.unmount());
  await act(async () => { tree = create(<Water onError={onError} />); });
  assert.equal(row().props.subtitle, '2 glasses logged today');
  assert.equal(relationships.meditations![0].settledMs, 3600000);
  dayId = '2026-09-06';
  await act(async () => tree!.update(<Water onError={onError} />));
  assert.equal(row().props.subtitle, 'Tap after you’ve had some water');
  assert.ok(row().props.reward);
  await act(async () => tree!.unmount());
});

for (const familyId of ['mossprout', 'steppling'] as const) {
  test(`${familyId}: Garden toggles visibility without remounting cards and completed work slides away`, async () => {
    let dayId = '2026-09-05';
    const orders = [1, 2].map((id) => ({ id: `daily:${id}`, title: `Request ${id}`, characterId: familyId,
      requirements: [{ definitionId: 'nature:flower:3', quantity: 2 }], reward: { coins: 8 } }));
    let world = { activeOrders: orders, companionDailyGarden: { [familyId]: { dayId, orders, served: {} } } };
    let snapshot: (value: typeof world) => void = () => {};
    const storage = new Map<string, unknown>();
    const opened: string[] = [];
    const overlayModule = loadNativeModule('components/katchadeck/world/companion-scene-overlay.tsx', { 'react-native': nativeViews });
    const module = loadNativeModule('components/katchadeck/world/companion-garden-action.tsx', {
      './companion-scene-overlay': overlayModule,
      'react-native': { ...nativeViews, Pressable: 'Pressable' },
      'expo-image': { Image: 'Image' },
      '@/utils/merge-world/engine': { mergeOrderReady: () => true, mergeWorldStateForBoard: (value: unknown) => value },
      '@/features/merge-world/merge-world-provider': { useOptionalMergeWorldState: () => null, useOptionalMergeWorldActions: () => null },
      '@/hooks/use-companion-calendar-day': { useCompanionCalendarDay: () => dayId },
      '@/utils/app-storage': { getStoredJson: (key: string, fallback: unknown) => storage.get(key) ?? fallback, setStoredJson: (key: string, value: unknown) => storage.set(key, value) },
      '@/utils/merge-world/repository': { ensureStoredCompanionDailyGarden: async () => ({ state: world }), subscribeMergeWorldSnapshots: (fn: typeof snapshot) => { snapshot = fn; return () => {}; } },
      '@/components/katchadeck/ui/day-action-card': { DayActionCardSurface: 'Card' },
      '@/components/katchadeck/ui/day-action-row': { DayActionActiveRow: 'ActiveRow', DayActionCompletedRow: 'CompletedRow' },
      '@/constants/katchimera-action-art': { katchimeraActionArt: () => 1 },
      './mossprout-journey-request-panel': { MossproutJourneyRequestPanel: 'RequestPanel' },
    });
    const Garden = module.CompanionGardenAction as React.ComponentType<{
      familyId: string; onOpenMerge: (id: string) => void;
      children: (card: React.ReactNode) => React.ReactNode;
    }>;
    const render = () => <Garden familyId={familyId} onOpenMerge={(id) => opened.push(id)}>
      {(card) => <>{React.createElement('Tracker')}{card}{React.createElement('NarrativeCard')}</>}
    </Garden>;
    let tree: ReactTestRenderer;
    await act(async () => { tree = create(render()); });
    assert.equal(tree!.root.findAllByType('Card' as React.ElementType).length, 1);
    const tracker = tree!.root.findByType('Tracker' as React.ElementType);
    const narrative = tree!.root.findByType('NarrativeCard' as React.ElementType);
    const gardenRow = tree!.root.findByType('ActiveRow' as React.ElementType);
    const panel = tree!.root.findByType('RequestPanel' as React.ElementType);
    const ordersLayer = panel.parent!;
    const cardsLayer = tracker.parent!;
    const container = cardsLayer.parent!;
    assert.equal(container.props.style, undefined, 'orders reserve no height in the bottom-aligned card section');
    assert.equal(container.props.collapsable, false);
    assert.equal(cardsLayer.props.collapsable, false, 'opacity toggles cannot reparent native animated rows');
    assert.equal(ordersLayer.props.style[0].position, 'absolute');
    assert.equal(ordersLayer.props.style[0].bottom, 0);
    assert.equal(cardsLayer.props.style.opacity, 1);
    assert.equal(ordersLayer.props.pointerEvents, 'none');
    for (let visit = 0; visit < 3; visit++) {
      await act(async () => tree!.root.findByType('Pressable' as React.ElementType).props.onPress());
      assert.equal(tree!.root.findByType('Tracker' as React.ElementType), tracker);
      assert.equal(tree!.root.findByType('NarrativeCard' as React.ElementType), narrative);
      assert.equal(tree!.root.findByType('ActiveRow' as React.ElementType), gardenRow, 'no unmount or entrance replay');
      assert.equal(cardsLayer.props.style.opacity, 0);
      assert.equal(cardsLayer.props.style.display, undefined, 'hidden cards keep their layout');
      assert.equal(cardsLayer.props.pointerEvents, 'none');
      assert.equal(cardsLayer.props.importantForAccessibility, 'no-hide-descendants');
      assert.equal(ordersLayer.props.pointerEvents, 'auto');
      assert.equal(container.props.style, undefined, 'navigation adds no height to the card layout');
      assert.equal(cardsLayer.props.collapsable, false);
      await act(async () => panel.props.onAction());
      assert.equal(cardsLayer.props.style.opacity, 1);
      assert.equal(cardsLayer.props.pointerEvents, 'auto');
      assert.equal(ordersLayer.props.pointerEvents, 'none');
      assert.equal(ordersLayer.props.importantForAccessibility, 'no-hide-descendants');
    }
    await act(async () => tree!.root.findByType('Pressable' as React.ElementType).props.onPress());
    assert.equal(panel.props.animateEntrance, false);
    assert.equal(panel.props.standalone, true);
    assert.equal(panel.props.fitContent, true);
    assert.equal(panel.props.actionLabel, 'Back');
    assert.equal(panel.props.requests.length, 2);
    assert.equal(panel.props.requests[0].badge, undefined, 'reward uses original order description');
    assert.match(panel.props.requests[0].description, /8 Glow/);
    await act(async () => panel.props.onRequestPress('daily:2'));
    assert.deepEqual(opened, ['daily:2']);
    await act(async () => panel.props.onAction());
    assert.equal(tree!.root.findAllByType('Tracker' as React.ElementType).length, 1);
    world = { ...world, activeOrders: [], companionDailyGarden: { [familyId]: { dayId, orders, served: { 'daily:1': 1, 'daily:2': 2 } } } };
    await act(async () => snapshot(world));
    const outro = tree!.root.findByType('CompletedRow' as React.ElementType);
    assert.equal(outro.props.start, true);
    await act(async () => outro.props.onFinished());
    assert.equal(tree!.root.findAllByType('Card' as React.ElementType).length, 0);
    assert.equal(tree!.root.findAllByType('CompletedRow' as React.ElementType).length, 0);
    await act(async () => tree!.unmount());
    await act(async () => { tree = create(render()); });
    assert.equal(tree!.root.findAllByType('Card' as React.ElementType).length, 0, 'done cards do not return after reopening');
    assert.equal(tree!.root.findAllByType('CompletedRow' as React.ElementType).length, 0, 'outro is acknowledged');
    dayId = '2026-09-06';
    world = { activeOrders: orders, companionDailyGarden: { [familyId]: { dayId, orders, served: {} } } };
    await act(async () => tree!.update(render()));
    assert.equal(tree!.root.findAllByType('Card' as React.ElementType).length, 1, 'new daily work enters as a fresh card');
    await act(async () => tree!.unmount());
  });
}


test('Garden orders are outside the card scroll layout even when taller than the remaining actions', async () => {
  const module = loadNativeModule('components/katchadeck/world/companion-scene-overlay.tsx', { 'react-native': nativeViews });
  const Host = module.CompanionSceneOverlayHost as React.ComponentType<{ children: React.ReactNode }>;
  const Overlay = module.CompanionSceneOverlay as React.ComponentType<{ visible: boolean; children: React.ReactNode }>;
  let mounts = 0;
  function RemainingCard() {
    React.useEffect(() => { mounts++; }, []);
    return React.createElement('Card', { style: { height: 66 } });
  }
  const render = (visible: boolean, requestCount = 2) => <Host>
    {React.createElement('ScrollView', {}, <>
      <RemainingCard />
      <Overlay visible={visible}>{React.createElement('RequestPanel', { requestCount, style: { height: 260 } })}</Overlay>
    </>)}
  </Host>;
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(render(false)); });
  const viewport = tree!.root.findByType('ScrollView' as React.ElementType);
  const card = tree!.root.findByType('Card' as React.ElementType);
  for (let visit = 0; visit < 3; visit++) {
    await act(async () => tree!.update(render(true)));
    assert.equal(viewport.findAllByType('RequestPanel' as React.ElementType).length, 0, 'orders cannot change scroll height or be clipped by it');
    const panel = tree!.root.findByType('RequestPanel' as React.ElementType);
    assert.equal(panel.parent!.props.style.position, 'absolute');
    assert.equal(panel.parent!.props.style.bottom, 0);
    assert.equal(viewport.parent!.props.style, undefined, 'host adds no minHeight');
    await act(async () => tree!.update(render(true, 3)));
    assert.equal(tree!.root.findByType('RequestPanel' as React.ElementType).props.requestCount, 3, 'open orders continue receiving live updates');
    await act(async () => tree!.update(render(false)));
    assert.equal(tree!.root.findByType('Card' as React.ElementType), card);
    assert.equal(mounts, 1);
    assert.equal(tree!.root.findAllByType('RequestPanel' as React.ElementType).length, 0);
  }
  await act(async () => tree!.unmount());
});
