import { memo, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useCombatActive } from '@/components/katchadeck/games/combat-effects';
import { useWispArt } from '@/features/encounter/battle-art';
import { useEffectSlots } from '@/hooks/use-effect-slots';
import { recordMergeRender } from '@/utils/merge-world/performance';

export type LaneWispSprite = { id: string; x: number; y: number; size: number; vy: number; alive: boolean; leaving: boolean; hp: number; look: string | null; guarded: boolean; strike: number };
const DRIFT_MS = 220;

/** Capacity is the authored enemy count: visible enemies are never dropped by an effects budget. */
export function PooledLaneWisps({ items, capacity }: { items: readonly LaneWispSprite[]; capacity: number }) {
  const slots = useEffectSlots(items, capacity);
  return <>{slots.map((item, index) => <LaneWispSlot key={index} item={item} />)}</>;
}

const LaneWispSlot = memo(function LaneWispSlot({ item }: { item: LaneWispSprite | null }) {
  recordMergeRender('wisp-slot');
  const retained = useRef(item);
  if (item) retained.current = item;
  const drawn = retained.current;
  const active = useCombatActive();
  const reduced = useReducedMotion();
  const size = drawn?.size ?? 48;
  const art = useWispArt(drawn?.look ?? null, size);
  const x = useSharedValue(item?.x ?? 0), y = useSharedValue(item?.y ?? 0);
  const life = useSharedValue(0), hit = useSharedValue(0);
  const id = item?.id ?? null;
  const alive = item?.alive ?? false, leaving = item?.leaving ?? false;
  const nextX = item?.x ?? 0, nextY = item?.y ?? 0, speed = item?.vy ?? 0;
  const positionId = useRef<string | null>(null);
  const lifeId = useRef<string | null>(null);
  useEffect(() => {
    recordMergeRender('wisp-slot-mount');
    return () => { recordMergeRender('wisp-slot-unmount'); };
  }, []);
  useEffect(() => {
    cancelAnimation(x); cancelAnimation(y);
    if (!id || !active) return;
    if (positionId.current !== id || reduced) { x.value = nextX; y.value = nextY; positionId.current = id; }
    if (!reduced) {
      x.value = withTiming(nextX, { duration: DRIFT_MS, easing: Easing.linear });
      y.value = withTiming(nextY + (alive && !leaving ? speed * DRIFT_MS : 0), { duration: DRIFT_MS, easing: Easing.linear });
    }
    return () => { cancelAnimation(x); cancelAnimation(y); };
  }, [active, alive, id, leaving, nextX, nextY, reduced, speed, x, y]);
  useEffect(() => {
    cancelAnimation(life);
    if (!id) { life.value = 0; return; }
    if (!active) return;
    if (lifeId.current !== id) { life.value = 0; lifeId.current = id; }
    life.value = withTiming(alive && !leaving ? 1 : 0, { duration: reduced ? 100 : 260, easing: Easing.out(Easing.cubic) });
    return () => cancelAnimation(life);
  }, [active, alive, id, leaving, life, reduced]);
  const strike = item?.strike ?? 0;
  const previousStrike = useRef({ id, strike });
  useEffect(() => {
    const previous = previousStrike.current;
    previousStrike.current = { id, strike };
    cancelAnimation(hit); hit.value = 0;
    if (active && alive && !reduced && previous.id === id && strike !== previous.strike) {
      hit.value = withSequence(withTiming(1, { duration: 45 }), withTiming(-0.5, { duration: 55 }), withTiming(0, { duration: 60 }));
    }
    return () => cancelAnimation(hit);
  }, [active, alive, hit, id, reduced, strike]);
  const style = useAnimatedStyle(() => ({ opacity: life.value,
    transform: [{ translateX: x.value - size / 2 + hit.value * 4 }, { translateY: y.value - size / 2 }, { scale: 0.75 + life.value * 0.25 }] }));
  if (!drawn) return null;
  return <Animated.View pointerEvents="none" style={[styles.slot, { width: size, height: size }, style]}>
    <Image source={art} accessibilityLabel={`${drawn.look ?? 'Corruption'} wisp`} contentFit="contain" transition={0} style={StyleSheet.absoluteFill} />
    {item?.alive && (drawn.hp > 1 || drawn.guarded) ? <View style={styles.badge}><Text style={styles.text}>{drawn.guarded ? '◆ ' : ''}{drawn.hp}</Text></View> : null}
  </Animated.View>;
}, (a, b) => a.item === b.item || Boolean(a.item && b.item &&
  a.item.id === b.item.id && a.item.x === b.item.x && a.item.y === b.item.y && a.item.size === b.item.size && a.item.vy === b.item.vy &&
  a.item.alive === b.item.alive && a.item.leaving === b.item.leaving && a.item.hp === b.item.hp && a.item.look === b.item.look && a.item.guarded === b.item.guarded && a.item.strike === b.item.strike));
const styles = StyleSheet.create({ slot: { position: 'absolute', left: 0, top: 0 },
  badge: { position: 'absolute', bottom: -3, alignSelf: 'center', paddingHorizontal: 5, borderRadius: 7, backgroundColor: '#291B3C' },
  text: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' } });
