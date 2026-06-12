import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';
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
  // 0 = whole shell, 1 = first glowing cracks, 2 = bursting. The stages are
  // generated edits of the same render, tight-cropped to a shared bounding
  // box so crossfades stay pixel-aligned.
  crackStage?: 0 | 1 | 2;
};

const eggBase = require('../../../assets/images/katchimeras/cutouts/egg-base.png');
const eggCrackOne = require('../../../assets/images/katchimeras/cutouts/egg-crack-1.png');
const eggCrackTwo = require('../../../assets/images/katchimeras/cutouts/egg-crack-2.png');

const AnimatedImage = Animated.createAnimatedComponent(Image);

export function EggShell({ egg, motion, reactionKey = 0, crackStage = 0 }: EggShellProps) {
  const breathe = useSharedValue(0);
  const reaction = useSharedValue(0);
  const shimmer = useSharedValue(egg.shimmer ? 1 : 0);
  const crackOne = useSharedValue(0);
  const crackTwo = useSharedValue(0);

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

  useEffect(() => {
    crackOne.value = withTiming(crackStage >= 1 ? 1 : 0, { duration: 360, easing: Easing.out(Easing.cubic) });
    crackTwo.value = withTiming(crackStage >= 2 ? 1 : 0, { duration: 320, easing: Easing.out(Easing.cubic) });
  }, [crackOne, crackTwo, crackStage]);

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
    opacity: 0.18 + breathe.value * 0.14 + motion.interactionEnergy.value * 0.3,
    transform: [
      { translateX: motion.glowLagX.value * 0.06 },
      { translateY: motion.glowLagY.value * 0.06 },
      { scale: 0.96 + breathe.value * 0.05 + motion.interactionEnergy.value * 0.08 },
    ],
  }));

  const crackOneStyle = useAnimatedStyle(() => ({
    opacity: crackOne.value * (1 - crackTwo.value * 0.65),
  }));

  const crackTwoStyle = useAnimatedStyle(() => ({
    opacity: crackTwo.value,
    transform: [{ scale: 1 + crackTwo.value * 0.02 }],
  }));

  // The aurora is baked into the artwork; this accent layer keeps the day's
  // own color identity and the moment-reaction pulses alive on top of it.
  const accentGlowStyle = useAnimatedStyle(() => ({
    opacity:
      0.14 +
      shimmer.value * 0.14 +
      egg.intensity * 0.1 +
      reaction.value * 0.22 +
      motion.pressProgress.value * 0.12 +
      motion.interactionEnergy.value * 0.12,
    transform: [
      { translateX: motion.glowLagX.value * 0.18 },
      { translateY: motion.glowLagY.value * 0.18 },
      { scale: 0.92 + egg.intensity * 0.12 + reaction.value * 0.08 },
    ],
  }));

  const sparkStyle = useAnimatedStyle(() => ({
    opacity: 0.6 + shimmer.value * 0.24 + motion.interactionEnergy.value * 0.16,
    transform: [
      { translateX: motion.glowLagX.value * 0.1 },
      { translateY: motion.glowLagY.value * 0.06 },
      { scale: 1 + motion.pressProgress.value * 0.08 },
    ],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.eggWrap, shellStyle]}>
      <Animated.View style={[styles.shellGlow, { backgroundColor: `${egg.accentColor}18` }, shellGlowStyle]} />
      <Image contentFit="contain" source={eggBase} style={styles.eggImage} transition={0} />
      <AnimatedImage contentFit="contain" source={eggCrackOne} style={[styles.eggImage, crackOneStyle]} transition={0} />
      <AnimatedImage contentFit="contain" source={eggCrackTwo} style={[styles.eggImage, crackTwoStyle]} transition={0} />
      <Animated.View style={[styles.accentGlow, { backgroundColor: egg.coreColor }, accentGlowStyle]} />
      <Animated.View style={[styles.spark, { backgroundColor: egg.accentColor }, sparkStyle]} />
      <Animated.View style={[styles.sparkSecondary, { backgroundColor: `${egg.coreColor}CC` }, sparkStyle]} />
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
  eggImage: {
    height: '100%',
    position: 'absolute',
    width: '112%',
  },
  accentGlow: {
    borderRadius: 999,
    height: 104,
    opacity: 0.2,
    width: 104,
  },
  spark: {
    borderRadius: 999,
    height: 12,
    position: 'absolute',
    right: 44,
    top: 46,
    width: 12,
  },
  sparkSecondary: {
    borderRadius: 999,
    bottom: 52,
    height: 8,
    left: 56,
    position: 'absolute',
    width: 8,
  },
});
