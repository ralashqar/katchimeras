import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchimeraBackButton } from '@/components/katchadeck/ui/katchimera-back-button';

// One close/back control for every full-screen takeover (maps, journal, camera).
// Floats just below the status bar via the top safe-area inset, so it never
// collides with the clock / battery / notch regardless of device.
export function ScreenCloseButton({
  onPress,
  variant = 'close',
  align = 'left',
  tint = '#F8FBFF',
  style,
}: {
  onPress: () => void;
  variant?: 'close' | 'back';
  align?: 'left' | 'right';
  tint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();

  if (variant === 'back') {
    return (
      <KatchimeraBackButton
        accessibilityLabel="Go back"
        onPress={onPress}
        style={[
          styles.backButton,
          align === 'right' ? styles.alignRight : styles.alignLeft,
          { top: insets.top + 10 },
        ]}
      />
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close"
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        align === 'right' ? styles.alignRight : styles.alignLeft,
        { top: insets.top + 10 },
        pressed ? styles.pressed : null,
        style,
      ]}>
      <IconSymbol color={tint} name="xmark" size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: 'rgba(10, 15, 28, 0.6)',
    borderColor: 'rgba(215, 228, 255, 0.18)',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    position: 'absolute',
    width: 40,
    zIndex: 30,
  },
  backButton: { position: 'absolute', zIndex: 30 },
  alignLeft: {
    left: 16,
  },
  alignRight: {
    right: 16,
  },
  pressed: {
    opacity: 0.6,
  },
});
