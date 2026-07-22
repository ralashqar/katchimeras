import type { HomeVisualKey } from '@/types/home';
import type { HomeArchetypeId } from '@/types/world-identity';
import type { TodayKingdomTileAlignment } from '@/utils/today-kingdom-hero-layout';
import { getDevKingdomHexVerticalAlignmentMode } from '@/utils/dev-asset-overrides';
import { katchimeraHexTileForIdentity } from '@/utils/katchimera-hex-tiles';
import { kingdomHexTileSet, type KingdomHexTileSpec } from '@/utils/world-visuals';

type KingdomResidentIdentity = {
  creatureId?: string;
  id?: string;
  visualKey: HomeVisualKey;
};

// Resolve resident art exactly as the Kingdom canvas does: the active themed
// resident tile wins, then an individual/custom tile, then the active generic
// Kingdom tile. Other surfaces can therefore share Kingdom art direction
// without maintaining their own asset maps.
export function kingdomResidentTileForIdentity(
  creature: KingdomResidentIdentity
): KingdomHexTileSpec {
  const tileSet = kingdomHexTileSet();
  const themedTile = tileSet.residentTiles?.[creature.visualKey] ?? null;
  const creatureId = creature.creatureId ?? creature.id ?? creature.visualKey;
  const customTile = !themedTile && tileSet.useCustomResidentTiles
    ? katchimeraHexTileForIdentity({ creatureId, visualKey: creature.visualKey })
    : null;
  return themedTile ?? customTile ?? tileSet.default;
}

// The Kingdom center changes with the chosen home archetype. If setup has not
// chosen one yet, use the active art direction's canonical egg/home tile.
export function kingdomHomeTileForIdentity(
  homeArchetypeId: HomeArchetypeId | null | undefined
): KingdomHexTileSpec {
  const tileSet = kingdomHexTileSet();
  return homeArchetypeId ? tileSet.homes[homeArchetypeId] : tileSet.center;
}

// Non-map surfaces still need Kingdom's measured bitmap-to-face alignment;
// returning the same inputs here prevents those surfaces inventing a second
// coordinate system for the exact same tile art.
export function kingdomSurfaceTileAlignment(
  tile: KingdomHexTileSpec,
): TodayKingdomTileAlignment {
  return {
    alignmentMode: getDevKingdomHexVerticalAlignmentMode(),
    assetBounds: tile.alphaBounds,
    faceBounds: tile.faceBounds,
    referenceBounds: kingdomHexTileSet().default.alphaBounds,
  };
}
