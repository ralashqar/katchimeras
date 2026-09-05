import assert from 'node:assert/strict';
import test from 'node:test';
import { MERGE_GENERATORS, MERGE_ITEMS_BY_ID, MERGE_ORDER_TEMPLATES } from '../constants/merge-world-catalog';
import { ensureOrderRequiresMerge, ensureOrdersRequireMerge } from '../utils/merge-world/order-requirements';
import { createInitialMergeWorldState, normalizeMergeWorldState, reduceMergeWorld } from '../utils/merge-world/engine';
import { createJourneyCycle } from '../game/katchimeras/companion-journey-cycle';
import type { MergeOrder } from '../types/merge-world';

const now = new Date(2026, 8, 5, 12).getTime();
function order(definitionId: string, quantity = 1): MergeOrder {
  return { id: 'legacy-order', characterId: 'mossprout', title: 'A garden request', difficulty: 'small',
    requirements: [{ definitionId, quantity }], reward: { coins: 8, energy: 0, mergeXp: 0, friendshipXp: 0 },
    createdAt: now, signature: false, purpose: 'normal' };
}

test('every spawnable tier-one-only request is promoted within the same chain, once', () => {
  for (const definitionId of new Set(MERGE_GENERATORS.flatMap((generator) => generator.tierOneDropDefinitionIds))) {
    const original = order(definitionId, 2);
    const promoted = ensureOrderRequiresMerge(original);
    const result = MERGE_ITEMS_BY_ID.get(promoted.requirements[0].definitionId)!;
    assert.ok(result.tier >= 2, definitionId);
    assert.equal(result.chainId, MERGE_ITEMS_BY_ID.get(definitionId)!.chainId);
    assert.equal(promoted.requirements[0].quantity, 2);
    assert.equal(promoted.id, original.id);
    assert.equal(promoted.reward, original.reward);
    assert.equal(ensureOrderRequiresMerge(promoted), promoted);
  }
});

test('combinations already requiring a merge and special items retain their authored requirements', () => {
  const mixed = { ...order('nature:garden:1'), requirements: [{ definitionId: 'nature:garden:1', quantity: 1 }, { definitionId: 'nature:waterside:3', quantity: 1 }] };
  assert.equal(ensureOrderRequiresMerge(mixed), mixed);
  const hybrid = order('hybrid:rain-mirror');
  assert.equal(ensureOrderRequiresMerge(hybrid), hybrid);
  for (const template of MERGE_ORDER_TEMPLATES) {
    const authored = { ...order(template.requirements[0].definitionId), requirements: template.requirements };
    assert.equal(ensureOrderRequiresMerge(authored), authored, template.key);
  }
  const unmergedCombo = { ...order('nature:garden:1'), requirements: [{ definitionId: 'nature:garden:1', quantity: 1 }, { definitionId: 'nature:waterside:1', quantity: 1 }] };
  assert.equal(ensureOrderRequiresMerge(unmergedCombo).requirements[0].definitionId, 'nature:garden:2');
});

test('loading old requests upgrades the active rail and daily preview without resetting served history', () => {
  const pending = order('nature:garden:1');
  const served = { ...order('nature:garden:1'), id: 'already-served' };
  const state = { ...createInitialMergeWorldState(now), activeOrders: [pending], companionDailyGarden: {
    mossprout: { dayId: '2026-09-05', orders: [pending, served], served: { 'already-served': now }, bonusReceiptId: null },
  } };
  const updated = normalizeMergeWorldState(state, now);
  assert.equal(updated.activeOrders.find((item) => item.id === pending.id)!.requirements[0].definitionId, 'nature:garden:2');
  const batch = updated.companionDailyGarden!.mossprout!;
  assert.equal(batch.orders[0].requirements[0].definitionId, 'nature:garden:2');
  assert.equal(batch.orders[1].requirements[0].definitionId, 'nature:garden:1');
  assert.deepEqual(batch.served, { 'already-served': now });
  assert.equal(ensureOrdersRequireMerge(updated), updated);
});

test('an old request cannot consume a spawned item or award a reward before it is merged', () => {
  const pending = order('nature:garden:1');
  const state = createInitialMergeWorldState(now);
  state.activeOrders = [pending];
  state.board[0] = { ...state.board[0], locked: false, mist: null, blocker: null,
    occupant: { kind: 'item', instanceId: 'seed', definitionId: 'nature:garden:1' } };
  const attempted = reduceMergeWorld(state, { type: 'serveOrder', orderId: pending.id, now });
  assert.equal(attempted.state.activeOrders[0].requirements[0].definitionId, 'nature:garden:2');
  assert.equal(attempted.state.board[0].occupant?.kind, 'item');
  assert.equal(attempted.state.coins, state.coins);
  assert.equal(attempted.state.completedOrderCount, state.completedOrderCount);
  const ready = { ...attempted.state, board: attempted.state.board.map((cell, index) => index === 0
    ? { ...cell, occupant: { kind: 'item' as const, instanceId: 'sprout', definitionId: 'nature:garden:2' } } : cell) };
  const served = reduceMergeWorld(ready, { type: 'serveOrder', orderId: pending.id, now: now + 1 });
  assert.equal(served.state.coins, state.coins + pending.reward.coins);
  assert.equal(served.state.activeOrders.some((item) => item.id === pending.id), false);
});

for (const familyId of ['mossprout', 'steppling'] as const) {
  test(`${familyId}: reconciliation cannot reintroduce a legacy tier-one meditation request`, () => {
    const cycle = createJourneyCycle({ id: `journey-cycle:${familyId}:old`, familyId, episodeId: 'one', number: 1, chapterId: 'one', title: 'First', nextTitle: 'Next', completedAt: now, finale: false });
    const definitionId = familyId === 'mossprout' ? 'nature:garden:1' : 'adventure:trail:1';
    cycle.requests[0] = { ...cycle.requests[0], orderId: `${cycle.id}:request:1`, definitionId };
    const command = { type: 'reconcileJourneyMeditation' as const, cycle, now, availableAt: now + 3600000 };
    const first = reduceMergeWorld(createInitialMergeWorldState(now), command);
    const active = first.state.activeOrders.find((item) => item.id === cycle.requests[0].orderId)!;
    assert.ok(MERGE_ITEMS_BY_ID.get(active.requirements[0].definitionId)!.tier >= 2);
    const replay = reduceMergeWorld(first.state, command);
    assert.equal(replay.changed, false);
    assert.equal(replay.state, first.state);
  });
}
