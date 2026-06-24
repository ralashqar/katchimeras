import { Pressable, StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Lantern } from '@/constants/theme';

type WorldActionStackProps = {
  onCamera: () => void;
  onMicTap: () => void;
  onMicPressIn: () => void;
  onMicPressOut: () => void;
  onAdd: () => void;
  // Manually mark where you are right now as a place (when passive missed it).
  onAddPlace?: () => void;
  recording?: boolean;
};

// The floating vertical controls on the right: capture a photo, add a note (tap)
// or hold the mic to record a voice note, mark the current place, and the
// primary "+" to add to today.
export function WorldActionStack({
  onCamera,
  onMicTap,
  onMicPressIn,
  onMicPressOut,
  onAdd,
  onAddPlace,
  recording = false,
}: WorldActionStackProps) {
  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Capture a moment with the camera"
        onPress={onCamera}
        style={styles.secondary}>
        <IconSymbol name="camera.fill" size={18} color={Lantern.moon50} />
      </Pressable>
      {onAddPlace ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add the place you're at now"
          onPress={onAddPlace}
          style={styles.secondary}>
          <IconSymbol name="mappin.and.ellipse" size={18} color={Lantern.moon50} />
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tap to write a note, hold to record a voice note"
        onPress={onMicTap}
        onLongPress={onMicPressIn}
        delayLongPress={250}
        onPressOut={onMicPressOut}
        style={[styles.secondary, recording ? styles.recording : null]}>
        <IconSymbol name="mic.fill" size={18} color={Lantern.moon50} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add to today"
        onPress={onAdd}
        style={styles.primary}>
        <IconSymbol name="plus" size={24} color={Lantern.emberInk} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: 12 },
  secondary: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(28,24,48,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(196,186,240,0.16)',
  },
  recording: { backgroundColor: Lantern.auroraRose, borderColor: Lantern.auroraRose },
  primary: {
    width: 56,
    height: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Lantern.ember300,
    boxShadow: '0 12px 28px rgba(255,195,107,0.36)',
    marginTop: 4,
  },
});
