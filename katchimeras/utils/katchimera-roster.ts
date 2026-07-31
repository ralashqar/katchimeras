import { katchimeraFamilies } from '@/constants/katchimera-skins';
import type { CompanionBondProgress } from '@/utils/companion-bond';
import type { HomeRarityTier, HomeVisualKey } from '@/types/home';
import type { KatchimeraFamilyId, LifeAspectId } from '@/types/katchimera';
import type { KingdomCreature } from '@/types/kingdom';
import type { KingdomResident } from '@/utils/kingdom-residents';

export type KatchimeraRosterStatus = 'offer' | 'active' | 'ready';
export type KatchimeraRosterSort = 'bond' | 'newest' | 'name' | 'rarity';

export type KatchimeraOwnedRosterItem = {
  kind: 'owned';
  creatureId: string;
  familyId: KatchimeraFamilyId;
  name: string;
  visualKey: HomeVisualKey;
  aspectId: LifeAspectId;
  rarity: HomeRarityTier;
  accentColor: string;
  houseLevel: number;
  hatchCount: number;
  arrivedAt: number;
  bond: CompanionBondProgress;
  status: KatchimeraRosterStatus | null;
};

export type KatchimeraLockedRosterItem = {
  kind: 'locked';
  familyId: KatchimeraFamilyId;
  aspectId: LifeAspectId;
  silhouetteVisualKey: HomeVisualKey;
};

export type KatchimeraRosterItem =
  | KatchimeraOwnedRosterItem
  | KatchimeraLockedRosterItem;

type BuildKatchimeraRosterArgs = {
  creatures: KingdomCreature[];
  residents: KingdomResident[];
  bondForCreature: (creatureId: string) => CompanionBondProgress;
  statusByCreatureId?: Partial<Record<string, KatchimeraRosterStatus>>;
};

const RARITY_ORDER: Record<HomeRarityTier, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
};

export function buildKatchimeraRoster({
  creatures,
  residents,
  bondForCreature,
  statusByCreatureId = {},
}: BuildKatchimeraRosterArgs): KatchimeraRosterItem[] {
  const creatureById = new Map<string, KingdomCreature>();
  for (const creature of creatures) {
    if (!creatureById.has(creature.creatureId)) {
      creatureById.set(creature.creatureId, creature);
    }
  }

  const ownedFamilyIds = new Set<KatchimeraFamilyId>();
  const owned = residents.flatMap<KatchimeraOwnedRosterItem>((resident) => {
    const creature = creatureById.get(resident.creatureId);
    if (!creature?.familyId || !creature.aspectId) return [];
    ownedFamilyIds.add(creature.familyId);
    const parsedArrival = Date.parse(`${creature.isoDate}T00:00:00`);
    return [{
      kind: 'owned',
      creatureId: creature.creatureId,
      familyId: creature.familyId,
      name: creature.name,
      visualKey: creature.visualKey,
      aspectId: creature.aspectId,
      rarity: creature.rarity,
      accentColor: creature.accentColor,
      houseLevel: resident.houseLevel,
      hatchCount: resident.hatchCount,
      arrivedAt: Number.isFinite(parsedArrival) ? parsedArrival : resident.arrivalIndex,
      bond: bondForCreature(creature.creatureId),
      status: statusByCreatureId[creature.creatureId] ?? null,
    }];
  });

  const locked = katchimeraFamilies.flatMap<KatchimeraLockedRosterItem>((family) => {
    if (ownedFamilyIds.has(family.id) || !family.anchorVisualKey) return [];
    return [{
      kind: 'locked',
      familyId: family.id,
      aspectId: family.aspectId,
      silhouetteVisualKey: family.anchorVisualKey,
    }];
  });

  return [...owned, ...locked];
}

export function filterAndSortKatchimeraRoster(
  items: KatchimeraRosterItem[],
  aspectId: LifeAspectId | 'all',
  sort: KatchimeraRosterSort,
): KatchimeraRosterItem[] {
  const filtered = aspectId === 'all'
    ? [...items]
    : items.filter((item) => item.aspectId === aspectId);
  const owned = filtered.filter(
    (item): item is KatchimeraOwnedRosterItem => item.kind === 'owned',
  );
  const locked = filtered.filter(
    (item): item is KatchimeraLockedRosterItem => item.kind === 'locked',
  );

  owned.sort((left, right) => {
    if (sort === 'bond') {
      return right.bond.totalPoints - left.bond.totalPoints
        || right.arrivedAt - left.arrivedAt
        || left.name.localeCompare(right.name);
    }
    if (sort === 'newest') {
      return right.arrivedAt - left.arrivedAt || left.name.localeCompare(right.name);
    }
    if (sort === 'rarity') {
      return RARITY_ORDER[right.rarity] - RARITY_ORDER[left.rarity]
        || right.bond.totalPoints - left.bond.totalPoints
        || left.name.localeCompare(right.name);
    }
    return left.name.localeCompare(right.name);
  });
  locked.sort((left, right) => left.familyId.localeCompare(right.familyId));
  return [...owned, ...locked];
}

export function featuredKatchimera(
  items: KatchimeraRosterItem[],
): KatchimeraOwnedRosterItem | null {
  return items
    .filter((item): item is KatchimeraOwnedRosterItem => item.kind === 'owned')
    .sort((left, right) => (
      right.bond.totalPoints - left.bond.totalPoints
      || right.arrivedAt - left.arrivedAt
      || left.name.localeCompare(right.name)
    ))[0] ?? null;
}
