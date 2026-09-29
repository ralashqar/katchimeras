import { memo, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

export type WallBurst = { id: number; left: number; top: number; size: number; tier: number; radius?: number; charge?: boolean; healing?: boolean };
const DURATION = 640;

/** One finite UI-thread shockwave; no React updates during animation. */
export const WallImpactBurst = memo(function WallImpactBurst({ burst, reduceMotion, onDone }: {
  burst: WallBurst; reduceMotion: boolean; onDone: (id: number) => void;
}) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: reduceMotion ? 160 : DURATION, easing: Easing.out(Easing.cubic) });
    const timer = setTimeout(() => onDone(burst.id), DURATION + 40);
    return () => { clearTimeout(timer); cancelAnimation(progress); };
  }, [burst.id, onDone, progress, reduceMotion]);
  const reach = burst.radius ?? 0.8 + burst.tier * 0.15;
  const ring = useAnimatedStyle(() => ({ opacity: burst.charge ? 0.4 + progress.value * 0.6 : 1 - progress.value,
    transform: [{ scale: reduceMotion ? 1 : burst.charge ? 1.2 - progress.value * 0.8 : 0.4 + progress.value * (reach * 2 - 0.4) }] }));
  const flash = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - progress.value * 2.2),
    transform: [{ scale: reduceMotion ? 1 : 0.45 + progress.value * 1.8 }] }));
  return <Animated.View pointerEvents="none" style={[styles.root, { left: burst.left, top: burst.top, width: burst.size, height: burst.size }]}>
    {!burst.charge ? <Animated.View style={[styles.flash, flash]} /> : null}
    {!reduceMotion && !burst.charge && !burst.healing ? Array.from({ length: 6 }, (_, index) => <Puff key={`puff:${index}`} index={index} size={burst.size} progress={progress} />) : null}
    <Animated.View style={[styles.ring, { borderColor: burst.charge ? '#FFE5A0' : burst.healing ? '#9BEFFF' : '#E8FFE1', borderWidth: 3 + burst.tier * 0.5 }, ring]} />
    {!reduceMotion && !burst.charge ? Array.from({ length: 6 + burst.tier * 2 }, (_, index) => <Shard key={index} index={index}
      count={6 + burst.tier * 2} distance={burst.size * reach} progress={progress} />) : null}
  </Animated.View>;
});

function Puff({ index, size, progress }: { index: number; size: number; progress: SharedValue<number> }) {
  const angle = index / 6 * Math.PI * 2;
  const style = useAnimatedStyle(() => ({ opacity: Math.sin(progress.value * Math.PI) * 0.65,
    transform: [{ translateX: Math.cos(angle) * size * progress.value * 0.8 },
      { translateY: Math.sin(angle) * size * progress.value * 0.8 - progress.value * size * 0.2 },
      { scale: 0.3 + progress.value * 2.5 }] }));
  return <Animated.View style={[{ position: 'absolute', left: '50%', top: '50%', marginLeft: -size * 0.16, marginTop: -size * 0.16,
    width: size * 0.32, height: size * 0.32, borderRadius: size, backgroundColor: index % 2 ? '#EBF6CE' : '#B9DFAB' }, style]} />;
}

function Shard({ index, count, distance, progress }: { index: number; count: number; distance: number; progress: SharedValue<number> }) {
  const angle = index / count * Math.PI * 2;
  const style = useAnimatedStyle(() => ({ opacity: 1 - progress.value,
    transform: [{ translateX: Math.cos(angle) * distance * progress.value },
      { translateY: Math.sin(angle) * distance * progress.value }, { rotate: `${index * 47}deg` }, { scale: 1.2 - progress.value }] }));
  return <Animated.View style={[styles.shard, index % 2 === 0 && styles.gold, style]} />;
}
const styles = StyleSheet.create({
  root: { position: 'absolute', zIndex: 110, overflow: 'visible' },
  flash: { ...StyleSheet.absoluteFillObject, borderRadius: 100, backgroundColor: '#F5FFD8' },
  ring: { ...StyleSheet.absoluteFillObject, borderRadius: 100, borderWidth: 4, borderColor: '#E8FFE1', backgroundColor: '#91E6A644' },
  shard: { position: 'absolute', left: '50%', top: '50%', marginLeft: -3, marginTop: -5, width: 6, height: 10, borderRadius: 2, backgroundColor: '#BDFFD0' },
  gold: { backgroundColor: '#FFE5A0' },
});
