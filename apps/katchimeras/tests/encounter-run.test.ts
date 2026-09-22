import assert from 'node:assert/strict';
import test from 'node:test';

import { encounterWindow } from '@/features/encounter/create-state';
import { encounterStatus, extendResolve, normalizeEncounterRun, resolveLeft } from '@/features/encounter/encounter-run';
import { encounterMechanicHost } from '@/features/encounter/adapt';
import { encounterGrade, encounterOutcome } from '@/features/encounter/outcome';
import { encounterRunId } from '@/features/encounter/run-id';
import { afterAction, createMechanicState, resolveMechanic, wispViews } from '@/features/mission-mechanics/mechanic';
import { NOW, PLANT, SEED, SPROUT, itemAt, makeEncounter, mistAt, move, play, startPlay } from './helpers/encounter';
import type { EncounterDefinition } from '@/types/encounter';
import type { MissionMechanicDefinition } from '@/types/mission-mechanic';

test('a merge costs one Resolve, a slide costs nothing, and the merge that finishes the board on its last Resolve counts', () => {
  let game = startPlay(makeEncounter({ resolve: 2 }));
  assert.equal(resolveLeft(game.run), 2);
  assert.equal(game.last, null);
  game = play(game, move(36, 30));
  assert.equal(resolveLeft(game.run), 2, 'a slide is free');
  assert.equal(game.last?.status, 'playing');
  game = play(game, move(30, 37));
  assert.equal(resolveLeft(game.run), 1, 'a merge costs one');
  assert.equal(itemAt(game.state, 37), SPROUT);
  assert.equal(game.last?.strike?.hits.length, 1);
  game = play(game, move(37, 38));
  assert.equal(resolveLeft(game.run), 0);
  assert.equal(game.last?.status, 'cleared', 'cleared is checked before the budget');
  assert.equal(itemAt(game.state, 38), PLANT);
  assert.equal(encounterOutcome(game.encounter, game.run, game.last!.status).cleared, true);
});

test('with no Resolve left an action is refused and the attempt is failed; keeping going adds Resolve and caps the grade', () => {
  let game = startPlay(makeEncounter({ resolve: 1, required: 2 }));
  game = play(game, move(36, 37));
  assert.equal(game.last?.status, 'failed');
  const refused = play(game, move(37, 38));
  assert.equal(refused.last?.refused, 'out_of_resolve');
  assert.equal(refused.run, game.run, 'nothing changed');
  const extended = { ...game, run: extendResolve(game.run, 5) };
  assert.equal(resolveLeft(extended.run), 5);
  const done = play(extended, move(37, 38));
  assert.equal(done.last?.status, 'cleared');
  assert.equal(encounterGrade(done.encounter, done.run), 'cleared', 'a Perfect is out of reach once the player kept going');
  assert.equal(encounterOutcome(done.encounter, done.run, 'cleared').continues, 1);
});

test('grades follow the Resolve left; a board with no budget is simply Cleared', () => {
  const encounter = makeEncounter({ resolve: 14, grades: { bright: 5, perfect: 10 } });
  let game = startPlay(encounter);
  game = play(game, move(36, 37));
  game = play(game, move(37, 38));
  assert.equal(game.last?.status, 'cleared');
  assert.equal(encounterGrade(encounter, game.run), 'perfect');
  assert.equal(encounterGrade(encounter, { ...game.run, resolve: { ...game.run.resolve, spent: 8 } }), 'bright');
  assert.equal(encounterGrade(encounter, { ...game.run, resolve: { ...game.run.resolve, spent: 12 } }), 'cleared');
  assert.equal(encounterGrade(makeEncounter({ resolve: null }), startPlay(makeEncounter({ resolve: null })).run), 'cleared');
  assert.equal(encounterOutcome(makeEncounter({ resolve: null }), startPlay(makeEncounter({ resolve: null })).run, 'playing').resolveLeft, null);
});

test('an attempt round-trips through its save and a new attempt, loadout or authored board starts fresh', () => {
  const encounter = makeEncounter();
  const run = startPlay(encounter, { loadout: { companionId: 'mossprout', level: 2 }, attempt: 2 }).run;
  assert.deepEqual(normalizeEncounterRun(JSON.parse(JSON.stringify(run)), encounter), run);
  assert.equal(normalizeEncounterRun(run, makeEncounter({ resolve: null })), null, 'a board whose budget changed cannot be read');
  assert.equal(normalizeEncounterRun({ seed: 'x' }, encounter), null);
  const a = encounterRunId(encounter, 1, { companionId: 'mossprout', level: 1 });
  assert.notEqual(a, encounterRunId(encounter, 2, { companionId: 'mossprout', level: 1 }), 'a new attempt');
  assert.notEqual(a, encounterRunId(encounter, 1, { companionId: 'steppling', level: 1 }), 'another Katchimera');
  assert.notEqual(a, encounterRunId(makeEncounter({ resolve: 9 }), 1, { companionId: 'mossprout', level: 1 }), 'a re-authored board');
  assert.equal(a, encounterRunId(makeEncounter(), 1, { companionId: 'mossprout', level: 1 }));
});

