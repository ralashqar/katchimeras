import { useEffect } from 'react';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { Copy } from './ui';

const WORDS = ['GOOD', 'GREAT', 'EPIC', 'LEGENDARY', 'GODLIKE'];
const COLORS = ['#DBFFB1', '#FFCCA2', '#FFE095', '#EAC4FF', '#FFF5AC'];

/** Formula Snap's climbing wordmark, softened to suit the egg stage. Never catches touches. */
export function CombatCallout({ label, streak, perfect, sequence, reduced, stage = false, compact = false }: {
  stage?: boolean; compact?: boolean; label: string; streak: number; perfect: boolean; sequence: number; reduced: boolean;
}) {
  const scale = useSharedValue(1);
  const tier = Math.min(4, Math.max(0, Math.floor((streak - 1) / 2)));
  const color = perfect ? COLORS[tier] : '#FFF0A9';
  useEffect(() => {
    scale.value = perfect && !reduced
      ? withSequence(withTiming(1.1, { duration: 90 }), withTiming(1, { duration: 240 })) : 1;
    return () => cancelAnimation(scale);
  }, [sequence, perfect, reduced, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View pointerEvents="none" style={[{ paddingVertical: 3, overflow: 'visible' }, style]}>
    <Copy numberOfLines={1} adjustsFontSizeToFit style={{ textAlign: 'center', color,
      fontFamily: 'EggDisplay', fontSize: stage ? (perfect ? (compact ? 28 : 38) : 16) : perfect ? 28 : 23,
      lineHeight: stage ? (perfect ? (compact ? 38 : 50) : 22) : perfect ? 36 : 31, fontWeight: '400',
      textShadowColor: '#19301D', textShadowRadius: stage ? 6 : perfect ? 8 : 0,
      textShadowOffset: { width: 0, height: 0 } }}>
      {perfect ? `${WORDS[tier]} · ${streak}` : label}
    </Copy>
    {perfect && !stage && <Copy style={{ textAlign: 'center', fontSize: compact ? 9 : 10, lineHeight: compact ? 12 : 14, color }}>{label}</Copy>}
  </Animated.View>;
}
