import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect } from 'react';
import { StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { AppFontFamilies } from '@/constants/theme';
import type {
  HavenTileUpgradePresentation,
  HavenUpgradePresentationPhase,
} from '@/utils/haven-upgrade-presentation';

const COIN_ART = require('../../../assets/images/katchimeras/merge-world/ui/coin.webp');
const COIN_SIZE = 34;

const COIN_VECTORS = [
  { arc: -66, delay: 0, offsetX: -24, offsetY: -22 },
  { arc: -82, delay: 55, offsetX: -11, offsetY: -34 },
  { arc: -92, delay: 110, offsetX: 0, offsetY: -38 },
  { arc: -78, delay: 165, offsetX: 13, offsetY: -32 },
  { arc: -62, delay: 220, offsetX: 26, offsetY: -20 },
] as const;

function random01(index: number, salt: number) {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43_758.5453;
  return value - Math.floor(value);
}

function silhouetteWidthAt(y: number) {
  if (y < 0.18) return 0.58 + (y / 0.18) * 0.34;
  if (y < 0.58) return 0.92;
  return Math.max(0.18, 0.92 - ((y - 0.58) / 0.42) * 0.74);
}

const RISING_PARTICLES = Array.from({ length: 34 }, (_, index) => {
  const y = 0.14 + random01(index, 2) * 0.78;
  const width = silhouetteWidthAt(y);
  return {
    delay: Math.round(random01(index, 3) * 340),
    drift: (random01(index, 4) - 0.5) * 38,
    duration: 760 + Math.round(random01(index, 5) * 500),
    leaf: index % 5 === 0,
    rotation: Math.round(random01(index, 6) * 180),
    size: 4 + Math.round(random01(index, 7) * 6),
    travel: 72 + Math.round(random01(index, 8) * 108),
    x: 0.5 + (random01(index, 1) - 0.5) * width,
    y,
  };
});

const LIGHT_RAYS = [
  { x: 0.13, width: 12, tilt: -5, height: 0.58 },
  { x: 0.27, width: 18, tilt: -3, height: 0.78 },
  { x: 0.4, width: 11, tilt: 2, height: 0.68 },
  { x: 0.51, width: 22, tilt: 0, height: 0.88 },
  { x: 0.64, width: 13, tilt: -2, height: 0.72 },
  { x: 0.76, width: 17, tilt: 4, height: 0.8 },
  { x: 0.88, width: 10, tilt: 5, height: 0.56 },
] as const;

type EffectRect = { height: number; left: number; top: number; width: number };

type Props = {
  area: EffectRect;
  phase: HavenUpgradePresentationPhase;
  presentation: HavenTileUpgradePresentation;
  reducedMotion: boolean;
  silhouetteFrame: EffectRect;
  silhouetteSource: ImageSourcePropType;
  target: { x: number; y: number };
  showCoins?: boolean;
  showReaction?: boolean;
};

export const HavenUpgradeEffects = memo(function HavenUpgradeEffects({
  area,
  phase,
  presentation,
  reducedMotion,
  silhouetteFrame,
  silhouetteSource,
  target,
  showCoins: coinsEnabled = true,
  showReaction: reactionEnabled = true,
}: Props) {
  const cover = useSharedValue(0);
  const reveal = useSharedValue(0);

  useEffect(() => {
    if (phase === 'cover') cover.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
    if (phase === 'reveal') reveal.value = withTiming(1, { duration: reducedMotion ? 180 : 520, easing: Easing.out(Easing.cubic) });
    if (phase === 'react' || phase === 'complete') cover.value = withTiming(0, { duration: reducedMotion ? 80 : 340, easing: Easing.out(Easing.cubic) });
    return () => {
      cancelAnimation(cover);
      cancelAnimation(reveal);
    };
  }, [cover, phase, reducedMotion, reveal]);

  const silhouetteStyle = useAnimatedStyle(() => ({
    opacity: cover.value * interpolate(reveal.value, [0, 0.22, 1], [0.28, 0.2, 0]),
    transform: [{ translateY: interpolate(reveal.value, [0, 1], [5, -10]) }],
  }));
  const raysStyle = useAnimatedStyle(() => ({
    opacity: cover.value * interpolate(reveal.value, [0, 0.55, 1], [0.56, 0.3, 0]),
    transform: [{ translateY: interpolate(reveal.value, [0, 1], [18, -22]) }],
  }));

  const showCoins = coinsEnabled && !reducedMotion && (phase === 'payment' || phase === 'cover');
  const showEnergy = !reducedMotion && ['cover', 'reveal', 'react'].includes(phase);
  const showReaction = reactionEnabled && (phase === 'react' || phase === 'complete');

  return (
    <View accessibilityElementsHidden pointerEvents="auto" style={StyleSheet.absoluteFill}>
      {showCoins ? COIN_VECTORS.map((vector, index) => (
        <UpgradeCoin from={presentation.coinOrigin} index={index} key={`${presentation.nonce}:coin:${index}`} target={target} vector={vector} />
      )) : null}

      {showEnergy ? (
        <>
          <Animated.View pointerEvents="none" style={[styles.silhouette, silhouetteFrame, silhouetteStyle]}>
            <Image contentFit="contain" source={silhouetteSource} style={StyleSheet.absoluteFill} tintColor={presentation.palette.glow} transition={0} />
          </Animated.View>
          <View pointerEvents="none" style={[styles.energyArea, area]}>
            <Animated.View style={[StyleSheet.absoluteFill, raysStyle]}>
              {LIGHT_RAYS.map((ray, index) => (
                <View key={`${presentation.nonce}:ray:${index}`} style={[styles.ray, {
                  height: area.height * ray.height,
                  left: area.width * ray.x - ray.width / 2,
                  transform: [{ rotateZ: `${ray.tilt}deg` }],
                  width: ray.width,
                }]}>
                  <LinearGradient colors={['transparent', presentation.palette.accent, 'transparent']} locations={[0, 0.6, 1]} style={StyleSheet.absoluteFill} />
                </View>
              ))}
            </Animated.View>
            {RISING_PARTICLES.map((particle, index) => (
              <RisingParticle key={`${presentation.nonce}:particle:${index}`} index={index} particle={particle} palette={presentation.palette} />
            ))}
            {[0.3, 0.5, 0.7].map((x, index) => (
              <RisingArrow accent={presentation.palette.accent} delay={index * 90} key={`${presentation.nonce}:arrow:${index}`} x={area.width * x} />
            ))}
          </View>
        </>
      ) : null}

      {showReaction ? (
        <Animated.View style={[styles.reaction, { left: Math.max(16, target.x - 112), top: Math.max(74, target.y - 148) }]}>
          <Text selectable style={styles.reactionText}>{presentation.reactionLine}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
});

function UpgradeCoin({ from, index, target, vector }: {
  from: { x: number; y: number };
  index: number;
  target: { x: number; y: number };
  vector: (typeof COIN_VECTORS)[number];
}) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(vector.delay, withTiming(1, { duration: 430, easing: Easing.inOut(Easing.cubic) }));
    return () => cancelAnimation(progress);
  }, [progress, vector.delay]);
  const style = useAnimatedStyle(() => {
    const value = progress.value;
    const inverse = 1 - value;
    const startX = from.x + vector.offsetX;
    const startY = from.y + vector.offsetY;
    const controlX = (startX + target.x) / 2 + (index % 2 === 0 ? -24 : 24);
    const controlY = Math.min(startY, target.y) + vector.arc;
    const x = inverse * inverse * startX + 2 * inverse * value * controlX + value * value * target.x;
    const y = inverse * inverse * startY + 2 * inverse * value * controlY + value * value * target.y;
    return {
      opacity: value < 0.9 ? 1 : Math.max(0, (1 - value) / 0.1),
      transform: [
        { translateX: x - COIN_SIZE / 2 },
        { translateY: y - COIN_SIZE / 2 },
        { rotateZ: `${interpolate(value, [0, 1], [index * -9, index * 34 + 120])}deg` },
        { scale: interpolate(value, [0, 0.75, 1], [0.82, 1.05, 0.34]) },
      ],
    };
  }, [from.x, from.y, index, target.x, target.y, vector.arc, vector.offsetX, vector.offsetY]);
  return <Animated.View style={[styles.coin, style]}><Image contentFit="contain" source={COIN_ART} style={StyleSheet.absoluteFill} transition={0} /></Animated.View>;
}

function RisingParticle({ index, palette, particle }: {
  index: number;
  palette: HavenTileUpgradePresentation['palette'];
  particle: (typeof RISING_PARTICLES)[number];
}) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(particle.delay, withTiming(1, { duration: particle.duration, easing: Easing.out(Easing.quad) }));
    return () => cancelAnimation(progress);
  }, [particle.delay, particle.duration, progress]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.12, 0.72, 1], [0, 1, 0.78, 0]),
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [0, particle.drift]) },
      { translateY: interpolate(progress.value, [0, 1], [0, -particle.travel]) },
      { rotateZ: `${particle.rotation + interpolate(progress.value, [0, 1], [0, index % 2 ? 100 : -100])}deg` },
      { scale: interpolate(progress.value, [0, 0.18, 1], [0.45, 1, 0.62]) },
    ],
  }));
  const color = index % 3 === 0 ? palette.accent : index % 3 === 1 ? palette.glow : palette.primary;
  return <Animated.View style={[
    particle.leaf ? styles.leafParticle : styles.emberParticle,
    {
      backgroundColor: color,
      height: particle.leaf ? particle.size * 1.7 : particle.size,
      left: `${particle.x * 100}%`,
      top: `${particle.y * 100}%`,
      width: particle.size,
    },
    style,
  ]} />;
}

