import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';
import type { DayMovementKind } from '@/types/home';

// Interpret a notably active day — the steps say "a lot moved today", the user says
// what it WAS. One tap, multiple choice. Read-only colour for the day's story; never
// a goal or a score. Shown from the "!" on the Steps structure.

type MovementOption = { movement: DayMovementKind; label: string; emoji: string; tint: string };
const MOVEMENTS: MovementOption[] = [
  { movement: 'hike', label: 'A hike', emoji: '🥾', tint: '#7DE8CD' },
  { movement: 'walk', label: 'A long walk', emoji: '🚶', tint: '#9AE6B4' },
  { movement: 'run', label: 'A run', emoji: '🏃', tint: '#FFC36B' },
  { movement: 'cycle', label: 'A ride', emoji: '🚴', tint: '#92D7FF' },
  { movement: 'workout', label: 'A workout', emoji: '🏋️', tint: '#F49AC1' },
  { movement: 'errands', label: 'Out & about', emoji: '🛍️', tint: '#C7B8FF' },
  { movement: 'travel', label: 'A travel day', emoji: '✈️', tint: '#A78BFA' },
];

export function StepsPromptSheet({
  stepsCount,
  onConfirm,
  onClose,
}: {
  stepsCount?: number | null;
  onConfirm: (input: { movement: DayMovementKind; label: string; emoji: string }) => void;
  onClose: () => void;
}) {
  const tabBarHeight = useBottomTabBarHeight();
  const stepsLine = stepsCount && stepsCount > 0 ? `${stepsCount.toLocaleString()} steps today` : 'A big day of movement';

  return (
    <View style={styles.overlay}>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)} style={styles.backdrop}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View entering={SlideInDown.duration(260)} exiting={SlideOutDown.duration(200)} style={[styles.sheet, { bottom: tabBarHeight + 10 }]}>
        <View style={styles.grabber} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <ThemedText style={styles.kicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
            {stepsLine}
          </ThemedText>
          <Animated.View entering={FadeInDown.duration(220)} style={styles.section}>
            <ThemedText style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
              What kind of day was it?
            </ThemedText>
            <View style={styles.grid}>
              {MOVEMENTS.map((option) => (
                <Pressable
                  key={option.movement}
                  onPress={() => onConfirm({ movement: option.movement, label: option.label, emoji: option.emoji })}
                  style={({ pressed }) => [styles.chip, { borderColor: `${option.tint}66` }, pressed && styles.chipPressed]}>
                  <ThemedText style={styles.chipEmoji}>{option.emoji}</ThemedText>
                  <ThemedText style={styles.chipLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                    {option.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </Animated.View>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.close}>
            <ThemedText style={styles.closeLabel} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
              Later
            </ThemedText>
          </Pressable>
        </ScrollView>
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
    left: 12,
    maxHeight: '74%',
    paddingBottom: 14,
    paddingHorizontal: 18,
    paddingTop: 12,
    position: 'absolute',
    right: 12,
  },
  grabber: { alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999, height: 4, marginBottom: 6, width: 38 },
  scroll: { gap: 8, paddingBottom: 4 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { fontSize: 18, fontWeight: '800', lineHeight: 23 },
  section: { gap: 10, paddingTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(12,10,20,0.7)',
  },
  chipPressed: { backgroundColor: 'rgba(40,34,60,0.9)' },
  chipEmoji: { fontSize: 16 },
  chipLabel: { fontSize: 13, fontWeight: '700' },
  close: { alignSelf: 'center', paddingTop: 6 },
  closeLabel: { fontSize: 13, fontWeight: '800', lineHeight: 16 },
});
