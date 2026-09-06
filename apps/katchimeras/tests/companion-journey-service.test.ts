import { stepplingEpisodeFlow } from '../constants/steppling-journey-campaign';
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadNativeModule } from './helpers/native-motion-harness';
import { emptyRelationshipProgressState } from '../game/katchimeras/relationship-progression';
import { currentJourneyCycle, JOURNEY_REST_MS } from '../game/katchimeras/companion-journey-cycle';
import { createInitialMergeWorldState, normalizeMergeWorldState, reduceMergeWorld } from '../utils/merge-world/engine';
import { createContentFlowRun, reduceContentFlow } from '../features/content-flow/content-flow-interpreter';
import { STEPPLING_DAY_ONE_FLOW, STEPPLING_DAY_ONE_RUN_ID } from '../features/content-flow/steppling-day-one-flow';
import type { ContentFlowCommand, ContentFlowDefinition, ContentFlowRun } from '../types/content-flow';
import type { ContentFlowEffectHandler } from '../features/content-flow/content-flow-capabilities';
import type { CompanionStoryArc } from '../utils/companion-story-storage';
import type { CompanionJourneyCycle } from '../types/companion-journey-cycle';

function harness(legacy = false) {
  const clock = { now: Date.now() };
  let relationships = emptyRelationshipProgressState();
  let world = createInitialMergeWorldState(clock.now);
  let story = {
    id: 'steppling:path-outside-story', familyId: 'steppling', status: legacy ? 'order_active' : 'intro_available',
    pendingConversationId: null, completedOrderIds: [], completedBeatIds: [], updatedAt: clock.now,
    actPhase: 'regular_orders', orderDeck: null,
  } as unknown as CompanionStoryArc;
  const definitions = new Map<string, ContentFlowDefinition>();
  const runs = new Map<string, ContentFlowRun>();
  const effects = new Map<string, ContentFlowEffectHandler>();
  const first = createContentFlowRun(STEPPLING_DAY_ONE_FLOW, { runId: STEPPLING_DAY_ONE_RUN_ID, now: clock.now });
  runs.set(first.runId, { ...first, status: 'completed', nodeId: 'complete', completedAt: clock.now, variables: { movementChoice: 'walk' } });
  async function drive(run: ContentFlowRun): Promise<ContentFlowRun> {
    runs.set(run.runId, run);
    const definition = definitions.get(run.definitionId)!;
    const node = definition.nodes.find((item) => item.id === run.nodeId);
    if (node?.kind !== 'effect') return run;
    const effectKey = `${run.runId}:${node.id}:effect:${node.effectId}`;
    try {
      const result = await effects.get(node.effectType)!({ run, payload: node.payload ?? {}, effectKey });
      return drive(reduceContentFlow(definition, run, { type: 'effect_completed', effectKey, result, now: clock.now }).run);
    } catch (error) {
      const failed = reduceContentFlow(definition, run, { type: 'fail', message: String(error), now: clock.now }).run;
      runs.set(run.runId, failed); return failed;
    }
  }
  async function dispatch(runId: string, command: ContentFlowCommand) {
    const run = runs.get(runId)!;
    return drive(reduceContentFlow(definitions.get(run.definitionId)!, run, { ...command, now: clock.now }).run);
  }
  let failGift = false;
  const service = loadNativeModule('features/companion/companion-journey-service.ts', {
    '@/storage/repositories/relationship-progression-repository': { relationshipProgressionRepository: {
      load: () => relationships, update: (reduce: (value: typeof relationships) => typeof relationships) => { relationships = reduce(relationships); return relationships; },
    } },
    '@/utils/companion-life-storage': { acceptDailyStoryHabit() {} },
    '@/utils/companion-life-recording': { recordLifeFlow() {} },
    '@/utils/companion-quick-goal-storage': { loadCompanionQuickGoalState: () => ({ goals: [], storyHabitIds: {} }), saveCompanionQuickGoalState() {} },
    '@/storage/repositories/home-repository': { homeRepository: { load: () => null } },
    '@/utils/companion-story-storage': {
      loadAuthoredCohortStory: () => story,
      saveAuthoredCohortStory: (_family: string, value: CompanionStoryArc) => { story = value; return story; },
      beginAuthoredCohortStory: () => {
        story = { ...story, status: 'order_active', orderDeck: { actId: 'act-1', requiredCount: 5, seed: 'test',
          templateKeys: ['shoes-by-door', 'ticket-no-itinerary', 'familiar-loop', 'walk-and-talk', 'useful-journey'], servedOrderIds: [] } }; return story;
      },
    },
    '@/utils/merge-world/repository': {
      loadMergeWorldState: async () => world,
      reconcileStoredJourneyMeditation: async (cycle: CompanionJourneyCycle, availableAt: number, now: number) => {
        const result = reduceMergeWorld(world, { type: 'reconcileJourneyMeditation', cycle, availableAt, now }); world = result.state; return result;
      },
      grantStoredJourneyReturn: async (cycle: NonNullable<typeof relationships.journeyCycles>[number], dayId: string) => {
        const result = reduceMergeWorld(world, { type: 'grantJourneyReturn', cycle, dayId, now: clock.now }); world = result.state;
        if (failGift) { failGift = false; throw new Error('Process stopped after durable parcel'); }
        return result;
      },
    },
    '@/utils/world-identity': { localDayId: () => '2026-09-04' },
    '@/features/content-flow/content-flow-capabilities': { registerContentFlowEffect: (id: string, effect: ContentFlowEffectHandler) => effects.set(id, effect) },
    '@/features/content-flow/content-flow-catalog': { registerContentFlowDefinition: (definition: ContentFlowDefinition) => definitions.set(definition.id, definition) },
    '@/features/content-flow/content-flow-repository': { loadContentFlowRun: async (id: string) => runs.get(id) ?? null },
    '@/features/content-flow/content-flow-director': {
      dispatchContentFlowCommand: dispatch,
      startContentFlow: async (definition: ContentFlowDefinition, input: { runId: string; variables?: ContentFlowRun['variables'] }) => {
        definitions.set(definition.id, definition);
        return drive(createContentFlowRun(definition, { ...input, now: clock.now }));
      },
      publishContentFlowDomainEvent: async (event: { eventId: string; type: string; payload: { episodeId: string } }) => {
        const run = [...runs.values()].find((item) => item.definitionId === event.payload.episodeId)!;
        await dispatch(run.runId, { type: 'record_event', event: { ...event, runId: run.runId, nodeId: run.nodeId, occurredAt: clock.now } });
      },
    },
  }, { Date: class extends Date { static now() { return clock.now; } } });
  return { service, clock, dispatch, runs, get state() { return relationships; }, get world() { return world; }, get story() { return story; },
    setStory(value: CompanionStoryArc) { story = value; }, failNextGift() { failGift = true; },
    serve(orderId: string) { story = { ...story, completedOrderIds: [...story.completedOrderIds, orderId], orderDeck: story.orderDeck ? { ...story.orderDeck, servedOrderIds: [...story.orderDeck.servedOrderIds, orderId] } : null }; },
  };
}

