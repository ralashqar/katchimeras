import assert from 'node:assert/strict';
import test from 'node:test';

import { FIRST_BATTLE, firstBattleGuide, LOST_TRAIL_BATTLES, LOST_TRAIL_RESCUE_CELL, scriptedBattleGuide } from '@/constants/last-clearing-battle';
import { encounterMechanicHost } from '@/features/encounter/adapt';
import { createEncounterRun, encounterStatus } from '@/features/encounter/encounter-run';
import { lanesFairness } from '@/features/encounter/lanes-playtest';
import { createEncounterState, encounterWindow } from '@/features/encounter/create-state';
import { createLanesState, laneCell, laneOf, lanesTick, type LanesMechanic, type LanesState } from '@/features/mission-mechanics/lanes';
import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { reduceMissionMove } from '@/utils/merge-world/engine';
import { mossproutFtueStep } from '@/features/onboarding/mossprout-ftue-script';
import type { MergeWorldState } from '@/types/merge-world';

const mechanic = FIRST_BATTLE.mechanic as LanesMechanic;
const window = encounterWindow(FIRST_BATTLE);

/** The first battle's board with only the pieces given, by column and row. */
function boardWith(pieces: readonly [column: number, row: number, definitionId: string][]): MergeWorldState {
  const board = createEncounterState(FIRST_BATTLE, 'mossprout', 1);
  const cells = [...board.board];
  for (const cell of window.cellIndices) cells[cell] = { ...cells[cell]!, occupant: null, mist: null, locked: false };
  pieces.forEach(([column, row, definitionId], index) => {
    const cell = laneCell(window, column, row)!;
    cells[cell] = { ...cells[cell]!, occupant: { kind: 'item', instanceId: `test:${index}`, definitionId } };
  });
  return { ...board, board: cells };
}

/** The first wisp here (column 3, high over the board), nothing else yet. */
const firstWispHere = () => ({ ...createLanesState(mechanic), clock: 4_000 });

test('the first battle points a piece shooting an empty lane to the lane a wisp is coming down', () => {
  const column = mechanic.wisps[0]!.column;
  const guide = firstBattleGuide(boardWith([[0, 3, 'nature:garden:2']]), firstWispHere());
  assert.equal(guide?.kind, 'move');
  assert.equal(guide?.from, laneCell(window, 0, 3));
  assert.equal(guide?.to, laneCell(window, column, window.rows - 1), 'to the lowest free cell under the wisp');
});

test('a piece already under the wisp is left alone; the finger shows the next merge instead', () => {
  const column = mechanic.wisps[0]!.column;
  const guide = firstBattleGuide(boardWith([[column, 3, 'nature:garden:2'], [0, 0, 'nature:garden:1'], [1, 0, 'nature:garden:1']]), firstWispHere());
  assert.deepEqual(guide, { kind: 'merge', from: laneCell(window, 0, 0), to: laneCell(window, 1, 0) });
});

test('no wisp over the board: no move is suggested, only merges; Seeds do not count as shooting', () => {
  const quiet = createLanesState(mechanic);
  assert.equal(firstBattleGuide(boardWith([[0, 3, 'nature:garden:2']]), quiet), null);
  assert.equal(firstBattleGuide(boardWith([[0, 3, 'nature:garden:1']]), firstWispHere()), null, 'a lone Seed fires nothing, so there is nothing to move');
});

test('the Mist lift frames Mossprout the way a tap on him does, not the old Egg close-up', () => {
  const camera = mossproutFtueStep('world.mist_lift')?.camera;
  assert.equal(camera?.kind === 'focus_target' ? camera.target.kind : null, 'haven_resident');
  assert.ok(camera?.kind === 'focus_target' && (camera.zoom ?? 0) < 2.5, 'no 3x Egg close-up');
});

test('the first battle is a chain: five guided wakes put a Sprout in every lane, and new Seeds land only in the bottom rows', () => {
  let board = createEncounterState(FIRST_BATTLE, 'mossprout', 1);
  let lanes: LanesState = createLanesState(mechanic);
  const item = (cell: number) => { const entry = board.board[cell]; return entry?.mist ? null : entry?.occupant?.kind === 'item' ? entry.occupant.definitionId : null; };
  for (let wake = 0; wake < 5; wake += 1) {
    const guide = firstBattleGuide(board, lanes);
    assert.equal(guide?.kind, 'wake', `wake ${wake + 1} is guided`);
    const result = reduceMissionMove(board, guide!.from, guide!.to, 1, MERGE_ITEMS_BY_ID);
    assert.ok(result.changed, `wake ${wake + 1} is accepted`);
    board = result.state;
  }
  for (let column = 0; column < 5; column += 1) assert.equal(item(laneCell(window, column, 3)!), 'nature:garden:2', `a Sprout shooting up lane ${column + 1}`);
  assert.equal(firstBattleGuide(board, lanes)?.kind, 'wake', 'the finger goes on up the chain: a Sprout to the one above it');
  const bottom = new Set([3, 4].flatMap((row) => [0, 1, 2, 3, 4].map((column) => laneCell(window, column, row)!)));
  const before = new Set(window.cellIndices.filter((cell) => item(cell)));
  for (let t = 0; t < 20_000; t += 100) {
    const result = lanesTick(mechanic, lanes, board, 100, window, MERGE_ITEMS_BY_ID);
    lanes = result.state as LanesState; board = result.board;
  }
  const landed = window.cellIndices.filter((cell) => item(cell) === 'nature:garden:1' && !before.has(cell));
  assert.ok(landed.length > 0, 'Seeds keep arriving');
  for (const cell of landed) assert.ok(bottom.has(cell), `a new Seed lands in the bottom rows, not at ${cell}`);
  assert.ok(mechanic.wisps.length >= 12 && new Set(mechanic.wisps.map((wisp) => wisp.column)).size === 5, 'waves of wisps across every lane');
});

