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
import { rewardedChildActionFlow } from '@/features/content-flow/content-flow-templates';
import { MOSSPROUT_FTUE_SCRIPT } from '@/features/onboarding/mossprout-ftue-script';
import type { ContentFlowDefinition, ContentFlowEvent } from '@/types/content-flow';
import { storyRoute } from '@/features/content-flow/story-route-registry';
import { defineStory, story } from '@/features/content-flow/story-manifest';
import { clearContentFlowCatalogForTests, registerContentFlowDefinition } from '@/features/content-flow/content-flow-catalog';

const COMPLETE_FLOW = defineContentFlow({
  id: 'test:durable',
  version: 1,
  entryNodeId: 'opening',
  nodes: [
    { id: 'opening', kind: 'scene', capability: 'story.conversation', surface: 'companion', sceneId: 'hello', actions: [{ id: 'continue', next: 'grant' }] },
    { id: 'grant', kind: 'effect', capability: 'story.reward_effect', effectId: 'coins', effectType: 'wallet.grant', payload: { amount: 5 }, next: 'garden' },
    { id: 'garden', kind: 'route', capability: 'story.route', surface: 'merge', routeId: 'garden', target: storyRoute('merge'), readiness: ['route', 'data', 'layout', 'background', 'foreground'], lock: true, next: 'orders' },
    { id: 'orders', kind: 'task', capability: 'merge.orders', surface: 'merge', taskId: 'two-orders', payload: { objectiveId: 'pond' }, requirements: [
      { id: 'one', event: { type: 'merge.order_served', where: { objectiveId: 'pond', orderId: 'one' } } },
      { id: 'two', event: { type: 'merge.order_served', where: { objectiveId: 'pond', orderId: 'two' } } },
    ], next: 'reward' },
    { id: 'reward', kind: 'presentation', capability: 'story.reward', surface: 'companion', presentationId: 'reward', presentationType: 'bond.flight', replayPolicy: 'replay', next: 'done' },
    { id: 'done', kind: 'complete' },
  ],
} satisfies ContentFlowDefinition);

function event(runId: string, nodeId: string, orderId: string, eventId = orderId): ContentFlowEvent {
  return { eventId, type: 'merge.order_served', runId, nodeId, objectiveId: 'pond', payload: { objectiveId: 'pond', orderId }, occurredAt: 10 };
}

test('compiler rejects unreachable nodes, dead ends, bad targets, and empty tasks', () => {
  const issues = validateContentFlowDefinition({
    id: 'broken', version: 1, entryNodeId: 'start', nodes: [
      { id: 'start', kind: 'scene', capability: 'story.conversation', surface: 'companion', sceneId: 'start', actions: [{ id: 'stay', next: 'start' }, { id: 'missing', next: 'nope' }] },
      { id: 'orphan', kind: 'task', capability: 'resident.orders', surface: 'merge', taskId: 'empty', requirements: [], next: 'orphan' },
    ],
  });
  assert.ok(issues.some((issue) => issue.message.includes('Unknown transition target')));
  assert.ok(issues.some((issue) => issue.message.includes('Unreachable node')));
  assert.ok(issues.some((issue) => issue.message.includes('No reachable complete')));
  assert.ok(issues.some((issue) => issue.message.includes('at least one requirement')));
});

test('typed story manifests provide shared capabilities, routes, readiness and back policy', () => {
  const manifest = defineStory({
    id: 'test:typed-story',
    version: 1,
    entryNodeId: 'opening',
    nodes: [
      story.conversation({ id: 'opening', conversationId: 'pond-opening', next: 'garden' }),
      story.route({ id: 'garden', route: 'merge', lock: true, next: 'orders', readiness: ['route', 'data', 'layout', 'background', 'foreground', 'interaction_target'] }),
      story.task({ id: 'orders', capability: 'merge.orders', surface: 'merge', taskId: 'pond-orders', payload: { objectiveId: 'pond' }, requirements: [{ id: 'shell', event: { type: 'merge.order_served', where: { orderId: 'shell' } } }], next: 'complete' }),
      story.complete(),
    ],
    metadata: { kind: 'story' as const },
  });
  assert.deepEqual(validateContentFlowDefinition(manifest), []);
  const route = manifest.nodes.find((node) => node.kind === 'route');
  assert.equal(route?.kind === 'route' ? route.target.pathname : null, '/game/merge-world');
  assert.equal(route?.kind === 'route' ? route.backPolicy : null, 'locked');
  assert.equal(route?.kind === 'route' ? route.readiness?.includes('interaction_target') : false, true);
});

