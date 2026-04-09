import { useEffect } from 'react';
import {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { KatchaDeckUI } from '@/constants/theme';

const motionEasing = Easing.bezier(0.22, 1, 0.36, 1);

export function presenceEnter(delay = 0) {
  return FadeInDown.duration(KatchaDeckUI.motion.base).delay(delay).easing(motionEasing);
}

export function presenceExit(delay = 0) {
  return FadeOutDown.duration(KatchaDeckUI.motion.quick).delay(delay).easing(motionEasing);
}

export function rewardEnter(delay = 0) {
  return FadeIn.duration(KatchaDeckUI.motion.slow).delay(delay).easing(motionEasing);
}

export function rewardExit(delay = 0) {
  return FadeOut.duration(KatchaDeckUI.motion.quick).delay(delay).easing(motionEasing);
}

export function useFloatingMotion(distance: number = KatchaDeckUI.motion.driftDistance, delay: number = 0) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-distance, {
            duration: 2200,
            easing: motionEasing,
          }),
          withTiming(distance, {
            duration: 2600,
            easing: motionEasing,
          })
        ),
        -1,
        true
      )
    );
  }, [delay, distance, translateY]);

  return useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
}

export function usePulseMotion(min: number = 0.9, max: number = 1.06, delay: number = 0) {
  const scale = useSharedValue(min);

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(max, {
            duration: 1800,
            easing: motionEasing,
          }),
          withTiming(min, {
            duration: 2100,
            easing: motionEasing,
          })
        ),
        -1,
        true
      )
    );
  }, [delay, max, min, scale]);

  return useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
}

export function usePressMotion() {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: 1 - pressed.value * 0.03 },
      { rotateX: `${pressed.value * 3.5}deg` },
      { rotateY: `${pressed.value * -4}deg` },
    ],
  }));

  return {
    animatedStyle,
    onPressIn: () => {
      pressed.value = withSpring(1, {
        damping: 18,
        stiffness: 280,
      });
    },
    onPressOut: () => {
      pressed.value = withSpring(0, {
        damping: 16,
        stiffness: 220,
      });
    },
  };
}
