import type { KingdomHexScene, KingdomTileArtLayer, KingdomTileRender } from '@/components/katchadeck/world/kingdom-hex-scene';
import type { KingdomHexCompanionSlot } from '@/utils/katchimera-kingdom-slots';
import {
  baristabbitMossproutBridgeFrame,
  havenSquareZoneFrame,
  MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS,
  MOSSPROUT_SQUARE_ZONES,
  mossproutEggHomeBridgeFrame,
  mossproutSquareSceneMetrics,
} from '@/utils/haven-square-world';

const SOURCE_SIZE = { height: 1024, width: 1024 } as const;
const FULL_BOUNDS = { bottom: 1024, left: 0, right: 1024, top: 0 } as const;
const BRIDGE_SOURCE_SIZE = { height: 455, width: 1024 } as const;
const BRIDGE_BOUNDS = { bottom: 364, left: 42, right: 982, top: 125 } as const;

const ENVIRONMENT_SOURCES = {
  full: require('../../../assets/images/katchimeras/world/square/mossprout-main-environment.webp'),
  medium: require('../../../assets/images/katchimeras/world/square/mossprout-main-environment-512.webp'),
  thumb: require('../../../assets/images/katchimeras/world/square/mossprout-main-environment-256.webp'),
};

const BARISTABBIT_CAFE_SOURCES = {
  full: require('../../../assets/images/katchimeras/world/square/baristabbit-cafe-island.webp'),
  medium: require('../../../assets/images/katchimeras/world/square/baristabbit-cafe-island-512.webp'),
  thumb: require('../../../assets/images/katchimeras/world/square/baristabbit-cafe-island-256.webp'),
};

const GARDEN_SOURCES = {
  full: require('../../../assets/images/katchimeras/world/square/mossprout-merge-island-perspective.webp'),
  medium: require('../../../assets/images/katchimeras/world/square/mossprout-merge-island-perspective-512.webp'),
  thumb: require('../../../assets/images/katchimeras/world/square/mossprout-merge-island-perspective-256.webp'),
};

const EGG_HOME_SOURCES = {
  full: require('../../../assets/images/katchimeras/world/square/egg-home-island.webp'),
  medium: require('../../../assets/images/katchimeras/world/square/egg-home-island-512.webp'),
  thumb: require('../../../assets/images/katchimeras/world/square/egg-home-island-256.webp'),
};

const HORIZONTAL_BRIDGE_SOURCES = {
  full: require('../../../assets/images/katchimeras/world/square/bridge-straight-horizontal-perspective.webp'),
  medium: require('../../../assets/images/katchimeras/world/square/bridge-straight-horizontal-perspective-512.webp'),
  thumb: require('../../../assets/images/katchimeras/world/square/bridge-straight-horizontal-perspective-256.webp'),
};

function interactionFrame(frame: { left: number; top: number; width: number; height: number }) {
  const bounds = MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS;
  return {
    height: ((bounds.bottom - bounds.top) / SOURCE_SIZE.height) * frame.height,
    left: frame.left + (bounds.left / SOURCE_SIZE.width) * frame.width,
    top: frame.top + (bounds.top / SOURCE_SIZE.height) * frame.height,
    width: ((bounds.right - bounds.left) / SOURCE_SIZE.width) * frame.width,
  };
}

