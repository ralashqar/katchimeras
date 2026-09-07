/**
 * One of the two pieces is rigged. Play it while it is live and the whole turn is lost.
 *
 * The first variety with real *stakes*: every other way a beat can fall short still pays for whatever landed,
 * so the worst case is a slow beat with a broken streak. Detonating pays **nothing** — no boost, no score, no
 * nitro, and the streak gone — which is what makes the choice of which piece to play first a decision rather
 * than a formality.
 *
 * ## Two variants, and they teach opposite lessons
 *
 * **`defuse`** — playing the *other* piece first disarms the bomb. The answer is order, and it is available on
 * the first frame: read the field, work out which piece is rigged, play the other one, then place the rigged
 * one safely. Nothing is timed, so it is a puzzle rather than a reflex test.
 *
 * **`cycle`** — the bomb arms and disarms on a repeating schedule, so the answer is *when*. This one needs the
 * clock, which is why the reducer has a `tick` at all.
 *
 * A single variety with a variant field rather than two registered varieties, because they share everything
 * that matters — which piece is rigged, what detonating costs, how it is drawn — and differ only in what
 * disarms it. Two entries would duplicate the data shape and the layer, and the two would drift.
 *
 * ## Both variants open **live**
 *
 * `cycle` used to open disarmed, on the reasoning that opening live would detonate anyone who reacted quickly
 * and so teach hesitation. That was backwards, and the failure was worse than the one it avoided: a brisk player
 * drops inside the first window and **never encounters the mechanic at all**. The bomb was drawn dim, nothing
 * happened, and the turn was an ordinary turn. A mechanic that a competent player can play past without noticing
 * is not a difficulty — it is dead weight in the rotation.
 *
 * Opening live inverts it. The first thing on screen is a lit fuse, so the mechanic announces itself and the
 * question it asks is answerable by *looking*: on `cycle` wait for it to go out, on `defuse` play the other
 * piece. Neither answer is a reflex, and neither is available by accident.
 *
 * ## It works on a one-footprint beat, and there it is forced to `cycle`
 *
 * A solo bomb is the purest form of the timing question — one piece, one target, and the only thing standing
 * between them is the schedule. `defuse` cannot be that beat: there is no other piece to play, so an armed
 * `defuse` bomb on a single is simply unwinnable. So a single **substitutes** `cycle` whatever strength asked
 * for, which is the one degradation available that is still a playable turn.
 *
 * ## No red pieces on a bomb beat
 *
 * The bomb marker is drawn in the sabotage red, and one of the five block colours (`ignition`) *is* that red. A
 * pulsing red dot on a red cell is invisible, and a red footprint next to a red warning reads as one thing — so
 * a bomb beat has no red pieces in it at all. `shape` recolours any it was dealt.
 *
 * Removing the colour from the **whole beat** rather than just from the rigged piece is the important detail, and
 * it is not laziness. `shape` runs *before* `deal`, so at that point nobody knows which piece will be rigged;
 * the only rule expressible there is one about the beat. It is also the stronger guarantee — the rigged
 * footprint has to contrast with the marker, and its *neighbour* has to contrast with the rigged one.
 *
 * ## Capabilities
 *
 * **A** (shape, for the colour rule above), **B** (data), **C** (the cycle variant's schedule), **G**
 * (`onPlace`). It needs `onPlace` because a bomb goes off when the player *acts*: `accepts` would only make the
 * drop miss, which still pays for the rest of the beat, and `expire` only fires on a clock.
 */

// Pure module — `.ts` extension imports so it runs under `node --test`.
import { nextInt } from '../../../../core/rng';
import { BLOCK_COLOR_IDS } from '../../engine/types';
import type { BlockColorId } from '../../engine/types';
import { defineVariety } from '../contract';

/**
 * The one block colour a bomb beat may not use.
 *
 * Named here rather than reached for by hex, because a variety's pure module carries no colour values — see
 * `meta/types.ts`. This is an *id*, and the fact that it happens to be the same red as `semantic.sabotageAxis`
 * is a property of the palette that `bomb.test.ts` asserts rather than a value this file knows.
 */
export const BOMB_CLASH_COLOR: BlockColorId = 'ignition';

export type BombVariant = 'defuse' | 'cycle';

