import assert from 'node:assert/strict';
import test from 'node:test';

import {
  companionConversationTopics,
  companionConversationDefinitionsForFamily,
  companionConversationDefinitionsV2,
} from '@/constants/companion-conversations-v2';
import { FEASTLE_FIRST_MEETING_DEFINITION_ID } from '@/constants/feastle-friendship-conversations';
import { BARISTABBIT_FIRST_MEETING_DEFINITION_ID } from '@/constants/baristabbit-story-conversations';
import { resolveMossproutCampaignConversation } from '@/constants/mossprout-campaign-conversations';
import { katchimeraFamilyById, katchimeraSkinById } from '@/constants/katchimera-skins';
import { companionQuickGoalTemplateById, quickGoalTemplatesForFamily } from '@/constants/companion-quick-goals';
import type { ConversationDefinition } from '@/types/companion-conversation';
import {
  CONVERSATION_V2_ENABLED_FAMILIES,
  CONVERSATION_V2_FAMILIES,
  CONVERSATION_V2_IDEAL_SKIN_FAMILIES,
  isConversationV2AuthoredFamily,
  isConversationV2Family,
  isConversationV2IdealSkinFamily,
} from '@/types/companion-conversation';
import type { StoredHomeDayRecord } from '@/types/home';
import {
  answerConversation,
  conversationGameQuestion,
  continueConversation,
  createConversationSession,
  restartInsightConversation,
  selectConversationDefinition,
  selectConversationForMode,
  selectConversationFromPool,
  validateConversationDefinitions,
  validateProfileQuestionGraph,
} from '@/utils/companion-conversation';
import { reconcileConversationJournalSignals } from '@/utils/companion-conversation-signals';
import {
  emptyCompanionContentState,
  normaliseCompanionContentState,
  resetCompanionContentForDay,
  upsertConversationSession,
} from '@/utils/companion-content';
import {
  createJourneyGoalFromProposal,
  emptyCompanionJourneyState,
  renameJourneyGoal,
  setJourneyGoalStatus,
} from '@/utils/companion-journey';
import { questDefinition } from '@/utils/quests/definitions';

const familyIds = ['baristabbit', 'steppling', 'flexel'] as const;
const authoredStoryFamilies = new Set(['baristabbit', 'steppling', 'voyagle', 'flexel', 'bedrotte']);

test('resetting Today makes its conversation pool unserved without erasing prior sessions', () => {
  const definition = companionConversationDefinitionsForFamily('mossprout')[0]!;
  const prior = createConversationSession({ definition, formId: 'mossprout', dayId: '2026-08-21', createdAt: 1 });
  const today = createConversationSession({ definition, formId: 'mossprout', dayId: '2026-08-22', createdAt: 2 });
  let state = upsertConversationSession(emptyCompanionContentState(), prior);
  state = upsertConversationSession(state, today);
  state = {
    ...state,
    servedConversationDayKeys: ['mossprout:2026-08-21', 'mossprout:2026-08-22'],
    conversationSignals: [{
      id: 'signal:today', kind: 'journal', familyId: 'mossprout', sourceId: 'journal:today',
      dayId: '2026-08-22', createdAt: 2, expiresAt: 3,
    }],
    processedConversationEvidenceIds: ['journal:today', 'journal:prior'],
  };

  const reset = resetCompanionContentForDay(state, '2026-08-22');

  assert.deepEqual(reset.conversationSessions.map((session) => session.id), [prior.id]);
  assert.deepEqual(reset.servedConversationDayKeys, ['mossprout:2026-08-21']);
  assert.deepEqual(reset.conversationSignals, []);
  assert.deepEqual(reset.processedConversationEvidenceIds, ['journal:prior']);
});

test('all 25 V2 packs are runtime-enabled while skin onboarding remains art-gated', () => {
  assert.deepEqual(validateConversationDefinitions(companionConversationDefinitionsV2), []);
  assert.equal(companionConversationDefinitionsV2.length, 1376);
  assert.deepEqual(CONVERSATION_V2_ENABLED_FAMILIES, CONVERSATION_V2_FAMILIES);
  assert.deepEqual(CONVERSATION_V2_IDEAL_SKIN_FAMILIES, familyIds);
  assert.equal(isConversationV2Family('feastle'), true);
  assert.equal(isConversationV2AuthoredFamily('feastle'), true);
  assert.equal(isConversationV2IdealSkinFamily('cheerlet'), false);
  for (const familyId of CONVERSATION_V2_IDEAL_SKIN_FAMILIES) {
    assert.ok(katchimeraFamilyById.get(familyId)!.skinIds.every((skinId) => katchimeraSkinById.get(skinId)?.visualKey));
  }
  for (const familyId of CONVERSATION_V2_FAMILIES) {
    const pack = companionConversationDefinitionsForFamily(familyId);
    assert.equal(companionConversationTopics[familyId].length, 8);
    for (const requiredTopic of ['play', 'goals', 'memory']) {
      assert.ok(companionConversationTopics[familyId].some((topic) => topic.id === requiredTopic), `${familyId} needs ${requiredTopic}`);
    }
    assert.ok(katchimeraFamilyById.get(familyId)!.skinIds.length >= 6, `${familyId} needs at least six forms`);
    assert.ok(katchimeraFamilyById.get(familyId)!.skinIds.length <= 12, `${familyId} catalog has grown beyond reviewable scope`);
    if (familyId === 'mossprout') {
      assert.equal(pack.length, 64);
      assert.equal(pack.filter((item) => item.trigger === 'evergreen').length, 55);
      assert.equal(pack.filter((item) => item.trigger === 'journal').length, 3);
      assert.equal(pack.filter((item) => item.trigger === 'goal_debrief').length, 0);
      assert.equal(pack.filter((item) => item.trigger === 'quest_debrief').length, 0);
      assert.equal(pack.filter((item) => item.trigger === 'bond').length, 3);
      assert.equal(pack.filter((item) => item.trigger === 'poll').length, 1);
      assert.equal(pack.filter((item) => item.trigger === 'signature_game').length, 2);
      assert.equal(pack.filter((item) => item.format === 'insight_game').length, 1);
      assert.equal(pack.some((item) => /^mossprout:story:\d+$/.test(item.id)), false);
      assert.ok(pack.every((item) => item.purpose && item.returnTarget && item.repeatPolicy));
      continue;
    }
    assert.equal(pack.length, familyId === 'feastle' ? 73 : authoredStoryFamilies.has(familyId) ? 57 : 53);
    assert.equal(pack.filter((item) => item.trigger === 'evergreen').length, familyId === 'feastle' || authoredStoryFamilies.has(familyId) ? 12 : 11);
    assert.equal(pack.filter((item) => item.isOpener).length, familyId === 'feastle' || authoredStoryFamilies.has(familyId) ? 9 : 8);
    assert.equal(pack.filter((item) => item.trigger === 'journal').length, 6);
    assert.equal(pack.filter((item) => item.trigger === 'goal_debrief').length, 2);
    assert.equal(pack.filter((item) => item.trigger === 'quest_debrief').length, 2);
    assert.equal(pack.filter((item) => item.trigger === 'bond').length, familyId === 'feastle' ? 22 : authoredStoryFamilies.has(familyId) ? 6 : 3);
    assert.equal(pack.filter((item) => item.trigger === 'poll').length, 24);
    assert.equal(pack.filter((item) => item.trigger === 'signature_game').length, 5);
    assert.equal(pack.filter((item) => item.format === 'insight_game').length, familyId === 'feastle' || authoredStoryFamilies.has(familyId) ? 5 : 4);
  }
});

