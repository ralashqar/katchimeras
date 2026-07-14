import * as Haptics from 'expo-haptics';
import { useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';
import type { ConstellationPoint } from '@/types/world-identity';

type Props = {
  accentColor: string;
  points: readonly ConstellationPoint[];
  tutorial?: boolean;
  onComplete: () => void;
};

type Size = { width: number; height: number };

export function ConnectStarsGame({ accentColor, points, tutorial = false, onComplete }: Props) {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [connected, setConnected] = useState(1);
  const completedRef = useRef(false);
  const pixelPoints = useMemo(
    () => points.map((point) => ({ x: point.x * size.width, y: point.y * size.height })),
    [points, size]
  );

  function connect(index: number) {
    if (index !== connected || completedRef.current) return;
    const next = connected + 1;
    setConnected(next);
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    if (next >= points.length) {
      completedRef.current = true;
      if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(onComplete, 420);
    }
  }

  const responder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        if (connected === 0) connect(0);
        const { locationX, locationY } = event.nativeEvent;
        const next = pixelPoints[connected];
        if (next && Math.hypot(locationX - next.x, locationY - next.y) <= 34) connect(connected);
      },
      onPanResponderMove: (event) => {
        const { locationX, locationY } = event.nativeEvent;
        const next = pixelPoints[connected];
        if (next && Math.hypot(locationX - next.x, locationY - next.y) <= 34) connect(connected);
      },
    }),
    // PanResponder must track the next expected point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [connected, pixelPoints]
  );

  return (
    <View
      accessibilityLabel="Connect the constellation stars in order"
      onLayout={(event) => setSize(event.nativeEvent.layout)}
      style={styles.board}
      {...responder.panHandlers}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: `${accentColor}0D` }]} />
      {pixelPoints.slice(1, connected).map((point, index) => {
        const from = pixelPoints[index];
        const dx = point.x - from.x;
        const dy = point.y - from.y;
        const length = Math.hypot(dx, dy);
        return <View key={`line-${index}`} style={[styles.line, { backgroundColor: accentColor, left: from.x, top: from.y, width: length, transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }] }]} />;
      })}
      {pixelPoints.map((point, index) => {
        const active = index < connected;
        const next = index === connected;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Star ${index + 1} of ${points.length}${next ? ', next' : ''}`}
            disabled={!next}
            key={`star-${index}`}
            onPress={() => connect(index)}
            style={[styles.starHit, { left: point.x - 24, top: point.y - 24 }]}>
            <View style={[styles.star, { backgroundColor: active ? accentColor : 'rgba(255,255,255,0.24)', boxShadow: active || next ? `0 0 18px ${accentColor}` : 'none' }, next && styles.nextStar]} />
            {tutorial ? <ThemedText style={styles.number} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{index + 1}</ThemedText> : null}
          </Pressable>
        );
      })}
      <ThemedText style={styles.hint} lightColor="rgba(255,255,255,0.72)" darkColor="rgba(255,255,255,0.72)">
        {tutorial ? 'Drag through the numbers, or tap each star.' : 'Trace tonight’s pattern.'}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  board: { backgroundColor: '#111329', borderRadius: 28, height: 320, overflow: 'hidden', position: 'relative', width: '100%' },
  line: { height: 3, position: 'absolute', transformOrigin: 'left center' },
  starHit: { alignItems: 'center', height: 48, justifyContent: 'center', position: 'absolute', width: 48 },
  star: { borderRadius: 999, height: 13, width: 13 },
  nextStar: { borderColor: 'rgba(255,255,255,0.9)', borderWidth: 2, height: 18, width: 18 },
  number: { fontSize: 10, fontWeight: '900', position: 'absolute', top: 32 },
  hint: { bottom: 14, fontSize: 12, left: 16, position: 'absolute', right: 16, textAlign: 'center' },
});
