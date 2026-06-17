import type {
  EncounterHistoryMap,
  HomeRarityTier,
  HomeScoreKey,
  HomeVisualKey,
  StoredHomeDayRecord,
} from '@/types/home';
import { buildEncounterCreature, recordEncounterHatch } from '@/utils/encounter-engine';

// "Hatch Your Past" — the onboarding aha. We run the user's reconstructed recent
// days (from day-backfill) through the live encounter engine and hand back the
// collection they already own: the unique creatures they've met, with how often
// each turned up. Pure orchestration over the engine, so it's harness-verifiable;
// the reveal UI just animates the result.

export type HatchedPastCreature = {
  profileId: string;
  name: string;
  visualKey: HomeVisualKey;
  accentColor: string;
  rarity: HomeRarityTier;
  rarityReason: string | null;
  visitCount: number;
  isoDate: string;
};

export type HatchYourPastResult = {
  creatures: HatchedPastCreature[];
  encounterHistory: EncounterHistoryMap;
  daysHatched: number;
};

const MAX_REVEAL = 6;
const rarityRank: Record<HomeRarityTier, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };

export function buildHatchYourPast(pastDays: StoredHomeDayRecord[]): HatchYourPastResult {
  // Replay oldest → newest so bond deepens the way it would have if lived.
  const ordered = [...pastDays].sort((left, right) => left.isoDate.localeCompare(right.isoDate));
  let encounterHistory: EncounterHistoryMap = {};
  const byProfile = new Map<string, HatchedPastCreature>();
  let daysHatched = 0;

  for (const day of ordered) {
    const [primary, secondary] = deriveTraits(day);
    const creature = buildEncounterCreature(day, encounterHistory, primary, secondary);
    if (!creature?.encounterProfileId) {
      continue;
    }
    daysHatched += 1;
    encounterHistory = recordEncounterHatch(encounterHistory, creature.encounterProfileId, day.isoDate);

    const existing = byProfile.get(creature.encounterProfileId);
    if (existing) {
      existing.visitCount += 1;
      existing.isoDate = day.isoDate;
      if (rarityRank[creature.rarity] > rarityRank[existing.rarity]) {
        existing.rarity = creature.rarity;
        existing.rarityReason = creature.rarityReason ?? existing.rarityReason;
      }
    } else {
      byProfile.set(creature.encounterProfileId, {
        profileId: creature.encounterProfileId,
        name: creature.name,
        visualKey: creature.visualKey,
        accentColor: creature.accentColor,
        rarity: creature.rarity,
        rarityReason: creature.rarityReason ?? null,
        visitCount: 1,
        isoDate: day.isoDate,
      });
    }
  }

  // Reveal builds to the best — keep the top six by rarity then bond, ordered so
  // the rarest / most-returned-to creature is revealed last.
  const creatures = [...byProfile.values()]
    .sort((left, right) => {
      if (rarityRank[left.rarity] !== rarityRank[right.rarity]) {
        return rarityRank[left.rarity] - rarityRank[right.rarity];
      }
      return left.visitCount - right.visitCount;
    })
    .slice(-MAX_REVEAL);

  return { creatures, encounterHistory, daysHatched };
}

function deriveTraits(day: StoredHomeDayRecord): [HomeScoreKey, HomeScoreKey] {
  if (day.stepsCount >= 7000) {
    return ['energy', 'exploration'];
  }
  if (day.newPlaceCount > 0 || day.visitedPlaceCount >= 3) {
    return ['exploration', 'energy'];
  }
  return ['calm', 'focus'];
}

// Build a minimal day record from a backfilled day (steps + photo places) plus
// any resolved place-category seeds, ready to feed buildHatchYourPast.
export function toHatchablePastDay(
  backfilled: { isoDate: string; stepsCount: number; locations: StoredHomeDayRecord['locations'] },
  placeCategorySeeds: string[]
): StoredHomeDayRecord {
  return {
    id: `past-${backfilled.isoDate}`,
    isoDate: backfilled.isoDate,
    state: 'ready_to_hatch',
    stepsCount: backfilled.stepsCount,
    visitedPlaceCount: 0,
    newPlaceCount: 0,
    locationSampleCount: backfilled.locations.length,
    shareReadyAt: null,
    moments: [],
    locations: backfilled.locations,
    healthRouteImport: null,
    exactRouteSegments: [],
    selectedPathId: null,
    promptAnswers: [],
    heroPhoto: null,
    creature: null,
    placeCategorySeeds,
  };
}
