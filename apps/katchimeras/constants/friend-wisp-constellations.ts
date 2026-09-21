import { WISP_RARITY } from '@/constants/wisp-rarity';
import { WISPS_BY_ID } from '@/constants/wisps';
import type { KatchimeraFamilyId } from '@/types/katchimera';
import type { WispId, WispRarity } from '@/types/wisp';
import type { WispPackDefinition } from '@/types/wisp-lantern';

/**
 * A friend's own Wisp collection: eight Wisps that come from that friend's packs, and one signature that is only ever
 * the reward for reaching the top of their Bond. This table is the whole of a friend's set; changing a friend's
 * Wisps, or giving a new friend a set, is an edit here. A friend with no entry has no collection yet.
 *
 * Until each friend has Wisps drawn for them alone, the sets are chosen from Wisps that already have art and fit the
 * friend. Those Wisps can also still be found by living the day they belong to; a pack just adds a copy.
 */
export type FriendConstellation = {
  familyId: KatchimeraFamilyId;
  name: string;
  commons: readonly WispId[];
  rares: readonly WispId[];
  epic: WispId;
  /** Never in a pack: given at Bond level 4. */
  signature: WispId;
  /** One small, permanent number in the friend's own corner of the economy, for completing all nine. */
  perk: FriendConstellationPerk;
};
export type FriendConstellationPerk =
  | { kind: 'garden_order_glow'; amount: number; label: string }
  | { kind: 'step_energy'; amount: number; label: string }
  | { kind: 'storage'; amount: number; label: string }
  | { kind: 'better_finds'; amount: number; label: string };

export const FRIEND_CONSTELLATIONS: readonly FriendConstellation[] = [
  { familyId: 'mossprout', name: 'Mossprout’s Grove Lights',
    commons: ['sprout', 'bloom', 'dewdrop', 'clover'], rares: ['fern', 'dawn', 'sunset'], epic: 'aurora', signature: 'grovelight',
    perk: { kind: 'garden_order_glow', amount: 0.05, label: '+5% Glow from Garden orders' } },
  { familyId: 'steppling', name: 'Steppling’s Trail Lights',
    commons: ['stride', 'shore', 'pebble', 'breeze'], rares: ['pulse', 'rush', 'wander'], epic: 'starlit', signature: 'pacespark',
    perk: { kind: 'step_energy', amount: 1, label: '+1 energy from every block of steps' } },
  { familyId: 'feastle', name: 'Feastle’s Hearth Lights',
    commons: ['crumb', 'sizzle', 'market', 'heartlet'], rares: ['feast', 'moonlit', 'flicker'], epic: 'orbit', signature: 'nibble',
    perk: { kind: 'storage', amount: 1, label: '+1 storage slot' } },
  { familyId: 'baristabbit', name: 'Baristabbit’s Café Lights',
    commons: ['steam', 'bubble', 'page', 'nest'], rares: ['focus', 'sketch', 'note'], epic: 'spire', signature: 'crema',
    perk: { kind: 'better_finds', amount: 0.03, label: '+3% better finds from item makers' } },
];

const BY_FAMILY = new Map(FRIEND_CONSTELLATIONS.map((constellation) => [constellation.familyId, constellation]));
export const friendConstellation = (familyId: string | null | undefined) => (familyId ? BY_FAMILY.get(familyId) ?? null : null);
/** The eight that come from packs. */
export const friendPackWisps = (constellation: FriendConstellation): readonly WispId[] => [...constellation.commons, ...constellation.rares, constellation.epic];
/** All nine, in the order the friend's page shows them. */
export const friendConstellationWisps = (constellation: FriendConstellation): readonly WispId[] => [...friendPackWisps(constellation), constellation.signature];

// ---- packs ----------------------------------------------------------------------------------------------------------

export type FriendPackKind = 'pouch' | 'bright' | 'gift' | 'gift-rare' | 'finale';
export const FRIEND_PACK_KINDS: readonly FriendPackKind[] = ['pouch', 'bright', 'gift', 'gift-rare', 'finale'];
export const FRIEND_PACK_NAMES: Record<FriendPackKind, string> = {
  pouch: 'Daily Pouch', bright: 'Bright Pouch', gift: 'Friend Gift', 'gift-rare': 'Friend Gift', finale: 'Chapter Gift',
};
/** How likely each tier is on one card, before the pity rule: a Common about two times in three. */
const TIER_WEIGHT: Record<'common' | 'rare' | 'epic', number> = { common: 16, rare: 10, epic: 6 };
/** A Bright Pouch doubles everything that is not Common. */
const BRIGHT_BOOST = 2;
/** After this many of a friend's packs with nothing new, the next one's last card is one the player is missing. */
export const FRIEND_PACK_PITY = 2;

export const friendPackId = (familyId: string, kind: FriendPackKind) => `friend-${kind}:${familyId}`;
const friendProtectionGroup = (familyId: string) => `friend:${familyId}`;

