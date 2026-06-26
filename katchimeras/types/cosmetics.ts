// Cosmetics — expression unlocked by Discoveries. STRICTLY cosmetic: never affects
// hatch odds, scores, rarity, or any progression. See discoveries-system-design §9.
// v1 ships lantern colours (the egg's glow); the registry is typed for more types
// (tile skins, trail styles, particles…) which follow the exact same pattern.

export type CosmeticType = 'lanternColour' | 'tileSkin' | 'trailStyle' | 'particle' | 'worldTheme';

export type CosmeticRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type CosmeticUnlockMethod = 'essencePurchase' | 'discoveryUnlock' | 'seasonal' | 'premium';

export type CosmeticDef = {
  id: string;
  type: CosmeticType;
  name: string;
  description: string;
  swatch: string; // representative colour shown in the picker
  value?: string; // the applied value (e.g. hex for a lantern colour); absent = "natural"
  isDefault?: boolean; // the fallback selection for its type (always owned, free)
  // How it's obtained (UI presentation). Ownership is derived from the fields:
  // isDefault → free; unlockDiscoveryId → unlocked with that Discovery; essenceCost
  // → bought with Essence (in the purchase receipt). See cosmetics-engine.
  unlockMethod?: CosmeticUnlockMethod;
  unlockDiscoveryId?: string; // discoveryUnlock
  essenceCost?: number; // essencePurchase
  rarity?: CosmeticRarity;
  seasonalTag?: string;
};

export type CosmeticState = {
  version: 1;
  selected: Partial<Record<CosmeticType, string>>; // type → chosen cosmetic id
};
