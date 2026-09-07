/**
 * The drift's screen offset — capability **E** of the variety contract.
 *
 * On a drifting beat the whole field bobs upward and back, so a player cannot aim once and let go: the
 * footprint they are aiming at has moved by the time the piece lands, and a placement grades exact only at
 * `offset === 0`. It gets **wider and quicker as the streak grows**, up to a limit — see `DEFAULT_LADDER`'s
 * drift ramp.
 *
 * ## Why one shared value
 *
 * Three separate things have to agree on where the field is, to the pixel, sixty times a second:
 *
 *  - the field's container, which translates by it,
 *  - the **drag resolve**, which quantises a drop against it on the UI thread,
 *  - the drop handler, which reads it once when the finger lifts.
 *
 * That rules out React state on both of the project's standing grounds: nothing runs React state at 60fps,
 * and the JS thread is the render thread — `RaceScene` draws the car and the road from a `useFrame` there,
 * so a per-frame re-render would compete with the 3D view for exactly the frames a player is mid-drag. A
 * shared value costs the JS thread nothing and is readable from a worklet, which is what keeps
 * `resolveDropCell` on the UI thread where the gesture rework put it.
 *
 * ## Why the phase is integrated rather than animated
 *
 * The obvious implementation is `withRepeat(withTiming(1, { duration }))`. It cannot work here, because the
 * *rate* has to change with the streak and a repeat cannot change its own duration without being reassigned
 * — and **assigning to a shared value replaces the running animation rather than adding to it**, so every
 * rung change would restart the phase from wherever it was and jump the field.
 *
 * Integrating instead — `phase += dt * rate` in a frame callback — makes the position continuous by
 * construction however the rate moves. `useFrameCallback` runs its worklet on the **UI thread**, so this
 * costs the render thread nothing; it is the same bargain the pan gesture strikes.
 *
 * The wrap at 1 is safe rather than lucky: every component of the wave completes a whole number of cycles
 * per unit phase, so the curve is smooth across the boundary. That is what `SLOT_DRIFT_RIPPLE` being an
 * integer buys.
 *
 * ## Why strength is one number and not two
 *
 * Amplitude and rate both scale from it, so fading one value fades both — and the fade is what turns a rung
 * change from a jump into the field picking up movement. Two values could disagree mid-fade; one cannot.
 *
 * ## Called unconditionally
 *
 * `data` is `undefined` on a beat with no drift, and this then holds the field at rest. That is the contract
 * every variety's offset hook follows: hooks cannot be called conditionally, so the view registry calls all
 * of them every render and each one no-ops itself. See `useVarietyOffset`.
 */

import { useEffect } from 'react';
import {
  Easing,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { SLOT_DRIFT_FADE_MS, slotDriftCyclesPerSecond, slotDriftOffset } from './drift-metrics';
import type { DriftData } from './drift';

export type DriftOffset = {
  /**
   * The field's offset from its solved position, in points. Never positive.
   *
   * Read by the field's transform, and by the tray's drop resolve so that accuracy is graded against where
   * the field actually is rather than where the layout put it.
   */
  offsetY: Readonly<SharedValue<number>>;
};

/**
 * @param amplitude how far the field may rise at full strength — `layout.slotField.driftAmplitude`
 * @param data this beat's drift, or `undefined` if it carries none
 * @param reduceMotion holds the field still outright
 */
export function useDriftOffset(
  amplitude: number,
  data: DriftData | undefined,
  reduceMotion: boolean,
  paused = false,
): DriftOffset {
  const phase = useSharedValue(0);
  const live = useSharedValue(0);

  const strength = data?.strength ?? 0;

  useEffect(() => {
    const target = reduceMotion ? 0 : Math.min(1, Math.max(0, strength));
    live.value = withTiming(target, {
      duration: reduceMotion ? 0 : SLOT_DRIFT_FADE_MS,
      easing: Easing.inOut(Easing.quad),
    });
  }, [live, strength, reduceMotion]);

  /**
   * Integrate the phase at the rate the current strength asks for.
   *
   * Runs even while the field is still, and deliberately: the phase is never reset, so a beat that starts
   * drifting picks the wave up wherever it had got to rather than always opening on the same rise. Two beats
   * at the same rung therefore do not present the same motion, which is one fewer thing to memorise.
   *
   * The cost of running it through still beats is one multiply and one modulo per frame on the UI thread.
   */
  useFrameCallback((frame) => {
    'worklet';
    if (paused) return;
    if (live.value === 0 && phase.value === 0) return;
    const dt = (frame.timeSincePreviousFrame ?? 0) / 1000;
    if (dt <= 0) return;
    // Guard against a long stall — a backgrounded app can hand back a multi-second delta, and advancing
    // the phase by all of it is wasted work for a wave that is periodic anyway.
    const step = Math.min(dt, 0.1) * slotDriftCyclesPerSecond(live.value);
    phase.value = (phase.value + step) % 1;
  }, true);

  const offsetY = useDerivedValue(() => slotDriftOffset(phase.value, live.value, amplitude));

  return { offsetY };
}
