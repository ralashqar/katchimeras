import { useTileColors, type TileColors } from '../../../ui/theme';
/**
 * A voided beat, detonating.
 *
 * The third outro gesture, and the one the other two could not cover. `ClearBurstSkia` is a reward — a ring, a
 * swell, shards thrown outward — and `SlotMissSkia` is gravity, cells dropping and tumbling out of the world.
 * A voided beat is neither. It is the only outcome that pays **absolutely nothing**: worse than missing every
 * footprint, because a missed beat still credits whatever landed. Reusing either animation would say the wrong
 * thing, and reusing the *miss* would say the merely-wrong thing, which is harder to notice and therefore worse.
 *
 * So: violence. See `slot-metrics.ts` for the two movements and their timings. Briefly — the whole footprint
 * judders together under a red rim, then the cells blow one after another, fast, each throwing sparks.
 *
 * ## It is keyed off `beat.voided`, not off the bomb
 *
 * Voiding is an **engine** concept, not a bomb one: `Beat.voided` is a beat flag and `resolveBeat` honours it by
 * zeroing its own terms. So this lives with the other outro animations rather than in `variety/bomb/`, and the
 * screen mounts it for any voided beat. If a second mechanic ever voids a turn, this is already the right
 * picture, and neither it nor the screen learns a new id.
 *
 * The bomb keeps its `FieldLayer` for the warning, which is the half that *is* bomb-specific.
 *
 * ## The cells are the footprints, not the drop
 *
 * Every footprint cell of the beat, including the ones nothing was ever dropped on. That is what was lost — the
 * turn, not the piece — and blowing up only the rigged footprint would understate it while also being confusing
 * on `defuse`, where the player may already have banked the other one. The `filled` cells are indistinguishable
 * from the empty ones here on purpose: after a void they scored the same.
 *
 * Same one-Picture construction as its siblings, and for the same reasons: paints built once per cell size, cells
 * mirrored into a shared value as plain numbers because a recording worklet cannot read props, and geometry read
 * out of `block-cell.ts` **in the component body** — calling an imported helper inside the worklet throws.
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
import { memo, useEffect, useMemo } from 'react';
import {
  Easing,
  cancelAnimation,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { alpha } from '../../../ui/color';
import { semantic } from '../../../ui/tokens';
import {
  SLOT_BLAST_POP_MS,
  SLOT_BLAST_SHAKE_MS,
  SLOT_BLAST_STEP_MS,
  slotBlastSpanMs,
} from './slot-metrics';
import {
  blockFacePaints,
  blockSparkPaints,
  faceRadius,
  rimWidth,
  wellRadius,
} from './block-cell';
import { BLOCK_COLOR_IDS } from '../engine/types';
import type { BlockColorId } from '../engine/types';

/**
 * How far a cell is thrown about while it judders, in points.
 *
 * Small on purpose. The judder has to read as *rattling in place*, so the cells are recognisably still on their
 * footprints when they go — a bigger throw and they read as already flying, which spends the explosion before it
 * happens. Three points is enough to be unmistakable at a glance and small enough that the rim stays legible.
 */
const JUDDER = 3;

/**
 * Judder frequency, cycles per second.
 *
 * The one number here in tension with something the project has already learned the hard way: 10–15Hz jitter is
 * what made the camera shake a headache. That lesson is about the **view** — the whole frame moving under the
 * player — and it is why the camera's own swings run at ~4Hz. This is a handful of cells inside a fixed frame
 * for a quarter of a second, so it can be fast, and it needs to be: a slow judder reads as a wobble, and a
 * wobble is not a warning. Kept deliberately short rather than deliberately gentle.
 */
const JUDDER_HZ = 13;

/** Sparks thrown per cell. */
const SPARKS = 6;

/** How far a spark travels, as a multiple of the cell. */
const SPARK_REACH = 1.15;

/** Numbers per cell in the flat array: x, y, colour index, phase offset. */
const STRIDE = 4;

/** Fast out, so the cell leaves rather than being lifted away. */
const POP_EASE = Easing.bezierFn(0.15, 0.75, 0.4, 1);

