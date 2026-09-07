/**
 * The slot game's data model.
 *
 * Pure, like the rest of `engine`: no React, no react-native, no side effects, and — the one that
 * shapes this file most — **no clock**. A placement's timing is graded, so the reducer needs to
 * know how long the player took; it takes that as an action payload rather than reading a clock,
 * which is what keeps a whole run reproducible from a seed and a list of actions.
 *
 * ## The slot field is a small board
 *
 * A `SLOT_GRID` is a `BoardSpec` and the field's occupancy is a `Board`. That is not a convenient
 * coincidence, it is the reason the pivot is as small as it is: `board.ts` — `boardIndex`,
 * `canPlace`, `validOrigins`, `cellsExtent` — and `shapes.ts` both carry over untouched. What
 * changes is only what a filled cell *means*. On the board, filling a whole row cleared it. Here,
 * filling a group's footprint completes it, and a beat resolves when every piece has been played.
 *
 * ## Why `Resolution` is reused rather than replaced
 *
 * `slot-reducer` emits the same `Resolution` shape the board used to. `event-bridge.ts` diffs
 * `eventSequence` and folds `Resolution` into the race sim, and `haptics.clearCascade`, the bullet
 * volley and the streak callout all ride the events it produces. Keeping the shape means none of
 * that had to be touched — the only edit the bridge needed was where it gets `lineCount` from.
 */

// Pure module — `.ts` extension imports so it runs under `node --test`.
import type { BlockColorId, BoardSpec, Cell, Piece, Resolution } from './types';
import type { VarietySpec } from '../variety/contract';
import type { Progression } from './progression';

/**
 * The slot field's **virtual** grid — the coordinate space drops are resolved in.
 *
 * Bigger than the area anything is drawn in, and the difference is the point. `SLOT_MARGIN` rows and
 * columns of empty space surround the zones on every side, and they exist to fix a real scoring bug:
 * `resolveSlotDrop` clamps a drop's origin so the footprint stays on the grid, so when a zone sat
 * flush against column 0 a drop aimed two cells *past* the left edge was clamped straight onto the
 * ghost and scored a perfect. The margin gives an over-shoot somewhere to land that is not a target.
 *
 * Nothing is ever drawn in the margin, so it costs no screen space — see `SLOT_PLAY_AREA`, which is
 * what the layout solver positions and fits. The virtual grid can therefore be as generous as the
 * accuracy measurement wants without the field growing.
 */
export const SLOT_GRID: BoardSpec = { rows: 8, cols: 13 };

/**
 * Empty rows and columns held around the zones, in cells.
 *
 * Two, which is what makes the miss tiers come out right: a drop one cell out still clips the
 * footprint and earns partial credit — that is the design — while a drop two or more cells out lands
 * wholly in margin and scores nothing. At one the clamp made a two-cell miss indistinguishable from a
 * one-cell miss; at zero it made it indistinguishable from a perfect.
 */
export const SLOT_MARGIN = 2;

/**
 * The rectangle the zones occupy, in cell coordinates — everything that is ever drawn.
 *
 * The layout solver centres *this* on the car and fits *this* between the HUD and the tray. The full
 * grid box extends past it by `SLOT_MARGIN` on every side and simply hangs off screen, empty.
 */
export const SLOT_PLAY_AREA = {
  rowFrom: SLOT_MARGIN,
  rowTo: SLOT_GRID.rows - 1 - SLOT_MARGIN,
  columnFrom: SLOT_MARGIN,
  columnTo: SLOT_GRID.cols - 1 - SLOT_MARGIN,
} as const;

/**
 * Largest piece the slot dealer will hand out, in cells.
 *
 * Six, which in practice is not the binding constraint at all — the **per-zone extent caps** in
 * `slot-deal.ts` are. This only has to be loose enough not to veto a shape the zones could hold, and
 * a zone holds at most 2x3.
 *
 * It was four, which silently vetoed `rectangle-2x3` outright: the 2x3 rectangle fits the bottom zone
 * exactly and its 3x2 rotation fits both flanks, so the cap was the only thing keeping the catalogue's
 * bulkiest piece out of a game it fits fine. The stated reason was that a big shape is slow to aim
 * against a per-placement clock — but pace is now judged per beat and summed, so a shape that takes an
 * extra moment is paid for out of the beat's budget rather than failing a window on its own.
 *
 * `MAX_BIG_PIECES` in `tray.ts` still caps a beat at one 5-plus-cell piece, so a two-slot beat can never
 * be two bulky shapes at once.
 */
