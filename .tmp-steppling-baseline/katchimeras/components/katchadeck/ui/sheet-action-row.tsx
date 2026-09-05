import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { StatusBadge } from '@/components/katchadeck/ui/status-badge';
import { useKatchaSurface } from '@/components/katchadeck/ui/katcha-surface';

type SheetActionRowProps = {
  emoji?: string;
  icon?: IconSymbolName;
  title: string;
  context?: string;
  meta?: string;
  statusLabel?: string;
  statusTone?: 'neutral' | 'warning' | 'success' | 'danger';
  completed?: boolean;
  disabled?: boolean;
  onPress?: () => void;
};

export function SheetActionRow({
  emoji,
  icon,
  title,
  context,
  meta,
  statusLabel,
  statusTone = 'neutral',
  completed = false,
  disabled = false,
  onPress,
}: SheetActionRowProps) {
  const { tokens } = useKatchaSurface();
  const inactive = disabled || completed || !onPress;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: tokens.subtle },
        pressed && !inactive ? styles.rowPressed : null,
        completed ? styles.rowDone : null,
      ]}>
      <View style={styles.leading}>
        {emoji ? (
          <ThemedText style={styles.emoji}>{emoji}</ThemedText>
        ) : icon ? (
          <IconSymbol name={icon} size={18} color={tokens.textSecondary} />
        ) : null}
      </View>
      <View style={styles.text}>
        <ThemedText style={styles.title} numberOfLines={2} lightColor={tokens.text} darkColor={tokens.text}>
          {title}
        </ThemedText>
        {context ? (
          <ThemedText style={styles.context} numberOfLines={1} lightColor={tokens.textTertiary} darkColor={tokens.textTertiary}>
            {context}
          </ThemedText>
        ) : null}
        {meta ? (
          <ThemedText style={styles.meta} numberOfLines={1} lightColor={tokens.success} darkColor={tokens.success}>
            {meta}
          </ThemedText>
        ) : null}
        {statusLabel ? <StatusBadge label={statusLabel} tone={statusTone} /> : null}
      </View>
      <View style={[styles.trailing, { backgroundColor: completed ? tokens.accent : tokens.subtle }, completed ? styles.trailingDone : null]}>
        <IconSymbol
          name={completed ? 'checkmark' : 'arrow.right'}
          size={13}
          color={completed ? tokens.accentText : tokens.textSecondary}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderCurve: 'continuous',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  rowPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  rowDone: {
    opacity: 0.58,
  },
  leading: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 28,
  },
  emoji: {
    fontSize: 22,
    lineHeight: 26,
    textAlign: 'center',
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14.5,
    fontWeight: '700',
    lineHeight: 19,
  },
  context: {
    fontSize: 11.5,
    fontWeight: '700',
    lineHeight: 15,
  },
  meta: {
    fontSize: 12,
    fontWeight: '700',
  },
  trailing: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  trailingDone: {
    opacity: 1,
  },
});
