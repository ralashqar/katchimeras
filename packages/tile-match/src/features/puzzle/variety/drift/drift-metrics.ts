/**
 * The drift's timings, geometry and wave — everything about *how* the field sways.
 *
 * The variety's view half, and the reason its pure half is three lines: drift changes no rules, so all of
 * it is here and in `DriftLayer`. It lived in `slot-metrics.ts` until the drift became a variety, which is
 * the migration that proved the contract — a variety owns its own numbers rather than adding them to the
 * field's shared ones.
 *
 * Pure, and Skia-free, so `node --test` runs it directly and the layout solver can read `SLOT_DRIFT_CELLS`
 * without pulling a canvas into the test process.
 */

// Pure module — `.ts` extension imports so it runs under `node --test`.

/**
 * How far the field rises at the **worst** of the sway, as a multiple of the cell pitch.
 *
 * The top of the difficulty ladder — see `DEFAULT_LADDER` — and the number the layout solver reserves room
 * for. A beat lower down the ramp uses a fraction of it: the live amplitude is this times the beat's own
 * `drift`, which climbs from `DRIFT_FLOOR` to 1 as the streak grows.
 *
 * 1.25 pitches is a lot on purpose. Even the *gentlest* drifting beat has to clear **half a cell**, because
 * a placement grades exact only at `offset === 0` — below that a player who aims once and ignores the
 * motion still quantises onto the right origin and the whole upper half of the ladder is decoration.
 *
 * Affordable because the sway is one-sided and rises into space that was already empty — the tightest
 * device has 116pt of clearance above the field against 47pt of sway. See `slotDriftOffset`.
 */
export const SLOT_DRIFT_CELLS = 1.25;

/**
 * How hard the field sways on the **first** drifting beat, as a fraction of the worst.
 *
 * Lives here rather than in `progression.ts` because it is the drift's own number: it is the strength the
 * ladder's ramp starts from *and* the point the harshness curve below measures from, and having those two be
 * the same constant is the whole reason the two curves line up. `progression.ts` imports it for the ladder.
 *
 * Not zero, and not small. The rung has to announce itself: a drift that ramped from nothing would make the
 * beat that *introduces* the mechanic indistinguishable from the still beat before it, so the player would
 * find out several beats after being handed it.
 */
export const DRIFT_FLOOR = 0.55;

/**
 * Amplitude on the gentlest drifting beat, as a fraction of `SLOT_DRIFT_CELLS`.
 *
 * **High on purpose, and this is the shape of the whole mechanic.** The drift used to scale its amplitude
 * directly off the strength, so the first drifting beat swayed 0.55 of the peak — a narrow, fast, fussy
 * wobble — and only a long streak made it a real movement. That is backwards. A player meeting the mechanic
 * for the first time should get the *most legible* version of it: a wide, smooth, obviously-tracking rise
 * and fall. What should get harder is the **character** of the motion, not its size.
 *
 * So amplitude runs 0.82 to 1.0 across the whole band — nearly flat, because it is already large — and the
 * third harmonic ramps from nothing to full over the same band. Early beats are broad and smooth; late ones
 * are the same breadth with the field surging and backing off inside it. See `slotDriftOffset`.
 */
export const SLOT_DRIFT_SMOOTH_AMPLITUDE = 0.82;

/**
 * How far into the drifting band a beat is: 0 on the gentlest, 1 at the worst.
 *
 * The strength a variety is dealt runs `DRIFT_FLOOR`..1, which is the ladder's coordinate. This is the same
 * information in the coordinate the *wave* cares about, and both curves below are written against it so
 * "smooth at first, erratic later" is one number rather than two independent tunings that could disagree.
 */
export function driftHarshness(strength: number): number {
  'worklet';
  if (strength <= 0) return 0;
  const span = 1 - DRIFT_FLOOR;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (strength - DRIFT_FLOOR) / span));
}

/**
 * One full sway at the **floor** of the ramp, in milliseconds.
 *
 * Sized against the pace budget rather than picked: `paceBudgetMs` allows 1500ms for a single and 2550ms
 * for a double, so a ~2s cycle means a player working at pace sees roughly one sweep per drag. Much
 * faster and the drop becomes a reflex test rather than a tracking one; much slower and the field is
 * effectively still for the length of a beat, which is the same as not drifting at all.
 *
 * The cycle *shortens* as the streak grows — see `slotDriftCyclesPerSecond`.
 */
