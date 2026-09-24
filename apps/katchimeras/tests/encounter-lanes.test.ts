import assert from 'node:assert/strict';
import test from 'node:test';

import { islandLevel, MIST_LEVEL_SPEC, PETALIMP_LEVEL_SPECS, type IslandLevelSpec } from '@/constants/island-campaigns/island-levels';
import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { encounterMechanicHost } from '@/features/encounter/adapt';
import { createEncounterState, encounterWindow } from '@/features/encounter/create-state';
import { createEncounterRun, encounterStatus, lossReason } from '@/features/encounter/encounter-run';
import { lanesFairness } from '@/features/encounter/lanes-playtest';
import { settleAction } from '@/features/encounter/settle';
import { createLanesState, LANE_MISS_ROW, laneFire, laneFlightMs, lanesKeepGoing, lanesTick, type LanesMechanic, type LanesState } from '@/features/mission-mechanics/lanes';
import { resolveMechanic } from '@/features/mission-mechanics/mechanic';
import type { MergeWorldState } from '@/types/merge-world';
import { reduceMissionMove } from '@/utils/merge-world/engine';

// Five columns, five rows: cells 15-19, 22-26, 29-33, 36-40, 43-47. Column 3 (index 2) is cells 17, 24, 31, 38, 45.
const base: IslandLevelSpec = {
  title: 'Test', objective: 'Test.', difficulty: 'calm',
  pieces: [], mist: [], pod: { cell: 47, charges: 4, every: 2 }, wisps: [],
  lanes: [{ id: 'a', column: 3, at: 1, hp: 4, step: 5 }],
};
function setup(spec: Partial<IslandLevelSpec> = {}) {
  const encounter = islandLevel('test', 'lanes', { ...base, ...spec }).encounter;
  const host = encounterMechanicHost(encounter);
  const mechanic = resolveMechanic(host) as LanesMechanic;
  const window = encounterWindow(encounter);
  const state = createEncounterState(encounter, 'mossprout', 1);
  return { encounter, host, mechanic, window, state, lanes: createLanesState(mechanic) };
}
const run = (mechanic: LanesMechanic, lanes: LanesState, board: MergeWorldState, ms: number, window: ReturnType<typeof encounterWindow>) => {
  let state = lanes;
  let next = board;
  const fired = [];
  const effects = [];
  for (let t = 0; t < ms; t += 100) {
    const ticked = lanesTick(mechanic, state, next, 100, window);
    state = ticked.state;
    next = ticked.board;
    fired.push(...ticked.fired);
    effects.push(...ticked.effects);
  }
  return { state, board: next, fired, effects };
};

test('a wisp arrives high over its column and drifts down a row every beat; past the bottom row it gets through and the level is lost', () => {
  const { encounter, host, mechanic, window, state, lanes } = setup();
  // The sky starts empty, so it is brought in half a second from the start (it was authored for 1 s).
  const early = run(mechanic, lanes, state, 400, window);
  assert.equal(early.state.wisps[0]!.row, -4, 'waiting four rows over the board until it arrives');
  const later = run(mechanic, lanes, state, 5_500, window);
  assert.ok(Math.abs(later.state.wisps[0]!.row - -3) < 0.05, `one row down one beat after it arrived (${later.state.wisps[0]!.row})`);
  const half = run(mechanic, lanes, state, 3_000, window);
  assert.ok(half.state.wisps[0]!.row > -3.6 && half.state.wisps[0]!.row < -3.4, 'it drifts, it does not jump');
  // From four rows up, a row every 5 s: its centre leaves the bottom row 8.5 rows later.
  const through = run(mechanic, lanes, state, 50_000, window);
  assert.equal(through.state.breached, 0);
  const runState = createEncounterRun(encounter);
  assert.equal(encounterStatus(encounter, host, through.state, runState, through.board, window), 'failed');
  assert.equal(lossReason(encounter, host, through.state, runState, through.board, window), 'breached');
});

