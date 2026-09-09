/**
 * Living targets: how each footprint moves on its own, and how much room it has to do it in.
 *
 * The drift used to translate the **whole field** by one vertical offset, and the layout had to reserve that
 * offset above the field — so on a tight battle screen it came out at 18 points, under half a cell, which the
 * drift's own docs call decoration. This module moves the *footprints* instead, each inside the slack its zone
 * already has: a two-tall shape in a four-row flank has two rows of empty zone above or below it, and that room
 * costs the layout nothing because it is inside the rectangle the field already draws in.
 *
 * Pure and Skia-free. The wave is `slotDriftOffset` — one curve, so the drift's tests still describe the motion —
 * applied per group with a phase offset, plus a horizontal sway and a tilt that arrive as the strength hardens.
 * `groupMotionAt` is a worklet: the screen's derived value calls it every frame with the beat's clock.
 */

// Pure module — `.ts` extension imports so it runs under `node --test`.
import { SLOT_ZONES } from '../engine/slot-deal';
import { MOTION_STRIDE } from '../engine/slot-drop';
import type { SlotGroup } from '../engine/slot-types';
import type { BoardSpec } from '../engine/types';
import { DRIFT_FLOOR, driftHarshness, slotDriftOffset } from '../variety/drift/drift-metrics';

export { MOTION_STRIDE };

/**
 * Farthest a footprint travels along one axis, in cell pitches.
 *
 * Above `SLOT_DRIFT_CELLS` (1.25) on purpose: that was the whole-field figure, sized so the field never reached
 * under the HUD. A footprint moving inside its own zone has nothing to reach under, and the ask was for the
 * motion to be *seen*. Kept under two so the target still reads as the same object in the same place.
 */
export const SLOT_MOTION_CELLS = 1.75;

/**
 * Horizontal travel, inward toward the centre, in pitches.
 *
 * Half a pitch: the flanks sit one spacer column off the five-cell corridor the egg may grow into, so a full
 * pitch of sway would put a footprint against the player's own shell. Half keeps it clear at the widest egg.
 */
export const SLOT_SWAY_CELLS = 0.5;

/** The tilt at full harshness, radians. Five degrees: enough to unsettle the eye, not enough to misread a shape. */
export const SLOT_TILT_RADIANS = (5 * Math.PI) / 180;

/**
 * Where in the harshness band the second axis and the tilt arrive.
 *
 * The gentlest drifting beat is a single smooth vertical rise, exactly as the drift always was, so a player
 * meeting the mechanic gets its most legible reading. The sway joins a third of the way up the band and the
 * tilt past halfway, so a long streak is a target moving on an ellipse and rocking, not merely a taller bob.
 */
export const SWAY_AT_HARSHNESS = 0.35;
export const TILT_AT_HARSHNESS = 0.55;

/**
 * How far behind the previous footprint each one runs, in cycles.
 *
 * Half a cycle, so a double's two targets are always at opposite ends of their travel: when one is up the other
 * is at rest. Two targets moving in unison read as one field moving, which is the thing this replaces.
 */
export const GROUP_PHASE_STEP = 0.5;

/** Per-group room: vertical travel (signed points, negative is up), then inward horizontal travel (signed). */
export const ROOM_STRIDE = 2;

/**
 * How far one footprint may move, from where the dealer put it.
 *
 * Vertical room is the zone's slack on whichever side has more of it — the dealer places a shape at a random
 * origin inside its zone, so a shape at the top of the flank bobs down and one at the bottom bobs up — plus
 * `extraUp`, the field-level clearance the layout already reserved above the play rect. Capped at
 * `SLOT_MOTION_CELLS` so a small shape in a tall zone does not wander.
 *
 * Horizontal room points toward the grid's centre column, so a flank footprint sways in toward the egg and
 * back, never off the edge of the frame. The centre zone has none: it is launch-only and sits under the egg.
 */
