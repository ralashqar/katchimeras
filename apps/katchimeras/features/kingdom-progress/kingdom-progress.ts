import { activeIslandCampaign, islandCampaignProgress, pendingIslandCampaignDiscovery } from '@/constants/island-campaigns/helpers';
import { islandCampaignForIsland } from '@/constants/island-campaigns/registry';
import { ISLAND_WAKE_ORDER, islandFriendHome, islandWakeState, nextOpenIsland } from '@/constants/island-campaigns/wake-order';
import { katchimeraSkinById } from '@/constants/katchimera-skins';
import { mossproutNatureIslandById, MOSSPROUT_NATURE_ISLAND_IDS } from '@/constants/mossprout-nature-islands';
import { MOSSPROUT_RESIDENT_IDS } from '@/constants/mossprout-residents';
import type { KatchimeraSkinId } from '@/types/katchimera';
import type { MergeWorldState, MossproutNatureIslandId } from '@/types/merge-world';

/**
 * home     – the friend's card is owned; they live in the Kingdom again.
 * helping  – met on their island, story in progress.
 * waiting  – their island is the next one to clear; nobody has met them yet.
 * resting  – asleep in the mist until an earlier friend is home.
 * away     – arrives through Mossprout's later journeys, not an island.
 */
export type KingdomFriendStatus = 'home' | 'helping' | 'waiting' | 'resting' | 'away';
export type KingdomFriendEntry = {
  skinId: KatchimeraSkinId;
  name: string;
  status: KingdomFriendStatus;
  source: 'companion' | 'island' | 'journey';
  islandId?: MossproutNatureIslandId;
  islandName?: string;
};

export type KingdomPlaceStatus = 'restored' | 'growing' | 'open' | 'resting';
export type KingdomPlaceEntry = {
  id: 'mossprout-garden' | MossproutNatureIslandId;
  name: string;
  level: number;
  maxLevel: number;
  status: KingdomPlaceStatus;
  residentSkinId?: KatchimeraSkinId;
};

export type KingdomNext = {
  kind: 'clear_mist' | 'talk' | 'merge' | 'restore' | 'story' | 'journey' | 'complete';
  label: string;
  islandId?: MossproutNatureIslandId;
  residentSkinId?: KatchimeraSkinId;
  campaignId?: string;
};

export type KingdomProgress = {
  friends: { home: number; met: number; total: number; entries: KingdomFriendEntry[] };
  places: { restored: number; total: number; entries: KingdomPlaceEntry[] };
  next: KingdomNext;
};

const friendName = (skinId: KatchimeraSkinId) => katchimeraSkinById.get(skinId)?.displayName ?? skinId;

function friendEntry(world: MergeWorldState, skinId: KatchimeraSkinId): KingdomFriendEntry {
  const name = friendName(skinId);
  if (skinId === 'mossprout') return { skinId, name, status: 'home', source: 'companion' };
  const wake = ISLAND_WAKE_ORDER.find((entry) => entry.residentSkinId === skinId);
  if (wake) {
    const islandName = mossproutNatureIslandById.get(wake.islandId)?.name;
    const base = { skinId, name, source: 'island' as const, islandId: wake.islandId, islandName };
    if (islandFriendHome(world, skinId)) return { ...base, status: 'home' };
    const campaign = islandCampaignForIsland(wake.islandId);
    const progress = campaign ? islandCampaignProgress(world, campaign) : null;
    if (progress) return { ...base, status: 'helping' };
    const state = islandWakeState(world, wake.islandId);
    return { ...base, status: state === 'sleeping' ? 'resting' : state === 'open' ? 'waiting' : 'helping' };
  }
  const home = world.mossproutResidentSkinIds.includes(skinId) || world.ownedKatchimeraCards.some((card) => card.cardId === skinId);
  if (home) return { skinId, name, status: 'home', source: 'journey' };
  const record = world.residentCardDiscovery.records.find((candidate) => candidate.residentId === skinId);
  const helping = Boolean(record && record.status !== 'locked' && record.status !== 'card_earned');
  return { skinId, name, status: helping ? 'helping' : 'away', source: 'journey' };
}

