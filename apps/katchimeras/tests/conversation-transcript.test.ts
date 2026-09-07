import { mossproutFtueConversationDefinitions, resolveMossproutFtueConversation } from '@/constants/mossprout-ftue-conversations';
import { MOSSPROUT_FOLLOWUPS } from '@/constants/companion-life-content';
import { conversationUsesNarrativeOverlay } from '@/utils/conversation-presentation';
import { companionConversationDefinitionsV2 } from '@/constants/companion-conversations-v2';
import assert from 'node:assert/strict';
import test from 'node:test';
import { answerConversation, conversationGameQuestion, continueConversation, createConversationSession } from '@/utils/companion-conversation';
import { conversationTranscript } from '@/utils/conversation-transcript';
import type { ConversationDefinition, ConversationSession } from '@/types/companion-conversation';

const definition = {
  id: 'mossprout:test', title: 'A quiet moment', trigger: 'bond', minimumBondLevel: 1, cooldownDays: 0, version: 1, familyId: 'mossprout', entryNodeId: 'hello',
  nodes: [
    { id: 'hello', kind: 'choice', prompt: 'What would help?', options: [
      { id: 'calm', label: 'A little calm', spokenText: 'I could use a little calm.', reply: 'We can slow down together.', nextNodeId: 'more' },
    ] },
    { id: 'more', kind: 'choice', prompt: 'Shall we sit?', options: [
      { id: 'yes', label: 'Yes', reply: 'There is room beside me.', nextNodeId: 'end' },
    ] },
    { id: 'end', kind: 'end', message: 'Thank you for sharing this moment.' },
  ],
} as ConversationDefinition;
const start = () => ({ ...createConversationSession({ definition, formId: 'mossprout', dayId: '2026-09-07', createdAt: 1 }), dialoguePresentation: true });

test('answers reveal the next prompt immediately while the final end gates completion', () => {
  const initial = { ...start(), actionOrigin: { actionId: 'bond' } as never };
  let session = answerConversation(initial, definition, 'calm', 2).session;
  assert.equal(session.currentNodeId, 'more');
  assert.equal(session.pendingReply, undefined);
  assert.equal(conversationTranscript(session, definition).at(-1)?.text, 'We can slow down together.');
  session = answerConversation(session, definition, 'yes', 5).session;
  assert.equal(session.currentNodeId, 'end');
  assert.equal(session.status, 'active');
  assert.equal(session.dialogueAcknowledgedAt, undefined);
  session = continueConversation(session, definition, 7);
  assert.equal(session.status, 'completed');
  assert.equal(session.dialogueAcknowledgedAt, 7);
  assert.equal(session.actionOrigin, initial.actionOrigin);
  assert.equal(continueConversation(session, definition, 8), session);
});

test('saved transcript survives relaunch and authored text changes; follow-ups carry history', () => {
  const answered = answerConversation(start(), definition, 'calm', 2).session;
  const restored = JSON.parse(JSON.stringify(answered));
  const changed = { ...definition, nodes: [] };
  const history = conversationTranscript(restored, changed);
  assert.deepEqual(history.map((entry) => entry.text), ['What would help?', 'I could use a little calm.', 'We can slow down together.']);
  assert.deepEqual(history.map((entry) => entry.speaker), ['mossprout', 'player', 'mossprout']);
  assert.equal(new Set(history.map((entry) => entry.id)).size, 3);
  assert.deepEqual(conversationTranscript({ ...start(), transcriptPrefix: history }, definition), history);
});

test('legacy history uses available authored answers and never invents missing choices', () => {
  const session = answerConversation(start(), definition, 'calm', 2).session;
  const legacy = { ...session, turns: session.turns.map(({ transcript, ...turn }) => turn) };
  assert.equal(conversationTranscript(legacy, definition).length, 3);
  assert.deepEqual(conversationTranscript(legacy, { ...definition, nodes: [] }), []);
});

