import type { ConversationDefinition, ConversationSession, ConversationTranscriptEntry } from '@/types/companion-conversation';

/** Legacy turns are reconstructed only when their authored answer still exists. */
export function conversationTranscript(session: ConversationSession, definition: ConversationDefinition): ConversationTranscriptEntry[] {
  const turns = session.turns.map((turn) => {
    if (turn.transcript) return turn.transcript;
    const node = definition.nodes.find((candidate) => candidate.id === turn.nodeId);
    const question = node?.kind === 'profile_game' || node?.kind === 'insight_game'
      ? node.questions.find((candidate) => candidate.id === turn.questionId) : null;
    const option = question?.options.find((candidate) => candidate.id === turn.optionId)
      ?? (node?.kind === 'choice' || node?.kind === 'poll' ? node.options.find((candidate) => candidate.id === turn.optionId) : undefined);
    if (!option) return [];
    const prompt = question?.prompt ?? (node && 'prompt' in node ? node.prompt : '');
    return [
      { id: `${turn.id}:prompt`, speaker: session.formId, text: prompt },
      { id: `${turn.id}:answer`, speaker: 'player' as const, text: option.spokenText ?? option.label },
      { id: `${turn.id}:reply`, speaker: session.formId, text: option.reply },
    ].filter((entry) => entry.text.trim());
  });
  return [...(session.transcriptPrefix ?? []),
    ...(session.transcriptEvents ?? []).filter((entry) => entry.afterTurn === 0),
    ...turns.flatMap((entries, index) => [...entries, ...(session.transcriptEvents ?? []).filter((entry) => entry.afterTurn === index + 1)]),
  ];
}

export function rememberConversationLine(session: ConversationSession, id: string, text: string): ConversationSession {
  if (!text.trim() || session.transcriptEvents?.some((entry) => entry.id === id)) return session;
  return { ...session, transcriptEvents: [...(session.transcriptEvents ?? []), {
    id, text, speaker: session.formId, afterTurn: session.turns.length,
  }] };
}
