export type HavenSquareCoord = {
  column: number;
  row: number;
};

export type HavenSquareZoneId = 'mossprout-environment' | 'mossprout-garden';

export type HavenSquareZone = {
  coord: HavenSquareCoord;
  id: HavenSquareZoneId;
};

export const HAVEN_SQUARE_ZONE_SIZE = 600;
/**
 * The source frames overlap by the combined transparent edge padding so the
 * main island's bottom stair meets the garden's top stair without art overlap.
 */
export const HAVEN_SQUARE_ZONE_FRAME_OVERLAP = 52;
export const HAVEN_SQUARE_SCENE_PADDING = 60;

export const MOSSPROUT_SQUARE_ZONES: readonly HavenSquareZone[] = [
  { id: 'mossprout-environment', coord: { column: 0, row: 0 } },
  { id: 'mossprout-garden', coord: { column: 0, row: 1 } },
] as const;

export function havenSquareZoneFrame(coord: HavenSquareCoord) {
  const pitch = HAVEN_SQUARE_ZONE_SIZE - HAVEN_SQUARE_ZONE_FRAME_OVERLAP;
  return {
    height: HAVEN_SQUARE_ZONE_SIZE,
    left: HAVEN_SQUARE_SCENE_PADDING + coord.column * pitch,
    top: HAVEN_SQUARE_SCENE_PADDING + coord.row * pitch,
    width: HAVEN_SQUARE_ZONE_SIZE,
  };
}

export function mossproutSquareSceneMetrics() {
  const frames = MOSSPROUT_SQUARE_ZONES.map((zone) => havenSquareZoneFrame(zone.coord));
  return {
    height: Math.max(...frames.map((frame) => frame.top + frame.height)) + HAVEN_SQUARE_SCENE_PADDING,
    width: Math.max(...frames.map((frame) => frame.left + frame.width)) + HAVEN_SQUARE_SCENE_PADDING,
  };
}

/** Bounds of the clear 6x7 runtime playfield in the unlined garden source. */
export const MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS = {
  bottom: 690,
  left: 276,
  right: 742,
  top: 180,
} as const;

/** Cell aspect derived from the complete 6x7 runtime playfield. */
export const MOSSPROUT_GARDEN_CELL_HEIGHT_TO_WIDTH_RATIO = (
  (MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS.bottom - MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS.top) / 7
) / (
  (MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS.right - MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS.left) / 6
);
