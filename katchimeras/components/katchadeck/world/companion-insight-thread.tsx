import { StyleSheet, View } from 'react-native';

import { useKatchaSurface } from '@/components/katchadeck/ui/katcha-surface';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchaUI } from '@/constants/katcha-ui';
import type { CompanionInsight } from '@/types/companion-interaction';
import { CompanionSection } from './companion-interaction-primitives';

export function CompanionInsightThread({ insight }: { insight: CompanionInsight }) {
  const { tokens } = useKatchaSurface();
  return (
    <View style={[styles.root, { backgroundColor: 'rgba(255,248,232,0.93)', borderColor: tokens.border }]}>
      <CompanionSection label="A pattern I noticed">
        <View style={styles.quoteRow}>
          <View style={[styles.mark, { backgroundColor: `${tokens.accent}2E` }]}><IconSymbol name="quote.opening" size={17} color={tokens.accentPressed} /></View>
          <ThemedText selectable style={styles.quote} lightColor={tokens.text} darkColor={tokens.text}>{insight.text}</ThemedText>
        </View>
      </CompanionSection>
      {insight.evidenceLabel ? (
        <View style={[styles.evidence, { backgroundColor: tokens.subtle, borderColor: tokens.border }]}>
          <IconSymbol name="sparkles" size={14} color={tokens.success} />
          <ThemedText style={styles.evidenceText} lightColor={tokens.textSecondary} darkColor={tokens.textSecondary}>{insight.evidenceLabel}</ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderCurve: 'continuous', borderRadius: 22, borderWidth: 1, boxShadow: '0 8px 22px rgba(37,42,29,0.20), inset 0 1px 0 rgba(255,255,255,0.78)', gap: 24, marginBottom: 12, padding: 16 },
  quoteRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 14 },
  mark: { alignItems: 'center', borderRadius: KatchaUI.radius.pill, height: 38, justifyContent: 'center', width: 38 },
  quote: { ...KatchaUI.type.display, flex: 1, fontSize: 24, lineHeight: 32 },
  evidence: { alignItems: 'center', alignSelf: 'flex-start', borderCurve: 'continuous', borderRadius: KatchaUI.radius.control, borderWidth: 1, flexDirection: 'row', gap: 8, minHeight: KatchaUI.touchTarget, paddingHorizontal: 13 },
  evidenceText: { ...KatchaUI.type.meta, fontSize: 12.5 },
});
