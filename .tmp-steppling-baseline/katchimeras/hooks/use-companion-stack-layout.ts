import { useCallback, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

/** Hold the tray footprint across row removal, then shrink it on the UI thread. */
export function useCompanionStackLayout() {
  const reduceMotion = useReducedMotion();
  const [measured, setMeasured] = useState(false);
  const previous = useRef<{ width: number; height: number } | null>(null);
  const height = useSharedValue(0);
  const onContentLayout = useCallback((event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout;
    const before = previous.current;
    if (before?.width === next.width && before.height === next.height) return;
    previous.current = { width: next.width, height: next.height };
    // First presentation, dismissal and orientation changes should not resize
    // into view. Subsequent content changes retain their old footprint first.
    const animate = before && before.width === next.width && before.height > 0 && next.height > 0;
    height.value = animate ? withTiming(next.height, {
      duration: reduceMotion ? 100 : 300,
      easing: Easing.inOut(Easing.cubic),
    }) : next.height;
    setMeasured(true);
  }, [height, reduceMotion]);
  const frameStyle = useAnimatedStyle(() => ({ height: measured ? height.value : undefined }), [measured]);
  return { measured, frameStyle, onContentLayout };
}
