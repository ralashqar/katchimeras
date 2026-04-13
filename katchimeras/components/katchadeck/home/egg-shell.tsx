import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';

import type { EggVisualState } from '@/types/home';
import { KatchaDeckUI } from '@/constants/theme';

export type EggAuraMotionValues = {
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  pressProgress: SharedValue<number>;
  releaseVelocity: SharedValue<number>;
  interactionEnergy: SharedValue<number>;
  glowLagX: SharedValue<number>;
  glowLagY: SharedValue<number>;
};

type EggShellProps = {
  egg: EggVisualState;
  motion: EggAuraMotionValues;
  reactionKey?: number;
};

export function EggShell({ egg, motion, reactionKey = 0 }: EggShellProps) {
  const breathe = useSharedValue(0);
  const reaction = useSharedValue(0);
  const shimmer = useSharedValue(egg.shimmer ? 1 : 0);

  useEffect(() => {
    breathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, [breathe]);

  useEffect(() => {
    shimmer.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.18, { duration: 1800, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, [egg.shimmer, shimmer]);

  useEffect(() => {
    reaction.value = 0;
    reaction.value = withSequence(
      withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 520, easing: Easing.out(Easing.cubic) })
    );
  }, [reaction, reactionKey]);

  const shellStyle = useAnimatedStyle(() => {
    const energy = motion.interactionEnergy.value;
    const dragMagnitude = Math.min(1, Math.hypot(motion.dragX.value, motion.dragY.value) / 88);

    return {
      transform: [
        { translateX: motion.dragX.value * 0.14 },
        { translateY: motion.dragY.value * 0.14 },
        { scaleX: 1 + breathe.value * 0.04 + reaction.value * 0.06 + dragMagnitude * 0.03 },
        { scaleY: 1 + breathe.value * 0.04 + reaction.value * 0.06 - dragMagnitude * 0.018 + energy * 0.025 },
      ],
    };
  });

  const shellGlowStyle = useAnimatedStyle(() => ({
    opacity: 0.16 + breathe.value * 0.14 + motion.interactionEnergy.value * 0.3,
    transform: [
      { translateX: motion.glowLagX.value * 0.06 },
      { translateY: motion.glowLagY.value * 0.06 },
      { scale: 0.96 + breathe.value * 0.05 + motion.interactionEnergy.value * 0.08 },
    ],
  }));

  const coreStyle = useAnimatedStyle(() => ({
    opacity: 0.52 + shimmer.value * 0.34 + reaction.value * 0.16 + motion.pressProgress.value * 0.1,
    transform: [
      { translateX: motion.glowLagX.value * 0.18 },
      { translateY: motion.glowLagY.value * 0.18 },
      { scale: 0.9 + egg.intensity * 0.14 + reaction.value * 0.08 + motion.interactionEnergy.value * 0.12 },
    ],
  }));

  const swirlStyle = useAnimatedStyle(() => ({
    opacity: 0.18 + shimmer.value * 0.16 + motion.interactionEnergy.value * 0.08,
    transform: [
      { translateX: motion.glowLagX.value * 0.08 },
      { translateY: motion.glowLagY.value * 0.08 },
      { rotateZ: `${egg.swirl * 210 + reaction.value * 16 + motion.dragX.value * 0.06}deg` },
    ],
  }));

  const sparkStyle = useAnimatedStyle(() => ({
    opacity: 0.74 + motion.interactionEnergy.value * 0.2,
    transform: [
      { translateX: motion.glowLagX.value * 0.1 },
      { translateY: motion.glowLagY.value * 0.06 },
      { scale: 1 + motion.pressProgress.value * 0.08 },
    ],
  }));

  return (
    <Animated.View style={[styles.eggWrap, shellStyle]}>
      <Animated.View style={[styles.shellGlow, { backgroundColor: `${egg.accentColor}18` }, shellGlowStyle]} />
      <LinearGradient colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0)']} style={styles.eggSheen} />
      <View style={[styles.eggShell, { borderColor: `${egg.accentColor}9C` }]}>
        <Animated.View style={[styles.eggCore, { backgroundColor: egg.coreColor }, coreStyle]} />
        <Animated.View style={[styles.eggSwirl, { borderColor: `${egg.accentColor}80` }, swirlStyle]} />
        <Animated.View style={[styles.spark, { backgroundColor: egg.accentColor }, sparkStyle]} />
        <Animated.View style={[styles.sparkSecondary, { backgroundColor: `${egg.coreColor}CC` }, sparkStyle]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  eggWrap: {
    alignItems: 'center',
    height: 224,
    justifyContent: 'center',
    width: 186,
  },
  shellGlow: {
    borderRadius: 999,
    height: 182,
    position: 'absolute',
    width: 154,
  },
  eggShell: {
    alignItems: 'center',
    backgroundColor: 'rgba(10,14,24,0.96)',
    borderRadius: 120,
    borderWidth: 1.25,
    boxShadow: KatchaDeckUI.shadows.card,
    height: '100%',
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },
  eggSheen: {
    borderRadius: 999,
    height: 86,
    left: 24,
    opacity: 0.7,
    position: 'absolute',
    top: 26,
    width: 56,
    zIndex: 2,
  },
  eggCore: {
    borderRadius: 999,
    height: 96,
    width: 96,
  },
  eggSwirl: {
    borderRadius: 999,
    borderWidth: 2,
    height: 118,
    opacity: 0.44,
    position: 'absolute',
    transform: [{ rotateZ: '22deg' }],
    width: 88,
  },
  spark: {
    borderRadius: 999,
    height: 16,
    position: 'absolute',
    right: 42,
    top: 40,
    width: 16,
  },
  sparkSecondary: {
    borderRadius: 999,
    bottom: 46,
    height: 10,
    left: 52,
    position: 'absolute',
    width: 10,
  },
});
