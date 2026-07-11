import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';
import { useHomeScreenState } from '@/hooks/use-home-screen-state';
import { qualityThresholds } from '@/utils/intelligence/quality-registry';
import { QUEST_DEFINITIONS } from '@/utils/quests/definitions';
import { loadDevLastPhotoAnalysis, type DevLastPhotoAnalysis } from '@/utils/dev-photo-analysis';
import { foundationSceneAvailability } from '@/utils/foundation-scene';

export default function IntelligenceLabScreen() {
  const { selectedDay, personalEntities, cloudIntelligenceEnabled } = useHomeScreenState();
  const memories = selectedDay?.kind === 'day' ? selectedDay.classifiedMemories ?? [] : [];
  const [lastPhoto, setLastPhoto] = useState<DevLastPhotoAnalysis | null>(() => loadDevLastPhotoAnalysis());
  const foundationAvailability = foundationSceneAvailability();
  const lastPhotoJson = useMemo(() => lastPhoto ? JSON.stringify(lastPhoto, null, 2) : '', [lastPhoto]);
  const focusedQuestEvaluation = lastPhoto?.questContext.questId
    ? lastPhoto.questEvaluations.find((evaluation) => evaluation.questId === lastPhoto.questContext.questId) ?? null
    : null;

  useFocusEffect(useCallback(() => {
    setLastPhoto(loadDevLastPhotoAnalysis());
  }, []));

  const shareLastPhotoJson = useCallback(() => {
    if (!lastPhotoJson) return;
    void Share.share({ title: 'Katchimeras photo analysis', message: lastPhotoJson });
  }, [lastPhotoJson]);

  return (
    <>
      <Stack.Screen options={{ title: 'Intelligence Lab' }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <View style={[styles.card, foundationAvailability.available ? styles.foundationReady : styles.foundationWarning]}>
          <View style={styles.headingRow}>
            <ThemedText style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50} selectable>
              Apple on-device intelligence
            </ThemedText>
            <ThemedText
              style={styles.provider}
              lightColor={foundationAvailability.available ? '#A8E2C6' : '#F3B36A'}
              darkColor={foundationAvailability.available ? '#A8E2C6' : '#F3B36A'}
              selectable>
              {foundationAvailability.available ? 'READY' : 'NEEDS ATTENTION'}
            </ThemedText>
          </View>
          <ThemedText style={styles.line} lightColor={Lantern.moon300} darkColor={Lantern.moon300} selectable>
            Status: {foundationAvailability.reason}
            {foundationAvailability.locale ? ` · device language ${foundationAvailability.locale}` : ''}
            {foundationAvailability.localeSupported === false ? ' · unsupported by the current model' : ''}
          </ThemedText>
          {!foundationAvailability.available ? (
            <ThemedText style={styles.line} lightColor={Lantern.moon300} darkColor={Lantern.moon300} selectable>
              In Settings → Apple Intelligence &amp; Siri, turn Apple Intelligence on and make sure the iPhone language and Siri language use the same supported language. If they already match, leave the phone charging on Wi-Fi while the model finishes downloading, then restart the app.
            </ThemedText>
          ) : (
            <ThemedText style={styles.line} lightColor={Lantern.moon300} darkColor={Lantern.moon300} selectable>
              Foundation Models is ready and photo interpretation stays on this device.
            </ThemedText>
          )}
        </View>
        {lastPhoto ? (
          <View style={[styles.card, styles.lastPhotoCard]}>
            <View style={styles.headingRow}>
              <ThemedText style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                Last photo analysis
              </ThemedText>
              <ThemedText style={styles.provider} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
                {lastPhoto.questContext.questId ? 'QUEST CAPTURE' : 'PHOTO'}
              </ThemedText>
            </View>
            <Image source={lastPhoto.thumbnailUri} style={styles.photo} contentFit="cover" transition={120} />
            <ThemedText style={styles.line} lightColor={Lantern.moon300} darkColor={Lantern.moon300} selectable>
              Captured: {lastPhoto.capturedAt} · representation {lastPhoto.classifiedMemory?.photoAnalysis?.representation.kind ?? 'unknown'}
            </ThemedText>
            {focusedQuestEvaluation ? (
              <View style={styles.questDecision}>
                <ThemedText style={styles.decisionTitle} lightColor={decisionColor(focusedQuestEvaluation.decision)} darkColor={decisionColor(focusedQuestEvaluation.decision)} selectable>
                  {focusedQuestEvaluation.questTitle}: {focusedQuestEvaluation.decision.replace('_', ' ')}
                </ThemedText>
                {focusedQuestEvaluation.reasons.map((reason) => (
                  <ThemedText key={reason} style={styles.line} lightColor={Lantern.moon300} darkColor={Lantern.moon300} selectable>
                    {reason}
                  </ThemedText>
                ))}
              </View>
            ) : null}
            <ThemedText style={styles.line} lightColor={Lantern.moon300} darkColor={Lantern.moon300} selectable>
              Raw labels: {lastPhoto.rawVision?.labels?.map((label) => `${label.name} ${Math.round(label.confidence * 100)}%`).join(' · ') || 'none'}
            </ThemedText>
            <ThemedText style={styles.line} lightColor={Lantern.moon300} darkColor={Lantern.moon300} selectable>
              Scene: {lastPhoto.scene ? `${lastPhoto.scene.source}:${lastPhoto.scene.type} — ${lastPhoto.scene.detail ?? lastPhoto.scene.label}` : 'none'}
            </ThemedText>
            <ThemedText style={styles.line} lightColor={Lantern.moon300} darkColor={Lantern.moon300} selectable>
              Subjects: {lastPhoto.classifiedMemory?.photoAnalysis?.subjects.map((subject) => `${subject.role}:${subject.canonicalValue} ${Math.round(subject.score * 100)}%`).join(' · ') || 'none'}
            </ThemedText>
            <ThemedText style={styles.line} lightColor={Lantern.moon300} darkColor={Lantern.moon300} selectable>
              Qualities: {lastPhoto.classifiedMemory?.qualities.map((quality) => `${quality.qualityId} ${Math.round(quality.score * 100)}% ${quality.centrality}/${quality.status}`).join(' · ') || 'none'}
            </ThemedText>
            <Pressable accessibilityRole="button" onPress={shareLastPhotoJson} style={styles.shareButton}>
              <ThemedText style={styles.shareLabel} lightColor={Lantern.ink950} darkColor={Lantern.ink950}>
                Share full JSON
              </ThemedText>
            </Pressable>
            <ThemedText style={styles.json} lightColor={Lantern.moon300} darkColor={Lantern.moon300} selectable>
              {lastPhotoJson}
            </ThemedText>
          </View>
        ) : (
          <View style={styles.empty}>
            <ThemedText lightColor={Lantern.moon500} darkColor={Lantern.moon500} selectable>
              No development photo snapshot yet. Capture another photo to populate the full JSON trace.
            </ThemedText>
          </View>
        )}
        <ThemedText style={styles.summary} lightColor={Lantern.moon300} darkColor={Lantern.moon300} selectable>
          {memories.length} classified memories for {selectedDay?.kind === 'day' ? selectedDay.isoDate : 'the selected day'} · cloud {cloudIntelligenceEnabled ? 'opted in for notes' : 'off'}
        </ThemedText>
        {personalEntities.length > 0 ? (
          <ThemedText style={styles.summary} lightColor={Lantern.moon300} darkColor={Lantern.moon300} selectable>
            Local context: {personalEntities.map((entity) => entity.displayName ?? `${entity.relationship ?? entity.kind} (${entity.subrole ?? entity.kind})`).join(' · ')}
          </ThemedText>
        ) : null}
        {memories.map((memory) => (
          <View key={memory.id} style={styles.card}>
            <View style={styles.headingRow}>
              <ThemedText style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50} selectable>
                {memory.dominantDomain}
              </ThemedText>
              <ThemedText style={styles.provider} lightColor={Lantern.ember300} darkColor={Lantern.ember300} selectable>
                {memory.sourceType}
              </ThemedText>
            </View>
            <ThemedText style={styles.line} lightColor={Lantern.moon300} darkColor={Lantern.moon300} selectable>
              Observed: {memory.observations.map((item) => `${item.provider}:${item.value} ${Math.round(item.confidence * 100)}%`).join(' · ') || 'none'}
            </ThemedText>
            <ThemedText style={styles.line} lightColor={Lantern.moon300} darkColor={Lantern.moon300} selectable>
              Facets: {memory.facets.map((item) => `${item.key}=${item.value}${item.confirmed ? ' ✓' : ''}${item.sensitive ? ' private' : ''}`).join(' · ') || 'none'}
            </ThemedText>
            <ThemedText style={styles.line} lightColor={Lantern.moon300} darkColor={Lantern.moon300} selectable>
              Qualities: {memory.qualities.map((quality) => `${quality.qualityId} ${Math.round(quality.score * 100)}% ${quality.centrality}/${quality.status} [${quality.sources.map((source) => source.provider).join('+') || 'manual'}]`).join(' | ') || 'none'}
            </ThemedText>
            {memory.photoAnalysis ? (
              <>
                <ThemedText style={styles.line} lightColor={Lantern.moon300} darkColor={Lantern.moon300} selectable>
                  Representation: {memory.photoAnalysis.representation.kind} {Math.round(memory.photoAnalysis.representation.confidence * 100)}% ({memory.photoAnalysis.representation.reasons.join(', ')})
                </ThemedText>
                <ThemedText style={styles.line} lightColor={Lantern.moon300} darkColor={Lantern.moon300} selectable>
                  Subjects: {memory.photoAnalysis.subjects.map((subject) => `${subject.role} ${subject.canonicalValue} ${Math.round(subject.score * 100)}%${subject.region ? ' boxed' : ''}`).join(' | ') || 'none'}
                </ThemedText>
                <ThemedText style={styles.line} lightColor={Lantern.moon300} darkColor={Lantern.moon300} selectable>
                  OCR: {memory.photoAnalysis.selectedOcr.map((item) => `${item.purpose}:${item.text} ${Math.round(item.confidence * 100)}%`).join(' | ') || 'none'}
                </ThemedText>
                <ThemedText style={styles.line} lightColor={Lantern.moon300} darkColor={Lantern.moon300} selectable>
                  Providers: {memory.photoAnalysis.providerRuns.map((run) => `${run.provider}:${run.status}${run.promptVersion ? `/${run.promptVersion}` : ''}`).join(' | ')}
                </ThemedText>
                <ThemedText style={styles.line} lightColor={Lantern.moon300} darkColor={Lantern.moon300} selectable>
                  Alternatives: {memory.photoAnalysis.alternatives.map((item) => `${item.domain} ${Math.round(item.score * 100)}%`).join(' | ') || 'none'}
                </ThemedText>
              </>
            ) : null}
            <ThemedText style={styles.line} lightColor={Lantern.moon300} darkColor={Lantern.moon300} selectable>
              Quest matches: {questMatchesForMemory(memory.qualities).join(' | ') || 'none'}
            </ThemedText>
            <ThemedText style={styles.line} lightColor={Lantern.moon300} darkColor={Lantern.moon300} selectable>
              Assignments: {memory.assignments.map((item) => `${item.role} ${item.seedId} ${Math.round(item.score * 100)}%${item.confirmed ? ' confirmed' : ''} (${item.reasons.join(', ')})`).join(' · ') || 'none'}
            </ThemedText>
            <ThemedText style={styles.line} lightColor={Lantern.moon300} darkColor={Lantern.moon300} selectable>
              Overrides: {memory.confirmations.map((item) => `${item.promptId} → ${item.label}`).join(' · ') || 'none'}
            </ThemedText>
            <ThemedText style={styles.line} lightColor={Lantern.moon500} darkColor={Lantern.moon500} selectable>
              Prompt: {memory.promptState.status}{memory.promptState.graphId ? ` · ${memory.promptState.graphId}` : ''} · {memory.promptState.questionCount ?? memory.promptState.answeredNodeIds.length}/{memory.promptState.maxQuestions ?? 3}{memory.promptState.answeredNodeIds.length ? ` · path ${memory.promptState.answeredNodeIds.join(' → ')}` : ''}
            </ThemedText>
          </View>
        ))}
        {memories.length === 0 ? (
          <View style={styles.empty}>
            <ThemedText lightColor={Lantern.moon500} darkColor={Lantern.moon500} selectable>
              Capture a photo, note, place, or movement answer to inspect its classification.
            </ThemedText>
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}

function decisionColor(decision: 'ready' | 'possible' | 'no_match'): string {
  return decision === 'ready' ? '#A8E2C6' : decision === 'possible' ? '#F3B36A' : '#F08C8C';
}

function questMatchesForMemory(qualities: { qualityId: string; score: number; status: string }[]): string[] {
  return qualities.flatMap((quality) => {
    const thresholds = qualityThresholds(quality.qualityId);
    if (quality.status === 'rejected' || quality.score < thresholds.review) return [];
    const status = quality.score >= thresholds.ready || quality.status === 'confirmed' ? 'ready' : 'possible';
    return Object.values(QUEST_DEFINITIONS)
      .filter((quest) => quest.criteria.some((criterion) => criterion.fact === 'memory.qualities' && criterion.value === quality.qualityId))
      .map((quest) => `${quest.id} ${status}`);
  });
}

const styles = StyleSheet.create({
  content: { gap: 12, padding: 18, paddingBottom: 48 },
  summary: { fontSize: 13, fontWeight: '700' },
  card: {
    backgroundColor: 'rgba(20,17,31,0.92)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  lastPhotoCard: { borderColor: 'rgba(146,215,255,0.4)' },
  foundationReady: { borderColor: 'rgba(168,226,198,0.4)' },
  foundationWarning: { borderColor: 'rgba(243,179,106,0.55)' },
  photo: { width: '100%', aspectRatio: 1.4, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)' },
  questDecision: { gap: 4, padding: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)' },
  decisionTitle: { fontSize: 14, fontWeight: '900', textTransform: 'capitalize' },
  shareButton: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#92D7FF' },
  shareLabel: { fontSize: 12.5, fontWeight: '900' },
  json: { fontFamily: 'monospace', fontSize: 10.5, lineHeight: 15 },
  headingRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: { fontSize: 18, fontWeight: '800', textTransform: 'capitalize' },
  provider: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  line: { fontSize: 12.5, lineHeight: 18 },
  empty: { alignItems: 'center', paddingVertical: 40 },
});
