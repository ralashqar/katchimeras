import { useEffect } from 'react';
import { Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Meadow } from '@/constants/meadow-theme';

import type { GoalTaskSourceRect } from './goal-task-row';

type ParticleSpec = {
  color: string;
  delay: number;
  dx: number;
  dy: number;
  round?: boolean;
  size: number;
  spin: number;
};

const PARTICLES: ParticleSpec[] = [
  { color: '#F2C14E', delay: 0.00, dx: -142, dy: -176, size: 9, spin: -280 },
  { color: '#73A85B', delay: 0.03, dx: -92, dy: -210, round: true, size: 8, spin: 190 },
  { color: '#EF8354', delay: 0.06, dx: -38, dy: -186, size: 11, spin: 330 },
  { color: '#6DB6C8', delay: 0.02, dx: 24, dy: -224, round: true, size: 8, spin: -220 },
  { color: '#E879A5', delay: 0.08, dx: 82, dy: -194, size: 10, spin: 310 },
  { color: '#F5D887', delay: 0.04, dx: 138, dy: -158, size: 8, spin: -260 },
  { color: '#79A967', delay: 0.10, dx: -164, dy: -92, round: true, size: 10, spin: 180 },
  { color: '#E879A5', delay: 0.01, dx: 164, dy: -74, round: true, size: 9, spin: -170 },
  { color: '#6DB6C8', delay: 0.13, dx: -132, dy: 16, size: 9, spin: 260 },
  { color: '#EF8354', delay: 0.07, dx: 144, dy: 28, size: 11, spin: -300 },
  { color: '#F2C14E', delay: 0.04, dx: -74, dy: 64, round: true, size: 8, spin: 220 },
  { color: '#73A85B', delay: 0.11, dx: 76, dy: 72, size: 9, spin: -230 },
  { color: '#F5D887', delay: 0.02, dx: -18, dy: -142, size: 7, spin: 280 },
  { color: '#E879A5', delay: 0.09, dx: 42, dy: -116, round: true, size: 7, spin: -190 },
  { color: '#EF8354', delay: 0.14, dx: -106, dy: -132, size: 7, spin: 250 },
  { color: '#6DB6C8', delay: 0.06, dx: 112, dy: -126, size: 8, spin: -270 },
];

export function GoalCompletionCelebration({
  embedded = false,
  reducedMotion,
  source,
}: {
  embedded?: boolean;
  reducedMotion: boolean;
  source: GoalTaskSourceRect | null;
}) {
  const { height, width } = useWindowDimensions();
  const progress = useSharedValue(0);
  const originX = source ? source.x + source.width / 2 : width / 2;
  const originY = source ? source.y + source.height / 2 : height * 0.48;

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: reducedMotion ? 220 : 900,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, reducedMotion]);

  const celebration = (
    <View pointerEvents="none" style={styles.screen}>
      <CelebrationHalo originX={originX} originY={originY} progress={progress} reducedMotion={reducedMotion} />
      {reducedMotion ? null : PARTICLES.map((particle, index) => (
        <CelebrationParticle
          key={`${particle.color}-${index}`}
          originX={originX}
          originY={originY}
          particle={particle}
          progress={progress}
        />
      ))}
    </View>
  );

  if (embedded) return celebration;

  return (
    <Modal
      animationType="none"
      navigationBarTranslucent
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible>
      {celebration}
    </Modal>
  );
}

function CelebrationHalo({
  originX,
  originY,
  progress,
  reducedMotion,
}: {
  originX: number;
  originY: number;
  progress: SharedValue<number>;
  reducedMotion: boolean;
}) {
  const haloStyle = useAnimatedStyle(() => ({
    opacity: reducedMotion
      ? interpolate(progress.value, [0, 0.2, 1], [0, 0.65, 0], Extrapolation.CLAMP)
      : interpolate(progress.value, [0, 0.12, 0.72], [0, 0.9, 0], Extrapolation.CLAMP),
    transform: [{ scale: reducedMotion ? 1 : interpolate(progress.value, [0, 1], [0.35, 2.3]) }],
  }));
  const badgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.1, 0.72, 1], [0, 1, 1, 0], Extrapolation.CLAMP),
    transform: [{ scale: reducedMotion ? 1 : interpolate(progress.value, [0, 0.18, 1], [0.45, 1.1, 0.92], Extrapolation.CLAMP) }],
  }));

  return (
    <>
      <Animated.View style={[styles.halo, { left: originX - 34, top: originY - 34 }, haloStyle]} />
      <Animated.View style={[styles.successBadge, { left: originX - 19, top: originY - 19 }, badgeStyle]}>
        <IconSymbol color="#FFF9E9" name="checkmark" size={20} />
      </Animated.View>
    </>
  );
}

function CelebrationParticle({
  originX,
  originY,
  particle,
  progress,
}: {
  originX: number;
  originY: number;
  particle: ParticleSpec;
  progress: SharedValue<number>;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const localProgress = interpolate(
      progress.value,
      [particle.delay, 1],
      [0, 1],
      Extrapolation.CLAMP,
    );
    const fall = interpolate(localProgress, [0, 0.65, 1], [0, 0, 72], Extrapolation.CLAMP);
    return {
      opacity: interpolate(localProgress, [0, 0.08, 0.76, 1], [0, 1, 1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: particle.dx * localProgress },
        { translateY: particle.dy * localProgress + fall },
        { rotate: `${particle.spin * localProgress}deg` },
        { scale: interpolate(localProgress, [0, 0.12, 1], [0.25, 1, 0.82], Extrapolation.CLAMP) },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          backgroundColor: particle.color,
          borderRadius: particle.round ? 999 : 2,
          height: particle.round ? particle.size : particle.size * 1.7,
          left: originX - particle.size / 2,
          top: originY - particle.size / 2,
          width: particle.size,
        },
        animatedStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFillObject },
  halo: {
    backgroundColor: 'rgba(245, 216, 135, 0.24)',
    borderColor: 'rgba(242, 193, 78, 0.92)',
    borderRadius: 999,
    borderWidth: 2,
    height: 68,
    position: 'absolute',
    width: 68,
  },
  successBadge: {
    alignItems: 'center',
    backgroundColor: Meadow.leafDeep,
    borderColor: '#FFF3C4',
    borderRadius: 999,
    borderWidth: 2,
    height: 38,
    justifyContent: 'center',
    position: 'absolute',
    shadowColor: '#7A5A17',
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
    width: 38,
  },
  particle: { position: 'absolute' },
});
