import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { QuestSubmissionItem } from '@/utils/quests/report-back-evidence';
import type { QuestRuntimeStatus } from '@/utils/quests/runtime';
import type { MemoryQualityScore } from '@/types/home';
import type { QuestCaptureFeedback } from '@/hooks/use-kingdom-quests';

export type CompanionThread = 'quest' | 'insight' | 'reflection';

type Criterion = {
  label: string;
  done: boolean;
  evidenceIds?: string[];
  reason?: string | null;
  current?: number | null;
  target?: number | null;
  progressRatio?: number | null;
  progressLabel?: string | null;
};

type Props = {
  name: string;
  houseLevel?: number;
  openingLine: string;
  thread: CompanionThread | null;
  onSelectThread: (thread: CompanionThread) => void;
  onClose: () => void;
  activeQuest: { title: string; hint: string } | null;
  questComplete: boolean;
  questRuntime: QuestRuntimeStatus | null;
  questCaptureFeedback: QuestCaptureFeedback | null;
  submissionItems: QuestSubmissionItem[];
  offer: { id: string; title: string; hint: string } | undefined;
  criteria: Criterion[];
  onAccept: () => void;
  onCashIn: () => void;
  onSubmitQuest: (item: QuestSubmissionItem) => void;
  onClarifyQuestMatch: (item: QuestSubmissionItem, answer: MemoryQualityScore['centrality'] | 'rejected') => void;
  onQuestAction: () => void;
  insightText: string;
  reflectionText: string;
  onAnswerReflection: () => void;
};

const CHIPS: { key: CompanionThread; icon: string; label: string }[] = [
  { key: 'quest', icon: 'sparkles', label: 'Quest' },
  { key: 'insight', icon: 'star.fill', label: 'Insight' },
  { key: 'reflection', icon: 'leaf.fill', label: 'Reflect' },
];

