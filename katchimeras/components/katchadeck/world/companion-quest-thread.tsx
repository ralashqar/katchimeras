import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { AppFontFamilies } from '@/constants/theme';
import { Meadow } from '@/constants/meadow-theme';
import type { CompanionQuestOfferViewModel, CompanionQuestViewModel } from '@/types/companion-interaction';
import type { QuestSubmissionItem } from '@/utils/quests/report-back-evidence';
import { companionQuestInlineNoteAction } from '@/utils/companion-interaction';
import { CompanionSection, CompanionStatusBadge } from './companion-interaction-primitives';

export function CompanionQuestChoices({
  offers,
  selectedId,
  onSelect,
  onAccept,
}: {
  offers: CompanionQuestOfferViewModel[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAccept: (id: string) => void;
}) {
  return (
    <View style={styles.choiceRoot}>
      <View style={styles.choiceHeading}>
        <View>
          <ThemedText style={styles.choiceTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>Choose a quest</ThemedText>
        </View>
        <ThemedText style={styles.available} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>{offers.length} available</ThemedText>
      </View>
      <View style={styles.offerList}>
        {offers.map((offer) => {
          const selected = selectedId === offer.id;
          const icon = questFamilyIcon(offer.family);
          return (
            <Pressable
              key={offer.id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${offer.title}. ${offer.hint}. ${offer.bondReward} bond. About ${offer.estimatedMinutes} minutes.`}
              onPress={() => onSelect(offer.id)}
              style={({ pressed }) => [styles.offer, selected && styles.offerSelected, pressed && styles.pressed]}>
              <View style={[styles.offerArt, selected && styles.offerArtSelected]}>
                <IconSymbol name={icon} size={31} color={selected ? Meadow.goldDeep : Meadow.iconOnCard} />
              </View>
              <View style={styles.offerCopy}>
                <View style={styles.offerTopline}>
                  <ThemedText style={styles.offerCategory} lightColor={selected ? Meadow.goldDeep : Meadow.leafDeep} darkColor={selected ? Meadow.goldDeep : Meadow.leafDeep}>
                    {offer.lane === 'mini_game' ? 'Mini-game' : 'Real life'}
                    {offer.recommended ? ' · Recommended' : ` · ${offer.categoryLabel}`}
                  </ThemedText>
                  <View style={[styles.radio, selected && styles.radioSelected]}>
                    {selected ? <IconSymbol name="checkmark" size={12} color="#FFF6DA" /> : null}
                  </View>
                </View>
                <ThemedText numberOfLines={2} style={styles.offerTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>{offer.title}</ThemedText>
                <ThemedText numberOfLines={2} style={styles.offerHint} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>{offer.hint}</ThemedText>
                <View style={styles.offerFooter}>
                  <View style={styles.offerMeta}>
                    <Meta icon="heart.fill" label={`+${offer.bondReward} bond`} />
                    <Meta icon="timer" label={`${offer.estimatedMinutes} min`} />
                  </View>
                  {selected ? (
                    <Animated.View entering={FadeIn.duration(140)}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Accept ${offer.title}`}
                        hitSlop={5}
                        onPress={(event) => {
                          event.stopPropagation();
                          onAccept(offer.id);
                        }}
                        style={({ pressed }) => [styles.accept, pressed && styles.acceptPressed]}>
                        <ThemedText style={styles.acceptText} lightColor={Meadow.ink} darkColor={Meadow.ink}>Accept</ThemedText>
                        <IconSymbol name="arrow.right" size={12} color={Meadow.ink} />
                      </Pressable>
                    </Animated.View>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Meta({ icon, label }: { icon: IconSymbolName; label: string }) {
  return <View style={styles.meta}><IconSymbol name={icon} size={11} color={Meadow.inkSoft} /><ThemedText style={styles.metaText} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>{label}</ThemedText></View>;
}

function questFamilyIcon(family: CompanionQuestOfferViewModel['family']): IconSymbolName {
  if (family === 'movement') return 'figure.run';
  if (family === 'food') return 'fork.knife';
  if (family === 'place') return 'mappin.and.ellipse';
  if (family === 'photo') return 'camera.fill';
  if (family === 'sleep') return 'moon.stars.fill';
  if (family === 'note' || family === 'voice') return 'square.and.pencil';
  if (family === 'weather') return 'cloud.sun.fill';
  return 'gamecontroller.fill';
}

export function CompanionQuestThread({
  model,
  reviewItem,
  onSelectReviewItem,
  onClarify,
  onAttemptInput,
}: {
  model: CompanionQuestViewModel;
  reviewItem: QuestSubmissionItem | null;
  onSelectReviewItem: (item: QuestSubmissionItem | null) => void;
  onClarify: (item: QuestSubmissionItem, answer: 'primary' | 'supporting' | 'incidental' | 'rejected') => void;
  onAttemptInput: () => void;
}) {
  const compactActive = model.mode === 'active';
  const inlineNoteAction = companionQuestInlineNoteAction(model);
  return (
    <Animated.View layout={LinearTransition.duration(180)} style={styles.root}>
      {compactActive ? (
        <View
          accessibilityLabel={`${model.eyebrow}. ${model.title}. ${model.criteria.map((criterion) => criterion.label).join('. ')}. ${model.statusLabel ?? model.message}`}
          style={styles.activeSummary}>
          <ThemedText style={styles.eyebrow} lightColor={Meadow.goldDeep} darkColor={Meadow.goldDeep}>{model.eyebrow}</ThemedText>
          <ThemedText selectable style={styles.title} lightColor={Meadow.ink} darkColor={Meadow.ink}>{model.title}</ThemedText>
          {model.criteria.length ? (
            <View style={styles.activeGoals}>
              {model.criteria.map((criterion) => (
                <View key={criterion.id} style={styles.activeGoal}>
                  <View style={[styles.check, styles.activeCheck, criterion.done && styles.checkDone]}>
                    <IconSymbol name={criterion.done ? 'checkmark' : 'circle'} size={12} color={criterion.done ? '#FFF8E6' : Meadow.inkSoft} />
                  </View>
                  <View style={styles.criterionCopy}>
                    <ThemedText style={styles.criterionLabel} lightColor={Meadow.ink} darkColor={Meadow.ink}>{criterion.label}</ThemedText>
                    {criterion.progressLabel ? <ThemedText style={styles.criterionReason} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>{criterion.progressLabel}</ThemedText> : null}
                    {criterion.progressRatio != null ? <QuestProgress ratio={criterion.progressRatio} done={criterion.done} label={criterion.progressLabel ?? criterion.label} /> : null}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <ThemedText selectable style={styles.message} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>{model.message}</ThemedText>
          )}
          {inlineNoteAction ? (
            <Pressable
              accessibilityHint={model.journalFallback
                ? 'Opens the matching journal category'
                : 'Opens a quest note with text and voice recording'}
              accessibilityLabel={model.journalFallback
                ? 'Open the matching journal entry for this quest'
                : 'Add a note or voice note for this quest'}
              accessibilityRole="button"
              onPress={onAttemptInput}
              style={({ pressed }) => [styles.noteAttempt, pressed && styles.noteAttemptPressed]}>
              <View style={styles.noteAttemptIcon}>
                <IconSymbol name="square.and.pencil" size={17} color={Meadow.goldDeep} />
              </View>
              <View style={styles.noteAttemptCopy}>
                <ThemedText style={styles.noteAttemptTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>
                  {model.journalFallback ? 'Fill journal entry' : 'Add note or voice'}
                </ThemedText>
                <ThemedText style={styles.noteAttemptHint} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
                  {model.journalFallback
                    ? 'The matching category is already selected'
                    : 'Share this moment for the quest'}
                </ThemedText>
              </View>
              <IconSymbol name="chevron.right" size={15} color={Meadow.goldDeep} />
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={styles.intro}>
          <ThemedText style={styles.eyebrow} lightColor={Meadow.goldDeep} darkColor={Meadow.goldDeep}>{model.eyebrow}</ThemedText>
          <ThemedText selectable style={styles.title} lightColor={Meadow.ink} darkColor={Meadow.ink}>{model.title}</ThemedText>
          <ThemedText selectable style={styles.message} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>{model.message}</ThemedText>
          {model.statusLabel ? <CompanionStatusBadge label={model.statusLabel} tone={model.statusTone} /> : null}
        </View>
      )}

      {model.captureFeedback ? <CaptureFeedback model={model} /> : null}

      {!compactActive && model.criteria.length ? (
        <CompanionSection label="What this quest needs">
          <View style={styles.criteria}>
            {model.criteria.map((criterion) => (
              <View key={criterion.id} style={styles.criterion}>
                <View style={[styles.check, criterion.done && styles.checkDone]}>
                  <IconSymbol name={criterion.done ? 'checkmark' : 'circle'} size={12} color={criterion.done ? '#FFF8E6' : Meadow.inkSoft} />
                </View>
                <View style={styles.criterionCopy}>
                  <ThemedText style={styles.criterionLabel} lightColor={Meadow.ink} darkColor={Meadow.ink}>{criterion.label}</ThemedText>
                  {criterion.progressLabel ? <ThemedText style={styles.criterionReason} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>{criterion.progressLabel}</ThemedText> : null}
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
          <ThemedText style={styles.reviewTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>{questMatchQuestion(reviewItem)}</ThemedText>
          {([
            ['primary', 'Yes, it is the main subject'],
            ['supporting', 'Yes, it is clearly visible'],
            ['incidental', 'Only in the background'],
            ['rejected', 'No, it does not match'],
          ] as const).map(([answer, label]) => (
            <Pressable key={answer} accessibilityRole="button" onPress={() => onClarify(reviewItem, answer)} style={({ pressed }) => [styles.answer, pressed && styles.pressed]}>
              <ThemedText style={styles.answerText} lightColor={answer === 'rejected' ? '#A84F43' : Meadow.inkSoft} darkColor={answer === 'rejected' ? '#A84F43' : Meadow.inkSoft}>{label}</ThemedText>
              <IconSymbol name="chevron.right" size={12} color={Meadow.inkSoft} />
            </Pressable>
          ))}
        </Animated.View>
      ) : null}

      {model.rewardLabel ? (
        <View style={styles.reward}>
          <IconSymbol name="sparkles" size={15} color={Meadow.goldDeep} />
          <ThemedText style={styles.rewardText} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>{model.rewardLabel}</ThemedText>
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
      {feedback.sourceType === 'photo' && feedback.sourceId
        ? <Image source={feedback.sourceId} style={styles.captureThumb} contentFit="cover" transition={120} />
        : (
          <View style={[styles.captureThumb, styles.captureNote]}>
            <IconSymbol name={feedback.sourceType === 'voice_note' ? 'mic.fill' : 'note.text'} size={19} color={Meadow.goldDeep} />
          </View>
        )}
      <View style={styles.captureCopy}>
        {analysing ? (
          <>
            <View style={[styles.captureBar, { width: '84%' }]} />
            <View style={[styles.captureBar, styles.captureBarShort]} />
          </>
        ) : (
          <ThemedText style={styles.captureLabel} lightColor={feedback.phase === 'matched' ? Meadow.leafDeep : feedback.phase === 'no_match' ? '#A84F43' : Meadow.goldDeep} darkColor={feedback.phase === 'matched' ? Meadow.leafDeep : feedback.phase === 'no_match' ? '#A84F43' : Meadow.goldDeep}>{label}</ThemedText>
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
        <ThemedText numberOfLines={2} style={styles.evidenceTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>{item.title}</ThemedText>
        <ThemedText numberOfLines={2} style={styles.evidenceSubtitle} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>{item.subtitle}</ThemedText>
      </View>
      {onPress ? <IconSymbol name="chevron.right" size={13} color={Meadow.inkSoft} /> : <IconSymbol name="checkmark.circle.fill" size={18} color={Meadow.leafDeep} />}
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
  choiceRoot: { gap: 12, paddingBottom: 8, paddingTop: 4 },
  choiceHeading: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between' },
  choiceTitle: { fontFamily: AppFontFamilies.instrumentSerif, fontSize: 24, lineHeight: 28 },
  available: { fontSize: 10.5, fontVariant: ['tabular-nums'], paddingBottom: 2 },
  offerList: { gap: 9 },
  offer: { alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.30)', borderColor: 'rgba(122,84,44,0.18)', borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, boxShadow: '-3px 4px 8px rgba(58,38,18,0.16), inset 0 1px 0 rgba(255,248,230,0.55)', flexDirection: 'row', gap: 11, minHeight: 108, padding: 9 },
  offerSelected: { backgroundColor: 'rgba(255,244,204,0.58)', borderColor: Meadow.goldDeep, boxShadow: '-3px 5px 12px rgba(92,57,20,0.22), inset 0 1px 0 rgba(255,252,235,0.78), 0 0 0 1px rgba(229,190,106,0.22)' },
  offerArt: { alignItems: 'center', backgroundColor: 'rgba(138,112,80,0.10)', borderColor: 'rgba(255,248,230,0.28)', borderCurve: 'continuous', borderRadius: 14, borderWidth: 1, boxShadow: 'inset 0 1px 0 rgba(255,248,230,0.38)', height: 82, justifyContent: 'center', width: 72 },
  offerArtSelected: { backgroundColor: Meadow.goldSoft },
  offerCopy: { flex: 1, gap: 3, minWidth: 0 },
  offerTopline: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  offerCategory: { fontSize: 9.5, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase' },
  offerTitle: { fontFamily: AppFontFamilies.instrumentSerif, fontSize: 19, lineHeight: 21 },
  offerHint: { fontSize: 10.5, lineHeight: 14 },
  offerFooter: { alignItems: 'center', flexDirection: 'row', gap: 6, justifyContent: 'space-between', paddingTop: 2 },
  offerMeta: { flexDirection: 'row', flexShrink: 1, gap: 6 },
  meta: { alignItems: 'center', backgroundColor: 'rgba(138,112,80,0.09)', borderRadius: 999, flexDirection: 'row', gap: 3, minHeight: 20, paddingHorizontal: 6 },
  metaText: { fontSize: 9.5, fontVariant: ['tabular-nums'], fontWeight: '700' },
  accept: { alignItems: 'center', backgroundColor: '#E7B951', borderColor: 'rgba(255,244,204,0.72)', borderCurve: 'continuous', borderRadius: 11, borderWidth: 1, boxShadow: '-2px 3px 7px rgba(92,57,20,0.22), inset 0 1px 0 rgba(255,252,234,0.72)', flexDirection: 'row', gap: 4, minHeight: 30, paddingHorizontal: 9 },
  acceptText: { fontSize: 10.5, fontWeight: '900' },
  acceptPressed: { opacity: 0.78, transform: [{ scale: 0.96 }] },
  radio: { alignItems: 'center', borderColor: Meadow.cardBorder, borderRadius: 999, borderWidth: 1, height: 22, justifyContent: 'center', width: 22 },
  radioSelected: { backgroundColor: Meadow.goldDeep, borderColor: Meadow.goldDeep },
  root: { gap: 18, paddingBottom: 18, paddingTop: 8 },
  intro: { gap: 8 },
  activeSummary: { gap: 10 },
  activeGoals: { gap: 7, paddingTop: 2 },
  activeGoal: { alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.32)', borderColor: 'rgba(122,84,44,0.16)', borderCurve: 'continuous', borderRadius: 17, borderWidth: 1, boxShadow: '-2px 3px 7px rgba(58,38,18,0.13), inset 0 1px 0 rgba(255,248,230,0.48)', flexDirection: 'row', gap: 11, minHeight: 58, paddingHorizontal: 11, paddingVertical: 9 },
  activeCheck: { flexShrink: 0 },
  noteAttempt: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: 'rgba(231,185,81,0.18)', borderColor: 'rgba(183,132,42,0.48)', borderCurve: 'continuous', borderRadius: 16, borderWidth: 1, boxShadow: '-2px 3px 7px rgba(58,38,18,0.12), inset 0 1px 0 rgba(255,248,230,0.56)', flexDirection: 'row', gap: 9, minHeight: 48, paddingHorizontal: 10, paddingVertical: 7 },
  noteAttemptPressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
  noteAttemptIcon: { alignItems: 'center', backgroundColor: Meadow.goldSoft, borderRadius: 11, height: 32, justifyContent: 'center', width: 32 },
  noteAttemptCopy: { gap: 1, minWidth: 0 },
  noteAttemptTitle: { fontSize: 12.5, fontWeight: '900', lineHeight: 16 },
  noteAttemptHint: { fontSize: 10.5, lineHeight: 14 },
  eyebrow: { fontSize: 10.5, fontWeight: '900', letterSpacing: 1.1, textTransform: 'uppercase' },
  title: { fontFamily: AppFontFamilies.instrumentSerif, fontSize: 27, lineHeight: 32 },
  message: { fontSize: 14, lineHeight: 21 },
  criteria: { gap: 2 },
  criterion: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, minHeight: 52, paddingVertical: 8 },
  check: { alignItems: 'center', backgroundColor: 'rgba(138,112,80,0.12)', borderRadius: 999, height: 26, justifyContent: 'center', width: 26 },
  checkDone: { backgroundColor: Meadow.leaf },
  criterionCopy: { flex: 1, gap: 4 },
  criterionLabel: { fontSize: 13.5, fontWeight: '800', lineHeight: 19 },
  criterionReason: { fontSize: 11.5, lineHeight: 16 },
  progressTrack: { backgroundColor: Meadow.trackOnCard, borderRadius: 999, height: 7, overflow: 'hidden' },
  progressFill: { backgroundColor: Meadow.goldDeep, borderRadius: 999, height: '100%' },
  progressDone: { backgroundColor: Meadow.leaf },
  capture: { alignItems: 'center', backgroundColor: 'rgba(107,128,95,0.10)', borderCurve: 'continuous', borderRadius: 18, flexDirection: 'row', gap: 12, padding: 12 },
  captureThumb: { backgroundColor: Meadow.cardSoft, borderCurve: 'continuous', borderRadius: 13, height: 58, width: 58 },
  captureNote: { alignItems: 'center', justifyContent: 'center' },
  captureCopy: { flex: 1, gap: 9 },
  captureBar: { backgroundColor: 'rgba(201,194,232,0.18)', borderRadius: 999, height: 9 },
  captureBarShort: { width: '52%' },
  captureLabel: { fontSize: 12.5, fontWeight: '800', lineHeight: 18 },
  evidenceList: { gap: 8 },
  evidence: { alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.34)', borderCurve: 'continuous', borderRadius: 18, flexDirection: 'row', gap: 11, minHeight: 72, padding: 10 },
  evidenceSelected: { backgroundColor: 'rgba(255,195,107,0.10)' },
  thumb: { borderCurve: 'continuous', borderRadius: 13, height: 52, width: 52 },
  iconBox: { alignItems: 'center', backgroundColor: Meadow.cardSoft, borderRadius: 13, height: 52, justifyContent: 'center', width: 52 },
  evidenceCopy: { flex: 1, gap: 3 },
  evidenceTitle: { fontSize: 13, fontWeight: '900', lineHeight: 17 },
  evidenceSubtitle: { fontSize: 11.5, lineHeight: 16 },
  review: { backgroundColor: 'rgba(255,195,107,0.08)', borderCurve: 'continuous', borderRadius: 20, gap: 7, padding: 14 },
  reviewTitle: { fontSize: 15, fontWeight: '800', lineHeight: 21, paddingBottom: 5 },
  answer: { alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.38)', borderCurve: 'continuous', borderRadius: 14, flexDirection: 'row', justifyContent: 'space-between', minHeight: 48, paddingHorizontal: 13 },
  answerText: { fontSize: 12.5, fontWeight: '800' },
  reward: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 8 },
  rewardText: { fontSize: 12.5, fontWeight: '800' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
