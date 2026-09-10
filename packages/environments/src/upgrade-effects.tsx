import { Image } from 'expo-image';

import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';


import type { HavenUpgradePresentationPhase, HavenUpgradeEffectPalette } from './upgrade-presentation';

const COIN_SIZE = 34;

function random01(index: number, salt: number) {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43_758.5453;
  return value - Math.floor(value);
}

// The Glow leaves the top bar and has to cross most of the screen to reach a
// hex tile. A handful of coins reads as a token gesture over that distance, so
// this is a dense stream: launched close together, fanned out, each one landing
// on its own beat. Every landing must still fall inside the payment window
// below (`HAVEN_UPGRADE_TIMING.revealAtMs`) or the coin is cut mid-flight.
const COIN_COUNT = 12;
const COIN_LAUNCH_STAGGER_MS = 42;
const COIN_FLIGHT_MS = 430;

const COIN_VECTORS = Array.from({ length: COIN_COUNT }, (_, index) => {
  const spread = COIN_COUNT > 1 ? index / (COIN_COUNT - 1) - 0.5 : 0;
  return {
    arc: -58 - Math.round(random01(index, 11) * 48),
    delay: index * COIN_LAUNCH_STAGGER_MS,
    duration: COIN_FLIGHT_MS + Math.round(random01(index, 12) * 90),
    offsetX: Math.round(spread * 76 + (random01(index, 13) - 0.5) * 16),
    offsetY: -16 - Math.round(random01(index, 14) * 28),
    sway: Math.round((random01(index, 15) - 0.5) * 68),
  };
});

/**
 * One tick per coin seating in the tile. Landings this close together would
 * blur into a buzz, so beats under the minimum gap are dropped; the final coin
 * always keeps its beat and lands heavier than the rest.
 */
export const COIN_HAPTIC_MIN_GAP_MS = 46;
export const COIN_HAPTIC_BEATS = (() => {
  const landings = COIN_VECTORS.map((vector) => vector.delay + vector.duration).sort((a, b) => a - b);
  const last = landings[landings.length - 1] ?? 0;
  const beats: number[] = [];
  landings.slice(0, -1).forEach((at) => {
    if (beats.length && at - beats[beats.length - 1]! < COIN_HAPTIC_MIN_GAP_MS) return;
    beats.push(at);
  });
  // The final coin always keeps its beat and lands alone: a light tap a few
  // milliseconds ahead of the heavier one would smear into it.
  while (beats.length && last - beats[beats.length - 1]! < COIN_HAPTIC_MIN_GAP_MS) beats.pop();
  return [...beats.map((at) => ({ at, last: false })), { at: last, last: true }];
})();


/**
 * When the last coin seats in the tile. `HAVEN_UPGRADE_TIMING.revealAtMs` must
 * stay above this or the restoration blend cuts the flight off mid-air.
 */
export const COIN_FLIGHT_WINDOW_MS = Math.max(...COIN_VECTORS.map((vector) => vector.delay + vector.duration));

export function createUpgradeEffects({coinArt:COIN_ART, fontFamily}: {coinArt: import('expo-image').ImageSource | number; fontFamily:string}) {
type HavenTileUpgradePresentation = {nonce:number;coinOrigin:{x:number;y:number};palette:HavenUpgradeEffectPalette;reactionLine:string};
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
  /** Fired as each Glow coin seats in the tile; `last` marks the final one. */
  onCoinLanded?: (last: boolean) => void;
  phase: HavenUpgradePresentationPhase;
  presentation: HavenTileUpgradePresentation;
  reducedMotion: boolean;
  target: { x: number; y: number };
  showCoins?: boolean;
  showReaction?: boolean;
};

