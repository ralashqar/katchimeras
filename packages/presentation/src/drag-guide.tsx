import { useEffect } from 'react';
import { Image } from 'expo-image';
import { View, type ImageSourcePropType } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

export function DragGuide({ from, to, hand, showHand }: { from: { x: number; y: number }; to: { x: number; y: number }; hand: ImageSourcePropType; showHand: boolean }) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    if (!reduced && showHand) progress.value = withRepeat(withSequence(withTiming(0, { duration: 0 }), withDelay(450, withTiming(1, { duration: 1200 })), withDelay(350, withTiming(1, { duration: 0 }))), -1);
    return () => cancelAnimation(progress);
  }, [progress, reduced, showHand, from.x, from.y, to.x, to.y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: from.x + (to.x - from.x) * progress.value - 104 * .28 }, { translateY: from.y + (to.y - from.y) * progress.value - 104 * .2 }], opacity: .95 }));
  return <View pointerEvents="none" accessibilityElementsHidden style={{ position: 'absolute', inset: 0, zIndex: 82 }}>
    {showHand && <Animated.View style={[{ position: 'absolute', width: 104, height: 104 }, style]}><Image source={hand} style={{ width: 104, height: 104 }} contentFit="contain" /></Animated.View>}
  </View>;
}
