import type { ReactNode } from 'react';
import {
  Pressable,
  type StyleProp,
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native';

import { StatusBadge, type StatusTone } from '@/components/katchadeck/ui/status-badge';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Meadow } from '@/constants/meadow-theme';
import { AppFontFamilies } from '@/constants/theme';

export function MeadowStatusBadge({ label, tone }: { label: string; tone: StatusTone }) {
  return <StatusBadge label={label} tone={tone} warm />;
}

export function MeadowPrimaryAction({
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
      <IconSymbol name={icon} size={17} color={Meadow.ink} />
      <ThemedText style={styles.primaryText} lightColor={Meadow.ink} darkColor={Meadow.ink}>{label}</ThemedText>
    </Pressable>
  );
}

export function MeadowSecondaryAction({
  label, icon, onPress, destructive = false,
}: { label: string; icon?: IconSymbolName; onPress: () => void; destructive?: boolean }) {
  const color = destructive ? '#A84F43' : Meadow.inkSoft;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
      {icon ? <IconSymbol name={icon} size={15} color={color} /> : null}
      <ThemedText style={styles.secondaryText} lightColor={color} darkColor={color}>{label}</ThemedText>
    </Pressable>
  );
}

export function MeadowBackAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
      <IconSymbol name="chevron.left" size={15} color={Meadow.inkSoft} />
      <ThemedText style={styles.backText} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>{label}</ThemedText>
    </Pressable>
  );
}

export function MeadowSection({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      {label ? <ThemedText style={styles.sectionLabel} lightColor={Meadow.inkFaint} darkColor={Meadow.inkFaint}>{label}</ThemedText> : null}
      {children}
    </View>
  );
}

export function MeadowSurfaceCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.surfaceCard, style]}>{children}</View>;
}

export function MeadowDetailRow({
  icon, label, value, accent,
}: { icon: IconSymbolName; label: string; value: string; accent: string }) {
  return (
    <View style={styles.cardRow}>
      <View style={[styles.detailIcon, { backgroundColor: `${accent}18` }]}>
        <IconSymbol name={icon} size={18} color={accent} />
      </View>
      <View style={styles.detailCopy}>
        <ThemedText style={styles.detailLabel} lightColor={Meadow.inkFaint} darkColor={Meadow.inkFaint}>{label}</ThemedText>
        <ThemedText selectable style={styles.detailValue} lightColor={Meadow.ink} darkColor={Meadow.ink}>{value}</ThemedText>
      </View>
    </View>
  );
}

export function MeadowInfoPanel({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.infoPanel}>
      <ThemedText style={styles.infoTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>{title}</ThemedText>
      <ThemedText selectable style={styles.infoBody} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>{body}</ThemedText>
    </View>
  );
}

export function MeadowNumberField({ label, ...props }: { label: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <ThemedText style={styles.fieldLabel} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>{label}</ThemedText>
      <TextInput
        accessibilityLabel={`Birth ${label.toLowerCase()}`}
        keyboardType="number-pad"
        maxLength={2}
        placeholderTextColor={Meadow.inkFaint}
        selectionColor={Meadow.goldDeep}
        {...props}
        style={[styles.numberInput, props.style]}
      />
    </View>
  );
}

const raisedSurface = '-3px 4px 8px rgba(58,38,18,0.16), inset 0 1px 0 rgba(255,248,230,0.55)';

const styles = StyleSheet.create({
  primary: {
    alignItems: 'center', backgroundColor: '#E7B951', borderColor: 'rgba(255,244,204,0.72)', borderCurve: 'continuous', borderRadius: 18, borderWidth: 1,
    boxShadow: '-3px 6px 16px rgba(92,57,20,0.28), inset 0 1px 0 rgba(255,252,234,0.78)', flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 52, paddingHorizontal: 18, width: '100%',
  },
  primaryText: { fontSize: 15, fontWeight: '900' },
  secondary: {
    alignItems: 'center', alignSelf: 'flex-start', backgroundColor: 'rgba(255,248,232,0.36)', borderColor: Meadow.cardBorder, borderCurve: 'continuous', borderRadius: 16, borderWidth: 1,
    boxShadow: '-2px 3px 7px rgba(58,38,18,0.15), inset 0 1px 0 rgba(255,248,230,0.54)', flexDirection: 'row', gap: 7, minHeight: 44, paddingHorizontal: 14,
  },
  secondaryText: { fontSize: 13.5, fontWeight: '800' },
  back: {
    alignItems: 'center', alignSelf: 'flex-start', backgroundColor: 'rgba(255,248,232,0.34)', borderColor: Meadow.cardBorder, borderCurve: 'continuous', borderRadius: 14, borderWidth: 1,
    boxShadow: '-2px 3px 7px rgba(58,38,18,0.13), inset 0 1px 0 rgba(255,248,230,0.50)', flexDirection: 'row', gap: 5, minHeight: 42, paddingHorizontal: 12,
  },
  backText: { fontSize: 12.5, fontWeight: '800' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.45 },
  section: { gap: 10 },
  sectionLabel: { fontSize: 10.5, fontWeight: '900', letterSpacing: 1.1, textTransform: 'uppercase' },
  surfaceCard: {
    backgroundColor: 'rgba(255,248,232,0.34)', borderColor: 'rgba(122,84,44,0.16)', borderCurve: 'continuous', borderRadius: 18, borderWidth: 1,
    boxShadow: raisedSurface,
  },
  cardRow: {
    alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.34)', borderColor: 'rgba(122,84,44,0.16)', borderCurve: 'continuous', borderRadius: 18, borderWidth: 1,
    boxShadow: raisedSurface, flexDirection: 'row', gap: 11, minHeight: 72, padding: 11,
  },
  detailIcon: { alignItems: 'center', borderColor: 'rgba(255,248,230,0.28)', borderCurve: 'continuous', borderRadius: 13, borderWidth: 1, height: 48, justifyContent: 'center', width: 48 },
  detailCopy: { flex: 1, gap: 2, minWidth: 0 },
  detailLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.35, textTransform: 'uppercase' },
  detailValue: { fontSize: 13.5, fontWeight: '800', lineHeight: 19 },
  infoPanel: {
    backgroundColor: 'rgba(255,248,232,0.30)', borderColor: 'rgba(122,84,44,0.16)', borderCurve: 'continuous', borderRadius: 18, borderWidth: 1,
    boxShadow: raisedSurface, gap: 5, padding: 15,
  },
  infoTitle: { fontSize: 14, fontWeight: '800' },
  infoBody: { fontSize: 12.5, lineHeight: 19 },
  field: { flex: 1, gap: 7 },
  fieldLabel: { fontSize: 12, fontWeight: '700' },
  numberInput: {
    backgroundColor: 'rgba(255,248,232,0.34)', borderColor: Meadow.cardBorder, borderCurve: 'continuous', borderRadius: 16, borderWidth: 1,
    boxShadow: 'inset 0 1px 0 rgba(255,248,230,0.52)', color: Meadow.ink, fontFamily: AppFontFamilies.manrope, fontSize: 23,
    fontVariant: ['tabular-nums'], fontWeight: '800', minHeight: 62, paddingHorizontal: 14, textAlign: 'center',
  },
});