test('compiler rejects unregistered capabilities and hand-written route mismatches', () => {
  const issues = validateContentFlowDefinition({
    id: 'test:bad-contracts',
    version: 1,
    entryNodeId: 'route',
    nodes: [
      { id: 'route', kind: 'route', capability: 'missing.route.renderer', routeId: 'route', surface: 'merge', target: { id: 'merge', pathname: '/wrong', surface: 'merge' }, readiness: ['route'], next: 'complete' },
      { id: 'complete', kind: 'complete' },
    ],
  });
  assert.ok(issues.some((issue) => issue.message.includes('Unknown capability')));
  assert.ok(issues.some((issue) => issue.message.includes('shared route registry')));
});

test('catalog requires released node migrations when a newer story removes ids', () => {
  clearContentFlowCatalogForTests();
  const first = defineStory({ id: 'test:migration', version: 1, entryNodeId: 'old', nodes: [story.conversation({ id: 'old', conversationId: 'old', next: 'complete' }), story.complete()], metadata: { kind: 'story' as const } });
  registerContentFlowDefinition(first);
  const missingMigration = defineStory({ id: 'test:migration', version: 2, entryNodeId: 'new', nodes: [story.conversation({ id: 'new', conversationId: 'new', next: 'complete' }), story.complete()], metadata: { kind: 'story' as const } });
  assert.throws(() => registerContentFlowDefinition(missingMigration), /without migrations: old/);
  const migrated = defineStory({ id: 'test:migration', version: 2, entryNodeId: 'new', nodes: [story.conversation({ id: 'new', conversationId: 'new', next: 'complete' }), story.complete()], migrations: { old: 'new' }, metadata: { kind: 'story' as const } });
  registerContentFlowDefinition(migrated);
  clearContentFlowCatalogForTests();
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
  const dayOneEffect = flow.nodes.find((node) => node.kind === 'effect' && node.effectType === 'relationship.complete_day_one_lesson');
  assert.ok(dayOneEffect);
  const dayOneScene = flow.nodes.find((node) => node.kind === 'scene' && node.actions.some((action) => action.id === 'companion.complete_day_one_action'));
  assert.equal(dayOneScene?.kind === 'scene'
    ? dayOneScene.actions.find((action) => action.id === 'companion.complete_day_one_action')?.next
    : null, dayOneEffect.id);
  const natureTheme = flow.nodes.find((node) => node.id === 'egg.nature_theme');
  assert.equal(natureTheme?.kind, 'scene');
  if (natureTheme?.kind === 'scene') {
    assert.deepEqual(new Set(natureTheme.actions.map((action) => action.next)), new Set(['egg.companion_identity']));
  }
});

test('Day 1 Content Flow completion durably crosses the relationship effect before Garden', () => {
  const flow = compileFtueFlow(MOSSPROUT_FTUE_SCRIPT);
  const base = createContentFlowRun(flow, { runId: 'ftue-day-one', now: 1 });
  const atLesson = { ...base, nodeId: 'companion.day_one_action', phase: 'awaiting_input' as const };
  const effect = reduceContentFlow(flow, atLesson, { type: 'submit_scene', actionId: 'companion.complete_day_one_action', now: 2 });
  assert.equal(effect.run.phase, 'awaiting_effect');
  assert.equal(effect.pendingWork.kind, 'effect');
  if (effect.pendingWork.kind !== 'effect') return;
  assert.equal(effect.pendingWork.effectType, 'relationship.complete_day_one_lesson');
  const advanced = reduceContentFlow(flow, effect.run, { type: 'effect_completed', effectKey: effect.pendingWork.key, now: 3 });
  assert.equal(advanced.run.nodeId, 'companion.garden_intro');
  assert.equal(Object.keys(advanced.run.effectReceipts).length, 1);
});
