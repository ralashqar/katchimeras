import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Meadow } from '@/constants/meadow-theme';

export function formatMeditationCountdown(availableAt: number, now: number): string {
  const seconds = Math.max(0, Math.ceil((availableAt - now) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export function meditationProgress(input: {
  availableAt: number;
  now: number;
  settledMs?: number;
  startedAt: number;
}) {
  const naturalAvailableAt = input.availableAt + Math.max(0, input.settledMs ?? 0);
  const duration = Math.max(1, naturalAvailableAt - input.startedAt);
  return Math.max(0, Math.min(1, 1 - Math.max(0, input.availableAt - input.now) / duration));
}

export function CompanionMeditationStage({
  availableAt,
  companionName,
  now,
  settledMs = 0,
  startedAt,
}: {
  availableAt: number;
  companionName: string;
  now: number;
  settledMs?: number;
  startedAt: number;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const countdown = formatMeditationCountdown(availableAt, now);
  const progress = useMemo(
    () => meditationProgress({ availableAt, now, settledMs, startedAt }),
    [availableAt, now, settledMs, startedAt],
  );
  const animatedProgress = useSharedValue(progress);

  useEffect(() => {
    animatedProgress.value = withTiming(progress, { duration: 260 });
  }, [animatedProgress, progress]);

  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: animatedProgress.value }] }));
  const markerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: Math.max(0, trackWidth - 18) * animatedProgress.value }],
  }));

  return (
    <View accessibilityLabel={`${companionName} is meditating. Ready in ${countdown}`} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <IconSymbol color={Meadow.leafDeep} name="timer" size={13} />
          <ThemedText style={styles.label} lightColor={Meadow.ink} darkColor={Meadow.ink}>
            Reflecting
          </ThemedText>
        </View>
        <ThemedText style={styles.countdown} lightColor={Meadow.ink} darkColor={Meadow.ink}>
          {countdown}
        </ThemedText>
      </View>
      <View onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)} style={styles.track}>
        <Animated.View style={[styles.fill, fillStyle]} />
        <Animated.View pointerEvents="none" style={[styles.marker, markerStyle]}>
          <IconSymbol color="#FFF9E9" name="leaf.fill" size={9} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,249,229,0.94)',
    borderColor: 'rgba(113,91,48,0.16)',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    boxShadow: '0 4px 11px rgba(46,36,24,0.1)',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  countdown: { fontSize: 12, fontVariant: ['tabular-nums'], fontWeight: '900', letterSpacing: 0.25 },
  fill: {
    backgroundColor: Meadow.leaf,
    borderRadius: 999,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    transformOrigin: 'left center',
  },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 11, fontWeight: '900' },
  marker: {
    alignItems: 'center',
    backgroundColor: Meadow.leafDeep,
    borderColor: '#FFF9E9',
    borderRadius: 999,
    borderWidth: 1,
    height: 18,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    top: -6,
    width: 18,
  },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  track: { backgroundColor: 'rgba(80,109,66,0.16)', borderRadius: 999, height: 6, marginHorizontal: 1, position: 'relative' },
});
