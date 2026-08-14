export const FTUE_OPENING_CAMERA_DURATION_MS = 2400;
export const FTUE_OPENING_UI_DELAY_MS = 2450;
export const FTUE_ANSWER_CAMERA_DURATION_MS = 1050;

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