function makeBlastPaints(cell: number, colors: TileColors): {
  faces: SkPaint[];
  sparks: SkPaint[];
  rim: SkPaint;
  flash: SkPaint;
} {
  /**
   * The **field** look, because these are cells in the grid — the footprints the beat was aiming at, drawn
   * exactly as `SlotField` drew them the frame before. There *is* a seam here: the field stops drawing on the
   * frame this starts, so a mismatched inset would flicker, which is the bug `block-cell.ts` exists to prevent.
   */
  const faces = blockFacePaints(cell, 'field', colors);
  const sparks = blockSparkPaints(colors);

  // The rim is the bomb's own red, so the detonation is visibly the same event as the marker that warned about
  // it. A neutral rim would make the blast read as a generic failure.
  const rim = Skia.Paint();
  rim.setAntiAlias(true);
  rim.setStyle(PaintStyle.Stroke);
  rim.setStrokeWidth(rimWidth(cell) * 1.6);
  rim.setColor(Skia.Color(semantic.sabotageAxis));

  /**
   * A blurred fill under the cell, so the moment of the bang is light rather than a shape appearing.
   *
   * Same reasoning as the bomb marker's halo and the burst's release ring — and the same reason it is
   * affordable, since at most a dozen cells are ever on this canvas and nothing else is drawing.
   */
  const flash = Skia.Paint();
  flash.setAntiAlias(true);
  flash.setStyle(PaintStyle.Fill);
  flash.setColor(Skia.Color(alpha(semantic.sabotageAxis, 0.9)));
  flash.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, cell * 0.34, false));

  return { faces, sparks, rim, flash };
}

export type BlastCell = { x: number; y: number; colorId: BlockColorId };

/**
 * One voided beat's footprints, coming apart.
 *
 * **The caller must key this on the beat's identity** so it remounts per void. Its timeline is built on mount,
 * exactly like its two siblings, so a reused element would open with the previous blast's clock already spent.
 */