export const MAX_SLOT_PIECE_CELLS = 6;

/**
 * How well one piece was placed — **accuracy only**.
 *
 * This used to fold in timing, so a slow but exact drop graded `good` and broke the streak. Pace is
 * now a separate per-beat verdict (`BeatPace`) that does not touch the combo. See `slot-grade.ts`.
 */
export type PlacementGrade = 'perfect' | 'good' | 'miss';

/**
 * Whether a beat came in under its time budget.
 *
 * Per **beat**, not per placement, and the budget scales with the piece count — see `paceBudgetMs`.
 * Being `late` costs the beat's flat perfect bonus and raises the `LATE` callout; it deliberately
 * leaves the streak alone, because the race clock already charges for slowness.
 */
export type BeatPace = 'onTime' | 'late';

/**
 * Where a footprint sits relative to the car.
 *
 * The whole reason the field is zoned rather than free-form: a slot should have a *place*, so the
 * player learns where to look instead of scanning. `left` and `right` flank the car at its own
 * height; `below` sits under its rear, on the road.
 */
export type SlotZoneId = 'left' | 'below' | 'right';

/**
 * One target footprint: where a piece is supposed to go, and what has landed on it so far.
 *
 * `cells` are absolute field coordinates, already offset to the group's origin, because every
 * consumer wants them that way — the renderer draws them, and `scorePlacement` intersects against
 * them. `origin` is kept separately only so accuracy can be measured as a distance.
 */
export type SlotGroup = {
  id: string;
  /** Which side of the car this footprint is on. */
  zone: SlotZoneId;
  /** The piece dealt for this group. Its shape *is* this footprint. */
  pieceId: string;
  /** Shared with the piece, so colour is what pairs the two on screen. */
  colorId: BlockColorId;
  /** Target cells, as flat field indices. */
  cells: number[];
  /** The origin the piece's shape sits at here — the answer a perfect drop matches. */
  origin: Cell;
  /** Which of `cells` have actually been filled. A subset, in no particular order. */
  filled: number[];
};

/** What one drop achieved. Kept per beat so the beat can be graded as a whole. */
export type Placement = {
  /** The group this drop was attributed to, or null when it overlapped none. */
  groupId: string | null;
  /**
   * Field indices this drop actually filled.
   *
   * The same information the group's own `filled` now carries, but *only this drop's* contribution —
   * which is what the arrival animation needs. A group filled by two pieces would otherwise pop all of
   * its cells again on the second one.
   */
  filled: number[];
  /**
   * Field indices the piece covered that scored nothing.
   *
   * Recorded because a wasted cell is the clearest feedback the game has for a bad drop: the view
   * tumbles these away immediately, at the moment of the mistake, rather than leaving the player to
   * infer it from a footprint that stayed half empty.
   */
  wasted: number[];
  /** The colour the piece was, so the wasted cells fall away in it. */
  colorId: BlockColorId;
  /** Fraction of the piece's cells that landed on an unfilled target cell, 0..1. */
  coverage: number;
  /** Chebyshev distance in cells from the group's true origin. 0 is exact. */
  offset: number;
  /**
   * Time from the previous drop, or from the start of the beat for the first.
   *
   * Kept per placement even though nothing grades it alone any more, because the beat's pace is the
   * **sum** of these — and because they only add up to the beat's wall duration if each is measured
   * from the last drop rather than from the beat's start.
   */
  elapsedMs: number;
  /** Accuracy only. Timing is judged once for the whole beat. */
  grade: PlacementGrade;
  /**
   * Why a drop that was **aimed correctly** still landed nothing, or `null` if nothing refused it.
   *
   * A refused drop is scored through exactly the path a badly aimed one takes — that is the whole point of
   * filtering the candidates rather than special-casing the grader — which leaves it indistinguishable from a
   * miss in the result. And those two deserve completely different feedback: "you were a cell out" is advice
   * about aim, where "that footprint would not take that piece" is a rule the player may not have noticed.
   *
   * So the reducer records which filter ate it, and only when the drop **would otherwise have hit** — see
   * `place`. A drop into empty space is a miss whatever the colours were, and saying WRONG COLOUR there would be
   * coaching about the wrong mistake.
   */
  refused: PlacementRefusal | null;
  /**
   * This drop was **eaten by a mechanic** rather than scored — see the `absorb` capability.
   *
   * Recorded on the beat so the view can react to it, and skipped by everything that grades: it moves neither
   * accuracy nor the pace budget, and it does not consume its piece. A beat can therefore hold several of these
   * before the drop that actually counts.
   *
   * The other fields are all zero or inert on an absorbed placement, `grade` included. Nothing reads them, and
   * they are filled in rather than made optional so a `Placement` stays one shape.
   */
  absorbed: boolean;
};