test('full Steppling chapter: existing Day 1, six cycles, five orders, finale, one gift per ordinary return', async () => {
  const app = harness();
  assert.equal(await app.service.initializeStepplingJourney(), true);
  assert.equal(currentJourneyCycle(app.state, 'steppling')!.participation, 'not_yet', 'Day 1 intention must not become a completed walk');
  for (let number = 1; number <= 6; number++) {
    const cycle = currentJourneyCycle(app.state, 'steppling')!;
    assert.equal(cycle.number, number);
    assert.equal(await app.service.beginNextStepplingEpisode(), null, 'return must be received first');
    app.clock.now += JOURNEY_REST_MS + 1;
    await app.service.claimCompanionJourneyReturn(cycle.id);
    await app.service.claimCompanionJourneyReturn(cycle.id);
    if (number === 6) break;
    let run = await app.service.beginNextStepplingEpisode() as ContentFlowRun;
    const same = await app.service.beginNextStepplingEpisode() as ContentFlowRun;
    assert.equal(same.runId, run.runId);
    const flow = stepplingEpisodeFlow(number + 1);
    for (let guard = 0; guard < flow.nodes.length && run.nodeId !== 'activity'; guard++) {
      const node = flow.nodes.find((item) => item.id === run.nodeId)!;
      assert.equal(node.kind, 'scene');
      if (node.kind !== 'scene') break;
      const action = node.actions?.find((item) => item.id === 'skip') ?? node.actions![0];
      run = await app.dispatch(run.runId, { type: 'submit_scene', actionId: action.id });
    }
    assert.equal(run.nodeId, 'activity');
    await app.service.reconcileStepplingEpisode(run);
    assert.equal(app.story.status, 'order_active');
    const key = app.story.orderDeck!.templateKeys[number - 1];
    app.serve(`merge-story:steppling:chapter-1:${key}`);
    if (number === 5) {
      await app.service.reconcileStepplingEpisode(run);
      assert.equal(app.story.actPhase, 'signature_order');
      app.serve('merge-story:steppling:chapter-1:path-outside');
    }
    run = await app.service.reconcileStepplingEpisode(run);
    assert.equal(run.nodeId, 'resolution');
    await app.dispatch(run.runId, { type: 'submit_scene', actionId: 'continue' });
  }
  assert.equal(app.story.status, 'chapter_complete');
  assert.equal(app.state.journeyCycles!.length, 6);
  assert.equal(app.world.arrivals.length, 5);
  assert.equal(await app.service.beginNextStepplingEpisode(), null);
  assert.equal(normalizeMergeWorldState(app.world).arrivals[0].itemDefinitionIds.length, 2);
});

