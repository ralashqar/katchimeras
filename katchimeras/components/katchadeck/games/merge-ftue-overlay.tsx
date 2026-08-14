import { Canvas, FillType, Path, Skia } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState, type RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { FtueCueDefinition, FtueSpotlightDefinition, FtueTarget } from '@/features/onboarding/ftue-types';
import { resolveFtueBoardCell } from '@/features/onboarding/merge-ftue';
import type { MergeWorldState } from '@/types/merge-world';
import { mergeCellOrigin } from '@/utils/merge-world/board-geometry';

import type { MergeBoardScreenMetrics } from './feastle-persistent-merge-board';

const HAND_ART = require('../../../assets/images/katchimeras/merge-world/ui/ftue-hand.webp');
const HAND_SIZE = 112;
const HAND_TIP_X = 0.28;
const HAND_TIP_Y = 0.2;

type Point = { x: number; y: number };
type Frame = Point & { height: number; width: number };
type CuePoints = { from: Point; to: Point };
type OverlayLayout = {
  configKey: string;
  presentationKey: string;
  targetRevision: number;
  cue: FtueCueDefinition | null;
  cuePoints: CuePoints | null;
  screen: { height: number; width: number };
  spotlightFrames: Frame[];
  spotlightOpacity: number;
  spotlightRadius: number;
};

