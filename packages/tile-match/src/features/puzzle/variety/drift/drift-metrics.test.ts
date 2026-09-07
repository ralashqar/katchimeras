/**
 * Tests for the drift: its wave, its ramp and the bound that makes it a mechanic at all.
 *
 * These earn their place because every one of them is a claim about a curve, and a curve is invisible in a
 * diff. The wave in particular has three properties the rest of the design leans on — it peaks at exactly
 * one, it is smooth across the phase wrap, and it never goes below rest — and breaking any of them is either
 * a visible tick on the thing the player is aiming at, or a field that reaches under the pause button.
 *
 * They moved here with `drift-metrics.ts` when the drift became a variety. A variety owns its own tests.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DRIFT_FLOOR } from '../../engine/progression';
import { paceBudgetMs } from '../../engine/slot-grade';
import {
  SLOT_DRIFT_CELLS,
  SLOT_DRIFT_FADE_MS,
  SLOT_DRIFT_MS,
  SLOT_DRIFT_RIPPLE,
  SLOT_DRIFT_RIPPLE_MIX,
  SLOT_DRIFT_SMOOTH_AMPLITUDE,
  SLOT_DRIFT_SPEEDUP,
  driftHarshness,
  slotDriftCyclesPerSecond,
  slotDriftOffset,
} from './drift-metrics';

// -------------------------------------------------------------------- the drift

const AMP = 24;

test('the field bobs upward from rest and never below it', () => {
  /**
   * **The property the layout depends on**, and the reason the sway is one-sided at all.
   *
   * The field's resting position has ten points of clearance below it — `SLOT_PLAY_GAP`, which is the
   * distance a finger crosses on every placement and the most expensive space on the screen. A symmetric
   * sway had to be paid for out of that, and measured on a 640-tall Android it cost the whole nitro row.
   * Above the field there is between 120 and 360 points of nothing. So the drift goes up, and this is what
   * stops it quietly going both ways again.
   */
  for (let phase = 0; phase <= 2; phase += 0.01) {
    const offset = slotDriftOffset(phase, 1, AMP);
    assert.ok(offset <= 1e-9, `phase ${phase.toFixed(2)} drifted down by ${(-offset).toFixed(2)}`);
    assert.ok(offset >= -AMP - 1e-9, `phase ${phase.toFixed(2)} overshot the amplitude`);
  }
});

test('phase zero is exactly rest, so a wrapping cycle never ticks', () => {
  // A raised cosine rather than a sine, which is what puts rest at the phase boundary. `withRepeat` runs
  // the phase 0 to 1 forever, so any other choice would step the field by up to a full amplitude every
  // cycle — a visible tick, once every two seconds, forever.
  assert.equal(slotDriftOffset(0, 1, AMP), 0);
  assert.ok(Math.abs(slotDriftOffset(1, 1, AMP)) < 1e-12);
  assert.ok(Math.abs(slotDriftOffset(0, 1, AMP) - slotDriftOffset(1, 1, AMP)) < 1e-12);
});

test('the peak is exactly a full amplitude, and never more', () => {
  /**
   * The bound the layout solver reserved against. Both components of the wave are `(1 - cos)/2` and both
   * peak together at mid-cycle, which is what makes the sum land on exactly 1 — mix them any other way and
   * the field would overshoot the space set aside for it and reach under the HUD.
   */
  assert.ok(Math.abs(slotDriftOffset(0.5, 1, AMP) + AMP) < 1e-12);

  let deepest = 0;
  for (let phase = 0; phase <= 1; phase += 0.0005) {
    deepest = Math.min(deepest, slotDriftOffset(phase, 1, AMP));
  }
  assert.ok(deepest >= -AMP - 1e-9, `the wave overshot to ${deepest.toFixed(4)} against amplitude ${AMP}`);
  assert.ok(Math.abs(deepest + AMP) < 1e-6, 'the peak should actually be reached, not merely bounded');

  // And the mix is a genuine mix — a degenerate weight would make this a plain sine again.
  assert.ok(SLOT_DRIFT_RIPPLE_MIX > 0.15 && SLOT_DRIFT_RIPPLE_MIX < 0.5);
});

