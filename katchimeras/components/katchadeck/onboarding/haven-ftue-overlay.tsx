import { Image } from 'expo-image';
import { memo, useEffect, useMemo, useState, type RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { FtueCueDefinition, FtueSpotlightDefinition, FtueTarget } from '@/features/onboarding/ftue-types';

const HAND_ART = require('../../../assets/images/katchimeras/merge-world/ui/ftue-hand.webp');
type Frame = { height: number; width: number; x: number; y: number };

export function havenFtueTargetKey(target: FtueTarget): string | null {
  if (target.kind === 'haven_tile') return `tile:${target.characterId}`;
  if (target.kind === 'haven_tile_hud') return `hud:${target.characterId}`;
  if (target.kind === 'haven_upgrade_button') return `upgrade:${target.characterId}`;
  if (target.kind === 'haven_world') return 'world';
  return null;
}

export const HavenFtueOverlay = memo(function HavenFtueOverlay({
  cue,
  screenRef,
  spotlight,
  targetRefs,
  targetRevision,
}: {
  cue: FtueCueDefinition | null;
  screenRef: RefObject<View | null>;
  spotlight: FtueSpotlightDefinition | null;
  targetRefs: RefObject<Map<string, View>>;
  targetRevision: number;
}) {
  const [layout, setLayout] = useState<{ focus: Frame; screen: Frame } | null>(null);
  const configKey = useMemo(() => JSON.stringify([cue, spotlight]), [cue, spotlight]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!cue && !spotlight) {
        setLayout(null);
        return;
      }
      const screen = await measure(screenRef.current);
      const targets = spotlight?.targets ?? (cue?.kind === 'tap' ? [cue.target] : []);
      if (!screen || targets.length === 0) return;
      const frames = await Promise.all(targets.map(async (target) => {
        const key = havenFtueTargetKey(target);
        return key ? measure(targetRefs.current.get(key) ?? null) : null;
      }));
      if (cancelled || frames.some((frame) => frame == null)) return;
      const valid = frames as Frame[];
      const padding = spotlight?.padding ?? 6;
      const left = Math.max(screen.x, Math.min(...valid.map((frame) => frame.x)) - padding);
      const top = Math.max(screen.y, Math.min(...valid.map((frame) => frame.y)) - padding);
      const right = Math.min(screen.x + screen.width, Math.max(...valid.map((frame) => frame.x + frame.width)) + padding);
      const bottom = Math.min(screen.y + screen.height, Math.max(...valid.map((frame) => frame.y + frame.height)) + padding);
      setLayout({
        focus: { x: left - screen.x, y: top - screen.y, width: right - left, height: bottom - top },
        screen: { x: 0, y: 0, width: screen.width, height: screen.height },
      });
    })();
    return () => { cancelled = true; };
  }, [configKey, cue, screenRef, spotlight, targetRefs, targetRevision]);

  if (!layout) return null;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={styles.overlay}>
      <Spotlight focus={layout.focus} opacity={spotlight?.dimOpacity ?? 0.62} radius={spotlight?.radius ?? 16} />
      {cue?.kind === 'tap' ? <Finger focus={layout.focus} resetKey={`${configKey}:${targetRevision}`} /> : null}
    </View>
  );
});

function Spotlight({ focus, opacity, radius }: { focus: Frame; opacity: number; radius: number }) {
  const dim = { backgroundColor: `rgba(11,9,24,${opacity})`, position: 'absolute' as const };
  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[dim, { height: focus.y, left: 0, right: 0, top: 0 }]} />
      <View style={[dim, { bottom: 0, left: 0, right: 0, top: focus.y + focus.height }]} />
      <View style={[dim, { height: focus.height, left: 0, top: focus.y, width: focus.x }]} />
      <View style={[dim, { height: focus.height, left: focus.x + focus.width, right: 0, top: focus.y }]} />
      <View style={[styles.ring, { borderRadius: radius, height: focus.height, left: focus.x, top: focus.y, width: focus.width }]} />
    </View>
  );
}

function Finger({ focus, resetKey }: { focus: Frame; resetKey: string }) {
  const reduceMotion = useReducedMotion();
  const press = useSharedValue(0);
  useEffect(() => {
    press.value = reduceMotion
      ? 0
      : withDelay(280, withRepeat(withSequence(
        withTiming(1, { duration: 260, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 560 }),
      ), -1));
  }, [press, reduceMotion, resetKey]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 0.9 : 1,
    transform: [
      { translateY: press.value * 8 },
      { scale: 1 - press.value * 0.08 },
    ],
  }));
  const size = 92;
  return (
    <Animated.View style={[styles.hand, { height: size, left: focus.x + focus.width / 2 - size * 0.28, top: focus.y + focus.height / 2 - size * 0.2, width: size }, animatedStyle]}>
      <Image contentFit="contain" source={HAND_ART} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

function measure(view: View | null): Promise<Frame | null> {
  return new Promise((resolve) => {
    if (!view) {
      resolve(null);
      return;
    }
    view.measureInWindow((x, y, width, height) => resolve(
      width > 0 && height > 0 ? { x, y, width, height } : null,
    ));
  });
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 80 },
  ring: {
    borderColor: 'rgba(214,255,190,0.96)',
    borderWidth: 2,
    boxShadow: '0 0 18px rgba(154,239,112,0.9)',
    position: 'absolute',
  },
  hand: { position: 'absolute' },
});
