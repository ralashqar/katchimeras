import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from './helpers/content-fs';
import type { MergeBoardCell, MergeWorldState } from '@/types/merge-world';
import { createOpeningMissionState } from '@/features/onboarding/opening-mission-state';
import { normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { mergeEffectRetentionMs } from '@/utils/merge-world/board-effects';

const NOW = Date.UTC(2026, 8, 12, 9);
const reload = (state: MergeWorldState) => normalizeMergeWorldState(JSON.parse(JSON.stringify(state)), NOW);

/** A window with a Sock at 36 and 37, a sleeping Sock at 38, and full mist around it hiding sleepers. */
function board(veiledCells: number[], extras: Partial<Record<number, MergeBoardCell>> = {}): MergeWorldState {
  const base = createOpeningMissionState(NOW);
  const cells = base.board.map((cell) => (cell.occupant ? { ...cell, occupant: null } : cell));
  cells[36] = { ...cells[36]!, occupant: { kind: 'item', instanceId: 'sock-a', definitionId: 'adventure:trail:1' } };
  cells[37] = { ...cells[37]!, occupant: { kind: 'item', instanceId: 'sock-b', definitionId: 'adventure:trail:1' } };
  cells[38] = { ...cells[38]!, locked: true, blocker: null, occupant: null, mist: { kind: 'echo', id: 'sleeper', definitionId: 'adventure:trail:1', ownerCharacterId: 'steppling' } };
  for (const cell of veiledCells) {
    cells[cell] = { ...cells[cell]!, locked: true, blocker: null, occupant: null, mist: { kind: 'veiled', echo: { id: `hidden-${cell}`, definitionId: 'adventure:trail:2', ownerCharacterId: 'steppling' } } };
  }
  for (const [index, cell] of Object.entries(extras)) cells[Number(index)] = cell!;
  return { ...base, board: cells, generators: {} };
}

test('waking a sleeper bursts the full mist sharing an edge with it open, into the sleeper it was hiding', () => {
  // 31 sits above 38, 39 beside it, 46 is diagonal (and touches neither sleeper): only the first two burst.
  const state = board([31, 39, 46]);
  const woke = reduceMergeWorld(state, { type: 'move', from: 37, to: 38, now: NOW });
  assert.equal(woke.changed, true, woke.message);
  assert.equal(woke.mergedCell, 38, 'the waking is the merge, and the only strike');
  assert.equal(woke.dreamEchoClearedId, 'sleeper');
  assert.deepEqual(woke.clearedMistCells, [38]);
  assert.deepEqual(woke.revealedMistCells, [31, 39], 'above and beside burst; the diagonal does not');
  for (const cell of [31, 39]) {
    assert.deepEqual(woke.state.board[cell]!.mist, { kind: 'echo', id: `hidden-${cell}`, definitionId: 'adventure:trail:2', ownerCharacterId: 'steppling' }, `${cell} is a sleeper now`);
    assert.equal(woke.state.board[cell]!.locked, true);
    assert.equal(woke.state.board[cell]!.occupant, null);
  }
  assert.equal(woke.state.board[46]!.mist?.kind, 'veiled', 'the diagonal keeps its mist');
  assert.equal((woke.state.board[38]!.occupant as { definitionId: string }).definitionId, 'adventure:trail:2', 'the sleeper woke as the next thing up');
  // The revealed sleeper wakes in turn, and reveals nothing more: there is nothing veiled beside it.
  const next = reduceMergeWorld(woke.state, { type: 'move', from: 38, to: 31, now: NOW + 1 });
  assert.equal(next.changed, true, next.message);
  assert.equal(next.mergedCell, 31);
  assert.equal(next.revealedMistCells, undefined);
  assert.equal(next.state.board[46]!.mist?.kind, 'veiled');
  assert.equal((next.state.board[31]!.occupant as { definitionId: string }).definitionId, 'adventure:trail:3');
});

test('a veiled cell cannot be dropped on, and an ordinary merge next to it reveals nothing', () => {
  const state = board([31]);
  const dropped = reduceMergeWorld(state, { type: 'move', from: 36, to: 31, now: NOW });
  assert.equal(dropped.changed, false);
  assert.equal(dropped.failureReason, 'locked_cell');
  const merged = reduceMergeWorld(state, { type: 'move', from: 36, to: 37, now: NOW });
  assert.equal(merged.changed, true, merged.message);
  assert.equal(merged.revealedMistCells, undefined, 'only a waking sleeper lets the mist beside it go');
  assert.equal(merged.state.board[31]!.mist?.kind, 'veiled');
});

test('veiled cells survive a reload; an unknown owner or item decays to plain mist', () => {
  const state = reload(board([31, 24]));
  assert.deepEqual(state.board[31]!.mist, { kind: 'veiled', echo: { id: 'hidden-31', definitionId: 'adventure:trail:2', ownerCharacterId: 'steppling' } });
  assert.equal(state.board[31]!.locked, true);
  const stale = board([31]);
  stale.board[31] = { ...stale.board[31]!, mist: { kind: 'veiled', echo: { id: 'x', definitionId: 'adventure:trail:2', ownerCharacterId: 'nobody' as never } } };
  assert.equal(reload(stale).board[31]!.mist?.kind, 'dormant', 'no owner: full mist, nothing hidden');
  const woke = reduceMergeWorld(state, { type: 'move', from: 37, to: 38, now: NOW });
  assert.deepEqual(reload(woke.state).board[31]!.mist, woke.state.board[31]!.mist, 'a revealed sleeper is an ordinary echo on reload');
});

test('the burst is a board effect of its own, shown a beat after the waking and never counted', () => {
  assert.equal(mergeEffectRetentionMs('mist-burst', false), 620);
  const board = readFileSync('components/katchadeck/games/feastle-persistent-merge-board.tsx', 'utf8');
  assert.match(board, /\(predicted\.revealedMistCells \?\? \[\]\)\.forEach\(\(cell, index\) => \{\s*timers\.schedule\(\(\) => emitBoardEffect\(cell, 'mist-burst'\), reduceMotion \? 0 : 140 \+ index \* 90\);/, 'cause, then effect, one cell at a time');
  assert.match(board, /cell\.mist\?\.kind === 'veiled' \? 'Thick mist\. Wake the sleeping cell beside it and it lets go\.'/);
  const effects = readFileSync('components/katchadeck/games/merge-spawn-effects-layer.tsx', 'utf8');
  assert.match(effects, /kind === 'mist-burst' \? '#E4EEF6'/, 'the burst is the mist’s own colour');
  assert.doesNotMatch(effects, /boxShadow|BlurMask/, 'no shadows on the burst');
  const store = readFileSync('features/onboarding/use-opening-mission-board.ts', 'utf8');
  assert.match(store, /const merged = command\.type === 'move' && result\.mergedCell != null;/, 'a reveal has no mergedCell of its own: only the waking counts');
});
