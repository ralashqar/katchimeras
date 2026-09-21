import { WISP_RARITY } from '@/constants/wisp-rarity';
import { wispDefinition } from '@/constants/wisps';
import type { WispId } from '@/types/wisp';
import type { WispPackDefinition } from '@/types/wisp-lantern';

export function wispRandom(seed: number) {
  let value = seed >>> 0;
  return () => { value += 0x6D2B79F5; let t = Math.imul(value ^ value >>> 15, 1 | value); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export type WispPackRoll = { id: WispId; discovered: boolean }[];

/**
 * What a pack holds, from its definition, its stored seed and what the player owns at the moment it is opened. One
 * algorithm for every kind of pack (the Lantern's visitors, a friend's pouch): weighted slots, no repeats when the
 * pack is `distinct`, a rarity floor on one slot, and the pity rule (after enough packs with nothing new, the last
 * slot is drawn from the missing cards). `onDiscover` is called as each new card is drawn, so a later slot in the
 * same pack sees it as owned.
 */
export function rollWispPack(definition: WispPackDefinition, seed: number, owned: (id: WispId) => boolean, dryPacks: number, onDiscover: (id: WispId, slot: number) => void): WispPackRoll {
  const random = wispRandom(seed);
  const selected = new Set<WispId>();
  const roll: WispPackRoll = [];
  let discovered = false;
  for (let slot = 0; slot < definition.slots; slot++) {
    const eligible = definition.pool.filter(entry => (!definition.distinct || !selected.has(entry.id)) &&
      (definition.guaranteedRarity?.slot !== slot || WISP_RARITY[wispDefinition(entry.id).rarity].rank >= WISP_RARITY[definition.guaranteedRarity.minimum].rank));
    const missing = eligible.filter(entry => !owned(entry.id));
    const guarantee: boolean = slot === definition.slots - 1 && !discovered && missing.length > 0
      && definition.guaranteeAfterDryPacks != null && dryPacks >= definition.guaranteeAfterDryPacks;
    const pool: { id: WispId; weight: number }[] = guarantee ? missing.map(entry => ({ ...entry, weight: 1 })) : eligible;
    let pick = random() * pool.reduce((sum, entry) => sum + entry.weight, 0);
    const chosen = pool.find(entry => (pick -= entry.weight) < 0) ?? pool[pool.length - 1];
    if (!chosen) throw new Error('This pouch has no eligible visitors.');
    selected.add(chosen.id);
    const isNew = !owned(chosen.id);
    if (isNew) onDiscover(chosen.id, slot);
    discovered ||= isNew;
    roll.push({ id: chosen.id, discovered: isNew });
  }
  return roll;
}
