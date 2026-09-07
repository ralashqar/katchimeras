/**
 * The bomb, drawn on the footprint it is rigged to.
 *
 * ## Why the footprint and not the tray piece
 *
 * The rigged thing is a *piece*, so marking the piece is the obvious answer — and it is the wrong one here.
 * The tray owns its own layout and its own gesture, and a per-beat prop threaded into it risks the one thing
 * that must not happen: a changed callback identity rebuilding the pan mid-drag.
 *
 * Marking the **footprint** costs nothing and says the same thing, because colour already pairs a piece with
 * its footprint — that pairing is load-bearing enough that `tray.ts` shuffles colours to guarantee it. So a
 * bombed footprint identifies the bombed piece as directly as a badge on the piece would, and it does it where
 * the player is already looking: at the field, around the car.
 *
 * It also puts the warning where the *consequence* is. The bomb does not spoil the piece, it spoils the turn,
 * and the turn is what the field represents.
 *
 * ## Two states, two readings
 *
 * **Live** pulses: a filled ring that breathes, in the sabotage red. Anything that flashes reads as "do not
 * touch", which is the whole message and needs no legend.
 *
 * **Disarmed** is a flat, dim outline — visibly the same marker, visibly off. Removing it entirely would be
 * worse: on the `defuse` variant the player needs to see that what they just did *worked*, and a marker that
 * vanishes is indistinguishable from one that was never there.
 *
 * ## The two transitions are not each other's reverse
 *
 * They used to be — one 180ms crossfade, run in whichever direction — and that reads as the marker being
 * *swapped* rather than as a bomb arming or going out. Both events matter too much for that. On `cycle` they are
 * the only thing telling the player when to move; on `defuse` the disarm is the confirmation that the answer was
 * right, and a confirmation the player can miss is not one.
 *
 * So each direction is shaped for what it is:
 *
 * **Arming snaps.** A short crossfade with a bright flare over the top of it — the flare is what makes it read as
 * ignition rather than as a fade-in, and it is over in a quarter of a second because a warning that arrives
 * gently is not a warning.
 *
 * **Disarming discharges.** A slower crossfade, plus a ring thrown outward that expands and dissipates: the
 * energy leaving. The dead outline contracts to rest underneath as it goes, so the marker visibly *settles*
 * rather than appearing. Slower than arming on purpose — this is the half the player is waiting for, and it is
 * also the only half that is good news.
 *
 * One Skia canvas rather than a View per cell, on the same reasoning as its siblings: a footprint is up to six
 * cells and the pulse is one shared value, so this is one recorded picture regardless of size. It draws in the
 * field's own coordinate space and is mounted inside the field's container, so it inherits the drift for free.
 */

import {
  BlurStyle,
  Canvas,
  PaintStyle,
  Picture,
  Skia,
  createPicture,
  type SkPaint,
} from '@shopify/react-native-skia';
import { memo, useEffect, useMemo, useRef } from 'react';
import {
  Easing,
  cancelAnimation,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { alpha } from '../../../../ui/color';
import { palette, semantic } from '../../../../ui/tokens';
import { cellOrigin } from '../../view/metrics';
import { varietyData } from '../contract';
import type { VarietyLayerProps } from '../view-registry';
import { BOMB_VARIETY, type BombData } from './bomb';

/** One full pulse of a live bomb, milliseconds. */
const PULSE_MS = 620;

/**
 * The two transitions, and they are deliberately different lengths. See the header.
 *
 * Arming is fast because a warning that arrives gently is not a warning. Disarming is slower because it is the
 * event the player is waiting for, and because "the light went out" is a thing that takes a moment where "the
 * light came on" does not.
 */
const ARM_MS = 110;
const DISARM_MS = 300;

/** The flare over an arming marker: up hard, then away. */
const IGNITE_RISE_MS = 80;
const IGNITE_FALL_MS = 240;

/** How long the discharge ring takes to expand and vanish. */
const DISCHARGE_MS = 440;

/** How far the discharge ring travels, as a multiple of the marker's radius. */
const DISCHARGE_REACH = 1.7;

/** Numbers per marker in the flat array: x, y. */
const STRIDE = 2;

/**
 * The marker's radius, as a fraction of the cell.
 *
 * Small enough to sit inside the cell's rim without touching it — a marker that reached the edge would read as
 * a *different kind of cell* rather than as something placed on one — and large enough to be unmistakable at
 * the top of the screen while the player's attention is on the car.
 */
const DOT = 0.3;

/**
 * The marker's line weight.
 *
 * One definition because two things draw a stroke here — the dead outline and the discharge ring — and the ring is
 * supposed to read as having come off that outline. Two copies of the same expression is exactly how the block
 * cell's geometry drifted before `block-cell.ts` existed.
 */
const markerStroke = (cell: number): number => Math.max(1.5, cell * 0.05);

function makeBombPaints(cell: number): {
  live: SkPaint;
  glow: SkPaint;
  dead: SkPaint;
  discharge: SkPaint;
} {
  const radius = cell * DOT;

  const live = Skia.Paint();
  live.setAntiAlias(true);
  live.setStyle(PaintStyle.Fill);
  live.setColor(Skia.Color(semantic.sabotageAxis));

  /**
   * A blurred halo under the dot, so the pulse reads as light rather than as a growing shape.
   *
   * Same reasoning as the field's arrival glow and the burst's release ring: a hard edge that changes size
   * reads as a second object moving, where a blur reads as the thing itself brightening. Affordable for the
   * same reason too — at most a handful of markers, and nothing else is animating on this canvas.
   */
  const glow = Skia.Paint();
  glow.setAntiAlias(true);
  glow.setStyle(PaintStyle.Fill);
  glow.setColor(Skia.Color(semantic.sabotageAxis));
  glow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, radius * 0.8, false));

  // Disarmed: the same marker with the light off. An outline rather than a fill, so it reads as spent.
  const dead = Skia.Paint();
  dead.setAntiAlias(true);
  dead.setStyle(PaintStyle.Stroke);
  dead.setStrokeWidth(markerStroke(cell));
  dead.setColor(Skia.Color(alpha(palette.textFaint, 0.5)));

  /**
   * The ring thrown outward as the bomb goes out.
   *
   * A **stroke**, unlike the glow's blurred fill, and the difference is the whole reading: a blur that grows is
   * something brightening in place, where a thin ring travelling outward is energy leaving. That is the same
   * distinction `ClearBurstSkia`'s release ring makes, and this borrows the vocabulary on purpose — a bomb going
   * cold and a footprint paying out are both good news, and should not look like unrelated events.
   *
   * Blurred only slightly, so it stays a ring rather than becoming a haze, and its stroke thins as it expands —
   * see the picture.
   */
  const discharge = Skia.Paint();
  discharge.setAntiAlias(true);
  discharge.setStyle(PaintStyle.Stroke);
  discharge.setColor(Skia.Color(semantic.sabotageAxis));
  discharge.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, radius * 0.22, false));

  return { live, glow, dead, discharge };
}

