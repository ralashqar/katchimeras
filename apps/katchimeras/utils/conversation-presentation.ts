import type { ConversationDefinition } from '@/types/companion-conversation';

/** Keep a branching interaction in one overlay, including its results. */
export function conversationUsesNarrativeOverlay(definition: ConversationDefinition): boolean {
  return definition.nodes.some((node) => {
    if (node.kind === 'choice' || node.kind === 'poll') return node.options.length > 1;
    if (node.kind === 'profile_game' || node.kind === 'insight_game') {
      return node.questions.some((question) => question.options.length > 1);
    }
    return false;
  });
}