export const SLOT_DRIFT_MS = 2200;

/**
 * How much quicker the sway gets at full `drift`, as a fraction.
 *
 * The second half of "harder as the streak grows". Amplitude alone would make a long streak merely a
 * bigger version of the same motion; adding rate means the window in which the field is near any given
 * position gets shorter too, which is what actually makes it harder to catch rather than just harder to
 * reach.
 *
 * Kept modest. At 0.55 the cycle runs 1690ms at the ramp's floor down to 1420ms at its top, so the
 * fastest component of the wave — the third harmonic below — peaks around 2Hz. That is deliberately well
 * clear of the ~10Hz band that made the camera shake a headache earlier in this project's life; the
 * lesson generalises, and a target the player is aiming at deserves more caution than the view does.
 */
export const SLOT_DRIFT_SPEEDUP = 0.55;

/**
 * The ripple riding on the main sway: which harmonic, and how much of the amplitude it takes.
 *
 * **Must be an integer.** `phase` wraps at 1, and the wave is only continuous across that wrap if every
 * component completes a whole number of cycles in it. A non-integer harmonic would put a jump in the
 * field's position once every two seconds — a position discontinuity on the thing the player is aiming
 * at, which is the worst possible place for one.
 *
 * 3 rather than 2 because an even harmonic is symmetric about the mid-cycle peak and reads as a single
 * smooth arc with a dip in it; an odd one breaks the symmetry, so the rise and the fall have different
 * shapes and the field surges and backs off on the way to each extreme. The velocity genuinely reverses
 * mid-sweep, which is the whole reason this is not a plain sine: a sine is slowest at its extremes and
 * therefore easy to time, and the ask was for something harder to catch.
 */
export const SLOT_DRIFT_RIPPLE = 3;

/**
 * How much of the amplitude the ripple takes **at full harshness**. A ceiling, not a constant.
 *
 * It used to be a constant 0.34 at every strength, which meant the very first drifting beat already had the
 * velocity reversal in it — so the mechanic's introduction was its hardest reading, and there was nothing
 * left for a long streak to add but speed. Ramped from zero, the first beat is a clean sinusoid and the
 * erratic version is something the player earns their way into.
 *
 * 0.42 rather than 0.34 because the ramp means it is now only reached at the top of the band, so the top can
 * afford to be nastier than a value that had to be tolerable everywhere.
 */
export const SLOT_DRIFT_RIPPLE_MIX = 0.42;

/**
 * How long the sway takes to change gear, milliseconds.
 *
 * The drift is not switched on and off, nor stepped between rungs — either would jump the field the
 * instant a beat changed. A single faded `drift` value drives amplitude *and* rate together, so a rung
 * change reads as the field picking up or shedding movement.
 */
export const SLOT_DRIFT_FADE_MS = 420;

/**
 * How fast the phase advances, in cycles per second, at a given `drift`.
 *
 * Separated from the offset because the phase is **integrated** rather than animated — see `useDriftOffset`.
 * A `withRepeat` cannot change its own rate without restarting, which would reset the phase and jump the
 * field; integrating at a rate that is itself animated keeps the position continuous while the rate moves.
 */
export function slotDriftCyclesPerSecond(drift: number): number {
  'worklet';
  return (1000 / SLOT_DRIFT_MS) * (1 + SLOT_DRIFT_SPEEDUP * drift);
}