export const BombLayer = memo(function BombLayer({
  metrics,
  beat,
  reduceMotion,
}: VarietyLayerProps) {
  const { width, height, cell } = metrics;
  const data = varietyData<BombData>(beat, BOMB_VARIETY.id);
  const paints = useMemo(() => makeBombPaints(cell), [cell]);
  const radius = cell * DOT;
  /**
   * The marker's line weight, read **once here** rather than inside the picture.
   *
   * `markerStroke` is an **imported-style module function**, and calling one inside a Skia recording worklet
   * throws — Reanimated packs it as a remote function the UI runtime refuses to call synchronously. That crash
   * has already shipped once in this project, from `rimWidth` in `SlotField`. Read it here; the loop captures a
   * plain number.
   */
  const stroke = markerStroke(cell);

  /**
   * Every cell of the rigged piece's footprint.
   *
   * Found by piece id rather than by index, because a variety that reshaped the beat could have reordered the
   * groups — and the bomb's own data names a piece, not a slot.
   */
  const flat = useMemo(() => {
    if (!data?.pieceId) return [];
    const group = beat.groups.find((candidate) => candidate.pieceId === data.pieceId);
    if (!group) return [];

    const values: number[] = [];
    for (const index of group.cells) {
      const { x, y } = cellOrigin(metrics, Math.floor(index / metrics.cols), index % metrics.cols);
      values.push(x + cell / 2, y + cell / 2);
    }
    return values;
  }, [beat.groups, data?.pieceId, metrics, cell]);

  // Mirrored into shared values because the recording worklet cannot read props.
  const cells = useSharedValue<number[]>(flat);
  const armed = useSharedValue(data?.armed ? 1 : 0);
  const pulse = useSharedValue(0);
  /** One-shot transition channels: the flare on arming, the ring on going out. */
  const ignite = useSharedValue(0);
  const discharge = useSharedValue(0);

  useEffect(() => {
    cells.value = flat;
  }, [cells, flat]);

  /**
   * Armed is a **faded** flag, not a boolean — and the fade is asymmetric.
   *
   * The `cycle` variant flips it every few seconds, and a hard cut between the live and dead markers would
   * read as the marker being replaced rather than as the bomb going out. One duration for both directions read
   * the same way for a subtler reason: a symmetric crossfade has no direction in it, so arming and disarming
   * were the same event played backwards. See the header for why neither of them is that.
   */
  const live = data?.armed ?? false;
  useEffect(() => {
    armed.value = withTiming(live ? 1 : 0, {
      duration: reduceMotion ? 0 : live ? ARM_MS : DISARM_MS,
      easing: live ? Easing.out(Easing.cubic) : Easing.inOut(Easing.quad),
    });
  }, [armed, live, reduceMotion]);

  /**
   * The one-shots, fired on a **change** rather than on a state.
   *
   * The previous value is held in a ref seeded from the first render, which is what stops a mount from counting
   * as a transition — a beat dealt with its bomb already live would otherwise open by igniting, announcing an
   * event that never happened. That matters more than it looks now that both variants open armed: *every* bomb
   * beat would have flared on arrival, and the flare's whole job is to mark the moment the state changed.
   */
  const wasLive = useRef(live);
  useEffect(() => {
    const changed = wasLive.current !== live;
    wasLive.current = live;
    if (!changed || reduceMotion) return;

    /**
     * Each direction parks the *other* channel at zero.
     *
     * Assigning to a shared value replaces whatever animation was running on it, so this both cancels the
     * opposite one-shot and leaves it somewhere harmless. A plain `cancelAnimation` would not: it freezes the
     * value where it stopped, which for a half-expanded discharge ring means a ring left drawn on the field
     * indefinitely. The `cycle` variant flips every second or two at full strength, so mid-flight reversals are
     * ordinary rather than exotic.
     */
    if (live) {
      discharge.value = 0;
      // Up hard and away. Ends on a timed zero rather than being left high, so the flare cannot bleed into the
      // pulse that takes over from it.
      ignite.value = 0;
      ignite.value = withSequence(
        withTiming(1, { duration: IGNITE_RISE_MS, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: IGNITE_FALL_MS, easing: Easing.in(Easing.quad) }),
      );
      return;
    }

    ignite.value = 0;
    // Restarted from zero rather than continued, for the reason the outro animations are keyed on mount: a ring
    // resumed from mid-flight would appear already halfway out.
    discharge.value = 0;
    discharge.value = withTiming(1, { duration: DISCHARGE_MS, easing: Easing.out(Easing.cubic) });
  }, [discharge, ignite, live, reduceMotion]);

  useEffect(() => {
    if (reduceMotion) {
      // Held at the bright end rather than at rest: under reduced motion the marker must still read as a
      // warning, and the pulse was the only thing saying so.
      pulse.value = 1;
      return;
    }
    pulse.value = 0;
    pulse.value = withRepeat(
      withTiming(1, { duration: PULSE_MS, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [pulse, reduceMotion]);

  const picture = useDerivedValue(() =>
    createPicture((canvas) => {
      const data2 = cells.value;
      if (data2.length === 0) return;

      const lit = armed.value;
      const beat2 = pulse.value;
      const flare = ignite.value;
      const out = discharge.value;
      const count = Math.floor(data2.length / STRIDE);

      for (let i = 0; i < count; i += 1) {
        const x = data2[i * STRIDE];
        const y = data2[i * STRIDE + 1];

        if (lit > 0.01) {
          /**
           * Grows and brightens together, so the pulse reads as one gesture rather than two.
           *
           * The flare rides on top of both terms rather than being drawn as a separate shape: it widens the
           * halo and whitens the dot at once, which is what a thing igniting does. A second circle would have
           * been a ring arriving, and a ring arriving is the discharge's vocabulary — the opposite event.
           */
          const swell = 0.78 + 0.34 * beat2 + 0.5 * flare;
          paints.glow.setAlphaf(Math.min(1, lit * (0.25 + 0.4 * beat2) + 0.55 * flare));
          canvas.drawCircle(x, y, radius * swell * 1.5, paints.glow);
          paints.live.setAlphaf(Math.min(1, lit * (0.7 + 0.3 * beat2) + 0.3 * flare));
          canvas.drawCircle(x, y, radius * swell, paints.live);
        }

        if (lit < 0.99) {
          /**
           * The dead outline **contracts** to rest as the light dies.
           *
           * Driven off `lit` rather than off the discharge, so it costs nothing and cannot fall out of step with
           * the crossfade it shares. While the bomb is live the (invisible) outline sits slightly wide; as `lit`
           * falls it settles inward, so the marker reads as coming to rest rather than as fading in.
           */
          paints.dead.setAlphaf(1 - lit);
          canvas.drawCircle(x, y, radius * (1 + 0.3 * lit), paints.dead);
        }

        if (out > 0.01 && out < 1) {
          /**
           * The energy leaving: a ring outward, thinning and fading as it goes.
           *
           * Squared fade rather than linear, so it holds its brightness through the first half of the travel and
           * then goes quickly — a ring that dims evenly reads as being erased, where one that survives its own
           * expansion reads as having been thrown.
           */
          paints.discharge.setStrokeWidth(Math.max(0.5, stroke * 1.6 * (1 - out)));
          paints.discharge.setAlphaf(1 - out * out);
          canvas.drawCircle(x, y, radius * (1 + DISCHARGE_REACH * out), paints.discharge);
        }
      }
    }),
  );

  if (!data?.pieceId) return null;

  return (
    <Canvas
      style={{ position: 'absolute', left: 0, top: 0, width, height }}
      pointerEvents="none"
    >
      <Picture picture={picture} />
    </Canvas>
  );
});
