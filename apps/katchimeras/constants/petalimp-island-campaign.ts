/**
 * Compatibility facade over the island-campaign registry. Petalimp was the
 * first authored island; these names keep older call sites and tests stable
 * while every consumer moves to `@/constants/island-campaigns`.
 */
import type { MergeWorldState, MossproutNatureIslandLevel } from '@/types/merge-world';
import {
  islandCampaignChapter,
  islandCampaignChapterChoice,
  islandCampaignChapterOrder,
  islandCampaignChapterStatus,
  islandCampaignConversationDefinitions,
  islandCampaignPayoffStyle,
  islandCampaignResolutionConversationId,
  islandCampaignReturnConversationId,
  islandCampaignReturnLevel,
  islandCampaignUpgradePanelState,
  type IslandCampaignUpgradePanelState,
} from './island-campaigns/helpers';
import { PETALIMP_BLOOM_CAMPAIGN, type PetalimpGrowthStyle } from './island-campaigns/petalimp-bloom';
import type { IslandCampaignChapterStatus, IslandCampaignChoice } from './island-campaigns/types';

export { PETALIMP_ISLAND_CAMPAIGN_ID, PETALIMP_ISLAND_ID, PETALIMP_BLOOM_CAMPAIGN } from './island-campaigns/petalimp-bloom';
export type { PetalimpGrowthStyle } from './island-campaigns/petalimp-bloom';

export type PetalimpIslandChoice = IslandCampaignChoice<PetalimpGrowthStyle>;
export type PetalimpIslandChapterStatus = IslandCampaignChapterStatus;
export type PetalimpIslandUpgradePanelState = IslandCampaignUpgradePanelState;

export const PETALIMP_ISLAND_CHAPTERS = PETALIMP_BLOOM_CAMPAIGN.chapters;

export const petalimpIslandChapter = (level: MossproutNatureIslandLevel) => islandCampaignChapter(PETALIMP_BLOOM_CAMPAIGN, level);
export const petalimpIslandChapterChoice = (level: MossproutNatureIslandLevel, choiceId?: string | null) => (
  islandCampaignChapterChoice(PETALIMP_BLOOM_CAMPAIGN, level, choiceId)
);
export const petalimpIslandChapterOrder = (level: MossproutNatureIslandLevel, choiceIdOrNow?: string | number | null, nowArg?: number) => (
  islandCampaignChapterOrder(PETALIMP_BLOOM_CAMPAIGN, level, choiceIdOrNow, nowArg)
);
export const petalimpIslandChapterStatus = (world: MergeWorldState, level: MossproutNatureIslandLevel) => (
  islandCampaignChapterStatus(world, PETALIMP_BLOOM_CAMPAIGN, level)
);
export const petalimpIslandUpgradePanelState = (world: MergeWorldState) => islandCampaignUpgradePanelState(world, PETALIMP_BLOOM_CAMPAIGN);
export const petalimpIslandReturnLevel = (world: MergeWorldState) => islandCampaignReturnLevel(world, PETALIMP_BLOOM_CAMPAIGN);
export const petalimpGrowthStyle = (choiceIds: readonly (string | null | undefined)[]) => (
  islandCampaignPayoffStyle(PETALIMP_BLOOM_CAMPAIGN, choiceIds) as PetalimpGrowthStyle
);
export const petalimpIslandReturnConversationId = (level: MossproutNatureIslandLevel, choiceId?: string | null) => (
  islandCampaignReturnConversationId(PETALIMP_BLOOM_CAMPAIGN, level, choiceId)
);
export const petalimpIslandResolutionConversationId = (level: MossproutNatureIslandLevel, choiceId?: string | null, growthStyle?: PetalimpGrowthStyle) => (
  islandCampaignResolutionConversationId(PETALIMP_BLOOM_CAMPAIGN, level, choiceId, growthStyle)
);
export const petalimpIslandConversationDefinitions = islandCampaignConversationDefinitions(PETALIMP_BLOOM_CAMPAIGN);
