import assert from 'node:assert/strict';
import test from 'node:test';

import { companionJourneyByFamilyId } from '@/constants/companion-journeys';
import {
  activeConversationForFamily,
  answerJourneyCheckIn,
  answerJourneyConversation,
  checkInForDay,
  currentJourneyConversationNode,
  editJourneyCheckIn,
  emptyCompanionJourneyState,
  goalsForJourneyFamily,
  hasJourneyMomentForDay,
  journeyProgressForGoal,
  journeyQuestionnaireProgress,
  migrateLegacyDiscoveryGoals,
  normaliseCompanionJourneyState,
  primaryGoalForFamily,
  recordJourneyMoment,
  recordJourneyReflection,
  reflectionPromptForJourney,
  setJourneyGoalStatus,
  setJourneyCheckInTaskSuggestionStatus,
  startJourneyCheckIn,
  startJourneyConversation,
  syncJourneyQuestCompletions,
  validateCompanionJourneyDefinitions,
  type CompanionJourneyState,
} from '@/utils/companion-journey';
import { companionCheckInQuestion, companionCheckInSuggestedGoalIds } from '@/utils/companion-check-in';
import type { CompanionQuest } from '@/utils/katchimera-quests';
import { identityForEncounter } from '@/utils/katchimera-identity';
import { themedQuestOffers } from '@/utils/quests/themed';

function answerCurrent(
  state: CompanionJourneyState,
  familyId: string,
  value: string,
  at: number
): CompanionJourneyState {
  const conversation = activeConversationForFamily(state, familyId);
  assert.ok(conversation);
  return answerJourneyConversation(state, conversation.id, value, at).state;
}

function completedQuest(
  questId: string,
  acceptedAt: number,
  completedAt: number,
  completedDayId: string,
  creatureId = 'companion:tasklet'
): CompanionQuest {
  return {
    questId,
    creatureId,
    title: questId,
    hint: 'test',
    acceptedAt,
    acceptedDayId: completedDayId,
    completedAt,
    completedDayId,
  };
}

test('journey catalogues have valid branches, goal types, and stages', () => {
  assert.deepEqual(validateCompanionJourneyDefinitions(), []);
  assert.equal(companionJourneyByFamilyId.size, 25);
  assert.ok(companionJourneyByFamilyId.has('cheerlet'));
  assert.ok(companionJourneyByFamilyId.has('baristabbit'));
  assert.ok(companionJourneyByFamilyId.has('dawnle'));
  assert.ok(companionJourneyByFamilyId.has('encora'));
  assert.ok(companionJourneyByFamilyId.has('errandimp'));
  assert.ok(companionJourneyByFamilyId.has('feastle'));
  assert.ok(companionJourneyByFamilyId.has('flickerbun'));
  assert.ok(companionJourneyByFamilyId.has('gatherglow'));
  assert.ok(companionJourneyByFamilyId.has('mossprout'));
  assert.ok(companionJourneyByFamilyId.has('mendle'));
  assert.ok(companionJourneyByFamilyId.has('pagelet'));
  assert.equal(companionJourneyByFamilyId.has('quietome'), false);
  assert.ok(companionJourneyByFamilyId.has('relicoon'));
  assert.ok(companionJourneyByFamilyId.has('bedrotte'));
  assert.ok(companionJourneyByFamilyId.has('skylo'));
  assert.ok(companionJourneyByFamilyId.has('steppling'));
  assert.ok(companionJourneyByFamilyId.has('tasklet'));
  assert.equal(companionJourneyByFamilyId.has('vesperitt'), false);
  for (const familyId of ['flexel', 'snuglet', 'waglet', 'heartmote', 'kindling']) {
    assert.ok(companionJourneyByFamilyId.has(familyId));
  }
});

