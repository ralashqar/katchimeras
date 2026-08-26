import { katchimeraFamilies } from '@/constants/katchimera-skins';
import type { KatchimeraFamilyId } from '@/types/katchimera';
import type { KingdomCreature } from '@/types/kingdom';
import type { KingdomResident } from '@/utils/kingdom-residents';
import type { HavenStage } from '@/constants/haven-catalog';
import type { EggAvatarSkinId } from '@/types/egg-avatar';
import { hexSpiral, type HexCoord } from '@/utils/world-hex';

type KingdomHexCompanionSlotBase = {
  coord: HexCoord;
  familyId: KatchimeraFamilyId;
  id: string;
};

export type KingdomHexLockedCompanionSlot = KingdomHexCompanionSlotBase & {
  kind: 'locked';
};

export type KingdomHexOwnedCompanionSlot = KingdomHexCompanionSlotBase & {
  kind: 'owned';
  creature: KingdomCreature;
  resident: KingdomResident;
  havenStage: HavenStage;
};

/** A discovered Grove whose Katchimera is still inside its Egg. */
export type KingdomHexRevealedEggCompanionSlot = KingdomHexCompanionSlotBase & {
  kind: 'revealed_egg';
  havenStage: HavenStage;
  eggSkinId: EggAvatarSkinId;
};

export type KingdomHexCompanionSlot =
  | KingdomHexLockedCompanionSlot
  | KingdomHexRevealedEggCompanionSlot
  | KingdomHexOwnedCompanionSlot;

export function kingdomCompanionTileId(familyId: KatchimeraFamilyId): string {
  return `family:${familyId}`;
}

const FAMILY_SLOT_COORDS = hexSpiral(katchimeraFamilies.length, false);
const FAMILY_SLOT_ORDER: KatchimeraFamilyId[] = [
  'mossprout',
  ...katchimeraFamilies.map((family) => family.id).filter((familyId) => familyId !== 'mossprout'),
];
const FAMILY_SLOT_COORD_BY_ID = new Map(
  FAMILY_SLOT_ORDER.map((familyId, index) => [familyId, FAMILY_SLOT_COORDS[index]] as const),
);

/**
 * Builds every authored family slot in catalog order. Ownership changes only
 * the slot state, so loading snapshots or discovering a companion never moves
 * any other Kingdom tile.
 */
export function kingdomCompanionHexSlots(
  residents: KingdomResident[],
  creatures: KingdomCreature[],
  havenStages: Partial<Record<KatchimeraFamilyId, HavenStage>> = {},
): KingdomHexCompanionSlot[] {
  const creatureById = new Map<string, KingdomCreature>();
  for (const creature of creatures) {
    if (!creatureById.has(creature.creatureId)) creatureById.set(creature.creatureId, creature);
  }

  const ownedByFamily = new Map<KatchimeraFamilyId, {
    creature: KingdomCreature;
    resident: KingdomResident;
  }>();
  for (const resident of residents) {
    const creature = creatureById.get(resident.creatureId);
    if (!creature?.familyId || ownedByFamily.has(creature.familyId)) continue;
    ownedByFamily.set(creature.familyId, { creature, resident });
  }

  return katchimeraFamilies.map((family) => {
    const base = {
      coord: FAMILY_SLOT_COORD_BY_ID.get(family.id) ?? FAMILY_SLOT_COORDS[0],
      familyId: family.id,
      id: kingdomCompanionTileId(family.id),
    };
    const owned = ownedByFamily.get(family.id);
    return owned
      ? { ...base, kind: 'owned' as const, ...owned, havenStage: havenStages[family.id] ?? 0 }
      : { ...base, kind: 'locked' as const };
  });
}