/**
 * Which of the two candidate filters refused a drop.
 *
 * `colour` is the game's own rule (`matchesColour`); `variety` is a beat mechanic's `accepts`. Distinguished
 * because the player is owed a different word for each, and because a variety refusing a drop is a mechanic
 * doing its job where colour refusing one is a mistake.
 */
export type PlacementRefusal = 'colour' | 'variety';

export type BeatStatus = 'placing' | 'resolved';

export type Beat = {
  /** 0-based. Drives the slot-count ramp. */
  index: number;
  groups: SlotGroup[];
  /** One entry per drop, in the order they happened. */
  placements: Placement[];
  status: BeatStatus;
  /**
   * This is the launch, not a turn of the race.
   *
   * The opening beat is what the screen holds the grid for: drag it home and the countdown starts. It
   * therefore **does not score and does not touch the combo** — see `resolveBeat`. Without that, nailing
   * the launch left the player on combo 1 and their first real beat was a double, so the game opened on
   * its second difficulty tier before the race had begun.
   *
   * A flag rather than `index === 0`, because that equivalence is true today and is exactly the kind of
   * thing a later change to `new_run` would quietly break.
   */
  launch: boolean;
  /**
   * The varieties decorating this beat, each with whatever it resolved at deal time.
   *
   * This was a single `drift: number` field, and generalising it is the whole point of the variety system:
   * a turn modifier is now a folder rather than a field on this type plus branches in five other files.
   * See `variety/contract.ts`.
   *
   * They are frozen onto the *beat* rather than derived by the view from the live combo, and that is
   * load-bearing: the combo updates the instant a beat resolves, so a view reading it directly would stop
   * the sway mid-outro on the beat that broke a streak and start it mid-outro on the beat that earned the
   * rung. Whatever a variety decided when the beat was dealt is what that beat has until it is over.
   *
   * Empty on the launch beat, always — it is the first thing anybody does, framed by a camera used nowhere
   * else, and a moving or burning target is not how to introduce a drag.
   */
  varieties: VarietySpec[];
  /**
   * The beat was **lost outright** — it pays nothing at all.
   *
   * The only outcome worse than missing every footprint, and the distinction matters: a missed beat still
   * credits the cells that landed, so it pays *something*. A voided one pays nothing, breaks the streak, and
   * consumes whatever pieces were left.
   *
   * A flag on the beat rather than a second resolve path, so `resolveBeat` stays the single place a beat's
   * payout is decided — it simply zeroes the terms rather than being bypassed. Set by the `voidBeat` effect;
   * see `VarietyEffect`, and the bomb, which is what needed it.
   */
  voided: boolean;
};

