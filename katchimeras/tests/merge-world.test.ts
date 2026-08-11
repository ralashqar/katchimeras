import assert from 'node:assert/strict';
import test from 'node:test';

import { MERGE_GENERATOR_COOLDOWN_MS, MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import type { MergeBoardItem, MergeWorldState } from '@/types/merge-world';
import { companionFriendshipProgress, emptyCompanionBondState } from '@/utils/companion-bond';
import { mergeCellCenter, mergeCellFromPoint, mergeCellOrigin } from '@/utils/merge-world/board-geometry';
import {
  createInitialMergeWorldState,
  mergeOrderReady,
  mergeWorldCatalogIssues,
  normalizeMergeWorldState,
  reduceMergeWorld,
} from '@/utils/merge-world/engine';

const NOW = 1_800_000_000_000;

test('board geometry uses one exact coordinate system for rendering and hit testing', () => {
  const geometry = { columns: 7, rows: 9, cellSize: 43, gap: 4, inset: 9 };
  for (let index = 0; index < 63; index += 1) {
    const origin = mergeCellOrigin(geometry, index);
    const center = mergeCellCenter(geometry, index);
    assert.equal(center.x, origin.x + geometry.cellSize / 2);
    assert.equal(center.y, origin.y + geometry.cellSize / 2);
    assert.equal(mergeCellFromPoint(geometry, center.x, center.y), index);
  }
  assert.equal(mergeCellFromPoint(geometry, -100, -100), null);
  assert.equal(mergeCellFromPoint(geometry, 10_000, 10_000), null);
});

test('catalog is internally valid and starter world has 33 open cells', () => {
  assert.deepEqual(mergeWorldCatalogIssues(), []);
  const state = createInitialMergeWorldState(NOW);
  assert.equal(state.board.length, 63);
  assert.equal(state.board.filter((cell) => !cell.locked).length, 33);
  assert.equal(state.activeOrders.length, 3);
  assert.equal(state.board[31].occupant?.kind, 'generator');
  assert.deepEqual(state.unlockedFamilies, ['food']);
});

test('generator taps consume one Energy and charge and create a discoverable item', () => {
  const state = createInitialMergeWorldState(NOW);
  const result = reduceMergeWorld(state, { type: 'tapGenerator', generatorId: 'starter-pantry', now: NOW + 1, seed: 'first-drop' });
  assert.equal(result.changed, true);
  // Tap costs one; the first-discovery reward immediately returns one.
  assert.equal(result.state.energy.value, 100);
  assert.equal(result.state.generators['starter-pantry'].charges, 11);
  assert.ok(result.spawnedCell != null);
  assert.equal(result.state.board[result.spawnedCell!].occupant?.kind, 'item');
  assert.equal(result.state.discoveries.length, 1);
});

test('a full board rejects generation without spending Energy or charges', () => {
  const state = createInitialMergeWorldState(NOW);
  const board = state.board.map((cell, index) => cell.locked || cell.occupant ? cell : {
    ...cell,
    occupant: item(`fill:${index}`, 'food:table:1'),
  });
  const full = { ...state, board };
  const result = reduceMergeWorld(full, { type: 'tapGenerator', generatorId: 'starter-pantry', now: NOW + 1, seed: 'full' });
  assert.equal(result.changed, false);
  assert.equal(result.state.energy.value, 100);
  assert.equal(result.state.generators['starter-pantry'].charges, 12);
});

test('identical items merge deterministically and hybrid recipe combines different families', () => {
  let state = createInitialMergeWorldState(NOW, ['voyagle']);
  state = withItems(state, [
    [29, item('a', 'food:table:1')],
    [30, item('b', 'food:table:1')],
  ]);
  let result = reduceMergeWorld(state, { type: 'move', from: 29, to: 30, now: NOW + 1 });
  assert.equal(result.state.board[30].occupant?.kind, 'item');
  assert.equal((result.state.board[30].occupant as MergeBoardItem).definitionId, 'food:table:2');
  assert.equal(result.discoveryId, 'food:table:2');

  state = withItems(result.state, [
    [29, item('meal', 'food:table:4')],
    [30, item('pack', 'adventure:trail:5')],
  ]);
  result = reduceMergeWorld(state, { type: 'move', from: 29, to: 30, now: NOW + 2 });
  assert.equal((result.state.board[30].occupant as MergeBoardItem).definitionId, 'hybrid:picnic-pack');
});

test('dropping onto a non-matching item swaps both board positions', () => {
  let state = createInitialMergeWorldState(NOW);
  state = withItems(state, [
    [29, item('ingredient', 'food:table:1')],
    [30, item('dish', 'food:table:3')],
  ]);
  const result = reduceMergeWorld(state, { type: 'move', from: 29, to: 30, now: NOW + 1 });
  assert.equal(result.changed, true);
  assert.equal(result.message, undefined);
  assert.equal((result.state.board[29].occupant as MergeBoardItem).instanceId, 'dish');
  assert.equal((result.state.board[30].occupant as MergeBoardItem).instanceId, 'ingredient');
});

test('generators can move to empty cells and swap with other occupants', () => {
  let state = createInitialMergeWorldState(NOW);
  let result = reduceMergeWorld(state, { type: 'move', from: 31, to: 29, now: NOW + 1 });
  assert.equal(result.changed, true);
  assert.equal(result.state.board[29].occupant?.kind, 'generator');
  assert.equal(result.state.board[31].occupant, null);

  state = withItems(result.state, [[30, item('ingredient', 'food:table:1')]]);
  result = reduceMergeWorld(state, { type: 'move', from: 29, to: 30, now: NOW + 2 });
  assert.equal(result.state.board[30].occupant?.kind, 'generator');
  assert.equal((result.state.board[29].occupant as MergeBoardItem).instanceId, 'ingredient');
});

test('activity receipts are idempotent and Energy remains capped', () => {
  const state = { ...createInitialMergeWorldState(NOW), energy: { value: 80, cap: 100, lastRegenAt: NOW } };
  const first = reduceMergeWorld(state, { type: 'grantActivityEnergy', receiptId: 'journal:1', amount: 10, now: NOW + 1 });
  const duplicate = reduceMergeWorld(first.state, { type: 'grantActivityEnergy', receiptId: 'journal:1', amount: 10, now: NOW + 2 });
  const capped = reduceMergeWorld(duplicate.state, { type: 'grantActivityEnergy', receiptId: 'journal:2', amount: 99, now: NOW + 3 });
  assert.equal(first.state.energy.value, 90);
  assert.equal(duplicate.changed, false);
  assert.equal(capped.state.energy.value, 100);
});

test('depleted generators recover from timestamps without background timers', () => {
  const state = createInitialMergeWorldState(NOW);
  const resting = {
    ...state,
    energy: { ...state.energy, value: 50 },
    generators: {
      ...state.generators,
      'starter-pantry': { ...state.generators['starter-pantry'], charges: 0, readyAt: NOW + MERGE_GENERATOR_COOLDOWN_MS },
    },
  };
  const early = reduceMergeWorld(resting, { type: 'refreshTime', now: NOW + MERGE_GENERATOR_COOLDOWN_MS - 1 });
  const ready = reduceMergeWorld(early.state, { type: 'refreshTime', now: NOW + MERGE_GENERATOR_COOLDOWN_MS });
  assert.equal(early.state.generators['starter-pantry'].charges, 0);
  assert.equal(ready.state.generators['starter-pantry'].charges, 12);
  assert.equal(ready.state.generators['starter-pantry'].readyAt, null);
});

test('Shellio and Voyagle unlock canonical branches and generators', () => {
  const state = createInitialMergeWorldState(NOW, ['shellio', 'voyagle']);
  assert.ok(state.generators['nature-pot']);
  assert.ok(state.generators['adventure-pack']);
  assert.ok(state.generators['nature-pot'].enabledBranches.includes('waterside'));
  assert.ok(state.generators['adventure-pack'].enabledBranches.includes('travel'));
  assert.ok(state.unlockedCharacters.includes('shellio'));
  assert.ok(state.unlockedCharacters.includes('voyagle'));
});

test('serving consumes requirements and emits replay-safe Friendship receipt', () => {
  let state = createInitialMergeWorldState(NOW, ['feastle']);
  const order = state.activeOrders[0];
  const placements: Array<[number, MergeBoardItem]> = [];
  let cell = 29;
  for (const requirement of order.requirements) {
    for (let count = 0; count < requirement.quantity; count += 1) placements.push([cell++, item(`serve:${cell}`, requirement.definitionId)]);
  }
  state = withItems(state, placements);
  assert.equal(mergeOrderReady(state, order), true);
  const result = reduceMergeWorld(state, { type: 'serveOrder', orderId: order.id, now: NOW + 1 });
  assert.equal(result.servedOrderId, order.id);
  assert.equal(result.state.completedOrderCount, 1);
  assert.ok(result.state.externalRewardReceipts.some((receipt) => receipt.id === `merge-friendship:${order.id}`));
  assert.equal(result.state.activeOrders.length, 3);
});

test('normalization recovers invalid snapshots and Friendship preserves legacy floors', () => {
  assert.equal(normalizeMergeWorldState({ version: 1, board: [] }, NOW).board.length, 63);
  const points = [0, 50, 150, 400];
  const expectedLevels = [1, 3, 6, 10];
  points.forEach((value, index) => {
    const bond = emptyCompanionBondState();
    bond.events.push({ id: `legacy:${value}`, creatureId: 'companion:feastle', kind: 'hatch', points: value, occurredAt: NOW });
    assert.equal(companionFriendshipProgress(bond, 'companion:feastle').level, expectedLevels[index]);
  });
});

function item(instanceId: string, definitionId: string): MergeBoardItem {
  assert.ok(MERGE_ITEMS_BY_ID.has(definitionId));
  return { kind: 'item', instanceId, definitionId };
}

function withItems(state: MergeWorldState, placements: Array<[number, MergeBoardItem]>): MergeWorldState {
  const board = [...state.board];
  for (const [cell, boardItem] of placements) board[cell] = { ...board[cell], locked: false, occupant: boardItem };
  return { ...state, board };
}
