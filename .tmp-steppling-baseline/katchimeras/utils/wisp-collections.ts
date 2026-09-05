import type { WispCollectionState, WispId } from '@/types/wisp';
import type { WispCollectionDefinition, WispCollectionProgress, WispEvolutionTier } from '@/types/wisp-collections';

export const WISP_EVOLUTION_THRESHOLDS: Readonly<Record<WispEvolutionTier, number>> = {
  common: 1,
  uncommon: 3,
  rare: 7,
  epic: 15,
  radiant: 30,
};

export function wispEvolutionTier(quantity: number): WispEvolutionTier {
  if (quantity >= WISP_EVOLUTION_THRESHOLDS.radiant) return 'radiant';
  if (quantity >= WISP_EVOLUTION_THRESHOLDS.epic) return 'epic';
  if (quantity >= WISP_EVOLUTION_THRESHOLDS.rare) return 'rare';
  if (quantity >= WISP_EVOLUTION_THRESHOLDS.uncommon) return 'uncommon';
  return 'common';
}

export function nextWispEvolution(quantity: number): { tier: WispEvolutionTier; remaining: number } | null {
  const next = (Object.entries(WISP_EVOLUTION_THRESHOLDS) as [WispEvolutionTier, number][])
    .find(([, threshold]) => quantity < threshold);
  return next ? { tier: next[0], remaining: next[1] - quantity } : null;
}

export function wispCollectionProgress(definition: WispCollectionDefinition, state: WispCollectionState): WispCollectionProgress {
  const quantities = definition.wispIds.map((id) => state.inventory[id]?.quantity ?? 0);
  const owned = quantities.filter((quantity) => quantity > 0).length;
  return {
    owned,
    total: definition.wispIds.length,
    complete: owned === definition.wispIds.length,
    evolved: quantities.filter((quantity) => wispEvolutionTier(quantity) !== 'common').length,
  };
}

export function wispQuantity(state: WispCollectionState, id: WispId): number {
  return state.inventory[id]?.quantity ?? 0;
}
