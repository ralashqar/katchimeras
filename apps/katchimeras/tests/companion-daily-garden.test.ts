import { createMossproutChapterZeroState } from '../utils/merge-world/onboarding';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialMergeWorldState, reduceMergeWorld, normalizeMergeWorldState, mergeOrderReady } from '../utils/merge-world/engine';
import { ensureCompanionDailyGarden } from '../utils/merge-world/companion-daily-garden';
import type { MergeOrder, MergeWorldState } from '../types/merge-world';
import { createJourneyCycle, installJourneyCycle, settleDailyGardenDelivery } from '../game/katchimeras/companion-journey-cycle';
import { emptyRelationshipProgressState } from '../game/katchimeras/relationship-progression';
import { localDayId } from '../utils/world-identity-rules';

const now = new Date(2026, 8, 5, 12).getTime();
function world(family: 'mossprout' | 'steppling' = 'mossprout') {
  let state = family === 'mossprout' ? createMossproutChapterZeroState(now) : createInitialMergeWorldState(now);
  state = reduceMergeWorld(state, { type: 'featureCharacter', characterId: family, now }).state;
  return { ...state, mossproutDailyGardenOrders: null, unlockedCharacters: [...new Set([...state.unlockedCharacters, family])] };
}
function fill(state: MergeWorldState, order: MergeOrder) {
  const items = order.requirements.flatMap((item) => Array.from({ length: item.quantity }, () => item.definitionId));
  return { ...state, board: state.board.map((cell, index) => ({ ...cell, locked: false, mist: null, blocker: null,
    occupant: items[index] ? { kind: 'item' as const, instanceId: `test:${index}`, definitionId: items[index], createdAt: now } : null })) };
}

for (const family of ['mossprout', 'steppling'] as const) {
  test(`${family}: daily pair is obtainable, substantial, frozen and persists`, () => {
    const original = ensureCompanionDailyGarden(world(family), family, now);
    const batch = original.companionDailyGarden![family]!;
    assert.equal(batch.orders.length, 2);
    assert.equal(batch.orders[0].requirements.reduce((n, item) => n + item.quantity, 0), 2);
    assert.ok(batch.orders.every((order) => order.requirements.every((item) => Number(item.definitionId.split(':').at(-1)) >= 3)));
    assert.equal(ensureCompanionDailyGarden(original, family, now + 10000), original);
    const restored = normalizeMergeWorldState(JSON.parse(JSON.stringify(original)), now);
    assert.deepEqual(restored.companionDailyGarden![family], batch);
  });
}

test('both deliveries consume their full requirements and award the bonus only once', () => {
  let state = ensureCompanionDailyGarden(world(), 'mossprout', now);
  const orders = state.companionDailyGarden!.mossprout!.orders;
  const coins = state.coins;
  for (const order of orders) {
    state = fill(state, order);
    assert.equal(mergeOrderReady(state, order), true);
    const result = reduceMergeWorld(state, { type: 'serveOrder', orderId: order.id, now });
    assert.equal(result.changed, true);
    state = result.state;
    assert.equal(state.board.filter((cell) => cell.occupant?.kind === 'item').length, 0);
    assert.equal(reduceMergeWorld(state, { type: 'serveOrder', orderId: order.id, now }).changed, false);
  }
  assert.equal(state.coins - coins, 24);
  assert.equal(Object.keys(state.companionDailyGarden!.mossprout!.served).length, 2);
  assert.ok(state.companionDailyGarden!.mossprout!.bonusReceiptId);
  assert.equal(state.activeOrders.some((order) => order.storyArcId === 'companion:daily-garden'), false);
  assert.equal(ensureCompanionDailyGarden(state, 'mossprout', now), state);
});

test('same-chain combinations require two distinct items', () => {
  const initial = world();
  // Garden Basket has two core chains, so force the single-chain fallback by
  // selecting a batch whose combo has the same requirement twice, as normalized generation does.
  const state = ensureCompanionDailyGarden(initial, 'mossprout', now);
  const order = state.companionDailyGarden!.mossprout!.orders[0];
  const combined = { ...order, requirements: [{ ...order.requirements[0], quantity: 2 }] };
  const one = fill(state, { ...combined, requirements: [{ ...combined.requirements[0], quantity: 1 }] });
  assert.equal(mergeOrderReady(one, combined), false);
  assert.equal(mergeOrderReady(fill(state, combined), combined), true);
});

