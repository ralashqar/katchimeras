import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';

export type StatusTone = 'neutral' | 'warning' | 'success' | 'danger';

export function StatusBadge({ label, tone }: { label: string; tone: StatusTone }) {
  const color = tone === 'success' ? Lantern.auroraTeal : tone === 'warning' ? Lantern.ember300 : tone === 'danger' ? '#F3A0A0' : Lantern.moon300;
  return (
    <View accessibilityRole="text" style={[styles.badge, { backgroundColor: `${color}18` }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <ThemedText style={styles.text} lightColor={color} darkColor={color}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', alignSelf: 'flex-start', borderRadius: 999, flexDirection: 'row', gap: 7, minHeight: 30, paddingHorizontal: 11 },
  dot: { borderRadius: 999, height: 7, width: 7 },
  text: { fontSize: 11.5, fontWeight: '900' },
});