export function motionRoomFor(
  grid: BoardSpec,
  group: SlotGroup,
  pitch: number,
  extraUp = 0,
): [vertical: number, inward: number] {
  const zone = SLOT_ZONES.find((candidate) => candidate.id === group.zone);
  if (!zone || group.cells.length === 0) return [0, 0];

  let minRow = Number.POSITIVE_INFINITY;
  let maxRow = Number.NEGATIVE_INFINITY;
  let columnSum = 0;
  for (const index of group.cells) {
    const row = Math.floor(index / grid.cols);
    if (row < minRow) minRow = row;
    if (row > maxRow) maxRow = row;
    columnSum += index % grid.cols;
  }

  const cap = SLOT_MOTION_CELLS * pitch;
  const above = Math.max(0, minRow - zone.rowFrom) * pitch + Math.max(0, extraUp);
  const below = Math.max(0, zone.rowTo - maxRow) * pitch;
  const vertical = above >= below ? -Math.min(above, cap) : Math.min(below, cap);

  const centre = (grid.cols - 1) / 2;
  const mean = columnSum / group.cells.length;
  const inward =
    zone.id === 'below' || Math.abs(mean - centre) < 0.5
      ? 0
      : Math.sign(centre - mean) * SLOT_SWAY_CELLS * pitch;

  return [vertical, inward];
}

/** Every group's room, flat, in `beat.groups` order. */
export function motionRoomsFor(
  grid: BoardSpec,
  groups: readonly SlotGroup[],
  pitch: number,
  extraUp = 0,
): number[] {
  const rooms: number[] = [];
  for (const group of groups) rooms.push(...motionRoomFor(grid, group, pitch, extraUp));
  return rooms;
}

/**
 * Every footprint's live `dx, dy, angle` at a phase, flat in `MOTION_STRIDE`.
 *
 * `phase` is the beat's own clock in cycles, as the drift already measures it; each group runs
 * `GROUP_PHASE_STEP` behind the last. `strength` is the beat's drift strength — zero holds every footprint at
 * rest and returns a zeroed array, so a still beat costs a loop over a few numbers.
 *
 * The vertical bob is the drift wave verbatim, signed by the room. The sway is a plain raised cosine a quarter
 * cycle behind it, so the path is an ellipse rather than a diagonal line. The tilt is a sine — through zero at
 * rest, so a footprint never sits crooked at the bottom of its travel. Both later terms are gated the way the
 * drift's own offset gates itself below `DRIFT_FLOOR`, so a fade in or out never snaps them on.
 *
 * `tilt` may be switched off by a caller whose beat already turns the footprint for a rule (see `spin`); two
 * rotations on one target is noise rather than difficulty.
 */
export function groupMotionAt(
  phase: number,
  strength: number,
  rooms: readonly number[],
  tilt = true,
): number[] {
  'worklet';
  const count = Math.floor(rooms.length / ROOM_STRIDE);
  const out: number[] = [];
  for (let i = 0; i < count * MOTION_STRIDE; i += 1) out.push(0);
  if (strength <= 0) return out;

  const gate = Math.min(1, strength / DRIFT_FLOOR);
  const harshness = driftHarshness(Math.max(strength, DRIFT_FLOOR));
  const swayMix = Math.min(1, Math.max(0, (harshness - SWAY_AT_HARSHNESS) / (1 - SWAY_AT_HARSHNESS)));
  const tiltMix = tilt
    ? Math.min(1, Math.max(0, (harshness - TILT_AT_HARSHNESS) / (1 - TILT_AT_HARSHNESS)))
    : 0;

  for (let g = 0; g < count; g += 1) {
    const local = (((phase + g * GROUP_PHASE_STEP) % 1) + 1) % 1;
    const vertical = rooms[g * ROOM_STRIDE];
    const inward = rooms[g * ROOM_STRIDE + 1];

    // `slotDriftOffset` is never positive: it is the upward bob. Room below flips it.
    const bob = slotDriftOffset(local, strength, Math.abs(vertical));
    const dy = vertical < 0 ? bob : -bob;

    const turn = local * Math.PI * 2;
    const sway = (1 - Math.cos(turn - Math.PI / 2)) / 2;
    const dx = inward * swayMix * gate * sway;

    const angle = SLOT_TILT_RADIANS * tiltMix * gate * Math.sin(turn);

    // `+ 0` folds the `-0` a zero mix times a negative sine produces into a plain zero, as the drift does.
    out[g * MOTION_STRIDE] = dx + 0;
    out[g * MOTION_STRIDE + 1] = dy + 0;
    out[g * MOTION_STRIDE + 2] = angle + 0;
  }
  return out;
}
