import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Lantern } from '@/constants/theme';
import type { CompanionThread } from '@/types/companion-interaction';

const THREADS: { id: CompanionThread; label: string; icon: IconSymbolName }[] = [
  { id: 'quest', label: 'Quest', icon: 'sparkles' },
  { id: 'insight', label: 'Insight', icon: 'star.fill' },
  { id: 'reflection', label: 'Reflect', icon: 'leaf.fill' },
];

export function CompanionThreadSwitcher({ value, onChange }: { value: CompanionThread; onChange: (thread: CompanionThread) => void }) {
  return (
    <View accessibilityRole="tablist" style={styles.root}>
      {THREADS.map((thread) => {
        const selected = value === thread.id;
        return (
          <Pressable
            key={thread.id}
            accessibilityRole="tab"
            accessibilityLabel={thread.label}
            accessibilityState={{ selected }}
            onPress={() => {
              if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
              onChange(thread.id);
            }}
            style={({ pressed }) => [styles.tab, selected && styles.selected, pressed && styles.pressed]}>
            <IconSymbol name={thread.icon} size={14} color={selected ? Lantern.emberInk : Lantern.moon300} />
            <ThemedText style={styles.label} lightColor={selected ? Lantern.emberInk : Lantern.moon300} darkColor={selected ? Lantern.emberInk : Lantern.moon300}>{thread.label}</ThemedText>
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
