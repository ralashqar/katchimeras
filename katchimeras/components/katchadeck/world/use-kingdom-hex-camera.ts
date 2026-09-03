import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withTiming,
} from 'react-native-reanimated';

import {
  clampHavenCameraScale,
  clampCameraTranslation,
  kingdomCameraSnapshotForFrame,
  kingdomCameraSnapshotForTarget,
  nearestKingdomFocusTarget,
  screenPointToWorld,
  type KingdomCameraSnapshot,
  type KingdomFocusTarget,
  type KingdomSize,
  type KingdomWorldFrame,
} from '@/utils/kingdom-rendering';
import { KINGDOM_RENDERING } from '@/constants/kingdom-rendering';
import { HAVEN_UPGRADE_REDUCED_TIMING, HAVEN_UPGRADE_TIMING } from '@/utils/haven-upgrade-presentation';

type CameraRenderState = {
  isMoving: boolean;
  snapshot: KingdomCameraSnapshot;
};

type UseKingdomHexCameraArgs = {
  center: { x: number; y: number };
  centerId?: string;
  initialFocus?: {
    durationMs?: number;
    initialScale?: number;
    scale: number;
    screenY: number;
    x: number;
    y: number;
  } | null;
  initialSnapshot?: KingdomCameraSnapshot | null;
  interactionEnabled?: boolean;
  initialFitWorld?: boolean;
  magneticFocus?: {
    anchorY: number;
    durationMs: number;
    enabled: boolean;
    reducedMotion: boolean;
    targets: readonly KingdomFocusTarget[];
  };
  minimumScale?: number;
  maximumScale?: number;
  onSnapshotChange?: (snapshot: KingdomCameraSnapshot) => void;
  onMotionChange?: (moving: boolean) => void;
  onWorldTapRelease?: (x: number, y: number) => void;
  scene: KingdomSize;
  viewport: KingdomSize;
};

function workletBounds(viewportSize: number, sceneSize: number, scale: number): [number, number] {
  'worklet';
  const scaledSize = sceneSize * scale;
  const centered = viewportSize / 2 - sceneSize / 2;
  if (scaledSize <= viewportSize) return [centered, centered];
  return [viewportSize - sceneSize / 2 - scaledSize / 2, scaledSize / 2 - sceneSize / 2];
}

function workletClamp(value: number, bounds: [number, number]): number {
  'worklet';
  return Math.min(bounds[1], Math.max(bounds[0], value));
}

