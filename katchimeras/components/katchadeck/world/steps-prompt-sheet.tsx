import { Pressable, ScrollView, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { MeadowSheet } from '@/components/katchadeck/ui/meadow-sheet';
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
  const stepsLine = stepsCount && stepsCount > 0 ? `${stepsCount.toLocaleString()} steps today` : 'A big day of movement';

  return (
    <MeadowSheet onClose={onClose} kicker={stepsLine} title="What kind of day was it?">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Animated.View entering={FadeInDown.duration(220)} style={styles.grid}>
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
        </Animated.View>
      </ScrollView>
    </MeadowSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 8, paddingBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 6 },
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
});
