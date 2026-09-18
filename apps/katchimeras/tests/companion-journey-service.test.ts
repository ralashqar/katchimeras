import assert from 'node:assert/strict';
import test from 'node:test';
import { loadNativeModule } from './helpers/native-motion-harness';
import { beginKatchimeraMeditation, emptyRelationshipProgressState } from '../game/katchimeras/relationship-progression';
import { currentJourneyCycle, journeyCycleReady } from '../game/katchimeras/companion-journey-cycle';
import { createInitialMergeWorldState, reduceMergeWorld } from '../utils/merge-world/engine';
import { createContentFlowRun, reduceContentFlow } from '../features/content-flow/content-flow-interpreter';
import { STEPPLING_DAY_ONE_FLOW, STEPPLING_DAY_ONE_RUN_ID } from '../features/content-flow/steppling-day-one-flow';
import { STEPPLING_CHAPTER } from '../constants/companion-journey-chapters/steppling';
import { FEASTLE_CHAPTER } from '../constants/companion-journey-chapters/feastle';
import { reconcileJourneyGardenOrders } from '../features/companion/journey-garden-orders';
import { hatchableByCompanion } from '../constants/hatchable-companions/registry';
import { journeyEpisodeConversation } from '../constants/companion-journey-chapters/episode-conversation';
import { emptyCompanionBondState } from '../utils/companion-bond';
import type { ContentFlowCommand, ContentFlowDefinition, ContentFlowRun } from '../types/content-flow';
import type { ContentFlowEffectHandler } from '../features/content-flow/content-flow-capabilities';
import type { CompanionStoryArc } from '../utils/companion-story-storage';
import type { CompanionJourneyCycle } from '../types/companion-journey-cycle';
import type { ConversationSession } from '../types/companion-conversation';

const HOUR = 60 * 60 * 1000;

function harness(legacy = false) {
  const clock = { now: Date.now() };
  let relationships = emptyRelationshipProgressState();
  let world = createInitialMergeWorldState(clock.now);
  let bond = emptyCompanionBondState();
  const journal = new Map<string, unknown>();
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
    '@/utils/game-clock': { gameNow: () => clock.now },
    '@/storage/repositories/relationship-progression-repository': { relationshipProgressionRepository: {
      load: () => relationships, update: (reduce: (value: typeof relationships) => typeof relationships) => { relationships = reduce(relationships); return relationships; },
    } },
    '@/utils/companion-life-storage': { acceptDailyStoryHabit() {}, rememberCompanionMoment: (entry: { id: string }) => journal.set(entry.id, entry) },
    '@/features/companion/journey-consequences': { registerJourneyConsequenceFlows() {}, resumeJourneyConsequences: async () => {}, startJourneyConsequence: async () => null },
    '@/utils/companion-life-recording': { recordLifeFlow() {} },
    '@/utils/companion-life': { selectedStoryHabit: () => null },
    '@/utils/companion-quick-goal-storage': { loadCompanionQuickGoalState: () => ({ goals: [], storyHabitIds: {} }), saveCompanionQuickGoalState() {} },
    '@/utils/companion-quick-goals': { updateCompanionQuickGoal: (state: unknown) => state },
    '@/storage/repositories/home-repository': { homeRepository: { load: () => null } },
    '@/constants/katchimera-skins': { companionIdForFamily: (family: string) => `companion:${family}` },
    '@/utils/companion-bond-storage': { loadCompanionBondState: () => bond, saveCompanionBondState: (state: typeof bond) => { bond = state; } },
    '@/utils/companion-story-storage': {
      isAuthoredCohortFamily: (familyId: string) => hatchableByCompanion(familyId) != null,
      loadAuthoredCohortStory: () => story,
      saveAuthoredCohortStory: (_family: string, value: CompanionStoryArc) => { story = value; return story; },
      beginAuthoredCohortStory: () => {
        story = { ...story, status: 'order_active', orderDeck: { actId: 'act-1', requiredCount: 5, seed: 'test',
          templateKeys: ['shoes-by-door', 'ticket-no-itinerary', 'familiar-loop', 'walk-and-talk', 'useful-journey'], servedOrderIds: [] } }; return story;
      },
    },
    '@/utils/merge-world/repository': {
      ensureStoredJourneyGardenOrders: async () => { world = reconcileJourneyGardenOrders(world, relationships, clock.now); },
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
    },
  }, { Date: class extends Date { static now() { return clock.now; } } });
  return { service, clock, runs, journal, get state() { return relationships; }, get world() { return world; }, get story() { return story; }, get bond() { return bond; },
    setStory(value: CompanionStoryArc) { story = value; }, failNextGift() { failGift = true; },
    setRelationships(value: typeof relationships) { relationships = value; },
    serve(orderId: string) { story = { ...story, completedOrderIds: [...story.completedOrderIds, orderId], orderDeck: story.orderDeck ? { ...story.orderDeck, servedOrderIds: [...story.orderDeck.servedOrderIds, orderId] } : null }; },
  };
}

