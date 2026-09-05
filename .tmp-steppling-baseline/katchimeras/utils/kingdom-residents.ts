import type { WorldObject } from '@/types/world';
import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import { PATCH_SIZE } from '@/utils/world-iso';

// Kingdom Residents (docs/kingdom-residents-plan.md): every UNIQUE katchimera
// claims one hex tile, in hatch order; duplicates level up that
// resident's house instead of adding a twin. Everything here is a PURE fold
// over the Dex — allocation is derived, never stored, so migration and
// recomputation are free. Only user-made moves would ever live in a store.

export type ResidentQuad = 0 | 1 | 2 | 3;

export type KingdomResident = {
  creatureId: string;
  /** 0-based order of first hatch among uniques — drives the spiral. */
  arrivalIndex: number;
  /** Which resident hex tile this katchimera owns. */
  tileIndex: number;
  /** Back-compat only: older code expected a quad. Hex residents always use 0. */
  quad: ResidentQuad;
  /** Creature centre in the tile's local fractional coords. */
  cell: { col: number; row: number };
  /** Total hatches of this creature (1 = first arrival). */
  hatchCount: number;
  /** House art level 1..MAX_HOUSE_LEVEL (clamped hatchCount). */
  houseLevel: number;
};

export const QUADS_PER_TILE = 1;
export const MAX_HOUSE_LEVEL = 4;

// Ring tiles render at PATCH_SIZE + 2·ring cells (14 with the standard ring
// of 5), but object cell coords keep the 4×4 grid's origin — the tile CENTRE
// is (1.5, 1.5) and the plantable space runs -ring … PATCH_SIZE-1+ring. Quad
// geometry must span that FULL extent or everything bunches in the middle
// (the original 0..3 coords only covered the central 4 cells).
const CENTRE = (PATCH_SIZE - 1) / 2;
const QUAD_SIGNS: readonly { col: -1 | 1; row: -1 | 1 }[] = [
  { col: -1, row: -1 }, // back
  { col: 1, row: -1 }, // right
  { col: -1, row: 1 }, // left
  { col: 1, row: 1 }, // front
];

/** Quad centres (where the katchimera stands) for a tile with this ring. */
export function quadCell(quad: ResidentQuad, ring: number): { col: number; row: number } {
  return { col: CENTRE, row: CENTRE };
}

/** House spots: each quad's OUTER corner (toward the tile's edge). */
export function quadHouseCell(quad: ResidentQuad, ring: number): { col: number; row: number } {
  return { col: CENTRE + 0.65, row: CENTRE - 0.55 };
}

// Back-compat quad centres at ring 0 (the raw 4×4 grid) — used by
// deriveResidents' cell field; renderers should use quadCell(quad, ring).
export const QUAD_CELLS: readonly { col: number; row: number }[] = [0, 1, 2, 3].map((quad) =>
  quadCell(quad as ResidentQuad, 0)
);

export type HatchRecord = { creatureId: string; hatchedAt: number };

/**
 * Fold the full hatch history into the resident list. Uniques are ordered by
 * FIRST hatch time (stable across replays); each takes the next hex tile.
 */
export function deriveResidents(
  hatches: HatchRecord[],
  // Completed companion quests credit the resident's house like a dupe hatch
  // (docs/katchimera-engagement-v1.md): creatureId → completed-quest count.
  questCredits?: Map<string, number>
): KingdomResident[] {
  const byFirstHatch = new Map<string, { first: number; count: number }>();
  for (const hatch of hatches) {
    const entry = byFirstHatch.get(hatch.creatureId);
    if (entry) {
      entry.first = Math.min(entry.first, hatch.hatchedAt);
      entry.count += 1;
    } else {
      byFirstHatch.set(hatch.creatureId, { first: hatch.hatchedAt, count: 1 });
    }
  }
  return [...byFirstHatch.entries()]
    .sort((a, b) => a[1].first - b[1].first)
    .map(([creatureId, { count }], arrivalIndex) => {
      return {
        creatureId,
        arrivalIndex,
        tileIndex: arrivalIndex,
        quad: 0,
        cell: { col: CENTRE, row: CENTRE },
        hatchCount: count,
        houseLevel: Math.min(MAX_HOUSE_LEVEL, count + (questCredits?.get(creatureId) ?? 0)),
      };
    });
}

