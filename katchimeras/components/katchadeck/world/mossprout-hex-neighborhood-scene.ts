import type { ImageSourcePropType } from 'react-native';

import type { KingdomHexScene, KingdomTileArtLayer, KingdomTileRender } from '@/components/katchadeck/world/kingdom-hex-scene';
import { KINGDOM_HEX_TILE_ALPHA_BOUNDS } from '@/constants/kingdom-hex-tile-bounds.gen';
import { MOSSPROUT_NATURE_ISLANDS } from '@/constants/mossprout-nature-islands';
import type { MossproutNatureIslandId, MossproutNatureIslandLevel } from '@/types/merge-world';
import type { KingdomHexCompanionSlot } from '@/utils/katchimera-kingdom-slots';
import { kingdomTileArtFrame } from '@/utils/kingdom-tile-alignment';
import { hexDrawDepth, hexToWorld, type HexCoord } from '@/utils/world-hex';
import { tileVisibleBounds } from '@/components/katchadeck/world/kingdom-hex-scene';

const SOURCE_SIZE = { height: 1024, width: 1024 } as const;
const LAYOUT_PROFILE = 'floating-neighborhood-v2' as const;
const NEIGHBORHOOD_SPACING_SCALE = 1.1;
const SCENE_PADDING = 96;
const MAIN_RESIDENT_SOURCE = require('../../../assets/images/katchimeras/world/square/mossprout-standing-resident-512.webp');

type TileSources = {
  full: ImageSourcePropType;
  medium: ImageSourcePropType;
  thumb: ImageSourcePropType;
};

type ArtSpec = {
  alphaBounds: { bottom: number; left: number; right: number; top: number };
  coord: HexCoord;
  sources: TileSources;
};

const MAIN: ArtSpec = {
  alphaBounds: KINGDOM_HEX_TILE_ALPHA_BOUNDS['mossprout_focused_v1_main_hex_tile.webp'],
  coord: { q: 0, r: 1 },
  sources: {
    full: require('../../../assets/images/katchimeras/world/hex/mossprout_focused_v1_main_hex_tile.webp'),
    medium: require('../../../assets/images/katchimeras/world/hex/mossprout_focused_v1_main_hex_tile_512.webp'),
    thumb: require('../../../assets/images/katchimeras/world/hex/mossprout_focused_v1_main_hex_tile_256.webp'),
  },
};

const GARDEN: ArtSpec = {
  alphaBounds: KINGDOM_HEX_TILE_ALPHA_BOUNDS['mossprout_focused_v1_garden_hex_tile.webp'],
  coord: { q: 0, r: 2 },
  sources: {
    full: require('../../../assets/images/katchimeras/world/hex/mossprout_focused_v1_garden_hex_tile.webp'),
    medium: require('../../../assets/images/katchimeras/world/hex/mossprout_focused_v1_garden_hex_tile_512.webp'),
    thumb: require('../../../assets/images/katchimeras/world/hex/mossprout_focused_v1_garden_hex_tile_256.webp'),
  },
};

