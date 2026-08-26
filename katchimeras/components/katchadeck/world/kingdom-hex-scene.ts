import type { ImageSourcePropType } from 'react-native';

import { lifeAspectById } from '@/constants/life-aspects';
import { katchimeraFamilyById } from '@/constants/katchimera-skins';
import type { WorldIdentityState } from '@/types/world-identity';
import { katchimeraHexTileForCreature } from '@/utils/katchimera-hex-tiles';
import type { KingdomHexCompanionSlot } from '@/utils/katchimera-kingdom-slots';
import {
  HEX_TILE_LIP,
  hexDrawDepth,
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

export type KingdomTileRender = {
  id: string;
  kind: 'home' | 'companion';
  coord: HexCoord;
  cx: number;
  cy: number;
  depth: number;
  companion?: KingdomHexCompanionSlot;
};

export type KingdomTileArtLayer = {
  alphaBounds: { left: number; top: number; right: number; bottom: number };
  id: string;
  coord: HexCoord;
  custom: boolean;
  depth: number;
  fallbackSource: ImageSourcePropType | null;
  fallbackSources?: KingdomHexTileLodSources;
  frame: { left: number; top: number; width: number; height: number };
  overlaySource?: ImageSourcePropType;
  overlaySources?: KingdomHexTileLodSources;
  residentAnchor?: { x: number; y: number };
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
  identity: Pick<WorldIdentityState, 'selectedHomeArchetypeId'> | null | undefined,
  verticalAlignmentMode: KingdomHexVerticalAlignmentMode
): KingdomTileArtLayer {
  const familyAnchor =
    tile.kind === 'companion' && tile.companion?.kind === 'owned' && tile.companion.creature.familyId
      ? katchimeraFamilyById.get(tile.companion.creature.familyId)?.anchorVisualKey ?? null
      : null;
  const aspectAnchor =
    familyAnchor ?? (tile.kind === 'companion' && tile.companion?.kind === 'owned' && tile.companion.creature.aspectId
      ? lifeAspectById.get(tile.companion.creature.aspectId)?.anchorVisualKey ?? null
      : null);
  const havenResidentTile =
    tile.kind === 'companion' && (tile.companion?.kind === 'owned' || tile.companion?.kind === 'revealed_egg')
      ? hexTiles.havenResidentTiles?.[tile.companion.familyId]?.[tile.companion.havenStage] ?? null
      : null;
  const themedResidentTile = havenResidentTile ?? (
    tile.kind === 'companion' && tile.companion?.kind === 'owned'
      ? hexTiles.residentTiles?.[tile.companion.creature.visualKey]
        ?? (aspectAnchor ? hexTiles.residentTiles?.[aspectAnchor] : null)
        ?? null
      : null
  );
  const customResidentTile =
    !themedResidentTile && hexTiles.useCustomResidentTiles && tile.kind === 'companion' && tile.companion?.kind === 'owned'
      ? katchimeraHexTileForCreature(tile.companion.creature)
        ?? (aspectAnchor
          ? katchimeraHexTileForCreature({ ...tile.companion.creature, visualKey: aspectAnchor })
          : null)
      : null;
  const homeTile = identity?.selectedHomeArchetypeId
    ? hexTiles.homes[identity.selectedHomeArchetypeId]
    : hexTiles.center;
  const residentTile = themedResidentTile ?? customResidentTile;
  const locked = tile.kind === 'companion' && tile.companion?.kind === 'locked';
  const selected = locked
    ? hexTiles.locked
    : residentTile ?? (tile.kind === 'home' ? homeTile : hexTiles.default);
  const baseBounds = tileAlphaBoundsOrBase('selected-base', hexTiles.default.alphaBounds, FULL_IMAGE_BOUNDS);
  const selectedBounds = tileAlphaBoundsOrBase(tile.id, selected.alphaBounds, baseBounds);
  const frame = kingdomTileArtFrame({
    alignmentMode: verticalAlignmentMode,
    assetBounds: selectedBounds,
    faceBounds: selected.faceBounds,
    referenceBounds: baseBounds,
    target: tileVisibleBounds(tile.cx, tile.cy),
  });

  return {
    alphaBounds: selectedBounds,
    id: tile.id,
    coord: tile.coord,
    custom: Boolean(residentTile),
    depth: tile.depth,
    fallbackSource: residentTile || locked ? hexTiles.default.source : null,
    fallbackSources: residentTile || locked ? hexTiles.default.sources : undefined,
    frame,
    overlaySource: selected.overlaySource,
    overlaySources: selected.overlaySources,
    residentAnchor: selected.residentAnchor
      ? {
          x: frame.left + frame.width * selected.residentAnchor.x,
          y: frame.top + frame.height * selected.residentAnchor.y,
        }
      : undefined,
    source: selected.source,
    sources: selected.sources,
  };
}

export function buildKingdomHexScene(
  companionSlots: KingdomHexCompanionSlot[],
  hexTiles: KingdomHexTileSelection,
  identity?: Pick<WorldIdentityState, 'selectedHomeArchetypeId'> | null,
  verticalAlignmentMode: KingdomHexVerticalAlignmentMode = 'ground-bottom'
): KingdomHexScene {
  const metrics = kingdomSceneMetrics(
    companionSlots.length + 1,
    hexTiles.layoutProfile
  );
  const { width, height } = metrics;
  const rawTiles: Omit<KingdomTileRender, 'cx' | 'cy' | 'depth'>[] = [
    { id: CENTER_ID, kind: 'home', coord: { q: 0, r: 0 } },
    ...companionSlots.map((companion) => ({
      id: companion.id,
      kind: 'companion' as const,
      coord: companion.coord,
      companion,
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