test('manual presentation traverses the authored packs without skipping replies or trapping a node', () => {
  for (const authored of companionConversationDefinitionsV2) {
    let session = { ...createConversationSession({ definition: authored, formId: authored.familyId as never, dayId: '2026-09-07', createdAt: 1 }), dialoguePresentation: true };
    let steps = 0;
    while (session.status === 'active' && steps++ < 200) {
      const node = authored.nodes.find((candidate) => candidate.id === session.currentNodeId);
      assert.ok(node, `${authored.id}: missing ${session.currentNodeId}`);
      if (session.pendingReply !== undefined) session = continueConversation(session, authored, steps + 1) as typeof session;
      else if (node.kind === 'choice' || node.kind === 'poll') session = answerConversation(session, authored, node.options[0].id, steps + 1).session as typeof session;
      else if (node.kind === 'profile_game' || node.kind === 'insight_game') {
        const question = conversationGameQuestion(node, session);
        assert.ok(question, authored.id);
        session = answerConversation(session, authored, question.options[0].id, steps + 1).session as typeof session;
      } else session = continueConversation(session, authored, steps + 1) as typeof session;
    }
    assert.equal(session.status, 'completed', `${authored.id}: stuck at ${session.currentNodeId}`);
    assert.ok(session.dialogueAcknowledgedAt, authored.id);
  }
});

test('only multi-choice interactions use the narrative overlay, including their result nodes', () => {
  assert.equal(conversationUsesNarrativeOverlay({ ...definition, nodes: [{ id: 'end', kind: 'end', message: 'A few more steps.' }] }), false);
  assert.equal(conversationUsesNarrativeOverlay(definition), false, 'linear single-option dialogue stays overhead');
  const choice = definition.nodes[0];
  assert.equal(choice.kind, 'choice');
  if (choice.kind !== 'choice') return;
  const branching = { ...definition, nodes: [{ ...choice, options: [...choice.options, { ...choice.options[0], id: 'company', label: 'Keep me company' }] }, ...definition.nodes.slice(1)] };
  assert.equal(conversationUsesNarrativeOverlay(branching), true);
});

for (const intent of ['calm', 'progress', 'unsure'] as const) {
  test(`first meeting connects ${intent} to a saved reply and Seed before completion`, () => {
    const authored = mossproutFtueConversationDefinitions.find((item) => item.id.includes('first-meeting:'))!;
    const resolved = resolveMossproutFtueConversation(authored, `desired-help:${intent}`, authored.version);
    let session: ConversationSession = { ...createConversationSession({ definition: resolved, formId: 'mossprout', dayId: '2026-09-07', createdAt: 1 }), dialoguePresentation: true };
    const hello = resolved.nodes.find((node) => node.id === 'hello');
    assert.ok(hello?.kind === 'choice');
    session = answerConversation(session, resolved, hello.options[0].id, 2).session;
    assert.equal(session.currentNodeId, 'followup');
    const followup = resolved.nodes.find((node) => node.id === 'followup');
    assert.ok(followup?.kind === 'choice');
    assert.ok(followup.prompt.endsWith(MOSSPROUT_FOLLOWUPS[intent].prompt));
    const choice = MOSSPROUT_FOLLOWUPS[intent].options[0];
    session = answerConversation(session, resolved, `life:${choice.id}`, 3).session;
    session = JSON.parse(JSON.stringify(session));
    assert.equal(session.currentNodeId, 'end');
    assert.equal(session.status, 'active', 'Seed invitation remains visible until Continue');
    const history = conversationTranscript(session, resolved);
    assert.ok(history.some((entry) => entry.speaker === 'player' && entry.text === choice.label));
    assert.ok(history.some((entry) => entry.text === choice.reply));
    const ending = resolved.nodes.find((node) => node.id === 'end');
    assert.ok(ending?.kind === 'end');
    assert.match(ending.message, /Memory Seed/);
    assert.match(ending.message, /Garden.*plant/);
    session = continueConversation(session, resolved, 4);
    assert.equal(session.status, 'completed');
    assert.equal(session.dialogueAcknowledgedAt, 4);
  });
}
