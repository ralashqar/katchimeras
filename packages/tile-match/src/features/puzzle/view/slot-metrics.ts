/**
 * Pixel geometry for the slot field, and the ordering of its outro.
 *
 * Deliberately thin. `metrics.ts` is already dimension-agnostic — it takes a `BoardSpec` and solves
 * a cell grid — so `boardMetricsForCell(SLOT_GRID, cell)`, `cellOrigin` and `firstCellCenter` all
 * work on the slot field verbatim. All that is genuinely slot-specific is the cell size range and
 * the burst ordering, so that is all this module holds.
 *
 * Pure, and kept out of the Skia components deliberately: it is shared geometry, and the delays are
 * the piece worth unit testing — they *are* the cascade, and they were the source of the one real
 * bug in the board's version of this.
 */

// Pure module — `.ts` extension imports so it runs under `node --test`.
import { SLOT_PLAY_AREA } from '../engine/slot-types';
import { cellOrigin, type BoardMetrics } from './metrics';
import type { BlockColorId, BoardSpec } from '../engine/types';

/** A rectangle in field-box pixel coordinates. */
export type SlotRect = { x: number; y: number; width: number; height: number };

/**
 * The part of the field box that anything is actually drawn in.
 *
 * The virtual grid carries `SLOT_MARGIN` empty cells on every side so that a drop aimed past a zone
 * has somewhere to land that is not a target — see `SLOT_GRID`. That margin must not cost screen
 * space, so everything that positions or measures the field on screen works from this rect and lets
 * the box's empty edges hang off it.
 */
export function slotPlayRect(metrics: BoardMetrics): SlotRect {
  const topLeft = cellOrigin(metrics, SLOT_PLAY_AREA.rowFrom, SLOT_PLAY_AREA.columnFrom);
  const bottomRight = cellOrigin(metrics, SLOT_PLAY_AREA.rowTo, SLOT_PLAY_AREA.columnTo);
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: bottomRight.x + metrics.cell - topLeft.x,
    height: bottomRight.y + metrics.cell - topLeft.y,
  };
}

/**
 * Cell size bounds for the slot field, in points.
 *
 * Narrower than the board's 32–48, and for a different reason. The board's range existed so an
 * 8-column grid could shrink to fit a narrow screen; the slot field's seven columns fit any phone
 * across this whole range, so width rarely binds. What binds is **height**, and indirectly the size
 * of the 3D view: the field is centred on the car, so a taller field pushes the car down the screen,
 * which forces the hero shorter — see `race-layout.ts`. Every point of cell size is paid for out of
 * the road.
 *
 * The floor is the board's, because it was chosen for the same thing that matters here and matters
 * more: a cell below ~32pt is hard to hit, and this game grades how precisely you hit it.
 */
export const SLOT_MIN_CELL = 32;
export const SLOT_MAX_CELL = 42;

/**
 * The size the field aims for when the screen allows it.
 *
 * 38 is the balance point of the trade above: two points of cell buys roughly fifteen points of
 * hero height. Below ~34 the drag starts to feel finicky against the grading; above ~40 the road
 * loses noticeably more than the field gains.
 */
export const SLOT_TARGET_CELL = 38;

/*
 * The field's **drift** used to live here — its amplitude, its rate, its compound wave and the pure
 * `slotDriftOffset` that produces the offset. It moved to `variety/drift/drift-metrics.ts` when the drift
 * became a variety, because a variety owns its own timings and geometry rather than adding to the field's.
 *
 * This module keeps only what belongs to *every* beat: the cell size range, the arrival pop and the outro's
 * ordering.
 */

/**
 * The arrival pop, per cell: how long one cell's landing flourish runs, and the stagger between them.
 *
 * Both lifted from the board's `PlacementArrival`, which used 280 and 45 — the point is to match a feel
 * the game already had rather than invent a new one. A cell that simply appears reads as the game
 * accepting input; a cell that pops reads as the player *doing* something, and that distinction is most
 * of what made the board satisfying to place on.
 */
export const SLOT_ARRIVAL_MS = 160;
export const SLOT_ARRIVAL_STEP_MS = 28;

/**
 * How long the pop runs over `cellCount` cells, milliseconds.
 *
 * **Zero for zero cells**, which matters because this gates the outro: a drop that filled nothing has no
 * flourish to wait for, and returning a full window there would hold the payout back for a quarter of a
 * second with nothing on screen to justify it.
 */
export function slotArrivalSpanMs(cellCount: number): number {
  if (cellCount <= 0) return 0;
  return (cellCount - 1) * SLOT_ARRIVAL_STEP_MS + SLOT_ARRIVAL_MS;
}

