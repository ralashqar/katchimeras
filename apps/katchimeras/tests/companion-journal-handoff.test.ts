import assert from 'node:assert/strict';
import test from 'node:test';

import { companionConversationDefinitionById } from '@/constants/companion-conversations-v2';
import { answerConversation, continueConversation, createConversationSession } from '@/utils/companion-conversation';
import { emptyCompanionContentState, upsertConversationSession } from '@/utils/companion-content';
import {
  advanceConversationForJournalHandoff,
  buildCompanionJournalHandoff,
} from '@/utils/companion-journal-handoff-domain';

test('a Feastle handoff targets Tomorrow and advances its conversation exactly once after save', () => {
  const definition = companionConversationDefinitionById.get('feastle:friendship:2')!;
  const started = createConversationSession({ definition, formId: 'feastle', dayId: '2026-08-12', createdAt: 1 });
  const answered = answerConversation(started, definition, 'easy', 2).session;
  const atHandoff = continueConversation(answered, definition, 3);
  const node = definition.nodes.find((item) => item.kind === 'journal_handoff')!;
  const content = upsertConversationSession(emptyCompanionContentState(), atHandoff);
  const handoff = buildCompanionJournalHandoff({
    mode: 'story', familyId: 'feastle', creatureId: 'feastle', session: atHandoff,
    node, target: 'tomorrow', now: 4,
  });

  assert.equal(handoff.target, 'tomorrow');
  assert.match(handoff.prompt, /Tomorrow’s Egg/);
  assert.equal(handoff.rewardGrowth, 20);
  const first = advanceConversationForJournalHandoff(content, handoff, 'journal-record', 6);
  assert.equal(first.advanced, true);
  const session = first.content.conversationSessions.find((item) => item.id === atHandoff.id)!;
  assert.equal(session.currentNodeId, 'busy-day');
  assert.deepEqual(session.outcomeIds, ['journal-handoff:saved:journal-record']);

  const duplicate = advanceConversationForJournalHandoff(first.content, handoff, 'journal-record', 7);
  assert.equal(duplicate.advanced, false);
  assert.equal(duplicate.content, first.content);
});

test('building a Today handoff does not mutate the Feastle conversation before save', () => {
  const definition = companionConversationDefinitionById.get('feastle:friendship:2')!;
  const started = createConversationSession({ definition, formId: 'feastle', dayId: '2026-08-12', createdAt: 10 });
  const atHandoff = continueConversation(answerConversation(started, definition, 'easy', 11).session, definition, 12);
  const node = definition.nodes.find((item) => item.kind === 'journal_handoff')!;
  const content = upsertConversationSession(emptyCompanionContentState(), atHandoff);
  const handoff = buildCompanionJournalHandoff({
    mode: 'story', familyId: 'feastle', creatureId: 'feastle', session: atHandoff,
    node, target: 'today', now: 13,
  });
  assert.equal(handoff.status, 'pending');
  assert.equal(content.conversationSessions[0]?.currentNodeId, 'today-table');
});

test('Mossprout nature answers create an editable journal draft and complete only after save', () => {
  const definition = [...companionConversationDefinitionById.values()]
    .find((candidate) => candidate.tags?.includes('nature-journal'))!;
  let session = createConversationSession({ definition, formId: 'mossprout', dayId: '2026-08-21', createdAt: 20 });
  for (let index = 0; index < 2; index += 1) {
    const node = definition.nodes.find((candidate) => candidate.id === session.currentNodeId);
    assert.equal(node?.kind, 'choice');
    if (node?.kind !== 'choice') throw new Error('Expected a nature journal question.');
    session = answerConversation(session, definition, node.options[0]!.id, 21 + index).session;
    if (session.pendingReply !== undefined) session = continueConversation(session, definition, 22 + index);
  }
  const node = definition.nodes.find((candidate) => candidate.id === session.currentNodeId);
  assert.equal(node?.kind, 'journal_handoff');
  if (node?.kind !== 'journal_handoff') throw new Error('Expected a journal handoff.');
  const handoff = buildCompanionJournalHandoff({
    mode: 'story', familyId: 'mossprout', creatureId: 'mossprout', session, node, target: 'today', now: 25,
  });
  assert.match(handoff.generatedDraft ?? '', /Nature found me/);
  assert.match(handoff.generatedDraft ?? '', /I want to remember/);
  assert.equal(session.status, 'active');
  const content = upsertConversationSession(emptyCompanionContentState(), session);
  const saved = advanceConversationForJournalHandoff(content, handoff, 'nature-journal-record', 26);
  assert.equal(saved.advanced, true);
  assert.equal(saved.content.conversationSessions[0]?.status, 'completed');
  assert.equal(saved.content.conversationSessions[0]?.completedAt, 26);
});

test('every Mossprout field note asks bespoke questions before an in-place journal handoff', () => {
  const definitions = [...companionConversationDefinitionById.values()]
    .filter((candidate) => candidate.tags?.includes('nature-journal'));
  assert.equal(definitions.length, 6);
  for (const definition of definitions) {
    const questions = definition.nodes.filter((node) => node.kind === 'choice');
    const handoff = definition.nodes.find((node) => node.kind === 'journal_handoff');
    assert.equal(questions.length, 2, `${definition.id} should ask two questions`);
    assert.ok(questions.every((question) => question.options.length >= 3), `${definition.id} should never collapse to one Outdoors option`);
    assert.ok(handoff?.draftTemplate, `${definition.id} should author its draft rather than join raw labels`);
    assert.ok(handoff && !/egg/i.test(handoff.body), `${definition.id} should keep journaling with Mossprout`);
    assert.equal(handoff?.saveLabel, 'Save field note');
  }
});

test('Mossprout field-note answers resolve directly to a journal subcategory', () => {
  const build = (definitionId: string, optionIds: readonly string[]) => {
    const definition = companionConversationDefinitionById.get(definitionId)!;
    let session = createConversationSession({ definition, formId: 'mossprout', dayId: '2026-08-21', createdAt: 30 });
    optionIds.forEach((optionId, index) => {
      session = answerConversation(session, definition, optionId, 31 + index * 2).session;
      if (session.pendingReply !== undefined) session = continueConversation(session, definition, 32 + index * 2);
    });
    const node = definition.nodes.find((candidate) => candidate.id === session.currentNodeId);
    if (node?.kind !== 'journal_handoff') throw new Error(`Expected ${definitionId} to reach its journal handoff.`);
    return buildCompanionJournalHandoff({
      mode: 'story', familyId: 'mossprout', creatureId: 'mossprout', session, node, target: 'today', now: 40,
    });
  };

  assert.equal(build('mossprout:conversation:nature-journal:three-detail-field-note', ['window', 'calm']).initialChoiceId, 'home');
  assert.equal(build('mossprout:conversation:nature-journal:one-growing-thing', ['tended', 'care']).initialChoiceId, 'garden');
  assert.equal(build('mossprout:conversation:nature-journal:small-return', ['edge', 'remember']).initialChoiceId, 'other_place');
  assert.equal(build('mossprout:conversation:nature-journal:weather-in-the-day', ['bright', 'soft']).initialChoiceId, 'park');
});
