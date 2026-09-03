import assert from 'node:assert/strict';
import test from 'node:test';

import {
  acknowledgeKatchimeraActionCompletion,
  activeKatchimeraMeditation,
  attachKatchimeraActionRewardReceipt,
  beginKatchimeraMeditation,
  companionInteractionAvailability,
  beginMossproutJourneyReturn,
  completeMossproutJourneyConversation,
  completeMossproutJourneyDay,
  completeMossproutFocusAction,
  completeMossproutJourneyGoalPlan,
  completeMossproutJourneyOpening,
  completeMossproutResidentCardDiscovery,
  emptyRelationshipProgressState,
  isMossproutFtueRoutineActionId,
  katchimeraMeditationRecord,
  makeMossproutResolutionAvailable,
  mossproutDailyActionDeck,
  mossproutJourneyForDay,
  mossproutStory,
  normalizeRelationshipProgressState,
  reconcileMossproutDayOneChoices,
  recordMossproutFirstGardenRestored,
  recordKatchimeraActionCompletion,
  recordHandledKatchimeraActionCompletion,
  recordMossproutJourneyOrderServed,
  recordMossproutMatchedCard,
  resetLastMossproutJourneyForDebug,
  resetRelationshipProgressForDayForDebug,
  settleKatchimeraMeditation,
  skipKatchimeraDayAction,
  startMossproutJourneyActivity,
  startMossproutJourneyDay,
} from '../game/katchimeras/relationship-progression';
import { mossproutStoryConversationDefinitions } from '../constants/mossprout-story-conversations';
import { MOSSPROUT_CAMPAIGN_EPISODES } from '../constants/mossprout-campaign';
import { MOSSPROUT_JOURNEY_CAMPAIGN } from '../constants/mossprout-journey-campaign';
import { validateJourneyCampaign } from '../game/katchimeras/journey-campaign';
import { mossproutCampaignConversationDefinitions } from '../constants/mossprout-campaign-conversations';
import { MOSSPROUT_DAILY_FIELD_NOTE_ACTION_ID, mossproutActionInstanceId, mossproutActiveConversationAction, mossproutConversationActionCompletion, mossproutConversationArtKey, mossproutGoalArtKey, resolveMossproutDayActions, resolveMossproutHome } from '../game/katchimeras/mossprout-home';
import { actionCommandFromOrigin, claimActionPresentation, commitActionCompletion, completeDayOneLesson, createActionBoardSnapshot, dismissActionPresentation, reconcileActionPresentationsAfterHydration } from '../game/katchimeras/action-runtime';
import type { JourneyDayRecord, KatchimeraActionOrigin, KatchimeraDayAction, RelationshipProgressState } from '../types/relationship-progression';
import { mossproutJourneyDayNumber, mossproutJourneyDayNumberForCompletionEvent, resolveMossproutJourneyHandoff } from '../game/katchimeras/mossprout-journey-handoff';

function firstJourneyCompleteState(dayId = '2026-08-23'): RelationshipProgressState {
  const journey: JourneyDayRecord = {
    id: `journey-day:${dayId}:mossprout`,
    dayId,
    familyId: 'mossprout',
    status: 'complete',
    chapterId: 'mossprout:chapter:quiet-patch',
    beatId: 'quiet-patch:first-flower',
    openingConversationId: null,
    profileConversationId: null,
    matchedCardId: 'mossprout-form:mossling',
    returnConversationId: null,
    activity: null,
    resolutionAvailableAt: null,
    signalReceiptIds: [],
    activityReceiptIds: [],
    resolutionId: 'quiet-patch:first-flower:resolution',
    actions: [],
    startedAt: new Date(`${dayId}T10:00:00`).getTime(),
    completedAt: new Date(`${dayId}T11:00:00`).getTime(),
    completionReceipt: {
      id: `journey-complete:${dayId}:mossprout`,
      journeyId: `journey-day:${dayId}:mossprout`,
      familyId: 'mossprout',
      dayId,
      beatId: 'quiet-patch:first-flower',
      bondPoints: 20,
      completedActivity: true,
      offeredGoal: true,
      cardId: 'mossprout-form:mossling',
      completedActionIds: [],
      createdAt: new Date(`${dayId}T11:00:00`).getTime(),
    },
  };
  return { ...emptyRelationshipProgressState(), journeyDays: [journey] };
}

function finishDayOneResident(state: RelationshipProgressState, dayId: string, now: number) {
  const matched = recordMossproutMatchedCard(state, dayId, 'petalimp');
  return completeMossproutResidentCardDiscovery(matched, dayId, 'petalimp', `test-resident:${dayId}`, now);
}

test('first Journey Day handoff changes from completion to waiting and then Day 2 ready', () => {
  const relationships = firstJourneyCompleteState();
  const completedAt = relationships.journeyDays[0]!.completedAt!;
  assert.equal(resolveMossproutJourneyHandoff({ dayId: '2026-08-23', ftueStatus: 'active', relationships, now: completedAt })?.state, 'completed_today');

  const waiting = resolveMossproutJourneyHandoff({ dayId: '2026-08-23', ftueStatus: 'complete', relationships, now: completedAt + 1 });
  assert.equal(waiting?.state, 'waiting_for_next_day');
  assert.match(waiting?.body ?? '', /eight hours/);

  const ready = resolveMossproutJourneyHandoff({ dayId: '2026-08-23', ftueStatus: 'complete', relationships, now: completedAt + 8 * 60 * 60 * 1000 });
  assert.equal(ready?.state, 'ready_to_begin');
  assert.equal(ready?.title, 'Journey Day 2 is ready');
  assert.equal(mossproutJourneyDayNumber(relationships, '2026-08-24'), 2);
});

test('starting Day 2 removes the initial Home handoff hook', () => {
  const relationships = firstJourneyCompleteState();
  relationships.journeyDays.push({
    ...relationships.journeyDays[0]!,
    id: 'journey-day:2026-08-24:mossprout',
    dayId: '2026-08-24',
    beatId: 'dry-pond:day-1',
    chapterId: 'mossprout:chapter:dry-pond',
    status: 'opening',
    completionReceipt: null,
    completedAt: null,
    startedAt: new Date('2026-08-24T09:00:00').getTime(),
  });
  assert.equal(resolveMossproutJourneyHandoff({ dayId: '2026-08-24', ftueStatus: 'complete', relationships }), null);
});

test('the eight-hour rest can start Journey Day 2 on the same calendar date', () => {
  const state = firstJourneyCompleteState();
  const completedAt = state.journeyDays[0]!.completedAt!;
  assert.equal(startMossproutJourneyDay(state, '2026-08-23', completedAt + 8 * 60 * 60 * 1000 - 1, 1).reason, 'existing');
  const started = startMossproutJourneyDay(state, '2026-08-23', completedAt + 8 * 60 * 60 * 1000, 1);
  assert.equal(started.reason, 'started');
  assert.equal(started.journey?.beatId, 'quiet-patch:pond-knock');
  assert.equal(started.journey?.dayId, '2026-08-23:mossprout-journey-02');
  assert.equal(mossproutJourneyDayNumber(started.state, '2026-08-23'), 2);
});

test('meditation is durable Katchimera state and owns the Journey wake time', () => {
  const journeyCompletedAt = new Date('2026-08-23T11:00:00').getTime();
  const meditationStartedAt = journeyCompletedAt + 20_000;
  const availableAt = meditationStartedAt + 8 * 60 * 60 * 1000;
  const state = beginKatchimeraMeditation(
    firstJourneyCompleteState(),
    'mossprout',
    meditationStartedAt,
    8 * 60 * 60 * 1000,
  );

  assert.equal(katchimeraMeditationRecord(state, 'mossprout')?.availableAt, availableAt);
  assert.equal(activeKatchimeraMeditation(state, 'mossprout', availableAt - 1)?.reason, 'journey_rest');
  assert.equal(activeKatchimeraMeditation(state, 'mossprout', availableAt), null);
  assert.equal(resolveMossproutJourneyHandoff({ dayId: '2026-08-23', ftueStatus: 'complete', relationships: state, now: availableAt - 1 })?.availableAt, availableAt);
  assert.equal(startMossproutJourneyDay(state, '2026-08-23', availableAt - 1, 1).reason, 'existing');
  assert.equal(startMossproutJourneyDay(state, '2026-08-23', availableAt, 1).reason, 'started');
});

test('meditation commands are idempotent by story source and gate companion actions', () => {
  const initial = emptyRelationshipProgressState();
  const once = beginKatchimeraMeditation(initial, 'mossprout', 1_000, 8_000, 'ftue:run:first-rest');
  const replayed = beginKatchimeraMeditation(once, 'mossprout', 5_000, 8_000, 'ftue:run:first-rest');

  assert.equal(replayed, once);
  assert.equal(katchimeraMeditationRecord(replayed, 'mossprout')?.availableAt, 9_000);
  assert.equal(companionInteractionAvailability(replayed, 'mossprout', 8_999).kind, 'meditating');
  assert.equal(companionInteractionAvailability(replayed, 'mossprout', 9_000).kind, 'available');
});

test('meditation settling is capped and idempotent per optional interaction', () => {
  const initial = beginKatchimeraMeditation(emptyRelationshipProgressState(), 'mossprout', 1_000, 8 * 60 * 60 * 1000, 'ftue:rest');
  const water = settleKatchimeraMeditation(initial, 'mossprout', 20 * 60 * 1000, 'water', 2_000);
  const replay = settleKatchimeraMeditation(water, 'mossprout', 20 * 60 * 1000, 'water', 2_001);
  const thought = settleKatchimeraMeditation(replay, 'mossprout', 10 * 60 * 1000, 'thought', 2_002);
  const capped = settleKatchimeraMeditation(thought, 'mossprout', 60 * 60 * 1000, 'extra', 2_003);
  assert.equal(katchimeraMeditationRecord(replay, 'mossprout')?.availableAt, katchimeraMeditationRecord(water, 'mossprout')?.availableAt);
  assert.equal(katchimeraMeditationRecord(capped, 'mossprout')?.settledMs, 30 * 60 * 1000);
  assert.equal(katchimeraMeditationRecord(capped, 'mossprout')?.settlementReceiptIds?.length, 2);
});

