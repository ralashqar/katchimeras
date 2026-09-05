import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { KatchaSurfacePalette } from '@/constants/katcha-ui';
import { Lantern } from '@/constants/theme';

const PARCHMENT = KatchaSurfacePalette.parchment;

// "Name today's patch" (the namePatch quest). The user accepts a suggestion or
// writes their own — it becomes the day's title (a Story Banner). Display-only.
type NameDaySheetProps = {
  initialName?: string | null;
  suggestion?: string | null;
  onSave: (name: string) => void;
  onClose: () => void;
};

export function NameDaySheet({ initialName, suggestion, onSave, onClose }: NameDaySheetProps) {
  const [value, setValue] = useState(initialName ?? '');
  const trimmed = value.trim();

  const save = (name: string) => {
    const next = name.trim();
    if (next.length === 0) return;
    onSave(next.slice(0, 40));
    onClose();
  };

  return (
    <KatchaSheet header={{ eyebrow: 'Name this day', title: 'What was today?' }} keyboardAvoiding onRequestClose={() => onClose()} surface="parchment">
      <View style={styles.body}>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder="e.g. A slow Sunday"
          placeholderTextColor={PARCHMENT.textTertiary}
          style={styles.input}
          maxLength={40}
          returnKeyType="done"
          onSubmitEditing={() => save(value)}
          autoFocus
        />

        {suggestion && suggestion.trim() && suggestion.trim() !== trimmed ? (
          <Pressable onPress={() => setValue(suggestion.trim())} style={styles.suggestion}>
            <ThemedText style={styles.suggestionText} lightColor={PARCHMENT.textSecondary} darkColor={PARCHMENT.textSecondary}>
              Use “{suggestion.trim()}”
            </ThemedText>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={trimmed.length === 0}
          onPress={() => save(value)}
          style={[styles.save, trimmed.length === 0 ? styles.saveDisabled : null]}>
          <ThemedText style={styles.saveLabel} lightColor={Lantern.emberInk} darkColor={Lantern.emberInk}>
            Name it
          </ThemedText>
        </Pressable>
      </View>
    </KatchaSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: 10 },
  input: {
    marginTop: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: PARCHMENT.subtle,
    borderColor: PARCHMENT.border,
    color: PARCHMENT.text,
    fontSize: 16,
    fontWeight: '600',
  },
  suggestion: { alignSelf: 'flex-start', paddingVertical: 4 },
  suggestionText: { fontSize: 13, fontWeight: '700' },
  save: {
    marginTop: 2,
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: Lantern.ember300,
  },
  saveDisabled: { opacity: 0.4 },
  saveLabel: { fontSize: 14, fontWeight: '800' },
});