function placeEntry(world: MergeWorldState, islandId: MossproutNatureIslandId): KingdomPlaceEntry {
  const island = mossproutNatureIslandById.get(islandId);
  const level = world.haven.mossproutNatureIslands[islandId] ?? 0;
  const wake = islandWakeState(world, islandId);
  const status: KingdomPlaceStatus = level >= 4 ? 'restored' : wake === 'revealed' ? 'growing' : wake === 'open' ? 'open' : 'resting';
  return { id: islandId, name: island?.name ?? islandId, level, maxLevel: 4, status, residentSkinId: ISLAND_WAKE_ORDER.find((entry) => entry.islandId === islandId)?.residentSkinId };
}

function nextStep(world: MergeWorldState, friends: KingdomFriendEntry[]): KingdomNext {
  const pending = pendingIslandCampaignDiscovery(world);
  if (pending) {
    const islandName = mossproutNatureIslandById.get(pending.campaign.islandId)?.name ?? 'the island';
    return { kind: 'talk', label: `Meet ${pending.campaign.residentName} at ${islandName}`, islandId: pending.campaign.islandId, residentSkinId: pending.campaign.residentSkinId, campaignId: pending.campaign.campaignId };
  }
  const active = activeIslandCampaign(world);
  if (active) {
    const { campaign, status } = active;
    const islandName = mossproutNatureIslandById.get(campaign.islandId)?.name ?? 'the island';
    const base = { islandId: campaign.islandId, residentSkinId: campaign.residentSkinId, campaignId: campaign.campaignId };
    switch (status) {
      case 'available': return { ...base, kind: 'talk', label: `Plan with ${campaign.residentName} at ${islandName}` };
      case 'orders_active': return { ...base, kind: 'merge', label: `Make ${campaign.residentName}’s request in Merge` };
      case 'return_ready': return { ...base, kind: 'talk', label: `Meet ${campaign.residentName} at ${islandName}` };
      case 'restoration_ready': return { ...base, kind: 'restore', label: `Restore ${islandName}` };
      case 'resolution_ready': return { ...base, kind: 'story', label: `See what grew at ${islandName}` };
      default: break;
    }
  }
  const open = nextOpenIsland(world);
  if (open) {
    const wake = ISLAND_WAKE_ORDER.find((entry) => entry.islandId === open);
    return { kind: 'clear_mist', label: `Clear the mist at ${mossproutNatureIslandById.get(open)?.name ?? open}`, islandId: open, residentSkinId: wake?.residentSkinId };
  }
  if (friends.some((friend) => friend.status !== 'home')) {
    const away = friends.filter((friend) => friend.status === 'away').map((friend) => friend.name);
    return { kind: 'journey', label: away.length
      ? `${away.join(' and ')} will find their way here through Mossprout’s journeys`
      : 'The next friend is still resting. Keep growing the garden.' };
  }
  return { kind: 'complete', label: 'Every friend is home.' };
}

/** Everything the Kingdom tracker, pill and goal scene show, derived from durable world state. */
export function kingdomProgress(world: MergeWorldState): KingdomProgress {
  const friendEntries = MOSSPROUT_RESIDENT_IDS.map((skinId) => friendEntry(world, skinId));
  const garden: KingdomPlaceEntry = {
    id: 'mossprout-garden', name: 'Mossprout’s Garden', level: world.haven.tileStages.mossprout ?? 0, maxLevel: 1,
    status: (world.haven.tileStages.mossprout ?? 0) >= 1 ? 'restored' : 'open', residentSkinId: 'mossprout',
  };
  const placeEntries = [garden, ...ISLAND_WAKE_ORDER.map((entry) => placeEntry(world, entry.islandId))
    .concat(MOSSPROUT_NATURE_ISLAND_IDS.filter((id) => !ISLAND_WAKE_ORDER.some((entry) => entry.islandId === id)).map((id) => placeEntry(world, id)))];
  return {
    friends: {
      home: friendEntries.filter((friend) => friend.status === 'home').length,
      met: friendEntries.filter((friend) => friend.status === 'home' || friend.status === 'helping').length,
      total: friendEntries.length,
      entries: friendEntries,
    },
    places: {
      restored: placeEntries.filter((place) => place.status === 'restored').length,
      total: placeEntries.length,
      entries: placeEntries,
    },
    next: nextStep(world, friendEntries),
  };
}
