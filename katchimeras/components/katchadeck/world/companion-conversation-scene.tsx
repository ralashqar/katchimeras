import { CompanionNarrativePanel } from './companion-narrative-panel';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { DailyHabitOffer } from './companion-life-actions';
import { lifeHabitById } from '@/constants/companion-life-content';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import { ActivityIndicator, Pressable, ScrollView, useWindowDimensions, View, type View as ViewType } from 'react-native';
import Animated, { FadeInUp, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchaUI } from '@/constants/katcha-ui';
import { companionQuickGoalTemplateById } from '@/constants/companion-quick-goals';
import { katchimeraSkinById } from '@/constants/katchimera-skins';
import type {
  ConversationDefinition,
  ConversationNode,
  ConversationOutcomeDestination,
  ConversationOutcomePresentation,
  ConversationSession,
} from '@/types/companion-conversation';
import type { KatchimeraSkinId } from '@/types/katchimera';
import { conversationGameQuestion, conversationNode } from '@/utils/companion-conversation';
import { getCreatureVisual } from '@/game/days';
import type { KingdomSkinOption } from '@/utils/katchimera-wardrobe';
import type { CompanionMemory } from '@/utils/companion-content';
import type { CompanionBondProgress } from '@/utils/companion-bond';
import type { CompanionConversationPresentationPhase } from '@/features/companion/use-companion-conversation-flow';
import {
  companionChoiceColumnCount,
  COMPANION_PANEL_LAYOUT_DURATION_MS,
  estimatedCompanionChoiceContentHeight,
  useCompanionAdaptivePanel,
} from '@/hooks/use-companion-adaptive-panel';
import { CompanionChoiceList } from './companion-choice-list';
import type { CompanionMergeRequest } from './companion-merge-request-tray';
import { MossproutJourneyRequestPanel } from './mossprout-journey-request-panel';
import { KatchimeraPageHeader } from './katchimera-page-header';

export function conversationSpeechLine(
  session: ConversationSession,
  definition: ConversationDefinition
): string {
  if (session.outcomePresentation) {
    const outcome = session.outcomePresentation;
    if (outcome.kind === 'quest') return `Quest started: ${outcome.title}.`;
    if (outcome.kind === 'task') return `Done — ${outcome.title} is on your goals list.`;
    if (outcome.kind === 'focus' || outcome.kind === 'goal') return `Done — ${outcome.title} is ready in your goals.`;
    if (outcome.kind === 'insight') return `I’ve added ${outcome.title} to what I know about you.`;
    return `I’ll remember: ${outcome.title}`;
  }
  if (session.pendingReply !== undefined) return session.pendingReply;
  if (session.status === 'completed' && session.lastReply) return session.lastReply;
  const node = conversationNode(definition, session.currentNodeId);
  if (!node) return 'We can stay here quietly for a moment.';
  if (node.kind === 'choice' || node.kind === 'poll') return conversationPrompt(node.prompt, definition, session);
  if (node.kind === 'profile_game' || node.kind === 'insight_game') {
    const question = conversationGameQuestion(node, session);
    const priorOptionId = session.turns.at(-1)?.optionId;
    return (priorOptionId ? question?.promptByPriorOptionId?.[priorOptionId] : null) ?? question?.prompt ?? node.title;
  }
  if (node.kind === 'form_reveal') {
    const name = katchimeraSkinById.get(session.formResult?.topFormId ?? session.formId)?.displayName ?? 'this form';
    return `I think ${name} is your closest match right now.`;
  }
  if (node.kind === 'insight_reveal') return session.insightResult?.reflection ?? node.title;
  if (node.kind === 'memory_proposal' || node.kind === 'goal_proposal' || node.kind === 'quick_goal_proposal' || node.kind === 'journal_handoff' || node.kind === 'quest_handoff') return node.prompt;
  return node.message;
}

