import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { createEffectDeadlines } from '@/features/encounter/effect-deadlines';
import { useEffectSlots } from '@/hooks/use-effect-slots';
import { useCombatEffects } from './combat-effects';
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
const MIST_BOLT_MOTES = 4;
const MIST_BOLT_POOL = 8;

/** Default: pooled native lightning. The diagnostic canvas remains an explicit opt-in. */
export function MistLightningLayer({ bolts, origin, reduceMotion, onDone }: {
  bolts: readonly MistBolt[]; origin: { x: number; y: number } | null; reduceMotion: boolean; onDone: (id: number) => void;
}) {
  const effects = useCombatEffects();
  const submitted = useRef(new Map<number, number>());
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    if (!effects || !origin) return;
    for (const bolt of bolts) if (!submitted.current.has(bolt.id)) {
      submitted.current.set(bolt.id, effects.lightning(bolt, origin, () => doneRef.current(bolt.id)));
    }
    const live = new Set(bolts.map((bolt) => bolt.id));
    for (const [id, token] of submitted.current) if (!live.has(id)) { effects.cancel([token]); submitted.current.delete(id); }
  }, [bolts, effects, origin]);
  useEffect(() => {
    const owned = submitted.current;
    return () => { effects?.cancel([...owned.values()]); owned.clear(); };
  }, [effects]);
  return effects && origin ? null : <NativeMistLightningLayer bolts={bolts} reduceMotion={reduceMotion} onDone={onDone} />;
}

function NativeMistLightningLayer({ bolts, reduceMotion, onDone }: { bolts: readonly MistBolt[]; reduceMotion: boolean; onDone: (id: number) => void }) {
  const slots = useEffectSlots(bolts, MIST_BOLT_POOL);
  const [deadlines] = useState(createEffectDeadlines);
  const scheduled = useRef(new Map<number, number[]>());
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => {
    const live = new Set(bolts.map((bolt) => bolt.id));
    for (const [id, tasks] of scheduled.current) if (!live.has(id)) {
      tasks.forEach(deadlines.cancel);
      scheduled.current.delete(id);
    }
    for (const bolt of bolts) if (!scheduled.current.has(bolt.id)) {
      const duration = reduceMotion ? 180 : MIST_BOLT_MS;
      scheduled.current.set(bolt.id, [
        deadlines.schedule(bolt.delay + duration * MIST_BOLT_REACH, bolt.onImpact),
        deadlines.schedule(bolt.delay + duration + 40, () => onDoneRef.current(bolt.id)),
      ]);
    }
  }, [bolts, deadlines, reduceMotion]);
  useEffect(() => {
    const owned = scheduled.current;
    return () => { deadlines.clear(); owned.clear(); };
  }, [deadlines]);
  return <>{slots.map((bolt, slot) => <MistLightning key={slot} bolt={bolt} reduceMotion={reduceMotion} />)}</>;
}

export const MistLightning = memo(function MistLightning({ bolt, reduceMotion }: { bolt: MistBolt | null; reduceMotion: boolean }) {
  const t = useSharedValue(0);
  const last = useRef(bolt);
  if (bolt) last.current = bolt;
  const drawn = last.current;
  const boltId = bolt?.id;
  const boltRef = useRef(bolt);
  boltRef.current = bolt;
  useEffect(() => {
    cancelAnimation(t);
    t.value = 0;
    const current = boltRef.current;
    if (!current) return;
    const duration = reduceMotion ? 180 : MIST_BOLT_MS;
    t.value = withDelay(current.delay, withTiming(1, { duration, easing: Easing.linear }));
    return () => cancelAnimation(t);
  // Once per bolt.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boltId]);
  const geometry = useMemo(() => drawn ? {
    a: { x: drawn.from.left + drawn.from.width / 2, y: drawn.from.top + drawn.from.height / 2 },
    b: { x: drawn.to.left + drawn.to.width / 2, y: drawn.to.top + drawn.to.height / 2 },
    thickness: Math.max(5, drawn.to.width * 0.09),
  } : null, [drawn]);
  if (!drawn || !geometry) return null;
  const { a, b, thickness } = geometry;
  const tone = drawn.tone ?? 'glow';
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: bolt ? 1 : 0 }]}>
    {reduceMotion ? null : Array.from({ length: MIST_BOLT_SEGMENTS }, (_, segment) => <MistBoltSegment key={segment} t={t} a={a} b={b} segment={segment} thickness={thickness} tone={tone} />)}
    <MistImpact t={t} at={b} size={drawn.to.width} tone={tone} />
  </View>;
});

/** Static zigzag geometry; only opacity animates, avoiding per-frame native layout updates. */
const MistBoltSegment = memo(function MistBoltSegment({ t, a, b, segment, thickness, tone }: { t: SharedValue<number>; a: { x: number; y: number }; b: { x: number; y: number }; segment: number; thickness: number; tone: 'glow' | 'mist' }) {
  const geometry = useMemo(() => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const kink = Math.min(10, Math.max(5, length * 0.06));
    const point = (index: number) => {
      const s = index / MIST_BOLT_SEGMENTS;
      const bend = index === 0 || index === MIST_BOLT_SEGMENTS ? 0 : (index % 2 ? 1 : -1) * Math.sin(Math.PI * s) * kink;
      return { x: a.x + dx * s - (dy / length) * bend, y: a.y + dy * s + (dx / length) * bend };
    };
    const from = point(segment);
    const to = point(segment + 1);
    return {
      left: from.x, top: from.y - thickness / 2, height: thickness,
      width: Math.hypot(to.x - from.x, to.y - from.y) + 1,
      transform: [{ rotate: `${Math.atan2(to.y - from.y, to.x - from.x)}rad` }],
    };
  }, [a, b, segment, thickness]);
  const style = useAnimatedStyle(() => {
    const p = t.value;
    // It grows from the piece to the cell, holds bright on impact, then flickers out.
    const grow = Math.min(1, p / MIST_BOLT_REACH);
    const shown = p > 0 && segment / MIST_BOLT_SEGMENTS < grow;
    const fade = p < MIST_BOLT_REACH ? 1 : Math.max(0, 1 - (p - MIST_BOLT_REACH) / (1 - MIST_BOLT_REACH));
    const flicker = 0.72 + 0.28 * Math.abs(Math.sin(p * 55 + segment));
    return {
      opacity: shown ? fade * flicker : 0,
    };
  });
  return <Animated.View style={[styles.bolt, tone === 'mist' && styles.boltMist, geometry, style]}><View style={[styles.boltCore, tone === 'mist' && styles.boltCoreMist]} /></Animated.View>;
});

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
