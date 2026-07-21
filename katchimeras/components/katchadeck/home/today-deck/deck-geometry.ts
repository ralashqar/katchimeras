import { Extrapolation, interpolate } from 'react-native-reanimated';

export function resolveDeckSlotGeometry(relativePosition: number, stride: number) {
  'worklet';
  const distance = Math.min(2, Math.abs(relativePosition));
  return {
    distance,
    transform: [
      { translateX: relativePosition * stride },
      { translateY: interpolate(distance, [0, 1, 2], [0, 26, 40], Extrapolation.CLAMP) },
      { rotate: `${interpolate(relativePosition, [-2, -1, 0, 1, 2], [-11, -8, 0, 8, 11], Extrapolation.CLAMP)}deg` },
      { scale: interpolate(distance, [0, 1, 2], [1, 0.69, 0.56], Extrapolation.CLAMP) },
    ],
  };
}