test('pieces fire Glow straight up their own column on their own beat, at the lowest wisp over them or off the top; a Seed does not fire', () => {
  assert.equal(laneFire(1), null);
  assert.ok(laneFire(3)!.damage > laneFire(2)!.damage && laneFire(3)!.periodMs < laneFire(2)!.periodMs);
  // A Sprout under the wisp (cell 38, column 3), a Seed beside it, a Sprout in another column.
  const { mechanic, window, state, lanes } = setup({ pieces: [[38, 2], [37, 1], [36, 2]] });
  const played = run(mechanic, lanes, state, 6_000, window);
  const aimed = played.fired.filter((shot) => shot.fromCell === 38);
  const misses = played.fired.filter((shot) => shot.fromCell === 36);
  assert.ok(aimed.length >= 2 && aimed.every((shot) => shot.wisp === 0 && shot.damage === 1), 'the piece under the wisp shoots it');
  assert.ok(misses.length >= 1 && misses.every((shot) => shot.wisp === -1 && shot.damage === 0), 'a piece with nothing over it still fires, off the top');
  assert.ok(!played.fired.some((shot) => shot.fromCell === 37), 'a Seed never fires');
  assert.equal(misses[0]!.landsAt - misses[0]!.firedAt, laneFlightMs(3 + LANE_MISS_ROW), 'a miss climbs past the top of the board');
  assert.ok(played.state.wisps[0]!.damage >= 1, 'the damage lands on the level clock');
});

test('a wisp that reaches a piece puts it under Mist and holds for a beat; every few cells it leaves Mist behind', () => {
  // A Seed in the wisp's way at the top row (cell 17), under it nothing that fires.
  const blocked = setup({ pieces: [[17, 1]] });
  // It arrives at 1 s four rows up; drifting a row every 5 s, its centre reaches the top row's edge at 18.5 s.
  const played = run(blocked.mechanic, blocked.lanes, blocked.state, 19_000, blocked.window);
  const cell = played.board.board[17]!;
  assert.equal(cell.mist?.kind === 'encounter' && cell.mist.type, 'bound', 'the piece is bound, not lost');
  assert.ok(played.effects.some((effect) => effect.kind === 'bound' && effect.cell === 17));
  assert.equal(played.state.wisps[0]!.row, -0.5, 'it holds at the edge of that cell');
  assert.ok(played.state.wisps[0]!.holdUntil > 19_000, 'for a beat');
  const dropping = setup({ lanes: [{ id: 'a', column: 3, at: 0, hp: 50, step: 1, drop: 1 }] });
  const dropped = run(dropping.mechanic, dropping.lanes, dropping.state, 5_100, dropping.window);
  assert.equal(dropped.board.board[17]!.mist?.kind, 'encounter', 'it left Mist on the cell it drifted out of');
});

test('a merge fires almost at once and its Glow clears the Mist beside it; a piece put where a wisp is goes under Mist', () => {
  const { encounter, host, mechanic, window, state, lanes } = setup({ pieces: [[38, 1], [39, 1]], mist: [{ cell: 31, type: 'light' }] });
  const binding = { encounter, host, window };
  const before = { state, run: createEncounterRun(encounter), mechanicState: { ...lanes, clock: 2_000 } };
  const command = { type: 'move' as const, from: 39, to: 38, now: 1 };
  const settled = settleAction(binding, before, command, reduceMissionMove(state, 39, 38, 1, MERGE_ITEMS_BY_ID));
  assert.equal(settled.state.board[38]!.occupant?.kind, 'item');
  assert.ok((settled.shots ?? []).some((shot) => shot.to === 31), 'its Glow flies at the Mist beside it');
  assert.equal(settled.state.board[31]!.mist, null);
  const made = settled.state.board[38]!.occupant!;
  assert.ok(settled.mechanicState.kind === 'lanes' && settled.mechanicState.ready[made.kind === 'item' ? made.instanceId : ''] === 2_120, 'it fires 120 ms after it is made');
  // The wisp down on the top row of column 3 (cell 17): a piece moved there is bound at once.
  const onBoard = setup({ pieces: [[36, 1]] });
  const standing = { ...onBoard.lanes, clock: 5_000, wisps: [{ ...onBoard.lanes.wisps[0]!, row: 0 }] };
  const crash = settleAction({ encounter: onBoard.encounter, host: onBoard.host, window: onBoard.window }, { state: onBoard.state, run: createEncounterRun(onBoard.encounter), mechanicState: standing }, { type: 'move', from: 36, to: 17, now: 1 }, reduceMissionMove(onBoard.state, 36, 17, 1, MERGE_ITEMS_BY_ID));
  assert.equal(crash.state.board[17]!.mist?.kind === 'encounter' && crash.state.board[17]!.mist.type, 'bound');
});

test('keep going puts every standing wisp back up the board', () => {
  const { mechanic, lanes } = setup();
  const lost = { ...lanes, clock: 30_000, breached: 0, wisps: [{ ...lanes.wisps[0]!, row: 4 }] };
  const kept = lanesKeepGoing(mechanic, lost);
  assert.equal(kept.breached, null);
  assert.equal(kept.wisps[0]!.row, 1);
  assert.ok(kept.wisps[0]!.holdUntil >= 30_000 + 5_000, 'and waits a beat');
});