function definitionFor(constellation: FriendConstellation, kind: FriendPackKind): WispPackDefinition {
  const boost = kind === 'bright' ? BRIGHT_BOOST : 1;
  const pool = [
    ...constellation.commons.map((id) => ({ id, weight: TIER_WEIGHT.common })),
    ...constellation.rares.map((id) => ({ id, weight: TIER_WEIGHT.rare * boost })),
    { id: constellation.epic, weight: TIER_WEIGHT.epic * boost },
  ];
  const daily = kind === 'pouch' || kind === 'bright';
  const floor: WispRarity | null = kind === 'gift-rare' ? 'rare' : kind === 'finale' ? 'epic' : null;
  return {
    id: friendPackId(constellation.familyId, kind), version: 1, collectionId: `${constellation.familyId}-constellation`, scope: 'local-lantern-v1',
    name: `${FRIEND_PACK_NAMES[kind]}`, artKey: 'pack', protectionGroup: friendProtectionGroup(constellation.familyId),
    slots: daily ? 1 : 3, distinct: !daily, pool,
    // A gift always holds something new while anything is missing; a daily pouch earns that after two dry ones.
    guaranteeAfterDryPacks: daily ? FRIEND_PACK_PITY : 0,
    // The floor sits on the first card so the pity rule (always the last card) can still work beside it.
    ...(floor ? { guaranteedRarity: { slot: 0, minimum: floor } } : {}),
  };
}

export const FRIEND_PACKS: readonly WispPackDefinition[] = FRIEND_CONSTELLATIONS.flatMap((constellation) => FRIEND_PACK_KINDS.map((kind) => definitionFor(constellation, kind)));

export function friendPackDefinition(id: string, version?: number): WispPackDefinition {
  const definition = FRIEND_PACKS.find((pack) => pack.id === id && (version == null || pack.version === version));
  if (!definition) throw new Error('This pack needs a newer version of the game.');
  return definition;
}
export const friendPackFamily = (definitionId: string): string => definitionId.slice(definitionId.indexOf(':') + 1);
export const friendPackKind = (definitionId: string): FriendPackKind => definitionId.slice('friend-'.length, definitionId.indexOf(':')) as FriendPackKind;

/**
 * A friend's pack holds that friend's own pack Wisps and nothing else: never the signature, never a Wisp earned as an
 * achievement, never one without art. Broken content fails here, when the game starts, not when a player opens a pack.
 */
export function validateFriendConstellations(constellations: readonly FriendConstellation[], packs: readonly WispPackDefinition[]) {
  const families = new Set<string>();
  for (const constellation of constellations) {
    if (families.has(constellation.familyId)) throw new Error(`Two constellations for ${constellation.familyId}`);
    families.add(constellation.familyId);
    const all = friendConstellationWisps(constellation);
    if (new Set(all).size !== all.length) throw new Error(`${constellation.familyId}: a Wisp appears twice`);
    if (constellation.commons.length !== 4 || constellation.rares.length !== 3) throw new Error(`${constellation.familyId}: a constellation is four Commons, three Rares, one Epic and a signature`);
    const tiers: [readonly WispId[], WispRarity][] = [[constellation.commons, 'common'], [constellation.rares, 'rare'], [[constellation.epic], 'epic']];
    for (const [ids, rarity] of tiers) for (const id of ids) {
      const wisp = WISPS_BY_ID.get(id);
      if (!wisp || wisp.availability !== 'ready') throw new Error(`${constellation.familyId}: ${id} has no art yet, so it cannot be in a pack`);
      if (wisp.rarity !== rarity) throw new Error(`${constellation.familyId}: ${id} is ${wisp.rarity}, listed as ${rarity}`);
      if (['achievement', 'family_signature'].includes(wisp.semanticClass)) throw new Error(`${constellation.familyId}: ${id} is earned, not found in a pack`);
    }
    const signature = WISPS_BY_ID.get(constellation.signature);
    if (!signature || signature.semanticClass !== 'family_signature' || signature.primaryFamilyId !== constellation.familyId) throw new Error(`${constellation.familyId}: ${constellation.signature} is not this friend's signature`);
  }
  for (const pack of packs) {
    const constellation = constellations.find((entry) => entry.familyId === friendPackFamily(pack.id));
    if (!constellation) throw new Error(`Pack ${pack.id} has no friend`);
    const allowed = friendPackWisps(constellation);
    if (pack.pool.some((entry) => !allowed.includes(entry.id) || entry.weight <= 0)) throw new Error(`Pack ${pack.id} holds a Wisp from outside its friend's pack set`);
    if (pack.distinct && pack.pool.length < pack.slots) throw new Error(`Pack ${pack.id} cannot fill its slots`);
    const floor = pack.guaranteedRarity;
    if (floor && !pack.pool.some((entry) => WISP_RARITY[WISPS_BY_ID.get(entry.id)!.rarity].rank >= WISP_RARITY[floor.minimum].rank)) throw new Error(`Pack ${pack.id} promises a rarity it does not hold`);
  }
}
validateFriendConstellations(FRIEND_CONSTELLATIONS, FRIEND_PACKS);