const HavenUpgradeEffects = memo(function HavenUpgradeEffects({
  area,
  onCoinLanded,
  phase,
  presentation,
  reducedMotion,
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

  const raysStyle = useAnimatedStyle(() => ({
    opacity: cover.value * interpolate(reveal.value, [0, 0.55, 1], [0.56, 0.3, 0]),
    transform: [{ translateY: interpolate(reveal.value, [0, 1], [18, -22]) }],
  }));

  const showCoins = coinsEnabled && !reducedMotion && (phase === 'payment' || phase === 'cover');
  const showEnergy = !reducedMotion && ['cover', 'reveal', 'react'].includes(phase);
  const showReaction = reactionEnabled && (phase === 'react' || phase === 'complete');

  // Scheduled once per receipt, not per phase: the stream keeps ticking across
  // the payment → cover boundary instead of being cancelled halfway through.
  const hapticNonce = showCoins ? presentation.nonce : null;
  const coinLandedRef = useRef(onCoinLanded);
  coinLandedRef.current = onCoinLanded;
  const scheduledHapticNonce = useRef<number | null>(null);
  const hapticTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => { hapticTimers.current.forEach(clearTimeout); hapticTimers.current = []; }, []);
  useEffect(() => {
    if (hapticNonce == null || scheduledHapticNonce.current === hapticNonce) return;
    scheduledHapticNonce.current = hapticNonce;
    hapticTimers.current.forEach(clearTimeout);
    hapticTimers.current = COIN_HAPTIC_BEATS.map((beat) => setTimeout(() => coinLandedRef.current?.(beat.last), beat.at));
  }, [hapticNonce]);

  return (
    <View accessibilityElementsHidden pointerEvents="auto" style={StyleSheet.absoluteFill}>
      {showCoins ? COIN_VECTORS.map((vector, index) => (
        <UpgradeCoin from={presentation.coinOrigin} index={index} key={`${presentation.nonce}:coin:${index}`} target={target} vector={vector} />
      )) : null}

      {showEnergy ? (
        <>
          {/* Tile artwork belongs exclusively to HavenUpgradeTileArt. Drawing
              the target here revealed its silhouette before the real blend. */}
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

      {showReaction && presentation.reactionLine.trim() ? (
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
    progress.value = withDelay(vector.delay, withTiming(1, { duration: vector.duration, easing: Easing.inOut(Easing.cubic) }));
    return () => cancelAnimation(progress);
  }, [progress, vector.delay, vector.duration]);
  const style = useAnimatedStyle(() => {
    const value = progress.value;
    const inverse = 1 - value;
    const startX = from.x + vector.offsetX;
    const startY = from.y + vector.offsetY;
    const controlX = (startX + target.x) / 2 + vector.sway;
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
  }, [from.x, from.y, index, target.x, target.y, vector.arc, vector.offsetX, vector.offsetY, vector.sway]);
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

/**
 * The reveal's rising embers, looping: the same particle geometry, shapes and
 * palette colouring as `RisingParticle`, but each ember climbs, fades and
 * starts again on its own timer, so a veiled tile can glow quietly for as
 * long as it stays veiled. Half the reveal's count, slower, and scaled by
 * `intensity`.
 */
const AMBIENT_EMBERS = RISING_PARTICLES.filter((_, index) => index % 2 === 0);

function AmbientEmber({ index, intensity, palette, particle, reducedMotion }: {
  index: number;
  intensity: number;
  palette: HavenUpgradeEffectPalette;
  particle: (typeof RISING_PARTICLES)[number];
  reducedMotion: boolean;
}) {
  const progress = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion) { progress.value = 0.4; return; }
    progress.value = 0;
    progress.value = withDelay(particle.delay * 4, withRepeat(withTiming(1, { duration: particle.duration * 2.4, easing: Easing.inOut(Easing.quad) }), -1, false));
    return () => cancelAnimation(progress);
  }, [particle.delay, particle.duration, progress, reducedMotion]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.16, 0.7, 1], [0, intensity, intensity * 0.72, 0]),
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [0, particle.drift]) },
      { translateY: interpolate(progress.value, [0, 1], [0, -particle.travel * 0.8]) },
      { rotateZ: `${particle.rotation + interpolate(progress.value, [0, 1], [0, index % 2 ? 70 : -70])}deg` },
      { scale: interpolate(progress.value, [0, 0.2, 1], [0.4, 1, 0.6]) },
    ],
  }));
  const color = index % 3 === 0 ? palette.accent : index % 3 === 1 ? palette.glow : palette.primary;
  // No blurred shadow here: these animate for as long as the tile is veiled,
  // and a shadow on a moving view re-rasterises every frame.
  return <Animated.View style={[
    particle.leaf ? styles.ambientLeaf : styles.ambientEmber,
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

const HavenAmbientEmbers = memo(function HavenAmbientEmbers({ area, intensity = 0.8, palette, reducedMotion }: {
  area: EffectRect;
  /** Peak opacity of each ember, 0..1. */
  intensity?: number;
  palette: HavenUpgradeEffectPalette;
  reducedMotion: boolean;
}) {
  return (
    <View accessibilityElementsHidden pointerEvents="none" style={[styles.energyArea, area]}>
      {AMBIENT_EMBERS.map((particle, index) => (
        <AmbientEmber index={index} intensity={intensity} key={`ambient:${index}`} palette={palette} particle={particle} reducedMotion={reducedMotion} />
      ))}
    </View>
  );
});

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
  ambientEmber: { borderRadius: 999, position: 'absolute' },
  ambientLeaf: { borderBottomLeftRadius: 8, borderTopRightRadius: 8, position: 'absolute' },
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
  reactionText: { color: '#FFF9DF', fontFamily: fontFamily, fontSize: 14, fontWeight: '800', lineHeight: 19, textAlign: 'center' },
  upArrow: { fontFamily: fontFamily, fontSize: 25, fontWeight: '900', position: 'absolute', textAlign: 'center', top: -5, width: 28 },
});

return { HavenUpgradeEffects, HavenAmbientEmbers };
}
