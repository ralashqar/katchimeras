import type { ImageSourcePropType } from 'react-native';

import type { KingdomHexScene, KingdomTileArtLayer, KingdomTileRender } from '@/components/katchadeck/world/kingdom-hex-scene';
import { KINGDOM_HEX_TILE_ALPHA_BOUNDS } from '@/constants/kingdom-hex-tile-bounds.gen';
import { MOSSPROUT_NATURE_ISLANDS } from '@/constants/mossprout-nature-islands';
import { STEPPLING_TILE, SHARED_WORLD_TILES } from '@/constants/shared-world';
import { mossproutMemoryPlantById, mossproutMemoryPlantStage } from '@/constants/mossprout-memory-plants';
import type { MossproutGardenPlantSlotId, MossproutNatureIslandId, MossproutNatureIslandLevel, PlantableMemoryInstance } from '@/types/merge-world';
import type { KingdomHexCompanionSlot } from '@/utils/katchimera-kingdom-slots';
import { kingdomTileArtFrame } from '@/utils/kingdom-tile-alignment';
import { hexDrawDepth, hexToWorld, type HexCoord } from '@/utils/world-hex';
import { tileVisibleBounds } from '@/components/katchadeck/world/kingdom-hex-scene';
import { GARDEN_PLANT_SLOT_POSITIONS, mossproutGardenPlantSlotFrame } from '@/utils/mossprout-garden-layout';

export { mossproutGardenPlantSlotFrame } from '@/utils/mossprout-garden-layout';

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
  coord: SHARED_WORLD_TILES['mossprout-home'].coord,
  sources: {
    full: require('../../../assets/images/katchimeras/world/hex/mossprout_focused_v1_main_hex_tile.webp'),
    medium: require('../../../assets/images/katchimeras/world/hex/mossprout_focused_v1_main_hex_tile_512.webp'),
    thumb: require('../../../assets/images/katchimeras/world/hex/mossprout_focused_v1_main_hex_tile_256.webp'),
  },
};

const GARDEN_LEVELS: Record<0 | 1 | 2, ArtSpec> = {
  0: {
  alphaBounds: { left: 25, top: 59, right: 995, bottom: 961 },
  coord: { q: 0, r: 2 },
  sources: {
    full: require('../../../assets/images/katchimeras/world/hex/mossprout_memory_garden_level_0.webp'),
    medium: require('../../../assets/images/katchimeras/world/hex/mossprout_memory_garden_level_0_512.webp'),
    thumb: require('../../../assets/images/katchimeras/world/hex/mossprout_memory_garden_level_0_256.webp'),
  },
  },
  1: {
    alphaBounds: { left: 11, top: 48, right: 1000, bottom: 992 },
    coord: { q: 0, r: 2 },
    sources: {
      full: require('../../../assets/images/katchimeras/world/hex/mossprout_memory_garden_level_1.webp'),
      medium: require('../../../assets/images/katchimeras/world/hex/mossprout_memory_garden_level_1_512.webp'),
      thumb: require('../../../assets/images/katchimeras/world/hex/mossprout_memory_garden_level_1_256.webp'),
    },
  },
  2: {
    alphaBounds: { left: 11, top: 48, right: 1000, bottom: 992 },
    coord: { q: 0, r: 2 },
    sources: {
      full: require('../../../assets/images/katchimeras/world/hex/mossprout_memory_garden_level_2.webp'),
      medium: require('../../../assets/images/katchimeras/world/hex/mossprout_memory_garden_level_2_512.webp'),
      thumb: require('../../../assets/images/katchimeras/world/hex/mossprout_memory_garden_level_2_256.webp'),
    },
  },
};

// Every Garden level is authored on the same 1024px canvas. Use one union
// silhouette for layout so tiny alpha-edge differences between exports can
// never move or resize the world object when its source changes.
const GARDEN_LAYOUT_BOUNDS = Object.values(GARDEN_LEVELS).reduce<ArtSpec['alphaBounds']>(
  (bounds, level) => ({
    bottom: Math.max(bounds.bottom, level.alphaBounds.bottom),
    left: Math.min(bounds.left, level.alphaBounds.left),
    right: Math.max(bounds.right, level.alphaBounds.right),
    top: Math.min(bounds.top, level.alphaBounds.top),
  }),
  { bottom: 0, left: SOURCE_SIZE.width, right: 0, top: SOURCE_SIZE.height },
);

export type MossproutGardenSceneState = {
  gateway?: 'locked' | 'egg' | 'open';
  level: number;
  plantableMemories: readonly PlantableMemoryInstance[];
  featureLevels?: { spring: number; path: number };
};