export function CompanionCard(props: Props) {
  const { thread } = props;
  return (
    <Pressable style={styles.scrim} onPress={props.onClose}>
      <Pressable style={styles.card} onPress={(event) => event.stopPropagation()}>
        <View style={styles.headerRow}>
          <ThemedText style={styles.name} lightColor="#FFE2B8" darkColor="#FFE2B8">
            {props.name}
            {props.houseLevel ? `  -  home Lv ${props.houseLevel}` : ''}
          </ThemedText>
          <Pressable hitSlop={8} onPress={props.onClose}>
            <IconSymbol name="xmark" size={12} color="rgba(251,243,228,0.7)" />
          </Pressable>
        </View>

        <View style={styles.bubble}>
          <ThemedText style={styles.bubbleText} lightColor="#EDEAF6" darkColor="#EDEAF6">
            {thread === null ? props.openingLine : threadLine(props)}
          </ThemedText>
          {thread === 'quest' ? <QuestBody {...props} /> : null}
          {thread === 'reflection' ? (
            <Pressable style={styles.action} onPress={props.onAnswerReflection}>
              <ThemedText style={styles.actionText} lightColor="#A8E2C6" darkColor="#A8E2C6">
                Answer in a note
              </ThemedText>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.chipRow}>
          {CHIPS.map((chip) => {
            const active = thread === chip.key;
            return (
              <Pressable
                key={chip.key}
                onPress={() => props.onSelectThread(chip.key)}
                style={[styles.chip, active ? styles.chipActive : null]}>
                <IconSymbol name={chip.icon as never} size={13} color={active ? '#1B140A' : '#EDEAF6'} />
                <ThemedText
                  style={styles.chipLabel}
                  lightColor={active ? '#1B140A' : '#EDEAF6'}
                  darkColor={active ? '#1B140A' : '#EDEAF6'}>
                  {chip.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </Pressable>
    </Pressable>
  );
}

function threadLine(props: Props): string {
  if (props.thread === 'insight') return props.insightText;
  if (props.thread === 'reflection') return props.reflectionText;
  if (props.questRuntime?.readyToSubmit) {
    return props.submissionItems.length > 0 ? 'That looks right. Choose what to submit.' : 'This needs a new matching entry.';
  }
  if ((props.questRuntime?.possibleEvidenceIds.length ?? 0) > 0 && props.submissionItems.length > 0) return 'I found a possible match. Check it before submitting.';
  if (props.questComplete) return 'You did it. Ready to make it count?';
  if (props.questRuntime?.state === 'blocked_permission') return props.questRuntime.userMessage;
  if (props.questRuntime?.state === 'unavailable') return props.questRuntime.userMessage;
  if (props.questRuntime?.state === 'impossible_today') return props.questRuntime.userMessage;
  if (props.activeQuest) return "Still on it. Here's where you're at.";
  return props.offer ? "Here's something I could use your help with." : 'Nothing pressing right now.';
}

function QuestBody(props: Props) {
  const [reviewItem, setReviewItem] = useState<QuestSubmissionItem | null>(null);
  if (props.activeQuest) {
    const hasSubmissionItem = props.submissionItems.length > 0;
    const questRuntime = props.questRuntime;
    return (
      <View style={styles.questBody}>
        <ThemedText style={styles.questTitle} lightColor="#FFE2B8" darkColor="#FFE2B8">
          {props.activeQuest.title}
        </ThemedText>
        {questRuntime ? (
          <View style={styles.statusPill}>
            <ThemedText style={styles.statusText} lightColor={statusColor(questRuntime, hasSubmissionItem)} darkColor={statusColor(questRuntime, hasSubmissionItem)}>
              {statusLabel(questRuntime, hasSubmissionItem)}
            </ThemedText>
          </View>
        ) : null}
        {props.questCaptureFeedback ? (
          <View style={styles.captureFeedback}>
            <Image source={props.questCaptureFeedback.sourceId} style={styles.captureFeedbackThumb} contentFit="cover" transition={120} />
            {props.questCaptureFeedback.phase === 'analyzing' ? <ActivityIndicator size="small" color="#92D7FF" /> : null}
            <ThemedText style={[styles.statusMessage, styles.captureFeedbackText]} lightColor="#EDEAF6" darkColor="#EDEAF6">
              {props.questCaptureFeedback.phase === 'analyzing'
                ? 'Analysing your new photo…'
                : props.questCaptureFeedback.phase === 'matched'
                  ? 'This photo matches the quest. It is ready to submit.'
                  : props.questCaptureFeedback.phase === 'possible'
                    ? 'This may match. Review the photo below to confirm it.'
                    : props.questCaptureFeedback.reason ?? 'This photo did not clearly match the quest. You can try another.'}
            </ThemedText>
          </View>
        ) : null}
        {props.questRuntime && !props.questRuntime.complete ? (
          <ThemedText style={styles.statusMessage} lightColor="#EDEAF6" darkColor="#EDEAF6">
            {props.questRuntime.readyToSubmit && !hasSubmissionItem
              ? 'Make a new matching entry for this quest, then come back to submit it.'
              : props.questRuntime.possibleEvidenceIds.length > 0 && !hasSubmissionItem
                ? 'There is no reviewable photo attached to that old signal. Take another photo to create a usable match.'
              : props.questRuntime.userMessage}
          </ThemedText>
        ) : null}
        {props.criteria.map((criterion) => (
          <View key={criterion.label} style={styles.criterionBlock}>
            <ThemedText
              style={styles.criterion}
              lightColor={criterion.done ? '#A8E2C6' : '#B7B2C6'}
              darkColor={criterion.done ? '#A8E2C6' : '#B7B2C6'}>
              {criterion.done ? 'OK' : '--'} {criterion.label}
              {criterion.evidenceIds?.length ? ` (${criterion.evidenceIds.length} signal${criterion.evidenceIds.length === 1 ? '' : 's'})` : ''}
            </ThemedText>
            {criterion.progressLabel && criterion.progressRatio != null ? (
              <QuestProgressBar label={criterion.progressLabel} ratio={criterion.progressRatio} complete={criterion.done} />
            ) : null}
          </View>
        ))}
        {questRuntime?.readyToSubmit || (questRuntime?.possibleEvidenceIds.length ?? 0) > 0 ? (
          <>
            {hasSubmissionItem ? (
              <ReportBackPreview
                items={props.submissionItems}
                emptyMode="submission"
                selectedId={reviewItem?.id ?? null}
                onSelect={(item) => item.matchStatus === 'possible' ? setReviewItem(item) : undefined}
              />
            ) : null}
            {reviewItem?.matchStatus === 'possible' ? (
              <View style={styles.matchQuestion}>
                <ThemedText style={styles.criterion} lightColor="#F8E8C8" darkColor="#F8E8C8">
                  {reviewItem.qualityId === 'place.city'
                    ? 'Does this photo show the city view Skylo is looking for?'
                    : 'Does this photo show what the quest is looking for?'}
                </ThemedText>
                {([
                  ['primary', "Yes — that's what I captured"],
                  ['supporting', "Yes — it's clearly visible"],
                  ['incidental', "It's only in the background"],
                  ['rejected', "No — it doesn't"],
                ] as const).map(([answer, label]) => (
                  <Pressable
                    key={answer}
                    style={styles.matchAnswer}
                    onPress={() => {
                      props.onClarifyQuestMatch(reviewItem, answer);
                      setReviewItem(null);
                    }}>
                    <ThemedText style={styles.actionText} lightColor="#F8E8C8" darkColor="#F8E8C8">{label}</ThemedText>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {hasSubmissionItem && props.submissionItems[0] ? (
              <Pressable
                style={[styles.action, props.submissionItems[0].matchStatus === 'possible' ? null : styles.cashIn]}
                onPress={() => props.submissionItems[0].matchStatus === 'possible'
                  ? setReviewItem(props.submissionItems[0])
                  : props.onSubmitQuest(props.submissionItems[0])}>
                <ThemedText
                  style={styles.actionText}
                  lightColor={props.submissionItems[0].matchStatus === 'possible' ? '#F8E8C8' : '#1B140A'}
                  darkColor={props.submissionItems[0].matchStatus === 'possible' ? '#F8E8C8' : '#1B140A'}>
                  {props.submissionItems[0].matchStatus === 'possible' ? 'Review possible match' : 'Submit quest'}
                </ThemedText>
              </Pressable>
            ) : null}
            {!hasSubmissionItem && questRuntime && questRuntime.nextAction !== 'none' ? (
              <>
                <ThemedText style={styles.actionHint} lightColor="#A8E2C6" darkColor="#A8E2C6">
                  {nextActionLabel(questRuntime)}
                </ThemedText>
                <Pressable style={styles.action} onPress={props.onQuestAction}>
                  <ThemedText style={styles.actionText} lightColor="#A8E2C6" darkColor="#A8E2C6">
                    {nextActionButtonLabel(questRuntime)}
                  </ThemedText>
                </Pressable>
              </>
            ) : null}
          </>
        ) : null}
        {props.questRuntime && props.questRuntime.nextAction !== 'none' && !props.questRuntime.complete && !props.questRuntime.readyToSubmit && props.questRuntime.possibleEvidenceIds.length === 0 ? (
          <ThemedText style={styles.actionHint} lightColor="#A8E2C6" darkColor="#A8E2C6">
            {nextActionLabel(props.questRuntime)}
          </ThemedText>
        ) : null}
        {props.questRuntime && props.questRuntime.nextAction !== 'none' && !props.questRuntime.complete && !props.questRuntime.readyToSubmit && props.questRuntime.possibleEvidenceIds.length === 0 ? (
          <Pressable style={styles.action} onPress={props.onQuestAction}>
            <ThemedText style={styles.actionText} lightColor="#A8E2C6" darkColor="#A8E2C6">
              {nextActionButtonLabel(props.questRuntime)}
            </ThemedText>
          </Pressable>
        ) : null}
        {props.questComplete ? (
          <>
            <ReportBackPreview items={props.submissionItems} emptyMode="report" />
            <Pressable style={[styles.action, styles.cashIn]} onPress={props.onCashIn}>
              <ThemedText style={styles.actionText} lightColor="#1B140A" darkColor="#1B140A">
                Report back
              </ThemedText>
            </Pressable>
          </>
        ) : null}
      </View>
    );
  }
  if (!props.offer) return null;
  return (
    <Pressable style={styles.action} onPress={props.onAccept}>
      <ThemedText style={styles.actionText} lightColor="#A8E2C6" darkColor="#A8E2C6">
        Accept: {props.offer.title} - {props.offer.hint}
      </ThemedText>
    </Pressable>
  );
}

function QuestProgressBar({ label, ratio, complete }: { label: string; ratio: number; complete: boolean }) {
  return (
    <View style={styles.progressBlock}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.max(4, Math.min(100, ratio * 100))}%` }, complete ? styles.progressFillDone : null]} />
      </View>
      <ThemedText style={styles.progressLabel} lightColor="#B7B2C6" darkColor="#B7B2C6">
        {label}
      </ThemedText>
    </View>
  );
}

function ReportBackPreview({
  items,
  emptyMode,
  selectedId = null,
  onSelect,
}: {
  items: QuestSubmissionItem[];
  emptyMode: 'submission' | 'report';
  selectedId?: string | null;
  onSelect?: (item: QuestSubmissionItem) => void;
}) {
  const visibleItems: QuestSubmissionItem[] =
    items.length > 0
      ? items
      : [
          {
            id: 'fallback',
            kind: 'moment',
            sourceType: 'moment',
            sourceId: 'fallback',
            evidenceId: null,
            createdAt: null,
            title: 'Quest evidence from today',
            subtitle: emptyMode === 'submission' ? 'Make a new matching entry to submit this quest.' : 'The matching signals are ready to submit.',
            icon: 'sparkles' as const,
            accentColor: '#A8E2C6',
          },
        ];

  return (
    <View style={styles.reportPreview}>
      <ThemedText style={styles.reportKicker} lightColor="#A8E2C6" darkColor="#A8E2C6">
        {emptyMode === 'submission' ? 'Matches from today' : 'Reporting back'}
      </ThemedText>
      {visibleItems.map((item, index) => (
        <View key={item.id}>
          {emptyMode === 'submission' && item.matchStatus && (index === 0 || visibleItems[index - 1]?.matchStatus !== item.matchStatus) ? (
            <ThemedText style={styles.reportKicker} lightColor={item.matchStatus === 'ready' ? '#A8E2C6' : '#F3B36A'} darkColor={item.matchStatus === 'ready' ? '#A8E2C6' : '#F3B36A'}>
              {item.matchStatus === 'ready' ? 'Ready' : 'Possible'}
            </ThemedText>
          ) : null}
          <Pressable
            disabled={!onSelect || item.matchStatus !== 'possible'}
            onPress={() => onSelect?.(item)}
            style={[styles.reportRow, selectedId === item.id ? styles.reportRowSelected : null]}>
          {item.thumbnailUri ? (
            <Image source={item.thumbnailUri} style={styles.reportThumb} contentFit="cover" transition={120} />
          ) : (
            <View style={[styles.reportIconBox, { borderColor: item.accentColor }]}>
              <IconSymbol name={item.icon} size={19} color={item.accentColor} />
            </View>
          )}
          <View style={styles.reportText}>
            <ThemedText numberOfLines={1} style={styles.reportTitle} lightColor="#F8E8C8" darkColor="#F8E8C8">
              {item.title}
            </ThemedText>
            <ThemedText numberOfLines={1} style={styles.reportSubtitle} lightColor="#B7B2C6" darkColor="#B7B2C6">
              {item.subtitle}
            </ThemedText>
            {item.body ? (
              <ThemedText numberOfLines={2} style={styles.reportBody} lightColor="#EDEAF6" darkColor="#EDEAF6">
                {item.body}
              </ThemedText>
            ) : null}
          </View>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function statusLabel(runtime: QuestRuntimeStatus, hasSubmissionItem = true): string {
  if (runtime.readyToSubmit) return hasSubmissionItem ? 'Ready to submit' : 'Needs new entry';
  if (runtime.possibleEvidenceIds.length > 0) return hasSubmissionItem ? 'Possible match' : 'No usable match yet';
  if (runtime.complete) return runtime.matchedEvidenceIds.length > 0 ? 'Matched from today' : 'Ready to report';
  switch (runtime.state) {
    case 'blocked_permission':
      return 'Needs permission';
    case 'unavailable':
      return 'Unavailable';
    case 'impossible_today':
      return 'Missed for today';
    default:
      return runtime.matchedEvidenceIds.length > 0 ? 'Partly matched' : 'Looking for signals';
  }
}

function statusColor(runtime: QuestRuntimeStatus, hasSubmissionItem = true): string {
  if (runtime.readyToSubmit) return hasSubmissionItem ? '#A8E2C6' : '#F3B36A';
  if (runtime.possibleEvidenceIds.length > 0) return '#F3B36A';
  if (runtime.complete) return '#A8E2C6';
  if (runtime.state === 'blocked_permission' || runtime.state === 'unavailable') return '#F3B36A';
  if (runtime.state === 'impossible_today') return '#F08C8C';
  return '#B7B2C6';
}

function nextActionLabel(runtime: QuestRuntimeStatus): string {
  switch (runtime.nextAction) {
    case 'take_photo':
      return 'Next: take a photo that clearly matches the quest.';
    case 'enable_photos':
      return 'Next: enable photo access.';
    case 'enable_camera':
      return 'Next: enable camera access.';
    case 'enable_location':
      return 'Next: enable location access or confirm a place manually.';
    case 'enable_travel_memory':
      return 'Next: enable Travel Memory.';
    case 'record_voice':
      return 'Next: record a voice note.';
    case 'add_note':
      return 'Next: add a note.';
    case 'open_health':
      return 'Next: connect Health or motion data.';
    case 'confirm_place':
      return 'Next: confirm where this happened.';
    default:
      return '';
  }
}

function nextActionButtonLabel(runtime: QuestRuntimeStatus): string {
  switch (runtime.nextAction) {
    case 'take_photo':
    case 'enable_camera':
      return 'Open camera';
    case 'enable_photos':
      return 'Open photos';
    case 'enable_location':
    case 'enable_travel_memory':
    case 'confirm_place':
      return 'Open places';
    case 'record_voice':
      return 'Record voice';
    case 'add_note':
      return 'Add note';
    case 'open_health':
      return 'Open movement';
    default:
      return 'Open Today';
  }
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  card: {
    marginHorizontal: 14,
    marginBottom: 118,
    borderRadius: 22,
    padding: 16,
    backgroundColor: 'rgba(16,14,26,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,195,107,0.35)',
    gap: 12,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: 15, fontWeight: '800' },
  bubble: {
    borderRadius: 16,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  questBody: { marginTop: 8, gap: 4 },
  questTitle: { fontSize: 13.5, fontWeight: '700' },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  statusText: { fontSize: 11.5, fontWeight: '800' },
  statusMessage: { fontSize: 12.5, lineHeight: 17, fontWeight: '600' },
  captureFeedback: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 12,
    padding: 10,
    backgroundColor: 'rgba(146,215,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(146,215,255,0.22)',
  },
  captureFeedbackThumb: {
    width: 44,
    height: 44,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  captureFeedbackText: { flex: 1 },
  criterion: { fontSize: 12.5 },
  criterionBlock: { gap: 5 },
  progressBlock: { gap: 4 },
  progressTrack: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    borderWidth: 1,
    height: 8,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: '#E9A93E',
    borderRadius: 999,
    height: '100%',
  },
  progressFillDone: {
    backgroundColor: '#A8E2C6',
  },
  progressLabel: { fontSize: 11.5, fontWeight: '800', lineHeight: 15 },
  actionHint: { fontSize: 12, lineHeight: 16, fontWeight: '800', marginTop: 2 },
  reportPreview: {
    marginTop: 8,
    gap: 8,
    borderRadius: 14,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(168,226,198,0.18)',
  },
  reportKicker: { fontSize: 10, fontWeight: '900', letterSpacing: 0, textTransform: 'uppercase' },
  reportRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reportRowSelected: {
    marginHorizontal: -6,
    padding: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(243,179,106,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(243,179,106,0.42)',
  },
  reportThumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  reportIconBox: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
  },
  reportText: { flex: 1, minWidth: 0, gap: 2 },
  reportTitle: { fontSize: 12.5, lineHeight: 16, fontWeight: '800' },
  reportSubtitle: { fontSize: 11, lineHeight: 14, fontWeight: '700' },
  reportBody: { fontSize: 11.5, lineHeight: 16 },
  matchQuestion: {
    marginTop: 8,
    gap: 7,
    borderRadius: 12,
    padding: 10,
    backgroundColor: 'rgba(243,179,106,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(243,179,106,0.26)',
  },
  matchAnswer: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  action: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(168,226,198,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(168,226,198,0.45)',
  },
  cashIn: { backgroundColor: '#A8E2C6', borderColor: '#A8E2C6' },
  actionText: { fontSize: 13, fontWeight: '700' },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  chipActive: { backgroundColor: '#E9A93E', borderColor: '#E9A93E' },
  chipLabel: { fontSize: 13, fontWeight: '700' },
});