test('every You questionnaire is low-friction multiple choice', () => {
  for (const definition of companionJourneyByFamilyId.values()) {
    for (const node of definition.nodes) {
      assert.equal(node.kind, 'single_choice', `${definition.familyId}:${node.id} requires typing`);
      assert.ok((node.options?.length ?? 0) >= 2, `${definition.familyId}:${node.id} has too few choices`);
      assert.notEqual(node.allowCustomText, true, `${definition.familyId}:${node.id} exposes a text answer`);
    }
  }
});

test('an outdated questionnaire session is replaced instead of mixing definition versions', () => {
  const definition = companionJourneyByFamilyId.get('shellio');
  assert.equal(definition?.version, 4);
  const outdated: CompanionJourneyState = {
    ...emptyCompanionJourneyState(),
    conversations: [{
      id: 'shellio-old-water-questionnaire',
      familyId: 'shellio',
      definitionId: 'shellio-water-connection',
      definitionVersion: 3,
      currentNodeId: 'shellio-conditions',
      startedAt: 50,
      answers: [{ nodeId: 'shellio-meaning', value: 'Connection to a place', answeredAt: 60 }],
    }],
  };

  assert.equal(activeConversationForFamily(outdated, 'shellio'), null);
  const restarted = startJourneyConversation(outdated, 'shellio', 100);
  const active = activeConversationForFamily(restarted, 'shellio');
  assert.equal(active?.definitionVersion, 4);
  assert.equal(active?.currentNodeId, 'shellio-meaning');
});

test('daily-rhythm batch creates actionable Focus goals with scoped suggestions', () => {
  const cases = [
    ['coffee-ritual', ['break', 'skip', 'break'], 'Protect one small drink break in the day'],
    ['errandimp', ['forms', 'batch', 'admin'], 'Handle life admin before it becomes urgent'],
    ['dawnle', ['quiet', 'phone', 'phone'], 'Choose what gets my attention at the start of the day'],
    ['mendle', ['kindness', 'judge', 'kind'], 'Replace harsh self-talk with something fairer'],
  ] as const;

  for (const [familyId, answers, expectedTitle] of cases) {
    let state = startJourneyConversation(emptyCompanionJourneyState(), familyId, 100);
    state = answerCurrent(state, familyId, answers[0], 110);
    state = answerCurrent(state, familyId, answers[1], 120);
    const session = activeConversationForFamily(state, familyId)!;
    const result = answerJourneyConversation(state, session.id, answers[2], 130);
    assert.equal(result.completed, true);
    assert.equal(primaryGoalForFamily(result.state, familyId)?.title, expectedTitle);
    assert.ok(result.suggestedQuickGoalIds.every((id) => id.startsWith(`${familyId}:`)));
  }
});

test('scaffolded batch journeys create distinct Focus goals and scoped suggestions', () => {
  const cases = [
    ['flickerbun', ['ideas', 'distraction', 'full-attention'], 'Give chosen screen stories my full attention'],
    ['relicoon', ['objects', 'museum', 'visit'], 'Make room for a museum or cultural visit'],
    ['encora', ['make', 'practice', 'practice'], 'Return gently to making or practising music'],
    ['gatherglow', ['deeper', 'surface', 'deepen'], 'Create space for more genuine conversation'],
    ['cheerlet', ['distance', 'next', 'progress'], 'Mark progress while it is still unfolding'],
    ['skylo', ['areas', 'routine', 'neighbourhood'], 'Get to know one neighbourhood beyond my usual route'],
  ] as const;

  for (const [familyId, answers, expectedTitle] of cases) {
    let state = startJourneyConversation(emptyCompanionJourneyState(), familyId, 100);
    state = answerCurrent(state, familyId, answers[0], 110);
    state = answerCurrent(state, familyId, answers[1], 120);
    const session = activeConversationForFamily(state, familyId)!;
    const result = answerJourneyConversation(state, session.id, answers[2], 130);
    assert.equal(result.completed, true);
    assert.equal(primaryGoalForFamily(result.state, familyId)?.title, expectedTitle);
    assert.ok(result.suggestedQuickGoalIds.length >= 2);
    assert.ok(result.suggestedQuickGoalIds.every((id) => id.startsWith(`${familyId}:`)));
  }
});

