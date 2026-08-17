import { WISP_IDS } from '@/constants/wisp-ids.generated';

export { WISP_IDS } from '@/constants/wisp-ids.generated';

export type WispId = (typeof WISP_IDS)[number];
export type WispCategory = 'place' | 'activity' | 'experience' | 'pattern' | 'achievement';
export type WispAcquisition = 'experience' | 'achievement' | 'game' | 'social' | 'shop' | 'seasonal' | 'premium';
export type WispRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type WispConfidence = 'explicit' | 'confirmed' | 'inferred';
export type WispSemanticClass = 'experience' | 'achievement' | 'family_signature' | 'cosmetic' | 'seasonal' | 'social' | 'game_reward';
export type WispGiftPolicy = 'not_giftable' | 'duplicate_only';
export type WispDuplicatePolicy = 'convert' | 'convert_or_gift';

export type WispRuleDefinition = {
  id: string;
  target: number;
  unit: string;
  params?: Record<string, string | number | string[] | unknown[]>;
};

export type WispCatalogItem = {
  id: WispId;
  name: string;
  subtitle: string;
  description: string;
  category: WispCategory;
  acquisition: WispAcquisition;
  rarity: WispRarity;
  hidden: boolean;
  featureFamily: string;
  personality: 'curious' | 'calm' | 'sleepy' | 'energetic' | 'affectionate';
  visualSummary: string;
  palette: string[];
  dayRule: WispRuleDefinition | null;
  unlockRule: WispRuleDefinition | null;
  availability: 'planned' | 'ready';
  sortOrder: number;
  version: number;
  semanticClass: WispSemanticClass;
  primaryAcquisition: WispAcquisition;
  primaryFamilyId: string | null;
  affinityFamilyIds: string[];
  seriesId: string | null;
  giftPolicy: WispGiftPolicy;
  duplicatePolicy: WispDuplicatePolicy;
  assetRefs: { art: string; runtime: string; thumbnail: string } | null;
};

export type WispDayCandidate = {
  wispId: WispId;
  score: number;
  confidence: WispConfidence;
  evidence: string[];
};

export type FeaturedWisp = WispDayCandidate;

export type WispUnlockRecord = {
  wispId: WispId;
  unlockedAt: number;
  sourceDayId: string | null;
  seenReveal: boolean;
};

export type WispGrantSource = 'experience' | 'achievement' | 'family_achievement' | 'essence_shop' | 'visitor' | 'plus_claim' | 'purchase' | 'season' | 'game' | 'social' | 'gift' | 'migration';

export type WispInventoryRecord = {
  wispId: WispId;
  quantity: number;
  sources: WispGrantSource[];
  firstGrantedAt: number;
  giftableQuantity: number;
};

export type WispCollectionState = {
  version: 2;
  equippedWispId: WispId | null;
  unlocked: Partial<Record<WispId, WispUnlockRecord>>;
  inventory: Partial<Record<WispId, WispInventoryRecord>>;
  baselinedCatalogVersion: number;
  /** Stable cross-system receipts, used by Merge World and future reward sources. */
  appliedGrantReceiptIds?: string[];
  /** Daily encounters only. Shop, gifting and achievement ownership do not grow Resonance. */
  resonanceCounts?: Partial<Record<WispId, number>>;
  pendingResonance?: { wispId: WispId; previousCount: number; nextCount: number } | null;
};

export type WispProgress = {
  current: number;
  target: number;
  unit: string;
};
