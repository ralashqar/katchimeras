import { lifeAspectById } from '@/constants/life-aspects';
import { katchimeraFamilies, katchimeraSkins } from '@/constants/katchimera-skins';
import type {
  EncounterHistoryMap,
  HomeRarityTier,
  HomeVisualKey,
  StoredHomeDayRecord,
} from '@/types/home';
import type { KatchimeraFamilyId, KatchimeraSkinId, LifeAspectCategory, LifeAspectId } from '@/types/katchimera';
import { resolveBondStage, type BondStage } from '@/utils/bond';
import type { CompanionBondState } from '@/utils/companion-bond';
import { companionIdForFamily } from '@/constants/katchimera-skins';
import { identityForCreature } from '@/utils/katchimera-identity';

// The collection is family-first. Broad life aspects organize companions but
// never merge unrelated species.

export type DexForm = {
  skinId: KatchimeraSkinId;
  name: string;
  visualKey: HomeVisualKey | null;
  unlocked: boolean;
  totalHatches: number;
  firstHatchedDate: string | null;
  lastSeenDate: string | null;
};

export type DexEntry = {
  speciesId: KatchimeraFamilyId;
  familyId: KatchimeraFamilyId;
  aspectId: LifeAspectId;
  name: string;
  label: string;
  visualKey: HomeVisualKey;
  category: LifeAspectCategory;
  locked: boolean;
  totalHatches: number;
  bondStage: BondStage;
  bondVisitCount: number;
  bondLevel: 1 | 2 | 3 | 4;
  bondLabel: 'New' | 'Familiar' | 'Devoted' | 'Kindred';
  bondPoints: number;
  highestRaritySeen: HomeRarityTier | null;
  firstHatchedDate: string | null;
  lastSeenDate: string | null;
  equippedSkinId: KatchimeraSkinId | null;
  forms: DexForm[];
};

