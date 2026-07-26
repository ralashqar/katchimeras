import assert from 'node:assert/strict';
import test from 'node:test';

import { companionJourneyByFamilyId } from '@/constants/companion-journeys';
import {
  activeConversationForFamily,
  answerJourneyConversation,
  currentJourneyConversationNode,
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
  startJourneyConversation,
  syncJourneyQuestCompletions,
  validateCompanionJourneyDefinitions,
  type CompanionJourneyState,
} from '@/utils/companion-journey';
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
  assert.ok(companionJourneyByFamilyId.has('coffee-ritual'));
  assert.ok(companionJourneyByFamilyId.has('dawnle'));
  assert.ok(companionJourneyByFamilyId.has('encora'));
  assert.ok(companionJourneyByFamilyId.has('errandimp'));
  assert.ok(companionJourneyByFamilyId.has('feastle'));
  assert.ok(companionJourneyByFamilyId.has('flickerbun'));
  assert.ok(companionJourneyByFamilyId.has('gatherglow'));
  assert.ok(companionJourneyByFamilyId.has('mossprout'));
  assert.ok(companionJourneyByFamilyId.has('mendle'));
  assert.ok(companionJourneyByFamilyId.has('pagelet'));
  assert.ok(companionJourneyByFamilyId.has('quietome'));
  assert.ok(companionJourneyByFamilyId.has('relicoon'));
  assert.ok(companionJourneyByFamilyId.has('sleep-rest'));
  assert.ok(companionJourneyByFamilyId.has('skylo'));
  assert.ok(companionJourneyByFamilyId.has('steppling'));
  assert.ok(companionJourneyByFamilyId.has('tasklet'));
  assert.ok(companionJourneyByFamilyId.has('vesperitt'));
  for (const familyId of ['flexel', 'sprintail', 'hooplet', 'serveling', 'snuglet', 'waglet', 'whiskit']) {
    assert.ok(companionJourneyByFamilyId.has(familyId));
  }
});

