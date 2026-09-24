import assert from 'node:assert/strict';
import test from 'node:test';

import { islandLevel, type IslandLevelSpec } from '@/constants/island-campaigns/island-levels';
import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { encounterMechanicHost } from '@/features/encounter/adapt';
import { createEncounterState, encounterWindow } from '@/features/encounter/create-state';
import { createEncounterRun, encounterStatus, keepGoing, lossReason } from '@/features/encounter/encounter-run';
import { encounterMistLeft, harmonyPulse } from '@/features/encounter/mist';
import { encounterGrade } from '@/features/encounter/outcome';
import { pulseArea } from '@/features/encounter/pulse';
import { settleAction, tapSeed } from '@/features/encounter/settle';
import { createDarkWispsState, darkWispsAfterAction, darkWispsPrepare, darkWispsStrike, darkWispsTurnStrip, darkWispsViews, planWispTurn, pulseTarget, pushBackDarkWisps, REST, SPORE_TURNS, type DarkWispsDefinition, type DarkWispsState } from '@/features/mission-mechanics/dark-wisps';
import { createMechanicState, resolveMechanic } from '@/features/mission-mechanics/mechanic';
import type { MergeWorldState } from '@/types/merge-world';
import { reduceMergeWorld, reduceMissionMove } from '@/utils/merge-world/engine';

// The window: cells 15-19, 22-26, 29-33, 36-40 (five columns, four rows).
const base: IslandLevelSpec = {
  title: 'Test', objective: 'Test.', difficulty: 'thick', ring: false, rest: 0,
  pieces: [[36, 1], [37, 1], [38, 1], [39, 1]], mist: [],
  pod: { cell: 40, charges: 3, every: 3 },
  wisps: [{ id: 'surger', hp: 9, cell: 17, intents: [{ kind: 'surge', every: 3 }] }],
};
const level = (spec: Partial<IslandLevelSpec> = {}) => islandLevel('test', 'level', { ...base, ...spec }).encounter;
const rng = () => 0;

function setup(spec: Partial<IslandLevelSpec> = {}) {
  const encounter = level(spec);
  const host = encounterMechanicHost(encounter);
  const window = encounterWindow(encounter);
  return { encounter, host, window, node: { state: createEncounterState(encounter, 'mossprout', 0), run: createEncounterRun(encounter), mechanicState: createMechanicState(resolveMechanic(host)) } };
}
type Ctx = ReturnType<typeof setup>;
function merge(ctx: Ctx, node: Ctx['node'], from: number, to: number) {
  const result = reduceMissionMove(node.state, from, to, 0, MERGE_ITEMS_BY_ID);
  assert.equal(result.changed && result.mergedCell != null, true, `merge ${from} into ${to}`);
  const settled = settleAction({ encounter: ctx.encounter, host: ctx.host, window: ctx.window }, node, { type: 'move', from, to, now: 0 }, result);
  return { ...settled, node: { state: settled.state, run: settled.run, mechanicState: settled.mechanicState } };
}
const mechanicOf = (spec: Partial<IslandLevelSpec>) => level(spec).mechanic as DarkWispsDefinition;
const isMist = (state: MergeWorldState, cell: number) => state.board[cell]?.mist?.kind === 'encounter';

test('a wisp nests on its cell: wisp-bound Mist the pulse never wears, opened when it falls', () => {
  const ctx = setup({ pieces: [[30, 1], [31, 1]], wisps: [{ id: 'w', hp: 1, cell: 24 }] });
  const nest = ctx.node.state.board[24]!.mist;
  assert.equal(nest?.kind === 'encounter' && nest.type === 'wisp-bound' && nest.wispId === 'w', true);
  const step = merge(ctx, ctx.node, 30, 31);
  assert.equal(step.strike?.target, 0, 'a Sprout landing beside the nest strikes it');
  assert.equal(step.status, 'cleared');
  assert.equal(step.state.board[24]!.mist, null, 'its nest lets go');
});