export type DexCategorySummary = {
  category: LifeAspectCategory;
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
const CATEGORY_ORDER: LifeAspectCategory[] = ['body', 'relationships', 'daily-life', 'purpose', 'world', 'inner-life'];

type SeenAggregate = {
  count: number;
  highestRarity: HomeRarityTier | null;
  firstHatchedDate: string | null;
  lastSeenDate: string | null;
  latestVisualKey: HomeVisualKey | null;
  latestSkinId: KatchimeraSkinId | null;
  forms: Map<KatchimeraSkinId, Omit<DexForm, 'name' | 'visualKey' | 'unlocked'>>;
};

export function buildDex(
  history: EncounterHistoryMap,
  hatchedDays: StoredHomeDayRecord[],
  bondState?: CompanionBondState,
  options: { unlockAll?: boolean; discoveredFamilyIds?: readonly KatchimeraFamilyId[] } = {},
): Dex {
  const seen = aggregateSeen(hatchedDays);
  const discovered = new Set(options.discoveredFamilyIds ?? []);
  const entries: DexEntry[] = katchimeraFamilies
    .filter((family): family is typeof family & { anchorVisualKey: HomeVisualKey } => family.anchorVisualKey !== null)
    .map((family) => {
      const aspect = lifeAspectById.get(family.aspectId);
      if (!aspect) throw new Error(`Unknown life aspect for ${family.id}`);
      const aggregate = seen.get(family.id);
      const historyEntry = history[family.id];
      const totalHatches = Math.max(historyEntry?.count ?? 0, aggregate?.count ?? 0);
      const progression = bondState
        ? dexBondProgress(bondState, companionIdForFamily(family.id))
        : null;
      const legacyBondStage = resolveBondStage(totalHatches);
      const forms = katchimeraSkins
        .filter((skin) => skin.familyId === family.id && (skin.visualKey ?? skin.placeholderVisualKey))
        .map((skin): DexForm => {
          const form = aggregate?.forms.get(skin.id);
          return {
            skinId: skin.id,
            name: skin.displayName,
            visualKey: skin.visualKey ?? skin.placeholderVisualKey ?? null,
            unlocked: options.unlockAll || discovered.has(family.id) && skin.id === family.anchorSkinId || Boolean(form),
            totalHatches: form?.totalHatches ?? 0,
            firstHatchedDate: form?.firstHatchedDate ?? null,
            lastSeenDate: form?.lastSeenDate ?? null,
          };
        });
      return {
        speciesId: family.id,
        familyId: family.id,
        aspectId: aspect.id,
        name: family.displayName,
        label: aspect.label,
        visualKey: aggregate?.latestVisualKey ?? family.anchorVisualKey,
        category: aspect.category,
        locked: options.unlockAll ? false : !discovered.has(family.id),
        totalHatches,
        bondStage: progression ? (progression.level - 1) as BondStage : legacyBondStage,
        bondVisitCount: totalHatches,
        bondLevel: progression?.level ?? (legacyBondStage + 1) as 1 | 2 | 3 | 4,
        bondLabel: progression?.label ?? (['New', 'Familiar', 'Devoted', 'Kindred'][legacyBondStage] as DexEntry['bondLabel']),
        bondPoints: progression?.totalPoints ?? totalHatches * 10,
        highestRaritySeen: aggregate?.highestRarity ?? null,
        firstHatchedDate: aggregate?.firstHatchedDate ?? null,
        lastSeenDate: aggregate?.lastSeenDate ?? historyEntry?.lastSeenIsoDate ?? null,
        equippedSkinId: aggregate?.latestSkinId ?? null,
        forms,
      };
    });

  const categories = CATEGORY_ORDER.map((category) => {
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

function dexBondProgress(state: CompanionBondState, creatureId: string): {
  level: 1 | 2 | 3 | 4;
  label: DexEntry['bondLabel'];
  totalPoints: number;
} {
  const totalPoints = state.events
    .filter((event) => event.creatureId === creatureId)
    .reduce((sum, event) => sum + event.points, 0);
  if (totalPoints >= 500) return { level: 4, label: 'Kindred', totalPoints };
  if (totalPoints >= 250) return { level: 3, label: 'Devoted', totalPoints };
  if (totalPoints >= 100) return { level: 2, label: 'Familiar', totalPoints };
  return { level: 1, label: 'New', totalPoints };
}

function aggregateSeen(hatchedDays: StoredHomeDayRecord[]): Map<KatchimeraFamilyId, SeenAggregate> {
  const seen = new Map<KatchimeraFamilyId, SeenAggregate>();
  for (const day of [...hatchedDays].sort((left, right) => left.isoDate.localeCompare(right.isoDate))) {
    const creature = day.creature;
    if (!creature) continue;
    const identity = identityForCreature(creature);
    if (!identity) continue;
    const current = seen.get(identity.familyId) ?? {
      count: 0,
      highestRarity: null,
      firstHatchedDate: null,
      lastSeenDate: null,
      latestVisualKey: null,
      latestSkinId: null,
      forms: new Map(),
    };
    current.count += 1;
    if (current.highestRarity === null || RARITY_RANK[creature.rarity] > RARITY_RANK[current.highestRarity]) {
      current.highestRarity = creature.rarity;
    }
    current.firstHatchedDate ??= day.isoDate;
    current.lastSeenDate = day.isoDate;
    current.latestVisualKey = creature.visualKey;
    current.latestSkinId = identity.skinId;
    const form = current.forms.get(identity.skinId);
    current.forms.set(identity.skinId, {
      skinId: identity.skinId,
      totalHatches: (form?.totalHatches ?? 0) + 1,
      firstHatchedDate: form?.firstHatchedDate ?? day.isoDate,
      lastSeenDate: day.isoDate,
    });
    seen.set(identity.familyId, current);
  }
  return seen;
}

export const dexCategoryLabel: Record<LifeAspectCategory, string> = {
  body: 'Body & wellbeing',
  relationships: 'Relationships',
  'daily-life': 'Daily life',
  purpose: 'Purpose & growth',
  world: 'World & exploration',
  'inner-life': 'Inner life',
};
