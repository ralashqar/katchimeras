import { Image } from 'expo-image';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
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
const ATMOSPHERE: Record<SleepQuality, { emoji: string; title: string; blurb: string }> = {
  good: { emoji: '☀️', title: 'Warm light', blurb: 'Your world woke to a bright morning.' },
  normal: { emoji: '🌤️', title: 'A clear start', blurb: 'A steady, settled morning.' },
  low: { emoji: '🌙', title: 'Soft & misty', blurb: 'A gentle, dreamy start to the day.' },
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
  const tabBarHeight = useBottomTabBarHeight();
  const atmosphere = sleep ? ATMOSPHERE[sleep.quality] : null;
  const hours =
    sleep?.totalSleepMinutes && sleep.totalSleepMinutes > 0
      ? `${Math.floor(sleep.totalSleepMinutes / 60)}h ${sleep.totalSleepMinutes % 60}m`
      : null;

  return (
    <View style={styles.overlay}>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)} style={styles.backdrop}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <Animated.View
        entering={SlideInDown.duration(260)}
        exiting={SlideOutDown.duration(200)}
        style={[styles.sheet, { bottom: tabBarHeight + 10 }]}>
        <View style={styles.grabber} />

        <ThemedText style={styles.kicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
          Sleep
        </ThemedText>

        {atmosphere ? (
          <View style={styles.detail}>
            <View style={styles.detailHead}>
              <ThemedText style={styles.detailEmoji}>{atmosphere.emoji}</ThemedText>
              <ThemedText type="subtitle" lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                {atmosphere.title}
              </ThemedText>
            </View>
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
            <ThemedText style={styles.blurb} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
              {atmosphere.blurb}
            </ThemedText>
          </View>
        ) : (
          <View style={styles.emptyDetail}>
            <ThemedText type="subtitle" lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
              Sleep not set yet
            </ThemedText>
            <ThemedText style={styles.blurb} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
              Add how the day began and the empty nook will settle into its morning atmosphere.
            </ThemedText>
          </View>
        )}

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

        <Pressable accessibilityRole="button" onPress={onClose} style={styles.close}>
          <ThemedText style={styles.closeLabel} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
            {atmosphere ? 'Close' : 'Later'}
          </ThemedText>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, elevation: 24, zIndex: 50 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4, 7, 15, 0.42)' },
  sheet: {
    backgroundColor: '#161226',
    borderColor: 'rgba(255,255,255,0.12)',
    borderCurve: 'continuous',
    borderRadius: 28,
    borderWidth: 1,
    boxShadow: '0 18px 48px rgba(0,0,0,0.55)',
    gap: 10,
    left: 12,
    paddingBottom: 16,
    paddingHorizontal: 18,
    paddingTop: 12,
    position: 'absolute',
    right: 12,
  },
  grabber: { alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999, height: 4, marginBottom: 4, width: 38 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  detail: { gap: 4 },
  emptyDetail: { gap: 6 },
  detailHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailEmoji: { fontSize: 18 },
  hoursRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 2 },
  hoursValue: { fontSize: 26, fontWeight: '800', letterSpacing: 0.2 },
  hoursCaption: { fontSize: 12, fontWeight: '700' },
  blurb: { fontSize: 13.5, fontWeight: '500', lineHeight: 19 },
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
  close: { alignSelf: 'center', paddingTop: 4 },
  closeLabel: { fontSize: 13, fontWeight: '800', lineHeight: 16 },
});
