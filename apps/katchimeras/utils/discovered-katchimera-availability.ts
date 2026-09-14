import {
  companionIdForFamily,
  katchimeraFamilyById,
} from '@/constants/katchimera-skins';
import { companionHasPage } from '@/features/companion/companion-page-policy';
import type { CompanionDiscoveryRecord } from '@/types/merge-world';
import type { KingdomCreature, KingdomState } from '@/types/kingdom';

const DISCOVERY_ACCENT_COLOR = '#D2AE59';
const FALLBACK_DISCOVERY_DATE = '1970-01-01';

function discoveryDate(discoveredAt: number): string {
  if (!Number.isFinite(discoveredAt)) return FALLBACK_DISCOVERY_DATE;
  const date = new Date(discoveredAt);
  return Number.isNaN(date.getTime())
    ? FALLBACK_DISCOVERY_DATE
    : date.toISOString().slice(0, 10);
}

/**
 * Projects Merge World's authoritative companion discovery ledger into the
 * older Kingdom read model used by roster, companion, and game surfaces.
 *
 * This is deliberately in-memory: discovery ownership remains persisted only
 * in Merge World. A historical day creature wins when one exists so legacy
 * skins, rarity, and arrival provenance are never replaced by the projection.
 */
export function withDiscoveredKatchimeras(
  kingdom: KingdomState,
  records: readonly CompanionDiscoveryRecord[],
): KingdomState {
  if (!records.length) return kingdom;

  // A discovered friend is that friend: the misted tile held Baristabbit, not a day's hatch of his family in
  // another form. A historical creature of a page family takes the friend's own art and name on the map.
  const friendFamilyIds = new Set<string>(records.map((record) => record.characterId).filter((familyId) => companionHasPage(familyId)));
  const creatures = kingdom.creatures.map((creature) => {
    const family = creature.familyId && friendFamilyIds.has(creature.familyId) ? katchimeraFamilyById.get(creature.familyId) : null;
    if (!family?.anchorVisualKey || (creature.skinId === family.anchorSkinId && creature.visualKey === family.anchorVisualKey)) return creature;
    return { ...creature, aspectId: family.aspectId, skinId: family.anchorSkinId, name: family.displayName, visualKey: family.anchorVisualKey };
  });
  const ownedFamilyIds = new Set(
    creatures.flatMap((creature) => creature.familyId ? [creature.familyId] : []),
  );
  const virtualCreatures = [...records]
    // Only a friend with a page is discovered as a companion; the engine drops the rest durably, this is the read-side guard.
    .filter((record) => companionHasPage(record.characterId))
    .sort((left, right) => right.discoveredAt - left.discoveredAt)
    .flatMap<KingdomCreature>((record) => {
      const family = katchimeraFamilyById.get(record.characterId);
      if (!family || !family.anchorVisualKey || ownedFamilyIds.has(family.id)) return [];
      ownedFamilyIds.add(family.id);
      const companionId = companionIdForFamily(family.id);
      return [{
        dayId: `discovery:${record.gateId}`,
        isoDate: discoveryDate(record.discoveredAt),
        creatureId: companionId,
        sourceCreatureId: `discovery:${record.characterId}:${record.gateId}`,
        companionId,
        aspectId: family.aspectId,
        familyId: family.id,
        skinId: family.anchorSkinId,
        name: family.displayName,
        visualKey: family.anchorVisualKey,
        rarity: 'common',
        accentColor: DISCOVERY_ACCENT_COLOR,
      }];
    });

  if (!virtualCreatures.length && creatures.every((creature, index) => creature === kingdom.creatures[index])) return kingdom;
  return {
    ...kingdom,
    creatures: [...creatures, ...virtualCreatures],
  };
}
