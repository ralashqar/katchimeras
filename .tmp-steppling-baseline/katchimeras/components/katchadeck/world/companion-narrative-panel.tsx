import type { ComponentProps } from 'react';
import Animated from 'react-native-reanimated';
import { KatchaUI } from '@/constants/katcha-ui';

/** The shared conversation surface, also used by short companion activities. */
export function CompanionNarrativePanel({ style, ...props }: ComponentProps<typeof Animated.View>) {
  return <Animated.View {...props} style={[{
    backgroundColor: KatchaUI.companionScenePanel.background,
    borderColor: KatchaUI.companionScenePanel.border,
    borderCurve: 'continuous', borderRadius: 30, borderWidth: 1,
    boxShadow: KatchaUI.companionScenePanel.shadow,
    overflow: 'hidden', paddingHorizontal: 12,
  }, style]} />;
}
