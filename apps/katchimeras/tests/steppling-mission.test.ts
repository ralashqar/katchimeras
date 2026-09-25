import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from './helpers/content-fs';
import { mergeFtueAllowsCommand } from '@/features/onboarding/merge-ftue';
import { MISSION_CAMERA_ANCHOR_Y, MISSION_CAMERA_ZOOM, OPENING_CAMERA_ZOOM, OPENING_MERGE_WINDOW_CELLS } from '@/features/onboarding/opening-mist';
import {
  createStepplingMissionState, STEPPLING_MISSION_CAMERA, STEPPLING_MISSION_ECHOES, STEPPLING_MISSION_HINT_DELAY_MS, STEPPLING_MISSION_HINT_THEME, STEPPLING_MISSION_ITEMS,
  STEPPLING_MISSION_MERGE_REQUIRED, STEPPLING_MISSION_SOCK_ID, STEPPLING_MISSION_STORAGE_KEY, STEPPLING_MISSION_VEILED, stepplingMissionBoardStep, stepplingMissionItemsOnBoard, stepplingMissionProgress, stepplingMissionWake,
} from '@/features/onboarding/steppling-mission';
import { GLOW_DISCOVERY_FLOW, GLOW_GATEWAY_NODE_IDS, GLOW_MISSION_CLEAR_NODE_ID, GLOW_MISSION_CLEARED_EVENT, GLOW_MISSION_FOCUS_NODE_ID, glowDiscoveryLocksCamera, glowDiscoveryMissionNode, glowDiscoveryResumeCamera, glowDiscoveryRevealLocked } from '@/features/onboarding/glow-discovery-flow';
import { STEPPLING_STORY_TARGET } from '@/constants/shared-world';
import type { MergeWorldState } from '@/types/merge-world';
import { reduceMergeWorld } from '@/utils/merge-world/engine';

const NOW = Date.UTC(2026, 8, 10, 9);
const WINDOW = new Set(OPENING_MERGE_WINDOW_CELLS);

test('the Steppling mission board is gear left on the trail, one sleeper, and full mist hiding the next ones', () => {
  const state = createStepplingMissionState(NOW);
  state.board.forEach((cell, index) => {
    if (!WINDOW.has(index)) assert.equal(cell.occupant, null, `cell ${index} outside the window is empty`);
  });
  assert.deepEqual(state.generators, {}, 'no spawner: spawning is taught on the Garden board, by parcel');
  assert.equal(state.board.some((cell) => cell.occupant?.kind === 'generator'), false);
  assert.equal(stepplingMissionItemsOnBoard(state), STEPPLING_MISSION_ITEMS.length);
  for (const { cell, definitionId } of STEPPLING_MISSION_ITEMS) {
    assert.ok(WINDOW.has(cell), `item cell ${cell} is in the window`);
    assert.equal((state.board[cell].occupant as { definitionId: string }).definitionId, definitionId);
  }
  assert.deepEqual(STEPPLING_MISSION_ITEMS.map((item) => [item.cell, item.definitionId]), [[36, STEPPLING_MISSION_SOCK_ID], [37, STEPPLING_MISSION_SOCK_ID], [40, STEPPLING_MISSION_SOCK_ID]], 'three Socks: a pair to merge and one for the sleeper that wants it later');
  assert.deepEqual(STEPPLING_MISSION_ECHOES, [{ cell: 38, id: 'steppling-trail-1', definitionId: 'adventure:trail:2' }], 'one sleeper the player can see, wanting the merge’s result');
  assert.deepEqual(state.board[38].mist, { kind: 'echo', id: 'steppling-trail-1', definitionId: 'adventure:trail:2', ownerCharacterId: 'steppling' });
  assert.deepEqual(STEPPLING_MISSION_VEILED.map((veiled) => [veiled.cell, veiled.definitionId]), [[31, 'adventure:trail:3'], [24, 'adventure:trail:5'], [30, 'adventure:trail:1'], [23, 'adventure:trail:2'], [22, 'adventure:trail:3']], 'the chain snakes up, across and up again; the top wants the Pack two Hiking Gears make');
  for (const veiled of STEPPLING_MISSION_VEILED) assert.ok(WINDOW.has(veiled.cell), `veiled cell ${veiled.cell} is in the window`);
  for (const veiled of STEPPLING_MISSION_VEILED) {
    const cell = state.board[veiled.cell];
    assert.equal(cell.locked, true);
    assert.equal(cell.occupant, null);
    assert.deepEqual(cell.mist, { kind: 'veiled', echo: { id: veiled.id, definitionId: veiled.definitionId, ownerCharacterId: 'steppling' } });
  }
  assert.equal(state.activeOrders.length, 0);
  assert.equal(state.arrivals.length, 0);
  assert.equal(state.rewardInbox.length, 0);
  assert.equal(STEPPLING_MISSION_STORAGE_KEY, 'katchimeras.mist-mission.steppling.v3', 'a new key: the Locker board is never resumed onto this one');
});

function stepOf(state: MergeWorldState, merges: number) {
  return stepplingMissionBoardStep(state, merges)!;
}

