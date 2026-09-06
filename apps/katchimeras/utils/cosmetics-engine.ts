import type { CosmeticDef, CosmeticState, CosmeticType } from '@/types/cosmetics';
import { COSMETIC_CATALOG } from '@/utils/cosmetics-catalog';
import { resolveSkin } from '@/utils/cosmetics-skin';

// Pure cosmetics resolution. OWNERSHIP is derived from the def's fields: a default
// is always owned; a purchased id (in the Essence receipt) is owned; a
// discovery-gated cosmetic is owned once its Discovery is unlocked; an unbought
// purchasable is not owned. Selection falls back to the type's default when unset or
// no longer owned. No side effects. See progression-customisation-design §5.

export function isCosmeticOwned(
  def: CosmeticDef,
  unlockedDiscoveryIds: Set<string>,
  purchases: string[]
): boolean {
  if (def.isDefault) return true;
  if (purchases.includes(def.id)) return true;
  if (def.unlockDiscoveryId) return unlockedDiscoveryIds.has(def.unlockDiscoveryId);
  if (def.essenceCost != null) return false; // purchasable, not yet bought
  return true; // free, ungated
}

export function canAfford(def: CosmeticDef, balance: number): boolean {
  return (def.essenceCost ?? 0) <= balance;
}

// A purchasable cosmetic the user hasn't bought yet (presentation hint for the shop).
export function isBuyable(def: CosmeticDef, purchases: string[]): boolean {
  return def.essenceCost != null && !def.isDefault && !purchases.includes(def.id);
}

export function ownedCosmetics(
  unlockedDiscoveryIds: Set<string>,
  purchases: string[],
  catalog: CosmeticDef[] = COSMETIC_CATALOG
): CosmeticDef[] {
  return catalog.filter((def) => isCosmeticOwned(def, unlockedDiscoveryIds, purchases));
}

function defaultForType(type: CosmeticType, catalog: CosmeticDef[]): CosmeticDef | null {
  const ofType = catalog.filter((def) => def.type === type);
  return ofType.find((def) => def.isDefault) ?? ofType[0] ?? null;
}

// The effective cosmetic for a type: the user's selection if set AND owned, else the
// type's default.
export function selectedCosmetic(
  state: CosmeticState,
  type: CosmeticType,
  unlockedDiscoveryIds: Set<string>,
  purchases: string[],
  catalog: CosmeticDef[] = COSMETIC_CATALOG
): CosmeticDef | null {
  const selectedId = state.selected[type];
  if (selectedId) {
    const chosen = catalog.find((def) => def.id === selectedId && def.type === type);
    if (chosen && isCosmeticOwned(chosen, unlockedDiscoveryIds, purchases)) return chosen;
  }
  return defaultForType(type, catalog);
}

// The active world theme's accent tint (undefined = the natural/default theme).
export function activeWorldThemeValue(
  state: CosmeticState,
  unlockedDiscoveryIds: Set<string>,
  purchases: string[],
  catalog: CosmeticDef[] = COSMETIC_CATALOG
): string | undefined {
  return selectedCosmetic(state, 'worldTheme', unlockedDiscoveryIds, purchases, catalog)?.value;
}

// The egg's lantern glow tint, LAYERED: an explicit lantern choice wins; otherwise
// the active world theme tints it; otherwise natural (undefined). Demonstrates the
// resolveSkin precedence (override → theme → default).
export function lanternColourValue(
  state: CosmeticState,
  unlockedDiscoveryIds: Set<string>,
  purchases: string[],
  catalog: CosmeticDef[] = COSMETIC_CATALOG
): string | undefined {
  return resolveSkin({
    override: selectedCosmetic(state, 'lanternColour', unlockedDiscoveryIds, purchases, catalog)?.value,
    theme: activeWorldThemeValue(state, unlockedDiscoveryIds, purchases, catalog),
    fallback: undefined,
  });
}
