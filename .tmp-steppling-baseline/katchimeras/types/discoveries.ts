// Discoveries System — life-milestone progression + world artefacts.
// See docs/discoveries-system-design.md. Phase 0 = pure types + catalog + engine.
//
// A Discovery is split in two: a STATIC def (the catalog, in code) and a PERSISTED
// record (what actually unlocked, in app-storage). Rules read only a derived
// DiscoveryContext so user data never stores names/descriptions/rules.

export type DiscoveryCategory =
  | 'exploration'
  | 'memory'
  | 'life'
  | 'journey'
  | 'reflection'
  | 'world';

export type DiscoveryRarity = 'common' | 'rare' | 'epic' | 'legendary';

// Lifetime aggregates folded from every HomeDayRecord (+ optional native health).
// Optional fields are absent until their data source lands; defs that read them
// simply never fire until then.
export type DiscoveryContext = {
  now: Date;
  dayCount: number;
  // Exploration
  uniquePlaceCount: number; // total confirmed places (v1 proxy — see context builder)
  placeCategoryCounts: Record<string, number>; // 'museum' → 3, 'cafe' → 11, …
  countryCount?: number; // needs reverse-geocode (deferred)
  // Memory
  photoCount: number;
  photoDayCount: number;
  distinctPhotoQualityCount: number;
  meaningfulMomentCount: number;
  voiceMemoryCount: number;
  foodMemoryCount: number;
  studioMemoryCount: number;
  // Life
  bigMomentCount: number;
  achievementMomentCount: number;
  bigMomentTypes: Set<string>;
  // Journey
  maxStepsInADay: number;
  walkingStreak: number; // longest run of consecutive walking days
  totalDistanceMeters?: number; // needs a HealthKit aggregate (deferred)
  // Reflection
  reflectionCount: number;
  calmDayCount: number;
  // World
  finalisedPatchCount: number;
  legendaryPatchCount: number;
};

// A static catalog entry: pure data + a pure predicate over the context.
export type DiscoveryDef = {
  id: string;
  category: DiscoveryCategory;
  name: string;
  description: string;
  rarity: DiscoveryRarity;
  hidden: boolean; // silhouette in the Hall until unlocked
  icon: string; // emoji or asset key (Hall + share card)
  worldRewardId?: string; // a permanent world artefact (Phase 3 art)
  cosmeticUnlockIds?: string[]; // tile/vault/trail/lantern skins (Phase 4)
  // Essence granted on unlock. Optional — defaults to a per-rarity amount in the
  // essence engine. See docs/progression-customisation-design.md §3.2.
  essenceReward?: number;
  // MUST be monotonic: once true for a given history it stays true (a Discovery
  // never un-unlocks). No side effects, no Date.now() — read ctx.now if needed.
  test: (ctx: DiscoveryContext) => boolean;
};

// A persisted unlock record (stamped by the hook, not the engine).
export type DiscoveryRecord = {
  id: string;
  unlockedAt: number; // epoch ms
  sourcePatchId?: string;
  sourceMomentIds: string[];
  seenAnimation: boolean; // has the "Discovery Recorded" celebration shown
};

export type DiscoveryState = {
  version: 1;
  catalogVersion?: number;
  unlocked: Record<string, DiscoveryRecord>; // id → record
  // True once the FIRST evaluation has run on this install. That first pass
  // silently backfills everything already earned (seenAnimation:true, one quiet
  // summary); only unlocks AFTER baseline celebrate. Prevents a retro-barrage.
  baselined?: boolean;
};