test('the only path: a merge, six wakings as the mist bursts open cell by cell, and a merge of the two Hiking Gears for the top; eight strikes, each guided in turn', () => {
  let state = createStepplingMissionState(NOW);
  let merges = 0;
  const itemAt = (cell: number) => (state.board[cell].occupant as { definitionId: string } | null)?.definitionId;
  // 1. The first merge is spotlit and exclusive: the one thing the opening taught. Nothing can wake yet.
  const first = stepOf(state, merges);
  assert.equal(first.id, 'mission.steppling.first_merge');
  assert.ok(first.spotlight && first.cue?.kind === 'drag');
  assert.deepEqual([first.cue.from, first.cue.to], [{ kind: 'board_cell', cell: 36 }, { kind: 'board_cell', cell: 37 }], 'the pair side by side, not the Sock across the row');
  assert.equal(stepplingMissionWake(state), null, 'the sleeper wants a Shoe, and there is none yet');
  assert.equal(reduceMergeWorld(state, { type: 'move', from: 36, to: 38, now: NOW }).changed, false, 'a Sock does not wake a sleeping Shoe');
  assert.equal(mergeFtueAllowsCommand(first, state, { type: 'move', from: 36, to: 37, now: NOW }), true);
  assert.equal(mergeFtueAllowsCommand(first, state, { type: 'move', from: 40, to: 37, now: NOW }), false, 'nothing but the spotlit merge');
  let result = reduceMergeWorld(state, { type: 'move', from: 36, to: 37, now: NOW + 1 });
  assert.equal(result.changed, true, result.message);
  assert.equal(result.mergedCell, 37);
  state = result.state; merges += 1;
  // 2–7. Each waking makes what the next sleeper wants and bursts the mist that was hiding it; the top cell waits for a Pack.
  const wakings: [number, string, number[] | undefined][] = [
    [38, 'adventure:trail:3', [31]],
    [31, 'adventure:trail:4', [24, 30]],
    [30, 'adventure:trail:2', [23]],
    [23, 'adventure:trail:3', [22]],
    [22, 'adventure:trail:4', undefined],
  ];
  for (const [cell, wakesAs, reveals] of wakings) {
    const step = stepOf(state, merges);
    assert.equal(step.id, 'mission.steppling.wake', `strike ${merges + 1} is a waking`);
    assert.match(step.guide.title ?? '', /^Something under there wants an? [A-Z]/, 'the article follows the name');
    assert.equal(step.spotlight, undefined, 'nothing spotlit once the board is free');
    assert.deepEqual(step.interaction, { mode: 'none' });
    const wake = stepplingMissionWake(state)!;
    assert.equal(wake.to, cell);
    assert.deepEqual(step.cue, { kind: 'drag', from: { kind: 'board_cell', cell: wake.from }, to: { kind: 'board_cell', cell } });
    result = reduceMergeWorld(state, { type: 'move', from: wake.from, to: cell, now: NOW + 2 + merges });
    assert.equal(result.changed, true, result.message);
    assert.equal(result.mergedCell, cell, 'the waking is a strike');
    assert.deepEqual(result.revealedMistCells, reveals, reveals ? `and the mist beside ${cell} lets go` : 'nothing veiled beside the last one');
    for (const revealed of reveals ?? []) assert.equal(result.state.board[revealed].mist?.kind, 'echo');
    assert.equal((result.state.board[cell].occupant as { definitionId: string }).definitionId, wakesAs);
    state = result.state; merges += 1;
    assert.equal(state.board[24].mist?.kind, merges >= 3 ? 'echo' : 'veiled', 'the top cell is a sleeper from the second waking on');
  }
  // 8. Two Hiking Gears and a sleeper that wants a Pack: the finger points at the pair.
  const merge = stepOf(state, merges);
  assert.equal(merge.id, 'mission.steppling.merge');
  assert.equal(merge.spotlight, undefined);
  assert.equal(merge.guide.title, 'Two of the same make an Adventure Pack.');
  assert.equal(itemAt(31), 'adventure:trail:4');
  assert.equal(itemAt(22), 'adventure:trail:4');
  assert.equal(stepplingMissionWake(state), null, 'the top sleeper wants what no loose piece is yet');
  result = reduceMergeWorld(state, { type: 'move', from: 22, to: 31, now: NOW + 20 });
  assert.equal(result.changed, true, result.message);
  assert.equal(result.mergedCell, 31);
  assert.equal(result.revealedMistCells, undefined, 'a merge beside veiled mist reveals nothing; only a waking does');
  state = result.state; merges += 1;
  // 9. The Pack wakes the top cell into an Expedition Kit: the finale.
  const last = stepOf(state, merges);
  assert.equal(last.id, 'mission.steppling.wake');
  const finale = stepplingMissionWake(state)!;
  assert.deepEqual([finale.from, finale.to], [31, 24]);
  result = reduceMergeWorld(state, { type: 'move', from: 31, to: 24, now: NOW + 21 });
  assert.equal(result.changed, true, result.message);
  assert.equal(result.mergedCell, 24);
  assert.equal((result.state.board[24].occupant as { definitionId: string }).definitionId, 'adventure:trail:6');
  state = result.state; merges += 1;
  assert.equal(merges, STEPPLING_MISSION_MERGE_REQUIRED, 'eight strikes: two per wisp');
  assert.equal(stepplingMissionWake(state), null);
  assert.equal(OPENING_MERGE_WINDOW_CELLS.some((index) => state.board[index].mist?.kind === 'veiled' || state.board[index].mist?.kind === 'echo'), false, 'every full-mist cell in the window bursts into something, and everything wakes');
  assert.equal(stepplingMissionItemsOnBoard(state), 1, 'one piece left: the Kit that flies into the mist');
  // A free board with a pair and nothing to wake points at the pair; with nothing at all, at nothing.
  const pairOnly = createStepplingMissionState(NOW);
  pairOnly.board[38] = { ...pairOnly.board[38], locked: false, mist: null };
  assert.equal(stepOf(pairOnly, 1).id, 'mission.steppling.merge');
  assert.equal(stepOf(pairOnly, 1).spotlight, undefined);
  const empty = { ...pairOnly, board: pairOnly.board.map((cell) => ({ ...cell, occupant: null })) };
  assert.equal(stepOf(empty, 1).id, 'mission.steppling.free');
  assert.equal(stepOf(empty, 1).cue, undefined);
  assert.equal(stepplingMissionProgress(STEPPLING_MISSION_MERGE_REQUIRED + 3), STEPPLING_MISSION_MERGE_REQUIRED);
  assert.equal(stepplingMissionProgress(-1), 0);
  assert.equal(STEPPLING_MISSION_HINT_DELAY_MS, 2_000);
  assert.deepEqual(STEPPLING_MISSION_HINT_THEME, { fingerDelayMs: 2_000 });
  assert.equal(stepplingMissionBoardStep(null, 0), null);
});

