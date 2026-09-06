import { normalizeSpeechText } from '@/utils/speech-text';
import { Image } from 'expo-image';
import { roundedMultiCutoutSegments } from '@/features/onboarding/spotlight-geometry';
import { memo, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
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
  type SharedValue,
} from 'react-native-reanimated';

import { EggAvatar } from '@/components/katchadeck/egg-avatar/egg-avatar';
import { ThemedText } from '@/components/themed-text';
import { KatchaDeckUI } from '@/constants/theme';
import { useEggAvatar } from '@/features/egg-avatar/egg-avatar-provider';
import type { FtueCueDefinition, FtueGuide, FtueSpotlightDefinition, FtueTarget } from '@/features/onboarding/ftue-types';
import { resolveFtueBoardCell, resolveFtueRailTargetKey } from '@/features/onboarding/merge-ftue';
import type { EggAvatarFaceId } from '@/types/egg-avatar';
import type { MergeWorldState } from '@/types/merge-world';
import { mergeCellOrigin } from '@/utils/merge-world/board-geometry';

import type { MergeBoardScreenMetrics } from './feastle-persistent-merge-board';

const HAND_ART = require('@incubator/art-merge-world/ui/ftue-hand.webp');
const HAND_TIP_X = 0.28;
const HAND_TIP_Y = 0.2;
const GUIDE_AUTO_DISMISS_MS = 4_800;
const GUIDE_EXPRESSION_FACE_IDS = [
  'happy-squint',
  'curious',
  'gentle-smile',
  'big-grin',
  'single-wink',
] as const satisfies readonly EggAvatarFaceId[];

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
  guide: FtueGuide | null;
  layoutNonce: number;
  onReadinessChange?: (ready: boolean) => void;
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
  guide,
  layoutNonce,
  onReadinessChange,
  screenRef,
  railTargetRefs,
  spotlight,
  state,
  targetRevision,
  visualTheme,
}: MergeFtueOverlayProps) {
  const [layout, setLayout] = useState<OverlayLayout | null>(null);
  const [dismissedGuideKey, setDismissedGuideKey] = useState<string | null>(null);
  const stateRef = useRef(state);
  const measurementGenerationRef = useRef(0);
  const screenFrameRef = useRef<Frame | null>(null);
  const measuredLayoutNonceRef = useRef(-1);
  stateRef.current = state;
  const theme = useMemo(() => ({ ...DEFAULT_MERGE_FTUE_VISUAL_THEME, ...visualTheme }), [visualTheme]);
  const cueKey = useMemo(() => cue ? JSON.stringify(cue) : 'none', [cue]);
  const spotlightKey = useMemo(() => spotlight ? JSON.stringify(spotlight) : 'none', [spotlight]);
  const configKey = `${cueKey}|${spotlightKey}`;

  useEffect(() => {
    const generation = ++measurementGenerationRef.current;
    let cancelled = false;
    void (async () => {
      const mustRefreshScreenFrame = measuredLayoutNonceRef.current !== layoutNonce;
      const screen = !mustRefreshScreenFrame && screenFrameRef.current
        ? screenFrameRef.current
        : await measureView(screenRef.current);
      if (screen) {
        screenFrameRef.current = screen;
        measuredLayoutNonceRef.current = layoutNonce;
      }
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
    })();
    return () => {
      cancelled = true;
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
  const presentationReady = currentLayout?.configKey === configKey
    && currentLayout.targetRevision === targetRevision;
  useEffect(() => {
    onReadinessChange?.(Boolean((!cue && !spotlight) || presentationReady));
    return () => onReadinessChange?.(false);
  }, [cue, onReadinessChange, presentationReady, spotlight]);
  // Keep the prior cutout visible while measuring the next target. Readiness
  // still gates input above; only an explicit null spotlight dismisses the mask.
  const spotlightReady = Boolean(spotlight && currentLayout?.spotlightFrames.length);
  const guideKey = guide && presentationReady ? `${configKey}:${normalizeSpeechText(guide.title)}:${normalizeSpeechText(guide.body)}` : null;
  const [hintKey, setHintKey] = useState<string | null>(null);
  const practice = guide?.coaching === 'practice';
  useEffect(() => {
    if (!practice || !guideKey) return;
    const timer = setTimeout(() => setHintKey(guideKey), 6000);
    return () => clearTimeout(timer);
  }, [practice, guideKey]);
  // One authored flag owns the complete guidance presentation. By default the
  // spotlight, finger, and Egg copy persist until the required command changes
  // the FTUE node. Only explicitly transient beats (currently the resident
  // request introduction) may dismiss the Egg copy and spotlight together.
  const guideDismissible = Boolean(spotlight?.dismissOnGuideClose);
  const guideDismissed = Boolean(guideDismissible && guideKey && dismissedGuideKey === guideKey);
  const spotlightDismissed = guideDismissed;
  const showSpotlight = spotlightReady && !spotlightDismissed;
  // Hide the previous moving hand while its replacement target is measured;
  // the same native finger view is reused for the next presentation.
  const showCue = Boolean(
    presentationReady
      && (!practice || hintKey === guideKey)
      && currentLayout.cue
      && currentLayout.cuePoints,
  );
  const showGuide = Boolean(
    guideKey
      && guide
      && showSpotlight
      && presentationReady
      && !guideDismissed,
  );

  useEffect(() => {
    if (!guideDismissible || !showGuide || !guideKey) return;
    const timer = setTimeout(() => setDismissedGuideKey(guideKey), GUIDE_AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [guideDismissible, guideKey, showGuide]);

  const dismissGuide = () => {
    if (guideDismissible && guideKey) setDismissedGuideKey(guideKey);
  };
  return (
    <View
      pointerEvents="box-none"
      style={styles.overlay}>
      {!spotlightDismissed ? (
        <FtueSpotlight
          frames={showSpotlight ? currentLayout?.spotlightFrames ?? [] : []}
          opacity={showSpotlight ? currentLayout?.spotlightOpacity ?? 0 : 0}
          radius={currentLayout?.spotlightRadius ?? 12}
          screen={currentLayout?.screen ?? { height: 0, width: 0 }}
          theme={theme}
        />
      ) : null}
      {showGuide && guide && currentLayout ? (
        <>
          {guideDismissible ? <Pressable
            accessibilityLabel="Dismiss Merge guidance"
            accessibilityRole="button"
            onPress={dismissGuide}
            style={styles.guideDismissLayer}
          /> : null}
          <Animated.View
            entering={FadeIn.duration(150)}
            exiting={FadeOut.duration(150)}
            pointerEvents="none"
            accessible
            accessibilityLabel={[guide.title, guide.body].filter(Boolean).join('. ')}
            style={StyleSheet.absoluteFill}>
            <MergeFtueEggGuide
              anchor={guideAnchorFrame(spotlight, currentLayout.spotlightFrames)}
              guide={guide}
              screen={currentLayout.screen}
            />
          </Animated.View>
        </>
      ) : null}
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
  const boundingSlot = useAnimatedSpotlightSlot(
    frames.length ? boundingFrame(frames) : null,
    radius,
    theme.spotlightTransitionDurationMs,
    reduceMotion,
  );
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

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {frames.length > 1 ? (
        <NativeMultiSpotlightDimMask
          color={`rgb(${theme.dimColor})`}
          frames={frames}
          opacity={dimOpacity}
          radius={radius}
          screen={screen}
        />
      ) : (
        <SpotlightDimMask
          color={`rgb(${theme.dimColor})`}
          opacity={dimOpacity}
          screen={screen}
          slot={boundingSlot}
        />
      )}
      <NativeSpotlightRing slot={slot0} theme={theme} />
      <NativeSpotlightRing slot={slot1} theme={theme} />
      <NativeSpotlightRing slot={slot2} theme={theme} />
      <NativeSpotlightRing slot={slot3} theme={theme} />
    </View>
  );
}

type AnimatedSpotlightSlot = ReturnType<typeof useAnimatedSpotlightSlot>;

function SpotlightDimMask({ color, opacity, screen, slot }: {
  color: string;
  opacity: SharedValue<number>;
  screen: { height: number; width: number };
  slot: AnimatedSpotlightSlot;
}) {
  const spreadRadius = Math.max(1, Math.hypot(screen.width, screen.height));
  const style = useAnimatedStyle(() => ({
    borderRadius: slot.corner.value,
    height: Math.max(0, slot.height.value),
    left: slot.x.value,
    opacity: opacity.value,
    top: slot.y.value,
    width: Math.max(0, slot.width.value),
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.spotlightDimShadow,
        { boxShadow: `0 0 0 ${spreadRadius}px ${color}` },
        style,
      ]}
    />
  );
}

function NativeMultiSpotlightDimMask({ color, frames, opacity, radius, screen }: {
  color: string;
  frames: readonly Frame[];
  opacity: SharedValue<number>;
  radius: number;
  screen: { height: number; width: number };
}) {
  const segments = useMemo(
    () => roundedMultiCutoutSegments(frames, radius, screen),
    [frames, radius, screen],
  );
  const opacityStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, opacityStyle]}>
      {segments.map((segment) => (
        <View
          key={`${segment.y}:${segment.x}:${segment.width}:${segment.height}`}
          style={[
            styles.multiCutoutSegment,
            {
              backgroundColor: color,
              height: segment.height,
              left: segment.x,
              top: segment.y,
              width: segment.width,
            },
          ]}
        />
      ))}
    </Animated.View>
  );
}

/**
 * Tessellates the dim layer around every opening. React Native cannot subtract
 * two native rounded views from one shadow, so a small set of horizontal bands
 * preserves two independent holes without mounting a Canvas during FTUE.
 */

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function NativeSpotlightRing({ slot, theme }: {
  slot: AnimatedSpotlightSlot;
  theme: MergeFtueVisualTheme;
}) {
  const style = useAnimatedStyle(() => ({
    borderRadius: slot.corner.value,
    height: Math.max(0, slot.height.value),
    left: slot.x.value,
    opacity: slot.width.value > 0.5 && slot.height.value > 0.5 ? 1 : 0,
    top: slot.y.value,
    width: Math.max(0, slot.width.value),
  }));
  return <Animated.View style={[
    styles.nativeSpotlightRing,
    {
      borderColor: theme.focusRingColor,
      boxShadow: `0 0 9px ${theme.focusRingShadowColor}`,
    },
    style,
  ]} />;
}

function mergeFtueOverlayPropsEqual(previous: MergeFtueOverlayProps, next: MergeFtueOverlayProps) {
  if (
    previous.blockedPulseNonce !== next.blockedPulseNonce
    || previous.boardMetrics !== next.boardMetrics
    || previous.cue !== next.cue
    || previous.guide !== next.guide
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
    <Animated.View pointerEvents="none" style={[
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

export function MergeFtueEggGuide({ anchor, guide, screen, children, hideAvatar = false, inlineWidth }: {
  anchor: Frame;
  guide: FtueGuide;
  screen: { height: number; width: number };
  children?: React.ReactNode;
  hideAvatar?: boolean;
  /** Embed the shared bubble in a measured parent, with its tail pointing right. */
  inlineWidth?: number;
}) {
  const { equippedFaceId, equippedSkinId } = useEggAvatar();
  const reduceMotion = useReducedMotion();
  const [guideFaceId, setGuideFaceId] = useState<EggAvatarFaceId>(equippedFaceId);
  const avatarWobble = useSharedValue(0);
  const avatarMotionStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -2 },
      { rotateZ: `${avatarWobble.value}deg` },
    ],
  }));

  useEffect(() => {
    if (hideAvatar) return;
    let cancelled = false;
    let reactionTimer: ReturnType<typeof setTimeout> | null = null;
    let restoreTimer: ReturnType<typeof setTimeout> | null = null;
    setGuideFaceId(equippedFaceId);

    const scheduleReaction = (first = false) => {
      reactionTimer = setTimeout(() => {
        if (cancelled) return;
        const available = GUIDE_EXPRESSION_FACE_IDS.filter((faceId) => faceId !== equippedFaceId);
        const nextFace = available[Math.floor(Math.random() * available.length)] ?? 'happy-squint';
        setGuideFaceId(nextFace);
        if (!reduceMotion) {
          avatarWobble.value = withSequence(
            withTiming(-1.7, { duration: 70, easing: Easing.inOut(Easing.quad) }),
            withTiming(1.5, { duration: 85, easing: Easing.inOut(Easing.quad) }),
            withTiming(-0.8, { duration: 75, easing: Easing.inOut(Easing.quad) }),
            withTiming(0, { duration: 105, easing: Easing.out(Easing.cubic) }),
          );
        }
        restoreTimer = setTimeout(() => {
          if (cancelled) return;
          setGuideFaceId(equippedFaceId);
          scheduleReaction();
        }, 780 + Math.round(Math.random() * 420));
      }, first
        ? 900 + Math.round(Math.random() * 900)
        : 3_000 + Math.round(Math.random() * 2_400));
    };

    scheduleReaction(true);
    return () => {
      cancelled = true;
      if (reactionTimer) clearTimeout(reactionTimer);
      if (restoreTimer) clearTimeout(restoreTimer);
      cancelAnimation(avatarWobble);
      avatarWobble.value = 0;
    };
  }, [avatarWobble, equippedFaceId, hideAvatar, reduceMotion]);

  const calloutWidth = inlineWidth ?? Math.min(326, screen.width - 28);
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const estimatedHeight = measuredHeight || (children ? 170 : 96);
  const calloutLeft = clamp(
    anchor.x + anchor.width / 2 - calloutWidth / 2,
    14,
    screen.width - calloutWidth - 14,
  );
  const belowTop = anchor.y + anchor.height + 14;
  const calloutBelow = belowTop + estimatedHeight <= screen.height - 14;
  const calloutTop = calloutBelow
    ? belowTop
    : Math.max(14, anchor.y - estimatedHeight - 14);
  const tailLeft = clamp(
    anchor.x + anchor.width / 2 - calloutLeft - 10,
    38,
    calloutWidth - 34,
  );

  return (
    <View
      accessibilityLabel={`${normalizeSpeechText(guide.title)} ${normalizeSpeechText(guide.body)}`}
      accessibilityLiveRegion="polite"
      pointerEvents={children ? 'auto' : 'none'}
      onLayout={(event) => setMeasuredHeight(event.nativeEvent.layout.height)}
      style={[
        styles.eggGuideCallout,
        { left: calloutLeft, top: calloutTop, width: calloutWidth },
        inlineWidth != null && { position: 'relative', left: 0, top: 0, minHeight: 72 },
      ]}>
      <View pointerEvents="none" style={[
        styles.eggGuideTail,
        inlineWidth != null ? { right: -8, top: Math.max(72, measuredHeight) / 2 - 10 } : calloutBelow ? styles.eggGuideTailAbove : styles.eggGuideTailBelow,
        inlineWidth == null && { left: tailLeft },
      ]} />
      <View style={styles.eggGuideContentRow}>
      {!hideAvatar ? <Animated.View
        accessibilityLabel="Your Egg is showing you around"
        pointerEvents="none"
        style={[styles.eggGuideAvatar, avatarMotionStyle]}>
        <EggAvatar faceId={guideFaceId} presentation="button" size={76} skinId={equippedSkinId} />
      </Animated.View> : null}
      <ThemedText style={[styles.eggGuideMessage, styles.eggGuideMessageLayout, { width: hideAvatar ? calloutWidth - 24 : calloutWidth - 24 - 76 - 9 }]} lightColor="#35422F" darkColor="#35422F">
        <ThemedText style={[styles.eggGuideMessage, styles.eggGuideEmphasis]} lightColor="#668A49" darkColor="#668A49">
          {normalizeSpeechText(guide.title)}
        </ThemedText>
        {' '}{normalizeSpeechText(guide.body)}
      </ThemedText>
      </View>
      {children ? <View style={styles.eggGuideActionRow}>{children}</View> : null}
    </View>
  );
}

function guideAnchorFrame(spotlight: FtueSpotlightDefinition | null, frames: readonly Frame[]) {
  if (!frames.length) return { height: 0, width: 0, x: 0, y: 0 };
  if (spotlight?.grouping !== 'bounding_rect') {
    const orderCardIndex = spotlight?.targets.findIndex((target) => target.kind === 'order_card') ?? -1;
    if (orderCardIndex >= 0 && frames[orderCardIndex]) return frames[orderCardIndex];
  }
  return boundingFrame(frames);
}

async function resolveTargetFrame(
  target: FtueTarget,
  state: MergeWorldState,
  boardMetrics: MergeBoardScreenMetrics | null,
  railTargetRefs: Map<string, View>,
  screen: Frame,
): Promise<Frame | null> {
  const targetKey = target.kind === 'order_card'
    ? `order-card:${target.orderId}`
    : target.kind === 'order_serve'
      ? `order-serve:${target.orderId}`
      : target.kind === 'tray_chat_note'
        ? `chat-note:${target.noteId}`
        : target.kind === 'tray_parcel'
          ? `tray-parcel:${target.arrivalId}`
          : resolveFtueRailTargetKey(state, target);
  if (targetKey) {
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
    height: boardMetrics.geometry.cellHeight ?? boardMetrics.geometry.cellSize,
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
  guideDismissLayer: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  hand: { position: 'absolute', zIndex: 4 },
  handArt: { height: '100%', width: '100%' },
  eggGuideCallout: {
    alignItems: 'center',
    backgroundColor: '#FFF9E8',
    borderColor: 'rgba(124,151,83,0.42)',
    borderCurve: 'continuous',
    borderRadius: 21,
    borderWidth: 1,
    boxShadow: '0 12px 30px rgba(25,42,25,0.28)',
    flexDirection: 'column',
    gap: 9,
    justifyContent: 'flex-start',
    paddingHorizontal: 11,
    paddingVertical: 9,
    position: 'absolute',
    zIndex: 2,
  },
  eggGuideTail: {
    backgroundColor: '#FFF9E8',
    height: 20,
    position: 'absolute',
    transform: [{ rotate: '45deg' }],
    width: 20,
    zIndex: 0,
  },
  eggGuideTailAbove: {
    borderLeftColor: 'rgba(124,151,83,0.42)',
    borderLeftWidth: 1,
    borderTopColor: 'rgba(124,151,83,0.42)',
    borderTopWidth: 1,
    top: -10,
  },
  eggGuideTailBelow: {
    borderBottomColor: 'rgba(124,151,83,0.42)',
    borderBottomWidth: 1,
    borderRightColor: 'rgba(124,151,83,0.42)',
    borderRightWidth: 1,
    bottom: -10,
  },
  eggGuideAvatar: { flexShrink: 0, height: 76, width: 76, zIndex: 1 },
  eggGuideContentRow: { alignItems: 'flex-start', flexDirection: 'row', flexShrink: 0, gap: 9, width: '100%' },
  eggGuideActionRow: { alignItems: 'flex-end', flexShrink: 0, width: '100%' },
  eggGuideMessage: {
    ...KatchaDeckUI.typography.ftueHeroTitle,
    fontSize: 16.5,
    lineHeight: 21,
  },
  eggGuideMessageLayout: {
    flexShrink: 0,
    zIndex: 1,
  },
  eggGuideEmphasis: { fontWeight: '900' },
  multiCutoutSegment: { position: 'absolute' },
  nativeSpotlightRing: {
    borderCurve: 'continuous',
    borderWidth: 2,
    position: 'absolute',
  },
  spotlightDimShadow: {
    backgroundColor: 'transparent',
    borderCurve: 'continuous',
    position: 'absolute',
  },
});
