import {
  HEX_TILE_H,
  HEX_TILE_W,
  KINGDOM_HEX_LAYOUT_PROFILES,
} from '@/utils/world-hex';

export type TodayHexWorldPoint = {
  x: number;
  y: number;
};

export type TodayHexNeighborhoodSpacing = {
  horizontalStride: number;
  verticalStep: number;
};

/** Uses the same projected south-east neighbour vector as the Kingdom map. */
export function todayHexKingdomSpacing(
  viewportWidth: number,
  fitHorizontalPadding: number,
  fitScale: number,
): TodayHexNeighborhoodSpacing {
  const renderedTileWidth = Math.max(
    1,
    (viewportWidth - fitHorizontalPadding * 2) * fitScale,
  );
  const kingdomSpacing = KINGDOM_HEX_LAYOUT_PROFILES['floating-neighborhood-v2'];
  return {
    horizontalStride: renderedTileWidth * 0.75 * kingdomSpacing.horizontalSpacing,
    verticalStep: renderedTileWidth
      * (HEX_TILE_H / HEX_TILE_W)
      * 0.5
      * kingdomSpacing.verticalSpacing,
  };
}

/**
 * Recent days form one alternating hex row. The world coordinates never
 * change when selection changes; the camera moves to the selected point.
 */
export function todayHexDayWorldPosition(
  index: number,
  horizontalStride: number,
  verticalStep: number,
): TodayHexWorldPoint {
  return {
    x: index * horizontalStride,
    y: index % 2 === 0 ? 0 : verticalStep,
  };
}

export function todayHexCameraTarget(
  selectedIndex: number,
  horizontalStride: number,
  verticalStep: number,
): TodayHexWorldPoint {
  const selected = todayHexDayWorldPosition(
    selectedIndex,
    horizontalStride,
    verticalStep,
  );
  return { x: -selected.x, y: -selected.y };
}

/**
 * Continuous camera path through the alternating Today hex row.
 *
 * Integer progress values land exactly on a day. Fractional values linearly
 * interpolate between the two neighbouring world points, so the camera always
 * travels along a straight segment with no vertical arc or bounce.
 */
export function todayHexCameraPositionForProgress(
  progress: number,
  horizontalStride: number,
  verticalStep: number,
): TodayHexWorldPoint {
  'worklet';
  const fromIndex = Math.floor(progress);
  const segmentProgress = progress - fromIndex;
  const fromY = fromIndex % 2 === 0 ? 0 : verticalStep;
  const toY = fromIndex % 2 === 0 ? verticalStep : 0;
  return {
    x: -progress * horizontalStride,
    y: -(fromY + (toY - fromY) * segmentProgress),
  };
}
