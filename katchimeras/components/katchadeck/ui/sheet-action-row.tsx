import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Lantern } from '@/constants/theme';

type SheetActionRowProps = {
  emoji?: string;
  icon?: IconSymbolName;
  title: string;
  context?: string;
  meta?: string;
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
  completed = false,
  disabled = false,
  onPress,
}: SheetActionRowProps) {
  const inactive = disabled || completed || !onPress;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && !inactive ? styles.rowPressed : null,
        completed ? styles.rowDone : null,
      ]}>
      <View style={styles.leading}>
        {emoji ? (
          <ThemedText style={styles.emoji}>{emoji}</ThemedText>
        ) : icon ? (
          <IconSymbol name={icon} size={18} color={Lantern.moon300} />
        ) : null}
      </View>
      <View style={styles.text}>
        <ThemedText style={styles.title} numberOfLines={2} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
          {title}
        </ThemedText>
        {context ? (
          <ThemedText style={styles.context} numberOfLines={1} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
            {context}
          </ThemedText>
        ) : null}
        {meta ? (
          <ThemedText style={styles.meta} numberOfLines={1} lightColor={Lantern.auroraTeal} darkColor={Lantern.auroraTeal}>
            {meta}
          </ThemedText>
        ) : null}
      </View>
      <View style={[styles.trailing, completed ? styles.trailingDone : null]}>
        <IconSymbol
          name={completed ? 'checkmark' : 'arrow.right'}
          size={13}
          color={completed ? Lantern.emberInk : Lantern.moon300}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  rowPressed: {
    backgroundColor: 'rgba(40,34,60,0.9)',
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
    backgroundColor: Lantern.ember300,
  },
});
