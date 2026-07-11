import type { ImageSourcePropType } from 'react-native';

import type { KingdomCreature } from '@/types/kingdom';
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
import type {
  KingdomHexTileAlphaBounds,
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
  kind: 'center' | 'resident';
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
const CENTER_TILE_ASSET_SIZE = 1024;

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

function tileArtFrame(tile: KingdomTileRender, assetBounds: KingdomHexTileAlphaBounds) {
  const target = tileVisibleBounds(tile.cx, tile.cy);
  const assetBoundsWidth = assetBounds.right - assetBounds.left;
  const assetBoundsCenterX = (assetBounds.left + assetBounds.right) / 2;
  const assetBoundsCenterY = (assetBounds.top + assetBounds.bottom) / 2;
  const targetWidth = target.right - target.left;
  const targetCenterX = (target.left + target.right) / 2;
  const targetCenterY = (target.top + target.bottom) / 2;
  const size = targetWidth * (CENTER_TILE_ASSET_SIZE / assetBoundsWidth);

  return {
    height: size,
    left: targetCenterX - (assetBoundsCenterX / CENTER_TILE_ASSET_SIZE) * size,
    top: targetCenterY - (assetBoundsCenterY / CENTER_TILE_ASSET_SIZE) * size,
    width: size,
  };
}

function artLayerFor(tile: KingdomTileRender, hexTiles: KingdomHexTileSelection): KingdomTileArtLayer {
  const customResidentTile =
    tile.kind === 'resident' && tile.resident ? katchimeraHexTileForCreature(tile.resident.creature) : null;
  const selected = customResidentTile ?? (tile.kind === 'center' ? hexTiles.center : hexTiles.default);

  return {
    id: tile.id,
    coord: tile.coord,
    custom: Boolean(customResidentTile),
    depth: tile.depth,
    fallbackSource: customResidentTile ? hexTiles.default.source : null,
    fallbackSources: customResidentTile ? hexTiles.default.sources : undefined,
    frame: tileArtFrame(tile, selected.alphaBounds),
    source: selected.source,
    sources: selected.sources,
  };
}

export function buildKingdomHexScene(
  residents: KingdomHexResidentTile[],
  hexTiles: KingdomHexTileSelection
): KingdomHexScene {
  const metrics = kingdomSceneMetrics(residents.length);
  const { width, height } = metrics;
  const rawTiles: Omit<KingdomTileRender, 'cx' | 'cy' | 'depth'>[] = [
    { id: CENTER_ID, kind: 'center', coord: { q: 0, r: 0 } },
    ...residents.map((resident) => ({
      id: resident.id,
      kind: 'resident' as const,
      coord: resident.coord,
      resident,
    })),
  ];

  const tiles = rawTiles
    .map((tile) => {
      const point = hexToWorld(tile.coord);
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
    tileArtLayers: tiles.map((tile) => artLayerFor(tile, hexTiles)),
    tileById,
    tiles,
    width,
  };
}

export function kingdomResidentHexTiles(
  residents: KingdomResident[],
  creatures: KingdomCreature[]
): KingdomHexResidentTile[] {
  const coordByIndex = hexSpiral(residents.length, false);
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