test('Journey Day 1 supports a complete manual narrative flow without FTUE', () => {
  const dayId = '2026-08-23';
  let state = startMossproutJourneyDay(emptyRelationshipProgressState(), dayId, 1, 0).state;
  let journey = mossproutJourneyForDay(state, dayId);

  assert.equal(journey?.status, 'opening');
  assert.equal(journey?.openingConversationId, MOSSPROUT_CAMPAIGN_EPISODES[0].openingConversationId);

  state = completeMossproutJourneyConversation(state, MOSSPROUT_CAMPAIGN_EPISODES[0].openingConversationId, 2);
  journey = mossproutJourneyForDay(state, dayId);
  assert.equal(journey?.status, 'activity_available');
  assert.equal(journey?.activity?.mergeOrderId, 'mossprout:chapter-0:first-sprout');

  state = startMossproutJourneyActivity(state, dayId);
  assert.equal(mossproutJourneyForDay(state, dayId)?.status, 'activity_in_progress');
  state = recordMossproutFirstGardenRestored(state, dayId, 'merge-order:mossprout:chapter-0:first-sprout', 3);
  assert.equal(mossproutJourneyForDay(state, dayId)?.status, 'resolution_ready');
  assert.equal(mossproutJourneyForDay(state, dayId)?.returnConversationId, 'mossprout:ftue:chapter-zero-return');

  state = completeMossproutJourneyConversation(state, 'mossprout:ftue:chapter-zero-return', 4);
  assert.equal(mossproutJourneyForDay(state, dayId)?.status, 'complete');
});

test('Journey Day 1 manual opening is authored in Mossprout’s first-person voice', () => {
  const definition = mossproutCampaignConversationDefinitions.find((candidate) => (
    candidate.id === MOSSPROUT_CAMPAIGN_EPISODES[0].openingConversationId
  ));
  assert.ok(definition);
  assert.match(definition.nodes[0]?.kind === 'choice' ? definition.nodes[0].prompt : '', /^I found/);
  assert.match(definition.nodes[1]?.kind === 'end' ? definition.nodes[1].message : '', /^Let’s grow/);
});

test('Journey Day 2 runs opening, two authored orders, return, and completion', () => {
  let state = emptyRelationshipProgressState();
  state = startMossproutJourneyDay(state, '2026-08-23', 1, 0).state;
  state = completeMossproutJourneyDay(state, '2026-08-23', {
    objectiveId: 'mossprout:objective:first-sprout',
    activityReceiptId: 'merge-order:mossprout:chapter-0:first-sprout',
    resolutionId: 'mossprout:ftue:chapter-zero-return',
  }, 2);

  const started = startMossproutJourneyDay(state, '2026-08-24', 3, 1);
  assert.equal(started.reason, 'started');
  assert.equal(started.journey?.status, 'opening');
  assert.equal(started.journey?.beatId, 'quiet-patch:pond-knock');
  assert.equal(started.journey?.openingConversationId, 'mossprout:campaign-v2:quiet-patch:pond-knock:opening');
  assert.equal(started.journey?.activity, null);

  let progressed = completeMossproutJourneyOpening(started.state, '2026-08-24', 4);
  let journey = mossproutJourneyForDay(progressed, '2026-08-24');
  assert.equal(journey?.status, 'activity_available');
  assert.deepEqual(journey?.activity?.mergeOrderIds, [
    'merge-story:mossprout:quiet-patch:listening-place',
    'merge-story:mossprout:quiet-patch:path-for-water',
  ]);
  assert.deepEqual(journey?.activity?.dropDefinitionIds, [
    'nature:waterside:1', 'nature:waterside:1',
    'nature:garden:1', 'nature:garden:1', 'nature:waterside:1',
  ]);
  const staleSave = {
    ...progressed,
    journeyDays: progressed.journeyDays.map((candidate) => candidate.dayId === '2026-08-24' && candidate.activity
      ? { ...candidate, activity: { ...candidate.activity, dropDefinitionIds: [] } }
      : candidate),
  };
  assert.deepEqual(
    mossproutJourneyForDay(normalizeRelationshipProgressState(staleSave), '2026-08-24')?.activity?.dropDefinitionIds,
    journey?.activity?.dropDefinitionIds,
  );
  progressed = startMossproutJourneyActivity(progressed, '2026-08-24');
  progressed = recordMossproutJourneyOrderServed(progressed, 'merge-story:mossprout:quiet-patch:listening-place', 5);
  assert.equal(mossproutJourneyForDay(progressed, '2026-08-24')?.status, 'activity_in_progress');
  progressed = recordMossproutJourneyOrderServed(progressed, 'merge-story:mossprout:quiet-patch:path-for-water', 6);
  assert.equal(mossproutJourneyForDay(progressed, '2026-08-24')?.status, 'return_available');
  progressed = beginMossproutJourneyReturn(progressed, '2026-08-24');
  progressed = completeMossproutJourneyConversation(progressed, MOSSPROUT_CAMPAIGN_EPISODES[1].resolutionConversationId!, 7);
  journey = mossproutJourneyForDay(progressed, '2026-08-24');
  assert.equal(journey?.status, 'complete');
  assert.ok(mossproutStory(progressed).completedBeatIds?.includes('quiet-patch:pond-knock'));
  const eventId = journey?.completionReceipt?.id;
  assert.ok(eventId);
  assert.equal(mossproutJourneyDayNumberForCompletionEvent(progressed, eventId), 2);
});

test('an active Journey Day exclusively owns Mossprout action cards', () => {
  let state = firstJourneyCompleteState('2026-08-23');
  state = startMossproutJourneyDay(state, '2026-08-24', 3, 1).state;
  let journey = mossproutJourneyForDay(state, '2026-08-24');
  const optionalInput = {
    dayId: '2026-08-24',
    goals: [{ id: 'optional-goal', title: 'Optional goal', completed: false }],
    gardenRequests: [{
      id: 'routine-order', title: 'Routine order', description: 'Optional Garden work', difficulty: 'small' as const,
      requirements: [{ definitionId: 'nature:garden:2', quantity: 1 }], coins: 10,
    }],
    offers: [{ id: 'quest-mossprout-green-photo', family: 'photo' as const, title: 'Take a photo', hint: 'Optional photo', bondReward: 4 }],
    storyComplete: false,
  };
  let actions = resolveMossproutDayActions({ ...optionalInput, journey });
  assert.equal(actions.length, 1);
  assert.equal(actions[0]?.required, true);
  assert.equal(actions[0]?.kind, 'story_chat');

  state = completeMossproutJourneyOpening(state, '2026-08-24', 4);
  journey = mossproutJourneyForDay(state, '2026-08-24');
  actions = resolveMossproutDayActions({ ...optionalInput, journey });
  assert.equal(actions.length, 1);
  assert.equal(actions[0]?.kind, 'garden_request');
  assert.equal(actions[0]?.required, true);

  const optionalDefinitionId = journey?.actions.find((action) => action.kind !== 'journey')?.definitionId;
  assert.ok(optionalDefinitionId);
  state = completeMossproutJourneyConversation(state, optionalDefinitionId, 5);
  journey = mossproutJourneyForDay(state, '2026-08-24');
  actions = resolveMossproutDayActions({ ...optionalInput, journey });
  assert.equal(actions.some((action) => action.required && action.kind === 'garden_request'), true);
  assert.equal(actions.some((action) => action.status === 'completed'), false);
  assert.equal(actions.some((action) => action.title === 'Optional goal' || action.title === 'Routine order' || action.title === 'Take a photo'), false);
});

test('reset latest Journey Day rewinds Day 2 while preserving Day 1', () => {
  let state = emptyRelationshipProgressState();
  state = startMossproutJourneyDay(state, '2026-08-23', 1, 0).state;
  state = completeMossproutJourneyDay(state, '2026-08-23', {
    objectiveId: 'mossprout:objective:first-sprout',
    activityReceiptId: 'merge-order:mossprout:chapter-0:first-sprout',
    resolutionId: 'mossprout:ftue:chapter-zero-return',
  }, 2);
  state = startMossproutJourneyDay(state, '2026-08-24', 3, 1).state;
  state = completeMossproutJourneyOpening(state, '2026-08-24', 4);
  state = startMossproutJourneyActivity(state, '2026-08-24');
  state = recordMossproutJourneyOrderServed(state, 'merge-story:mossprout:quiet-patch:listening-place', 5);
  state = recordMossproutJourneyOrderServed(state, 'merge-story:mossprout:quiet-patch:path-for-water', 6);
  state = beginMossproutJourneyReturn(state, '2026-08-24');
  state = completeMossproutJourneyConversation(state, MOSSPROUT_CAMPAIGN_EPISODES[1].resolutionConversationId!, 7);

  const reset = resetLastMossproutJourneyForDebug(state, 8);
  assert.equal(mossproutJourneyForDay(reset, '2026-08-24'), null);
  assert.equal(mossproutJourneyForDay(reset, '2026-08-23')?.status, 'complete');
  assert.deepEqual(mossproutStory(reset).completedBeatIds, ['quiet-patch:first-flower']);
  assert.equal(mossproutStory(reset).activeBeatId, 'quiet-patch:pond-knock');
  assert.equal(mossproutStory(reset).habitatStage, 0);
});

test('the next unstarted Mossprout chapter is labelled as Journey Day 2', () => {
  const actions = resolveMossproutDayActions({
    goals: [],
    journey: null,
    journeyDayNumber: 2,
    offers: [],
    storyComplete: false,
  });
  assert.equal(actions[0]?.title, 'Begin Journey Day 2');
});

test('incompatible relationship state starts empty without migration', () => {
  const normalized = normalizeRelationshipProgressState({
    schemaVersion: 1,
    journeyDays: [],
    stories: {},
    acknowledgedActionOutroIds: [],
    completedActionOutros: [],
  });
  assert.deepEqual(normalized.skippedActionIds, []);
  assert.equal(normalized.schemaVersion, 7);
  assert.deepEqual(normalized.journeyDays, []);
  assert.deepEqual(normalized.mossproutDailyActionDecks, []);
});

test('legacy Mossprout Day 1 saves gain all three FTUE choices', () => {
  const legacy = firstJourneyCompleteState('2026-08-23');
  legacy.journeyDays[0]!.actions = [{
    id: 'mossprout:quiet-patch:first-flower:field-note',
    kind: 'journal_prompt',
    required: false,
    definitionId: 'mossprout:conversation:nature-journal:one-growing-thing',
    status: 'ready',
    bondContribution: 20,
    completedAt: null,
    outroAcknowledgedAt: null,
  }];

  const normalized = normalizeRelationshipProgressState(legacy);
  const journey = mossproutJourneyForDay(normalized, '2026-08-23');
  const choices = journey!.actions.filter((action) => action.kind !== 'journey');
  assert.deepEqual(choices.map((action) => action.kind), ['goal_plan', 'playful_game', 'journal_prompt']);
  assert.equal(choices.every((action) => action.status === 'ready'), true);

  const visible = resolveMossproutDayActions({
    dayId: '2026-08-23',
    goals: [],
    journey,
    offers: [],
    storyComplete: false,
  }).filter((action) => choices.some((choice) => choice.id === action.id));
  assert.equal(visible.length, 3);
});