export function MergeFtueOverlay({
  blockedPulseNonce,
  boardMetrics,
  cue,
  layoutNonce,
  screenRef,
  railTargetRefs,
  spotlight,
  state,
  targetRevision,
}: {
  blockedPulseNonce: number;
  boardMetrics: MergeBoardScreenMetrics | null;
  cue: FtueCueDefinition | null;
  layoutNonce: number;
  screenRef: RefObject<View | null>;
  railTargetRefs: RefObject<Map<string, View>>;
  spotlight: FtueSpotlightDefinition | null;
  state: MergeWorldState;
  targetRevision: number;
}) {
  const [layout, setLayout] = useState<OverlayLayout | null>(null);
  const cueKey = useMemo(() => cue ? JSON.stringify(cue) : 'none', [cue]);
  const spotlightKey = useMemo(() => spotlight ? JSON.stringify(spotlight) : 'none', [spotlight]);
  const configKey = `${cueKey}|${spotlightKey}`;

  useEffect(() => {
    let cancelled = false;
    const frame = requestAnimationFrame(async () => {
      const screen = await measureView(screenRef.current);
      if (!screen || (!cue && !spotlight)) {
        if (!cancelled) setLayout(null);
        return;
      }

      const resolve = (target: FtueTarget) => resolveTargetFrame(
        target,
        state,
        boardMetrics,
        railTargetRefs.current,
        screen,
      );

      let cuePoints: CuePoints | null = null;
      if (cue) {
        const fromFrame = await resolve(cue.kind === 'drag' ? cue.from : cue.target);
        const toFrame = cue.kind === 'drag' ? await resolve(cue.to) : fromFrame;
        if (fromFrame && toFrame) {
          cuePoints = { from: frameCenter(fromFrame), to: frameCenter(toFrame) };
        }
      }

      let spotlightFrames: Frame[] = [];
      if (spotlight) {
        const resolved = await Promise.all(spotlight.targets.map(resolve));
        // Never dim the whole game if a declared cutout has not mounted yet.
        // The next layout/target revision will retry once that target exists.
        if (resolved.every((target): target is Frame => target != null)) {
          const grouped = spotlight.grouping === 'bounding_rect'
            ? [boundingFrame(resolved)]
            : resolved;
          spotlightFrames = grouped.map((target) => paddedFrame(
            target,
            spotlight.padding ?? 4,
            screen.width,
            screen.height,
          ));
        }
      }

      // Keep the last valid presentation mounted while newly declared targets
      // are entering or their native refs are being measured. This lets its
      // keyed exit animation finish instead of flashing the undimmed board.
      if ((cue && !cuePoints) || (spotlight && spotlightFrames.length === 0)) return;

      if (!cancelled) {
        // The same source/target pair can appear in consecutive FTUE nodes.
        // Include the node/target revision so its guide always gets a fresh
        // animation timeline instead of inheriting the previous loop's time.
        const presentationKey = `${targetRevision}|${configKey}|${spotlightFrames.map(frameSignature).join('|')}|${cuePoints ? `${pointSignature(cuePoints.from)}>${pointSignature(cuePoints.to)}` : 'no-cue'}`;
        setLayout({
          configKey,
          presentationKey,
          targetRevision,
          cue,
          cuePoints,
          screen: { height: screen.height, width: screen.width },
          spotlightFrames,
          spotlightOpacity: spotlight?.dimOpacity ?? 0.64,
          spotlightRadius: spotlight?.radius ?? 12,
        });
      }
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [
    boardMetrics,
    cue,
    cueKey,
    configKey,
    layoutNonce,
    screenRef,
    railTargetRefs,
    spotlight,
    spotlightKey,
    state,
    state.revision,
    targetRevision,
  ]);

  const currentLayout = layout;
  const showSpotlight = Boolean(currentLayout?.spotlightFrames.length);
  // Do not leave the previous node's moving hand visible while the new
  // source and target are being measured. The new keyed cue mounts at time 0.
  const showCue = Boolean(
    currentLayout?.configKey === configKey
      && currentLayout.targetRevision === targetRevision
      && currentLayout.cue
      && currentLayout.cuePoints,
  );
  if (!currentLayout || (!showSpotlight && !showCue)) return null;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.overlay}>
      {showSpotlight ? (
        <FtueSpotlight
          frames={currentLayout.spotlightFrames}
          key={`spotlight:${currentLayout.presentationKey}`}
          opacity={currentLayout.spotlightOpacity}
          radius={currentLayout.spotlightRadius}
          screen={currentLayout.screen}
        />
      ) : null}
      {showCue && currentLayout.cue && currentLayout.cuePoints ? (
        <FtueFingerCue
          blockedPulseNonce={blockedPulseNonce}
          cue={currentLayout.cue}
          key={`cue:${currentLayout.presentationKey}`}
          points={currentLayout.cuePoints}
          resetKey={currentLayout.presentationKey}
        />
      ) : null}
    </View>
  );
}

function FtueSpotlight({ frames, opacity, radius, screen }: {
  frames: Frame[];
  opacity: number;
  radius: number;
  screen: { height: number; width: number };
}) {
  const path = useMemo(() => {
    const mask = Skia.Path.Make();
    mask.addRect({ x: 0, y: 0, width: screen.width, height: screen.height });
    for (const frame of frames) {
      const corner = Math.min(radius, frame.height / 2, frame.width / 2);
      mask.addRRect({ rect: frame, rx: corner, ry: corner });
    }
    mask.setFillType(FillType.EvenOdd);
    return mask;
  }, [frames, radius, screen.height, screen.width]);

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(140)}
      style={StyleSheet.absoluteFill}>
      <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Path color={`rgba(11, 9, 24, ${opacity})`} path={path} />
      </Canvas>
      {frames.map((frame, index) => (
        <View
          key={`${index}:${frame.x}:${frame.y}`}
          style={[
            styles.focusRing,
            {
              borderRadius: Math.min(radius, frame.height / 2, frame.width / 2),
              height: frame.height,
              left: frame.x,
              top: frame.y,
              width: frame.width,
            },
          ]}
        />
      ))}
    </Animated.View>
  );
}

