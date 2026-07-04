import { useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Lantern } from '@/constants/theme';
import { Meadow } from '@/constants/meadow-theme';

// The quick note composer — tapping the mic opens THIS instead of a full
// screen: a single text box pinned in the TOP HALF of the screen (never under
// the keyboard) over the dimmed page. Enter submits and the box becomes a
// small "Reading…" spinner while the on-device interpreter works; tapping
// outside (or ✕) cancels. Recording stays on hold-the-mic — there is
// deliberately no record button here.
type QuickNoteComposerProps = {
  onClose: () => void;
  // Interpret + persist the note; the composer closes itself once it resolves.
  onSubmit: (text: string) => Promise<void>;
};

export function QuickNoteComposer({ onClose, onSubmit }: QuickNoteComposerProps) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [reading, setReading] = useState(false);

  const submit = async () => {
    const trimmed = text.trim();
    if (reading) return;
    if (!trimmed) {
      onClose();
      return;
    }
    Keyboard.dismiss();
    setReading(true);
    try {
      await onSubmit(trimmed);
      onClose();
    } catch {
      // Interpretation always resolves to SOMETHING (rules fallback), so this
      // is storage-level failure — reopen the input rather than losing text.
      setReading(false);
    }
  };

  return (
    <View style={styles.overlay}>
      <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(160)} style={styles.backdrop}>
        <Pressable disabled={reading} onPressIn={onClose} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(220)}
        exiting={FadeOutUp.duration(180)}
        style={[styles.card, { top: insets.top + 96 }]}>
        {reading ? (
          <View style={styles.readingRow}>
            <ActivityIndicator color={Lantern.ember300} size="small" />
            <ThemedText style={styles.readingLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
              Reading…
            </ThemedText>
          </View>
        ) : (
          <View style={styles.inputRow}>
            <TextInput
              autoFocus
              onChangeText={setText}
              onSubmitEditing={submit}
              placeholder="What happened?"
              placeholderTextColor="rgba(251, 243, 228, 0.45)"
              returnKeyType="send"
              selectionColor={Lantern.ember300}
              style={styles.input}
              value={text}
            />
            <Pressable accessibilityRole="button" accessibilityLabel="Cancel" hitSlop={10} onPress={onClose} style={styles.closeX}>
              <IconSymbol name="xmark" size={12} color="rgba(251, 243, 228, 0.75)" />
            </Pressable>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, elevation: 60, zIndex: 60 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4, 7, 15, 0.35)' },
  // Pinned in the top half of the screen — the keyboard can never cover it.
  card: {
    backgroundColor: Meadow.overlay.sheetBg,
    borderColor: Meadow.overlay.sheetBorder,
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 1,
    boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
    left: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    position: 'absolute',
    right: 14,
  },
  inputRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  input: {
    color: '#FBF3E4',
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
  },
  closeX: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,248,230,0.18)',
    borderRadius: 999,
    borderWidth: 1,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  readingRow: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'center', paddingVertical: 8 },
  readingLabel: { fontSize: 14.5, fontWeight: '700' },
});
