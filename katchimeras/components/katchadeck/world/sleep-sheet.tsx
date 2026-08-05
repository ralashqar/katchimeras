import { Image } from 'expo-image';
import { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { KatchaSurfacePalette } from '@/constants/katcha-ui';
import type { DaySleep, SleepQuality } from '@/types/home';
import type { FeedSourceRect } from '@/components/katchadeck/home/day-prompt-strip';

// Generated 3D sleep-quality icons (FAL row, style-anchored to the sleep moon).
export const SLEEP_ART: Record<string, number> = {
  good: require('@/assets/images/katchimeras/today-icons/sleep/good.webp'),
  normal: require('@/assets/images/katchimeras/today-icons/sleep/normal.webp'),
  low: require('@/assets/images/katchimeras/today-icons/sleep/low.webp'),
};
const PARCHMENT = KatchaSurfacePalette.parchment;

// Sleep — how the day began. Never a score or a failure; low sleep is just a
// softer, mistier morning. Just the three options (selected one highlighted)
// plus the Health hours when known — no atmosphere tag, no extra question.
export const SLEEP_OPTIONS: { quality: SleepQuality; emoji: string; label: string; accent: string }[] = [
  { quality: 'good', emoji: '☀️', label: 'Good', accent: '#FFC36B' },
  { quality: 'normal', emoji: '🌤️', label: 'Okay', accent: '#A7D5FF' },
  { quality: 'low', emoji: '🌙', label: 'Low', accent: '#AAB2FF' },
];

type SleepSheetProps = {
  sleep: DaySleep | null;
  // Absent → read-only (a past/hatched day): options shown dimmed, no taps.
  // `from` is the tapped tile's screen rect so the host can fly the answer
  // into the egg (same mote flight as the mood sheet).
  onSet?: (quality: SleepQuality, label: string, from: FeedSourceRect) => void;
  onClose: () => void;
};

export function SleepSheet({ sleep, onSet, onClose }: SleepSheetProps) {
  const hours =
    sleep?.totalSleepMinutes && sleep.totalSleepMinutes > 0
      ? `${Math.floor(sleep.totalSleepMinutes / 60)}h ${sleep.totalSleepMinutes % 60}m`
      : null;

  return (
    <KatchaSheet header={{ eyebrow: 'Sleep', title: onSet ? 'How was your sleep?' : 'How the night went' }} onRequestClose={() => onClose()} surface="parchment">
      {hours ? (
        <View style={styles.hoursRow}>
          <ThemedText style={styles.hoursValue} lightColor={PARCHMENT.text} darkColor={PARCHMENT.text}>
            {hours}
          </ThemedText>
          <ThemedText style={styles.hoursCaption} lightColor={PARCHMENT.textTertiary} darkColor={PARCHMENT.textTertiary}>
            last night · Apple Health
          </ThemedText>
        </View>
      ) : null}

      {/* Same tile language as the mood grid: art on top, label beneath,
          accent-tinted when selected. */}
      <View style={styles.row}>
        {SLEEP_OPTIONS.map((option) => (
          <SleepOptionTile
            key={option.quality}
            option={option}
            selected={sleep?.quality === option.quality}
            onSet={onSet}
          />
        ))}
      </View>
    </KatchaSheet>
  );
}

// Measures its own screen rect on tap so the answer can fly into the egg
// (mirrors the mood sheet's choice tiles).
function SleepOptionTile({
  option,
  selected,
  onSet,
}: {
  option: (typeof SLEEP_OPTIONS)[number];
  selected: boolean;
  onSet?: (quality: SleepQuality, label: string, from: FeedSourceRect) => void;
}) {
  const ref = useRef<View | null>(null);
  const handlePress = () => {
    ref.current?.measureInWindow((x, y, w, h) => onSet?.(option.quality, option.label, { x, y, w, h }));
  };
  return (
    <View ref={ref} style={styles.chipCell}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected, disabled: !onSet }}
        disabled={!onSet}
        onPress={handlePress}
        style={({ pressed }) => [
          styles.chip,
          {
            borderColor: selected ? option.accent : `${option.accent}35`,
            backgroundColor: selected ? `${option.accent}32` : PARCHMENT.subtle,
          },
          pressed && onSet ? styles.chipPressed : null,
          !onSet && !selected ? styles.chipMuted : null,
        ]}>
        {SLEEP_ART[option.quality] ? (
          <Image source={SLEEP_ART[option.quality]} style={styles.chipArt} contentFit="contain" />
        ) : (
          <ThemedText style={styles.chipEmoji}>{option.emoji}</ThemedText>
        )}
        <ThemedText style={styles.chipLabel} lightColor={PARCHMENT.text} darkColor={PARCHMENT.text}>
          {option.label}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  hoursRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 2 },
  hoursValue: { fontSize: 26, fontWeight: '800', letterSpacing: 0.2 },
  hoursCaption: { fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  chipCell: { flex: 1 },
  // Mirrors the mood grid tile exactly (size, radius, selection tint).
  chip: {
    alignItems: 'center',
    gap: 3,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  chipPressed: { transform: [{ scale: 0.98 }] },
  chipArt: { height: 30, width: 30 },
  chipMuted: { opacity: 0.55 },
  chipEmoji: { fontSize: 17 },
  chipLabel: { fontSize: 11.5, fontWeight: '800', textAlign: 'center' },
});
