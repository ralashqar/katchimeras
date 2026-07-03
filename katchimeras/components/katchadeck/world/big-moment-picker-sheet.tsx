import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MeadowSheet } from '@/components/katchadeck/ui/meadow-sheet';
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

// Shared emoji/label per big-moment type — reused by the reader (BigMomentSheet)
// and anywhere a big moment is shown. 'celebration' isn't a picker option but can
// arrive from note interpretation, so give it a friendly default too.
export const BIG_MOMENT_META: Record<string, { emoji: string; label: string }> = {
  ...Object.fromEntries(OPTIONS.map((option) => [option.type, { emoji: option.emoji, label: option.label }])),
  celebration: { emoji: '🎉', label: 'Celebration' },
};

type BigMomentPickerSheetProps = {
  onPick: (type: BigMomentType) => void;
  onClose: () => void;
};

export function BigMomentPickerSheet({ onPick, onClose }: BigMomentPickerSheetProps) {
  return (
    <MeadowSheet onClose={onClose} kicker="A big moment" title="What made today matter?">
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
    </MeadowSheet>
  );
}

const styles = StyleSheet.create({
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
});
