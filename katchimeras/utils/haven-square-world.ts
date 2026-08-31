export type HavenSquareCoord = {
  column: number;
  row: number;
};

export type HavenSquareZoneId =
  | 'baristabbit-cafe'
  | 'egg-home'
  | 'mossprout-environment'
  | 'mossprout-garden'
  | 'steppling-board'
  | 'steppling-movement';

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
/** Crop the unused western world column while retaining the authored spacing. */
export const MOSSPROUT_WORLD_OFFSET_X = 420;
export const MOSSPROUT_NATURE_ISLAND_SIZE = 300;
export const MOSSPROUT_NATURE_ISLAND_COLUMN_CENTERS = [180, 1_140] as const;
/** Compact three-row orbit matched to the authored Mossprout layout guide. */
export const MOSSPROUT_NATURE_ISLAND_ROW_CENTERS = [340, 660, 1_040] as const;
/** Slightly oversize the Garden so its fixed 120px order stacks clear the perimeter fence. */
export const MOSSPROUT_GARDEN_FRAME_SIZE = 726;

export const MOSSPROUT_SQUARE_ZONES: readonly HavenSquareZone[] = [
  { id: 'baristabbit-cafe', coord: { column: 0, row: 0 } },
  { id: 'mossprout-environment', coord: { column: 1, row: 0 } },
  { id: 'egg-home', coord: { column: 2, row: 0 } },
  { id: 'steppling-movement', coord: { column: 0, row: 1 } },
  { id: 'mossprout-garden', coord: { column: 1, row: 1 } },
  { id: 'steppling-board', coord: { column: 0, row: 2 } },
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
  const gardenFrame = mossproutGardenFrame();
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

/** Enlarged square frame for the dedicated Garden destination island. */
export function mossproutGardenFrame() {
  const garden = MOSSPROUT_SQUARE_ZONES.find((zone) => zone.id === 'mossprout-garden')!;
  const square = mossproutWorldFrame(havenSquareZoneFrame(garden.coord));
  const growth = MOSSPROUT_GARDEN_FRAME_SIZE - HAVEN_SQUARE_ZONE_SIZE;
  return {
    height: MOSSPROUT_GARDEN_FRAME_SIZE,
    left: square.left - growth / 2,
    top: square.top - growth / 2,
    width: MOSSPROUT_GARDEN_FRAME_SIZE,
  };
}

export function mossproutWorldFrame(frame: { height: number; left: number; top: number; width: number }) {
  return { ...frame, left: frame.left - MOSSPROUT_WORLD_OFFSET_X };
}

export function stepplingBoardJunctionTrayFrames() {
  const boardZone = MOSSPROUT_SQUARE_ZONES.find((zone) => zone.id === 'steppling-board')!;
  const boardFrame = havenSquareZoneFrame(boardZone.coord);
  const center = {
    height: HAVEN_JUNCTION_MINI_ISLAND_SIZE,
    left: boardFrame.left + (boardFrame.width - HAVEN_JUNCTION_MINI_ISLAND_SIZE) / 2,
    top: boardFrame.top - HAVEN_JUNCTION_MINI_ISLAND_RISE,
    width: HAVEN_JUNCTION_MINI_ISLAND_SIZE,
  };
  return [
    { ...center, left: center.left - HAVEN_JUNCTION_MINI_ISLAND_SPACING },
    center,
    { ...center, left: center.left + HAVEN_JUNCTION_MINI_ISLAND_SPACING },
  ].map((island) => ({
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
  const gardenFrame = mossproutWorldFrame(havenSquareZoneFrame(gardenZone.coord));
  const horizontalGapCenter = (
    baristabbitFrame.left + baristabbitFrame.width + environmentFrame.left
  ) / 2;
  const verticalOverlapCenter = (
    environmentFrame.top + environmentFrame.height + gardenFrame.top
  ) / 2;

  return mossproutWorldFrame({
    height: HAVEN_WEST_NATURE_ISLAND_SIZE,
    left: horizontalGapCenter - HAVEN_WEST_NATURE_ISLAND_SIZE / 2,
    top: verticalOverlapCenter - HAVEN_WEST_NATURE_ISLAND_SIZE / 2,
    width: HAVEN_WEST_NATURE_ISLAND_SIZE,
  });
}

/** Mirrors the west nature islet across the Mossprout environment centerline. */
export function mossproutGardenEastNatureIslandFrame() {
  const environmentZone = MOSSPROUT_SQUARE_ZONES.find((zone) => zone.id === 'mossprout-environment')!;
  const environmentFrame = mossproutWorldFrame(havenSquareZoneFrame(environmentZone.coord));
  const westFrame = mossproutGardenWestNatureIslandFrame();
  const environmentCenterX = environmentFrame.left + environmentFrame.width / 2;
  const westCenterX = westFrame.left + westFrame.width / 2;
  const eastCenterX = environmentCenterX + (environmentCenterX - westCenterX);

  return {
    ...westFrame,
    left: eastCenterX - westFrame.width / 2,
  };
}

export type MossproutNatureIslandPosition =
  | 'upper-left'
  | 'upper-right'
  | 'middle-left'
  | 'middle-right'
  | 'lower-left'
  | 'lower-right';

const MOSSPROUT_NATURE_ISLAND_GRID: Record<MossproutNatureIslandPosition, readonly [number, number]> = {
  'upper-left': [0, 0],
  'upper-right': [1, 0],
  'middle-left': [0, 1],
  'middle-right': [1, 1],
  'lower-left': [0, 2],
  'lower-right': [1, 2],
};

export function mossproutNatureIslandFrame(position: MossproutNatureIslandPosition) {
  const [column, row] = MOSSPROUT_NATURE_ISLAND_GRID[position];
  const centerX = MOSSPROUT_NATURE_ISLAND_COLUMN_CENTERS[column];
  const centerY = MOSSPROUT_NATURE_ISLAND_ROW_CENTERS[row];
  return {
    height: MOSSPROUT_NATURE_ISLAND_SIZE,
    left: centerX - MOSSPROUT_NATURE_ISLAND_SIZE / 2,
    top: centerY - MOSSPROUT_NATURE_ISLAND_SIZE / 2,
    width: MOSSPROUT_NATURE_ISLAND_SIZE,
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
  const environment = MOSSPROUT_SQUARE_ZONES.find((zone) => zone.id === 'mossprout-environment')!;
  const frames = [
    mossproutWorldFrame(havenSquareZoneFrame(environment.coord)),
    mossproutGardenFrame(),
    mossproutNatureIslandFrame('upper-left'),
    mossproutNatureIslandFrame('upper-right'),
    mossproutNatureIslandFrame('middle-left'),
    mossproutNatureIslandFrame('middle-right'),
    mossproutNatureIslandFrame('lower-left'),
    mossproutNatureIslandFrame('lower-right'),
  ];
  return {
    height: Math.max(...frames.map((frame) => frame.top + frame.height)) + HAVEN_SQUARE_SCENE_PADDING,
    width: Math.max(...frames.map((frame) => frame.left + frame.width)) + HAVEN_SQUARE_SCENE_PADDING / 2,
  };
}

export const MOSSPROUT_GARDEN_SOURCE_SIZE = { height: 1_024, width: 1_024 } as const;

/**
 * Keep every resident board on one world-space grid metric. The Steppling
 * source has a larger clear floor than Mossprout, so its overlay deliberately
 * uses the same centered 7x6 footprint instead of stretching to the rails.
 */
export const STEPPLING_BOARD_PLAYFIELD_SOURCE_CORNERS = {
  bottomLeft: { x: 220, y: 690 },
  bottomRight: { x: 804, y: 690 },
  topLeft: { x: 245, y: 215 },
  topRight: { x: 779, y: 215 },
} as const;

export const STEPPLING_BOARD_PLAYFIELD_SOURCE_BOUNDS = {
  bottom: STEPPLING_BOARD_PLAYFIELD_SOURCE_CORNERS.bottomLeft.y,
  left: STEPPLING_BOARD_PLAYFIELD_SOURCE_CORNERS.bottomLeft.x,
  right: STEPPLING_BOARD_PLAYFIELD_SOURCE_CORNERS.bottomRight.x,
  top: STEPPLING_BOARD_PLAYFIELD_SOURCE_CORNERS.topLeft.y,
} as const;

export const STEPPLING_BOARD_TOP_WIDTH_RATIO = (
  STEPPLING_BOARD_PLAYFIELD_SOURCE_CORNERS.topRight.x
  - STEPPLING_BOARD_PLAYFIELD_SOURCE_CORNERS.topLeft.x
) / (
  STEPPLING_BOARD_PLAYFIELD_SOURCE_CORNERS.bottomRight.x
  - STEPPLING_BOARD_PLAYFIELD_SOURCE_CORNERS.bottomLeft.x
);

export const STEPPLING_BOARD_CELL_HEIGHT_TO_WIDTH_RATIO = (
  (STEPPLING_BOARD_PLAYFIELD_SOURCE_BOUNDS.bottom - STEPPLING_BOARD_PLAYFIELD_SOURCE_BOUNDS.top) / 6
) / (
  (STEPPLING_BOARD_PLAYFIELD_SOURCE_BOUNDS.right - STEPPLING_BOARD_PLAYFIELD_SOURCE_BOUNDS.left) / 7
);