function FtueFingerCue({ blockedPulseNonce, cue, points, resetKey }: {
  blockedPulseNonce: number;
  cue: FtueCueDefinition;
  points: CuePoints;
  resetKey: string;
}) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const correction = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(progress);
    progress.value = 0;
    if (reduceMotion) return;
    progress.value = withDelay(260, withRepeat(withTiming(1, {
      duration: cue.kind === 'drag' ? 1_650 : 1_180,
      easing: Easing.inOut(Easing.cubic),
    }), -1, false));
    return () => {
      cancelAnimation(progress);
      progress.value = 0;
    };
  }, [cue.kind, progress, reduceMotion, resetKey]);

  useEffect(() => {
    if (!blockedPulseNonce) return;
    cancelAnimation(correction);
    correction.value = withSequence(
      withTiming(1, { duration: 90 }),
      withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) }),
    );
    return () => cancelAnimation(correction);
  }, [blockedPulseNonce, correction]);

  const travelX = points.to.x - points.from.x;
  const travelY = points.to.y - points.from.y;
  const animatedStyle = useAnimatedStyle(() => {
    const value = progress.value;
    const drag = cue.kind === 'drag';
    const motion = reduceMotion ? 0 : value;
    return {
      opacity: reduceMotion ? 1 : drag
        ? interpolate(value, [0, 0.08, 0.72, 0.86, 1], [0, 1, 1, 0, 0])
        : interpolate(value, [0, 0.12, 0.72, 1], [0.82, 1, 1, 0.82]),
      transform: [
        { translateX: drag ? travelX * interpolate(motion, [0, 0.12, 0.72, 1], [0, 0, 1, 1]) : 0 },
        { translateY: drag ? travelY * interpolate(motion, [0, 0.12, 0.72, 1], [0, 0, 1, 1]) : interpolate(motion, [0, 0.45, 0.72, 1], [5, -5, -5, 5]) },
        { scale: 1 + correction.value * 0.13 },
      ],
    };
  }, [cue.kind, reduceMotion, travelX, travelY]);

  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)} style={[
      styles.hand,
      {
        left: points.from.x - HAND_SIZE * HAND_TIP_X,
        top: points.from.y - HAND_SIZE * HAND_TIP_Y,
      },
      animatedStyle,
    ]}>
      <Image
        accessibilityIgnoresInvertColors
        allowDownscaling={false}
        cachePolicy="memory-disk"
        contentFit="contain"
        source={HAND_ART}
        style={styles.handArt}
        transition={0}
      />
    </Animated.View>
  );
}

function frameSignature(frame: Frame) {
  return `${Math.round(frame.x)}:${Math.round(frame.y)}:${Math.round(frame.width)}:${Math.round(frame.height)}`;
}

function pointSignature(point: Point) {
  return `${Math.round(point.x)}:${Math.round(point.y)}`;
}

async function resolveTargetFrame(
  target: FtueTarget,
  state: MergeWorldState,
  boardMetrics: MergeBoardScreenMetrics | null,
  railTargetRefs: Map<string, View>,
  screen: Frame,
): Promise<Frame | null> {
  if (target.kind === 'order_serve' || target.kind === 'tray_chat_note') {
    const targetKey = target.kind === 'order_serve'
      ? `order-serve:${target.orderId}`
      : `chat-note:${target.noteId}`;
    const measured = await measureView(railTargetRefs.get(targetKey) ?? null);
    return measured ? {
      height: measured.height,
      width: measured.width,
      x: measured.x - screen.x,
      y: measured.y - screen.y,
    } : null;
  }
  if (!boardMetrics) return null;
  const cell = resolveFtueBoardCell(state, target);
  if (cell == null) return null;
  const origin = mergeCellOrigin(boardMetrics.geometry, cell);
  return {
    height: boardMetrics.geometry.cellSize,
    width: boardMetrics.geometry.cellSize,
    x: boardMetrics.x + origin.x - screen.x,
    y: boardMetrics.y + origin.y - screen.y,
  };
}

function frameCenter(frame: Frame): Point {
  return { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 };
}

function boundingFrame(frames: readonly Frame[]): Frame {
  const left = Math.min(...frames.map((frame) => frame.x));
  const top = Math.min(...frames.map((frame) => frame.y));
  const right = Math.max(...frames.map((frame) => frame.x + frame.width));
  const bottom = Math.max(...frames.map((frame) => frame.y + frame.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function paddedFrame(frame: Frame, padding: number, screenWidth: number, screenHeight: number): Frame {
  const x = Math.max(0, frame.x - padding);
  const y = Math.max(0, frame.y - padding);
  return {
    x,
    y,
    width: Math.max(0, Math.min(screenWidth - x, frame.width + padding * 2)),
    height: Math.max(0, Math.min(screenHeight - y, frame.height + padding * 2)),
  };
}

function measureView(view: View | null): Promise<Frame | null> {
  return new Promise((resolve) => {
    if (!view) {
      resolve(null);
      return;
    }
    view.measureInWindow((x, y, width, height) => resolve(width > 0 && height > 0 ? { height, width, x, y } : null));
  });
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 250 },
  focusRing: {
    borderColor: 'rgba(196, 250, 255, 0.96)',
    borderWidth: 2,
    position: 'absolute',
    shadowColor: '#82EDFF',
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 7,
  },
  hand: { height: HAND_SIZE, position: 'absolute', width: HAND_SIZE },
  handArt: { height: '100%', width: '100%' },
});
