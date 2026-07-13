import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useReducer } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInLeft, FadeInRight, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { MeadowSheet } from '@/components/katchadeck/ui/meadow-sheet';
import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';
import type { HomeVisualKey, MemoryQualityScore } from '@/types/home';
import type {
  CompanionInsight,
  CompanionReflectionDraft,
  CompanionThread,
  QuestCaptureFeedback,
} from '@/types/companion-interaction';
import { getCreatureVisual } from '@/game/days';
import type { QuestSubmissionItem } from '@/utils/quests/report-back-evidence';
import type { QuestRuntimeStatus } from '@/utils/quests/runtime';
import {
  buildCompanionQuestViewModel,
  companionInteractionReducer,
  companionReflectionIsDirty,
  createCompanionInteractionState,
} from '@/utils/companion-interaction';
import { CompanionHero } from './companion-hero';
import { CompanionInsightThread } from './companion-insight-thread';
import { CompanionPrimaryAction, CompanionSecondaryAction } from './companion-interaction-primitives';
import { CompanionQuestThread } from './companion-quest-thread';
import { CompanionReflectionThread } from './companion-reflection-thread';
import { CompanionThreadSwitcher } from './companion-thread-switcher';

type Criterion = {
  label: string;
  done: boolean;
  reason?: string | null;
  progressRatio?: number | null;
  progressLabel?: string | null;
};

export type CompanionInteractionSheetProps = {
  creatureId: string;
  name: string;
  visualKey: HomeVisualKey;
  accentColor: string;
  houseLevel?: number;
  openingLine: string;
  initialThread: CompanionThread;
  onSelectThread?: (thread: CompanionThread) => void;
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
  insight: CompanionInsight;
  onInsightAction: () => void;
  reflectionText: string;
  initialReflectionDraft?: CompanionReflectionDraft | null;
  onReflectionDraftChange?: (draft: CompanionReflectionDraft | null) => void;
  onReviewReflection: (draft: CompanionReflectionDraft) => void;
  reflectionReviewPending?: boolean;
  reflectionSaved?: boolean;
};

