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

import { useEffect, useMemo } from 'react';
import { Easing, useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import type { ComponentType } from 'react';

import type { Beat } from '../engine/slot-types';
import type { BoardSpec } from '../engine/types';
import type { BoardMetrics } from '../view/metrics';
import { MOTION_STRIDE } from '../engine/slot-drop';
import { groupMotionAt, motionRoomsFor } from '../view/group-motion';
import { varietyData } from './contract';
import { VARIETY_IDS, type VarietyId } from './registry';
import { ArmourLayer } from './armour/ArmourLayer';
import { BombLayer } from './bomb/BombLayer';
import { HuesLayer } from './hues/HuesLayer';
import { FuseLayer } from './fuse/FuseLayer';
import { SpinLayer } from './spin/SpinLayer';
import { DRIFT_VARIETY, type DriftData } from './drift/drift';
import { SPIN_VARIETY, type SpinData } from './spin/spin';
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
  /** Where every footprint is right now, so a layer decorating one can ride along with it. */
  motion?: GroupMotion;
};

/**
 * Where every footprint is, relative to where the dealer put it: `dx, dy, angle` per group, flat in
 * `MOTION_STRIDE`, in `beat.groups` order. See `slot-drop.ts`.
 *
 * One shared array rather than a pair of numbers for the field, because the field no longer moves as one thing.
 * Every consumer — the footprint transform, the hover ghost, the drag resolve, the volley launch — reads this
 * same array, which is what keeps them agreeing to the pixel.
 */
export type GroupMotion = Readonly<SharedValue<number[]>>;

/** What the layout gives the motion hook to work from. */
export type MotionContext = {
  paused?: boolean;
  /** Clearance the layout reserved above the play rect, in points. Added to each footprint's upward room. */
  driftAmplitude: number;
  reduceMotion: boolean;
  grid: BoardSpec;
  /** `metrics.pitch`, so room can be measured in cells. */
  pitch: number;
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
  // The spin turns the footprint through the motion channel's angle — see `useGroupMotion` — and draws only the
  // countdown to the next turn, because a timing mechanic without a visible clock is a guessing game.
  spin: { FieldLayer: SpinLayer },
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
 * Every footprint's live motion, from every variety that moves one.
 *
 * ## Hooks are called unconditionally, and that is not a workaround
 *
 * Every variety's motion hook runs on every render, whether its variety is on this beat or not, receiving its
 * data or `undefined` and returning rest when absent. React requires it — a hook cannot be called
 * conditionally — and the registry being a static object is what makes the order stable.
 *
 * It is also what the drift already did: `useSlotDrift` was called with `beat.drift`, which was 0 on a still
 * beat, so this formalises an existing pattern rather than inventing one. The cost is one idle
 * `useFrameCallback` per registered variety, which is a comparison per frame on the UI thread.
 *
 * ## Why one array rather than an offset per variety
 *
 * Several consumers need this, and they must agree to the pixel: each footprint's transform, the hover ghost,
 * and the tray's drop resolve — so that accuracy is graded against where the footprints *are*. Handing them a
 * list to sum themselves would be several places to get it wrong. A variety that turns a footprint for a rule
 * writes the same `angle` slot the drift's tilt would, so the two cannot fight over one target.
 *
 * The drift used to move the field as a whole, by one vertical offset the layout had to reserve. It now moves
 * each footprint inside its zone's own slack — see `group-motion.ts` — so the range is set by the grid rather
 * than by the screen, which is what makes the gust visible on a tight battle layout.
 */
export function useGroupMotion(beat: Beat, ctx: MotionContext): GroupMotion {
  const drift = useDriftOffset(
    ctx.driftAmplitude,
    varietyData<DriftData>(beat, DRIFT_VARIETY.id),
    ctx.reduceMotion,
    ctx.paused,
  );

  const rooms = useMemo(
    () => motionRoomsFor(ctx.grid, beat.groups, ctx.pitch, ctx.driftAmplitude),
    [ctx.grid, beat.groups, ctx.pitch, ctx.driftAmplitude],
  );
  const spin = useSpinAngle(beat, ctx.reduceMotion);

  return useDerivedValue(() => {
    const out = groupMotionAt(drift.phase.value, drift.live.value, rooms, spin.index < 0);
    if (spin.index >= 0) out[spin.index * MOTION_STRIDE + 2] = spin.angle.value;
    return out;
  });
}

/**
 * The spinning footprint's angle, tweened, and which footprint it belongs to.
 *
 * Shared by `useGroupMotion` and any host that drives the motion from its own clock, so the two cannot disagree
 * about how a turn looks. Three quarter turns go the short way round, and a new beat starts square rather than
 * unwinding the last one's turn.
 */
export function useSpinAngle(beat: Beat, reduceMotion: boolean): { index: number; angle: Readonly<SharedValue<number>> } {
  const data = varietyData<SpinData>(beat, SPIN_VARIETY.id);
  const index = data?.groupId ? beat.groups.findIndex((group) => group.id === data.groupId) : -1;
  const facing = data?.facing ?? 0;
  const target = facing === 3 ? -Math.PI / 2 : (facing * Math.PI) / 2;
  const angle = useSharedValue(0);

  useEffect(() => {
    angle.value = 0;
  }, [angle, beat.index]);

  useEffect(() => {
    angle.value = reduceMotion
      ? target
      : withTiming(target, { duration: SPIN_TURN_MS, easing: Easing.out(Easing.cubic) });
  }, [angle, target, reduceMotion]);

  return { index, angle };
}

/** How long a turn takes to play, milliseconds. Quick enough to read as a snap, slow enough to be seen. */
export const SPIN_TURN_MS = 220;
