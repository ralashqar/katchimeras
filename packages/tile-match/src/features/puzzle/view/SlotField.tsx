import { useTileColors, type TileColors } from '../../../ui/theme';
/**
 * The slot field: the target footprints drawn around the car, and the drop feedback over them.
 *
 * Modelled directly on `BoardCells`, which is the right template and for the same reason — one
 * `Canvas`, one recorded `Picture`, paints built once per cell size, and the cell data mirrored into
 * a shared value as plain numbers because the recording worklet cannot read props. Where the board
 * drew a full rectangle of wells, this draws only the cells that belong to a footprint, so an empty
 * field is genuinely nothing rather than a grid of holes.
 *
 * ## What the player is being told
 *
 * Three states per cell, and the distinction between the last two is the whole accuracy mechanic:
 *
 *  - **target**: a footprint cell waiting to be filled. A faint tinted well in its group's colour,
 *    which is what pairs it with the piece sitting in the tray.
 *  - **filled**: a cell a dropped piece landed on. The full block gradient, so a completed footprint
 *    reads as solid.
 *  - **hover**: while dragging, the cells the piece would land on, split into the ones that would
 *    hit a target and the ones that would be **wasted**. The board's version of this was a
 *    valid/invalid ghost, which does not apply here — every drop is legal, it is only more or less
 *    accurate — so showing which cells are about to be thrown away is the honest replacement, and it
 *    teaches the scoring without a tutorial.
 *
 * ## The ghost is Views, not Skia
 *
 * Deliberate, and the same split `BlockBoard` used. The picture is rebuilt whenever the field
 * changes, which is once per placement; the ghost changes on every cell the finger crosses. Keeping
 * it as a handful of absolutely-positioned Views means a hover costs a cheap style update rather than
 * re-recording the canvas mid-drag, which is the one moment the JS thread must not be interrupted.
 */

import {
  Canvas,
  Picture,
  Skia,
  createPicture,
  type SkPaint,
} from '@shopify/react-native-skia';
import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Easing,
  cancelAnimation,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { palette, semantic } from '../../../ui/tokens';
import { BLOCK_COLOR_IDS } from '../engine/types';
import type { BoardSpec } from '../engine/types';
import type { SlotGroup } from '../engine/slot-types';
import {
  blockFacePaints,
  blockFaceRect,
  blockGlowPaints,
  blockRimPaints,
  blockShinePaint,
  blockShineRect,
  faceRadius,
  rimWidth,
  wellRadius,
  blockWellPaints,
} from './block-cell';
import { cellOrigin, type BoardMetrics } from './metrics';
import {
  SLOT_ARRIVAL_MS,
  SLOT_ARRIVAL_STEP_MS,
  slotArrivalSpanMs,
} from './slot-metrics';

/**
 * The field's entrance, per group.
 *
 * Footprints arrive one after another rather than together: a beat with three of them should read
 * as three things being asked of you, and simultaneous arrival reads as one. The stagger is per
 * *group*, not per cell — a group is a single object as far as the player is concerned.
 */
export const SLOT_INTRO_MS = 260;
export const SLOT_INTRO_STEP_MS = 90;

/**
 * How much a landing cell swells, as a fraction of its size.
 *
 * The board used 0.055 on a dense 8x5 grid, where anything larger had neighbours to collide with. Slot
 * cells are fewer and carry a 3pt gap, so there is room for a pop you can actually see: at 0.12 a 38pt
 * cell grows about 2pt on each side, which stays inside the gap.
 */
const ARRIVAL_POP = 0.12;

/**
 * Numbers per cell in the flat array: x, y, colour index, group index, filled flag, arrival ordinal.
 *
 * The arrival ordinal is the cell's place in the pop sequence, or -1 for a cell that is not arriving.
 * Baked into the array rather than looked up from a set inside the worklet: the stagger needs an index
 * anyway, and membership plus ordering falls out of one number.
 */
const STRIDE = 6;

/**
 * The field's paints, all five families from `block-cell.ts`.
 *
 * Every one of these used to be written out here, and the gradient and the face geometry were duplicated
 * again in `ClearBurstSkia` — which the field hands each cell over to on the frame a beat resolves. Two
 * separate flickers came out of that pair drifting apart. They now share one definition, so they cannot.
 *
 * The arrival glow is worth one note that did not move: the blur is affordable *here* in a way it would
 * not be during a clear cascade, because an arrival fires on a placement, when nothing else is animating,
 * and at most a handful of cells carry it.
 */
