import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialMergeWorldState, normalizeMergeWorldState } from '../utils/merge-world/engine';
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
