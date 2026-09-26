import type { HexCoord } from '@incubator/environments/hex';

/**
 * The wide world (`docs/regions-world-design.md`): the Sanctuary at the centre (rings 0-3), and six landmarks four
 * cells out, one in each hex direction, each the heart of a region, a "petal". A region is its landmark, its first
 * ring (its families' homes and the doorstep toward the Sanctuary) and its second ring (its Frontier). Where two petals
 * meet a cell is the nearer landmark's; a tie stays wild. Only the Hollow Reaches is built; the rest are design.
 */
export type RegionId = 'hollow-reaches' | 'night-shore' | 'busy-hills' | 'bright-commons' | 'showtime-glade' | 'mists-heart';

export type RegionDefinition = { id: RegionId; name: string; landmark: HexCoord; landmarkName: string; built: boolean };

export const REGIONS: readonly RegionDefinition[] = [
  { id: 'hollow-reaches', name: 'the Hollow Reaches', landmark: { q: 0, r: -4 }, landmarkName: 'the Hollow Tree', built: true },
  { id: 'night-shore', name: 'the Night Shore', landmark: { q: 4, r: -4 }, landmarkName: 'the Sleeping Lighthouse', built: false },
  { id: 'busy-hills', name: 'the Busy Hills', landmark: { q: 4, r: 0 }, landmarkName: 'the Old Clocktower', built: false },
  { id: 'bright-commons', name: 'the Bright Commons', landmark: { q: 0, r: 4 }, landmarkName: 'the Lantern Hall', built: false },
  { id: 'showtime-glade', name: 'the Showtime Glade', landmark: { q: -4, r: 4 }, landmarkName: 'the Glade Stage', built: false },
  { id: 'mists-heart', name: 'the Mist’s Heart', landmark: { q: -4, r: 0 }, landmarkName: 'the Grey Well', built: false },
];
const byId = new Map(REGIONS.map((region) => [region.id, region]));
export const regionById = (id: RegionId) => byId.get(id)!;

export const hexDistance = (a: HexCoord, b: HexCoord) => Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.q + a.r - b.q - b.r));
const ORIGIN: HexCoord = { q: 0, r: 0 };
/** The Sanctuary's own rings: nothing of a region is drawn inside them. */
export const SANCTUARY_RADIUS = 3;

/** A region's cells at a ring around its landmark: outside the Sanctuary, and nearer its landmark than any other (a tie stays wild). */
export function regionRing(regionId: RegionId, ring: 1 | 2): HexCoord[] {
  const region = regionById(regionId);
  const cells: HexCoord[] = [];
  for (let q = region.landmark.q - ring; q <= region.landmark.q + ring; q += 1) {
    for (let r = region.landmark.r - ring; r <= region.landmark.r + ring; r += 1) {
      const cell = { q, r };
      if (hexDistance(cell, region.landmark) !== ring || hexDistance(cell, ORIGIN) <= SANCTUARY_RADIUS) continue;
      const nearest = Math.min(...REGIONS.filter((other) => other.id !== regionId).map((other) => hexDistance(cell, other.landmark)));
      if (nearest <= ring) continue;
      cells.push(cell);
    }
  }
  return cells;
}

/** The Hollow Reaches' homes, around the Hollow Tree: its keeper's (Dawnle), three families' still to come, and its crown. */
export const HOLLOW_REACHES_HOMES: Readonly<Record<string, HexCoord>> = {
  dawnle: { q: 1, r: -4 },
  relicoon: { q: -1, r: -3 },
  pagelet: { q: 1, r: -5 },
  museling: { q: -1, r: -4 },
  crown: { q: 0, r: -5 },
};
