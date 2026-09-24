import assert from 'node:assert/strict';
import test from 'node:test';

import { islandLevel, type IslandLevelSpec } from '@/constants/island-campaigns/island-levels';
import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { encounterMechanicHost } from '@/features/encounter/adapt';
import { createEncounterState, encounterWindow } from '@/features/encounter/create-state';
import { createEncounterRun } from '@/features/encounter/encounter-run';
import { glowShots } from '@/features/encounter/mist';
import { fairness, playtest } from '@/features/encounter/playtest';
import { settleAction, tapSeed } from '@/features/encounter/settle';
import { createDarkWispsState, darkWispsPrepare, type DarkWispsDefinition, type DarkWispsState } from '@/features/mission-mechanics/dark-wisps';
import { createMechanicState, resolveMechanic } from '@/features/mission-mechanics/mechanic';
import type { MergeWorldCommand, MergeWorldState } from '@/types/merge-world';
import { reduceMergeWorld, reduceMissionMove } from '@/utils/merge-world/engine';

// Merge vs Mist on a five-by-five board: cells 15-19, 22-26, 29-33, 36-40, 43-47.
const base: IslandLevelSpec = {
  title: 'Test', objective: 'Test.', difficulty: 'calm',
  pieces: [[43, 1], [44, 1]], mist: [],
  pod: { cell: 47, charges: 5, every: 3 },
  wisps: [{ id: 'creeper', hp: 1, cell: 24, kind: 'creeper' }],
};
const level = (spec: Partial<IslandLevelSpec> = {}) => islandLevel('test', 'tactics', { ...base, ...spec }).encounter;

type Node = { state: MergeWorldState; run: ReturnType<typeof createEncounterRun>; mechanicState: ReturnType<typeof createMechanicState> };
function setup(spec: Partial<IslandLevelSpec> = {}) {
  const encounter = level(spec);
  const host = encounterMechanicHost(encounter);
  const window = encounterWindow(encounter);
  const state = createEncounterState(encounter, 'mossprout', 0);
  const mechanic = resolveMechanic(host) as DarkWispsDefinition;
  const node: Node = { state, run: createEncounterRun(encounter), mechanicState: darkWispsPrepare(mechanic, createDarkWispsState(mechanic), state, window) };
  return { encounter, host, window, mechanic, node };
}
type Ctx = ReturnType<typeof setup>;
function act(ctx: Ctx, node: Node, command: MergeWorldCommand) {
  const result = command.type === 'move' ? reduceMissionMove(node.state, command.from, command.to, 0, MERGE_ITEMS_BY_ID) : reduceMergeWorld(node.state, command);
  assert.equal(result.changed, true, JSON.stringify(command));
  const settled = settleAction({ encounter: ctx.encounter, host: ctx.host, window: ctx.window }, node, command, result);
  return { ...settled, node: { state: settled.state, run: settled.run, mechanicState: settled.mechanicState } as Node };
}
const plansOf = (node: Node) => (node.mechanicState as DarkWispsState).plans ?? [];
const move = (from: number, to: number): MergeWorldCommand => ({ type: 'move', from, to, now: 0 });

test('a battle plays on five rows; the wisp stands on its cell', () => {
  const ctx = setup();
  assert.equal(ctx.encounter.rows, 5);
  assert.equal(ctx.window.cellIndices.length, 25);
  assert.equal(ctx.node.state.board[45]!.locked, false);
  const marker = ctx.node.state.board[24]!.mist;
  assert.equal(marker?.kind === 'encounter' && marker.type === 'wisp-bound', true);
});

test('only a merge is a turn: moving and spawning are free, a merge lets the wisp spread onto the cell it showed', () => {
  const ctx = setup({ pieces: [[43, 1], [44, 1], [36, 1]] });
  const shown = plansOf(ctx.node)[0]!;
  assert.equal(shown.kind, 'corrupt');
  assert.equal(shown.cells.length, 1);
  const tap = { type: 'tapGenerator' as const, generatorId: 'wild-garden', now: 0, seed: tapSeed(ctx.node.run), spendEnergy: false as const, enforceCharges: true as const };
  const spawned = act(ctx, ctx.node, tap);
  assert.deepEqual(spawned.effects, [], 'a spawn is free');
  const moved = act(ctx, spawned.node, move(36, 29));
  assert.deepEqual(moved.effects, [], 'a move is free');
  assert.equal(moved.run.actions, 0);
  const merged = act(ctx, moved.node, move(43, 44));
  assert.equal(merged.run.actions, 1);
  assert.deepEqual(merged.effects, [{ kind: 'corrupted', wisp: 0, cell: shown.cells[0] }], 'what it showed is where it spread');
});