test('a turn is a merge: the Pod costs nothing and gives the wisps no turn; after a merge the front of the strip acts, as planned', () => {
  const ctx = setup();
  assert.equal(ctx.node.run.territory?.overrun, 13, 'a thick level is lost at 65% of twenty cells');
  const command = { type: 'tapGenerator' as const, generatorId: 'wild-garden', now: 0, seed: tapSeed(ctx.node.run), spendEnergy: false as const, enforceCharges: true as const };
  const afterTap = settleAction({ encounter: ctx.encounter, host: ctx.host, window: ctx.window }, ctx.node, command, reduceMergeWorld(ctx.node.state, command));
  assert.equal(afterTap.refused, undefined);
  assert.deepEqual(afterTap.effects, [], 'no turn passed');
  const mechanic = ctx.encounter.mechanic as DarkWispsDefinition;
  const plan = planWispTurn(mechanic, ctx.node.mechanicState as DarkWispsState, ctx.node.state, ctx.window)!;
  assert.equal(plan.kind, 'surge');
  assert.equal(plan.cells.length, 1);
  const step = merge(ctx, ctx.node, 36, 37);
  assert.deepEqual(step.effects, [{ kind: 'surged', wisp: 0, cell: plan.cells[0] }], 'what it showed is what it did');
  assert.ok((step.mechanicState as DarkWispsState).plan, 'and the next turn is planned for the player to see');
});

test('the Harmony pulse grows with what was made: a Sprout the four beside it, a Plant the eight, a Flower twice, then two cells out', () => {
  const window = encounterWindow(level());
  assert.deepEqual(new Set(pulseArea(24, 2, window).cells), new Set([17, 31, 23, 25]));
  assert.equal(pulseArea(24, 2, window).hits, 1);
  assert.deepEqual(new Set(pulseArea(24, 3, window).cells), new Set([16, 17, 18, 23, 25, 30, 31, 32]));
  assert.equal(pulseArea(24, 4, window).hits, 2);
  assert.equal(pulseArea(24, 5, window).cells.length, 11, 'a radius-two diamond, kept to the board');
  assert.deepEqual(new Set(pulseArea(15, 2, window).cells), new Set([16, 22]), 'a corner reaches only what is on the board');
  const encounter = level({ mist: [{ cell: 23, type: 'dense' }, { cell: 16, type: 'light' }] });
  const board = createEncounterState(encounter, 'mossprout', 0);
  const sprout = harmonyPulse(board, 30, 'nature:garden:2', window);
  assert.ok(isMist(sprout.board, 23) && isMist(sprout.board, 16), 'a Sprout below only wears the thick Mist above it');
  const flower = harmonyPulse(board, 24, 'nature:garden:4', window);
  assert.ok(!isMist(flower.board, 23) && !isMist(flower.board, 16), 'a Flower opens thick Mist in one and reaches the diagonal');
});

test('where a merge lands decides what it strikes: only a nest inside its pulse, the one acting soonest first', () => {
  const window = encounterWindow(level());
  const mechanic = mechanicOf({ wisps: [{ id: 'soon', hp: 5, cell: 16, intents: [{ kind: 'surge', every: 1 }] }, { id: 'later', hp: 5, cell: 18, intents: [{ kind: 'surge', every: 1 }] }] });
  const state = createDarkWispsState(mechanic);
  assert.deepEqual(state.order, [0, 1]);
  assert.equal(pulseTarget(mechanic, state, 25, 2, window), 1, 'a Sprout below the right one');
  assert.equal(pulseTarget(mechanic, state, 38, 2, window), null, 'nothing in reach at the bottom');
  assert.equal(pulseTarget(mechanic, state, 24, 3, window), 0, 'a Plant between them strikes the one acting sooner');
  assert.equal(darkWispsStrike(mechanic, state, { type: 'merge_completed', resultCell: 38, resultDefinitionId: 'nature:garden:2' }, undefined, window).strike, null);
});

