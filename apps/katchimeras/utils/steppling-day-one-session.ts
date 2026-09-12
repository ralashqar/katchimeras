import type { ConversationSession } from '@/types/companion-conversation';

const DEFINITION_ID = 'steppling:journey:day-one';
export function migrateStepplingDayOneSession(session: ConversationSession): ConversationSession {
  if (session.definitionId !== DEFINITION_ID || session.definitionVersion >= 3 || session.status !== 'active') return session;
  const answer = [...session.turns].reverse().find((turn) => turn.nodeId === 'reflection' && ['walk', 'adapted', 'rest'].includes(turn.optionId));
  return { ...session, definitionVersion: 3, currentNodeId: answer ? `handoff.${answer.optionId}` : 'reflection',
    pendingReply: undefined, pendingNextNodeId: undefined, lastReply: undefined, exitTransition: undefined };
}
/** A completed day-one conversation whose garden handoff has not been taken up yet. */
export function gardenHandoffPendingFor(session: ConversationSession, definitionId: string, minimumVersion = 3): boolean {
  return session.definitionId === definitionId && session.definitionVersion >= minimumVersion && !session.preview
    && session.status === 'completed' && session.gardenHandoffAt == null;
}
export function stepplingGardenHandoffPending(session: ConversationSession): boolean {
  return gardenHandoffPendingFor(session, DEFINITION_ID);
}
