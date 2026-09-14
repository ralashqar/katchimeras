import { EGG_FEED_TARGET_Y_RATIO } from '@/features/today/egg-feed-target';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { AppState, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, useDerivedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';

// World units: 36 renders at 72 points at the resting ~2x camera.
const WISP_SIZE = 36;
// Like the Egg, decode into a large native surface and scale down at render time.
// Covers the 3x close-up plus hover pulse without enlarging a tiny raster layer.
const WISP_NATIVE_SURFACE_SCALE = 4;
const WISP_NATIVE_SIZE = WISP_SIZE * WISP_NATIVE_SURFACE_SCALE;
const WISP = require('@incubator/art-cutouts/corruption-wisp.png');
export type HatchWispFrame = { x: number; y: number; radius: number; scale: number; sourceY: number };

/** World encounters supply their camera projection; only the standalone UI measures its Egg. */
export function HatchWispLayer({ targetRef, cleared, visible = true, revealProgress, projectedFrame }: { targetRef: RefObject<View | null>; cleared: number; visible?: boolean; revealProgress?: SharedValue<number>; projectedFrame?: SharedValue<HatchWispFrame> }) {
  const root = useRef<View>(null);
  const measuredFrame = useSharedValue<HatchWispFrame>({ x: 0, y: 0, radius: 38, scale: 2, sourceY: 0 });
  const [frame, setFrame] = useState<HatchWispFrame | null>(null);
  const { width, height } = useWindowDimensions();
  useEffect(() => {
    if (!visible || projectedFrame) return;
    let disposed = false;
    const measure = () => root.current?.measureInWindow((rx, ry) => targetRef.current?.measureInWindow((x, y, w, h) => {
      if (!disposed && w > 0 && h > 0) {
        const radius = Math.min(width * 0.29, Math.max(76, w / 2 + 18));
        const next = { x: Math.max(radius + WISP_SIZE + 8, Math.min(width - radius - WISP_SIZE - 8, x + w / 2 - rx)), y: y + h * 0.05 - ry, radius: radius / 2, scale: 2, sourceY: h * (EGG_FEED_TARGET_Y_RATIO - 0.05) / 2 };
        setFrame((previous) => previous && Math.abs(previous.x - next.x) < 1 && Math.abs(previous.y - next.y) < 1 && Math.abs(previous.radius - next.radius) < 1 && Math.abs(previous.sourceY - next.sourceY) < 1 ? previous : next);
      }
    }));
    measure();
    // Camera and Egg growth can still settle while the layer is arriving.
    const timer = setInterval(measure, 250);
    // The world Egg can mount after asynchronous day/assets loading. Keep
    // tracking while visible rather than permanently giving up after 1.5s.
    return () => { disposed = true; clearInterval(timer); };
  }, [cleared, height, projectedFrame, targetRef, visible, width]);
  useEffect(() => { if (frame) measuredFrame.value = frame; }, [frame, measuredFrame]);
  const revealStyle = useAnimatedStyle(() => ({ opacity: revealProgress?.value ?? 1 }));
  const placement = useDerivedValue(() => projectedFrame?.value ?? measuredFrame.value);
  const localFrame = useDerivedValue(() => ({ x: 0, y: 0, radius: placement.value.radius, scale: placement.value.scale, sourceY: placement.value.sourceY }));
  const worldStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: placement.value.x }, { translateY: placement.value.y }],
  }));
  if (!visible) return null;
  return <Animated.View ref={root} collapsable={false} pointerEvents="none" style={[styles.root, revealStyle]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Animated.View collapsable={false} renderToHardwareTextureAndroid={false} shouldRasterizeIOS={false} style={[styles.worldAnchor, worldStyle]}>
    {projectedFrame || frame ? [0, 1].map((index) => <HoverWisp key={index} frame={localFrame} index={index} cleared={cleared} />) : null}
    </Animated.View>
  </Animated.View>;
}