test('a Surge spreads its Mist into the free cells nearest its nest; walled in, it binds the smallest piece it touches', () => {
  const window = encounterWindow(level());
  const open = level();
  const mechanic = open.mechanic as DarkWispsDefinition;
  const spread = darkWispsAfterAction(mechanic, createDarkWispsState(mechanic), createEncounterState(open, 'mossprout', 0), window, rng);
  const surged = spread.effects.find((effect) => effect.kind === 'surged');
  assert.ok(surged && surged.kind === 'surged' && [16, 18, 24].includes(surged.cell), 'beside its nest');
  assert.ok(isMist(spread.board, surged.cell));
  const walled = level({ pieces: [[16, 1], [18, 2], [24, 2], [36, 1], [37, 1]] });
  const bound = darkWispsAfterAction(mechanic, createDarkWispsState(mechanic), createEncounterState(walled, 'mossprout', 0), window, rng);
  assert.deepEqual(bound.effects, [{ kind: 'bound', wisp: 0, cell: 16, definitionId: 'nature:garden:1' }]);
  const caught = bound.board.board[16]!.mist;
  assert.equal(caught?.kind === 'encounter' && caught.type === 'bound' && caught.holds?.kind === 'item' && caught.holds.definitionId === 'nature:garden:1', true, 'caught in the Mist, not lost');
});

test('a Burrow moves the nest deeper into its Mist; its old nest stays misted', () => {
  const encounter = level({ mist: [{ cell: 16, type: 'light' }, { cell: 15, type: 'light' }], wisps: [{ id: 'mole', hp: 5, cell: 17, intents: [{ kind: 'burrow', every: 1 }] }] });
  const mechanic = encounter.mechanic as DarkWispsDefinition;
  const turn = darkWispsAfterAction(mechanic, createDarkWispsState(mechanic), createEncounterState(encounter, 'mossprout', 0), encounterWindow(encounter), rng);
  assert.deepEqual(turn.effects, [{ kind: 'burrowed', wisp: 0, from: 17, to: 15 }]);
  assert.equal(turn.state.nest![0], 15);
  const moved = turn.board.board[15]!.mist;
  assert.equal(moved?.kind === 'encounter' && moved.type === 'wisp-bound' && moved.wispId === 'mole', true);
  assert.ok(isMist(turn.board, 17));
  assert.deepEqual(darkWispsViews(mechanic, turn.state)[0]!.placement, { kind: 'cell', cell: 15, size: 0.9 }, 'drawn where it went');
});

test('Spores turn an empty cell to Mist after two turns; a piece put on it ends the spore', () => {
  const encounter = level({ rest: 2, wisps: [{ id: 'spore', hp: 5, cell: 17, intents: [{ kind: 'spores', every: 1 }] }] });
  const mechanic = encounter.mechanic as DarkWispsDefinition;
  const window = encounterWindow(encounter);
  const board = createEncounterState(encounter, 'mossprout', 0);
  const dropped = darkWispsAfterAction(mechanic, createDarkWispsState(mechanic), board, window, rng);
  const spore = dropped.state.spores![0]!;
  assert.equal(spore.turns, SPORE_TURNS);
  assert.ok(![16, 18, 24].includes(spore.cell), 'away from its own Mist');
  const waited = darkWispsAfterAction(mechanic, dropped.state, dropped.board, window, rng);
  assert.equal(waited.state.spores![0]!.turns, 1);
  const bloomed = darkWispsAfterAction(mechanic, waited.state, waited.board, window, rng);
  assert.ok(bloomed.effects.some((effect) => effect.kind === 'spore_bloomed' && effect.cell === spore.cell));
  assert.ok(isMist(bloomed.board, spore.cell));
  const cells = [...waited.board.board];
  cells[spore.cell] = { ...cells[spore.cell]!, occupant: { kind: 'item', instanceId: 'blocker', definitionId: 'nature:garden:1' } };
  const blocked = darkWispsAfterAction(mechanic, waited.state, { ...waited.board, board: cells }, window, rng);
  assert.equal(blocked.state.spores!.length, 0);
  assert.ok(!isMist(blocked.board, spore.cell));
});