test('Day 1 choice reconciliation preserves completion and keeps alternatives closed', () => {
  const legacy = firstJourneyCompleteState('2026-08-23');
  legacy.journeyDays[0]!.actions = [{
    id: 'mossprout:quiet-patch:first-flower:field-note',
    kind: 'journal_prompt',
    required: false,
    definitionId: 'mossprout:conversation:nature-journal:one-growing-thing',
    status: 'completed',
    bondContribution: 20,
    completedAt: 100,
    outroAcknowledgedAt: null,
  }];

  const normalized = normalizeRelationshipProgressState(legacy);
  const choices = mossproutJourneyForDay(normalized, '2026-08-23')!.actions.filter((action) => action.kind !== 'journey');
  assert.deepEqual(choices.map((action) => action.status), ['skipped', 'skipped', 'completed']);
  assert.equal(choices.find((action) => action.status === 'completed')?.completedAt, 100);
});

test('live Day 1 reconciliation repairs a cached one-choice journey exactly once', () => {
  const cached = firstJourneyCompleteState('2026-08-23');
  cached.journeyDays[0]!.actions = [{
    id: 'mossprout:quiet-patch:first-flower:field-note',
    kind: 'journal_prompt', required: false,
    definitionId: 'mossprout:conversation:nature-journal:one-growing-thing',
    status: 'ready', bondContribution: 20, completedAt: null, outroAcknowledgedAt: null,
  }];

  const repaired = reconcileMossproutDayOneChoices(cached);
  assert.notEqual(repaired, cached);
  assert.equal(repaired.journeyDays[0]?.actions.filter((action) => action.kind !== 'journey').length, 3);
  assert.equal(reconcileMossproutDayOneChoices(repaired), repaired);
});

test('every bespoke Mossprout question and journal resolves to its intended action artwork', () => {
  const conversationArt = {
    'mossprout:conversation:nature-question:suspicious-path': 'mossprout:suspicious-path',
    'mossprout:conversation:nature-question:weather-committee': 'mossprout:nature-weather',
    'mossprout:conversation:nature-question:garden-guests': 'mossprout:garden-guest',
    'mossprout:conversation:nature-question:outdoor-luxury': 'mossprout:outdoor-luxury',
    'mossprout:conversation:nature-question:tree-neighbour': 'mossprout:tree-neighbour',
    'mossprout:conversation:nature-question:cloud-job': 'mossprout:cloud-job',
    'mossprout:conversation:nature-question:pocket-expedition': 'today:quest',
    'mossprout:conversation:nature-question:garden-rule': 'mossprout:garden-rules',
    'mossprout:conversation:nature-journal:three-detail-field-note': 'today:reflection',
    'mossprout:conversation:nature-journal:weather-in-the-day': 'mossprout:nature-weather',
    'mossprout:conversation:nature-journal:one-growing-thing': 'today:reflection',
    'mossprout:conversation:nature-journal:sound-map': 'mossprout:nature-sound-map',
    'mossprout:conversation:nature-journal:light-on-the-place': 'mossprout:nature-light',
    'mossprout:conversation:nature-journal:small-return': 'today:place',
    'mossprout:game:form-finder': 'mossprout:nature-card',
    'mossprout:insight:nature-connection': 'mossprout:nature-insight',
  } as const;

  for (const [definitionId, artKey] of Object.entries(conversationArt)) {
    assert.equal(mossproutConversationArtKey(definitionId), artKey, definitionId);
  }
});

test('Mossprout goals reuse Today artwork where it fits and bespoke artwork where it does not', () => {
  const goalArt = {
    'mossprout:step-outside': 'today:movement',
    'mossprout:sit-outside': 'today:movement',
    'mossprout:visit-green': 'today:place',
    'mossprout:same-place': 'today:place',
    'mossprout:care-for-plant': 'mossprout:plant-care',
    'mossprout:window-view': 'mossprout:nature-window',
    'mossprout:notice-living-thing': 'mossprout:nature-observation',
    'mossprout:season-change': 'mossprout:nature-observation',
  } as const;

  for (const [templateId, artKey] of Object.entries(goalArt)) {
    assert.equal(mossproutGoalArtKey(templateId), artKey, templateId);
  }
});

test('completion presentation is separate from three active board slots', () => {
  const makeAction = (id: string, slotId: 'together' | 'field' | 'garden'): KatchimeraDayAction => ({
    id,
    instanceId: `old-presentation:${slotId}:${id}`,
    slotId,
    kind: 'fun_chat',
    title: id,
    subtitle: null,
    icon: 'bubble.left.fill',
    required: false,
    disabled: false,
    status: 'ready',
    reward: null,
    destination: { kind: 'journey' },
    completedAt: null,
    outroAcknowledgedAt: null,
  });
  const first = makeAction('first', 'together');
  const promoted = makeAction('third', 'field');
  const incoming = makeAction('new', 'garden');
  const snapshot = createActionBoardSnapshot('day', [first, promoted, incoming], []);
  assert.deepEqual(snapshot.slots.map((slot) => slot.action?.id), ['first', 'third', 'new']);
  assert.equal(snapshot.slots.every((slot) => slot.enabled), true);
});

test('starting a conversation preserves the exact Action Board card until completion', () => {
  const origin = {
    dayId: '2026-08-26', familyId: 'mossprout',
    actionId: 'mossprout:conversation:mossprout:nature-question:garden-rule',
    instanceId: '2026-08-26:together:3:mossprout:conversation:mossprout:nature-question:garden-rule',
    sourceSlotId: 'together', slotId: 'together', sequence: 3,
    kind: 'fun_chat', title: 'Make one new Garden rule', subtitle: 'A short garden sceneâ€”one or two choices.',
    icon: 'bubble.left.fill', artKey: 'today:quest', artworkDefinitionIds: [],
    reward: { kind: 'bond', amount: 4 }, rotationEffect: 'consume', presentation: 'action_card',
  } satisfies KatchimeraActionOrigin;
  const active = mossproutActiveConversationAction({
    actionOrigin: origin,
    definitionId: 'mossprout:nature-question:garden-rule',
    status: 'active',
  });
  assert.equal(active?.instanceId, origin.instanceId);
  assert.equal(active?.title, 'Make one new Garden rule');
  assert.deepEqual(active?.destination, { kind: 'conversation', definitionId: 'mossprout:nature-question:garden-rule' });
  assert.equal(mossproutActiveConversationAction({
    actionOrigin: origin,
    definitionId: 'mossprout:nature-question:garden-rule',
    status: 'completed',
  }), null);
});

test('legacy Mossprout slot decks are discarded at the unreleased schema cutover', () => {
  const normalized = normalizeRelationshipProgressState({
    schemaVersion: 2,
    journeyDays: [],
    stories: {},
    acknowledgedActionOutroIds: [],
    skippedActionIds: [],
    completedActionOutros: [],
    mossproutDailyActionDecks: [{
      dayId: '2026-08-21',
      slotSequences: { together: 1, field: 2, garden: 3 },
    }],
  });
  assert.deepEqual(normalized.mossproutDailyActionDecks, []);
});

test('legacy action outro receipts are discarded at the unreleased schema cutover', () => {
  const normalized = normalizeRelationshipProgressState({
    schemaVersion: 1,
    journeyDays: [], stories: {}, acknowledgedActionOutroIds: [], skippedActionIds: [],
    completedActionOutros: [{
      id: '2026-08-21:mossprout:conversation:old-note', dayId: '2026-08-21', familyId: 'mossprout',
      actionId: 'mossprout:conversation:old-note', kind: 'journal_prompt', title: 'Old note', subtitle: 'Saved',
      icon: 'square.and.pencil', artworkDefinitionIds: [], reward: { kind: 'bond', amount: 4 }, completedAt: 10,
    }],
  });
  assert.deepEqual(normalized.actionCompletions, []);
  assert.deepEqual(normalized.actionPresentations, []);
});

test('optional Katchimera actions skip once for the selected day while required actions remain', () => {
  const optional = {
    id: 'mossprout:conversation:field-note', kind: 'journal_prompt', title: 'Keep a field note', subtitle: null,
    icon: 'square.and.pencil', required: false, disabled: false, status: 'ready', reward: { kind: 'bond', amount: 4 },
    destination: { kind: 'conversation', definitionId: 'field-note' }, completedAt: null, outroAcknowledgedAt: null,
  } satisfies KatchimeraDayAction;
  const required = { ...optional, id: 'mossprout:journey', required: true } satisfies KatchimeraDayAction;
  const initial = emptyRelationshipProgressState();
  const skipped = skipKatchimeraDayAction(initial, '2026-08-21', optional);
  assert.deepEqual(skipped.skippedActionIds, [
    '2026-08-21:mossprout:conversation:field-note',
    '2026-08-21:source:mossprout:conversation:field-note',
  ]);
  assert.equal(skipped.mossproutDailyActionDecks[0]?.slotSequences.field, 1);
  assert.deepEqual(skipped.mossproutDailyActionDecks[0]?.consumedActionIds.field, ['mossprout:conversation:field-note']);
  assert.equal(skipKatchimeraDayAction(skipped, '2026-08-21', optional), skipped);
  assert.equal(skipKatchimeraDayAction(skipped, '2026-08-21', required), skipped);
});

test('Mossprout resolver hides a skipped optional action only on that day', () => {
  const conversations = [{ definitionId: 'field-note', mode: 'talk' as const, actionKind: 'journal_prompt' as const, title: 'Keep a field note' }];
  const skippedActionIds = [`2026-08-21:source:${MOSSPROUT_DAILY_FIELD_NOTE_ACTION_ID}`];
  const hidden = resolveMossproutDayActions({ conversations, dayId: '2026-08-21', goals: [], journey: null, offers: [], skippedActionIds, storyComplete: false });
  const tomorrow = resolveMossproutDayActions({ conversations, dayId: '2026-08-22', goals: [], journey: null, offers: [], skippedActionIds, storyComplete: false });
  assert.equal(hidden.some((action) => action.id === MOSSPROUT_DAILY_FIELD_NOTE_ACTION_ID), false);
  assert.equal(tomorrow.some((action) => action.id === MOSSPROUT_DAILY_FIELD_NOTE_ACTION_ID), true);
  assert.equal(hidden.some((action) => action.required), true);
});

test('Mossprout offers only one field-note flow per day after it is skipped', () => {
  const dayId = '2026-08-21';
  const conversations = ['one', 'two', 'three'].map((id) => ({
    definitionId: `field-note:${id}`,
    mode: 'talk' as const,
    actionKind: 'journal_prompt' as const,
    title: `Field note ${id}`,
  }));
  const initial = resolveMossproutDayActions({ conversations, dayId, goals: [], journey: null, offers: [], storyComplete: false });
  const field = initial.find((action) => action.slotId === 'field');
  assert.ok(field);
  assert.equal(field.id, MOSSPROUT_DAILY_FIELD_NOTE_ACTION_ID);
  assert.equal(initial.filter((action) => action.kind === 'journal_prompt').length, 1);

  const state = skipKatchimeraDayAction(emptyRelationshipProgressState(), dayId, field);
  const deck = mossproutDailyActionDeck(state, dayId);
  const sameDay = resolveMossproutDayActions({
    conversations,
    consumedActionIds: deck.consumedActionIds,
    dayId,
    goals: [],
    journey: null,
    offers: [],
    skippedActionIds: state.skippedActionIds,
    slotSequences: deck.slotSequences,
    storyComplete: false,
  });
  const tomorrow = resolveMossproutDayActions({ conversations, dayId: '2026-08-22', goals: [], journey: null, offers: [], storyComplete: false });
  assert.equal(sameDay.some((action) => action.kind === 'journal_prompt'), false);
  assert.equal(tomorrow.some((action) => action.id === MOSSPROUT_DAILY_FIELD_NOTE_ACTION_ID), true);
});

