import { createCinematicEnvironment } from "@incubator/environments/cinematic";
import { usePresentedAssetReadiness } from "@incubator/presentation/presented-asset-readiness";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, type ReactNode } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, useReducedMotion, withSequence, withTiming, cancelAnimation } from 'react-native-reanimated';
import { BACKGROUNDS } from "../data/art";

const { TodayExplorationBackground } = createCinematicEnvironment({
  backgrounds: BACKGROUNDS,
  progressions: {},
  todayScene: {
    homeExplorationBackground: {
      _comment: "Egg Snap fixed combat stage",
      eggContactYRatio: 0.7,
      eggWidthViewportHeightRatio: 0.3,
      eggWidthViewportWidthRatio: 0.4,
      creatureContactYRatio: 0.35,
      creatureWidthViewportHeightRatio: 0.18,
      creatureWidthViewportWidthRatio: 0.22,
      overscrollResistance: 0.2,
      pageTransitionDurationMs: 350,
      quickSwipe: { minDistance: 60, minVelocity: 400 },
      resetSpring: { damping: 20, mass: 1, stiffness: 150 },
    },
  },
});
export function Scene({
  environment = "mossprout",
  children,
  onReady,
  impact = false,
  impulse,
}: {
  environment?: keyof typeof BACKGROUNDS;
  children: ReactNode;
  onReady?: (ready: boolean) => void;
  impact?: boolean;
  impulse?: { id: number; strength: number };
}) {
  const recoil = useSharedValue(0);
  const reduced = useReducedMotion();
  const lastImpulse = useRef<number | undefined>(undefined);
  const impulseId = impulse?.id;
  const impulseStrength = impulse?.strength ?? 0;
  useEffect(() => {
    const strength = impact ? 1 : impulseId !== lastImpulse.current ? impulseStrength : 0;
    if (impulseId !== undefined) lastImpulse.current = impulseId;
    if (strength && !reduced) recoil.value = withSequence(withTiming(4 * strength, {duration: 45}), withTiming(-2 * strength, {duration: 65}), withTiming(0, {duration: 100}));
    else recoil.value = 0;
    return () => cancelAnimation(recoil);
  }, [impact, impulseId, impulseStrength, reduced, recoil]);
  // Only scenery recoils: footprints and their aiming coordinates remain stable.
  const recoilStyle = useAnimatedStyle(() => ({ transform: [{translateY: recoil.value}, {scale: 1.015}] }));
  const { height, width } = useWindowDimensions();
  const readiness = usePresentedAssetReadiness(true, {
    label: `Egg Snap ${environment}`,
  });
  useEffect(() => {
    onReady?.(readiness.ready);
  }, [onReady, readiness.ready]);
  return (
    <View style={{ flex: 1, backgroundColor: "#132B25" }}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, recoilStyle]}>
        <TodayExplorationBackground
          backgroundKey={environment}
          imageSize={Math.max(height, width)}
          contentFit="cover"
          onDisplay={readiness.onDisplay}
          onError={readiness.onError}
        />
      </Animated.View>
      <LinearGradient
        pointerEvents="none"
        colors={[
          "rgba(9,28,24,0.58)",
          "rgba(9,28,24,0.06)",
          "rgba(9,28,24,0.94)",
        ]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}
