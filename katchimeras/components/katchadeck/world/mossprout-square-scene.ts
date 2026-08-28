import type { KingdomHexScene, KingdomTileArtLayer, KingdomTileRender } from '@/components/katchadeck/world/kingdom-hex-scene';
import type { KingdomHexCompanionSlot } from '@/utils/katchimera-kingdom-slots';
import {
  havenSquareZoneFrame,
  MOSSPROUT_GARDEN_GRID_SOURCE_BOUNDS,
  MOSSPROUT_SQUARE_ZONES,
  mossproutSquareSceneMetrics,
} from '@/utils/haven-square-world';

const SOURCE_SIZE = { height: 1024, width: 1024 } as const;
const FULL_BOUNDS = { bottom: 1024, left: 0, right: 1024, top: 0 } as const;

const ENVIRONMENT_SOURCES = {
  full: require('../../../assets/images/katchimeras/world/square/mossprout-main-environment.webp'),
  medium: require('../../../assets/images/katchimeras/world/square/mossprout-main-environment-512.webp'),
  thumb: require('../../../assets/images/katchimeras/world/square/mossprout-main-environment-256.webp'),
};

const GARDEN_SOURCES = {
  full: require('../../../assets/images/katchimeras/world/square/mossprout-garden-7x6.webp'),
  medium: require('../../../assets/images/katchimeras/world/square/mossprout-garden-7x6-512.webp'),
  thumb: require('../../../assets/images/katchimeras/world/square/mossprout-garden-7x6-256.webp'),
};

function interactionFrame(frame: { left: number; top: number; width: number; height: number }) {
  const bounds = MOSSPROUT_GARDEN_GRID_SOURCE_BOUNDS;
  return {
    height: ((bounds.bottom - bounds.top) / SOURCE_SIZE.height) * frame.height,
    left: frame.left + (bounds.left / SOURCE_SIZE.width) * frame.width,
    top: frame.top + (bounds.top / SOURCE_SIZE.height) * frame.height,
    width: ((bounds.right - bounds.left) / SOURCE_SIZE.width) * frame.width,
  };
}

export function buildMossproutSquareScene(companionSlots: KingdomHexCompanionSlot[]): KingdomHexScene {
  const mossprout = companionSlots.find((slot) => slot.familyId === 'mossprout')
    ?? { id: 'family:mossprout', familyId: 'mossprout', kind: 'locked' as const, coord: { q: 0, r: 0 } };
  const environmentZone = MOSSPROUT_SQUARE_ZONES[0];
  const gardenZone = MOSSPROUT_SQUARE_ZONES[1];
  const environmentFrame = havenSquareZoneFrame(environmentZone.coord);
  const gardenFrame = havenSquareZoneFrame(gardenZone.coord);
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
    source: ENVIRONMENT_SOURCES.full,
    sources: ENVIRONMENT_SOURCES,
    sourceSize: { width: SOURCE_SIZE.width, height: SOURCE_SIZE.height },
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
    sourceSize: { width: SOURCE_SIZE.width, height: SOURCE_SIZE.height },
    squareCoord: gardenZone.coord,
  };
  const metrics = mossproutSquareSceneMetrics();
  return {
    centerTile: environmentTile,
    height: metrics.height,
    tileArtLayers: [environmentLayer, gardenLayer],
    tileById: new Map([[environmentTile.id, environmentTile]]),
    tiles: [environmentTile],
    width: metrics.width,
  };
}

