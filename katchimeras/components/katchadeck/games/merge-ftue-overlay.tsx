import { BlurMask, Canvas, FillType, Path, usePathValue } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { memo, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
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
const HAND_TIP_X = 0.28;
const HAND_TIP_Y = 0.2;

export type MergeFtueVisualTheme = {
  dimColor: string;
  dragDurationMs: number;
  fingerDelayMs: number;
  fingerSize: number;
  focusRingColor: string;
  focusRingShadowColor: string;
  spotlightTransitionDurationMs: number;
  tapDurationMs: number;
};

export const DEFAULT_MERGE_FTUE_VISUAL_THEME: MergeFtueVisualTheme = {
  dimColor: '11, 9, 24',
  dragDurationMs: 1_650,
  fingerDelayMs: 260,
  fingerSize: 112,
  focusRingColor: 'rgba(196, 250, 255, 0.96)',
  focusRingShadowColor: '#82EDFF',
  spotlightTransitionDurationMs: 420,
  tapDurationMs: 1_180,
};

type Point = { x: number; y: number };
type Frame = Point & { height: number; width: number };
type CuePoints = { from: Point; to: Point };
type OverlayLayout = {
  configKey: string;
  targetRevision: number;
  cue: FtueCueDefinition | null;
  cuePoints: CuePoints | null;
  screen: { height: number; width: number };
  spotlightFrames: Frame[];
  spotlightOpacity: number;
  spotlightRadius: number;
};

type MergeFtueOverlayProps = {
  blockedPulseNonce: number;
  boardMetrics: MergeBoardScreenMetrics | null;
  cue: FtueCueDefinition | null;
  layoutNonce: number;
  screenRef: RefObject<View | null>;
  railTargetRefs: RefObject<Map<string, View>>;
  spotlight: FtueSpotlightDefinition | null;
  state: MergeWorldState;
  targetRevision: number;
  visualTheme?: Partial<MergeFtueVisualTheme>;
};

export const MergeFtueOverlay = memo(function MergeFtueOverlay({
  blockedPulseNonce,
  boardMetrics,
  cue,
  layoutNonce,
  screenRef,
  railTargetRefs,
  spotlight,
  state,
  targetRevision,
  visualTheme,
}: MergeFtueOverlayProps) {
  const [layout, setLayout] = useState<OverlayLayout | null>(null);
  const stateRef = useRef(state);
  const measurementGenerationRef = useRef(0);
  stateRef.current = state;
  const theme = useMemo(() => ({ ...DEFAULT_MERGE_FTUE_VISUAL_THEME, ...visualTheme }), [visualTheme]);
  const cueKey = useMemo(() => cue ? JSON.stringify(cue) : 'none', [cue]);
  const spotlightKey = useMemo(() => spotlight ? JSON.stringify(spotlight) : 'none', [spotlight]);
  const configKey = `${cueKey}|${spotlightKey}`;

  useEffect(() => {
    const generation = ++measurementGenerationRef.current;
    let cancelled = false;
    const frame = requestAnimationFrame(async () => {
      const screen = await measureView(screenRef.current);
      if (!screen || (!cue && !spotlight)) {
        if (!cancelled && generation === measurementGenerationRef.current) setLayout(null);
        return;
      }

      const resolve = (target: FtueTarget) => resolveTargetFrame(
        target,
        stateRef.current,
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

      // Keep the last valid presentation while newly declared native targets
      // are being measured. The persistent renderer updates only when the next
      // complete presentation is ready.
      if ((cue && !cuePoints) || (spotlight && spotlightFrames.length === 0)) return;

      if (!cancelled && generation === measurementGenerationRef.current) {
        setLayout({
          configKey,
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
    targetRevision,
  ]);

  const currentLayout = layout;
  const showSpotlight = Boolean(currentLayout?.spotlightFrames.length);
  // Hide the previous moving hand while its replacement target is measured;
  // the same native finger view is reused for the next presentation.
  const showCue = Boolean(
    currentLayout?.configKey === configKey
      && currentLayout.targetRevision === targetRevision
      && currentLayout.cue
      && currentLayout.cuePoints,
  );
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.overlay}>
      <FtueSpotlight
        frames={showSpotlight ? currentLayout?.spotlightFrames ?? [] : []}
        opacity={showSpotlight ? currentLayout?.spotlightOpacity ?? 0 : 0}
        radius={currentLayout?.spotlightRadius ?? 12}
        screen={currentLayout?.screen ?? { height: 0, width: 0 }}
        theme={theme}
      />
      <FtueFingerCue
        blockedPulseNonce={blockedPulseNonce}
        cue={showCue ? currentLayout?.cue ?? null : null}
        points={showCue ? currentLayout?.cuePoints ?? null : null}
        resetKey={`${currentLayout?.targetRevision ?? 0}|${currentLayout?.configKey ?? 'none'}`}
        theme={theme}
      />
    </View>
  );
}, mergeFtueOverlayPropsEqual);

function FtueSpotlight({ frames, opacity, radius, screen, theme }: {
  frames: Frame[];
  opacity: number;
  radius: number;
  screen: { height: number; width: number };
  theme: MergeFtueVisualTheme;
}) {
  const reduceMotion = useReducedMotion();
  const dimOpacity = useSharedValue(0);
  const slot0 = useAnimatedSpotlightSlot(frames[0] ?? null, radius, theme.spotlightTransitionDurationMs, reduceMotion);
  const slot1 = useAnimatedSpotlightSlot(frames[1] ?? null, radius, theme.spotlightTransitionDurationMs, reduceMotion);
  const slot2 = useAnimatedSpotlightSlot(frames[2] ?? null, radius, theme.spotlightTransitionDurationMs, reduceMotion);
  const slot3 = useAnimatedSpotlightSlot(frames[3] ?? null, radius, theme.spotlightTransitionDurationMs, reduceMotion);

  useEffect(() => {
    dimOpacity.value = reduceMotion
      ? opacity
      : withTiming(opacity, {
        duration: opacity > 0 ? 180 : 140,
        easing: Easing.out(Easing.cubic),
      });
  }, [dimOpacity, opacity, reduceMotion]);

  const path = usePathValue((mask) => {
    'worklet';
    mask.addRect({ x: 0, y: 0, width: screen.width, height: screen.height });

    const appendSlot = (
      x: number,
      y: number,
      width: number,
      height: number,
      corner: number,
    ) => {
      'worklet';
      if (width <= 0.5 || height <= 0.5) return;
      mask.addRRect({
        rect: { x, y, width, height },
        rx: Math.min(corner, height / 2, width / 2),
        ry: Math.min(corner, height / 2, width / 2),
      });
    };

    appendSlot(slot0.x.value, slot0.y.value, slot0.width.value, slot0.height.value, slot0.corner.value);
    appendSlot(slot1.x.value, slot1.y.value, slot1.width.value, slot1.height.value, slot1.corner.value);
    appendSlot(slot2.x.value, slot2.y.value, slot2.width.value, slot2.height.value, slot2.corner.value);
    appendSlot(slot3.x.value, slot3.y.value, slot3.width.value, slot3.height.value, slot3.corner.value);
    mask.setFillType(FillType.EvenOdd);
  });

  const ringPath = usePathValue((ring) => {
    'worklet';
    const appendSlot = (
      x: number,
      y: number,
      width: number,
      height: number,
      corner: number,
    ) => {
      'worklet';
      if (width <= 0.5 || height <= 0.5) return;
      ring.addRRect({
        rect: { x, y, width, height },
        rx: Math.min(corner, height / 2, width / 2),
        ry: Math.min(corner, height / 2, width / 2),
      });
    };

    appendSlot(slot0.x.value, slot0.y.value, slot0.width.value, slot0.height.value, slot0.corner.value);
    appendSlot(slot1.x.value, slot1.y.value, slot1.width.value, slot1.height.value, slot1.corner.value);
    appendSlot(slot2.x.value, slot2.y.value, slot2.width.value, slot2.height.value, slot2.corner.value);
    appendSlot(slot3.x.value, slot3.y.value, slot3.width.value, slot3.height.value, slot3.corner.value);
  });

  return (
    <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Path color={`rgb(${theme.dimColor})`} opacity={dimOpacity} path={path} />
      <Path color={theme.focusRingShadowColor} path={ringPath} style="stroke" strokeWidth={5}>
        <BlurMask blur={6} style="solid" />
      </Path>
      <Path color={theme.focusRingColor} path={ringPath} style="stroke" strokeWidth={2} />
    </Canvas>
  );
}

function mergeFtueOverlayPropsEqual(previous: MergeFtueOverlayProps, next: MergeFtueOverlayProps) {
  if (
    previous.blockedPulseNonce !== next.blockedPulseNonce
    || previous.boardMetrics !== next.boardMetrics
    || previous.cue !== next.cue
    || previous.layoutNonce !== next.layoutNonce
    || previous.railTargetRefs !== next.railTargetRefs
    || previous.screenRef !== next.screenRef
    || previous.spotlight !== next.spotlight
    || previous.targetRevision !== next.targetRevision
    || previous.visualTheme !== next.visualTheme
  ) return false;
  return ftueResolvedBoardTargetKey(previous) === ftueResolvedBoardTargetKey(next);
}

function ftueResolvedBoardTargetKey({ cue, spotlight, state }: MergeFtueOverlayProps) {
  const targets: FtueTarget[] = [];
  if (cue?.kind === 'drag') targets.push(cue.from, cue.to);
  else if (cue) targets.push(cue.target);
  if (spotlight) targets.push(...spotlight.targets);
  return targets.map((target) => `${JSON.stringify(target)}:${resolveFtueBoardCell(state, target) ?? 'none'}`).join('|');
}

function useAnimatedSpotlightSlot(
  frame: Frame | null,
  radius: number,
  durationMs: number,
  reduceMotion: boolean,
) {
  const x = useSharedValue(frame?.x ?? 0);
  const y = useSharedValue(frame?.y ?? 0);
  const width = useSharedValue(frame?.width ?? 0);
  const height = useSharedValue(frame?.height ?? 0);
  const corner = useSharedValue(frame ? Math.min(radius, frame.height / 2, frame.width / 2) : 0);
  const previousFrameRef = useRef<Frame | null>(frame);

  useEffect(() => {
    const previousFrame = previousFrameRef.current;
    const timing = {
      duration: durationMs,
      easing: Easing.inOut(Easing.cubic),
    };

    if (!frame) {
      if (previousFrame) {
        const centerX = previousFrame.x + previousFrame.width / 2;
        const centerY = previousFrame.y + previousFrame.height / 2;
        x.value = reduceMotion ? centerX : withTiming(centerX, timing);
        y.value = reduceMotion ? centerY : withTiming(centerY, timing);
        width.value = reduceMotion ? 0 : withTiming(0, timing);
        height.value = reduceMotion ? 0 : withTiming(0, timing);
        corner.value = reduceMotion ? 0 : withTiming(0, timing);
      }
      previousFrameRef.current = null;
      return;
    }

    const nextCorner = Math.min(radius, frame.height / 2, frame.width / 2);
    if (!previousFrame || reduceMotion) {
      x.value = frame.x;
      y.value = frame.y;
      width.value = frame.width;
      height.value = frame.height;
      corner.value = nextCorner;
    } else {
      x.value = withTiming(frame.x, timing);
      y.value = withTiming(frame.y, timing);
      width.value = withTiming(frame.width, timing);
      height.value = withTiming(frame.height, timing);
      corner.value = withTiming(nextCorner, timing);
    }
    previousFrameRef.current = frame;
  }, [
    corner,
    durationMs,
    frame,
    height,
    radius,
    reduceMotion,
    width,
    x,
    y,
  ]);

  return { corner, height, width, x, y };
}

function FtueFingerCue({ blockedPulseNonce, cue, points, resetKey, theme }: {
  blockedPulseNonce: number;
  cue: FtueCueDefinition | null;
  points: CuePoints | null;
  resetKey: string;
  theme: MergeFtueVisualTheme;
}) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const correction = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(progress);
    if (!cue || !points) return;
    progress.value = 0;
    if (reduceMotion) return;
    progress.value = withDelay(theme.fingerDelayMs, withRepeat(withTiming(1, {
      duration: cue.kind === 'drag' ? theme.dragDurationMs : theme.tapDurationMs,
      easing: Easing.inOut(Easing.cubic),
    }), -1, false));
    return () => cancelAnimation(progress);
  }, [cue, points, progress, reduceMotion, resetKey, theme.dragDurationMs, theme.fingerDelayMs, theme.tapDurationMs]);

  useEffect(() => {
    if (!blockedPulseNonce) return;
    cancelAnimation(correction);
    correction.value = withSequence(
      withTiming(1, { duration: 90 }),
      withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) }),
    );
    return () => cancelAnimation(correction);
  }, [blockedPulseNonce, correction]);

  const travelX = points ? points.to.x - points.from.x : 0;
  const travelY = points ? points.to.y - points.from.y : 0;
  const cueKind = cue?.kind ?? 'tap';
  const visible = Boolean(cue && points);
  const animatedStyle = useAnimatedStyle(() => {
    const value = progress.value;
    const drag = cueKind === 'drag';
    const motion = reduceMotion ? 0 : value;
    return {
      opacity: !visible ? 0 : reduceMotion ? 1 : drag
        ? interpolate(value, [0, 0.08, 0.72, 0.86, 1], [0, 1, 1, 0, 0])
        : interpolate(value, [0, 0.12, 0.72, 1], [0.82, 1, 1, 0.82]),
      transform: [
        { translateX: drag ? travelX * interpolate(motion, [0, 0.12, 0.72, 1], [0, 0, 1, 1]) : 0 },
        { translateY: drag ? travelY * interpolate(motion, [0, 0.12, 0.72, 1], [0, 0, 1, 1]) : interpolate(motion, [0, 0.45, 0.72, 1], [5, -5, -5, 5]) },
        { scale: 1 + correction.value * 0.13 },
      ],
    };
  }, [cueKind, reduceMotion, travelX, travelY, visible]);

  return (
    <Animated.View style={[
      styles.hand,
      {
        height: theme.fingerSize,
        left: (points?.from.x ?? 0) - theme.fingerSize * HAND_TIP_X,
        top: (points?.from.y ?? 0) - theme.fingerSize * HAND_TIP_Y,
        width: theme.fingerSize,
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
  hand: { position: 'absolute' },
  handArt: { height: '100%', width: '100%' },
});
