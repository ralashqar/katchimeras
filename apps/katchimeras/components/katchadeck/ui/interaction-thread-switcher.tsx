import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { KatchaUI } from '@/constants/katcha-ui';
import { useKatchaSurface } from './katcha-surface';

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
  const { tokens } = useKatchaSurface();
  return (
    <View accessibilityRole="tablist" style={[styles.root, { backgroundColor: tokens.subtle, borderColor: tokens.border }]}>
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
            style={({ pressed }) => [
              styles.tab,
              compact && styles.compactTab,
              { borderColor: selected ? tokens.borderStrong : 'transparent' },
              selected && [styles.selected, { backgroundColor: tokens.accent }],
              pressed && styles.pressed,
            ]}>
            <IconSymbol name={option.icon} size={15} color={selected ? tokens.accentText : tokens.textSecondary} />
            <ThemedText numberOfLines={1} style={[styles.label, compact && styles.compactLabel]} lightColor={selected ? tokens.accentText : tokens.textSecondary} darkColor={selected ? tokens.accentText : tokens.textSecondary}>{option.label}</ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderCurve: 'continuous', borderRadius: KatchaUI.radius.card, borderWidth: 1, boxShadow: '-3px 4px 8px rgba(58,38,18,0.16), inset 0 1px 0 rgba(255,248,230,0.48)', flexDirection: 'row', gap: 4, padding: 4 },
  tab: { alignItems: 'center', borderCurve: 'continuous', borderRadius: KatchaUI.radius.control, borderWidth: 1, flex: 1, flexDirection: 'row', gap: 7, justifyContent: 'center', minHeight: KatchaUI.touchTarget, paddingHorizontal: 8 },
  compactTab: { gap: 4, paddingHorizontal: 4 },
  selected: { boxShadow: '-2px 3px 7px rgba(82,52,20,0.22), inset 0 1px 0 rgba(255,252,234,0.78)' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  label: { ...KatchaUI.type.companionAction, fontSize: 13, letterSpacing: -0.1 },
  compactLabel: { fontSize: 11.5 },
});
