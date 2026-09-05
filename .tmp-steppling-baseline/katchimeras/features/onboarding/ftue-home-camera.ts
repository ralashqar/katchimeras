export const FTUE_OPENING_CAMERA_DURATION_MS = 2400;
export const FTUE_OPENING_UI_DELAY_MS = 2450;
export const FTUE_ANSWER_CAMERA_DURATION_MS = 1050;
/** Extra upward scene translation while the camera is looking down toward the Egg. */
export const FTUE_OPENING_CAMERA_PAN_Y = -72;

/**
 * Authored pinch targets for the five-question Egg opening.
 */
export function ftueHomeCameraPinchTarget(
  stepId: string | null | undefined,
  maxPinchScale: number,
): number | null {
  const maximum = Math.max(1, maxPinchScale);
  const targetForAnswersRemaining = (answersRemaining: number, total = 3) =>
    Math.pow(maximum, answersRemaining / total);
  switch (stepId) {
    case 'egg.opening':
      return maximum;
    case 'egg.context':
      return targetForAnswersRemaining(4, 5);
    case 'egg.mind':
      return targetForAnswersRemaining(3, 5);
    case 'egg.nature_theme':
      return targetForAnswersRemaining(2, 5);
    case 'egg.companion_identity':
      return targetForAnswersRemaining(1, 5);
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
 * The scene translation retreats across the five answers and reaches the
 * normal baseline when the Egg is ready.
 */
export function ftueHomeCameraPanTarget(stepId: string | null | undefined): number {
  switch (stepId) {
    case 'egg.opening':
      return FTUE_OPENING_CAMERA_PAN_Y;
    case 'egg.context':
      return FTUE_OPENING_CAMERA_PAN_Y * (4 / 5);
    case 'egg.mind':
      return FTUE_OPENING_CAMERA_PAN_Y * (3 / 5);
    case 'egg.nature_theme':
      return FTUE_OPENING_CAMERA_PAN_Y * (2 / 5);
    case 'egg.companion_identity':
      return FTUE_OPENING_CAMERA_PAN_Y * (1 / 5);
    default:
      return 0;
  }
}

/** The relationship-first Grove opening retreats once per Egg answer. */
export function mossproutGroveEggCameraPinchTarget(
  stepId: string | null | undefined,
  maxPinchScale: number,
): number | null {
  const maximum = Math.max(1, maxPinchScale);
  switch (stepId) {
    case 'egg.opening':
      return maximum;
    case 'egg.context':
      return Math.pow(maximum, 2 / 3);
    case 'egg.mind':
      return Math.pow(maximum, 1 / 3);
    case 'egg.ready':
      return 1;
    default:
      return null;
  }
}

export function mossproutGroveEggCameraPanTarget(stepId: string | null | undefined): number {
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

export function mossproutGroveEggCameraDuration(stepId: string | null | undefined): number {
  return stepId === 'egg.opening'
    ? FTUE_OPENING_CAMERA_DURATION_MS
    : FTUE_ANSWER_CAMERA_DURATION_MS;
}

/**
 * Keep the Grove Egg on Today's established visual curve while reserving a
 * distinct size for each of the two authored answers:
 *
 *   waiting  -> 0.60x
 *   answer 1 -> 0.80x
 *   answer 2 -> 1.00x
 *
 * The non-zero starting ratio deliberately makes the opening Egg a little
 * larger than the generic daily Egg without making the first answer look
 * hatch-ready.
 */
export function mossproutGroveEggEnergyRatio(answeredCount: number): number {
  const completed = Math.min(2, Math.max(0, answeredCount));
  return 0.1 + completed * 0.2;
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
