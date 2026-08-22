import {
  cancelAnimation,
  Easing,
  type SharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

/** Canonical Today-style reaction used whenever reward tokens land on a character target. */
export function runRewardArrivalMotion(
  pulse: SharedValue<number>,
  shake: SharedValue<number>,
  reduceMotion: boolean,
) {
  cancelAnimation(pulse);
  cancelAnimation(shake);
  pulse.value = withSequence(
    withTiming(1, { duration: reduceMotion ? 70 : 110, easing: Easing.out(Easing.cubic) }),
    withTiming(0, { duration: reduceMotion ? 150 : 320, easing: Easing.out(Easing.cubic) }),
  );
  if (reduceMotion) {
    shake.value = 0;
    return;
  }
  shake.value = 0;
  shake.value = withSequence(
    withTiming(1, { duration: 75, easing: Easing.linear }),
    withTiming(-1, { duration: 80, easing: Easing.linear }),
    withTiming(0.72, { duration: 85, easing: Easing.linear }),
    withTiming(-0.42, { duration: 90, easing: Easing.linear }),
    withTiming(0, { duration: 130, easing: Easing.out(Easing.cubic) }),
  );
}