test('a piece set on the shown cell does not stop the Mist: it spreads to the next free cell (a Snare Wisp locks the piece instead)', () => {
  const ctx = setup({ pieces: [[43, 1], [44, 1], [36, 1]] });
  const shown = plansOf(ctx.node)[0]!.cells[0]!;
  const blocked = act(ctx, ctx.node, move(36, shown));
  const turn = act(ctx, blocked.node, move(43, 44));
  const spread = turn.effects.find((effect) => effect.kind === 'corrupted');
  assert.ok(spread && spread.kind === 'corrupted' && spread.cell !== shown, 'elsewhere');
  assert.equal(turn.state.board[shown]!.occupant?.kind, 'item', 'the piece is untouched');

  const snare = setup({ pieces: [[43, 1], [44, 1], [31, 2]], wisps: [{ id: 'snare', hp: 1, cell: 24, kind: 'snare' }] });
  assert.deepEqual(plansOf(snare.node)[0]!.cells, [31], 'a Snare Wisp reaches for the piece beside it');
  const locked = act(snare, snare.node, move(43, 44));
  const mist = locked.state.board[31]!.mist;
  assert.equal(mist?.kind === 'encounter' && mist.type === 'bound' && mist.holds?.kind === 'item' && mist.holds.definitionId === 'nature:garden:2', true, 'locked, still there');
  const freed = glowShots(locked.state, 38, 'nature:garden:2', snare.window);
  assert.equal(freed.board.board[31]!.occupant?.kind === 'item' && freed.board.board[31]!.occupant.definitionId, 'nature:garden:2', 'Glow on that Mist frees it');
});

test('a merge fires Glow at the nearest Mist: a Sprout one shot beside it, a Plant two reaching two steps, a Flower three reaching three', () => {
  const encounter = level({ mist: [{ cell: 24, type: 'light' }, { cell: 17, type: 'light' }, { cell: 19, type: 'dense' }], wisps: [{ id: 'creeper', hp: 1, cell: 44, kind: 'creeper' }] });
  const window = encounterWindow(encounter);
  const board = createEncounterState(encounter, 'mossprout', 0);
  const sprout = glowShots(board, 31, 'nature:garden:2', window);
  assert.deepEqual(sprout.shots, [{ from: 31, to: 24, opened: true }], 'one shot, at the Mist beside it');
  assert.deepEqual(glowShots(board, 38, 'nature:garden:2', window).shots, [], 'a Sprout cannot reach Mist two steps off');
  const plant = glowShots(board, 31, 'nature:garden:3', window);
  assert.deepEqual(plant.shots.map((shot) => shot.to), [24, 17], 'two shots: the nearest first, then two steps off');
  const flower = glowShots(board, 26, 'nature:garden:4', window);
  assert.deepEqual(flower.shots.map((shot) => [shot.to, shot.opened]), [[19, false], [19, true], [24, true]], 'Thick Mist takes two shots; the third flies on');
  assert.equal(glowShots(board, 31, 'nature:garden:2', window, undefined, { boost: 1 }).shots.length, 2, 'Focus: one step stronger');
});

test('the wisp is cleansed by a merge right beside it once the four cells around it are clear', () => {
  const ctx = setup({ pieces: [[31, 1], [38, 1], [43, 1], [44, 1]], mist: [{ cell: 17, type: 'light' }, { cell: 23, type: 'light' }, { cell: 25, type: 'light' }] });
  const blocked = act(ctx, ctx.node, move(38, 31));
  assert.equal(blocked.strike, null, 'a merge beside it while Mist still wraps it does not cleanse it');
  const open = setup({ pieces: [[31, 1], [38, 1], [43, 1], [44, 1]], mist: [{ cell: 16, type: 'light' }] });
  const cleansed = act(open, open.node, move(38, 31));
  assert.equal(cleansed.strike?.target, 0);
  assert.equal(cleansed.status, 'cleared');
  assert.equal(cleansed.state.board[24]!.mist, null);
  assert.equal(cleansed.state.board[16]!.mist, null, 'the Mist around it collapses');
});

test('a Spore Wisp spreads two cells every third merge; a Root Wisp spreads Thick Mist', () => {
  const spore = setup({ pieces: [[36, 1], [37, 1], [38, 1], [39, 1], [43, 1], [44, 1]], wisps: [{ id: 'spore', hp: 1, cell: 17, kind: 'spore' }] });
  let node = spore.node;
  const sizes: number[] = [];
  for (const [from, to] of [[36, 37], [38, 39], [43, 44]] as const) {
    sizes.push(plansOf(node)[0]!.cells.length);
    node = act(spore, node, move(from, to)).node;
  }
  assert.deepEqual(sizes, [1, 1, 2]);
  const root = setup({ wisps: [{ id: 'root', hp: 1, cell: 17, kind: 'root' }] });
  const planned = plansOf(root.node)[0]!;
  assert.equal(planned.kind, 'shroud');
  const turn = act(root, root.node, move(43, 44));
  const laid = turn.state.board[planned.cells[0]!]!.mist;
  assert.equal(laid?.kind === 'encounter' && laid.type === 'dense', true);
});

