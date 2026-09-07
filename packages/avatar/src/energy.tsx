import { useEffect, type ReactNode } from "react";
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
  hurt?: boolean;
  reduceMotion?: boolean;
  color?: string;
  paused?: boolean;
};
/** Passive, host-driven energy. No FTUE interaction, persistence, or app policy. */
export function EggEnergy({
  children,
  energy,
  pulseKey = 0,
  hurt = false,
  reduceMotion = false,
  color = "#FFE599",
  paused = false,
}: EggEnergyProps) {
  const breathe = useSharedValue(0);
  const pulse = useSharedValue(0);
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
              energy * 0.08 + breathe.value * 0.015 + pulse.value * 0.025,
            ),
      },
      {
        rotate: `${reduceMotion ? 0 : (hurt ? 4 : energy > 0.6 ? 1.2 : 0) * Math.sin(breathe.value * Math.PI * 2)}deg`,
      },
    ],
  }));
  const glow = useAnimatedStyle(() => ({
    opacity: energy * (0.18 + breathe.value * 0.12 + pulse.value * 0.15),
    transform: [{ scale: 0.85 + breathe.value * 0.08 }],
  }));
  return (
    <Animated.View style={[styles.root, style]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.aura,
          { backgroundColor: color, boxShadow: `0 0 35px 16px ${color}` },
          glow,
        ]}
      />
      <View style={styles.root}>{children}</View>
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  root: { width: "100%", height: "100%" },
  aura: {
    position: "absolute",
    left: "22%",
    top: "24%",
    width: "56%",
    height: "58%",
    borderRadius: 200,
  },
});