export type SlotRunState = {
  grid: BoardSpec;
  /**
   * How this run decides what the next turn is — the level's play mode.
   *
   * Stored on the run rather than closed over, so `nextBeat` can resolve a plan from state alone and the
   * reducer stays a pure function of (state, action). It is plain data, so a run remains serialisable and
   * replayable from a seed the way the rest of this type promises.
   */
  progression: Progression;
  seed: string;
  rngState: number;
  beat: Beat;
  /** Beats that have resolved. `beat.index` is this while a beat is live. */
  beatsPlayed: number;
  /** The pieces for the live beat, one per group. */
  tray: Piece[];
  /**
   * Increments on every deal.
   *
   * The tray uses it as a React key so a new beat's pieces remount and replay their intro, and the
   * slot field uses it to re-run its own entrance. Same contract as the board's tray generation.
   */
  trayGeneration: number;
  combo: number;
  maxCombo: number;
  score: number;
  groupsCompleted: number;
  piecesPlaced: number;
  /** Monotonic, one per resolved beat. The match bridge diffs this. */
  eventSequence: number;
  /** The beat that just resolved, in the shape the race side already understands. */
  lastResolution: Resolution | null;
  /** The worst accuracy grade in the beat that just resolved — what the callout announces. */
  lastBeatGrade: PlacementGrade | null;
  /**
   * Whether the beat that just resolved beat its clock.
   *
   * Separate from `lastBeatGrade` because the two verdicts have separate consequences and the screen
   * shows different words for them: an accuracy miss breaks the streak and says `MISSED`, being late
   * keeps it and says `LATE`. Folding them into one field is what made a slow-but-exact beat
   * indistinguishable from a sloppy one.
   */
  lastBeatPace: BeatPace | null;
  /**
   * How long the beat that just resolved took, milliseconds — the sum of its placements.
   *
   * Recorded because `lastBeatPace` alone cannot say *how* late, which the probe wants when it is
   * sweeping the budget, and because it is the only place a beat's total duration survives.
   */
  lastBeatElapsedMs: number;
  /**
   * How many groups the beat that just resolved contained.
   *
   * The bridge needs this as its `lineCount`: two footprints completed together should pay the
   * multi-line bonus and earn the heavier haptic accent, exactly as a row-plus-column clear did.
   * It cannot be recovered from the `Resolution` because `clearedRows`/`clearedColumns` are empty
   * in slot mode — there are no lines.
   */
  lastGroupCount: number;
  /**
   * How many cells each resolved group contributed, in the same order as `clearedCells`.
   *
   * The view needs the group boundaries to stagger the outro one footprint at a time — see
   * `buildSlotBurst`. `clearedCells` is a flat list by the time it reaches `Resolution`, and its
   * grouping is real but invisible, so it is recorded here rather than left to be guessed at.
   */
  lastGroupSizes: number[];
};

export type SlotAction =
  /**
   * Drop a piece at a field origin.
   *
   * `elapsedMs` is supplied by the caller because the engine has no clock. It is measured from the
   * previous drop in this beat, or from the moment the beat became interactive for the first drop.
   *
   * Measuring it per piece rather than as "how long the beat has run" is what lets the reducer sum
   * them into the beat's duration *and* keep each drop's own timing on the record. Grading no longer
   * uses one alone — see `BeatPace`.
   */
  | { type: 'place'; pieceId: string; row: number; column: number; elapsedMs: number }
  /**
   * Let a piece go somewhere the field is not, and lose it.
   *
   * A distinct action rather than a `place` with a null origin, because there genuinely is no origin: the
   * piece never reached the grid, so any row and column handed to `scorePlacement` would be a fiction —
   * and a clamped one could *overlap a footprint* and score, which is the one outcome a total miss must
   * never produce.
   *
   * It costs the piece and the streak, exactly as a badly aimed drop does. Releasing over the tray is not
   * this: the screen treats that as a cancel and never dispatches — see `handleDropAt`.
   */
  | { type: 'discard'; pieceId: string; elapsedMs: number }
  /**
   * Time has passed. Let any variety with a deadline act on it.
   *
   * The one action that is not a player doing something, and it is how a timed variety — a fuse, a colour
   * on a schedule — happens at all without this module growing a clock. `beatElapsedMs` is measured from the
   * moment the beat went interactive, by the caller, exactly as `elapsedMs` on a placement is.
   *
   * Two rules make it cheap enough to dispatch from a 60Hz loop. The reducer stores **deadlines, not
   * countdowns**, so nothing is written per frame; and a tick that crosses no deadline returns the state
   * object **unchanged**, which every caller already treats as a no-op.
   */
  | { type: 'tick'; beatElapsedMs: number }
  /** Deal the next beat. The screen sends this after the resolve animation has played. */
  | { type: 'next_beat' }
  | { type: 'new_run'; seed: string };
