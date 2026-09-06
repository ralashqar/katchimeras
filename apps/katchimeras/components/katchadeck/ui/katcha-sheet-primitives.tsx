import { type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  type TextInputProps,
  type ViewProps,
  View,
} from 'react-native';

import { useKatchaSurface } from '@/components/katchadeck/ui/katcha-surface';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { KatchaUI } from '@/constants/katcha-ui';

export function KatchaSurfaceCard({ children, style, ...props }: ViewProps) {
  const { tokens } = useKatchaSurface();
  return <View {...props} style={[styles.card, { backgroundColor: tokens.subtle, boxShadow: tokens.cardShadow }, style]}>{children}</View>;
}

/**
 * The raised parchment/night card shared by journal choices, timeline entries,
 * and other tactile rows. The rim is deliberately owned here so feature
 * surfaces do not recreate slightly different bevel and lighting treatments.
 */
export function KatchaBeveledCard({ children, style, ...props }: ViewProps) {
  const { tokens } = useKatchaSurface();
  return (
    <View
      {...props}
      style={[
        styles.beveledCard,
        {
          backgroundColor: tokens.subtle,
          borderColor: tokens.border,
          boxShadow: tokens.cardShadow,
        },
        style,
      ]}>
      <View pointerEvents="none" style={[styles.bevelRim, { borderColor: tokens.borderStrong }]} />
      {children}
    </View>
  );
}

export function KatchaSectionHeading({ children }: { children: ReactNode }) {
  const { tokens } = useKatchaSurface();
  return <ThemedText style={styles.sectionHeading} lightColor={tokens.textTertiary} darkColor={tokens.textTertiary}>{children}</ThemedText>;
}

export function KatchaChoiceTile({
  description,
  disabled = false,
  icon,
  label,
  onPress,
  selected = false,
}: {
  description?: string;
  disabled?: boolean;
  icon?: IconSymbolName;
  label: string;
  onPress?: () => void;
  selected?: boolean;
}) {
  const { tokens } = useKatchaSurface();
  return (
    <Pressable
      accessibilityHint={description}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        { backgroundColor: selected ? `${tokens.accent}24` : tokens.subtle, borderColor: selected ? tokens.accent : tokens.border },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      {icon ? <View style={[styles.choiceIcon, { backgroundColor: tokens.subtle }]}><IconSymbol name={icon} size={18} color={selected ? tokens.accentPressed : tokens.textSecondary} /></View> : null}
      <View style={styles.choiceCopy}>
        <ThemedText style={styles.choiceLabel} lightColor={tokens.text} darkColor={tokens.text}>{label}</ThemedText>
        {description ? <ThemedText style={styles.choiceDescription} lightColor={tokens.textSecondary} darkColor={tokens.textSecondary}>{description}</ThemedText> : null}
      </View>
      {selected ? <IconSymbol name="checkmark" size={15} color={tokens.accentPressed} /> : <IconSymbol name="chevron.right" size={16} color={tokens.textTertiary} />}
    </Pressable>
  );
}

export function KatchaIconButton({ icon, label, onPress }: { icon: IconSymbolName; label: string; onPress: () => void }) {
  const { tokens } = useKatchaSurface();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, { backgroundColor: tokens.subtle, borderColor: tokens.border }, pressed && styles.pressed]}>
      <IconSymbol name={icon} size={17} color={tokens.textSecondary} />
    </Pressable>
  );
}

export function KatchaTextInput(props: TextInputProps) {
  const { tokens } = useKatchaSurface();
  return (
    <TextInput
      {...props}
      placeholderTextColor={props.placeholderTextColor ?? tokens.textTertiary}
      selectionColor={props.selectionColor ?? tokens.accentPressed}
      style={[styles.input, { backgroundColor: tokens.subtle, borderColor: tokens.border, color: tokens.text }, props.style]}
    />
  );
}

export function KatchaActionBar({ children }: { children: ReactNode }) {
  const { tokens } = useKatchaSurface();
  return <View style={[styles.actionBar, { borderTopColor: tokens.border }]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { borderCurve: 'continuous', borderRadius: KatchaUI.radius.card, gap: 10, padding: 14 },
  beveledCard: {
    borderCurve: 'continuous',
    borderRadius: KatchaUI.radius.card,
    borderWidth: 1,
    position: 'relative',
  },
  bevelRim: {
    ...StyleSheet.absoluteFillObject,
    borderCurve: 'continuous',
    borderRadius: KatchaUI.radius.card,
    borderTopWidth: 1,
    opacity: 0.72,
  },
  sectionHeading: KatchaUI.type.label,
  choice: { alignItems: 'center', borderCurve: 'continuous', borderRadius: KatchaUI.radius.card, borderWidth: 1, flexDirection: 'row', gap: 11, minHeight: 64, paddingHorizontal: 12, paddingVertical: 10 },
  choiceIcon: { alignItems: 'center', borderRadius: 12, height: 38, justifyContent: 'center', width: 38 },
  choiceCopy: { flex: 1, gap: 2 },
  choiceLabel: { ...KatchaUI.type.title, fontSize: 14.5, lineHeight: 19 },
  choiceDescription: { ...KatchaUI.type.body, fontSize: 12, lineHeight: 16 },
  iconButton: { alignItems: 'center', borderRadius: KatchaUI.radius.pill, borderWidth: 1, height: KatchaUI.touchTarget, justifyContent: 'center', width: KatchaUI.touchTarget },
  input: { borderCurve: 'continuous', borderRadius: KatchaUI.radius.control, borderWidth: 1, fontSize: 16, minHeight: 52, paddingHorizontal: 14, paddingVertical: 12 },
  actionBar: { borderTopWidth: 1, gap: 8, paddingTop: 12 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.46 },
});