test('foundation journeys create plain-language Focus goals with scoped suggestions', () => {
  const cases = [
    ['steppling', ['energy', 'breaks', 'daily-ten'], 'Make room for short walks'],
    ['feastle', ['connection', 'time', 'shared-food'], 'Create more moments around shared food'],
    ['pagelet', ['subject', 'attention', 'understand-topic'], 'Follow one question until I understand it better'],
    ['mossprout', ['attention', 'street', 'notice-season'], 'Pay attention to small seasonal changes'],
  ] as const;

  for (const [familyId, answers, expectedTitle] of cases) {
    let state = startJourneyConversation(emptyCompanionJourneyState(), familyId, 100);
    state = answerCurrent(state, familyId, answers[0], 110);
    state = answerCurrent(state, familyId, answers[1], 120);
    const session = activeConversationForFamily(state, familyId)!;
    const result = answerJourneyConversation(state, session.id, answers[2], 130);
    assert.equal(result.completed, true);
    assert.equal(primaryGoalForFamily(result.state, familyId)?.title, expectedTitle);
    assert.ok(result.suggestedQuickGoalIds.length >= 2);
    assert.ok(result.suggestedQuickGoalIds.every((id) => id.startsWith(`${familyId}:`)));
  }
});

test('Feastle turns everyday nourishment answers into matching practical goals', () => {
  let state = startJourneyConversation(emptyCompanionJourneyState(), 'feastle', 100);
  state = answerCurrent(state, 'feastle', 'ease', 110);
  assert.equal(currentJourneyConversationNode(activeConversationForFamily(state, 'feastle'))?.id, 'nourishment-friction');
  state = answerCurrent(state, 'feastle', 'decisions', 120);
  assert.equal(currentJourneyConversationNode(activeConversationForFamily(state, 'feastle'))?.id, 'nourishment-goal');

  const session = activeConversationForFamily(state, 'feastle')!;
  const result = answerJourneyConversation(state, session.id, 'fewer-decisions', 130);
  assert.equal(result.completed, true);
  assert.equal(primaryGoalForFamily(result.state, 'feastle')?.goalTypeId, 'everyday-nourishment');
  assert.equal(primaryGoalForFamily(result.state, 'feastle')?.title, 'Make everyday food decisions easier');
  assert.deepEqual(result.suggestedQuickGoalIds, [
    'feastle:two-meal-list',
    'feastle:reduce-one-decision',
    'feastle:plan-meal',
  ]);
});

test('Bedrotte and Snoozle share one Rest Journey, goal ledger, and quest catalogue', () => {
  const bedrotte = identityForEncounter('location_home_evening_bedrotte', 'bedrotte');
  const snoozle = identityForEncounter('state_well_rested_snoozle', 'snoozle');
  assert.ok(bedrotte);
  assert.ok(snoozle);
  assert.equal(bedrotte.familyId, 'bedrotte');
  assert.equal(snoozle.familyId, 'bedrotte');
  assert.equal(bedrotte.companionId, snoozle.companionId);
  assert.equal(companionJourneyByFamilyId.has('bedrotte'), true);
  assert.equal(companionJourneyByFamilyId.has('snoozle'), false);

  let state = startJourneyConversation(emptyCompanionJourneyState(), bedrotte.familyId, 100);
  state = answerCurrent(state, snoozle.familyId, 'wind-down', 110);
  assert.equal(currentJourneyConversationNode(activeConversationForFamily(state, bedrotte.familyId))?.id, 'wind-down-goal');
  state = answerCurrent(state, bedrotte.familyId, 'quiet-ritual', 120);
  const restSession = activeConversationForFamily(state, snoozle.familyId)!;
  const restCompleted = answerJourneyConversation(state, restSession.id, 'switching-off', 130);
  state = restCompleted.state;
  assert.equal(restCompleted.completed, true);
  assert.deepEqual(restCompleted.suggestedQuickGoalIds, ['sleep-rest:phone-away', 'sleep-rest:gentler-night']);
  const goal = primaryGoalForFamily(state, bedrotte.familyId);
  assert.equal(goal?.goalTypeId, 'wind-down');
  assert.equal(goalsForJourneyFamily(state, snoozle.familyId)[0]?.id, goal?.id);

  state = syncJourneyQuestCompletions(state, [
    completedQuest('quest-rest-wind-down', 200, 250, '2026-07-25', bedrotte.companionId),
    completedQuest('quest-bedrotte-rest-note', 300, 350, '2026-07-28', snoozle.companionId),
  ]);
  assert.equal(journeyProgressForGoal(state, goal!)?.questCompletions, 2);
  assert.equal(new Set(state.questEvents.map((event) => event.goalId)).size, 1);

  const bedrotteOffers = themedQuestOffers('good_sleep', 'night', 'bedrotte')
    .filter((offer) => offer.family === 'note' || offer.id === 'quest-early-night')
    .map((offer) => offer.id)
    .sort();
  const snoozleOffers = themedQuestOffers('good_sleep', 'night', 'snoozle')
    .filter((offer) => offer.family === 'note' || offer.id === 'quest-early-night')
    .map((offer) => offer.id)
    .sort();
  assert.deepEqual(bedrotteOffers, snoozleOffers);
  assert.ok(bedrotteOffers.includes('quest-rest-weekly-review'));
});