test('the field surges and backs off, so there is no single moment to time', () => {
  /**
   * **Why this is not a plain sine.** A sine is slowest at exactly its extremes, which is where a player
   * naturally waits to aim — so the mechanic collapsed to "wait for the top and drop", a rhythm to learn
   * once rather than a target to track.
   *
   * The third harmonic reverses the velocity part-way to each extreme: the field rises, eases back, and
   * rises again. This counts those reversals. A plain sine has exactly two per cycle, one at each extreme;
   * more than that means the motion genuinely doubles back on itself.
   */
  const step = 0.001;
  let reversals = 0;
  let previous = slotDriftOffset(step, 1, AMP) - slotDriftOffset(0, 1, AMP);
  for (let phase = step; phase < 1; phase += step) {
    const velocity = slotDriftOffset(phase + step, 1, AMP) - slotDriftOffset(phase, 1, AMP);
    if (velocity !== 0 && previous !== 0 && Math.sign(velocity) !== Math.sign(previous)) reversals += 1;
    if (velocity !== 0) previous = velocity;
  }
  assert.ok(
    reversals > 2,
    `only ${reversals} direction changes per cycle — that is a plain sine, which is what this replaced`,
  );
  assert.ok(SLOT_DRIFT_RIPPLE >= 2, 'the ripple has to be a real harmonic to break the symmetry');
});

test('the ripple harmonic is a whole number, or the wave tears at the wrap', () => {
  /**
   * `useSlotDrift` integrates the phase and wraps it at 1. That is only safe because every component of
   * the wave completes a whole number of cycles per unit phase — a fractional harmonic would put a jump in
   * the field's *position* once per cycle, on the exact thing the player is aiming at.
   */
  assert.equal(SLOT_DRIFT_RIPPLE, Math.round(SLOT_DRIFT_RIPPLE));

  /**
   * Checked rather than merely asserted about the constant: the wave is genuinely periodic in phase, so
   * value *and* slope match across the boundary the integrator wraps at.
   *
   * The slope is compared with **central** differences. A one-sided pair differs by the curvature times
   * the step even on a perfectly smooth curve, which is an artefact of the measurement rather than a
   * property of the wave — and with a third harmonic in play that artefact is nine times bigger than the
   * bound a plain sine would need, which is exactly the trap this comment exists to save the next reader
   * from falling into.
   */
  const step = 1e-4;
  const slope = (phase: number) =>
    (slotDriftOffset(phase + step, 1, AMP) - slotDriftOffset(phase - step, 1, AMP)) / (2 * step);

  assert.ok(Math.abs(slotDriftOffset(1, 1, AMP) - slotDriftOffset(0, 1, AMP)) < 1e-12);
  assert.ok(Math.abs(slope(1) - slope(0)) < 1e-6, 'the slope changes across the phase wrap');
  // And both are zero there, which is what makes rest a genuine resting point rather than a fly-through.
  assert.ok(Math.abs(slope(0)) < 1e-6);
});

test('the sway gets quicker as the streak grows, and stops there', () => {
  /**
   * The second half of "harder as the streak grows". Amplitude alone would make a long streak a bigger
   * version of the same motion; the rate is what shortens the window in which the field is near any given
   * position, which is what actually makes it hard to catch.
   */
  const floor = slotDriftCyclesPerSecond(DRIFT_FLOOR);
  const full = slotDriftCyclesPerSecond(1);
  assert.ok(full > floor, 'a long streak should sway quicker, not just wider');
  assert.ok(
    Math.abs(full / slotDriftCyclesPerSecond(0) - (1 + SLOT_DRIFT_SPEEDUP)) < 1e-9,
    'the speed-up should be worth what its constant says',
  );

  /**
   * And the fastest component stays well clear of the band that made the camera shake a headache.
   *
   * That was 10-15Hz and it was genuinely unpleasant; the lesson generalises, and a target the player is
   * aiming at deserves more caution than the view does. The ripple is the quickest thing here, running at
   * `SLOT_DRIFT_RIPPLE` times the cycle rate.
   */
  const fastestHz = full * SLOT_DRIFT_RIPPLE;
  assert.ok(fastestHz < 4, `the ripple runs at ${fastestHz.toFixed(2)}Hz at full drift`);
});

test('the sway is smooth everywhere, including at the turnaround', () => {
  /**
   * No corner anywhere, including across the phase wrap — the loop runs past 1 deliberately, since that is
   * the boundary `useSlotDrift`'s integrator resets at. A triangle wave or an eased shuttle would reverse
   * with a discontinuity in velocity, and a corner in a *position* reads as a knock, which on a target the
   * player is aiming at is worse than the motion it was trying to add.
   *
   * Checked as a bound on the second difference. The bound is **derived from the harmonics** rather than
   * written down: each `(cos(n.theta) - 1)/2` term contributes `n^2` to the curvature, so the third
   * harmonic alone is nine times stiffer than the fundamental. A bound sized for a plain sine fails here
   * for reasons that have nothing to do with smoothness.
   */
  const step = 0.001;
  const curvature = (1 - SLOT_DRIFT_RIPPLE_MIX) + SLOT_DRIFT_RIPPLE_MIX * SLOT_DRIFT_RIPPLE ** 2;
  const bound = AMP * ((2 * Math.PI * step) ** 2 / 2) * curvature * 1.05;
  for (let phase = step; phase < 2; phase += step) {
    const curve =
      slotDriftOffset(phase + step, 1, AMP) -
      2 * slotDriftOffset(phase, 1, AMP) +
      slotDriftOffset(phase - step, 1, AMP);
    assert.ok(Math.abs(curve) <= bound, `a corner at phase ${phase.toFixed(3)}`);
  }
});

