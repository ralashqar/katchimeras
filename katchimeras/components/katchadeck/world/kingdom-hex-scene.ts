import type { ImageSourcePropType } from 'react-native';

import type { KingdomCreature } from '@/types/kingdom';
import type { WorldIdentityState } from '@/types/world-identity';
import { katchimeraHexTileForCreature } from '@/utils/katchimera-hex-tiles';
import type { KingdomResident } from '@/utils/kingdom-residents';
import {
  HEX_TILE_LIP,
  hexDrawDepth,
  hexSpiral,
  hexTileTopPoints,
  hexToWorld,
  type HexCoord,
} from '@/utils/world-hex';
import { kingdomSceneMetrics } from '@/utils/kingdom-rendering';
import {
  kingdomTileArtFrame,
  type KingdomHexVerticalAlignmentMode,
} from '@/utils/kingdom-tile-alignment';
import type {
  KingdomHexTileLodSources,
  KingdomHexTileSelection,
} from '@/utils/world-visuals';

export type KingdomHexResidentTile = {
  id: string;
  resident: KingdomResident;
  creature: KingdomCreature;
  coord: HexCoord;
};

export type KingdomTileRender = {
  id: string;
  kind: 'home' | 'zodiac' | 'resident';
  coord: HexCoord;
  cx: number;
  cy: number;
  depth: number;
  resident?: KingdomHexResidentTile;
};

export type KingdomTileArtLayer = {
  id: string;
  coord: HexCoord;
  custom: boolean;
  depth: number;
  fallbackSource: ImageSourcePropType | null;
  fallbackSources?: KingdomHexTileLodSources;
  frame: { left: number; top: number; width: number; height: number };
  source: ImageSourcePropType;
  sources?: KingdomHexTileLodSources;
};

export type KingdomHexScene = {
  centerTile: KingdomTileRender;
  height: number;
  tileArtLayers: KingdomTileArtLayer[];
  tileById: Map<string, KingdomTileRender>;
  tiles: KingdomTileRender[];
  width: number;
};

const CENTER_ID = 'kingdom';
export const ZODIAC_TILE_ID = 'zodiac';
export const ZODIAC_HEX_COORD: HexCoord = { q: -1, r: 1 };
const FULL_IMAGE_BOUNDS = { left: 0, top: 0, right: 1024, bottom: 1024 };
const warnedMissingBounds = new Set<string>();

function validAlphaBounds(bounds: KingdomHexTileSelection['default']['alphaBounds'] | null | undefined) {
  return Boolean(
    bounds &&
      Number.isFinite(bounds.left) &&
      Number.isFinite(bounds.top) &&
      Number.isFinite(bounds.right) &&
      Number.isFinite(bounds.bottom) &&
      bounds.right > bounds.left &&
      bounds.bottom > bounds.top
  );
}

function tileAlphaBoundsOrBase(
  tileId: string,
  bounds: KingdomHexTileSelection['default']['alphaBounds'] | null | undefined,
  baseBounds: KingdomHexTileSelection['default']['alphaBounds']
) {
  if (validAlphaBounds(bounds)) return bounds!;
  if (__DEV__ && !warnedMissingBounds.has(tileId)) {
    warnedMissingBounds.add(tileId);
    console.warn(`[Kingdom] Missing alignment bounds for ${tileId}; using the selected base tile bounds.`);
  }
  return baseBounds;
}

export function residentTileId(creatureId: string): string {
  return `resident:${creatureId}`;
}

export function tileVisibleBounds(cx: number, cy: number) {
  const topPoints = hexTileTopPoints(cx, cy);
  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;

  for (const point of topPoints) {
    left = Math.min(left, point.x);
    right = Math.max(right, point.x);
    top = Math.min(top, point.y);
    bottom = Math.max(bottom, point.y + HEX_TILE_LIP);
  }
  return { left, right, top, bottom };
}

