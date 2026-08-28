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
/** Vertical frames overlap enough for their padded silhouettes to meet slightly. */
export const HAVEN_SQUARE_ROW_PITCH = 450;
export const HAVEN_SQUARE_SCENE_PADDING = 60;

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

/** Bounds of the clear 7x6 runtime playfield in the compact merge-island source. */
export const MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS = {
  bottom: 726,
  left: 246,
  right: 778,
  top: 270,
} as const;

/** Cell aspect derived from the complete 7x6 runtime playfield. */
export const MOSSPROUT_GARDEN_CELL_HEIGHT_TO_WIDTH_RATIO = (
  (MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS.bottom - MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS.top) / 6
) / (
  (MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS.right - MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS.left) / 7
);
