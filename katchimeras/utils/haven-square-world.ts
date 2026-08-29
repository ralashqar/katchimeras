export type HavenSquareCoord = {
  column: number;
  row: number;
};

export type HavenSquareZoneId =
  | 'baristabbit-cafe'
  | 'egg-home'
  | 'mossprout-environment'
  | 'mossprout-garden';

export type HavenSquareZone = {
  coord: HavenSquareCoord;
  id: HavenSquareZoneId;
};

export const HAVEN_SQUARE_ZONE_SIZE = 600;
/** Horizontal neighbors leave room for the shared suspension bridges. */
export const HAVEN_SQUARE_COLUMN_PITCH = 720;
/** Lower the complete merge-board island area without disturbing its internal anchors. */
export const HAVEN_MERGE_BOARD_AREA_LOWERING = HAVEN_SQUARE_ZONE_SIZE * 0.15;
/** Vertical frames retain a slight silhouette overlap after the garden is lowered. */
export const HAVEN_SQUARE_ROW_PITCH = 480 + HAVEN_MERGE_BOARD_AREA_LOWERING;
export const HAVEN_SQUARE_SCENE_PADDING = 60;
export const HAVEN_JUNCTION_MINI_ISLAND_SIZE = 160;
export const HAVEN_JUNCTION_MINI_ISLAND_SPACING = 130;
export const HAVEN_JUNCTION_MINI_ISLAND_RISE = 10;
export const HAVEN_JUNCTION_TRAY_SIZE = 95;
export const HAVEN_JUNCTION_TRAY_TOP_OFFSET = 48;
/** Compact decorative nature islet placed west of the Mossprout/garden seam. */
export const HAVEN_WEST_NATURE_ISLAND_SIZE = 330;

export const MOSSPROUT_SQUARE_ZONES: readonly HavenSquareZone[] = [
  { id: 'baristabbit-cafe', coord: { column: 0, row: 0 } },
  { id: 'mossprout-environment', coord: { column: 1, row: 0 } },
  { id: 'egg-home', coord: { column: 2, row: 0 } },
  { id: 'mossprout-garden', coord: { column: 1, row: 1 } },
] as const;

export function havenSquareZoneFrame(coord: HavenSquareCoord) {
  return {
    height: HAVEN_SQUARE_ZONE_SIZE,
    left: HAVEN_SQUARE_SCENE_PADDING + coord.column * HAVEN_SQUARE_COLUMN_PITCH,
    top: HAVEN_SQUARE_SCENE_PADDING + coord.row * HAVEN_SQUARE_ROW_PITCH,
    width: HAVEN_SQUARE_ZONE_SIZE,
  };
}

/**
 * Decorative island centered over the Mossprout/garden seam. The transparent
 * source padding keeps its visible cliff above the merge playfield.
 */
export function mossproutGardenJunctionMiniIslandFrame() {
  const gardenZone = MOSSPROUT_SQUARE_ZONES.find((zone) => zone.id === 'mossprout-garden')!;
  const gardenFrame = havenSquareZoneFrame(gardenZone.coord);
  return {
    height: HAVEN_JUNCTION_MINI_ISLAND_SIZE,
    left: gardenFrame.left + (gardenFrame.width - HAVEN_JUNCTION_MINI_ISLAND_SIZE) / 2,
    top: gardenFrame.top - HAVEN_JUNCTION_MINI_ISLAND_RISE,
    width: HAVEN_JUNCTION_MINI_ISLAND_SIZE,
  };
}

export function mossproutGardenJunctionMiniIslandFrames() {
  const center = mossproutGardenJunctionMiniIslandFrame();
  return [
    { ...center, left: center.left - HAVEN_JUNCTION_MINI_ISLAND_SPACING },
    center,
    { ...center, left: center.left + HAVEN_JUNCTION_MINI_ISLAND_SPACING },
  ] as const;
}

export function mossproutGardenJunctionTrayFrames() {
  return mossproutGardenJunctionMiniIslandFrames().map((island) => ({
    height: HAVEN_JUNCTION_TRAY_SIZE,
    left: island.left + (island.width - HAVEN_JUNCTION_TRAY_SIZE) / 2,
    top: island.top + HAVEN_JUNCTION_TRAY_TOP_OFFSET,
    width: HAVEN_JUNCTION_TRAY_SIZE,
  }));
}

/**
 * Centers the nature islet in the horizontal gap west of Mossprout and on the
 * vertical overlap between the Mossprout environment and merge-board island.
 */
