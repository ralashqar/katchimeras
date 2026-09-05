export type TodayExplorationSwipeDirection = -1 | 1;
export type TodayExplorationTransitionPlane = 'background' | 'subject';
export type TodayExplorationTransitionRole = 'current' | 'incoming' | 'static';

export function resolveTodayExplorationDragTranslation({
  gestureStartX,
  maxPan,
  overscrollResistance,
  translationX,
}: {
  gestureStartX: number;
  maxPan: number;
  overscrollResistance: number;
  translationX: number;
}): number {
  'worklet';
  const raw = gestureStartX + translationX;
  const magnitude = Math.abs(raw);
  if (magnitude <= maxPan) return raw;
  const direction = raw < 0 ? -1 : 1;
  return direction * (
    maxPan + (magnitude - maxPan) * overscrollResistance
  );
}

export function resolveTodayExplorationSwipeDirection({
  minDistance,
  minVelocity,
  translationX,
  velocityX,
}: {
  minDistance: number;
  minVelocity: number;
  translationX: number;
  velocityX: number;
}): TodayExplorationSwipeDirection | null {
  'worklet';
  const hasDistance = Math.abs(translationX) >= minDistance;
  const hasVelocity = Math.abs(velocityX) >= minVelocity;
  const continuesInReleaseDirection = translationX * velocityX > 0;
  if (!hasDistance || !hasVelocity || !continuesInReleaseDirection) return null;
  return translationX > 0 ? -1 : 1;
}

export function resolveTodayExplorationTransitionDuration({
  currentX,
  targetX,
}: {
  currentX: number;
  targetX: number;
}): number {
  'worklet';
  const viewportWidth = Math.max(1, Math.abs(targetX));
  const remainingFraction = Math.min(
    1,
    Math.abs(targetX - currentX) / viewportWidth,
  );
  return Math.round(180 + remainingFraction * 100);
}

export function resolveTodayExplorationTransitionOpacity({
  plane,
  progress,
  role,
  selectedIncoming,
}: {
  plane: TodayExplorationTransitionPlane;
  progress: number;
  role: TodayExplorationTransitionRole;
  selectedIncoming: boolean;
}): number {
  'worklet';
  const clampedProgress = Math.max(0, Math.min(1, progress));
  if (role === 'static') return 1;
  if (role === 'incoming' && !selectedIncoming) return 0;
  const easedProgress =
    clampedProgress * clampedProgress * (3 - 2 * clampedProgress);

  if (plane === 'background') {
    if (role === 'incoming') return easedProgress;
    if (clampedProgress <= 0.72) return 1;
    const outgoingFadeProgress = Math.max(
      0,
      Math.min(1, (clampedProgress - 0.72) / 0.28),
    );
    const easedOutgoingFade =
      outgoingFadeProgress
      * outgoingFadeProgress
      * (3 - 2 * outgoingFadeProgress);
    return 1 - easedOutgoingFade;
  }

  return role === 'incoming'
    ? easedProgress
    : 1 - easedProgress;
}