test('struck to half, a wisp breaks off its twin, which nests beside it; a caller calls its hidden one into its Mist', () => {
  const encounter = level({ wisps: [{ id: 'big', hp: 6, cell: 17, splitsInto: 'shard' }, { id: 'shard', hp: 2, cell: 17, hidden: true, intents: [{ kind: 'surge', every: 2 }] }] });
  const mechanic = encounter.mechanic as DarkWispsDefinition;
  const window = encounterWindow(encounter);
  const board = createEncounterState(encounter, 'mossprout', 0);
  assert.equal(darkWispsViews(mechanic, createDarkWispsState(mechanic))[1]!.alive, false);
  const halved = { ...createDarkWispsState(mechanic), damage: [3, 0] };
  const split = darkWispsAfterAction(mechanic, halved, board, window, rng);
  const effect = split.effects.find((entry) => entry.kind === 'split');
  assert.ok(effect && effect.kind === 'split' && [16, 18, 24].includes(effect.cell));
  assert.equal(darkWispsViews(mechanic, split.state)[1]!.alive, true);
  const nest = split.board.board[effect.cell]!.mist;
  assert.equal(nest?.kind === 'encounter' && nest.type === 'wisp-bound' && nest.wispId === 'shard', true);
  assert.equal(darkWispsAfterAction(mechanic, split.state, split.board, window, rng).effects.filter((entry) => entry.kind === 'split').length, 0, 'only once');

  const called = level({ mist: [{ cell: 16, type: 'light' }], wisps: [{ id: 'caller', hp: 4, cell: 17, intents: [{ kind: 'call', every: 1 }] }, { id: 'mistling', hp: 2, cell: 17, hidden: true }] });
  const calls = called.mechanic as DarkWispsDefinition;
  const turn = darkWispsAfterAction(calls, createDarkWispsState(calls), createEncounterState(called, 'mossprout', 0), window, rng);
  assert.deepEqual(turn.effects, [{ kind: 'called', wisp: 1, caller: 0, cell: 16 }], 'into its own Mist');
});

test('the Mist takes over: at its share of the board the level is lost', () => {
  const ctx = setup({ overrun: 0.25, mist: [{ cell: 16, type: 'light' }], wisps: [{ id: 'w', hp: 9, cell: 17, intents: [{ kind: 'surge', every: 1, amount: 3 }] }] });
  assert.equal(ctx.node.run.territory?.overrun, 5);
  const step = merge(ctx, ctx.node, 38, 39);
  assert.equal(encounterMistLeft(step.state, ctx.window), 5);
  assert.equal(step.status, 'failed');
  assert.equal(lossReason(ctx.encounter, ctx.host, step.mechanicState, step.run, step.state, ctx.window), 'overrun');
  assert.equal(step.run.territory?.peak, 5);
});

test('the board chokes: no free cell and no merge is a loss', () => {
  const ctx = setup();
  const distinct = [...MERGE_ITEMS_BY_ID.values()].filter((item) => item.nextItemId).map((item) => item.id);
  const cells = [...ctx.node.state.board];
  let n = 0;
  for (const index of ctx.window.cellIndices) if (!cells[index]!.mist && cells[index]!.occupant?.kind !== 'generator') cells[index] = { ...cells[index]!, occupant: { kind: 'item', instanceId: `fill:${index}`, definitionId: distinct[n++]! } };
  const state = { ...ctx.node.state, board: cells };
  assert.equal(encounterStatus(ctx.encounter, ctx.host, ctx.node.mechanicState, ctx.node.run, state, ctx.window), 'failed');
  assert.equal(lossReason(ctx.encounter, ctx.host, ctx.node.mechanicState, ctx.node.run, state, ctx.window), 'choked');
});

