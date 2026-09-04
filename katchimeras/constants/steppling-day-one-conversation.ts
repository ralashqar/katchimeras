import type { ConversationDefinition, ConversationNode } from '@/types/companion-conversation';
import { STEPPLING_DAY_ONE_FLOW } from '@/features/content-flow/steppling-day-one-flow';

export const STEPPLING_DAY_ONE_CONVERSATION_ID = 'steppling:journey:day-one';

/** Present the authored journey with the same conversation engine as Mossprout. */
export const stepplingDayOneConversation: ConversationDefinition = {
  id: STEPPLING_DAY_ONE_CONVERSATION_ID, version: 1, familyId: 'steppling',
  title: 'A little way together', trigger: 'evergreen', minimumBondLevel: 1,
  cooldownDays: 0, contextualOnly: true, repeatPolicy: 'once_ever',
  purpose: 'journey', format: 'narrative', returnTarget: 'character_home',
  entryNodeId: 'welcome',
  nodes: [
    ...STEPPLING_DAY_ONE_FLOW.nodes.flatMap((node): ConversationNode[] => {
      if (node.kind !== 'scene') return [];
      const choices = node.payload?.options as readonly { id: string; label: string }[] | undefined;
      return [{ id: node.id, kind: 'choice', prompt: String(node.payload?.text ?? ''),
        options: (node.actions ?? []).map((action) => ({
          id: action.id, label: choices?.find((choice) => choice.id === action.id)?.label ?? 'Continue',
          reply: '', nextNodeId: action.next === 'parcel' ? 'end' : action.next ?? null,
        })),
      }];
    }),
    { id: 'end', kind: 'end', message: 'A little parcel is waiting in our Garden.' },
  ],
};
