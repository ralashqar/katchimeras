export const WISP_IDS = [
  'sunbeam', 'sprout', 'steam', 'flash', 'drizzle', 'moonlit', 'page', 'wander', 'heartlet', 'sunset',
  'bloom', 'pixel', 'buddy', 'crumb', 'dream', 'relic', 'spark', 'puddle', 'aurora', 'breeze',
  'focus', 'giggle', 'orbit', 'flame', 'shore', 'fern', 'shelf', 'feast', 'flicker', 'pulse',
  'platform', 'spire', 'market', 'nest', 'stride', 'rush', 'wheel', 'ripple', 'sizzle', 'sketch',
  'note', 'whisker', 'flurry', 'dawn', 'starlit', 'comet', 'chronicle', 'explorer', 'confetti', 'recall',
] as const;

export type WispId = (typeof WISP_IDS)[number];
export type WispCategory = 'place' | 'activity' | 'experience' | 'pattern' | 'achievement';
export type WispAcquisition = 'experience' | 'achievement' | 'game' | 'social' | 'shop' | 'seasonal' | 'premium';
export type WispRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type WispConfidence = 'explicit' | 'confirmed' | 'inferred';

export type WispRuleDefinition = {
  id: string;
  target: number;
  unit: string;
  params?: Record<string, string | number | string[]>;
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

export type WispCollectionState = {
  version: 1;
  equippedWispId: WispId | null;
  unlocked: Partial<Record<WispId, WispUnlockRecord>>;
  baselinedCatalogVersion: number;
};

export type WispProgress = {
  current: number;
  target: number;
  unit: string;
};
