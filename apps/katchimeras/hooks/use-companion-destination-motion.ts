import { useCallback, useLayoutEffect } from 'react';
import { useWindowDimensions } from 'react-native';
import { Easing, FadeIn, FadeOut, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

/** Matches the two-leg action submenu transition for ordinary destination pages. */
export function useCompanionDestinationMotion(direction: number) {
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const currentDirection = useSharedValue(direction > 0 ? 1 : -1);
  useLayoutEffect(() => { currentDirection.value = direction > 0 ? 1 : -1; }, [currentDirection, direction]);
  const distance = width + 32;
  const entering = useCallback(() => {
    'worklet';
    return { initialValues: { transform: [{ translateX: currentDirection.value * distance }] },
      animations: { transform: [{ translateX: withDelay(220, withTiming(0, { duration: 220, easing: Easing.inOut(Easing.quad) })) }] } };
  }, [currentDirection, distance]);
  const exiting = useCallback(() => {
    'worklet';
    return { initialValues: { transform: [{ translateX: 0 }] },
      animations: { transform: [{ translateX: withTiming(-currentDirection.value * distance, { duration: 220, easing: Easing.inOut(Easing.quad) }) }] } };
  }, [currentDirection, distance]);
  return { entering: reduced ? FadeIn.duration(100) : entering, exiting: reduced ? FadeOut.duration(100) : exiting };
}
