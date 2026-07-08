import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Lantern } from '@/constants/theme';

type SheetEmptyStateProps = {
  icon?: IconSymbolName;
  title: string;
  body?: string;
};

export function SheetEmptyState({ icon = 'sparkles', title, body }: SheetEmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.icon}>
        <IconSymbol name={icon} size={18} color={Lantern.moon300} />
      </View>
      <ThemedText style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
        {title}
      </ThemedText>
      {body ? (
        <ThemedText style={styles.body} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
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
