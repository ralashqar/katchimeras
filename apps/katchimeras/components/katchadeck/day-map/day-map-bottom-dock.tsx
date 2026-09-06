import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Meadow } from '@/constants/meadow-theme';
import type { HomeDayRecord } from '@/types/home';

export function DayMapBottomDock({
  dayIndex,
  dayCount,
  previousDay,
  nextDay,
  onPrevious,
  onNext,
}: {
  dayIndex: number;
  dayCount: number;
  previousDay: HomeDayRecord | null;
  nextDay: HomeDayRecord | null;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  return (
    <Animated.View entering={FadeInUp.duration(220)} style={styles.dock}>
      <DayNavigationButton day={previousDay} direction="previous" onPress={onPrevious} />
      <View style={styles.position}>
        <ThemedText selectable style={styles.positionText} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
          {dayIndex + 1}/{dayCount}
        </ThemedText>
      </View>
      <DayNavigationButton day={nextDay} direction="next" onPress={onNext} />
    </Animated.View>
  );
}

function DayNavigationButton({
  day,
  direction,
  onPress,
}: {
  day: HomeDayRecord | null;
  direction: 'previous' | 'next';
  onPress?: () => void;
}) {
  const previous = direction === 'previous';
  const label = previous ? 'Previous' : 'Next';
  const date = day ? `${day.dayLabel} · ${day.dateLabel}` : previous ? 'No earlier day' : 'No later day';

  return (
    <Pressable
      accessibilityLabel={`${label} day${day ? `, ${day.dayLabel}, ${day.dateLabel}` : ', unavailable'}`}
      accessibilityRole="button"
      disabled={!day}
      onPress={onPress}
      style={({ pressed }) => [styles.navigationButton, !day && styles.disabled, pressed && styles.pressed]}>
      {previous ? <IconSymbol name="chevron.left" size={21} color={Meadow.goldDeep} /> : null}
      <View style={[styles.navigationCopy, !previous && styles.navigationCopyNext]}>
        <ThemedText style={styles.directionLabel} lightColor={Meadow.inkFaint} darkColor={Meadow.inkFaint}>
          {label}
        </ThemedText>
        <ThemedText selectable numberOfLines={1} style={styles.dateLabel} lightColor={Meadow.ink} darkColor={Meadow.ink}>
          {date}
        </ThemedText>
      </View>
      {!previous ? <IconSymbol name="chevron.right" size={21} color={Meadow.goldDeep} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dock: {
    alignItems: 'center',
    backgroundColor: 'rgba(249,229,183,0.98)',
    borderColor: 'rgba(123,82,26,0.28)',
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 1,
    boxShadow: '0 10px 28px rgba(18,18,22,0.34), inset 0 1px 0 rgba(255,255,255,0.70)',
    flexDirection: 'row',
    gap: 6,
    padding: 7,
  },
  navigationButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,247,221,0.68)',
    borderColor: 'rgba(123,82,26,0.20)',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    minHeight: 48,
    minWidth: 0,
    paddingHorizontal: 9,
  },
  navigationCopy: { flex: 1, minWidth: 0 },
  navigationCopyNext: { alignItems: 'flex-end' },
  directionLabel: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.6, lineHeight: 11, textTransform: 'uppercase' },
  dateLabel: { fontSize: 11.5, fontWeight: '900', lineHeight: 15 },
  position: { alignItems: 'center', justifyContent: 'center', width: 38 },
  positionText: { fontSize: 10.5, fontVariant: ['tabular-nums'], fontWeight: '900' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.3 },
});