export function mossproutGardenWestNatureIslandFrame() {
  const baristabbitZone = MOSSPROUT_SQUARE_ZONES.find((zone) => zone.id === 'baristabbit-cafe')!;
  const environmentZone = MOSSPROUT_SQUARE_ZONES.find((zone) => zone.id === 'mossprout-environment')!;
  const gardenZone = MOSSPROUT_SQUARE_ZONES.find((zone) => zone.id === 'mossprout-garden')!;
  const baristabbitFrame = havenSquareZoneFrame(baristabbitZone.coord);
  const environmentFrame = havenSquareZoneFrame(environmentZone.coord);
  const gardenFrame = havenSquareZoneFrame(gardenZone.coord);
  const horizontalGapCenter = (
    baristabbitFrame.left + baristabbitFrame.width + environmentFrame.left
  ) / 2;
  const verticalOverlapCenter = (
    environmentFrame.top + environmentFrame.height + gardenFrame.top
  ) / 2;

  return {
    height: HAVEN_WEST_NATURE_ISLAND_SIZE,
    left: horizontalGapCenter - HAVEN_WEST_NATURE_ISLAND_SIZE / 2,
    top: verticalOverlapCenter - HAVEN_WEST_NATURE_ISLAND_SIZE / 2,
    width: HAVEN_WEST_NATURE_ISLAND_SIZE,
  };
}

/** Mirrors the west nature islet across the Mossprout environment centerline. */
export function mossproutGardenEastNatureIslandFrame() {
  const environmentZone = MOSSPROUT_SQUARE_ZONES.find((zone) => zone.id === 'mossprout-environment')!;
  const environmentFrame = havenSquareZoneFrame(environmentZone.coord);
  const westFrame = mossproutGardenWestNatureIslandFrame();
  const environmentCenterX = environmentFrame.left + environmentFrame.width / 2;
  const westCenterX = westFrame.left + westFrame.width / 2;
  const eastCenterX = environmentCenterX + (environmentCenterX - westCenterX);

  return {
    ...westFrame,
    left: eastCenterX - westFrame.width / 2,
  };
}

/**
 * The horizontal bridge is intentionally oversized past both shorelines. Its
 * transparent source frame places the visible deck in the upper-middle of the
 * island sides while the islands mask both clean endpoint tails.
 */
function horizontalBridgeFrameFrom(zoneId: HavenSquareZoneId) {
  const zone = MOSSPROUT_SQUARE_ZONES.find((candidate) => candidate.id === zoneId)!;
  const frame = havenSquareZoneFrame(zone.coord);
  return {
    height: 201,
    left: frame.left + frame.width - 166,
    top: frame.top + 147,
    width: 453,
  };
}

export function baristabbitMossproutBridgeFrame() {
  return horizontalBridgeFrameFrom('baristabbit-cafe');
}

export function mossproutEggHomeBridgeFrame() {
  return horizontalBridgeFrameFrom('mossprout-environment');
}

export function mossproutSquareSceneMetrics() {
  const frames = MOSSPROUT_SQUARE_ZONES.map((zone) => havenSquareZoneFrame(zone.coord));
  return {
    height: Math.max(...frames.map((frame) => frame.top + frame.height)) + HAVEN_SQUARE_SCENE_PADDING,
    width: Math.max(...frames.map((frame) => frame.left + frame.width)) + HAVEN_SQUARE_SCENE_PADDING,
  };
}

/** Four calibrated corners of the clear gridless playfield in the 1024 source. */
export const MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_CORNERS = {
  bottomLeft: { x: 220, y: 690 },
  bottomRight: { x: 804, y: 690 },
  topLeft: { x: 245, y: 215 },
  topRight: { x: 779, y: 215 },
} as const;

/** Bounds enclosing the calibrated four-corner overlay. */
export const MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS = {
  bottom: MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_CORNERS.bottomLeft.y,
  left: MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_CORNERS.bottomLeft.x,
  right: MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_CORNERS.bottomRight.x,
  top: MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_CORNERS.topLeft.y,
} as const;

export const MOSSPROUT_GARDEN_TOP_WIDTH_RATIO = (
  MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_CORNERS.topRight.x
  - MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_CORNERS.topLeft.x
) / (
  MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_CORNERS.bottomRight.x
  - MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_CORNERS.bottomLeft.x
);

/** Cell aspect derived from the complete 7x6 runtime playfield. */
export const MOSSPROUT_GARDEN_CELL_HEIGHT_TO_WIDTH_RATIO = (
  (MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS.bottom - MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS.top) / 6
) / (
  (MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS.right - MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS.left) / 7
);
