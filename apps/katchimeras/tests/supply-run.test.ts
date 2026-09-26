import assert from 'node:assert/strict';
import test from 'node:test';

import { heartwoodBuildingTimberCost } from '@/constants/heartwood-buildings';
import { upgradeHeartwoodBuilding } from '@/features/heartwood-buildings/buildings-world';
import { createSupplyRunBoard, supplyOrder, supplyRunSlots } from '@/features/supply-run/supply-run';
import { createInitialMergeWorldState, mergeOrderReady, normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import type { MergeWorldState } from '@/types/merge-world';

test('a Café order is served off the board and pays Meals, Timber and Glow into the world, once, and the slot moves on', () => {
  let board = createSupplyRunBoard(1_000);
  assert.ok(board.board.some((cell) => cell.occupant?.kind === 'generator' && cell.occupant.generatorId === 'ritual-bar'), 'the Ritual Bar pours drinks');
  assert.ok(!board.board.some((cell) => cell.occupant?.kind === 'generator' && cell.occupant.generatorId === 'cafe-counter'), 'one chain at the Café: no Counter');
  assert.ok(!board.board.some((cell) => cell.occupant?.kind === 'item' && cell.occupant.definitionId.startsWith('food:')), 'coffee only until Feastle brings food');
  assert.ok(!board.board.some((cell) => cell.occupant?.kind === 'item' && cell.occupant.definitionId.startsWith('nature:')), 'no plants: food and drink only');
  const order = supplyOrder(0, 0);
  assert.deepEqual(order.requirements, [{ definitionId: 'drink:hot:2', quantity: 1 }], 'the first order: a Caramel Latte');
  assert.ok(!board.board.some((cell) => (cell.occupant?.kind === 'item' && cell.occupant.definitionId.startsWith('drink:refresh')) || (cell.mist && 'definitionId' in cell.mist && String(cell.mist.definitionId).startsWith('drink:refresh'))), 'coffee is the one drink chain');
  assert.equal(mergeOrderReady(board, order), false, 'the board starts without one');
  // Two Tiny Espressos make it.
  const cups = board.board.flatMap((cell, index) => cell.occupant?.kind === 'item' && !cell.mist && cell.occupant.definitionId === 'drink:hot:1' ? [index] : []);
  board = reduceMergeWorld(board, { type: 'move', from: cups[0]!, to: cups[1]!, now: 1_100 }).state;
  assert.equal(mergeOrderReady(board, order), true, 'ready');
  const served = reduceMergeWorld(board, { type: 'serveBoardOrder', order, now: 1_200 });
  assert.equal(served.changed, true);
  assert.equal(served.state.coins, board.coins, 'the board itself pays nothing: the world does');

  let world: MergeWorldState = createInitialMergeWorldState(1_000);
  const coins = world.coins;
  assert.deepEqual(supplyRunSlots(world), [0, 0], 'each card shows its friend’s first order');
  assert.equal(order.characterId, 'steppling');
  assert.equal(supplyOrder(1, 0).characterId, 'mossprout');
  assert.ok(order.meals > order.timber, 'Meals are the main payout; Timber a little');
  world = reduceMergeWorld(world, { type: 'completeSupplyOrder', slot: 0, index: 0, timber: order.timber, glow: order.reward.coins, meals: order.meals, now: 1_300 }).state;
  assert.equal(world.materials?.timber, order.timber);
  assert.equal(world.materials?.meals, order.meals);
  assert.equal(world.coins, coins + order.reward.coins);
  assert.deepEqual(supplyRunSlots(world), [1, 0], 'the served card shows its friend’s next order');
  assert.equal(reduceMergeWorld(world, { type: 'completeSupplyOrder', slot: 0, index: 0, timber: 9, glow: 9, meals: 9, now: 1_400 }).changed, false, 'the same order pays once');
  const reloaded = normalizeMergeWorldState(JSON.parse(JSON.stringify(world)), 2_000);
  assert.deepEqual(reloaded.supplyRun, { slots: [1, 0], served: 1, crates: 0, kitchenServed: 0 }, 'the slots and the count survive a reload');
  assert.deepEqual(reloaded.materials, { timber: order.timber, meals: order.meals });
});

test('every Café order can be made from the board’s own generators', () => {
  const board = createSupplyRunBoard(1_000);
  const chains = new Set(board.board.flatMap((cell) => (cell.occupant?.kind === 'generator' ? [cell.occupant.generatorId] : [])).flatMap((id) => {
    const generator = board.generators[id];
    return [...(generator?.tierOneDropDefinitionIds ?? []), ...(generator?.forcedDropDefinitionId ? [generator.forcedDropDefinitionId] : [])].map((drop) => drop.replace(/:\d+$/, ''));
  }));
  for (const slot of [0, 1] as const) for (let index = 0; index < 6; index += 1) {
    for (const requirement of supplyOrder(slot, index).requirements) assert.ok(chains.has(requirement.definitionId.replace(/:\d+$/, '')), `${requirement.definitionId} is poured or baked here`);
  }
});

test('buildings take Timber from level two', () => {
  assert.equal(heartwoodBuildingTimberCost(0), 0, 'building costs only Glow');
  const cost = heartwoodBuildingTimberCost(1);
  assert.ok(cost > 0);
  const base = { ...createInitialMergeWorldState(1_000), coins: 500, heartwoodBuildings: { 'dew-spring': { level: 1 } }, kingdomGoal: { introducedAt: 1, coachmarkSeenAt: 1 } } as MergeWorldState;
  assert.throws(() => upgradeHeartwoodBuilding({ ...base, materials: { timber: cost - 1 } }, 'dew-spring', 1, 2_000), /Timber/);
  const grown = upgradeHeartwoodBuilding({ ...base, materials: { timber: cost + 1 } }, 'dew-spring', 1, 2_000);
  assert.equal(grown.heartwoodBuildings?.['dew-spring']?.level, 2);
  assert.equal(grown.materials?.timber, 1, 'the Timber is spent');
});

test('the Café is one continuous board: no crates, and the Kitchen counts its feasts', () => {
  let world: MergeWorldState = createInitialMergeWorldState(1_000);
  let timber = 0;
  let meals = 0;
  for (let served = 0; served < 6; served += 1) {
    const slot = (served % 2) as 0 | 1;
    const index = world.supplyRun?.slots[slot] ?? 0;
    const order = supplyOrder(slot, index);
    world = reduceMergeWorld(world, { type: 'completeSupplyOrder', slot, index, timber: order.timber, glow: order.reward.coins, meals: order.meals, kitchen: served >= 4, now: 2_000 + served }).state;
    timber += order.timber;
    meals += order.meals;
  }
  assert.equal(world.supplyRun?.crates ?? 0, 0, 'no crates');
  assert.equal(world.materials?.timber, timber, 'each order pays its own');
  assert.equal(world.materials?.meals, meals);
  assert.equal(world.supplyRun?.kitchenServed, 2, 'orders served in the Kitchen are its feasts');
});
test('a Café order is served off the board and pays Meals, Timber and Glow into the world, once, and the slot moves on', () => {
  let board = createSupplyRunBoard(1_000);
  assert.ok(board.board.some((cell) => cell.occupant?.kind === 'generator' && cell.occupant.generatorId === 'ritual-bar'), 'the Ritual Bar pours drinks');
  assert.ok(!board.board.some((cell) => cell.occupant?.kind === 'generator' && cell.occupant.generatorId === 'cafe-counter'), 'one chain at the Café: no Counter');
  assert.ok(!board.board.some((cell) => cell.occupant?.kind === 'item' && cell.occupant.definitionId.startsWith('food:')), 'coffee only until Feastle brings food');
  assert.ok(!board.board.some((cell) => cell.occupant?.kind === 'item' && cell.occupant.definitionId.startsWith('nature:')), 'no plants: food and drink only');
  const order = supplyOrder(0, 0);
  assert.deepEqual(order.requirements, [{ definitionId: 'drink:hot:2', quantity: 1 }], 'the first order: a Caramel Latte');
  assert.ok(!board.board.some((cell) => (cell.occupant?.kind === 'item' && cell.occupant.definitionId.startsWith('drink:refresh')) || (cell.mist && 'definitionId' in cell.mist && String(cell.mist.definitionId).startsWith('drink:refresh'))), 'coffee is the one drink chain');
  assert.equal(mergeOrderReady(board, order), false, 'the board starts without one');
  // Two Tiny Espressos make it.
  const cups = board.board.flatMap((cell, index) => cell.occupant?.kind === 'item' && !cell.mist && cell.occupant.definitionId === 'drink:hot:1' ? [index] : []);
  board = reduceMergeWorld(board, { type: 'move', from: cups[0]!, to: cups[1]!, now: 1_100 }).state;
  assert.equal(mergeOrderReady(board, order), true, 'ready');
  const served = reduceMergeWorld(board, { type: 'serveBoardOrder', order, now: 1_200 });
  assert.equal(served.changed, true);
  assert.equal(served.state.coins, board.coins, 'the board itself pays nothing: the world does');

  let world: MergeWorldState = createInitialMergeWorldState(1_000);
  const coins = world.coins;
  assert.deepEqual(supplyRunSlots(world), [0, 0], 'each card shows its friend’s first order');
  assert.equal(order.characterId, 'steppling');
  assert.equal(supplyOrder(1, 0).characterId, 'mossprout');
  assert.ok(order.meals > order.timber, 'Meals are the main payout; Timber a little');
  world = reduceMergeWorld(world, { type: 'completeSupplyOrder', slot: 0, index: 0, timber: order.timber, glow: order.reward.coins, meals: order.meals, now: 1_300 }).state;
  assert.equal(world.materials?.timber, order.timber);
  assert.equal(world.materials?.meals, order.meals);
  assert.equal(world.coins, coins + order.reward.coins);
  assert.deepEqual(supplyRunSlots(world), [1, 0], 'the served card shows its friend’s next order');
  assert.equal(reduceMergeWorld(world, { type: 'completeSupplyOrder', slot: 0, index: 0, timber: 9, glow: 9, meals: 9, now: 1_400 }).changed, false, 'the same order pays once');
  const reloaded = normalizeMergeWorldState(JSON.parse(JSON.stringify(world)), 2_000);
  assert.deepEqual(reloaded.supplyRun, { slots: [1, 0], served: 1, crates: 0, kitchenServed: 0 }, 'the slots and the count survive a reload');
  assert.deepEqual(reloaded.materials, { timber: order.timber, meals: order.meals });
});

test('every Café order can be made from the board’s own generators', () => {
  const board = createSupplyRunBoard(1_000);
  const chains = new Set(board.board.flatMap((cell) => (cell.occupant?.kind === 'generator' ? [cell.occupant.generatorId] : [])).flatMap((id) => {
    const generator = board.generators[id];
    return [...(generator?.tierOneDropDefinitionIds ?? []), ...(generator?.forcedDropDefinitionId ? [generator.forcedDropDefinitionId] : [])].map((drop) => drop.replace(/:\d+$/, ''));
  }));
  for (const slot of [0, 1] as const) for (let index = 0; index < 6; index += 1) {
    for (const requirement of supplyOrder(slot, index).requirements) assert.ok(chains.has(requirement.definitionId.replace(/:\d+$/, '')), `${requirement.definitionId} is poured or baked here`);
  }
});

test('buildings take Timber from level two', () => {
  assert.equal(heartwoodBuildingTimberCost(0), 0, 'building costs only Glow');
  const cost = heartwoodBuildingTimberCost(1);
  assert.ok(cost > 0);
  const base = { ...createInitialMergeWorldState(1_000), coins: 500, heartwoodBuildings: { 'dew-spring': { level: 1 } }, kingdomGoal: { introducedAt: 1, coachmarkSeenAt: 1 } } as MergeWorldState;
  assert.throws(() => upgradeHeartwoodBuilding({ ...base, materials: { timber: cost - 1 } }, 'dew-spring', 1, 2_000), /Timber/);
  const grown = upgradeHeartwoodBuilding({ ...base, materials: { timber: cost + 1 } }, 'dew-spring', 1, 2_000);
  assert.equal(grown.heartwoodBuildings?.['dew-spring']?.level, 2);
  assert.equal(grown.materials?.timber, 1, 'the Timber is spent');
});

