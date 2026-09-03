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
import { rewardedChildActionFlow } from '@/features/content-flow/content-flow-templates';
import { MOSSPROUT_FTUE_SCRIPT } from '@/features/onboarding/mossprout-ftue-script';
import { MOSSPROUT_FTUE_FLOW } from '@/features/onboarding/mossprout-ftue-flow';
import type { ContentFlowDefinition, ContentFlowEvent } from '@/types/content-flow';
import { storyRoute } from '@/features/content-flow/story-route-registry';
import { defineStory, story } from '@/features/content-flow/story-manifest';
import { clearContentFlowCatalogForTests, registerContentFlowDefinition } from '@/features/content-flow/content-flow-catalog';
import { contentFlowEffectResult, upgradeWorldTargetRecipe } from '@/features/content-flow/story-world-operations';
import { StoryTargetRegistry, waitForStoryTargets } from '@/features/content-flow/story-targets';
import { clearStoryVariantRegistryForTests, defineStoryVariants, registerStoryVariantSet, selectStoryVariantForDebug, selectedStoryVariant } from '@/features/content-flow/story-variant-registry';

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

test('streamlined introduction resumes at every boundary and hands off to the separate discovery chapter', () => {
  const flow = MOSSPROUT_FTUE_FLOW;
  let run = createContentFlowRun(flow, { runId: 'streamlined-ftue', now: 1 });
  const visited = new Set<string>();
  const events: string[] = [];
  let commands = 0;
  while (run.status !== 'completed' && commands++ < 80) {
    run = JSON.parse(JSON.stringify(run));
    visited.add(run.nodeId);
    const state = reduceContentFlow(flow, run, { type: 'retry', now: commands + 1 });
    run = state.run;
    const work = state.pendingWork;
    const node = flow.nodes.find((candidate) => candidate.id === run.nodeId)!;
    if (work.kind === 'effect') {
      const next = reduceContentFlow(flow, run, { type: 'effect_completed', effectKey: work.key, now: commands + 2 });
      const replay = reduceContentFlow(flow, next.run, { type: 'effect_completed', effectKey: work.key, now: commands + 3 });
      assert.equal(replay.run.nodeId, next.run.nodeId);
      assert.deepEqual(replay.run.effectReceipts, next.run.effectReceipts);
      run = replay.run;
    } else if (work.kind === 'presentation') {
      run = reduceContentFlow(flow, run, { type: 'presentation_acknowledged', presentationKey: work.key }).run;
    } else if (node.kind === 'scene') {
      run = reduceContentFlow(flow, run, { type: 'submit_scene', actionId: node.actions[0].id }).run;
    } else if (node.kind === 'task') {
      const requirement = node.requirements[0];
      const event = { eventId: `command:${commands}`, type: requirement.event.type, runId: run.runId, nodeId: run.nodeId, payload: requirement.event.where ?? {}, occurredAt: commands };
      assert.equal(reduceContentFlow(flow, run, { type: 'record_event', event: { ...event, runId: 'unrelated' } }).run.nodeId, run.nodeId);
      events.push(event.type);
      run = reduceContentFlow(flow, run, { type: 'record_event', event }).run;
    } else assert.fail(`Unhandled FTUE node ${node.id}`);
  }
  assert.equal(run.status, 'completed');
  assert.equal(events.filter((type) => type === 'ftue.merge_completed').length, 3);
  assert.equal(events.filter((type) => type === 'ftue.item_spawned').length, 0);
  assert.ok(visited.has('effect.haven.start_glow_discovery'));
  assert.ok(visited.has('world.seed_planted'));
  assert.ok(visited.has('world.first_seed_grew'));
  for (const removed of ['companion.day_one_action', 'companion.bond_spotlight', 'companion.order_preview', 'world.garden_handoff', 'companion.chapter_zero_return', 'companion.water_response', 'companion.first_insight'] as const) {
    assert.equal(visited.has(removed), false);
    assert.ok(flow.migrations?.[removed]);
  }
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
  const dayTwo = flows[1]!;
  assert.equal(dayOne.nodes.some((node) => node.kind === 'effect' && node.effectType === 'resident.grant_parcel'), false);
  assert.ok(dayTwo.nodes.some((node) => node.kind === 'effect' && node.effectType === 'resident.grant_parcel'));
  assert.ok(dayTwo.nodes.some((node) => node.kind === 'presentation' && node.presentationType === 'resident.card_reward'));
});