test('Mossprout keeps only the current Journey extras and offers a concise daily nature pool', () => {
  const definitions = companionConversationDefinitionsForFamily('mossprout');
  const journeyQuestions = definitions.filter((definition) => definition.purpose === 'get_to_know' && definition.contextualOnly);
  assert.equal(journeyQuestions.length, 1);
  assert.ok(journeyQuestions.every((definition) => definition.tags?.includes('nature')));
  assert.ok(journeyQuestions.every((definition) => definition.repeatPolicy === 'once_ever'));
  assert.ok(journeyQuestions.every((definition) => definition.nodes.filter((node) => node.kind === 'choice' || node.kind === 'poll').length === 1));
  assert.equal(definitions.some((definition) => definition.id.includes('dry-pond:day-')), false);

  const dailyQuestions = definitions.filter((definition) => definition.tags?.includes('nature-question'));
  assert.equal(dailyQuestions.length, 8);
  assert.ok(dailyQuestions.every((definition) => Boolean(definition.actionTitle)));
  assert.equal(new Set(dailyQuestions.map((definition) => definition.actionTitle)).size, dailyQuestions.length);
  assert.equal(dailyQuestions.some((definition) => definition.actionTitle === 'Mossprout has a question'), false);
  assert.ok(dailyQuestions.every((definition) => !definition.contextualOnly && definition.repeatPolicy === 'after_cooldown'));
  assert.equal(dailyQuestions.filter((definition) => definition.format === 'poll').length, 4);
  assert.equal(dailyQuestions.filter((definition) => definition.format === 'narrative').length, 4);
  assert.equal(dailyQuestions.filter((definition) => definition.format === 'insight_game').length, 0);
  assert.ok(dailyQuestions.filter((definition) => definition.format === 'poll')
    .every((definition) => definition.nodes.some((node) => node.kind === 'poll')));
  assert.ok(dailyQuestions.every((definition) => {
    const interactions = definition.nodes.filter((node) => node.kind === 'choice' || node.kind === 'poll');
    return interactions.length >= 1 && interactions.length <= 2;
  }));

  const dailyJournals = definitions.filter((definition) => definition.tags?.includes('nature-journal'));
  assert.equal(dailyJournals.length, 6);
  assert.ok(dailyJournals.every((definition) => definition.nodes.some((node) => node.kind === 'journal_handoff')));
});

test('Mossprout post-Journey selectors keep the retired quick-goal planner out of the nature pool', () => {
  const definitions = companionConversationDefinitionsForFamily('mossprout');
  const shared = { familyId: 'mossprout' as const, definitions, sessions: [], dayId: '2026-08-21', bondLevel: 1 as const, friendshipLevel: 1 };
  const question = selectConversationFromPool({ ...shared, poolId: 'nature-question', seed: 'mossprout:question' });
  const insight = selectConversationForMode({ ...shared, mode: 'discover', seed: 'mossprout:insight' });
  const journal = selectConversationFromPool({ ...shared, poolId: 'nature-journal', seed: 'mossprout:journal' });
  const plan = selectConversationFromPool({ ...shared, poolId: 'goals', seed: 'mossprout:plan' });

  assert.ok(question?.tags?.includes('nature-question'));
  assert.ok(journal?.tags?.includes('nature-journal'));
  assert.equal(insight?.id, 'mossprout:insight:nature-connection');
  assert.equal(plan, null);
  const retiredQuickGoalPlanner = definitions.find((definition) => definition.id === 'mossprout:conversation:nature-goal-discovery');
  assert.equal(retiredQuickGoalPlanner?.contextualOnly, true);
});

test('Mossprout Day 1 includes an authored focus card with three optional nature goals', () => {
  const definition = companionConversationDefinitionsForFamily('mossprout')
    .find((item) => item.id === 'mossprout:quiet-patch:first-flower:goal-plan');
  assert.ok(definition);
  const proposals = definition.nodes.filter((node) => node.kind === 'goal_proposal');
  assert.ok(proposals.length >= 1);
  assert.ok(proposals.every((node) => node.suggestedQuickGoalIds.length === 3));
});

test('Mossprout goal ideas respond to the place, time, and action answers', () => {
  const definition = companionConversationDefinitionsForFamily('mossprout')
    .find((item) => item.id === 'mossprout:conversation:nature-goal-discovery')!;
  const turn = (nodeId: string, optionId: string, answeredAt: number) => ({
    id: `${nodeId}:${optionId}`, nodeId, optionId, answeredAt,
  });
  const home = resolveMossproutCampaignConversation(definition, undefined, [
    turn('time', 'time-short', 1), turn('place', 'place-home', 2), turn('style', 'style-tend', 3),
  ]);
  const outing = resolveMossproutCampaignConversation(definition, undefined, [
    turn('time', 'time-outing', 1), turn('place', 'place-green', 2), turn('style', 'style-visit', 3),
  ]);
  const homeGoals = home.nodes.find((node) => node.kind === 'goal_proposal' && node.id === 'goals-tend');
  const outingGoals = outing.nodes.find((node) => node.kind === 'goal_proposal' && node.id === 'goals-visit');
  assert.ok(homeGoals?.kind === 'goal_proposal' && outingGoals?.kind === 'goal_proposal');
  assert.deepEqual(homeGoals.suggestedQuickGoalIds.slice(0, 2), ['mossprout:care-for-plant', 'mossprout:notice-living-thing']);
  assert.deepEqual(outingGoals.suggestedQuickGoalIds.slice(0, 2), ['mossprout:visit-green', 'mossprout:same-place']);
});

