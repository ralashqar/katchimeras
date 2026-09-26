import { ISLAND_WAKE_ORDER } from '@/constants/island-campaigns/wake-order';
import { islandCampaignForIsland } from '@/constants/island-campaigns/registry';
import { MOSSPROUT_NATURE_ISLANDS } from '@/constants/mossprout-nature-islands';
import type { MergeWorldState } from '@/types/merge-world';

/**
 * Where battles are for Glow and XP (Sept 2026: plants that shoot, never the old Grove): the latest friend island whose
 * Mist is lifted, its levels on its track. Null before any island is, when Glow comes from the Café instead.
 */
export function battleSourceCampaign(world: Pick<MergeWorldState, 'haven'>): { campaignId: string; islandId: string; place: string } | null {
  for (const entry of [...ISLAND_WAKE_ORDER].reverse()) {
    const revealed = Boolean(world.haven.mossproutNatureIslandReveals[entry.islandId]) || (world.haven.mossproutNatureIslands[entry.islandId] ?? 0) > 0;
    if (!revealed) continue;
    const campaign = islandCampaignForIsland(entry.islandId);
    if (!campaign) continue;
    const place = MOSSPROUT_NATURE_ISLANDS.find((island) => island.id === entry.islandId)?.name ?? 'the island';
    return { campaignId: campaign.campaignId, islandId: entry.islandId, place };
  }
  return null;
}
