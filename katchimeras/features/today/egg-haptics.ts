import * as Haptics from 'expo-haptics';
import { createEggHapticSequence } from '@/utils/egg-haptic-sequence';

/** Shared Egg-card confirmation, separate from the Bond landing feedback. */
export function playEggActionHaptic() {
  if (process.env.EXPO_OS === 'ios') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
}

/** Both Eggs share soft shake pulses, a heavy hatch, and a settling success cue. */
export function createEggHatchHaptics(reduceMotion: boolean): ReturnType<typeof createEggHapticSequence> {
  if (process.env.EXPO_OS !== 'ios') return { advance: () => {}, stop: () => {} };
  return createEggHapticSequence((cue) => {
    if (cue === 'settle') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      void Haptics.impactAsync(cue === 'shake' ? Haptics.ImpactFeedbackStyle.Soft : Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }
  }, reduceMotion);
}
