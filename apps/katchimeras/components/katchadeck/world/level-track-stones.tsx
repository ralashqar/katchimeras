import { memo, useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { trackAnchors } from '@/constants/level-track-anchors';

/**
 * A tile's levels drawn on the tile itself while its track is open: cleared
 * stones lit with their stars, the next one breathing, later ones still in the
 * Mist, a few dots of path between. They live in the world's scaled layer, so
 * they zoom with the tile. A playable stone plays its level when tapped.
 */
export type LevelTrackStone = { key: string; number: number; state: 'done' | 'next' | 'ahead'; stars: number; boss: boolean; playable: boolean };

type Frame = { left: number; top: number; width: number; height: number };

export const LevelTrackStones = memo(function LevelTrackStones({ tileKey, frame, stones, reducedMotion, onPress }: {
  tileKey: string; frame: Frame; stones: readonly LevelTrackStone[]; reducedMotion: boolean; onPress?: (key: string) => void;
}) {
  const anchors = trackAnchors(tileKey, stones.length);
  const size = Math.max(14, Math.min(34, frame.width * 0.075));
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reducedMotion) { pulse.setValue(0.5); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse, reducedMotion]);
  const at = (index: number) => ({ x: frame.left + anchors[index]!.fx * frame.width, y: frame.top + anchors[index]!.fy * frame.height });
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
    {stones.slice(1).flatMap((stone, index) => {
      const from = at(index);
      const to = at(index + 1);
      return [0.33, 0.66].map((t) => <View key={`${stone.key}:dot:${t}`} pointerEvents="none"
        style={[styles.dot, { left: from.x + (to.x - from.x) * t - 2, top: from.y + (to.y - from.y) * t - 2 }, stone.state === 'ahead' && styles.dotAhead]} />);
    })}
    {stones.map((stone, index) => {
      const point = at(index);
      const face = stone.state === 'done' ? styles.done : stone.state === 'next' ? styles.next : styles.ahead;
      const box = { left: point.x - size / 2, top: point.y - size / 2, width: size, height: size, borderRadius: size / 2 };
      return <Pressable key={stone.key} accessibilityRole="button" disabled={!stone.playable || !onPress}
        accessibilityLabel={`Level ${stone.number}${stone.boss ? ', a boss' : ''}, ${stone.state === 'done' ? `${stone.stars} of 3 stars` : stone.state === 'next' ? 'next' : 'still in the Mist'}`}
        onPress={() => onPress?.(stone.key)} hitSlop={8} style={[styles.stone, box]}>
        {stone.state === 'next' ? <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.halo, { borderRadius: size, transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1.05, 1.45] }) }], opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0.15] }) }]} /> : null}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.face, face, { borderRadius: size / 2 }, stone.boss && styles.boss]} />
        <Text pointerEvents="none" style={[styles.number, { fontSize: size * 0.42 }, stone.state === 'ahead' && styles.numberAhead]}>{stone.number}</Text>
        {stone.state === 'done' && stone.stars > 0 ? <Text pointerEvents="none" style={[styles.stars, { top: size * 0.86, fontSize: size * 0.3 }]}>{'★'.repeat(stone.stars)}</Text> : null}
      </Pressable>;
    })}
  </View>;
});

const styles = StyleSheet.create({
  stone: { position: 'absolute', alignItems: 'center', justifyContent: 'center', zIndex: 39 },
  face: { borderWidth: 2 },
  done: { backgroundColor: '#FFE7A3', borderColor: '#C9962E' },
  next: { backgroundColor: '#FFF8DE', borderColor: '#F4C95D' },
  ahead: { backgroundColor: 'rgba(226,236,232,0.72)', borderColor: 'rgba(160,178,172,0.8)' },
  boss: { borderWidth: 3, borderColor: '#9C5BD6' },
  halo: { backgroundColor: '#FFE9A8' },
  number: { color: '#5A3E12', fontWeight: '800' },
  numberAhead: { color: '#7C8B86' },
  stars: { position: 'absolute', color: '#E0A628', fontWeight: '800', textShadowColor: 'rgba(90,62,18,0.5)', textShadowRadius: 2 },
  dot: { position: 'absolute', width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,240,196,0.9)', zIndex: 38 },
  dotAhead: { backgroundColor: 'rgba(200,214,208,0.6)' },
});