export function buildMossproutSquareScene(companionSlots: KingdomHexCompanionSlot[]): KingdomHexScene {
  const baristabbit = companionSlots.find((slot) => slot.familyId === 'baristabbit')
    ?? { id: 'family:baristabbit', familyId: 'baristabbit', kind: 'locked' as const, coord: { q: -1, r: 0 } };
  const mossprout = companionSlots.find((slot) => slot.familyId === 'mossprout')
    ?? { id: 'family:mossprout', familyId: 'mossprout', kind: 'locked' as const, coord: { q: 0, r: 0 } };
  const baristabbitZone = MOSSPROUT_SQUARE_ZONES.find((zone) => zone.id === 'baristabbit-cafe')!;
  const environmentZone = MOSSPROUT_SQUARE_ZONES.find((zone) => zone.id === 'mossprout-environment')!;
  const eggHomeZone = MOSSPROUT_SQUARE_ZONES.find((zone) => zone.id === 'egg-home')!;
  const gardenZone = MOSSPROUT_SQUARE_ZONES.find((zone) => zone.id === 'mossprout-garden')!;
  const baristabbitFrame = havenSquareZoneFrame(baristabbitZone.coord);
  const environmentFrame = havenSquareZoneFrame(environmentZone.coord);
  const eggHomeFrame = havenSquareZoneFrame(eggHomeZone.coord);
  const gardenFrame = havenSquareZoneFrame(gardenZone.coord);
  const baristabbitBridgeFrame = baristabbitMossproutBridgeFrame();
  const eggHomeBridgeFrame = mossproutEggHomeBridgeFrame();
  const baristabbitTile: KingdomTileRender = {
    companion: baristabbit,
    coord: { q: -1, r: 0 },
    cx: baristabbitFrame.left + baristabbitFrame.width / 2,
    cy: baristabbitFrame.top + baristabbitFrame.height / 2,
    depth: 1,
    id: baristabbit.id,
    kind: 'companion',
    squareCoord: baristabbitZone.coord,
  };
  const baristabbitLayer: KingdomTileArtLayer = {
    alphaBounds: FULL_BOUNDS,
    coord: baristabbitTile.coord,
    custom: true,
    depth: 0,
    fallbackSource: null,
    frame: baristabbitFrame,
    id: baristabbitTile.id,
    kind: 'tile',
    residentAnchor: {
      x: baristabbitFrame.left + baristabbitFrame.width * 0.5,
      y: baristabbitFrame.top + baristabbitFrame.height * 0.52,
    },
    source: BARISTABBIT_CAFE_SOURCES.full,
    sources: BARISTABBIT_CAFE_SOURCES,
    sourceSize: SOURCE_SIZE,
    squareCoord: baristabbitZone.coord,
  };
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
  const eggHomeTile: KingdomTileRender = {
    coord: { q: 1, r: 0 },
    cx: eggHomeFrame.left + eggHomeFrame.width / 2,
    cy: eggHomeFrame.top + eggHomeFrame.height / 2,
    depth: 1,
    id: 'home:egg',
    kind: 'home',
    squareCoord: eggHomeZone.coord,
  };
  const baristabbitBridgeLayer: KingdomTileArtLayer = {
    alphaBounds: BRIDGE_BOUNDS,
    coord: { q: -1, r: 0 },
    custom: true,
    depth: -1,
    fallbackSource: null,
    frame: baristabbitBridgeFrame,
    id: 'decor:baristabbit-mossprout-bridge',
    kind: 'tile',
    source: HORIZONTAL_BRIDGE_SOURCES.full,
    sources: HORIZONTAL_BRIDGE_SOURCES,
    sourceSize: BRIDGE_SOURCE_SIZE,
  };
  const eggHomeBridgeLayer: KingdomTileArtLayer = {
    ...baristabbitBridgeLayer,
    coord: { q: 0, r: 0 },
    frame: eggHomeBridgeFrame,
    id: 'decor:mossprout-egg-home-bridge',
  };
  const eggHomeLayer: KingdomTileArtLayer = {
    alphaBounds: FULL_BOUNDS,
    coord: eggHomeTile.coord,
    custom: true,
    depth: 0,
    fallbackSource: null,
    frame: eggHomeFrame,
    id: eggHomeTile.id,
    kind: 'tile',
    source: EGG_HOME_SOURCES.full,
    sources: EGG_HOME_SOURCES,
    sourceSize: SOURCE_SIZE,
    squareCoord: eggHomeZone.coord,
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
    tileArtLayers: [
      baristabbitBridgeLayer,
      eggHomeBridgeLayer,
      baristabbitLayer,
      environmentLayer,
      eggHomeLayer,
      gardenLayer,
    ],
    tileById: new Map([
      [baristabbitTile.id, baristabbitTile],
      [environmentTile.id, environmentTile],
      [eggHomeTile.id, eggHomeTile],
    ]),
    tiles: [baristabbitTile, environmentTile, eggHomeTile],
    width: metrics.width,
  };
}
