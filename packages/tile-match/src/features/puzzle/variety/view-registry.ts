/**
 * Every variety's view half: what it draws, and how it moves the field.
 *
 * Capabilities **E** and **F** of the contract. They live here rather than on `VarietyDef` because they need
 * React and Reanimated, and `registry.ts` is imported by the engine — which `node --test` loads directly, so
 * a transitive React import would execute inside the test process. That split is the one structural rule of
 * the whole system, and `variety.test.ts` asserts the two registries name the same varieties so the split
 * cannot silently become a gap.
 *
 * This is the only `id -> React component` registry in the codebase. Every other registry here is data-only
 * and its consumers switch on the data, so it is worth saying why this one is different: the alternative is
 * `race.tsx` importing every variety and mounting each one explicitly, which is exactly the entanglement the
 * variety system exists to prevent. A screen that has to be edited per mode is a screen that will accumulate
 * a branch per mode.
 *
 * ## Where a layer is mounted, and what that buys
 *
 * `FieldLayer` goes inside the field's container in `race.tsx`, as a sibling of the footprints, the burst and
 * the miss shower. That inherits the field's coordinate space, its `metrics` sizing and the drift transform
 * for free — the same three lines the burst already uses. `zLayer` keeps deliberate gaps for exactly this;
 * variety layers take 51–59, above the field and below the play stack.
 *
 * `TrayLayer` goes over the play stack, for chrome that belongs to a *piece* rather than a footprint — a fuse
 * on a bomb, say.
 *
 * Two constraints a layer must respect, both already learned the hard way elsewhere. A Skia `Canvas` is a
 * fixed surface and is **not** clipped by a larger parent, so anything drawn outside `metrics.width × height`
 * needs its own bigger canvas (see `missFallPadding`). And decoration does not earn a canvas at all —
 * `AGENTS.md` is explicit that Skia is for collapsing many cells into one recorded picture, and that a ring
 * or a plate should be Reanimated and Views.
 */

import { useMemo } from 'react';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import type { ComponentType } from 'react';

import type { Beat } from '../engine/slot-types';
import type { BoardMetrics } from '../view/metrics';
import { varietyData } from './contract';
import { VARIETY_IDS, type VarietyId } from './registry';
import { ArmourLayer } from './armour/ArmourLayer';
import { BombLayer } from './bomb/BombLayer';
import { HuesLayer } from './hues/HuesLayer';
import { FuseLayer } from './fuse/FuseLayer';
import { DRIFT_VARIETY, type DriftData } from './drift/drift';
import { useDriftOffset } from './drift/use-drift-offset';

/** What every variety layer is handed. Scalars and numbers only — never engine types. */
export type VarietyLayerProps = {
  /** Field geometry, so a layer can place itself by cell. */
  metrics: BoardMetrics;
  /** The beat's footprints, for a layer that decorates them. */
  beat: Beat;
  reduceMotion: boolean;
  /** Optional host simulation clock. Freezes timing cues with pause/background. */
  clock?: Readonly<SharedValue<number>>;
  beatStartedAt?: number;
};

/** Where the field is, relative to where the layout put it. Points, summed across varieties. */
export type FieldOffset = {
  dx: Readonly<SharedValue<number>>;
  dy: Readonly<SharedValue<number>>;
};

/** What the layout gives an offset hook to work from. */
export type OffsetContext = {
  paused?: boolean;
  /** How far the field may rise at full strength — `layout.slotField.driftAmplitude`. */
  driftAmplitude: number;
  reduceMotion: boolean;
};

export type VarietyView = {
  /**
   * Drawn inside the field's container **behind** the footprints.
   *
   * Use for backing plates or frames that the footprint cells should paint over — so the plate
   * "peeks out" as a frame rather than covering what the player is aiming at.
   */
  BackLayer?: ComponentType<VarietyLayerProps>;
  /** Drawn inside the field's container **above** the footprints, so it drifts with the field. */
  FieldLayer?: ComponentType<VarietyLayerProps>;
  /** Drawn over the play stack, for chrome belonging to a piece rather than a footprint. */
  TrayLayer?: ComponentType<VarietyLayerProps>;
};