const NATURE: Record<MossproutNatureIslandId, ArtSpec> = {
  'seed-nursery': {
    alphaBounds: KINGDOM_HEX_TILE_ALPHA_BOUNDS['mossprout_focused_v1_seed_nursery_hex_tile.webp'],
    coord: { q: -1, r: 1 },
    sources: {
      full: require('../../../assets/images/katchimeras/world/hex/mossprout_focused_v1_seed_nursery_hex_tile.webp'),
      medium: require('../../../assets/images/katchimeras/world/hex/mossprout_focused_v1_seed_nursery_hex_tile_512.webp'),
      thumb: require('../../../assets/images/katchimeras/world/hex/mossprout_focused_v1_seed_nursery_hex_tile_256.webp'),
    },
  },
  'bloom-garden': {
    alphaBounds: KINGDOM_HEX_TILE_ALPHA_BOUNDS['mossprout_focused_v1_bloom_garden_hex_tile.webp'],
    coord: { q: 1, r: 0 },
    sources: {
      full: require('../../../assets/images/katchimeras/world/hex/mossprout_focused_v1_bloom_garden_hex_tile.webp'),
      medium: require('../../../assets/images/katchimeras/world/hex/mossprout_focused_v1_bloom_garden_hex_tile_512.webp'),
      thumb: require('../../../assets/images/katchimeras/world/hex/mossprout_focused_v1_bloom_garden_hex_tile_256.webp'),
    },
  },
  'pond-sanctuary': {
    alphaBounds: KINGDOM_HEX_TILE_ALPHA_BOUNDS['mossprout_focused_v1_pond_sanctuary_hex_tile.webp'],
    coord: { q: -1, r: 2 },
    sources: {
      full: require('../../../assets/images/katchimeras/world/hex/mossprout_focused_v1_pond_sanctuary_hex_tile.webp'),
      medium: require('../../../assets/images/katchimeras/world/hex/mossprout_focused_v1_pond_sanctuary_hex_tile_512.webp'),
      thumb: require('../../../assets/images/katchimeras/world/hex/mossprout_focused_v1_pond_sanctuary_hex_tile_256.webp'),
    },
  },
  'orchard-grove': {
    alphaBounds: KINGDOM_HEX_TILE_ALPHA_BOUNDS['mossprout_focused_v1_orchard_grove_hex_tile.webp'],
    coord: { q: 1, r: 1 },
    sources: {
      full: require('../../../assets/images/katchimeras/world/hex/mossprout_focused_v1_orchard_grove_hex_tile.webp'),
      medium: require('../../../assets/images/katchimeras/world/hex/mossprout_focused_v1_orchard_grove_hex_tile_512.webp'),
      thumb: require('../../../assets/images/katchimeras/world/hex/mossprout_focused_v1_orchard_grove_hex_tile_256.webp'),
    },
  },
  'ancient-tree-grove': {
    alphaBounds: KINGDOM_HEX_TILE_ALPHA_BOUNDS['mossprout_focused_v1_ancient_tree_grove_hex_tile.webp'],
    coord: { q: -1, r: 3 },
    sources: {
      full: require('../../../assets/images/katchimeras/world/hex/mossprout_focused_v1_ancient_tree_grove_hex_tile.webp'),
      medium: require('../../../assets/images/katchimeras/world/hex/mossprout_focused_v1_ancient_tree_grove_hex_tile_512.webp'),
      thumb: require('../../../assets/images/katchimeras/world/hex/mossprout_focused_v1_ancient_tree_grove_hex_tile_256.webp'),
    },
  },
  'wildgrowth-grove': {
    alphaBounds: KINGDOM_HEX_TILE_ALPHA_BOUNDS['mossprout_focused_v1_wildgrowth_grove_hex_tile.webp'],
    coord: { q: 1, r: 2 },
    sources: {
      full: require('../../../assets/images/katchimeras/world/hex/mossprout_focused_v1_wildgrowth_grove_hex_tile.webp'),
      medium: require('../../../assets/images/katchimeras/world/hex/mossprout_focused_v1_wildgrowth_grove_hex_tile_512.webp'),
      thumb: require('../../../assets/images/katchimeras/world/hex/mossprout_focused_v1_wildgrowth_grove_hex_tile_256.webp'),
    },
  },
};

const REFERENCE_BOUNDS = KINGDOM_HEX_TILE_ALPHA_BOUNDS['floating_neighborhood_v2_neutral_hex_tile.webp'];

function mossproutHexPoint(coord: HexCoord) {
  const point = hexToWorld(coord, LAYOUT_PROFILE);
  return {
    x: point.x * NEIGHBORHOOD_SPACING_SCALE,
    y: point.y * NEIGHBORHOOD_SPACING_SCALE,
  };
}

