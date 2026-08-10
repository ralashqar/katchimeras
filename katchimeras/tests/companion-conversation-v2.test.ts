import assert from 'node:assert/strict';
import test from 'node:test';

import {
  companionConversationDefinitionsForFamily,
  companionConversationDefinitionsV2,
} from '@/constants/companion-conversations-v2';
import { companionQuickGoalTemplateById, quickGoalTemplatesForFamily } from '@/constants/companion-quick-goals';
import type { ConversationDefinition } from '@/types/companion-conversation';
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

test('first V2 packs are complete, valid, and isolated to the launch allowlist', () => {
  assert.deepEqual(validateConversationDefinitions(companionConversationDefinitionsV2), []);
  assert.equal(companionConversationDefinitionsV2.length, 53 * familyIds.length);
  for (const familyId of familyIds) {
    const pack = companionConversationDefinitionsForFamily(familyId);
    assert.equal(pack.length, 53);
    assert.equal(pack.filter((item) => item.trigger === 'evergreen').length, 11);
    assert.equal(pack.filter((item) => item.isOpener).length, 8);
    assert.equal(pack.filter((item) => item.trigger === 'journal').length, 6);
    assert.equal(pack.filter((item) => item.trigger === 'goal_debrief').length, 2);
    assert.equal(pack.filter((item) => item.trigger === 'quest_debrief').length, 2);
    assert.equal(pack.filter((item) => item.trigger === 'bond').length, 3);
    assert.equal(pack.filter((item) => item.trigger === 'poll').length, 24);
    assert.equal(pack.filter((item) => item.trigger === 'signature_game').length, 5);
    assert.equal(pack.filter((item) => item.format === 'insight_game').length, 4);
  }
});

test('a conversation resumes from persisted reply state and reaches its authored result', () => {
  const definition = companionConversationDefinitionsForFamily('steppling')
    .find((item) => item.id === 'steppling:insight:outside-conditions')!;
  const game = definition.nodes.find((node) => node.kind === 'insight_game')!;
  const started = createConversationSession({ definition, formId: 'steppling', dayId: '2026-08-10', createdAt: 1 });
  const first = answerConversation(started, definition, game.questions[0]!.options[0]!.id, 2).session;
  assert.ok(first.pendingReply);

  const persisted = normaliseCompanionContentState(upsertConversationSession(emptyCompanionContentState(), first));
  const resumed = persisted.conversationSessions[0]!;
  assert.equal(resumed.pendingReply, first.pendingReply);
  let revealed = continueConversation(resumed, definition, 3);
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

test('an answer stays provisional and can be changed until Continue', () => {
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
  gameSession = answerConversation(gameSession, game, 'tea', 3).session;
  assert.equal(gameSession.turns.length, 1);
  assert.equal(gameSession.affinityScores.hearthsip, 4);
  assert.equal(gameSession.affinityScores.lattelet, undefined);
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
  assert.equal(next.conversationSignals.length, 1);
  assert.equal(next.conversationSignals[0]?.familyId, 'steppling');
  assert.equal(next.conversationSignals[0]?.sourceId, 'new');
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
    assert.equal(pack.filter((definition) => definition.format === 'insight_game').length, 4);
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

test('launch-family insights use five meaningful questions while every form-game branch takes three picks', () => {
  for (const familyId of familyIds) {
    const games = companionConversationDefinitionsForFamily(familyId)
      .flatMap((definition) => definition.nodes)
      .filter((node) => node.kind === 'profile_game' || node.kind === 'insight_game');
    assert.equal(games.length, 5);
    for (const game of games.filter((candidate) => candidate.kind === 'profile_game')) {
      assert.deepEqual(validateProfileQuestionGraph(`${familyId}:test`, game), []);
    }
    assert.equal(games.filter((game) => game.kind === 'insight_game').every((game) => game.questions.length === 5), true);
  }
});

test('journal, goal, quest, and bond chats resolve to their correct outcome classes', () => {
  for (const familyId of familyIds) {
    const pack = companionConversationDefinitionsForFamily(familyId);
    const journals = pack.filter((definition) => definition.trigger === 'journal');
    const goalDebriefs = pack.filter((definition) => definition.trigger === 'goal_debrief');
    const questDebriefs = pack.filter((definition) => definition.trigger === 'quest_debrief');
    const bondChats = pack.filter((definition) => definition.trigger === 'bond');
    assert.equal(journals.length, 6);
    assert.ok(journals.every((definition) => definition.nodes.some((node) => node.kind === 'memory_proposal')));
    assert.ok(goalDebriefs.every((definition) => definition.nodes.some((node) => node.kind === 'goal_proposal')));
    assert.ok(questDebriefs.some((definition) => definition.nodes.some((node) => node.kind === 'memory_proposal')));
    assert.ok(questDebriefs.some((definition) => definition.nodes.some((node) => node.kind === 'goal_proposal')));
    assert.ok(bondChats.every((definition) => definition.nodes.some((node) => node.kind === 'memory_proposal')));
    assert.ok(pack
      .filter((definition) => definition.format !== 'insight_game')
      .every((definition) => definition.nodes.every((node) => node.kind !== 'insight_reveal')));
  }
});

test('goal conversations cover every available launch-family goal template', () => {
  for (const familyId of familyIds) {
    const offeredIds = new Set(companionConversationDefinitionsForFamily(familyId)
      .flatMap((definition) => definition.nodes)
      .filter((node) => node.kind === 'goal_proposal')
      .flatMap((node) => node.suggestedQuickGoalIds));
    const cataloguePrefix = familyId === 'baristabbit' ? 'coffee-ritual:' : `${familyId}:`;
    const availableIds = quickGoalTemplatesForFamily(familyId)
      .map((template) => template.id)
      .filter((id) => id.startsWith(cataloguePrefix));
    assert.equal(availableIds.length, 8);
    assert.deepEqual(availableIds.filter((id) => !offeredIds.has(id)), []);
    assert.ok(companionConversationDefinitionsForFamily(familyId)
      .flatMap((definition) => definition.nodes)
      .filter((node) => node.kind === 'goal_proposal')
      .every((node) => node.suggestedQuickGoalIds.length >= 2 && node.suggestedQuickGoalIds.length <= 3));
  }
});

// Ensures the imported data remains statically typed as the engine contract.
const _definitions: readonly ConversationDefinition[] = companionConversationDefinitionsV2;
void _definitions;
