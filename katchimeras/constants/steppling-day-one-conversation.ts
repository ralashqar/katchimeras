import type { ConversationDefinition, ConversationNode } from '@/types/companion-conversation';
import { LEGACY_STEPPLING_DAY_ONE_FLOW } from '@/features/content-flow/steppling-day-one-flow-v1';
import type { ContentFlowDefinition } from '@/types/content-flow';
import { STEPPLING_DAY_ONE_FLOW } from '@/features/content-flow/steppling-day-one-flow';

export const STEPPLING_DAY_ONE_CONVERSATION_ID = 'steppling:journey:day-one';

/** Present the authored journey with the same conversation engine as Mossprout. */
function conversationFromFlow(flow: ContentFlowDefinition): ConversationDefinition {
  const visibleTarget = (id: string | undefined | null): string | null => {
    const node = flow.nodes.find((item) => item.id === id);
    if (!node || node.kind === "complete" || id === "parcel") return "end";
    return node.kind === "effect" ? visibleTarget(node.next) : id ?? null;
  };
  return {
  id: STEPPLING_DAY_ONE_CONVERSATION_ID, version: flow.version, familyId: 'steppling',
  title: 'A little way together', trigger: 'evergreen', minimumBondLevel: 1,
  cooldownDays: 0, contextualOnly: true, repeatPolicy: 'once_ever',
  purpose: 'journey', format: 'narrative', returnTarget: 'character_home',
  entryNodeId: 'welcome',
  nodes: [
    ...flow.nodes.flatMap((node): ConversationNode[] => {
      if (node.kind !== 'scene') return [];
      const choices = node.payload?.options as readonly { id: string; label: string }[] | undefined;
      return [{ id: node.id, kind: 'choice', interactionKind: node.id.startsWith('habit.') || node.actions?.length === 1 ? 'navigation' : undefined, prompt: String(node.payload?.text ?? ''),
        options: (node.actions ?? []).map((action) => ({
          id: action.id, label: choices?.find((choice) => choice.id === action.id)?.label ?? (node.payload?.choices as readonly (readonly [string, string])[] | undefined)?.find(([id]) => id === action.id)?.[1] ?? 'Continue',
          reply: '', nextNodeId: visibleTarget(action.next),
        })),
      }];
    }),
    { id: 'end', kind: 'end', message: 'A little parcel is waiting in our Garden.' },
  ],
};

}
export const stepplingDayOneConversation = conversationFromFlow(STEPPLING_DAY_ONE_FLOW);
export const legacyStepplingDayOneConversation = conversationFromFlow(LEGACY_STEPPLING_DAY_ONE_FLOW);
