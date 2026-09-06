import { MERGE_ORDER_TEMPLATES } from '../constants/merge-world-catalog';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createJourneyCycle, installJourneyCycle, completeMeditationRequest, observeJourneySteps, finishJourneyReturn, journeyCycleReady, JOURNEY_REST_MS } from '../game/katchimeras/companion-journey-cycle';
import { emptyRelationshipProgressState, beginKatchimeraMeditation, normalizeRelationshipProgressState, settleKatchimeraMeditation, startMossproutJourneyDay, completeMossproutJourneyDay, mossproutJourneyRuntimeDayId } from '../game/katchimeras/relationship-progression';
import { STEPPLING_JOURNEY_DAYS, stepplingEpisodeFlow } from '../constants/steppling-journey-campaign';
import { validateContentFlowDefinition } from '../features/content-flow/content-flow-compiler';
import { createContentFlowRun, reduceContentFlow } from '../features/content-flow/content-flow-interpreter';
import { createInitialMergeWorldState, normalizeMergeWorldState, reduceMergeWorld } from '../utils/merge-world/engine';

const at = new Date('2026-09-04T22:00:00').getTime();
function cycle(familyId: 'steppling' | 'mossprout' = 'steppling') {
  return createJourneyCycle({ id: `journey-cycle:${familyId}:day-1`, familyId, episodeId: 'day-1', number: 1, chapterId: `${familyId}-chapter-1`, title: 'A little way together', nextTitle: 'A reason to go', completedAt: at, finale: false, stepBaselines: { '2026-09-04': 1000 } });
}
function state() { return installJourneyCycle(emptyRelationshipProgressState(), cycle()); }

test('natural return is durable and cannot skip meditation or replay a gift claim', () => {
  const initial = state();
  assert.equal(journeyCycleReady(initial, cycle(), at + JOURNEY_REST_MS - 1), false);
  assert.equal(finishJourneyReturn(initial, cycle().id, at + 1), initial);
  const returned = finishJourneyReturn(initial, cycle().id, at + JOURNEY_REST_MS);
  assert.equal(returned.journeyCycles![0].returnedAt, at + JOURNEY_REST_MS);
  assert.equal(finishJourneyReturn(returned, cycle().id, at + JOURNEY_REST_MS + 1), returned);
  assert.deepEqual(normalizeRelationshipProgressState(JSON.parse(JSON.stringify(returned))).journeyCycles, returned.journeyCycles);
});

test('requests are frozen, exactly once, share existing acceleration cap, and expire', () => {
  let value = state();
  const request = cycle().requests[0];
  value = completeMeditationRequest(value, cycle().id, request.id, 'serve:1', at + 1);
  assert.equal(value.meditations![0].settledMs, 5 * 60000);
  assert.equal(completeMeditationRequest(value, cycle().id, request.id, 'serve:1', at + 2), value);
  value = settleKatchimeraMeditation(value, 'steppling', 2 * 3600000, 'ordinary', at + 3);
  value = completeMeditationRequest(value, cycle().id, cycle().requests[2].id, 'rest', at + 4, 'rest');
  assert.equal(value.meditations![0].settledMs, 2 * 3600000);
  assert.equal(value.journeyCycles![0].participation, 'rest');
  assert.equal(completeMeditationRequest(value, cycle().id, cycle().requests[1].id, 'late', at + JOURNEY_REST_MS), value);
  assert.equal(installJourneyCycle(value, cycle()), value);
});

test('pending saved requests adopt five minutes without undoing earned reductions', () => {
  const initial = state();
  const legacy = { ...initial, journeyCycles: initial.journeyCycles!.map((item) => ({ ...item, requests: item.requests.map((request) => request.kind === 'merge' ? { ...request, reductionMs: 30 * 60000 } : request) })) };
  const restored = normalizeRelationshipProgressState(legacy);
  assert.equal(restored.journeyCycles![0].requests[0].reductionMs, 5 * 60000);
  assert.equal(restored.meditations![0].availableAt, initial.meditations![0].availableAt);
  const served = completeMeditationRequest(legacy, cycle().id, cycle().requests[0].id, 'legacy-order', at + 1);
  assert.equal(served.meditations![0].settledMs, 5 * 60000);
});

test('steps count only new increments across source dates and never count twice', () => {
  let value = observeJourneySteps(state(), cycle().id, '2026-09-04', 1200, at + 1, at - 22 * 3600000);
  assert.equal(value.journeyCycles![0].stepProgress, 200);
  assert.equal(observeJourneySteps(value, cycle().id, '2026-09-04', 1100, at + 2, at - 22 * 3600000), value);
  const midnight = at + 2 * 3600000;
  value = observeJourneySteps(value, cycle().id, '2026-09-05', 300, midnight + 1, midnight);
  assert.equal(value.journeyCycles![0].stepProgress, 500);
  assert.equal(value.journeyCycles![0].participation, 'walk');
  assert.equal(value.meditations![0].settledMs, 3600000);
  value = observeJourneySteps(value, cycle().id, '2026-09-05', 700, midnight + 2, midnight);
  assert.equal(value.meditations![0].settledMs, 3600000);
});