function layerFor(id: string, kind: KingdomTileArtLayer['kind'], spec: ArtSpec): KingdomTileArtLayer {
  const point = mossproutHexPoint(spec.coord);
  const target = tileVisibleBounds(point.x, point.y);
  const frame = kingdomTileArtFrame({
    alignmentMode: 'ground-bottom',
    assetBounds: spec.alphaBounds,
    referenceBounds: REFERENCE_BOUNDS,
    target,
  });
  return {
    alphaBounds: spec.alphaBounds,
    coord: spec.coord,
    custom: true,
    depth: hexDrawDepth(point),
    fallbackSource: null,
    frame,
    interactionFrame: {
      height: target.bottom - target.top,
      left: target.left,
      top: target.top,
      width: target.right - target.left,
    },
    id,
    kind,
    source: spec.sources.full,
    sources: spec.sources,
    sourceSize: SOURCE_SIZE,
  };
}

function shiftLayer(layer: KingdomTileArtLayer, dx: number, dy: number): KingdomTileArtLayer {
  const shift = (frame: { height: number; left: number; top: number; width: number }) => ({
    ...frame,
    left: frame.left + dx,
    top: frame.top + dy,
  });
  return {
    ...layer,
    frame: shift(layer.frame),
    interactionFrame: layer.interactionFrame ? shift(layer.interactionFrame) : undefined,
    residentAnchor: layer.residentAnchor
      ? { x: layer.residentAnchor.x + dx, y: layer.residentAnchor.y + dy }
      : undefined,
  };
}

export function buildMossproutHexNeighborhoodScene(
  companionSlots: KingdomHexCompanionSlot[],
  natureIslandLevels: Record<MossproutNatureIslandId, MossproutNatureIslandLevel>,
): KingdomHexScene {
  const mossprout = companionSlots.find((slot) => slot.familyId === 'mossprout')
    ?? { id: 'family:mossprout', familyId: 'mossprout', kind: 'locked' as const, coord: MAIN.coord };
  const mainLayer = layerFor(mossprout.id, 'tile', MAIN);
  mainLayer.residentSource = MAIN_RESIDENT_SOURCE;
  mainLayer.residentAnchor = {
    x: mainLayer.frame.left + mainLayer.frame.width * 0.5,
    y: mainLayer.frame.top + mainLayer.frame.height * 0.49,
  };
  const rawLayers = [
    mainLayer,
    layerFor('structure:mossprout-hex-garden', 'structure', GARDEN),
    ...MOSSPROUT_NATURE_ISLANDS.flatMap((island) => (
      (natureIslandLevels[island.id] ?? 0) > 0
        ? [layerFor(`nature:mossprout:${island.id}`, 'tile', NATURE[island.id])]
        : []
    )),
  ];
  const left = Math.min(...rawLayers.map((layer) => layer.frame.left));
  const top = Math.min(...rawLayers.map((layer) => layer.frame.top));
  const right = Math.max(...rawLayers.map((layer) => layer.frame.left + layer.frame.width));
  const bottom = Math.max(...rawLayers.map((layer) => layer.frame.top + layer.frame.height));
  const dx = SCENE_PADDING - left;
  const dy = SCENE_PADDING - top;
  const layers = rawLayers.map((layer) => shiftLayer(layer, dx, dy)).sort((a, b) => a.depth - b.depth);
  const mainPoint = mossproutHexPoint(MAIN.coord);
  const centerTile: KingdomTileRender = {
    companion: mossprout,
    coord: MAIN.coord,
    cx: mainPoint.x + dx,
    cy: mainPoint.y + dy,
    depth: hexDrawDepth(mainPoint),
    id: mossprout.id,
    kind: 'companion',
  };
  return {
    centerTile,
    height: Math.ceil(bottom - top + SCENE_PADDING * 2),
    tileArtLayers: layers,
    tileById: new Map([[centerTile.id, centerTile]]),
    tiles: [centerTile],
    width: Math.ceil(right - left + SCENE_PADDING * 2),
  };
}