test('every Petalimp level is Lanes and fair: careful play wins, a novice wins the calm ones and not the boss, doing nothing loses', () => {
  const levels = [MIST_LEVEL_SPEC, ...PETALIMP_LEVEL_SPECS[1], ...PETALIMP_LEVEL_SPECS[2], ...PETALIMP_LEVEL_SPECS[3], ...PETALIMP_LEVEL_SPECS[4]];
  for (const [index, spec] of levels.entries()) {
    const encounter = islandLevel('island-campaign:petalimp-bloom', `lanes-${index}`, spec).encounter;
    assert.equal(encounter.mechanic?.kind, 'lanes');
    const careful = lanesFairness(encounter, 'careful', 6);
    assert.ok(careful.wins >= 4, `${spec.title}: the careful player won ${careful.wins} of 6`);
    assert.equal(lanesFairness(encounter, 'idle', 1).wins, 0, `${spec.title}: doing nothing must lose`);
    if (spec.difficulty === 'calm' || spec.difficulty === 'boss') {
      const novice = lanesFairness(encounter, 'careless', 6).wins;
      if (spec.difficulty === 'calm') assert.ok(novice >= 3, `${spec.title}: a novice won ${novice} of 6`);
      else assert.ok(novice <= 2, `${spec.title}: a novice won the boss ${novice} of 6`);
    }
  }
});

test('a wisp over the board spits Mist down its column onto the top-most free cell, never onto a piece', () => {
  const free = setup({ lanes: [{ id: 'a', column: 3, at: 0, hp: 50, step: 60, spit: 1 }] });
  const spat = run(free.mechanic, free.lanes, free.state, 1_300, free.window);
  assert.equal(spat.board.board[17]!.mist?.kind === 'encounter' && spat.board.board[17]!.mist.type, 'light', 'the top cell of its column mists over');
  const next = run(free.mechanic, spat.state, spat.board, 1_000, free.window);
  assert.equal(next.board.board[24]!.mist?.kind, 'encounter', 'the next spit lands on the next cell down');
  const piece = setup({ pieces: [[17, 2]], lanes: [{ id: 'a', column: 3, at: 0, hp: 50, step: 60, spit: 1 }] });
  const passed = run(piece.mechanic, piece.lanes, piece.state, 1_300, piece.window);
  assert.equal(passed.board.board[17]!.occupant?.kind, 'item', 'the piece is left alone');
  assert.equal(passed.board.board[24]!.mist?.kind, 'encounter', 'the Mist lands on the free cell below it');
});

test('the first boards’ chain plays on a Lanes board: a sleeper woken by its twin opens the full Mist beside it', () => {
  const { encounter, host, window, state, lanes } = setup({ pieces: [[37, 1]], sleepers: [[38, 1]], veiled: [[31, 1]] });
  assert.equal(state.board[38]!.mist?.kind, 'echo');
  assert.equal(state.board[31]!.mist?.kind, 'veiled');
  const result = reduceMissionMove(state, 37, 38, 1, MERGE_ITEMS_BY_ID);
  assert.deepEqual(result.revealedMistCells, [31]);
  const settled = settleAction({ encounter, host, window }, { state, run: createEncounterRun(encounter), mechanicState: lanes }, { type: 'move', from: 37, to: 38, now: 1 }, result);
  assert.equal(settled.state.board[38]!.occupant?.kind === 'item' && settled.state.board[38]!.occupant.definitionId, 'nature:garden:2', 'it wakes a tier up');
  assert.equal(settled.state.board[31]!.mist?.kind, 'echo', 'the full Mist beside it opens to half Mist over its sleeper');
});

test('an empty sky never waits: with no wisp standing, the next arrives at once and every later one as much sooner', () => {
  const { mechanic, window, state, lanes } = setup({ pieces: [[38, 4]], lanes: [{ id: 'a', column: 3, at: 0, hp: 1, step: 5 }, { id: 'b', column: 3, at: 30, hp: 50, step: 5 }, { id: 'c', column: 2, at: 40, hp: 50, step: 5 }] });
  const played = run(mechanic, lanes, state, 6_000, window);
  assert.ok(played.state.wisps[0]!.damage >= 1, 'the first falls to the Flower under it');
  assert.ok((played.state.advance ?? 0) > 20_000, 'the rest were brought forward');
  assert.ok(played.state.clock >= 30_000 - (played.state.advance ?? 0), 'the second has arrived well before 30 s');
  assert.equal(40_000 - (played.state.advance ?? 0) - (30_000 - (played.state.advance ?? 0)), 10_000, 'the spacing after it is kept');
});