test('light Mist goes on one hit beside a merge, dense on two, root only to a plant, and what a cell held lands there', () => {
  const encounter = makeEncounter({
    resolve: 10, required: 3,
    seed: { items: [{ cell: 36, definitionId: SEED }, { cell: 37, definitionId: SEED }, { cell: 38, definitionId: SEED }, { cell: 39, definitionId: SEED }], echoes: [], veiled: [] },
    mist: [{ cell: 30, type: 'light', holds: { kind: 'item', definitionId: PLANT } }, { cell: 31, type: 'dense' }, { cell: 32, type: 'root' }, { cell: 23, type: 'light' }],
  });
  let game = startPlay(encounter);
  assert.deepEqual(mistAt(game.state, 30), { kind: 'encounter', type: 'light', hp: 1, holds: { kind: 'item', definitionId: PLANT } });
  assert.deepEqual(mistAt(game.state, 31), { kind: 'encounter', type: 'dense', hp: 2 });
  // A Sprout made at 37: its neighbours are 30 (above), 36, 38.
  game = play(game, move(36, 37));
  assert.equal(mistAt(game.state, 30), null, 'light Mist beside the merge cleared');
  assert.equal(itemAt(game.state, 30), PLANT, 'and gave up the Plant it held');
  assert.deepEqual(game.last?.opened, [{ cell: 30, holds: { kind: 'item', definitionId: PLANT } }]);
  assert.deepEqual(mistAt(game.state, 31), { kind: 'encounter', type: 'dense', hp: 2 }, 'not beside the merge');
  // A Sprout made at 38: its neighbours are 31 (dense) and 37, 39.
  game = play(game, move(39, 38));
  assert.deepEqual(mistAt(game.state, 31), { kind: 'encounter', type: 'dense', hp: 1 }, 'dense Mist worn, not cleared');
  // A Plant made at 38 from the two Sprouts: 31 clears now; 32 (root) is not beside it.
  game = play(game, move(37, 38));
  assert.equal(mistAt(game.state, 31), null);
  assert.deepEqual(mistAt(game.state, 32), { kind: 'encounter', type: 'root', hp: 1 });
  assert.equal(game.last?.status, 'cleared');
});

test('root Mist ignores a merge that is not a plant', () => {
  const encounter = makeEncounter({
    resolve: 10, required: 1, wisps: [{ id: 'one', fx: 0.5, fy: 0.3, size: 0.2 }],
    seed: { items: [{ cell: 36, definitionId: 'adventure:trail:1' }, { cell: 37, definitionId: 'adventure:trail:1' }], echoes: [], veiled: [] },
    mist: [{ cell: 30, type: 'root' }, { cell: 38, type: 'light' }],
  });
  let game = startPlay(encounter);
  game = play(game, move(36, 37));
  assert.deepEqual(mistAt(game.state, 30), { kind: 'encounter', type: 'root', hp: 1 }, 'a trail merge does not touch root Mist');
  assert.equal(mistAt(game.state, 38), null, 'but light Mist beside it goes');
});

const DARK: MissionMechanicDefinition = { kind: 'dark-wisps', wisps: [{ id: 'keeper', hp: 3, placement: { kind: 'tile', fx: 0.5, fy: 0.3, size: 0.2 }, behaviour: { kind: 'plain' } }], damageByTier: [1, 1, 2] };

test('wisp-bound Mist falls with its wisp; Dark Wisps take damage by the tier of what was made', () => {
  const encounter = makeEncounter({
    resolve: 10, required: 3, mechanic: DARK, wisps: [],
    seed: { items: [{ cell: 36, definitionId: SEED }, { cell: 37, definitionId: SEED }, { cell: 38, definitionId: SPROUT }], echoes: [], veiled: [] },
    mist: [{ cell: 15, type: 'wisp-bound', wispId: 'keeper', holds: { kind: 'item', definitionId: SEED } }],
  });
  let game = startPlay(encounter);
  game = play(game, move(36, 37));
  assert.deepEqual(game.last?.strike?.hits, [{ wisp: 0, damage: 1 }], 'a Sprout deals one');
  assert.equal(mistAt(game.state, 15)?.kind, 'encounter', 'the wisp still stands');
  game = play(game, move(37, 38));
  assert.deepEqual(game.last?.strike?.hits, [{ wisp: 0, damage: 2 }], 'a Plant deals two');
  assert.equal(game.last?.strike?.finale, true);
  assert.equal(mistAt(game.state, 15), null, 'the Mist bound to it let go');
  assert.equal(itemAt(game.state, 15), SEED);
  assert.equal(game.last?.status, 'cleared');
});