test('stars are the ground won back; Keep going pulls the Mist back, tops up the Pod and caps the level at one star', () => {
  const encounter = level({ mist: [{ cell: 15, type: 'light' }, { cell: 16, type: 'dense' }, { cell: 22, type: 'light' }] });
  const run = createEncounterRun(encounter);
  const held = (last: number) => ({ ...run, territory: { ...run.territory!, last } });
  assert.equal(encounterGrade(encounter, held(5)), 'perfect');
  assert.equal(encounterGrade(encounter, held(9)), 'bright');
  assert.equal(encounterGrade(encounter, held(10)), 'cleared');
  const board = createEncounterState(encounter, 'mossprout', 0);
  const window = encounterWindow(encounter);
  const kept = keepGoing(board, run, window, 5);
  assert.equal(encounterMistLeft(kept.board, window), 1, 'everything but the nest');
  assert.ok(isMist(kept.board, 17));
  assert.equal(kept.board.generators['wild-garden']!.charges, board.generators['wild-garden']!.charges + 2);
  assert.equal(kept.run.resolve.continues, 1);
  assert.equal(encounterGrade(encounter, { ...kept.run, territory: { ...kept.run.territory!, last: 1 } }), 'cleared');
});

test('a ward takes the hit first; a gather surges three unless it is staggered by three damage in time', () => {
  const encounter = level({ wisps: [{ id: 'w', hp: 9, cell: 24, intents: [{ kind: 'ward', every: 1, amount: 2 }, { kind: 'gather', every: 2, amount: 3 }] }] });
  const mechanic = encounter.mechanic as DarkWispsDefinition;
  const window = encounterWindow(encounter);
  const board = createEncounterState(encounter, 'mossprout', 0);
  let state = darkWispsAfterAction(mechanic, createDarkWispsState(mechanic), board, window, rng).state;
  assert.equal(state.ward![0], 2);
  const plant = { type: 'merge_completed' as const, resultCell: 31, resultDefinitionId: 'nature:garden:3' };
  const hit = darkWispsStrike(mechanic, state, plant, undefined, window);
  assert.equal(hit.next.damage[0], 0, 'the ward took it');
  state = hit.next;
  const ignored = darkWispsAfterAction(mechanic, state, board, window, rng);
  assert.equal(ignored.effects.filter((effect) => effect.kind === 'surged').length, 3);
  let hard = darkWispsStrike(mechanic, state, { ...plant, resultDefinitionId: 'nature:garden:4' }, undefined, window).next;
  hard = darkWispsStrike(mechanic, hard, { ...plant, resultDefinitionId: 'nature:garden:2' }, undefined, window).next;
  const staggered = darkWispsAfterAction(mechanic, hard, board, window, rng);
  assert.ok(staggered.effects.some((effect) => effect.kind === 'staggered'));
  assert.ok(!staggered.effects.some((effect) => effect.kind === 'surged'));
});

test('Trailfinder puts a Rest at the front of the strip: the next turn passes quietly', () => {
  const mechanic = mechanicOf({});
  const board = createEncounterState(level(), 'mossprout', 0);
  const pushed = pushBackDarkWisps(mechanic, createDarkWispsState(mechanic));
  assert.deepEqual(pushed.order, [REST, 0]);
  const turn = darkWispsAfterAction(mechanic, pushed, board, encounterWindow(level()), rng);
  assert.deepEqual(turn.effects, [{ kind: 'rested' }]);
});