test('fading the amount out converges on rest from wherever the field is', () => {
  /**
   * Why `amount` and `phase` are separate shared values rather than one animated offset.
   *
   * Assigning to a shared value *replaces* the running animation rather than adding to it, so animating the
   * offset directly would mean stopping the sway cancelled the repeat and drove to rest at a rate unrelated
   * to how far there was to go — sometimes a snap, sometimes a crawl. Scaling a continuous curve instead
   * means the field converges on rest smoothly at every phase, which is what this pins.
   */
  for (const phase of [0, 0.13, 0.25, 0.5, 0.77, 0.99]) {
    let previous = Math.abs(slotDriftOffset(phase, 1, AMP));
    for (const amount of [0.8, 0.6, 0.4, 0.2, 0]) {
      const here = Math.abs(slotDriftOffset(phase, amount, AMP));
      assert.ok(here <= previous + 1e-12, `phase ${phase} moved away from rest as it faded`);
      previous = here;
    }
    assert.equal(slotDriftOffset(phase, 0, AMP), 0, `phase ${phase} did not reach rest`);
  }
});

test('the drift timings are sized against the pace budget, not picked', () => {
  /**
   * A player working at pace should see roughly one sweep per drag — much faster and the drop is a reflex
   * test rather than a tracking one, much slower and the field is effectively still for a whole beat, which
   * is the same as not drifting.
   */
  const cycleAtFloor = 1000 / slotDriftCyclesPerSecond(DRIFT_FLOOR);
  const cycleAtFull = 1000 / slotDriftCyclesPerSecond(1);
  for (const cycle of [cycleAtFloor, cycleAtFull]) {
    assert.ok(
      cycle > paceBudgetMs(1) * 0.5 && cycle < paceBudgetMs(2),
      `a ${cycle.toFixed(0)}ms cycle against budgets of ${paceBudgetMs(1)} and ${paceBudgetMs(2)}`,
    );
  }
  assert.ok(SLOT_DRIFT_MS >= cycleAtFloor, 'SLOT_DRIFT_MS should be the slowest the sway ever runs');

  // The fade has to be a fraction of a beat, or a rung change would still be settling when it mattered.
  assert.ok(SLOT_DRIFT_FADE_MS < paceBudgetMs(1) / 2);
});

test('even the gentlest drifting beat moves the field past half a cell', () => {
  /**
   * **The bound that decides whether the mechanic exists at all.** A placement grades exact only at
   * `offset === 0`, and a drop quantises to the nearest origin — so if the field never moves more than half a
   * cell, a player who aims once and ignores the motion still lands exactly, and the whole upper half of the
   * ladder is decoration.
   *
   * Checked at the ramp's **floor**, since that is the first drifting beat a player meets and the weakest
   * the sway ever is. Expressed in cell pitches so it holds on every device.
   */
  const atFloor = SLOT_DRIFT_CELLS * DRIFT_FLOOR;
  assert.ok(
    atFloor > 0.5,
    `the first drifting beat sways ${atFloor.toFixed(2)} of a cell, which is still aimable-once`,
  );
  // And the peak stays inside what the layout can give it — see the race-layout tests for the device-by-
  // device version of this.
  assert.ok(SLOT_DRIFT_CELLS <= 1.5, `${SLOT_DRIFT_CELLS} pitches reads as unmoored from the car`);
});

// ------------------------------------------------- smooth first, erratic later

/** Direction changes in one cycle. A plain raised cosine has exactly one: the turn at its peak. */
function reversals(strength: number): number {
  const step = 0.001;
  let count = 0;
  let previous = slotDriftOffset(step, strength, AMP) - slotDriftOffset(0, strength, AMP);
  for (let phase = step; phase < 1; phase += step) {
    const velocity = slotDriftOffset(phase + step, strength, AMP) - slotDriftOffset(phase, strength, AMP);
    if (velocity !== 0 && previous !== 0 && Math.sign(velocity) !== Math.sign(previous)) count += 1;
    if (velocity !== 0) previous = velocity;
  }
  return count;
}

