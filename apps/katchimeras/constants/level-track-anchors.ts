/**
 * Where a tile's level stepping-stones sit on its art, as fractions of the
 * tile's interaction frame (the pattern `GARDEN_PLANT_SLOT_POSITIONS` uses for
 * the Heartwood beds). A tile with no hand-placed stones gets a gentle path
 * from its front-left to its back-right, so no island needs art for its track.
 * Hand-place a tile's stones here once its art is final.
 */
export type TrackAnchor = { fx: number; fy: number };

const HAND_PLACED: Readonly<Record<string, readonly TrackAnchor[]>> = {};

/** A winding path across the tile: front-left to back-right, swaying either side of its middle. */
export function defaultTrackAnchors(count: number): TrackAnchor[] {
  if (count <= 0) return [];
  if (count === 1) return [{ fx: 0.5, fy: 0.55 }];
  return Array.from({ length: count }, (_, index) => {
    const t = index / (count - 1);
    return {
      fx: 0.2 + t * 0.6,
      fy: 0.74 - t * 0.44 + Math.sin(t * Math.PI * 2) * 0.06,
    };
  });
}

/** A tile's stones: its hand-placed ones when there are enough, else the default path. */
export function trackAnchors(tileKey: string, count: number): TrackAnchor[] {
  const placed = HAND_PLACED[tileKey];
  return placed && placed.length >= count ? placed.slice(0, count) : defaultTrackAnchors(count);
}
