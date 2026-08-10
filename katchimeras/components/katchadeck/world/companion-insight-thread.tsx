import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { useKatchaSurface } from '@/components/katchadeck/ui/katcha-surface';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchaUI } from '@/constants/katcha-ui';
import type { CompanionInsight } from '@/types/companion-interaction';
import type { KatchimeraFamilyId } from '@/types/katchimera';
import type { CompanionInsightRecord } from '@/utils/companion-content';

const FAMILY_LABELS: Partial<Record<KatchimeraFamilyId, string>> = {
  baristabbit: 'Baristabbit',
  steppling: 'Steppling',
  flexel: 'Flexel',
};

export function CompanionInsightThread({
  currentFamilyId,
  insight: _legacyInsight,
  insights,
  onRemoveInsight,
  onRetakeInsight,
}: {
  currentFamilyId: KatchimeraFamilyId | null;
  insight: CompanionInsight;
  insights: readonly CompanionInsightRecord[];
  onRemoveInsight: (insightId: string) => void;
  onRetakeInsight: (definitionId: string) => void;
}) {
  const { tokens } = useKatchaSurface();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const visible = currentFamilyId
    ? insights.filter((item) => item.familyId === currentFamilyId)
    : [];
  const newest = visible[0] ?? null;

  if (!visible.length) return (
    <View style={[styles.empty, { backgroundColor: 'rgba(255,248,232,0.94)', borderColor: tokens.border }]}>
      <View style={[styles.emptyEmblem, { backgroundColor: `${tokens.accent}24` }]}>
        <IconSymbol color={tokens.accentPressed} name="sparkles" size={27} weight="bold" />
      </View>
      <ThemedText selectable style={styles.emptyTitle} lightColor={tokens.text} darkColor={tokens.text}>Nothing has been claimed about you yet</ThemedText>
      <ThemedText selectable style={styles.emptyBody} lightColor={tokens.textSecondary} darkColor={tokens.textSecondary}>
        Choose a self-discovery game while talking with {currentFamilyId ? FAMILY_LABELS[currentFamilyId] ?? 'this Katchimera' : 'a Katchimera'}. You will see the exact reflection before deciding whether to keep it.
      </ThemedText>
    </View>
  );

  return <View style={styles.root}>
    {newest ? <View style={[styles.hero, { backgroundColor: '#FFF2C7', borderColor: 'rgba(164,112,35,0.28)' }]}>
      <View style={styles.heroHeading}>
        <View style={styles.heroEmblem}><IconSymbol color="#FFF9E9" name="sparkles" size={20} weight="bold" /></View>
        <View style={styles.heroCopy}>
          <ThemedText selectable style={styles.eyebrow} lightColor="#866225" darkColor="#866225">WHAT {currentFamilyId ? (FAMILY_LABELS[currentFamilyId] ?? 'THIS KATCHIMERA').toUpperCase() : 'THIS KATCHIMERA'} KNOWS</ThemedText>
          <ThemedText selectable style={styles.heroTitle} lightColor="#352719" darkColor="#352719">{newest.title}</ThemedText>
        </View>
      </View>
      <ThemedText selectable style={styles.heroSummary} lightColor="#58432D" darkColor="#58432D">{newest.summary}</ThemedText>
      <ThemedText selectable style={styles.heroMeta} lightColor="#806126" darkColor="#806126">
        {visible.length} active insight{visible.length === 1 ? '' : 's'} from your conversations together
      </ThemedText>
    </View> : null}

    <View style={styles.list}>
      {visible.map((item) => {
        const expanded = expandedId === item.id;
        return <View key={item.id} style={[styles.card, { backgroundColor: 'rgba(255,248,232,0.94)', borderColor: tokens.border }]}>
          <Pressable
            accessibilityHint="Shows the answers and history behind this insight"
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            onPress={() => setExpandedId(expanded ? null : item.id)}
            style={({ pressed }) => [styles.cardButton, pressed && styles.pressed]}>
            <View style={[styles.cardEmblem, { backgroundColor: `${tokens.accent}22` }]}>
              <IconSymbol color={tokens.accentPressed} name="sparkles" size={18} weight="bold" />
            </View>
            <View style={styles.cardCopy}>
              <View style={styles.cardMetaRow}>
                <ThemedText selectable style={styles.cardCategory} lightColor={tokens.accentPressed} darkColor={tokens.accentPressed}>{item.category.toUpperCase()}</ThemedText>
              </View>
              <ThemedText selectable style={styles.cardTitle} lightColor={tokens.text} darkColor={tokens.text}>{item.title}</ThemedText>
              {item.secondaryTitle ? <ThemedText selectable style={styles.provenance} lightColor={tokens.textSecondary} darkColor={tokens.textSecondary}>Also present: {item.secondaryTitle}</ThemedText> : null}
              <ThemedText selectable style={styles.cardSummary} lightColor={tokens.textSecondary} darkColor={tokens.textSecondary}>{item.summary}</ThemedText>
            </View>
            <IconSymbol color={tokens.textSecondary} name={expanded ? 'chevron.up' : 'chevron.down'} size={15} />
          </Pressable>
          {expanded ? <View style={[styles.detail, { borderTopColor: tokens.border }]}>
            <ThemedText selectable style={styles.detailLabel} lightColor={tokens.textSecondary} darkColor={tokens.textSecondary}>YOUR ANSWERS INCLUDED</ThemedText>
            <View style={styles.traits}>{item.supportingTraits.map((trait) => <View key={trait} style={[styles.trait, { backgroundColor: tokens.subtle }]}>
              <ThemedText selectable style={styles.traitText} lightColor={tokens.text} darkColor={tokens.text}>{trait}</ThemedText>
            </View>)}</View>
            <ThemedText selectable style={styles.provenance} lightColor={tokens.textSecondary} darkColor={tokens.textSecondary}>
              From {item.evidenceRefs.filter((ref) => ref.sourceType === 'journal').length
                ? `${item.evidenceRefs.filter((ref) => ref.sourceType === 'journal').length} journal moment${item.evidenceRefs.filter((ref) => ref.sourceType === 'journal').length === 1 ? '' : 's'} and your conversation`
                : 'your conversation'} · Updated {new Date(item.updatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
            </ThemedText>
            {item.revisions.length ? <View style={styles.history}>
              <ThemedText selectable style={styles.detailLabel} lightColor={tokens.textSecondary} darkColor={tokens.textSecondary}>PREVIOUSLY</ThemedText>
              {item.revisions.slice().reverse().map((revision, index) => <ThemedText key={`${revision.resultId}:${revision.recordedAt}:${index}`} selectable style={styles.historyText} lightColor={tokens.textSecondary} darkColor={tokens.textSecondary}>{revision.title} · {new Date(revision.recordedAt).toLocaleDateString()}</ThemedText>)}
            </View> : null}
            {item.familyId === currentFamilyId && (item.sourceDefinitionId.includes(':insight:') || item.sourceDefinitionId.includes(':game:form-finder')) ? <Pressable accessibilityRole="button" onPress={() => onRetakeInsight(item.sourceDefinitionId)} style={({ pressed }) => [styles.retake, pressed && styles.pressed]}>
              <IconSymbol color="#6D542E" name="arrow.clockwise" size={14} />
              <ThemedText selectable style={styles.retakeText} lightColor="#6D542E" darkColor="#6D542E">Retake this conversation</ThemedText>
            </Pressable> : null}
            <Pressable accessibilityRole="button" onPress={() => Alert.alert('Remove this insight?', 'It will disappear from About You. Your original conversation is not deleted.', [
              { text: 'Keep it', style: 'cancel' },
              { text: 'Remove', style: 'destructive', onPress: () => onRemoveInsight(item.id) },
            ])} style={({ pressed }) => [styles.remove, pressed && styles.pressed]}>
              <IconSymbol color="#925044" name="trash" size={14} />
              <ThemedText selectable style={styles.removeText} lightColor="#925044" darkColor="#925044">This no longer fits me</ThemedText>
            </Pressable>
          </View> : null}
        </View>;
      })}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  root: { gap: 14, paddingBottom: 22 },
  hero: { borderCurve: 'continuous', borderRadius: 27, borderWidth: 1, boxShadow: '0 10px 28px rgba(91,62,25,0.13)', gap: 11, padding: 18 },
  heroHeading: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  heroEmblem: { alignItems: 'center', backgroundColor: '#C9922D', borderRadius: 999, height: 46, justifyContent: 'center', width: 46 },
  heroCopy: { flex: 1, gap: 2 },
  eyebrow: { fontSize: 9.5, fontWeight: '900', letterSpacing: 1.15 },
  heroTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.45, lineHeight: 28 },
  heroSummary: { fontSize: 14, fontWeight: '700', lineHeight: 21 },
  heroMeta: { fontSize: 11.5, fontWeight: '800' },
  list: { gap: 10 },
  card: { borderCurve: 'continuous', borderRadius: 23, borderWidth: 1, overflow: 'hidden' },
  cardButton: { alignItems: 'flex-start', flexDirection: 'row', gap: 11, padding: 15 },
  cardEmblem: { alignItems: 'center', borderRadius: 16, height: 40, justifyContent: 'center', width: 40 },
  cardCopy: { flex: 1, gap: 5 },
  cardMetaRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  cardCategory: { fontSize: 9.5, fontWeight: '900', letterSpacing: 1 },
  cardTitle: { fontSize: 19, fontWeight: '900', letterSpacing: -0.25, lineHeight: 23 },
  cardSummary: { fontSize: 13, lineHeight: 19 },
  detail: { borderTopWidth: 1, gap: 11, padding: 15, paddingTop: 13 },
  detailLabel: { fontSize: 9.5, fontWeight: '900', letterSpacing: 1 },
  traits: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  trait: { borderRadius: KatchaUI.radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  traitText: { fontSize: 11, fontWeight: '800' },
  provenance: { fontSize: 11.5, lineHeight: 17 },
  history: { gap: 5 },
  historyText: { fontSize: 11.5, lineHeight: 17 },
  remove: { alignItems: 'center', alignSelf: 'flex-start', borderRadius: 12, flexDirection: 'row', gap: 7, minHeight: 38, paddingHorizontal: 8 },
  removeText: { fontSize: 11.5, fontWeight: '800' },
  retake: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: 'rgba(217,164,62,0.13)', borderRadius: 12, flexDirection: 'row', gap: 7, minHeight: 40, paddingHorizontal: 10 },
  retakeText: { fontSize: 11.5, fontWeight: '900' },
  empty: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 25, borderWidth: 1, gap: 11, padding: 24 },
  emptyEmblem: { alignItems: 'center', borderRadius: 999, height: 58, justifyContent: 'center', width: 58 },
  emptyTitle: { fontSize: 21, fontWeight: '900', letterSpacing: -0.3, lineHeight: 25, textAlign: 'center' },
  emptyBody: { fontSize: 13.5, lineHeight: 20, textAlign: 'center' },
  pressed: { opacity: 0.7, transform: [{ scale: 0.985 }] },
});
