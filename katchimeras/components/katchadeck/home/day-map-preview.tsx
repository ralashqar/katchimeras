import { StyleSheet, View } from 'react-native';

import { DayMapSurface } from '@/components/katchadeck/day-map/day-map-surface';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { ThemedText } from '@/components/themed-text';
import type { HomeDayRecord } from '@/types/home';

type DayMapPreviewProps = {
  day: HomeDayRecord;
  accentColor: string;
  onPress: () => void;
};

export function DayMapPreview({ day, accentColor, onPress }: DayMapPreviewProps) {
  return (
    <View style={styles.stack}>
      <View style={styles.header}>
        <View style={styles.copy}>
          <ThemedText type="onboardingLabel" style={styles.label} lightColor="#D7E4FF" darkColor="#D7E4FF">
            {day.isToday ? 'Live day map' : 'Day map'}
          </ThemedText>
          <ThemedText style={styles.body} lightColor="#DCE6FF" darkColor="#DCE6FF">
            {day.isToday ? 'What the day has captured so far.' : 'Where the day left its strongest trace.'}
          </ThemedText>
        </View>
        <KatchaButton icon="arrow.right" label="View day map" onPress={onPress} variant="secondary" />
      </View>
      <DayMapSurface accentColor={accentColor} day={day} height={216} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  header: {
    gap: 12,
  },
  copy: {
    gap: 2,
  },
  label: {
    fontSize: 11,
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
  },
});
