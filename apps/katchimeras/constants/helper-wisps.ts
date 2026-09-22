import { FRIEND_CONSTELLATIONS } from '@/constants/friend-wisp-constellations';
import { WISP_CATALOG } from '@/constants/wisps';
import type { WispId, WispRarity } from '@/types/wisp';

/**
 * A helper Wisp brought into the Mist: one light modifier, by the Wisp's
 * rarity, with a friend's signature Wisp paying in Glow instead. No
 * equipment, no stats: a common gives a step of Resolve, a rare a charge, an
 * epic holds the Dark Wisps off for a few actions, a legendary two steps.
 */
export type EncounterPerk =
  | { kind: 'resolve'; amount: number }
  | { kind: 'charges'; amount: number }
  | { kind: 'reveal'; cells: number }
  | { kind: 'delay'; actions: number }
  | { kind: 'glow'; fraction: number };

export const PERK_BY_RARITY: Readonly<Record<WispRarity, EncounterPerk>> = {
  common: { kind: 'resolve', amount: 1 },
  rare: { kind: 'charges', amount: 1 },
  epic: { kind: 'delay', actions: 2 },
  legendary: { kind: 'resolve', amount: 2 },
};

export const SIGNATURE_PERK: EncounterPerk = { kind: 'glow', fraction: 0.1 };

const rarityById = new Map<string, WispRarity>(WISP_CATALOG.map((wisp) => [wisp.id, wisp.rarity]));
const signatures = new Set<string>(FRIEND_CONSTELLATIONS.map((constellation) => constellation.signature));

export function wispPerk(wispId: WispId | string | null | undefined): EncounterPerk | null {
  if (!wispId) return null;
  if (signatures.has(wispId)) return SIGNATURE_PERK;
  const rarity = rarityById.get(wispId);
  return rarity ? PERK_BY_RARITY[rarity] : null;
}

/** How the perk reads on the loadout row. */
export function perkLabel(perk: EncounterPerk): string {
  switch (perk.kind) {
    case 'resolve': return `+${perk.amount} Resolve`;
    case 'charges': return `+${perk.amount} spawner charge${perk.amount === 1 ? '' : 's'}`;
    case 'reveal': return `${perk.cells} Mist cell${perk.cells === 1 ? '' : 's'} revealed`;
    case 'delay': return `Dark Wisps wait ${perk.actions} moves`;
    case 'glow': return `+${Math.round(perk.fraction * 100)}% Glow`;
  }
}