export function useKingdomHexCamera({
  center,
  centerId,
  initialFocus = null,
  initialSnapshot = null,
  interactionEnabled = true,
  initialFitWorld = false,
  magneticFocus,
  minimumScale = 0.54,
  maximumScale = KINGDOM_RENDERING.havenMaxScale,
  onSnapshotChange,
  onMotionChange,
  onWorldTapRelease,
  scene,
  viewport,
}: UseKingdomHexCameraArgs) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const panStartTx = useSharedValue(0);
  const panStartTy = useSharedValue(0);
  const pinchStartScale = useSharedValue(1);
  const pinchStartTx = useSharedValue(0);
  const pinchStartTy = useSharedValue(0);
  const pinchFocalX = useSharedValue(0);
  const pinchFocalY = useSharedValue(0);
  const initializedRef = useRef(false);
  const previousGeometryRef = useRef<{
    sceneHeight: number;
    sceneWidth: number;
    viewportHeight: number;
    viewportWidth: number;
  } | null>(null);
  const frameFocusKeyRef = useRef<string | null>(null);
  const onWorldTapReleaseRef = useRef(onWorldTapRelease);
  onWorldTapReleaseRef.current = onWorldTapRelease;
  const onSnapshotChangeRef = useRef(onSnapshotChange);
  onSnapshotChangeRef.current = onSnapshotChange;
  const decayCompletions = useSharedValue(0);
  const [ready, setReady] = useState(false);
  const [focusedTileId, setFocusedTileId] = useState<string | null>(centerId ?? null);
  const centerX = center.x;
  const centerY = center.y;
  const cameraScene = useMemo(
    () => ({ height: scene.height, width: scene.width }),
    [scene.height, scene.width],
  );
  const cameraViewport = useMemo(
    () => ({ height: viewport.height, width: viewport.width }),
    [viewport.height, viewport.width],
  );

  const baseScale = useMemo(
    () =>
      viewport.width && viewport.height
        ? Math.min(
            KINGDOM_RENDERING.havenMaxScale,
            Math.max(0.72, Math.min(viewport.width / 520, viewport.height / 620)),
          )
        : 1,
    [viewport.height, viewport.width]
  );
  const minScale = minimumScale;
  const maxScale = maximumScale;
  const [renderState, setRenderState] = useState<CameraRenderState>(() => ({
    isMoving: false,
    snapshot: { tx: 0, ty: 0, scale: 1 },
  }));
  const emittedSnapshotKeyRef = useRef<string | null>(null);

  useEffect(() => {
    onMotionChange?.(!ready || renderState.isMoving);
  }, [onMotionChange, ready, renderState.isMoving]);

  useEffect(() => {
    if (!ready || renderState.isMoving) return;
    const snapshot = renderState.snapshot;
    const key = `${snapshot.tx.toFixed(2)}:${snapshot.ty.toFixed(2)}:${snapshot.scale.toFixed(4)}`;
    if (emittedSnapshotKeyRef.current === key) return;
    emittedSnapshotKeyRef.current = key;
    onSnapshotChangeRef.current?.(snapshot);
  }, [ready, renderState]);

  const commitSnapshot = useCallback(
    (nextTx: number, nextTy: number, nextScale: number, moving = false) => {
      setRenderState((current) => {
        const snapshotChanged =
          Math.abs(current.snapshot.tx - nextTx) >= 0.5 ||
          Math.abs(current.snapshot.ty - nextTy) >= 0.5 ||
          Math.abs(current.snapshot.scale - nextScale) >= 0.001;
        if (!snapshotChanged && current.isMoving === moving) {
          return current;
        }
        return {
          isMoving: moving,
          snapshot: snapshotChanged ? { tx: nextTx, ty: nextTy, scale: nextScale } : current.snapshot,
        };
      });
    },
    []
  );

  const beginMotion = useCallback(() => {
    setRenderState((current) => (current.isMoving ? current : { ...current, isMoving: true }));
  }, []);

  const clearFrameFocus = useCallback(() => {
    frameFocusKeyRef.current = null;
  }, []);

  const animateTo = useCallback(
    (x: number, y: number, zoom: number, screenY: number, duration: number, onComplete?: () => void) => {
      if (!cameraViewport.width || !cameraViewport.height) {
        onComplete?.();
        return;
      }
      cancelAnimation(tx);
      cancelAnimation(ty);
      cancelAnimation(scale);
      beginMotion();
      const clampedZoom = clampHavenCameraScale(zoom, minScale, maxScale);
      const nextTx = cameraViewport.width / 2 - cameraScene.width / 2 - (x - cameraScene.width / 2) * clampedZoom;
      const nextTy = screenY - cameraScene.height / 2 - (y - cameraScene.height / 2) * clampedZoom;
      const clamped = clampCameraTranslation({ tx: nextTx, ty: nextTy }, cameraViewport, cameraScene, clampedZoom);
      const timing = { duration, easing: Easing.out(Easing.cubic) };
      tx.value = withTiming(clamped.tx, timing);
      ty.value = withTiming(clamped.ty, timing);
      scale.value = withTiming(clampedZoom, timing, (finished) => {
        if (finished) {
          runOnJS(commitSnapshot)(clamped.tx, clamped.ty, clampedZoom, false);
          if (onComplete) runOnJS(onComplete)();
        }
      });
      pinchStartScale.value = clampedZoom;
    },
    [beginMotion, cameraScene, cameraViewport, commitSnapshot, maxScale, minScale, pinchStartScale, scale, tx, ty]
  );

  const settleAfterPan = useCallback((nextTx: number, nextTy: number, nextScale: number) => {
    if (!magneticFocus?.enabled || magneticFocus.targets.length === 0) {
      commitSnapshot(nextTx, nextTy, nextScale, false);
      return;
    }
    const focusPoint = screenPointToWorld(
      { x: viewport.width / 2, y: viewport.height * magneticFocus.anchorY },
      scene,
      { tx: nextTx, ty: nextTy, scale: nextScale }
    );
    const target = nearestKingdomFocusTarget(focusPoint, magneticFocus.targets);
    if (!target) {
      commitSnapshot(nextTx, nextTy, nextScale, false);
      return;
    }
    setFocusedTileId(target.id);
    animateTo(
      target.x,
      target.y,
      nextScale,
      viewport.height * magneticFocus.anchorY,
      magneticFocus.reducedMotion ? 0 : magneticFocus.durationMs
    );
  }, [animateTo, commitSnapshot, magneticFocus, scene, viewport]);

  useEffect(() => {
    if (!cameraViewport.width || !cameraViewport.height || !cameraScene.width || !cameraScene.height) return;

    if (!initializedRef.current) {
      const initialScale = initialFocus
        ? clampHavenCameraScale(initialFocus.initialScale ?? initialFocus.scale, minScale, maxScale)
        : initialSnapshot
          ? clampHavenCameraScale(initialSnapshot.scale, minScale, maxScale)
        : initialFitWorld
          ? Math.max(minScale, Math.min(baseScale * 0.78, cameraViewport.width / cameraScene.width, cameraViewport.height / cameraScene.height))
          : baseScale;
      const home = initialFocus
        ? kingdomCameraSnapshotForTarget(
            cameraViewport,
            cameraScene,
            { x: initialFocus.x, y: initialFocus.y },
            initialScale,
            { x: cameraViewport.width / 2, y: initialFocus.screenY },
          )
        : initialSnapshot
          ? { ...clampCameraTranslation(initialSnapshot, cameraViewport, cameraScene, initialScale), scale: initialScale }
        : kingdomCameraSnapshotForTarget(
            cameraViewport,
            cameraScene,
            { x: centerX, y: centerY },
            initialScale,
            { x: cameraViewport.width / 2, y: cameraViewport.height / 2 },
          );
      tx.value = home.tx;
      ty.value = home.ty;
      scale.value = home.scale;
      pinchStartScale.value = home.scale;
      initializedRef.current = true;
      previousGeometryRef.current = {
        sceneHeight: cameraScene.height,
        sceneWidth: cameraScene.width,
        viewportHeight: cameraViewport.height,
        viewportWidth: cameraViewport.width,
      };
      const startsWithMotion = Boolean(
        initialFocus?.initialScale != null
        && initialFocus.durationMs
        && Math.abs(initialScale - initialFocus.scale) >= 0.001
      );
      commitSnapshot(home.tx, home.ty, home.scale, startsWithMotion);
      setReady(true);
      if (startsWithMotion && initialFocus) {
        // Start the authored opening move in the same layout commit that
        // establishes the first camera frame. Waiting for a second React
        // effect allowed a visible static pause before the FTUE zoom began.
        animateTo(
          initialFocus.x,
          initialFocus.y,
          initialFocus.scale,
          initialFocus.screenY,
          initialFocus.durationMs!,
        );
      }
      return;
    }

    const previousGeometry = previousGeometryRef.current;
    const nextGeometry = {
      sceneHeight: cameraScene.height,
      sceneWidth: cameraScene.width,
      viewportHeight: cameraViewport.height,
      viewportWidth: cameraViewport.width,
    };
    previousGeometryRef.current = nextGeometry;

    // Camera limits describe valid destinations and gesture bounds; they are
    // not presentation state. In particular, closing a close-up interaction
    // lowers maximumScale before the next authored camera move begins. Never
    // clamp the currently visible frame merely because those limits changed:
    // doing so creates a one-frame jump before the real transition. Explicit
    // camera moves always animate from the live shared values and clamp only
    // their destination.
    if (
      previousGeometry
      && previousGeometry.sceneWidth === nextGeometry.sceneWidth
      && previousGeometry.sceneHeight === nextGeometry.sceneHeight
      && previousGeometry.viewportWidth === nextGeometry.viewportWidth
      && previousGeometry.viewportHeight === nextGeometry.viewportHeight
    ) {
      return;
    }

    const sceneDeltaX = previousGeometry ? (cameraScene.width - previousGeometry.sceneWidth) / 2 : 0;
    const sceneDeltaY = previousGeometry ? (cameraScene.height - previousGeometry.sceneHeight) / 2 : 0;
    const nextScale = clampHavenCameraScale(scale.value, minScale, maxScale);
    const clamped = clampCameraTranslation(
      { tx: tx.value - sceneDeltaX, ty: ty.value - sceneDeltaY },
      cameraViewport,
      cameraScene,
      nextScale
    );
    tx.value = clamped.tx;
    ty.value = clamped.ty;
    scale.value = nextScale;
    commitSnapshot(clamped.tx, clamped.ty, nextScale, false);
  }, [animateTo, baseScale, cameraScene, cameraViewport, centerX, centerY, commitSnapshot, initialFitWorld, initialFocus, initialSnapshot, maxScale, minScale, pinchStartScale, scale, tx, ty]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(interactionEnabled)
        .maxPointers(1)
        .activeOffsetX([-6, 6])
        .activeOffsetY([-6, 6])
        .onBegin(() => {
          cancelAnimation(tx);
          cancelAnimation(ty);
          panStartTx.value = tx.value;
          panStartTy.value = ty.value;
          decayCompletions.value = 0;
          runOnJS(clearFrameFocus)();
          runOnJS(beginMotion)();
        })
        .onChange((event) => {
          const xBounds = workletBounds(viewport.width, scene.width, scale.value);
          const yBounds = workletBounds(viewport.height, scene.height, scale.value);
          tx.value = workletClamp(panStartTx.value + event.translationX, xBounds);
          ty.value = workletClamp(panStartTy.value + event.translationY, yBounds);
        })
        .onEnd((event) => {
          const xBounds = workletBounds(viewport.width, scene.width, scale.value);
          const yBounds = workletBounds(viewport.height, scene.height, scale.value);
          const completeDecay = (finished?: boolean) => {
            'worklet';
            if (!finished) return;
            decayCompletions.value += 1;
            if (decayCompletions.value === 2) {
              runOnJS(settleAfterPan)(tx.value, ty.value, scale.value);
            }
          };
          tx.value = withDecay({ velocity: event.velocityX, deceleration: 0.996, clamp: xBounds }, completeDecay);
          ty.value = withDecay({ velocity: event.velocityY, deceleration: 0.996, clamp: yBounds }, completeDecay);
        }),
    [beginMotion, clearFrameFocus, decayCompletions, interactionEnabled, panStartTx, panStartTy, scale, scene, settleAfterPan, tx, ty, viewport.height, viewport.width]
  );

  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .enabled(interactionEnabled)
        .onBegin((event) => {
          cancelAnimation(tx);
          cancelAnimation(ty);
          cancelAnimation(scale);
          pinchStartScale.value = scale.value;
          pinchStartTx.value = tx.value;
          pinchStartTy.value = ty.value;
          pinchFocalX.value = event.focalX;
          pinchFocalY.value = event.focalY;
          runOnJS(clearFrameFocus)();
          runOnJS(beginMotion)();
        })
        .onChange((event) => {
          const nextScale = clampHavenCameraScale(pinchStartScale.value * event.scale, minScale, maxScale);
          const sceneCenterX = scene.width / 2;
          const sceneCenterY = scene.height / 2;
          const worldDeltaX = (pinchFocalX.value - sceneCenterX - pinchStartTx.value) / pinchStartScale.value;
          const worldDeltaY = (pinchFocalY.value - sceneCenterY - pinchStartTy.value) / pinchStartScale.value;
          const nextTx = pinchFocalX.value - sceneCenterX - nextScale * worldDeltaX;
          const nextTy = pinchFocalY.value - sceneCenterY - nextScale * worldDeltaY;
          const xBounds = workletBounds(viewport.width, scene.width, nextScale);
          const yBounds = workletBounds(viewport.height, scene.height, nextScale);
          tx.value = workletClamp(nextTx, xBounds);
          ty.value = workletClamp(nextTy, yBounds);
          scale.value = nextScale;
        })
        .onFinalize(() => {
          runOnJS(commitSnapshot)(tx.value, ty.value, scale.value, false);
        }),
    [
      beginMotion,
      clearFrameFocus,
      commitSnapshot,
      interactionEnabled,
      maxScale,
      minScale,
      pinchFocalX,
      pinchFocalY,
      pinchStartScale,
      pinchStartTx,
      pinchStartTy,
      scale,
      scene.height,
      scene.width,
      tx,
      ty,
      viewport.height,
      viewport.width,
    ]
  );

  const emitWorldTapRelease = useCallback((x: number, y: number) => {
    onWorldTapReleaseRef.current?.(x, y);
  }, []);
  const worldTap = useMemo(() => Gesture.Tap()
    .enabled(interactionEnabled && Boolean(onWorldTapReleaseRef.current))
    .maxDistance(5)
    .onEnd((event, success) => {
      if (!success) return;
      const worldX = (event.x - scene.width / 2 - tx.value) / scale.value + scene.width / 2;
      const worldY = (event.y - scene.height / 2 - ty.value) / scale.value + scene.height / 2;
      runOnJS(emitWorldTapRelease)(worldX, worldY);
    }), [emitWorldTapRelease, interactionEnabled, scale, scene.height, scene.width, tx, ty]);
  const gesture = useMemo(() => Gesture.Simultaneous(pan, pinch, worldTap), [pan, pinch, worldTap]);
  const worldStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const recenter = useCallback(() => {
    clearFrameFocus();
    setFocusedTileId(centerId ?? null);
    if (initialFitWorld) {
      const fitScale = viewport.width && viewport.height
        ? Math.max(minScale, Math.min(baseScale * 0.78, viewport.width / scene.width, viewport.height / scene.height))
        : minScale;
      animateTo(scene.width / 2, scene.height / 2, fitScale, viewport.height / 2, 260);
      return;
    }
    animateTo(center.x, center.y, baseScale, viewport.height / 2 - viewport.height * 0.02, 260);
  }, [animateTo, baseScale, center.x, center.y, centerId, clearFrameFocus, initialFitWorld, minScale, scene.height, scene.width, viewport.height, viewport.width]);

  const focusResident = useCallback(
    (x: number, y: number, options?: { anchorY?: number; durationMs?: number; id?: string; onComplete?: () => void; zoom?: number }) => {
      clearFrameFocus();
      if (options?.id) setFocusedTileId(options.id);
      // An explicit scripted zoom is a destination, not a minimum. The former
      // max(current, requested) rule made FTUE camera retreat impossible after
      // the opening close-up had reached its peak scale.
      const zoom = options?.zoom == null
        ? maxScale
        : Math.min(maxScale, Math.max(minScale, options.zoom));
      const anchorY = options?.anchorY ?? 0.42;
      animateTo(x, y, zoom, viewport.height * anchorY, options?.durationMs ?? 420, options?.onComplete);
    },
    [animateTo, clearFrameFocus, maxScale, minScale, viewport.height]
  );

  const fitWorld = useCallback((durationMs = 680, onComplete?: () => void) => {
    clearFrameFocus();
    setFocusedTileId(null);
    const fitScale = viewport.width && viewport.height
      ? Math.max(minScale, Math.min(baseScale * 0.78, viewport.width / scene.width, viewport.height / scene.height))
      : minScale;
    animateTo(scene.width / 2, scene.height / 2, fitScale, viewport.height / 2, durationMs, onComplete);
  }, [animateTo, baseScale, clearFrameFocus, minScale, scene.height, scene.width, viewport.height, viewport.width]);

  const animateToSnapshot = useCallback((
    snapshot: KingdomCameraSnapshot,
    durationMs = 440,
    onComplete?: () => void,
  ) => {
    if (!cameraViewport.width || !cameraViewport.height) {
      onComplete?.();
      return;
    }
    clearFrameFocus();
    setFocusedTileId(null);
    cancelAnimation(tx);
    cancelAnimation(ty);
    cancelAnimation(scale);
    beginMotion();
    const nextScale = clampHavenCameraScale(snapshot.scale, minScale, maxScale);
    const target = clampCameraTranslation(snapshot, cameraViewport, cameraScene, nextScale);
    const timing = { duration: durationMs, easing: Easing.out(Easing.cubic) };
    tx.value = withTiming(target.tx, timing);
    ty.value = withTiming(target.ty, timing);
    scale.value = withTiming(nextScale, timing, (finished) => {
      if (!finished) return;
      runOnJS(commitSnapshot)(target.tx, target.ty, nextScale, false);
      if (onComplete) runOnJS(onComplete)();
    });
    pinchStartScale.value = nextScale;
  }, [beginMotion, cameraScene, cameraViewport, clearFrameFocus, commitSnapshot, maxScale, minScale, pinchStartScale, scale, tx, ty]);

  // React's settled snapshot intentionally updates only when motion completes.
  // Handoffs, however, must capture the exact frame currently on screen, even
  // midway through another move. Keep that distinction explicit.
  const getSnapshot = useCallback((): KingdomCameraSnapshot => ({
    scale: scale.value,
    tx: tx.value,
    ty: ty.value,
  }), [scale, tx, ty]);

  const focusFrame = useCallback((frame: KingdomWorldFrame, options?: {
    durationMs?: number;
    horizontalPadding?: number;
    onComplete?: () => void;
    screenCenterY?: number;
    verticalPadding?: number;
  }) => {
    if (!viewport.width || !viewport.height || frame.width <= 0 || frame.height <= 0) return;
    const target = kingdomCameraSnapshotForFrame(viewport, scene, frame, {
      horizontalPadding: options?.horizontalPadding,
      maximumScale: maxScale,
      minimumScale: minScale,
      screenCenterY: options?.screenCenterY,
      verticalPadding: options?.verticalPadding,
    });
    const key = [target.tx, target.ty, target.scale].map((value) => value.toFixed(3)).join(':');
    if (frameFocusKeyRef.current === key) {
      options?.onComplete?.();
      return;
    }
    if (
      Math.abs(tx.value - target.tx) < 0.75
      && Math.abs(ty.value - target.ty) < 0.75
      && Math.abs(scale.value - target.scale) < 0.002
    ) {
      commitSnapshot(target.tx, target.ty, target.scale, false);
      options?.onComplete?.();
      return;
    }
    frameFocusKeyRef.current = key;
    setFocusedTileId(null);
    animateTo(
      frame.left + frame.width / 2,
      frame.top + frame.height / 2,
      target.scale,
      options?.screenCenterY ?? viewport.height / 2,
      options?.durationMs ?? 360,
      () => {
        if (frameFocusKeyRef.current === key) frameFocusKeyRef.current = null;
        options?.onComplete?.();
      },
    );
  }, [animateTo, commitSnapshot, maxScale, minScale, scale, scene, tx, ty, viewport]);

  const focusUpgrade = useCallback(
    (x: number, y: number, reducedMotion: boolean, onComplete: () => void) => {
      if (!viewport.width || !viewport.height) {
        onComplete();
        return;
      }
      animateTo(
        x,
        y,
        maxScale,
        viewport.height * 0.46,
        reducedMotion ? HAVEN_UPGRADE_REDUCED_TIMING.cameraMs : HAVEN_UPGRADE_TIMING.cameraMs,
        onComplete,
      );
    },
    [animateTo, maxScale, viewport.height, viewport.width]
  );

  return {
    animateToSnapshot,
    fitWorld,
    focusFrame,
    focusResident,
    focusUpgrade,
    focusedTileId,
    getSnapshot,
    gesture,
    isMoving: renderState.isMoving,
    ready,
    recenter,
    snapshot: renderState.snapshot,
    scaleValue: scale,
    translationXValue: tx,
    translationYValue: ty,
    worldStyle,
  };
}