test('a completed field note does not replace itself with another field note that day', () => {
  const dayId = '2026-08-21';
  const conversations = ['one', 'two'].map((id) => ({
    definitionId: `field-note:${id}`,
    mode: 'talk' as const,
    actionKind: 'journal_prompt' as const,
    title: `Field note ${id}`,
  }));
  const first = resolveMossproutDayActions({ conversations, dayId, goals: [], journey: null, offers: [], storyComplete: false })
    .find((action) => action.slotId === 'field')!;
  const state = recordKatchimeraActionCompletion(emptyRelationshipProgressState(), {
    dayId,
    familyId: 'mossprout',
    actionId: first.id,
    instanceId: first.instanceId!,
    slotId: 'field',
    sequence: first.sequence!,
    kind: first.kind,
    title: first.title,
    subtitle: first.subtitle ?? 'Complete',
    icon: first.icon,
    artworkDefinitionIds: [],
    reward: first.reward,
    completedAt: 10,
  });
  const deck = mossproutDailyActionDeck(state, dayId);
  const remaining = resolveMossproutDayActions({
    conversations,
    consumedActionIds: deck.consumedActionIds,
    dayId,
    goals: [],
    journey: null,
    offers: [],
    slotSequences: deck.slotSequences,
    storyComplete: false,
  });

  assert.equal(remaining.some((action) => action.kind === 'journal_prompt'), false);
  assert.deepEqual(deck.consumedActionIds.field, [MOSSPROUT_DAILY_FIELD_NOTE_ACTION_ID]);
});

test('legacy definition-specific field-note receipts also consume today\'s shared field-note action', () => {
  const dayId = '2026-08-21';
  const conversations = [
    { definitionId: 'mossprout:conversation:nature-journal:three-detail-field-note', mode: 'talk' as const, actionKind: 'journal_prompt' as const, title: 'A three-detail field note' },
    { definitionId: 'mossprout:conversation:nature-journal:weather-in-the-day', mode: 'talk' as const, actionKind: 'journal_prompt' as const, title: 'How the weather entered the day' },
  ];
  const legacyActionId = 'mossprout:conversation:mossprout:conversation:nature-journal:three-detail-field-note';
  const afterCompletion = resolveMossproutDayActions({
    conversations,
    consumedActionIds: { field: [legacyActionId] },
    dayId,
    goals: [],
    journey: null,
    offers: [],
    storyComplete: false,
  });
  const afterSkip = resolveMossproutDayActions({
    conversations,
    dayId,
    goals: [],
    journey: null,
    offers: [],
    skippedActionIds: [`${dayId}:source:${legacyActionId}`],
    storyComplete: false,
  });

  assert.equal(afterCompletion.some((action) => action.kind === 'journal_prompt'), false);
  assert.equal(afterSkip.some((action) => action.kind === 'journal_prompt'), false);
});

test('Mossprout hides unavailable and competing real-life requests instead of locking them', () => {
  const offers = [
    { id: 'quest-mossprout-green-photo', title: 'Green', hint: 'Photo', family: 'photo', bondReward: 5, availableToday: true },
    { id: 'quest-mossprout-nature-note', title: 'Sensory detail', hint: 'Note', family: 'note', bondReward: 5, availableToday: false },
  ];
  const available = resolveMossproutDayActions({ goals: [], journey: null, offers, storyComplete: false });
  assert.equal(available.some((action) => action.title === 'Sensory detail'), false);
  assert.equal(available.some((action) => action.title === 'Green' && !action.disabled), true);

  const competing = resolveMossproutDayActions({ activeQuestId: 'another-quest', goals: [], journey: null, offers, storyComplete: false });
  assert.equal(competing.some((action) => action.kind === 'photo_request' || action.kind === 'note_request'), false);
});

test('Mossprout never selects a disabled Journey row into a visible slot', () => {
  let state = startMossproutJourneyDay(emptyRelationshipProgressState(), '2026-08-21', 1).state;
  state = completeMossproutJourneyDay(state, '2026-08-21', { objectiveId: 'first-sprout', activityReceiptId: 'sprout', resolutionId: 'ftue' }, 2);
  state = startMossproutJourneyDay(state, '2026-08-22', 3).state;
  state = completeMossproutJourneyOpening(state, '2026-08-22', 4);

  const actions = resolveMossproutDayActions({
    goals: [], journey: mossproutJourneyForDay(state, '2026-08-22'), offers: [], storyComplete: false,
  });

  assert.equal(actions.some((action) => action.disabled), false);
  assert.equal(actions.some((action) => action.title === 'Mossprout is still noticing today'), false);
});

test('only one companion can own a real day', () => {
  const started = startMossproutJourneyDay(emptyRelationshipProgressState(), '2026-08-21', 1);
  assert.equal(started.reason, 'started');
  const repeated = startMossproutJourneyDay(started.state, '2026-08-21', 2);
  assert.equal(repeated.reason, 'existing');
  assert.equal(repeated.state.journeyDays.length, 1);
});

test('the first Garden order unlocks the return insight before completing Day 1', () => {
  let state = startMossproutJourneyDay(emptyRelationshipProgressState(), '2026-08-21', 1).state;
  state = recordMossproutFirstGardenRestored(state, '2026-08-21', 'merge-order:first-plant', 2);
  let journey = mossproutJourneyForDay(state, '2026-08-21');
  assert.equal(journey?.status, 'resolution_ready');
  assert.equal(journey?.returnConversationId, 'mossprout:ftue:chapter-zero-return');
  assert.equal(journey?.completionReceipt, null);
  assert.equal(mossproutStory(state).habitatStage, 0);

  state = completeMossproutJourneyConversation(state, 'mossprout:ftue:chapter-zero-return', 3);
  state = finishDayOneResident(state, '2026-08-21', 3.1);
  journey = mossproutJourneyForDay(state, '2026-08-21');
  assert.equal(journey?.status, 'complete');
  assert.equal(journey?.completionReceipt?.bondPoints, 0);
  assert.equal(journey?.actions.find((action) => action.kind === 'playful_game')?.status, 'ready');
  assert.equal(mossproutStory(state).habitatStage, 0);

  state = completeMossproutJourneyConversation(state, 'mossprout:quiet-patch:first-flower:goal-plan', 4);
  state = completeMossproutJourneyConversation(state, 'mossprout:quiet-patch:first-flower:playful', 5);
  assert.equal(mossproutJourneyForDay(state, '2026-08-21')?.completionReceipt?.bondPoints, 20);
  assert.equal(mossproutJourneyForDay(state, '2026-08-21')?.actions.filter((action) => action.status === 'skipped').length, 2);
});

test('a Journey Garden card uses the live order title, reward, and every requested item', () => {
  let state = startMossproutJourneyDay(emptyRelationshipProgressState(), '2026-08-21', 1).state;
  state = completeMossproutJourneyDay(state, '2026-08-21', { objectiveId: 'first-sprout', activityReceiptId: 'sprout', resolutionId: 'ftue' }, 2);
  state = startMossproutJourneyDay(state, '2026-08-22', 3, 6).state;
  state = completeMossproutJourneyOpening(state, '2026-08-22', 4);
  state = startMossproutJourneyDay(state, '2026-08-23', 5, 7).state;
  state = completeMossproutJourneyOpening(state, '2026-08-23', 6);

  const actions = resolveMossproutDayActions({
    goals: [],
    journey: mossproutJourneyForDay(state, '2026-08-23'),
    journeyGardenRequest: {
      id: 'live-order', title: 'The order on the board', description: 'Bring these exact pieces.', difficulty: 'major',
      requirements: [
        { definitionId: 'nature:waterside:2', quantity: 2 },
        { definitionId: 'nature:garden:3', quantity: 1 },
      ],
      coins: 47,
    },
    offers: [],
    storyComplete: false,
  });
  const garden = actions.find((action) => action.kind === 'garden_request');

  assert.equal(garden?.title, 'The order on the board');
  assert.equal(garden?.subtitle, 'Bring these exact pieces.');
  assert.equal(garden?.destination.kind, 'garden');
  assert.equal(garden?.destination.kind === 'garden' ? garden.destination.orderId : null, 'live-order');
  assert.deepEqual(garden?.artworkDefinitionIds, ['nature:waterside:2', 'nature:waterside:2', 'nature:garden:3']);
  assert.deepEqual(garden?.reward, { kind: 'coins', amount: 47 });
});

test('Mossprout Day 1 exposes its goal and fun threads after the main Garden journey', () => {
  let state = startMossproutJourneyDay(emptyRelationshipProgressState(), '2026-08-21', 1).state;
  state = recordMossproutFirstGardenRestored(state, '2026-08-21', 'merge-order:first-plant', 2);
  state = completeMossproutJourneyConversation(state, 'mossprout:ftue:chapter-zero-return', 3);
  state = finishDayOneResident(state, '2026-08-21', 3.1);
  let journey = mossproutJourneyForDay(state, '2026-08-21');
  const offers = [
    { id: 'quest-mossprout-green-photo', title: 'Photograph something green', hint: 'A nature photo', family: 'photo', bondReward: 4 },
    { id: 'quest-mossprout-nature-note', title: 'Keep a tiny field note', hint: 'A nature note', family: 'journal', bondReward: 4 },
  ];
  let actions = resolveMossproutDayActions({ goals: [], journey, offers, storyComplete: false });
  assert.deepEqual(actions.map((action) => action.slotId), ['together', 'field', 'garden']);
  assert.deepEqual(actions.map((action) => action.kind), ['fun_chat', 'journal_prompt', 'photo_request']);
  assert.equal(actions.every((action) => action.status !== 'completed'), true);

  const mainAction = journey?.actions.find((action) => action.kind === 'journey');
  journey = mossproutJourneyForDay(state, '2026-08-21');
  actions = resolveMossproutDayActions({ goals: [], journey, offers, storyComplete: false });
  assert.deepEqual(actions.map((action) => action.kind), ['fun_chat', 'journal_prompt', 'photo_request']);
  assert.equal(actions.filter((action) => action.kind === 'photo_request' || action.kind === 'note_request').length, 1);
  assert.equal(journey?.actions.find((action) => action.kind === 'goal_plan')?.status, 'ready');

  const goalPlan = journey!.actions.find((action) => action.kind === 'goal_plan')!;
  state = completeMossproutFocusAction(state, '2026-08-21', {
    dayId: '2026-08-21', familyId: 'mossprout', actionId: goalPlan.id,
    instanceId: `2026-08-21:together:0:${goalPlan.id}`, sourceSlotId: 'together', slotId: 'together', sequence: 0,
    kind: 'goal_plan', title: 'Find a nature direction', subtitle: 'Choose a small direction for tomorrow.', icon: 'scope',
    artKey: 'today:quest', artworkDefinitionIds: [], reward: { kind: 'bond', amount: goalPlan.bondContribution },
    journeyId: journey!.id, journeyActionId: goalPlan.id, rotationEffect: 'preserve', presentation: 'action_card',
  }, 4);
  assert.equal(state.actionCompletions.some((completion) => completion.actionId === goalPlan.id), true);
  assert.equal(state.actionPresentations.some((presentation) => presentation.card.kind === 'goal_plan' && presentation.status === 'pending'), true);
  actions = resolveMossproutDayActions({ goals: [], journey: mossproutJourneyForDay(state, '2026-08-21'), offers, storyComplete: false });
  assert.equal(actions.some((action) => action.kind === 'goal_plan'), false);
  assert.equal(actions.every((action) => action.status !== 'completed'), true);
  assert.equal(actions.some((action) => action.slotId === 'field'), true);

  state = completeMossproutJourneyConversation(state, 'mossprout:quiet-patch:first-flower:playful', 5);
  actions = resolveMossproutDayActions({ goals: [], journey: mossproutJourneyForDay(state, '2026-08-21'), offers, storyComplete: false });
  assert.equal(mossproutJourneyForDay(state, '2026-08-21')?.actions.find((action) => action.kind === 'playful_game')?.status, 'skipped');
  assert.equal(actions.some((action) => action.id === 'mossprout:quiet-patch:first-flower:playful'), false);
});

