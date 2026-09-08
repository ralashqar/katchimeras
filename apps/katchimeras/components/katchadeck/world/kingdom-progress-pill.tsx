import { Pressable, StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { AppFontFamilies } from '@/constants/theme';
import type { KingdomProgress } from '@/features/kingdom-progress/kingdom-progress';

/** Compact "friends home · places restored" readout for the Kingdom top bar. */
export function KingdomProgressPill({ progress, onPress }: { progress: KingdomProgress; onPress: () => void }) {
  const label = `${progress.friends.home} of ${progress.friends.total} friends home, ${progress.places.restored} of ${progress.places.total} places restored`;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Opens the Kingdom progress" onPress={onPress} style={({ pressed }) => [styles.pill, pressed && styles.pressed]}>
    <View style={styles.stat}>
      <IconSymbol color="#FFE9A6" name="house.fill" size={13} />
      <ThemedText style={styles.value} lightColor="#FFF4C7" darkColor="#FFF4C7">{progress.friends.home}<ThemedText style={styles.total} lightColor="#E4D3A4" darkColor="#E4D3A4">/{progress.friends.total}</ThemedText></ThemedText>
    </View>
    <View style={styles.divider} />
    <View style={styles.stat}>
      <IconSymbol color="#BFE59A" name="leaf.fill" size={13} />
      <ThemedText style={styles.value} lightColor="#FFF4C7" darkColor="#FFF4C7">{progress.places.restored}<ThemedText style={styles.total} lightColor="#E4D3A4" darkColor="#E4D3A4">/{progress.places.total}</ThemedText></ThemedText>
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  pill: { alignItems: 'center', backgroundColor: 'rgba(22,34,20,0.58)', borderColor: 'rgba(255,244,199,0.28)', borderCurve: 'continuous', borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 8, height: 34, paddingHorizontal: 12 },
  pressed: { opacity: 0.82 },
  stat: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  divider: { width: 1, height: 16, backgroundColor: 'rgba(255,244,199,0.28)' },
  value: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 14, lineHeight: 18, fontVariant: ['tabular-nums'] },
  total: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 12, lineHeight: 18, fontVariant: ['tabular-nums'] },
});
