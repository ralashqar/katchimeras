export type RewardIconSize = { width: number; height: number };

export function rewardTokenTiming(index: number, reduced: boolean, energy = false) {
  const riseMs = reduced ? 90 : 140;
  const flightStartMs = riseMs + (reduced ? 70 : 150) + index * (reduced ? 25 : 65) + (energy ? 28 : 0);
  const flightMs = reduced ? 240 : 380;
  return { riseMs, flightStartMs, flightMs, arrivalMs: flightStartMs + flightMs };
}

/** Clamp each sprite's clock at contact so landed sprites stop notifying styles. */
export function rewardTokenClock(elapsedMs: number, arrivalMs: number) {
  'worklet';
  return Math.max(0, Math.min(elapsedMs, arrivalMs));
}

/** Match the measured image box, not the surrounding currency pill. */
export function rewardIconFlightScale(rise: number, flight: number, tokenSize: number, target: RewardIconSize) {
  'worklet';
  const startScale = 0.58 + rise * 0.48;
  return {
    scaleX: startScale + (target.width / tokenSize - startScale) * flight,
    scaleY: startScale + (target.height / tokenSize - startScale) * flight,
  };
}
