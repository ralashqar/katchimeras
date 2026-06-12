import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';

import { EggShell } from '@/components/katchadeck/home/egg-shell';
import type { EggVisualState } from '@/types/home';

type LanternEggProps = {
  egg: EggVisualState;
  onPress?: () => void;
  reactionKey?: number;
  crackStage?: 0 | 1 | 2;
};

const softGlow = require('../../../assets/images/katchimeras/soft-glow.png');
const softRing = require('../../../assets/images/katchimeras/soft-ring.png');

const AnimatedImage = Animated.createAnimatedComponent(Image);
const DRAG_LIMIT = 60;

// The Lantern egg stage. The egg artwork breathes over a pulsing tinted glow;
// tapping squeezes it and sends ripple rings out; dragging pulls it against a
// soft membrane ring that materializes under the finger and springs the shell
// back on release. (Feathered glow/ring are generated textures - RN views
// can't blur, so softness is baked into the asset and tinted per day.)
export function LanternEgg({ egg, onPress, reactionKey = 0, crackStage = 0 }: LanternEggProps) {
  const pressProgress = useSharedValue(0);
  const ripple = useSharedValue(1);
  const rippleEcho = useSharedValue(1);
  const pulse = useSharedValue(0);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const interactionEnergy = useSharedValue(0);
  const motion = {
    dragX,
    dragY,
    pressProgress,
    releaseVelocity: useSharedValue(0),
    interactionEnergy,
    glowLagX: useSharedValue(0),
    glowLagY: useSharedValue(0),
  };

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1900, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, [pulse]);

  const fireRipple = () => {
    ripple.value = 0;
    ripple.value = withTiming(1, { duration: 680, easing: Easing.out(Easing.cubic) });
    rippleEcho.value = 0;
    rippleEcho.value = withDelay(120, withTiming(1, { duration: 680, easing: Easing.out(Easing.cubic) }));
    onPress?.();
  };

  const tapGesture = Gesture.Tap()
    .maxDeltaX(12)
    .maxDeltaY(12)
    .onBegin(() => {
      pressProgress.value = withTiming(1, { duration: 140, easing: Easing.out(Easing.cubic) });
    })
    .onFinalize(() => {
      pressProgress.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) });
    })
    .onEnd(() => {
      runOnJS(fireRipple)();
    });

  const panGesture = Gesture.Pan()
    .minDistance(10)
    .onBegin(() => {
      pressProgress.value = withTiming(1, { duration: 140, easing: Easing.out(Easing.cubic) });
    })
    .onUpdate((event) => {
      const clampedX = Math.max(-DRAG_LIMIT, Math.min(DRAG_LIMIT, event.translationX * 0.55));
      const clampedY = Math.max(-DRAG_LIMIT, Math.min(DRAG_LIMIT, event.translationY * 0.55));
      dragX.value = clampedX;
      dragY.value = clampedY;
      interactionEnergy.value = Math.min(1, Math.hypot(clampedX, clampedY) / DRAG_LIMIT);
    })
    .onEnd((event) => {
      dragX.value = withSpring(0, { damping: 11, stiffness: 220, velocity: event.velocityX * 0.4 });
      dragY.value = withSpring(0, { damping: 11, stiffness: 220, velocity: event.velocityY * 0.4 });
      interactionEnergy.value = withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) });
    })
    .onFinalize(() => {
      pressProgress.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) });
    });

  const gesture = Gesture.Exclusive(panGesture, tapGesture);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.34 + pulse.value * 0.22 + pressProgress.value * 0.16 + interactionEnergy.value * 0.18,
    transform: [
      { translateX: dragX.value * 0.3 },
      { translateY: dragY.value * 0.3 },
      { scale: 0.94 + pulse.value * 0.1 + interactionEnergy.value * 0.08 },
    ],
  }));

  const membraneStyle = useAnimatedStyle(() => {
    const magnitude = Math.min(1, Math.hypot(dragX.value, dragY.value) / DRAG_LIMIT);
    return {
      opacity: pressProgress.value * 0.22 + magnitude * 0.45,
      transform: [
        { translateX: dragX.value * 0.55 },
        { translateY: dragY.value * 0.55 },
        { scaleX: 1 + Math.abs(dragX.value) / 260 + pressProgress.value * 0.02 },
        { scaleY: 1 + Math.abs(dragY.value) / 260 + pressProgress.value * 0.02 },
      ],
    };
  });

  const rippleStyle = useAnimatedStyle(() => ({
    opacity: (1 - ripple.value) * 0.55,
    transform: [{ scale: 0.62 + ripple.value * 0.85 }],
  }));

  const rippleEchoStyle = useAnimatedStyle(() => ({
    opacity: (1 - rippleEcho.value) * 0.35,
    transform: [{ scale: 0.55 + rippleEcho.value * 1.0 }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.stage}>
        <AnimatedImage
          contentFit="contain"
          pointerEvents="none"
          source={softGlow}
          style={[styles.glow, glowStyle]}
          tintColor={egg.haloColor}
          transition={0}
        />
        <AnimatedImage
          contentFit="contain"
          pointerEvents="none"
          source={softRing}
          style={[styles.membrane, membraneStyle]}
          tintColor={egg.accentColor}
          transition={0}
        />
        <AnimatedImage
          contentFit="contain"
          pointerEvents="none"
          source={softRing}
          style={[styles.membrane, rippleStyle]}
          tintColor={egg.accentColor}
          transition={0}
        />
        <AnimatedImage
          contentFit="contain"
          pointerEvents="none"
          source={softRing}
          style={[styles.membrane, rippleEchoStyle]}
          tintColor={egg.coreColor}
          transition={0}
        />
        <Animated.View style={styles.lift}>
          <EggShell crackStage={crackStage} egg={egg} motion={motion} reactionKey={reactionKey} />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: 'center',
    height: 258,
    justifyContent: 'center',
    width: '100%',
  },
  glow: {
    height: 330,
    position: 'absolute',
    top: -42,
    width: 330,
  },
  membrane: {
    height: 286,
    position: 'absolute',
    top: -20,
    width: 286,
  },
  lift: {
    transform: [{ translateY: -10 }, { scale: 1.08 }],
  },
});