const VARIETY_VIEWS = {
  // Drift draws nothing. All of it is the offset below, which is the whole reason it was the right variety
  // to build the contract against: it proved that "moves the field" and "draws something" are separate
  // capabilities rather than one.
  drift: {},
  // The bomb marks the footprint its rigged piece belongs to — see `BombLayer` for why the footprint and
  // not the tray piece. Inside the field's container, so it drifts with the cells it is drawn on.
  bomb: { FieldLayer: BombLayer },
  // Crossed draws nothing: the colours already say which piece goes where, and an arrow from a tray slot to a
  // footprint would answer the question the mechanic exists to ask.
  crossed: {},
  // The hue swap needs a clock the player can see, or it is a guessing game — see `HuesLayer`.
  hues: { FieldLayer: HuesLayer },
  // Armour has to show both that a footprint is frozen and how many more drops it wants. Without the second half
  // it is an obstacle rather than a mechanic — see `ArmourLayer`.
  armour: { FieldLayer: ArmourLayer },
  // Fuse draws a chrome plate **behind** both halves of the split footprint so the cells paint over it
  // as a frame. BackLayer rather than FieldLayer so it sits below the footprints in the z-stack.
  fuse: { BackLayer: FuseLayer },
} as const satisfies Record<VarietyId, VarietyView>;

export function varietyView(id: VarietyId): VarietyView {
  return VARIETY_VIEWS[id];
}

/** Every variety's layers, in registry order, for a screen to mount unconditionally. */
export const VARIETY_VIEW_IDS: readonly VarietyId[] = VARIETY_IDS;

/**
 * The field layers to mount, in registry order.
 *
 * Every registered layer, unconditionally — **not** only the ones this beat carries. A layer decides for itself
 * whether it has anything to draw, by reading its own data off the beat and returning `null` when it is absent,
 * because mounting conditionally would remount the layer whenever the beat gained or lost that variety and
 * discard whatever animation it had running. `BombLayer` is written that way and so should any other be.
 *
 * The list is derived from the registry, so a screen never names a variety. That is the entanglement the whole
 * two-registry arrangement exists to prevent.
 */
export const varietyFieldLayers: readonly {
  id: VarietyId;
  Layer: ComponentType<VarietyLayerProps>;
}[] = VARIETY_IDS.flatMap((id) => {
  // Widened to `VarietyView` before the read: the table's inferred type is a *union* of the concrete entry
  // shapes, and a variety with no layers contributes `{}`, which has no such property.
  const view: VarietyView = VARIETY_VIEWS[id];
  const Layer = view.FieldLayer;
  return Layer ? [{ id, Layer }] : [];
});

/**
 * Variety layers rendered **before** (behind) the footprints.
 *
 * Same unconditional-mount contract as `varietyFieldLayers` — each layer returns `null` when its data is absent.
 * The distinction from `FieldLayer` is purely z-order: a `BackLayer` is a backing plate the footprint cells
 * should paint over, so it must sit below them in the stack.
 */
export const varietyBackLayers: readonly {
  id: VarietyId;
  Layer: ComponentType<VarietyLayerProps>;
}[] = VARIETY_IDS.flatMap((id) => {
  const view: VarietyView = VARIETY_VIEWS[id];
  const Layer = view.BackLayer;
  return Layer ? [{ id, Layer }] : [];
});

/**
 * The field's live offset, summed across every variety that moves it.
 *
 * ## Hooks are called unconditionally, and that is not a workaround
 *
 * Every variety's offset hook runs on every render, whether its variety is on this beat or not, receiving its
 * data or `undefined` and returning rest when absent. React requires it — a hook cannot be called
 * conditionally — and the registry being a static object is what makes the order stable.
 *
 * It is also what the drift already did: `useSlotDrift` was called with `beat.drift`, which was 0 on a still
 * beat, so this formalises an existing pattern rather than inventing one. The cost is one idle
 * `useFrameCallback` per registered variety, which is a comparison per frame on the UI thread.
 *
 * ## Why a single summed pair rather than one value per variety
 *
 * Two consumers need this, and they must agree to the pixel: the field container's transform, and the tray's
 * drop resolve — so that accuracy is graded against where the footprints *are*. Handing them a list to sum
 * themselves would be two places to get it wrong. Summing means two varieties that both move the field
 * compose rather than one winning, which is the only sane default.
 *
 * `dx` exists and is always zero today. The drift is vertical because the layout can only afford vertical —
 * see `slotDriftOffset` — but a variety that slides the field sideways is an obvious future one, and adding
 * the axis later would mean touching the tray's gesture again.
 */
export function useVarietyOffset(beat: Beat, ctx: OffsetContext): FieldOffset {
  const drift = useDriftOffset(
    ctx.driftAmplitude,
    varietyData<DriftData>(beat, DRIFT_VARIETY.id),
    ctx.reduceMotion,
    ctx.paused,
  );

  // Listed explicitly rather than mapped over the registry, because each hook has its own signature and its
  // own data type — and because a loop over hooks is exactly the thing React's rules forbid. One line per
  // variety that moves the field is a small, honest price.
  const contributions = useMemo(() => [drift.offsetY], [drift.offsetY]);

  const dy = useDerivedValue(() => {
    let total = 0;
    for (const value of contributions) total += value.value;
    return total;
  });

  const dx = useDerivedValue(() => 0);

  return { dx, dy };
}
