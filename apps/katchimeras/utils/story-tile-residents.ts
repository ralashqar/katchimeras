import type { KatchimeraSkinDefinition } from '@/constants/katchimera-skins';
import type { StoryTileDefinition } from '@/constants/story-tiles/registry';
import type { KingdomHexCompanionSlot, KingdomHexOwnedCompanionSlot } from '@/utils/katchimera-kingdom-slots';
import type { HexCoord } from '@incubator/environments/hex';

/** A story tile's resident, ready for the scene: which tile, where, and the slot they stand as. */
export type StoryTileResident = { tileId: string; coord: HexCoord; companion: KingdomHexOwnedCompanionSlot };

/** The scene id of a story tile's structure layer; its resident stands under that id. */
export const storyTileStructureId = (tileId: string) => `structure:${tileId}`;

/**
 * Who stands on the revealed story tiles: a tile that names a resident form
 * shows that form once its mist has cleared, standing as its friend's owned
 * slot (so the shared resident stage, the LODs and the tap work as for a
 * friend) but as its own creature, with the form's look and name. A tile
 * still misted, a form nobody knows, or a friend not yet owned shows no one.
 */
export function storyTileResidents(
  tiles: readonly StoryTileDefinition[],
  states: Partial<Record<string, 'misted' | 'revealed'>>,
  slots: readonly KingdomHexCompanionSlot[],
  skins: ReadonlyMap<string, KatchimeraSkinDefinition>,
): StoryTileResident[] {
  return tiles.flatMap((tile) => {
    if (!tile.residentSkinId || (states[tile.id] ?? 'misted') !== 'revealed') return [];
    const skin = skins.get(tile.residentSkinId);
    const slot = slots.find((candidate): candidate is KingdomHexOwnedCompanionSlot => candidate.kind === 'owned' && candidate.familyId === tile.companion);
    if (!skin || !slot) return [];
    const id = storyTileStructureId(tile.id);
    return [{
      tileId: tile.id, coord: tile.coord,
      companion: {
        ...slot, id, coord: tile.coord,
        creature: { ...slot.creature, creatureId: `resident:${tile.id}`, skinId: skin.id, visualKey: skin.visualKey ?? slot.creature.visualKey, name: skin.displayName },
      },
    }];
  });
}
