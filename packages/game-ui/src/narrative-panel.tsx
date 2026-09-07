import type { ComponentProps } from 'react';
import Animated from 'react-native-reanimated';

/** Shared conversation container; game adapters supply their existing theme. */
export function NarrativePanel({ style, ...props }: ComponentProps<typeof Animated.View>) {
  return <Animated.View {...props} style={[{ borderCurve: 'continuous', borderRadius: 30, borderWidth: 1, overflow: 'hidden', paddingHorizontal: 12 }, style]} />;
}