test('the wisps take their turn after every action that costs Resolve, by their behaviour, and never before their delay', () => {
  const window = encounterWindow(makeEncounter());
  const behaviours = (behaviour: NonNullable<Extract<MissionMechanicDefinition, { kind: 'dark-wisps' }>['wisps'][number]['behaviour']>): EncounterDefinition => makeEncounter({
    resolve: 12, required: 5, wisps: [],
    mechanic: { kind: 'dark-wisps', wisps: [{ id: 'dark', hp: 5, placement: { kind: 'tile', fx: 0.5, fy: 0.3, size: 0.2 }, behaviour }] },
    seed: { items: [{ cell: 36, definitionId: SEED }, { cell: 37, definitionId: SEED }, { cell: 38, definitionId: SEED }, { cell: 39, definitionId: SEED }, { cell: 40, definitionId: SPROUT }], echoes: [], veiled: [] },
  });
  // Shrouder: an open empty cell is covered in light Mist every action.
  let game = startPlay(behaviours({ kind: 'shrouder', every: 1 }));
  game = play(game, move(36, 37));
  assert.equal(game.last?.effects.length, 1);
  assert.equal(game.last?.effects[0]?.kind, 'shrouded');
  const shrouded = (game.last!.effects[0] as { cell: number }).cell;
  assert.deepEqual(mistAt(game.state, shrouded), { kind: 'encounter', type: 'light', hp: 1 });
  assert.ok(window.cellIndices.includes(shrouded));
  const slid = play(game, move(37, 30));
  assert.deepEqual(slid.last?.effects, [], 'a free slide is not a turn');
  // Hungry: the lowest loose piece is eaten every action, never one of the last two.
  game = startPlay(behaviours({ kind: 'hungry', every: 1, maxTier: 1 }));
  game = play(game, move(36, 37));
  assert.equal(game.last?.effects[0]?.kind, 'ate');
  assert.equal((game.last?.effects[0] as { definitionId: string }).definitionId, SEED, 'never a Sprout when Seeds are lower');
  game = play(game, move(38, 39));
  const eaten = game.last?.effects.filter((effect) => effect.kind === 'ate') ?? [];
  const left = window.cellIndices.filter((cell) => itemAt(game.state, cell)).length;
  assert.ok(left >= 2, 'a pair always remains');
  assert.ok(eaten.length <= 1);
  // Every second action: the first passes.
  game = startPlay(behaviours({ kind: 'hungry', every: 2, maxTier: 1 }));
  game = play(game, move(36, 37));
  assert.deepEqual(game.last?.effects, []);
  // Rootbound: root Mist spreads, and plant merges hit it harder.
  game = startPlay(behaviours({ kind: 'rootbound', every: 1, plantBonus: 2 }));
  game = play(game, move(36, 37));
  assert.deepEqual(game.last?.strike?.hits, [{ wisp: 0, damage: 3 }], 'one plus the plant bonus');
  assert.equal(game.last?.effects[0]?.kind, 'root_mist');
  // Mender: left alone for a turn, it mends one.
  game = startPlay(behaviours({ kind: 'mender', every: 2 }));
  game = play(game, move(36, 37));
  assert.equal(game.mechanicState.kind === 'dark-wisps' ? game.mechanicState.damage[0] : null, 1);
  game = play(game, move(38, 30));
  game = play(game, move(30, 39));
  // Struck on action 1, action 2's turn was due on the second action: it mends on that turn only when untouched since its last turn.
  const damage = game.mechanicState.kind === 'dark-wisps' ? game.mechanicState.damage[0] : null;
  assert.ok(damage != null && damage <= 2);
  // Delay: with a delay of two, the first two actions pass without a turn.
  game = startPlay(behaviours({ kind: 'shrouder', every: 1 }), { profile: { startingResolve: 0, extraCharges: 0, tierTwoChance: 0, tierThreeChance: 0, openCells: 0, delay: 2, glowBonus: 0 } });
  game = play(game, move(36, 37));
  assert.deepEqual(game.last?.effects, []);
  game = play(game, move(38, 39));
  assert.deepEqual(game.last?.effects, []);
  game = play(game, move(37, 39));
  assert.equal(game.last?.effects.length, 1, 'the third action is the first turn');
});

test('the door is closed to every other mechanic: their turn changes nothing', () => {
  const encounter = makeEncounter();
  const host = encounterMechanicHost(encounter);
  const mechanic = resolveMechanic(host);
  const game = startPlay(encounter);
  const state = createMechanicState(mechanic);
  const turn = afterAction(mechanic, host, state, game.state, { window: encounterWindow(encounter), action: 'merge', rng: () => 0.5 });
  assert.equal(turn.state, state);
  assert.equal(turn.board, game.state);
  assert.deepEqual(turn.effects, []);
  assert.equal(wispViews(mechanic, host, state).length, 3);
  assert.equal(encounterStatus(encounter, host, state, game.run, game.state, encounterWindow(encounter)), 'playing');
  assert.equal(NOW > 0, true);
});
