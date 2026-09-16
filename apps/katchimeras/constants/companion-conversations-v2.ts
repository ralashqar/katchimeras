import { markRegistryBuilt, packEntries } from '@/features/content-packs/active-pack';
import { STEPPLING_TRAIL_CONVERSATIONS } from '@/constants/steppling-activities';
import { mossproutTheoryConversationDefinitions } from '@/constants/mossprout-theory-conversations';
import { familyPack } from '@/constants/companion-poll-conversation';
import type { ConversationDefinition } from '@/types/companion-conversation';
import { mossproutFtueConversationDefinitions } from '@/constants/mossprout-ftue-conversations';
import { mossproutStoryConversationDefinitions } from '@/constants/mossprout-story-conversations';
import { stepplingDayOneConversation } from '@/constants/steppling-day-one-conversation';
import { hatchableDayOneConversation } from '@/constants/hatchable-day-one-conversation';
import { HATCHABLE_COMPANIONS } from '@/constants/hatchable-companions/registry';
import { mossproutCampaignConversationDefinitions } from '@/constants/mossprout-campaign-conversations';
import { ALL_ISLAND_CAMPAIGN_CONVERSATION_DEFINITIONS } from '@/constants/island-campaigns/helpers';
import { JOURNEY_EPISODE_CONVERSATIONS } from '@/constants/companion-journey-chapters/registry';

/**
 * Every conversation the companion pages can open: day one for each hatchable
 * friend, Steppling's trail chats, Mossprout's FTUE, campaign, story and
 * theory conversations, the island chapters, and the scenario polls each
 * friend asks one of a day. A new friend adds a day-one copy file and a poll
 * file; nothing here names them.
 */

export { poll, familyPack } from '@/constants/companion-poll-conversation';

export const companionConversationDefinitionsBundled: readonly ConversationDefinition[] = [
  stepplingDayOneConversation,
  ...HATCHABLE_COMPANIONS.filter((definition) => definition.companion !== 'steppling').map(hatchableDayOneConversation),
  ...STEPPLING_TRAIL_CONVERSATIONS,
  ...mossproutFtueConversationDefinitions,
  ...mossproutCampaignConversationDefinitions,
  ...ALL_ISLAND_CAMPAIGN_CONVERSATION_DEFINITIONS,
  ...mossproutStoryConversationDefinitions,
  ...mossproutTheoryConversationDefinitions,
  ...HATCHABLE_COMPANIONS.flatMap((definition) => familyPack(definition.companion, definition.daily?.polls ?? [])),
  ...JOURNEY_EPISODE_CONVERSATIONS,
];
export const companionConversationDefinitionsV2: readonly ConversationDefinition[] = [...companionConversationDefinitionsBundled, ...packEntries('conversations')];
markRegistryBuilt('conversations');

export const companionConversationDefinitionById = new Map(
  companionConversationDefinitionsV2.map((definition) => [definition.id, definition])
);

export function companionConversationDefinitionsForFamily(familyId: string): readonly ConversationDefinition[] {
  return companionConversationDefinitionsV2.filter((definition) => definition.familyId === familyId);
}
