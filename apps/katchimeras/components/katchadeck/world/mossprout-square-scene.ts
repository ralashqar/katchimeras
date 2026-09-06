import type { ImageSourcePropType } from 'react-native';

import type { KingdomHexScene, KingdomTileArtLayer, KingdomTileRender } from '@/components/katchadeck/world/kingdom-hex-scene';
import { MOSSPROUT_NATURE_ISLANDS } from '@/constants/mossprout-nature-islands';
import type { MossproutNatureIslandId, MossproutNatureIslandLevel } from '@/types/merge-world';
import type { KingdomHexCompanionSlot } from '@/utils/katchimera-kingdom-slots';
import {
  havenSquareZoneFrame,
  mossproutGardenFrame,
  MOSSPROUT_GARDEN_SOURCE_SIZE,
  MOSSPROUT_SQUARE_ZONES,
  mossproutNatureIslandFrame,
  mossproutSquareSceneMetrics,
  mossproutWorldFrame,
  type MossproutNatureIslandPosition,
} from '@/utils/haven-square-world';

const SOURCE_SIZE = { height: 1024, width: 1024 } as const;
const FULL_BOUNDS = { bottom: 1024, left: 0, right: 1024, top: 0 } as const;

const ENVIRONMENT_SOURCES = {
  full: require('@incubator/art-world/square/mossprout-main-environment.webp'),
  medium: require('@incubator/art-world/square/mossprout-main-environment-512.webp'),
  thumb: require('@incubator/art-world/square/mossprout-main-environment-256.webp'),
};
const GARDEN_SOURCES = {
  full: require('@incubator/art-world/square/mossprout-garden-hub-v2.webp'),
  medium: require('@incubator/art-world/square/mossprout-garden-hub-v2-512.webp'),
  thumb: require('@incubator/art-world/square/mossprout-garden-hub-v2-256.webp'),
};
const MOSSPROUT_STANDING_RESIDENT_SOURCE = require(
  '@incubator/art-world/square/mossprout-standing-resident-512.webp',
);

type NatureIslandSources = {
  full: ImageSourcePropType;
  medium: ImageSourcePropType;
  thumb: ImageSourcePropType;
};

/** Temporary art contract: every visible level uses the approved final-form master. */
const NATURE_ISLAND_SOURCES: Record<MossproutNatureIslandId, NatureIslandSources> = {
  'seed-nursery': {
    full: require('@incubator/art-world/square/mossprout-seed-nursery-l4.webp'),
    medium: require('@incubator/art-world/square/mossprout-seed-nursery-l4-512.webp'),
    thumb: require('@incubator/art-world/square/mossprout-seed-nursery-l4-256.webp'),
  },
  'bloom-garden': {
    full: require('@incubator/art-world/square/mossprout-bloom-garden-l4.webp'),
    medium: require('@incubator/art-world/square/mossprout-bloom-garden-l4-512.webp'),
    thumb: require('@incubator/art-world/square/mossprout-bloom-garden-l4-256.webp'),
  },
  'pond-sanctuary': {
    full: require('@incubator/art-world/square/mossprout-pond-sanctuary-l4.webp'),
    medium: require('@incubator/art-world/square/mossprout-pond-sanctuary-l4-512.webp'),
    thumb: require('@incubator/art-world/square/mossprout-pond-sanctuary-l4-256.webp'),
  },
  'orchard-grove': {
    full: require('@incubator/art-world/square/mossprout-orchard-grove-l4.webp'),
    medium: require('@incubator/art-world/square/mossprout-orchard-grove-l4-512.webp'),
    thumb: require('@incubator/art-world/square/mossprout-orchard-grove-l4-256.webp'),
  },
  'ancient-tree-grove': {
    full: require('@incubator/art-world/square/mossprout-ancient-tree-grove-l4.webp'),
    medium: require('@incubator/art-world/square/mossprout-ancient-tree-grove-l4-512.webp'),
    thumb: require('@incubator/art-world/square/mossprout-ancient-tree-grove-l4-256.webp'),
  },
  'wildgrowth-grove': {
    full: require('@incubator/art-world/square/mossprout-wildgrowth-grove-l4.webp'),
    medium: require('@incubator/art-world/square/mossprout-wildgrowth-grove-l4-512.webp'),
    thumb: require('@incubator/art-world/square/mossprout-wildgrowth-grove-l4-256.webp'),
  },
};

