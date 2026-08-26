import assert from 'node:assert/strict';
import test from 'node:test';

import { MOSSPROUT_JOURNEY_CAMPAIGN } from '@/constants/mossprout-journey-campaign';
import { defineContentFlow, validateContentFlowDefinition } from '@/features/content-flow/content-flow-compiler';
import {
  contentFlowEffectKey,
  contentFlowNavigationKey,
  contentFlowPresentationKey,
  createContentFlowRun,
  reduceContentFlow,
} from '@/features/content-flow/content-flow-interpreter';
import { compileJourneyCampaignFlows } from '@/features/content-flow/journey-flow-compiler';
import { compileFtueFlow } from '@/features/content-flow/ftue-flow-adapter';
import { journeyNodeForLegacyRecord, migrateJourneyRecordToContentFlow } from '@/features/content-flow/content-flow-legacy-mapping';
import { rewardedChildActionFlow } from '@/features/content-flow/content-flow-templates';
import { MOSSPROUT_FTUE_SCRIPT } from '@/features/onboarding/mossprout-ftue-script';
import type { ContentFlowDefinition, ContentFlowEvent } from '@/types/content-flow';
import type { JourneyDayRecord } from '@/types/relationship-progression';

const COMPLETE_FLOW = defineContentFlow({
  id: 'test:durable',
  version: 1,
  entryNodeId: 'opening',
  nodes: [
    { id: 'opening', kind: 'scene', surface: 'companion', sceneId: 'hello', actions: [{ id: 'continue', next: 'grant' }] },
    { id: 'grant', kind: 'effect', effectId: 'coins', effectType: 'wallet.grant', payload: { amount: 5 }, next: 'garden' },
    { id: 'garden', kind: 'route', surface: 'merge', routeId: 'garden', route: '/game/merge-world', lock: true, next: 'orders' },
    { id: 'orders', kind: 'task', surface: 'merge', taskId: 'two-orders', requirements: [
      { id: 'one', event: { type: 'merge.order_served', where: { objectiveId: 'pond', orderId: 'one' } } },
      { id: 'two', event: { type: 'merge.order_served', where: { objectiveId: 'pond', orderId: 'two' } } },
    ], next: 'reward' },
    { id: 'reward', kind: 'presentation', surface: 'companion', presentationId: 'reward', presentationType: 'bond.flight', next: 'done' },
    { id: 'done', kind: 'complete' },
  ],
} satisfies ContentFlowDefinition);

function event(runId: string, nodeId: string, orderId: string, eventId = orderId): ContentFlowEvent {
  return { eventId, type: 'merge.order_served', runId, nodeId, objectiveId: 'pond', payload: { objectiveId: 'pond', orderId }, occurredAt: 10 };
}

test('compiler rejects unreachable nodes, dead ends, bad targets, and empty tasks', () => {
  const issues = validateContentFlowDefinition({
    id: 'broken', version: 1, entryNodeId: 'start', nodes: [
      { id: 'start', kind: 'scene', surface: 'companion', sceneId: 'start', actions: [{ id: 'stay', next: 'start' }, { id: 'missing', next: 'nope' }] },
      { id: 'orphan', kind: 'task', surface: 'merge', taskId: 'empty', requirements: [], next: 'orphan' },
    ],
  });
  assert.ok(issues.some((issue) => issue.message.includes('Unknown transition target')));
  assert.ok(issues.some((issue) => issue.message.includes('Unreachable node')));
  assert.ok(issues.some((issue) => issue.message.includes('No reachable complete')));
  assert.ok(issues.some((issue) => issue.message.includes('at least one requirement')));
});

