import { Easing, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

// Extracted unchanged from the world and Today Egg hatch. Keep packs and Eggs
// on the same continuous rattle and radiance, rather than separate approximations.
export function eggHatchRattle() {
  return withRepeat(withSequence(
    withTiming(1, { duration: 62, easing: Easing.linear }),
    withTiming(-1, { duration: 62, easing: Easing.linear }),
  ), -1, true);
}
export function eggHatchPulse(reduced: boolean) {
  return withRepeat(withTiming(1, { duration: reduced ? 240 : 720, easing: Easing.out(Easing.cubic) }), -1, false);
}
export const EGG_HATCH_SHAKE_X = 7;
export const EGG_HATCH_SHAKE_ROTATION = 5.6;