test('Rest quests contribute only when they fit the selected goal type', () => {
  let state = startJourneyConversation(emptyCompanionJourneyState(), 'sleep-rest', 100);
  state = answerCurrent(state, 'sleep-rest', 'recovery', 110);
  state = answerCurrent(state, 'sleep-rest', 'quiet-break', 120);
  state = answerCurrent(state, 'sleep-rest', 'responsibility', 130);
  const goal = primaryGoalForFamily(state, 'sleep-rest')!;

  state = syncJourneyQuestCompletions(state, [
    completedQuest('quest-early-night', 200, 250, '2026-07-25', 'companion:sleep-rest'),
    completedQuest('quest-rest-recovery-checkin', 300, 350, '2026-07-28', 'companion:sleep-rest'),
  ]);
  assert.equal(state.questEvents.some((event) => event.questId === 'quest-early-night'), true);
  assert.equal(journeyProgressForGoal(state, goal)?.questCompletions, 2);
});

test('Tasklet conversation branches into a persistent goal and follow-up', () => {
  let state = startJourneyConversation(emptyCompanionJourneyState(), 'tasklet', 100);
  let conversation = activeConversationForFamily(state, 'tasklet');
  assert.equal(currentJourneyConversationNode(conversation)?.id, 'attention');
  assert.deepEqual(
    journeyQuestionnaireProgress(companionJourneyByFamilyId.get('tasklet')!, conversation!),
    { current: 1, total: 3, ratio: 1 / 3 }
  );

  state = answerCurrent(state, 'tasklet', 'project', 110);
  conversation = activeConversationForFamily(state, 'tasklet');
  assert.equal(currentJourneyConversationNode(conversation)?.id, 'project-goal');
  assert.deepEqual(
    journeyQuestionnaireProgress(companionJourneyByFamilyId.get('tasklet')!, conversation!),
    { current: 2, total: 3, ratio: 2 / 3 }
  );

  state = answerCurrent(state, 'tasklet', 'next-milestone', 120);
  const goal = primaryGoalForFamily(state, 'tasklet');
  assert.equal(goal?.goalTypeId, 'project');
  assert.equal(goal?.title, 'Finish the next meaningful project milestone');
  assert.equal(currentJourneyConversationNode(activeConversationForFamily(state, 'tasklet'))?.id, 'friction');

  const finalSession = activeConversationForFamily(state, 'tasklet')!;
  const completed = answerJourneyConversation(state, finalSession.id, 'time', 130);
  state = completed.state;
  assert.equal(completed.completed, true);
  assert.deepEqual(completed.suggestedQuickGoalIds, ['tasklet:next-action', 'tasklet:ten-minutes', 'tasklet:focus-block']);
  assert.equal(activeConversationForFamily(state, 'tasklet'), null);
  assert.equal(goalsForJourneyFamily(state, 'tasklet').length, 1);
});

