import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';

// "Name today's patch" (the namePatch quest). The user accepts a suggestion or
// writes their own — it becomes the day's title (a Story Banner). Display-only.
type NameDaySheetProps = {
  initialName?: string | null;
  suggestion?: string | null;
  onSave: (name: string) => void;
  onClose: () => void;
};

export function NameDaySheet({ initialName, suggestion, onSave, onClose }: NameDaySheetProps) {
  const tabBarHeight = useBottomTabBarHeight();
  const [value, setValue] = useState(initialName ?? '');
  const trimmed = value.trim();

  const save = (name: string) => {
    const next = name.trim();
    if (next.length === 0) return;
    onSave(next.slice(0, 40));
    onClose();
  };

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
          Name this day
        </ThemedText>
        <ThemedText style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
          What was today?
        </ThemedText>

        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder="e.g. A slow Sunday"
          placeholderTextColor={Lantern.moon500}
          style={styles.input}
          maxLength={40}
          returnKeyType="done"
          onSubmitEditing={() => save(value)}
          autoFocus
        />

        {suggestion && suggestion.trim() && suggestion.trim() !== trimmed ? (
          <Pressable onPress={() => setValue(suggestion.trim())} style={styles.suggestion}>
            <ThemedText style={styles.suggestionText} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
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
  title: { fontSize: 18, fontWeight: '800', lineHeight: 23 },
  input: {
    marginTop: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(196,186,240,0.22)',
    backgroundColor: 'rgba(12,10,20,0.7)',
    color: Lantern.moon50,
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
  close: { alignSelf: 'center', paddingTop: 2 },
  closeLabel: { fontSize: 13, fontWeight: '800', lineHeight: 16 },
});
