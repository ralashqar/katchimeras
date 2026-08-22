import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInUp, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KatchimeraBackButton } from '@/components/katchadeck/ui/katchimera-back-button';
import { BondIconArt } from '@/components/katchadeck/ui/bond-icon-art';
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

export function conversationSpeechLine(
  session: ConversationSession,
  definition: ConversationDefinition
): string {
  if (session.outcomePresentation) {
    const outcome = session.outcomePresentation;
    if (outcome.kind === 'quest') return `Quest accepted: ${outcome.title}.`;
    if (outcome.kind === 'task') return `Done — ${outcome.title} is on your goals list.`;
    if (outcome.kind === 'focus' || outcome.kind === 'goal') return `Done — ${outcome.title} is ready in your goals.`;
    if (outcome.kind === 'insight') return `I’ve added ${outcome.title} to what I know about you.`;
    return `I’ll remember: ${outcome.title}`;
  }
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
  bondProgress,
  definition,
  developerContent,
  flowPhase,
  name,
  onAdvance,
  onAnswer,
  onClose,
  onMemoryDecision,
  onGoalDecision,
  onInsightDecision,
  onQuickGoalDecision,
  onJournalHandoff,
  onQuestHandoff,
  hasActiveFocus,
  onOpenMore,
  storyFlow = false,
  storyFinale = false,
  session,
  skins,
  questOffer,
  requiresManualAdvance,
  journalMergeEnergyPreview,
}: {
  bondProgress: CompanionBondProgress;
  definition: ConversationDefinition;
  developerContent?: ReactNode;
  flowPhase: CompanionConversationPresentationPhase;
  name: string;
  onAdvance: () => void;
  onAnswer: (optionId: string) => void;
  onClose: () => void;
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
  memories: readonly CompanionMemory[];
  onUpdateMemory: (input: { memoryId: string; status: 'confirmed' | 'rejected' | 'forgotten'; summary?: string }) => void;
  onOpenMore: () => void;
  onStoryComplete?: () => void;
  storyFlow?: boolean;
  storyFinale?: boolean;
  session: ConversationSession;
  skins: readonly KingdomSkinOption[];
  questOffer: { id: string; title: string; hint: string } | null;
  requiresManualAdvance: boolean;
  journalMergeEnergyPreview: number;
}) {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const node = conversationNode(definition, session.currentNodeId);
  const headerSkin = skins.find((skin) => skin.id === session.formId) ?? skins[0] ?? null;
  const headerVisual = headerSkin ? getCreatureVisual(headerSkin.visualKey, 'grown') : null;
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
  const estimatedContentHeight = visibleOptionCount > 0
    ? estimatedCompanionChoiceContentHeight(
        visibleOptionCount,
        companionChoiceColumnCount(width, visibleOptionCount),
      )
    : 190;
  const panelContentKey = `${session.currentNodeId}:${activeGameQuestion?.id ?? 'no-question'}:${session.status}:${session.outcomePresentation?.id ?? 'none'}:${session.pendingReply ?? 'ready'}:${visibleOptionCount}`;
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
      <View style={{ alignItems: 'center', flexDirection: 'row', minHeight: 48, zIndex: 4 }}>
        <KatchimeraBackButton accessibilityLabel="Back to Katchimeras" onPress={onClose} />
        <View style={{ alignItems: 'center', flex: 1, flexDirection: 'row', gap: 9, paddingHorizontal: 10 }}>
          <View style={{ alignItems: 'center', backgroundColor: 'rgba(255,247,220,0.92)', borderColor: 'rgba(255,225,158,0.7)', borderCurve: 'continuous', borderRadius: 15, borderWidth: 1, height: 46, justifyContent: 'center', overflow: 'hidden', width: 46 }}>
            {headerVisual ? <Image accessibilityLabel={`${name} portrait`} contentFit="contain" source={headerVisual.source} style={{ height: 44, width: 44 }} /> : null}
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <ThemedText
              adjustsFontSizeToFit
              minimumFontScale={0.72}
              numberOfLines={1}
              selectable
              style={{ ...KatchaUI.type.companionName, fontSize: 22, lineHeight: 25 }}
              lightColor="#FFD36E"
              darkColor="#FFD36E">
              {name}
            </ThemedText>
            <View accessibilityLabel={`${bondProgress.relationshipStage} bond, ${Math.round(bondProgress.relationshipStageRatio * 100)} percent to the next stage`} style={{ alignItems: 'center', flexDirection: 'row', gap: 6 }}>
              <BondIconArt size={17} />
              <ThemedText selectable style={{ fontSize: 9.5, fontWeight: '900' }} lightColor="#FFF1CC" darkColor="#FFF1CC">{bondProgress.relationshipStage}</ThemedText>
              <View style={{ backgroundColor: 'rgba(255,244,213,0.25)', borderRadius: 999, flex: 1, height: 5, overflow: 'hidden' }}>
                <View style={{ backgroundColor: '#E8B547', borderRadius: 999, height: '100%', width: `${Math.max(bondProgress.totalPoints ? 5 : 0, bondProgress.relationshipStageRatio * 100)}%` }} />
              </View>
            </View>
          </View>
        </View>
        <Pressable
          accessibilityLabel="Open companion story dashboard"
          accessibilityRole="button"
          onPress={onOpenMore}
          style={({ pressed }) => ({ alignItems: 'center', backgroundColor: 'rgba(255,248,225,0.94)', borderCurve: 'continuous', borderRadius: 14, gap: 1, minHeight: 44, justifyContent: 'center', opacity: pressed ? 0.68 : 1, paddingHorizontal: 10 })}>
          <IconSymbol color="#6B4A24" name="book.closed.fill" size={17} weight="bold" />
          <ThemedText selectable style={{ fontSize: 8.5, fontWeight: '900' }} lightColor="#6B4A24" darkColor="#6B4A24">Story</ThemedText>
        </Pressable>
      </View>

      <View accessibilityElementsHidden pointerEvents="none" style={{ flex: 1, minHeight: 120 }} />

      <Animated.View
        accessibilityLabel={`Conversation ${flowPhase.replace('_', ' ')}`}
        entering={reduceMotion ? undefined : FadeInUp.duration(220)}
        layout={reduceMotion ? undefined : LinearTransition.duration(COMPANION_PANEL_LAYOUT_DURATION_MS)}
        style={{
          backgroundColor: KatchaUI.companionScenePanel.background,
          borderColor: KatchaUI.companionScenePanel.border,
          borderCurve: 'continuous',
          borderRadius: 30,
          borderWidth: 1,
          boxShadow: KatchaUI.companionScenePanel.shadow,
          height: adaptivePanel.panelHeight,
          overflow: 'hidden',
          paddingHorizontal: 12,
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
        ) : session.pendingReply !== undefined ? <NarrativeTransition label="Mossprout is thinking…" /> : session.status === 'completed' || node?.kind === 'end' ? (
          session.preview ? <View style={{ alignItems: 'center', gap: 10, paddingVertical: 6 }}>
            <ThemedText selectable style={{ fontSize: 14, lineHeight: 20, textAlign: 'center' }} lightColor={KatchaUI.companionScenePanel.inkSoft} darkColor={KatchaUI.companionScenePanel.inkSoft}>Preview complete. Choose another flow below or exit the preview.</ThemedText>
          </View> : <NarrativeTransition
            label={storyFlow && !storyFinale ? 'Opening the next chapter…' : `Returning to ${name}…`}
            onAdvance={onAdvance}
            requiresManualAdvance={requiresManualAdvance}
          />
        ) : node?.kind === 'choice' ? (
          <CompanionChoiceList options={node.options} onSelect={answer} />
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
              <ThemedText selectable style={{ fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }} lightColor={KatchaUI.companionScenePanel.accent} darkColor={KatchaUI.companionScenePanel.accent}>A QUEST PICKED FOR YOU</ThemedText>
              <ThemedText selectable style={{ fontSize: 21, fontWeight: '900', lineHeight: 26 }} lightColor={KatchaUI.companionScenePanel.ink} darkColor={KatchaUI.companionScenePanel.ink}>{questOffer.title}</ThemedText>
              <ThemedText selectable style={{ fontSize: 13, lineHeight: 19 }} lightColor={KatchaUI.companionScenePanel.inkSoft} darkColor={KatchaUI.companionScenePanel.inkSoft}>{questOffer.hint}</ThemedText>
            </View> : <View style={{ alignItems: 'center', gap: 8, paddingVertical: 12 }}>
              <IconSymbol color="#8B672E" name="sparkles" size={20} />
              <ThemedText selectable style={{ fontSize: 14, lineHeight: 20, textAlign: 'center' }} lightColor={KatchaUI.companionScenePanel.inkSoft} darkColor={KatchaUI.companionScenePanel.inkSoft}>Bringing your answers together…</ThemedText>
            </View>}
            {questOffer ? <PrimaryAction label="Take this quest" onPress={() => onQuestHandoff(true, node)} /> : null}
            {questOffer ? <SecondaryAction label="Skip" onPress={() => onQuestHandoff(false, node)} /> : null}
          </View>
        ) : null}
        {developerContent}
        </ScrollView>
      </Animated.View>
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
      <ThemedText selectable style={{ fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }} lightColor={KatchaUI.companionScenePanel.accent} darkColor={KatchaUI.companionScenePanel.accent}>A GOAL PLAN FOR YOU</ThemedText>
      <ThemedText selectable style={{ fontSize: 19, fontWeight: '900', lineHeight: 24 }} lightColor={KatchaUI.companionScenePanel.ink} darkColor={KatchaUI.companionScenePanel.ink}>{node.goalTitle}</ThemedText>
      {node.summary ? <ThemedText selectable style={{ fontSize: 14, lineHeight: 20 }} lightColor={KatchaUI.companionScenePanel.inkSoft} darkColor={KatchaUI.companionScenePanel.inkSoft}>{node.summary}</ThemedText> : null}
      <ThemedText selectable style={{ fontSize: 13, lineHeight: 18 }} lightColor={KatchaUI.companionScenePanel.inkSoft} darkColor={KatchaUI.companionScenePanel.inkSoft}>
        {hasActiveGoalPlan ? 'Choose any steps you want to add to your current goals.' : 'Choose one or more concrete steps. The first is my best match for your answers.'}
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
          {index === 0 ? <ThemedText selectable style={{ fontSize: 9, fontWeight: '900', letterSpacing: 0.8 }} lightColor={KatchaUI.companionScenePanel.accent} darkColor={KatchaUI.companionScenePanel.accent}>BEST MATCH</ThemedText> : null}
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
      <ThemedText selectable style={{ fontSize: 11, fontWeight: '900', letterSpacing: 1.1 }} lightColor={KatchaUI.companionScenePanel.accent} darkColor={KatchaUI.companionScenePanel.accent}>{cardReveal ? 'YOUR KATCHIMERA CARD' : 'YOUR CLOSEST FORM'}</ThemedText>
      {topVisual ? <View style={{ alignItems: 'center', height: 170, justifyContent: 'center' }}>
        <Image contentFit="contain" source={topVisual.source} style={{ height: 170, width: '100%' }} transition={220} />
      </View> : null}
      <ThemedText selectable style={{ fontSize: 26, fontWeight: '900' }} lightColor={KatchaUI.companionScenePanel.ink} darkColor={KatchaUI.companionScenePanel.ink}>{topName}</ThemedText>
      <ThemedText selectable style={{ fontSize: 14, lineHeight: 20 }} lightColor={KatchaUI.companionScenePanel.inkSoft} darkColor={KatchaUI.companionScenePanel.inkSoft}>{node.descriptions[topId] ?? 'A form that fits the choices you made today.'}</ThemedText>
      <ThemedText selectable style={{ fontSize: 9.5, fontWeight: '900', letterSpacing: 1 }} lightColor={KatchaUI.companionScenePanel.accent} darkColor={KatchaUI.companionScenePanel.accent}>BECAUSE YOU CHOSE</ThemedText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {reasons.map((reason) => <View key={reason} style={{ backgroundColor: 'rgba(217,164,62,0.15)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 }}>
          <ThemedText selectable style={{ fontSize: 10.5, fontWeight: '800' }} lightColor="#74572C" darkColor="#74572C">{reason}</ThemedText>
        </View>)}
      </View>
      {runnerName ? <ThemedText selectable style={{ fontSize: 12, fontWeight: '800' }} lightColor={KatchaUI.companionScenePanel.accent} darkColor={KatchaUI.companionScenePanel.accent}>Runner-up: {runnerName}</ThemedText> : null}
      {cardReveal ? <ThemedText selectable style={{ fontSize: 12, lineHeight: 17 }} lightColor={KatchaUI.companionScenePanel.accent} darkColor={KatchaUI.companionScenePanel.accent}>This match joins your Mossprout card collection for free.</ThemedText> : !top?.unlocked ? <ThemedText selectable style={{ fontSize: 12, lineHeight: 17 }} lightColor={KatchaUI.companionScenePanel.accent} darkColor={KatchaUI.companionScenePanel.accent}>Not discovered yet. Its hatch cues will stay visible in your collection.</ThemedText> : null}
    </View>
    <NarrativeTransition label={preview ? 'Preview ready' : cardReveal ? 'Adding this card to your collection…' : 'Saving this match to your insights…'} onAdvance={onAdvance} requiresManualAdvance={preview} />
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

function NarrativeTransition({ label, onAdvance, requiresManualAdvance = false }: {
  label: string;
  onAdvance?: () => void;
  requiresManualAdvance?: boolean;
}) {
  return <View accessibilityLiveRegion="polite" style={{ gap: 9 }}>
    <ThemedText selectable style={{ fontSize: 13.5, fontWeight: '900', lineHeight: 18, textAlign: 'center' }} lightColor={KatchaUI.companionScenePanel.inkSoft} darkColor={KatchaUI.companionScenePanel.inkSoft}>{label}</ThemedText>
    {onAdvance && requiresManualAdvance ? <PrimaryAction label="Continue" onPress={onAdvance} /> : null}
  </View>;
}

function PrimaryAction({ disabled = false, label, onPress }: { disabled?: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => ({ alignItems: 'center', backgroundColor: KatchaUI.companionScenePanel.accent, borderCurve: 'continuous', borderRadius: 17, minHeight: 52, justifyContent: 'center', opacity: disabled ? 0.42 : pressed ? 0.82 : 1, paddingHorizontal: 16, transform: [{ scale: pressed && !disabled ? 0.985 : 1 }] })}>
    <ThemedText selectable style={{ fontSize: 15, fontWeight: '900' }} lightColor={KatchaUI.companionScenePanel.accentInk} darkColor={KatchaUI.companionScenePanel.accentInk}>{label}</ThemedText>
  </Pressable>;
}

function SecondaryAction({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ alignItems: 'center', borderRadius: 15, minHeight: 42, justifyContent: 'center', opacity: pressed ? 0.62 : 1, paddingHorizontal: 12 })}>
    <ThemedText selectable style={{ fontSize: 13, fontWeight: '800' }} lightColor={KatchaUI.companionScenePanel.inkSoft} darkColor={KatchaUI.companionScenePanel.inkSoft}>{label}</ThemedText>
  </Pressable>;
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
