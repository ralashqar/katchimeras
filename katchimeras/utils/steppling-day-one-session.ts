import type { ConversationSession } from '@/types/companion-conversation';

const DEFINITION_ID = 'steppling:journey:day-one';
export function migrateStepplingDayOneSession(session: ConversationSession): ConversationSession {
  if (session.definitionId !== DEFINITION_ID || session.definitionVersion >= 3 || session.status !== 'active') return session;
  const answer = [...session.turns].reverse().find((turn) => turn.nodeId === 'reflection' && ['walk', 'adapted', 'rest'].includes(turn.optionId));
  return { ...session, definitionVersion: 3, currentNodeId: answer ? `handoff.${answer.optionId}` : 'reflection',
    pendingReply: undefined, pendingNextNodeId: undefined, lastReply: undefined, exitTransition: undefined };
}
export function stepplingGardenHandoffPending(session: ConversationSession): boolean {
  return session.definitionId === DEFINITION_ID && session.definitionVersion >= 3 && !session.preview
    && session.status === 'completed' && session.gardenHandoffAt == null;
}