test('one entry of the strip acts a turn: a boss takes two places, Rests are spaced between, a struck wisp waiting is pushed back once', () => {
  const window = encounterWindow(level());
  const mechanic = mechanicOf({ rest: 1, wisps: [{ id: 'boss', hp: 9, cell: 16, slots: 2, intents: [{ kind: 'ward', every: 1 }] }, { id: 'small', hp: 4, cell: 18, intents: [{ kind: 'surge', every: 1 }] }] });
  const state = createDarkWispsState(mechanic);
  assert.deepEqual(state.order, [0, 1, 0, REST]);
  assert.deepEqual(darkWispsTurnStrip(mechanic, state, 4), [0, 1, 0, REST]);
  const struck = darkWispsStrike(mechanic, state, { type: 'merge_completed', resultCell: 25, resultDefinitionId: 'nature:garden:2' }, undefined, window).next;
  assert.deepEqual(struck.order, [0, 0, 1, REST], 'the small one, waiting, went back a place');
  const again = darkWispsStrike(mechanic, struck, { type: 'merge_completed', resultCell: 25, resultDefinitionId: 'nature:garden:2' }, undefined, window).next;
  assert.deepEqual(again.order, [0, 0, 1, REST], 'once a turn');
  const views = darkWispsViews(mechanic, state);
  assert.equal(views[0]!.acting, true);
  assert.equal(views[1]!.intent?.countdown, 2, 'turns until it acts: its place in the strip');
});

test('the plan is locked: a Plant on a targeted cell holds its ground; a piece moved off a Devour target goes uneaten; felled before its turn, it does not act', () => {
  const window = encounterWindow(level());
  const encounter = level({ pieces: [[16, 3], [18, 3], [24, 3], [36, 1], [37, 1]] });
  const mechanic = encounter.mechanic as DarkWispsDefinition;
  const board = createEncounterState(encounter, 'mossprout', 0);
  const prepared = darkWispsPrepare(mechanic, createDarkWispsState(mechanic), board, window) as DarkWispsState;
  assert.ok(prepared.plan && prepared.plan.cells.length === 1, 'walled in by Plants, it plans to bind one');
  const turn = darkWispsAfterAction(mechanic, prepared, board, window, rng);
  assert.deepEqual(turn.effects, [{ kind: 'held', wisp: 0, cell: prepared.plan.cells[0] }]);

  const hungry = level({ pieces: [[16, 1], [36, 1], [37, 1]], wisps: [{ id: 'nibble', hp: 5, cell: 17, intents: [{ kind: 'devour', every: 1 }] }] });
  const eater = hungry.mechanic as DarkWispsDefinition;
  const start = createEncounterState(hungry, 'mossprout', 0);
  const plan = darkWispsPrepare(eater, createDarkWispsState(eater), start, window) as DarkWispsState;
  assert.equal(plan.plan?.piece?.cell, 16);
  const moved = reduceMissionMove(start, 16, 22, 0, MERGE_ITEMS_BY_ID).state;
  assert.deepEqual(darkWispsAfterAction(eater, plan, moved, window, rng).effects, [], 'it goes hungry');
  const felled = { ...plan, damage: [5] };
  assert.deepEqual(darkWispsAfterAction(eater, felled, start, window, rng).effects, []);
});

test('a bound piece: a pulse frees it, or its twin merged into it frees and merges it on the spot', () => {
  const encounter = level({ bound: [[31, 2]], pieces: [[36, 2], [30, 1], [37, 1]] });
  const window = encounterWindow(encounter);
  const board = createEncounterState(encounter, 'mossprout', 0);
  const caught = board.board[31]!.mist;
  assert.equal(caught?.kind === 'encounter' && caught.type === 'bound', true);
  const freed = harmonyPulse(board, 30, 'nature:garden:2', window);
  assert.equal(freed.board.board[31]!.mist, null);
  assert.equal(freed.board.board[31]!.occupant?.kind === 'item' && freed.board.board[31]!.occupant.definitionId, 'nature:garden:2', 'the piece is loose where it was caught');
  const woke = reduceMissionMove(board, 36, 31, 0, MERGE_ITEMS_BY_ID);
  assert.equal(woke.changed && woke.mergedCell, 31);
  assert.equal(woke.state.board[31]!.occupant?.kind === 'item' && woke.state.board[31]!.occupant.definitionId, 'nature:garden:3');
  assert.equal(reduceMissionMove(board, 37, 31, 0, MERGE_ITEMS_BY_ID).changed, false, 'only its twin');
});