test('Mossprout optional copy stays short and avoids questionnaire filler', () => {
  const definitions = companionConversationDefinitionsForFamily('mossprout').filter((definition) =>
    definition.tags?.some((tag) => ['nature-question', 'nature-journal', 'reflection', 'goals'].includes(tag))
  );
  const banned = /based on your answers|thoughtful questions|meaningful direction|personalized|tailored for you/i;
  for (const definition of definitions) {
    const copy = JSON.stringify(definition);
    assert.doesNotMatch(copy, banned, `${definition.id} contains filler copy`);
    for (const node of definition.nodes) {
      if (node.kind === 'choice' || node.kind === 'poll') {
        assert.ok(node.prompt.split(/\s+/).length <= 24, `${definition.id}:${node.id} prompt is too long`);
        assert.ok(node.options.every((option) => option.label.split(/\s+/).length <= 8), `${definition.id}:${node.id} has a long answer`);
      }
    }
  }
});

test('a conversation resumes on the next question and reaches its authored result', () => {
  const definition = companionConversationDefinitionsForFamily('steppling')
    .find((item) => item.id === 'steppling:insight:outside-conditions')!;
  const game = definition.nodes.find((node) => node.kind === 'insight_game')!;
  const started = createConversationSession({ definition, formId: 'steppling', dayId: '2026-08-10', createdAt: 1 });
  const first = answerConversation(started, definition, game.questions[0]!.options[0]!.id, 2).session;
  assert.equal(first.pendingReply, undefined);
  assert.equal(first.gameQuestionIndex, 1);

  const persisted = normaliseCompanionContentState(upsertConversationSession(emptyCompanionContentState(), first));
  const resumed = persisted.conversationSessions[0]!;
  assert.equal(resumed.pendingReply, undefined);
  assert.equal(resumed.gameQuestionIndex, 1);
  let revealed = resumed;
  for (let index = 1; index < game.questions.length; index += 1) {
    revealed = answerConversation(revealed, definition, game.questions[index]!.options[0]!.id, revealed.updatedAt + 1).session;
    revealed = continueConversation(revealed, definition, revealed.updatedAt + 1);
  }
  assert.equal(revealed.currentNodeId, 'reveal');
  assert.ok(revealed.insightResult);
  const completed = continueConversation(revealed, definition, revealed.updatedAt + 1);
  assert.equal(completed.status, 'completed');
  assert.equal(completed.encounterTurns, 5);
  assert.equal(completed.exitTransition, undefined);
  assert.equal(continueConversation(completed, definition, 7), completed);
});

test('a final answer stays provisional while consecutive questions advance immediately', () => {
  const definition = companionConversationDefinitionsForFamily('baristabbit')
    .find((item) => item.isOpener)!;
  const node = definition.nodes.find((item) => item.kind === 'choice')!;
  let session = createConversationSession({ definition, formId: 'baristabbit', dayId: '2026-08-10', createdAt: 1 });
  session = answerConversation(session, definition, node.options[0]!.id, 2).session;
  session = answerConversation(session, definition, node.options[1]!.id, 3).session;
  assert.equal(session.turns.length, 1);
  assert.equal(session.encounterTurns, 1);
  assert.equal(session.turns[0]?.optionId, node.options[1]!.id);
  assert.equal(session.pendingReply, node.options[1]!.reply);
  assert.deepEqual(session.exitTransition, node.options[1]!.transition);

  const game = companionConversationDefinitionsForFamily('baristabbit')
    .find((item) => item.format === 'profile_game')!;
  let gameSession = createConversationSession({ definition: game, formId: 'baristabbit', dayId: '2026-08-10', createdAt: 1 });
  gameSession = answerConversation(gameSession, game, 'coffee', 2).session;
  assert.equal(gameSession.pendingReply, undefined);
  assert.equal(gameSession.gameQuestionIndex, 1);
  const profileGame = game.nodes.find((node) => node.kind === 'profile_game')!;
  const secondQuestion = conversationGameQuestion(profileGame, gameSession)!;
  const secondOption = secondQuestion.options[0]!;
  gameSession = answerConversation(gameSession, game, secondOption.id, 3).session;
  assert.equal(gameSession.pendingReply, undefined);
  assert.notEqual(gameSession.gameQuestionId, secondQuestion.id);
  assert.deepEqual(gameSession.turns.map((turn) => turn.optionId), ['coffee', secondOption.id]);
});

test('answering one choice question enters the next choice without a reply beat', () => {
  const definition = companionConversationDefinitionsForFamily('steppling')
    .find((item) => item.id === 'steppling:conversation:goal-discovery')!;
  const first = definition.nodes.find((node) => node.kind === 'choice' && node.id === definition.entryNodeId);
  if (!first || first.kind !== 'choice') throw new Error('Goal discovery needs an opening choice');
  const option = first.options[0]!;
  const started = createConversationSession({ definition, formId: 'steppling', dayId: '2026-08-10', createdAt: 1 });
  const answered = answerConversation(started, definition, option.id, 2).session;

  assert.equal(answered.currentNodeId, option.nextNodeId);
  assert.equal(answered.pendingReply, undefined);
  assert.equal(answered.turns.at(-1)?.optionId, option.id);
});

test('signature game scores authored form affinities without unlocking a skin', () => {
  const definition = companionConversationDefinitionsForFamily('baristabbit')
    .find((item) => item.format === 'profile_game')!;
  let session = createConversationSession({ definition, formId: 'baristabbit', dayId: '2026-08-10', createdAt: 1 });
  const game = definition.nodes.find((node) => node.kind === 'profile_game')!;
  for (let pick = 0; pick < 3; pick += 1) {
    const question = conversationGameQuestion(game, session);
    assert.ok(question);
    const teaChoice = question.options.find((option) => option.affinity?.hearthsip) ?? question.options[0]!;
    session = answerConversation(session, definition, teaChoice.id, session.updatedAt + 1).session;
    session = continueConversation(session, definition, session.updatedAt + 1);
  }
  assert.equal(session.currentNodeId, 'reveal');
  assert.ok(session.formResult?.topFormId);
  assert.equal('unlockedSkinIds' in session, false);
});

