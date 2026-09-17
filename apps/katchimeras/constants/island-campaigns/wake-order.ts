import { katchimeraSkinById } from '@/constants/katchimera-skins';
import type { KatchimeraSkinId } from '@/types/katchimera';
import type { MergeWorldState, MossproutNatureIslandId } from '@/types/merge-world';
import { hatchableEggProgress } from '@/features/onboarding/hatchable-egg-policy';
import { ISLAND_CAMPAIGNS, islandCampaignForIsland, islandCampaignForResident } from './registry';
import type { IslandWakeCondition } from './types';

export type IslandWakeEntry = { islandId: MossproutNatureIslandId; residentSkinId: KatchimeraSkinId };

/**
 * Friends drifted into the mist one by one; they come home in this order.
 * Each island sleeps until the friend before it is home, so the Kingdom
 * always has exactly one "next" place to bring back.
 */
export const ISLAND_WAKE_ORDER: readonly IslandWakeEntry[] = [
  { islandId: 'bloom-garden', residentSkinId: 'petalimp' },
  { islandId: 'wildgrowth-grove', residentSkinId: 'fernip' },
  { islandId: 'seed-nursery', residentSkinId: 'blossle' },
  { islandId: 'pond-sanctuary', residentSkinId: 'drizzlet' },
  { islandId: 'orchard-grove', residentSkinId: 'amberleaf' },
  { islandId: 'ancient-tree-grove', residentSkinId: 'mistle' },
];

export type IslandWakeState = 'open' | 'sleeping' | 'revealed';

export const islandWakeEntry = (islandId: MossproutNatureIslandId | string | null | undefined): IslandWakeEntry | null => {
  const ordered = ISLAND_WAKE_ORDER.find((entry) => entry.islandId === islandId);
  if (ordered) return ordered;
  // An island with its own wake condition (a pack's) is its own entry.
  const campaign = islandCampaignForIsland(islandId);
  return campaign?.wake ? { islandId: campaign.islandId, residentSkinId: campaign.residentSkinId } : null;
};

/** Whether a campaign's own wake condition holds. */
export function islandWakeConditionHolds(world: MergeWorldState, condition: IslandWakeCondition): boolean {
  switch (condition.kind) {
    case 'always': return true;
    case 'friend_home': return islandFriendHome(world, condition.residentSkinId);
    case 'friend_hatched': return Boolean(hatchableEggProgress(world, { companion: condition.companion })?.hatchedAt) || world.companionDiscovery.records.some((record) => record.characterId === condition.companion);
  }
}

/** A friend is home once their card is owned or their island story granted it. */
export function islandFriendHome(world: MergeWorldState, residentSkinId: KatchimeraSkinId): boolean {
  if (world.ownedKatchimeraCards.some((card) => card.cardId === residentSkinId)) return true;
  const campaign = islandCampaignForResident(residentSkinId);
  return Boolean(campaign && world.islandCampaigns?.[campaign.campaignId]?.cardEarnedAt != null);
}

export function islandWakeState(world: MergeWorldState, islandId: MossproutNatureIslandId): IslandWakeState {
  if (world.haven.mossproutNatureIslandReveals[islandId] || (world.haven.mossproutNatureIslands[islandId] ?? 0) > 0) return 'revealed';
  const own = islandCampaignForIsland(islandId)?.wake;
  if (own) return islandWakeConditionHolds(world, own) ? 'open' : 'sleeping';
  const index = ISLAND_WAKE_ORDER.findIndex((entry) => entry.islandId === islandId);
  if (index < 0 || !islandCampaignForIsland(islandId)) return 'sleeping';
  const previous = ISLAND_WAKE_ORDER[index - 1];
  return !previous || islandFriendHome(world, previous.residentSkinId) ? 'open' : 'sleeping';
}

/** The friend who has to come home before this island wakes, if there is one. */
export function islandWakeBlocker(world: MergeWorldState, islandId: MossproutNatureIslandId): (IslandWakeEntry & { residentName: string }) | null {
  const index = ISLAND_WAKE_ORDER.findIndex((entry) => entry.islandId === islandId);
  const previous = index > 0 ? ISLAND_WAKE_ORDER[index - 1] : null;
  if (!previous || islandFriendHome(world, previous.residentSkinId)) return null;
  return { ...previous, residentName: katchimeraSkinById.get(previous.residentSkinId)?.displayName ?? previous.residentSkinId };
}

export function islandWakeLockedReason(world: MergeWorldState, islandId: MossproutNatureIslandId): string | null {
  if (islandWakeState(world, islandId) !== 'sleeping') return null;
  const own = islandCampaignForIsland(islandId);
  if (own?.wake) return own.copy.sleepingHint;
  const blocker = islandWakeBlocker(world, islandId);
  return blocker
    ? `Someone is resting here. Bring ${blocker.residentName} home first.`
    : 'Someone is resting here. This part of the garden is not ready to wake yet.';
}

/** The island whose mist the player can clear next. */
export function nextOpenIsland(world: MergeWorldState): MossproutNatureIslandId | null {
  return ISLAND_WAKE_ORDER.find((entry) => islandWakeState(world, entry.islandId) === 'open')?.islandId ?? null;
}

/** Every island awake right now, the bundled order first, then any island a pack woke by its own condition. */
export function openIslands(world: MergeWorldState): MossproutNatureIslandId[] {
  const ordered = ISLAND_WAKE_ORDER.map((entry) => entry.islandId);
  const own = ISLAND_CAMPAIGNS.filter((campaign) => campaign.wake).map((campaign) => campaign.islandId);
  return [...ordered, ...own.filter((id) => !ordered.includes(id))].filter((id) => islandWakeState(world, id) === 'open');
}
