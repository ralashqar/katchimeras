import { useMemo, useState } from 'react';

import type { CosmeticDef, CosmeticType } from '@/types/cosmetics';
import { COSMETIC_CATALOG } from '@/utils/cosmetics-catalog';
import {
  activeWorldThemeValue,
  canAfford,
  isBuyable,
  isCosmeticOwned,
  lanternColourValue,
  selectedCosmetic,
} from '@/utils/cosmetics-engine';
import { loadCosmeticState, saveCosmeticState, setCosmeticSelection } from '@/utils/cosmetics-storage';

export type CosmeticEntry = {
  def: CosmeticDef;
  owned: boolean;
  selected: boolean;
  buyable: boolean; // a purchasable the user hasn't bought
  affordable: boolean; // balance covers the cost
};

// Cosmetics hook. Takes the unlock currency (unlocked Discovery ids), the Essence
// purchase receipt, and the current balance; manages the user's selections. The
// only rendered output is `lanternColour` (the egg glow tint; undefined = natural).
export function useCosmetics(unlockedDiscoveryIds: Set<string>, purchases: string[], balance: number) {
  const [state, setState] = useState(() => loadCosmeticState());

  const entries = useMemo<CosmeticEntry[]>(() => {
    return COSMETIC_CATALOG.map((def) => {
      const owned = isCosmeticOwned(def, unlockedDiscoveryIds, purchases);
      const active = selectedCosmetic(state, def.type, unlockedDiscoveryIds, purchases);
      return {
        def,
        owned,
        selected: active?.id === def.id,
        buyable: isBuyable(def, purchases),
        affordable: canAfford(def, balance),
      };
    });
  }, [state, unlockedDiscoveryIds, purchases, balance]);

  const lanternColour = useMemo(
    () => lanternColourValue(state, unlockedDiscoveryIds, purchases),
    [state, unlockedDiscoveryIds, purchases]
  );
  // The active world theme's accent (an ambient wash over the world); undefined = natural.
  const worldThemeAccent = useMemo(
    () => activeWorldThemeValue(state, unlockedDiscoveryIds, purchases),
    [state, unlockedDiscoveryIds, purchases]
  );

  const select = (type: CosmeticType, id: string) =>
    setState((prev) => {
      const next = setCosmeticSelection(prev, type, id);
      saveCosmeticState(next);
      return next;
    });

  const ownedCount = useMemo(() => entries.filter((entry) => entry.owned).length, [entries]);

  return { entries, lanternColour, worldThemeAccent, select, ownedCount, totalCount: COSMETIC_CATALOG.length };
}
