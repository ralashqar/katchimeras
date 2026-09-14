import { STEPPLING_TRAIL_CONVERSATIONS } from '@/constants/steppling-activities';
import { STEPPLING_SCENARIO_POLLS } from '@/constants/steppling-scenario-polls';
import { BARISTABBIT_SCENARIO_POLLS } from '@/constants/baristabbit-scenario-polls';
import { mossproutTheoryConversationDefinitions } from '@/constants/mossprout-theory-conversations';
import { spokenAnswerText } from '@/utils/companion-conversation';
import type {
  ConversationDefinition,
  ConversationPollSeed,
  ConversationV2FamilyId,
} from '@/types/companion-conversation';
import { mossproutFtueConversationDefinitions } from '@/constants/mossprout-ftue-conversations';
import { mossproutStoryConversationDefinitions } from '@/constants/mossprout-story-conversations';
import { stepplingDayOneConversation } from '@/constants/steppling-day-one-conversation';
import { hatchableDayOneConversation } from '@/constants/hatchable-day-one-conversation';
import { HATCHABLE_COMPANIONS } from '@/constants/hatchable-companions/registry';
import { mossproutCampaignConversationDefinitions } from '@/constants/mossprout-campaign-conversations';
import { ALL_ISLAND_CAMPAIGN_CONVERSATION_DEFINITIONS } from '@/constants/island-campaigns/helpers';

/**
 * Every conversation the companion pages can open: day one for each hatchable
 * friend, Steppling's trail chats, Mossprout's FTUE, campaign, story and
 * theory conversations, the island chapters, and the scenario polls each
 * friend asks one of a day. A new friend adds a day-one copy file and a poll
 * file; nothing here names them.
 */

/** Fictional village splits by answer count; rotated per poll so the same slot does not always win. */
const POLL_WEIGHTS: Readonly<Record<number, readonly number[]>> = { 2: [58, 42], 3: [42, 34, 24], 4: [36, 28, 21, 15], 5: [30, 24, 19, 15, 12] };

const endNode = (message: string) => ({ id: 'end', kind: 'end' as const, message });

export function poll(
  familyId: ConversationV2FamilyId,
  seed: ConversationPollSeed,
  index: number
): ConversationDefinition {
  const weights = POLL_WEIGHTS[seed.labels.length] ?? POLL_WEIGHTS[3]!;
  const pollOptions = seed.labels.map((label, optionIndex) => {
    const traits = seed.traits?.[optionIndex];
    const spokenText = spokenAnswerText(label);
    return {
      id: `choice-${optionIndex + 1}`,
      label,
      ...(spokenText ? { spokenText } : {}),
      reply: seed.replies?.[optionIndex] ?? (optionIndex === 0
        ? `I thought ${label.toLowerCase()} might win you over.`
        : optionIndex === 1
          ? `A good choice. ${label} has a loyal little corner of the village.`
          : `You picked ${label.toLowerCase()}. I like the less obvious answer.`),
      nextNodeId: 'end',
      villageWeight: weights[(optionIndex + index) % weights.length]!,
      ...(traits ? { traits } : {}),
    };
  });
  return {
    id: `${familyId}:poll:${seed.id}`,
    version: 2,
    familyId,
    title: seed.title ?? seed.prompt,
    trigger: 'poll',
    minimumBondLevel: seed.bond ?? 1,
    cooldownDays: 14,
    tags: ['play', 'preferences'],
    format: 'poll',
    entryNodeId: 'poll',
    nodes: [
      { id: 'poll', kind: 'poll', prompt: seed.prompt, helperText: seed.replies ? 'The village answers too. Just for fun.' : 'Pick quickly. The village result is just for fun.', options: pollOptions, nextNodeId: 'end' },
      endNode(seed.ending ?? 'That one belongs in the village ledger now.'),
    ],
  };
}

/** A friend's daily questions: their scenario polls, one served a day. */
export function familyPack(familyId: ConversationV2FamilyId, polls: readonly ConversationPollSeed[]): ConversationDefinition[] {
  return polls.map((seed, index) => poll(familyId, seed, index));
}

export const companionConversationDefinitionsV2: readonly ConversationDefinition[] = [
  stepplingDayOneConversation,
  ...HATCHABLE_COMPANIONS.filter((definition) => definition.companion !== 'steppling').map(hatchableDayOneConversation),
  ...STEPPLING_TRAIL_CONVERSATIONS,
  ...mossproutFtueConversationDefinitions,
  ...mossproutCampaignConversationDefinitions,
  ...ALL_ISLAND_CAMPAIGN_CONVERSATION_DEFINITIONS,
  ...mossproutStoryConversationDefinitions,
  ...mossproutTheoryConversationDefinitions,
  ...familyPack('baristabbit', BARISTABBIT_SCENARIO_POLLS),
  ...familyPack('steppling', STEPPLING_SCENARIO_POLLS),
];

export const companionConversationDefinitionById = new Map(
  companionConversationDefinitionsV2.map((definition) => [definition.id, definition])
);

export function companionConversationDefinitionsForFamily(familyId: string): readonly ConversationDefinition[] {
  return companionConversationDefinitionsV2.filter((definition) => definition.familyId === familyId);
}
