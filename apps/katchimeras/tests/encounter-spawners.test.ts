import assert from 'node:assert/strict';
import test from 'node:test';

import { encounterMechanicHost } from '@/features/encounter/adapt';
import { cacheEntries, canOpenCache, openCache } from '@/features/encounter/cache';
import { createEncounterState, encounterWindow } from '@/features/encounter/create-state';
import { encounterStatus, resolveLeft } from '@/features/encounter/encounter-run';
import { encounterSolvabilityIssues, solveEncounter } from '@/features/encounter/solvability';
import { validateEncounterDefinition } from '@/features/encounter/validate-encounter';
import { validateMissionDefinition } from '@/features/mission-mechanics/validate';
import { createInitialMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import type { EncounterDefinition } from '@/types/encounter';
import { NOW, SEED, SPROUT, itemAt, makeEncounter, mistAt, move, play, startPlay, tap } from './helpers/encounter';

const POD: EncounterDefinition['spawners'][number] = { id: 'pod', generatorId: 'wild-garden', cell: 40, charges: 2, drops: [SEED], recharge: { kind: 'merges', every: 2, amount: 1 } };

test('a spawner on the board has the charges it was authored with, spends one a tap, and is empty when they are gone', () => {
  const encounter = makeEncounter({ resolve: 10, required: 3, spawners: [POD], seed: { items: [{ cell: 36, definitionId: SEED }], echoes: [], veiled: [] } });
  let game = startPlay(encounter);
  assert.equal(game.state.board[40]?.occupant?.kind, 'generator');
  assert.equal(game.state.generators['wild-garden']?.charges, 2);
  game = play(game, tap('wild-garden'));
  assert.equal(game.last?.status, 'playing');
  assert.equal(game.state.generators['wild-garden']?.charges, 1);
  assert.equal(resolveLeft(game.run), 9, 'a tap costs one Resolve');
  game = play(game, tap('wild-garden'));
  assert.equal(game.state.generators['wild-garden']?.charges, 0);
  const spent = play(game, tap('wild-garden'));
  assert.equal(spent.last, null, 'nothing happens on an empty spawner');
  const refused = reduceMergeWorld(game.state, { type: 'tapGenerator', generatorId: 'wild-garden', now: NOW, seed: 'x', spendEnergy: false, enforceCharges: true });
  assert.equal(refused.failureReason, 'spawner_spent');
  // The same tap without the flag is the world's own policy: unlimited today.
  assert.equal(reduceMergeWorld(game.state, { type: 'tapGenerator', generatorId: 'wild-garden', now: NOW, seed: 'x', spendEnergy: false }).changed, true);
  // Two Seeds dropped beside the authored one: a merge, then a lone Seed beside a Sprout and nothing charged: stuck.
  const seeds = encounterWindow(encounter).cellIndices.filter((cell) => itemAt(game.state, cell) === SEED);
  assert.equal(seeds.length, 3);
  game = play(game, move(seeds[0]!, seeds[1]!));
  assert.equal(game.state.generators['wild-garden']?.charges, 0, 'one merge is not yet a recharge');
  assert.equal(game.last?.status, 'stuck');
});

test('a spawner recharges every so many merges, or when a wisp falls', () => {
  const byMerges = makeEncounter({ resolve: 10, required: 4, spawners: [{ ...POD, charges: 0 }], seed: { items: [{ cell: 36, definitionId: SEED }, { cell: 37, definitionId: SEED }, { cell: 38, definitionId: SEED }, { cell: 39, definitionId: SEED }], echoes: [], veiled: [] } });
  let game = startPlay(byMerges);
  game = play(game, move(36, 37));
  assert.equal(game.state.generators['wild-garden']?.charges, 0);
  game = play(game, move(38, 39));
  assert.equal(game.state.generators['wild-garden']?.charges, 1, 'the second merge brings one back');
  assert.equal(game.run.spawners.pod?.sinceRecharge, 0);
  const byWisp = makeEncounter({ resolve: 10, required: 2, wisps: [{ id: 'a', fx: 0.3, fy: 0.3, size: 0.2 }, { id: 'b', fx: 0.7, fy: 0.3, size: 0.2 }], spawners: [{ ...POD, charges: 0, recharge: { kind: 'wisp', amount: 2 } }], seed: { items: [{ cell: 36, definitionId: SEED }, { cell: 37, definitionId: SEED }, { cell: 38, definitionId: SEED }, { cell: 39, definitionId: SEED }], echoes: [], veiled: [] } });
  game = startPlay(byWisp);
  game = play(game, move(36, 37));
  assert.equal(game.state.generators['wild-garden']?.charges, 2, 'the first wisp fell on the first strike');
});

test('the same attempt draws the same drops; another attempt draws differently', () => {
  const encounter = makeEncounter({ resolve: 10, required: 3, spawners: [{ ...POD, charges: 6, drops: [SEED, SPROUT] }], seed: { items: [], echoes: [], veiled: [] } });
  const drops = (attempt: number) => {
    let game = startPlay(encounter, { attempt });
    const out: string[] = [];
    for (let n = 0; n < 6; n += 1) {
      game = play(game, tap('wild-garden'));
      out.push(itemAt(game.state, game.last!.state.board.findIndex((cell, index) => index === (game.last as { state: { board: unknown[] } }).state.board.length - 1 ? false : false)) ?? '');
    }
    return game.state.board.map((cell) => (cell.occupant?.kind === 'item' ? cell.occupant.definitionId : null)).filter(Boolean).join(',');
  };
  assert.equal(drops(1), drops(1));
  assert.notEqual(drops(1), drops(2));
});

test('Mist that holds a spawner places it when the cell opens; a hidden spawner is under no other cell', () => {
  const encounter = makeEncounter({
    resolve: 10, required: 3,
    seed: { items: [{ cell: 36, definitionId: SEED }, { cell: 37, definitionId: SEED }], echoes: [], veiled: [] },
    mist: [{ cell: 30, type: 'light', holds: { kind: 'spawner', spawnerId: 'pod' } }],
    spawners: [{ ...POD, hidden: true, charges: 3 }],
  });
  let game = startPlay(encounter);
  assert.equal(game.state.board[40]?.occupant, null, 'not placed at the start');
  game = play(game, move(36, 37));
  assert.equal(mistAt(game.state, 30), null);
  assert.deepEqual(game.state.board[30]?.occupant, { kind: 'generator', generatorId: 'wild-garden' });
  assert.equal(game.state.generators['wild-garden']?.charges, 3);
});

test('the cache opens only on a stuck board, once, and brings the request or twins of the highest pieces', () => {
  const encounter = makeEncounter({ resolve: 10, required: 3, seed: { items: [{ cell: 36, definitionId: SEED }, { cell: 37, definitionId: SPROUT }], echoes: [], veiled: [] }, cache: { contents: { kind: 'items', items: [{ definitionId: SEED, quantity: 1 }, { definitionId: SPROUT, quantity: 2 }] }, landOn: [39, 40, 33] } });
  let game = startPlay(encounter);
  const host = encounterMechanicHost(encounter);
  const window = encounterWindow(encounter);
  assert.equal(encounterStatus(encounter, host, game.mechanicState, game.run, game.state, window), 'stuck');
  assert.equal(canOpenCache('stuck', game.run), true);
  assert.equal(canOpenCache('playing', game.run), false);
  assert.deepEqual(cacheEntries(encounter, game.state, window), [{ cell: 39, definitionId: SEED }, { cell: 40, definitionId: SPROUT }, { cell: 33, definitionId: SPROUT }]);
  const opened = openCache(encounter, game.state, window, game.run);
  assert.equal(opened.run.cacheOpened, true);
  assert.equal(canOpenCache('stuck', opened.run), false, 'once');
  game = { ...game, state: opened.board, run: opened.run };
  assert.equal(encounterStatus(encounter, host, game.mechanicState, game.run, game.state, window), 'playing');
  game = play(game, move(36, 39));
  game = play(game, move(39, 37));
  game = play(game, move(40, 33));
  assert.equal(game.last?.status, 'cleared');
  // No cache authored: twins of the two highest loose pieces are the rescue.
  const bare = makeEncounter({ seed: { items: [{ cell: 36, definitionId: SEED }, { cell: 37, definitionId: SPROUT }, { cell: 38, definitionId: 'adventure:trail:1' }], echoes: [], veiled: [] } });
  assert.deepEqual(cacheEntries(bare, createEncounterState(bare, 'mossprout', NOW), window).map((entry) => entry.definitionId).sort(), ['adventure:trail:1', SPROUT].sort());
});

test('the search finds the shortest play and the validator refuses a budget without the safety margin', () => {
  const encounter = makeEncounter({ resolve: 4 });
  const solution = solveEncounter(encounter);
  assert.deepEqual({ minActions: solution.minActions, proven: solution.proven, margin: solution.margin }, { minActions: 2, proven: true, margin: 2 });
  assert.deepEqual(encounterSolvabilityIssues(encounter, solution), []);
  assert.match(encounterSolvabilityIssues(makeEncounter({ resolve: 3 }))[0]!, /Resolve 3 leaves 1 over the shortest play of 2/);
  assert.deepEqual(validateMissionDefinition(encounter as never), [], 'the mission validator hands an encounter to its own check');
  const stuck = makeEncounter({ seed: { items: [{ cell: 36, definitionId: SEED }], echoes: [], veiled: [] } });
  assert.match(encounterSolvabilityIssues(stuck)[0]!, /cannot be finished/);
  // A spawner and a cache are part of the play the search finds.
  const withPod = makeEncounter({ resolve: 6, required: 2, spawners: [{ ...POD, charges: 1 }], seed: { items: [{ cell: 36, definitionId: SEED }, { cell: 38, definitionId: SPROUT }], echoes: [], veiled: [] } });
  assert.equal(solveEncounter(withPod).minActions, 3, 'tap, merge, merge');
});

test('the encounter validator names what is wrong before it searches', () => {
  const bad = makeEncounter({
    mist: [{ cell: 36, type: 'light' }, { cell: 99, type: 'dense' }, { cell: 30, type: 'wisp-bound', wispId: 'nobody' }, { cell: 31, type: 'light', holds: { kind: 'item', definitionId: 'not:a:thing' } }],
    spawners: [{ id: 'a', generatorId: 'wild-garden', cell: 37, charges: 1 }, { id: 'b', generatorId: 'wild-garden', cell: 40, charges: -1 }, { id: 'c', generatorId: 'no-such-maker', cell: 39, charges: 1, hidden: true }],
    cache: { contents: { kind: 'items', items: [{ definitionId: SEED, quantity: 0 }] } },
    objective: { kind: 'dark-wisp', wispId: 'ghost' },
  });
  const issues = validateEncounterDefinition(bad);
  for (const expected of ['cell 36 is on a cell already used', 'cell 99 is outside the board', 'names no wisp', 'not a known item', 'two spawners are the same item maker', 'needs a count of charges', 'not a known item maker', 'is under no Mist', 'the cache asks for 0', 'names wisp ghost']) {
    assert.ok(issues.some((issue) => issue.includes(expected)), `${expected}: ${issues.join(' | ')}`);
  }
  assert.equal(createInitialMergeWorldState(NOW).version, 25);
});
