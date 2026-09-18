import assert from 'node:assert/strict';
import test from 'node:test';
import { createMossproutBasketParcelState, createMossproutOpeningState } from '@/utils/merge-world/onboarding';
import { reduceMergeWorld, normalizeMergeWorldState } from '@/utils/merge-world/engine';
import { glowDiscoveryBoardStep, glowDiscoveryLessonReady } from '@/features/onboarding/glow-discovery-flow';
import { MOSSPROUT_BASKET_ARRIVAL_ID, GLOW_ORDER_IDS } from '@/utils/merge-world/glow-discovery-policy';
import { openingMistBoardStep, OPENING_MERGE_REQUIRED } from '@/features/onboarding/opening-mist';
import { nextLessonMerge } from '@/features/content-flow/merge-lesson-recipe';
import { mergeFtueAllowsCommand } from '@/features/onboarding/merge-ftue';
import { mergeFtueDisplayGuide } from '@/features/onboarding/merge-ftue-guidance';
import { MOSSPROUT_BOND_SHARE_PROMPTS, MOSSPROUT_SUPPORT_PROMPT, MOSSPROUT_SUPPORT_STYLE_OPTIONS, mossproutSupportCallback, mossproutFirstSeedForIntent } from '@/features/onboarding/mossprout-bond-share';
import { MOSSPROUT_GARDEN_RETURN, MOSSPROUT_FIRST_NOTICE } from '@/features/onboarding/mossprout-first-grow';
import { MOSSPROUT_FTUE_SCRIPT } from '@/features/onboarding/mossprout-ftue-script';
import type { MergeWorldCommand, MergeWorldState } from '@/types/merge-world';

const NOW = Date.parse('2026-09-18T12:00:00Z');
function apply(state: MergeWorldState, command: MergeWorldCommand) {
  const result = reduceMergeWorld(state, command);
  assert.ok(result.changed, result.message);
  return normalizeMergeWorldState(JSON.parse(JSON.stringify(result.state)), NOW);
}
test('the opening has a working finger for every merge, only the first spotlight, and no guide after completion', () => {
  let state = createMossproutOpeningState(NOW);
  const authored = { id: 'world.mist_clear', surface: 'haven' as const, actions: [], guide: { title: 'Clear the Mist', body: '', eyebrow: '' } };
  for (let count = 0; count < OPENING_MERGE_REQUIRED; count++) {
    const step = openingMistBoardStep(authored, state, count)!;
    assert.equal(step.cue?.kind, 'drag');
    assert.equal(Boolean(step.spotlight), count === 0);
    assert.equal(step.interaction?.mode, count < 2 ? 'exclusive' : 'none');
    const cue = step.cue!;
    assert.ok(cue.kind === 'drag' && cue.from.kind === 'board_cell' && cue.to.kind === 'board_cell');
    const command = { type: 'move' as const, from: cue.from.cell, to: cue.to.cell, now: NOW };
    assert.ok(mergeFtueAllowsCommand(step, state, command));
    state = apply(state, command);
  }
  assert.equal(openingMistBoardStep(authored, state, OPENING_MERGE_REQUIRED)?.cue, undefined);
});
test('the real parcel lesson needs just two spawns, then wakes the existing Sprout and serves its Plant', () => {
  let state = apply(createMossproutBasketParcelState(NOW), { type: 'prepareGlowDiscoveryLesson', now: NOW });
  state = apply(state, { type: 'claimArrival', arrivalId: MOSSPROUT_BASKET_ARRIVAL_ID, now: NOW });
  for (let n = 0; n < 2; n++) {
    assert.equal(Boolean(glowDiscoveryBoardStep('lesson.single.spawn', state)?.spotlight), n === 0);
    state = apply(state, { type: 'tapGenerator', generatorId: 'wild-garden', spendEnergy: false, seed: 'test', now: NOW });
    assert.equal(glowDiscoveryLessonReady('lesson.single.spawn', state), n === 1);
  }
  let move = nextLessonMerge(state.board, 'nature:garden:3')!;
  assert.equal(move.echo, false);
  state = apply(state, { type: 'move', from: move.from, to: move.to, now: NOW });
  move = nextLessonMerge(state.board, 'nature:garden:3')!;
  assert.equal(move.echo, true);
  assert.equal(state.board[move.to].mist?.kind, 'echo');
  const hint = glowDiscoveryBoardStep('lesson.single.grow', state)!;
  assert.deepEqual(hint.cue, { kind: 'drag', from: { kind: 'board_cell', cell: move.from }, to: { kind: 'board_cell', cell: move.to } });
  assert.equal(hint.spotlight, undefined);
  assert.match(mergeFtueDisplayGuide(hint)!.title, /Sprout.*Mist/);
  const command = { type: 'move' as const, from: move.from, to: move.to, now: NOW };
  assert.ok(mergeFtueAllowsCommand(hint, state, command));
  state = apply(state, command);
  assert.ok(glowDiscoveryLessonReady('lesson.single.grow', state));
  state = apply(state, { type: 'serveOrder', orderId: GLOW_ORDER_IDS[1], now: NOW });
  assert.ok(glowDiscoveryLessonReady('lesson.single.serve', state));
});
test('guidance ignores unrelated pairs and falls back when the sleeping Sprout was already used', () => {
  let state = createMossproutBasketParcelState(NOW);
  state.board = state.board.map(cell => ({ ...cell, occupant: null, mist: null, locked: false, blocker: null }));
  state.board[0].occupant = { kind: 'item', instanceId: 'food1', definitionId: 'food:table:1' };
  state.board[1].occupant = { kind: 'item', instanceId: 'food2', definitionId: 'food:table:1' };
  assert.equal(nextLessonMerge(state.board, 'nature:garden:3'), null);
  for (const cell of [2, 3]) state.board[cell].occupant = { kind: 'item', instanceId: `sprout:${cell}`, definitionId: 'nature:garden:2' };
  assert.deepEqual(nextLessonMerge(state.board, 'nature:garden:3'), { from: 2, to: 3, echo: false });
});
test('narrative preferences keep save identities and seeds; graph and overlay share the same support choices', () => {
  assert.deepEqual(MOSSPROUT_BOND_SHARE_PROMPTS[0].options.map(o => o.id), ['progress', 'calm', 'feel_like_myself']);
  assert.deepEqual(['progress', 'calm', 'feel_like_myself'].map(id => mossproutFirstSeedForIntent(id).id), ['momentum', 'stillness', 'renewal']);
  assert.deepEqual(MOSSPROUT_GARDEN_RETURN.choices.map(o => o.id), ['pleased', 'together', 'next']);
  assert.deepEqual(MOSSPROUT_FIRST_NOTICE.choices.map(o => o.id), ['light', 'sound', 'growing']);
  const support = MOSSPROUT_FTUE_SCRIPT.steps.flatMap(step => step.actions).find(action => action.id === 'companion.choose_support_style')!;
  assert.equal(support.title, MOSSPROUT_SUPPORT_PROMPT);
  assert.deepEqual(support.options, MOSSPROUT_SUPPORT_STYLE_OPTIONS.map(({ id, label, icon }) => ({ id, label, icon })));
  for (const option of MOSSPROUT_SUPPORT_STYLE_OPTIONS) assert.ok(mossproutSupportCallback(option.id));
  assert.equal(mossproutSupportCallback(null), '');
});