test('lost only when the board cannot come back, or at the Mist line', async () => {
  const { lossReason } = await import('@/features/encounter/encounter-run');
  const ctx = setup({ pieces: [], pod: { cell: 47, charges: 0, every: 3 } });
  const run = { ...ctx.node.run, cacheOpened: true };
  assert.equal(lossReason(ctx.encounter, ctx.host, ctx.node.mechanicState, run, ctx.node.state, ctx.window), 'spent', 'no piece and an empty Pod: nothing to merge, ever');
  const growing = setup({ pieces: [[43, 2]], pod: { cell: 47, charges: 0, every: 3 } });
  assert.equal(lossReason(growing.encounter, growing.host, growing.node.mechanicState, run, growing.node.state, growing.window), null, 'the rescue can still bring its twin');
});

test('a Drifter drifts through its own Mist away from your pieces, leaving Mist behind; with no Mist beside it, it spreads', () => {
  const ctx = setup({ pieces: [[43, 1], [44, 1], [45, 1]], pod: { cell: 40, charges: 3, every: 3 }, mist: [{ cell: 17, type: 'light' }, { cell: 31, type: 'light' }], wisps: [{ id: 'drifter', hp: 1, cell: 24, kind: 'drifter' }] });
  const plan = plansOf(ctx.node)[0]!;
  assert.deepEqual(plan, { wisp: 0, kind: 'move', cells: [17] }, 'up, away from the pieces below');
  const turn = act(ctx, ctx.node, move(43, 44));
  assert.deepEqual(turn.effects, [{ kind: 'drifted', wisp: 0, from: 24, to: 17 }]);
  const trail = turn.state.board[24]!.mist;
  assert.equal(trail?.kind === 'encounter' && trail.type === 'light', true, 'Mist where it was');
  const marker = turn.state.board[17]!.mist;
  assert.equal(marker?.kind === 'encounter' && marker.type === 'wisp-bound', true);
  assert.equal((turn.mechanicState as DarkWispsState).nest![0], 17);
  const bare = setup({ wisps: [{ id: 'drifter', hp: 1, cell: 24, kind: 'drifter' }] });
  assert.equal(plansOf(bare.node)[0]!.kind, 'corrupt', 'nowhere to drift: it spreads like a Creeper');
});

test('Merge vs Mist: every Mist a merge lifts is a Glow shot\'s target (the Glow clears it, never the merge)', () => {
  // The Merge vs Mist levels Petalimp played before Lanes replaced them.
  const light = (cell: number) => ({ cell, type: 'light' as const });
  const dense = (cell: number) => ({ cell, type: 'dense' as const });
  const specs: IslandLevelSpec[] = [
    { ...base, pieces: [[36, 1], [37, 1], [39, 1], [40, 1], [44, 1], [46, 1]], mist: [light(16), light(17), light(18), light(23), light(25), light(31)], pod: { cell: 45, charges: 10, every: 2 }, wisps: [{ id: 'creeper', hp: 1, cell: 24, kind: 'creeper' }] },
    { ...base, pieces: [[38, 2], [39, 2], [36, 1], [37, 1], [44, 1], [46, 1]], mist: [dense(16), dense(18), light(24), light(22), light(26), light(30)], pod: { cell: 45, charges: 10, every: 2 }, wisps: [{ id: 'creeper', hp: 1, cell: 17, kind: 'creeper' }] },
    { ...base, pieces: [[36, 1], [37, 1], [38, 1], [39, 1], [44, 1], [46, 1]], mist: [light(15), light(16), light(18), light(19), light(22), dense(23), light(24), dense(25), light(26)], pod: { cell: 45, charges: 10, every: 2 }, wisps: [{ id: 'drifter', hp: 1, cell: 17, kind: 'drifter' }] },
    { ...base, pieces: [[36, 1], [37, 1], [39, 1], [40, 1], [38, 2], [44, 1]], mist: [light(15), light(17), light(22), light(18), light(26), light(25)], pod: { cell: 45, charges: 10, every: 2 }, wisps: [{ id: 'creeper', hp: 1, cell: 16, kind: 'creeper' }, { id: 'drifter', hp: 1, cell: 19, kind: 'drifter' }] },
  ];
  let checked = 0;
  for (const spec of specs) {
    const encounter = islandLevel('test', 'shots', spec).encounter;
    const host = encounterMechanicHost(encounter);
    const window = encounterWindow(encounter);
    for (const attempt of [1, 2, 3]) {
      playtest(encounter, { style: 'careful', attempt, onStep: (step) => {
        if (step.kind !== 'merge' || step.command?.type !== 'move') return;
        const result = reduceMissionMove(step.before.state, step.command.from, step.command.to, 0, MERGE_ITEMS_BY_ID);
        const settled = settleAction({ encounter, host, window, items: MERGE_ITEMS_BY_ID }, step.before, step.command, result);
        const targets = new Set((settled.shots ?? []).map((shot) => shot.to));
        for (const cell of window.cellIndices) {
          const was = step.before.state.board[cell]?.mist;
          if (was?.kind !== 'encounter' || was.type === 'wisp-bound') continue;
          if (settled.state.board[cell]?.mist?.kind === 'encounter') continue;
          checked += 1;
          assert.ok(targets.has(cell), `${spec.title}: cell ${cell} cleared without a Glow shot`);
        }
      } });
    }
  }
  assert.ok(checked > 10);
});
