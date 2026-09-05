export type DailyCardFace = 'front' | 'back';

const HALF_TURN_DEGREES = 180;
const COMMIT_DRAG_DEGREES = 60;
const COMMIT_VELOCITY_X = 460;

export function resolveDailyCardFlipTarget(rotationDegrees: number, velocityX: number): 0 | 180 {
  'worklet';
  const projectedRotation = rotationDegrees - velocityX * 0.12;
  return projectedRotation >= 90 ? 180 : 0;
}

/**
 * Resolve a horizontal card drag without collapsing the card back to a fixed
 * 0..180 range. Keeping the accumulated half turns is what lets either swipe
 * direction continue turning the card naturally from either face.
 */
export function resolveDirectionalDailyCardFlipTarget(
  startRotationDegrees: number,
  draggedRotationDegrees: number,
  velocityX: number,
): number {
  'worklet';
  const dragDelta = draggedRotationDegrees - startRotationDegrees;
  const velocityDirection = Math.abs(velocityX) >= COMMIT_VELOCITY_X
    ? velocityX < 0 ? 1 : -1
    : 0;
  const dragDirection = Math.abs(dragDelta) >= COMMIT_DRAG_DEGREES
    ? dragDelta < 0 ? -1 : 1
    : 0;
  const direction = dragDirection || velocityDirection;
  return startRotationDegrees + direction * HALF_TURN_DEGREES;
}

export function dailyCardFaceForRotation(rotationDegrees: number): DailyCardFace {
  'worklet';
  const halfTurns = Math.round(rotationDegrees / HALF_TURN_DEGREES);
  return Math.abs(halfTurns % 2) === 1 ? 'back' : 'front';
}

export function canonicalDailyCardRotation(rotationDegrees: number): 0 | 180 {
  'worklet';
  return dailyCardFaceForRotation(rotationDegrees) === 'back' ? 180 : 0;
}
