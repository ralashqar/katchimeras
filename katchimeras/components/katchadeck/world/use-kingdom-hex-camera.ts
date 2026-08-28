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
  interactionEnabled = true,
  initialFitWorld = false,
  magneticFocus,
  minimumScale = 0.54,
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
  const previousSceneRef = useRef(scene);
  const frameFocusKeyRef = useRef<string | null>(null);
  const decayCompletions = useSharedValue(0);
  const [ready, setReady] = useState(false);
  const [focusedTileId, setFocusedTileId] = useState<string | null>(centerId ?? null);
  const centerX = center.x;
  const centerY = center.y;

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
  const maxScale = KINGDOM_RENDERING.havenMaxScale;
  const [renderState, setRenderState] = useState<CameraRenderState>(() => ({
    isMoving: false,
    snapshot: { tx: 0, ty: 0, scale: 1 },
  }));

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
      if (!viewport.width || !viewport.height) {
        onComplete?.();
        return;
      }
      cancelAnimation(tx);
      cancelAnimation(ty);
      cancelAnimation(scale);
      beginMotion();
      const clampedZoom = clampHavenCameraScale(zoom, minScale);
      const nextTx = viewport.width / 2 - scene.width / 2 - (x - scene.width / 2) * clampedZoom;
      const nextTy = screenY - scene.height / 2 - (y - scene.height / 2) * clampedZoom;
      const clamped = clampCameraTranslation({ tx: nextTx, ty: nextTy }, viewport, scene, clampedZoom);
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
    [beginMotion, commitSnapshot, minScale, pinchStartScale, scale, scene, tx, ty, viewport]
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
    if (!viewport.width || !viewport.height || !scene.width || !scene.height) return;

    if (!initializedRef.current) {
      const initialScale = initialFitWorld
        ? Math.max(minScale, Math.min(baseScale * 0.78, viewport.width / scene.width, viewport.height / scene.height))
        : baseScale;
      const home = kingdomCameraSnapshotForTarget(
        viewport,
        scene,
        { x: centerX, y: centerY },
        initialScale,
        { x: viewport.width / 2, y: viewport.height / 2 },
      );
      tx.value = home.tx;
      ty.value = home.ty;
      scale.value = home.scale;
      pinchStartScale.value = home.scale;
      initializedRef.current = true;
      previousSceneRef.current = scene;
      commitSnapshot(home.tx, home.ty, home.scale, false);
      setReady(true);
      return;
    }

    const previousScene = previousSceneRef.current;
    const sceneDeltaX = (scene.width - previousScene.width) / 2;
    const sceneDeltaY = (scene.height - previousScene.height) / 2;
    previousSceneRef.current = scene;
    const nextScale = clampHavenCameraScale(scale.value, minScale);
    const clamped = clampCameraTranslation(
      { tx: tx.value - sceneDeltaX, ty: ty.value - sceneDeltaY },
      viewport,
      scene,
      nextScale
    );
    tx.value = clamped.tx;
    ty.value = clamped.ty;
    scale.value = nextScale;
    commitSnapshot(clamped.tx, clamped.ty, nextScale, false);
  }, [baseScale, centerX, centerY, commitSnapshot, initialFitWorld, minScale, pinchStartScale, scale, scene, tx, ty, viewport]);

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
          const nextScale = clampHavenCameraScale(pinchStartScale.value * event.scale, minScale);
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

  const gesture = useMemo(() => Gesture.Simultaneous(pan, pinch), [pan, pinch]);
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
      const zoom = Math.min(maxScale, Math.max(scale.value, options?.zoom ?? maxScale));
      const anchorY = options?.anchorY ?? 0.42;
      animateTo(x, y, zoom, viewport.height * anchorY, options?.durationMs ?? 420, options?.onComplete);
    },
    [animateTo, clearFrameFocus, maxScale, scale, viewport.height]
  );

  const fitWorld = useCallback((durationMs = 680, onComplete?: () => void) => {
    clearFrameFocus();
    setFocusedTileId(null);
    const fitScale = viewport.width && viewport.height
      ? Math.max(minScale, Math.min(baseScale * 0.78, viewport.width / scene.width, viewport.height / scene.height))
      : minScale;
    animateTo(scene.width / 2, scene.height / 2, fitScale, viewport.height / 2, durationMs, onComplete);
  }, [animateTo, baseScale, clearFrameFocus, minScale, scene.height, scene.width, viewport.height, viewport.width]);

  const focusFrame = useCallback((frame: KingdomWorldFrame, options?: {
    durationMs?: number;
    horizontalPadding?: number;
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
    if (frameFocusKeyRef.current === key) return;
    if (
      Math.abs(tx.value - target.tx) < 0.75
      && Math.abs(ty.value - target.ty) < 0.75
      && Math.abs(scale.value - target.scale) < 0.002
    ) {
      commitSnapshot(target.tx, target.ty, target.scale, false);
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
      },
    );
  }, [animateTo, commitSnapshot, maxScale, minScale, scale, scene, tx, ty, viewport]);

  const focusUpgrade = useCallback(
    (x: number, y: number, reducedMotion: boolean, onComplete: () => void) => {
      if (!viewport.width || !viewport.height) {
        onComplete();
        return;
      }
      cancelAnimation(tx);
      cancelAnimation(ty);
      cancelAnimation(scale);
      beginMotion();
      const zoom = maxScale;
      const screenY = viewport.height * 0.46;
      const nextTx = viewport.width / 2 - scene.width / 2 - (x - scene.width / 2) * zoom;
      const nextTy = screenY - scene.height / 2 - (y - scene.height / 2) * zoom;
      const clamped = clampCameraTranslation({ tx: nextTx, ty: nextTy }, viewport, scene, zoom);
      const timing = {
        duration: reducedMotion ? HAVEN_UPGRADE_REDUCED_TIMING.cameraMs : HAVEN_UPGRADE_TIMING.cameraMs,
        easing: Easing.out(Easing.cubic),
      };
      const finish = () => {
        commitSnapshot(clamped.tx, clamped.ty, zoom, false);
        onComplete();
      };
      tx.value = withTiming(clamped.tx, timing);
      ty.value = withTiming(clamped.ty, timing);
      scale.value = withTiming(zoom, timing, (finished) => {
        if (finished) runOnJS(finish)();
      });
      pinchStartScale.value = zoom;
    },
    [beginMotion, commitSnapshot, maxScale, pinchStartScale, scale, scene, tx, ty, viewport]
  );

  return {
    fitWorld,
    focusFrame,
    focusResident,
    focusUpgrade,
    focusedTileId,
    gesture,
    isMoving: renderState.isMoving,
    ready,
    recenter,
    snapshot: renderState.snapshot,
    worldStyle,
  };
}