export function CompanionInteractionSheet(props: CompanionInteractionSheetProps) {
  const [state, dispatch] = useReducer(companionInteractionReducer, {
    initialThread: props.initialThread,
    reflectionDraft: props.initialReflectionDraft,
  }, createCompanionInteractionState);
  const reduceMotion = useReducedMotion();
  const visual = getCreatureVisual(props.visualKey);
  const quest = useMemo(() => buildCompanionQuestViewModel({
    activeQuest: props.activeQuest,
    offer: props.offer,
    runtime: props.questRuntime,
    questComplete: props.questComplete,
    captureFeedback: props.questCaptureFeedback,
    items: props.submissionItems,
    criteria: props.criteria,
  }), [props.activeQuest, props.criteria, props.offer, props.questCaptureFeedback, props.questComplete, props.questRuntime, props.submissionItems]);
  const reviewItem = props.submissionItems.find((item) => item.id === state.reviewItemId) ?? null;
  const onReflectionDraftChange = props.onReflectionDraftChange;

  const requestClose = () => {
    if (state.thread === 'reflection' && companionReflectionIsDirty(state)) dispatch({ type: 'request_discard' });
    else props.onClose();
  };
  const selectThread = (thread: CompanionThread) => {
    dispatch({ type: 'select_thread', thread });
    props.onSelectThread?.(thread);
  };
  const updateReflection = useCallback((draft: CompanionReflectionDraft | null) => {
    dispatch({ type: 'set_reflection_draft', draft });
    onReflectionDraftChange?.(draft);
  }, [onReflectionDraftChange]);
  const runPrimary = () => {
    const action = quest.primaryAction;
    if (!action) return;
    if (process.env.EXPO_OS === 'ios') {
      if (action.kind === 'accept') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      else void Haptics.selectionAsync();
    }
    if (action.kind === 'accept') props.onAccept();
    else if (action.kind === 'quest_action') props.onQuestAction();
    else if (action.kind === 'review_match') dispatch({ type: 'review_item', itemId: action.item.id });
    else if (action.kind === 'submit') props.onSubmitQuest(action.item);
    else props.onCashIn();
  };
  const footer = props.reflectionSaved
    ? null
    : state.thread === 'quest' && quest.primaryAction
      ? reviewItem ? null : <CompanionPrimaryAction label={quest.primaryAction.label} icon={quest.primaryAction.icon} onPress={runPrimary} disabled={quest.mode === 'analysing'} />
      : state.thread === 'insight' && props.insight.action
        ? <CompanionPrimaryAction label={props.insight.action.label} icon={props.insight.action.icon} onPress={props.onInsightAction} />
        : state.thread === 'reflection' && state.reflectionDraft
          ? <CompanionPrimaryAction label={props.reflectionReviewPending ? 'Preparing review…' : 'Review memory'} icon="arrow.right" disabled={props.reflectionReviewPending} onPress={() => props.onReviewReflection(state.reflectionDraft!)} />
          : null;
  const entering = reduceMotion ? FadeIn.duration(100) : state.direction > 0 ? FadeInRight.duration(210) : FadeInLeft.duration(210);

  return (
    <MeadowSheet onClose={requestClose} variant="tall">
      <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={8} style={styles.keyboard}>
        <CompanionHero name={props.name} image={visual.source} accentColor={props.accentColor || visual.accentColor} houseLevel={props.houseLevel} openingLine={props.openingLine} />
        <CompanionThreadSwitcher value={state.thread} onChange={selectThread} />
        <View style={styles.contentFrame}>
          <ScrollView
            automaticallyAdjustKeyboardInsets
            contentContainerStyle={styles.scrollContent}
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <Animated.View key={state.thread} entering={entering} exiting={FadeOut.duration(100)}>
              {props.reflectionSaved ? (
                <View accessibilityLiveRegion="polite" style={styles.saved}>
                  <ThemedText style={styles.savedTitle} lightColor={Lantern.auroraTeal} darkColor={Lantern.auroraTeal}>Memory kept</ThemedText>
                  <ThemedText style={styles.savedBody} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>{props.name} will remember that with you.</ThemedText>
                </View>
              ) : state.thread === 'quest' ? (
                <CompanionQuestThread
                  model={quest}
                  reviewItem={reviewItem}
                  onSelectReviewItem={(item) => dispatch({ type: 'review_item', itemId: item?.id ?? null })}
                  onClarify={(item, answer) => {
                    props.onClarifyQuestMatch(item, answer);
                    dispatch({ type: 'review_item', itemId: null });
                  }}
                />
              ) : state.thread === 'insight' ? (
                <CompanionInsightThread insight={props.insight} />
              ) : (
                <CompanionReflectionThread
                  promptId={`companion:${props.creatureId}:reflection`}
                  promptText={props.reflectionText}
                  initialDraft={state.reflectionDraft}
                  onDraftChange={updateReflection}
                />
              )}
            </Animated.View>
          </ScrollView>
        </View>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
        {state.discardOpen ? (
          <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(120)} style={styles.discard}>
            <View style={styles.discardPanel}>
              <ThemedText style={styles.discardTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>Discard this answer?</ThemedText>
              <ThemedText style={styles.discardBody} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>Your reflection has not been saved yet.</ThemedText>
              <View style={styles.discardActions}>
                <CompanionSecondaryAction label="Keep editing" onPress={() => dispatch({ type: 'keep_editing' })} />
                <CompanionSecondaryAction label="Discard" icon="trash" destructive onPress={props.onClose} />
              </View>
            </View>
          </Animated.View>
        ) : null}
      </KeyboardAvoidingView>
    </MeadowSheet>
  );
}

const styles = StyleSheet.create({
  keyboard: { flex: 1, gap: 10, minHeight: 0 },
  contentFrame: { flex: 1, minHeight: 0 },
  scrollContent: { paddingBottom: 12, paddingHorizontal: 4 },
  footer: { backgroundColor: Lantern.ink800, paddingBottom: 2, paddingHorizontal: 4, paddingTop: 10 },
  saved: { alignItems: 'center', gap: 8, justifyContent: 'center', minHeight: 220, paddingHorizontal: 24 },
  savedTitle: { fontSize: 24, fontWeight: '900' },
  savedBody: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  discard: { ...StyleSheet.absoluteFillObject, alignItems: 'center', backgroundColor: 'rgba(12,10,20,0.82)', justifyContent: 'center', zIndex: 10 },
  discardPanel: { backgroundColor: Lantern.ink800, borderCurve: 'continuous', borderRadius: 24, gap: 10, padding: 20, width: '88%' },
  discardTitle: { fontSize: 19, fontWeight: '900' },
  discardBody: { fontSize: 13.5, lineHeight: 20 },
  discardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, paddingTop: 6 },
});
