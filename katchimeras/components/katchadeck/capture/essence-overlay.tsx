import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withRepeat,
} from 'react-native-reanimated';

import type { DayScores, HomeScoreKey } from '@/types/home';

// The ambient "essence" over the live camera: soft glowing motes drifting and
// orbiting, tinted + paced by today's dominant energy. On capture they collapse
// toward the center as the moment is drawn in. Purely visual (no frame
// processing), per the capture feature's perf rule.

// Tilt-parallax + touch-attraction signals driving the field (Tier-1 "reactive"
// without needing camera frames). All center-relative; touchActive 0..1.
export type EssenceInteraction = {
  tiltX: SharedValue<number>;
  tiltY: SharedValue<number>;
  touchX: SharedValue<number>;
  touchY: SharedValue<number>;
  touchActive: SharedValue<number>;
};

type EssenceOverlayProps = {
  dayScores: DayScores | null;
  phase: 'live' | 'capturing';
  // Live scene brightness (0..1). Optional — if absent the field uses its steady
  // day-energy look (reserved for a future VisionCamera frame processor).
  liveIntensity?: SharedValue<number>;
  // Device-motion tilt + touch gathering. Optional.
  interaction?: EssenceInteraction;
};

type Mote = { angle: number; radius: number; size: number; drift: number; phase: number };

const COUNT = 46;
const ENERGY_THEME: Record<HomeScoreKey, { color: string; speed: number }> = {
  calm: { color: '#9FB8FF', speed: 0.6 },
  energy: { color: '#FFC36B', speed: 1.25 },
  social: { color: '#F4A9C0', speed: 0.95 },
  exploration: { color: '#9DDCB8', speed: 0.85 },
  focus: { color: '#B9A8FF', speed: 0.75 },
};

function dominantTheme(scores: DayScores | null) {
  if (!scores) return ENERGY_THEME.calm;
  const keys: HomeScoreKey[] = ['energy', 'calm', 'social', 'exploration', 'focus'];
  const top = keys.reduce((best, key) => (scores[key] > scores[best] ? key : best), keys[0]);
  return ENERGY_THEME[top];
}

export function EssenceOverlay({ dayScores, phase, liveIntensity, interaction }: EssenceOverlayProps) {
  const { color, speed } = dominantTheme(dayScores);
  const drift = useSharedValue(0);
  const collapse = useSharedValue(0);
  // Fallbacks when a signal isn't wired (all read-only zeros are safe to share).
  const steadyIntensity = useSharedValue(0.5);
  const zero = useSharedValue(0);
  const intensity = liveIntensity ?? steadyIntensity;
  const tiltX = interaction?.tiltX ?? zero;
  const tiltY = interaction?.tiltY ?? zero;
  const touchX = interaction?.touchX ?? zero;
  const touchY = interaction?.touchY ?? zero;
  const touchActive = interaction?.touchActive ?? zero;

  // Deterministic-enough spread; varied per mount so each open feels alive.
  const motes = useMemo<Mote[]>(
    () =>
      Array.from({ length: COUNT }, (_, i) => ({
        angle: (i / COUNT) * Math.PI * 2 + Math.random() * 0.6,
        radius: 60 + Math.random() * 150,
        size: 3 + Math.random() * 5,
        drift: 0.4 + Math.random() * 0.9,
        phase: Math.random() * Math.PI * 2,
      })),
    []
  );

  useEffect(() => {
    drift.value = withRepeat(withTiming(1, { duration: 9000 / speed, easing: Easing.linear }), -1, false);
  }, [drift, speed]);

  useEffect(() => {
    collapse.value = withTiming(phase === 'capturing' ? 1 : 0, {
      duration: phase === 'capturing' ? 360 : 600,
      easing: Easing.in(Easing.cubic),
    });
  }, [collapse, phase]);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
      {motes.map((mote, index) => (
        <EssenceMote
          key={index}
          mote={mote}
          color={color}
          drift={drift}
          collapse={collapse}
          intensity={intensity}
          tiltX={tiltX}
          tiltY={tiltY}
          touchX={touchX}
          touchY={touchY}
          touchActive={touchActive}
        />
      ))}
      <CenterAura color={color} collapse={collapse} intensity={intensity} />
    </View>
  );
}

function EssenceMote({
  mote,
  color,
  drift,
  collapse,
  intensity,
  tiltX,
  tiltY,
  touchX,
  touchY,
  touchActive,
}: {
  mote: Mote;
  color: string;
  drift: SharedValue<number>;
  collapse: SharedValue<number>;
  intensity: SharedValue<number>;
  tiltX: SharedValue<number>;
  tiltY: SharedValue<number>;
  touchX: SharedValue<number>;
  touchY: SharedValue<number>;
  touchActive: SharedValue<number>;
}) {
  // Deeper motes (bigger orbit) parallax more as you tilt — the depth illusion.
  const depth = mote.radius / 200;

  const style = useAnimatedStyle(() => {
    const spin = mote.phase + drift.value * Math.PI * 2 * mote.drift;
    const radius = mote.radius * (1 - collapse.value);
    let x = Math.cos(spin) * radius;
    // gentle upward float layered on the orbit
    let y = Math.sin(spin) * radius - Math.sin(drift.value * Math.PI * 2 + mote.phase) * 10 * (1 - collapse.value);

    // Tilt parallax: the field shifts against the phone's lean, deeper motes more.
    x += tiltX.value * 30 * depth;
    y += tiltY.value * 30 * depth;

    // Touch attraction: motes gather toward the finger while it's down.
    const gather = touchActive.value * 0.6;
    x += (touchX.value - x) * gather;
    y += (touchY.value - y) * gather;

    const twinkle = 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(drift.value * Math.PI * 4 + mote.phase));
    const live = 0.55 + 0.7 * intensity.value;
    return {
      opacity: twinkle * live * (1 - collapse.value * 0.85),
      transform: [{ translateX: x }, { translateY: y }, { scale: (0.85 + 0.4 * intensity.value) * (1 - collapse.value * 0.4) }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.mote,
        { width: mote.size, height: mote.size, borderRadius: mote.size, backgroundColor: color, boxShadow: `0 0 8px ${color}` },
        style,
      ]}
    />
  );
}

function CenterAura({
  color,
  collapse,
  intensity,
}: {
  color: string;
  collapse: SharedValue<number>;
  intensity: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: 0.1 + intensity.value * 0.16 + collapse.value * 0.5,
    transform: [{ scale: 0.8 + intensity.value * 0.15 + collapse.value * 0.6 }],
  }));
  return <Animated.View style={[styles.aura, { backgroundColor: `${color}55`, boxShadow: `0 0 60px ${color}` }, style]} />;
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mote: {
    position: 'absolute',
  },
  aura: {
    borderRadius: 999,
    height: 150,
    position: 'absolute',
    width: 150,
  },
});