test('an unknown historical baseline and pre-rest reading cannot fabricate steps', () => {
  const initial = state();
  assert.equal(observeJourneySteps(initial, cycle().id, '2026-09-04', 5000, at - 1, at - 86400000), initial);
  const value = observeJourneySteps(initial, cycle().id, '2026-09-03', 5000, at + 1, at - 86400000);
  assert.equal(value.journeyCycles![0].stepProgress, 0);
});

test('adopting FTUE meditation preserves its timer, reductions, and source identity', () => {
  let value = beginKatchimeraMeditation(emptyRelationshipProgressState(), 'mossprout', at + 1000, JOURNEY_REST_MS, 'ftue:first-rest');
  value = settleKatchimeraMeditation(value, 'mossprout', 1200000, 'water', at + 2000);
  const availableAt = value.meditations![0].availableAt;
  value = installJourneyCycle(value, cycle('mossprout'));
  assert.equal(value.meditations![0].availableAt, availableAt);
  assert.equal(value.meditations![0].sourceId, 'ftue:first-rest');
  assert.equal(beginKatchimeraMeditation(value, 'mossprout', at + 5000, JOURNEY_REST_MS, 'ftue:first-rest'), value);
});

test('families progress independently and a pending return blocks only its family', () => {
  const value = installJourneyCycle(state(), cycle('mossprout'));
  assert.equal(value.meditations!.length, 2);
  const returned = finishJourneyReturn(value, cycle().id, at + JOURNEY_REST_MS);
  assert.equal(returned.journeyCycles!.find((item) => item.familyId === 'mossprout')!.returnedAt, null);
});

test('every Steppling branch leads to real orders before resolution and meditation', () => {
  for (const day of STEPPLING_JOURNEY_DAYS.slice(1)) {
    const flow = stepplingEpisodeFlow(day.number);
    assert.deepEqual(validateContentFlowDefinition(flow), []);
    const opening = flow.nodes.find((node) => node.id === flow.entryNodeId)!;
    assert.equal(opening.kind, 'scene');
    if (opening.kind !== 'scene') continue;
    for (const { id: choice } of opening.actions!) {
      let run = createContentFlowRun(flow, { runId: `test:${day.number}:${choice}`, now: at });
      run = reduceContentFlow(flow, run, { type: 'submit_scene', actionId: choice, now: at }).run;
      for (let guard = 0; guard < flow.nodes.length && run.nodeId !== 'activity'; guard++) {
        const node = flow.nodes.find((item) => item.id === run.nodeId)!;
        assert.equal(node.kind, 'scene');
        if (node.kind !== 'scene') break;
        const action = node.actions?.find((item) => item.id === 'skip') ?? node.actions![0];
        run = reduceContentFlow(flow, run, { type: 'submit_scene', actionId: action.id, now: at }).run;
      }
      assert.equal(run.nodeId, 'activity');
      assert.equal(reduceContentFlow(flow, run, { type: 'submit_scene', actionId: 'continue', now: at }).run.nodeId, 'activity');
    }
  }
});

test('return parcels use stable identities and remain queued without free board cells', () => {
  const initial = createInitialMergeWorldState(at);
  const once = reduceMergeWorld(initial, { type: 'grantJourneyReturn', cycle: cycle(), dayId: '2026-09-05', now: at + JOURNEY_REST_MS });
  assert.equal(once.state.arrivals.filter((item) => item.id === cycle().rewardId).length, 1);
  assert.equal(reduceMergeWorld(once.state, { type: 'grantJourneyReturn', cycle: cycle(), dayId: '2026-09-06', now: at + JOURNEY_REST_MS + 1 }).changed, false);
  assert.equal(reduceMergeWorld(initial, { type: 'grantJourneyReturn', cycle: { ...cycle(), finale: true }, dayId: '2026-09-05', now: at }).changed, false);
  const full = { ...once.state, board: once.state.board.map((cell, index) => ({ ...cell, occupant: cell.occupant ?? { kind: 'item' as const, definitionId: 'adventure:trail:1', instanceId: `full:${index}` } })) };
  const blocked = reduceMergeWorld(full, { type: 'claimArrival', arrivalId: cycle().rewardId, now: at + JOURNEY_REST_MS });
  assert.equal(blocked.changed, false);
  assert.equal(blocked.state.arrivals.find((item) => item.id === cycle().rewardId)!.claimedAt, null);
  const free = { ...blocked.state, board: blocked.state.board.map((cell, index) => index < 2 ? { ...cell, locked: false, mist: null, occupant: null } : cell) };
  const claimed = reduceMergeWorld(free, { type: 'claimArrival', arrivalId: cycle().rewardId, now: at + JOURNEY_REST_MS + 1 });
  assert.equal(claimed.spawnedItems?.length, 2);
  assert.equal(reduceMergeWorld({ ...claimed.state, arrivals: [] }, { type: 'grantJourneyReturn', cycle: cycle(), dayId: '2026-09-06', now: at + JOURNEY_REST_MS + 2 }).changed, false, 'a pruned arrival cannot be granted again');
});