function HoverWisp({ frame, index, cleared }: { frame: SharedValue<HatchWispFrame>; index: number; cleared: number }) {
  const reduced = useReducedMotion();
  const orbit = useSharedValue(index * Math.PI);
  const death = useSharedValue(cleared > index ? 1 : 0);
  const arrival = useSharedValue(0);
  const dead = cleared > index;
  useEffect(() => {
    arrival.value = withTiming(1, { duration: reduced ? 120 : 450 });
    return () => cancelAnimation(arrival);
  }, [arrival, reduced]);
  useEffect(() => {
    const start = () => {
      cancelAnimation(orbit);
      if (!reduced && !dead) orbit.value = withRepeat(withTiming(orbit.value + Math.PI * 2, { duration: 5600, easing: Easing.linear }), -1, false);
    };
    start();
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') start(); else cancelAnimation(orbit); });
    return () => { cancelAnimation(orbit); subscription.remove(); };
  }, [dead, orbit, reduced]);
  useEffect(() => {
    death.value = withTiming(dead ? 1 : 0, { duration: reduced ? 120 : 600 });
    return () => cancelAnimation(death);
  }, [dead, death, reduced]);
  const side = index === 0 ? -1 : 1;
  const style = useAnimatedStyle(() => {
    const depth = Math.sin(orbit.value);
    return { left: frame.value.x - WISP_NATIVE_SIZE / 2, top: frame.value.y - WISP_NATIVE_SIZE / 2, opacity: arrival.value * (1 - death.value),
      transform: [{ translateX: (side * frame.value.radius + Math.sin(orbit.value * 2) * 3.5) * frame.value.scale }, { translateY: depth * 13 * frame.value.scale },
        { scale: (0.85 + (depth + 1) * 0.12 + (cleared === index ? Math.sin(orbit.value * 3) * 0.04 : 0)) * (1 - death.value * 0.85) * frame.value.scale / WISP_NATIVE_SURFACE_SCALE }] };
  });
  return <>
    {dead && !reduced ? Array.from({ length: 7 }, (_, segment) => <GlowBoltSegment
      key={segment} frame={frame} orbit={orbit} death={death} side={side} segment={segment} />) : null}
    <Animated.View collapsable={false} renderToHardwareTextureAndroid={false} shouldRasterizeIOS={false} style={[styles.wisp, style]}><Image source={WISP} allowDownscaling={false} cachePolicy="memory-disk" transition={0} style={styles.image} contentFit="contain" /></Animated.View>
    {dead && !reduced ? Array.from({ length: 8 }, (_, mote) => <WispMote key={mote} frame={frame} orbit={orbit} death={death} side={side} index={mote} />) : null}
  </>;
}
/** Endpoint-preserving zigzag: the Egg tip and moving wisp always stay connected. */
function GlowBoltSegment({ frame, orbit, death, side, segment }: {
  frame: SharedValue<HatchWispFrame>; orbit: SharedValue<number>; death: SharedValue<number>; side: number; segment: number;
}) {
  const geometry = useDerivedValue(() => {
    const dx = side * frame.value.radius + Math.sin(orbit.value * 2) * 3.5;
    const dy = Math.sin(orbit.value) * 13 - frame.value.sourceY;
    const length = Math.max(1, Math.hypot(dx, dy));
    const point = (index: number) => {
      const t = index / 7;
      const bend = index === 0 || index === 7 ? 0
        : (index % 2 ? 1 : -1) * Math.sin(Math.PI * t) * (5 + Math.sin(death.value * 28 + index) * 1.5);
      return { x: dx * t - dy / length * bend, y: frame.value.sourceY + dy * t + dx / length * bend };
    };
    const from = point(segment), to = point(segment + 1);
    return { x: from.x, y: from.y, length: Math.hypot(to.x - from.x, to.y - from.y), angle: Math.atan2(to.y - from.y, to.x - from.x) };
  });
  const bolt = useAnimatedStyle(() => ({
    left: geometry.value.x * frame.value.scale,
    top: geometry.value.y * frame.value.scale - frame.value.scale * 2.5,
    width: geometry.value.length * frame.value.scale + 1,
    height: frame.value.scale * 5,
    opacity: death.value > 0 && death.value < 0.8 ? Math.sin(Math.PI * death.value / 0.8) : 0,
    transform: [{ rotate: `${geometry.value.angle}rad` }],
  }));
  return <Animated.View style={[styles.bolt, bolt]}>
    <View style={styles.boltCore} />
  </Animated.View>;
}

function WispMote({ frame, orbit, death, side, index }: { frame: SharedValue<HatchWispFrame>; orbit: SharedValue<number>; death: SharedValue<number>; side: number; index: number }) {
  const style = useAnimatedStyle(() => ({
    left: frame.value.x + (side * frame.value.radius + Math.sin(orbit.value * 2) * 3.5) * frame.value.scale, top: frame.value.y + Math.sin(orbit.value) * 13 * frame.value.scale,
    opacity: death.value > 0 && death.value < 1 ? Math.sin(death.value * Math.PI) : 0,
    transform: [{ translateX: Math.cos(index * Math.PI / 4) * death.value * 24 * frame.value.scale }, { translateY: Math.sin(index * Math.PI / 4) * death.value * 24 * frame.value.scale }, { scale: (1 - death.value * 0.6) * frame.value.scale }],
  }));
  return <Animated.View style={[styles.mote, style]} />;
}
const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 110 },
  worldAnchor: { position: 'absolute', left: 0, top: 0, width: 0, height: 0, overflow: 'visible' },
  wisp: { position: 'absolute', width: WISP_NATIVE_SIZE, height: WISP_NATIVE_SIZE }, image: { width: '100%', height: '100%' },
  bolt: { position: 'absolute', transformOrigin: 'left center', borderRadius: 5, backgroundColor: 'rgba(255,204,70,0.48)', justifyContent: 'center' },
  boltCore: { height: '32%', width: '100%', borderRadius: 2, backgroundColor: '#FFF7D1' },
  mote: { position: 'absolute', width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#FFE9A1' },
});
