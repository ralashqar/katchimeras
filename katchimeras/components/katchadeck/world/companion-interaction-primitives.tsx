import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Lantern } from '@/constants/theme';
export { StatusBadge as CompanionStatusBadge } from '@/components/katchadeck/ui/status-badge';

export function CompanionPrimaryAction({
  label, icon, onPress, disabled = false,
}: { label: string; icon: IconSymbolName; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.primary, pressed && styles.pressed, disabled && styles.disabled]}>
      <IconSymbol name={icon} size={17} color={Lantern.emberInk} />
      <ThemedText style={styles.primaryText} lightColor={Lantern.emberInk} darkColor={Lantern.emberInk}>{label}</ThemedText>
    </Pressable>
  );
}

export function CompanionSecondaryAction({
  label, icon, onPress, destructive = false,
}: { label: string; icon?: IconSymbolName; onPress: () => void; destructive?: boolean }) {
  const color = destructive ? '#F3A0A0' : Lantern.moon300;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
      {icon ? <IconSymbol name={icon} size={15} color={color} /> : null}
      <ThemedText style={styles.secondaryText} lightColor={color} darkColor={color}>{label}</ThemedText>
    </Pressable>
  );
}

export function CompanionSection({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      {label ? <ThemedText style={styles.sectionLabel} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>{label}</ThemedText> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  primary: {
    alignItems: 'center', backgroundColor: Lantern.ember300, borderCurve: 'continuous', borderRadius: 18,
    flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 52, paddingHorizontal: 18, width: '100%',
    boxShadow: `0 10px 24px ${Lantern.emberGlow}`,
  },
  primaryText: { fontSize: 15, fontWeight: '900' },
  secondary: {
    alignItems: 'center', alignSelf: 'flex-start', backgroundColor: Lantern.dusk700, borderCurve: 'continuous',
    borderRadius: 16, flexDirection: 'row', gap: 7, minHeight: 44, paddingHorizontal: 14,
  },
  secondaryText: { fontSize: 13.5, fontWeight: '800' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.45 },
  section: { gap: 10 },
  sectionLabel: { fontSize: 10.5, fontWeight: '900', letterSpacing: 1.1, textTransform: 'uppercase' },
});
