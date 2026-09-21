import { FRIEND_PACK_KINDS, friendConstellation, friendConstellationWisps, friendPackDefinition, friendPackFamily, friendPackId, friendPackKind, type FriendPackKind } from '@/constants/friend-wisp-constellations';
import type { WispCollectionState, WispId } from '@/types/wisp';
import type { WispPackInstance } from '@/types/wisp-lantern';
import { rollWispPack } from '@/utils/wisp-pack-roll';

/**
 * Friends' packs: their own small ledger beside the Lantern's. They share the pack roll and the pack shape, so the
 * same reveal opens both, but nothing else: a friend's pack needs no Lantern, pays no Echoes, and a duplicate is
 * simply another copy of that Wisp (copies are what a Wisp's growth tiers count).
 */
export type FriendWispPackState = {
  version: 1;
  packs: Record<string, WispPackInstance>;
  /** Packs in a row with nothing new, per friend. */
  dryPacks: Record<string, number>;
  /** Set rewards already taken: `<family>:commons`, `<family>:rares`, `<family>:all`. */
  claims: string[];
  /** The Wisp each friend carries at their shoulder: one of their own constellation that the player owns. */
  equipped?: Record<string, WispId>;
};

export const emptyFriendWispPacks = (): FriendWispPackState => ({ version: 1, packs: {}, dryPacks: {}, claims: [], equipped: {} });

export function normalizeFriendWispPacks(raw: unknown): FriendWispPackState {
  if (!raw || typeof raw !== 'object') return emptyFriendWispPacks();
  const value = raw as Partial<FriendWispPackState>;
  const packs: FriendWispPackState['packs'] = {};
  for (const [id, pack] of Object.entries(value.packs ?? {})) {
    // A pack this build cannot read (a friend or kind added later, then rolled back) is kept out, not thrown on:
    // the collection must still load.
    try { friendPackDefinition(pack.definitionId, pack.definitionVersion); } catch { continue; }
    if (!pack || pack.id !== id || !Number.isSafeInteger(pack.seed) || !Number.isFinite(pack.grantedAt)) continue;
    packs[id] = { ...pack, revealed: Number.isInteger(pack.revealed) && pack.revealed >= 0 ? pack.revealed : 0 };
  }
  const dryPacks = Object.fromEntries(Object.entries(value.dryPacks ?? {}).filter(([, count]) => Number.isSafeInteger(count) && count >= 0));
  // A carried Wisp must still be one of that friend's own: a set that changed sheds what no longer belongs.
  const equipped = Object.fromEntries(Object.entries(value.equipped ?? {}).filter(([familyId, id]) => {
    const constellation = friendConstellation(familyId);
    return Boolean(constellation && friendConstellationWisps(constellation).includes(id));
  }));
  return { version: 1, packs, dryPacks, equipped, claims: Array.isArray(value.claims) ? value.claims.filter((claim): claim is string => typeof claim === 'string') : [] };
}

export type FriendWispPackCommand =
  | { type: 'grant'; receiptId: string; familyId: string; kind: FriendPackKind; seed: number }
  /** A day's pouch that has not been opened yet becomes a Bright Pouch when the day earns it. */
  | { type: 'brighten'; receiptId: string }
  | { type: 'open'; packId: string }
  | { type: 'acknowledge_reveal'; packId: string; revealed: number }
  | { type: 'claim_set'; familyId: string; set: FriendSetId }
  /** `wispId: null` sends the carried Wisp home. */
  | { type: 'equip'; familyId: string; wispId: WispId | null };

export type FriendSetId = 'commons' | 'rares' | 'all';
export const FRIEND_SETS: readonly FriendSetId[] = ['commons', 'rares', 'all'];

export function friendSetWisps(familyId: string, set: FriendSetId): readonly WispId[] {
  const constellation = friendConstellation(familyId);
  if (!constellation) return [];
  return set === 'commons' ? constellation.commons : set === 'rares' ? [...constellation.commons, ...constellation.rares] : friendConstellationWisps(constellation);
}

function addCopy(state: WispCollectionState, id: WispId, receiptId: string, now: number) {
  const held = state.inventory[id];
  state.inventory[id] = held
    ? { ...held, quantity: held.quantity + 1, giftableQuantity: Math.max(held.giftableQuantity, held.quantity) }
    : { wispId: id, quantity: 1, sources: ['friend_pack'], firstGrantedAt: now, giftableQuantity: 0 };
  // The pack's own reveal shows the card, so the separate "new Wisp" reveal is not queued behind it.
  state.unlocked[id] ??= { wispId: id, unlockedAt: now, sourceDayId: null, seenReveal: true };
  state.appliedGrantReceiptIds = [...(state.appliedGrantReceiptIds ?? []), receiptId];
}

