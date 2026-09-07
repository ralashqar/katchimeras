import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';
import type { BulletVolley } from '@incubator/tile-match/effects';
import { TILE_COLORS } from '../data/tile-theme';
import { arrivedCells, cellImpactTarget, flightOffset, CELL_FLIGHT_MS, CELL_IMPACT_MS, CELL_LAUNCH_MS } from '../game/volley-presentation';

export type CombatVolleyData = BulletVolley & { damage: number; opponentWidth: number };
export const CombatVolley = memo(function CombatVolley({ volley, paused, reduced, onImpact, onDone }: {
  volley: CombatVolleyData; paused: boolean; reduced: boolean;
  onImpact: (id: number, index: number, damage: number, count: number) => void; onDone: (id: number) => void;
}) {
  const elapsed = useSharedValue(0), delivered = useSharedValue(0), done = useSharedValue(false);
  const delays = volley.bullets.map(b => b.delay);
  const duration = Math.max(0, ...delays) + CELL_FLIGHT_MS + CELL_IMPACT_MS;
  // One pausable clock drives flight, collision particles and impact notifications.
  useFrameCallback(frame => {
    if (paused || done.value) return;
    elapsed.value += frame.timeSincePreviousFrame ?? 0;
    const count = arrivedCells(delays, elapsed.value);
    while (delivered.value < count) {
      runOnJS(onImpact)(volley.id, delivered.value, volley.damage, delays.length);
      delivered.value += 1;
    }
    if (elapsed.value >= duration) { done.value = true; runOnJS(onDone)(volley.id); }
  });
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 300 }]}>
    {volley.bullets.map((bullet, index) => <Cell key={index} bullet={bullet} target={cellImpactTarget(bullet.x, volley.target, volley.opponentWidth)} elapsed={elapsed} reduced={reduced} />)}
  </View>;
});
function Cell({ bullet, target, elapsed, reduced }: {
  bullet: BulletVolley['bullets'][number]; target: BulletVolley['target']; elapsed: SharedValue<number>; reduced: boolean;
}) {
  const colour = TILE_COLORS[bullet.colorId];
  const style = useAnimatedStyle(() => {
    const age = elapsed.value - bullet.delay;
    const t = Math.max(0, Math.min(1, age / CELL_FLIGHT_MS));
    const flight = flightOffset(target.x - bullet.x, target.y - bullet.y, t);
    return { opacity: age >= CELL_FLIGHT_MS ? 0 : 1, transform: [
      { translateX: reduced ? 0 : flight.x },
      { translateY: reduced ? 0 : flight.y },
      { scale: reduced ? 1 : flight.scale },
    ] };
  });
  const launch = useAnimatedStyle(() => {
    const age = elapsed.value - bullet.delay;
    const t = Math.max(0, Math.min(1, age / CELL_LAUNCH_MS));
    return { opacity: age < 0 || age >= CELL_LAUNCH_MS ? 0 : (1-t)*.8,
      transform: [{ scale: reduced ? 1 : .75+t*.95 }] };
  });
  return <>
    <Animated.View style={[{ position: 'absolute', left: bullet.x-bullet.size/2, top: bullet.y-bullet.size/2,
      width: bullet.size, height: bullet.size, borderRadius: bullet.size/2, borderWidth: 2,
      borderColor: colour.bright, boxShadow: `0 0 6px ${colour.glow}` }, launch]} />
    <Animated.View style={[{ position: 'absolute', left: bullet.x - bullet.size/2, top: bullet.y - bullet.size/2,
      width: bullet.size, height: bullet.size, borderRadius: 6, backgroundColor: colour.mid,
      borderTopWidth: 3, borderLeftWidth: 2, borderBottomWidth: 3, borderColor: colour.bright,
      borderBottomColor: colour.deep, boxShadow: `0 0 8px ${colour.glow}` }, style]} />
    {[0, 1, 2, 3, 4, 5].map(i => <Shard key={i} index={i} delay={bullet.delay} target={target} elapsed={elapsed} colour={colour.bright} reduced={reduced} />)}
  </>;
}
function Shard({ index, delay, target, elapsed, colour, reduced }: {
  index: number; delay: number; target: BulletVolley['target']; elapsed: SharedValue<number>; colour: string; reduced: boolean;
}) {
  const style = useAnimatedStyle(() => {
    const age = elapsed.value - delay - CELL_FLIGHT_MS;
    const t = Math.max(0, Math.min(1, age / CELL_IMPACT_MS));
    const angle = index * Math.PI / 3;
    return { opacity: age < 0 || age >= CELL_IMPACT_MS ? 0 : (1-t) * (reduced ? .55 : 1), transform: [
      { translateX: reduced ? Math.cos(angle)*7 : Math.cos(angle)*(8 + t*36) },
      { translateY: reduced ? Math.sin(angle)*7 : Math.sin(angle)*(8+t*36)+t*t*12 },
      { rotate: `${reduced ? 0 : index*30+t*100}deg` }, { scale: 1-t*.8 },
    ] };
  });
  return <Animated.View style={[{ position: 'absolute', left: target.x-4, top: target.y-4, width: 8, height: 8,
    borderRadius: 2, backgroundColor: colour }, style]} />;
}
