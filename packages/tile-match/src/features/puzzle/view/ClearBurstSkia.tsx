import { useTileColors, type TileColors } from '../../../ui/theme';
/**
 * The clear burst, drawn in Skia.
 *
 * Visually identical to the View version it replaces — a ring, a tumbling cell and
 * four shards per cleared cell, cascading outward along the line that cleared.
 *
 * ## Why move it
 *
 * This was the heaviest effect in the game: **three animated styles per cleared
 * cell**, so a row-plus-column clear ran 36 of them. And it fires at the worst
 * possible moment — the same instant the camera pushes and shakes, the bullet
 * volley launches, and the haptic cascade starts. Peak load, every clear.
 *
 * As one recorded picture it is a single derived value regardless of how many cells
 * cleared. Forty cells cost the same reactive footprint as one.
 *
 * ## Timing
 *
 * One linear ramp spans the whole cascade and each cell remaps its own window out
 * of it, applying the easing in-worklet — the same single-driver approach the View
 * version already used, so the delays and curves are unchanged.
 *
 * ## Data
 *
 * Cleared cells are mirrored into a flat numeric array: x, y, palette index and
 * delay per cell. The worklet cannot read props, and numbers are all it needs.
 *
 * ## Why it takes positions rather than a `Resolution`
 *
 * It used to take `(spec, resolution, metrics)` and work out each cell's position with `cellOrigin`
 * and its delay with `clearCascadePhase`. Both of those are board concepts, and the second one is
 * actively wrong off the board: `clearCascadePhase` returns `Infinity` for a cell that is in no
 * cleared line, which this component clamps to its **maximum** stagger — so every cell would wait
 * the full delay, the field would empty, hold blank for a fifth of a second, and then pop all at
 * once. That is the exact bug the board's launch wipe hit.
 *
 * So the caller now computes positions and delays and passes them in. The animation is unchanged;
 * it simply no longer assumes the cells came from a rectangular grid with lines in it.
 */

