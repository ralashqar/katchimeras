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
  // The campaign pivot: the Merge Garden and its lesson are gone, so a friend's day one hands over to nothing.
  // It ends on the Haven, where the Kingdom's goal takes over.
  void session; void definitionId; void minimumVersion;
  return false;
}
export function stepplingGardenHandoffPending(session: ConversationSession): boolean {
  return gardenHandoffPendingFor(session, DEFINITION_ID);
}
