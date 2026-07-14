import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Lantern } from '@/constants/theme';

export type InteractionThreadOption<T extends string> = {
  id: T;
  label: string;
  icon: IconSymbolName;
};

export function InteractionThreadSwitcher<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly InteractionThreadOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View accessibilityRole="tablist" style={styles.root}>
      {options.map((option) => {
        const selected = value === option.id;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => {
              if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
              onChange(option.id);
            }}
            style={({ pressed }) => [styles.tab, selected && styles.selected, pressed && styles.pressed]}>
            <IconSymbol name={option.icon} size={14} color={selected ? Lantern.emberInk : Lantern.moon300} />
            <ThemedText style={styles.label} lightColor={selected ? Lantern.emberInk : Lantern.moon300} darkColor={selected ? Lantern.emberInk : Lantern.moon300}>{option.label}</ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: Lantern.ink900, borderCurve: 'continuous', borderRadius: 18, flexDirection: 'row', gap: 4, padding: 4 },
  tab: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 14, flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'center', minHeight: 44, paddingHorizontal: 8 },
  selected: { backgroundColor: Lantern.ember300 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  label: { fontSize: 12.5, fontWeight: '900' },
});
