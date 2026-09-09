import { useMemo } from 'react';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { varietyData, slotDriftCyclesPerSecond } from '@incubator/tile-match/varieties';
import { groupMotionAt, motionRoomsFor, MOTION_STRIDE } from '@incubator/tile-match/motion';
import { useSpinAngle, type GroupMotion } from '@incubator/tile-match/native';
import type { Beat, BoardSpec } from '@incubator/tile-match/engine';

/**
 * Every footprint's live motion for one egg, driven by the shared combat clock.
 *
 * The phase is derived from the clock rather than integrated, so both eggs read the same beat-relative time
 * and pause, background and resume together. Each footprint moves inside its own zone's slack — see
 * `motionRoomsFor` — with `extraUp` being the clearance the layout already reserved above the play rect.
 * A spinning footprint takes its angle from the spin instead of the gust's tilt.
 */
export function useCombatMotion(
  beat: Beat, clock: SharedValue<number>, startedAt: number,
  grid: BoardSpec, pitch: number, extraUp: number, reduced: boolean,
): GroupMotion {
  const strength = varietyData<{strength: number}>(beat, 'drift')?.strength ?? 0;
  const rooms = useMemo(() => motionRoomsFor(grid, beat.groups, pitch, extraUp), [grid, beat.groups, pitch, extraUp]);
  const spin = useSpinAngle(beat, reduced);
  return useDerivedValue(() => {
    const phase = reduced || strength <= 0 ? 0 : (Math.max(0, clock.value - startedAt) / 1000 * slotDriftCyclesPerSecond(strength)) % 1;
    const out = groupMotionAt(phase, reduced ? 0 : strength, rooms, spin.index < 0);
    if (spin.index >= 0) out[spin.index * MOTION_STRIDE + 2] = spin.angle.value;
    return out;
  });
}
