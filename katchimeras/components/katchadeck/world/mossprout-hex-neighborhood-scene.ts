import type { ImageSourcePropType } from 'react-native';

import type { KingdomHexScene, KingdomTileArtLayer, KingdomTileRender } from '@/components/katchadeck/world/kingdom-hex-scene';
import { KINGDOM_HEX_TILE_ALPHA_BOUNDS } from '@/constants/kingdom-hex-tile-bounds.gen';
import { MOSSPROUT_NATURE_ISLANDS } from '@/constants/mossprout-nature-islands';
import { mossproutMemoryPlantById, mossproutMemoryPlantStage } from '@/constants/mossprout-memory-plants';
import type { MossproutGardenPlantSlotId, MossproutNatureIslandId, MossproutNatureIslandLevel, PlantableMemoryInstance } from '@/types/merge-world';
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

const GARDEN_LEVELS: Record<0 | 1 | 2, ArtSpec> = {
  0: {
  alphaBounds: { left: 29, top: 69, right: 999, bottom: 966 },
  coord: { q: 0, r: 2 },
  sources: {
    full: require('../../../assets/images/katchimeras/world/hex/mossprout_memory_garden_level_0.webp'),
    medium: require('../../../assets/images/katchimeras/world/hex/mossprout_memory_garden_level_0_512.webp'),
    thumb: require('../../../assets/images/katchimeras/world/hex/mossprout_memory_garden_level_0_256.webp'),
  },
  },
  1: {
    alphaBounds: { left: 28, top: 69, right: 997, bottom: 967 },
    coord: { q: 0, r: 2 },
    sources: {
      full: require('../../../assets/images/katchimeras/world/hex/mossprout_memory_garden_level_1.webp'),
      medium: require('../../../assets/images/katchimeras/world/hex/mossprout_memory_garden_level_1_512.webp'),
      thumb: require('../../../assets/images/katchimeras/world/hex/mossprout_memory_garden_level_1_256.webp'),
    },
  },
  2: {
    alphaBounds: { left: 29, top: 69, right: 995, bottom: 966 },
    coord: { q: 0, r: 2 },
    sources: {
      full: require('../../../assets/images/katchimeras/world/hex/mossprout_memory_garden_level_2.webp'),
      medium: require('../../../assets/images/katchimeras/world/hex/mossprout_memory_garden_level_2_512.webp'),
      thumb: require('../../../assets/images/katchimeras/world/hex/mossprout_memory_garden_level_2_256.webp'),
    },
  },
};

export type MossproutGardenSceneState = {
  level: number;
  plantableMemories: readonly PlantableMemoryInstance[];
  movementEggStatus?: 'hidden' | 'revealed' | 'stirring';
  featureLevels?: { spring: number; path: number };
};

const GARDEN_PLANT_SLOT_POSITIONS = {
  'back-left': { x: 0.39, y: 0.42 },
  'back-centre': { x: 0.55, y: 0.35 },
  'back-right': { x: 0.72, y: 0.37 },
  'front-left': { x: 0.29, y: 0.52 },
  'front-centre': { x: 0.50, y: 0.50 },
  'front-right': { x: 0.69, y: 0.49 },
} as const;

export const MOSSPROUT_GARDEN_PLANT_SLOT_IDS = Object.keys(GARDEN_PLANT_SLOT_POSITIONS) as MossproutGardenPlantSlotId[];

export function mossproutGardenPlantSlotFrame(
  gardenFrame: { height: number; left: number; top: number; width: number },
  slotId: MossproutGardenPlantSlotId,
) {
  const position = GARDEN_PLANT_SLOT_POSITIONS[slotId];
  // This is the semantic planting patch, not merely the visible Seed cutout.
  // Keep it generous enough for spotlighting and future direct placement.
  const size = gardenFrame.width * 0.24;
  const baseX = gardenFrame.left + gardenFrame.width * position.x;
  const baseY = gardenFrame.top + gardenFrame.height * position.y;
  return {
    left: baseX - size * 0.5,
    top: baseY - size * 0.64,
    width: size,
    height: size * 0.7,
  };
}

const DREAM_MIST_LOCKED_NATURE_SOURCES: TileSources = {
  full: require('../../../assets/images/katchimeras/world/hex/dream_mist_locked_hex_tile_v1.webp'),
  medium: require('../../../assets/images/katchimeras/world/hex/dream_mist_locked_hex_tile_v1_512.webp'),
  thumb: require('../../../assets/images/katchimeras/world/hex/dream_mist_locked_hex_tile_v1_256.webp'),
};
const DREAM_MIST_LOCKED_NATURE_ALPHA_BOUNDS = KINGDOM_HEX_TILE_ALPHA_BOUNDS['dream_mist_locked_hex_tile_v1.webp'];

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