import {
  BlurStyle,
  Canvas,
  Picture,
  Skia,
  createPicture,
  PaintStyle,
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

import { BLOCK_COLOR_IDS } from '../engine/types';
import type { BlockColorId } from '../engine/types';
import { semantic } from '../../../ui/tokens';
import {
  SHINE_ALPHA,
  blockFacePaints,
  blockFaceRect,
  blockShinePaint,
  blockShineRect,
  blockSparkPaints,
  faceRadius,
} from './block-cell';
import { cellRadius } from './metrics';
import { SLOT_CELL_LIFE_MS, SLOT_CELL_SETTLE_FRACTION as SF } from './slot-metrics';

/**
 * One cell's whole window once its turn comes: it settles, then it leaves.
 *
 * Re-exported from `slot-metrics`, which owns the two halves: the beat's settle timing is derived from
 * them, and the pure modules that derive it must not have to import Skia to do so.
 */
export const BURST_MS = SLOT_CELL_LIFE_MS;

/**
 * Ceiling on a cell's start delay, milliseconds.
 *
 * Was 220, which suited the board: a line clear staggered by position along the line, so even forty
 * cells fell inside a fifth of a second and the cap was a safety net that never fired. A beat resolves
 * one cell at a time in sequence instead, so the last of a dozen cells legitimately starts 700 ms in —
 * and at 220 the cap silently collapsed the tail of every cascade into a single simultaneous pop,
 * which is most of why it felt flat.
 *
 * 780 covers the worst case the haptics module will also tap out (14 cells across the beat's footprints).
 * Left where it is after the ladder dropped to two footprints: the headroom is free, and the cap exists to
 * bound a sequence rather than to describe one. It is
 * still a cap rather than an assumption: a caller that computed a longer sequence gets a compressed
 * tail rather than a burst that outlives whatever is holding it on screen.
 */
export const BURST_MAX_DELAY_MS = 780;

/**
 * One cell going out: where it is, what colour, and how long after the start it goes.
 *
 * Positions are relative to the canvas the burst is drawn on, which is the caller's coordinate
 * space — the field's own box, in practice.
 */
export type BurstCell = {
  x: number;
  y: number;
  colorId: BlockColorId;
  /** Clamped to `BURST_MAX_DELAY_MS` here, so callers can compute a raw phase without care. */
  delayMs: number;
};

const BURST_EASE = Easing.bezierFn(0.2, 0.76, 0.28, 1);

/** Numbers per cell in the flat array: x, y, colour index, delay. */
const STRIDE = 4;

/**
 * Paints, built once per cell size.
 *
 * Alpha is set per draw rather than per paint: a recorded picture captures paint
 * state at draw time, so one paint can serve every cell at a different opacity.
 */
function makeBurstPaints(cell: number, colors: TileColors): {
  fills: SkPaint[];
  shards: SkPaint[];
  spark: SkPaint;
  shine: SkPaint;
  ring: SkPaint;
} {
  /**
   * Identical to `SlotField`'s filled-cell paint, because it is now literally the same call.
   *
   * The field hands a cell over to this at full strength, so any difference between the two shows as a
   * flicker on the seam — and that has happened twice. The gradient used to run 0..cell here against the
   * field's inset..inset+span, which tinted the cell very slightly differently at the exact moment the
   * two swapped. `block-cell.ts` is what makes that class of bug unavailable rather than merely fixed.
   */
  const fills = blockFacePaints(cell, 'field', colors);

  const shards = blockSparkPaints(colors);

  const spark = Skia.Paint();
  spark.setAntiAlias(true);
  spark.setStyle(PaintStyle.Fill);
  spark.setColor(Skia.Color(semantic.clearSpark));

  // The same highlight the field draws on a filled cell. Without it the cell visibly lost its shine on
  // the frame the burst took over.
  const shine = blockShinePaint();

  /**
   * The glow thrown as a cell releases.
   *
   * Blurred, which is the change from the hard-edged ring this was. A crisp expanding outline reads as a
   * *shape leaving* the cell — a second object — where a blurred one reads as the cell itself lighting up
   * on its way out. It also matches `SlotField`'s arrival glow, so a cell's first and last moments are
   * recognisably the same kind of event rather than two unrelated effects.
   */
  const ring = Skia.Paint();
  ring.setAntiAlias(true);
  ring.setStyle(PaintStyle.Stroke);
  ring.setStrokeWidth(Math.max(2, cell * 0.09));
  ring.setColor(Skia.Color(semantic.clearGlowEdge));
  ring.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, cell * 0.13, false));

  return { fills, shards, spark, shine, ring };
}

/** Linear ramp between two values — cheaper than pulling in `interpolate`. */
function mix(a: number, b: number, t: number): number {
  'worklet';
  return a + (b - a) * t;
}

/** Piecewise ramp over an arbitrary number of stops. */
function ramp(t: number, stops: number[], values: number[]): number {
  'worklet';
  if (t <= stops[0]) return values[0];
  for (let index = 1; index < stops.length; index += 1) {
    if (t <= stops[index]) {
      const span = stops[index] - stops[index - 1];
      const local = span === 0 ? 0 : (t - stops[index - 1]) / span;
      return mix(values[index - 1], values[index], local);
    }
  }
  return values[values.length - 1];
}

/**
 * The burst.
 *
 * **The caller must key this on the burst's identity**, so it remounts per burst. Its timeline is
 * built on mount from the cells it is given; reusing the element for a second burst would leave the
 * first one's `progress` where it stopped.
 */