test('the rescue is won only with every wisp down and the trapped cell out of the Mist, and the finger merges toward it', () => {
  const rescue = LOST_TRAIL_BATTLES[0]!;
  assert.deepEqual(rescue.objective, { kind: 'rescue', cell: LOST_TRAIL_RESCUE_CELL });
  const host = encounterMechanicHost(rescue);
  const trailWindow = encounterWindow(rescue);
  const lanesMechanic = rescue.mechanic as LanesMechanic;
  const board = createEncounterState(rescue, 'mossprout', 1);
  assert.equal(board.board[LOST_TRAIL_RESCUE_CELL]?.mist?.kind, 'encounter', 'Steppling starts under the Mist');
  const allDown: LanesState = { ...createLanesState(lanesMechanic), clock: 60_000, wisps: lanesMechanic.wisps.map((wisp) => ({ row: -2, damage: wisp.hp, holdUntil: 0, cells: 0 })) };
  const run = createEncounterRun(rescue);
  assert.equal(encounterStatus(rescue, host, allDown, run, board, trailWindow), 'playing', 'the wisps down is not enough while he is still under the Mist');
  const cleared = { ...board, board: board.board.map((cell, index) => index === LOST_TRAIL_RESCUE_CELL ? { ...cell, mist: null } : cell) };
  assert.equal(encounterStatus(rescue, host, allDown, run, cleared, trailWindow), 'cleared', 'free, and every wisp down: the rescue is won');
  // The finger: a merge landing as near the trapped cell as the pieces allow.
  const guide = scriptedBattleGuide(rescue, board, createLanesState(lanesMechanic));
  assert.equal(guide?.kind, 'merge');
  const near = (cell: number) => { const a = laneOf(trailWindow, cell)!; const b = laneOf(trailWindow, LOST_TRAIL_RESCUE_CELL)!; return Math.abs(a.column - b.column) + Math.abs(a.row - b.row); };
  assert.ok(near(guide!.to) <= near(guide!.from), 'the merge lands on the nearer piece');
});

test('every Lost Trail battle can be won by a careful player', () => {
  for (const [index, encounter] of LOST_TRAIL_BATTLES.entries()) {
    const careful = lanesFairness(encounter, 'careful', 3);
    assert.equal(careful.wins, careful.seeds, `stone ${index + 1}: careful wins every time (${careful.wins}/${careful.seeds}, ${careful.seconds}s)`);
  }
});

test('FTUE v2: Baristabbit is rescued in a Lanes battle, winnable by a careful player, with no ticket', async () => {
  const { BARISTABBIT_RESCUE_BATTLE, BARISTABBIT_RESCUE_COPY } = await import('@/constants/rescue-battles');
  const { BARISTABBIT_HATCHABLE } = await import('@/constants/hatchable-companions/baristabbit');
  assert.equal(BARISTABBIT_RESCUE_BATTLE.mechanic?.kind, 'lanes');
  assert.equal(BARISTABBIT_RESCUE_BATTLE.objective.kind, 'rescue');
  assert.equal(BARISTABBIT_HATCHABLE.mission.encounter, BARISTABBIT_RESCUE_BATTLE, 'the window is played as the rescue battle');
  assert.equal(BARISTABBIT_HATCHABLE.tile.price, 0, 'no ticket: the battle is the price');
  const careful = lanesFairness(BARISTABBIT_RESCUE_BATTLE, 'careful', 4);
  assert.ok(careful.wins >= 3, `careful wins the lit window (${careful.wins}/${careful.seeds}, ${careful.seconds}s)`);
  const idle = lanesFairness(BARISTABBIT_RESCUE_BATTLE, 'idle', 2);
  assert.equal(idle.wins, 0, 'doing nothing loses: it is a real battle');
  // In the battle (the Mist's presence) no "!"; once he is home, his arrival scene may.
  const { intro, arrival, ...said } = BARISTABBIT_RESCUE_COPY;
  for (const line of [...Object.values(said), intro?.title ?? '', intro?.line ?? '']) assert.ok(!/!/.test(line), `no "!" in the Mist's presence: ${line}`);
  assert.ok((arrival?.lines.length ?? 0) >= 3, 'home, he says who he is and what the Café is for before the goal widget comes back');
  assert.ok(intro, 'the rescue opens with its story card before the wisps come');
});
