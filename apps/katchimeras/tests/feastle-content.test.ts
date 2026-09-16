import assert from 'node:assert/strict';
import test from 'node:test';
import { FEASTLE_CHAPTER } from '../constants/companion-journey-chapters/feastle';
import { emptyRelationshipProgressState } from '../game/katchimeras/relationship-progression';
import { createInitialMergeWorldState } from '../utils/merge-world/engine';
import { emptyCompanionBondState } from '../utils/companion-bond';
import { emptyCompanionContentState } from '../utils/companion-content';
import { journeyChapterState, type JourneyTriggerFacts } from '../features/companion/journey-triggers';

test('Feastle waits for each authored meal delivery even after the chapter timer has elapsed', () => {
  const now = Date.UTC(2026, 8, 16, 12);
  for (const index of [2, 4, 6]) {
    const relationships = emptyRelationshipProgressState();
    relationships.journeyEpisodes = {};
    for (const episode of FEASTLE_CHAPTER.episodes.slice(0, index)) {
      relationships.journeyEpisodes[`feastle:${episode.id}`] = {
        familyId: 'feastle', episodeId: episode.id, completedAt: now - 24 * 3600000, answers: {}, facts: {},
      };
    }
    const world = createInitialMergeWorldState(now);
    const input: JourneyTriggerFacts = { familyId: 'feastle', now, world, relationships,
      bond: emptyCompanionBondState(), content: emptyCompanionContentState(), dayOneComplete: true };
    const episode = FEASTLE_CHAPTER.episodes[index];
    const gate = episode.unlock.find((condition) => condition.kind === 'orders_served');
    assert.ok(gate?.kind === 'orders_served');
    const authoredOrders = FEASTLE_CHAPTER.episodes[index - 1].consequences?.flatMap((effect) => effect.kind === 'garden_orders' ? effect.orders.map((order) => order.id) : []) ?? [];
    assert.deepEqual(gate.orderIds, authoredOrders, 'the previous conversation actually creates the required orders');
    assert.equal(journeyChapterState(FEASTLE_CHAPTER, input).next?.status, 'locked');
    world.externalRewardReceipts = gate.orderIds.map((id) => ({ id: `merge-story-served:${id}`, kind: 'story_order_served', characterId: 'feastle', amount: 0, createdAt: now, appliedAt: now }));
    const ready = journeyChapterState(FEASTLE_CHAPTER, input);
    assert.equal(ready.next?.episode.id, episode.id);
    assert.equal(ready.next?.status, 'available');
  }
});
