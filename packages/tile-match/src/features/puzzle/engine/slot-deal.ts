/**
 * Dealing a beat: which zones are in play, which shapes, and where in each zone they sit.
 *
 * Two invariants this module exists to guarantee.
 *
 * **A perfect beat is always available.** Each group's target cells are literally its own piece's
 * shape at a chosen origin, so there is always an exact answer and the player can only fall short by
 * being inaccurate or slow. That is the whole difference from the board, where the pressure came from
 * running out of room — there is no jam here, and nothing to recover from.
 *
 * **A slot always appears in the same place.** Footprints are placed in fixed zones relative to the
 * car — one to its left, one to its right, one beneath it — rather than anywhere on the field. An
 * earlier version picked a uniformly random origin across the whole grid, and the result read as
 * scattered: the player had to *find* the targets every beat, which is a search task on top of the
 * aiming task and pulled the eye off the car. Zoning means the second slot to appear is always on the
 * right, so it can be anticipated.
 */

// Pure module — `.ts` extension imports so it runs under `node --test`.
import { nextInt } from '../../../core/rng';
import { boardIndex, canPlace, cellsExtent, createEmptyBoard } from './board';
import { buildShapePool, shapeCellCount } from './shapes';
import { pickDiverseShapes, toPieces } from './tray';
import { MAX_SLOT_PIECE_CELLS, type Beat, type SlotGroup, type SlotZoneId } from './slot-types';
import type { BeatPlan } from './progression';
import type { DealContext, VarietySpec } from '../variety/contract';
import { dealVarieties, shapeBeat } from '../variety/registry';
import type { Board, BoardSpec, Piece, Shape } from './types';

/** Most footprints a single beat will ever show. */
export const MAX_SLOTS = 2;

/**
 * The difficulty ladder moved out of this file.
 *
 * It used to live here as a `BEAT_TIERS` table plus `slotsForCombo`, `zonesForBeat` and `driftForCombo`, which
 * meant the dealer decided the play mode — one curve, welded in, with no way to express any other. A level
 * now supplies a `Progression` and the dealer takes the `BeatPlan` it resolves. See `progression.ts`, and
 * `DEFAULT_LADDER` for the table that used to be these lines.
 *
 * What stayed is everything about *placing* a beat once its plan is known: the zones, their extent caps,
 * the shape pools, and the launch's forced shape.
 */

/**
 * Which flank a single-footprint beat sits on.
 *
 * Alternating rather than random: a slot should have a *place*, and a predictable side is one fewer thing
 * to hunt for when the only thing being tested is precision. Exported because the progression decides how
 * many footprints there are and this decides where a lone one goes — two questions that belong to
 * different modules but have to agree.
 */
export function flankForBeat(beatIndex: number): SlotZoneId {
  return beatIndex % 2 === 0 ? 'left' : 'right';
}

/**
 * The opening beat: one fixed shape, in one fixed place.
 *
 * The first beat of a run is not really a beat — it is the launch. The player has to drag it home before
 * the countdown will start, so it doubles as the tutorial, and a tutorial should not be able to roll a
 * domino one race and a Z-piece the next.
 *
 * **The 2x3 rectangle**, because it is the largest shape in the catalogue and a solid block: the easiest
 * thing in the game to line up and the hardest to misread. Note that no rotation is specified and none
 * is needed — the centre zone caps height at 2, so the only rotation that survives its pool is the
 * 3-wide, 2-tall one. The zone picks the orientation for free.
 *
 * **The centre zone**, because the launch footprint is the one target in the game that is *not* read
 * against the car. Every other footprint is positioned from where the chase shot projects the car, but
 * the launch is framed by `gridIdle` — a three-quarter view from above the car's shoulder — so a
 * car-relative flank slot would sit nowhere meaningful. Dead centre is legible under any framing, and it
 * gives the instruction panel somewhere to sit directly above it.
 *
 * This is the one exception to "the centre slot appears only in a triple". It is a fair one: the launch
 * happens once, before the race, under a camera the player never sees again, so it cannot be confused
 * with the mid-race silhouette that rule is about.
 */
export const LAUNCH_FAMILY_ID = 'rectangle-2x3';
export const LAUNCH_ZONE: SlotZoneId = 'below';

/**
 * A rectangular region of the field, and the largest shape that may go in it.
 *
 * The extent caps are what make the zones work at all. The field is only seven columns wide, so the
 * side zones get two each and the bottom three — and a four-wide line simply does not fit a two-wide
 * zone. Rather than reject shapes at placement time and end up with beats that silently deal fewer
 * footprints, each zone advertises what it can hold and only draws from shapes that fit.
 *
 * The happy consequence is that the caps give each zone a *character*: the side slots are tall and
 * narrow, the bottom one is wide and shallow. That reads as deliberate framing around the car rather
 * than as three arbitrary blobs, and it makes the three instantly distinguishable at a glance.
 */
