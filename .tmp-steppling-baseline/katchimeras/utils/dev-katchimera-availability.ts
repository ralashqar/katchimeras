import {
  companionIdForFamily,
  katchimeraFamilies,
} from '@/constants/katchimera-skins';
import type { KingdomCreature, KingdomState } from '@/types/kingdom';

const DEV_ARRIVAL_DATE = '1970-01-01';
const DEV_ACCENT_COLOR = '#D2AE59';

/**
 * Adds reversible, in-memory residents for families that have renderable art.
 * Real hatch records always win, and this never writes to the player's day,
 * encounter, bond, quest, or wardrobe history.
 */
export function withDevAvailableKatchimeras(
  kingdom: KingdomState,
  enabled: boolean,
): KingdomState {
  if (!enabled) return kingdom;

  const ownedFamilyIds = new Set(
    kingdom.creatures.flatMap((creature) => creature.familyId ? [creature.familyId] : []),
  );
  const virtualCreatures = katchimeraFamilies.flatMap<KingdomCreature>((family) => {
    if (ownedFamilyIds.has(family.id) || !family.anchorVisualKey) return [];
    const companionId = companionIdForFamily(family.id);
    return [{
      dayId: `dev-unlocked:${family.id}`,
      isoDate: DEV_ARRIVAL_DATE,
      creatureId: companionId,
      sourceCreatureId: `dev-unlocked:${family.id}`,
      companionId,
      aspectId: family.aspectId,
      familyId: family.id,
      skinId: family.anchorSkinId,
      name: family.displayName,
      visualKey: family.anchorVisualKey,
      rarity: 'common',
      accentColor: DEV_ACCENT_COLOR,
    }];
  });

  if (!virtualCreatures.length) return kingdom;
  return {
    ...kingdom,
    creatures: [...kingdom.creatures, ...virtualCreatures],
  };
}