test('every authored family form is represented in its finder answers and reveal copy', () => {
  for (const familyId of CONVERSATION_V2_FAMILIES) {
    const definition = companionConversationDefinitionsForFamily(familyId)
      .find((item) => item.format === 'profile_game')!;
    const game = definition.nodes.find((node) => node.kind === 'profile_game')!;
    const reveal = definition.nodes.find((node) => node.kind === 'form_reveal')!;
    const scoredFormIds = new Set(game.questions.flatMap((question) =>
      question.options.flatMap((option) => Object.keys(option.affinity ?? {}))
    ));
    for (const skinId of katchimeraFamilyById.get(familyId)!.skinIds) {
      assert.equal(scoredFormIds.has(skinId), true, `${skinId} needs a finder affinity`);
      assert.ok(reveal.descriptions[skinId]?.trim(), `${skinId} needs reveal copy`);
    }
  }
});

test('every authored form can win a complete three-answer finder path', () => {
  for (const familyId of CONVERSATION_V2_FAMILIES) {
    const definition = companionConversationDefinitionsForFamily(familyId)
      .find((item) => item.format === 'profile_game')!;
    const game = definition.nodes.find((node) => node.kind === 'profile_game')!;
    for (const skinId of katchimeraFamilyById.get(familyId)!.skinIds) {
      let session = createConversationSession({ definition, formId: familyId, dayId: '2026-08-10', createdAt: 1 });
      for (let pick = 0; pick < 3; pick += 1) {
        const question = conversationGameQuestion(game, session)!;
        const answer = question.options.find((option) => option.affinity?.[skinId]) ?? question.options[0]!;
        session = answerConversation(session, definition, answer.id, session.updatedAt + 1).session;
        session = continueConversation(session, definition, session.updatedAt + 1);
      }
      assert.equal(session.formResult?.topFormId, skinId, `${familyId}:${skinId} needs a winning path`);
    }
  }
});

test('fictional village poll is deterministic and totals one hundred', () => {
  const definition = companionConversationDefinitionsForFamily('flexel').find((item) => item.trigger === 'poll')!;
  const run = () => answerConversation(
    createConversationSession({ definition, formId: 'flexel', dayId: '2026-08-10', createdAt: 1 }),
    definition,
    'choice-2',
    2
  ).session.pollResult!;
  const first = run();
  const second = run();
  assert.deepEqual(first, second);
  assert.equal(Object.values(first.percentages).reduce((sum, value) => sum + value, 0), 100);
  assert.equal(first.label, 'Katchimera village poll - fictional');
});

test('insight games resolve authored outcomes and can be replayed before confirmation', () => {
  const definition = companionConversationDefinitionsForFamily('baristabbit')
    .find((item) => item.id === 'baristabbit:insight:drink-compass')!;
  const game = definition.nodes.find((node) => node.kind === 'insight_game')!;
  let session = createConversationSession({ definition, formId: 'baristabbit', dayId: '2026-08-10', createdAt: 1 });
  for (const question of game.questions) {
    const classic = question.options.find((choice) => choice.id.startsWith('classic-'))!;
    session = answerConversation(session, definition, classic.id, session.updatedAt + 1).session;
    session = continueConversation(session, definition, session.updatedAt + 1);
  }
  assert.equal(session.currentNodeId, 'reveal');
  assert.equal(session.insightResult?.resultId, 'reliable-classic');
  assert.equal(session.insightResult?.title, 'The Reliable Classic');
  assert.equal(session.insightResult?.supportingTraits.length, 5);
  const replayed = restartInsightConversation(session, definition, session.updatedAt + 1);
  assert.equal(replayed.currentNodeId, 'game');
  assert.equal(replayed.turns.length, 0);
  assert.equal(replayed.insightResult, undefined);
});

test('richer assessments expose four meaningful answers and preserve a mixed secondary thread', () => {
  const definition = companionConversationDefinitionsForFamily('baristabbit')
    .find((item) => item.id === 'baristabbit:insight:ritual-rhythm')!;
  const game = definition.nodes.find((node) => node.kind === 'insight_game')!;
  assert.equal(game.questions.length, 5);
  assert.ok(game.questions.every((question) => question.options.length === 4));
  const branchedQuestion = game.questions[1]!;
  assert.equal(Object.keys(branchedQuestion.promptByPriorOptionId ?? {}).length, 4);
  assert.equal(new Set(Object.values(branchedQuestion.promptByPriorOptionId ?? {})).size, 4);
  let session = createConversationSession({ definition, formId: 'baristabbit', dayId: '2026-08-10', createdAt: 1 });
  for (let index = 0; index < game.questions.length; index += 1) {
    const option = game.questions[index]!.options[index % 2]!;
    session = answerConversation(session, definition, option.id, session.updatedAt + 1).session;
    session = continueConversation(session, definition, session.updatedAt + 1);
  }
  assert.equal(session.insightResult?.confidence, 'mixed');
  assert.ok(session.insightResult?.secondaryResultId);
  assert.ok(session.insightResult?.secondaryTitle);
  assert.equal(session.insightResult?.scoreMargin, 1);
});

test('selection prioritises a matching journal callback over the daily rotation', () => {
  const definitions = companionConversationDefinitionsForFamily('steppling');
  const selected = selectConversationDefinition({
    familyId: 'steppling',
    dayId: '2026-08-10',
    definitions,
    sessions: [],
    signals: [{
      id: 'signal-1', kind: 'journal', familyId: 'steppling', sourceId: 'journal-1', dayId: '2026-08-09',
      routeKey: 'movement.walk', createdAt: 1, expiresAt: Date.now() + 1000,
    }],
    bondLevel: 1,
  });
  assert.equal(selected?.definition.trigger, 'journal');
  assert.ok(selected?.definition.triggerRouteKeys?.includes('movement.walk'));
});