test('one interpreter owns input, effects, navigation, correlated objectives, presentation, and completion', () => {
  let run = createContentFlowRun(COMPLETE_FLOW, { runId: 'run', now: 1 });
  assert.equal(run.phase, 'awaiting_input');
  let transition = reduceContentFlow(COMPLETE_FLOW, run, { type: 'submit_scene', actionId: 'continue', now: 2 });
  run = transition.run;
  assert.equal(run.phase, 'awaiting_effect');
  assert.equal(transition.pendingWork.kind, 'effect');
  const effectKey = contentFlowEffectKey(run, 'coins');
  transition = reduceContentFlow(COMPLETE_FLOW, run, { type: 'effect_completed', effectKey, result: { awarded: true }, now: 3 });
  run = transition.run;
  assert.equal(run.phase, 'awaiting_navigation');
  assert.equal(run.effectReceipts[effectKey]?.result && (run.effectReceipts[effectKey].result as { awarded: boolean }).awarded, true);
  transition = reduceContentFlow(COMPLETE_FLOW, run, { type: 'navigation_acknowledged', navigationKey: contentFlowNavigationKey(run, 'garden'), now: 4 });
  run = transition.run;
  assert.equal(run.nodeId, 'orders');

  const wrongRun = reduceContentFlow(COMPLETE_FLOW, run, { type: 'record_event', event: event('another-run', 'orders', 'one'), now: 5 });
  assert.deepEqual(wrongRun.run.objectiveProgress, {});
  const wrongNode = reduceContentFlow(COMPLETE_FLOW, run, { type: 'record_event', event: event('run', 'old-orders', 'one'), now: 5 });
  assert.deepEqual(wrongNode.run.objectiveProgress, {});

  transition = reduceContentFlow(COMPLETE_FLOW, run, { type: 'record_event', event: event('run', 'orders', 'one'), now: 6 });
  run = transition.run;
  assert.equal(run.nodeId, 'orders');
  assert.equal(run.objectiveProgress['orders:one'], 1);
  transition = reduceContentFlow(COMPLETE_FLOW, run, { type: 'record_event', event: event('run', 'orders', 'two'), now: 7 });
  run = transition.run;
  assert.equal(run.phase, 'awaiting_presentation');
  const presentationKey = contentFlowPresentationKey(run, 'reward');
  transition = reduceContentFlow(COMPLETE_FLOW, run, { type: 'presentation_acknowledged', presentationKey, now: 8 });
  assert.equal(transition.run.status, 'completed');
  assert.equal(transition.run.completedAt, 8);
});

test('duplicate acknowledgements and unrelated commands cannot double-advance a node', () => {
  let run = createContentFlowRun(COMPLETE_FLOW, { runId: 'idempotent', now: 1 });
  run = reduceContentFlow(COMPLETE_FLOW, run, { type: 'submit_scene', actionId: 'unknown', now: 2 }).run;
  assert.equal(run.nodeId, 'opening');
  run = reduceContentFlow(COMPLETE_FLOW, run, { type: 'submit_scene', actionId: 'continue', now: 3 }).run;
  const key = contentFlowEffectKey(run, 'coins');
  const once = reduceContentFlow(COMPLETE_FLOW, run, { type: 'effect_completed', effectKey: key, now: 4 }).run;
  const twice = reduceContentFlow(COMPLETE_FLOW, once, { type: 'effect_completed', effectKey: key, now: 5 }).run;
  assert.equal(twice.nodeId, once.nodeId);
  assert.equal(Object.keys(twice.effectReceipts).length, 1);
});

test('a run resumes from serialized state at every durable boundary', () => {
  let run = createContentFlowRun(COMPLETE_FLOW, { runId: 'relaunch', now: 1 });
  run = JSON.parse(JSON.stringify(reduceContentFlow(COMPLETE_FLOW, run, { type: 'submit_scene', actionId: 'continue', now: 2 }).run));
  assert.equal(run.phase, 'awaiting_effect');
  run = JSON.parse(JSON.stringify(reduceContentFlow(COMPLETE_FLOW, run, { type: 'effect_completed', effectKey: contentFlowEffectKey(run, 'coins'), now: 3 }).run));
  assert.equal(run.phase, 'awaiting_navigation');
  run = JSON.parse(JSON.stringify(reduceContentFlow(COMPLETE_FLOW, run, { type: 'navigation_acknowledged', navigationKey: contentFlowNavigationKey(run, 'garden'), now: 4 }).run));
  run = JSON.parse(JSON.stringify(reduceContentFlow(COMPLETE_FLOW, run, { type: 'record_event', event: event('relaunch', 'orders', 'one'), now: 5 }).run));
  assert.equal(run.objectiveProgress['orders:one'], 1);
  run = JSON.parse(JSON.stringify(reduceContentFlow(COMPLETE_FLOW, run, { type: 'record_event', event: event('relaunch', 'orders', 'two'), now: 6 }).run));
  assert.equal(run.phase, 'awaiting_presentation');
  run = JSON.parse(JSON.stringify(reduceContentFlow(COMPLETE_FLOW, run, { type: 'presentation_acknowledged', presentationKey: contentFlowPresentationKey(run, 'reward'), now: 7 }).run));
  assert.equal(run.status, 'completed');
});

