import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CHAPTER_ZERO_MERGE_STEP_IDS,
  CHAPTER_ZERO_ORDER_ID,
  CHAPTER_ZERO_SERVED_STEP_ID,
  chapterZeroStepsFrom,
  mergeFtueBoardGate,
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

test('the board decides every chapter-zero beat, forwards and backwards', () => {
  const start = createMossproutChapterZeroState(NOW);
  assert.deepEqual(mossproutChapterZeroMergeStep(start), { stepId: 'merge.seed_drag', refill: false });
  const oneSprout = merge(start, SEED, NOW + 1);
  assert.deepEqual(mossproutChapterZeroMergeStep(oneSprout), { stepId: 'merge.second_seed_drag', refill: false });
  const twoSprouts = merge(oneSprout, SEED, NOW + 2);
  assert.deepEqual(mossproutChapterZeroMergeStep(twoSprouts), { stepId: 'merge.first_bloom', refill: false });
  const plant = merge(twoSprouts, SPROUT, NOW + 3);
  assert.deepEqual(mossproutChapterZeroMergeStep(plant), { stepId: 'merge.serve_sprout', refill: false });
  const served = reduceMergeWorld(plant, { type: 'serveOrder', orderId: CHAPTER_ZERO_ORDER_ID, now: NOW + 4 });
  assert.equal(served.changed, true);
  assert.deepEqual(mossproutChapterZeroMergeStep(served.state), { stepId: CHAPTER_ZERO_SERVED_STEP_ID, refill: false });

  // The checkpoint ran ahead of a lost board write: rewind to what is playable.
  assert.equal(mossproutChapterZeroRepairTarget({ status: 'active', stepId: 'merge.first_bloom' }, start), 'merge.seed_drag');
  assert.equal(mossproutChapterZeroRepairTarget({ status: 'active', stepId: 'merge.serve_sprout' }, oneSprout), 'merge.second_seed_drag');
  // The board ran ahead of the checkpoint: advance to what it already proves.
  assert.equal(mossproutChapterZeroRepairTarget({ status: 'active', stepId: 'merge.seed_drag' }, twoSprouts), 'merge.first_bloom');
  assert.equal(mossproutChapterZeroRepairTarget({ status: 'active', stepId: 'merge.serve_sprout' }, served.state), CHAPTER_ZERO_SERVED_STEP_ID);
  // In step: nothing to repair. Outside chapter zero: never touched.
  assert.equal(mossproutChapterZeroRepairTarget({ status: 'active', stepId: 'merge.second_seed_drag' }, oneSprout), null);
  assert.equal(mossproutChapterZeroRepairTarget({ status: 'active', stepId: 'world.first_bloom_offer' }, served.state), null);
  assert.equal(mossproutChapterZeroRepairTarget({ status: 'complete', stepId: 'merge.seed_drag' }, twoSprouts), null);
  assert.equal(mossproutChapterZeroRepairTarget({ status: 'active', stepId: 'merge.seed_drag' }, null), null);
});

test('a board that lost its Seeds refills from the Basket instead of locking every gesture', () => {
  const start = createMossproutChapterZeroState(NOW);
  const oneSeedLeft = without(start, SEED, 3);
  assert.deepEqual(mossproutChapterZeroMergeStep(oneSeedLeft), { stepId: 'merge.seed_drag', refill: true });
  const scripted = mossproutFtueStep('merge.seed_drag')!;
  assert.equal(mergeFtueBoardGate(scripted, oneSeedLeft).kind, 'locked', 'the authored drag has no second Seed to target');
  const derived = mergeFtueStepForBoard(oneSeedLeft, scripted)!;
  assert.equal(derived.id, 'merge.seed_drag.refill');
  assert.deepEqual(mergeFtueBoardGate(derived, oneSeedLeft), { kind: 'generator', cell: 31, generatorId: 'wild-garden' });
  const refilled = reduceMergeWorld(oneSeedLeft, { type: 'tapGenerator', generatorId: 'wild-garden', now: NOW + 1, seed: 'refill' });
  assert.equal(refilled.changed, true);
  assert.equal(cellsOf(refilled.state, SEED).length, 2, 'the chapter-zero Basket only makes Seeds');
  assert.equal(mergeFtueStepForBoard(refilled.state, scripted), scripted, 'the authored drag resumes once both Seeds exist');

  const sproutAndOneSeed = without(merge(start, SEED, NOW + 2), SEED, 1);
  assert.deepEqual(mossproutChapterZeroMergeStep(sproutAndOneSeed), { stepId: 'merge.second_seed_drag', refill: true });
  assert.equal(mergeFtueStepForBoard(sproutAndOneSeed, mossproutFtueStep('merge.second_seed_drag'))!.id, 'merge.second_seed_drag.refill');
  // A different authored step still projects the board's beat, so the finger, spotlight and gate agree with what is playable.
  assert.equal(mergeFtueStepForBoard(merge(start, SEED, NOW + 3), scripted)!.id, 'merge.second_seed_drag');
});

test('chapter-zero derivation stays out of boards that are not the lesson', () => {
  const plain = createInitialMergeWorldState(NOW, ['mossprout']);
  assert.equal(mossproutChapterZeroMergeStep(plain), null);
  assert.equal(mergeFtueStepForBoard(plain, mossproutFtueStep('merge.seed_drag')), mossproutFtueStep('merge.seed_drag'));
  assert.equal(mossproutChapterZeroRepairTarget({ status: 'active', stepId: 'merge.seed_drag' }, plain), null);
});

test('rewinding clears the beats the player will replay, and the manifest keeps them in play order', () => {
  assert.deepEqual(chapterZeroStepsFrom('merge.second_seed_drag'), ['merge.second_seed_drag', 'merge.first_bloom', 'merge.serve_sprout']);
  assert.deepEqual(chapterZeroStepsFrom('world.first_bloom_offer'), []);
  const order = (id: string) => MOSSPROUT_FTUE_FLOW.nodes.findIndex((node) => node.id === id);
  const indices = [...CHAPTER_ZERO_MERGE_STEP_IDS, CHAPTER_ZERO_SERVED_STEP_ID].map(order);
  assert.ok(indices.every((index) => index >= 0));
  assert.deepEqual([...indices].sort((a, b) => a - b), indices, 'task replay relies on manifest order');
});