test('the Day 1 Bond lesson shows its three authored choices without coin-only Garden orders', () => {
  const dayId = '2026-08-21';
  let state = startMossproutJourneyDay(emptyRelationshipProgressState(), dayId, 1).state;
  state = recordMossproutFirstGardenRestored(state, dayId, 'merge-order:first-plant', 2);
  state = completeMossproutJourneyConversation(state, 'mossprout:ftue:chapter-zero-return', 3);
  state = finishDayOneResident(state, dayId, 3.1);
  const mainAction = mossproutJourneyForDay(state, dayId)!.actions.find((action) => action.kind === 'journey')!;
  const journey = mossproutJourneyForDay(state, dayId)!;
  const choiceIds = journey.actions
    .filter((action) => action.kind !== 'journey')
    .map((action) => action.id);

  const actions = resolveMossproutDayActions({
    dayId,
    gardenRequests: [{
      id: 'coin-order',
      title: 'A coin-only Garden order',
      description: 'This does not grow Bond.',
      difficulty: 'small',
      requirements: [{ definitionId: 'nature:garden:2', quantity: 1 }],
      coins: 20,
    }],
    goals: [],
    hasActiveFocus: true,
    includeActionIds: choiceIds,
    journey,
    offers: [],
    storyComplete: false,
  });

  assert.equal(choiceIds.length, 3);
  assert.equal(actions.length, 3);
  assert.deepEqual(new Set(actions.map((action) => action.id)), new Set(choiceIds));
  assert.equal(actions.every((action) => action.reward?.kind === 'bond'), true);
  assert.equal(actions.some((action) => action.kind === 'garden_request'), false);
});

test('the inline Day 1 FTUE receipt refills all three action rows without completing a Journey action', () => {
  const dayId = '2026-08-21';
  let state = startMossproutJourneyDay(emptyRelationshipProgressState(), dayId, 1).state;
  state = recordMossproutFirstGardenRestored(state, dayId, 'merge-order:first-plant', 2);
  state = completeMossproutJourneyConversation(state, 'mossprout:ftue:chapter-zero-return', 3);
  state = finishDayOneResident(state, dayId, 5);
  const journeyBeforeAcknowledgement = mossproutJourneyForDay(state, dayId)!;

  const input = {
    dayId,
    goals: [],
    hasActiveFocus: true,
    journey: mossproutJourneyForDay(state, dayId),
    offers: [],
    storyComplete: false,
  };
  const withoutFtueReceipt = resolveMossproutDayActions(input);
  const actions = resolveMossproutDayActions({ ...input, dayOneLessonCompleted: true });

  assert.equal(withoutFtueReceipt.length, 2);
  assert.equal(actions.length, 3);
  assert.deepEqual(new Set(actions.map((action) => action.kind)), new Set(['goal_plan', 'fun_chat', 'journal_prompt']));
});

test('a completed Day 1 Journey action never participates in slot selection', () => {
  const dayId = '2026-08-21';
  let state = startMossproutJourneyDay(emptyRelationshipProgressState(), dayId, 1).state;
  state = recordMossproutFirstGardenRestored(state, dayId, 'merge-order:first-plant', 2);
  state = completeMossproutJourneyConversation(state, 'mossprout:ftue:chapter-zero-return', 3);
  state = finishDayOneResident(state, dayId, 4);

  const input = {
    dayId,
    dayOneLessonCompleted: true,
    gardenRequests: [{
      id: 'daily-order',
      title: 'A Garden request',
      description: 'Bring one growing thing.',
      difficulty: 'small' as const,
      requirements: [{ definitionId: 'nature:garden:2', quantity: 1 }],
      coins: 20,
    }],
    goals: [],
    hasActiveFocus: false,
    offers: [],
    storyComplete: false,
  };
  const resolved = resolveMossproutDayActions({
    ...input,
    journey: mossproutJourneyForDay(state, dayId),
  });
  assert.equal(resolved.length, 3);
  assert.equal(resolved.every((action) => action.status === 'ready' || action.status === 'active'), true);
  assert.equal(resolved.some((action) => action.slotId === 'together'), true);
});

test('a Journey completion immediately reveals replacements', () => {
  const dayId = '2026-08-21';
  let state = startMossproutJourneyDay(emptyRelationshipProgressState(), dayId, 1).state;
  state = recordMossproutFirstGardenRestored(state, dayId, 'merge-order:first-plant', 2);
  state = completeMossproutJourneyConversation(state, 'mossprout:ftue:chapter-zero-return', 3);
  state = finishDayOneResident(state, dayId, 3.1);
  const mainAction = mossproutJourneyForDay(state, dayId)!.actions.find((action) => action.kind === 'journey')!;
  const offers = [
    { id: 'quest-mossprout-green-photo', title: 'Photograph something green', hint: 'A nature photo', family: 'photo', bondReward: 4 },
    { id: 'quest-mossprout-nature-note', title: 'Keep a tiny field note', hint: 'A nature note', family: 'journal', bondReward: 4 },
  ];
  const before = resolveMossproutDayActions({ dayId, goals: [], journey: mossproutJourneyForDay(state, dayId), offers, storyComplete: false });
  assert.ok(before.find((action) => action.kind === 'journal_prompt'));

  state = completeMossproutJourneyConversation(state, 'mossprout:conversation:nature-journal:one-growing-thing', 4);
  const after = resolveMossproutDayActions({ dayId, goals: [], journey: mossproutJourneyForDay(state, dayId), offers, storyComplete: false });
  assert.equal(after.length, 2);
  assert.equal(after.every((action) => action.status !== 'completed'), true);
});

test('Mossprout keeps offering independent nature activities after Journey actions are exhausted', () => {
  let state = startMossproutJourneyDay(emptyRelationshipProgressState(), '2026-08-21', 1).state;
  state = recordMossproutFirstGardenRestored(state, '2026-08-21', 'merge-order:first-plant', 2);
  state = completeMossproutJourneyConversation(state, 'mossprout:ftue:chapter-zero-return', 3);
  state = finishDayOneResident(state, '2026-08-21', 3.1);
  state = completeMossproutJourneyConversation(state, 'mossprout:quiet-patch:first-flower:goal-plan', 4);
  state = completeMossproutJourneyConversation(state, 'mossprout:quiet-patch:first-flower:playful', 5);
  state = completeMossproutJourneyConversation(state, 'mossprout:conversation:nature-journal:one-growing-thing', 5.5);

  const actions = resolveMossproutDayActions({
    conversations: [
      { definitionId: 'mossprout:conversation:nature-question:suspicious-path', mode: 'talk', title: 'A suspicious little path', label: 'Mossprout has a question' },
      { definitionId: 'mossprout:conversation:nature-journal:three-detail-field-note', mode: 'talk', actionKind: 'journal_prompt', title: 'A three-detail field note' },
      { definitionId: 'mossprout:insight:nature-connection', mode: 'discover', title: 'What does nature give back to you?' },
      { definitionId: 'mossprout:conversation:nature-plan', mode: 'plan', title: 'Make a small nature plan' },
    ],
    gardenRequests: [
      { id: 'garden-1', title: 'A little garden tidying', description: 'Bring one Sprout.', difficulty: 'small', requirements: [{ definitionId: 'nature:garden:2', quantity: 1 }], coins: 20 },
      { id: 'garden-2', title: 'A mixed patch', description: 'Bring two pieces.', difficulty: 'medium', requirements: [{ definitionId: 'nature:garden:2', quantity: 1 }, { definitionId: 'nature:waterside:2', quantity: 1 }], coins: 35 },
    ],
    goals: [],
    journey: mossproutJourneyForDay(state, '2026-08-21'),
    offers: [],
    storyComplete: false,
  });

  assert.deepEqual(actions.map((action) => action.kind), ['fun_chat', 'journal_prompt', 'garden_request']);
  assert.deepEqual(actions.map((action) => action.slotId), ['together', 'field', 'garden']);
  assert.equal(actions.filter((action) => action.kind !== 'garden_request').every((action) => action.reward?.kind === 'bond' && action.reward.amount === 4), true);
  assert.deepEqual(actions.filter((action) => action.kind === 'garden_request').map((action) => action.reward?.amount), [20]);
});

test('Mossprout lends an empty slot to the deepest eligible action queue', () => {
  const actions = resolveMossproutDayActions({
    conversations: [
      { definitionId: 'question:one', mode: 'talk', title: 'Question one' },
      { definitionId: 'journal:one', mode: 'talk', actionKind: 'journal_prompt', title: 'Field note one' },
    ],
    dayId: '2026-08-21',
    goals: [],
    journey: null,
    offers: [
      { id: 'quest-mossprout-green-photo', title: 'Photograph green', hint: 'Take a photo', family: 'photo', bondReward: 5 },
      { id: 'quest-mossprout-nature-note', title: 'Follow one detail', hint: 'Keep a note', family: 'note', bondReward: 5 },
    ],
    storyComplete: false,
  });

  assert.deepEqual(actions.map((action) => action.slotId), ['together', 'field', 'garden']);
  assert.equal(actions.length, 3);
  const borrowed = actions.find((action) => action.slotId === 'garden');
  assert.equal(borrowed?.kind, 'photo_request');
  assert.equal(borrowed?.sourceSlotId, 'field');
});