// Every memory-plant export is normalized to a 384px square with its planting
// contact at y=366. Anchor that contact—not the image box—to the bed centre.
const MEMORY_PLANT_ART_CONTACT_Y = 366 / 384;

export const MOSSPROUT_GARDEN_PLANT_SLOT_IDS = Object.keys(GARDEN_PLANT_SLOT_POSITIONS) as MossproutGardenPlantSlotId[];

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

function layerFor(
  id: string,
  kind: KingdomTileArtLayer['kind'],
  spec: ArtSpec,
  layoutBounds = spec.alphaBounds,
): KingdomTileArtLayer {
  const point = mossproutHexPoint(spec.coord);
  const target = tileVisibleBounds(point.x, point.y);
  const frame = kingdomTileArtFrame({
    alignmentMode: 'ground-bottom',
    assetBounds: layoutBounds,
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
    GARDEN_LAYOUT_BOUNDS,
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
      frame: { left: baseX - size / 2, top: baseY - size * MEMORY_PLANT_ART_CONTACT_Y, width: size, height: size },
      interactionFrame: mossproutGardenPlantSlotFrame(gardenLayer.frame, plant.slotId),
      id: `plant:${plant.id}`,
      kind: 'structure',
      source: definition.art[mossproutMemoryPlantStage(plant.growthPoints)],
      sourceSize: { width: 384, height: 384 },
    }];
  });
  const stepplingLayer = (locked: boolean) => layerFor('structure:steppling-home', 'structure', {
      coord: STEPPLING_TILE.coord,
      alphaBounds: locked ? DREAM_MIST_LOCKED_NATURE_ALPHA_BOUNDS : KINGDOM_HEX_TILE_ALPHA_BOUNDS['floating_neighborhood_v2_steppling_haven_stage_0_hex_tile.webp'],
      sources: locked ? DREAM_MIST_LOCKED_NATURE_SOURCES : {
        full: require('../../../assets/images/katchimeras/world/hex/floating_neighborhood_v2_steppling_haven_stage_0_hex_tile.webp'),
        medium: require('../../../assets/images/katchimeras/world/hex/floating_neighborhood_v2_steppling_haven_stage_0_hex_tile_512.webp'),
        thumb: require('../../../assets/images/katchimeras/world/hex/floating_neighborhood_v2_steppling_haven_stage_0_hex_tile_256.webp'),
      },
    });
  const lockedSteppling = stepplingLayer(true);
  const revealedSteppling = stepplingLayer(false);
  revealedSteppling.residentAnchor = mossproutHexPoint(STEPPLING_TILE.coord);
  const rawLayers = [
    mainLayer, gardenLayer, ...plantLayers,
    !gardenState.gateway || gardenState.gateway === 'locked' ? lockedSteppling : revealedSteppling,
    ...MOSSPROUT_NATURE_ISLANDS.map((island) => natureLayerFor(
      island.id,
      natureIslandLevels[island.id] ?? 0,
    )),
  ];
  // Reserve both art envelopes so changing mist to terrain never shifts the world.
  const boundsLayers = [...rawLayers, lockedSteppling, revealedSteppling];
  const left = Math.min(...boundsLayers.map((layer) => layer.frame.left));
  const top = Math.min(...boundsLayers.map((layer) => layer.frame.top));
  const right = Math.max(...boundsLayers.map((layer) => layer.frame.left + layer.frame.width));
  const bottom = Math.max(...boundsLayers.map((layer) => layer.frame.top + layer.frame.height));
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
  const residentTiles: KingdomTileRender[] = Object.values(SHARED_WORLD_TILES).flatMap((entry) => {
    if (entry.companion === 'mossprout') return [];
    // Discovery-only tiles never inherit an owned/dev resident projection.
    if ('residentVisible' in entry && !entry.residentVisible) return [];
    const slot = companionSlots.find((candidate) => candidate.familyId === entry.companion && candidate.kind === 'owned');
    if (!slot) return [];
    const point = mossproutHexPoint(entry.coord);
    return [{ companion: slot, coord: entry.coord, cx: point.x + dx, cy: point.y + dy, depth: hexDrawDepth(point), id: slot.id, kind: 'companion' as const }];
  });
  const tiles = [centerTile, ...residentTiles];
  return {
    centerTile,
    height: Math.ceil(bottom - top + SCENE_PADDING * 2),
    tileArtLayers: layers,
    tileById: new Map(tiles.map((tile) => [tile.id, tile])),
    tiles,
    width: Math.ceil(right - left + SCENE_PADDING * 2),
  };
}
