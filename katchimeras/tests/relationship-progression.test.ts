import assert from 'node:assert/strict';
import test from 'node:test';

import {
  acknowledgeMossproutJourneyActionOutro,
  beginMossproutJourneyReturn,
  completeMossproutJourneyConversation,
  completeMossproutJourneyDay,
  completeMossproutJourneyGoalPlan,
  completeMossproutJourneyOpening,
  emptyRelationshipProgressState,
  makeMossproutResolutionAvailable,
  mossproutDailyActionDeck,
  mossproutJourneyForDay,
  mossproutStory,
  normalizeRelationshipProgressState,
  recordMossproutFirstGardenRestored,
  recordKatchimeraActionCompletion,
  recordHandledKatchimeraActionCompletion,
  recordMossproutJourneyOrderServed,
  recordMossproutMatchedCard,
  resetRelationshipProgressForDayForDebug,
  skipKatchimeraDayAction,
  startMossproutJourneyActivity,
  startMossproutJourneyDay,
} from '../game/katchimeras/relationship-progression';
import { mossproutStoryConversationDefinitions } from '../constants/mossprout-story-conversations';
import { composeMossproutVisibleActions, MOSSPROUT_DAILY_FIELD_NOTE_ACTION_ID, mossproutConversationActionCompletion, mossproutConversationArtKey, mossproutGoalArtKey, mossproutJourneyDayStatus, resolveMossproutDayActions, resolveMossproutHome } from '../game/katchimeras/mossprout-home';
import type { KatchimeraDayAction } from '../types/relationship-progression';