/**
 * The field's vertical offset, in points. Never positive: the field bobs **upward** from rest.
 *
 * ## Why it only goes one way
 *
 * Not a taste call — it is what the layout can afford. The field's resting position is the tightest thing
 * on the screen at the bottom: `SLOT_PLAY_GAP` is ten points, and that gap is the distance a finger drags
 * on every placement. Above it there is between 120 and 360 points of clear space depending on the device.
 * A symmetric sway therefore has to be paid for entirely out of the cheapest ten points on screen, and
 * measured on a 640-tall Android it cost the whole nitro row — an *input* — to buy motion.
 *
 * One-sided, it is free: the reservation lands in the space that was already empty, the resting position
 * is untouched, and the drag never gets longer than it is today. See `solveFor` in `race-layout.ts`.
 *
 * ## Smooth and wide first, erratic later
 *
 * The wave's **character** is what the difficulty ramps, not its size. At the bottom of the band this is a
 * plain raised cosine at nearly full amplitude: a broad, smooth, obviously-trackable rise and fall, which is
 * the right way to introduce a mechanic. At the top the third harmonic is fully mixed in and the field
 * surges, backs off and surges again on the way to each extreme, so there is no single moment to memorise.
 *
 * A plain sine *everywhere* was the first version and it was too easy to read once learned: it is slowest at
 * exactly the extremes, which is where a player naturally waits to aim, so the mechanic reduced to "wait for
 * the top and drop". A constant harmonic mix was the second, and it was too hard too early — the beat that
 * introduces the drift had the same reversal in it as the hardest beat in the game.
 *
 * Both terms are `(1 - cos)/2`, so both are zero at phase zero and both peak together at mid-cycle, and the
 * two weights sum to 1. That keeps two properties the rest of the design leans on at *every* mix: the wave
 * stays inside `[0, 1]` exactly, so the offset never exceeds the amplitude the solver reserved, and rest is
 * exactly rest.
 *
 * It is still smooth everywhere, including across the phase wrap, which is why `SLOT_DRIFT_RIPPLE` has to
 * be an integer. A corner in a *position* reads as a knock, and on the thing being aimed at that is worse
 * than the motion it is trying to add.
 *
 * `drift` scales amplitude and rate together, so fading it out converges the field on rest from wherever
 * it happens to be — there is no phase to unwind and nothing to snap back from.
 */
export function slotDriftOffset(phase: number, drift: number, amplitude: number): number {
  'worklet';
  // A still field is exactly rest, short-circuited. This is the common case — most beats do not drift, and
  // this runs per frame — and it also makes rest an exact `0` rather than the `-0` that falls out of
  // multiplying a negative curve by zero. Both translate identically, but `-0` is not `Object.is`-equal to
  // `0`, which is a trap for anyone reasonably asserting that the field is at rest.
  if (drift === 0) return 0;

  /**
   * `drift` does two jobs, and they have to be pulled apart here.
   *
   * The caller animates it from 0 to the beat's strength so a rung change reads as the field picking up
   * movement rather than snapping into it — so mid-fade it takes values *below* `DRIFT_FLOOR`, which are not
   * strengths any beat is ever dealt. Read as a strength they would clamp to the floor, and the fade would
   * jump straight to a full-width sway the instant it left zero.
   *
   * So: below the floor it is a **gate**, ramping the whole offset up from nothing; at and above the floor
   * the gate is open and it is a **strength**, hardening the curve. Continuous and monotonic across the
   * join, which is what keeps the fade smooth and what `fading the amount out converges on rest` pins.
   */
  const gate = Math.min(1, drift / DRIFT_FLOOR);
  const strength = Math.max(drift, DRIFT_FLOOR);

  const harshness = driftHarshness(strength);
  // Zero at the bottom of the band, full at the top — see `SLOT_DRIFT_RIPPLE_MIX`.
  const mix = SLOT_DRIFT_RIPPLE_MIX * harshness;
  /**
   * Nearly flat, and deliberately **not** the strength.
   *
   * Scaling the amplitude by the strength is what made the first drifting beat a narrow fast wobble. The
   * size is large from the outset; the harshness above is what grows.
   */
  const scale =
    SLOT_DRIFT_SMOOTH_AMPLITUDE + (1 - SLOT_DRIFT_SMOOTH_AMPLITUDE) * harshness;

  const turn = phase * Math.PI * 2;
  // `(cos - 1)` rather than `-(1 - cos)` so rest comes out as `+0` at phase zero, for the reason above.
  const swell = (Math.cos(turn) - 1) / 2;
  const ripple = (Math.cos(turn * SLOT_DRIFT_RIPPLE) - 1) / 2;
  const wave = swell * (1 - mix) + ripple * mix;

  return wave * scale * gate * amplitude;
}
