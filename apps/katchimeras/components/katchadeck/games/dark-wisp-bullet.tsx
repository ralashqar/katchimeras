import { memo, useEffect } from 'react';
import { View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

export type DarkBullet = { id: number; from: { x: number; y: number }; to: { x: number; y: number }; size: number; flightMs: number };

/** Finite dark projectile and impact, animated on the UI thread. */
export const DarkWispBullet = memo(function DarkWispBullet({ shot, reduceMotion, onDone }: { shot: DarkBullet; reduceMotion: boolean; onDone: (id: number) => void }) {
  const time = useSharedValue(0);
  useEffect(() => {
    time.value = withTiming(shot.flightMs + 300, { duration: shot.flightMs + 300, easing: Easing.linear });
    const timer = setTimeout(() => onDone(shot.id), shot.flightMs + 340);
    return () => { clearTimeout(timer); cancelAnimation(time); };
  }, [shot, time, onDone]);
  const style = useAnimatedStyle(() => {
    const p = Math.min(1, time.value / shot.flightMs);
    return { opacity: reduceMotion || p >= 1 ? 0 : 1, transform: [
      { translateX: shot.from.x + (shot.to.x - shot.from.x) * p - shot.size / 2 },
      { translateY: shot.from.y + (shot.to.y - shot.from.y) * p - shot.size / 2 },
    ] };
  });
  return <View pointerEvents="none" style={{ position: 'absolute', inset: 0, zIndex: 110 }}>
    <Animated.View style={[{ position: 'absolute', width: shot.size, height: shot.size, borderRadius: shot.size, backgroundColor: '#21102F', borderWidth: 3, borderColor: '#8E46C4' }, style]} />
    {Array.from({ length: reduceMotion ? 1 : 6 }, (_, index) => <Impact key={index} index={index} shot={shot} time={time} reduceMotion={reduceMotion} />)}
  </View>;
});

function Impact({ shot, index, time, reduceMotion }: { shot: DarkBullet; index: number; time: SharedValue<number>; reduceMotion: boolean }) {
  const style = useAnimatedStyle(() => {
    const p = Math.max(0, Math.min(1, (time.value - shot.flightMs) / 300));
    const angle = index * Math.PI / 3;
    const distance = reduceMotion ? 0 : p * shot.size * 1.8;
    return { opacity: time.value < shot.flightMs ? 0 : 1 - p, transform: [
      { translateX: Math.cos(angle) * distance }, { translateY: Math.sin(angle) * distance }, { scale: 1.4 - p },
    ] };
  });
  return <Animated.View style={[{ position: 'absolute', left: shot.to.x - 4, top: shot.to.y - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: '#BD78F0', borderWidth: 1, borderColor: '#35133F' }, style]} />;
}
