import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppFontFamilies, Lantern } from '@/constants/theme';
import type { CompanionQuestViewModel } from '@/types/companion-interaction';
import type { QuestSubmissionItem } from '@/utils/quests/report-back-evidence';
import { CompanionSection, CompanionStatusBadge } from './companion-interaction-primitives';

export function CompanionQuestThread({
  model,
  reviewItem,
  onSelectReviewItem,
  onClarify,
}: {
  model: CompanionQuestViewModel;
  reviewItem: QuestSubmissionItem | null;
  onSelectReviewItem: (item: QuestSubmissionItem | null) => void;
  onClarify: (item: QuestSubmissionItem, answer: 'primary' | 'supporting' | 'incidental' | 'rejected') => void;
}) {
  return (
    <Animated.View layout={LinearTransition.duration(180)} style={styles.root}>
      <View style={styles.intro}>
        <ThemedText style={styles.eyebrow} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>{model.eyebrow}</ThemedText>
        <ThemedText selectable style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{model.title}</ThemedText>
        <ThemedText selectable style={styles.message} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>{model.message}</ThemedText>
        {model.statusLabel ? <CompanionStatusBadge label={model.statusLabel} tone={model.statusTone} /> : null}
      </View>

      {model.captureFeedback ? <CaptureFeedback model={model} /> : null}

      {model.criteria.length ? (
        <CompanionSection label="What this quest needs">
          <View style={styles.criteria}>
            {model.criteria.map((criterion) => (
              <View key={criterion.id} style={styles.criterion}>
                <View style={[styles.check, criterion.done && styles.checkDone]}>
                  <IconSymbol name={criterion.done ? 'checkmark' : 'circle'} size={12} color={criterion.done ? Lantern.emberInk : Lantern.moon500} />
                </View>
                <View style={styles.criterionCopy}>
                  <ThemedText style={styles.criterionLabel} lightColor={criterion.done ? Lantern.moon50 : Lantern.moon300} darkColor={criterion.done ? Lantern.moon50 : Lantern.moon300}>{criterion.label}</ThemedText>
                  {criterion.progressLabel ? <ThemedText style={styles.criterionReason} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>{criterion.progressLabel}</ThemedText> : null}
                  {criterion.progressRatio != null ? <QuestProgress ratio={criterion.progressRatio} done={criterion.done} label={criterion.progressLabel ?? criterion.label} /> : null}
                </View>
              </View>
            ))}
          </View>
        </CompanionSection>
      ) : null}

      {model.evidence.length ? (
        <CompanionSection label={model.mode === 'possible' ? 'Possible matches' : model.mode === 'complete' ? 'Matched memory' : 'Ready from today'}>
          <View style={styles.evidenceList}>
            {model.evidence.map((item) => (
              <EvidenceRow key={item.id} item={item} selected={reviewItem?.id === item.id} onPress={item.matchStatus === 'possible' ? () => onSelectReviewItem(item) : undefined} />
            ))}
          </View>
        </CompanionSection>
      ) : null}

      {reviewItem?.matchStatus === 'possible' ? (
        <Animated.View entering={FadeIn.duration(180)} style={styles.review}>
          <ThemedText style={styles.reviewTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{questMatchQuestion(reviewItem)}</ThemedText>
          {([
            ['primary', 'Yes, it is the main subject'],
            ['supporting', 'Yes, it is clearly visible'],
            ['incidental', 'Only in the background'],
            ['rejected', 'No, it does not match'],
          ] as const).map(([answer, label]) => (
            <Pressable key={answer} accessibilityRole="button" onPress={() => onClarify(reviewItem, answer)} style={({ pressed }) => [styles.answer, pressed && styles.pressed]}>
              <ThemedText style={styles.answerText} lightColor={answer === 'rejected' ? '#F3A0A0' : Lantern.moon300} darkColor={answer === 'rejected' ? '#F3A0A0' : Lantern.moon300}>{label}</ThemedText>
              <IconSymbol name="chevron.right" size={12} color={Lantern.moon500} />
            </Pressable>
          ))}
        </Animated.View>
      ) : null}

      {model.rewardLabel ? (
        <View style={styles.reward}>
          <IconSymbol name="sparkles" size={15} color={Lantern.ember300} />
          <ThemedText style={styles.rewardText} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>{model.rewardLabel}</ThemedText>
        </View>
      ) : null}
    </Animated.View>
  );
}

function CaptureFeedback({ model }: { model: CompanionQuestViewModel }) {
  const feedback = model.captureFeedback!;
  const analysing = feedback.phase === 'analyzing';
  const label = feedback.phase === 'matched'
    ? 'This memory matches the quest.'
    : feedback.phase === 'possible'
      ? 'This may match. Check it before submitting.'
      : feedback.phase === 'no_match'
        ? feedback.reason ?? 'This did not clearly match. You can try another memory.'
        : 'Analysing your new memory…';
  return (
    <View accessibilityLiveRegion="polite" style={styles.capture}>
      {feedback.sourceId ? <Image source={feedback.sourceId} style={styles.captureThumb} contentFit="cover" transition={120} /> : <View style={styles.captureThumb} />}
      <View style={styles.captureCopy}>
        {analysing ? (
          <>
            <View style={[styles.captureBar, { width: '84%' }]} />
            <View style={[styles.captureBar, styles.captureBarShort]} />
          </>
        ) : (
          <ThemedText style={styles.captureLabel} lightColor={feedback.phase === 'matched' ? Lantern.auroraTeal : feedback.phase === 'no_match' ? '#F3A0A0' : Lantern.ember300} darkColor={feedback.phase === 'matched' ? Lantern.auroraTeal : feedback.phase === 'no_match' ? '#F3A0A0' : Lantern.ember300}>{label}</ThemedText>
        )}
      </View>
    </View>
  );
}

function EvidenceRow({ item, selected, onPress }: { item: QuestSubmissionItem; selected: boolean; onPress?: () => void }) {
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.evidence, selected && styles.evidenceSelected, pressed && styles.pressed]}>
      {item.thumbnailUri ? <Image source={item.thumbnailUri} style={styles.thumb} contentFit="cover" /> : <View style={styles.iconBox}><IconSymbol name={item.icon} size={18} color={item.accentColor} /></View>}
      <View style={styles.evidenceCopy}>
        <ThemedText numberOfLines={2} style={styles.evidenceTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{item.title}</ThemedText>
        <ThemedText numberOfLines={2} style={styles.evidenceSubtitle} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>{item.subtitle}</ThemedText>
      </View>
      {onPress ? <IconSymbol name="chevron.right" size={13} color={Lantern.moon500} /> : <IconSymbol name="checkmark.circle.fill" size={18} color={Lantern.auroraTeal} />}
    </Pressable>
  );
}

