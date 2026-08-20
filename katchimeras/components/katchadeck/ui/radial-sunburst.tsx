import { Image } from 'expo-image';
import { memo, useEffect } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
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

export const RotatingRadialSunburst = memo(function RotatingRadialSunburst({
  baseOpacity = 0.76,
  rotationDurationMs = 32_000,
  size,
  style,
}: {
  baseOpacity?: number;
  rotationDurationMs?: number;
  size: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReducedMotion();
  const rotation = useSharedValue(0);
  const breath = useSharedValue(reduceMotion ? 0.45 : 0);

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
      { scale: 0.985 + breath.value * 0.03 },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      renderToHardwareTextureAndroid
      shouldRasterizeIOS
      style={[styles.field, { height: size, width: size }, style, animatedStyle]}>
      <Image
        accessibilityIgnoresInvertColors
        allowDownscaling
        cachePolicy="memory"
        contentFit="contain"
        recyclingKey="radial-sunburst"
        source={RADIAL_SUNBURST_ART}
        style={StyleSheet.absoluteFill}
        transition={0}
      />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  field: { position: 'absolute' },
});
