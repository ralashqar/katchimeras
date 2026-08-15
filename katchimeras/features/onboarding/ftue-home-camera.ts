export const FTUE_OPENING_CAMERA_DURATION_MS = 2400;
export const FTUE_OPENING_UI_DELAY_MS = 2450;
export const FTUE_ANSWER_CAMERA_DURATION_MS = 1050;
/** Extra upward scene translation while the camera is looking down toward the Egg. */
export const FTUE_OPENING_CAMERA_PAN_Y = -72;

/**
 * Authored pinch targets for the three-question Egg opening.
 *
 * The first beat travels all the way to the normal gesture maximum. After the
 * Each answer completes one third of the total logarithmic zoom journey.
 * Geometric targets make every transition the same proportional camera move;
 * equal additive scale subtraction makes the later zoom-outs look larger.
 */
export function ftueHomeCameraPinchTarget(
  stepId: string | null | undefined,
  maxPinchScale: number,
): number | null {
  const maximum = Math.max(1, maxPinchScale);
  const targetForAnswersRemaining = (answersRemaining: number) =>
    Math.pow(maximum, answersRemaining / 3);
  switch (stepId) {
    case 'egg.opening':
      return maximum;
    case 'egg.context':
      return targetForAnswersRemaining(2);
    case 'egg.mind':
      return targetForAnswersRemaining(1);
    case 'egg.ready':
      return 1;
    default:
      // The life-to-Energy chapter returns to the identical authored Home
      // camera, settled at the opening sequence's fully zoomed-out endpoint.
      return stepId?.startsWith('energy.') ? 1 : null;
  }
}

export function ftueHomeCameraDuration(stepId: string | null | undefined): number {
  return stepId === 'egg.opening'
    ? FTUE_OPENING_CAMERA_DURATION_MS
    : FTUE_ANSWER_CAMERA_DURATION_MS;
}

/**
 * Keeps the enlarged answer panel from covering the Egg at the closest zoom.
 * The scene translation retreats in the same three authored beats as the
 * logarithmic zoom and reaches the existing FTUE baseline at Egg readiness.
 */
export function ftueHomeCameraPanTarget(stepId: string | null | undefined): number {
  switch (stepId) {
    case 'egg.opening':
      return FTUE_OPENING_CAMERA_PAN_Y;
    case 'egg.context':
      return FTUE_OPENING_CAMERA_PAN_Y * (2 / 3);
    case 'egg.mind':
      return FTUE_OPENING_CAMERA_PAN_Y * (1 / 3);
    default:
      return 0;
  }
}

export function clampFtueCameraPanToCoverage({
  edgeBleed = 0,
  projectedBottom,
  projectedTop,
  requestedPanY,
  viewportHeight,
}: {
  edgeBleed?: number;
  projectedBottom: number;
  projectedTop: number;
  requestedPanY: number;
  viewportHeight: number;
}): number {
  'worklet';
  const safeBleed = Math.max(0, edgeBleed);
  const minimumPanY = viewportHeight + safeBleed - projectedBottom;
  const maximumPanY = -safeBleed - projectedTop;
  if (minimumPanY > maximumPanY) return 0;
  return Math.min(maximumPanY, Math.max(minimumPanY, requestedPanY));
}
