import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';

export function KatchimeraBackButton({
  accessibilityHint,
  accessibilityLabel = 'Back',
  compact = false,
  disabled = false,
  onPress,
  style,
}: {
  accessibilityHint?: string;
  accessibilityLabel?: string;
  compact?: boolean;
  disabled?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const goBack = () => {
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    onPress();
  };

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={goBack}
      style={({ pressed }) => [styles.button, compact && styles.buttonCompact, style, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <IconSymbol name="chevron.left" size={compact ? 21 : 24} color="#74461F" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: '#FFF0CE',
    borderColor: '#C99137',
    borderCurve: 'continuous',
    borderRadius: 17,
    borderWidth: 2,
    boxShadow: '0 5px 14px rgba(81,46,28,0.22), inset 0 2px 0 rgba(255,255,255,0.86), inset 0 -3px 0 rgba(182,116,33,0.17)',
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  buttonCompact: { borderRadius: 15, height: 42, width: 42 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.48 },
});