test('Mossprout resumes an unfinished episode across dates without creating another', () => {
  const initial = startMossproutJourneyDay(emptyRelationshipProgressState(), '2026-09-04', at).state;
  const resumed = startMossproutJourneyDay(initial, '2026-09-05', at + 86400000);
  assert.equal(resumed.state, initial);
  assert.equal(mossproutJourneyRuntimeDayId(initial, '2026-09-05'), '2026-09-04');
  const completed = completeMossproutJourneyDay(initial, '2026-09-04', { activityReceiptId: 'plant', resolutionId: 'bloom' }, at + 1);
  assert.equal(startMossproutJourneyDay(completed, '2026-09-05', at + 2).reason, 'resting');
  assert.equal(startMossproutJourneyDay(completed, '2026-09-05', at + JOURNEY_REST_MS + 2, 0).reason, 'started');
});

function legacyCycle(familyId: 'mossprout' | 'steppling' = 'steppling') {
  const value = cycle(familyId);
  return { ...value, dailyGardenVersion: undefined, requests: value.requests.map((request, index) => request.kind !== 'merge' ? request : {
    ...request, definitionId: `${familyId === 'mossprout' ? 'nature:garden' : 'adventure:trail'}:${index + 1}`, orderId: `${value.id}:request:${index + 1}`,
  }) };
}

test('expired meditation orders preserve items, including after a shortened deadline', () => {
  const pending = legacyCycle();
  const availableAt = at + JOURNEY_REST_MS;
  const initial = reduceMergeWorld(createInitialMergeWorldState(at), { type: 'reconcileJourneyMeditation', cycle: pending, availableAt, now: at }).state;
  const order = initial.activeOrders.find((item) => item.id === pending.requests[0].orderId)!;
  const ready = { ...initial, board: initial.board.map((cell, index) => index === 0 ? { ...cell, locked: false, mist: null, occupant: { kind: 'item' as const, definitionId: order.requirements[0].definitionId, instanceId: 'request-item' } } : cell) };
  assert.equal(reduceMergeWorld(ready, { type: 'serveOrder', orderId: order.id, now: at + 1 }).changed, true);
  const expired = reduceMergeWorld(ready, { type: 'serveOrder', orderId: order.id, now: availableAt });
  assert.equal(expired.changed, false);
  assert.deepEqual(expired.state.board, ready.board);
  const shortened = reduceMergeWorld(ready, { type: 'reconcileJourneyMeditation', cycle: pending, availableAt: availableAt - 3600000, now: at + 1 }).state;
  assert.equal(shortened.activeOrders.find((item) => item.id === order.id)!.expiresAt, availableAt - 3600000);
  assert.equal(reduceMergeWorld(shortened, { type: 'serveOrder', orderId: order.id, now: availableAt - 3600000 }).changed, false);
});

test('meditation requests pay Glow once, preserve time receipts, and repair saved zero rewards', () => {
  for (const familyId of ['mossprout', 'steppling'] as const) {
    const pending = legacyCycle(familyId);
    const initial = reduceMergeWorld(createInitialMergeWorldState(at), { type: 'reconcileJourneyMeditation', cycle: pending, availableAt: at + JOURNEY_REST_MS, now: at }).state;
    const order = initial.activeOrders.find((item) => item.id === pending.requests[0].orderId)!;
    assert.equal(order.reward.coins, 8);
    const saved = { ...initial, activeOrders: initial.activeOrders.map((item) => ({ ...item, reward: { ...item.reward, coins: 0 } })) };
    assert.ok(normalizeMergeWorldState(saved, at).activeOrders.every((item) => item.reward.coins > 0));
    const repaired = reduceMergeWorld(saved, { type: 'reconcileJourneyMeditation', cycle: pending, availableAt: at + JOURNEY_REST_MS, now: at }).state;
    assert.equal(repaired.activeOrders.find((item) => item.id === order.id)!.reward.coins, 8);
    const ready = { ...repaired, board: repaired.board.map((cell, index) => index === 0 ? { ...cell, locked: false, mist: null, occupant: { kind: 'item' as const, definitionId: order.requirements[0].definitionId, instanceId: 'paid-request' } } : cell) };
    const served = reduceMergeWorld(ready, { type: 'serveOrder', orderId: order.id, now: at + 1 });
    assert.equal(served.state.coins, ready.coins + 8);
    assert.equal(served.servedOrderId, order.id);
    assert.ok(served.state.externalRewardReceipts.some((receipt) => receipt.id === 'merge-story-served:' + order.id));
    const replay = reduceMergeWorld(served.state, { type: 'serveOrder', orderId: order.id, now: at + 2 });
    assert.equal(replay.changed, false);
    assert.equal(replay.state.coins, served.state.coins);
  }
});

test('every procedural order template carries a positive Glow reward', () => {
  assert.ok(MERGE_ORDER_TEMPLATES.length > 0);
  for (const template of MERGE_ORDER_TEMPLATES) assert.ok(Number.isFinite(template.reward.coins) && template.reward.coins > 0, template.key);
});
