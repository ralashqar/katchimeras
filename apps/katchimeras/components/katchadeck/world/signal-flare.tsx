import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { FTUE_SCENE_LAYERS } from '@/constants/ftue-scene-layers';

const RISE_MS = 900;
const BURST_MS = 700;
const HEIGHT = 190;

/**
 * A distress signal from a misted tile (a chapter's opening: "The Signal"): a bright spark shoots up out of the Mist
 * on a thin trail and bursts into a ring and a flash, twice, so the eye is drawn to where the story goes next.
 * Runtime, not baked; placed over the tile's measured screen frame.
 */
export function SignalFlare({ node, color = '#FF8FC8' }: { node: View | null; color?: string }) {
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!node) return;
    // The camera is still settling when the flare starts: measure once it has.
    const timer = setTimeout(() => node.measureInWindow((x, y, width, height) => { if (width > 0) setOrigin({ x: x + width / 2, y: y + height * 0.35 }); }), 120);
    return () => clearTimeout(timer);
  }, [node]);
  const reduceMotion = useReducedMotion();
  const rise = useSharedValue(0);
  const burst = useSharedValue(0);
  useEffect(() => {
    if (!origin) return;
    const cycle = (value: typeof rise, first: number, second: number) => withRepeat(withSequence(
      withTiming(0, { duration: 0 }),
      withDelay(first, withTiming(1, { duration: second, easing: Easing.out(Easing.cubic) })),
      withDelay(500, withTiming(1, { duration: 0 })),
    ), 2, false);
    rise.value = reduceMotion ? 1 : cycle(rise, 0, RISE_MS);
    burst.value = reduceMotion ? 1 : cycle(burst, RISE_MS - 60, BURST_MS);
  }, [burst, origin, reduceMotion, rise]);
  const spark = useAnimatedStyle(() => ({ opacity: rise.value < 1 ? 1 : 1 - burst.value, transform: [{ translateY: -HEIGHT * rise.value }, { scale: 1 + burst.value * 0.6 }] }));
  const trail = useAnimatedStyle(() => ({ height: HEIGHT * rise.value, opacity: 0.8 * (1 - burst.value) }));
  const ring = useAnimatedStyle(() => ({ opacity: burst.value > 0 ? 1 - burst.value : 0, transform: [{ translateY: -HEIGHT }, { scale: 0.3 + burst.value * 2.6 }] }));
  const flash = useAnimatedStyle(() => ({ opacity: burst.value > 0 && burst.value < 1 ? 0.55 * (1 - burst.value) : 0, transform: [{ translateY: -HEIGHT }, { scale: 1 + burst.value * 4 }] }));
  if (!origin) return null;
  return <View pointerEvents="none" style={[styles.layer, { left: origin.x, top: origin.y }]}>
    <Animated.View style={[styles.trail, { backgroundColor: color, shadowColor: color }, trail]} />
    <Animated.View style={[styles.flash, { backgroundColor: color }, flash]} />
    <Animated.View style={[styles.ring, { borderColor: color }, ring]} />
    <Animated.View style={[styles.spark, { backgroundColor: '#FFF4FA', shadowColor: color }, spark]} />
  </View>;
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', width: 0, height: 0, zIndex: FTUE_SCENE_LAYERS.spotlight - 2 },
  trail: { position: 'absolute', bottom: 0, left: -2, width: 4, borderRadius: 2, shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  spark: { position: 'absolute', left: -9, top: -9, width: 18, height: 18, borderRadius: 9, shadowOpacity: 1, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } },
  ring: { position: 'absolute', left: -22, top: -22, width: 44, height: 44, borderRadius: 22, borderWidth: 3 },
  flash: { position: 'absolute', left: -16, top: -16, width: 32, height: 32, borderRadius: 16 },
});
