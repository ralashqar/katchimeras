import { cancelAnimation, Easing, type SharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';

/** Katchimeras LanternEgg answer absorption, shared verbatim with combat firing. */
export function runEggFeedMotion(absorb: SharedValue<number>, shake: SharedValue<number>, ripple: SharedValue<number>, reduced = false) {
  [absorb, shake, ripple].forEach(cancelAnimation);
  absorb.value = withSequence(
    withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) }),
    withTiming(0, { duration: 680, easing: Easing.out(Easing.cubic) }),
  );
  shake.value = 0;
  if (!reduced) shake.value = withSequence(
    withTiming(1, { duration: 55, easing: Easing.linear }),
    withTiming(-1, { duration: 55, easing: Easing.linear }),
    withTiming(1, { duration: 55, easing: Easing.linear }),
    withTiming(-1, { duration: 55, easing: Easing.linear }),
    withTiming(.5, { duration: 55, easing: Easing.linear }),
    withTiming(0, { duration: 70, easing: Easing.out(Easing.cubic) }),
  );
  ripple.value = 0;
  ripple.value = withDelay(160, withTiming(1, { duration: 720, easing: Easing.out(Easing.cubic) }));
}