const POSITIONS: Record<MossproutNatureIslandId, MossproutNatureIslandPosition> = {
  'seed-nursery': 'upper-left',
  'bloom-garden': 'upper-right',
  'pond-sanctuary': 'middle-left',
  'orchard-grove': 'middle-right',
  'ancient-tree-grove': 'lower-left',
  'wildgrowth-grove': 'lower-right',
};

function natureIslandLayers(
  levels: Record<MossproutNatureIslandId, MossproutNatureIslandLevel>,
): KingdomTileArtLayer[] {
  return MOSSPROUT_NATURE_ISLANDS.flatMap((island, index) => {
    const level = levels[island.id] ?? 0;
    if (level < 1) return [];
    const frame = mossproutNatureIslandFrame(POSITIONS[island.id]);
    const row = Math.floor(index / 2);
    const depth = 1 + row * 3;
    const sources = NATURE_ISLAND_SOURCES[island.id];
    return [{
      alphaBounds: FULL_BOUNDS,
      coord: { q: index % 2 === 0 ? -1 : 1, r: row },
      custom: true,
      depth,
      fallbackSource: null,
      frame,
      interactionFrame: frame,
      id: `nature:mossprout:${island.id}`,
      kind: 'tile',
      source: sources.full,
      sources,
      sourceSize: SOURCE_SIZE,
    } satisfies KingdomTileArtLayer];
  });
}

/** The focused world contains only Mossprout-owned visual and interaction layers. */
export function buildMossproutSquareScene(
  companionSlots: KingdomHexCompanionSlot[],
  natureIslandLevels: Record<MossproutNatureIslandId, MossproutNatureIslandLevel>,
): KingdomHexScene {
  const mossprout = companionSlots.find((slot) => slot.familyId === 'mossprout')
    ?? { id: 'family:mossprout', familyId: 'mossprout', kind: 'locked' as const, coord: { q: 0, r: 0 } };
  const environmentZone = MOSSPROUT_SQUARE_ZONES.find((zone) => zone.id === 'mossprout-environment')!;
  const gardenZone = MOSSPROUT_SQUARE_ZONES.find((zone) => zone.id === 'mossprout-garden')!;
  const environmentFrame = mossproutWorldFrame(havenSquareZoneFrame(environmentZone.coord));
  const gardenFrame = mossproutGardenFrame();

  const environmentTile: KingdomTileRender = {
    companion: mossprout,
    coord: { q: 0, r: 0 },
    cx: environmentFrame.left + environmentFrame.width / 2,
    cy: environmentFrame.top + environmentFrame.height / 2,
    depth: 1,
    id: mossprout.id,
    kind: 'companion',
    squareCoord: environmentZone.coord,
  };
  const environmentLayer: KingdomTileArtLayer = {
    alphaBounds: FULL_BOUNDS,
    coord: environmentTile.coord,
    custom: true,
    depth: 0,
    fallbackSource: null,
    frame: environmentFrame,
    id: environmentTile.id,
    kind: 'tile',
    residentAnchor: {
      x: environmentFrame.left + environmentFrame.width * 0.5,
      y: environmentFrame.top + environmentFrame.height * 0.47,
    },
    residentSource: MOSSPROUT_STANDING_RESIDENT_SOURCE,
    source: ENVIRONMENT_SOURCES.full,
    sources: ENVIRONMENT_SOURCES,
    sourceSize: SOURCE_SIZE,
    squareCoord: environmentZone.coord,
  };
  const gardenLayer: KingdomTileArtLayer = {
    alphaBounds: { bottom: MOSSPROUT_GARDEN_SOURCE_SIZE.height, left: 0, right: MOSSPROUT_GARDEN_SOURCE_SIZE.width, top: 0 },
    coord: { q: 0, r: 1 },
    custom: true,
    depth: 5,
    fallbackSource: null,
    frame: gardenFrame,
    id: 'structure:mossprout-square-garden',
    interactionFrame: gardenFrame,
    kind: 'structure',
    source: GARDEN_SOURCES.full,
    sources: GARDEN_SOURCES,
    sourceSize: MOSSPROUT_GARDEN_SOURCE_SIZE,
    squareCoord: gardenZone.coord,
  };
  const metrics = mossproutSquareSceneMetrics();
  return {
    centerTile: environmentTile,
    height: metrics.height,
    tileArtLayers: [environmentLayer, gardenLayer, ...natureIslandLayers(natureIslandLevels)]
      .sort((left, right) => left.depth - right.depth),
    tileById: new Map([[environmentTile.id, environmentTile]]),
    tiles: [environmentTile],
    width: metrics.width,
  };
}
