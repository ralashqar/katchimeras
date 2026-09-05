import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialMergeWorldState, normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { STEPPLING_GARDEN_FLOW, STEPPLING_PARCEL_ID, STEPPLING_SHOE_ORDER_ID, stepplingGardenBoardStep, stepplingGardenCheckpoint, stepplingGardenDrop } from '@/features/onboarding/steppling-garden-lesson';
import { validateContentFlowDefinition } from '@/features/content-flow/content-flow-compiler';
import { registerContentFlowDefinition } from '@/features/content-flow/content-flow-catalog';
import { createContentFlowRun, reduceContentFlow } from '@/features/content-flow/content-flow-interpreter';
import { mergeFtueAllowsCommand } from '@/features/onboarding/merge-ftue';
import type { MergeWorldCommand, MergeWorldState } from '@/types/merge-world';
import { loadNativeModule } from './helpers/native-motion-harness';
import type { ContentFlowRun } from '@/types/content-flow';

const NOW = Date.UTC(2026, 8, 5, 12);
function fresh() {
  const state = createInitialMergeWorldState(NOW);
  const generators = { ...state.generators }; delete generators['journey-locker'];
  return { ...state, board: state.board.map((cell) => ({ ...cell, locked: false, mist: null, occupant: null })), generators, activeOrders: [],
    companionDiscovery: { ...state.companionDiscovery, active: null, records: [] } } as MergeWorldState;
}
function apply(state: MergeWorldState, command: MergeWorldCommand) {
  const result = reduceMergeWorld(state, command);
  assert.ok(result.changed, `${command.type}: ${result.message}`);
  return normalizeMergeWorldState(JSON.parse(JSON.stringify(result.state)), NOW);
}
function prepared() {
  let state = apply(fresh(), { type: 'grantGeneratorParcel', generatorId: 'journey-locker', rewardId: STEPPLING_PARCEL_ID, dayId: '2026-09-05', now: NOW });
  state = apply(state, { type: 'prepareStepplingGardenLesson', now: NOW });
  return state;
}
test('Steppling lesson registers and every authored task and finale action is valid', () => {
  assert.deepEqual(validateContentFlowDefinition(STEPPLING_GARDEN_FLOW), []);
  assert.doesNotThrow(() => registerContentFlowDefinition(STEPPLING_GARDEN_FLOW));
  let run = createContentFlowRun(STEPPLING_GARDEN_FLOW, { runId: 'lesson-test', now: NOW });
  for (const id of ['parcel', 'spawn.first', 'spawn.second', 'merge', 'serve']) {
    assert.equal(run.nodeId, id);
    run = reduceContentFlow(STEPPLING_GARDEN_FLOW, JSON.parse(JSON.stringify(run)), { type: 'record_event', event: {
      eventId: id, runId: run.runId, nodeId: id, type: `steppling.garden.${id}`, occurredAt: NOW, payload: {},
    } }).run;
  }
  assert.equal(run.nodeId, 'closing');
  run = reduceContentFlow(STEPPLING_GARDEN_FLOW, run, { type: 'submit_scene', actionId: 'summary' }).run;
  assert.equal(run.nodeId, 'summary'); assert.notEqual(run.status, 'completed');
  run = reduceContentFlow(STEPPLING_GARDEN_FLOW, JSON.parse(JSON.stringify(run)), { type: 'submit_scene', actionId: 'finish' }).run;
  assert.equal(run.status, 'completed');
});
test('parcel, two guaranteed Socks, merge and one Shoe order survive reloads without duplicate rewards', () => {
  let state = prepared();
  assert.equal(stepplingGardenCheckpoint(state), 'parcel');
  assert.equal(reduceMergeWorld(state, { type: 'prepareStepplingGardenLesson', now: NOW }).changed, false);
  state = apply(state, { type: 'claimArrival', arrivalId: STEPPLING_PARCEL_ID, now: NOW });
  assert.equal(stepplingGardenCheckpoint(state), 'spawn.first');
  state.generators['journey-locker'] = { ...state.generators['journey-locker'], charges: 0, restStartedAt: NOW };
  state.energy.value = 0;
  for (const [index, next] of ['spawn.second', 'merge'].entries()) {
    const command = { type: 'tapGenerator' as const, generatorId: 'journey-locker', seed: `${index}`, now: NOW };
    const step = stepplingGardenBoardStep(stepplingGardenCheckpoint(state), state);
    assert.equal(mergeFtueAllowsCommand(step, state, command), true);
    assert.equal(mergeFtueAllowsCommand(step, state, { ...command, generatorId: 'wild-garden' }), false);
    state = apply(state, command);
    assert.equal(stepplingGardenCheckpoint(state), next);
    assert.equal(state.energy.value, 0);
  }
  assert.equal(stepplingGardenDrop(state, 'journey-locker'), null, 'no third tutorial drop');
  assert.equal(reduceMergeWorld(state, { type: 'tapGenerator', generatorId: 'journey-locker', seed: 'rapid-third', now: NOW }).changed, false);
  const socks = state.board.filter((cell) => cell.occupant?.kind === 'item' && cell.occupant.definitionId === 'adventure:trail:1');
  assert.equal(socks.length, 2);
  const command = { type: 'move' as const, from: state.board.indexOf(socks[0]), to: state.board.indexOf(socks[1]), now: NOW };
  assert.equal(mergeFtueAllowsCommand(stepplingGardenBoardStep('merge', state), state, command), true);
  state = apply(state, command);
  assert.equal(stepplingGardenCheckpoint(state), 'serve');
  const before = state.coins;
  state = apply(state, { type: 'serveOrder', orderId: STEPPLING_SHOE_ORDER_ID, now: NOW });
  assert.equal(state.coins - before, 20);
  assert.equal(stepplingGardenCheckpoint(state), 'closing');
  assert.equal(stepplingGardenDrop(state, 'journey-locker'), null);
  assert.equal(reduceMergeWorld(state, { type: 'serveOrder', orderId: STEPPLING_SHOE_ORDER_ID, now: NOW }).changed, false);
  assert.equal(reduceMergeWorld(state, { type: 'grantGeneratorParcel', generatorId: 'journey-locker', rewardId: STEPPLING_PARCEL_ID, dayId: '2026-09-05', now: NOW }).changed, false);
});
test('full board releases the interaction gate without destroying board contents', () => {
  const state = prepared();
  state.board = state.board.map((cell, index) => ({ ...cell, occupant: { kind: 'item', instanceId: `keep:${index}`, definitionId: 'nature:garden:1' } }));
  assert.equal(stepplingGardenBoardStep('parcel', state)?.interaction, undefined);
  const result = reduceMergeWorld(state, { type: 'claimArrival', arrivalId: STEPPLING_PARCEL_ID, now: NOW });
  assert.equal(result.changed, false);
  assert.deepEqual(result.state.board, state.board);
});
test('journal recovery follows saved board evidence and preserves the summary and completion receipts', async () => {
  let run = createContentFlowRun(STEPPLING_GARDEN_FLOW, { runId: 'ftue:steppling-garden:1', now: NOW });
  const runtime = loadNativeModule('features/onboarding/steppling-garden-runtime.ts', {
    './steppling-garden-lesson': { STEPPLING_GARDEN_FLOW, STEPPLING_GARDEN_RUN_ID: 'ftue:steppling-garden:1', stepplingGardenCheckpoint },
    '@/features/content-flow/content-flow-catalog': { registerContentFlowDefinition() {} },
    '@/features/content-flow/content-flow-director': {},
    '@/features/content-flow/content-flow-repository': {
      loadContentFlowRun: async () => run,
      reduceContentFlowRunAtomically: async ({ reduce }: { reduce: (run: ContentFlowRun) => ContentFlowRun }) => { run = reduce(run); return { run }; },
    },
  });
  let state = prepared();
  state = apply(state, { type: 'claimArrival', arrivalId: STEPPLING_PARCEL_ID, now: NOW });
  await runtime.reconcileStepplingGarden(state); assert.equal(run.nodeId, 'spawn.first');
  for (const nodeId of ['summary', 'complete']) {
    run = { ...run, nodeId, status: nodeId === 'complete' ? 'completed' : 'active' };
    await runtime.reconcileStepplingGarden(state); assert.equal(run.nodeId, nodeId);
  }
});
