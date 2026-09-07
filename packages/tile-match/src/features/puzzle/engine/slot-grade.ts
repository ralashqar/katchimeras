/**
 * Grading a beat, in two independent dimensions: **accuracy** per placement, **pace** per beat.
 *
 * They are separate on purpose, and that separation is the whole content of this module.
 *
 * ## Why pace no longer breaks the streak
 *
 * It used to. `gradePlacement` folded both dimensions into one verdict, so a pixel-exact placement
 * made a fraction of a second too slowly graded `good`, which reset the combo — and because the
 * combo is the dominant term in the speed payout, a single slow drag cost most of a race.
 *
 * That was double-counting. **Being slow is already self-penalising**: the race clock runs whether or
 * not the player is dragging, so a slow beat means fewer beats, which means less total payout. Adding
 * a streak reset on top made the clock the harshest thing in the game while the brief says accuracy
 * is what wins races. Now accuracy alone moves the combo, and being late costs the beat's flat bonus
 * — a real cost, paid once, that does not compound.
 *
 * ## Why pace is measured per beat rather than per piece
 *
 * A per-piece window judges three drags as three independent tests, so one fumble on the second
 * piece condemns a beat where the other two were quick. That is not how the beat *feels* — the player
 * experiences it as one unit of work with one deadline. Summing the placements and comparing against
 * a budget that scales with the piece count lets a fast drag pay for a slow one, which is both fairer
 * and much closer to what "you were too slow" means.
 *
 * `scripts/match-probe.ts` drives these numbers headlessly against scripted players of varying pace
 * and accuracy, so they can be set from what they do to a race rather than from how they feel in
 * isolation.
 */

// Pure module — `.ts` extension imports so it runs under `node --test`.
import type { BeatPace, PlacementGrade } from './slot-types';

export const GRADE = {
  /**
   * Coverage floor for a `good`.
   *
   * Half the piece on target. Below that the drop was not really aimed at the footprint, and
   * crediting it would make the accuracy dimension meaningless — the whole point of partial fills is
   * that they are visibly worse than an exact one, not that everything counts a bit.
   */
  MIN_COVERAGE: 0.5,

  /**
   * Cells of positional error a `perfect` allows.
   *
   * Zero. A `perfect` is an exact placement, and there is no half-credit tier between exact and
   * one-cell-out because at cell scale one cell out is unambiguous — the footprint is drawn on
   * screen, so the player can see whether they hit it.
   */
  PERFECT_OFFSET: 0,
} as const;

/**
 * The beat's time budget: a fixed cost plus one per piece.
 *
 * The two terms model the two things the player actually does. `BASE_MS` is **read the beat** — the
 * footprints have just arrived and have to be located before the first drag can begin, and that
 * happens once however many there are. `PER_PIECE_MS` is one drag at the pace a good player
 * sustains, which is where the old 1100ms per-placement window came from.
 *
 * So the budget comes out at 1500ms for a single and 2550 for a double, which are the only two sizes a
 * beat comes in — see `BEAT_TIERS`. Against the old rule — 1100ms per piece, each judged alone — every
 * beat is more generous, and the single is the most generous of all by some margin. That is deliberate: a
 * single is the only beat where a fumble cannot be averaged away, and it is where a player who has just
 * broken a streak lands. It is *also* where the drift is introduced, which makes the extra room earn its
 * keep twice: the hardest rung to learn is the one with the most slack per drag.
 *
 * Note the per-piece *allowance* tightens as the beat grows (1500, then 1275), which is the base being
 * amortised rather than a difficulty ramp — you do not re-read the field between pieces. The averaging
 * more than pays for it. The function still takes an arbitrary count and still extrapolates correctly, so
 * a third footprint returning would need no change here.
 */
export const PACE = {
  BASE_MS: 450,
  PER_PIECE_MS: 1050,
} as const;

/**
 * Milliseconds a beat of `pieceCount` pieces is allowed before it reads as late.
 *
 * `allowanceMs` is time the beat's own **mechanics** force the player to spend, and it is added on top. Two
 * varieties make you wait rather than making you aim: a cycling bomb has to be waited out, and a mismatched
 * footprint cannot be dropped on until it turns back. Neither wait is avoidable and neither is a mistake — so
 * charging it against a budget sized for *drags* marked a player LATE for playing correctly, which is the one kind
 * of failure this codebase keeps having to remove.
 *
 * It arrives as a parameter rather than being derived here because this module has no idea varieties exist, and
 * that separation is worth more than the convenience: `slot-grade.ts` grades, and what a beat costs in waiting is
 * the beat's business. See `beatPaceAllowanceMs`.
 */
export function paceBudgetMs(pieceCount: number, allowanceMs = 0): number {
  return (
    PACE.BASE_MS + Math.max(0, pieceCount) * PACE.PER_PIECE_MS + Math.max(0, allowanceMs)
  );
}

/**
 * Was the beat on time?
 *
 * `elapsedMs` is the **sum** of its placements' elapsed times, which is the beat's wall duration
 * because each placement is timed from the previous drop.
 */
export function gradePace(elapsedMs: number, pieceCount: number, allowanceMs = 0): BeatPace {
  return elapsedMs <= paceBudgetMs(pieceCount, allowanceMs) ? 'onTime' : 'late';
}

export type GradeInput = {
  /** 0..1, from `scorePlacement`. */
  coverage: number;
  /** Chebyshev distance in cells from the group's origin. `Infinity` for a drop that touched nothing. */
  offset: number;
};

/**
 * Grade one drop's **accuracy**. Nothing to do with how long it took.
 *
 * Three tiers rather than two because a partial fill is a real, visible outcome — the footprint stays
 * half empty and pays proportionally less — and calling that the same thing as a drop that landed in
 * open space would throw away the game's clearest piece of feedback.
 */
export function gradePlacement({ coverage, offset }: GradeInput): PlacementGrade {
  if (coverage >= 1 && offset <= GRADE.PERFECT_OFFSET) return 'perfect';
  if (coverage >= GRADE.MIN_COVERAGE) return 'good';
  return 'miss';
}

/**
 * The accuracy grade for a whole beat: its worst placement.
 *
 * Worst rather than an average, because the streak rule is all-or-nothing and the callout should say
 * the same thing the combo just did. A beat with no placements at all — which the reducer cannot
 * currently produce, since a beat always deals at least one group — grades as a miss rather than
 * as a free perfect.
 */
export function gradeBeat(grades: readonly PlacementGrade[]): PlacementGrade {
  if (grades.length === 0) return 'miss';
  if (grades.includes('miss')) return 'miss';
  if (grades.includes('good')) return 'good';
  return 'perfect';
}