test('daily-rhythm batch creates actionable Focus goals with scoped suggestions', () => {
  const cases = [
    ['coffee-ritual', ['break', 'skip', 'break'], 'Protect one small drink break in the day'],
    ['errandimp', ['forms', 'batch', 'admin'], 'Handle life admin before it becomes urgent'],
    ['dawnle', ['quiet', 'phone', 'phone'], 'Keep the first few minutes of the day phone-free'],
    ['mendle', ['kindness', 'judge', 'kind'], 'Replace harsh self-talk with something fairer'],
    ['quietome', ['question', 'solve', 'question'], 'Stay with one important question without forcing an answer'],
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
    ['steppling', ['energy', 'breaks', 'daily-ten'], 'Make room for a ten-minute walk'],
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

test('Bedrotte and Snoozle share one Rest Journey, goal ledger, and quest catalogue', () => {
  const bedrotte = identityForEncounter('location_home_evening_bedrotte', 'bedrotte');
  const snoozle = identityForEncounter('state_well_rested_snoozle', 'snoozle');
  assert.ok(bedrotte);
  assert.ok(snoozle);
  assert.equal(bedrotte.familyId, 'sleep-rest');
  assert.equal(snoozle.familyId, 'sleep-rest');
  assert.equal(bedrotte.companionId, snoozle.companionId);
  assert.equal(companionJourneyByFamilyId.has('bedrotte'), false);
  assert.equal(companionJourneyByFamilyId.has('snoozle'), false);

  let state = startJourneyConversation(emptyCompanionJourneyState(), bedrotte.familyId, 100);
  state = answerCurrent(state, snoozle.familyId, 'wind-down', 110);
  assert.equal(currentJourneyConversationNode(activeConversationForFamily(state, bedrotte.familyId))?.id, 'wind-down-goal');
  state = answerCurrent(state, bedrotte.familyId, 'Read quietly before bed', 120);
  state = answerCurrent(state, snoozle.familyId, 'switching-off', 130);
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
  state = answerCurrent(state, 'sleep-rest', 'Recover without filling the evening with chores', 120);
  state = answerCurrent(state, 'sleep-rest', 'responsibility', 130);
  const goal = primaryGoalForFamily(state, 'sleep-rest')!;

  state = syncJourneyQuestCompletions(state, [
    completedQuest('quest-early-night', 200, 250, '2026-07-25', 'companion:sleep-rest'),
    completedQuest('quest-rest-recovery-checkin', 300, 350, '2026-07-28', 'companion:sleep-rest'),
  ]);
  assert.equal(state.questEvents.some((event) => event.questId === 'quest-early-night'), false);
  assert.equal(journeyProgressForGoal(state, goal)?.questCompletions, 1);
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

  state = answerCurrent(state, 'tasklet', 'Ship the first usable prototype', 120);
  const goal = primaryGoalForFamily(state, 'tasklet');
  assert.equal(goal?.goalTypeId, 'project');
  assert.equal(goal?.title, 'Ship the first usable prototype');
  assert.equal(currentJourneyConversationNode(activeConversationForFamily(state, 'tasklet'))?.id, 'friction');

  state = answerCurrent(state, 'tasklet', 'time', 130);
  assert.equal(activeConversationForFamily(state, 'tasklet'), null);
  assert.equal(goalsForJourneyFamily(state, 'tasklet').length, 1);
});

test('Vesperitt accidental nights branch to a gentle shift goal', () => {
  let state = startJourneyConversation(emptyCompanionJourneyState(), 'vesperitt', 100);
  state = answerCurrent(state, 'vesperitt', 'scrolling', 110);
  state = answerCurrent(state, 'vesperitt', 'accidental', 120);
  assert.equal(currentJourneyConversationNode(activeConversationForFamily(state, 'vesperitt'))?.id, 'shift-goal');
  state = answerCurrent(state, 'vesperitt', 'Put the phone down after one episode', 130);
  assert.equal(primaryGoalForFamily(state, 'vesperitt')?.goalTypeId, 'shift');
  assert.equal(activeConversationForFamily(state, 'vesperitt'), null);
});

test('Vesperitt final question offers suggested goals and optional custom text', () => {
  let state = startJourneyConversation(emptyCompanionJourneyState(), 'vesperitt', 100);
  state = answerCurrent(state, 'vesperitt', 'making', 110);
  state = answerCurrent(state, 'vesperitt', 'mixed', 120);
  const node = currentJourneyConversationNode(activeConversationForFamily(state, 'vesperitt'));
  assert.equal(node?.id, 'understand-goal');
  assert.equal(node?.kind, 'single_choice');
  assert.equal(node?.allowCustomText, true);
  assert.equal(node?.options?.length, 4);
  assert.deepEqual(
    node?.options?.find((option) => option.id === 'stopping-cues')?.suggestedQuickGoalIds,
    ['vesperitt:end-planned', 'vesperitt:next-morning']
  );

  const session = activeConversationForFamily(state, 'vesperitt')!;
  const answered = answerJourneyConversation(state, session.id, 'stopping-cues', 130);
  state = answered.state;
  assert.deepEqual(answered.suggestedQuickGoalIds, ['vesperitt:end-planned', 'vesperitt:next-morning']);
  assert.equal(primaryGoalForFamily(state, 'vesperitt')?.title, 'Learn what helps me stop when I mean to');
  assert.equal(activeConversationForFamily(state, 'vesperitt'), null);
});

test('Vesperitt stores actionable goal titles and upgrades old answer-shaped titles', () => {
  let state = startJourneyConversation(emptyCompanionJourneyState(), 'vesperitt', 100);
  state = answerCurrent(state, 'vesperitt', 'making', 110);
  state = answerCurrent(state, 'vesperitt', 'mixed', 120);
  state = answerCurrent(state, 'vesperitt', 'chosen-to-drift', 130);
  assert.equal(
    primaryGoalForFamily(state, 'vesperitt')?.title,
    'Notice when and why a chosen night turns into drift'
  );
  assert.equal(
    state.conversations[0]?.answers.at(-1)?.value,
    'When a chosen night turns into drift'
  );

  const goal = primaryGoalForFamily(state, 'vesperitt')!;
  const normalized = normaliseCompanionJourneyState({
    ...state,
    goals: state.goals.map((item) => item.id === goal.id
      ? { ...item, title: 'When a chosen night turns into drift' }
      : item),
  });
  assert.equal(
    primaryGoalForFamily(normalized, 'vesperitt')?.title,
    'Notice when and why a chosen night turns into drift'
  );
});

test('quest events are idempotent and move the current goal through stages', () => {
  let state = startJourneyConversation(emptyCompanionJourneyState(), 'tasklet', 100);
  state = answerCurrent(state, 'tasklet', 'project', 110);
  state = answerCurrent(state, 'tasklet', 'Finish the portfolio', 120);
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
  assert.match(reflectionPromptForJourney(state, 'tasklet') ?? '', /Finish the portfolio/);

  state = setJourneyGoalStatus(state, goal.id, 'completed', 600);
  assert.equal(journeyProgressForGoal(state, state.goals[0]!)?.stages.every((stage) => stage.complete), true);
});

test('manual moments advance the current goal once per day', () => {
  let state = startJourneyConversation(emptyCompanionJourneyState(), 'vesperitt', 100);
  state = answerCurrent(state, 'vesperitt', 'scrolling', 110);
  state = answerCurrent(state, 'vesperitt', 'mixed', 120);
  state = answerCurrent(state, 'vesperitt', 'chosen-to-drift', 130);
  const goal = primaryGoalForFamily(state, 'vesperitt')!;

  const first = recordJourneyMoment(state, 'vesperitt', 'drifted', '', 200, '2026-07-25');
  assert.equal(first.recorded, true);
  assert.equal(hasJourneyMomentForDay(first.state, goal.id, '2026-07-25'), true);
  assert.equal(journeyProgressForGoal(first.state, goal)?.moments, 1);

  const repeated = recordJourneyMoment(first.state, 'vesperitt', 'intentional', '', 250, '2026-07-25');
  assert.equal(repeated.recorded, false);
  assert.equal(repeated.reason, 'already_recorded_today');
  assert.equal(repeated.state.momentEvents.length, 1);

  const secondDay = recordJourneyMoment(repeated.state, 'vesperitt', 'next-day-effect', '', 300, '2026-07-26');
  assert.equal(journeyProgressForGoal(secondDay.state, goal)?.moments, 2);
});

test('a quest and manual check-in on the same day count as one noticed moment', () => {
  let state = startJourneyConversation(emptyCompanionJourneyState(), 'tasklet', 100);
  state = answerCurrent(state, 'tasklet', 'project', 110);
  state = answerCurrent(state, 'tasklet', 'Finish the portfolio', 120);
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
  for (let index = 0; index < 3; index += 1) {
    state = startJourneyConversation(state, 'tasklet', 100 + index * 10);
    state = answerCurrent(state, 'tasklet', 'project', 101 + index * 10);
    state = answerCurrent(state, 'tasklet', `Project ${index + 1}`, 102 + index * 10);
    state = answerCurrent(state, 'tasklet', 'time', 103 + index * 10);
  }
  assert.equal(goalsForJourneyFamily(state, 'tasklet').filter((goal) => goal.status === 'active').length, 1);
  assert.equal(goalsForJourneyFamily(state, 'tasklet').filter((goal) => goal.status === 'paused').length, 2);
  assert.equal(goalsForJourneyFamily(state, 'tasklet').filter((goal) => goal.isPrimary).length, 1);
  assert.equal(primaryGoalForFamily(state, 'tasklet')?.title, 'Project 3');

  const second = goalsForJourneyFamily(state, 'tasklet').find((goal) => goal.title === 'Project 2')!;
  state = setJourneyGoalStatus(state, second.id, 'active', 200);
  assert.equal(primaryGoalForFamily(state, 'tasklet')?.id, second.id);
  assert.equal(goalsForJourneyFamily(state, 'tasklet').filter((goal) => goal.status === 'active').length, 1);

  state = startJourneyConversation(state, 'tasklet', 300);
  state = answerCurrent(state, 'tasklet', 'project', 301);
  const session = activeConversationForFamily(state, 'tasklet')!;
  const replaced = answerJourneyConversation(state, session.id, 'Project 4', 302);
  assert.equal(replaced.blockedReason, null);
  assert.equal(replaced.state.goals.length, 4);
  assert.equal(primaryGoalForFamily(replaced.state, 'tasklet')?.title, 'Project 4');
  assert.equal(goalsForJourneyFamily(replaced.state, 'tasklet').filter((goal) => goal.status === 'active').length, 1);
});

test('legacy Rest, Tasklet, and Vesperitt discovery goals migrate once', () => {
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
    ],
  };
  const first = migrateLegacyDiscoveryGoals(emptyCompanionJourneyState(), discovery, 200);
  const repeated = migrateLegacyDiscoveryGoals(first, discovery, 300);
  assert.equal(first.goals.length, 3);
  assert.equal(repeated.goals.length, 3);
  assert.equal(primaryGoalForFamily(first, 'sleep-rest')?.goalTypeId, 'wind-down');
  assert.equal(primaryGoalForFamily(first, 'tasklet')?.title, 'Finish the launch');
  assert.equal(goalsForJourneyFamily(first, 'vesperitt')[0]?.status, 'paused');
});
