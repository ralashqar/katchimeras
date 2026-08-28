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
 * The transparent source squares overlap so the painted silhouettes sit close
 * together. Their alpha bounds remain separated by a small visible gap.
 */
export const HAVEN_SQUARE_ZONE_FRAME_OVERLAP = HAVEN_SQUARE_ZONE_SIZE * 0.1;
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

/** Bounds of the generated 7x6 painted grid in its canonical 1024px source. */
export const MOSSPROUT_GARDEN_GRID_SOURCE_BOUNDS = {
  bottom: 677,
  left: 174,
  right: 854,
  top: 244,
} as const;

/** Average painted cell aspect, derived from the complete 7x6 source grid. */
export const MOSSPROUT_GARDEN_CELL_HEIGHT_TO_WIDTH_RATIO = (
  (MOSSPROUT_GARDEN_GRID_SOURCE_BOUNDS.bottom - MOSSPROUT_GARDEN_GRID_SOURCE_BOUNDS.top) / 6
) / (
  (MOSSPROUT_GARDEN_GRID_SOURCE_BOUNDS.right - MOSSPROUT_GARDEN_GRID_SOURCE_BOUNDS.left) / 7
);