export function reduceFriendWispPacks(input: WispCollectionState, command: FriendWispPackCommand, now: number, externallyOwned: readonly WispId[] = []): WispCollectionState {
  if (!Number.isFinite(now)) throw new Error('Invalid Wisp command time');
  const state = structuredClone(input);
  const friends = state.friendPacks = normalizeFriendWispPacks(state.friendPacks);
  const owned = (id: WispId) => (state.inventory[id]?.quantity ?? 0) > 0 || externallyOwned.includes(id);
  switch (command.type) {
    case 'grant': {
      if (!command.receiptId || Object.hasOwn(Object.prototype, command.receiptId) || !Number.isSafeInteger(command.seed)) throw new Error('Invalid pack receipt.');
      if (friends.packs[command.receiptId]) return input;
      if (!FRIEND_PACK_KINDS.includes(command.kind)) throw new Error('Unknown kind of pack.');
      const definition = friendPackDefinition(friendPackId(command.familyId, command.kind));
      friends.packs[command.receiptId] = { id: command.receiptId, definitionId: definition.id, definitionVersion: definition.version, scope: 'local-lantern-v1', seed: command.seed, grantedAt: now, revealed: 0 };
      return state;
    }
    case 'brighten': {
      const pack = friends.packs[command.receiptId];
      if (!pack || pack.openedAt != null || friendPackKind(pack.definitionId) !== 'pouch') return input;
      const bright = friendPackDefinition(friendPackId(friendPackFamily(pack.definitionId), 'bright'));
      friends.packs[pack.id] = { ...pack, definitionId: bright.id, definitionVersion: bright.version };
      return state;
    }
    case 'open': {
      const pack = friends.packs[command.packId];
      if (!pack) throw new Error('Pack unavailable.');
      if (pack.openedAt != null) return input;
      const definition = friendPackDefinition(pack.definitionId, pack.definitionVersion);
      const familyId = friendPackFamily(pack.definitionId);
      const dry = friends.dryPacks[familyId] ?? 0;
      // A card found earlier in this same pack is owned for the cards after it.
      const found = new Set<WispId>();
      const roll = rollWispPack(definition, pack.seed, (id) => owned(id) || found.has(id), dry, (id) => { found.add(id); });
      roll.forEach((card, slot) => addCopy(state, card.id, `${pack.id}:slot:${slot}`, now));
      pack.outcomes = roll.map((card) => ({ ...card, echoes: 0 }));
      pack.openedAt = now;
      friends.dryPacks[familyId] = roll.some((card) => card.discovered) || definition.pool.every((entry) => owned(entry.id)) ? 0 : dry + 1;
      return state;
    }
    case 'acknowledge_reveal': {
      const pack = friends.packs[command.packId];
      if (!pack?.outcomes) throw new Error('Open the pack first.');
      if (!Number.isInteger(command.revealed) || command.revealed < 0) throw new Error('Invalid reveal position.');
      pack.revealed = Math.max(pack.revealed, Math.min(pack.outcomes.length, command.revealed));
      return state;
    }
    case 'equip': {
      const constellation = friendConstellation(command.familyId);
      if (!constellation) throw new Error('This friend has no Wisps of their own yet.');
      const carried = { ...friends.equipped };
      if ((carried[command.familyId] ?? null) === command.wispId) return input;
      if (command.wispId == null) delete carried[command.familyId];
      else {
        if (!friendConstellationWisps(constellation).includes(command.wispId)) throw new Error('That Wisp belongs with someone else.');
        if (!owned(command.wispId)) throw new Error('Find this Wisp first.');
        carried[command.familyId] = command.wispId;
      }
      friends.equipped = carried;
      return state;
    }
    case 'claim_set': {
      const claim = `${command.familyId}:${command.set}`;
      if (friends.claims.includes(claim)) return input;
      const wisps = friendSetWisps(command.familyId, command.set);
      if (!wisps.length || !wisps.every(owned)) throw new Error('Complete this set first.');
      friends.claims.push(claim);
      return state;
    }
  }
}

/** A friend's unopened packs, oldest first. */
export function friendPacksWaiting(state: Pick<WispCollectionState, 'friendPacks'>, familyId: string): WispPackInstance[] {
  return Object.values(state.friendPacks?.packs ?? {})
    .filter((pack) => pack.openedAt == null && friendPackFamily(pack.definitionId) === familyId)
    .sort((a, b) => a.grantedAt - b.grantedAt);
}

export function friendCollectionProgress(state: Pick<WispCollectionState, 'inventory'>, familyId: string, externallyOwned: readonly WispId[] = []) {
  const constellation = friendConstellation(familyId);
  if (!constellation) return null;
  const all = friendConstellationWisps(constellation);
  const owned = all.filter((id) => (state.inventory[id]?.quantity ?? 0) > 0 || externallyOwned.includes(id));
  return { owned: owned.length, total: all.length, ownedIds: owned, signatureOwned: owned.includes(constellation.signature) };
}

/** The Wisp a friend carries at their shoulder, if any. */
export function friendEquippedWisp(state: Pick<WispCollectionState, 'friendPacks'>, familyId: string): WispId | null {
  return state.friendPacks?.equipped?.[familyId] ?? null;
}

/** Whether a friend's completed constellation is paying its perk. */
export function friendPerkActive(state: Pick<WispCollectionState, 'friendPacks'>, familyId: string) {
  return Boolean(state.friendPacks?.claims.includes(`${familyId}:all`));
}
