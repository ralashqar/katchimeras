export const REGULAR_TODAY_CAMERA_ACTION_TARGET = 3;

/**
 * Mirrors the three equal logarithmic camera steps used by the Discovery Egg.
 * Saved qualifying action receipts make the camera deterministic across
 * remounts and prevent a replayed completion animation from advancing twice.
 */
export function regularTodayCameraPinchTarget(
  qualifyingActionCount: number,
  maxPinchScale: number,
): number {
  const maximum = Math.max(1, maxPinchScale);
  const completed = Math.min(
    REGULAR_TODAY_CAMERA_ACTION_TARGET,
    Math.max(0, Math.floor(qualifyingActionCount)),
  );
  const actionsRemaining = REGULAR_TODAY_CAMERA_ACTION_TARGET - completed;
  return Math.pow(maximum, actionsRemaining / REGULAR_TODAY_CAMERA_ACTION_TARGET);
}
