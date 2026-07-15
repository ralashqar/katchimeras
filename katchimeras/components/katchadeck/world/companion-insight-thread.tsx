import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppFontFamilies } from '@/constants/theme';
import { Meadow } from '@/constants/meadow-theme';
import type { CompanionInsight } from '@/types/companion-interaction';
import { CompanionSection } from './companion-interaction-primitives';

export function CompanionInsightThread({ insight }: { insight: CompanionInsight }) {
  return (
    <View style={styles.root}>
      <CompanionSection label="A pattern I noticed">
        <View style={styles.quoteRow}>
          <View style={styles.mark}><IconSymbol name="quote.opening" size={17} color={Meadow.goldDeep} /></View>
          <ThemedText selectable style={styles.quote} lightColor={Meadow.ink} darkColor={Meadow.ink}>{insight.text}</ThemedText>
        </View>
      </CompanionSection>
      {insight.evidenceLabel ? (
        <View style={styles.evidence}>
          <IconSymbol name="sparkles" size={14} color={Meadow.leafDeep} />
          <ThemedText style={styles.evidenceText} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>{insight.evidenceLabel}</ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 24, paddingBottom: 20, paddingTop: 8 },
  quoteRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 14 },
  mark: { alignItems: 'center', backgroundColor: Meadow.goldSoft, borderRadius: 999, height: 38, justifyContent: 'center', width: 38 },
  quote: { flex: 1, fontFamily: AppFontFamilies.instrumentSerif, fontSize: 24, lineHeight: 32 },
  evidence: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: 'rgba(255,248,232,0.38)', borderColor: Meadow.cardBorder, borderCurve: 'continuous', borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 8, minHeight: 44, paddingHorizontal: 13 },
  evidenceText: { fontSize: 12.5, fontWeight: '700' },
});
