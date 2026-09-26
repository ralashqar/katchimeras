import { katchimeraSkinById } from '@/constants/katchimera-skins';
import type { KatchimeraSkinId } from '@/types/katchimera';
import type { MergeWorldState, MossproutNatureIslandId } from '@/types/merge-world';
import { hatchableEggProgress } from '@/features/onboarding/hatchable-egg-policy';
import { heartTreeLevel } from '@/constants/heart-tree';
import { heartwoodStage, type HeartwoodStage } from '@/features/shared-adventure/heartwood-progression';
import { ISLAND_CAMPAIGNS, islandCampaignForIsland, islandCampaignForResident } from './registry';
import type { IslandWakeCondition } from './types';

export type IslandWakeEntry = {
  islandId: MossproutNatureIslandId; residentSkinId: KatchimeraSkinId;
  /** The Heart Tree level the island needs before it wakes (`constants/heart-tree.ts`): the Sanctuary must be strong enough to reach it. */
  heartTree?: number;
};
const HEARTWOOD_STAGES: readonly HeartwoodStage[] = ['dormant', 'stirring', 'rooted', 'blooming', 'awakened'];

/**
 * Friends drifted into the mist one by one; they come home in this order.
 * Each island sleeps until the friend before it is home, so the Kingdom
 * always has exactly one "next" place to bring back.
 */
export const ISLAND_WAKE_ORDER: readonly IslandWakeEntry[] = [
  { islandId: 'bloom-garden', residentSkinId: 'petalimp' },
  { islandId: 'wildgrowth-grove', residentSkinId: 'fernip', heartTree: 3 },
  { islandId: 'seed-nursery', residentSkinId: 'blossle', heartTree: 4 },
  { islandId: 'pond-sanctuary', residentSkinId: 'drizzlet', heartTree: 5 },
  { islandId: 'orchard-grove', residentSkinId: 'amberleaf', heartTree: 6 },
  { islandId: 'ancient-tree-grove', residentSkinId: 'mistle', heartTree: 7 },
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
    case 'tree_stage': return HEARTWOOD_STAGES.indexOf(heartwoodStage(world)) >= HEARTWOOD_STAGES.indexOf(condition.stage);
    case 'rung_cleared': return Boolean(world.encounters?.clears[condition.missionId]);
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
  const campaign = islandCampaignForIsland(islandId);
  // Cozy 4X (a woken Heart Tree): a pack still built on the old boards (a clock, column-shot) stays asleep until its
  // levels are Lanes (the Wanderling Trail, the Rush Track).
  if (world.heartTree && campaign?.chapters.some((chapter) => chapter.restoration?.rush || chapter.restoration?.mechanic)) return 'sleeping';
  const own = campaign?.wake;
  if (own) return islandWakeConditionHolds(world, own) ? 'open' : 'sleeping';
  const index = ISLAND_WAKE_ORDER.findIndex((entry) => entry.islandId === islandId);
  if (index < 0 || !islandCampaignForIsland(islandId)) return 'sleeping';
  const previous = ISLAND_WAKE_ORDER[index - 1];
  if (previous && !islandFriendHome(world, previous.residentSkinId)) return 'sleeping';
  return islandHeartTreeShort(world, islandId) ? 'sleeping' : 'open';
}

/**
 * The Heart Tree level an island still waits for, or null when it is tall enough. Only a woken Tree gates (worlds
 * from before the Last Clearing never had one to grow).
 */
export function islandHeartTreeShort(world: MergeWorldState, islandId: MossproutNatureIslandId): number | null {
  const needed = ISLAND_WAKE_ORDER.find((entry) => entry.islandId === islandId)?.heartTree ?? 0;
  if (!world.heartTree || heartTreeLevel(world) >= needed) return null;
  return needed;
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
  const tree = blocker ? null : islandHeartTreeShort(world, islandId);
  if (tree != null) return `The Mist is too thick to reach. Grow the Heart Tree to level ${tree} first.`;
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