test('skipping a borrowed action advances its source queue rather than the borrowed display slot', () => {
  const dayId = '2026-08-21';
  const initial = resolveMossproutDayActions({
    dayId,
    gardenRequests: [
      { id: 'garden-1', title: 'First order', description: 'One thing', difficulty: 'small', requirements: [{ definitionId: 'nature:garden:1', quantity: 1 }], coins: 10 },
      { id: 'garden-2', title: 'Second order', description: 'Two things', difficulty: 'medium', requirements: [{ definitionId: 'nature:garden:2', quantity: 1 }], coins: 20 },
      { id: 'garden-3', title: 'Third order', description: 'Three things', difficulty: 'major', requirements: [{ definitionId: 'nature:garden:3', quantity: 1 }], coins: 30 },
    ],
    goals: [],
    journey: null,
    offers: [],
    storyComplete: false,
  });
  const borrowed = initial.find((action) => action.slotId === 'field');
  assert.equal(initial.length, 3);
  assert.equal(borrowed?.kind, 'garden_request');
  assert.equal(borrowed?.sourceSlotId, 'garden');

  const skipped = skipKatchimeraDayAction(emptyRelationshipProgressState(), dayId, borrowed!);
  const deck = mossproutDailyActionDeck(skipped, dayId);
  assert.equal(deck.slotSequences.garden, 1);
  assert.equal(deck.slotSequences.field, 0);
  assert.deepEqual(deck.consumedActionIds.garden, [borrowed!.id]);
});

test('Mossprout action completion receipts are durable and idempotent', () => {
  const input = {
    dayId: '2026-08-21', familyId: 'mossprout' as const, actionId: 'mossprout:conversation:field-note',
    instanceId: '2026-08-21:field:0:mossprout:conversation:field-note', slotId: 'field' as const, sequence: 0,
    kind: 'journal_prompt' as const, title: 'A three-detail field note', subtitle: 'Field note kept with Mossprout',
    icon: 'square.and.pencil' as const, artworkDefinitionIds: [], reward: { kind: 'bond' as const, amount: 4 }, completedAt: 10,
  };
  const once = recordKatchimeraActionCompletion(emptyRelationshipProgressState(), input);
  const twice = recordKatchimeraActionCompletion(once, input);
  assert.equal(once.actionCompletions.length, 1);
  assert.equal(twice, once);
  assert.equal(once.actionCompletions[0]?.id, '2026-08-21:2026-08-21:field:0:mossprout:conversation:field-note');
  assert.equal(once.mossproutDailyActionDecks[0]?.slotSequences.field, 1);
  assert.deepEqual(once.mossproutDailyActionDecks[0]?.consumedActionIds.field, [input.actionId]);
});

test('canonical completion rotates once and presentation lifecycle cannot affect slots', () => {
  const origin = {
    dayId: '2026-08-21', familyId: 'mossprout' as const, actionId: 'daily-question',
    instanceId: '2026-08-21:together:0:daily-question', sourceSlotId: 'together' as const,
    slotId: 'together' as const, sequence: 0, kind: 'fun_chat' as const, title: 'A question',
    subtitle: 'Answer together', icon: 'bubble.left.fill' as const, artworkDefinitionIds: [],
    reward: { kind: 'bond' as const, amount: 4 }, rotationEffect: 'consume' as const,
    presentation: 'action_card' as const,
  };
  const command = actionCommandFromOrigin(origin, 10);
  const once = commitActionCompletion(emptyRelationshipProgressState(), command);
  const twice = commitActionCompletion(once, command);
  assert.equal(twice, once);
  assert.equal(once.actionCompletions.length, 1);
  assert.equal(once.actionPresentations.length, 1);
  assert.equal(mossproutDailyActionDeck(once, origin.dayId).slotSequences.together, 1);

  const presentationId = once.actionPresentations[0]!.id;
  const claimed = claimActionPresentation(once, presentationId, 20);
  const dismissedOnRestart = reconcileActionPresentationsAfterHydration(claimed, 30);
  const explicitlyDismissed = dismissActionPresentation(once, presentationId, 30);
  assert.equal(dismissedOnRestart.actionPresentations[0]?.status, 'dismissed');
  assert.equal(explicitlyDismissed.actionPresentations[0]?.status, 'dismissed');
  assert.deepEqual(dismissedOnRestart.mossproutDailyActionDecks, once.mossproutDailyActionDecks);
  assert.deepEqual(explicitlyDismissed.mossproutDailyActionDecks, once.mossproutDailyActionDecks);
});

test('Day 1 milestone is explicit and idempotent', () => {
  const once = completeDayOneLesson(emptyRelationshipProgressState(), { completedAt: 10, flowRunId: 'flow-one' });
  const twice = completeDayOneLesson(once, { completedAt: 20, flowRunId: 'flow-two' });
  assert.equal(twice, once);
  assert.deepEqual(once.milestones, { dayOneLessonCompletedAt: 10, dayOneLessonFlowRunId: 'flow-one' });
});

test('missing and malformed presentations are discarded without changing board slots', () => {
  const action = {
    id: 'one', instanceId: 'one', slotId: 'together' as const, kind: 'fun_chat' as const,
    title: 'One', subtitle: null, icon: 'bubble.left.fill' as const, required: false, disabled: false,
    status: 'ready' as const, reward: null, destination: { kind: 'journey' as const },
    completedAt: null, outroAcknowledgedAt: null,
  };
  const malformed = normalizeRelationshipProgressState({
    ...emptyRelationshipProgressState(),
    actionPresentations: [{ id: 'bad', completionId: 'missing', dayId: 'day', slotId: 'together', status: 'pending', card: {} }],
  });
  const snapshot = createActionBoardSnapshot('day', [action], malformed.actionPresentations);
  assert.deepEqual(malformed.actionPresentations, []);
  assert.equal(snapshot.slots[0].action?.id, 'one');
  assert.equal(snapshot.slots[0].enabled, true);
});

test('Journey and FTUE completions never consume a normal daily action slot', () => {
  const dayId = '2026-08-21';
  const source = {
    dayId,
    familyId: 'mossprout' as const,
    actionId: 'mossprout:quiet-patch:first-flower:field-note',
    instanceId: `${dayId}:field:0:mossprout:quiet-patch:first-flower:field-note`,
    sourceSlotId: 'field' as const,
    slotId: 'field' as const,
    sequence: 0,
    kind: 'journal_prompt' as const,
    title: 'Notice one growing thing',
    subtitle: 'Field note kept with Mossprout',
    icon: 'square.and.pencil' as const,
    artworkDefinitionIds: [],
    reward: { kind: 'bond' as const, amount: 20 },
    journeyId: `journey-day:${dayId}:mossprout`,
    journeyActionId: 'mossprout:quiet-patch:first-flower:field-note',
    rotationEffect: 'preserve' as const,
    presentation: 'action_card' as const,
  };
  const recorded = commitActionCompletion(emptyRelationshipProgressState(), actionCommandFromOrigin(source, 10));

  assert.equal(recorded.actionCompletions.length, 1);
  assert.deepEqual(mossproutDailyActionDeck(recorded, dayId), {
    dayId,
    slotSequences: { together: 0, field: 0, garden: 0 },
    consumedActionIds: { together: [], field: [], garden: [] },
  });

  const withNormalCompletion = commitActionCompletion(recorded, actionCommandFromOrigin({
      ...source,
      actionId: 'mossprout:conversation:normal-field-note',
      instanceId: `${dayId}:field:0:mossprout:conversation:normal-field-note`,
      journeyId: undefined,
      journeyActionId: undefined,
      rotationEffect: 'consume',
      reward: { kind: 'bond', amount: 4 },
    }, 20));
  assert.equal(mossproutDailyActionDeck(withNormalCompletion, dayId).slotSequences.field, 1);
  assert.deepEqual(mossproutDailyActionDeck(withNormalCompletion, dayId).consumedActionIds.field, [
    'mossprout:conversation:normal-field-note',
  ]);
});

test('FTUE-origin completion never consumes a routine slot', () => {
  const dayId = '2026-08-21';
  const actionId = 'mossprout:conversation:mossprout:ftue:first-meeting:calm';
  const source = {
    dayId,
    familyId: 'mossprout' as const,
    actionId,
    instanceId: `${dayId}:together:0:${actionId}`,
    sourceSlotId: 'together' as const,
    slotId: 'together' as const,
    sequence: 0,
    kind: 'fun_chat' as const,
    title: 'Meet Mossprout',
    subtitle: 'Mossprout loved that answer',
    icon: 'bubble.left.fill' as const,
    artworkDefinitionIds: [],
    reward: { kind: 'bond' as const, amount: 4 },
    rotationEffect: 'preserve' as const,
    presentation: 'action_card' as const,
  };

  assert.equal(isMossproutFtueRoutineActionId(actionId), true);
  const newlyRecorded = commitActionCompletion(emptyRelationshipProgressState(), actionCommandFromOrigin(source, 10));
  assert.equal(newlyRecorded.mossproutDailyActionDecks.length, 0);

  assert.equal(newlyRecorded.actionCompletions[0]?.rotationEffect, 'preserve');
  assert.deepEqual(mossproutDailyActionDeck(newlyRecorded, dayId), {
    dayId,
    slotSequences: { together: 0, field: 0, garden: 0 },
    consumedActionIds: { together: [], field: [], garden: [] },
  });
});

test('completion keeps launch identity while presentation acknowledgement is independent', () => {
  const source = {
    dayId: '2026-08-21', familyId: 'mossprout' as const, actionId: 'mossprout:conversation:weather',
    instanceId: '2026-08-21:together:2:mossprout:conversation:weather', sourceSlotId: 'together' as const,
    slotId: 'garden' as const, sequence: 2, kind: 'fun_chat' as const, title: 'Choose the perfect weather',
    subtitle: 'A very official weather decision', icon: 'bubble.left.fill' as const, artworkDefinitionIds: [],
    reward: { kind: 'bond' as const, amount: 4 }, rotationEffect: 'consume' as const, presentation: 'action_card' as const,
  };
  let state = commitActionCompletion(emptyRelationshipProgressState(), actionCommandFromOrigin(source, 10));
  const completion = state.actionCompletions[0]!;
  assert.equal(completion.actionInstanceId, source.instanceId);
  assert.equal(completion.sourceSlotId, 'together');
  assert.equal(completion.slotId, 'garden');
  assert.equal(state.actionPresentations[0]?.status, 'pending');
  state = attachKatchimeraActionRewardReceipt(state, completion.id, {
    id: 'bond-reward:katchimera-action:weather', eventId: 'katchimera-action:weather', creatureId: 'companion:mossprout',
    kind: 'conversation_completed', points: 4, occurredAt: 10, beforeTotal: 20, afterTotal: 24, beforeLevel: 1, afterLevel: 1,
  });
  assert.equal(state.actionCompletions[0]?.rewardReceipt?.afterTotal, 24);
  assert.equal(state.actionPresentations[0]?.status, 'pending');
  state = acknowledgeKatchimeraActionCompletion(state, completion.id, 50);
  assert.equal(state.actionPresentations[0]?.status, 'dismissed');
});

