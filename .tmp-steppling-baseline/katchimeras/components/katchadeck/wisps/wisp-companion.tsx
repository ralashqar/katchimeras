import { useEffect } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { wispDefinition } from '@/constants/wisps';
import type { WispId } from '@/types/wisp';
import { WispArtwork } from './wisp-artwork';

export type WispBehavior = 'idle' | 'inspect' | 'orbit' | 'surprised' | 'nervous' | 'back-away' | 'celebrate';

export function WispCompanion({ id, size, behavior = 'idle', style }: { id: WispId; size: number; behavior?: WispBehavior; style?: StyleProp<ViewStyle> }) {
  const reduceMotion = useReducedMotion();
  const definition = wispDefinition(id);
  const y = useSharedValue(0);
  const x = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      y.value = 0; x.value = 0; scale.value = 1; return;
    }
    const duration = definition.personality === 'energetic' ? 760 : definition.personality === 'sleepy' ? 1900 : 1250;
    y.value = withRepeat(withSequence(withTiming(-size * 0.06, { duration, easing: Easing.inOut(Easing.sin) }), withTiming(size * 0.03, { duration, easing: Easing.inOut(Easing.sin) })), -1, true);
    if (behavior === 'orbit' || behavior === 'celebrate') {
      x.value = withRepeat(withSequence(withTiming(size * 0.2, { duration: 360 }), withTiming(-size * 0.2, { duration: 360 })), 2, true);
      scale.value = withSequence(withTiming(1.18, { duration: 180 }), withTiming(1, { duration: 260 }));
    } else if (behavior === 'back-away') {
      x.value = withTiming(size * 0.28, { duration: 260 });
      scale.value = withTiming(0.88, { duration: 260 });
    } else if (behavior === 'surprised' || behavior === 'nervous') {
      scale.value = withSequence(withTiming(1.14, { duration: 120 }), withTiming(0.96, { duration: 120 }), withTiming(1, { duration: 180 }));
    } else {
      x.value = withTiming(0, { duration: 220 });
      scale.value = withTiming(1, { duration: 220 });
    }
  }, [behavior, definition.personality, reduceMotion, scale, size, x, y]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }] }));
  return <Animated.View pointerEvents="none" style={[style, animatedStyle]}><WispArtwork id={id} size={size} /></Animated.View>;
}
