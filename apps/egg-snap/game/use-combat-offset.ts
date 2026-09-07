import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { varietyData, slotDriftOffset, slotDriftCyclesPerSecond } from '@incubator/tile-match/varieties';
import type { Beat } from '@incubator/tile-match/engine';

/** The same phase at the same beat-relative time, independently for each egg. */
export function useCombatOffset(beat: Beat, clock: SharedValue<number>, startedAt: number, amplitude: number, reduced: boolean) {
  const strength = varietyData<{strength: number}>(beat, 'drift')?.strength ?? 0;
  const dy = useDerivedValue(() => reduced ? 0 : slotDriftOffset(
    (Math.max(0, clock.value - startedAt) / 1000 * slotDriftCyclesPerSecond(strength)) % 1, strength, amplitude,
  ));
  const dx = useDerivedValue(() => 0);
  return {dx, dy};
}