export type SlotZone = {
  id: SlotZoneId;
  rowFrom: number;
  rowTo: number;
  columnFrom: number;
  columnTo: number;
  maxHeight: number;
  maxWidth: number;
};

/**
 * The three zones, in virtual-grid coordinates.
 *
 * Columns read: two of margin, the left zone, a **spacer**, the bottom zone, a spacer, the right
 * zone, two of margin. The spacers are there because without them the flanking footprints sat against
 * the car's own silhouette — the car spans roughly 38% of the frame width at its depth, so a zone
 * immediately beside the middle columns overlaps it. One empty column each side pushes them clear, so
 * they read as being *beside* the car rather than on it.
 *
 * Disjoint by column, which matters for a second reason: placement can never fail for want of room,
 * so there is no packing retry and no possibility of a beat quietly dealing fewer footprints.
 *
 * Vertically the side zones use the full playable height while the bottom one is held to the lower
 * rows. The field is centred on the car and nudged down half a cell, so the car sits around the upper
 * rows — which puts the side zones alongside it and the bottom zone genuinely underneath it.
 */
export const SLOT_ZONES: readonly SlotZone[] = [
  { id: 'left', rowFrom: 2, rowTo: 5, columnFrom: 2, columnTo: 3, maxHeight: 3, maxWidth: 2 },
  { id: 'below', rowFrom: 4, rowTo: 5, columnFrom: 5, columnTo: 7, maxHeight: 2, maxWidth: 3 },
  { id: 'right', rowFrom: 2, rowTo: 5, columnFrom: 9, columnTo: 10, maxHeight: 3, maxWidth: 2 },
];

const zoneById = (id: SlotZoneId): SlotZone => {
  const zone = SLOT_ZONES.find((candidate) => candidate.id === id);
  if (!zone) throw new Error(`unknown slot zone ${id}`);
  return zone;
};

/**
 * The shapes a given zone can hold.
 *
 * `buildShapePool` already drops anything that cannot fit the field's dimensions; the extra filters
 * are the cell-count cap — see `MAX_SLOT_PIECE_CELLS` — and the zone's own extent.
 *
 * Memoised per zone, because it depends on nothing else and `dealBeat` is called once per beat.
 */
const poolCache = new Map<string, Shape[]>();

export function slotShapePoolFor(grid: BoardSpec, zone: SlotZone): Shape[] {
  const key = `${grid.rows}x${grid.cols}:${zone.id}`;
  let pool = poolCache.get(key);
  if (!pool) {
    pool = buildShapePool(grid).filter(
      (shape) =>
        shapeCellCount(shape) <= MAX_SLOT_PIECE_CELLS &&
        shape.height <= zone.maxHeight &&
        shape.width <= zone.maxWidth,
    );
    poolCache.set(key, pool);
  }
  return pool;
}

/** Absolute field indices of a shape placed at an origin. */
function footprintOf(grid: BoardSpec, shape: Shape, row: number, column: number): number[] {
  return shape.cells.map((cell) => boardIndex(grid, row + cell.row, column + cell.column));
}

/** Every origin at which `shape` fits entirely inside `zone`. */
function originsInZone(zone: SlotZone, shape: Shape): { row: number; column: number }[] {
  const { height, width } = cellsExtent(shape.cells);
  const origins: { row: number; column: number }[] = [];
  for (let row = zone.rowFrom; row + height - 1 <= zone.rowTo; row += 1) {
    for (let column = zone.columnFrom; column + width - 1 <= zone.columnTo; column += 1) {
      origins.push({ row, column });
    }
  }
  return origins;
}

/**
 * Deal a beat: its footprints and the pieces that fill them.
 *
 * `trayGeneration` only feeds the piece ids, which have to be unique across a run so React keys and
 * the reducer's lookups cannot collide between beats.
 *
 * The retry ladder a previous version needed is gone. That existed because footprints were packed
 * into a shared grid at random origins, which failed to fit three shapes about 5% of the time —
 * quietly handing the player an easier beat. Disjoint zones with per-zone extent caps make placement
 * unconditional, so there is nothing left to retry.
 */
