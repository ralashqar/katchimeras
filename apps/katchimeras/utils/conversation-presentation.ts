import type { ConversationDefinition } from '@/types/companion-conversation';

/** Narrative ownership is definition-wide, including replies and the final
 * line. Only a standalone, non-narrative status message belongs overhead. */
export function conversationUsesNarrativeOverlay(definition: ConversationDefinition): boolean {
  if (definition.format === 'narrative' || definition.purpose === 'journey'
    || definition.tags?.includes('required-narrative-overlay')) return true;
  return definition.nodes.length > 1 || definition.nodes.some(node => node.kind !== 'end');
}