test('a sky wisp floats over a column: struck only from the top row (a Plant reaches the columns beside), shielded while its guards stand; its Rain falls into its column', async () => {
  const { pulseReachesSky } = await import('@/features/encounter/pulse');
  const window = encounterWindow(level());
  assert.deepEqual(pulseReachesSky(17, 2, window), [3]);
  assert.deepEqual(pulseReachesSky(17, 3, window), [2, 3, 4]);
  assert.deepEqual(pulseReachesSky(24, 3, window), [], 'the second row cannot reach it');
  assert.deepEqual(pulseReachesSky(24, 5, window), [3], 'unless tier five or more');
  const encounter = level({ wisps: [{ id: 'guard', hp: 2, cell: 22 }, { id: 'sky', hp: 6, cell: 0, sky: 4, guardedBy: ['guard'], intents: [{ kind: 'rain', every: 1, amount: 2 }] }] });
  const mechanic = encounter.mechanic as DarkWispsDefinition;
  const state = createDarkWispsState(mechanic);
  assert.equal(darkWispsViews(mechanic, state)[1]!.guarded, true);
  assert.equal(darkWispsViews(mechanic, state)[1]!.placement.kind, 'tile', 'drawn over the tile');
  assert.equal(pulseTarget(mechanic, state, 18, 2, window), null, 'shielded');
  const unguarded = { ...state, damage: [2, 0] };
  assert.equal(pulseTarget(mechanic, unguarded, 18, 2, window), 1);
  assert.equal(pulseTarget(mechanic, unguarded, 25, 2, window), null);
  const board = createEncounterState(encounter, 'mossprout', 0);
  const turn = darkWispsAfterAction(mechanic, state, board, window, rng);
  assert.deepEqual(turn.effects, [{ kind: 'rained', wisp: 1, cell: 18 }, { kind: 'rained', wisp: 1, cell: 25 }], 'down its column from the top');
});

test('chains are tools: Water washes light and dense Mist twice as hard, only Growth cuts roots, a weakness hits for one more', async () => {
  const { chainRole } = await import('@/features/encounter/chains');
  assert.equal(chainRole('nature:garden:2'), 'growth');
  assert.equal(chainRole('nature:waterside:2'), 'water');
  const encounter = level({ mist: [{ cell: 31, type: 'dense' }, { cell: 37, type: 'root' }] });
  const window = encounterWindow(encounter);
  const board = createEncounterState(encounter, 'mossprout', 0);
  const washed = harmonyPulse(board, 30, 'nature:waterside:2', window);
  assert.equal(washed.board.board[31]!.mist, null, 'a Shell opens dense Mist in one');
  assert.ok(washed.board.board[37]!.mist, 'but never a root');
  const grown = harmonyPulse(board, 30, 'nature:garden:2', window);
  assert.ok(grown.board.board[31]!.mist, 'a Sprout only wears dense Mist');
  assert.equal(grown.board.board[37]!.mist, null, 'and cuts the root');
  const mechanic = mechanicOf({ wisps: [{ id: 'w', hp: 9, cell: 24, weakTo: 'water' }] });
  const state = createDarkWispsState(mechanic);
  assert.equal(darkWispsStrike(mechanic, state, { type: 'merge_completed', resultCell: 31, resultDefinitionId: 'nature:waterside:2' }, undefined, window).next.damage[0], 2);
  assert.equal(darkWispsStrike(mechanic, state, { type: 'merge_completed', resultCell: 31, resultDefinitionId: 'nature:garden:2' }, undefined, window).next.damage[0], 1);
});