function artLayerFor(
  tile: KingdomTileRender,
  hexTiles: KingdomHexTileSelection,
  identity: Pick<WorldIdentityState, 'selectedHomeArchetypeId' | 'zodiacSignId'> | null | undefined,
  verticalAlignmentMode: KingdomHexVerticalAlignmentMode
): KingdomTileArtLayer {
  const themedResidentTile =
    tile.kind === 'resident' && tile.resident
      ? hexTiles.residentTiles?.[tile.resident.creature.visualKey] ?? null
      : null;
  const customResidentTile =
    !themedResidentTile && hexTiles.useCustomResidentTiles && tile.kind === 'resident' && tile.resident
      ? katchimeraHexTileForCreature(tile.resident.creature)
      : null;
  const homeTile = identity?.selectedHomeArchetypeId
    ? hexTiles.homes[identity.selectedHomeArchetypeId]
    : hexTiles.center;
  const zodiacTile = identity?.zodiacSignId ? hexTiles.zodiacs[identity.zodiacSignId] : hexTiles.default;
  const residentTile = themedResidentTile ?? customResidentTile;
  const selected = residentTile ?? (tile.kind === 'home' ? homeTile : tile.kind === 'zodiac' ? zodiacTile : hexTiles.default);
  const baseBounds = tileAlphaBoundsOrBase('selected-base', hexTiles.default.alphaBounds, FULL_IMAGE_BOUNDS);
  const selectedBounds = tileAlphaBoundsOrBase(tile.id, selected.alphaBounds, baseBounds);

  return {
    id: tile.id,
    coord: tile.coord,
    custom: Boolean(residentTile),
    depth: tile.depth,
    fallbackSource: residentTile ? hexTiles.default.source : null,
    fallbackSources: residentTile ? hexTiles.default.sources : undefined,
    frame: kingdomTileArtFrame({
      alignmentMode: verticalAlignmentMode,
      assetBounds: selectedBounds,
      faceBounds: selected.faceBounds,
      referenceBounds: baseBounds,
      target: tileVisibleBounds(tile.cx, tile.cy),
    }),
    source: selected.source,
    sources: selected.sources,
  };
}

export function buildKingdomHexScene(
  residents: KingdomHexResidentTile[],
  hexTiles: KingdomHexTileSelection,
  identity?: Pick<WorldIdentityState, 'selectedHomeArchetypeId' | 'zodiacSignId'> | null,
  verticalAlignmentMode: KingdomHexVerticalAlignmentMode = 'ground-bottom'
): KingdomHexScene {
  const hasZodiac = Boolean(identity?.zodiacSignId);
  const metrics = kingdomSceneMetrics(
    residents.length + (hasZodiac ? 1 : 0),
    hexTiles.layoutProfile
  );
  const { width, height } = metrics;
  const rawTiles: Omit<KingdomTileRender, 'cx' | 'cy' | 'depth'>[] = [
    { id: CENTER_ID, kind: 'home', coord: { q: 0, r: 0 } },
    ...(hasZodiac ? [{ id: ZODIAC_TILE_ID, kind: 'zodiac' as const, coord: ZODIAC_HEX_COORD }] : []),
    ...residents.map((resident) => ({
      id: resident.id,
      kind: 'resident' as const,
      coord: resident.coord,
      resident,
    })),
  ];

  const tiles = rawTiles
    .map((tile) => {
      const point = hexToWorld(tile.coord, hexTiles.layoutProfile);
      const cx = point.x + metrics.centerX;
      const cy = point.y + metrics.centerY;
      return { ...tile, cx, cy, depth: hexDrawDepth({ x: cx, y: cy }) };
    })
    .sort((a, b) => a.depth - b.depth);
  const centerTile = tiles.find((tile) => tile.id === CENTER_ID) ?? tiles[0];
  const tileById = new Map(tiles.map((tile) => [tile.id, tile]));

  return {
    centerTile,
    height,
    tileArtLayers: tiles.map((tile) => artLayerFor(tile, hexTiles, identity, verticalAlignmentMode)),
    tileById,
    tiles,
    width,
  };
}

export function kingdomResidentHexTiles(
  residents: KingdomResident[],
  creatures: KingdomCreature[]
): KingdomHexResidentTile[] {
  const coordByIndex = hexSpiral(residents.length + 1, false).filter(
    (coord) => coord.q !== ZODIAC_HEX_COORD.q || coord.r !== ZODIAC_HEX_COORD.r
  );
  const meta = new Map(creatures.map((creature) => [creature.creatureId, creature]));

  return residents
    .map((resident, index) => {
      const creature = meta.get(resident.creatureId);
      if (!creature) return null;
      return {
        id: residentTileId(resident.creatureId),
        resident,
        creature,
        coord: coordByIndex[index],
      };
    })
    .filter((tile): tile is KingdomHexResidentTile => Boolean(tile));
}
