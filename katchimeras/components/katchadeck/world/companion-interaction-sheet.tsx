import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AppState, Keyboard, KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInLeft, FadeInRight, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { KatchaDialog } from '@/components/katchadeck/ui/katcha-dialog';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';
import type { HomeVisualKey, MemoryQualityScore } from '@/types/home';
import type {
  CompanionInsight,
  CompanionQuestOfferViewModel,
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
  companionQuestUsesFullBleed,
  companionReflectionIsDirty,
  companionViewportResetKey,
  createCompanionInteractionState,
} from '@/utils/companion-interaction';
import { CompanionHero } from './companion-hero';
import { CompanionInsightThread } from './companion-insight-thread';
import { CompanionPrimaryAction, CompanionSecondaryAction } from './companion-interaction-primitives';
import { CompanionQuestChoices, CompanionQuestThread } from './companion-quest-thread';
import { CompanionReflectionReview, CompanionReflectionThread } from './companion-reflection-thread';
import { CompanionThreadSwitcher } from './companion-thread-switcher';
import { QuestExperienceHost } from './quests/quest-experience-host';
import type { InteractiveQuestExecution, QuestResult } from '@/utils/quests/experiences/types';
import type { CompanionBondProgress } from '@/utils/companion-bond';
import { CompanionBondMeter } from './companion-bond-meter';
import { CompanionSkinsThread } from './companion-skins-thread';
import type { KatchimeraFamilyId, KatchimeraSkinId } from '@/types/katchimera';
import type { KingdomSkinOption } from '@/utils/katchimera-wardrobe';
import { CompanionDiscoveryThread } from './companion-discovery-thread';
import { CompanionJourneyDiscoveryThread } from './companion-journey-thread';
import type {
  CompanionDiscoveryPromptDefinition,
  KatchimeraRoleDefinition,
} from '@/constants/katchimera-roles';
import type { CompanionDiscoveryAnswer } from '@/utils/companion-discovery';
import type {
  CompanionJourneyConversationNode,
  CompanionJourneyDefinition,
  CompanionJourneyGoalStatus,
} from '@/constants/companion-journeys';
import type {
  CompanionGoalJourneyProgress,
  CompanionJourneyConversationSession,
  CompanionJourneyGoal,
} from '@/utils/companion-journey';
import {
  CompanionQuickGoalPicker,
  CompanionQuickGoalsPanel,
  QuickGoalCompletionPrompt,
} from '@/components/katchadeck/goals/companion-quick-goals';
import type {
  CompanionQuickGoal,
  CompanionQuickGoalCadence,
  CompanionQuickGoalCompletion,
  CompanionQuickGoalState,
} from '@/utils/companion-quick-goals';

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
  offers: CompanionQuestOfferViewModel[];
  selectedOfferId: string | null;
  onSelectOffer: (offerId: string) => void;
  criteria: Criterion[];
  onAccept: (offerId?: string) => void;
  onCashIn: () => void;
  onSubmitQuest: (item: QuestSubmissionItem) => void;
  onClarifyQuestMatch: (item: QuestSubmissionItem, answer: MemoryQualityScore['centrality'] | 'rejected') => void;
  onQuestAction: () => void;
  recentTriviaQuestionIds?: string[];
  recentWordPuzzleIds?: string[];
  recentWordPathPuzzleIds?: string[];
  recentSortingItemIds?: string[];
  sortingBestDurationMs?: number | null;
  matchingBestDurationMs?: number | null;
  recentMatchingContentIds?: string[];
  recentMergeOrderIds?: string[];
  mergeBest?: { movesUsed: number; durationMs: number } | null;
  blockJamBest?: { movesUsed: number; durationMs: number } | null;
  onStartQuestAttempt?: (config: Record<string, unknown>) => string;
  onCancelQuestAttempt?: (attemptId: string) => void;
  onCompleteInteractiveQuest?: (attemptId: string, result: QuestResult) => void;
  insight: CompanionInsight;
  onInsightAction: () => void;
  reflectionText: string;
  initialReflectionDraft?: CompanionReflectionDraft | null;
  onReflectionDraftChange?: (draft: CompanionReflectionDraft | null) => void;
  onSaveReflection: (draft: CompanionReflectionDraft) => void;
  memorySaved?: boolean;
  bondProgress: CompanionBondProgress;
  onExperienceActiveChange?: (active: boolean) => void;
  skins: readonly KingdomSkinOption[];
  equippedSkinId: KatchimeraSkinId | null;
  onEquipSkin: (skinId: KatchimeraSkinId) => void;
  role: KatchimeraRoleDefinition | null;
  discoveryPrompts: readonly CompanionDiscoveryPromptDefinition[];
  discoveryAnswers: readonly CompanionDiscoveryAnswer[];
  onAnswerDiscovery: (prompt: CompanionDiscoveryPromptDefinition, value: string) => void;
  onRemoveDiscoveryAnswer: (promptId: string) => void;
  onSetDiscoveryGoalStatus: (promptId: string, status: 'active' | 'completed' | 'paused') => void;
  journeyDefinition: CompanionJourneyDefinition | null;
  journeyGoals: readonly CompanionJourneyGoal[];
  journeyConversation: CompanionJourneyConversationSession | null;
  journeyNode: CompanionJourneyConversationNode | null;
  journeyProgress: CompanionGoalJourneyProgress | null;
  journeyMomentLoggedToday: boolean;
  questAdvancesJourneyGoal: boolean;
  onStartJourneyConversation: () => void;
  onAnswerJourneyConversation: (sessionId: string, value: string) => void;
  onLogJourneyMoment: (kindId: string, note?: string) => void;
  onSetJourneyGoalStatus: (goalId: string, status: CompanionJourneyGoalStatus) => void;
  onSetPrimaryJourneyGoal: (goalId: string) => void;
  familyId: KatchimeraFamilyId;
  quickGoalsEnabled: boolean;
  quickGoalDayId: string;
  quickGoalState: CompanionQuickGoalState;
  onAddQuickGoalTemplate: (templateId: string) => { added: boolean; reason: string | null };
  onAddCustomQuickGoal: (
    familyId: KatchimeraFamilyId,
    title: string,
    cadence: CompanionQuickGoalCadence
  ) => { added: boolean; reason: string | null };
  onCompleteQuickGoal: (goalId: string) => CompanionQuickGoalCompletion | null;
  onUndoQuickGoal: (goalId: string) => boolean;
  onRememberQuickGoal: (completion: CompanionQuickGoalCompletion, goal: CompanionQuickGoal) => void;
  quickGoalSuggestionIds: readonly string[];
  onAddQuickGoalSuggestions: (templateIds: readonly string[]) => void;
  onDismissQuickGoalSuggestions: () => void;
};