function sessionFor(definitionId: string, turns: { nodeId: string; optionId: string }[], completedAt: number): ConversationSession {
  return { id: `session:${definitionId}`, familyId: 'steppling', definitionId, definitionVersion: 1, formId: 'steppling', createdDayId: '2026-09-04', servedDayId: '2026-09-04',
    status: 'completed', createdAt: completedAt - 1, updatedAt: completedAt, completedAt, currentNodeId: 'end', turns: turns.map((turn, index) => ({ id: `turn:${index}`, ...turn, answeredAt: completedAt })),
    affinityScores: {}, outcomeIds: [], evidenceRefs: [] } as unknown as ConversationSession;
}

test('the first meeting records day one and starts the friend reflecting; an episode records its answers, pays once and reflects again', async () => {
  const app = harness();
  assert.equal(await app.service.initializeJourney('steppling'), true);
  assert.ok(app.state.journeyEpisodes?.['steppling:day-1'], 'day one is the first episode');
  const cycle = currentJourneyCycle(app.state, 'steppling')!;
  assert.equal(cycle.number, 1);
  assert.equal(cycle.participation, 'not_yet', 'Day 1 intention must not become a completed walk');
  assert.equal(journeyCycleReady(app.state, cycle, app.clock.now + 4 * HOUR - 1), false, 'a chapter reflects for its own pause');
  assert.equal(journeyCycleReady(app.state, cycle, app.clock.now + 4 * HOUR), true);
  assert.equal(app.bond.events.length, 0, 'day one pays no journey Bond');
  app.clock.now += 4 * HOUR + 1;
  await app.service.claimCompanionJourneyReturn(cycle.id);
  await app.service.claimCompanionJourneyReturn(cycle.id);
  assert.equal(app.world.arrivals.length, 1, 'one gift per return');
  const compiled = journeyEpisodeConversation(STEPPLING_CHAPTER, STEPPLING_CHAPTER.episodes[1]!)!;
  const opening = compiled.definition.nodes[0]!;
  assert.ok(opening.kind === 'choice');
  const session = sessionFor(compiled.definition.id, [{ nodeId: opening.id, optionId: opening.options[0]!.id }], app.clock.now);
  assert.equal(app.service.completeJourneyEpisode('steppling', 'day-2', { session, now: app.clock.now }), true);
  assert.equal(app.service.completeJourneyEpisode('steppling', 'day-2', { session, now: app.clock.now }), false, 'recorded once');
  const record = app.state.journeyEpisodes!['steppling:day-2']!;
  assert.equal(record.answers[opening.id], opening.options[0]!.id);
  assert.equal(app.bond.events.length, 1);
  assert.equal(app.bond.events[0]!.id, 'journey:steppling:day-2');
  assert.equal(app.bond.events[0]!.points, 20);
  assert.ok(app.journal.has('journey:steppling:day-2'), 'the episode is a journal moment');
  const next = currentJourneyCycle(app.state, 'steppling')!;
  assert.equal(next.number, 2);
  assert.equal(next.returnedAt, null, 'the friend reflects after the episode');
  assert.equal(app.story.status, 'order_active', 'the chapter orders stay open while episodes remain');
});

test('Mossprout’s arc begins with the first session: managed once the farewell’s rest exists, day one recorded then, no rest of its own', async () => {
  const app = harness();
  assert.equal(await app.service.initializeJourney('mossprout'), false, 'before the first session ends there is nothing to manage');
  assert.equal(await app.service.journeyDayOneComplete('mossprout'), false);
  const startedAt = app.clock.now - 2 * HOUR;
  app.setRelationships(beginKatchimeraMeditation(app.state, 'mossprout', startedAt, 8 * HOUR, 'ftue:test:first-rest'));
  assert.equal(await app.service.initializeJourney('mossprout'), true);
  assert.equal(await app.service.journeyDayOneComplete('mossprout'), true);
  const record = app.state.journeyEpisodes?.['mossprout:quiet-patch:first-flower'];
  assert.equal(record?.completedAt, startedAt, 'day one happened when the farewell did');
  assert.equal(currentJourneyCycle(app.state, 'mossprout'), null, 'the first session starts no pause of its own');
  assert.equal(app.bond.events.length, 0);
  await app.service.initializeJourney('mossprout');
  assert.equal(Object.keys(app.state.journeyEpisodes ?? {}).length, 1, 'once');
  // A save from the campaign's day-and-rest era: every completed day is its beat's opening and resolution, recorded once, paying nothing.
  const dayAt = startedAt + 9 * HOUR;
  app.setRelationships({ ...app.state, journeyDays: [{ id: 'journey:mossprout:2026-09-05', dayId: '2026-09-05', familyId: 'mossprout', status: 'complete', chapterId: 'mossprout:chapter:quiet-patch', beatId: 'quiet-patch:pond-knock',
    openingConversationId: null, profileConversationId: null, matchedCardId: null, returnConversationId: null, activity: null, resolutionAvailableAt: null, signalReceiptIds: [], activityReceiptIds: [], resolutionId: 'r', actions: [], startedAt: dayAt - HOUR, completedAt: dayAt, completionReceipt: null }] });
  await app.service.initializeJourney('mossprout');
  assert.deepEqual(Object.keys(app.state.journeyEpisodes ?? {}).sort(), ['mossprout:quiet-patch:first-flower', 'mossprout:quiet-patch:pond-knock', 'mossprout:quiet-patch:pond-knock:resolution']);
  assert.equal(app.state.journeyEpisodes!['mossprout:quiet-patch:pond-knock:resolution']!.migrated, true);
  assert.equal(app.bond.events.length, 0, 'a migrated day pays nothing again');
  await app.service.initializeJourney('mossprout');
  assert.equal(Object.keys(app.state.journeyEpisodes ?? {}).length, 3, 'once');
});

