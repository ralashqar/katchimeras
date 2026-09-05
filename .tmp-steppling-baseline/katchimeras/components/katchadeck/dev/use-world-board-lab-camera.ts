import { useCallback, useEffect, useMemo, useState } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDecay,
  withTiming,
} from 'react-native-reanimated';

import type { WorldPoint } from '@/utils/world-board-lab';

export type WorldBoardCameraSnapshot = {
  tx: number;
  ty: number;
  scale: number;
};

type Size = { width: number; height: number };

function clamp(value: number, minimum: number, maximum: number) {
  'worklet';
  return Math.max(minimum, Math.min(maximum, value));
}

function translationBounds(viewportSize: number, sceneSize: number, scale: number) {
  'worklet';
  const scaledSize = sceneSize * scale;
  const centered = viewportSize / 2 - sceneSize / 2;
  if (scaledSize <= viewportSize) return { minimum: centered, maximum: centered };
  return {
    minimum: viewportSize - sceneSize / 2 - scaledSize / 2,
    maximum: scaledSize / 2 - sceneSize / 2,
  };
}

function cameraForTarget(
  viewport: Size,
  scene: Size,
  point: WorldPoint,
  scale: number,
  screenY = viewport.height / 2,
): WorldBoardCameraSnapshot {
  const xBounds = translationBounds(viewport.width, scene.width, scale);
  const yBounds = translationBounds(viewport.height, scene.height, scale);
  return {
    tx: clamp(viewport.width / 2 - scene.width / 2 - (point.x - scene.width / 2) * scale, xBounds.minimum, xBounds.maximum),
    ty: clamp(screenY - scene.height / 2 - (point.y - scene.height / 2) * scale, yBounds.minimum, yBounds.maximum),
    scale,
  };
}

