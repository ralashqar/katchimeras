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
  const maxHeight = Math.max(120, viewportHeight - insets.top - insets.bottom - 32);
  const [height, setHeight] = useState(360);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (moving || ready) return;
    const timer = setTimeout(() => setReady(true), 160);
    return () => clearTimeout(timer);
  }, [moving, ready]);
  const position = useAnimatedStyle(() => {
    const x = sceneWidth / 2 + cameraX.value + (frame.left + frame.width / 2 - sceneWidth / 2) * cameraScale.value;
    const y = sceneHeight / 2 + cameraY.value + (frame.top + frame.height * 0.48 - sceneHeight / 2) * cameraScale.value;
    return { transform: [
      { translateX: Math.max(12, Math.min(viewportWidth - width - 12, x - width / 2)) },
      { translateY: Math.max(insets.top + 12, Math.min(viewportHeight - insets.bottom - height - 12, y - height * 0.75)) },
    ] };
  });
  return ready ? <Animated.View onLayout={(event) => setHeight(event.nativeEvent.layout.height)} style={[styles.anchor, { width, maxHeight }, position]}>{children}</Animated.View> : null;
}
const styles = StyleSheet.create({ anchor: { position: 'absolute', left: 0, top: 0, zIndex: 32 } });