test('rewarded optional actions compile as independent child flows with durable rewards', () => {
  const child = rewardedChildActionFlow({ id: 'mossprout:optional:weather', version: 1, sceneId: 'choose-weather', rewardEffectType: 'bond.grant', rewardPresentationType: 'bond.flight' });
  assert.deepEqual(validateContentFlowDefinition(child), []);
  assert.deepEqual(child.nodes.map((node) => node.kind), ['scene', 'effect', 'presentation', 'complete']);
});

test('all Mossprout Journey days compile as executable, terminal graphs', () => {
  const flows = compileJourneyCampaignFlows(MOSSPROUT_JOURNEY_CAMPAIGN);
  assert.equal(flows.length, MOSSPROUT_JOURNEY_CAMPAIGN.days.length);
  for (const flow of flows) {
    assert.deepEqual(validateContentFlowDefinition(flow), []);
    assert.equal(flow.nodes.at(-1)?.kind, 'complete');
  }
  const dayOne = flows[0]!;
  assert.ok(dayOne.nodes.some((node) => node.kind === 'effect' && node.effectType === 'resident.grant_parcel'));
  assert.ok(dayOne.nodes.some((node) => node.kind === 'presentation' && node.presentationType === 'resident.card_reward'));
});

test('the existing FTUE graph compiles without screen-owned step semantics', () => {
  const flow = compileFtueFlow(MOSSPROUT_FTUE_SCRIPT);
  assert.deepEqual(validateContentFlowDefinition(flow), []);
  assert.equal(flow.entryNodeId, MOSSPROUT_FTUE_SCRIPT.entryStepId);
  assert.equal(flow.nodes.find((node) => node.id === MOSSPROUT_FTUE_SCRIPT.terminalStepId)?.kind, 'complete');
  const natureTheme = flow.nodes.find((node) => node.id === 'egg.nature_theme');
  assert.equal(natureTheme?.kind, 'scene');
  if (natureTheme?.kind === 'scene') {
    assert.deepEqual(new Set(natureTheme.actions.map((action) => action.next)), new Set(['egg.companion_identity']));
  }
});

function legacyJourney(status: JourneyDayRecord['status'], overrides: Partial<JourneyDayRecord> = {}): JourneyDayRecord {
  return {
    id: 'journey-day:2026-08-25:mossprout', dayId: '2026-08-25', familyId: 'mossprout', status,
    chapterId: 'dry-pond', beatId: MOSSPROUT_JOURNEY_CAMPAIGN.days[1]!.id,
    openingConversationId: 'opening', profileConversationId: null, matchedCardId: null, returnConversationId: 'resolution',
    activity: { kind: 'merge', objectiveId: 'pond', mergeOrderId: 'one', mergeOrderIds: ['one', 'two'], servedOrderIds: [], opportunityId: 'opportunity', generatorId: 'garden', dropDefinitionIds: [] },
    resolutionAvailableAt: null, signalReceiptIds: [], activityReceiptIds: [], resolutionId: null, actions: [], startedAt: 1, completedAt: null, completionReceipt: null,
    ...overrides,
  };
}

test('legacy Journey migration resumes at the earliest incomplete authored node', () => {
  const inProgress = legacyJourney('activity_in_progress');
  assert.match(journeyNodeForLegacyRecord(inProgress) ?? '', /:orders$/);
  const served = legacyJourney('activity_in_progress', { activity: { ...inProgress.activity!, servedOrderIds: ['one', 'two'] } });
  assert.match(journeyNodeForLegacyRecord(served) ?? '', /:resolution$/);
  const reward = legacyJourney('card_reward', { beatId: MOSSPROUT_JOURNEY_CAMPAIGN.days[2]!.id });
  const migrated = migrateJourneyRecordToContentFlow(reward, 100)!;
  assert.match(migrated.nodeId, /:resident:card-reward$/);
  assert.equal(migrated.phase, 'awaiting_presentation');
});