test('legacy relationship state normalizes with an empty skipped-action ledger', () => {
  const normalized = normalizeRelationshipProgressState({
    schemaVersion: 1,
    journeyDays: [],
    stories: {},
    acknowledgedActionOutroIds: [],
    completedActionOutros: [],
  });
  assert.deepEqual(normalized.skippedActionIds, []);
  assert.equal(normalized.schemaVersion, 2);
  assert.deepEqual(normalized.mossproutDailyActionDecks, []);
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

test('a completed Mossprout row is inserted without unmounting the card below it', () => {
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
  const completed = {
    ...makeAction('second', 'field'),
    instanceId: 'completion:second',
    disabled: true,
    status: 'completed' as const,
    completedAt: 10,
  };

  assert.deepEqual(
    composeMossproutVisibleActions([first, promoted, incoming], completed).map((action) => action.id),
    ['first', 'second', 'third'],
  );
  assert.deepEqual(
    composeMossproutVisibleActions([first, promoted, incoming], null).map((action) => action.id),
    ['first', 'third', 'new'],
  );
});

test('Mossprout nameplate reports the current Journey Day instead of repeating the companion name', () => {
  assert.deepEqual(mossproutJourneyDayStatus(null, false), {
    eyebrow: "TODAY'S JOURNEY",
    title: 'Ready to Begin',
  });
  assert.deepEqual(mossproutJourneyDayStatus(null, true), {
    eyebrow: 'GARDEN JOURNEY',
    title: 'The Dry Pond Is Restored',
  });

  const started = startMossproutJourneyDay(emptyRelationshipProgressState(), '2026-08-22').state;
  const journey = mossproutJourneyForDay(started, '2026-08-22');
  assert.ok(journey);
  assert.deepEqual(mossproutJourneyDayStatus(journey, false), {
    eyebrow: 'FIRST JOURNEY DAY',
    title: 'Garden Task in Progress',
  });
  assert.deepEqual(mossproutJourneyDayStatus({ ...journey, status: 'complete' }, false), {
    eyebrow: 'FIRST JOURNEY DAY',
    title: 'Journey Day Complete',
  });
});

test('legacy Mossprout slot decks gain empty consumed queues', () => {
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
  assert.deepEqual(normalized.mossproutDailyActionDecks[0]?.consumedActionIds, {
    together: [], field: [], garden: [],
  });
});

test('legacy action outro receipts gain slot identity without replaying or disappearing', () => {
  const normalized = normalizeRelationshipProgressState({
    schemaVersion: 1,
    journeyDays: [], stories: {}, acknowledgedActionOutroIds: [], skippedActionIds: [],
    completedActionOutros: [{
      id: '2026-08-21:mossprout:conversation:old-note', dayId: '2026-08-21', familyId: 'mossprout',
      actionId: 'mossprout:conversation:old-note', kind: 'journal_prompt', title: 'Old note', subtitle: 'Saved',
      icon: 'square.and.pencil', artworkDefinitionIds: [], reward: { kind: 'bond', amount: 4 }, completedAt: 10,
    }],
  });
  assert.equal(normalized.completedActionOutros.length, 1);
  assert.equal(normalized.completedActionOutros[0]?.slotId, 'field');
  assert.equal(normalized.completedActionOutros[0]?.instanceId, 'mossprout:conversation:old-note');
  assert.equal(normalized.completedActionOutros[0]?.sequence, 0);
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
  journey = mossproutJourneyForDay(state, '2026-08-21');
  assert.equal(journey?.status, 'complete');
  assert.equal(journey?.completionReceipt?.bondPoints, 16);
  assert.equal(journey?.actions.find((action) => action.kind === 'playful_game')?.status, 'ready');
  assert.equal(mossproutStory(state).habitatStage, 1);

  state = completeMossproutJourneyConversation(state, 'mossprout:quiet-patch:first-flower:goal-plan', 4);
  state = completeMossproutJourneyConversation(state, 'mossprout:quiet-patch:first-flower:playful', 5);
  assert.equal(mossproutJourneyForDay(state, '2026-08-21')?.completionReceipt?.bondPoints, 24);
});

test('a Journey Garden card uses the live order title, reward, and every requested item', () => {
  let state = startMossproutJourneyDay(emptyRelationshipProgressState(), '2026-08-21', 1).state;
  state = completeMossproutJourneyDay(state, '2026-08-21', { objectiveId: 'first-sprout', activityReceiptId: 'sprout', resolutionId: 'ftue' }, 2);
  state = startMossproutJourneyDay(state, '2026-08-22', 3).state;
  state = completeMossproutJourneyOpening(state, '2026-08-22', 4);
  state = makeMossproutResolutionAvailable(state, '2026-08-22', { force: true }, 5);
  state = completeMossproutJourneyConversation(state, 'mossprout:dry-pond:day-1:resolution', 6);
  state = startMossproutJourneyDay(state, '2026-08-23', 7).state;
  state = completeMossproutJourneyOpening(state, '2026-08-23', 8);

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
  let journey = mossproutJourneyForDay(state, '2026-08-21');
  const offers = [
    { id: 'quest-mossprout-green-photo', title: 'Photograph something green', hint: 'A nature photo', family: 'photo', bondReward: 4 },
    { id: 'quest-mossprout-nature-note', title: 'Keep a tiny field note', hint: 'A nature note', family: 'journal', bondReward: 4 },
  ];
  let actions = resolveMossproutDayActions({ goals: [], journey, offers, storyComplete: false });
  assert.deepEqual(actions.map((action) => action.slotId), ['together', 'field', 'garden']);
  assert.deepEqual(actions.map((action) => action.kind), ['story_chat', 'photo_request', 'fun_chat']);
  assert.equal(actions[0]?.status, 'completed');

  const mainAction = journey?.actions.find((action) => action.kind === 'journey');
  state = acknowledgeMossproutJourneyActionOutro(state, '2026-08-21', mainAction!.id, 3.5);
  journey = mossproutJourneyForDay(state, '2026-08-21');
  actions = resolveMossproutDayActions({ goals: [], journey, offers, storyComplete: false });
  assert.deepEqual(actions.map((action) => action.kind), ['fun_chat', 'photo_request', 'goal_plan']);
  assert.equal(actions.filter((action) => action.kind === 'photo_request' || action.kind === 'note_request').length, 1);
  assert.equal(actions.find((action) => action.kind === 'goal_plan')?.destination.kind, 'focus_questionnaire');

  state = completeMossproutJourneyGoalPlan(state, '2026-08-21', 4);
  actions = resolveMossproutDayActions({ goals: [], journey: mossproutJourneyForDay(state, '2026-08-21'), offers, storyComplete: false });
  assert.equal(actions[0]?.kind, 'goal_plan');
  assert.equal(actions[0]?.status, 'completed');
  assert.equal(actions[1]?.slotId, 'field');

  state = completeMossproutJourneyConversation(state, 'mossprout:quiet-patch:first-flower:playful', 5);
  actions = resolveMossproutDayActions({ goals: [], journey: mossproutJourneyForDay(state, '2026-08-21'), offers, storyComplete: false });
  assert.equal(actions.some((action) => action.slotId === 'together' && action.status === 'completed'), true);
});

test('Mossprout keeps offering independent nature activities after Journey actions are exhausted', () => {
  let state = startMossproutJourneyDay(emptyRelationshipProgressState(), '2026-08-21', 1).state;
  state = recordMossproutFirstGardenRestored(state, '2026-08-21', 'merge-order:first-plant', 2);
  state = completeMossproutJourneyConversation(state, 'mossprout:ftue:chapter-zero-return', 3);
  state = completeMossproutJourneyConversation(state, 'mossprout:quiet-patch:first-flower:goal-plan', 4);
  state = completeMossproutJourneyConversation(state, 'mossprout:quiet-patch:first-flower:playful', 5);
  for (const action of mossproutJourneyForDay(state, '2026-08-21')!.actions) {
    state = acknowledgeMossproutJourneyActionOutro(state, '2026-08-21', action.id, 6);
  }

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
  const twice = recordKatchimeraActionCompletion(once, {
    ...input,
    instanceId: '2026-08-21:field:1:remounted-session',
    sequence: 1,
    completedAt: 11,
  });
  assert.equal(once.completedActionOutros.length, 1);
  assert.equal(twice, once);
  assert.equal(once.completedActionOutros[0]?.id, '2026-08-21:2026-08-21:field:0:mossprout:conversation:field-note');
  assert.equal(once.mossproutDailyActionDecks[0]?.slotSequences.field, 1);
  assert.deepEqual(once.mossproutDailyActionDecks[0]?.consumedActionIds.field, [input.actionId]);
});

test('self-animated Katchimera completions consume their slot without replaying an outro', () => {
  const input = {
    dayId: '2026-08-21', familyId: 'mossprout' as const, actionId: 'mossprout:goal:walk-outside',
    instanceId: '2026-08-21:field:0:mossprout:goal:walk-outside', slotId: 'field' as const, sequence: 0,
    kind: 'goal_checkoff' as const, title: 'Step outside for five minutes', subtitle: 'A small promise kept',
    icon: 'checkmark.circle.fill' as const, artworkDefinitionIds: [], reward: { kind: 'bond' as const, amount: 5 }, completedAt: 10,
  };
  const state = recordHandledKatchimeraActionCompletion(emptyRelationshipProgressState(), input);
  const receipt = state.completedActionOutros[0];
  assert.equal(receipt?.actionId, input.actionId);
  assert.deepEqual(state.acknowledgedActionOutroIds, [receipt?.id]);
  assert.equal(state.mossproutDailyActionDecks[0]?.slotSequences.field, 1);
  assert.deepEqual(state.mossproutDailyActionDecks[0]?.consumedActionIds.field, [input.actionId]);
});

test('legacy duplicate action completions collapse to an acknowledged logical receipt', () => {
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

  assert.deepEqual(normalized.completedActionOutros.map((record) => record.id), [acknowledged.id]);
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

  assert.equal(reset.completedActionOutros.some((record) => record.dayId === dayOne), false);
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

test('Mossprout macro progression advances once across distinct Journey Days', () => {
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
  assert.equal(mossproutStory(state).activeBeatId, 'dry-pond:complete');
});

test('the Dry Pond slice alternates narrative, Merge activity, return, and real-day gates', () => {
  let state = startMossproutJourneyDay(emptyRelationshipProgressState(), '2026-08-21', 1).state;
  state = completeMossproutJourneyDay(state, '2026-08-21', { objectiveId: 'first-sprout', activityReceiptId: 'sprout', resolutionId: 'ftue' }, 2);

  state = startMossproutJourneyDay(state, '2026-08-22', 3).state;
  assert.equal(mossproutJourneyForDay(state, '2026-08-22')?.status, 'opening');
  state = completeMossproutJourneyConversation(state, 'mossprout:dry-pond:day-1:opening', 4);
  assert.equal(mossproutJourneyForDay(state, '2026-08-22')?.status, 'living');
  state = makeMossproutResolutionAvailable(state, '2026-08-22', { signalReceiptId: 'signal:rain' }, 5);
  state = completeMossproutJourneyConversation(state, 'mossprout:dry-pond:day-1:resolution', 6);
  assert.equal(mossproutJourneyForDay(state, '2026-08-22')?.status, 'complete');
  assert.equal(mossproutStory(state).activeBeatId, 'dry-pond:day-2');

  state = startMossproutJourneyDay(state, '2026-08-23', 7).state;
  state = completeMossproutJourneyOpening(state, '2026-08-23', 8);
  assert.equal(mossproutJourneyForDay(state, '2026-08-23')?.status, 'activity_available');
  state = recordMossproutMatchedCard(state, '2026-08-23', 'fernip');
  state = completeMossproutJourneyConversation(state, 'mossprout:game:form-finder', 8.5);
  const available = mossproutJourneyForDay(state, '2026-08-23');
  assert.equal(available?.status, 'activity_available');
  assert.deepEqual(available?.activity?.dropDefinitionIds, ['nature:waterside:1', 'nature:waterside:1', 'nature:garden:1', 'nature:garden:1']);
  state = startMossproutJourneyActivity(state, '2026-08-23');
  state = recordMossproutJourneyOrderServed(state, available!.activity!.mergeOrderId, 9);
  assert.equal(mossproutJourneyForDay(state, '2026-08-23')?.status, 'return_available');
  state = beginMossproutJourneyReturn(state, '2026-08-23');
  state = completeMossproutJourneyConversation(state, 'mossprout:dry-pond:day-2:resolution', 10);
  assert.equal(mossproutJourneyForDay(state, '2026-08-23')?.status, 'complete');
  assert.equal(mossproutJourneyForDay(state, '2026-08-23')?.completionReceipt?.cardId, 'fernip');
  assert.equal(mossproutJourneyForDay(state, '2026-08-23')?.completionReceipt?.bondPoints, 16);
  assert.equal(mossproutStory(state).activeBeatId, 'dry-pond:day-3');

  state = completeMossproutJourneyConversation(state, 'mossprout:dry-pond:day-2:goal-plan', 10.5);
  assert.equal(mossproutJourneyForDay(state, '2026-08-23')?.completionReceipt?.bondPoints, 20);
  assert.equal(mossproutJourneyForDay(state, '2026-08-23')?.actions.filter((action) => action.status === 'completed').length, 3);

  const sameDay = startMossproutJourneyDay(state, '2026-08-23', 11);
  assert.equal(sameDay.journey?.status, 'complete');
  assert.equal(mossproutStory(sameDay.state).activeBeatId, 'dry-pond:day-3');

  for (const [index, day] of [
    { dayId: '2026-08-24', beatId: 'dry-pond:day-3' },
    { dayId: '2026-08-25', beatId: 'dry-pond:day-4' },
  ].entries()) {
    state = startMossproutJourneyDay(state, day.dayId, 20 + index * 5).state;
    state = completeMossproutJourneyConversation(state, `mossprout:${day.beatId}:opening`, 21 + index * 5);
    const activity = mossproutJourneyForDay(state, day.dayId)?.activity;
    assert.ok(activity);
    state = startMossproutJourneyActivity(state, day.dayId);
    state = recordMossproutJourneyOrderServed(state, activity!.mergeOrderId, 22 + index * 5);
    state = beginMossproutJourneyReturn(state, day.dayId);
    state = completeMossproutJourneyConversation(state, `mossprout:${day.beatId}:resolution`, 23 + index * 5);
    assert.equal(mossproutJourneyForDay(state, day.dayId)?.status, 'complete');
  }
  assert.equal(mossproutStory(state).activeBeatId, 'dry-pond:complete');
  assert.equal(mossproutStory(state).habitatStage, 2);
});
