import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Position follows world coordinates; panel typography stays in screen units. */
export function WorldUpgradeAnchor({ frame, cameraScale, cameraX, cameraY, sceneWidth, sceneHeight, viewportWidth, viewportHeight, moving, children }: {
  frame: { left: number; top: number; width: number; height: number };
  cameraScale: SharedValue<number>; cameraX: SharedValue<number>; cameraY: SharedValue<number>;
  sceneWidth: number; sceneHeight: number; viewportWidth: number; viewportHeight: number;
  moving: boolean; children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const width = Math.min(336, viewportWidth - 24);
  // Reserve the navigation/currency chrome as well as the device safe area.
  // The explicit available bounds let the panel measure its natural content
  // height without moving the top edge or exceeding the screen bottom.
  const topBoundary = insets.top + 80;
  const availableHeight = Math.max(1, viewportHeight - topBoundary - insets.bottom - 20);
  const referenceHeight = Math.min(480, availableHeight);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (moving || ready) return;
    const timer = setTimeout(() => setReady(true), 160);
    return () => clearTimeout(timer);
  }, [moving, ready]);
  const position = useAnimatedStyle(() => {
    const x = sceneWidth / 2 + cameraX.value + (frame.left + frame.width / 2 - sceneWidth / 2) * cameraScale.value;
    const y = sceneHeight / 2 + cameraY.value + (frame.top + frame.height * 0.48 - sceneHeight / 2) * cameraScale.value;
    // Position uses the original reference height, never the changing content height.
    const top = Math.max(topBoundary, Math.min(viewportHeight - insets.bottom - referenceHeight - 20, y - referenceHeight * 0.75));
    return { height: Math.max(1, viewportHeight - insets.bottom - 20 - top), transform: [
      { translateX: Math.max(12, Math.min(viewportWidth - width - 12, x - width / 2)) },
      { translateY: top },
    ] };
  });
  return ready ? <Animated.View pointerEvents="box-none" style={[styles.anchor, { width, height: availableHeight }, position]}>{children}</Animated.View> : null;
}
const styles = StyleSheet.create({ anchor: { position: 'absolute', left: 0, top: 0, zIndex: 32 } });
