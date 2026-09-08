import type { KatchimeraSkinId } from '@/types/katchimera';
import type { MossproutNatureIslandId } from '@/types/merge-world';
import { AMBERLEAF_ORCHARD_CAMPAIGN } from './amberleaf-orchard';
import { BLOSSLE_NURSERY_CAMPAIGN } from './blossle-nursery';
import { DRIZZLET_POND_CAMPAIGN } from './drizzlet-pond';
import { FERNIP_WILDGROWTH_CAMPAIGN } from './fernip-wildgrowth';
import { MISTLE_ANCIENT_TREE_CAMPAIGN } from './mistle-ancient-tree';
import { PETALIMP_BLOOM_CAMPAIGN } from './petalimp-bloom';
import type { IslandCampaignDefinition } from './types';

/**
 * Every narrative-led nature island, in wake order. Keep this module free of
 * engine or offer imports: the engine reads it while reducing commands.
 */
export const ISLAND_CAMPAIGNS: readonly IslandCampaignDefinition[] = [
  PETALIMP_BLOOM_CAMPAIGN,
  FERNIP_WILDGROWTH_CAMPAIGN,
  BLOSSLE_NURSERY_CAMPAIGN,
  DRIZZLET_POND_CAMPAIGN,
  AMBERLEAF_ORCHARD_CAMPAIGN,
  MISTLE_ANCIENT_TREE_CAMPAIGN,
];

export const islandCampaignById = new Map(ISLAND_CAMPAIGNS.map((campaign) => [campaign.campaignId, campaign]));

export function islandCampaignForIsland(islandId: MossproutNatureIslandId | string | null | undefined): IslandCampaignDefinition | null {
  return ISLAND_CAMPAIGNS.find((campaign) => campaign.islandId === islandId) ?? null;
}

export function islandCampaignForResident(skinId: KatchimeraSkinId | string | null | undefined): IslandCampaignDefinition | null {
  return ISLAND_CAMPAIGNS.find((campaign) => campaign.residentSkinId === skinId) ?? null;
}

/** World upgrade offers address islands as `nature:<islandId>`. */
export function islandCampaignForOffer(offerId: string | null | undefined): IslandCampaignDefinition | null {
  return offerId?.startsWith('nature:') ? islandCampaignForIsland(offerId.slice('nature:'.length)) : null;
}

export function isIslandCampaignId(id: string | null | undefined): boolean {
  return id != null && islandCampaignById.has(id);
}

/** Order chapter ids carry `${chapterIdPrefix}-level-${n}`. */
export function isIslandCampaignChapterId(id: string | null | undefined): boolean {
  return id != null && ISLAND_CAMPAIGNS.some((campaign) => id.startsWith(`${campaign.chapterIdPrefix}-level-`));
}

export function islandCampaignReturnNoteId(campaign: IslandCampaignDefinition, level: number): string {
  return `${campaign.campaignId}:return:${level}`;
}

export function parseIslandCampaignReturnNoteId(noteId: string): { campaign: IslandCampaignDefinition; level: number } | null {
  for (const campaign of ISLAND_CAMPAIGNS) {
    const prefix = `${campaign.campaignId}:return:`;
    if (!noteId.startsWith(prefix)) continue;
    const level = Number(noteId.slice(prefix.length));
    return Number.isInteger(level) ? { campaign, level } : null;
  }
  return null;
}
