import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { KatchaDeckUI } from '@/constants/theme';

type SectionHeaderProps = {
  label?: string;
  title: string;
  actionLabel?: string;
  action?: ReactNode;
};

export function SectionHeader({ label, title, actionLabel, action }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        {label ? (
          <ThemedText type="label" style={styles.label} lightColor="#BFD1F7" darkColor="#BFD1F7">
            {label}
          </ThemedText>
        ) : null}
        <ThemedText type="subtitle" style={styles.title} lightColor="#F8FBFF" darkColor="#F8FBFF">
          {title}
        </ThemedText>
      </View>
      {action ?? (actionLabel ? (
        <ThemedText style={styles.actionLabel} lightColor="#C8D8FF" darkColor="#C8D8FF">
          {actionLabel}
        </ThemedText>
      ) : null)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  copy: {
    gap: 4,
  },
  label: {
    fontSize: 11,
  },
  title: {
    fontSize: 22,
  },
  actionLabel: {
    ...KatchaDeckUI.typography.body,
    fontWeight: '600',
  },
});