test('midnight expires only optional daily requests, preserving inventory and chapter orders', () => {
  let state = ensureCompanionDailyGarden(world(), 'mossprout', now);
  const order = state.companionDailyGarden!.mossprout!.orders[0];
  state = fill(state, order);
  const chapter = { ...order, id: 'required-chapter', storyArcId: 'mossprout:chapter:one' };
  state = { ...state, activeOrders: [...state.activeOrders, chapter] };
  const tomorrow = new Date(2026, 8, 6, 0, 1).getTime();
  assert.equal(reduceMergeWorld(state, { type: 'serveOrder', orderId: order.id, now: tomorrow }).changed, false);
  const next = ensureCompanionDailyGarden(state, 'mossprout', tomorrow);
  assert.equal(next.board, state.board);
  assert.ok(next.activeOrders.some((item) => item.id === chapter.id));
  assert.equal(next.companionDailyGarden!.mossprout!.dayId, localDayId(new Date(tomorrow)));
  assert.equal(next.activeOrders.some((item) => item.id === order.id), false);
});

test('saved legacy daily batch survives today and switches tomorrow', () => {
  const initial = { ...world(), companionDailyGardenVersion: undefined, companionDailyGarden: undefined,
    mossproutDailyGardenOrders: { dayId: localDayId(new Date(now)), activeOrderId: 'saved', offeredOrderIds: ['saved'], servedOrderIds: [], complete: false } };
  const migrated = ensureCompanionDailyGarden(initial, 'mossprout', now);
  assert.equal(migrated.mossproutDailyGardenOrders, initial.mossproutDailyGardenOrders);
  assert.equal(migrated.companionDailyGarden?.mossprout, undefined);
  const next = ensureCompanionDailyGarden(migrated, 'mossprout', now + 86400000);
  assert.equal(next.companionDailyGarden!.mossprout!.orders.length, 2);
});

test('daily receipts cannot advance story, bank reductions, or settle more than two orders per rest', () => {
  const cycle = createJourneyCycle({ id: 'cycle', familyId: 'steppling', episodeId: 'episode', chapterId: 'chapter', number: 1, title: 'Trail', nextTitle: 'Next', completedAt: now, finale: false });
  let state = installJourneyCycle(emptyRelationshipProgressState(), cycle);
  assert.ok(cycle.requests.filter((item) => item.kind === 'merge').every((item) => item.orderId == null));
  assert.equal(settleDailyGardenDelivery(state, 'steppling', 'before', now - 1), state);
  for (let index = 0; index < 4; index++) state = settleDailyGardenDelivery(state, 'steppling', `receipt:${index}`, now + 1000 + index);
  assert.equal(state.meditations![0].settledMs, 10 * 60000);
  assert.equal(state.journeyCycles![0].returnedAt, null);
  assert.equal(settleDailyGardenDelivery(state, 'steppling', 'receipt:0', now + 1000), state);
  assert.equal(settleDailyGardenDelivery(state, 'steppling', 'late', now + 9 * 3600000), state);
});


test('story reconciliation preserves both daily cards and repairs an omitted order shell', () => {
  for (const familyId of ['mossprout', 'steppling'] as const) {
    const initial = ensureCompanionDailyGarden(world(familyId), familyId, now);
    const ids = initial.companionDailyGarden![familyId]!.orders.map((order) => order.id);
    const active = familyId === 'mossprout'
      ? reduceMergeWorld(initial, { type: 'reconcileCharacterActivity', familyId, dayId: localDayId(new Date(now)), status: 'activity_in_progress', activity: { objectiveId: 'mossprout:objective:nursery-key', mergeOrderId: 'merge-story:mossprout:memory-nursery:ivy-gate', opportunityId: 'none', generatorId: 'wild-garden', dropDefinitionIds: [] }, now }).state
      : reduceMergeWorld(initial, { type: 'reconcileStory', familyId, status: 'order_active', targetLevel: 6, actPhase: 'regular_orders', now }).state;
    assert.ok(ids.every((id) => active.activeOrders.some((order) => order.id === id)));
    const repaired = ensureCompanionDailyGarden({ ...active, activeOrders: active.activeOrders.filter((order) => order.id !== ids[0]) }, familyId, now);
    assert.ok(ids.every((id) => repaired.activeOrders.some((order) => order.id === id)));
    assert.deepEqual(repaired.companionDailyGarden, initial.companionDailyGarden);
  }
});
