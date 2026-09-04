export type RewardIconSize = { width: number; height: number };

/** Match the measured image box, not the surrounding currency pill. */
export function rewardIconFlightScale(rise: number, flight: number, tokenSize: number, target: RewardIconSize) {
  'worklet';
  const startScale = 0.58 + rise * 0.48;
  return {
    scaleX: startScale + (target.width / tokenSize - startScale) * flight,
    scaleY: startScale + (target.height / tokenSize - startScale) * flight,
  };
}