test('legacy Vesperitt routes into Bedrotte’s shared Rest Focus', () => {
  let state = startJourneyConversation(emptyCompanionJourneyState(), 'vesperitt', 100);
  assert.equal(activeConversationForFamily(state, 'vesperitt')?.familyId, 'bedrotte');
  state = answerCurrent(state, 'vesperitt', 'wind-down', 110);
  state = answerCurrent(state, 'vesperitt', 'quiet-ritual', 120);
  state = answerCurrent(state, 'vesperitt', 'switching-off', 130);
  assert.equal(primaryGoalForFamily(state, 'vesperitt')?.familyId, 'bedrotte');
  assert.equal(primaryGoalForFamily(state, 'vesperitt')?.goalTypeId, 'wind-down');
  assert.equal(activeConversationForFamily(state, 'vesperitt'), null);
});

test('quest events are idempotent and move the current goal through stages', () => {
  let state = startJourneyConversation(emptyCompanionJourneyState(), 'tasklet', 100);
  state = answerCurrent(state, 'tasklet', 'project', 110);
  state = answerCurrent(state, 'tasklet', 'next-milestone', 120);
  state = answerCurrent(state, 'tasklet', 'time', 130);
  const goal = primaryGoalForFamily(state, 'tasklet')!;

  const quests = [
    completedQuest('quest-goal-note', 50, 90, '2026-07-20'),
    completedQuest('quest-tasklet-next-action', 200, 250, '2026-07-25'),
    completedQuest('quest-tasklet-clear-three', 300, 350, '2026-07-28'),
    completedQuest('quest-tasklet-tomorrow-first', 400, 450, '2026-07-31'),
  ];
  state = syncJourneyQuestCompletions(state, quests);
  state = syncJourneyQuestCompletions(state, quests);
  assert.equal(state.questEvents.length, 3);
  assert.equal(journeyProgressForGoal(state, goal)?.questCompletions, 3);
  assert.equal(journeyProgressForGoal(state, goal)?.currentStage.id, 'review');

  state = recordJourneyReflection(state, 'tasklet', 'memory-1', 500, '2026-08-01');
  state = recordJourneyReflection(state, 'tasklet', 'memory-1', 500, '2026-08-01');
  assert.equal(state.reflectionEvents.length, 1);
  assert.equal(journeyProgressForGoal(state, goal)?.currentStage.id, 'decide');
  assert.match(reflectionPromptForJourney(state, 'tasklet') ?? '', /next meaningful project milestone/);

  state = setJourneyGoalStatus(state, goal.id, 'completed', 600);
  assert.equal(journeyProgressForGoal(state, state.goals[0]!)?.stages.every((stage) => stage.complete), true);
});

test('manual moments advance the current goal once per day', () => {
  let state = startJourneyConversation(emptyCompanionJourneyState(), 'vesperitt', 100);
  state = answerCurrent(state, 'vesperitt', 'wind-down', 110);
  state = answerCurrent(state, 'vesperitt', 'quiet-ritual', 120);
  state = answerCurrent(state, 'vesperitt', 'switching-off', 130);
  const goal = primaryGoalForFamily(state, 'vesperitt')!;

  const first = recordJourneyMoment(state, 'vesperitt', 'restored', '', 200, '2026-07-25');
  assert.equal(first.recorded, true);
  assert.equal(hasJourneyMomentForDay(first.state, goal.id, '2026-07-25'), true);
  assert.equal(journeyProgressForGoal(first.state, goal)?.moments, 1);

  const repeated = recordJourneyMoment(first.state, 'vesperitt', 'stopped', '', 250, '2026-07-25');
  assert.equal(repeated.recorded, false);
  assert.equal(repeated.reason, 'already_recorded_today');
  assert.equal(repeated.state.momentEvents.length, 1);

  const secondDay = recordJourneyMoment(repeated.state, 'vesperitt', 'boundary', '', 300, '2026-07-26');
  assert.equal(journeyProgressForGoal(secondDay.state, goal)?.moments, 2);
});