/**
 * Deepest point of one cycle, as a fraction of the amplitude.
 *
 * `+ 0` because negating a resting `0` gives `-0`, which `assert.equal` does not consider equal to `0` — the
 * same wrinkle that made `slotDriftOffset` return `+0` explicitly in the first place.
 */
function peakFraction(strength: number): number {
  let deepest = 0;
  for (let phase = 0; phase <= 1; phase += 0.0005) {
    deepest = Math.min(deepest, slotDriftOffset(phase, strength, AMP));
  }
  return -deepest / AMP + 0;
}

test('the gentlest drifting beat is a single smooth rise and fall', () => {
  /**
   * **The shape of the whole mechanic, and it was backwards before.**
   *
   * The amplitude used to scale directly off the strength, so the beat that *introduces* the drift swayed
   * 0.55 of the peak as a narrow fast wobble — and it already carried the third harmonic, so its very first
   * reading was also its hardest. A player meeting a mechanic should get the most legible version of it.
   *
   * One reversal is the signature of a clean raised cosine: the field goes up, turns once, and comes back.
   */
  assert.equal(reversals(DRIFT_FLOOR), 1, 'the first drifting beat should be a plain sinusoid');
  assert.ok(
    peakFraction(DRIFT_FLOOR) >= SLOT_DRIFT_SMOOTH_AMPLITUDE - 1e-9,
    `the first drifting beat only sways ${peakFraction(DRIFT_FLOOR).toFixed(2)} of the peak`,
  );
});

test('the worst beat is erratic, at the full width', () => {
  // The field surges, backs off and surges again on the way to each extreme, so there is no single moment to
  // memorise — and it does that at the *same* breadth, not a bigger one.
  assert.ok(reversals(1) > 2, `the hardest beat still reverses only ${reversals(1)} times`);
  assert.ok(Math.abs(peakFraction(1) - 1) < 1e-6, 'the worst beat should reach the full amplitude');
});

test('the character hardens with the streak while the width barely moves', () => {
  /**
   * The two curves, as a pair. Width is nearly flat across the band — it is already large — and the harmonic
   * is what climbs. Asserting the *ratio* rather than the values, so retuning either constant cannot quietly
   * invert the relationship.
   */
  const widthGrowth = peakFraction(1) / peakFraction(DRIFT_FLOOR);
  assert.ok(widthGrowth > 1, 'the worst beat should still be the widest');
  assert.ok(widthGrowth < 1.35, `width grows ${widthGrowth.toFixed(2)}x, which is a size ramp not a character one`);

  // Monotonic in both, so no strength in between is easier than one below it.
  let previousPeak = 0;
  for (const strength of [DRIFT_FLOOR, 0.7, 0.85, 1]) {
    const peak = peakFraction(strength);
    assert.ok(peak >= previousPeak - 1e-9, `strength ${strength} narrowed the sway`);
    previousPeak = peak;
  }
  assert.equal(driftHarshness(DRIFT_FLOOR), 0);
  assert.equal(driftHarshness(1), 1);
});

test('fading in never jumps: below the floor the drift is a gate, not a strength', () => {
  /**
   * The bug this pins, which the retune above would otherwise have introduced.
   *
   * `useDriftOffset` animates its value from 0 up to the beat's strength, so mid-fade it passes through
   * values *below* `DRIFT_FLOOR` — values no beat is ever dealt. Read as a strength they clamp to the floor,
   * and because the floor's amplitude is now 0.82 of the peak, the fade would snap to a nearly full-width
   * sway the instant it left zero.
   *
   * So below the floor the value gates the whole offset instead. This asserts the join is smooth: the peak
   * grows steadily from nothing with no step in it.
   */
  const peaks = [0, 0.1, 0.2, 0.3, 0.4, DRIFT_FLOOR].map(peakFraction);
  assert.equal(peaks[0], 0, 'zero must be exactly rest');

  for (let i = 1; i < peaks.length; i += 1) {
    assert.ok(peaks[i] > peaks[i - 1], `the fade went backwards at step ${i}`);
    // No step bigger than the whole floor amplitude spread over the fade's steps.
    assert.ok(
      peaks[i] - peaks[i - 1] < SLOT_DRIFT_SMOOTH_AMPLITUDE * 0.5,
      `the fade jumped ${(peaks[i] - peaks[i - 1]).toFixed(2)} of the peak in one step`,
    );
  }
});