/**
 * How long the bomb is live, and then dead, on the `cycle` variant.
 *
 * Three seconds each way. The window has to be long enough to *cross a whole drag* — a double's pace budget
 * allows 2550ms for two placements, so about 1.2s per piece — or a player who started the drag in a safe
 * window would detonate mid-air through no fault of their own. Three seconds leaves room to see the bomb go
 * out, commit to the drag, and land it.
 *
 * Equal on and off, so the mechanic is legible: half the time is safe, and the rhythm is obvious after one
 * cycle. Weighting it either way would be a difficulty knob, and `strength` is already that.
 */
export const BOMB_WINDOW_MS = 3000;

/** How much `strength` may shorten the window, as a fraction. At 1 the cycle runs at `1 - this`. */
export const BOMB_WINDOW_SQUEEZE = 0.4;

/**
 * At or above this strength the bomb is a `cycle`; below it, a `defuse`.
 *
 * Exported because a **progression** may want to hold the bomb to one variant, and the quick race does exactly
 * that — it pools the `defuse` puzzle and not the wait-it-out form. A ladder that hardcoded 0.5 to stay under
 * would be a second copy of this threshold, and the two would drift the first time it was retuned.
 */
export const BOMB_CYCLE_AT = 0.5;

export type BombData = {
  variant: BombVariant;
  /**
   * The rigged piece, or `null` when the beat had nothing at all to rig.
   *
   * Only an **empty** tray reaches null now. A one-piece beat is a real bomb — see the header — so the inert
   * case is genuinely just "there was nothing there", which is reachable if a progression attaches this to a
   * turn the dealer could not fill.
   */
  pieceId: string | null;
  /** Live right now. Detonates on contact. */
  armed: boolean;
  /** `cycle` only: the window length, and when the next toggle is due. */
  windowMs: number;
  nextToggleMs: number;
};

/** The live window at a given strength, in milliseconds. */
export function bombWindowMs(strength: number): number {
  const clamped = Math.min(1, Math.max(0, strength));
  return Math.round(BOMB_WINDOW_MS * (1 - BOMB_WINDOW_SQUEEZE * clamped));
}