test('journal reconciliation baselines old records then queues only new relevant evidence', () => {
  const day = (ids: string[]) => ({
    isoDate: '2026-08-10',
    journalRecords: ids.map((id) => ({
      id,
      flowId: 'movement',
      categoryId: 'walk',
      fields: {},
      feeling: null,
      createdAt: '2026-08-10T08:00:00.000Z',
      source: { kind: 'manual' },
    })),
  } as unknown as StoredHomeDayRecord);
  const baseline = reconcileConversationJournalSignals(emptyCompanionContentState(), [day(['old'])], Date.parse('2026-08-10T09:00:00Z'));
  assert.equal(baseline.conversationSignals.length, 0);
  assert.deepEqual(baseline.processedConversationEvidenceIds, ['old']);
  const next = reconcileConversationJournalSignals(baseline, [day(['old', 'new'])], Date.parse('2026-08-10T09:00:00Z'));
  assert.equal(next.conversationSignals.length, 3);
  assert.deepEqual(new Set(next.conversationSignals.map((signal) => signal.familyId)), new Set(['steppling', 'mossprout', 'skylo']));
  assert.ok(next.conversationSignals.every((signal) => signal.sourceId === 'new'));
});

test('V5 completion migrates to a served-day marker without replaying old journal evidence', () => {
  const migrated = normaliseCompanionContentState({
    schemaVersion: 5,
    invitations: [], memoryFacts: [], memories: [], visitPlans: [], telemetry: [], events: [], introductions: [], visits: [],
    conversationReceipts: [{
      id: 'receipt-1', visitPlanId: 'plan-1', familyId: 'baristabbit', dayId: '2026-08-10',
      responseIds: ['answer'], affectedMemoryIds: [], completedAt: 1,
    }],
  });
  assert.ok(migrated.servedConversationDayKeys.includes('baristabbit:2026-08-10'));
  assert.equal(migrated.conversationSignalBaselineComplete, false);
});

test('developer previews do not affect production opening selection', () => {
  const definitions = companionConversationDefinitionsForFamily('baristabbit');
  const definition = definitions.find((item) => item.trigger === 'poll')!;
  let preview = createConversationSession({
    definition, formId: 'baristabbit', dayId: '2026-08-10', createdAt: 1, preview: true, sessionId: 'preview-1',
  });
  preview = answerConversation(preview, definition, 'choice-1', 2).session;
  preview = continueConversation(preview, definition, 3);
  const state = upsertConversationSession(emptyCompanionContentState(), preview);
  assert.equal(preview.status, 'completed');
  assert.deepEqual(state.servedConversationDayKeys, []);
  const selected = selectConversationDefinition({
    familyId: 'baristabbit', dayId: '2026-08-10', definitions, sessions: state.conversationSessions, signals: [], bondLevel: 1,
  });
  assert.equal(selected?.definition.isOpener, true);
});

test('opener answers branch into an authored topic pool', () => {
  const definitions = companionConversationDefinitionsForFamily('baristabbit');
  const opener = definitions.find((item) => item.isOpener && item.nodes.some((node) => node.kind === 'choice' && node.options.some((option) => option.transition?.kind === 'pool' && option.transition.poolId === 'ritual')))!;
  const openingNode = opener.nodes.find((node) => node.kind === 'choice')!;
  const ritualOption = openingNode.options.find((option) => option.transition?.kind === 'pool' && option.transition.poolId === 'ritual')!;
  let session = createConversationSession({ definition: opener, formId: 'baristabbit', dayId: '2026-08-10', createdAt: 1, encounterId: 'encounter-1' });
  session = answerConversation(session, opener, ritualOption.id, 2).session;
  session = continueConversation(session, opener, 3);
  assert.equal(session.status, 'completed');
  assert.deepEqual(session.exitTransition, { kind: 'pool', poolId: 'ritual' });
  const branched = selectConversationFromPool({ familyId: 'baristabbit', poolId: 'ritual', definitions, sessions: [session], seed: 'branch-1' });
  assert.ok(branched?.tags?.includes('ritual'));
  assert.equal(branched?.contextualOnly, undefined);
});

test('Talk starts one of the original non-game topic threads instead of the mode chooser', () => {
  for (const familyId of familyIds) {
    const definitions = companionConversationDefinitionsForFamily(familyId);
    const definition = selectConversationForMode({
      familyId,
      mode: 'talk',
      definitions,
      sessions: [],
      seed: `${familyId}:talk`,
    });
    assert.ok(definition);
    assert.notEqual(definition.format, 'opener');
    assert.notEqual(definition.format, 'poll');
    assert.notEqual(definition.format, 'profile_game');
    assert.equal(Boolean(definition.isOpener), false);
    const originalTalkPools = new Set(definitions.flatMap((candidate) => candidate.isOpener
      ? candidate.nodes.flatMap((node) => node.kind === 'choice'
          ? node.options.flatMap((option) => option.transition?.kind === 'pool'
              && option.transition.poolId !== 'play'
              && option.transition.poolId !== 'goals'
            ? [option.transition.poolId]
            : [])
          : [])
      : []));
    assert.ok(definition.tags?.some((tag) => originalTalkPools.has(tag)));
    const first = definition.nodes.find((node) => node.id === definition.entryNodeId);
    if (first?.kind === 'choice') {
      assert.ok(first.options.every((option) => option.transition === undefined));
    }
  }
});

test('continuous conversations can select multiple chapters on the same day and avoid recent repeats', () => {
  const definitions = companionConversationDefinitionsForFamily('steppling');
  const first = selectConversationFromPool({ familyId: 'steppling', poolId: 'play', definitions, sessions: [], seed: 'same-seed' })!;
  const firstSession = createConversationSession({ definition: first, formId: 'steppling', dayId: '2026-08-10', createdAt: 1 });
  const second = selectConversationFromPool({ familyId: 'steppling', poolId: 'play', definitions, sessions: [firstSession], seed: 'same-seed' })!;
  assert.notEqual(second.id, first.id);
  assert.equal(firstSession.createdDayId, '2026-08-10');
  assert.ok(second.tags?.includes('play'));

  const excluded = selectConversationFromPool({
    familyId: 'steppling',
    poolId: 'play',
    definitions,
    sessions: [],
    seed: 'same-seed',
    excludeDefinitionIds: [first.id],
  })!;
  assert.notEqual(excluded.id, first.id);
});