function makeSlotPaints(cell: number, colors: TileColors): {
  fills: SkPaint[];
  wells: SkPaint[];
  rims: SkPaint[];
  glows: SkPaint[];
  shine: SkPaint;
} {
  return {
    fills: blockFacePaints(cell, 'field', colors),
    wells: blockWellPaints(colors),
    rims: blockRimPaints(cell, colors),
    glows: blockGlowPaints(cell, colors),
    shine: blockShinePaint(),
  };
}

export type SlotFieldProps = {
  grid: BoardSpec;
  metrics: BoardMetrics;
  groups: readonly SlotGroup[];
  /**
   * Draw nothing at all.
   *
   * Set the instant a beat resolves, and it is what makes the outro read as the cells *leaving*. The
   * burst draws each filled cell from its own position at `t=0` and animates it out; with this layer
   * still drawing the same cells underneath, the burst played over a static copy of itself and nothing
   * appeared to go anywhere. The board got this for free because its reducer nulled the cleared cells
   * out of `board` in the same commit the burst mounted — the slot reducer keeps the groups, so the
   * hand-off has to be explicit.
   *
   * It hides the empty ghosts too, deliberately. A beat is over: the footprints that were not filled
   * have nothing left to ask for, and leaving them up while their neighbours burst reads as the field
   * half-forgetting to clear.
   */
  hidden?: boolean;
  /**
   * Increments per beat. Used as a `key` by the parent so this remounts and replays its entrance —
   * without it React reuses the views and a new beat's footprints simply appear.
   */
  generation: number;
  /**
   * The drop ghost: every cell a dragged piece would land on, and whether it would count.
   *
   * One flat list rather than two arrays of indices, and **order matters** — the ghosts are keyed by
   * position in it so React reuses the same Views as a piece moves. Two separate arrays keyed by cell
   * index meant every cell crossing unmounted up to four Views and mounted four more, doubled with two
   * fingers down; now a crossing is a style update on views that already exist.
   */
  hoverCells?: readonly HoverGhost[];
  /**
   * The cells the last drop just filled, and an id that changes per drop.
   *
   * Without this a landed cell simply switched from a faint well to a solid block between two frames,
   * which reads as the game *accepting input* rather than as the player having done something. The board
   * had a pop for exactly this and it is most of what made placing on it satisfying.
   *
   * Only the cells *this* drop contributed, never the whole group — a footprint filled by two pieces
   * would otherwise pop all of its cells again on the second one.
   */
  arrival?: SlotArrival;
  reduceMotion?: boolean;
};

/** One cell of a drop ghost. */
export type HoverGhost = { index: number; onTarget: boolean };

/** A landing to celebrate. `id` changes per drop so the animation retriggers. */
export type SlotArrival = { id: number; cells: readonly number[] };