function RisingArrow({ accent, delay, x }: { accent: string; delay: number; x: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration: 760, easing: Easing.out(Easing.cubic) }));
    return () => cancelAnimation(progress);
  }, [delay, progress]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.18, 0.72, 1], [0, 0.9, 0.7, 0]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [22, -30]) },
      { scale: interpolate(progress.value, [0, 0.25, 1], [0.72, 1, 0.9]) },
    ],
  }));
  return <Animated.Text style={[styles.upArrow, { color: accent, left: x - 14 }, style]}>↑</Animated.Text>;
}

const styles = StyleSheet.create({
  coin: { height: COIN_SIZE, left: 0, position: 'absolute', top: 0, width: COIN_SIZE, zIndex: 5 },
  emberParticle: { borderRadius: 999, boxShadow: '0 0 8px rgba(255,239,153,0.92)', position: 'absolute' },
  energyArea: { overflow: 'visible', position: 'absolute' },
  leafParticle: { borderBottomLeftRadius: 8, borderTopRightRadius: 8, boxShadow: '0 0 7px rgba(184,242,116,0.72)', position: 'absolute' },
  ray: { bottom: 0, opacity: 0.46, overflow: 'hidden', position: 'absolute' },
  reaction: {
    backgroundColor: 'rgba(31,34,34,0.94)',
    borderColor: 'rgba(255,255,255,0.28)',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    boxShadow: '0 8px 20px rgba(17,28,20,0.3)',
    maxWidth: 224,
    paddingHorizontal: 16,
    paddingVertical: 11,
    position: 'absolute',
  },
  reactionText: { color: '#FFF9DF', fontFamily: AppFontFamilies.manrope, fontSize: 14, fontWeight: '800', lineHeight: 19, textAlign: 'center' },
  silhouette: { position: 'absolute' },
  upArrow: { fontFamily: AppFontFamilies.manrope, fontSize: 25, fontWeight: '900', position: 'absolute', textAlign: 'center', top: -5, width: 28 },
});