export function dealBeat(
  grid: BoardSpec,
  rngState: number,
  beatIndex: number,
  trayGeneration: number,
  /**
   * What this beat asks for, resolved by the level's progression — see `planBeat`.
   *
   * This used to be a bare `combo`, and the dealer worked the plan out itself. Taking the plan instead is
   * what makes the play mode data: the dealer places footprints and no longer has an opinion about which
   * ones a streak has earned.
   */
  plan: BeatPlan,
  /**
   * Deal the launch beat instead of a normal one — one fixed shape in the centre zone.
   *
   * See `LAUNCH_FAMILY_ID`. The forced shape is only honoured where the zone can actually hold it, so
   * this can never produce an unplaceable beat: a zone that cannot take the family falls back to a
   * normal roll.
   *
   * It also suppresses the plan's varieties. The launch is the first thing anybody does, framed by a camera
   * used nowhere else, and a moving or burning target is not how to introduce a drag.
   */
  launch = false,
): { beat: Beat; tray: Piece[]; rngState: number } {
  const zones = (launch ? [LAUNCH_ZONE] : plan.zones).map(zoneById);
  const forceFamilyId = launch ? LAUNCH_FAMILY_ID : undefined;

  let state = rngState;
  const placed: { zone: SlotZone; shape: Shape; row: number; column: number }[] = [];
  /** Shared across zones, so a three-slot beat never shows the same shape twice. */
  const usedFamilies = new Set<string>();
  let bigPieces = 0;

  for (const zone of zones) {
    const candidates = slotShapePoolFor(grid, zone);
    const pool = plan.minShapeHeight ? candidates.filter(shape => shape.height >= plan.minShapeHeight!) : candidates;
    if (pool.length === 0) throw new Error(`No shapes satisfy the authored constraint in ${zone.id}`);
    const forced = forceFamilyId
      ? pool.find((candidate) => candidate.familyId === forceFamilyId)
      : undefined;
    // One shape at a time rather than all three at once, because each zone draws from its own pool.
    // `usedFamilies` is threaded through so diversity still holds across the whole beat.
    const picked = pickDiverseShapes(pool, state, 1, { families: usedFamilies, bigPieces });
    // The roll happens either way, so the rng advances identically whether or not a shape was forced.
    // Otherwise a forced beat and a rolled one would put the generator in different states and the two
    // would diverge for the rest of the run.
    state = picked.rngState;
    const shape = forced ?? picked.shapes[0];
    // Only reachable if a zone's pool is empty, which the tests rule out. Skipping is better than
    // throwing: a beat with two footprints still plays.
    if (!shape) continue;

    usedFamilies.add(shape.familyId);
    if (shapeCellCount(shape) >= 5) bigPieces += 1;

    const origins = originsInZone(zone, shape);
    if (origins.length === 0) continue;
    const roll = nextInt(state, origins.length);
    state = roll.state;
    const origin = origins[roll.value];

    placed.push({ zone, shape, row: origin.row, column: origin.column });
  }

  const built = toPieces(
    placed.map((entry) => entry.shape),
    state,
    trayGeneration,
  );
  state = built.rngState;

  let groups: SlotGroup[] = placed.map((entry, index) => {
    const piece = built.pieces[index];
    return {
      id: `${trayGeneration}:${index}`,
      zone: entry.zone.id,
      pieceId: piece.id,
      colorId: piece.colorId,
      cells: footprintOf(grid, entry.shape, entry.row, entry.column),
      origin: { row: entry.row, column: entry.column },
      filled: [],
    };
  });
  let tray = built.pieces;

  /**
   * The varieties, in two passes: reshape the beat, then resolve onto it.
   *
   * Two passes rather than one because a variety that splits a footprint has to run *before* the ones that
   * decorate footprints, or they would resolve against a skeleton that is about to be replaced. Both are
   * skipped entirely on the launch, and both thread the generator — see the contract's rng rule.
   */
  const requests = launch ? [] : plan.varieties;
  let varieties: VarietySpec[] = [];

  if (requests.length > 0) {
    const ctx: DealContext = { grid, beatIndex, combo: plan.combo, groups, tray, rngState: state };

    const shaped = shapeBeat(requests, ctx);
    if (shaped) {
      groups = shaped.groups;
      tray = shaped.tray;
      state = shaped.rngState;
    }

    const dealt = dealVarieties(requests, { ...ctx, groups, tray, rngState: state });
    varieties = dealt.varieties;
    state = dealt.rngState;
  }

  return {
    beat: {
      index: beatIndex,
      groups,
      placements: [],
      status: 'placing',
      launch,
      varieties,
      voided: false,
    },
    tray,
    rngState: state,
  };
}

/**
 * Whether a beat's footprints are all placeable as dealt — the guarantee, as an assertion.
 *
 * Only used by tests, but it lives here because it is a statement about what `dealBeat` promises
 * rather than about how it happens to work today.
 */
export function beatHasPerfectSolution(grid: BoardSpec, beat: Beat, tray: readonly Piece[]): boolean {
  const field: Board = createEmptyBoard(grid);

  for (const group of beat.groups) {
    const piece = tray.find((candidate) => candidate.id === group.pieceId);
    if (!piece) return false;
    if (!canPlace(grid, field, piece.cells, group.origin.row, group.origin.column)) return false;
    for (const index of group.cells) field[index] = piece.colorId;
  }

  return true;
}