function QuestProgress({ ratio, done, label }: { ratio: number; done: boolean; label: string }) {
  const percentage = Math.max(0, Math.min(100, ratio * 100));
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.round(percentage) }} style={styles.progressTrack}>
      <View style={[styles.progressFill, done && styles.progressDone, { width: `${Math.max(4, percentage)}%` }]} />
    </View>
  );
}

function questMatchQuestion(item: QuestSubmissionItem): string {
  if (item.qualityId === 'place.city') return 'Does this clearly show the city skyline?';
  if (item.qualityId === 'place.park') return 'Does this clearly show the park or green space?';
  if (item.qualityId === 'subject.food') return 'Does this clearly show the meal?';
  if (item.qualityId === 'subject.dog') return 'Is the dog clearly visible?';
  if (item.qualityId === 'subject.cat') return 'Is the cat clearly visible?';
  return 'Does this clearly show what the quest is looking for?';
}

const styles = StyleSheet.create({
  root: { gap: 24, paddingBottom: 20, paddingTop: 8 },
  intro: { gap: 8 },
  eyebrow: { fontSize: 10.5, fontWeight: '900', letterSpacing: 1.1, textTransform: 'uppercase' },
  title: { fontFamily: AppFontFamilies.instrumentSerif, fontSize: 27, lineHeight: 32 },
  message: { fontSize: 14, lineHeight: 21 },
  criteria: { gap: 2 },
  criterion: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, minHeight: 52, paddingVertical: 8 },
  check: { alignItems: 'center', backgroundColor: Lantern.dusk700, borderRadius: 999, height: 26, justifyContent: 'center', width: 26 },
  checkDone: { backgroundColor: Lantern.auroraTeal },
  criterionCopy: { flex: 1, gap: 4 },
  criterionLabel: { fontSize: 13.5, fontWeight: '800', lineHeight: 19 },
  criterionReason: { fontSize: 11.5, lineHeight: 16 },
  progressTrack: { backgroundColor: Lantern.dusk700, borderRadius: 999, height: 7, overflow: 'hidden' },
  progressFill: { backgroundColor: Lantern.ember300, borderRadius: 999, height: '100%' },
  progressDone: { backgroundColor: Lantern.auroraTeal },
  capture: { alignItems: 'center', backgroundColor: 'rgba(125,232,205,0.07)', borderCurve: 'continuous', borderRadius: 18, flexDirection: 'row', gap: 12, padding: 12 },
  captureThumb: { backgroundColor: Lantern.dusk700, borderCurve: 'continuous', borderRadius: 13, height: 58, width: 58 },
  captureCopy: { flex: 1, gap: 9 },
  captureBar: { backgroundColor: 'rgba(201,194,232,0.18)', borderRadius: 999, height: 9 },
  captureBarShort: { width: '52%' },
  captureLabel: { fontSize: 12.5, fontWeight: '800', lineHeight: 18 },
  evidenceList: { gap: 8 },
  evidence: { alignItems: 'center', backgroundColor: Lantern.ink900, borderCurve: 'continuous', borderRadius: 18, flexDirection: 'row', gap: 11, minHeight: 72, padding: 10 },
  evidenceSelected: { backgroundColor: 'rgba(255,195,107,0.10)' },
  thumb: { borderCurve: 'continuous', borderRadius: 13, height: 52, width: 52 },
  iconBox: { alignItems: 'center', backgroundColor: Lantern.dusk700, borderRadius: 13, height: 52, justifyContent: 'center', width: 52 },
  evidenceCopy: { flex: 1, gap: 3 },
  evidenceTitle: { fontSize: 13, fontWeight: '900', lineHeight: 17 },
  evidenceSubtitle: { fontSize: 11.5, lineHeight: 16 },
  review: { backgroundColor: 'rgba(255,195,107,0.08)', borderCurve: 'continuous', borderRadius: 20, gap: 7, padding: 14 },
  reviewTitle: { fontSize: 15, fontWeight: '800', lineHeight: 21, paddingBottom: 5 },
  answer: { alignItems: 'center', backgroundColor: Lantern.ink900, borderCurve: 'continuous', borderRadius: 14, flexDirection: 'row', justifyContent: 'space-between', minHeight: 48, paddingHorizontal: 13 },
  answerText: { fontSize: 12.5, fontWeight: '800' },
  reward: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 8 },
  rewardText: { fontSize: 12.5, fontWeight: '800' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