export const SlotField = memo(function SlotField({
  grid,
  metrics,
  groups,
  generation,
  hidden = false,
  hoverCells,
  arrival,
  reduceMotion = false,
}: SlotFieldProps) {
  const arrivalId = arrival?.id;
  const arrivalCells = arrival?.cells;
  const arrivalCount = arrivalCells?.length ?? 0;
  const { width, height, cell } = metrics;
  const radius = wellRadius(cell);
  const innerRadius = faceRadius(cell);
  const colors = useTileColors();
  const paints = useMemo(() => makeSlotPaints(cell, colors), [cell, colors]);

  /**
   * The face and shine geometry, hoisted out of the recording worklet.
   *
   * These allocate, and the worklet walks every cell every frame — so they are read once here and the
   * loop below captures plain numbers. Shared with `ClearBurstSkia` through `block-cell.ts`, which is
   * what stops the two drifting apart on the frame the burst takes a cell over.
   */
  const face = blockFaceRect(cell);
  const shine = blockShineRect(cell);
  /**
   * Half the rim's stroke, so the rim sits *inside* the cell rather than straddling its edge — which would
   * make adjacent cells in one footprint read as a single thick line.
   *
   * Hoisted for the same reason as the two above, and this one is not merely an optimisation: calling an
   * ordinary imported function from inside the recording worklet throws at runtime. Reanimated packs it as a
   * remote function and the UI runtime refuses to call it synchronously — *"Tried to synchronously call a
   * Remote Function"*, which is what happened when this was `rimWidth(cell) / 2` inline in the loop.
   */
  const rimInset = rimWidth(cell) / 2;

  /**
   * Every footprint cell, flattened for the worklet.
   *
   * Rebuilt when the beat's groups change, which is once per placement — not per frame.
   */
  const flat = useMemo(() => {
    // Position in the pop sequence, by cell. Built once per drop rather than searched per cell.
    const arrivalOrder = new Map<number, number>();
    arrivalCells?.forEach((index, ordinal) => arrivalOrder.set(index, ordinal));

    const values: number[] = [];
    groups.forEach((group, groupIndex) => {
      const filled = new Set(group.filled);
      const colour = BLOCK_COLOR_IDS.indexOf(group.colorId);
      for (const index of group.cells) {
        const { x, y } = cellOrigin(metrics, Math.floor(index / grid.cols), index % grid.cols);
        values.push(
          x,
          y,
          colour,
          groupIndex,
          filled.has(index) ? 1 : 0,
          arrivalOrder.get(index) ?? -1,
        );
      }
    });
    return values;
  }, [groups, grid.cols, metrics, arrivalCells]);

  const cells = useSharedValue<number[]>(flat);
  useEffect(() => {
    cells.value = flat;
  }, [cells, flat]);

  // Mirrored into a shared value rather than branching in render, so hiding costs a redraw of one
  // picture instead of tearing down and rebuilding the canvas.
  const hiddenSV = useSharedValue(hidden);
  useEffect(() => {
    hiddenSV.value = hidden;
  }, [hidden, hiddenSV]);

  /**
   * The arrival pop, as one linear ramp each cell remaps its own window out of.
   *
   * Same single-driver approach as the entrance above and the clear burst: one shared value regardless
   * of how many cells landed, with the stagger applied in-worklet from each cell's ordinal. Restarted
   * on `arrival.id` rather than on the cells themselves so two drops that happen to fill the same cells
   * still each get a pop.
   */
  const arrivalSpan = Math.max(1, slotArrivalSpanMs(arrivalCount));
  const arrive = useSharedValue(1);
  // Mirrored, because the recording worklet cannot read props and the per-cell windows are fractions of
  // this. Kept in step by the same effect that starts the ramp.
  const arrivalSpanSV = useSharedValue(arrivalSpan);

  useEffect(() => {
    // Hover updates may recreate the prop object. Only a placement event starts a landing.
    if (arrivalId === undefined || arrivalCount === 0 || reduceMotion) {
      arrive.value = 1;
      return;
    }
    arrivalSpanSV.value = arrivalSpan;
    arrive.value = 0;
    arrive.value = withTiming(1, { duration: arrivalSpan, easing: Easing.linear });
    return () => cancelAnimation(arrive);
  }, [arrivalId, arrivalCount, arrivalSpan, arrive, arrivalSpanSV, reduceMotion]);

  /** One driver for the whole entrance; each group remaps its own window out of it. */
  const span = Math.max(1, (groups.length - 1) * SLOT_INTRO_STEP_MS + SLOT_INTRO_MS);
  const intro = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      intro.value = 1;
      return;
    }
    intro.value = 0;
    intro.value = withTiming(1, { duration: span, easing: Easing.linear });
    return () => cancelAnimation(intro);
    // `generation` is in here on purpose: the parent keys this component on it, so this normally
    // runs on mount — but if that key is ever dropped, a new beat must still replay the entrance
    // rather than silently inheriting a finished one.
  }, [intro, reduceMotion, span, generation]);

  const picture = useDerivedValue(() =>
    createPicture((canvas) => {
      if (hiddenSV.value) return;

      const data = cells.value;
      const progress = intro.value;
      const arrivalProgress = arrive.value;
      const count = Math.floor(data.length / STRIDE);

      for (let i = 0; i < count; i += 1) {
        const x = data[i * STRIDE];
        const y = data[i * STRIDE + 1];
        const colour = data[i * STRIDE + 2];
        const groupIndex = data[i * STRIDE + 3];
        const isFilled = data[i * STRIDE + 4] === 1;
        const arrivalOrdinal = data[i * STRIDE + 5];

        // Per-group window out of the single ramp.
        const start = (groupIndex * SLOT_INTRO_STEP_MS) / span;
        const end = (groupIndex * SLOT_INTRO_STEP_MS + SLOT_INTRO_MS) / span;
        let t = 1;
        if (progress < 1) {
          t = progress <= start ? 0 : progress >= end ? 1 : (progress - start) / (end - start);
        }
        if (t <= 0) continue;

        // Overshoot so footprints land rather than merely appear — the board's arrival pop.
        let scale = t >= 1 ? 1 : 0.4 + (1.08 - 0.4) * Math.min(1, t / 0.7);

        /**
         * The landing flourish, for a cell this drop just filled.
         *
         * `sin(pi * a)` is the shape: zero at both ends and one in the middle, so the cell swells and
         * settles in a single motion with nothing to unwind. Ramping up and back down separately would
         * need the two halves to agree about the peak, and a mismatch there reads as a hitch.
         *
         * The glow is a *separate* curve — brightest the instant the cell lands and fading from there,
         * because the flash is what says "this just happened" and it should not still be brightening
         * once the cell has stopped moving.
         */
        let arrivalGlow = 0;
        // `isFilled` is part of the condition, not just the ordinal. An arrival is by definition a cell
        // that was filled, and gating on the ordinal alone let a stale arrival from the previous beat pop
        // an *empty* ghost whose index happened to collide.
        if (isFilled && arrivalOrdinal >= 0 && arrivalProgress < 1) {
          const from = (arrivalOrdinal * SLOT_ARRIVAL_STEP_MS) / arrivalSpanSV.value;
          const to = (arrivalOrdinal * SLOT_ARRIVAL_STEP_MS + SLOT_ARRIVAL_MS) / arrivalSpanSV.value;
          if (arrivalProgress > from) {
            const a = arrivalProgress >= to ? 1 : (arrivalProgress - from) / (to - from);
            scale *= 1 + ARRIVAL_POP * Math.sin(Math.PI * a);
            arrivalGlow = (1 - a) * (1 - a);
          }
        }

        canvas.save();
        canvas.translate(x + cell / 2, y + cell / 2);
        if (scale !== 1) canvas.scale(scale, scale);
        canvas.translate(-cell / 2, -cell / 2);

        if (isFilled) {
          // Under the block, so it reads as light escaping from behind the cell rather than as a ring
          // drawn on top of it.
          if (arrivalGlow > 0.01) {
            const glow = paints.glows[colour] ?? paints.glows[0];
            glow.setAlphaf(arrivalGlow);
            const spread = cell * 0.1 * (1 - arrivalGlow);
            canvas.drawRRect(
              Skia.RRectXY(
                Skia.XYWHRect(-spread, -spread, cell + spread * 2, cell + spread * 2),
                radius,
                radius,
              ),
              glow,
            );
          }
          canvas.drawRRect(
            Skia.RRectXY(
              Skia.XYWHRect(face.x, face.y, face.width, face.height),
              innerRadius,
              innerRadius,
            ),
            paints.fills[colour] ?? paints.fills[0],
          );
          canvas.drawRRect(
            Skia.RRectXY(
              Skia.XYWHRect(shine.x, shine.y, shine.width, shine.height),
              shine.radius,
              shine.radius,
            ),
            paints.shine,
          );
        } else {
          canvas.drawRRect(
            Skia.RRectXY(Skia.XYWHRect(0, 0, cell, cell), radius, radius),
            paints.wells[colour] ?? paints.wells[0],
          );
          canvas.drawRRect(
            Skia.RRectXY(
              Skia.XYWHRect(rimInset, rimInset, cell - rimInset * 2, cell - rimInset * 2),
              radius,
              radius,
            ),
            paints.rims[colour] ?? paints.rims[0],
          );
        }

        canvas.restore();
      }
    }),
  );

  return (
    <View style={{ width, height }} pointerEvents="none">
      <Canvas style={{ position: 'absolute', left: 0, top: 0, width, height }}>
        <Picture picture={picture} />
      </Canvas>

      {/* The drop ghost. Keyed by position in the list, not by cell, so a piece moving reuses these
          Views instead of remounting them — see `hoverCells`. Suppressed while hidden along with
          everything else: a drag cannot be in flight during a resolve, but a stale hover surviving one
          would be drawn over the burst. */}
      {hidden
        ? null
        : hoverCells?.map((ghost, ordinal) => (
            <HoverCell
              key={ordinal}
              index={ghost.index}
              onTarget={ghost.onTarget}
              grid={grid}
              metrics={metrics}
            />
          ))}
    </View>
  );
});

/**
 * One ghost cell.
 *
 * Green for a cell about to land on target, red for one about to be wasted — the same colour
 * vocabulary the board's valid/invalid ghost used, repointed at the thing that actually varies now.
 */
const HoverCell = memo(function HoverCell({
  index,
  grid,
  metrics,
  onTarget = false,
}: {
  index: number;
  grid: BoardSpec;
  metrics: BoardMetrics;
  onTarget?: boolean;
}) {
  const { x, y } = cellOrigin(metrics, Math.floor(index / grid.cols), index % grid.cols);
  return (
    <View
      style={[
        styles.hover,
        {
          left: x,
          top: y,
          width: metrics.cell,
          height: metrics.cell,
          borderRadius: wellRadius(metrics.cell),
          borderColor: onTarget ? palette.greenHot : palette.redHot,
          backgroundColor: onTarget ? semantic.valid : semantic.invalid,
          opacity: onTarget ? 0.55 : 0.34,
        },
      ]}
    />
  );
});

const styles = StyleSheet.create({
  hover: {
    position: 'absolute',
    borderWidth: 2,
    borderCurve: 'continuous',
  },
});