export const ClearBurstSkia = memo(function ClearBurstSkia({
  cells: burstCells,
  width,
  height,
  cell,
  pitch,
  reduceMotion,
}: {
  cells: readonly BurstCell[];
  /** Canvas size — the box the positions in `cells` are relative to. */
  width: number;
  height: number;
  cell: number;
  /** cell + gap. Only used to derive the tumble direction from grid parity. */
  pitch: number;
  reduceMotion: boolean;
}) {
  const radius = cellRadius(cell);
  const colors = useTileColors();
  const paints = useMemo(() => makeBurstPaints(cell, colors), [cell, colors]);

  /** Flat cell data, plus the ramp length it implies. */
  const { flat, span } = useMemo(() => {
    const values: number[] = [];
    let maxDelay = 0;
    for (const { x, y, colorId, delayMs } of burstCells) {
      const delay = Math.min(Math.max(0, delayMs), BURST_MAX_DELAY_MS);
      maxDelay = Math.max(maxDelay, delay);
      values.push(x, y, BLOCK_COLOR_IDS.indexOf(colorId), delay);
    }
    return { flat: values, span: maxDelay + BURST_MS };
  }, [burstCells]);

  /**
   * Seeded from `flat` rather than empty.
   *
   * The race screen keys this component on the resolution id, so it remounts per burst and the
   * initialiser runs with the right data every time. Starting empty cost a blank frame: the cells
   * are removed from the board in the commit that mounts this, and the effect below — which used to
   * be the only thing that filled `cells` — does not run until after that commit is painted. So the
   * cleared cells flickered out of existence for a frame before their own outro began.
   *
   * Empty under reduced motion, where the effect deliberately never runs: seeding it there would
   * leave the cells drawn at `progress` 0 permanently, as ghosts on top of the board.
   */
  const cells = useSharedValue<number[]>(reduceMotion ? [] : flat);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    cells.value = flat;
    progress.value = 0;
    progress.value = withTiming(1, { duration: span, easing: Easing.linear });
    return () => cancelAnimation(progress);
  }, [cells, flat, progress, reduceMotion, span]);

  const shardSize = Math.max(3, cell * 0.16);
  const innerRadius = faceRadius(cell);
  // Hoisted out of the recording worklet, and shared with the field — see `block-cell.ts`. This is the
  // geometry that jumped four points larger on the hand-off frame when the two were written out twice.
  const face = blockFaceRect(cell);
  const shineBar = blockShineRect(cell);

  const picture = useDerivedValue(() =>
    createPicture((canvas) => {
      const data = cells.value;
      const global = progress.value;
      if (data.length === 0 || global >= 1) return;

      const count = Math.floor(data.length / STRIDE);
      for (let i = 0; i < count; i += 1) {
        const x = data[i * STRIDE];
        const y = data[i * STRIDE + 1];
        const colour = data[i * STRIDE + 2];
        const delay = data[i * STRIDE + 3];

        const start = delay / span;
        const end = (delay + BURST_MS) / span;
        /**
         * A cell whose turn has not come is drawn **at rest**, not skipped.
         *
         * This used to `continue`, which was the whole cause of cells blinking out before their outro.
         * The field hands every cell over at once — it hides the instant the beat resolves — but the
         * cascade reveals them one at a time, so a cell late in the sequence had nothing drawing it for
         * up to half a second: gone, pause, then pop.
         *
         * Clamping `t` to 0 instead draws it exactly where the field left it, so the hand-off is
         * seamless and the cascade is purely about *when* each cell leaves. The original comment here
         * already had the right idea — "drawing it at `t` 0 puts it exactly where the board cell was" —
         * but only applied it to the one cell whose delay happened to be zero. The board got away with
         * that because its stagger was positional and capped at 220 ms; a sequential cascade does not.
         */
        const t =
          global >= end
            ? 1
            : global <= start
              ? 0
              : BURST_EASE((global - start) / (end - start));

        // Alternating tumble direction, from the cell's grid parity — matches the
        // View version's `(row + column) % 2`.
        const direction = ((x / pitch + y / pitch) | 0) % 2 === 0 ? 1 : -1;

        canvas.save();
        canvas.translate(x + cell / 2, y + cell / 2);

        /**
         * ---- glow ----
         *
         * Zero at `t` 0, so a cell waiting its turn carries none of it and the hand-off from the field is
         * invisible. It blooms as the cell swells and is gone before the cell is.
         *
         * Scaled tightly — 0.95 out to 1.45 rather than the 0.72-to-1.72 hoop this was — because paired
         * with the blur on the paint it should read as the cell *lighting up*, not as a ring leaving it.
         */
        const ringAlpha = ramp(t, [0, SF * 0.55, SF, SF + (1 - SF) * 0.5, 1], [0, 0.85, 0.62, 0.24, 0]);
        if (ringAlpha > 0.01) {
          const ringScale = ramp(t, [0, SF, 1], [0.94, 1.16, 1.5]);
          paints.ring.setAlphaf(ringAlpha);
          canvas.drawRRect(
            Skia.RRectXY(
              Skia.XYWHRect(
                (-cell * ringScale) / 2,
                (-cell * ringScale) / 2,
                cell * ringScale,
                cell * ringScale,
              ),
              radius * ringScale,
              radius * ringScale,
            ),
            paints.ring,
          );
        }

        /**
         * ---- the cell itself ----
         *
         * Fully opaque at `t` 0, which matters more than it looks: the field draws the cell at full
         * strength right up to the frame it hands over, so starting this ramp at 0.9 put a visible 10%
         * dip at the seam. A cell waiting its turn must be indistinguishable from a cell the field is
         * still drawing.
         *
         * Then up, then down — swelling to 1.13 by `t` 0.22 before shrinking away. That order is the
         * gesture: a cell that only ever shrinks reads as being deleted, where one that pushes out first
         * reads as releasing something.
         */
        const cellAlpha = ramp(
          t,
          [0, SF, SF + (1 - SF) * 0.45, SF + (1 - SF) * 0.75, 1],
          [1, 1, 0.9, 0.45, 0],
        );
        if (cellAlpha > 0.01) {
          const cellScale = ramp(
            t,
            [0, SF, SF + (1 - SF) * 0.3, 1],
            [1, 1.18, 1.04, 0.45],
          );
          // Still until it starts leaving. A cell that spins while it is settling reads as unstable
          // rather than as landing.
          const spin = ramp(t, [0, SF, 1], [0, 0, direction * 7]);
          canvas.save();
          canvas.rotate(spin, 0, 0);
          canvas.scale(cellScale, cellScale);
          const paint = paints.fills[colour] ?? paints.fills[0];
          paint.setAlphaf(cellAlpha);
          canvas.translate(-cell / 2, -cell / 2);
          // The field's exact geometry, from the one place that defines it.
          canvas.drawRRect(
            Skia.RRectXY(
              Skia.XYWHRect(face.x, face.y, face.width, face.height),
              innerRadius,
              innerRadius,
            ),
            paint,
          );
          paints.shine.setAlphaf(cellAlpha * SHINE_ALPHA);
          canvas.drawRRect(
            Skia.RRectXY(
              Skia.XYWHRect(shineBar.x, shineBar.y, shineBar.width, shineBar.height),
              shineBar.radius,
              shineBar.radius,
            ),
            paints.shine,
          );
          canvas.restore();
        }

        // ---- shards ----
        const shardAlpha = ramp(t, [0, SF, SF + (1 - SF) * 0.35, 1], [0, 0, 0.9, 0]);
        if (shardAlpha > 0.01) {
          const shardScale = ramp(t, [0, SF, SF + (1 - SF) * 0.55, 1], [0.4, 0.4, 1.1, 1.82]);
          const shardSpin = ramp(t, [SF, 1], [0, direction * 24]);
          canvas.save();
          canvas.rotate(shardSpin, 0, 0);
          canvas.scale(shardScale, shardScale);
          const tint = paints.shards[colour] ?? paints.shards[0];
          tint.setAlphaf(shardAlpha);
          paints.spark.setAlphaf(shardAlpha);
          const reach = cell * 0.3;
          const corners: [number, number, SkPaint][] = [
            [-reach, -reach, tint],
            [reach, -reach, paints.spark],
            [-reach, reach, tint],
            [reach, reach, paints.spark],
          ];
          for (const [dx, dy, paint] of corners) {
            canvas.drawRRect(
              Skia.RRectXY(
                Skia.XYWHRect(dx - shardSize / 2, dy - shardSize / 2, shardSize, shardSize),
                shardSize * 0.35,
                shardSize * 0.35,
              ),
              paint,
            );
          }
          canvas.restore();
        }

        canvas.restore();
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
