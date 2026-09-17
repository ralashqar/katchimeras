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

test('a saved Feastle chapter restores two Snacks and serving opens its closing scene once', () => {
  let world = createInitialMergeWorldState(now);
  assert.equal(journeyGardenOrders(emptyRelationshipProgressState(), world).length, 0);
  world = reconcileJourneyGardenOrders(world, relationships, now);
  const order = world.activeOrders.find(item => item.id === 'feastle:chapter-1:doorstep-snacks')!;
  assert.ok(order);
  assert.deepEqual(order.requirements, [{ definitionId: 'food:table:2', quantity: 2 }]);
  assert.equal(reconcileJourneyGardenOrders(world, relationships, now), world);
  const state = () => journeyChapterState(FEASTLE_CHAPTER, { familyId: 'feastle', now, relationships, world, dayOneComplete: true, content: emptyCompanionContentState(), bond: emptyCompanionBondState() });
  assert.equal(state().next?.status, 'locked');
  const slots = world.board.flatMap((cell, index) => !cell.locked && !cell.blocker && !cell.occupant ? [index] : []).slice(0, 2);
  assert.equal(slots.length, 2);
  world = { ...world, board: world.board.map((cell, index) => slots.includes(index) ? { ...cell, occupant: { kind: 'item' as const, instanceId: `snack:${index}`, definitionId: 'food:table:2' } } : cell) };
  assert.deepEqual(journeyGardenReturnNotes(relationships, world), []);
  const coins = world.coins;
  const served = reduceMergeWorld(world, { type: 'serveOrder', orderId: order.id, now });
  assert.equal(served.servedOrderId, order.id);
  world = normalizeMergeWorldState(JSON.parse(JSON.stringify(served.state)), now);
  assert.equal(world.coins, coins + 25);
  const notes = journeyGardenReturnNotes(relationships, world);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].characterId, 'feastle');
  assert.equal(notes[0].conversationId, 'feastle:journey:day-2-return');
  assert.deepEqual(journeyGardenReturnNotes(relationships, JSON.parse(JSON.stringify(world))), notes);
  const continued = { ...relationships, journeyEpisodes: { ...relationships.journeyEpisodes, 'feastle:day-2-return': { familyId: 'feastle', episodeId: 'day-2-return', completedAt: now, answers: {}, facts: {} } } };
  assert.deepEqual(journeyGardenReturnNotes(continued, world), []);
  assert.ok(world.externalRewardReceipts.some(receipt => receipt.id === `merge-story-served:${order.id}`));
  assert.equal(state().next?.episode.id, 'day-2-return');
  assert.equal(state().next?.status, 'available');
  assert.equal(reconcileJourneyGardenOrders(world, relationships, now), world, 'served requests stay served after restart');
  assert.equal(reduceMergeWorld(world, { type: 'serveOrder', orderId: order.id, now }).changed, false);
});

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

test('chapter return opens the companion without invoking legacy reward progression', () => {
  const pushed: unknown[] = [];
  const { openCharacterReturn } = loadNativeModule('components/katchadeck/games/merge-world-screen.tsx', {}, {
    useCallback: (callback: unknown) => callback,
    active: true,
    storyNavigationPendingRef: { current: false },
    parseIslandCampaignReturnNoteId: () => null,
    MOSSPROUT_FTUE_RETURN_NOTE_ID: 'ftue',
    JOURNEY_DELIVERY_NOTE_PREFIX: 'chat-note:journey-delivery:',
    transitionTo: ({ navigate }: { navigate: () => void }) => { navigate(); return true; },
    router: { push: (route: unknown) => pushed.push(route) },
    mossproutJourneyDayId: null,
    returnToIslandCampaign: () => {},
    beginFeastleReturn: () => assert.fail('must not replay legacy return'),
  }, 'openCharacterReturn');
  openCharacterReturn('feastle', 'chat-note:journey-delivery:feastle:day-2');
  assert.deepEqual(JSON.parse(JSON.stringify(pushed)), [{ pathname: '/katchimera/[creatureId]', params: { creatureId: 'companion:feastle', source: 'merge-world', story: 'return', journeyDelivery: 'chat-note:journey-delivery:feastle:day-2' } }]);
});
