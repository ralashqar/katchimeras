import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';
import type { BigMomentType } from '@/types/home';

// "Mark today as a big moment" — the Big Moment quest. Pick what kind of moment
// it was; it grows a rare landmark on the patch and lifts the day's Chronicle.

type BigMomentOption = { type: BigMomentType; emoji: string; label: string };

const OPTIONS: BigMomentOption[] = [
  { type: 'birthday', emoji: '🎂', label: 'Birthday' },
  { type: 'milestone', emoji: '🗿', label: 'Milestone' },
  { type: 'trip', emoji: '🧳', label: 'Trip' },
  { type: 'firstTime', emoji: '⭐️', label: 'A first' },
  { type: 'achievement', emoji: '🏆', label: 'Achievement' },
  { type: 'anniversary', emoji: '💛', label: 'Anniversary' },
  { type: 'holiday', emoji: '🎏', label: 'Holiday' },
];

type BigMomentPickerSheetProps = {
  onPick: (type: BigMomentType) => void;
  onClose: () => void;
};

export function BigMomentPickerSheet({ onPick, onClose }: BigMomentPickerSheetProps) {
  const tabBarHeight = useBottomTabBarHeight();

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
          A big moment
        </ThemedText>
        <ThemedText style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
          What made today matter?
        </ThemedText>

        <View style={styles.grid}>
          {OPTIONS.map((option) => (
            <Pressable
              key={option.type}
              onPress={() => onPick(option.type)}
              style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}>
              <ThemedText style={styles.chipEmoji}>{option.emoji}</ThemedText>
              <ThemedText style={styles.chipLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                {option.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <Pressable accessibilityRole="button" onPress={onClose} style={styles.close}>
          <ThemedText style={styles.closeLabel} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
            Later
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
    gap: 8,
    left: 12,
    paddingBottom: 16,
    paddingHorizontal: 18,
    paddingTop: 12,
    position: 'absolute',
    right: 12,
  },
  grabber: { alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999, height: 4, marginBottom: 4, width: 38 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { fontSize: 18, fontWeight: '800', lineHeight: 23 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(12,10,20,0.7)',
  },
  chipPressed: { backgroundColor: 'rgba(40,34,60,0.9)' },
  chipEmoji: { fontSize: 16 },
  chipLabel: { fontSize: 13, fontWeight: '700' },
  close: { alignSelf: 'center', paddingTop: 6 },
  closeLabel: { fontSize: 13, fontWeight: '800', lineHeight: 16 },
});