/** How many resident hex tiles the current unique count needs. */
export function tilesNeeded(uniqueCount: number): number {
  return uniqueCount;
}

// Placeholder house art until the resident-house family lands (slice F —
// 4 level arts). The 'home' structure reads as a house at reduced scale.
const RESIDENT_HOUSE_ASSET = 'home';

export type ResidentMeta = { name: string; visualKey: string };

/**
 * Render objects for one ring tile's residents: each quad gets the resident's
 * house at its centre plus the katchimera itself just in front of it. Merged
 * into the expansion patch's objects next to planted decor.
 */
export function residentObjects(
  residents: KingdomResident[],
  tileIndex: number,
  metaOf: (creatureId: string) => ResidentMeta | undefined,
  ring: number,
  glyphOf?: (creatureId: string) => WorldObject['statusGlyph']
): WorldObject[] {
  return residents
    .filter((resident) => resident.tileIndex === tileIndex)
    .flatMap((resident) => {
      const meta = metaOf(resident.creatureId);
      const houseCell = quadHouseCell(resident.quad, ring);
      const house: WorldObject = {
        id: `resident-${resident.creatureId}`,
        kind: 'prop' as const,
        assetKey: RESIDENT_HOUSE_ASSET,
        label: meta?.name ?? 'Resident',
        col: houseCell.col,
        row: houseCell.row,
        footprint: 1,
        sourceLabel: `Resident home · Lv ${resident.houseLevel}`,
        badge: resident.houseLevel > 1 ? resident.houseLevel : undefined,
        // Houses grow a touch with each level until the real level arts exist.
        sizeScale: 1.4 + resident.houseLevel * 0.08,
      };
      if (!meta) return [house];
      // The katchimera takes the quad centre, in front of its corner house.
      const creatureCell = quadCell(resident.quad, ring);
      const creature: WorldObject = {
        id: `resident-creature-${resident.creatureId}`,
        kind: 'creature' as const,
        assetKey: `creature:${meta.visualKey}`,
        label: meta.name,
        col: creatureCell.col,
        row: creatureCell.row,
        footprint: 1,
        sizeScale: 1.15,
        statusGlyph: glyphOf?.(resident.creatureId),
      };
      return [house, creature];
    });
}

// Witnessed-residents ledger: which katchimeras have already had their arrival
// ceremony, so a newly-hatched one gets announced exactly once.
const WITNESSED_KEY = 'katchadeck.residents-witnessed-v1';

export function loadWitnessedResidents(): Set<string> {
  return new Set(getStoredJson<string[]>(WITNESSED_KEY, []));
}

export function saveWitnessedResidents(ids: Set<string>): void {
  setStoredJson(WITNESSED_KEY, [...ids]);
}

/** New residents not yet witnessed (arrival ceremony pending). */
export function unwitnessedResidents(residents: KingdomResident[], witnessed: Set<string>): KingdomResident[] {
  return residents.filter((resident) => !witnessed.has(resident.creatureId));
}

export type ArrivalPlan =
  | { kind: 'settle'; resident: KingdomResident; needsNewTile: boolean }
  | { kind: 'upgrade'; resident: KingdomResident; leveledUp: boolean };

/**
 * What should happen when `creatureId` hatches now, given the history BEFORE
 * this hatch and how many ring tiles are already unlocked. Drives the arrival
 * / upgrade ceremonies; the caller appends the hatch to history afterwards.
 */
export function planArrival(
  history: HatchRecord[],
  creatureId: string,
  hatchedAt: number,
  unlockedTiles: number
): ArrivalPlan {
  const after = deriveResidents([...history, { creatureId, hatchedAt }]);
  const resident = after.find((r) => r.creatureId === creatureId)!;
  if (resident.hatchCount > 1) {
    return { kind: 'upgrade', resident, leveledUp: resident.hatchCount <= MAX_HOUSE_LEVEL };
  }
  return { kind: 'settle', resident, needsNewTile: resident.tileIndex >= unlockedTiles };
}
