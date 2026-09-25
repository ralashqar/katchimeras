import assert from 'node:assert/strict';
import test from 'node:test';
import { journeyGardenOrders, journeyGardenReturnNotes, reconcileJourneyGardenOrders } from '@/features/companion/journey-garden-orders';
import { createInitialMergeWorldState, normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { emptyRelationshipProgressState } from '@/game/katchimeras/relationship-progression';
import { journeyChapterState } from '@/features/companion/journey-triggers';
import { FEASTLE_CHAPTER } from '@/constants/companion-journey-chapters/feastle';
import { emptyCompanionContentState } from '@/utils/companion-content';
import { emptyCompanionBondState } from '@/utils/companion-bond';
import { loadNativeModule } from './helpers/native-motion-harness';

const now = Date.now();
const relationships = { ...emptyRelationshipProgressState(), journeyEpisodes: Object.fromEntries(['day-1', 'day-2'].map(episodeId => [`feastle:${episodeId}`, { familyId: 'feastle', episodeId, completedAt: now - 3 * 3600000, answers: {}, facts: {} }])) };

test('the real Feastle provider reconciliation preserves authored requests instead of applying retired story orders', () => {
  const world = createInitialMergeWorldState(now);
  const { reconcileFeastleStory } = loadNativeModule('features/merge-world/merge-world-provider.tsx', {}, {
    useCallback: (callback: unknown) => callback,
    journeyChapterFor: () => FEASTLE_CHAPTER,
    reconcileJourneyGardenOrders,
    relationshipProgressionRepository: { load: () => relationships },
  }, 'reconcileFeastleStory');
  const projected = reconcileFeastleStory(world, now);
  assert.ok(projected.activeOrders.some((order: { id: string }) => order.id === 'feastle:chapter-1:doorstep-snacks'));
  assert.equal(reconcileFeastleStory(projected, now), projected);
});

test('a multi-order chapter only offers a return after its final delivery', () => {
  const order = { id: 'first', title: 'First', description: '', coins: 1, requirements: [] };
  const chapter = { ...FEASTLE_CHAPTER, episodes: [{ ...FEASTLE_CHAPTER.episodes[1], consequences: undefined, consequence: { kind: 'garden_orders' as const, objectiveId: 'batch', storyArcId: 'batch', orders: [order, { ...order, id: 'last' }] } }, FEASTLE_CHAPTER.episodes[2]] };
  const world = createInitialMergeWorldState(now);
  const receipt = (id: string) => ({ id: `merge-story-served:${id}`, kind: 'story_order_served' as const, characterId: 'feastle', amount: 0, createdAt: now, appliedAt: now });
  world.externalRewardReceipts = [receipt('first')];
  assert.deepEqual(journeyGardenReturnNotes(relationships, world, [chapter]), []);
  world.externalRewardReceipts.push(receipt('last'));
  assert.equal(journeyGardenReturnNotes(relationships, world, [chapter]).length, 1);
});
