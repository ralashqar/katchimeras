import assert from 'node:assert/strict';
import test from 'node:test';

import { BARISTABBIT_HATCHABLE } from '@/constants/hatchable-companions/baristabbit';
import { createHatchableDiscoveryFlow } from '@/features/onboarding/hatchable-flows';
import { hatchableAvailable } from '@/utils/merge-world/glow-discovery-policy';
import { createInitialMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';

test('Baristabbit comes home without an Egg: the board, the tile, the rescue, the welcome', () => {
  const flow = createHatchableDiscoveryFlow(BARISTABBIT_HATCHABLE);
  const ids = flow.nodes.map((node) => node.id);
  assert.ok(!ids.includes('gateway.egg') && !ids.includes('egg.enter'), 'no Egg');
  const rescue = flow.nodes.find((node) => node.id === 'gateway.rescue');
  assert.equal(rescue?.kind, 'effect');
  assert.equal(rescue?.kind === 'effect' ? rescue.capability : null, 'haven.friend_joins');
  assert.ok(ids.indexOf('gateway.rescue') > ids.indexOf('mission.clear'), 'after his board is cleared');
  assert.equal(flow.migrations?.['gateway.egg'], 'gateway.rescue', 'a save parked at the old Egg moves on');
});

test('his window wakes once Steppling is home, and the rescue brings him home once', () => {
  const fresh = createInitialMergeWorldState(1_000);
  assert.equal(hatchableAvailable(fresh, BARISTABBIT_HATCHABLE), false, 'asleep in the first session');
  const steppling = reduceMergeWorld(fresh, { type: 'rescueWorldFriend', targetId: 'mossprout:overgrown-trail', now: 1_500 }).state;
  assert.equal(hatchableAvailable(steppling, BARISTABBIT_HATCHABLE), true, 'Chapter 1: the lit window');
  const home = reduceMergeWorld(steppling, { type: 'rescueWorldFriend', targetId: BARISTABBIT_HATCHABLE.tile.unlockId, now: 2_000 });
  assert.equal(home.changed, true);
  assert.ok(home.state.companionDiscovery.records.some((record) => record.characterId === 'baristabbit'));
  assert.equal(reduceMergeWorld(home.state, { type: 'rescueWorldFriend', targetId: BARISTABBIT_HATCHABLE.tile.unlockId, now: 2_100 }).changed, false, 'once');
});

test('Feastle comes home without an Egg once Petalimp is home, and turns the Café into a Kitchen', async () => {
  const { FEASTLE_HATCHABLE } = await import('@/constants/hatchable-companions/feastle');
  const { createSupplyRunBoard, kitchenOpen, supplyOrder } = await import('@/features/supply-run/supply-run');
  const { SANCTUARY_CHAPTERS } = await import('@/constants/sanctuary-chapters');
  const ids = createHatchableDiscoveryFlow(FEASTLE_HATCHABLE).nodes.map((node) => node.id);
  assert.ok(ids.includes('gateway.rescue') && !ids.includes('gateway.egg'), 'no Egg');
  const fresh = createInitialMergeWorldState(1_000);
  assert.equal(hatchableAvailable(fresh, FEASTLE_HATCHABLE), false);
  const petalimp = { ...fresh, islandCampaigns: { 'island-campaign:petalimp-bloom': { residentSkinId: 'petalimp', cardEarnedAt: 1_200 } } } as never;
  assert.equal(hatchableAvailable(petalimp, FEASTLE_HATCHABLE), true, 'the warm table wakes after Petalimp');
  const home = reduceMergeWorld(fresh, { type: 'rescueWorldFriend', targetId: FEASTLE_HATCHABLE.tile.unlockId, now: 2_000 }).state;
  assert.equal(kitchenOpen(home), true);
  const board = createSupplyRunBoard(1_000, true);
  const generators = board.board.flatMap((cell) => (cell.occupant?.kind === 'generator' ? [cell.occupant.generatorId] : []));
  assert.deepEqual(generators.sort(), ['cafe-counter', 'hearth-pantry', 'ritual-bar']);
  const chains = new Set(generators.flatMap((id) => {
    const generator = board.generators[id];
    return [...(generator?.tierOneDropDefinitionIds ?? []), ...(generator?.forcedDropDefinitionId ? [generator.forcedDropDefinitionId] : [])].map((drop) => drop.replace(/:\d+$/, ''));
  }));
  for (const slot of [0, 1] as const) for (let index = 0; index < 8; index += 1) {
    for (const requirement of supplyOrder(slot, index, true).requirements) assert.ok(chains.has(requirement.definitionId.replace(/:\d+$/, '')), `${requirement.definitionId} can be made in the Kitchen`);
  }
  assert.ok(Math.max(...[0, 1, 2, 3].map((index) => supplyOrder(1, index, true).meals)) > Math.max(...[0, 1, 2].map((index) => supplyOrder(1, index).meals)), 'feasts pay more Meals');
  const kitchen = SANCTUARY_CHAPTERS.find((chapter) => chapter.id === 'the-kitchen')!;
  assert.equal(kitchen.number, 4);
  assert.deepEqual(kitchen.goals[0]!.action, { kind: 'world_offer', offerId: 'mist:feastle-home' });
});
