import { katchimeraSkinById } from '@/constants/katchimera-skins';
import type { KatchimeraSkinId } from '@/types/katchimera';
import type { MergeWorldState, MossproutNatureIslandId } from '@/types/merge-world';
import { islandCampaignForIsland, islandCampaignForResident } from './registry';

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

export const islandWakeEntry = (islandId: MossproutNatureIslandId | string | null | undefined): IslandWakeEntry | null => (
  ISLAND_WAKE_ORDER.find((entry) => entry.islandId === islandId) ?? null
);

/** A friend is home once their card is owned or their island story granted it. */
export function islandFriendHome(world: MergeWorldState, residentSkinId: KatchimeraSkinId): boolean {
  if (world.ownedKatchimeraCards.some((card) => card.cardId === residentSkinId)) return true;
  const campaign = islandCampaignForResident(residentSkinId);
  return Boolean(campaign && world.islandCampaigns?.[campaign.campaignId]?.cardEarnedAt != null);
}

export function islandWakeState(world: MergeWorldState, islandId: MossproutNatureIslandId): IslandWakeState {
  if (world.haven.mossproutNatureIslandReveals[islandId] || (world.haven.mossproutNatureIslands[islandId] ?? 0) > 0) return 'revealed';
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
  const blocker = islandWakeBlocker(world, islandId);
  return blocker
    ? `Someone is resting here. Bring ${blocker.residentName} home first.`
    : 'Someone is resting here. This part of the garden is not ready to wake yet.';
}

/** The island whose mist the player can clear next. */
export function nextOpenIsland(world: MergeWorldState): MossproutNatureIslandId | null {
  return ISLAND_WAKE_ORDER.find((entry) => islandWakeState(world, entry.islandId) === 'open')?.islandId ?? null;
}
