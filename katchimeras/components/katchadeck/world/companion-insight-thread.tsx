import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppFontFamilies, Lantern } from '@/constants/theme';
import type { CompanionInsight } from '@/types/companion-interaction';
import { CompanionSection } from './companion-interaction-primitives';

export function CompanionInsightThread({ insight }: { insight: CompanionInsight }) {
  return (
    <View style={styles.root}>
      <CompanionSection label="A pattern I noticed">
        <View style={styles.quoteRow}>
          <View style={styles.mark}><IconSymbol name="quote.opening" size={17} color={Lantern.ember300} /></View>
          <ThemedText selectable style={styles.quote} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{insight.text}</ThemedText>
        </View>
      </CompanionSection>
      {insight.evidenceLabel ? (
        <View style={styles.evidence}>
          <IconSymbol name="sparkles" size={14} color={Lantern.auroraTeal} />
          <ThemedText style={styles.evidenceText} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>{insight.evidenceLabel}</ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 24, paddingBottom: 20, paddingTop: 8 },
  quoteRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 14 },
  mark: { alignItems: 'center', backgroundColor: 'rgba(255,195,107,0.12)', borderRadius: 999, height: 38, justifyContent: 'center', width: 38 },
  quote: { flex: 1, fontFamily: AppFontFamilies.instrumentSerif, fontSize: 24, lineHeight: 32 },
  evidence: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: Lantern.ink900, borderCurve: 'continuous', borderRadius: 16, flexDirection: 'row', gap: 8, minHeight: 44, paddingHorizontal: 13 },
  evidenceText: { fontSize: 12.5, fontWeight: '700' },
});

