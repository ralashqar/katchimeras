import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AppState, KeyboardAvoidingView, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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
import { QuestExperienceHost } from './quests/quest-experience-host';
import type { InteractiveQuestExecution, QuestResult } from '@/utils/quests/experiences/types';

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
  activeQuest: { title: string; hint: string; execution?: InteractiveQuestExecution | null; resolvedConfig?: Record<string, unknown>; offerSeed?: string } | null;
  questComplete: boolean;
  questRuntime: QuestRuntimeStatus | null;
  questCaptureFeedback: QuestCaptureFeedback | null;
  submissionItems: QuestSubmissionItem[];
  offer: { id: string; title: string; hint: string } | undefined;
  criteria: Criterion[];
  onAccept: () => void;
  offerCount?: number;
  onCycleOffer?: () => void;
  onCashIn: () => void;
  onSubmitQuest: (item: QuestSubmissionItem) => void;
  onClarifyQuestMatch: (item: QuestSubmissionItem, answer: MemoryQualityScore['centrality'] | 'rejected') => void;
  onQuestAction: () => void;
  recentTriviaQuestionIds?: string[];
  recentWordPuzzleIds?: string[];
  recentSortingItemIds?: string[];
  sortingBestDurationMs?: number | null;
  matchingBestDurationMs?: number | null;
  recentMatchingContentIds?: string[];
  onStartQuestAttempt?: (config: Record<string, unknown>) => string;
  onCancelQuestAttempt?: (attemptId: string) => void;
  onCompleteInteractiveQuest?: (attemptId: string, result: QuestResult) => void;
  insight: CompanionInsight;
  onInsightAction: () => void;
  reflectionText: string;
  initialReflectionDraft?: CompanionReflectionDraft | null;
  onReflectionDraftChange?: (draft: CompanionReflectionDraft | null) => void;
  onReviewReflection: (draft: CompanionReflectionDraft) => void;
  reflectionReviewPending?: boolean;
  memorySaved?: boolean;
};