test('a failed effect after saving a parcel retries without a second parcel or losing the pending return', async () => {
  const app = harness(); await app.service.initializeStepplingJourney();
  const cycle = currentJourneyCycle(app.state, 'steppling')!;
  app.clock.now += JOURNEY_REST_MS + 1;
  app.failNextGift();
  await assert.rejects(app.service.claimCompanionJourneyReturn(cycle.id));
  assert.equal(currentJourneyCycle(app.state, 'steppling')!.returnedAt, null);
  assert.equal(app.world.arrivals.length, 1);
  await app.service.claimCompanionJourneyReturn(cycle.id);
  assert.equal(app.world.arrivals.length, 1);
  assert.equal(currentJourneyCycle(app.state, 'steppling')!.returnedAt, app.clock.now);
});

test('legacy completed chapter migrates without replaying Day 1 or granting gifts', async () => {
  const app = harness(true);
  app.setStory({ ...app.story, status: 'chapter_complete', completedOrderIds: ['merge-story:steppling:chapter-1:path-outside'] });
  await app.service.initializeStepplingJourney();
  assert.equal(app.state.journeyCycles!.length, 6);
  assert.equal(app.state.journeyCycles!.every((cycle) => cycle.migrated && cycle.returnedAt != null), true);
  assert.equal(app.world.arrivals.length, 0);
  assert.equal(await app.service.beginNextStepplingEpisode(), null);
});

test('an existing unfinished legacy conversation is preserved before migration', async () => {
  const app = harness(true);
  app.setStory({ ...app.story, status: 'conversation_active', pendingConversationId: 'steppling:story:6' });
  assert.equal(await app.service.initializeStepplingJourney(), false);
  assert.equal(app.state.journeyCycles?.length ?? 0, 0);
  assert.equal(app.story.pendingConversationId, 'steppling:story:6');
});