test('a quest and manual check-in on the same day count as one noticed moment', () => {
  let state = startJourneyConversation(emptyCompanionJourneyState(), 'tasklet', 100);
  state = answerCurrent(state, 'tasklet', 'project', 110);
  state = answerCurrent(state, 'tasklet', 'next-milestone', 120);
  state = answerCurrent(state, 'tasklet', 'time', 130);
  const goal = primaryGoalForFamily(state, 'tasklet')!;

  state = syncJourneyQuestCompletions(state, [
    completedQuest('quest-tasklet-next-action', 200, 250, '2026-07-25'),
  ]);
  const manual = recordJourneyMoment(state, 'tasklet', 'moved-forward', '', 300, '2026-07-25');
  assert.equal(manual.recorded, false);
  assert.equal(manual.reason, 'already_recorded_today');
  assert.equal(journeyProgressForGoal(manual.state, goal)?.moments, 1);
});

test('each family keeps one current focus and preserves earlier focuses as paused history', () => {
  let state = emptyCompanionJourneyState();
  const projectDirections = ['next-milestone', 'clear-plan', 'restart'] as const;
  for (let index = 0; index < 3; index += 1) {
    state = startJourneyConversation(state, 'tasklet', 100 + index * 10);
    state = answerCurrent(state, 'tasklet', 'project', 101 + index * 10);
    state = answerCurrent(state, 'tasklet', projectDirections[index]!, 102 + index * 10);
    state = answerCurrent(state, 'tasklet', 'time', 103 + index * 10);
  }
  assert.equal(goalsForJourneyFamily(state, 'tasklet').filter((goal) => goal.status === 'active').length, 1);
  assert.equal(goalsForJourneyFamily(state, 'tasklet').filter((goal) => goal.status === 'paused').length, 2);
  assert.equal(goalsForJourneyFamily(state, 'tasklet').filter((goal) => goal.isPrimary).length, 1);
  assert.equal(primaryGoalForFamily(state, 'tasklet')?.title, 'Restart momentum on this project');

  const second = goalsForJourneyFamily(state, 'tasklet').find((goal) => goal.title === 'Create a clear plan for this project')!;
  state = setJourneyGoalStatus(state, second.id, 'active', 200);
  assert.equal(primaryGoalForFamily(state, 'tasklet')?.id, second.id);
  assert.equal(goalsForJourneyFamily(state, 'tasklet').filter((goal) => goal.status === 'active').length, 1);

  state = startJourneyConversation(state, 'tasklet', 300);
  state = answerCurrent(state, 'tasklet', 'project', 301);
  const session = activeConversationForFamily(state, 'tasklet')!;
  const replaced = answerJourneyConversation(state, session.id, 'smaller-scope', 302);
  assert.equal(replaced.blockedReason, null);
  assert.equal(replaced.state.goals.length, 4);
  assert.equal(primaryGoalForFamily(replaced.state, 'tasklet')?.title, 'Reduce this project to a manageable scope');
  assert.equal(goalsForJourneyFamily(replaced.state, 'tasklet').filter((goal) => goal.status === 'active').length, 1);
});

