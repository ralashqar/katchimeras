import { useCallback } from 'react';
import { Easing, type LayoutAnimationFunction, useReducedMotion, withTiming } from 'react-native-reanimated';

/** Resize the anchored tray as rows disappear, separately from horizontal navigation. */
export function useCompanionStackLayout(screenAnchored = false) {
  const reduceMotion = useReducedMotion();
  return useCallback<LayoutAnimationFunction>((values) => {
    'worklet';
    // Match the action rows' 300 ms settle. A bottom-aligned ancestor may move
    // without changing this frame's local origin, so preserve its screen Y too.
    const options = { duration: reduceMotion ? 100 : 300, easing: Easing.inOut(Easing.cubic) };
    return {
      initialValues: {
        originX: values.currentOriginX,
        originY: screenAnchored
          ? values.targetOriginY + values.currentGlobalOriginY - values.targetGlobalOriginY
          : values.currentOriginY,
        width: values.currentWidth,
        height: values.currentHeight,
      },
      animations: {
        originX: withTiming(values.targetOriginX, options),
        originY: withTiming(values.targetOriginY, options),
        width: withTiming(values.targetWidth, options),
        height: withTiming(values.targetHeight, options),
      },
    };
  }, [reduceMotion, screenAnchored]);
}
