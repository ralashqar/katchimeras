import { useEffect } from 'react';
import type { StyleProp, ViewProps, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

type MotionValues = {
  opacity?: number;
  scale?: number;
  scaleY?: number;
  translateX?: number;
  translateY?: number;
};

type MotionTransition = {
  type?: 'timing' | 'spring';
  duration?: number;
  delay?: number;
  loop?: boolean;
  damping?: number;
  stiffness?: number;
  mass?: number;
};

type MotionViewProps = ViewProps & {
  animate: MotionValues;
  from?: MotionValues;
  style?: StyleProp<ViewStyle>;
  transition?: MotionTransition;
};

// Small Reanimated-native replacement for the subset of MotiView used by the
// app. Keeping this local avoids evaluating Moti's deprecated React Native
// SafeAreaView re-export merely to animate a View.
export function MotionView({ animate, from, transition, style, ...props }: MotionViewProps) {
  const opacity = useSharedValue(from?.opacity ?? animate.opacity ?? 1);
  const scale = useSharedValue(from?.scale ?? animate.scale ?? 1);
  const scaleY = useSharedValue(from?.scaleY ?? animate.scaleY ?? 1);
  const translateX = useSharedValue(from?.translateX ?? animate.translateX ?? 0);
  const translateY = useSharedValue(from?.translateY ?? animate.translateY ?? 0);

  const hasOpacity = from?.opacity != null || animate.opacity != null;
  const hasScale = from?.scale != null || animate.scale != null;
  const hasScaleY = from?.scaleY != null || animate.scaleY != null;
  const hasTranslateX = from?.translateX != null || animate.translateX != null;
  const hasTranslateY = from?.translateY != null || animate.translateY != null;
  const type = transition?.type ?? 'timing';
  const duration = transition?.duration ?? 300;
  const delay = transition?.delay ?? 0;
  const loop = transition?.loop ?? false;
  const damping = transition?.damping ?? 14;
  const stiffness = transition?.stiffness ?? 160;
  const mass = transition?.mass ?? 1;

  useEffect(() => {
    const animation = (value: number) => {
      const base = type === 'spring'
        ? withSpring(value, { damping, mass, stiffness })
        : withTiming(value, { duration });
      const repeated = loop ? withRepeat(base, -1, true) : base;
      return delay > 0 ? withDelay(delay, repeated) : repeated;
    };
    if (animate.opacity != null) opacity.value = animation(animate.opacity);
    if (animate.scale != null) scale.value = animation(animate.scale);
    if (animate.scaleY != null) scaleY.value = animation(animate.scaleY);
    if (animate.translateX != null) translateX.value = animation(animate.translateX);
    if (animate.translateY != null) translateY.value = animation(animate.translateY);
  }, [animate.opacity, animate.scale, animate.scaleY, animate.translateX, animate.translateY, damping, delay, duration, loop, mass, opacity, scale, scaleY, stiffness, translateX, translateY, type]);

  const motionStyle = useAnimatedStyle(() => ({
    opacity: hasOpacity ? opacity.value : undefined,
    transform: [
      ...(hasTranslateX ? [{ translateX: translateX.value }] : []),
      ...(hasTranslateY ? [{ translateY: translateY.value }] : []),
      ...(hasScale ? [{ scale: scale.value }] : []),
      ...(hasScaleY ? [{ scaleY: scaleY.value }] : []),
    ],
  }));

  return <Animated.View {...props} style={[style, motionStyle]} />;
}