test('legacy foundation and specialist discovery goals migrate once', () => {
  const discovery = {
    schemaVersion: 1 as const,
    answers: [
      {
        id: 'legacy-rest',
        familyId: 'sleep-rest',
        promptId: 'sleep-rest:wind-down-goal',
        value: 'Leave the phone outside the bedroom',
        answeredAt: 90,
        goalStatus: 'active' as const,
      },
      {
        id: 'legacy-1',
        familyId: 'tasklet',
        promptId: 'tasklet:focus-goal',
        value: 'Finish the launch',
        answeredAt: 100,
        goalStatus: 'active' as const,
      },
      {
        id: 'legacy-2',
        familyId: 'vesperitt',
        promptId: 'vesperitt:night-intention',
        value: 'Protect drawing time',
        answeredAt: 110,
        goalStatus: 'paused' as const,
      },
      {
        id: 'legacy-shellio',
        familyId: 'shellio',
        promptId: 'shellio:quest-goal',
        value: 'Return to the canal safely',
        answeredAt: 120,
        goalStatus: 'active' as const,
      },
    ],
  };
  const first = migrateLegacyDiscoveryGoals(emptyCompanionJourneyState(), discovery, 200);
  const repeated = migrateLegacyDiscoveryGoals(first, discovery, 300);
  assert.equal(first.goals.length, 4);
  assert.equal(repeated.goals.length, 4);
  assert.equal(goalsForJourneyFamily(first, 'sleep-rest').some((goal) => goal.goalTypeId === 'wind-down'), true);
  assert.equal(primaryGoalForFamily(first, 'tasklet')?.title, 'Finish the launch');
  assert.equal(goalsForJourneyFamily(first, 'vesperitt').find((goal) => goal.id.includes('vesperitt'))?.status, 'paused');
  assert.equal(primaryGoalForFamily(first, 'shellio')?.goalTypeId, 'shellio-direction');
  assert.equal(primaryGoalForFamily(first, 'shellio')?.title, 'Return to the canal safely');
});

test('daily check-ins branch over three taps and reward journey progress only once', () => {
  let state = emptyCompanionJourneyState();
  state = startJourneyConversation(state, 'tasklet', 100);
  state = answerCurrent(state, 'tasklet', 'project', 110);
  state = answerCurrent(state, 'tasklet', 'next-milestone', 120);
  const completedFocus = answerJourneyConversation(
    state,
    activeConversationForFamily(state, 'tasklet')!.id,
    'time',
    130
  );
  state = completedFocus.state;
  const goal = primaryGoalForFamily(state, 'tasklet')!;
  const started = startJourneyCheckIn(state, {
    companionId: 'companion:tasklet',
    familyId: 'tasklet',
    dayId: '2026-07-26',
  }, 200);
  state = started.state;
  assert.equal(checkInForDay(state, 'companion:tasklet', '2026-07-26')?.id, started.checkIn.id);

  const firstQuestion = companionCheckInQuestion({
    checkIn: started.checkIn,
    definition: companionJourneyByFamilyId.get('tasklet')!,
    role: null,
    goal,
  });
  assert.equal(firstQuestion?.id, 'moment');
  let result = answerJourneyCheckIn(state, {
    checkInId: started.checkIn.id,
    questionId: 'moment',
    optionId: 'moved-forward',
    label: 'I moved it forward',
  }, 210);
  state = result.state;
  result = answerJourneyCheckIn(state, {
    checkInId: started.checkIn.id,
    questionId: 'effect',
    optionId: 'blocked',
    label: 'It got in the way',
  }, 220);
  state = result.state;
  const taskIds = companionCheckInSuggestedGoalIds({
    answers: [
      ...result.checkIn!.answers,
      { questionId: 'next', optionId: 'smaller', label: 'Make the next step easier', suggestsTasks: true, answeredAt: 230 },
    ],
    definition: companionJourneyByFamilyId.get('tasklet')!,
    goal,
  });
  assert.ok(taskIds.length > 0);
  result = answerJourneyCheckIn(state, {
    checkInId: started.checkIn.id,
    questionId: 'next',
    optionId: 'smaller',
    label: 'Make the next step easier',
    suggestsTasks: true,
    suggestedQuickGoalIds: taskIds,
  }, 230);
  state = result.state;
  assert.equal(result.completedNow, true);
  assert.equal(state.reflectionEvents.length, 1);
  assert.equal(result.checkIn?.taskSuggestionStatus, 'pending');

  state = setJourneyCheckInTaskSuggestionStatus(state, started.checkIn.id, 'added', 240);
  assert.equal(checkInForDay(state, 'companion:tasklet', '2026-07-26')?.taskSuggestionStatus, 'added');
  state = editJourneyCheckIn(state, started.checkIn.id, 250);
  assert.equal(checkInForDay(state, 'companion:tasklet', '2026-07-26')?.completedAt, undefined);
  assert.equal(state.reflectionEvents.length, 1);
});

