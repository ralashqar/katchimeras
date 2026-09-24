import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming, type SharedValue } from 'react-native-reanimated';

/**
 * A merge's Glow striking the Mist: the Egg's lightning (a zigzag gold bolt with a white core that flickers as it
 * fades) from the merged piece to the Mist cell. It reaches the cell a quarter of the way in, lands there (the Mist lets
 * go and the board puffs it away), and a ring and motes pulse out from the impact while the bolt fades.
 */
export type BoltBox = { left: number; top: number; width: number; height: number };
/** One strike: between two boxes (in the space the layer is drawn in), after `delay` ms; `onImpact` runs as it lands. `tone` violet is a wisp's Mist. */
export type MistBolt = { id: number; from: BoltBox; to: BoltBox; delay: number; onImpact: () => void; tone?: 'glow' | 'mist' };
export const MIST_BOLT_MS = 520;
export const MIST_BOLT_REACH = 0.25;
export const MIST_BOLT_LEAD_MS = 90;
export const MIST_BOLT_STAGGER_MS = 110;
const MIST_BOLT_SEGMENTS = 7;
const MIST_BOLT_MOTES = 8;

export const MistLightning = memo(function MistLightning({ bolt, reduceMotion, onDone }: { bolt: MistBolt; reduceMotion: boolean; onDone: (id: number) => void }) {
  const t = useSharedValue(0);
  useEffect(() => {
    const duration = reduceMotion ? 180 : MIST_BOLT_MS;
    t.value = withDelay(bolt.delay, withTiming(1, { duration, easing: Easing.linear }));
    const impact = setTimeout(bolt.onImpact, bolt.delay + duration * MIST_BOLT_REACH);
    const done = setTimeout(() => onDone(bolt.id), bolt.delay + duration + 40);
    return () => { clearTimeout(impact); clearTimeout(done); cancelAnimation(t); };
  // Once per bolt.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bolt.id]);
  const a = { x: bolt.from.left + bolt.from.width / 2, y: bolt.from.top + bolt.from.height / 2 };
  const b = { x: bolt.to.left + bolt.to.width / 2, y: bolt.to.top + bolt.to.height / 2 };
  const thickness = Math.max(5, bolt.to.width * 0.09);
  const tone = bolt.tone ?? 'glow';
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    {reduceMotion ? null : Array.from({ length: MIST_BOLT_SEGMENTS }, (_, segment) => <MistBoltSegment key={segment} t={t} a={a} b={b} segment={segment} thickness={thickness} tone={tone} />)}
    <MistImpact t={t} at={b} size={bolt.to.width} tone={tone} />
  </View>;
});

/** One stretch of the zigzag; the ends stay pinned to the two cells, the kinks jitter as it flickers. */
function MistBoltSegment({ t, a, b, segment, thickness, tone }: { t: SharedValue<number>; a: { x: number; y: number }; b: { x: number; y: number }; segment: number; thickness: number; tone: 'glow' | 'mist' }) {
  const style = useAnimatedStyle(() => {
    const p = t.value;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const kink = Math.min(10, Math.max(5, length * 0.06));
    const point = (index: number) => {
      const s = index / MIST_BOLT_SEGMENTS;
      const bend = index === 0 || index === MIST_BOLT_SEGMENTS ? 0 : (index % 2 ? 1 : -1) * Math.sin(Math.PI * s) * (kink + Math.sin(p * 28 + index) * 2.5);
      return { x: a.x + dx * s - (dy / length) * bend, y: a.y + dy * s + (dx / length) * bend };
    };
    const from = point(segment);
    const to = point(segment + 1);
    // It grows from the piece to the cell, holds bright on impact, then flickers out.
    const grow = Math.min(1, p / MIST_BOLT_REACH);
    const shown = p > 0 && segment / MIST_BOLT_SEGMENTS < grow;
    const fade = p < MIST_BOLT_REACH ? 1 : Math.max(0, 1 - (p - MIST_BOLT_REACH) / (1 - MIST_BOLT_REACH));
    const flicker = 0.72 + 0.28 * Math.abs(Math.sin(p * 55 + segment));
    return {
      left: from.x, top: from.y - thickness / 2, height: thickness,
      width: Math.hypot(to.x - from.x, to.y - from.y) + 1,
      opacity: shown ? fade * flicker : 0,
      transform: [{ rotate: `${Math.atan2(to.y - from.y, to.x - from.x)}rad` }],
    };
  });
  return <Animated.View style={[styles.bolt, tone === 'mist' && styles.boltMist, style]}><View style={[styles.boltCore, tone === 'mist' && styles.boltCoreMist]} /></Animated.View>;
}

/** The impact: a bright ring pulsing out of the struck cell, and motes thrown from it. */
function MistImpact({ t, at, size, tone }: { t: SharedValue<number>; at: { x: number; y: number }; size: number; tone: 'glow' | 'mist' }) {
  const ring = useAnimatedStyle(() => {
    const q = t.value < MIST_BOLT_REACH ? -1 : (t.value - MIST_BOLT_REACH) / (1 - MIST_BOLT_REACH);
    return { opacity: q < 0 ? 0 : (1 - q) * 0.9, transform: [{ scale: q < 0 ? 0.4 : 0.45 + q * 0.95 }] };
  });
  return <>
    <Animated.View style={[styles.impact, tone === 'mist' && styles.impactMist, { left: at.x - size / 2, top: at.y - size / 2, width: size, height: size, borderRadius: size / 2 }, ring]} />
    {Array.from({ length: MIST_BOLT_MOTES }, (_, index) => <MistImpactMote key={index} t={t} at={at} size={size} index={index} tone={tone} />)}
  </>;
}

function MistImpactMote({ t, at, size, index, tone }: { t: SharedValue<number>; at: { x: number; y: number }; size: number; index: number; tone: 'glow' | 'mist' }) {
  const style = useAnimatedStyle(() => {
    const q = t.value < MIST_BOLT_REACH ? -1 : (t.value - MIST_BOLT_REACH) / (1 - MIST_BOLT_REACH);
    const angle = (index / MIST_BOLT_MOTES) * Math.PI * 2 + 0.3;
    const reach = size * (0.35 + (index % 3) * 0.08);
    return {
      opacity: q < 0 ? 0 : Math.sin(Math.min(1, q) * Math.PI),
      transform: [{ translateX: Math.cos(angle) * reach * Math.max(0, q) }, { translateY: Math.sin(angle) * reach * Math.max(0, q) }, { scale: 1 - Math.max(0, q) * 0.6 }],
    };
  });
  return <Animated.View style={[styles.mote, tone === 'mist' && styles.moteMist, { left: at.x - 3, top: at.y - 3 }, style]} />;
}

const styles = StyleSheet.create({
  bolt: { position: 'absolute', transformOrigin: 'left center', borderRadius: 5, backgroundColor: 'rgba(255,204,70,0.55)', justifyContent: 'center' },
  boltCore: { height: '34%', width: '100%', borderRadius: 2, backgroundColor: '#FFF7D1' },
  boltMist: { backgroundColor: 'rgba(122,62,190,0.6)' },
  boltCoreMist: { backgroundColor: '#E8D2FF' },
  impact: { position: 'absolute', borderWidth: 3, borderColor: '#FFE7A0', backgroundColor: 'rgba(255,238,190,0.22)' },
  impactMist: { borderColor: '#B98CF0', backgroundColor: 'rgba(90,40,140,0.28)' },
  mote: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFE9A1' },
  moteMist: { backgroundColor: '#C9A6FF' },
});