test('a Spring waits under the Mist: clearing its cell places it, and it makes the Water chain', async () => {
  const { ISLAND_CAMPAIGNS } = await import('@/constants/island-campaigns/registry');
  const { regionLadder } = await import('@/constants/island-campaigns/ladder');
  const { ENCOUNTER_ONLY_GENERATORS, MERGE_LOCKED_TIER_ONE_ECHOES } = await import('@/constants/merge-world-catalog');
  const fernip = ISLAND_CAMPAIGNS.find((campaign) => campaign.campaignId.includes('fernip'))!;
  const first = regionLadder(fernip).find((rung) => rung.mission.id.endsWith(':c1-1'))!.mission.encounter;
  const spring = first.spawners.find((spawner) => spawner.generatorId === 'mist-spring')!;
  assert.equal(spring.hidden, true);
  assert.ok(first.mist.some((mist) => mist.cell === spring.cell && mist.holds?.kind === 'spawner'));
  assert.notEqual(createEncounterState(first, 'mossprout', 0).board[spring.cell]!.occupant?.kind, 'generator', 'not there until the Mist is cleared');
  assert.ok(ENCOUNTER_ONLY_GENERATORS.has('mist-spring'));
  assert.ok(!MERGE_LOCKED_TIER_ONE_ECHOES.some((echo) => echo.generatorId === 'mist-spring'), 'never on the player’s own board');
});

test('the wisps’ lines keep the Mist’s voice: no exclamation, the Mist capitalised', async () => {
  const { WISP_ACT_LINES, THREAT_LINE, GATHER_LINE, EXPOSED_LINE, ENCOUNTER_LOSS_V2, INTENT_WORDS } = await import('@/features/encounter/encounter-copy');
  const lines = [...Object.values(WISP_ACT_LINES), ...Object.values(INTENT_WORDS), THREAT_LINE, GATHER_LINE, EXPOSED_LINE, ENCOUNTER_LOSS_V2.overrun.title, ENCOUNTER_LOSS_V2.overrun.body, ENCOUNTER_LOSS_V2.choked.title, ENCOUNTER_LOSS_V2.spent.title, ENCOUNTER_LOSS_V2.keepGoing];
  for (const line of lines) {
    assert.ok(!line.includes('!'), line);
    assert.ok(!/\bmist\b/.test(line), `${line}: the Mist is capitalised`);
  }
});

test('every Dark Wisp wears a look with its cutout on disk; the bosses their own', async () => {
  const { existsSync } = await import('node:fs');
  const { resolve } = await import('node:path');
  const { DARK_WISP_LOOKS, darkWispLook } = await import('@/constants/dark-wisp-looks');
  for (const look of DARK_WISP_LOOKS) assert.ok(existsSync(resolve('../../art/assets/images/katchimeras/cutouts/dark-wisps', `${look}.webp`)), `${look}.webp is generated`);
  assert.equal(darkWispLook({}, 'surge'), 'snuffer');
  assert.equal(darkWispLook({ hidden: true }, 'surge'), 'mistling');
  assert.equal(darkWispLook({}, null), null, 'a plain Mistwisp keeps the corruption wisp');
  const { ISLAND_CAMPAIGNS } = await import('@/constants/island-campaigns/registry');
  const { regionLadder } = await import('@/constants/island-campaigns/ladder');
  const { SLEEPING_GROVE_RUNGS } = await import('@/constants/regions/sleeping-grove');
  const bosses = [...SLEEPING_GROVE_RUNGS.flatMap((rung) => rung.kind === 'encounter' ? [rung.mission] : []), ...ISLAND_CAMPAIGNS.flatMap((campaign) => regionLadder(campaign).map((rung) => rung.mission))]
    .filter((mission) => mission.difficulty === 'boss' && mission.encounter.mechanic?.kind === 'dark-wisps');
  const looks = bosses.map((mission) => {
    const mechanic = mission.encounter.mechanic as DarkWispsDefinition;
    return darkWispsViews(mechanic, createDarkWispsState(mechanic)).find((view) => view.hp === Math.max(...mechanic.wisps.map((wisp) => wisp.hp)))?.look;
  });
  assert.deepEqual(new Set(looks), new Set(['keeper', 'thief', 'overgrowth']));
});