export const SlotBlastSkia = memo(function SlotBlastSkia({
  cells: blastCells,
  width,
  height,
  cell,
  reduceMotion,
}: {
  cells: readonly BlastCell[];
  width: number;
  height: number;
  cell: number;
  reduceMotion: boolean;
}) {
  const colors = useTileColors();
  const paints = useMemo(() => makeBlastPaints(cell, colors), [cell, colors]);

  /**
   * Geometry read **once**, in the component body.
   *
   * Not a style choice: `faceRadius`, `rimWidth` and `wellRadius` are imported functions, and Reanimated packs
   * an imported function as a remote one that the UI runtime refuses to call synchronously. Calling `rimWidth`
   * inside a recording worklet is a crash this project has already shipped once.
   */
  const face = faceRadius(cell);
  const well = wellRadius(cell);
  const inset = rimWidth(cell) * 0.8;
  const sparkRadius = Math.max(1.5, cell * 0.09);

  const { flat, span } = useMemo(() => {
    const values: number[] = [];
    blastCells.forEach(({ x, y, colorId }, index) => {
      /**
       * A per-cell phase, so the cells judder out of step with each other.
       *
       * In step they read as one rigid object being shaken, which is a *camera* gesture — and the camera is
       * already shaking on this frame, so the two would fuse and neither would be visible. Derived from the
       * index rather than rolled, so the picture stays pure and a replay is identical.
       */
      values.push(x, y, BLOCK_COLOR_IDS.indexOf(colorId), (index * 0.37) % 1);
    });
    return { flat: values, span: slotBlastSpanMs(blastCells.length) };
  }, [blastCells]);

  /**
   * Seeded from `flat` rather than empty, for the reason its siblings document: these cells are drawn here for
   * the first time in the commit that mounts this, and an effect does not run until after that commit is
   * painted — so starting empty costs a blank frame between the field hiding and the blast starting, which on
   * this animation is the frame the whole thing hangs on.
   */
  const cells = useSharedValue<number[]>(reduceMotion ? [] : flat);
  const clock = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    cells.value = flat;
    clock.value = 0;
    clock.value = withTiming(span, { duration: span, easing: Easing.linear });
    return () => cancelAnimation(clock);
  }, [cells, clock, flat, reduceMotion, span]);

  const picture = useDerivedValue(() =>
    createPicture((canvas) => {
      const data = cells.value;
      // Milliseconds, not a 0..1 fraction, because the two movements have absolute lengths and the second one's
      // stagger is per cell — normalising would mean dividing by `span` at every use to get back here.
      const now = clock.value;
      if (data.length === 0 || now >= span) return;

      const count = Math.floor(data.length / STRIDE);
      for (let i = 0; i < count; i += 1) {
        const x = data[i * STRIDE];
        const y = data[i * STRIDE + 1];
        const colour = data[i * STRIDE + 2];
        const phase = data[i * STRIDE + 3];

        const popAt = SLOT_BLAST_SHAKE_MS + i * SLOT_BLAST_STEP_MS;

        if (now < popAt) {
          // ---- movement one: judder in place under a red rim ----

          /**
           * The judder ramps *up* over the wait rather than running flat.
           *
           * A constant rattle reads as a state — "these cells are bombed" — where a rising one reads as
           * something about to happen. It is also what makes a cell late in the stagger visibly more agitated
           * than one that has already gone, so the second movement feels caused by the first.
           */
          const wind = Math.min(1, now / SLOT_BLAST_SHAKE_MS);
          const t = (now / 1000) * JUDDER_HZ + phase * 6.283;
          const dx = Math.sin(t) * JUDDER * wind;
          const dy = Math.cos(t * 1.31) * JUDDER * wind;

          canvas.save();
          canvas.translate(x + dx, y + dy);

          paints.faces[colour]?.setAlphaf(1);
          canvas.drawRRect(
            Skia.RRectXY(Skia.XYWHRect(0, 0, cell, cell), face, face),
            paints.faces[colour] ?? paints.faces[0],
          );

          // The rim brightens with the wind-up, and pulses inside it, so it reads as a fuse rather than as a
          // border. Inset by its own width so the stroke sits on the cell instead of straddling its edge.
          paints.rim.setAlphaf(0.45 + 0.55 * wind * (0.6 + 0.4 * Math.sin(t * 0.5)));
          canvas.drawRRect(
            Skia.RRectXY(
              Skia.XYWHRect(inset, inset, cell - inset * 2, cell - inset * 2),
              well,
              well,
            ),
            paints.rim,
          );

          canvas.restore();
          continue;
        }

        // ---- movement two: the bang ----

        const raw = (now - popAt) / SLOT_BLAST_POP_MS;
        if (raw >= 1) continue;
        const t = POP_EASE(raw);

        // The flash is only the first third, and it is the brightest thing in the animation while it lasts.
        // Any longer and it stops reading as an instant.
        if (raw < 0.34) {
          paints.flash.setAlphaf(0.85 * (1 - raw / 0.34));
          canvas.drawCircle(x + cell / 2, y + cell / 2, cell * (0.4 + 0.5 * t), paints.flash);
        }

        // The cell swells slightly and goes. Swelling rather than shrinking, which is the opposite of the
        // miss's collapse — this is pressure from inside, not something dropping.
        const alphaOut = 1 - t;
        if (alphaOut > 0.02) {
          const scale = 1 + 0.35 * t;
          canvas.save();
          canvas.translate(x + cell / 2, y + cell / 2);
          canvas.scale(scale, scale);
          canvas.translate(-cell / 2, -cell / 2);
          paints.faces[colour]?.setAlphaf(alphaOut * 0.9);
          canvas.drawRRect(
            Skia.RRectXY(Skia.XYWHRect(0, 0, cell, cell), face, face),
            paints.faces[colour] ?? paints.faces[0],
          );
          canvas.restore();
        }

        /**
         * Sparks, thrown from the cell's centre.
         *
         * In the cell's **own colour**, not the sabotage red: the red is the bomb and these are the player's
         * piece coming apart, so the two channels stay distinct — the thing that killed the turn and the thing
         * that was killed. The angles are spread evenly with a per-cell offset, and gravity is applied at
         * `t * t`, so they arc rather than radiating flat.
         */
        const sparkAlpha = 1 - t * t;
        if (sparkAlpha > 0.02) {
          const paint = paints.sparks[colour] ?? paints.sparks[0];
          paint.setAlphaf(sparkAlpha);
          const reach = cell * SPARK_REACH * t;
          for (let s = 0; s < SPARKS; s += 1) {
            const angle = ((s + phase) / SPARKS) * 6.283;
            canvas.drawCircle(
              x + cell / 2 + Math.cos(angle) * reach,
              y + cell / 2 + Math.sin(angle) * reach + cell * 0.55 * t * t,
              sparkRadius * (1 - 0.6 * t),
              paint,
            );
          }
        }
      }
    }),
  );

  if (reduceMotion) return null;

  return (
    <Canvas
      style={{ position: 'absolute', left: 0, top: 0, width, height }}
      pointerEvents="none"
    >
      <Picture picture={picture} />
    </Canvas>
  );
});