test('every way of playing the board reaches the bar: no move leaves the mission short of its strikes', () => {
  // Exhaustive over merges and wakings from the seed (moves onto empty cells change nothing that matters).
  const seen = new Set<string>();
  let leaves = 0;
  const key = (state: MergeWorldState) => JSON.stringify(state.board.map((cell) => [cell.occupant?.kind === 'item' ? cell.occupant.definitionId : null, cell.mist?.kind ?? null, cell.mist?.kind === 'echo' ? cell.mist.definitionId : null]));
  const walk = (state: MergeWorldState, strikes: number) => {
    const signature = `${key(state)}:${strikes}`;
    if (seen.has(signature)) return;
    seen.add(signature);
    if (strikes >= STEPPLING_MISSION_MERGE_REQUIRED) return;
    const items = OPENING_MERGE_WINDOW_CELLS.filter((index) => state.board[index]?.occupant?.kind === 'item');
    const targets = OPENING_MERGE_WINDOW_CELLS.filter((index) => state.board[index]?.occupant?.kind === 'item' || state.board[index]?.mist?.kind === 'echo');
    let moved = false;
    for (const from of items) for (const to of targets) {
      if (from === to) continue;
      const result = reduceMergeWorld(state, { type: 'move', from, to, now: NOW });
      if (!result.changed || result.mergedCell == null) continue;
      moved = true;
      walk(result.state, strikes + 1);
    }
    if (!moved) { leaves += 1; assert.fail(`a dead end after ${strikes} strikes`); }
  };
  walk(createStepplingMissionState(NOW), 0);
  assert.equal(leaves, 0);
  assert.ok(seen.size >= STEPPLING_MISSION_MERGE_REQUIRED, 'every strike along the way is a state of its own');
  // And every path is the same path: the only freedom is which two of the three Socks meet first.
  let forcedStates = 0;
  const walkChoices = (state: MergeWorldState, strikes: number) => {
    if (strikes >= STEPPLING_MISSION_MERGE_REQUIRED) return;
    const items = OPENING_MERGE_WINDOW_CELLS.filter((index) => state.board[index]?.occupant?.kind === 'item');
    const targets = OPENING_MERGE_WINDOW_CELLS.filter((index) => state.board[index]?.occupant?.kind === 'item' || state.board[index]?.mist?.kind === 'echo');
    const outcomes = new Set<string>();
    let next: MergeWorldState | null = null;
    for (const from of items) for (const to of targets) {
      if (from === to) continue;
      const result = reduceMergeWorld(state, { type: 'move', from, to, now: NOW });
      if (!result.changed || result.mergedCell == null) continue;
      outcomes.add(JSON.stringify(result.state.board.map((cell) => [cell.occupant?.kind === 'item' ? cell.occupant.definitionId : null, cell.mist?.kind ?? null]).filter((entry) => entry[0] != null || entry[1] === 'echo' || entry[1] === 'veiled').sort()));
      next = result.state;
    }
    assert.ok(outcomes.size <= (strikes === 0 ? 3 : 1), `strike ${strikes + 1}: one thing to do, not ${outcomes.size}`);
    forcedStates += 1;
    if (next) walkChoices(next, strikes + 1);
  };
  walkChoices(createStepplingMissionState(NOW), 0);
  assert.equal(forcedStates, STEPPLING_MISSION_MERGE_REQUIRED);
});