test('multiple completion presentations retain chronological queue order across days', () => {
  const makeSource = (dayId: string, actionId: string) => ({
    dayId, familyId: 'mossprout' as const, actionId, instanceId: `${dayId}:together:0:${actionId}`,
    sourceSlotId: 'together' as const, slotId: 'together' as const, sequence: 0, kind: 'fun_chat' as const,
    title: actionId, subtitle: '', icon: 'bubble.left.fill' as const, artworkDefinitionIds: [],
    reward: { kind: 'bond' as const, amount: 4 }, rotationEffect: 'consume' as const, presentation: 'action_card' as const,
  });
  let state = commitActionCompletion(emptyRelationshipProgressState(), actionCommandFromOrigin(makeSource('2026-08-22', 'second'), 20));
  state = commitActionCompletion(state, actionCommandFromOrigin(makeSource('2026-08-21', 'first'), 10));
  assert.deepEqual(state.actionCompletions.map((event) => event.actionId), ['second', 'first']);
  const pending = [...state.actionPresentations].sort((left, right) => left.createdAt - right.createdAt);
  assert.deepEqual(pending.map((event) => state.actionCompletions.find((completion) => completion.id === event.completionId)?.actionId), ['first', 'second']);
});

test('self-animated Katchimera completions consume their slot without replaying an outro', () => {
  const input = {
    dayId: '2026-08-21', familyId: 'mossprout' as const, actionId: 'mossprout:goal:walk-outside',
    instanceId: '2026-08-21:field:0:mossprout:goal:walk-outside', slotId: 'field' as const, sequence: 0,
    kind: 'goal_checkoff' as const, title: 'Step outside for five minutes', subtitle: 'A small promise kept',
    icon: 'checkmark.circle.fill' as const, artworkDefinitionIds: [], reward: { kind: 'bond' as const, amount: 5 }, completedAt: 10,
  };
  const state = recordHandledKatchimeraActionCompletion(emptyRelationshipProgressState(), input);
  const receipt = state.actionCompletions[0];
  assert.equal(receipt?.actionId, input.actionId);
  assert.equal(state.actionPresentations[0]?.status, 'dismissed');
  assert.equal(state.mossproutDailyActionDecks[0]?.slotSequences.field, 1);
  assert.deepEqual(state.mossproutDailyActionDecks[0]?.consumedActionIds.field, [input.actionId]);
});

test('legacy duplicate action completions are not migrated', () => {
  const base = {
    dayId: '2026-08-21', familyId: 'mossprout' as const, actionId: 'mossprout:conversation:nature-question',
    slotId: 'together' as const, kind: 'fun_chat' as const, title: 'Mossprout has a question', subtitle: 'Insight found',
    icon: 'sparkles' as const, artworkDefinitionIds: [], reward: { kind: 'bond' as const, amount: 4 }, completedAt: 10,
  };
  const first = { ...base, id: '2026-08-21:first', instanceId: 'first', sequence: 0 };
  const acknowledged = { ...base, id: '2026-08-21:second', instanceId: 'second', sequence: 1, completedAt: 11 };
  const normalized = normalizeRelationshipProgressState({
    ...emptyRelationshipProgressState(),
    acknowledgedActionOutroIds: [acknowledged.id],
    completedActionOutros: [first, acknowledged],
  });

  assert.deepEqual(normalized.actionCompletions, []);
});

test('resetting one relationship day restores empty slots without erasing other days or story progress', () => {
  const dayOne = '2026-08-21';
  const dayTwo = '2026-08-22';
  const completion = {
    dayId: dayOne, familyId: 'mossprout' as const, actionId: 'mossprout:conversation:nature-question',
    instanceId: `${dayOne}:together:session`, slotId: 'together' as const, sequence: 0,
    kind: 'fun_chat' as const, title: 'Mossprout has a question', subtitle: 'Insight found', icon: 'sparkles' as const,
    artworkDefinitionIds: [], reward: { kind: 'bond' as const, amount: 4 }, completedAt: 10,
  };
  let state = recordKatchimeraActionCompletion(emptyRelationshipProgressState(), completion);
  state = skipKatchimeraDayAction(state, dayOne, {
    id: 'mossprout:conversation:journal', instanceId: `${dayOne}:field:0:journal`, slotId: 'field',
    kind: 'journal_prompt', title: 'Make a tiny field note', subtitle: null, icon: 'square.and.pencil', required: false,
    disabled: false, status: 'ready', reward: { kind: 'bond', amount: 4 },
    destination: { kind: 'conversation', definitionId: 'journal' }, completedAt: null, outroAcknowledgedAt: null,
  });
  state = startMossproutJourneyDay(state, dayOne, 1).state;
  state = startMossproutJourneyDay(state, dayTwo, 2).state;
  const storyBefore = state.stories;

  const reset = resetRelationshipProgressForDayForDebug(state, dayOne);

  assert.equal(reset.actionCompletions.some((event) => event.dayId === dayOne), false);
  assert.equal(reset.skippedActionIds.some((id) => id.startsWith(`${dayOne}:`)), false);
  assert.equal(reset.journeyDays.some((journey) => journey.dayId === dayOne), false);
  assert.equal(reset.journeyDays.some((journey) => journey.dayId === dayTwo), true);
  assert.deepEqual(mossproutDailyActionDeck(reset, dayOne), {
    dayId: dayOne,
    slotSequences: { together: 0, field: 0, garden: 0 },
    consumedActionIds: { together: [], field: [], garden: [] },
  });
  assert.equal(reset.stories, storyBefore);
});

test('completed independent Mossprout conversations retain the dashboard action identity', () => {
  const question = mossproutStoryConversationDefinitions.find((definition) => definition.tags?.includes('nature-question'))!;
  const journal = mossproutStoryConversationDefinitions.find((definition) => definition.tags?.includes('nature-journal'))!;
  const questionReceipt = mossproutConversationActionCompletion(question, '2026-08-21', 10);
  const journalReceipt = mossproutConversationActionCompletion(journal, '2026-08-21', 11);

  assert.equal(questionReceipt.actionId, `mossprout:conversation:${question.id}`);
  assert.equal(questionReceipt.title, question.actionTitle);
  assert.equal(questionReceipt.kind, 'fun_chat');
  assert.equal(questionReceipt.artKey, mossproutConversationArtKey(question.id, 'fun_chat'));
  assert.deepEqual(questionReceipt.reward, { kind: 'bond', amount: 4 });
  assert.equal(journalReceipt.actionId, MOSSPROUT_DAILY_FIELD_NOTE_ACTION_ID);
  assert.equal(journalReceipt.title, journal.actionTitle);
  assert.equal(journalReceipt.kind, 'journal_prompt');
  assert.equal(journalReceipt.artKey, mossproutConversationArtKey(journal.id, 'journal_prompt'));
});

test('Mossprout conversation completions keep the visible action row identity', () => {
  const dayId = '2026-08-21';
  const definition = mossproutStoryConversationDefinitions.find((candidate) => candidate.tags?.includes('nature-question'))!;
  const actionId = `mossprout:conversation:${definition.id}`;
  const actions = resolveMossproutDayActions({
    conversations: [{
      definitionId: definition.id,
      mode: 'play',
      title: definition.title,
      label: definition.actionTitle,
    }],
    dayId,
    goals: [],
    journey: null,
    offers: [],
    slotSequences: { together: 3, field: 0, garden: 0 },
    storyComplete: false,
  });
  const visible = actions.find((action) => action.id === actionId)!;
  const instanceId = mossproutActionInstanceId(dayId, 'together', 3, actionId);
  const receipt = mossproutConversationActionCompletion(definition, dayId, 10, instanceId, 3);

  // The required Journey card owns the Together row, so this conversation is
  // visually borrowed by another row without changing its durable identity.
  assert.notEqual(visible.slotId, 'together');
  assert.equal(visible.sourceSlotId, 'together');
  assert.equal(visible.instanceId, instanceId);
  assert.equal(instanceId, `${dayId}:together:3:${actionId}`);
  assert.equal(receipt.actionId, actionId);
  assert.equal(receipt.instanceId, instanceId);
  assert.equal(receipt.sequence, 3);
});

test('every Mossprout field note has its own action-led card title', () => {
  const journals = mossproutStoryConversationDefinitions.filter((definition) => definition.tags?.includes('nature-journal'));
  assert.ok(journals.length >= 6);
  assert.equal(journals.every((definition) => Boolean(definition.actionTitle)), true);
  assert.equal(new Set(journals.map((definition) => definition.actionTitle)).size, journals.length);
  assert.equal(journals.every((definition) => definition.actionTitle !== definition.title), true);
});

test('Mossprout home always gives a clear return target after a completed day', () => {
  let state = startMossproutJourneyDay(emptyRelationshipProgressState(), '2026-08-21', 1).state;
  state = completeMossproutJourneyDay(state, '2026-08-21', { objectiveId: 'first-sprout', activityReceiptId: 'sprout', resolutionId: 'ftue' }, 2);
  const view = resolveMossproutHome({
    beatBody: 'Unused beat body',
    beatTitle: 'Unused beat title',
    journey: mossproutJourneyForDay(state, '2026-08-21'),
    postJourneyAnswered: true,
    storyComplete: false,
  });
  assert.equal(view.title, "Today's Journey is complete");
  assert.equal(view.primaryLabel, 'Talk a little longer');
  assert.equal(view.waitingForTomorrow, true);
});

test.skip('legacy Mossprout macro progression advances once across distinct Journey Days', () => {
  let state = startMossproutJourneyDay(emptyRelationshipProgressState(), '2026-08-21', 1).state;
  state = completeMossproutJourneyDay(state, '2026-08-21', { objectiveId: 'mossprout:objective:first-flower', activityReceiptId: 'a', resolutionId: 'flower' }, 2);
  assert.equal(mossproutStory(state).habitatStage, 1);
  assert.equal(mossproutStory(state).activeBeatId, 'dry-pond:day-1');

  const sameDay = startMossproutJourneyDay(state, '2026-08-21', 3);
  assert.equal(sameDay.journey?.status, 'complete');
  assert.equal(mossproutStory(sameDay.state).activeBeatId, 'dry-pond:day-1');

  for (const [index, dayId] of ['2026-08-22', '2026-08-23', '2026-08-24', '2026-08-25'].entries()) {
    state = startMossproutJourneyDay(state, dayId, 10 + index).state;
    state = completeMossproutJourneyDay(state, dayId, { objectiveId: `dry-${index}`, activityReceiptId: `activity-${index}`, resolutionId: `resolution-${index}` }, 20 + index);
  }
  assert.equal(mossproutStory(state).habitatStage, 2);
  assert.equal(mossproutStory(state).activeBeatId, 'memory-nursery:nursery-key');
});

