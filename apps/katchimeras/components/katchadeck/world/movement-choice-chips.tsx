import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { KatchaSurfacePalette } from '@/constants/katcha-ui';
import type { DayMovementKind } from '@/types/home';

export type MovementChoiceOption = {
  movement: DayMovementKind;
  label: string;
  emoji: string;
  tint: string;
};

export const FTUE_MOVEMENT_CHOICES: readonly MovementChoiceOption[] = [
  { movement: 'walk', label: 'A walk', emoji: '\u{1F6B6}', tint: '#9AE6B4' },
  { movement: 'hike', label: 'A hike', emoji: '\u{1F97E}', tint: '#7DE8CD' },
  { movement: 'run', label: 'A run', emoji: '\u{1F3C3}', tint: '#FFC36B' },
  { movement: 'workout', label: 'A workout', emoji: '\u{1F3CB}\u{FE0F}', tint: '#F49AC1' },
  { movement: 'transit', label: 'Getting around', emoji: '\u{1F687}', tint: '#8FC9FF' },
  { movement: 'errands', label: 'Errands', emoji: '\u{1F6CD}\u{FE0F}', tint: '#C7B8FF' },
  { movement: 'mixed', label: 'Something else', emoji: '\u{1F9ED}', tint: '#D3B7FF' },
] as const;

const PARCHMENT = KatchaSurfacePalette.parchment;

export function MovementChoiceChips({ options, onChoose }: {
  options: readonly MovementChoiceOption[];
  onChoose: (option: MovementChoiceOption) => void;
}) {
  return <View style={styles.grid}>
    {options.map((option) => <Pressable
      accessibilityLabel={option.label}
      accessibilityRole="button"
      key={option.movement}
      onPress={() => onChoose(option)}
      style={({ pressed }) => [styles.chip, { borderColor: `${option.tint}66` }, pressed && styles.pressed]}>
      <ThemedText style={styles.emoji}>{option.emoji}</ThemedText>
      <ThemedText selectable style={styles.label} lightColor={PARCHMENT.text} darkColor={PARCHMENT.text}>{option.label}</ThemedText>
    </Pressable>)}
  </View>;
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 6 },
  chip: { alignItems: 'center', backgroundColor: PARCHMENT.subtle, borderCurve: 'continuous', borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 7, minHeight: 40, paddingHorizontal: 13, paddingVertical: 8 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  emoji: { fontSize: 16 },
  label: { fontSize: 13, fontWeight: '700' },
});
