import { Image } from 'expo-image';
import { memo, useEffect, useMemo, useState, type RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
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
  if (target.kind === 'haven_gateway') return 'shared-world:steppling-home';
  if (target.kind === 'haven_tile') return `tile:${target.characterId}`;
  if (target.kind === 'haven_tile_hud') return `hud:${target.characterId}`;
  if (target.kind === 'haven_upgrade_button') return `upgrade:${target.characterId}`;
  if (target.kind === 'haven_garden_button') return `garden-button:${target.characterId}`;
  if (target.kind === 'haven_garden_plant_button') return `garden-plant-button:${target.characterId}`;
  if (target.kind === 'haven_garden_order') return `garden-order:${target.characterId}:${target.orderId}`;
  if (target.kind === 'haven_garden_plot') return `garden-plot:${target.characterId}:${target.slotId}`;
  if (target.kind === 'haven_guide') return 'haven-guide';
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
  const reduceMotion = useReducedMotion();
  const [layout, setLayout] = useState<{ cueFocus: Frame | null; focus: Frame; screen: Frame } | null>(null);
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
      const cueFrame = cue?.kind === 'tap'
        ? await measure(targetRefs.current.get(havenFtueTargetKey(cue.target) ?? '') ?? null)
        : null;
      if (cancelled || frames.some((frame) => frame == null) || (cue?.kind === 'tap' && !cueFrame)) return;
      const valid = frames as Frame[];
      const padding = spotlight?.padding ?? 6;
      const left = Math.max(screen.x, Math.min(...valid.map((frame) => frame.x)) - padding);
      const top = Math.max(screen.y, Math.min(...valid.map((frame) => frame.y)) - padding);
      const right = Math.min(screen.x + screen.width, Math.max(...valid.map((frame) => frame.x + frame.width)) + padding);
      const bottom = Math.min(screen.y + screen.height, Math.max(...valid.map((frame) => frame.y + frame.height)) + padding);
      setLayout({
        cueFocus: cueFrame ? {
          x: cueFrame.x - screen.x,
          y: cueFrame.y - screen.y,
          width: cueFrame.width,
          height: cueFrame.height,
        } : null,
        focus: { x: left - screen.x, y: top - screen.y, width: right - left, height: bottom - top },
        screen: { x: 0, y: 0, width: screen.width, height: screen.height },
      });
    })();
    return () => { cancelled = true; };
  }, [configKey, cue, screenRef, spotlight, targetRefs, targetRevision]);

  if (!layout) return null;
  return (
    <Animated.View
      accessibilityElementsHidden
      entering={FadeIn.duration(reduceMotion ? 80 : 180)}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.overlay}>
      <Spotlight focus={layout.focus} opacity={spotlight?.dimOpacity ?? 0.62} radius={spotlight?.radius ?? 16} screen={layout.screen} />
      {cue?.kind === 'tap' ? <Finger focus={layout.cueFocus ?? layout.focus} resetKey={`${configKey}:${targetRevision}`} /> : null}
    </Animated.View>
  );
});

function Spotlight({ focus, opacity, radius, screen }: { focus: Frame; opacity: number; radius: number; screen: Frame }) {
  const cornerRadius = Math.min(radius, focus.width / 2, focus.height / 2);
  const spreadRadius = Math.max(1, Math.hypot(screen.width, screen.height));
  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[
        styles.dimMask,
        {
          borderRadius: cornerRadius,
          boxShadow: `0 0 0 ${spreadRadius}px rgba(11,9,24,${opacity})`,
          height: focus.height,
          left: focus.x,
          top: focus.y,
          width: focus.width,
        },
      ]} />
      <View style={[styles.ring, { borderRadius: cornerRadius, height: focus.height, left: focus.x, top: focus.y, width: focus.width }]} />
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
  overlay: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', zIndex: 80 },
  dimMask: {
    backgroundColor: 'transparent',
    borderCurve: 'continuous',
    position: 'absolute',
  },
  ring: {
    borderColor: 'rgba(214,255,190,0.96)',
    borderCurve: 'continuous',
    borderWidth: 2,
    boxShadow: '0 0 18px rgba(154,239,112,0.9)',
    position: 'absolute',
  },
  hand: { position: 'absolute' },
});