/**
 * Milliseconds between one cell going out and the next.
 *
 * **Must match `haptics.cellCascade`'s tap step**, which is why it is passed to it rather than left
 * for both to assume: the pop and the pulse landing together is the entire effect. 40 ms is also the
 * floor at which the motor renders adjacent pulses as separate taps rather than one buzz.
 */
export const SLOT_BURST_STEP_MS = 32;

/**
 * Extra pause between one footprint finishing and the next starting.
 *
 * Small, but it is what makes a three-slot beat read as *three things clearing* rather than as one
 * long run of twelve cells. Without it the sequence is uniform and the grouping is invisible.
 */
export const SLOT_GROUP_GAP_MS = 44;

/**
 * Turn resolved cells into burst input, one cell at a time in the order they were filled.
 *
 * The delay is a **running sequence**, not a function of position, and that is the fix for how this
 * felt. Two earlier attempts were both wrong:
 *
 *  - The board's `clearCascadePhase`, which phases a cell by its offset along the line that cleared
 *    it. There are no lines here, so it returns `Infinity` for every cell, which the burst clamps to
 *    its *maximum* stagger — the field empties, holds blank, then pops all at once. The board's launch
 *    wipe hit exactly this.
 *  - A diagonal sweep across the field by row and column. Better, but the footprints are scattered
 *    around the car by design, so a spatial sweep fires cells from different slots interleaved. It
 *    reads as noise: nothing on screen corresponds to the order things happen in.
 *
 * Sequencing by group and then within the group means slot one empties, then slot two, then slot
 * three — which is what the player just did, in the order they did it, and it gives the haptic run
 * something real to be locked to.
 *
 * `cells` must arrive grouped, which `slot-reducer`'s `resolveBeat` guarantees: it walks the groups in
 * order and pushes each one's filled cells together. `groupSizes` is what recovers the boundaries.
 */
export function buildSlotBurst(
  grid: BoardSpec,
  metrics: BoardMetrics,
  cells: readonly { index: number; colorId: BlockColorId }[],
  groupSizes: readonly number[] = [],
): { x: number; y: number; colorId: BlockColorId; delayMs: number }[] {
  /**
   * Which group each cell belongs to, by position in the flat list.
   *
   * Built explicitly rather than by testing membership of a set of boundary offsets. A group whose
   * piece missed entirely contributes **zero** cells, so two boundaries can land on the same offset —
   * and a set collapses them, which silently under-counts the group index and shrinks the gap. An
   * array cannot get that wrong.
   */
  const groupOf: number[] = [];
  groupSizes.forEach((size, group) => {
    for (let i = 0; i < size; i += 1) groupOf.push(group);
  });

  return cells.map(({ index, colorId }, order) => {
    const group = groupOf[order] ?? 0;
    const { x, y } = cellOrigin(metrics, Math.floor(index / grid.cols), index % grid.cols);
    return {
      x,
      y,
      colorId,
      delayMs: order * SLOT_BURST_STEP_MS + group * SLOT_GROUP_GAP_MS,
    };
  });
}

/**
 * How long a burst over `cellCount` cells in `groupCount` footprints runs, milliseconds.
 *
 * An **upper bound**, not the exact value: a beat where one piece missed entirely has a group that
 * contributes no cells and therefore no gap, so the real span is shorter. That is the right direction
 * to be wrong in, because callers use this to decide how long to wait — over-estimating wastes a few
 * milliseconds, under-estimating cuts the tail off the animation.
 */
export function slotBurstSpanMs(cellCount: number, groupCount: number): number {
  return (
    Math.max(0, cellCount - 1) * SLOT_BURST_STEP_MS +
    Math.max(0, groupCount - 1) * SLOT_GROUP_GAP_MS
  );
}

/**
 * One cell's own life when a beat resolves, in two halves: it **settles**, then it **leaves**.
 *
 * These are per cell and they run back to back, which is the whole point. An earlier version made the
 * settle and the outro two *global* phases — every cell popped, and only once the last one had finished
 * did any cell begin to leave. That is inherently slow, and it read as a wait: nothing moved for a third
 * of a second, then everything went at once.
 *
 * Per cell they pipeline instead. Cell two is still rising while cell one is already falling, so the
 * payout streams. It also lets the two halves be a *single* motion rather than two: the settle is the
 * rise (glow, swell) and the outro is the fall (shrink, spin, fade), so a cell never has to come back to
 * rest between them and there is no double hump.
 *
 * They live here rather than in `ClearBurstSkia` because the beat's settle timing is derived from them,
 * and the pure modules that derive it must not have to import Skia — `node --test` runs these directly.
 */
