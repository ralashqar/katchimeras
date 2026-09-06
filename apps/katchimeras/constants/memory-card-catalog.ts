import type { MemoryCardRarity, OwnedMemoryCard } from '@/types/merge-world';

export type MemoryCardDefinition = {
  id: string;
  poolId: 'small-wonders';
  name: string;
  reflection: string;
  rarity: MemoryCardRarity;
};

export const MEMORY_CARD_CATALOG: readonly MemoryCardDefinition[] = [
  { id: 'rain-on-glass', poolId: 'small-wonders', name: 'Rain on Glass', reflection: 'A quiet surface can hold a whole weather system.', rarity: 'rare' },
  { id: 'first-green-shoot', poolId: 'small-wonders', name: 'First Green Shoot', reflection: 'Beginning can be almost too small to notice.', rarity: 'common' },
  { id: 'path-taken-twice', poolId: 'small-wonders', name: 'Path Taken Twice', reflection: 'Returning changes both the path and the person walking it.', rarity: 'uncommon' },
  { id: 'cup-after-rain', poolId: 'small-wonders', name: 'A Cup After Rain', reflection: 'Warmth feels different when the world is still dripping.', rarity: 'uncommon' },
  { id: 'light-through-leaves', poolId: 'small-wonders', name: 'Light Through Leaves', reflection: 'Some light only exists because something living shaped it.', rarity: 'rare' },
  { id: 'something-worth-keeping', poolId: 'small-wonders', name: 'Something Worth Keeping', reflection: 'Attention is one of the ways a moment becomes a memory.', rarity: 'rare' },
] as const;

export const MEMORY_CARDS_BY_ID = new Map(MEMORY_CARD_CATALOG.map((card) => [card.id, card]));

const RARITY_RANK: Record<MemoryCardRarity, number> = { common: 0, uncommon: 1, rare: 2 };

/** Deterministic and duplicate-protected until every eligible card is owned. */
export function selectMemoryCard(
  poolId: 'small-wonders',
  rarityFloor: MemoryCardRarity,
  seed: string,
  owned: readonly OwnedMemoryCard[],
) {
  const eligible = MEMORY_CARD_CATALOG.filter((card) => card.poolId === poolId && RARITY_RANK[card.rarity] >= RARITY_RANK[rarityFloor]);
  const ownedIds = new Set(owned.map((card) => card.cardId));
  const protectedPool = eligible.filter((card) => !ownedIds.has(card.id));
  const pool = protectedPool.length ? protectedPool : eligible;
  if (!pool.length) return null;
  return pool[stableHash(seed) % pool.length];
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
