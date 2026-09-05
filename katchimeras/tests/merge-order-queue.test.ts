import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialMergeWorldState, normalizeMergeWorldState, reduceMergeWorld } from '../utils/merge-world/engine';
import { prioritizedVisibleMergeOrders } from '../utils/merge-world/order-presentation';
import { MERGE_ITEMS_BY_ID, MERGE_REPEATABLE_ORDER_TEMPLATES } from '../constants/merge-world-catalog';
import type { MergeOrder } from '../types/merge-world';

const now = Date.UTC(2026, 8, 5, 12);
const order = (id: string, storyArcId?: string): MergeOrder => ({
  id, characterId: 'mossprout', title: id, storyArcId, difficulty: 'medium',
  requirements: [{ definitionId: 'nature:garden:4', quantity: 1 }],
  reward: { coins: 8, mergeXp: 0, friendshipXp: 0, energy: 0 }, createdAt: now, signature: false, purpose: 'normal',
});

test('one request advances through Journey, daily preview order, then free play even in exclusive Journey mode', () => {
  const first = order('journey:first', 'mossprout:chapter:test');
  const second = order('journey:second', 'mossprout:chapter:test');
  const dailyA = order('daily:first', 'companion:daily-garden');
  const dailyB = order('daily:second', 'companion:daily-garden');
  const repeat = order('repeat');
  let state = { ...createInitialMergeWorldState(now), activeOrders: [repeat, dailyB, second, dailyA, first],
    companionDailyGarden: { mossprout: { dayId: '2026-09-05', orders: [dailyA, dailyB], served: {}, bonusReceiptId: null } } };
  const context = { characterId: 'mossprout', exclusiveJourney: true, focusOrderId: dailyB.id, journeyOrderIds: new Set([first.id, second.id]) };
  for (const expected of [first, second, dailyA, dailyB, repeat]) {
    assert.deepEqual(prioritizedVisibleMergeOrders(state, context).map((item) => item.id), [expected.id]);
    state = { ...state, activeOrders: state.activeOrders.filter((item) => item.id !== expected.id) };
  }
  assert.deepEqual(prioritizedVisibleMergeOrders(state, context), []);
});

test('tutorial request takes precedence over later daily or selected requests', () => {
  const tutorial = order('mossprout:chapter-0:first-sprout');
  const state = { ...createInitialMergeWorldState(now), activeOrders: [order('repeat'), tutorial] };
  assert.deepEqual(prioritizedVisibleMergeOrders(state, { focusOrderId: 'repeat' }), [tutorial]);
});

test('Steppling preview selects his queue on the shared Mossprout board, then keeps replenishing', () => {
  let state = createInitialMergeWorldState(now, ['mossprout', 'steppling']);
  state = reduceMergeWorld(state, { type: 'featureCharacter', characterId: 'steppling', now }).state;
  state = reduceMergeWorld(state, { type: 'featureCharacter', characterId: 'mossprout', now }).state;
  state.stepplingGardenLesson = { preparedAt: now - 1000, servedAt: now };
  state.unlockedChains = ['nature:garden', 'nature:waterside', 'adventure:trail', 'adventure:travel'];
  state = normalizeMergeWorldState(state, now);
  const batch = state.companionDailyGarden!.steppling!;
  assert.equal(batch.orders.length, 2);
  // A preview of the second request must still start at the first request.
  const oldLink = { characterId: 'mossprout', focusOrderId: batch.orders[1].id };
  assert.equal(prioritizedVisibleMergeOrders(state, oldLink)[0]?.id, batch.orders[0].id);
  const context = { characterId: 'steppling', focusOrderId: batch.orders[1].id };
  for (let index = 0; index < 5; index++) {
    const [current] = prioritizedVisibleMergeOrders(state, context);
    assert.ok(current, `request ${index + 1} exists`);
    assert.equal(current.characterId, 'steppling');
    if (index < 2) assert.equal(current.id, batch.orders[index].id);
    else assert.equal(current.storyArcId, undefined, 'daily requests are followed by repeatable requests');
    const definitions = current.requirements.flatMap((item) => Array.from({ length: item.quantity }, () => item.definitionId));
    state = { ...state, board: state.board.map((cell, slot) => ({ ...cell, locked: false, blocker: null, mist: null,
      occupant: definitions[slot] ? { kind: 'item' as const, definitionId: definitions[slot], instanceId: `serve:${index}:${slot}` } : null })) };
    const result = reduceMergeWorld(state, { type: 'serveOrder', orderId: current.id, now });
    assert.equal(result.changed, true, result.message);
    state = result.state;
    assert.ok(prioritizedVisibleMergeOrders(state, context).length, 'serving refills immediately, without a reload');
    state = normalizeMergeWorldState(JSON.parse(JSON.stringify(state)), now);
  }
  assert.equal(Object.keys(state.companionDailyGarden!.steppling!.served).length, 2);
  assert.ok(state.activeOrders.some((item) => item.characterId === 'mossprout' && !item.storyArcId));
});

test('three existing Mossprout repeatables cannot crowd Steppling out; missing daily requests are repaired', () => {
  let state = createInitialMergeWorldState(now, ['mossprout', 'steppling']);
  state = reduceMergeWorld(state, { type: 'featureCharacter', characterId: 'steppling', now }).state;
  state.stepplingGardenLesson = { preparedAt: now - 1000, servedAt: now };
  state.unlockedChains = ['nature:garden', 'nature:waterside', 'adventure:trail', 'adventure:travel'];
  state = normalizeMergeWorldState(state, now);
  const batch = state.companionDailyGarden!.steppling!;
  state.activeOrders = [order('repeat:1'), order('repeat:2'), order('repeat:3')];
  state = normalizeMergeWorldState(state, now);
  assert.deepEqual(state.companionDailyGarden!.steppling, batch);
  assert.ok(batch.orders.every((item) => state.activeOrders.some((candidate) => candidate.id === item.id)));
  assert.ok(state.activeOrders.some((item) => item.characterId === 'steppling' && !item.storyArcId));
});

test('new repeatable requests require a tier four item or a substantial combination at low Bond', () => {
  for (const template of MERGE_REPEATABLE_ORDER_TEMPLATES) {
    const tiers = template.requirements.map((item) => MERGE_ITEMS_BY_ID.get(item.definitionId)!.tier);
    assert.ok(tiers.every((tier) => tier >= 3), template.key);
    assert.ok(tiers.length > 1 || tiers[0] >= 4, template.key);
  }
  const fresh = createInitialMergeWorldState(now, ['mossprout', 'steppling']);
  fresh.unlockedChains = ['nature:garden', 'nature:waterside', 'adventure:trail', 'adventure:travel'];
  fresh.companionDiscovery.records.push({ characterId: 'steppling', source: 'legacy_grandfather',
    gateId: 'gate-2-steppling', pathId: null, discoveredAt: now, revealSeenAt: now,
    firstOrderCompletedAt: now, permanentFeatureId: null });
  const state = normalizeMergeWorldState(fresh, now);
  const generated = state.activeOrders.filter((item) => !item.storyArcId);
  assert.ok(generated.length > 0);
  assert.ok(generated.every((item) => item.requirements.every((requirement) => MERGE_ITEMS_BY_ID.get(requirement.definitionId)!.tier >= 3)));
});