export const SLOT_CELL_SETTLE_MS = 140;
export const SLOT_CELL_OUTRO_MS = 230;

/** One cell's full window: settle plus leave. */
export const SLOT_CELL_LIFE_MS = SLOT_CELL_SETTLE_MS + SLOT_CELL_OUTRO_MS;

/**
 * Where in a cell's window it stops rising and starts leaving, as a fraction.
 *
 * The burst remaps its per-cell ramps around this, so the two halves stay in step with the timings above
 * rather than each having its own hard-coded stops.
 */
export const SLOT_CELL_SETTLE_FRACTION = SLOT_CELL_SETTLE_MS / SLOT_CELL_LIFE_MS;

/**
 * Quiet held between the last cell going out and the next beat's footprints coming in.
 *
 * Small, because the settle is no longer a fixed pause — it is the burst's own length plus this. The
 * ordering is the thing that matters: **cells animate out, then ghosts animate in**, never overlapping.
 * A flat pause could not guarantee that, since a three-slot beat's cascade runs nearly three times as
 * long as a one-slot beat's and would still be playing when the next beat was dealt.
 */
export const SLOT_SETTLE_GAP_MS = 140;

/**
 * How long to hold a resolved beat before dealing the next one, milliseconds.
 *
 * The last cell starts at `slotBurstSpanMs` and then lives for `SLOT_CELL_LIFE_MS` — settling and
 * leaving — so that sum is when the field is genuinely empty, and the gap is the breath after it.
 *
 * Scales with the payout, which is a happy side effect rather than the goal: a big beat earns a longer
 * beat of silence to land in, and a one-slot opener moves on briskly.
 */
export function beatSettleMs(cellCount: number, groupCount: number): number {
  if (cellCount <= 0) return SLOT_SETTLE_GAP_MS;
  return slotBurstSpanMs(cellCount, groupCount) + SLOT_CELL_LIFE_MS + SLOT_SETTLE_GAP_MS;
}

// ------------------------------------------------------------------ the blast

/**
 * A voided beat's detonation, in two movements.
 *
 * The third outro gesture, and it exists because the other two are both wrong for this. `ClearBurstSkia` is a
 * reward and `SlotMissSkia` is gravity — *that did not work* — but a voided beat is neither earned nor merely
 * failed: it is the one outcome in the game that pays **nothing at all**, worse than missing every footprint.
 * It needs its own vocabulary, and the vocabulary is violence.
 *
 * The two movements matter more than the numbers:
 *
 * 1. **Every cell judders together** for `SLOT_BLAST_SHAKE_MS`, rimmed in the sabotage red. Together, not
 *    staggered — a stagger here would read as a wave passing along the footprint, where the point is that the
 *    whole turn is about to go. This is the flinch, and it is what makes the bang legible when it lands.
 * 2. **Then they blow, one after another**, fast. `SLOT_BLAST_STEP_MS` is deliberately far tighter than the
 *    burst's cascade: a payout streams because streaming *is* the reward, and a detonation rips.
 *
 * Kept here rather than in the component for the reason the rest of this module is: the screen has to size the
 * settle against the blast's own length, and it should not have to import Skia to ask how long that is.
 */
export const SLOT_BLAST_SHAKE_MS = 260;

/** How long one cell takes to come apart. Short — the judder is the drama, not the fragments. */
export const SLOT_BLAST_POP_MS = 300;

/**
 * Per-cell stagger through the second movement.
 *
 * Deliberately below `SLOT_BURST_STEP_MS`, which is floored at ~30ms because the burst fires **one haptic tap per
 * cell** and the motor blurs anything faster into a single buzz. The blast has no such floor — it fires two hits
 * total, a rattle and a bang — so it is free to be quicker than the eye reads as a queue, which is what makes it
 * rip rather than cascade.
 */
export const SLOT_BLAST_STEP_MS = 22;

/** The whole detonation over `cellCount` cells, milliseconds. */
export function slotBlastSpanMs(cellCount: number): number {
  if (cellCount <= 0) return 0;
  return SLOT_BLAST_SHAKE_MS + (cellCount - 1) * SLOT_BLAST_STEP_MS + SLOT_BLAST_POP_MS;
}

/**
 * How long to hold a **voided** beat before dealing the next one.
 *
 * A voided beat clears no cells, so `beatSettleMs` returns the bare `SLOT_SETTLE_GAP_MS` for it — 140ms, which
 * is right for "nothing happened" and nowhere near enough for the blast. This is the same shape as its sibling:
 * the animation's own length plus the breath after it.
 */
export function blastSettleMs(cellCount: number): number {
  return slotBlastSpanMs(cellCount) + SLOT_SETTLE_GAP_MS;
}
