import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, TextInput, type TextInputProps, View, type ViewStyle } from 'react-native';

import { StatusBadge, type StatusTone } from '@/components/katchadeck/ui/status-badge';
import { KatchimeraBackButton } from '@/components/katchadeck/ui/katchimera-back-button';
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
    <KatchaButton accessibilityLabel={label} disabled={disabled} onPress={onPress} icon={icon} style={{width: '100%'}} label={(label)} />
  );
}

export function MeadowSecondaryAction({
  label, icon, onPress, destructive = false,
}: { label: string; icon?: IconSymbolName; onPress: () => void; destructive?: boolean }) {
  return (
    <KatchaButton label={label} icon={icon} onPress={onPress} size="compact" variant={destructive ? 'destructive' : 'secondary'} />
  );
}

export function MeadowBackAction({ label, onPress }: { label: string; onPress: () => void }) {
  return <KatchimeraBackButton accessibilityLabel={label} onPress={onPress} />;
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