export const BOMB_VARIETY = defineVariety<BombData>({
  id: 'bomb',

  /**
   * Take the clashing red out of the beat, piece and footprint together.
   *
   * Both halves have to move or the colour rule breaks the beat: `matchesColour` pairs a piece with its footprint
   * by colour, so recolouring one and not the other would deal a turn with no legal drop in it. They are matched
   * by `group.pieceId`, which is the pairing the dealer established and the only one that survives a reshape.
   *
   * The substitute is the first colour the beat is not already using — five colours against at most two pieces,
   * so one always exists. Deterministic rather than rolled, and that is deliberate twice over: it consumes no
   * randomness (so `rngState` passes straight through, and the contract's rng rule is satisfied by there being
   * nothing to burn), and a fixed substitute cannot make two otherwise-identical beats diverge.
   *
   * Leaves every group and piece **by identity** when there was no red to remove, which is the common case —
   * four beats in five.
   */
  shape: (ctx) => {
    if (!ctx.tray.some((piece) => piece.colorId === BOMB_CLASH_COLOR)) {
      // Copied rather than passed through, because `BeatShape` is mutable and the context's arrays are not. One
      // shallow copy of at most two entries; the identity that matters for repaints is the *groups'*, and those
      // are the same objects.
      return { groups: [...ctx.groups], tray: [...ctx.tray], rngState: ctx.rngState };
    }

    const taken = new Set(ctx.tray.map((piece) => piece.colorId));
    const substitute =
      BLOCK_COLOR_IDS.find((id) => id !== BOMB_CLASH_COLOR && !taken.has(id)) ?? BOMB_CLASH_COLOR;

    const clashing = new Set(
      ctx.tray.filter((piece) => piece.colorId === BOMB_CLASH_COLOR).map((piece) => piece.id),
    );

    return {
      groups: ctx.groups.map((group) =>
        clashing.has(group.pieceId) ? { ...group, colorId: substitute } : group,
      ),
      tray: ctx.tray.map((piece) =>
        clashing.has(piece.id) ? { ...piece, colorId: substitute } : piece,
      ),
      rngState: ctx.rngState,
    };
  },

  /**
   * Rig one piece at random.
   *
   * The roll is what makes it a decision every beat rather than a rule to memorise — with a fixed index the
   * player would learn "the left one is always safe" in two beats and the mechanic would evaporate.
   *
   * **The roll happens even when there is nothing to rig**, which is the rng rule the contract insists on: a
   * one-piece beat that skipped it would leave the generator one step behind a two-piece beat, and every deal
   * after it would diverge. Burn it and discard the result.
   *
   * The variant comes from the strength rather than being rolled, so a level can choose deliberately: below
   * halfway it is the `defuse` puzzle, above it the `cycle` timing test. That makes a stream's two bomb turns
   * genuinely different turns rather than the same one twice.
   *
   * **A one-piece beat overrides that and takes `cycle`**, because `defuse` has nothing to defuse with and an
   * armed one would be an unwinnable turn. See the header.
   */
  deal: (ctx, strength) => {
    const roll = nextInt(ctx.rngState, Math.max(1, ctx.tray.length));
    const riggable = ctx.tray.length >= 1;
    const solo = ctx.tray.length < 2;
    const variant: BombVariant = solo || strength >= BOMB_CYCLE_AT ? 'cycle' : 'defuse';
    const windowMs = bombWindowMs(strength);

    return {
      data: {
        variant,
        pieceId: riggable ? (ctx.tray[roll.value]?.id ?? null) : null,
        // **Live from the first frame**, both variants. The header has the argument; the short version is that
        // a bomb which opens cold is a bomb a brisk player never meets.
        armed: riggable,
        windowMs,
        nextToggleMs: windowMs,
      },
      rngState: roll.state,
    };
  },

  /**
   * Only the `cycle` variant wants a clock, and only while there is a bomb to toggle.
   *
   * `null` everywhere else means the screen dispatches no tick at all for a `defuse` bomb — the beat is
   * entirely event-driven, and paying for a per-frame reducer call to be told nothing happened would be waste.
   */
  deadlineMs: (data) =>
    data.variant === 'cycle' && data.pieceId !== null ? data.nextToggleMs : null,

  /**
   * A cycling bomb can cost the player one whole live window of standing still.
   *
   * Only the `cycle` variant, and that is the distinction the whole capability turns on: `defuse` is answered by
   * *order*, which costs no time at all — you play the safe piece first, which you were going to play anyway.
   * `cycle` is answered by the clock, and there is nothing to do while it runs.
   *
   * One window, not two. The budget is a threshold rather than a pot to draw down: it only has to be wide enough
   * that a player who waited out the live half once is not called late for it.
   */
  waitMs: (data) => (data.variant === 'cycle' && data.pieceId !== null ? data.windowMs : 0),

  /**
   * Flip the bomb and schedule the next flip.
   *
   * Catches up rather than stepping once: `beatElapsedMs` can arrive well past the deadline after a stalled
   * frame or a backgrounded app, and stepping once would leave the schedule permanently behind the clock. The
   * armed state is derived from *how many* windows have elapsed, so it is correct however late the tick is.
   */
  expire: (data, beatElapsedMs) => {
    /**
     * Which window the clock is *in*, counting from zero.
     *
     * `floor`, not `floor + 1`, and the difference is the whole off-by-one: at exactly one window elapsed the
     * first window has just ended and the second has begun, so the bomb is live. Counting windows that have
     * *started* rather than *finished* put the toggle a whole window late.
     */
    const window = Math.floor(beatElapsedMs / data.windowMs);
    return {
      data: {
        ...data,
        // Window 0 is the **live** one now that the bomb opens armed, so the safe windows are the odd ones.
        armed: window % 2 === 0,
        nextToggleMs: (window + 1) * data.windowMs,
      },
      effects: [],
    };
  },

  /**
   * The moment of truth.
   *
   * Two cases, and the order matters: check the rigged piece *first*, so a `defuse` bomb played as the very
   * first piece detonates rather than disarming itself.
   */
  onPlace: (data, input) => {
    if (data.pieceId === null) return { data, effects: [] };

    if (input.piece.id === data.pieceId) {
      // Placed the rigged piece. Live means the turn is gone; disarmed means it was just a piece.
      return { data, effects: data.armed ? [{ kind: 'voidBeat' }] : [] };
    }

    /**
     * Played something else.
     *
     * On `defuse` that is the answer, and the bomb goes cold for the rest of the beat. On `cycle` it changes
     * nothing — the schedule is the only thing that disarms it — which is what makes the two variants ask
     * different questions of the same board.
     */
    if (data.variant === 'defuse' && data.armed) {
      return { data: { ...data, armed: false }, effects: [] };
    }

    return { data, effects: [] };
  },
});
