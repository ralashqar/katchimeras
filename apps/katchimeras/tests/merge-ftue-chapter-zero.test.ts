import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CHAPTER_ZERO_MERGE_STEP_IDS,
  CHAPTER_ZERO_ORDER_ID,
  CHAPTER_ZERO_SERVED_STEP_ID,
  chapterZeroStepsFrom,
  mergeFtueBoardGate,
  mergeFtueRailGate,
  mergeFtueStepForBoard,
  mossproutChapterZeroMergeStep,
  mossproutChapterZeroRepairTarget,
} from '@/features/onboarding/merge-ftue';
import { MOSSPROUT_FTUE_FLOW } from '@/features/onboarding/mossprout-ftue-flow';
import { mossproutFtueStep } from '@/features/onboarding/mossprout-ftue-script';
import type { MergeWorldState } from '@/types/merge-world';
import { createInitialMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { createMossproutChapterZeroState } from '@/utils/merge-world/onboarding';

const NOW = Date.UTC(2026, 8, 9, 12);
const SEED = 'nature:garden:1';
const SPROUT = 'nature:garden:2';

function cellsOf(state: MergeWorldState, definitionId: string) {
  return state.board.flatMap((cell, index) => cell.occupant?.kind === 'item' && cell.occupant.definitionId === definitionId ? [index] : []);
}
function merge(state: MergeWorldState, definitionId: string, now: number) {
  const [from, to] = cellsOf(state, definitionId);
  const result = reduceMergeWorld(state, { type: 'move', from, to, now });
  assert.equal(result.changed, true, `merge ${definitionId}`);
  return result.state;
}
/** Drop items the way a lost buffered write would: the board simply never had them. */
function without(state: MergeWorldState, definitionId: string, count: number): MergeWorldState {
  const remove = new Set(cellsOf(state, definitionId).slice(0, count));
  return { ...state, board: state.board.map((cell, index) => remove.has(index) ? { ...cell, occupant: null } : cell) };
}

test('the request is the only chapter-zero merge beat; the board only decides served or not', () => {
  assert.deepEqual([...CHAPTER_ZERO_MERGE_STEP_IDS], ['merge.serve_sprout']);
  const start = createMossproutChapterZeroState(NOW);
  assert.deepEqual(mossproutChapterZeroMergeStep(start), { stepId: 'merge.serve_sprout', refill: true }, 'no Plant yet');
  const plant = merge(merge(merge(start, SEED, NOW + 1), SEED, NOW + 2), SPROUT, NOW + 3);
  assert.deepEqual(mossproutChapterZeroMergeStep(plant), { stepId: 'merge.serve_sprout', refill: false });
  const served = reduceMergeWorld(plant, { type: 'serveOrder', orderId: CHAPTER_ZERO_ORDER_ID, now: NOW + 4 });
  assert.equal(served.changed, true);
  assert.deepEqual(mossproutChapterZeroMergeStep(served.state), { stepId: CHAPTER_ZERO_SERVED_STEP_ID, refill: false });

  // The board proves the request was served while the checkpoint still waits on it: advance.
  assert.equal(mossproutChapterZeroRepairTarget({ status: 'active', stepId: 'merge.serve_sprout' }, served.state), CHAPTER_ZERO_SERVED_STEP_ID);
  assert.equal(mossproutChapterZeroRepairTarget({ status: 'active', stepId: 'merge.serve_sprout' }, plant), null);
  assert.equal(mossproutChapterZeroRepairTarget({ status: 'active', stepId: 'world.first_bloom_offer' }, served.state), null);
  assert.equal(mossproutChapterZeroRepairTarget({ status: 'complete', stepId: 'merge.serve_sprout' }, served.state), null);
  assert.equal(mossproutChapterZeroRepairTarget({ status: 'active', stepId: 'merge.serve_sprout' }, null), null);
});

test('without a Plant the request points at the next merge in voice, never locking the board', () => {
  const start = createMossproutChapterZeroState(NOW);
  const scripted = mossproutFtueStep('merge.serve_sprout')!;
  assert.equal(scripted.interaction?.mode, 'none');
  assert.equal(mergeFtueRailGate(scripted, start).kind, 'open', 'the rail stays usable even before the Plant exists');

  const fromSeeds = mergeFtueStepForBoard(start, scripted)!;
  assert.equal(fromSeeds.id, 'merge.serve_sprout.refill');
  assert.match(fromSeeds.guide.title, /Seeds/);
  assert.equal(fromSeeds.interaction?.mode, 'none');
  assert.equal(fromSeeds.spotlight, undefined);
  assert.equal(mergeFtueBoardGate(fromSeeds, start).kind, 'open');

  const twoSprouts = merge(merge(start, SEED, NOW + 1), SEED, NOW + 2);
  const fromSprouts = mergeFtueStepForBoard(twoSprouts, scripted)!;
  assert.match(fromSprouts.guide.body, /Sprouts into a Plant/);
  assert.equal(fromSprouts.interaction?.mode, 'none');

  const plant = merge(twoSprouts, SPROUT, NOW + 3);
  assert.equal(mergeFtueStepForBoard(plant, scripted), scripted, 'the authored Serve step returns once the Plant exists');
});

test('a board with nothing left to merge refills from the Basket instead of dead-ending', () => {
  const start = createMossproutChapterZeroState(NOW);
  const oneSeedLeft = without(start, SEED, 3);
  const scripted = mossproutFtueStep('merge.serve_sprout')!;
  const derived = mergeFtueStepForBoard(oneSeedLeft, scripted)!;
  assert.equal(derived.id, 'merge.serve_sprout.refill');
  assert.deepEqual(mergeFtueBoardGate(derived, oneSeedLeft), { kind: 'generator', cell: 31, generatorId: 'wild-garden' });
  const refilled = reduceMergeWorld(oneSeedLeft, { type: 'tapGenerator', generatorId: 'wild-garden', now: NOW + 1, seed: 'refill' });
  assert.equal(refilled.changed, true);
  assert.equal(cellsOf(refilled.state, SEED).length, 2, 'the chapter-zero Basket only makes Seeds');
  assert.equal(mergeFtueBoardGate(mergeFtueStepForBoard(refilled.state, scripted)!, refilled.state).kind, 'open', 'back to free merging once a pair exists');
});

test('chapter-zero derivation stays out of boards that are not the lesson', () => {
  const plain = createInitialMergeWorldState(NOW, ['mossprout']);
  assert.equal(mossproutChapterZeroMergeStep(plain), null);
  assert.equal(mergeFtueStepForBoard(plain, mossproutFtueStep('merge.serve_sprout')), mossproutFtueStep('merge.serve_sprout'));
  assert.equal(mossproutChapterZeroRepairTarget({ status: 'active', stepId: 'merge.serve_sprout' }, plain), null);
});

test('the request precedes its scene in the manifest, and the retired drags migrate onto it', () => {
  assert.deepEqual(chapterZeroStepsFrom('merge.serve_sprout'), ['merge.serve_sprout']);
  assert.deepEqual(chapterZeroStepsFrom('world.first_bloom_offer'), []);
  const order = (id: string) => MOSSPROUT_FTUE_FLOW.nodes.findIndex((node) => node.id === id);
  assert.ok(order('merge.serve_sprout') >= 0 && order('merge.serve_sprout') < order(CHAPTER_ZERO_SERVED_STEP_ID), 'task replay relies on manifest order');
  for (const id of ['merge.seed_drag', 'merge.second_seed_drag', 'merge.first_bloom']) {
    assert.equal(order(id), -1);
    assert.equal((MOSSPROUT_FTUE_FLOW.migrations as Record<string, string>)[id], 'merge.serve_sprout');
  }
});
