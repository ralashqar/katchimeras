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