export function CompanionInteractionSheet(props: CompanionInteractionSheetProps) {
  const [state, dispatch] = useReducer(companionInteractionReducer, {
    initialThread: props.initialThread,
    reflectionDraft: props.initialReflectionDraft,
  }, createCompanionInteractionState);
  const [activeAttemptId, setActiveAttemptId] = useState<string | null>(null);
  const [endAttemptOpen, setEndAttemptOpen] = useState(false);
  const contentRef = useRef<ScrollView>(null);
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

  const resetActiveViewport = useCallback(() => {
    if (!activeAttemptId) return;
    contentRef.current?.scrollTo({ x: 0, y: 0, animated: false });
  }, [activeAttemptId]);

  useEffect(() => {
    if (!activeAttemptId) return;
    const frame = requestAnimationFrame(resetActiveViewport);
    const settled = setTimeout(resetActiveViewport, 180);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settled);
    };
  }, [activeAttemptId, resetActiveViewport]);

  useEffect(() => {
    if (!activeAttemptId) return;
    let frame: number | null = null;
    let settled: ReturnType<typeof setTimeout> | null = null;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      frame = requestAnimationFrame(resetActiveViewport);
      settled = setTimeout(resetActiveViewport, 220);
    });
    return () => {
      subscription.remove();
      if (frame !== null) cancelAnimationFrame(frame);
      if (settled !== null) clearTimeout(settled);
    };
  }, [activeAttemptId, resetActiveViewport]);

  const requestClose = () => {
    if (activeAttemptId) setEndAttemptOpen(true);
    else if (state.thread === 'reflection' && companionReflectionIsDirty(state)) dispatch({ type: 'request_discard' });
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
  const interactiveExecution = props.activeQuest?.execution ?? null;
  const footer = props.memorySaved
    ? null
    : state.thread === 'quest' && interactiveExecution
      ? null
    : state.thread === 'quest' && quest.primaryAction
      ? reviewItem ? null : <View style={styles.footerStack}><CompanionPrimaryAction label={quest.primaryAction.label} icon={quest.primaryAction.icon} onPress={runPrimary} disabled={quest.mode === 'analysing'} />{quest.mode === 'offer' && (props.offerCount ?? 0) > 1 && props.onCycleOffer ? <CompanionSecondaryAction label="Try another quest" icon="arrow.counterclockwise" onPress={props.onCycleOffer} /> : null}</View>
      : state.thread === 'insight' && props.insight.action
        ? <CompanionPrimaryAction label={props.insight.action.label} icon={props.insight.action.icon} onPress={props.onInsightAction} />
        : state.thread === 'reflection' && state.reflectionDraft
          ? <CompanionPrimaryAction label={props.reflectionReviewPending ? 'Preparing review…' : 'Review memory'} icon="arrow.right" disabled={props.reflectionReviewPending} onPress={() => props.onReviewReflection(state.reflectionDraft!)} />
          : null;
  const entering = reduceMotion ? FadeIn.duration(100) : state.direction > 0 ? FadeInRight.duration(210) : FadeInLeft.duration(210);

  return (
    <Modal animationType="none" navigationBarTranslucent onRequestClose={requestClose} presentationStyle="overFullScreen" statusBarTranslucent transparent visible>
      <GestureHandlerRootView style={styles.modalRoot}>
        <MeadowSheet onClose={requestClose} showClose={!activeAttemptId} variant={activeAttemptId ? 'full' : 'tall'}>
      <KeyboardAvoidingView behavior={!activeAttemptId && process.env.EXPO_OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={8} style={styles.keyboard}>
        {!activeAttemptId ? <CompanionHero key="companion-hero" name={props.name} image={visual.source} accentColor={props.accentColor || visual.accentColor} houseLevel={props.houseLevel} openingLine={props.openingLine} /> : null}
        {!activeAttemptId ? <CompanionThreadSwitcher key="thread-switcher" value={state.thread} onChange={selectThread} /> : null}
        <View key="interaction-content" style={styles.contentFrame}>
          <ScrollView
            ref={contentRef}
            automaticallyAdjustContentInsets={!activeAttemptId}
            automaticallyAdjustKeyboardInsets={!activeAttemptId}
            bounces={!activeAttemptId}
            contentContainerStyle={[styles.scrollContent, activeAttemptId && styles.activeScrollContent]}
            contentInsetAdjustmentBehavior={activeAttemptId ? 'never' : 'automatic'}
            contentOffset={activeAttemptId ? { x: 0, y: 0 } : undefined}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={activeAttemptId ? resetActiveViewport : undefined}
            onLayout={activeAttemptId ? resetActiveViewport : undefined}
            overScrollMode={activeAttemptId ? 'never' : 'auto'}
            scrollEnabled={!activeAttemptId}
            showsVerticalScrollIndicator={false}>
            <Animated.View key={state.thread} entering={entering} exiting={FadeOut.duration(100)} style={activeAttemptId ? styles.activeExperience : undefined}>
              {props.memorySaved ? (
                <View accessibilityLiveRegion="polite" style={styles.saved}>
                  <ThemedText style={styles.savedTitle} lightColor={Lantern.auroraTeal} darkColor={Lantern.auroraTeal}>Memory kept</ThemedText>
                  <ThemedText style={styles.savedBody} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>{props.name} will remember that with you.</ThemedText>
                </View>
              ) : state.thread === 'quest' && interactiveExecution && props.onStartQuestAttempt && props.onCancelQuestAttempt && props.onCompleteInteractiveQuest ? (
                <QuestExperienceHost
                  execution={interactiveExecution}
                  config={props.activeQuest?.resolvedConfig ?? {}}
                  seed={props.activeQuest?.offerSeed ?? `${props.creatureId}:${props.activeQuest?.title}`}
                  recentQuestionIds={props.recentTriviaQuestionIds ?? []}
                  recentPuzzleIds={props.recentWordPuzzleIds ?? []}
                  recentSortingItemIds={props.recentSortingItemIds ?? []}
                  sortingBestDurationMs={props.sortingBestDurationMs ?? null}
                  matchingBestDurationMs={props.matchingBestDurationMs ?? null}
                  recentMatchingContentIds={props.recentMatchingContentIds ?? []}
                  onAttemptStart={props.onStartQuestAttempt}
                  onAttemptCancel={props.onCancelQuestAttempt}
                  onComplete={(attemptId, result) => {
                    props.onCompleteInteractiveQuest?.(attemptId, result);
                    setActiveAttemptId(null);
                    selectThread('insight');
                  }}
                  onRunningChange={(running, attemptId) => setActiveAttemptId(running ? attemptId ?? null : null)}
                />
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
        {endAttemptOpen ? (
          <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(120)} style={styles.discard}>
            <View style={styles.discardPanel}>
              <ThemedText style={styles.discardTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>End this attempt?</ThemedText>
              <ThemedText style={styles.discardBody} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>This run will be cancelled, but the quest will stay active so you can retry.</ThemedText>
              <View style={styles.discardActions}>
                <CompanionSecondaryAction label="Keep playing" onPress={() => setEndAttemptOpen(false)} />
                <CompanionSecondaryAction label="End attempt" icon="xmark" destructive onPress={() => { if (activeAttemptId) props.onCancelQuestAttempt?.(activeAttemptId); setActiveAttemptId(null); props.onClose(); }} />
              </View>
            </View>
          </Animated.View>
        ) : null}
      </KeyboardAvoidingView>
        </MeadowSheet>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1 },
  keyboard: { flex: 1, gap: 10, minHeight: 0 },
  contentFrame: { flex: 1, minHeight: 0 },
  scrollContent: { paddingBottom: 12, paddingHorizontal: 4 },
  activeScrollContent: { flexGrow: 1, paddingBottom: 0, paddingHorizontal: 0 },
  activeExperience: { flex: 1 },
  footer: { backgroundColor: 'transparent', paddingBottom: 2, paddingHorizontal: 4, paddingTop: 10 },
  footerStack: { gap: 8 },
  saved: { alignItems: 'center', gap: 8, justifyContent: 'center', minHeight: 220, paddingHorizontal: 24 },
  savedTitle: { fontSize: 24, fontWeight: '900' },
  savedBody: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  discard: { ...StyleSheet.absoluteFillObject, alignItems: 'center', backgroundColor: 'rgba(12,10,20,0.82)', justifyContent: 'center', zIndex: 10 },
  discardPanel: { backgroundColor: Lantern.ink800, borderCurve: 'continuous', borderRadius: 24, gap: 10, padding: 20, width: '88%' },
  discardTitle: { fontSize: 19, fontWeight: '900' },
  discardBody: { fontSize: 13.5, lineHeight: 20 },
  discardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, paddingTop: 6 },
});
