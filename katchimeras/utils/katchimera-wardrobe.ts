import {
  ALL_KATCHIMERA_SKINS_UNLOCKED,
  familyIdFromCompanionId,
  katchimeraFamilyById,
  katchimeraSkinById,
  katchimeraSkins,
  type KatchimeraSkinDefinition,
} from '@/constants/katchimera-skins';
import type {
  HomeVisualKey,
} from '@/types/home';
import type {
  KatchimeraFamilyId,
  KatchimeraSkinId,
  KatchimeraWardrobeState,
} from '@/types/katchimera';
import type { KingdomCreature, KingdomState } from '@/types/kingdom';

export type KingdomSkinOption = Omit<KatchimeraSkinDefinition, 'visualKey'> & {
  visualKey: HomeVisualKey;
  unlocked: boolean;
};

export const EMPTY_KATCHIMERA_WARDROBE: KatchimeraWardrobeState = {
  version: 2,
  equippedByFamily: {},
};

export function normalizeKatchimeraWardrobe(value: unknown): KatchimeraWardrobeState {
  if (!isRecord(value)) {
    return EMPTY_KATCHIMERA_WARDROBE;
  }

  const source =
    value.version === 2 && isRecord(value.equippedByFamily)
      ? value.equippedByFamily
      : value.version === 1 && isRecord(value.equippedByAspect)
        ? value.equippedByAspect
        : null;
  if (!source) return EMPTY_KATCHIMERA_WARDROBE;

  const equippedByFamily: KatchimeraWardrobeState['equippedByFamily'] = {};
  for (const [rawOwnerId, rawSkinId] of Object.entries(source)) {
    if (typeof rawSkinId !== 'string') continue;
    const skin = katchimeraSkinById.get(rawSkinId);
    const familyId =
      value.version === 1
        ? skin?.familyId
        : rawOwnerId as KatchimeraFamilyId;
    if (
      familyId &&
      katchimeraFamilyById.has(familyId) &&
      skin?.familyId === familyId &&
      selectableVisualKey(skin) !== null
    ) {
      equippedByFamily[familyId] = skin.id;
    }
  }

  return { version: 2, equippedByFamily };
}

export function skinsForKingdomCompanion(
  familyId: KatchimeraFamilyId,
  ownedSkinIds: ReadonlySet<KatchimeraSkinId>
): KingdomSkinOption[] {
  return katchimeraSkins.flatMap((skin) => {
    const visualKey = selectableVisualKey(skin);
    if (skin.familyId !== familyId || !visualKey) return [];
    return [{
      ...skin,
      visualKey,
      unlocked: ALL_KATCHIMERA_SKINS_UNLOCKED || ownedSkinIds.has(skin.id),
    }];
  });
}

export function equipKatchimeraSkin(
  state: KatchimeraWardrobeState,
  familyId: KatchimeraFamilyId,
  skinId: KatchimeraSkinId
): KatchimeraWardrobeState {
  const skin = katchimeraSkinById.get(skinId);
  if (
    !skin ||
    skin.familyId !== familyId ||
    selectableVisualKey(skin) === null
  ) {
    return state;
  }

  return {
    version: 2,
    equippedByFamily: {
      ...state.equippedByFamily,
      [familyId]: skin.id,
    },
  };
}

export function applyWardrobeToKingdom(
  kingdom: KingdomState,
  wardrobe: KatchimeraWardrobeState
): KingdomState {
  let changed = false;
  const creatures = kingdom.creatures.map((creature) => {
    const next = applyWardrobeToCreature(creature, wardrobe);
    if (next !== creature) changed = true;
    return next;
  });
  return changed ? { ...kingdom, creatures } : kingdom;
}

export function applyWardrobeToCreature(
  creature: KingdomCreature,
  wardrobe: KatchimeraWardrobeState
): KingdomCreature {
  const familyId =
    creature.familyId ??
    familyIdFromCompanionId(creature.companionId ?? creature.creatureId);
  if (!familyId) return creature;

  const equippedSkinId = wardrobe.equippedByFamily[familyId];
  const skin = equippedSkinId ? katchimeraSkinById.get(equippedSkinId) : null;
  const visualKey = skin ? selectableVisualKey(skin) : null;
  if (
    !skin ||
    skin.familyId !== familyId ||
    !visualKey
  ) {
    return creature;
  }

  if (
    creature.skinId === skin.id &&
    creature.visualKey === visualKey
  ) {
    return creature;
  }

  return {
    ...creature,
    aspectId: skin.aspectId,
    familyId,
    skinId: skin.id,
    visualKey,
  };
}

function selectableVisualKey(skin: KatchimeraSkinDefinition): HomeVisualKey | null {
  return skin.visualKey ?? skin.placeholderVisualKey ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
