import { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Atlas, Canvas, Path, useColorBuffer, useImage, usePathValue, useRectBuffer, useRSXformBuffer } from '@shopify/react-native-skia';
import { runOnJS, runOnUI, useFrameCallback, useReducedMotion, useSharedValue } from 'react-native-reanimated';
import { useBattleQuality } from '@/features/encounter/battle-performance';
import { useAppForeground } from '@/hooks/use-app-foreground';
import type { MistBolt } from './mist-lightning';
import { advanceCombatEffects, type CombatEffect as Effect } from '@/features/encounter/combat-effects-clock';
import { acquireLifecycleResource } from '@/utils/lifecycle-performance';
import { CombatEffectsContext, type CombatEffects, type CombatEffectsProviderProps } from './combat-effects';

export const COMBAT_EFFECTS_ATLAS = require('@incubator/art-merge-world/generated/combat-effects-atlas.webp');
const CAPACITY = 64;
const STRIDE = 6; // bullet, ring, four decorative motes
type Point = { x: number; y: number };

/** One native canvas and fixed sprite buffers for a whole combat session, including empty intervals. */
export function SkiaCombatEffectsProvider({ children, screenRef, active = true, onReady }: CombatEffectsProviderProps) {
  const foreground = useAppForeground();
  const reduceMotion = useReducedMotion();
  const quality = useBattleQuality();
  const image = useImage(COMBAT_EFFECTS_ATLAS);
  const events = useSharedValue<Effect[]>([]);
  const clock = useSharedValue(0);
  const origin = useSharedValue<Point>({ x: 0, y: 0 });
  const callbacks = useRef(new Map<number, { impact: () => void; done: () => void }>());
  const sequence = useRef(0);
  const alive = useRef(true);
  const deliver = useCallback((messages: { id: number; done: boolean }[]) => {
    if (!alive.current) return;
    for (const message of messages) {
      const callback = callbacks.current.get(message.id);
      if (!callback) continue;
      if (message.done) { callbacks.current.delete(message.id); callback.done(); }
      else callback.impact();
    }
  }, []);
  const frame = useFrameCallback((info) => {
    if (!events.value.length) return;
    // UI time stops with the scene; no background wall time is replayed on resume.
    clock.value += Math.max(0, info.timeSincePreviousFrame ?? 0);
    let messages: { id: number; done: boolean }[] = [];
    events.modify((list) => {
      messages = advanceCombatEffects(list, clock.value);
      return list;
    });
    if (messages.length) runOnJS(deliver)(messages);
  }, false);
  useEffect(() => {
    const running = active && foreground;
    frame.setActive(running);
    const release = running ? acquireLifecycleResource('animation_loop', 'combat-effects') : () => {};
    return () => { frame.setActive(false); release(); };
  }, [active, foreground, frame]);
  useEffect(() => {
    alive.current = true;
    const owned = callbacks.current;
    return () => { alive.current = false; owned.clear(); };
  }, []);
  useEffect(() => { if (image) onReady?.(); }, [image, onReady]);
  const measure = useCallback(() => {
    screenRef.current?.measureInWindow((x, y) => { origin.value = { x, y }; });
  }, [origin, screenRef]);
  const controller = useMemo<CombatEffects>(() => {
    const enqueue = (made: Omit<Effect, 'start' | 'impacted'>[]) => {
      runOnUI((batch: Omit<Effect, 'start' | 'impacted'>[]) => {
        events.modify((list) => {
          // Incoming projectiles take visual slots before old decorative impact tails.
          const tail = list.findIndex((event) => event.impacted);
          list.splice(tail < 0 ? list.length : tail, 0, ...batch.map((event) => ({ ...event, start: clock.value, impacted: false })));
          return list;
        });
      })(made);
    };
    return {
      bolts(batch) {
        const made = batch.map((bolt): Omit<Effect, 'start' | 'impacted'> => {
          const id = ++sequence.current;
          callbacks.current.set(id, { impact: bolt.onImpact, done: () => {} });
          return { id, kind: 'bullet', tone: 0, from: bolt.from, to: bolt.to, size: bolt.size, delay: bolt.delay, duration: bolt.duration, miss: bolt.miss };
        });
        enqueue(made);
      },
      lightning(bolt, offset, onDone) {
        const id = ++sequence.current;
        callbacks.current.set(id, { impact: bolt.onImpact, done: onDone });
        const point = (box: MistBolt['from']) => ({ x: offset.x + box.left + box.width / 2, y: offset.y + box.top + box.height / 2 });
        enqueue([{ id, kind: 'lightning', tone: bolt.tone === 'mist' ? 1 : 0, from: point(bolt.from), to: point(bolt.to),
          size: bolt.to.width, delay: bolt.delay, duration: reduceMotion ? 180 : 520, miss: false }]);
        return id;
      },
      cancel(ids) {
        ids.forEach((id) => callbacks.current.delete(id));
        runOnUI((removed: readonly number[]) => { events.modify((list) => {
          for (let i = list.length - 1; i >= 0; i--) if (removed.includes(list[i]!.id)) list.splice(i, 1);
          return list;
        }); })(ids);
      },
    };
  }, [clock, events, reduceMotion]);
  const sprites = useRectBuffer(CAPACITY * STRIDE, (rect, index) => {
    'worklet';
    const event = events.value[Math.floor(index / STRIDE)];
    const part = index % STRIDE;
    rect.setXYWH(part === 0 ? 0 : event?.tone ? 192 : 128, part >= 2 ? 64 : 0, part === 0 ? 128 : part === 1 ? 64 : 16, part === 0 ? 128 : part === 1 ? 64 : 16);
  });
  const transforms = useRSXformBuffer(CAPACITY * STRIDE, (transform, index) => {
    'worklet';
    const event = events.value[Math.floor(index / STRIDE)];
    const part = index % STRIDE;
    if (!event) { transform.set(0, 0, 0, 0); return; }
    const age = clock.value - event.start - event.delay;
    const hitAt = event.kind === 'lightning' ? event.duration * 0.25 : event.duration;
    if (age < 0 || (part === 0 && (reduceMotion || event.kind !== 'bullet' || age >= hitAt)) || (part !== 0 && (age < hitAt || event.miss))
      || (part >= 2 && (reduceMotion || quality === 'reduced'))) { transform.set(0, 0, 0, 0); return; }
    if (part === 0) {
      const t = Math.min(1, age / event.duration);
      const p = event.miss ? 1 - (1 - t) * (1 - t) : t * t;
      const scale = event.size / 128 * (0.75 + p * 0.35);
      transform.set(scale, 0, event.from.x + (event.to.x - event.from.x) * p - origin.value.x - scale * 64,
        event.from.y + (event.to.y - event.from.y) * p - origin.value.y - scale * 64);
      return;
    }
    const q = Math.min(1, (age - hitAt) / (event.kind === 'lightning' ? event.duration * 0.75 : 480));
    const scale = part === 1 ? event.size / 64 * (0.45 + q * 0.95) : 0.42 * (1 - q * 0.6);
    const angle = (part - 2) * Math.PI / 2 + 0.3;
    const reach = event.size * 0.5 * q;
    const half = part === 1 ? 32 : 8;
    transform.set(scale, 0, event.to.x - origin.value.x + (part === 1 ? 0 : Math.cos(angle) * reach) - scale * half,
      event.to.y - origin.value.y + (part === 1 ? 0 : Math.sin(angle) * reach) - scale * half);
  });
  const colours = useColorBuffer(CAPACITY * STRIDE, (colour, index) => {
    'worklet';
    const event = events.value[Math.floor(index / STRIDE)];
    const part = index % STRIDE;
    let alpha = 0;
    if (event) {
      const age = clock.value - event.start - event.delay;
      const hitAt = event.kind === 'lightning' ? event.duration * 0.25 : event.duration;
      alpha = part === 0 ? event.miss ? Math.min(1, Math.max(0, (1 - age / hitAt) * 3)) : 1
        : Math.max(0, 1 - (age - hitAt) / (event.kind === 'lightning' ? event.duration * 0.75 : 480));
    }
    colour[0] = 1; colour[1] = 1; colour[2] = 1; colour[3] = alpha;
  });
  // Two reusable paths replace seven layout-animated segment Views per lightning bolt.
  const glowPath = usePathValue((path) => {
    'worklet';
    if (reduceMotion) return;
    for (let i = 0; i < Math.min(CAPACITY, events.value.length); i++) {
      const e = events.value[i]!;
      const p = (clock.value - e.start - e.delay) / e.duration;
      if (e.kind !== 'lightning' || e.tone !== 0 || p < 0 || p > 0.9) continue;
      const dx = e.to.x - e.from.x, dy = e.to.y - e.from.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      path.moveTo(e.from.x - origin.value.x, e.from.y - origin.value.y);
      for (let j = 1; j <= Math.min(7, Math.ceil(p * 28)); j++) {
        const bend = j === 7 ? 0 : (j % 2 ? 1 : -1) * Math.min(10, length * 0.06);
        path.lineTo(e.from.x + dx * j / 7 - dy / length * bend - origin.value.x, e.from.y + dy * j / 7 + dx / length * bend - origin.value.y);
      }
    }
  });
  const mistPath = usePathValue((path) => {
    'worklet';
    if (reduceMotion) return;
    for (let i = 0; i < Math.min(CAPACITY, events.value.length); i++) {
      const e = events.value[i]!;
      const p = (clock.value - e.start - e.delay) / e.duration;
      if (e.kind !== 'lightning' || e.tone !== 1 || p < 0 || p > 0.9) continue;
      const dx = e.to.x - e.from.x, dy = e.to.y - e.from.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      path.moveTo(e.from.x - origin.value.x, e.from.y - origin.value.y);
      for (let j = 1; j <= Math.min(7, Math.ceil(p * 28)); j++) {
        const bend = j === 7 ? 0 : (j % 2 ? 1 : -1) * Math.min(10, length * 0.06);
        path.lineTo(e.from.x + dx * j / 7 - dy / length * bend - origin.value.x, e.from.y + dy * j / 7 + dx / length * bend - origin.value.y);
      }
    }
  });
  return <CombatEffectsContext value={controller}>{children}<View pointerEvents="none" onLayout={measure} style={styles.canvas}><Canvas style={StyleSheet.absoluteFill}>
    <Path path={glowPath} color="#FFCC46" style="stroke" strokeWidth={5} strokeCap="round" />
    <Path path={glowPath} color="#FFF7D1" style="stroke" strokeWidth={1.8} />
    <Path path={mistPath} color="#7A3EBE" style="stroke" strokeWidth={5} strokeCap="round" />
    <Path path={mistPath} color="#E8D2FF" style="stroke" strokeWidth={1.8} />
    <Atlas image={image} sprites={sprites} transforms={transforms} colors={colours} blendMode="modulate" />
  </Canvas></View></CombatEffectsContext>;
}

const styles = StyleSheet.create({ canvas: { ...StyleSheet.absoluteFillObject, zIndex: 100 } });
