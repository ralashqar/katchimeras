import { StyleSheet } from 'react-native';

import { GlassPanel } from '@/components/katchadeck/ui/glass-panel';
import { ThemedText } from '@/components/themed-text';
import { AppFontFamilies, Lantern } from '@/constants/theme';
import type { LocalCreatureRecord } from '@/types/home';

type ReflectionCardProps = {
  creature: LocalCreatureRecord;
};

// The reflection reads as a quote from the character, not as data.
export function ReflectionCard({ creature }: ReflectionCardProps) {
  return (
    <GlassPanel contentStyle={styles.body} fillColor={Lantern.ink800} radius={24}>
      <ThemedText type="onboardingLabel" style={styles.label} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
        {creature.name} remembers
      </ThemedText>
      <ThemedText style={styles.quote} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
        “{creature.reflection}”
      </ThemedText>
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 8,
    padding: 20,
  },
  label: {
    fontSize: 11,
  },
  quote: {
    fontFamily: AppFontFamilies.instrumentSerif,
    fontSize: 19,
    fontStyle: 'italic',
    lineHeight: 28,
  },
});
