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
  clampCameraTranslation,
  kingdomCameraSnapshotForTarget,
  residentLodWithHysteresis,
  tileLodWithHysteresis,
  type KingdomCameraSnapshot,
  type KingdomResidentLod,
  type KingdomSize,
} from '@/utils/kingdom-rendering';
import type { KingdomHexTileLod } from '@/utils/world-visuals';
import { HAVEN_UPGRADE_REDUCED_TIMING, HAVEN_UPGRADE_TIMING } from '@/utils/haven-upgrade-presentation';

type CameraRenderState = {
  isMoving: boolean;
  residentLod: KingdomResidentLod;
  snapshot: KingdomCameraSnapshot;
  tileLod: KingdomHexTileLod;
};

type UseKingdomHexCameraArgs = {
  center: { x: number; y: number };
  interactionEnabled?: boolean;
  residentWorldSize: number;
  scene: KingdomSize;
  tileWorldWidth: number;
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
  interactionEnabled = true,
  residentWorldSize,
  scene,
  tileWorldWidth,
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
  const decayCompletions = useSharedValue(0);
  const [ready, setReady] = useState(false);
  const centerX = center.x;
  const centerY = center.y;

  const baseScale = useMemo(
    () =>
      viewport.width && viewport.height
        ? Math.min(1.28, Math.max(0.72, Math.min(viewport.width / 520, viewport.height / 620)))
        : 1,
    [viewport.height, viewport.width]
  );
  const minScale = 0.54;
  const maxScale = 2.25;
  const [renderState, setRenderState] = useState<CameraRenderState>(() => ({
    isMoving: false,
    residentLod: 'thumb',
    snapshot: { tx: 0, ty: 0, scale: 1 },
    tileLod: 'thumb',
  }));

  const commitSnapshot = useCallback(
    (nextTx: number, nextTy: number, nextScale: number, moving = false) => {
      setRenderState((current) => {
        const nextTileLod = tileLodWithHysteresis(current.tileLod, tileWorldWidth * nextScale);
        const nextResidentLod = residentLodWithHysteresis(current.residentLod, residentWorldSize * nextScale);
        const snapshotChanged =
          Math.abs(current.snapshot.tx - nextTx) >= 0.5 ||
          Math.abs(current.snapshot.ty - nextTy) >= 0.5 ||
          Math.abs(current.snapshot.scale - nextScale) >= 0.001;
        if (!snapshotChanged && current.isMoving === moving && nextTileLod === current.tileLod && nextResidentLod === current.residentLod) {
          return current;
        }
        return {
          isMoving: moving,
          residentLod: nextResidentLod,
          snapshot: snapshotChanged ? { tx: nextTx, ty: nextTy, scale: nextScale } : current.snapshot,
          tileLod: nextTileLod,
        };
      });
    },
    [residentWorldSize, tileWorldWidth]
  );

  const beginMotion = useCallback(() => {
    setRenderState((current) => (current.isMoving ? current : { ...current, isMoving: true }));
  }, []);

  useEffect(() => {
    if (!viewport.width || !viewport.height || !scene.width || !scene.height) return;

    if (!initializedRef.current) {
      const home = kingdomCameraSnapshotForTarget(
        viewport,
        scene,
        { x: centerX, y: centerY },
        baseScale,
        { x: viewport.width / 2, y: viewport.height / 2 - viewport.height * 0.02 },
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
    const clamped = clampCameraTranslation(
      { tx: tx.value - sceneDeltaX, ty: ty.value - sceneDeltaY },
      viewport,
      scene,
      scale.value
    );
    tx.value = clamped.tx;
    ty.value = clamped.ty;
    commitSnapshot(clamped.tx, clamped.ty, scale.value, false);
  }, [baseScale, centerX, centerY, commitSnapshot, pinchStartScale, scale, scene, tx, ty, viewport]);

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
              runOnJS(commitSnapshot)(tx.value, ty.value, scale.value, false);
            }
          };
          tx.value = withDecay({ velocity: event.velocityX, deceleration: 0.996, clamp: xBounds }, completeDecay);
          ty.value = withDecay({ velocity: event.velocityY, deceleration: 0.996, clamp: yBounds }, completeDecay);
        }),
    [beginMotion, commitSnapshot, decayCompletions, interactionEnabled, panStartTx, panStartTy, scale, scene.height, scene.width, tx, ty, viewport.height, viewport.width]
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
          runOnJS(beginMotion)();
        })
        .onChange((event) => {
          const nextScale = Math.min(maxScale, Math.max(minScale, pinchStartScale.value * event.scale));
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
      commitSnapshot,
      interactionEnabled,
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
      const nextTx = viewport.width / 2 - scene.width / 2 - (x - scene.width / 2) * zoom;
      const nextTy = screenY - scene.height / 2 - (y - scene.height / 2) * zoom;
      const clamped = clampCameraTranslation({ tx: nextTx, ty: nextTy }, viewport, scene, zoom);
      const timing = { duration, easing: Easing.out(Easing.cubic) };
      tx.value = withTiming(clamped.tx, timing);
      ty.value = withTiming(clamped.ty, timing);
      scale.value = withTiming(zoom, timing, (finished) => {
        if (finished) {
          runOnJS(commitSnapshot)(clamped.tx, clamped.ty, zoom, false);
          if (onComplete) runOnJS(onComplete)();
        }
      });
      pinchStartScale.value = zoom;
    },
    [beginMotion, commitSnapshot, pinchStartScale, scale, scene, tx, ty, viewport]
  );

  const recenter = useCallback(() => {
    animateTo(center.x, center.y, baseScale, viewport.height / 2 - viewport.height * 0.02, 260);
  }, [animateTo, baseScale, center.x, center.y, viewport.height]);

  const focusResident = useCallback(
    (x: number, y: number, options?: { anchorY?: number; durationMs?: number; onComplete?: () => void; zoom?: number }) => {
      const zoom = Math.min(maxScale, Math.max(scale.value, options?.zoom ?? 1.35));
      const anchorY = options?.anchorY ?? 0.42;
      animateTo(x, y, zoom, viewport.height * anchorY, options?.durationMs ?? 420, options?.onComplete);
    },
    [animateTo, scale, viewport.height]
  );

  const fitWorld = useCallback((durationMs = 680, onComplete?: () => void) => {
    const fitScale = viewport.width && viewport.height
      ? Math.max(minScale, Math.min(baseScale * 0.78, viewport.width / scene.width, viewport.height / scene.height))
      : minScale;
    animateTo(scene.width / 2, scene.height / 2, fitScale, viewport.height / 2, durationMs, onComplete);
  }, [animateTo, baseScale, scene.height, scene.width, viewport.height, viewport.width]);

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
      const zoom = 1.45;
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
    [beginMotion, commitSnapshot, pinchStartScale, scale, scene, tx, ty, viewport]
  );

  return {
    fitWorld,
    focusResident,
    focusUpgrade,
    gesture,
    isMoving: renderState.isMoving,
    ready,
    recenter,
    residentLod: renderState.residentLod,
    snapshot: renderState.snapshot,
    tileLod: renderState.tileLod,
    worldStyle,
  };
}