test('check-ins remain useful without a Journey focus and do not invent tasks', () => {
  const started = startJourneyCheckIn(emptyCompanionJourneyState(), {
    companionId: 'companion:signalhop',
    familyId: 'signalhop',
    dayId: '2026-07-26',
  }, 100);
  const question = companionCheckInQuestion({
    checkIn: started.checkIn,
    definition: null,
    role: null,
    goal: null,
  });
  assert.equal(question?.id, 'moment');
  assert.equal(question?.options.length, 4);
  assert.deepEqual(companionCheckInSuggestedGoalIds({
    answers: [{ questionId: 'next', optionId: 'notice', label: 'Notice it again', suggestsTasks: true, answeredAt: 110 }],
    definition: null,
    goal: null,
  }), []);
});

test('bond invitations use a coherent three-question conversation and repair stale options', () => {
  const legacyOptions = [
    { id: 'supported', label: 'It supported me' },
    { id: 'mixed', label: 'It felt mixed' },
    { id: 'difficult', label: 'It felt difficult' },
    { id: 'noticed', label: 'I noticed something new' },
  ];
  const correctedOptions = [
    { id: 'gentle-encouragement', label: 'Encourage me gently' },
    { id: 'notice-patterns', label: 'Help me notice patterns' },
    { id: 'small-suggestions', label: 'Keep suggestions small' },
    { id: 'set-my-pace', label: 'Let me set the pace' },
  ];
  let started = startJourneyCheckIn(emptyCompanionJourneyState(), {
    companionId: 'companion:steppling',
    familyId: 'steppling',
    dayId: '2026-08-02',
    contentItemId: 'steppling:bond:2',
    contentPrompt: 'What would you like Steppling to understand about you?',
    contentOptions: legacyOptions,
  }, 100);
  let answered = answerJourneyCheckIn(started.state, {
    checkInId: started.checkIn.id,
    questionId: 'moment',
    optionId: 'supported',
    label: 'It supported me',
  }, 110);
  started = startJourneyCheckIn(answered.state, {
    companionId: 'companion:steppling',
    familyId: 'steppling',
    dayId: '2026-08-02',
    contentItemId: 'steppling:bond:2',
    contentPrompt: 'What would you like Steppling to understand about you?',
    contentOptions: correctedOptions,
  }, 120);
  assert.deepEqual(started.checkIn.answers, []);
  assert.deepEqual(started.checkIn.contentOptions, correctedOptions);

  const first = companionCheckInQuestion({
    checkIn: started.checkIn,
    definition: companionJourneyByFamilyId.get('steppling')!,
    role: null,
    goal: null,
  });
  assert.deepEqual(first?.options.map((option) => option.label), correctedOptions.map((option) => option.label));

  answered = answerJourneyCheckIn(started.state, {
    checkInId: started.checkIn.id,
    questionId: 'moment',
    optionId: correctedOptions[0].id,
    label: correctedOptions[0].label,
  }, 130);
  const second = companionCheckInQuestion({
    checkIn: answered.checkIn!,
    definition: companionJourneyByFamilyId.get('steppling')!,
    role: null,
    goal: null,
  });
  assert.equal(second?.prompt, 'Why would that be useful to you?');

  answered = answerJourneyCheckIn(answered.state, {
    checkInId: started.checkIn.id,
    questionId: 'effect',
    optionId: 'feel-supported',
    label: 'It would help me feel supported',
  }, 140);
  const third = companionCheckInQuestion({
    checkIn: answered.checkIn!,
    definition: companionJourneyByFamilyId.get('steppling')!,
    role: null,
    goal: null,
  });
  assert.match(third?.prompt ?? '', /use what you shared/i);
  assert.equal(third?.options[0]?.label, 'Bring it into future invitations');
});