export function CompanionInteractionSheet(props: CompanionInteractionSheetProps) {
  const onExperienceActiveChange = props.onExperienceActiveChange;
  const [state, dispatch] = useReducer(companionInteractionReducer, {
    initialThread: props.initialThread,
    reflectionDraft: props.initialReflectionDraft,
  }, createCompanionInteractionState);
  const [activeAttemptId, setActiveAttemptId] = useState<string | null>(null);
  const [endAttemptOpen, setEndAttemptOpen] = useState(false);
  const [experienceInstance, setExperienceInstance] = useState(0);
  const [recentQuickGoal, setRecentQuickGoal] = useState<{
    completion: CompanionQuickGoalCompletion;
    goal: CompanionQuickGoal;
  } | null>(null);
  const [quickGoalPickerOpen, setQuickGoalPickerOpen] = useState(false);
  const contentRef = useRef<ScrollView>(null);
  const reduceMotion = useReducedMotion();
  const visual = getCreatureVisual(props.visualKey);
  const selectedOffer = props.offers.find((offer) => offer.id === props.selectedOfferId) ?? props.offers[0];
  const quest = useMemo(() => buildCompanionQuestViewModel({
    activeQuest: props.activeQuest,
    offer: selectedOffer,
    runtime: props.questRuntime,
    questComplete: props.questComplete,
    captureFeedback: props.questCaptureFeedback,
    items: props.submissionItems,
    criteria: props.criteria,
  }), [props.activeQuest, props.criteria, props.questCaptureFeedback, props.questComplete, props.questRuntime, props.submissionItems, selectedOffer]);
  const reviewItem = props.submissionItems.find((item) => item.id === state.reviewItemId) ?? null;
  const onReflectionDraftChange = props.onReflectionDraftChange;
  const viewportResetKey = `${companionViewportResetKey({
    creatureId: props.creatureId,
    thread: state.thread,
    questMode: quest.mode,
    activeQuestTitle: props.activeQuest?.title,
    journeyNodeId: props.journeyNode?.id,
    reviewItemId: state.reviewItemId,
    reflectionReviewOpen: state.reflectionReviewOpen,
    activeAttemptId,
    memorySaved: props.memorySaved,
  })}:quick-goal-picker:${quickGoalPickerOpen}`;

  const resetViewport = useCallback(() => {
    contentRef.current?.scrollTo({ x: 0, y: 0, animated: false });
  }, []);

  useEffect(() => {
    Keyboard.dismiss();
    resetViewport();
    const frame = requestAnimationFrame(resetViewport);
    // KeyboardAvoidingView and the animated thread swap settle on separate
    // native layout passes. Reset once more after both have finished so a
    // longer previous thread cannot strand a shorter quest above the viewport.
    const settled = setTimeout(resetViewport, 260);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settled);
    };
  }, [resetViewport, viewportResetKey]);

  useEffect(() => {
    if (!activeAttemptId) return;
    let frame: number | null = null;
    let settled: ReturnType<typeof setTimeout> | null = null;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      frame = requestAnimationFrame(resetViewport);
      settled = setTimeout(resetViewport, 220);
    });
    return () => {
      subscription.remove();
      if (frame !== null) cancelAnimationFrame(frame);
      if (settled !== null) clearTimeout(settled);
    };
  }, [activeAttemptId, resetViewport]);

  const requestClose = () => {
    if (quickGoalPickerOpen) setQuickGoalPickerOpen(false);
    else if (activeAttemptId) setEndAttemptOpen(true);
    else if (state.thread === 'reflection' && companionReflectionIsDirty(state)) dispatch({ type: 'request_discard' });
    else props.onClose();
  };
  const selectThread = (thread: CompanionThread) => {
    Keyboard.dismiss();
    resetViewport();
    dispatch({ type: 'select_thread', thread });
    props.onSelectThread?.(thread);
  };
  const updateReflection = useCallback((draft: CompanionReflectionDraft | null) => {
    dispatch({ type: 'set_reflection_draft', draft });
    onReflectionDraftChange?.(draft);
  }, [onReflectionDraftChange]);
  const reviewReflection = () => {
    Keyboard.dismiss();
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    dispatch({ type: 'review_reflection' });
  };
  const runPrimary = () => {
    const action = quest.primaryAction;
    if (!action) return;
    if (process.env.EXPO_OS === 'ios') {
      if (action.kind === 'accept') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      else void Haptics.selectionAsync();
    }
    if (action.kind === 'accept') props.onAccept(selectedOffer?.id);
    else if (action.kind === 'quest_action') props.onQuestAction();
    else if (action.kind === 'review_match') dispatch({ type: 'review_item', itemId: action.item.id });
    else if (action.kind === 'submit') props.onSubmitQuest(action.item);
    else props.onCashIn();
  };
  const interactiveExecution = props.activeQuest?.execution ?? null;
  const completeQuickGoal = (goalId: string) => {
    const goal = props.quickGoalState.goals.find((candidate) => candidate.id === goalId);
    const completion = props.onCompleteQuickGoal(goalId);
    if (goal && completion) setRecentQuickGoal({ goal, completion });
    return completion;
  };
  const undoQuickGoal = (goalId: string) => {
    const undone = props.onUndoQuickGoal(goalId);
    if (undone) setRecentQuickGoal((current) => current?.goal.id === goalId ? null : current);
    return undone;
  };
  const quickGoalPanel = props.quickGoalsEnabled ? (
    <View style={styles.quickGoalStack}>
      <CompanionQuickGoalsPanel
        dayId={props.quickGoalDayId}
        familyId={props.familyId}
        onCompleteGoal={completeQuickGoal}
        onOpen={() => {
          if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
          setQuickGoalPickerOpen(true);
        }}
        onUndoGoal={undoQuickGoal}
        state={props.quickGoalState}
      />
      <QuickGoalCompletionPrompt
        completion={recentQuickGoal?.completion ?? null}
        goal={recentQuickGoal?.goal ?? null}
        onRemember={(completion, goal) => {
          setRecentQuickGoal(null);
          props.onRememberQuickGoal(completion, goal);
        }}
        onUndo={undoQuickGoal}
      />
    </View>
  ) : null;
  const immersiveExperience = Boolean(activeAttemptId && companionQuestUsesFullBleed(interactiveExecution));
  useEffect(() => {
    onExperienceActiveChange?.(Boolean(activeAttemptId));
    return () => onExperienceActiveChange?.(false);
  }, [activeAttemptId, onExperienceActiveChange]);
  const actionFooter = props.memorySaved
    ? null
    : state.thread === 'quest' && interactiveExecution
      ? null
    : state.thread === 'quest' && quest.mode === 'offer'
      ? null
    : state.thread === 'quest' && quest.primaryAction
      ? reviewItem ? null : <View style={styles.footerStack}><CompanionPrimaryAction label={quest.mode === 'offer' ? 'Accept selected quest' : quest.primaryAction.label} icon={quest.primaryAction.icon} onPress={runPrimary} disabled={quest.mode === 'analysing'} /></View>
      : state.thread === 'insight' && props.insight.action
        ? <CompanionPrimaryAction label={props.insight.action.label} icon={props.insight.action.icon} onPress={props.onInsightAction} />
        : state.thread === 'reflection' && state.reflectionDraft
          ? state.reflectionReviewOpen
            ? (
                <View style={styles.footerStack}>
                  <CompanionSecondaryAction label="Edit reflection" icon="pencil" onPress={() => dispatch({ type: 'edit_reflection' })} />
                  <CompanionPrimaryAction label="Keep reflection" icon="sparkles" onPress={() => props.onSaveReflection(state.reflectionDraft!)} />
                </View>
              )
            : <CompanionPrimaryAction label="Review reflection" icon="arrow.right" onPress={reviewReflection} />
      : null;
  const footer = !activeAttemptId && !props.memorySaved ? (
    <View style={styles.footerStack}>
      <CompanionBondMeter name={props.name} progress={props.bondProgress} />
      {actionFooter}
    </View>
  ) : actionFooter;
  const visibleFooter = quickGoalPickerOpen ? null : footer;
  const entering = reduceMotion ? FadeIn.duration(100) : state.direction > 0 ? FadeInRight.duration(210) : FadeInLeft.duration(210);

  return (<>
        <KatchaSheet fullBleed={immersiveExperience} onRequestClose={requestClose} showClose={!activeAttemptId} surface={activeAttemptId ? 'night' : 'parchment'} size={activeAttemptId ? 'full' : 'tall'}>
      <KeyboardAvoidingView behavior={!activeAttemptId && process.env.EXPO_OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={8} style={styles.keyboard}>
        {!activeAttemptId && !quickGoalPickerOpen ? (
          <CompanionHero key="companion-hero" name={props.name} image={visual.source} houseLevel={props.houseLevel} openingLine={props.openingLine}>
            <CompanionThreadSwitcher value={state.thread} onChange={selectThread} showSkins={props.skins.length > 1} />
          </CompanionHero>
        ) : null}
        <View key="interaction-content" style={styles.contentFrame}>
          <ScrollView
            key={viewportResetKey}
            ref={contentRef}
            automaticallyAdjustContentInsets={false}
            automaticallyAdjustKeyboardInsets={false}
            bounces={!activeAttemptId}
            contentContainerStyle={[styles.scrollContent, activeAttemptId && styles.activeScrollContent]}
            contentInsetAdjustmentBehavior="never"
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={activeAttemptId ? resetViewport : undefined}
            onLayout={activeAttemptId ? resetViewport : undefined}
            overScrollMode={activeAttemptId ? 'never' : 'auto'}
            scrollEnabled={!activeAttemptId}
            showsVerticalScrollIndicator={false}>
            <Animated.View key={state.thread} entering={entering} exiting={FadeOut.duration(100)} style={activeAttemptId ? styles.activeExperience : undefined}>
              {quickGoalPickerOpen ? (
                <CompanionQuickGoalPicker
                  dayId={props.quickGoalDayId}
                  familyId={props.familyId}
                  onAddCustom={props.onAddCustomQuickGoal}
                  onAddTemplate={props.onAddQuickGoalTemplate}
                  onBack={() => setQuickGoalPickerOpen(false)}
                  state={props.quickGoalState}
                />
              ) : props.memorySaved ? (
                <View accessibilityLiveRegion="polite" style={styles.saved}>
                  <ThemedText style={styles.savedTitle} lightColor={Lantern.auroraTeal} darkColor={Lantern.auroraTeal}>Memory kept</ThemedText>
                  <ThemedText style={styles.savedBody} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>{props.name} will remember that with you.</ThemedText>
                </View>
              ) : state.thread === 'quest' && interactiveExecution && props.onStartQuestAttempt && props.onCancelQuestAttempt && props.onCompleteInteractiveQuest ? (
                <View style={!activeAttemptId ? styles.gamePreviewFrame : styles.activeExperience}>
                <QuestExperienceHost
                  key={experienceInstance}
                  execution={interactiveExecution}
                  config={props.activeQuest?.resolvedConfig ?? {}}
                  seed={props.activeQuest?.offerSeed ?? `${props.creatureId}:${props.activeQuest?.title}`}
                  recentQuestionIds={props.recentTriviaQuestionIds ?? []}
                  recentPuzzleIds={props.recentWordPuzzleIds ?? []}
                  recentWordPathPuzzleIds={props.recentWordPathPuzzleIds ?? []}
                  recentSortingItemIds={props.recentSortingItemIds ?? []}
                  sortingBestDurationMs={props.sortingBestDurationMs ?? null}
                  matchingBestDurationMs={props.matchingBestDurationMs ?? null}
                  recentMatchingContentIds={props.recentMatchingContentIds ?? []}
                  recentMergeOrderIds={props.recentMergeOrderIds ?? []}
                  mergeBest={props.mergeBest ?? null}
                  blockJamBest={props.blockJamBest ?? null}
                  onAttemptStart={props.onStartQuestAttempt}
                  onAttemptCancel={props.onCancelQuestAttempt}
                  onComplete={(attemptId, result) => {
                    props.onCompleteInteractiveQuest?.(attemptId, result);
                    setActiveAttemptId(null);
                    selectThread('insight');
                  }}
                  onRequestExit={() => setEndAttemptOpen(true)}
                  onRunningChange={(running, attemptId) => setActiveAttemptId(running ? attemptId ?? null : null)}
                />
                </View>
              ) : state.thread === 'quest' && !props.activeQuest && props.offers.length ? (
                <View>
                  {quickGoalPanel}
                  <CompanionQuestChoices
                    offers={props.offers}
                    selectedId={selectedOffer?.id ?? null}
                    onSelect={props.onSelectOffer}
                    onAccept={(offerId) => {
                      if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      props.onAccept(offerId);
                    }}
                  />
                </View>
              ) : state.thread === 'quest' ? (
                <View>
                  {quickGoalPanel}
                  <CompanionQuestThread
                    model={quest}
                    reviewItem={reviewItem}
                    onSelectReviewItem={(item) => dispatch({ type: 'review_item', itemId: item?.id ?? null })}
                    onClarify={(item, answer) => {
                      props.onClarifyQuestMatch(item, answer);
                      dispatch({ type: 'review_item', itemId: null });
                    }}
                  />
                </View>
              ) : state.thread === 'discovery' ? (
                props.journeyDefinition ? (
                  <CompanionJourneyDiscoveryThread
                    companionName={props.name}
                    conversation={props.journeyConversation}
                    definition={props.journeyDefinition}
                    goals={props.journeyGoals}
                    momentLoggedToday={props.journeyMomentLoggedToday}
                    node={props.journeyNode}
                    onAnswer={props.onAnswerJourneyConversation}
                    onLogMoment={props.onLogJourneyMoment}
                    onSetGoalStatus={props.onSetJourneyGoalStatus}
                    onSetPrimaryGoal={props.onSetPrimaryJourneyGoal}
                    onStart={props.onStartJourneyConversation}
                    progress={props.journeyProgress}
                    quickGoalSuggestionIds={props.quickGoalSuggestionIds}
                    onAddQuickGoalSuggestions={props.onAddQuickGoalSuggestions}
                    onDismissQuickGoalSuggestions={props.onDismissQuickGoalSuggestions}
                  />
                ) : (
                  <CompanionDiscoveryThread
                    answers={props.discoveryAnswers}
                    companionName={props.name}
                    onAnswer={props.onAnswerDiscovery}
                    onRemove={props.onRemoveDiscoveryAnswer}
                    onSetGoalStatus={props.onSetDiscoveryGoalStatus}
                    prompts={props.discoveryPrompts}
                    role={props.role}
                  />
                )
              ) : state.thread === 'insight' ? (
                <CompanionInsightThread insight={props.insight} />
              ) : state.thread === 'skins' ? (
                <CompanionSkinsThread
                  companionName={props.name}
                  equippedSkinId={props.equippedSkinId}
                  onEquip={props.onEquipSkin}
                  skins={props.skins}
                />
              ) : state.reflectionReviewOpen && state.reflectionDraft ? (
                <CompanionReflectionReview
                  draft={state.reflectionDraft}
                  promptText={props.reflectionText}
                />
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
        {visibleFooter ? <View style={styles.footer}>{visibleFooter}</View> : null}
        <KatchaDialog
          body="Your current game progress will be lost. You can retry the quest from here."
          cancelLabel="Keep playing"
          confirmLabel="Exit game"
          onCancel={() => setEndAttemptOpen(false)}
          onConfirm={() => {
            const attemptId = activeAttemptId;
            setEndAttemptOpen(false);
            setActiveAttemptId(null);
            setExperienceInstance((current) => current + 1);
            if (attemptId) props.onCancelQuestAttempt?.(attemptId);
          }}
          open={endAttemptOpen}
          portal={false}
          surface="night"
          title="Exit this game?"
          tone="destructive"
        />
      </KeyboardAvoidingView>
        </KatchaSheet>
        <KatchaDialog body="Your reflection has not been saved yet." cancelLabel="Keep editing" confirmLabel="Discard" onCancel={() => dispatch({ type: 'keep_editing' })} onConfirm={props.onClose} open={state.discardOpen} title="Discard this answer?" tone="destructive" />
  </>);
}

const styles = StyleSheet.create({
  keyboard: { flex: 1, gap: 8, minHeight: 0 },
  contentFrame: { flex: 1, minHeight: 0 },
  scrollContent: { paddingBottom: 12, paddingHorizontal: 4 },
  activeScrollContent: { flexGrow: 1, paddingBottom: 0, paddingHorizontal: 0 },
  activeExperience: { flex: 1 },
  gamePreviewFrame: { backgroundColor: Lantern.ink900, borderCurve: 'continuous', borderRadius: 20, minHeight: 320, padding: 14 },
  quickGoalStack: { gap: 8, marginBottom: 12 },
  footer: { backgroundColor: 'transparent', paddingBottom: 2, paddingHorizontal: 2, paddingTop: 7 },
  footerStack: { gap: 7 },
  saved: { alignItems: 'center', gap: 8, justifyContent: 'center', minHeight: 220, paddingHorizontal: 24 },
  savedTitle: { fontSize: 24, fontWeight: '900' },
  savedBody: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
});
