/**
 * One footprint keeps turning. Drop its piece only while it faces the way the piece does.
 *
 * The third timing mechanic, and a sibling of the colour clock and the cycling bomb by design: the target tells
 * you "not yet" on a schedule you can see, and the answer is *when*, not *where*. Every `windowMs` the footprint
 * flips between its true orientation and a wrong one — drawn turned about its own centre — and while it is turned
 * it refuses its piece outright.
 *
 * ## Why the target turns and the piece does not
 *
 * Same reasoning as `hues`: a piece that changed in your hand would read as the game cheating, where a target that
 * turns away is a light going red. It also keeps the input model intact — there is no rotate gesture to teach.
 *
 * ## Why the cells never change
 *
 * The footprint's `cells` are the dealt shape at the dealt origin, always. The turn is a *rule* (`accepts`) and a
 * *transform* (the group's angle in `GroupMotion`), never a rewrite of the cells — so the dealer's guarantee that a
 * perfect beat is available holds without an argument, the drop resolve is untouched by the angle, and a drop on a
 * turned footprint is refused through the same path a wrong colour takes.
 *
 * ## Which shapes can spin
 *
 * Only a shape that *looks* different turned. A square is the same at every quarter turn, so a beat whose rolled
 * footprint is one is dealt inert rather than pretending. `visibleTurns` lists the quarter turns that change the
 * silhouette; a line has one distinct look (upright vs flat), an L has three.
 *
 * Capabilities: **B** (data), **C** (schedule), **D** (`accepts`), **I** (`waitMs`). No `shape`.
 */

// Pure module — `.ts` extension imports so it runs under `node --test`.
import { nextInt } from '../../../../core/rng';
import { normaliseCells, rotateCells } from '../../engine/board';
import type { Cell } from '../../engine/types';
import { defineVariety } from '../contract';

/**
 * How long a footprint holds each orientation, milliseconds.
 *
 * Sized like the bomb's window rather than the colour clock's: a turned footprint is read at a glance, but the
 * player then has to *aim* a drag at a target that is about to turn back, and a window shorter than a whole drag
 * would detonate a correctly started drop mid-air.
 */
export const SPIN_WINDOW_MS = 2400;

/** How much `strength` may shorten the window, as a fraction. */
export const SPIN_WINDOW_SQUEEZE = 0.35;

/**
 * At or above this strength the footprint cycles through **two** wrong orientations rather than one.
 *
 * Below it the mechanic is a metronome — turned, true, turned, true — which is the legible form to meet first.
 * Above it the turned look changes each time, so there is one more thing to read before deciding to wait.
 */
export const SPIN_DOUBLE_AT = 0.6;

export type SpinData = {
  /** The one footprint that turns, or `null` when nothing dealt could. */
  groupId: string | null;
  /** The quarter turns it cycles through while turned, each a distinct look. Never contains 0. */
  turns: number[];
  windowMs: number;
  nextTurnMs: number;
  /** True while the footprint is showing a wrong orientation and refusing its piece. */
  turned: boolean;
  /** Quarter turns from true, 0 while aligned. What the view rotates by. */
  facing: number;
};

export function spinWindowMs(strength: number): number {
  const clamped = Math.min(1, Math.max(0, strength));
  return Math.round(SPIN_WINDOW_MS * (1 - SPIN_WINDOW_SQUEEZE * clamped));
}

const signature = (cells: readonly Cell[]) =>
  normaliseCells(cells)
    .map((cell) => `${cell.row},${cell.column}`)
    .join('|');

/**
 * The quarter turns that give this shape a look it does not already have.
 *
 * Deduplicated against the true orientation *and* against each other, so a line reports one turn rather than two
 * that look identical, and a square reports none.
 */
export function visibleTurns(cells: readonly Cell[]): number[] {
  const seen = new Set<string>([signature(cells)]);
  const turns: number[] = [];
  for (const turn of [1, 2, 3]) {
    const look = signature(rotateCells(cells, turn));
    if (seen.has(look)) continue;
    seen.add(look);
    turns.push(turn);
  }
  return turns;
}

export const SPIN_VARIETY = defineVariety<SpinData>({
  id: 'spin',

  /**
   * Roll one footprint that can visibly turn.
   *
   * The roll is over every group and is **unconditional** — burned even when nothing can spin — which is the
   * contract's rng rule. Which group it lands on is then taken modulo the spinnable ones, so a beat with one
   * square and one L always spins the L without the generator learning anything about shapes.
   *
   * Opens with a turn **already due** (`nextTurnMs: 0`), for the reason the bomb and the colour clock both open
   * live: a brisk player who drops inside the first window must still meet the mechanic. The first tick turns it
   * through the one path that changes what the player sees, so `turned: false` here is honest for exactly as
   * long as it takes to become true.
   */
  deal: (ctx, strength) => {
    const roll = nextInt(ctx.rngState, Math.max(1, ctx.groups.length));
    const spinnable = ctx.groups
      .map((group) => {
        const piece = ctx.tray.find((entry) => entry.id === group.pieceId);
        return piece ? { group, turns: visibleTurns(piece.cells) } : null;
      })
      .filter((entry): entry is { group: (typeof ctx.groups)[number]; turns: number[] } => !!entry && entry.turns.length > 0);

    const picked = spinnable.length > 0 ? spinnable[roll.value % spinnable.length] : null;
    const turns = picked ? (strength >= SPIN_DOUBLE_AT ? picked.turns.slice(0, 2) : picked.turns.slice(0, 1)) : [];

    return {
      data: {
        groupId: picked?.group.id ?? null,
        turns,
        windowMs: spinWindowMs(strength),
        nextTurnMs: 0,
        turned: false,
        facing: 0,
      },
      rngState: roll.state,
    };
  },

  deadlineMs: (data) => (data.groupId === null ? null : data.nextTurnMs),

  /** One window of standing still, on every beat — the deal opens on a turn. */
  waitMs: (data) => (data.groupId === null ? 0 : data.windowMs),

  /**
   * Turn, or turn back, and schedule the next.
   *
   * Derived from how many windows have elapsed rather than stepped once, so a stalled frame lands on the right
   * orientation instead of leaving the schedule behind. Window 0 is turned — see `deal` — so the true orientation
   * is up on the odd windows, and each turned window shows the next look in `turns`.
   */
  expire: (data, beatElapsedMs) => {
    if (data.groupId === null || data.turns.length === 0) {
      return { data: { ...data, nextTurnMs: Number.POSITIVE_INFINITY }, effects: [] };
    }
    const window = Math.floor(beatElapsedMs / data.windowMs);
    const turned = window % 2 === 0;
    return {
      data: {
        ...data,
        turned,
        facing: turned ? data.turns[Math.floor(window / 2) % data.turns.length] : 0,
        nextTurnMs: (window + 1) * data.windowMs,
      },
      effects: [],
    };
  },

  /** A turned footprint takes nothing. Every other footprint is unaffected. */
  accepts: (data, { group }) => group.id !== data.groupId || !data.turned,
});
