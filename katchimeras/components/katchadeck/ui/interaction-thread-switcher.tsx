import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Meadow } from '@/constants/meadow-theme';
import { AppFontFamilies } from '@/constants/theme';

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
  const compact = options.length >= 4;
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
            style={({ pressed }) => [styles.tab, compact && styles.compactTab, selected && styles.selected, pressed && styles.pressed]}>
            <IconSymbol name={option.icon} size={15} color={selected ? Meadow.ink : Meadow.inkSoft} />
            <ThemedText numberOfLines={1} style={[styles.label, compact && styles.compactLabel]} lightColor={selected ? Meadow.ink : Meadow.inkSoft} darkColor={selected ? Meadow.ink : Meadow.inkSoft}>{option.label}</ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: 'rgba(123,83,43,0.13)', borderColor: Meadow.cardBorder, borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, boxShadow: '-3px 4px 8px rgba(58,38,18,0.16), inset 0 1px 0 rgba(255,248,230,0.48)', flexDirection: 'row', gap: 4, padding: 4 },
  tab: { alignItems: 'center', borderColor: 'rgba(255,248,230,0.12)', borderCurve: 'continuous', borderRadius: 14, borderWidth: 1, flex: 1, flexDirection: 'row', gap: 7, justifyContent: 'center', minHeight: 46, paddingHorizontal: 8 },
  compactTab: { gap: 4, paddingHorizontal: 4 },
  selected: { backgroundColor: '#F1D38E', borderColor: 'rgba(255,248,230,0.64)', boxShadow: '-2px 3px 7px rgba(82,52,20,0.22), inset 0 1px 0 rgba(255,252,234,0.78)' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  label: { fontFamily: AppFontFamilies.manrope, fontSize: 13, fontWeight: '800', letterSpacing: -0.1 },
  compactLabel: { fontSize: 11.5 },
});
