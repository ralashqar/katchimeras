import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MeadowSheet } from '@/components/katchadeck/ui/meadow-sheet';
import { Lantern } from '@/constants/theme';
import type { DaySleep, SleepQuality } from '@/types/home';

// Generated 3D sleep-quality icons (FAL row, style-anchored to the sleep moon).
const SLEEP_ART: Record<string, number> = {
  good: require('@/assets/images/katchimeras/today-icons/sleep/good.webp'),
  normal: require('@/assets/images/katchimeras/today-icons/sleep/normal.webp'),
  low: require('@/assets/images/katchimeras/today-icons/sleep/low.webp'),
};

// Sleep — how the day began. Never a score or a failure; low sleep is just a
// softer, mistier morning. Shows the atmosphere (+ hours if Health knows them)
// and always lets you answer / re-answer "how was it?".
const ATMOSPHERE: Record<SleepQuality, { emoji: string; title: string }> = {
  good: { emoji: '☀️', title: 'Warm light' },
  normal: { emoji: '🌤️', title: 'A clear start' },
  low: { emoji: '🌙', title: 'Soft & misty' },
};
const OPTIONS: { quality: SleepQuality; emoji: string; label: string }[] = [
  { quality: 'good', emoji: '☀️', label: 'Good' },
  { quality: 'normal', emoji: '🌤️', label: 'Okay' },
  { quality: 'low', emoji: '🌙', label: 'Low' },
];

type SleepSheetProps = {
  sleep: DaySleep | null;
  // Absent → read-only (a past/hatched day): show the atmosphere + hours, no chips.
  onSet?: (quality: SleepQuality) => void;
  onClose: () => void;
};

export function SleepSheet({ sleep, onSet, onClose }: SleepSheetProps) {
  const atmosphere = sleep ? ATMOSPHERE[sleep.quality] : null;
  const hours =
    sleep?.totalSleepMinutes && sleep.totalSleepMinutes > 0
      ? `${Math.floor(sleep.totalSleepMinutes / 60)}h ${sleep.totalSleepMinutes % 60}m`
      : null;

  return (
    <MeadowSheet
      onClose={onClose}
      kicker="Sleep"
      title={atmosphere ? `${atmosphere.emoji} ${atmosphere.title}` : 'Sleep not set yet'}>
      {hours ? (
        <View style={styles.hoursRow}>
          <ThemedText style={styles.hoursValue} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            {hours}
          </ThemedText>
          <ThemedText style={styles.hoursCaption} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
            last night · Apple Health
          </ThemedText>
        </View>
      ) : null}

      {onSet ? (
        <>
          <ThemedText style={styles.question} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
            {atmosphere ? 'How did it really feel?' : 'How was your sleep?'}
          </ThemedText>
          <View style={styles.row}>
            {OPTIONS.map((option) => {
              const selected = sleep?.quality === option.quality;
              return (
                <Pressable
                  key={option.quality}
                  onPress={() => onSet(option.quality)}
                  style={[styles.chip, selected ? styles.chipSelected : null]}>
                  {SLEEP_ART[option.quality] ? (
                    <Image source={SLEEP_ART[option.quality]} style={{ height: 30, width: 30 }} contentFit="contain" />
                  ) : (
                    <ThemedText style={styles.chipEmoji}>{option.emoji}</ThemedText>
                  )}
                  <ThemedText style={styles.chipLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                    {option.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
    </MeadowSheet>
  );
}

const styles = StyleSheet.create({
  hoursRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 2 },
  hoursValue: { fontSize: 26, fontWeight: '800', letterSpacing: 0.2 },
  hoursCaption: { fontSize: 12, fontWeight: '700' },
  question: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  row: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: 'rgba(12,10,20,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(196,186,240,0.14)',
  },
  chipSelected: { borderColor: Lantern.ember300, backgroundColor: 'rgba(255,195,107,0.12)' },
  chipEmoji: { fontSize: 15 },
  chipLabel: { fontSize: 13, fontWeight: '700' },
});