test('short takeaway stories are excluded in favour of deep assessments', () => {
  for (const familyId of familyIds) {
    const pack = companionConversationDefinitionsForFamily(familyId);
    assert.equal(pack.some((definition) => definition.id.includes(':conversation:first-sip')), false);
    assert.equal(pack.some((definition) => definition.id.includes(':conversation:doorstep')), false);
    assert.equal(pack.some((definition) => definition.id.includes(':conversation:showing-up')), false);
    assert.equal(JSON.stringify(pack).includes('reflection_reveal'), false);
    assert.equal(pack.filter((definition) => definition.format === 'insight_game').length, authoredStoryFamilies.has(familyId) ? 5 : 4);
  }
  const authored = JSON.stringify(companionConversationDefinitionsV2);
  assert.equal(authored.includes('Finish this thought'), false);
  assert.equal(authored.includes('CONVERSATION TAKEAWAY'), false);
  assert.equal(authored.includes('What would you like to do with that answer?'), false);
  assert.equal(authored.includes('Try one small change'), false);
});

test('action paths use valid task and quest data without a separate Focus review', () => {
  for (const familyId of familyIds) {
    const outcomes = companionConversationDefinitionsForFamily(familyId)
      .filter((definition) => ['goal-discovery', 'small-step', 'quest-handoff'].some((suffix) => definition.id.endsWith(suffix)));
    assert.equal(outcomes.length, 3);

    const quickGoalNodes = outcomes.flatMap((definition) => definition.nodes)
      .filter((node) => node.kind === 'quick_goal_proposal');
    assert.equal(quickGoalNodes.length, 3);
    assert.ok(quickGoalNodes.every((node) => companionQuickGoalTemplateById.has(node.templateId)));

    const questNodes = outcomes.flatMap((definition) => definition.nodes)
      .filter((node) => node.kind === 'quest_handoff');
    assert.equal(questNodes.length, 1);
    assert.ok(questNodes[0]!.suggestedQuestIds.every((questId) => questDefinition(questId)));

    const goalDiscovery = outcomes.find((definition) => definition.id.endsWith('goal-discovery'))!;
    assert.equal(goalDiscovery.requiresNoActiveFocus, undefined);
    const questHandoff = outcomes.find((definition) => definition.id.endsWith('quest-handoff'))!;
    assert.equal(questHandoff.requiresNoActiveQuest, true);
    assert.equal(questHandoff.contextualOnly, undefined);
    const firstNode = questHandoff.nodes.find((node) => node.id === questHandoff.entryNodeId);
    assert.equal(firstNode?.kind, 'choice');
    assert.doesNotMatch(firstNode?.kind === 'choice' ? firstNode.prompt : '', /quest|conversation/i);
    assert.equal(questHandoff.nodes.filter((node) => node.kind === 'choice').length, 2);
    const questNode = questHandoff.nodes.find((node) => node.kind === 'quest_handoff');
    assert.ok(questNode?.kind === 'quest_handoff');
    const fallbackNode = questHandoff.nodes.find((node) => node.id === questNode.fallbackNodeId);
    assert.equal(fallbackNode?.kind, 'goal_proposal');
    assert.equal(
      fallbackNode?.kind === 'goal_proposal' ? fallbackNode.suggestedQuickGoalIds.length : 0,
      3,
    );
  }
  assert.equal(JSON.stringify(companionConversationDefinitionsV2).includes('How does your current'), false);
});

test('goal discovery asks four branching questions before presenting a matched plan', () => {
  for (const familyId of familyIds) {
    const definition = companionConversationDefinitionsForFamily(familyId)
      .find((candidate) => candidate.id.endsWith('goal-discovery'))!;
    const nodeById = new Map(definition.nodes.map((node) => [node.id, node]));
    const desiredChange = nodeById.get(definition.entryNodeId);
    assert.equal(desiredChange?.kind, 'choice');
    if (desiredChange?.kind !== 'choice') continue;
    assert.equal(desiredChange.options.length, 4);

    const contextPrompts = new Set<string>();
    const reachedGoalTitles = new Set<string>();
    for (const direction of desiredChange.options) {
      const context = nodeById.get(direction.nextNodeId ?? '');
      assert.equal(context?.kind, 'choice');
      if (context?.kind !== 'choice') continue;
      contextPrompts.add(context.prompt);
      assert.equal(context.options.length, 4);

      const frictionPrompts = new Set<string>();
      for (const contextChoice of context.options) {
        const friction = nodeById.get(contextChoice.nextNodeId ?? '');
        assert.equal(friction?.kind, 'choice');
        if (friction?.kind !== 'choice') continue;
        frictionPrompts.add(friction.prompt);
        assert.equal(friction.options.length, 4);

        for (const frictionChoice of friction.options) {
          const shape = nodeById.get(frictionChoice.nextNodeId ?? '');
          assert.equal(shape?.kind, 'choice');
          if (shape?.kind !== 'choice') continue;
          assert.equal(shape.options.length, 4);
          for (const shapeChoice of shape.options) {
            const goal = nodeById.get(shapeChoice.nextNodeId ?? '');
            assert.equal(goal?.kind, 'goal_proposal');
            if (goal?.kind !== 'goal_proposal') continue;
            reachedGoalTitles.add(goal.goalTitle);
            assert.ok((goal.summary?.length ?? 0) > 80);
            assert.equal(goal.suggestedQuickGoalIds.length, 3);
            assert.ok(goal.suggestedQuickGoalIds.every((id) => companionQuickGoalTemplateById.has(id)));
          }
        }
      }
      assert.equal(frictionPrompts.size, 4);
    }
    assert.equal(contextPrompts.size, 4);
    assert.equal(reachedGoalTitles.size, 4);
  }
});

test('goal-plan proposals respect an existing plan instead of replacing it', () => {
  const first = createJourneyGoalFromProposal(emptyCompanionJourneyState(), {
    familyId: 'flexel', goalTypeId: 'flexel-direction', title: 'Build a flexible rhythm', suggestedQuickGoalIds: [], createdAt: 1,
  });
  assert.ok(first.createdGoalId);
  const blocked = createJourneyGoalFromProposal(first.state, {
    familyId: 'flexel', goalTypeId: 'flexel-direction', title: 'Replace it silently', suggestedQuickGoalIds: [], createdAt: 2,
  });
  assert.equal(blocked.blockedReason, 'active_goal_limit');
  assert.equal(blocked.state.goals.length, 1);
  assert.equal(blocked.state.goals[0]?.title, 'Build a flexible rhythm');
});

