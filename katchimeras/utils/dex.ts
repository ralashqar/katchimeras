import { encounterLiveCast } from '@/constants/encounter-cast';
import { katchimeraEncounterProfiles } from '@/constants/katchimera-encounter-profiles';
import type {
  EncounterHistoryMap,
  HomeRarityTier,
  HomeVisualKey,
  StoredHomeDayRecord,
} from '@/types/home';
import { resolveBondStage, type BondStage } from '@/utils/bond';

// The Dex: the full live cast as a collection, blending the static catalog with
// the player's encounter history and hatched days. Locked species show as
// silhouettes; met ones carry their highest rarity seen and bond depth. Pure —
// derived entirely from the stored state, so it is harness-verifiable.

export type SpeciesCategory = 'place' | 'subject' | 'activity' | 'landmark' | 'season';

export type DexEntry = {
  speciesId: string;
  name: string;
  visualKey: HomeVisualKey;
  category: SpeciesCategory;
  locked: boolean;
  totalHatches: number;
  bondStage: BondStage;
  bondVisitCount: number;
  highestRaritySeen: HomeRarityTier | null;
  firstHatchedDate: string | null;
  lastSeenDate: string | null;
};

export type DexCategorySummary = {
  category: SpeciesCategory;
  total: number;
  collected: number;
};

export type Dex = {
  entries: DexEntry[];
  categories: DexCategorySummary[];
  collected: number;
  total: number;
};

const RARITY_RANK: Record<HomeRarityTier, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };
const CATEGORY_ORDER: SpeciesCategory[] = ['place', 'subject', 'activity', 'landmark', 'season'];
const SEASONAL_SEEDS = new Set(['spring_blossom', 'first_snow', 'autumn_day', 'rain_day']);

const profileNameById = new Map(katchimeraEncounterProfiles.map((profile) => [profile.id, profile.name]));

type SeenAggregate = {
  highestRarity: HomeRarityTier | null;
  firstHatchedDate: string | null;
  lastSeenDate: string | null;
};

export function buildDex(history: EncounterHistoryMap, hatchedDays: StoredHomeDayRecord[]): Dex {
  const seen = aggregateSeen(hatchedDays);

  const entries: DexEntry[] = encounterLiveCast.map((castEntry) => {
    const historyEntry = history[castEntry.profileId];
    const totalHatches = historyEntry?.count ?? 0;
    const aggregate = seen.get(castEntry.profileId);
    return {
      speciesId: castEntry.profileId,
      name: profileNameById.get(castEntry.profileId) ?? humanizeProfileId(castEntry.profileId),
      visualKey: castEntry.visualKey,
      category: resolveCategory(castEntry.profileId, castEntry.seedId),
      locked: totalHatches === 0,
      totalHatches,
      bondStage: resolveBondStage(totalHatches),
      bondVisitCount: totalHatches,
      highestRaritySeen: aggregate?.highestRarity ?? null,
      firstHatchedDate: aggregate?.firstHatchedDate ?? null,
      lastSeenDate: aggregate?.lastSeenDate ?? historyEntry?.lastSeenIsoDate ?? null,
    };
  });

  const categories: DexCategorySummary[] = CATEGORY_ORDER.map((category) => {
    const inCategory = entries.filter((entry) => entry.category === category);
    return {
      category,
      total: inCategory.length,
      collected: inCategory.filter((entry) => !entry.locked).length,
    };
  }).filter((summary) => summary.total > 0);

  return {
    entries,
    categories,
    collected: entries.filter((entry) => !entry.locked).length,
    total: entries.length,
  };
}

function aggregateSeen(hatchedDays: StoredHomeDayRecord[]): Map<string, SeenAggregate> {
  const seen = new Map<string, SeenAggregate>();
  for (const day of hatchedDays) {
    const creature = day.creature;
    if (!creature?.encounterProfileId) {
      continue;
    }
    const current = seen.get(creature.encounterProfileId) ?? {
      highestRarity: null,
      firstHatchedDate: null,
      lastSeenDate: null,
    };
    if (current.highestRarity === null || RARITY_RANK[creature.rarity] > RARITY_RANK[current.highestRarity]) {
      current.highestRarity = creature.rarity;
    }
    if (current.firstHatchedDate === null || day.isoDate < current.firstHatchedDate) {
      current.firstHatchedDate = day.isoDate;
    }
    if (current.lastSeenDate === null || day.isoDate > current.lastSeenDate) {
      current.lastSeenDate = day.isoDate;
    }
    seen.set(creature.encounterProfileId, current);
  }
  return seen;
}

function resolveCategory(profileId: string, seedId: string): SpeciesCategory {
  if (SEASONAL_SEEDS.has(seedId)) return 'season';
  if (profileId.startsWith('landmark_')) return 'landmark';
  if (profileId.startsWith('subject_')) return 'subject';
  if (profileId.startsWith('activity_')) return 'activity';
  // location_* and anything else read as places.
  return 'place';
}

function humanizeProfileId(profileId: string): string {
  const tail = profileId.split('_').slice(-1)[0] ?? profileId;
  return tail.charAt(0).toUpperCase() + tail.slice(1);
}

export const dexCategoryLabel: Record<SpeciesCategory, string> = {
  place: 'Places',
  subject: 'Companions',
  activity: 'Activities',
  landmark: 'Landmarks',
  season: 'Seasons',
};
