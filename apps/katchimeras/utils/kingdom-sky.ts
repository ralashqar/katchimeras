export const KINGDOM_SKY_LAYERS = {
  far: { durationMs: 150_000, horizontalParallax: 0.025, verticalParallax: 0.0125 },
  middle: { durationMs: 105_000, horizontalParallax: 0.055, verticalParallax: 0.0275 },
  near: { durationMs: 75_000, horizontalParallax: 0.09, verticalParallax: 0.045 },
} as const;

export type KingdomSkyLayerId = keyof typeof KINGDOM_SKY_LAYERS;

export function wrapKingdomCloudX(value: number, viewportWidth: number, cloudWidth: number, overscan: number): number {
  'worklet';
  const span = viewportWidth + cloudWidth + overscan * 2;
  if (span <= 0) return value;
  return ((value + overscan + cloudWidth) % span + span) % span - overscan - cloudWidth;
}

export function kingdomSkyMotionEnabled(isFocused: boolean, appIsActive: boolean, reduceMotion: boolean): boolean {
  return isFocused && appIsActive && !reduceMotion;
}