test('a failed effect after saving a parcel retries without a second parcel or losing the pending return', async () => {
  const app = harness(); await app.service.initializeJourney('steppling');
  const cycle = currentJourneyCycle(app.state, 'steppling')!;
  app.clock.now += 4 * HOUR + 1;
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
  await app.service.initializeJourney('steppling');
  assert.equal(Object.keys(app.state.journeyEpisodes ?? {}).length, 6);
  assert.ok(Object.values(app.state.journeyEpisodes!).every((record) => record.migrated));
  assert.equal(app.world.arrivals.length, 0);
  assert.equal(app.bond.events.length, 0);
  assert.equal(app.story.status, 'chapter_complete');
});

test('cycles from the day-and-rest era become complete episodes, once', async () => {
  const app = harness();
  app.setStory({ ...app.story, journeyManaged: true, status: 'conversation_active' } as CompanionStoryArc);
  app.setRelationships({ ...app.state, journeyCycles: [1, 2, 3].map((number) => ({
    id: `journey-cycle:steppling:steppling:journey:day-${number}`, familyId: 'steppling', episodeId: `steppling:journey:day-${number}`, number, chapterId: 'steppling-chapter-1',
    title: `Day ${number}`, nextTitle: null, completedAt: app.clock.now - (4 - number) * HOUR, participation: 'not_yet', requests: [], stepBaselines: {}, stepProgress: 0, observedSteps: {},
    returnStartedAt: null, returnedAt: number < 3 ? app.clock.now : null, rewardId: `gift-${number}`, finale: false,
  })) });
  await app.service.initializeJourney('steppling');
  assert.deepEqual(Object.keys(app.state.journeyEpisodes ?? {}).sort(), ['steppling:day-1', 'steppling:day-2', 'steppling:day-3']);
  await app.service.initializeJourney('steppling');
  assert.equal(Object.keys(app.state.journeyEpisodes ?? {}).length, 3);
});

test('an existing unfinished legacy conversation is preserved before migration', async () => {
  const app = harness(true);
  app.setStory({ ...app.story, status: 'conversation_active', pendingConversationId: 'steppling:story:6' });
  assert.equal(await app.service.initializeJourney('steppling'), false);
  assert.equal(Object.keys(app.state.journeyEpisodes ?? {}).length, 0);
  assert.equal(app.story.pendingConversationId, 'steppling:story:6');
});

test('Feastle recovers retired pantry return dialogue and opens his authored chapter without replaying rewards', async () => {
  const app = harness();
  app.setStory({ ...app.story, familyId: 'feastle', status: 'return_available', pendingConversationId: 'feastle:friendship:2', completedOrderIds: ['feastle:discovery:first-snack'] });
  const first = app.runs.get(STEPPLING_DAY_ONE_RUN_ID)!;
  app.runs.set(FEASTLE_CHAPTER.dayOne.runId, { ...first, runId: FEASTLE_CHAPTER.dayOne.runId, definitionId: FEASTLE_CHAPTER.dayOne.flowId });
  assert.equal(await app.service.initializeJourney('feastle'), true);
  assert.equal(app.story.pendingConversationId, null);
  assert.equal(app.story.journeyManaged, true);
  assert.ok(app.state.journeyEpisodes?.['feastle:day-1']);
  assert.equal(app.state.journeyEpisodes?.['feastle:day-2'], undefined);
  assert.ok(app.story.completedOrderIds.includes('feastle:discovery:first-snack'), 'keep delivery history');
  assert.equal(await app.service.initializeJourney('feastle'), true);
  assert.equal(Object.keys(app.state.journeyEpisodes ?? {}).length, 1);
  assert.equal(app.bond.events.length, 0);
  assert.equal(app.world.arrivals.length, 0);
});

