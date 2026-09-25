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
  stabilizeContentFlow,
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

test('foreground stabilization preserves identity, timestamps and revisions at every waiting node', () => {
  for (const nodeId of ['opening', 'grant', 'garden', 'orders', 'reward', 'done']) {
    const initial = { ...createContentFlowRun(COMPLETE_FLOW, { runId: `resume:${nodeId}`, now: 1 }), nodeId };
    const stable = stabilizeContentFlow(COMPLETE_FLOW, initial, 2);
    for (let cycle = 0; cycle < 30; cycle++) {
      const resumed = stabilizeContentFlow(COMPLETE_FLOW, stable.run, 100 + cycle);
      assert.equal(resumed.run, stable.run, nodeId);
      assert.deepEqual(resumed.pendingWork, stable.pendingWork, nodeId);
    }
  }
});

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

test('the Last Clearing resumes at every boundary: cold open, guardian, first battle, the Mist pulls back', () => {
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
      for (let index = 0; index < (requirement.count ?? 1); index++) {
        const event = { eventId: `command:${commands}:${index}`, type: requirement.event.type, runId: run.runId, nodeId: run.nodeId, payload: requirement.event.where ?? {}, occurredAt: commands };
        assert.equal(reduceContentFlow(flow, run, { type: 'record_event', event: { ...event, runId: 'unrelated' } }).run.nodeId, run.nodeId);
        events.push(event.type);
        run = reduceContentFlow(flow, run, { type: 'record_event', event }).run;
      }
    } else assert.fail(`Unhandled FTUE node ${node.id}`);
  }
  assert.equal(run.status, 'completed');
  assert.equal(events.filter((type) => type === 'ftue.battle_won').length, 4, 'the first battle and the Lost Trail\u2019s three are each won once');
  assert.equal(events.filter((type) => type === 'ftue.item_spawned').length, 0);
  for (const beat of ['world.mist_open', 'world.guardian', 'world.mist_clear', 'world.mist_lift', 'effect.haven.opening_glow'] as const) assert.ok(visited.has(beat), beat);
  // The Egg, the hatch meeting, the Garden and the first rest are retired: never visited, and an old run ends.
  for (const removed of ['egg.opening', 'egg.ready', 'companion.first_meeting', 'world.garden_arrival', 'world.first_seed_grew', 'companion.meditating', 'effect.haven.start_glow_discovery', 'merge.seed_drag'] as const) {
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
  assert.equal(dayTwo.nodes.some((node) => node.kind === 'effect' && node.effectType === 'resident.grant_parcel'), false);
  assert.ok(dayTwo.nodes.some((node) => node.kind === 'effect' && node.effectType === 'journey.wisp_reward'));
  assert.ok(dayTwo.nodes.some((node) => node.kind === 'presentation' && node.presentationType === 'journey.wisp_reward_reveal'));
  const legacyResidentNode = 'mossprout:journey:quiet-patch:pond-knock:resident:card-reward';
  assert.equal(dayTwo.migrations?.[legacyResidentNode], 'mossprout:journey:quiet-patch:pond-knock:wisp');
});

test('the shipping FTUE is the Last Clearing, a direct data-driven Content Flow manifest', () => {
  const flow = MOSSPROUT_FTUE_FLOW;
  assert.deepEqual(validateContentFlowDefinition(flow), []);
  assert.equal(flow.metadata.authoring, 'content-flow');
  assert.equal(flow.entryNodeId, MOSSPROUT_FTUE_SCRIPT.entryStepId);
  assert.equal(flow.nodes.find((node) => node.id === MOSSPROUT_FTUE_SCRIPT.terminalStepId)?.kind, 'complete');
  assert.deepEqual(flow.nodes.map((node) => node.id), ['world.mist_open', 'world.guardian', 'world.mist_clear', 'world.mist_lift', 'effect.haven.opening_glow', 'world.heart_tree', 'effect.haven.restore_heart_tree', 'world.sanctuary_founded', 'world.frontier', 'world.lost_tracks', 'world.lost_trail_mission', 'world.trail_stone_1', 'world.trail_stone_2', 'world.trail_stone_3', 'world.steppling_rescued', 'world.steppling_meets', 'effect.haven.steppling_joins', 'world.steppling_joined', 'world.home', 'complete']);
  assert.equal(flow.nodes.some((node) => node.id.startsWith('egg.')), false, 'no Egg: Mossprout is there from the first frame');
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
