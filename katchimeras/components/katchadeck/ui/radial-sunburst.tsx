import { Image } from 'expo-image';
import { memo, useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const RADIAL_SUNBURST_ART = require('../../../assets/images/katchimeras/ui/radial-sunburst.png');
const SUNBURST_NATIVE_SURFACE_SCALE = 2;

export const RotatingRadialSunburst = memo(function RotatingRadialSunburst({
  baseOpacity = 0.76,
  nativeSurfaceScale = SUNBURST_NATIVE_SURFACE_SCALE,
  rotationDurationMs = 32_000,
  size,
  style,
}: {
  baseOpacity?: number;
  /** Set to 1 when the sunburst already lives inside an oversized native
   * surface that is counter-scaled by its parent. */
  nativeSurfaceScale?: number;
  rotationDurationMs?: number;
  size: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReducedMotion();
  const rotation = useSharedValue(0);
  const breath = useSharedValue(reduceMotion ? 0.45 : 0);
  const resolvedNativeSurfaceScale = Math.max(1, nativeSurfaceScale);
  const nativeSize = size * resolvedNativeSurfaceScale;

  useEffect(() => {
    cancelAnimation(rotation);
    cancelAnimation(breath);
    if (reduceMotion) {
      rotation.value = 0;
      breath.value = 0.45;
      return;
    }
    rotation.value = withRepeat(
      withTiming(1, { duration: rotationDurationMs, easing: Easing.linear }),
      -1,
      false,
    );
    breath.value = withRepeat(
      withTiming(1, { duration: 2_800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(rotation);
      cancelAnimation(breath);
    };
  }, [breath, reduceMotion, rotation, rotationDurationMs]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, baseOpacity + breath.value * 0.1),
    transform: [
      { rotate: `${rotation.value * 360}deg` },
      { scale: (0.985 + breath.value * 0.03) / resolvedNativeSurfaceScale },
    ],
  }), [baseOpacity, resolvedNativeSurfaceScale]);

  return (
    <View pointerEvents="none" style={[styles.viewport, { height: size, width: size }, style]}>
      <Animated.View
        collapsable={false}
        renderToHardwareTextureAndroid={false}
        shouldRasterizeIOS={false}
        style={[
          styles.field,
          {
            height: nativeSize,
            left: (size - nativeSize) / 2,
            top: (size - nativeSize) / 2,
            width: nativeSize,
          },
          animatedStyle,
        ]}>
        <Image
          accessibilityIgnoresInvertColors
          allowDownscaling={false}
          cachePolicy="memory"
          contentFit="contain"
          recyclingKey="radial-sunburst"
          source={RADIAL_SUNBURST_ART}
          style={StyleSheet.absoluteFill}
          transition={0}
        />
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  viewport: { overflow: 'visible', position: 'absolute' },
  field: { position: 'absolute' },
});
