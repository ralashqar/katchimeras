import { type ReactNode, useCallback, useEffect, useRef } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

export type RewardFlightPoint = { x: number; y: number };

export const REWARD_TOKEN_MAX_COUNT = 5;
export const REWARD_TOKEN_RISE_MS = 140;
export const REWARD_TOKEN_HOVER_MS = 150;
export const REWARD_TOKEN_FLIGHT_MS = 380;
export const REWARD_TOKEN_STAGGER_MS = 65;
export const REWARD_TOKEN_PAYOUT_DURATION_MS =
  REWARD_TOKEN_RISE_MS +
  REWARD_TOKEN_HOVER_MS +
  (REWARD_TOKEN_MAX_COUNT - 1) * REWARD_TOKEN_STAGGER_MS +
  REWARD_TOKEN_FLIGHT_MS;

const BURST_VECTORS = [
  { rotation: -12, x: -31, y: -48 },
  { rotation: -6, x: -16, y: -57 },
  { rotation: 0, x: 0, y: -62 },
  { rotation: 6, x: 16, y: -57 },
  { rotation: 12, x: 31, y: -48 },
] as const;

/** Canonical Today reward motion: burst, hover, then staggered homing flight. */
export function RewardTokenFlight({
  children,
  count,
  from,
  index,
  onArrive,
  style,
  to,
  tokenSize,
  zIndex = 1,
}: {
  children: ReactNode;
  count: number;
  from: RewardFlightPoint;
  index: number;
  onArrive: () => void;
  style?: StyleProp<ViewStyle>;
  to: RewardFlightPoint;
  tokenSize: number;
  zIndex?: number;
}) {
  const riseProgress = useSharedValue(0);
  const flightProgress = useSharedValue(0);
  const hoverPhase = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const onArriveRef = useRef(onArrive);
  onArriveRef.current = onArrive;
  const arrive = useCallback(() => onArriveRef.current(), []);
  const vector =
    BURST_VECTORS[index] ?? BURST_VECTORS[BURST_VECTORS.length - 1];

  useEffect(() => {
    const riseDuration = reduceMotion ? 100 : REWARD_TOKEN_RISE_MS;
    const hoverDuration = reduceMotion ? 90 : REWARD_TOKEN_HOVER_MS;
    const stagger = reduceMotion ? index * 28 : index * REWARD_TOKEN_STAGGER_MS;
    const flightDuration = reduceMotion ? 250 : REWARD_TOKEN_FLIGHT_MS;

    // Every token rises together and hovers as one readable reward cluster.
    // Only the flights into the destination are staggered.
    riseProgress.value = withTiming(1, {
      duration: riseDuration,
      easing: Easing.out(Easing.cubic),
    });
    hoverPhase.value = reduceMotion
      ? withTiming(1, { duration: 560, easing: Easing.linear })
      : withRepeat(
          withTiming(1, { duration: 720, easing: Easing.linear }),
          -1,
          false,
        );
    flightProgress.value = withDelay(
      riseDuration + hoverDuration + stagger,
      withTiming(
        1,
        {
          duration: flightDuration,
          easing: Easing.in(Easing.cubic),
        },
        (finished) => {
          if (finished) runOnJS(arrive)();
        },
      ),
    );

    return () => {
      cancelAnimation(flightProgress);
      cancelAnimation(hoverPhase);
      cancelAnimation(riseProgress);
    };
  }, [
    arrive,
    count,
    flightProgress,
    hoverPhase,
    index,
    reduceMotion,
    riseProgress,
  ]);

  const animatedStyle = useAnimatedStyle(() => {
    const rise = riseProgress.value;
    const flight = flightProgress.value;
    const inverse = 1 - flight;
    const burstX = from.x + vector.x;
    const burstY = from.y + vector.y;
    const controlX = (burstX + to.x) / 2 + (index % 2 === 0 ? -24 : 24);
    const controlY = Math.min(burstY, to.y) - 82 - index * 3;
    const stagedX = from.x + vector.x * rise;
    const stagedY = from.y + vector.y * rise;
    const baseX =
      flight === 0
        ? stagedX
        : inverse * inverse * burstX +
          2 * inverse * flight * controlX +
          flight * flight * to.x;
    const baseY =
      flight === 0
        ? stagedY
        : inverse * inverse * burstY +
          2 * inverse * flight * controlY +
          flight * flight * to.y;
    const hoverEnvelope = rise * inverse;
    const phase = hoverPhase.value * Math.PI * 2 + index * 0.92;
    const hoverStrength = reduceMotion ? 0.5 : 1;
    const x = baseX + Math.cos(phase) * 3 * hoverEnvelope * hoverStrength;
    const y = baseY + Math.sin(phase) * 4 * hoverEnvelope * hoverStrength;
    const scale = flight > 0 ? 1.06 - flight * 0.8 : 0.54 + rise * 0.52;
    const hoverScale =
      1 + Math.sin(phase + 0.6) * 0.035 * hoverEnvelope * hoverStrength;
    const opacity =
      rise <= 0.04
        ? rise / 0.04
        : flight < 0.88
          ? 1
          : Math.max(0, (1 - flight) / 0.12);

    return {
      opacity,
      transform: [
        { translateX: x - tokenSize / 2 },
        { translateY: y - tokenSize / 2 },
        { rotate: `${vector.rotation * (1 - flight)}deg` },
        { scale: scale * hoverScale },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.token,
        { height: tokenSize, width: tokenSize, zIndex },
        style,
        animatedStyle,
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  token: {
    alignItems: "center",
    justifyContent: "center",
    left: 0,
    position: "absolute",
    top: 0,
  },
});