test.skip('legacy Dry Pond slice alternates narrative, Merge activity, return, and real-day gates', () => {
  let state = startMossproutJourneyDay(emptyRelationshipProgressState(), '2026-08-21', 1).state;
  state = recordMossproutMatchedCard(state, '2026-08-21', 'fernip');
  state = completeMossproutJourneyDay(state, '2026-08-21', { objectiveId: 'first-sprout', activityReceiptId: 'sprout', resolutionId: 'ftue' }, 2);

  state = startMossproutJourneyDay(state, '2026-08-22', 3).state;
  assert.equal(mossproutJourneyForDay(state, '2026-08-22')?.status, 'opening');
  assert.equal(mossproutJourneyForDay(state, '2026-08-22')?.matchedCardId, 'fernip');
  state = completeMossproutJourneyConversation(state, 'mossprout:dry-pond:day-1:opening', 4);
  assert.equal(mossproutJourneyForDay(state, '2026-08-22')?.status, 'activity_available');
  const residentActivity = mossproutJourneyForDay(state, '2026-08-22')!.activity!;
  assert.equal(residentActivity.objectiveId, 'mossprout:objective:place-for-rain');
  state = startMossproutJourneyActivity(state, '2026-08-22');
  state = recordMossproutJourneyOrderServed(state, residentActivity.mergeOrderId, 5);
  state = beginMossproutJourneyReturn(state, '2026-08-22');
  state = completeMossproutJourneyConversation(state, 'mossprout:dry-pond:day-1:resolution', 6);
  assert.equal(mossproutJourneyForDay(state, '2026-08-22')?.status, 'complete');
  assert.equal(mossproutJourneyForDay(state, '2026-08-22')?.completionReceipt?.cardId, 'fernip');
  assert.equal(mossproutStory(state).activeBeatId, 'dry-pond:day-2');

  state = startMossproutJourneyDay(state, '2026-08-23', 7).state;
  state = completeMossproutJourneyOpening(state, '2026-08-23', 8);
  assert.equal(mossproutJourneyForDay(state, '2026-08-23')?.status, 'activity_available');
  const available = mossproutJourneyForDay(state, '2026-08-23');
  assert.equal(available?.status, 'activity_available');
  assert.equal(available?.activity?.objectiveId, 'mossprout:objective:bank-that-holds');
  state = startMossproutJourneyActivity(state, '2026-08-23');
  state = recordMossproutJourneyOrderServed(state, available!.activity!.mergeOrderId, 9);
  assert.equal(mossproutJourneyForDay(state, '2026-08-23')?.status, 'return_available');
  state = beginMossproutJourneyReturn(state, '2026-08-23');
  state = completeMossproutJourneyConversation(state, 'mossprout:dry-pond:day-2:resolution', 10);
  assert.equal(mossproutJourneyForDay(state, '2026-08-23')?.status, 'complete');
  assert.equal(mossproutJourneyForDay(state, '2026-08-23')?.completionReceipt?.cardId, null);
  assert.equal(mossproutJourneyForDay(state, '2026-08-23')?.completionReceipt?.bondPoints, 12);
  assert.equal(mossproutStory(state).activeBeatId, 'dry-pond:day-3');

  state = completeMossproutJourneyConversation(state, 'mossprout:dry-pond:day-2:goal-plan', 10.5);
  assert.equal(mossproutJourneyForDay(state, '2026-08-23')?.completionReceipt?.bondPoints, 16);
  assert.equal(mossproutJourneyForDay(state, '2026-08-23')?.actions.filter((action) => action.status === 'completed').length, 2);

  const sameDay = startMossproutJourneyDay(state, '2026-08-23', 11);
  assert.equal(sameDay.journey?.status, 'complete');
  assert.equal(mossproutStory(sameDay.state).activeBeatId, 'dry-pond:day-3');

  state = startMossproutJourneyDay(state, '2026-08-24', 20).state;
  state = completeMossproutJourneyConversation(state, 'mossprout:dry-pond:day-3:opening', 21);
  const majorActivity = mossproutJourneyForDay(state, '2026-08-24')!.activity!;
  assert.equal(majorActivity.objectiveId, 'mossprout:objective:little-rain-garden');
  state = startMossproutJourneyActivity(state, '2026-08-24');
  state = recordMossproutJourneyOrderServed(state, majorActivity.mergeOrderId, 22);
  state = beginMossproutJourneyReturn(state, '2026-08-24');
  state = completeMossproutJourneyConversation(state, 'mossprout:dry-pond:day-3:resolution', 23);

  state = startMossproutJourneyDay(state, '2026-08-25', 25).state;
  state = completeMossproutJourneyConversation(state, 'mossprout:dry-pond:day-4:opening', 26);
  assert.equal(mossproutJourneyForDay(state, '2026-08-25')?.status, 'living');
  state = makeMossproutResolutionAvailable(state, '2026-08-25', { force: true }, 27);
  state = completeMossproutJourneyConversation(state, 'mossprout:dry-pond:day-4:resolution', 28);
  assert.equal(mossproutJourneyForDay(state, '2026-08-25')?.status, 'complete');
  assert.equal(mossproutStory(state).activeBeatId, 'memory-nursery:nursery-key');
  assert.equal(mossproutStory(state).habitatStage, 2);
});

test.skip('legacy over-threshold saves play every Memory Nursery and Heartwood beat without skipping', () => {
  let state = startMossproutJourneyDay(emptyRelationshipProgressState(), '2026-08-01', 1).state;
  state = completeMossproutJourneyDay(state, '2026-08-01', { objectiveId: 'first', activityReceiptId: 'first', resolutionId: 'first' }, 2);
  for (const [index, dayId] of ['2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05'].entries()) {
    state = startMossproutJourneyDay(state, dayId, 10 + index).state;
    state = completeMossproutJourneyDay(state, dayId, { objectiveId: `pond:${index}`, activityReceiptId: `pond:${index}`, resolutionId: `pond:${index}` }, 20 + index);
  }

  const expectedBeats = [
    'memory-nursery:nursery-key', 'memory-nursery:keepsake-root',
    'memory-nursery:garden-remembers', 'memory-nursery:lantern-bank',
    'heartwood:mirror-for-rain', 'heartwood:rings-of-attention',
    'heartwood:place-that-holds', 'heartwood:heartwood',
  ];
  for (const [index, beatId] of expectedBeats.entries()) {
    const dayId = `2026-08-${String(index + 6).padStart(2, '0')}`;
    const started = startMossproutJourneyDay(state, dayId, 100 + index, 28);
    assert.equal(started.journey?.beatId, beatId);
    state = completeMossproutJourneyDay(started.state, dayId, { objectiveId: `extended:${index}`, activityReceiptId: `extended:${index}`, resolutionId: `extended:${index}` }, 120 + index);
    if (index === 3) assert.equal(mossproutStory(state).habitatStage, 3);
  }
  assert.equal(mossproutStory(state).activeBeatId, 'heartwood:complete');
  assert.equal(mossproutStory(state).habitatStage, 4);
  assert.equal(startMossproutJourneyDay(state, '2026-08-20', 200, 28).reason, 'resting');
});

test('Campaign V2 serves all thirteen anchors on their upcoming active Garden Days', () => {
  let state = emptyRelationshipProgressState();
  for (const episode of MOSSPROUT_CAMPAIGN_EPISODES) {
    const dayId = `2026-09-${String(episode.episodeNumber).padStart(2, '0')}`;
    if (episode.unlockGardenDay > 1) {
      const tooEarly = startMossproutJourneyDay(state, dayId, episode.episodeNumber * 10, episode.unlockGardenDay - 2);
      assert.equal(tooEarly.reason, 'resting');
    }
    const started = startMossproutJourneyDay(state, dayId, episode.episodeNumber * 10, episode.unlockGardenDay - 1);
    assert.equal(started.reason, 'started');
    assert.equal(started.journey?.beatId, episode.beatId);
    state = completeMossproutJourneyDay(started.state, dayId, {
      objectiveId: episode.objectiveId ?? undefined,
      activityReceiptId: `campaign-v2:${episode.episodeNumber}`,
      resolutionId: episode.resolutionConversationId ?? episode.openingConversationId,
    }, episode.episodeNumber * 10 + 1);
  }
  assert.deepEqual(mossproutStory(state).completedBeatIds, MOSSPROUT_CAMPAIGN_EPISODES.map((episode) => episode.beatId));
  assert.equal(mossproutStory(state).habitatStage, 4);
  assert.equal(mossproutStory(state).activeBeatId, 'heartwood:complete');
});

test('Campaign V2 remembers consequential answers and the recurring resident', () => {
  const state = completeMossproutJourneyConversation(emptyRelationshipProgressState(), {
    definitionId: 'mossprout:campaign-v2:test',
    turns: [
      { id: 'one', nodeId: 'scene', optionId: 'promise-surprise', answeredAt: 1 },
      { id: 'two', nodeId: 'scene', optionId: 'lantern-lost-things', answeredAt: 2 },
      { id: 'three', nodeId: 'scene', optionId: 'resident-fernip', answeredAt: 3 },
    ],
    preview: false,
  }, 3);
  assert.equal(mossproutStory(state).storyFacts?.garden_promise, 'surprise');
  assert.equal(mossproutStory(state).storyFacts?.lantern_for, 'lost_things');
  assert.equal(mossproutStory(state).coStarSkinId, 'fernip');
});

test('the modular Mossprout campaign validates and gives every day one authored insight', () => {
  assert.deepEqual(validateJourneyCampaign(MOSSPROUT_JOURNEY_CAMPAIGN), []);
  assert.equal(MOSSPROUT_JOURNEY_CAMPAIGN.days.length, 13);
  assert.equal(new Set(MOSSPROUT_JOURNEY_CAMPAIGN.days.map((day) => day.insightKey)).size, 13);
  assert.deepEqual(MOSSPROUT_JOURNEY_CAMPAIGN.days[0]?.steps.map((step) => step.kind), [
    'conversation', 'merge_orders', 'conversation', 'optional_action', 'complete',
  ]);
  assert.equal(MOSSPROUT_JOURNEY_CAMPAIGN.days[1]?.steps.some((step) => step.kind === 'merge_orders'), true);
  assert.equal(MOSSPROUT_JOURNEY_CAMPAIGN.days[1]?.steps.some((step) => step.kind === 'resident_discovery' && step.selection === 'petalimp'), true);
  assert.equal(MOSSPROUT_JOURNEY_CAMPAIGN.days.slice(2, 9).every((day) => day.steps.some((step) => step.kind === 'resident_discovery')), true);
  assert.equal(MOSSPROUT_JOURNEY_CAMPAIGN.days.slice(2, 9).every((day) => day.steps.every((step) => step.kind !== 'merge_orders')), true);
});
