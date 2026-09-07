import { useTileColors, type TileColors } from '../../../ui/theme';
/**
 * Cells that missed, falling away.
 *
 * Fires the instant a piece lands, for the part of it that scored nothing. Until this existed a bad
 * drop had *no* immediate feedback at all: the cells that hit lit up, the ones that missed simply were
 * never drawn, and the only sign anything had gone wrong was a footprint that stayed half empty and a
 * streak that broke a beat later. The mistake and its consequence were separated by seconds.
 *
 * ## Why it looks nothing like the clear burst
 *
 * `ClearBurstSkia` is a *reward*: a ring, a scale-up, shards thrown outward, energy leaving. Reusing it
 * here would celebrate a mistake. This is the opposite gesture — gravity. The cells drop, shrink, tumble
 * and fade, with no ring and nothing thrown. That vocabulary is not invented either: it is the board's
 * `JamCollapse`, which fell, shrank to 0.62 and tilted ±14 degrees, and it read unmistakably as *that
 * did not work*.
 *
 * Same one-Picture construction as its siblings, and the same reasons: paints built once per cell size,
 * cells mirrored into a shared value as plain numbers because the recording worklet cannot read props.
 */

import {
  Canvas,
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

import { blockFacePaints } from './block-cell';
import { BLOCK_COLOR_IDS } from '../engine/types';
import type { BlockColorId } from '../engine/types';

/**
 * How long one cell takes to fall out of sight, milliseconds.
 *
 * Shorter than the clear burst's 300 ms per cell *and* front-loaded by the easing below. A failure
 * should be over quickly — it is information, not a performance, and the player is already reaching for
 * the next piece.
 */
export const MISS_FALL_MS = 340;

/**
 * Per-cell stagger, milliseconds.
 *
 * Much tighter than the clear cascade's 40 ms. The cells of one piece fell together in reality, so they
 * should read as one object coming apart rather than as a queue — the stagger is only here to stop them
 * looking like a rigid block.
 */
export const MISS_STEP_MS = 26;

/** How far a cell falls, as a multiple of the cell size. */
const FALL_DISTANCE = 2.4;

/**
 * Room a canvas needs *below* the cells for the fall, in points.
 *
 * A Skia `Canvas` is a fixed drawing surface — anything outside its width and height never exists, and it
 * is not clipped by a parent that happens to be bigger. So a caller sizing a canvas to the cells alone
 * gets a fall that vanishes a third of the way down. The field's own canvas has the virtual grid's empty
 * margin to fall into and never noticed; a canvas anchored to an arbitrary drop point has nothing, and has
 * to add this.
 *
 * The half cell on top is for the tumble: a cell rotates 26 degrees about its centre at full fall, which
 * reaches past its own corner.
 */
export function missFallPadding(cell: number): number {
  return cell * (FALL_DISTANCE + 0.5);
}

/** Numbers per cell in the flat array: x, y, colour index, tumble direction. */
const STRIDE = 4;

/** Accelerating, so it reads as being dropped rather than lowered. */
const FALL_EASE = Easing.bezierFn(0.4, 0, 0.9, 0.7);

function makeMissPaints(cell: number, colors: TileColors): { fills: SkPaint[] } {
  /**
   * The **piece** look, not the field's — and the distinction is the point.
   *
   * What falls away is the piece the player was holding, so it is drawn the way a piece is drawn: the
   * full cell, gradient over its whole height, matching `PieceArt` in the tray. The field's cells are
   * inset by two so neighbours in one footprint read as separate cells, which a piece coming apart does
   * not need.
   *
   * There is no seam here — nothing hands a cell over to this — so the two looks are free to differ.
   * Before `block-cell.ts` they differed by accident and nobody could tell which; now the choice is a
   * named argument.
   */
  const fills = blockFacePaints(cell, 'piece', colors);

  return { fills };
}

export type MissCell = { x: number; y: number; colorId: BlockColorId };

/**
 * One piece's wasted cells, tumbling away.
 *
 * **The caller must key this on the placement's identity**, so it remounts per drop. Its timeline is
 * built on mount; reusing the element for a second miss would leave the first one's `fall` where it
 * stopped, and the new cells would appear already on the floor.
 */
export const SlotMissSkia = memo(function SlotMissSkia({
  cells: missCells,
  width,
  height,
  cell,
  reduceMotion,
}: {
  cells: readonly MissCell[];
  /** Canvas size — the box the positions in `cells` are relative to. */
  width: number;
  height: number;
  cell: number;
  reduceMotion: boolean;
}) {
  const radius = Math.max(4, cell * 0.14);
  const colors = useTileColors();
  const paints = useMemo(() => makeMissPaints(cell, colors), [cell, colors]);

  const { flat, span } = useMemo(() => {
    const values: number[] = [];
    missCells.forEach(({ x, y, colorId }, index) => {
      // Direction from grid parity, matching the burst's own rule, so a cell always tumbles the same
      // way whichever animation takes it.
      const direction = (index % 2 === 0 ? 1 : -1) * (x > y ? 1 : -1);
      values.push(x, y, BLOCK_COLOR_IDS.indexOf(colorId), direction);
    });
    return {
      flat: values,
      span: Math.max(0, missCells.length - 1) * MISS_STEP_MS + MISS_FALL_MS,
    };
  }, [missCells]);

  /**
   * Seeded from `flat` rather than empty, for the reason `ClearBurstSkia` documents: the cells are drawn
   * here for the first time in the commit that mounts this, and an effect does not run until after that
   * commit is painted — so starting empty costs a blank frame between the drop and the fall.
   */
  const cells = useSharedValue<number[]>(reduceMotion ? [] : flat);
  const fall = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    cells.value = flat;
    fall.value = 0;
    fall.value = withTiming(1, { duration: span, easing: Easing.linear });
    return () => cancelAnimation(fall);
  }, [cells, fall, flat, reduceMotion, span]);

  const picture = useDerivedValue(() =>
    createPicture((canvas) => {
      const data = cells.value;
      const global = fall.value;
      if (data.length === 0 || global >= 1) return;

      const count = Math.floor(data.length / STRIDE);
      for (let i = 0; i < count; i += 1) {
        const x = data[i * STRIDE];
        const y = data[i * STRIDE + 1];
        const colour = data[i * STRIDE + 2];
        const direction = data[i * STRIDE + 3];

        const start = (i * MISS_STEP_MS) / span;
        const end = (i * MISS_STEP_MS + MISS_FALL_MS) / span;
        // `<` not `<=`, so a zero-delay cell draws on the very first frame — otherwise the first cell
        // of every miss blinks out of existence before its own fall begins.
        if (global < start) continue;
        const t = global >= end ? 1 : FALL_EASE((global - start) / (end - start));

        // Fades late rather than linearly: a cell that dims immediately reads as being deleted, where
        // one that stays solid most of the way down reads as falling out of the world.
        const alpha = t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45;
        if (alpha <= 0.01) continue;

        canvas.save();
        canvas.translate(x + cell / 2, y + cell / 2 + t * cell * FALL_DISTANCE);
        canvas.rotate(direction * 26 * t, 0, 0);
        const scale = 1 - 0.34 * t;
        canvas.scale(scale, scale);
        canvas.translate(-cell / 2, -cell / 2);

        const paint = paints.fills[colour] ?? paints.fills[0];
        paint.setAlphaf(alpha);
        canvas.drawRRect(
          Skia.RRectXY(Skia.XYWHRect(0, 0, cell, cell), radius, radius),
          paint,
        );

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

/** Total length of a miss shower over `cellCount` cells, milliseconds. */
export function missSpanMs(cellCount: number): number {
  return Math.max(0, cellCount - 1) * MISS_STEP_MS + MISS_FALL_MS;
}