test('the shipping FTUE is a direct data-driven Content Flow manifest', () => {
  const flow = MOSSPROUT_FTUE_FLOW;
  assert.deepEqual(validateContentFlowDefinition(flow), []);
  assert.equal(flow.metadata.authoring, 'content-flow');
  assert.equal(flow.entryNodeId, MOSSPROUT_FTUE_SCRIPT.entryStepId);
  assert.equal(flow.nodes.find((node) => node.id === MOSSPROUT_FTUE_SCRIPT.terminalStepId)?.kind, 'complete');
  const dayOneEffect = flow.nodes.find((node) => node.kind === 'effect' && node.effectType === 'relationship.complete_day_one_lesson');
  assert.ok(dayOneEffect);
  const dayOneScene = flow.nodes.find((node) => node.kind === 'scene' && node.actions.some((action) => action.id === 'companion.complete_first_meeting'));
  assert.equal(dayOneScene?.kind === 'scene'
    ? dayOneScene.actions.find((action) => action.id === 'companion.complete_first_meeting')?.next
    : null, dayOneEffect.id);
  const opening = flow.nodes.find((node) => node.id === 'egg.opening');
  assert.equal(opening?.kind, 'scene');
  if (opening?.kind === 'scene') {
    assert.deepEqual(new Set(opening.actions.map((action) => action.next)), new Set(['egg.context']));
  }
  const context = flow.nodes.find((node) => node.id === 'egg.context');
  assert.equal(context?.kind === 'scene' ? context.actions[0]?.next : null, 'egg.ready');
  assert.equal(flow.nodes.some((node) => node.id === 'egg.nature_theme'), false);
});

test('Day 1 Content Flow completion durably crosses the relationship effect before Garden', () => {
  const flow = MOSSPROUT_FTUE_FLOW;
  const base = createContentFlowRun(flow, { runId: 'ftue-day-one', now: 1 });
  const atLesson = { ...base, nodeId: 'companion.first_meeting', phase: 'awaiting_input' as const };
  const effect = reduceContentFlow(flow, atLesson, { type: 'submit_scene', actionId: 'companion.complete_first_meeting', now: 2 });
  assert.equal(effect.run.phase, 'awaiting_effect');
  assert.equal(effect.pendingWork.kind, 'effect');
  if (effect.pendingWork.kind !== 'effect') return;
  assert.equal(effect.pendingWork.effectType, 'relationship.complete_day_one_lesson');
  const seeded = reduceContentFlow(flow, effect.run, { type: 'effect_completed', effectKey: effect.pendingWork.key, now: 3 });
  assert.equal(seeded.run.nodeId, 'effect.haven.grant_first_memory');
  assert.equal(seeded.pendingWork.kind, 'effect');
  if (seeded.pendingWork.kind !== 'effect') return;
  assert.equal(seeded.pendingWork.effectType, 'haven.grant_first_memory');
  const advanced = reduceContentFlow(flow, seeded.run, { type: 'effect_completed', effectKey: seeded.pendingWork.key, now: 4 });
  assert.equal(advanced.run.nodeId, 'companion.garden_intro');
  assert.equal(Object.keys(advanced.run.effectReceipts).length, 2);
});

test('the first memory is planted by its own world action and growth remains visible before companion return', () => {
  const flow = MOSSPROUT_FTUE_FLOW;
  const base = createContentFlowRun(flow, { runId: 'ftue-first-seed', now: 1 });
  const arrival = { ...base, nodeId: 'world.garden_arrival', phase: 'awaiting_input' as const };
  const placing = reduceContentFlow(flow, arrival, { type: 'submit_scene', actionId: 'world.plant_first_seed', now: 2 });
  assert.equal(placing.run.nodeId, 'effect.haven.place_first_memory');
  assert.equal(placing.pendingWork.kind, 'effect');
  if (placing.pendingWork.kind !== 'effect') return;
  assert.equal(placing.pendingWork.effectType, 'haven.place_first_memory');
  const planted = reduceContentFlow(flow, placing.run, { type: 'effect_completed', effectKey: placing.pendingWork.key, now: 3 });
  assert.equal(planted.run.nodeId, 'world.seed_planted');

  const beforeGrowth = { ...base, nodeId: 'effect.haven.grow_first_memory', phase: 'awaiting_effect' as const };
  const growthWork = reduceContentFlow(flow, beforeGrowth, { type: 'retry', now: 4 });
  assert.equal(growthWork.pendingWork.kind, 'effect');
  if (growthWork.pendingWork.kind !== 'effect') return;
  const grown = reduceContentFlow(flow, growthWork.run, { type: 'effect_completed', effectKey: growthWork.pendingWork.key, now: 5 });
  assert.equal(grown.run.nodeId, 'world.first_seed_grew');
});