test('explicit goal-plan actions rename and preserve paused history', () => {
  const created = createJourneyGoalFromProposal(emptyCompanionJourneyState(), {
    familyId: 'steppling', goalTypeId: 'walking-rhythm', title: 'Walk more', suggestedQuickGoalIds: [], createdAt: 1,
  });
  const goalId = created.createdGoalId!;
  const renamed = renameJourneyGoal(created.state, goalId, 'Use walking for headspace', 2);
  assert.equal(renamed.goals[0]?.title, 'Use walking for headspace');
  const paused = setJourneyGoalStatus(renamed, goalId, 'paused', 3);
  const replacement = createJourneyGoalFromProposal(paused, {
    familyId: 'steppling', goalTypeId: 'walking-rhythm', title: 'Explore nearby routes', suggestedQuickGoalIds: [], createdAt: 4,
  });
  assert.equal(replacement.state.goals.length, 2);
  assert.equal(replacement.state.goals.find((goal) => goal.id === goalId)?.status, 'paused');
  assert.equal(replacement.state.goals.find((goal) => goal.id === replacement.createdGoalId)?.status, 'active');
});

test('authored-family insights use five meaningful questions while every form-game branch takes three picks', () => {
  for (const familyId of CONVERSATION_V2_FAMILIES) {
    const games = companionConversationDefinitionsForFamily(familyId)
      .flatMap((definition) => definition.nodes)
      .filter((node) => node.kind === 'profile_game' || node.kind === 'insight_game');
    assert.equal(games.length, familyId === 'mossprout' ? 2 : familyId === 'feastle' || authoredStoryFamilies.has(familyId) ? 6 : 5);
    for (const game of games.filter((candidate) => candidate.kind === 'profile_game')) {
      assert.deepEqual(validateProfileQuestionGraph(`${familyId}:test`, game), []);
    }
    assert.equal(games.filter((game) => game.kind === 'insight_game').every((game) => game.questions.length === (familyId === 'mossprout' ? 3 : 5)), true);
  }
});

test('journal, goal, quest, and bond chats resolve to their correct outcome classes', () => {
  for (const familyId of CONVERSATION_V2_FAMILIES) {
    const pack = companionConversationDefinitionsForFamily(familyId);
    const journals = pack.filter((definition) => definition.trigger === 'journal');
    const goalDebriefs = pack.filter((definition) => definition.trigger === 'goal_debrief');
    const questDebriefs = pack.filter((definition) => definition.trigger === 'quest_debrief');
    const bondChats = pack.filter((definition) => definition.trigger === 'bond');
    if (familyId === 'mossprout') {
      assert.equal(journals.length, 3);
      assert.ok(journals.every((definition) => definition.purpose === 'reflection'));
      assert.equal(goalDebriefs.length, 0);
      assert.equal(questDebriefs.length, 0);
      assert.equal(bondChats.length, 3);
      assert.ok(bondChats.every((definition) => definition.purpose === 'bond_milestone'));
      continue;
    }
    assert.equal(journals.length, 6);
    assert.ok(journals.every((definition) => definition.nodes.some((node) => node.kind === 'memory_proposal')));
    assert.ok(goalDebriefs.every((definition) => definition.nodes.some((node) => node.kind === 'goal_proposal')));
    assert.ok(questDebriefs.some((definition) => definition.nodes.some((node) => node.kind === 'memory_proposal')));
    assert.ok(questDebriefs.some((definition) => definition.nodes.some((node) => node.kind === 'goal_proposal')));
    assert.ok(bondChats.every((definition) => definition.nodes.some((node) => node.kind === 'memory_proposal' || node.kind === 'poll' || node.kind === 'insight_reveal' || node.kind === 'journal_handoff')));
    assert.ok(pack
      .filter((definition) => definition.format !== 'insight_game')
      .every((definition) => definition.nodes.every((node) => node.kind !== 'insight_reveal')));
  }
});

test('goal conversations cover every available authored-family goal template', () => {
  for (const familyId of CONVERSATION_V2_FAMILIES) {
    if (familyId === 'mossprout') {
      const quickGoalIds = new Set(companionConversationDefinitionsForFamily(familyId)
        .flatMap((definition) => definition.nodes)
        .filter((node) => node.kind === 'goal_proposal')
        .flatMap((node) => node.suggestedQuickGoalIds));
      assert.deepEqual([...quickGoalIds].sort(), [
        'mossprout:care-for-plant',
        'mossprout:notice-living-thing',
        'mossprout:same-place',
        'mossprout:season-change',
        'mossprout:sit-outside',
        'mossprout:step-outside',
        'mossprout:visit-green',
        'mossprout:window-view',
      ]);
      continue;
    }
    const offeredIds = new Set(companionConversationDefinitionsForFamily(familyId)
      .flatMap((definition) => definition.nodes)
      .filter((node) => node.kind === 'goal_proposal')
      .flatMap((node) => node.suggestedQuickGoalIds));
    const cataloguePrefix = familyId === 'baristabbit' ? 'coffee-ritual:' : `${familyId}:`;
    const allFamilyTemplates = quickGoalTemplatesForFamily(familyId);
    const prefixedTemplates = allFamilyTemplates.filter((template) => template.id.startsWith(cataloguePrefix));
    const availableIds = (prefixedTemplates.length >= 3 ? prefixedTemplates : allFamilyTemplates)
      .slice(0, 8)
      .map((template) => template.id);
    assert.equal(availableIds.length, 8);
    assert.deepEqual(availableIds.filter((id) => !offeredIds.has(id)), []);
    assert.ok(companionConversationDefinitionsForFamily(familyId)
      .flatMap((definition) => definition.nodes)
      .filter((node) => node.kind === 'goal_proposal')
      .every((node) => node.suggestedQuickGoalIds.length >= 2 && node.suggestedQuickGoalIds.length <= 3));
  }
});