export function CompanionConversationScene({
  bondIconTargetRef,
  bondProgress,
  bondRewardPulseKey = 0,
  definition,
  developerContent,
  flowPhase,
  name,
  onAdvance,
  onAnswer,
  onClose,
  onCompletedExit,
  onMemoryDecision,
  onGoalDecision,
  onInsightDecision,
  onQuickGoalDecision,
  onJournalHandoff,
  onQuestHandoff,
  hasActiveFocus,
  journeyTaskHandoff = false,
  journeyTaskRequests = [],
  journeyTaskTitle,
  storyFlow = false,
  storyFinale = false,
  session,
  skins,
  questOffer,
  requiresManualAdvance,
  journalMergeEnergyPreview,
  navigationLocked = false,
}: {
  bondIconTargetRef?: RefObject<ViewType | null>;
  bondProgress: CompanionBondProgress;
  bondRewardPulseKey?: number;
  definition: ConversationDefinition;
  developerContent?: ReactNode;
  flowPhase: CompanionConversationPresentationPhase;
  name: string;
  onAdvance: () => void;
  onAnswer: (optionId: string) => void;
  onClose: () => void;
  onCompletedExit: () => void;
  onContinue: () => void;
  onEquipForm: (formId: KatchimeraSkinId) => void;
  onMemoryDecision: (remember: boolean, summary: string) => void;
  onGoalDecision: (selectedTemplateIds: readonly string[] | null, node: Extract<ConversationNode, { kind: 'goal_proposal' }>) => void;
  onInsightDecision: (accept: boolean, node: Extract<ConversationNode, { kind: 'insight_reveal' }>) => void;
  onKeepTalking: (poolId?: string) => void;
  onDismissOutcome: () => void;
  onOpenOutcomeDestination: (destination: ConversationOutcomeDestination) => void;
  onQuickGoalDecision: (accept: boolean, node: Extract<ConversationNode, { kind: 'quick_goal_proposal' }>) => void;
  onJournalHandoff: (open: boolean, node: Extract<ConversationNode, { kind: 'journal_handoff' }>) => void;
  onQuestHandoff: (accept: boolean, node: Extract<ConversationNode, { kind: 'quest_handoff' }>) => void;
  hasActiveFocus: boolean;
  journeyTaskHandoff?: boolean;
  journeyTaskRequests?: readonly CompanionMergeRequest[];
  journeyTaskTitle?: string;
  memories: readonly CompanionMemory[];
  onUpdateMemory: (input: { memoryId: string; status: 'confirmed' | 'rejected' | 'forgotten'; summary?: string }) => void;
  onStoryComplete?: () => void;
  storyFlow?: boolean;
  storyFinale?: boolean;
  session: ConversationSession;
  skins: readonly KingdomSkinOption[];
  questOffer: { id: string; title: string; hint: string } | null;
  requiresManualAdvance: boolean;
  journalMergeEnergyPreview: number;
  navigationLocked?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const node = conversationNode(definition, session.currentNodeId);
  const journeyNarrative = definition.purpose === 'journey' && definition.format === 'narrative';
  const journeyRequestHandoffVisible = !session.outcomePresentation
    && session.pendingReply === undefined
    && !session.preview
    && journeyNarrative
    && node?.kind === 'end'
    && journeyTaskHandoff;
  const haptic = () => {
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
  };
  const answer = (optionId: string) => { haptic(); onAnswer(optionId); };
  const progress = conversationProgress(definition, session);
  const showConversationProgress = !session.outcomePresentation
    && session.status !== 'completed'
    && (node?.kind === 'choice' || node?.kind === 'poll' || node?.kind === 'profile_game' || node?.kind === 'insight_game' || node?.kind === 'journal_handoff');
  const activeGameQuestion = node?.kind === 'profile_game' || node?.kind === 'insight_game'
    ? conversationGameQuestion(node, session)
    : null;
  const visibleOptionCount = node?.kind === 'choice' || node?.kind === 'poll'
    ? node.options.length
    : node?.kind === 'profile_game' || node?.kind === 'insight_game'
      ? activeGameQuestion?.options.length ?? 0
      : 0;
  const estimatedContentHeight = journeyRequestHandoffVisible
    ? 253
    : visibleOptionCount > 0
    ? estimatedCompanionChoiceContentHeight(
        visibleOptionCount,
        companionChoiceColumnCount(width, visibleOptionCount),
      )
    : 190;
  const panelContentKey = `${session.currentNodeId}:${activeGameQuestion?.id ?? 'no-question'}:${session.status}:${session.outcomePresentation?.id ?? 'none'}:${session.pendingReply ?? 'ready'}:${visibleOptionCount}:${journeyRequestHandoffVisible ? 'journey-handoff' : 'standard'}`;
  const panelChromeHeight = showConversationProgress ? 51 : 20;
  const adaptivePanel = useCompanionAdaptivePanel({
    chromeHeight: panelChromeHeight,
    contentKey: panelContentKey,
    estimatedContentHeight,
    safeAreaBottom: insets.bottom,
    safeAreaTop: insets.top,
    viewportHeight: height,
  });
  const shortPanelBottomLift = adaptivePanel.scrollable
    ? 0
    : Math.min(22, Math.max(0, (adaptivePanel.maxHeight - adaptivePanel.panelHeight) * 0.1));
  useEffect(() => {
    if (!session.outcomePresentation?.celebrate || process.env.EXPO_OS !== 'ios') return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [session.outcomePresentation?.id, session.outcomePresentation?.celebrate]);

  return (
    <View style={{
      flex: 1,
      gap: 10,
      minHeight: 0,
      paddingBottom: insets.bottom + 10 + shortPanelBottomLift,
      paddingHorizontal: width >= 700 ? Math.max(28, (width - 720) / 2) : 16,
      paddingTop: insets.top + 10,
    }}>
      <KatchimeraPageHeader
        bondIconTargetRef={bondIconTargetRef}
        bondProgress={bondProgress}
        bondRewardPulseKey={bondRewardPulseKey}
        includeSafeArea={false}
        navigationLocked={navigationLocked}
        onBack={onClose}
      />

      <View accessibilityElementsHidden pointerEvents="none" style={{ flex: 1, minHeight: 120 }} />

      <CompanionNarrativePanel
        accessibilityLabel={`Conversation ${flowPhase.replace('_', ' ')}`}
        entering={reduceMotion ? undefined : FadeInUp.duration(220)}
        layout={reduceMotion || journeyRequestHandoffVisible ? undefined : LinearTransition.duration(COMPANION_PANEL_LAYOUT_DURATION_MS)}
        style={{
          height: adaptivePanel.panelHeight,
          paddingTop: showConversationProgress ? 12 : 8,
        }}>
        {showConversationProgress ? <>
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'space-between' }}>
            <ThemedText selectable style={{ fontSize: 11, fontWeight: '900', letterSpacing: 1.2 }} lightColor={KatchaUI.companionScenePanel.accent} darkColor={KatchaUI.companionScenePanel.accent}>
              {session.preview ? 'DEVELOPER PREVIEW' : definition.trigger === 'signature_game' ? 'A LITTLE GAME' : definition.trigger === 'journal' ? 'FROM YOUR JOURNAL' : 'OUR CONVERSATION'}
            </ThemedText>
            <ThemedText selectable style={{ fontSize: 11, fontVariant: ['tabular-nums'], fontWeight: '900' }} lightColor={KatchaUI.companionScenePanel.inkSoft} darkColor={KatchaUI.companionScenePanel.inkSoft}>
              {progress.label}
            </ThemedText>
          </View>
          <View style={{ backgroundColor: KatchaUI.companionScenePanel.softBackground, borderRadius: 999, height: 6, marginBottom: 8, marginTop: 6, overflow: 'hidden' }}>
            <View style={{ backgroundColor: KatchaUI.companionScenePanel.accent, borderRadius: 999, height: '100%', width: `${Math.max(8, progress.ratio * 100)}%` }} />
          </View>
        </> : null}

        <ScrollView
          key={panelContentKey}
          bounces={adaptivePanel.scrollable}
          contentContainerStyle={{ gap: 10, paddingBottom: 20, paddingTop: showConversationProgress ? 2 : 6 }}
          contentInsetAdjustmentBehavior="never"
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          onContentSizeChange={(_, contentHeight) => adaptivePanel.onContentHeightChange(contentHeight)}
          scrollEnabled={adaptivePanel.scrollable}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1, minHeight: 0 }}>
        {session.outcomePresentation ? (
          <ConversationOutcomeCard
            outcome={session.outcomePresentation}
            onAdvance={onAdvance}
            requiresManualAdvance={requiresManualAdvance}
          />
        ) : session.pendingReply !== undefined ? <NarrativeTransition
          label={journeyNarrative ? 'Continue the story' : 'Mossprout is thinking…'}
          onAdvance={journeyNarrative ? onAdvance : undefined}
          requiresManualAdvance={journeyNarrative && requiresManualAdvance}
        /> : session.status === 'completed' ? (
          session.preview ? <View style={{ alignItems: 'center', gap: 10, paddingVertical: 6 }}>
            <ThemedText selectable style={{ fontSize: 14, lineHeight: 20, textAlign: 'center' }} lightColor={KatchaUI.companionScenePanel.inkSoft} darkColor={KatchaUI.companionScenePanel.inkSoft}>Preview complete. Choose another flow below or exit the preview.</ThemedText>
          </View> : definition.id === 'steppling:journey:day-one' && definition.version >= 3 ? null : <ConversationCompletion
            label={definition.id === 'mossprout:game:form-finder' ? 'Closest match found' : 'Conversation complete'}
            onContinue={onCompletedExit}
          />
        ) : node?.kind === 'end' ? (
          journeyNarrative && journeyTaskHandoff ? <MossproutJourneyRequestPanel
            animateEntrance={false}
            onAction={requiresManualAdvance ? onAdvance : undefined}
            requests={journeyTaskRequests}
            title={journeyTaskTitle ?? 'Today’s Garden requests'}
          /> : <NarrativeTransition
            label={journeyNarrative
              ? journeyTaskHandoff ? 'Your Garden request is ready' : 'Finish today’s Journey'
              : storyFlow && !storyFinale ? 'Opening the next chapter…' : 'Finish this conversation'}
            actionLabel={journeyNarrative
              ? journeyTaskHandoff ? 'Go to the Garden' : 'Finish Journey'
              : undefined}
            onAdvance={onAdvance}
            requiresManualAdvance={requiresManualAdvance}
          />
        ) : node?.kind === 'choice' ? (
          <CompanionChoiceList options={node.id.startsWith('habit.') ? node.options.filter((option) => option.id !== 'choose') : node.options} onSelect={answer} />
        ) : node?.kind === 'poll' ? (
          <CompanionChoiceList options={node.options} onSelect={answer} />
        ) : node?.kind === 'profile_game' || node?.kind === 'insight_game' ? (
          <CompanionChoiceList options={activeGameQuestion?.options ?? []} onSelect={answer} />
        ) : node?.kind === 'form_reveal' ? (
          <FormReveal definition={definition} node={node} onAdvance={onAdvance} preview={Boolean(session.preview)} session={session} skins={skins} />
        ) : node?.kind === 'insight_reveal' ? (
          <InsightReveal node={node} onDecision={onInsightDecision} preview={Boolean(session.preview)} session={session} />
        ) : node?.kind === 'memory_proposal' ? (
          <MemoryProposal node={node} onDecision={onMemoryDecision} session={session} />
        ) : node?.kind === 'goal_proposal' ? (
          <GoalBundleProposal hasActiveGoalPlan={hasActiveFocus} node={node} onDecision={onGoalDecision} />
        ) : node?.kind === 'quick_goal_proposal' && node.storyDaily && (definition.familyId === 'mossprout' || definition.familyId === 'steppling') ? (
          <DailyHabitOffer key={node.id} familyId={definition.familyId} suggestedId={node.templateId} preview={Boolean(session.preview)} saveOnAccept={false}
            onDecision={(id) => onQuickGoalDecision(Boolean(id), { ...node, templateId: id ?? node.templateId, title: id ? lifeHabitById.get(id)?.title ?? node.title : node.title })} />
        ) : node?.kind === 'quick_goal_proposal' ? (
          <View style={{ gap: 10 }}>
            <ThemedText selectable style={{ fontSize: 16, fontWeight: '900', lineHeight: 22 }} lightColor={KatchaUI.companionScenePanel.ink} darkColor={KatchaUI.companionScenePanel.ink}>{node.title}</ThemedText>
            <PrimaryAction label="Add this small task" onPress={() => onQuickGoalDecision(true, node)} />
            <SecondaryAction label="Skip" onPress={() => onQuickGoalDecision(false, node)} />
          </View>
        ) : node?.kind === 'journal_handoff' ? (
          <View style={{ gap: 11 }}>
            <View style={{ backgroundColor: KatchaUI.companionScenePanel.cardBackground, borderColor: 'rgba(168,117,47,0.3)', borderCurve: 'continuous', borderRadius: 22, borderWidth: 1, gap: 8, padding: 16 }}>
              <View style={{ alignItems: 'center', flexDirection: 'row', gap: 9 }}>
                <View style={{ alignItems: 'center', backgroundColor: '#806040', borderRadius: 999, height: 32, justifyContent: 'center', width: 32 }}>
                  <IconSymbol color="#FFF8E7" name="book.closed.fill" size={16} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText selectable style={{ fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }} lightColor={KatchaUI.companionScenePanel.accent} darkColor={KatchaUI.companionScenePanel.accent}>A MOMENT WORTH KEEPING</ThemedText>
                  <ThemedText selectable style={{ fontSize: 20, fontWeight: '900', lineHeight: 25 }} lightColor={KatchaUI.companionScenePanel.ink} darkColor={KatchaUI.companionScenePanel.ink}>{node.title}</ThemedText>
                </View>
              </View>
              <ThemedText selectable style={{ fontSize: 13.5, lineHeight: 20 }} lightColor={KatchaUI.companionScenePanel.inkSoft} darkColor={KatchaUI.companionScenePanel.inkSoft}>{node.body}</ThemedText>
              <View style={{ alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <View style={{ backgroundColor: '#F5D985', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                  <ThemedText selectable style={{ fontSize: 11, fontWeight: '900' }} lightColor="#5B421D" darkColor="#5B421D">
                    {definition.familyId === 'mossprout' ? 'Saved with Mossprout' : `+${node.rewardGrowth} Egg Growth`}
                  </ThemedText>
                </View>
                <View style={{ backgroundColor: '#F5D985', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                  <ThemedText selectable style={{ fontSize: 11, fontWeight: '900' }} lightColor="#5B421D" darkColor="#5B421D">
                    {journalMergeEnergyPreview > 0 ? `+${journalMergeEnergyPreview} Merge Energy today` : 'Daily Merge Energy already collected'}
                  </ThemedText>
                </View>
              </View>
            </View>
            <PrimaryAction label={node.saveLabel} onPress={() => onJournalHandoff(true, node)} />
            <SecondaryAction label="Skip" onPress={() => onJournalHandoff(false, node)} />
          </View>
        ) : node?.kind === 'quest_handoff' ? (
          <View style={{ gap: 10 }}>
            {questOffer ? <View style={{ backgroundColor: KatchaUI.companionScenePanel.cardBackground, borderColor: 'rgba(168,117,47,0.3)', borderCurve: 'continuous', borderRadius: 22, borderWidth: 1, gap: 7, padding: 16 }}>
              <ThemedText selectable style={{ fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }} lightColor={KatchaUI.companionScenePanel.accent} darkColor={KatchaUI.companionScenePanel.accent}>A SMALL INVITATION</ThemedText>
              <ThemedText selectable style={{ fontSize: 21, fontWeight: '900', lineHeight: 26 }} lightColor={KatchaUI.companionScenePanel.ink} darkColor={KatchaUI.companionScenePanel.ink}>{questOffer.title}</ThemedText>
              <ThemedText selectable style={{ fontSize: 13, lineHeight: 19 }} lightColor={KatchaUI.companionScenePanel.inkSoft} darkColor={KatchaUI.companionScenePanel.inkSoft}>{questOffer.hint}</ThemedText>
            </View> : <View style={{ alignItems: 'center', gap: 8, paddingVertical: 12 }}>
              <IconSymbol color="#8B672E" name="sparkles" size={20} />
              <ThemedText selectable style={{ fontSize: 14, lineHeight: 20, textAlign: 'center' }} lightColor={KatchaUI.companionScenePanel.inkSoft} darkColor={KatchaUI.companionScenePanel.inkSoft}>Looking for one that fits…</ThemedText>
            </View>}
            {questOffer ? <PrimaryAction label="Take this quest" onPress={() => onQuestHandoff(true, node)} /> : null}
            {questOffer ? <SecondaryAction label="Skip" onPress={() => onQuestHandoff(false, node)} /> : null}
          </View>
        ) : null}
        {developerContent}
        </ScrollView>
      </CompanionNarrativePanel>
    </View>
  );
}

function GoalBundleProposal({ hasActiveGoalPlan, node, onDecision }: {
  hasActiveGoalPlan: boolean;
  node: Extract<ConversationNode, { kind: 'goal_proposal' }>;
  onDecision: (selectedTemplateIds: readonly string[] | null, node: Extract<ConversationNode, { kind: 'goal_proposal' }>) => void;
}) {
  const suggestions = node.suggestedQuickGoalIds
    .map((id) => companionQuickGoalTemplateById.get(id))
    .filter((template): template is NonNullable<typeof template> => Boolean(template))
    .slice(0, 3);
  const [selectedIds, setSelectedIds] = useState<readonly string[]>(suggestions[0] ? [suggestions[0].id] : []);
  const toggle = (id: string) => setSelectedIds((current) => current.includes(id)
    ? current.filter((selectedId) => selectedId !== id)
    : [...current, id]);
  return <View style={{ gap: 11 }}>
    <View style={{ gap: 5 }}>
      <ThemedText selectable style={{ fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }} lightColor={KatchaUI.companionScenePanel.accent} darkColor={KatchaUI.companionScenePanel.accent}>A FEW IDEAS</ThemedText>
      <ThemedText selectable style={{ fontSize: 19, fontWeight: '900', lineHeight: 24 }} lightColor={KatchaUI.companionScenePanel.ink} darkColor={KatchaUI.companionScenePanel.ink}>{node.goalTitle}</ThemedText>
      {node.summary ? <ThemedText selectable style={{ fontSize: 14, lineHeight: 20 }} lightColor={KatchaUI.companionScenePanel.inkSoft} darkColor={KatchaUI.companionScenePanel.inkSoft}>{node.summary}</ThemedText> : null}
      <ThemedText selectable style={{ fontSize: 13, lineHeight: 18 }} lightColor={KatchaUI.companionScenePanel.inkSoft} darkColor={KatchaUI.companionScenePanel.inkSoft}>
        {hasActiveGoalPlan ? 'Keep any that fit your current goals.' : 'Pick one, a few, or none.'}
      </ThemedText>
    </View>
    {suggestions.map((suggestion, index) => {
      const selected = selectedIds.includes(suggestion.id);
      return <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        key={suggestion.id}
        onPress={() => toggle(suggestion.id)}
        style={({ pressed }) => ({ alignItems: 'center', backgroundColor: selected ? KatchaUI.companionScenePanel.cardSelected : KatchaUI.companionScenePanel.cardBackground, borderColor: selected ? 'rgba(242,197,87,0.52)' : KatchaUI.companionScenePanel.cardBorder, borderRadius: 17, borderWidth: selected ? 2 : 1, flexDirection: 'row', gap: 11, minHeight: 62, opacity: pressed ? 0.74 : 1, padding: 12 })}>
        <View style={{ alignItems: 'center', backgroundColor: selected ? KatchaUI.companionScenePanel.accent : KatchaUI.companionScenePanel.softBackground, borderRadius: 999, height: 27, justifyContent: 'center', width: 27 }}>
          {selected ? <IconSymbol color={KatchaUI.companionScenePanel.accentInk} name="checkmark" size={14} weight="bold" /> : null}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          {index === 0 ? <ThemedText selectable style={{ fontSize: 9, fontWeight: '900', letterSpacing: 0.8 }} lightColor={KatchaUI.companionScenePanel.accent} darkColor={KatchaUI.companionScenePanel.accent}>TRY THIS FIRST</ThemedText> : null}
          <ThemedText selectable style={{ fontSize: 14, fontWeight: '800', lineHeight: 19 }} lightColor={KatchaUI.companionScenePanel.ink} darkColor={KatchaUI.companionScenePanel.ink}>{suggestion.title}</ThemedText>
        </View>
      </Pressable>;
    })}
    <PrimaryAction disabled={!selectedIds.length} label={selectedIds.length > 1 ? `Add ${selectedIds.length} goals` : 'Add selected goal'} onPress={() => onDecision(selectedIds, node)} />
    <SecondaryAction label="Skip" onPress={() => onDecision(null, node)} />
  </View>;
}

function conversationPrompt(
  prompt: string,
  definition: ConversationDefinition,
  session: ConversationSession
): string {
  const answer = optionLabel(definition, session, session.turns.at(-1)?.optionId ?? null);
  return prompt.replace('{answer}', answer ?? 'that');
}

function ConversationOutcomeCard({ outcome, onAdvance, requiresManualAdvance }: {
  outcome: ConversationOutcomePresentation;
  onAdvance: () => void;
  requiresManualAdvance: boolean;
}) {
  return <Animated.View entering={FadeInUp.duration(240)} style={{ gap: 11 }}>
    <View style={{ backgroundColor: KatchaUI.companionScenePanel.cardBackground, borderColor: 'rgba(168,117,47,0.34)', borderCurve: 'continuous', borderRadius: 24, borderWidth: 1, boxShadow: '0 9px 24px rgba(112,76,30,0.13)', gap: 8, padding: 17 }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
        <View style={{ alignItems: 'center', backgroundColor: '#739356', borderRadius: 999, height: 28, justifyContent: 'center', width: 28 }}>
          <IconSymbol color="#FFF9E9" name="checkmark" size={15} weight="bold" />
        </View>
        <ThemedText selectable style={{ flex: 1, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }} lightColor="#6F7E3E" darkColor="#6F7E3E">{outcome.eyebrow}</ThemedText>
      </View>
      <ThemedText selectable style={{ fontSize: 23, fontWeight: '900', lineHeight: 28 }} lightColor={KatchaUI.companionScenePanel.ink} darkColor={KatchaUI.companionScenePanel.ink}>{outcome.title}</ThemedText>
      <ThemedText selectable style={{ fontSize: 13, lineHeight: 19 }} lightColor={KatchaUI.companionScenePanel.inkSoft} darkColor={KatchaUI.companionScenePanel.inkSoft}>{outcome.message}</ThemedText>
      {outcome.items?.map((item) => <View key={item} style={{ alignItems: 'center', backgroundColor: KatchaUI.companionScenePanel.softBackground, borderRadius: 14, flexDirection: 'row', gap: 9, paddingHorizontal: 11, paddingVertical: 9 }}>
        <IconSymbol color="#6F7E3E" name="checkmark.circle.fill" size={17} />
        <ThemedText selectable style={{ flex: 1, fontSize: 13, fontWeight: '800', lineHeight: 18 }} lightColor={KatchaUI.companionScenePanel.ink} darkColor={KatchaUI.companionScenePanel.ink}>{item}</ThemedText>
      </View>)}
    </View>
    {requiresManualAdvance ? <PrimaryAction label="Continue" onPress={onAdvance} /> : null}
  </Animated.View>;
}

function FormReveal({ definition, node, onAdvance, preview, session, skins }: {
  definition: ConversationDefinition;
  node: Extract<ConversationNode, { kind: 'form_reveal' }>;
  onAdvance: () => void;
  preview: boolean;
  session: ConversationSession;
  skins: readonly KingdomSkinOption[];
}) {
  const topId = session.formResult?.topFormId ?? session.formId;
  const runnerId = session.formResult?.runnerUpFormId ?? null;
  const top = skins.find((skin) => skin.id === topId);
  const topName = top?.displayName ?? katchimeraSkinById.get(topId)?.displayName ?? topId;
  const runnerName = runnerId ? skins.find((skin) => skin.id === runnerId)?.displayName ?? katchimeraSkinById.get(runnerId)?.displayName : null;
  const topVisual = top ? getCreatureVisual(top.visualKey, 'grown') : null;
  const reasons = session.turns
    .filter((turn) => Boolean(turn.questionId))
    .slice(-3)
    .map((turn) => optionLabel(definition, session, turn.optionId))
    .filter((label): label is string => Boolean(label));
  const cardReveal = definition.familyId === 'mossprout' && definition.id === 'mossprout:game:form-finder';
  return <View style={{ gap: 11 }}>
    <View style={{ backgroundColor: KatchaUI.companionScenePanel.cardBackground, borderCurve: 'continuous', borderRadius: 22, gap: 8, padding: 16 }}>
      <ThemedText selectable style={{ fontSize: 11, fontWeight: '900', letterSpacing: 1.1 }} lightColor={KatchaUI.companionScenePanel.accent} darkColor={KatchaUI.companionScenePanel.accent}>{cardReveal ? 'SOMEONE FEELS CLOSE' : 'YOUR CLOSEST FORM'}</ThemedText>
      {!cardReveal && topVisual ? <View style={{ alignItems: 'center', height: 170, justifyContent: 'center' }}>
        <Image contentFit="contain" source={topVisual.source} style={{ height: 170, width: '100%' }} transition={220} />
      </View> : null}
      <ThemedText selectable style={{ fontSize: 26, fontWeight: '900' }} lightColor={KatchaUI.companionScenePanel.ink} darkColor={KatchaUI.companionScenePanel.ink}>{cardReveal ? 'A veiled garden visitor' : topName}</ThemedText>
      <ThemedText selectable style={{ fontSize: 14, lineHeight: 20 }} lightColor={KatchaUI.companionScenePanel.inkSoft} darkColor={KatchaUI.companionScenePanel.inkSoft}>{cardReveal ? 'Your choices point to one resident, but meeting them is part of the story. Open their parcel in the garden to find out who answered.' : node.descriptions[topId] ?? 'A form that fits the choices you made today.'}</ThemedText>
      <ThemedText selectable style={{ fontSize: 9.5, fontWeight: '900', letterSpacing: 1 }} lightColor={KatchaUI.companionScenePanel.accent} darkColor={KatchaUI.companionScenePanel.accent}>BECAUSE YOU CHOSE</ThemedText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {reasons.map((reason) => <View key={reason} style={{ backgroundColor: 'rgba(217,164,62,0.15)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 }}>
          <ThemedText selectable style={{ fontSize: 10.5, fontWeight: '800' }} lightColor="#74572C" darkColor="#74572C">{reason}</ThemedText>
        </View>)}
      </View>
      {!cardReveal && runnerName ? <ThemedText selectable style={{ fontSize: 12, fontWeight: '800' }} lightColor={KatchaUI.companionScenePanel.accent} darkColor={KatchaUI.companionScenePanel.accent}>Runner-up: {runnerName}</ThemedText> : null}
      {cardReveal ? <ThemedText selectable style={{ fontSize: 12, lineHeight: 17 }} lightColor={KatchaUI.companionScenePanel.accent} darkColor={KatchaUI.companionScenePanel.accent}>The card is not earned yet. Reveal the resident, then help with two small requests.</ThemedText> : !top?.unlocked ? <ThemedText selectable style={{ fontSize: 12, lineHeight: 17 }} lightColor={KatchaUI.companionScenePanel.accent} darkColor={KatchaUI.companionScenePanel.accent}>Not discovered yet. Its hatch cues will stay visible in your collection.</ThemedText> : null}
    </View>
    <NarrativeTransition label={preview ? 'Preview ready' : cardReveal ? 'Preparing a veiled parcel…' : 'Saving this match to your insights…'} onAdvance={onAdvance} requiresManualAdvance={preview} />
  </View>;
}

function InsightReveal({ node, onDecision, preview, session }: {
  node: Extract<ConversationNode, { kind: 'insight_reveal' }>;
  onDecision: (accept: boolean, node: Extract<ConversationNode, { kind: 'insight_reveal' }>) => void;
  preview: boolean;
  session: ConversationSession;
}) {
  const result = session.insightResult;
  if (!result) return <View style={{ gap: 10 }}>
    <ThemedText selectable style={{ fontSize: 14, lineHeight: 20, textAlign: 'center' }} lightColor={KatchaUI.companionScenePanel.inkSoft} darkColor={KatchaUI.companionScenePanel.inkSoft}>I could not resolve this result yet. Try the conversation again.</ThemedText>
    <SecondaryAction label="Close" onPress={() => onDecision(false, node)} />
  </View>;
  if (!preview) return <AutomaticInsightTransition label="Adding your insight…" />;
  return <Animated.View entering={FadeInUp.duration(260)} style={{ gap: 10 }}>
    <View style={{ backgroundColor: KatchaUI.companionScenePanel.cardBackground, borderColor: 'rgba(174,119,38,0.3)', borderCurve: 'continuous', borderRadius: 21, borderWidth: 1, gap: 6, paddingHorizontal: 16, paddingVertical: 15 }}>
      <ThemedText selectable style={{ fontSize: 22, fontWeight: '900', lineHeight: 26 }} lightColor={KatchaUI.companionScenePanel.ink} darkColor={KatchaUI.companionScenePanel.ink}>{result.title}</ThemedText>
      <ThemedText selectable style={{ fontSize: 14, lineHeight: 20 }} lightColor={KatchaUI.companionScenePanel.inkSoft} darkColor={KatchaUI.companionScenePanel.inkSoft}>{result.summary}</ThemedText>
    </View>
    <PrimaryAction label="Continue preview" onPress={() => onDecision(false, node)} />
  </Animated.View>;
}

function AutomaticInsightTransition({ label }: { label: string }) {
  return <View accessibilityLiveRegion="polite" style={{ alignItems: 'center', gap: 10, paddingVertical: 22 }}>
    <ActivityIndicator color={KatchaUI.companionScenePanel.accent} size="small" />
    <ThemedText selectable style={{ fontSize: 13, fontWeight: '800' }} lightColor={KatchaUI.companionScenePanel.inkSoft} darkColor={KatchaUI.companionScenePanel.inkSoft}>{label}</ThemedText>
  </View>;
}

function MemoryProposal({ node, onDecision, session }: {
  node: Extract<ConversationNode, { kind: 'memory_proposal' }>;
  onDecision: (remember: boolean, summary: string) => void;
  session: ConversationSession;
}) {
  const topName = katchimeraSkinById.get(session.formResult?.topFormId ?? session.formId)?.displayName ?? 'this form';
  const summary = node.summary.replace('{topForm}', topName);
  const isFormInsight = node.memoryKey.includes(':form-match');
  if (!session.preview) return <AutomaticInsightTransition label={isFormInsight ? 'Saving your form insight…' : 'Tucking this into shared memory…'} />;
  if (isFormInsight && session.preview) return <View style={{ gap: 10 }}>
    <View style={{ backgroundColor: KatchaUI.companionScenePanel.softBackground, borderCurve: 'continuous', borderRadius: 18, gap: 5, padding: 13 }}>
      <ThemedText selectable style={{ fontSize: 11, fontWeight: '900', letterSpacing: 1 }} lightColor={KatchaUI.companionScenePanel.accent} darkColor={KatchaUI.companionScenePanel.accent}>YOUR FORM INSIGHT</ThemedText>
      <ThemedText selectable style={{ fontSize: 14, lineHeight: 20 }} lightColor={KatchaUI.companionScenePanel.inkSoft} darkColor={KatchaUI.companionScenePanel.inkSoft}>{summary}</ThemedText>
    </View>
    <PrimaryAction label="Finish preview" onPress={() => onDecision(false, summary)} />
  </View>;
  return <View style={{ gap: 10 }}>
    <View style={{ backgroundColor: KatchaUI.companionScenePanel.softBackground, borderCurve: 'continuous', borderRadius: 18, gap: 5, padding: 13 }}>
      <ThemedText selectable style={{ fontSize: 11, fontWeight: '900', letterSpacing: 1 }} lightColor={KatchaUI.companionScenePanel.accent} darkColor={KatchaUI.companionScenePanel.accent}>SHARED MEMORY PREVIEW</ThemedText>
      <ThemedText selectable style={{ fontSize: 14, lineHeight: 20 }} lightColor={KatchaUI.companionScenePanel.inkSoft} darkColor={KatchaUI.companionScenePanel.inkSoft}>{summary}</ThemedText>
    </View>
    <PrimaryAction label="Finish preview" onPress={() => onDecision(false, summary)} />
  </View>;
}

function ConversationCompletion({ label, onContinue }: { label: string; onContinue: () => void }) {
  return <Animated.View accessibilityLabel={label} entering={FadeInUp.duration(180)} style={{ gap: 10 }}>
    <ThemedText selectable style={{ fontSize: 13.5, fontWeight: '900', lineHeight: 18, textAlign: 'center' }} lightColor={KatchaUI.companionScenePanel.inkSoft} darkColor={KatchaUI.companionScenePanel.inkSoft}>{label}</ThemedText>
    <PrimaryAction label="Continue" onPress={onContinue} />
  </Animated.View>;
}

function NarrativeTransition({ actionLabel = 'Continue', label, onAdvance, requiresManualAdvance = false }: {
  actionLabel?: string;
  label: string;
  onAdvance?: () => void;
  requiresManualAdvance?: boolean;
}) {
  return <View accessibilityLiveRegion="polite" style={{ gap: 9 }}>
    <ThemedText selectable style={{ fontSize: 13.5, fontWeight: '900', lineHeight: 18, textAlign: 'center' }} lightColor={KatchaUI.companionScenePanel.inkSoft} darkColor={KatchaUI.companionScenePanel.inkSoft}>{label}</ThemedText>
    {onAdvance && requiresManualAdvance ? <PrimaryAction label={actionLabel} onPress={onAdvance} /> : null}
  </View>;
}

function PrimaryAction({ disabled = false, label, onPress }: { disabled?: boolean; label: string; onPress: () => void }) {
  return <KatchaButton disabled={disabled} onPress={onPress} label={label} />;
}

function SecondaryAction({ label, onPress }: { label: string; onPress: () => void }) {
  return <KatchaButton onPress={onPress} label={label} size="compact" variant="tertiary" />;
}

function optionLabel(definition: ConversationDefinition, session: ConversationSession, optionId: string | null): string | null {
  if (!optionId) return null;
  for (const node of definition.nodes) {
    if (node.kind === 'choice' || node.kind === 'poll') {
      const match = node.options.find((option) => option.id === optionId);
      if (match) return match.label;
    }
    if (node.kind === 'profile_game' || node.kind === 'insight_game') {
      for (const question of node.questions) {
        const match = question.options.find((option) => option.id === optionId);
        if (match) return match.label;
      }
    }
  }
  return null;
}

function conversationProgress(definition: ConversationDefinition, session: ConversationSession): { label: string; ratio: number } {
  const node = conversationNode(definition, session.currentNodeId);
  if (session.status === 'completed') return { label: 'Done', ratio: 1 };
  if (node?.kind === 'profile_game' || node?.kind === 'insight_game') {
    const total = node.kind === 'profile_game' ? 3 : node.questions.length;
    const answered = session.turns.filter((turn) => turn.nodeId === node.id).length;
    const current = Math.min(total, answered + (session.pendingReply !== undefined ? 0 : 1));
    return { label: `${current} of ${total}`, ratio: current / total };
  }
  const target = Math.max(1, session.encounterTargetTurns ?? 3);
  const completedTurns = Math.min(target, session.encounterTurns ?? 0);
  const ratio = Math.min(0.96, Math.max(0.12, (completedTurns + 0.5) / target));
  const phase = node?.kind === 'choice' && node.phase
    ? node.phase
    : ratio < 0.26
      ? 'opening'
      : ratio < 0.58
        ? 'explore'
        : ratio < 0.84
          ? 'deepen'
          : 'resolve';
  const labels: Record<typeof phase, string> = {
    opening: 'Opening', explore: 'Following the thread', deepen: 'Going deeper', resolve: 'Bringing it together',
  };
  return { label: labels[phase], ratio };
}
