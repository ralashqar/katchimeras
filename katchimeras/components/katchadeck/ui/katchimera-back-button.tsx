import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';

export function KatchimeraBackButton({
  accessibilityHint,
  accessibilityLabel = 'Back',
  onPress,
  style,
}: {
  accessibilityHint?: string;
  accessibilityLabel?: string;
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
      hitSlop={8}
      onPress={goBack}
      style={({ pressed }) => [styles.button, style, pressed && styles.pressed]}
    >
      <IconSymbol name="chevron.left" size={22} color="#71442B" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,244,214,0.97)',
    borderColor: 'rgba(151,96,49,0.28)',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    boxShadow: '0 5px 14px rgba(81,46,28,0.20), inset 0 1px 0 rgba(255,255,255,0.72)',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
