import { Image } from 'expo-image';
import { PixelRatio, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming, cancelAnimation, useReducedMotion } from 'react-native-reanimated';
import { useEffect } from 'react';
import type { StagePlacement } from '../game/layout';
import { DUEL_BACKGROUNDS } from '../data/art';

export function DuelBackdrop({ stage, onDisplay, onError, impactKey }: {
  stage: StagePlacement; onDisplay: () => void; onError: () => void; impactKey: number;
}) {
  const { frame, projection, definition } = stage;
  const sources = DUEL_BACKGROUNDS[definition.id as keyof typeof DUEL_BACKGROUNDS];
  const source = frame.width * PixelRatio.get() <= 640 ? sources.medium : sources.full;
  const light = useSharedValue(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    light.value = 0;
    if (impactKey && !reduced) light.value = withSequence(withTiming(.11, { duration: 60 }), withTiming(0, { duration: 230 }));
    return () => cancelAnimation(light);
  }, [impactKey, reduced, light]);
  const glow = useAnimatedStyle(() => ({ opacity: light.value }));
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <Image source={sources.medium} contentFit="cover" blurRadius={30} style={[StyleSheet.absoluteFill, { opacity: .35 }]} />
    <View style={{ position: 'absolute', width: frame.width, height: frame.height, left: frame.x, top: frame.y, overflow: 'hidden' }}>
      <Image source={source} contentFit="fill" onDisplay={onDisplay} onError={onError}
        style={{ position: 'absolute', left: projection.x - frame.x, top: projection.y - frame.y,
          width: projection.width, height: projection.height }} />
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#FFF0BE' }, glow]} />
    </View>
  </View>;
}
