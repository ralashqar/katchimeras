export const NAVIGATION_DISTANCE_RATIO = 0.48;
export const SWIPE_PROJECTION_SECONDS = 0.12;
export const SWIPE_DISTANCE = 54;
export const MAX_DRAG_INDEX_DISTANCE = 1.12;
export const DECK_VISUAL_SETTLE_EPSILON = 0.001;

export const DECK_SPRING = {
  damping: 26,
  // Match Reanimated's precise default. A larger cutoff visibly terminated
  // around the last few percent and then wrote the exact target in one frame.
  energyThreshold: 6e-9,
  mass: 0.72,
  overshootClamping: false,
  stiffness: 260,
} as const;

export function resolveDeckStride(windowWidth: number): number {
  return Math.min(210, Math.max(168, windowWidth * NAVIGATION_DISTANCE_RATIO));
}

export function clampDeckIndex(index: number, maxIndex: number): number {
  'worklet';
  return Math.max(0, Math.min(maxIndex, index));
}

export function resolveSwipeTarget({
  maxIndex,
  originIndex,
  translationX,
  velocityX,
}: {
  maxIndex: number;
  originIndex: number;
  translationX: number;
  velocityX: number;
}): number {
  'worklet';
  const projectedTranslation = translationX + velocityX * SWIPE_PROJECTION_SECONDS;
  const direction = projectedTranslation > SWIPE_DISTANCE
    ? -1
    : projectedTranslation < -SWIPE_DISTANCE
      ? 1
      : 0;
  return clampDeckIndex(Math.round(originIndex) + direction, maxIndex);
}

export function resolveDraggedIndex({
  maxIndex,
  originIndex,
  stride,
  translationX,
}: {
  maxIndex: number;
  originIndex: number;
  stride: number;
  translationX: number;
}): number {
  'worklet';
  const rawIndex = originIndex - translationX / stride;
  const localMin = Math.max(0, originIndex - MAX_DRAG_INDEX_DISTANCE);
  const localMax = Math.min(maxIndex, originIndex + MAX_DRAG_INDEX_DISTANCE);
  if (rawIndex < localMin) return localMin + (rawIndex - localMin) * 0.18;
  if (rawIndex > localMax) return localMax + (rawIndex - localMax) * 0.18;
  return rawIndex;
}

export function allDeckIndices(length: number): number[] {
  return length > 0 ? Array.from({ length }, (_, index) => index) : [];
}

export function isHatchTransitionActive({
  active,
  dayId,
  hatchingDayId,
}: {
  active: boolean;
  dayId: string;
  hatchingDayId?: string | null;
}): boolean {
  return active && hatchingDayId === dayId;
}

export function isDeckVisuallySettled(currentIndex: number, targetIndex: number): boolean {
  'worklet';
  return Math.abs(currentIndex - targetIndex) <= DECK_VISUAL_SETTLE_EPSILON;
}
