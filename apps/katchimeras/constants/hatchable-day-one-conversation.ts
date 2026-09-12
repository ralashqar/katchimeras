import type { ConversationDefinition, ConversationNode } from '@/types/companion-conversation';
import type { HatchableCompanionDefinition } from '@/types/hatchable-companion';
import { hatchableFlows } from '@/features/onboarding/hatchable-flows';

/**
 * A hatchable companion's day-one conversation, presented with the same
 * engine as Mossprout's, from the companion's generated day-one flow: each
 * scene a choice, the parcel effect hidden behind the end. Steppling keeps his
 * own instance for the ids his saves carry; every later friend is built here.
 */
export function hatchableDayOneConversation(definition: HatchableCompanionDefinition): ConversationDefinition {
  const flow = hatchableFlows(definition).dayOne;
  const visibleTarget = (id: string | undefined | null): string | null => {
    const node = flow.nodes.find((item) => item.id === id);
    if (!node || node.kind === 'complete' || id === 'parcel') return 'end';
    return node.kind === 'effect' ? visibleTarget(node.next) : id ?? null;
  };
  return {
    id: definition.dayOne.conversationId, version: flow.version, familyId: definition.companion,
    title: definition.dayOne.flow.title, trigger: 'evergreen', minimumBondLevel: 1,
    cooldownDays: 0, contextualOnly: true, repeatPolicy: 'once_ever',
    purpose: 'journey', format: 'narrative', returnTarget: 'character_home',
    entryNodeId: flow.entryNodeId,
    nodes: [
      ...flow.nodes.flatMap((node): ConversationNode[] => {
        if (node.kind !== 'scene') return [];
        const choices = node.payload?.options as readonly { id: string; label: string }[] | undefined;
        return [{ id: node.id, kind: 'choice', interactionKind: node.actions?.length === 1 ? 'navigation' : undefined, prompt: String(node.payload?.text ?? ''),
          options: (node.actions ?? []).map((action) => ({
            id: action.id, label: choices?.find((choice) => choice.id === action.id)?.label ?? 'Continue',
            reply: '', nextNodeId: visibleTarget(action.next),
          })),
        }];
      }),
      { id: 'end', kind: 'end', message: definition.dayOne.endMessage },
    ],
  };
}
