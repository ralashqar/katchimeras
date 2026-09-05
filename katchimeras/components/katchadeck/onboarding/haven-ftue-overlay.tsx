import { FTUE_SCENE_LAYERS } from '@/constants/ftue-scene-layers';
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
import { roundedMultiCutoutSegments } from '@/features/onboarding/spotlight-geometry';

const HAND_ART = require('../../../assets/images/katchimeras/merge-world/ui/ftue-hand.webp');
type Frame = { height: number; width: number; x: number; y: number };

export function havenFtueTargetKey(target: FtueTarget): string | null {
  if (target.kind === 'haven_gateway') return 'shared-world:steppling-home';
  if (target.kind === 'haven_tile') return `tile:${target.characterId}`;
  if (target.kind === 'haven_tile_hud') return `hud:${target.characterId}`;
  if (target.kind === 'haven_upgrade_button') return `upgrade:${target.characterId}`;
  if (target.kind === 'haven_garden_button') return `garden-button:${target.characterId}`;
  if (target.kind === 'haven_garden_cluster') return `garden-cluster:${target.characterId}`;
  if (target.kind === 'haven_garden_plant_button') return `garden-plant-button:${target.characterId}`;
  if (target.kind === 'haven_garden_order') return `garden-order:${target.characterId}:${target.orderId}`;
  if (target.kind === 'haven_garden_plot') return `garden-plot:${target.characterId}:${target.slotId}`;
  if (target.kind === 'haven_guide') return 'haven-guide';
  if (target.kind === 'haven_world') return 'world';
  return null;
}

export const HavenFtueOverlay = memo(function HavenFtueOverlay({
  cue,
  fingerPlacement = 'center',
  screenRef,
  spotlight,
  targetRefs,
  targetRevision,
}: {
  cue: FtueCueDefinition | null;
  fingerPlacement?: 'center' | 'below';
  screenRef: RefObject<View | null>;
  spotlight: FtueSpotlightDefinition | null;
  targetRefs: RefObject<Map<string, View>>;
  targetRevision: number;
}) {
  const reduceMotion = useReducedMotion();
  const [layout, setLayout] = useState<{ cueFocus: Frame | null; focus: Frame; focuses: Frame[]; screen: Frame } | null>(null);
  const configKey = useMemo(() => JSON.stringify([cue, spotlight]), [cue, spotlight]);

  useEffect(() => {
    let cancelled = false;
    let retryFrame: number | undefined;
    const retry = () => {
      if (!cancelled) retryFrame = requestAnimationFrame(() => { void measureTargets(); });
    };
    const measureTargets = async () => {
      if (!cue && !spotlight) {
        setLayout(null);
        return;
      }
      const screen = await measure(screenRef.current);
      const targets = spotlight?.targets ?? (cue?.kind === 'tap' ? [cue.target] : []);
      if (cancelled || targets.length === 0) return;
      if (!screen) { retry(); return; }
      const frames = await Promise.all(targets.map(async (target) => {
        const key = havenFtueTargetKey(target);
        return key ? measure(targetRefs.current.get(key) ?? null) : null;
      }));
      const cueFrame = cue?.kind === 'tap'
        ? await measure(targetRefs.current.get(havenFtueTargetKey(cue.target) ?? '') ?? null)
        : null;
      if (cancelled) return;
      // Native refs may exist before their first layout. Retry instead of
      // leaving this authored spotlight invisible for the rest of the step.
      if (frames.some((frame) => frame == null) || (cue?.kind === 'tap' && !cueFrame)) { retry(); return; }
      const valid = frames as Frame[];
      const grouped = spotlight?.targetGroups?.map((indices) => {
        const members = indices.flatMap((index) => valid[index] ? [valid[index]] : []);
        if (!members.length) return null;
        const x = Math.min(...members.map((frame) => frame.x));
        const y = Math.min(...members.map((frame) => frame.y));
        return { x, y, width: Math.max(...members.map((frame) => frame.x + frame.width)) - x,
          height: Math.max(...members.map((frame) => frame.y + frame.height)) - y };
      }).filter((frame): frame is Frame => frame !== null) ?? valid;
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
        focuses: spotlight?.grouping === 'individual' ? grouped.map((frame) => {
          const x = Math.max(0, frame.x - screen.x - padding);
          const y = Math.max(0, frame.y - screen.y - padding);
          return { x, y, width: Math.min(screen.width, frame.x - screen.x + frame.width + padding) - x,
            height: Math.min(screen.height, frame.y - screen.y + frame.height + padding) - y };
        }) : [{ x: left - screen.x, y: top - screen.y, width: right - left, height: bottom - top }],
        screen: { x: 0, y: 0, width: screen.width, height: screen.height },
      });
    };
    retry();
    return () => {
      cancelled = true;
      if (retryFrame !== undefined) cancelAnimationFrame(retryFrame);
    };
  }, [configKey, cue, screenRef, spotlight, targetRefs, targetRevision]);

  if (!layout) return null;
  return (
    <Animated.View
      accessibilityElementsHidden
      entering={FadeIn.duration(reduceMotion ? 80 : 180)}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.overlay}>
      {layout.focuses.length > 1
        ? <MultipleSpotlights frames={layout.focuses} opacity={spotlight?.dimOpacity ?? 0.62} radius={spotlight?.radius ?? 16} screen={layout.screen} />
        : <Spotlight focus={layout.focus} opacity={spotlight?.dimOpacity ?? 0.62} radius={spotlight?.radius ?? 16} screen={layout.screen} />}
      {cue?.kind === 'tap' ? <Finger focus={layout.cueFocus ?? layout.focus} placement={fingerPlacement} resetKey={`${configKey}:${targetRevision}`} /> : null}
    </Animated.View>
  );
});

function MultipleSpotlights({ frames, opacity, radius, screen }: { frames: Frame[]; opacity: number; radius: number; screen: Frame }) {
  const segments = useMemo(() => roundedMultiCutoutSegments(frames, radius, screen), [frames, radius, screen]);
  return <View style={StyleSheet.absoluteFill}>
    {segments.map((segment, index) => <View key={index} style={{ position: 'absolute', left: segment.x, top: segment.y, width: segment.width, height: segment.height, backgroundColor: `rgba(11,9,24,${opacity})` }} />)}
    {frames.map((frame, index) => <View key={index} style={[styles.ring, { left: frame.x, top: frame.y, width: frame.width, height: frame.height, borderRadius: Math.min(radius, frame.width / 2, frame.height / 2) }]} />)}
  </View>;
}

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

function Finger({ focus, resetKey, placement }: { focus: Frame; resetKey: string; placement: 'center' | 'below' }) {
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
    <Animated.View style={[styles.hand, { height: size, left: focus.x + focus.width / 2 - size * 0.28, top: focus.y + (placement === 'below' ? focus.height + 8 : focus.height / 2) - size * 0.2, width: size }, animatedStyle]}>
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
  overlay: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', zIndex: FTUE_SCENE_LAYERS.spotlight },
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