export function useWorldBoardLabCamera({
  boardCellWorldSize,
  scene,
  viewport,
}: {
  boardCellWorldSize: number;
  scene: Size;
  viewport: Size;
}) {
  const reduceMotion = useReducedMotion();
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const pinchStartScale = useSharedValue(1);
  const pinchStartTx = useSharedValue(0);
  const pinchStartTy = useSharedValue(0);
  const pinchFocalX = useSharedValue(0);
  const pinchFocalY = useSharedValue(0);
  const decayCompletions = useSharedValue(0);
  const [snapshot, setSnapshot] = useState<WorldBoardCameraSnapshot>({ tx: 0, ty: 0, scale: 1 });
  const [moving, setMoving] = useState(false);

  const overviewScale = useMemo(() => {
    if (!viewport.width || !viewport.height || !scene.width || !scene.height) return 0.2;
    return Math.max(0.12, Math.min(viewport.width / scene.width, viewport.height / scene.height) * 0.94);
  }, [scene.height, scene.width, viewport.height, viewport.width]);
  const maxScale = Math.max(1.25, overviewScale * 3.5);
  const boardScale = Math.min(maxScale, Math.max(overviewScale * 1.7, 44 / boardCellWorldSize));

  const commit = useCallback((next: WorldBoardCameraSnapshot) => {
    setSnapshot(next);
    setMoving(false);
  }, []);

  const animateTo = useCallback((next: WorldBoardCameraSnapshot, duration = 260) => {
    cancelAnimation(tx);
    cancelAnimation(ty);
    cancelAnimation(scale);
    setMoving(true);
    const timing = { duration: reduceMotion ? 80 : duration, easing: Easing.out(Easing.cubic) };
    tx.value = withTiming(next.tx, timing);
    ty.value = withTiming(next.ty, timing);
    scale.value = withTiming(next.scale, timing, (finished) => {
      if (finished) runOnJS(commit)(next);
    });
  }, [commit, reduceMotion, scale, tx, ty]);

  const overview = useCallback((animated = true) => {
    if (!viewport.width || !viewport.height) return;
    const next = cameraForTarget(viewport, scene, { x: scene.width / 2, y: scene.height / 2 }, overviewScale);
    if (animated) animateTo(next, 300);
    else {
      tx.value = next.tx;
      ty.value = next.ty;
      scale.value = next.scale;
      commit(next);
    }
  }, [animateTo, commit, overviewScale, scale, scene, tx, ty, viewport]);

  const focus = useCallback((point: WorldPoint, requestedScale = boardScale) => {
    if (!viewport.width || !viewport.height) return;
    animateTo(cameraForTarget(viewport, scene, point, clamp(requestedScale, overviewScale, maxScale), viewport.height * 0.48), 320);
  }, [animateTo, boardScale, maxScale, overviewScale, scene, viewport]);

  useEffect(() => {
    overview(false);
  }, [overview]);

  const pan = useMemo(() => Gesture.Pan()
    .maxPointers(1)
    .activeOffsetX([-6, 6])
    .activeOffsetY([-6, 6])
    .onBegin(() => {
      cancelAnimation(tx);
      cancelAnimation(ty);
      panStartX.value = tx.value;
      panStartY.value = ty.value;
      decayCompletions.value = 0;
      runOnJS(setMoving)(true);
    })
    .onChange((event) => {
      const xBounds = translationBounds(viewport.width, scene.width, scale.value);
      const yBounds = translationBounds(viewport.height, scene.height, scale.value);
      tx.value = clamp(panStartX.value + event.translationX, xBounds.minimum, xBounds.maximum);
      ty.value = clamp(panStartY.value + event.translationY, yBounds.minimum, yBounds.maximum);
    })
    .onEnd((event) => {
      const xBounds = translationBounds(viewport.width, scene.width, scale.value);
      const yBounds = translationBounds(viewport.height, scene.height, scale.value);
      if (reduceMotion) {
        runOnJS(commit)({ tx: tx.value, ty: ty.value, scale: scale.value });
        return;
      }
      const completeDecay = (finished?: boolean) => {
        'worklet';
        if (!finished) return;
        decayCompletions.value += 1;
        if (decayCompletions.value === 2) {
          runOnJS(commit)({ tx: tx.value, ty: ty.value, scale: scale.value });
        }
      };
      tx.value = withDecay({
        clamp: [xBounds.minimum, xBounds.maximum],
        deceleration: 0.996,
        velocity: event.velocityX,
      }, completeDecay);
      ty.value = withDecay({
        clamp: [yBounds.minimum, yBounds.maximum],
        deceleration: 0.996,
        velocity: event.velocityY,
      }, completeDecay);
    }),
  [commit, decayCompletions, panStartX, panStartY, reduceMotion, scale, scene.height, scene.width, tx, ty, viewport.height, viewport.width]);

  const pinch = useMemo(() => Gesture.Pinch()
    .onBegin((event) => {
      cancelAnimation(tx);
      cancelAnimation(ty);
      cancelAnimation(scale);
      pinchStartScale.value = scale.value;
      pinchStartTx.value = tx.value;
      pinchStartTy.value = ty.value;
      pinchFocalX.value = event.focalX;
      pinchFocalY.value = event.focalY;
      runOnJS(setMoving)(true);
    })
    .onUpdate((event) => {
      const nextScale = clamp(pinchStartScale.value * event.scale, overviewScale, maxScale);
      const sceneCenterX = scene.width / 2;
      const sceneCenterY = scene.height / 2;
      const worldDeltaX = (pinchFocalX.value - sceneCenterX - pinchStartTx.value) / pinchStartScale.value;
      const worldDeltaY = (pinchFocalY.value - sceneCenterY - pinchStartTy.value) / pinchStartScale.value;
      const xBounds = translationBounds(viewport.width, scene.width, nextScale);
      const yBounds = translationBounds(viewport.height, scene.height, nextScale);
      tx.value = clamp(pinchFocalX.value - sceneCenterX - nextScale * worldDeltaX, xBounds.minimum, xBounds.maximum);
      ty.value = clamp(pinchFocalY.value - sceneCenterY - nextScale * worldDeltaY, yBounds.minimum, yBounds.maximum);
      scale.value = nextScale;
    })
    .onFinalize(() => runOnJS(commit)({ tx: tx.value, ty: ty.value, scale: scale.value })),
  [commit, maxScale, overviewScale, pinchFocalX, pinchFocalY, pinchStartScale, pinchStartTx, pinchStartTy, scale, scene.height, scene.width, tx, ty, viewport.height, viewport.width]);

  const gesture = useMemo(() => Gesture.Simultaneous(pan, pinch), [pan, pinch]);
  const worldStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return {
    boardScale,
    focus,
    gesture,
    moving,
    overview,
    overviewScale,
    snapshot,
    worldStyle,
  };
}

export type WorldBoardLabCamera = ReturnType<typeof useWorldBoardLabCamera>;

export const WorldBoardAnimatedView = Animated.View;