test('reopening an already-managed Feastle chapter repairs missing Garden orders without resetting progress', async () => {
  const app = harness();
  app.setStory({ ...app.story, familyId: 'feastle', journeyManaged: true, status: 'conversation_active' });
  app.setRelationships({ ...app.state, journeyEpisodes: Object.fromEntries(['day-1', 'day-2'].map(episodeId => [`feastle:${episodeId}`, { familyId: 'feastle', episodeId, completedAt: app.clock.now, answers: {}, facts: {} }])) });
  const before = JSON.stringify(app.state);
  assert.equal(await app.service.initializeJourney('feastle'), true);
  assert.ok(app.world.activeOrders.some(order => order.id === 'feastle:chapter-1:doorstep-snacks'));
  assert.equal(JSON.stringify(app.state), before);
  const world = app.world;
  await app.service.initializeJourney('feastle');
  assert.equal(app.world, world);
  assert.equal(app.bond.events.length, 0);
});

test('orders reach the signature once enough are served and the chapter completes with its last episode', async () => {
  const app = harness();
  await app.service.initializeJourney('steppling');
  for (const key of app.story.orderDeck!.templateKeys) app.serve(`merge-story:steppling:chapter-1:${key}`);
  app.service.projectJourneyOrders('steppling');
  assert.equal(app.story.actPhase, 'signature_order');
  for (const episode of STEPPLING_CHAPTER.episodes.slice(1)) {
    app.clock.now += 9 * HOUR;
    const cycle = currentJourneyCycle(app.state, 'steppling')!;
    await app.service.claimCompanionJourneyReturn(cycle.id);
    app.service.completeJourneyEpisode('steppling', episode.id, { now: app.clock.now });
  }
  assert.equal(app.story.status, 'chapter_complete');
  assert.equal(app.story.actPhase, 'complete');
  assert.equal(currentJourneyCycle(app.state, 'steppling')!.finale, true);
});

test('Feastle delivery closes with one Bond reward and one queued celebration', () => {
  const app = harness();
  app.service.completeJourneyEpisode('feastle', 'day-2', { now: app.clock.now });
  assert.equal(app.bond.events.filter(event => event.id === 'journey:feastle:day-2').length, 0, 'intro does not pay before delivery');
  app.service.completeJourneyEpisode('feastle', 'day-2-return', { now: app.clock.now + 1000 });
  assert.equal(app.bond.events.filter(event => event.id === 'journey:feastle:day-2').length, 1);
  assert.equal(app.bond.pendingCelebrations?.filter(receipt => receipt.eventId === 'journey:feastle:day-2').length, 1);
  assert.equal(app.service.completeJourneyEpisode('feastle', 'day-2-return'), false);
  assert.equal(app.bond.pendingCelebrations?.filter(receipt => receipt.eventId === 'journey:feastle:day-2').length, 1);
});

test('existing Feastle progress beyond a delivery does not replay its new closing scene', async () => {
  const app = harness();
  app.setStory({ ...app.story, familyId: 'feastle', journeyManaged: true });
  app.setRelationships({ ...app.state, journeyEpisodes: Object.fromEntries(['day-1', 'day-2', 'day-3'].map(episodeId => [`feastle:${episodeId}`, { familyId: 'feastle', episodeId, completedAt: app.clock.now, answers: {}, facts: {} }])) });
  await app.service.initializeJourney('feastle');
  assert.ok(app.state.journeyEpisodes?.['feastle:day-2-return']);
  assert.equal(app.bond.events.length, 0);
});

test('Mossprout stays managed after old rest/history is replaced: the saved first episode is authoritative', async () => {
  const app = harness();
  const { journeyChapterFor } = await import('@/constants/companion-journey-chapters/registry');
  const first = journeyChapterFor('mossprout')!.episodes.find(episode => episode.dayOne)!;
  app.setRelationships({ ...app.state, meditations: [], journeyCycles: [], journeyDays: [], journeyEpisodes: {
    [`mossprout:${first.id}`]: { familyId: 'mossprout', episodeId: first.id, completedAt: app.clock.now - 8 * HOUR, answers: {}, facts: {} },
  } });
  assert.equal(await app.service.initializeJourney('mossprout'), true);
  assert.equal(await app.service.journeyDayOneComplete('mossprout'), true);
  assert.equal(await app.service.initializeJourney('mossprout'), true, 'reentry is stable');
  assert.equal(app.bond.events.length, 0, 'recognizing saved progress cannot replay rewards');
});
