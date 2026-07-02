import type { BigMomentType, HomeRarityTier, HomeVisualKey } from '@/types/home';

// The Kingdom — the persistent world the user's whole life builds, replacing
// the per-day WorldPatch as the long-term unit. Derived (never authored) state:
// deriveKingdom() folds every day ever lived into building levels, the creature
// roster, and Legacy Landmarks, so it can always be rebuilt from the day
// archive alone (existing users get a full Kingdom on first open).

export type KingdomBuildingId =
  | 'home'          // 🏠 what is today's story?
  | 'memoryLibrary' // 📦 what do I want to remember?
  | 'crossroads'    // 🗺 where did I go?
  | 'journeyHall'   // 🛤 how did I move through life?
  | 'sanctuary'     // 🌿 how did life feel?
  | 'study'         // 📚 what inspired me?
  | 'foodPavilion'; // 🍽 what did I savour?

export type KingdomBuildingLevel = 0 | 1 | 2 | 3 | 4;

export type KingdomBuilding = {
  id: KingdomBuildingId;
  label: string;
  // The one human question this building answers.
  question: string;
  emoji: string;
  level: KingdomBuildingLevel;
  // The lifetime count backing the level (steps for Journey Hall, memories for
  // the Library, …).
  count: number;
  countLabel: string;
  // Count needed for the next level; null once the building is maxed.
  nextLevelAt: number | null;
};

// A hatched day's creature, now living in the Kingdom.
export type KingdomCreature = {
  dayId: string;
  isoDate: string;
  creatureId: string;
  name: string;
  visualKey: HomeVisualKey;
  rarity: HomeRarityTier;
  accentColor: string;
};

// A Legacy Landmark — a Big Moment turned permanent monument.
export type KingdomLandmark = {
  id: string;
  type: BigMomentType;
  label: string;
  subject: string | null;
  dayId: string;
  isoDate: string;
};

export type KingdomTotals = {
  daysLived: number;
  daysHatched: number;
  memories: number; // photos + notes + captured meanings
  photos: number;
  notes: number;
  places: number;
  steps: number;
  reflections: number;
  foodMoments: number;
  studioMoments: number;
  bigMoments: number;
};

export type KingdomState = {
  version: 1;
  builtFromDayCount: number;
  buildings: KingdomBuilding[];
  // Newest hatch first.
  creatures: KingdomCreature[];
  // Chronological.
  landmarks: KingdomLandmark[];
  totals: KingdomTotals;
};