test('world upgrade recipes expand into focus, atomic commit, and receipt-backed reveal', () => {
  const operationNodes = upgradeWorldTargetRecipe({
    id: 'restore.first-corner',
    target: { kind: 'haven_tile', familyId: 'mossprout' },
    toLevel: 1,
    economy: { mode: 'free', reason: 'FTUE first bloom' },
    focusTarget: { kind: 'haven_structure', structureId: 'mossprout-hex-garden' },
    next: 'complete',
    presentation: { reactionLine: 'The garden remembered.', showCoins: false },
  });
  const flow = defineStory({
    id: 'test:world-upgrade',
    version: 1,
    entryNodeId: operationNodes[0]!.id,
    nodes: [...operationNodes, story.complete()],
    metadata: { kind: 'story' as const },
  });
  assert.deepEqual(flow.nodes.map((node) => node.kind), ['presentation', 'effect', 'presentation', 'complete']);
  const focus = flow.nodes[0];
  assert.deepEqual(focus.kind === 'presentation' ? focus.payload?.target : null, { kind: 'haven_structure', structureId: 'mossprout-hex-garden' });
  const reveal = flow.nodes[2];
  assert.equal(reveal.kind === 'presentation' ? reveal.payload?.sourceEffectNodeId : null, 'restore.first-corner.commit');
  assert.deepEqual(reveal.kind === 'presentation' ? reveal.payload?.target : null, { kind: 'haven_structure', structureId: 'mossprout-hex-garden' });
  assert.equal(reveal.kind === 'presentation' ? reveal.payload?.showCoins : null, false);
  const receiptKey = 'run:restore.first-corner.commit:effect:restore.first-corner.commit';
  assert.deepEqual(contentFlowEffectResult({ [receiptKey]: { result: { toLevel: 1 } } }, 'run', 'restore.first-corner.commit', 'restore.first-corner.commit'), { toLevel: 1 });
});

test('world upgrade authoring rejects unsafe targets, missing economy reasons, and mismatched reveal receipts', () => {
  assert.throws(() => defineStory({
    id: 'test:bad-upgrade',
    version: 1,
    entryNodeId: 'upgrade',
    nodes: [
      { id: 'upgrade', kind: 'effect', capability: 'world.upgrade', effectId: 'upgrade', effectType: 'world.upgrade', payload: { target: { kind: 'haven_home' }, toLevel: 1, economy: { mode: 'free', reason: '' } }, next: 'complete' },
      story.complete(),
    ],
    metadata: { kind: 'story' as const },
  }), /world\.upgrade target|require a reason/);

  const issues = validateContentFlowDefinition({
    id: 'test:orphan-reveal', version: 1, entryNodeId: 'reveal', nodes: [
      { id: 'reveal', kind: 'presentation', capability: 'world.upgrade_reveal', surface: 'haven', presentationId: 'reveal', presentationType: 'world.upgrade_reveal', replayPolicy: 'replay', payload: { sourceEffectNodeId: 'missing', sourceEffectId: 'missing', preset: 'growth' }, next: 'complete' },
      { id: 'complete', kind: 'complete' },
    ],
  });
  assert.ok(issues.some((issue) => issue.message.includes('must reference a world.upgrade effect')));
});

test('semantic targets wait for layout readiness and stale cleanup cannot remove a newer registration', async () => {
  const registry = new StoryTargetRegistry();
  const target = { kind: 'haven_tile', familyId: 'mossprout' } as const;
  const firstCleanup = registry.register(target, { frame: { left: 0, top: 0, width: 10, height: 10 }, interactive: true, ready: false });
  const ready = waitForStoryTargets(registry, [target], 100);
  const secondCleanup = registry.register(target, { frame: { left: 2, top: 3, width: 20, height: 20 }, interactive: true, ready: true });
  firstCleanup();
  await ready;
  assert.equal(registry.resolve(target)?.frame.left, 2);
  secondCleanup();
  assert.equal(registry.resolve(target), null);
});

test('local story variants select only registered versioned manifests', () => {
  clearStoryVariantRegistryForTests();
  const alternate = defineStory({ ...MOSSPROUT_FTUE_FLOW, version: MOSSPROUT_FTUE_FLOW.version + 1, metadata: { ...MOSSPROUT_FTUE_FLOW.metadata, variantId: 'alternate' } });
  const variants = defineStoryVariants({
    id: 'test:variants',
    defaultVariantId: 'default',
    variants: [
      { id: 'default', label: 'Default', definition: MOSSPROUT_FTUE_FLOW },
      { id: 'alternate', label: 'Alternate', definition: alternate },
    ],
  });
  registerStoryVariantSet(variants);
  assert.equal(selectedStoryVariant(variants.id).id, 'default');
  selectStoryVariantForDebug(variants.id, 'alternate');
  assert.equal(selectedStoryVariant(variants.id).definition.version, MOSSPROUT_FTUE_FLOW.version + 1);
  assert.throws(() => selectStoryVariantForDebug(variants.id, 'missing'), /Unknown variant/);
  clearStoryVariantRegistryForTests();
});
