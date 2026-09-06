import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { useKatchaSurface } from '@/components/katchadeck/ui/katcha-surface';

type SheetEmptyStateProps = {
  icon?: IconSymbolName;
  title: string;
  body?: string;
};

export function SheetEmptyState({ icon = 'sparkles', title, body }: SheetEmptyStateProps) {
  const { tokens } = useKatchaSurface();
  return (
    <View style={[styles.wrap, { backgroundColor: tokens.subtle, borderColor: tokens.border }]}>
      <View style={[styles.icon, { backgroundColor: tokens.subtle }]}>
        <IconSymbol name={icon} size={18} color={tokens.textSecondary} />
      </View>
      <ThemedText style={styles.title} lightColor={tokens.text} darkColor={tokens.text}>
        {title}
      </ThemedText>
      {body ? (
        <ThemedText style={styles.body} lightColor={tokens.textTertiary} darkColor={tokens.textTertiary}>
          {body}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  icon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
    textAlign: 'center',
  },
  body: {
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 17,
    maxWidth: 260,
    textAlign: 'center',
  },
});