test('every authored quest handoff references playable quest data', () => {
  for (const familyId of CONVERSATION_V2_FAMILIES) {
    const handoffs = companionConversationDefinitionsForFamily(familyId)
      .flatMap((definition) => definition.nodes)
      .filter((node) => node.kind === 'quest_handoff');
    assert.equal(handoffs.length, 1);
    assert.ok(handoffs[0]!.suggestedQuestIds.length >= 2, `${familyId} needs two quest choices`);
    for (const questId of handoffs[0]!.suggestedQuestIds) assert.ok(questDefinition(questId), `${familyId}:${questId}`);
  }
});

test('Feastle Friendship invitations select the exact earned level and keep signature chapters gated', () => {
  const definitions = companionConversationDefinitionsForFamily('feastle');
  const friendship = definitions.filter((definition) => definition.id.startsWith('feastle:friendship:'));
  assert.equal(friendship.length, 19);
  assert.deepEqual(friendship.map((definition) => definition.minimumFriendshipLevel), Array.from({ length: 19 }, (_, index) => index + 2));
  const selection = selectConversationDefinition({
    familyId: 'feastle',
    dayId: '2027-01-15',
    definitions,
    sessions: [],
    signals: [{
      id: 'signal:chapter-8', kind: 'bond', familyId: 'feastle', sourceId: 'feastle-chapter-8',
      dayId: '2027-01-15', createdAt: Date.now(), expiresAt: Date.now() + 10_000,
    }],
    bondLevel: 4,
    friendshipLevel: 8,
  });
  assert.equal(selection?.definition.id, 'feastle:friendship:8');
});

test('Feastle Chapter One uses distinct two-beat scenes instead of repeated questionnaire answers', () => {
  const definitions = companionConversationDefinitionsForFamily('feastle');
  for (const level of [2, 3, 4]) {
    const definition = definitions.find((item) => item.id === `feastle:friendship:${level}`);
    assert.ok(definition);
    assert.equal(definition.version, 2);
    const choices = definition.nodes.filter((node) => node.kind === 'choice' || node.kind === 'poll');
    assert.equal(choices.length, 2);
    for (const node of choices) {
      assert.equal(node.options.length, 3);
      assert.equal(new Set(node.options.map((option) => option.label)).size, 3);
      assert.equal(new Set(node.options.map((option) => option.reply)).size, 3);
    }
  }
  const playful = definitions.find((item) => item.id === 'feastle:friendship:3');
  assert.equal(playful?.nodes.some((node) => node.kind === 'memory_proposal'), false);
});

test('Feastle introduces an optional journal handoff and resumes the chapter after either decision', () => {
  const definition = companionConversationDefinitionsForFamily('feastle')
    .find((item) => item.id === 'feastle:friendship:2')!;
  const handoff = definition.nodes.find((node) => node.kind === 'journal_handoff');
  assert.ok(handoff);
  assert.equal(handoff.flowId, 'food');
  assert.equal(handoff.nextNodeId, 'busy-day');
  assert.equal(handoff.rewardGrowth, 20);
  assert.equal('rewardMergeEnergy' in handoff, false);
  assert.equal('rewardItemIds' in handoff, false);

  const started = createConversationSession({ definition, formId: 'feastle', dayId: '2026-08-12', createdAt: 1 });
  const answered = answerConversation(started, definition, 'easy', 2).session;
  const atHandoff = continueConversation(answered, definition, 3);
  assert.equal(atHandoff.currentNodeId, 'today-table');
  const resumed = continueConversation(atHandoff, definition, 4);
  assert.equal(resumed.currentNodeId, 'busy-day');
});

test('Feastle closes Chapter One with a remembered insight followed by a practical Today goal', () => {
  const definition = companionConversationDefinitionsForFamily('feastle')
    .find((item) => item.id === 'feastle:friendship:4')!;
  const memories = definition.nodes.filter((node) => node.kind === 'memory_proposal');
  const goals = definition.nodes.filter((node) => node.kind === 'goal_proposal');
  assert.equal(memories.length, 3);
  assert.equal(goals.length, 3);
  for (const memory of memories) {
    assert.ok(goals.some((goal) => goal.id === memory.nextNodeId));
  }
  assert.ok(goals.every((goal) => goal.suggestedQuickGoalIds.length === 3));
});

test('Feastle first meeting is a first-person story in the conversation engine', () => {
  const definition = companionConversationDefinitionsV2.find((item) => item.id === FEASTLE_FIRST_MEETING_DEFINITION_ID);
  assert.ok(definition);
  assert.equal(definition.format, 'opener');
  assert.equal(definition.contextualOnly, true);
  assert.equal(definition.entryNodeId, 'table');
  const spokenCopy = JSON.stringify(definition.nodes);
  assert.match(spokenCopy, /I brought a basket/);
  assert.match(spokenCopy, /how would you like me beside you/);
  assert.doesNotMatch(spokenCopy, /should Feastle|Feastle says|Feastle (?:will|can|should)/);
});

test('Baristabbit owns a complete drink-ritual chapter with journal, insight, memory, and goal beats', () => {
  const definitions = companionConversationDefinitionsForFamily('baristabbit');
  const firstMeeting = definitions.find((item) => item.id === BARISTABBIT_FIRST_MEETING_DEFINITION_ID)!;
  const midpoint = definitions.find((item) => item.id === 'baristabbit:story:6')!;
  const insight = definitions.find((item) => item.id === 'baristabbit:story:7')!;
  const finale = definitions.find((item) => item.id === 'baristabbit:story:8')!;
  assert.equal(firstMeeting.format, 'opener');
  assert.match(JSON.stringify(firstMeeting.nodes), /The menu is imaginary, but the pause can be real/);
  const journal = midpoint.nodes.find((node) => node.kind === 'journal_handoff');
  assert.ok(journal);
  assert.equal('rewardMergeEnergy' in journal, false);
  assert.equal('rewardItemIds' in journal, false);
  const game = insight.nodes.find((node) => node.kind === 'insight_game');
  const reveal = insight.nodes.find((node) => node.kind === 'insight_reveal');
  assert.equal(game?.questions.length, 5);
  assert.equal(reveal?.results.length, 4);
  assert.ok(finale.nodes.some((node) => node.kind === 'memory_proposal'));
  assert.ok(finale.nodes.some((node) => node.kind === 'goal_proposal' && node.goalTypeId === 'ritual'));
});

// Ensures the imported data remains statically typed as the engine contract.
const _definitions: readonly ConversationDefinition[] = companionConversationDefinitionsV2;
void _definitions;
