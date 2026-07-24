export type DailyCardFace = 'front' | 'back';

export function resolveDailyCardFlipTarget(rotationDegrees: number, velocityX: number): 0 | 180 {
  'worklet';
  const projectedRotation = rotationDegrees - velocityX * 0.12;
  return projectedRotation >= 90 ? 180 : 0;
}
