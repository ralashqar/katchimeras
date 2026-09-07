export const DEFEAT_SHAKE_MS = 1000;
export const DEFEAT_PUFF_MS = 500;
export const DEFEAT_REWARD_AT_MS = 1100;
export const DEFEAT_FINISH_MS = 2300;

export function healthCrackOpacity(healthFraction: number) {
  'worklet';
  return Math.max(0, Math.min(1, (1 - healthFraction) / .9));
}
export function defeatProgress(age: number) {
  'worklet';
  return Math.max(0, Math.min(1, (age - DEFEAT_SHAKE_MS) / DEFEAT_PUFF_MS));
}
