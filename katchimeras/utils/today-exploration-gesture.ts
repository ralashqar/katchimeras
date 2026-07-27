export type TodayExplorationSwipeDirection = -1 | 1;

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
