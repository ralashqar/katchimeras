import { useEffect, useRef, type ReactNode } from "react";
import { runEggFeedMotion } from './feed-motion';
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

export type EggEnergyProps = {
  children: ReactNode;
  energy: number;
  pulseKey?: number;
  feedKey?: number;
  hitKey?: number;
  hurt?: boolean;
  reduceMotion?: boolean;
  color?: string;
  paused?: boolean;
  /** Normalized anchor in the avatar container; existing consumers default to its centre. */
  anchor?: { x: number; y: number };
};
/** Passive, host-driven energy. No FTUE interaction, persistence, or app policy. */
export function EggEnergy({
  children,
  energy,
  pulseKey = 0,
  feedKey = 0,
  hitKey = 0,
  hurt = false,
  reduceMotion = false,
  color = "#FFE599",
  paused = false,
  anchor,
}: EggEnergyProps) {
  const breathe = useSharedValue(0);
  const pulse = useSharedValue(0);
  const absorb = useSharedValue(0), feedShake = useSharedValue(0), ripple = useSharedValue(1), hit = useSharedValue(0);
  const hitShake = useSharedValue(0);
  const seenFeed = useRef(0), seenHit = useRef(0);
  useEffect(() => {
    if (feedKey && feedKey !== seenFeed.current && !paused) {
      seenFeed.current = feedKey;
      runEggFeedMotion(absorb, feedShake, ripple, reduceMotion);
    }
    return () => { [absorb, feedShake, ripple].forEach(cancelAnimation); absorb.value = 0; feedShake.value = 0; ripple.value = 1; };
  }, [feedKey, paused, reduceMotion, absorb, feedShake, ripple]);
  useEffect(() => {
    if (hitKey && hitKey !== seenHit.current && !paused) {
      seenHit.current = hitKey;
      // Continue from the current glow on successive cells; never reset between hits.
      hit.value = withSequence(
        withTiming(1, { duration: 130, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 380, easing: Easing.inOut(Easing.cubic) }),
      );
      if (!reduceMotion) {
        const direction = hitKey % 2 ? 1 : -1;
        hitShake.value = withSequence(
          withTiming(direction, { duration: 55, easing: Easing.out(Easing.cubic) }),
          withTiming(-direction * .65, { duration: 75, easing: Easing.inOut(Easing.sin) }),
          withTiming(direction * .3, { duration: 85, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 120, easing: Easing.out(Easing.cubic) }),
        );
      }
    }
  }, [hitKey, paused, reduceMotion, hit, hitShake]);
  useEffect(() => {
    if (paused || reduceMotion) { cancelAnimation(hitShake); hitShake.value = 0; }
    if (paused) { cancelAnimation(hit); hit.value = 0; }
    return () => { cancelAnimation(hit); cancelAnimation(hitShake); };
  }, [paused, reduceMotion, hit, hitShake]);
  useEffect(() => {
    cancelAnimation(breathe);
    breathe.value = 0;
    if (!reduceMotion && !paused)
      breathe.value = withRepeat(
        withTiming(1, {
          duration: Math.max(450, 1500 - energy * 900),
          easing: Easing.inOut(Easing.sin),
        }),
        -1,
        true,
      );
    return () => cancelAnimation(breathe);
  }, [breathe, energy, paused, reduceMotion]);
  useEffect(() => {
    pulse.value =
      reduceMotion || paused
        ? 0
        : withSequence(
            withTiming(1, { duration: 80 }),
            withTiming(0, { duration: 260 }),
          );
    return () => cancelAnimation(pulse);
  }, [pulseKey, hurt, reduceMotion, paused, pulse]);
  const style = useAnimatedStyle(() => ({
    transform: [
      {
        scale: reduceMotion
          ? 1
          : 1 +
            Math.min(
              0.12,
              energy * 0.08 + breathe.value * 0.015 + pulse.value * 0.025 + absorb.value * .1,
            ),
      },
      {
        rotate: `${reduceMotion ? 0 : (hurt ? 4 : energy > 0.6 ? 1.2 : 0) * Math.sin(breathe.value * Math.PI * 2) + hitShake.value * 1.4}deg`,
      },
      { translateX: reduceMotion ? 0 : hitShake.value * 3 },
    ],
  }));
  const firing = useAnimatedStyle(() => ({ transform: [
    { translateX: reduceMotion ? 0 : feedShake.value * 5 },
    { translateY: reduceMotion ? 0 : -absorb.value * 6 },
    { rotateZ: `${reduceMotion ? 0 : feedShake.value * 3.2}deg` },
  ] }));
  const glow = useAnimatedStyle(() => ({
    opacity: energy * (0.18 + breathe.value * 0.12 + pulse.value * 0.15) + absorb.value * .42,
    transform: [{ scale: 0.85 + breathe.value * 0.08 }],
  }));
  const hitGlow = useAnimatedStyle(() => ({
    opacity: hit.value * .55,
    transform: [{ scale: reduceMotion ? 1 : .96 + hit.value * .2 }],
  }));
  const ring = useAnimatedStyle(() => ({ opacity: feedKey ? (1-ripple.value)*.55 : 0,
    transform: [{ scale: reduceMotion ? 1 : .62+ripple.value*.85 }] }));
  return (
    <Animated.View style={[styles.root, anchor && { transformOrigin: [`${anchor.x * 100}%`, `${anchor.y * 100}%`, 0] }, style]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.aura,
          { backgroundColor: color, boxShadow: `0 0 35px 16px ${color}` },
          glow,
        ]}
      />
      <Animated.View pointerEvents="none" style={[styles.aura, { borderWidth: 2, borderColor: color }, ring]} />
      <Animated.View pointerEvents="none" style={[styles.hitRim, { boxShadow: '0 0 20px 9px #FF3E4E' }, hitGlow]} />
      <Animated.View style={[styles.root, firing]}>{children}</Animated.View>
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  root: { width: "100%", height: "100%" },
  hitRim: {
    position: 'absolute', left: '20%', top: '13%', width: '60%', height: '77%',
    borderTopLeftRadius: '50%', borderTopRightRadius: '50%',
    borderBottomLeftRadius: '44%', borderBottomRightRadius: '44%',
    backgroundColor: 'transparent',
  },
  aura: {
    position: "absolute",
    left: "22%",
    top: "24%",
    width: "56%",
    height: "58%",
    borderRadius: 200,
  },
});
