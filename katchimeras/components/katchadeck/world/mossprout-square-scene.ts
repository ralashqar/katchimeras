import type { KingdomHexScene, KingdomTileArtLayer, KingdomTileRender } from '@/components/katchadeck/world/kingdom-hex-scene';
import type { KingdomHexCompanionSlot } from '@/utils/katchimera-kingdom-slots';
import {
  havenSquareZoneFrame,
  MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS,
  MOSSPROUT_SQUARE_ZONES,
  mossproutGardenEastNatureIslandFrame,
  mossproutGardenWestNatureIslandFrame,
  mossproutSquareSceneMetrics,
  mossproutWorldFrame,
} from '@/utils/haven-square-world';

const SOURCE_SIZE = { height: 1024, width: 1024 } as const;
const FULL_BOUNDS = { bottom: 1024, left: 0, right: 1024, top: 0 } as const;

const ENVIRONMENT_SOURCES = {
  full: require('../../../assets/images/katchimeras/world/square/mossprout-main-environment.webp'),
  medium: require('../../../assets/images/katchimeras/world/square/mossprout-main-environment-512.webp'),
  thumb: require('../../../assets/images/katchimeras/world/square/mossprout-main-environment-256.webp'),
};
const GARDEN_SOURCES = {
  full: require('../../../assets/images/katchimeras/world/square/mossprout-merge-island-perspective.webp'),
  medium: require('../../../assets/images/katchimeras/world/square/mossprout-merge-island-perspective-512.webp'),
  thumb: require('../../../assets/images/katchimeras/world/square/mossprout-merge-island-perspective-256.webp'),
};
const MOSSPROUT_STANDING_RESIDENT_SOURCE = require(
  '../../../assets/images/katchimeras/world/square/mossprout-standing-resident-512.webp',
);

const NATURE_ISLAND_ORIGINAL_SOURCE_SIZE = { height: 512, width: 512 } as const;
const WEST_NATURE_ISLAND_CROP = { bottom: 480, left: 79, right: 433, top: 32 } as const;
const EAST_NATURE_ISLAND_CROP = { bottom: 480, left: 66, right: 445, top: 32 } as const;
const WEST_NATURE_ISLAND_SOURCE_SIZE = { height: 448, width: 354 } as const;
const EAST_NATURE_ISLAND_SOURCE_SIZE = { height: 448, width: 379 } as const;
const NATURE_ISLAND_SOURCE = require('../../../assets/images/katchimeras/world/square/nature-island-512.webp');
const EAST_NATURE_ISLAND_SOURCE = require('../../../assets/images/katchimeras/world/square/nature-island-east-512.webp');

function cropArtFrame(
  frame: { height: number; left: number; top: number; width: number },
  crop: { bottom: number; left: number; right: number; top: number },
) {
  const scaleX = frame.width / NATURE_ISLAND_ORIGINAL_SOURCE_SIZE.width;
  const scaleY = frame.height / NATURE_ISLAND_ORIGINAL_SOURCE_SIZE.height;
  return {
    height: (crop.bottom - crop.top) * scaleY,
    left: frame.left + crop.left * scaleX,
    top: frame.top + crop.top * scaleY,
    width: (crop.right - crop.left) * scaleX,
  };
}

function interactionFrame(frame: { left: number; top: number; width: number; height: number }) {
  const bounds = MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS;
  return {
    height: ((bounds.bottom - bounds.top) / SOURCE_SIZE.height) * frame.height,
    left: frame.left + (bounds.left / SOURCE_SIZE.width) * frame.width,
    top: frame.top + (bounds.top / SOURCE_SIZE.height) * frame.height,
    width: ((bounds.right - bounds.left) / SOURCE_SIZE.width) * frame.width,
  };
}

/** The focused world contains only Mossprout-owned visual and interaction layers. */
export function buildMossproutSquareScene(companionSlots: KingdomHexCompanionSlot[]): KingdomHexScene {
  const mossprout = companionSlots.find((slot) => slot.familyId === 'mossprout')
    ?? { id: 'family:mossprout', familyId: 'mossprout', kind: 'locked' as const, coord: { q: 0, r: 0 } };
  const environmentZone = MOSSPROUT_SQUARE_ZONES.find((zone) => zone.id === 'mossprout-environment')!;
  const gardenZone = MOSSPROUT_SQUARE_ZONES.find((zone) => zone.id === 'mossprout-garden')!;
  const environmentFrame = mossproutWorldFrame(havenSquareZoneFrame(environmentZone.coord));
  const gardenFrame = mossproutWorldFrame(havenSquareZoneFrame(gardenZone.coord));
  const westNatureFrame = cropArtFrame(mossproutGardenWestNatureIslandFrame(), WEST_NATURE_ISLAND_CROP);
  const eastNatureFrame = cropArtFrame(mossproutGardenEastNatureIslandFrame(), EAST_NATURE_ISLAND_CROP);

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
    alphaBounds: FULL_BOUNDS,
    coord: { q: 0, r: 1 },
    custom: true,
    depth: 2,
    fallbackSource: null,
    frame: gardenFrame,
    id: 'structure:mossprout-square-garden',
    interactionFrame: interactionFrame(gardenFrame),
    kind: 'structure',
    source: GARDEN_SOURCES.full,
    sources: GARDEN_SOURCES,
    sourceSize: SOURCE_SIZE,
    squareCoord: gardenZone.coord,
  };
  const westNatureLayer: KingdomTileArtLayer = {
    alphaBounds: { bottom: WEST_NATURE_ISLAND_SOURCE_SIZE.height, left: 0, right: WEST_NATURE_ISLAND_SOURCE_SIZE.width, top: 0 },
    coord: { q: -1, r: 1 },
    custom: true,
    depth: 3,
    fallbackSource: null,
    frame: westNatureFrame,
    id: 'decor:mossprout-garden-west-nature-island',
    kind: 'tile',
    source: NATURE_ISLAND_SOURCE,
    sources: { full: NATURE_ISLAND_SOURCE, medium: NATURE_ISLAND_SOURCE, thumb: NATURE_ISLAND_SOURCE },
    sourceSize: WEST_NATURE_ISLAND_SOURCE_SIZE,
  };
  const eastNatureLayer: KingdomTileArtLayer = {
    ...westNatureLayer,
    alphaBounds: { bottom: EAST_NATURE_ISLAND_SOURCE_SIZE.height, left: 0, right: EAST_NATURE_ISLAND_SOURCE_SIZE.width, top: 0 },
    coord: { q: 1, r: 1 },
    frame: eastNatureFrame,
    id: 'decor:mossprout-garden-east-nature-island',
    source: EAST_NATURE_ISLAND_SOURCE,
    sources: { full: EAST_NATURE_ISLAND_SOURCE, medium: EAST_NATURE_ISLAND_SOURCE, thumb: EAST_NATURE_ISLAND_SOURCE },
    sourceSize: EAST_NATURE_ISLAND_SOURCE_SIZE,
  };
  const metrics = mossproutSquareSceneMetrics();
  return {
    centerTile: environmentTile,
    height: metrics.height,
    tileArtLayers: [environmentLayer, gardenLayer, westNatureLayer, eastNatureLayer]
      .sort((left, right) => left.depth - right.depth),
    tileById: new Map([[environmentTile.id, environmentTile]]),
    tiles: [environmentTile],
    width: metrics.width,
  };
}