function natureLayerFor(
  islandId: MossproutNatureIslandId,
  level: MossproutNatureIslandLevel,
): KingdomTileArtLayer {
  const authored = NATURE[islandId];
  const locked = level === 0;
  const rendered = locked
    ? {
        alphaBounds: DREAM_MIST_LOCKED_NATURE_ALPHA_BOUNDS,
        coord: authored.coord,
        sources: DREAM_MIST_LOCKED_NATURE_SOURCES,
      }
    : authored;
  const result = layerFor(`nature:mossprout:${islandId}`, 'tile', rendered);
  // A mist tile establishes the complete neighborhood silhouette but is not
  // an upgrade target until progression replaces it with Level 1 island art.
  return locked ? { ...result, interactionFrame: undefined } : result;
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
  gardenState: MossproutGardenSceneState = { level: 0, plantableMemories: [] },
): KingdomHexScene {
  const mossprout = companionSlots.find((slot) => slot.familyId === 'mossprout')
    ?? { id: 'family:mossprout', familyId: 'mossprout', kind: 'locked' as const, coord: MAIN.coord };
  const mainLayer = layerFor(mossprout.id, 'tile', MAIN);
  mainLayer.residentSource = MAIN_RESIDENT_SOURCE;
  mainLayer.residentAnchor = {
    x: mainLayer.frame.left + mainLayer.frame.width * 0.5,
    y: mainLayer.frame.top + mainLayer.frame.height * 0.49,
  };
  const gardenArtLevel: 0 | 1 | 2 = gardenState.level <= 0
    ? 0
    : (gardenState.featureLevels?.spring ?? 0) > 0 && (gardenState.featureLevels?.path ?? 0) > 0 ? 2 : 1;
  const gardenLayer = layerFor(
    'structure:mossprout-hex-garden',
    'structure',
    GARDEN_LEVELS[gardenArtLevel],
  );
  const plantLayers = gardenState.plantableMemories.flatMap((plant): KingdomTileArtLayer[] => {
    if (plant.status !== 'planted' || !plant.slotId) return [];
    const definition = mossproutMemoryPlantById.get(plant.definitionId);
    const position = GARDEN_PLANT_SLOT_POSITIONS[plant.slotId];
    if (!definition || !position) return [];
    const size = gardenLayer.frame.width * 0.18;
    const baseX = gardenLayer.frame.left + gardenLayer.frame.width * position.x;
    const baseY = gardenLayer.frame.top + gardenLayer.frame.height * position.y;
    return [{
      alphaBounds: { left: 0, top: 0, right: 384, bottom: 384 },
      coord: GARDEN_LEVELS[0].coord,
      custom: true,
      depth: gardenLayer.depth + 1 + position.y,
      fallbackSource: null,
      frame: { left: baseX - size / 2, top: baseY - size * 0.82, width: size, height: size },
      interactionFrame: mossproutGardenPlantSlotFrame(gardenLayer.frame, plant.slotId),
      id: `plant:${plant.id}`,
      kind: 'structure',
      source: definition.art[mossproutMemoryPlantStage(plant.growthPoints)],
      sourceSize: { width: 384, height: 384 },
    }];
  });
  const movementEggLayer: KingdomTileArtLayer | null = gardenState.movementEggStatus && gardenState.movementEggStatus !== 'hidden'
    ? (() => {
        const size = gardenLayer.frame.width * 0.17;
        const baseX = gardenLayer.frame.left + gardenLayer.frame.width * 0.80;
        const baseY = gardenLayer.frame.top + gardenLayer.frame.height * 0.27;
        return {
          alphaBounds: { left: 0, top: 0, right: 1024, bottom: 1024 },
          coord: GARDEN_LEVELS[0].coord,
          custom: true,
          depth: gardenLayer.depth + 1.25,
          fallbackSource: null,
          frame: { left: baseX - size / 2, top: baseY - size * 0.82, width: size, height: size },
          interactionFrame: { left: baseX - size * 0.35, top: baseY - size * 0.68, width: size * 0.7, height: size * 0.7 },
          id: 'structure:mossprout-movement-egg',
          kind: 'structure',
          source: require('../../../assets/images/katchimeras/cutouts/egg-base.webp'),
          sourceSize: SOURCE_SIZE,
        };
      })()
    : null;
  const rawLayers = [
    mainLayer,
    gardenLayer,
    ...plantLayers,
    ...(movementEggLayer ? [movementEggLayer] : []),
    ...MOSSPROUT_NATURE_ISLANDS.map((island) => natureLayerFor(
      island.id,
      natureIslandLevels[island.id] ?? 0,
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
