import assert from 'node:assert/strict';
import test from 'node:test';

import { heartwoodBuildingTimberCost } from '@/constants/heartwood-buildings';
import { upgradeHeartwoodBuilding } from '@/features/heartwood-buildings/buildings-world';
import { createSupplyRunBoard, SUPPLY_CRATE, supplyOrder, supplyRunSlots } from '@/features/supply-run/supply-run';
import { createInitialMergeWorldState, mergeOrderReady, normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import type { MergeWorldState } from '@/types/merge-world';

test('a Supply Run order is served off the board and pays Timber and Glow into the world, once, and the slot moves on', () => {
  let board = createSupplyRunBoard(1_000);
  const order = supplyOrder(0, 0);
  assert.deepEqual(order.requirements, [{ definitionId: 'nature:garden:2', quantity: 2 }], 'the first order: two Sprouts');
  assert.equal(mergeOrderReady(board, order), false, 'the board starts one Sprout short');
  // Make the second Sprout: two Seeds merged.
  const seeds = board.board.flatMap((cell, index) => cell.occupant?.kind === 'item' && !cell.mist && cell.occupant.definitionId === 'nature:garden:1' ? [index] : []);
  board = reduceMergeWorld(board, { type: 'move', from: seeds[0]!, to: seeds[1]!, now: 1_100 }).state;
  assert.equal(mergeOrderReady(board, order), true, 'two Sprouts: ready');
  const served = reduceMergeWorld(board, { type: 'serveBoardOrder', order, now: 1_200 });
  assert.equal(served.changed, true);
  assert.equal(served.state.board.filter((cell) => cell.occupant?.kind === 'item' && cell.occupant.definitionId === 'nature:garden:2').length, 0, 'the Sprouts leave the board');
  assert.equal(served.state.coins, board.coins, 'the board itself pays nothing: the world does');

  let world: MergeWorldState = createInitialMergeWorldState(1_000);
  const coins = world.coins;
  assert.deepEqual(supplyRunSlots(world), [0, 0], 'each card shows its friend’s first order');
  assert.equal(order.characterId, 'steppling');
  assert.equal(supplyOrder(1, 0).characterId, 'mossprout');
  world = reduceMergeWorld(world, { type: 'completeSupplyOrder', slot: 0, index: 0, timber: order.timber, glow: order.reward.coins, now: 1_300 }).state;
  assert.equal(world.materials?.timber, order.timber);
  assert.equal(world.coins, coins + order.reward.coins);
  assert.deepEqual(supplyRunSlots(world), [1, 0], 'the served card shows its friend’s next order');
  assert.equal(supplyOrder(0, 1).characterId, 'steppling', 'and the same friend stays at the card');
  assert.equal(reduceMergeWorld(world, { type: 'completeSupplyOrder', slot: 0, index: 0, timber: 9, glow: 9, now: 1_400 }).changed, false, 'the same order pays once');
  const reloaded = normalizeMergeWorldState(JSON.parse(JSON.stringify(world)), 2_000);
  assert.deepEqual(reloaded.supplyRun, { slots: [1, 0], served: 1, crates: 0 }, 'the slots and the count survive a reload');
  assert.equal(reloaded.materials?.timber, order.timber);
});

test('buildings take Timber from level two: Supply Runs are what grows the Sanctuary', () => {
  assert.equal(heartwoodBuildingTimberCost(0), 0, 'building costs only Glow');
  const cost = heartwoodBuildingTimberCost(1);
  assert.ok(cost > 0);
  const base = { ...createInitialMergeWorldState(1_000), coins: 500, heartwoodBuildings: { 'dew-spring': { level: 1 } }, kingdomGoal: { introducedAt: 1, coachmarkSeenAt: 1 } } as MergeWorldState;
  assert.throws(() => upgradeHeartwoodBuilding({ ...base, materials: { timber: cost - 1 } }, 'dew-spring', 1, 2_000), /Timber/);
  const grown = upgradeHeartwoodBuilding({ ...base, materials: { timber: cost + 1 } }, 'dew-spring', 1, 2_000);
  assert.equal(grown.heartwoodBuildings?.['dew-spring']?.level, 2);
  assert.equal(grown.materials?.timber, 1, 'the Timber is spent');
});

test('every fifth order fills a crate: its bonus comes with that order, once', () => {
  let world: MergeWorldState = createInitialMergeWorldState(1_000);
  let timber = 0;
  for (let served = 0; served < SUPPLY_CRATE.every; served += 1) {
    const slot = (served % 2) as 0 | 1;
    const index = world.supplyRun?.slots[slot] ?? 0;
    const order = supplyOrder(slot, index);
    world = reduceMergeWorld(world, { type: 'completeSupplyOrder', slot, index, timber: order.timber, glow: order.reward.coins, crate: SUPPLY_CRATE, now: 2_000 + served }).state;
    timber += order.timber;
  }
  assert.equal(world.supplyRun?.served, SUPPLY_CRATE.every);
  assert.equal(world.supplyRun?.crates, 1, 'one crate filled');
  assert.equal(world.materials?.timber, timber + SUPPLY_CRATE.timber, 'with its bonus Timber');
});
