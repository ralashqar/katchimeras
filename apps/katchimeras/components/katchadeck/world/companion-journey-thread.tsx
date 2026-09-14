import { useState, type RefObject } from 'react';
import { Pressable, StyleSheet, type View as ViewType } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  type CompanionJourneyConversationNode,
  type CompanionJourneyDefinition,
} from '@/constants/companion-journeys';
import { AppFontFamilies } from '@/constants/theme';
import { KatchaUI } from '@/constants/katcha-ui';
import { Meadow } from '@/constants/meadow-theme';
import type { HomeVisualKey } from '@/types/home';
import {
  type CompanionJourneyConversationSession,
  type CompanionJourneyGoal,
  journeyQuestionnaireProgress,
} from '@/utils/companion-journey';
import { companionQuickGoalTemplateById } from '@/constants/companion-quick-goals';
import {
  companionQuestionnaireOptionIcon,
  type QuestionnaireImageSource,
} from '@/utils/companion-questionnaire-presentation';
import type { TodayAtmosphereBackground } from '@/utils/day-background-scene';
import type { TodayExplorationBackgroundKey } from '@/utils/today-exploration-backgrounds';
import type { CompanionBondProgress } from '@/utils/companion-bond';
import {
  CompanionQuestionnaireScene,
  QuestionnaireResultNotice,
} from './companion-questionnaire-scene';
import { CompanionPrimaryAction } from './companion-interaction-primitives';

export function CompanionJourneyQuestionnairePage({
  accentColor,
  background,
  bondIconTargetRef,
  bondProgress,
  bondRewardPulseKey = 0,
  companionName,
  conversation,
  creature,
  definition,
  environmentKey,
  goals,
  node,
  onAddTasks,
  onAnswer,
  onBack,
  onDone,
  onDismissTasks,
  presentation = 'immersive',
  quickGoalSuggestionIds,
  resultReady,
  visualKey,
}: {
  accentColor: string;
  background: TodayAtmosphereBackground;
  bondIconTargetRef?: RefObject<ViewType | null>;
  bondProgress?: CompanionBondProgress;
  bondRewardPulseKey?: number;
  companionName: string;
  conversation: CompanionJourneyConversationSession | null;
  creature: QuestionnaireImageSource;
  definition: CompanionJourneyDefinition;
  environmentKey: TodayExplorationBackgroundKey | null;
  goals: readonly CompanionJourneyGoal[];
  node: CompanionJourneyConversationNode | null;
  onAddTasks: (templateIds: readonly string[]) => readonly string[];
  onAnswer: (sessionId: string, value: string) => readonly string[];
  onBack: () => void;
  onDone: () => void;
  onDismissTasks: () => void;
  presentation?: 'immersive' | 'conversation';
  quickGoalSuggestionIds: readonly string[];
  resultReady: boolean;
  visualKey: HomeVisualKey;
}) {
  const activeFocus = goals.find((goal) => goal.status === 'active' && goal.isPrimary)
    ?? goals.find((goal) => goal.status === 'active')
    ?? null;
  const [newlyAddedTaskIds, setNewlyAddedTaskIds] = useState<readonly string[] | null>(null);
  const [taskDecision, setTaskDecision] = useState<'preview' | 'added' | 'already-added' | 'none'>('preview');

  if (resultReady) {
    const suggestedTasks = quickGoalSuggestionIds
      .map((templateId) => companionQuickGoalTemplateById.get(templateId))
      .flatMap((template) => template ? [template] : [])
      .map((template) => template.title);
    const addedTasks = (newlyAddedTaskIds ?? [])
      .map((templateId) => companionQuickGoalTemplateById.get(templateId))
      .flatMap((template) => template ? [template] : [])
      .map((template) => template.title);
    const previewing = taskDecision === 'preview' && suggestedTasks.length > 0;
    const added = taskDecision === 'added';
    const alreadyAdded = taskDecision === 'already-added';
    return (
      <CompanionQuestionnaireScene
        accentColor={accentColor}
        background={background}
        bondIconTargetRef={bondIconTargetRef}
        bondProgress={bondProgress}
        bondRewardPulseKey={bondRewardPulseKey}
        companionName={companionName}
        creature={creature}
        environmentKey={environmentKey}
        helperText={presentation === 'conversation'
          ? undefined
          : 'This direction can shape future questions, goals, quests, and reflections.'}
        onBack={onBack}
        presentation={presentation}
        result
        stepLabel="Your direction"
        title={activeFocus?.title ?? 'Your goal plan is ready'}
        visualKey={visualKey}>
        <QuestionnaireResultNotice
          body={alreadyAdded ? 'Those steps were already waiting for you.' : undefined}
          mode={previewing ? 'preview' : added || alreadyAdded ? 'added' : 'saved'}
          tasks={previewing ? suggestedTasks : added ? addedTasks : []}
          title={alreadyAdded ? 'Already in Today' : undefined}
        />
        {previewing ? (
          <>
            <CompanionPrimaryAction
              icon="plus"
              label={`Add ${suggestedTasks.length} to Today`}
              onPress={() => {
                const addedIds = onAddTasks(quickGoalSuggestionIds);
                setNewlyAddedTaskIds(addedIds);
                setTaskDecision(addedIds.length ? 'added' : 'already-added');
              }}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                onDismissTasks();
                setTaskDecision('none');
              }}
              style={({ pressed }) => [styles.resultTextAction, pressed && styles.pressed]}>
              <ThemedText style={styles.resultTextActionLabel} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
                Not now
              </ThemedText>
            </Pressable>
          </>
        ) : (
          <CompanionPrimaryAction
            icon="checkmark"
            label="Done"
            onPress={() => {
              onDismissTasks();
              onDone();
            }}
          />
        )}
      </CompanionQuestionnaireScene>
    );
  }

  if (!conversation || !node) {
    return (
      <CompanionQuestionnaireScene
        accentColor={accentColor}
        background={background}
        bondIconTargetRef={bondIconTargetRef}
        bondProgress={bondProgress}
        bondRewardPulseKey={bondRewardPulseKey}
        companionName={companionName}
        creature={creature}
        environmentKey={environmentKey}
        helperText={presentation === 'conversation' ? undefined : 'Give me a moment to gather the right choices.'}
        onBack={onBack}
        presentation={presentation}
        stepLabel="Set direction"
        visualKey={visualKey}
        title="Preparing your questions…"
      />
    );
  }

  const progress = journeyQuestionnaireProgress(definition, conversation);
  return (
    <CompanionQuestionnaireScene
      accentColor={accentColor}
      background={background}
      bondIconTargetRef={bondIconTargetRef}
      bondProgress={bondProgress}
      bondRewardPulseKey={bondRewardPulseKey}
      companionName={companionName}
      choicePresentation={presentation === 'conversation' ? 'single-column' : 'responsive-grid'}
      creature={creature}
      environmentKey={environmentKey}
      helperText={presentation === 'conversation' ? undefined : node.helperText}
      onBack={onBack}
      onSelect={(option) => onAnswer(conversation.id, option.id)}
      options={(node.options ?? []).map((option) => ({
        id: option.id,
        label: option.label,
        icon: presentation === 'conversation'
          ? undefined
          : companionQuestionnaireOptionIcon(option.id, option.label),
      }))}
      progress={progress.ratio}
      presentation={presentation}
      stepLabel={`Question ${progress.current} of ${progress.total}`}
      title={node.prompt}
      visualKey={visualKey}
    />
  );
}

const styles = StyleSheet.create({
  root: { gap: 14, paddingBottom: 18, paddingHorizontal: 4, paddingTop: 8 },
  heading: { gap: 6, paddingBottom: 4, paddingHorizontal: 4 },
  eyebrow: { fontFamily: AppFontFamilies.manrope, fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  title: { fontFamily: AppFontFamilies.manrope, fontSize: 23, fontWeight: '900', letterSpacing: -0.55, lineHeight: 28 },
  description: { fontFamily: AppFontFamilies.manrope, fontSize: 13, fontWeight: '600', lineHeight: 19 },
  conversationCard: { backgroundColor: 'rgba(255,248,232,0.62)', borderColor: Meadow.goldDeep, borderCurve: 'continuous', borderRadius: 20, borderWidth: 1, gap: 10, padding: 16 },
  conversationLabel: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  conversationLabelText: { fontFamily: AppFontFamilies.manrope, fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  question: { fontFamily: AppFontFamilies.manrope, fontSize: 18, fontWeight: '900', lineHeight: 23 },
  helper: { fontFamily: AppFontFamilies.manrope, fontSize: 12.5, fontWeight: '600', lineHeight: 18 },
  options: { gap: 8, paddingTop: 2 },
  option: { alignItems: 'center', backgroundColor: Meadow.goldSoft, borderCurve: 'continuous', borderRadius: 14, flexDirection: 'row', justifyContent: 'space-between', minHeight: 46, paddingHorizontal: 13 },
  optionText: { flex: 1, fontFamily: AppFontFamilies.manrope, fontSize: 13, fontWeight: '800' },
  customOption: { alignItems: 'center', alignSelf: 'flex-start', borderColor: Meadow.cardBorder, borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 6, minHeight: 38, paddingHorizontal: 12 },
  customOptionOpen: { backgroundColor: 'rgba(255,249,234,0.72)', borderColor: Meadow.goldDeep },
  customOptionText: { fontFamily: AppFontFamilies.manrope, fontSize: 11.5, fontWeight: '800' },
  editor: { gap: 9 },
  input: { backgroundColor: '#FFF9EA', borderColor: Meadow.cardBorder, borderCurve: 'continuous', borderRadius: 14, borderWidth: 1, color: Meadow.ink, fontFamily: AppFontFamilies.manrope, fontSize: 14, minHeight: 92, padding: 12, textAlignVertical: 'top' },
  startCard: { backgroundColor: KatchaUI.companionPanel.cardBackground, borderColor: KatchaUI.companionPanel.cardBorder, borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, boxShadow: KatchaUI.companionPanel.cardShadow, gap: 14, padding: 16 },
  youStartCard: { backgroundColor: KatchaUI.companionPanel.cardBackground, borderColor: KatchaUI.companionPanel.cardBorder },
  startCardPrimary: { borderColor: Meadow.goldDeep, borderWidth: 1.5 },
  startHeading: { alignItems: 'flex-start', flexDirection: 'row', gap: 12 },
  startIcon: { alignItems: 'center', backgroundColor: Meadow.goldSoft, borderRadius: 15, height: 44, justifyContent: 'center', width: 44 },
  youStartIcon: { backgroundColor: 'rgba(128,97,38,0.14)', borderColor: 'rgba(128,97,38,0.24)', borderWidth: 1 },
  suggestionCard: { backgroundColor: 'rgba(255,248,232,0.62)', borderColor: Meadow.goldDeep, borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, gap: 12, padding: 15 },
  suggestionList: { gap: 7 },
  suggestionRow: { alignItems: 'center', backgroundColor: Meadow.goldSoft, borderRadius: 13, flexDirection: 'row', gap: 8, minHeight: 40, paddingHorizontal: 11 },
  startCopy: { gap: 4 },
  startTitle: { fontFamily: AppFontFamilies.manrope, fontSize: 16, fontWeight: '900' },
  resultTextAction: { alignItems: 'center', alignSelf: 'stretch', justifyContent: 'center', minHeight: 44, paddingHorizontal: 14 },
  resultTextActionLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 13, fontWeight: '900' },
  goalsSection: { gap: 9 },
  sectionLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, paddingHorizontal: 4 },
  goalCard: { backgroundColor: KatchaUI.companionPanel.cardBackground, borderColor: KatchaUI.companionPanel.cardBorder, borderCurve: 'continuous', borderRadius: 17, borderWidth: 1, boxShadow: KatchaUI.companionPanel.cardShadow, gap: 10, padding: 14 },
  goalCardPrimary: { backgroundColor: KatchaUI.companionPanel.cardSelected, borderColor: Meadow.goldDeep },
  youGoalCard: { backgroundColor: KatchaUI.companionPanel.cardBackground, borderColor: KatchaUI.companionPanel.cardBorder },
  goalTopRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  goalCopy: { flex: 1, gap: 3 },
  goalMeta: { fontFamily: AppFontFamilies.manrope, fontSize: 9.5, fontWeight: '900', letterSpacing: 0.9 },
  goalTitle: { fontFamily: AppFontFamilies.manrope, fontSize: 14, fontWeight: '800', lineHeight: 19 },
  smallButton: { backgroundColor: 'rgba(255,249,234,0.72)', borderColor: Meadow.cardBorder, borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  smallButtonLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 10, fontWeight: '900' },
  goalActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  goalAction: { alignItems: 'center', borderColor: Meadow.cardBorder, borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 4, minHeight: 32, paddingHorizontal: 9 },
  youGoalAction: { backgroundColor: KatchaUI.companionPanel.softBackground, borderColor: KatchaUI.companionPanel.softBorder },
  goalActionLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '800' },
  progressCard: { backgroundColor: 'rgba(255,248,232,0.54)', borderColor: Meadow.cardBorder, borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, gap: 11, padding: 14 },
  progressHeading: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  progressCopy: { flex: 1, gap: 2 },
  progressEyebrow: { fontFamily: AppFontFamilies.manrope, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  progressTitle: { fontFamily: AppFontFamilies.manrope, fontSize: 15, fontWeight: '900', lineHeight: 20 },
  stageTrack: { flexDirection: 'row', paddingHorizontal: 3 },
  stageItem: { alignItems: 'center', flex: 1, flexDirection: 'row' },
  stageDot: { alignItems: 'center', backgroundColor: '#E8D8BA', borderColor: Meadow.cardBorder, borderRadius: 999, borderWidth: 1, height: 20, justifyContent: 'center', width: 20 },
  stageDotComplete: { backgroundColor: Meadow.leaf, borderColor: Meadow.leafDeep },
  stageDotCurrent: { backgroundColor: Meadow.gold, borderColor: Meadow.goldDeep, borderWidth: 2 },
  stageLine: { backgroundColor: '#D6BF97', flex: 1, height: 2 },
  stageLineComplete: { backgroundColor: Meadow.leaf },
  currentStageRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  currentStageTitle: { fontFamily: AppFontFamilies.manrope, fontSize: 13, fontWeight: '900' },
  stageCountBlock: { alignItems: 'flex-end', gap: 1 },
  stageCountLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 7.5, fontWeight: '900', letterSpacing: 0.7 },
  stageCount: { fontFamily: AppFontFamilies.manrope, fontSize: 13, fontVariant: ['tabular-nums'], fontWeight: '900' },
  checkIn: { borderTopColor: Meadow.cardBorder, borderTopWidth: 1, gap: 10, paddingTop: 11 },
  checkInPrompt: { fontFamily: AppFontFamilies.manrope, fontSize: 14, fontWeight: '900', lineHeight: 19 },
  momentOption: { alignItems: 'center', backgroundColor: Meadow.goldSoft, borderCurve: 'continuous', borderRadius: 13, flexDirection: 'row', gap: 8, justifyContent: 'space-between', minHeight: 43, paddingHorizontal: 12 },
  momentInput: { backgroundColor: '#FFF9EA', borderColor: Meadow.cardBorder, borderCurve: 'continuous', borderRadius: 14, borderWidth: 1, color: Meadow.ink, fontFamily: AppFontFamilies.manrope, fontSize: 14, minHeight: 72, padding: 12, textAlignVertical: 'top' },
  loggedToday: { alignItems: 'center', backgroundColor: 'rgba(111,139,102,0.12)', borderCurve: 'continuous', borderRadius: 13, flexDirection: 'row', gap: 7, minHeight: 40, paddingHorizontal: 12 },
  loggedTodayText: { fontFamily: AppFontFamilies.manrope, fontSize: 12, fontWeight: '900' },
  questContext: { alignItems: 'center', backgroundColor: 'rgba(111,139,102,0.10)', borderColor: 'rgba(78,112,72,0.28)', borderCurve: 'continuous', borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 9, marginBottom: 10, paddingHorizontal: 12, paddingVertical: 10 },
  questContextLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  questContextTitle: { fontFamily: AppFontFamilies.manrope, fontSize: 12, fontWeight: '800' },
  questionnairePage: { flex: 1, gap: 22, minHeight: 560 },
  questionnaireHeader: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  questionnaireBack: { alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.74)', borderColor: Meadow.cardBorder, borderRadius: 999, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
  questionnaireHeaderCopy: { flex: 1, gap: 2 },
  questionnaireEyebrow: { fontFamily: AppFontFamilies.manrope, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  questionnaireStep: { fontFamily: AppFontFamilies.manrope, fontSize: 12, fontWeight: '700' },
  questionnaireTrack: { backgroundColor: 'rgba(155,127,75,0.18)', borderRadius: 999, height: 6, overflow: 'hidden' },
  questionnaireTrackFill: { backgroundColor: Meadow.goldDeep, borderRadius: 999, height: '100%' },
  questionnairePrompt: { gap: 10, paddingTop: 10 },
  questionnaireQuestion: { fontFamily: AppFontFamilies.manrope, fontSize: 30, fontWeight: '900', letterSpacing: -0.8, lineHeight: 37 },
  questionnaireHelper: { fontFamily: AppFontFamilies.manrope, fontSize: 14, fontWeight: '600', lineHeight: 21 },
  questionnaireOptions: { gap: 10 },
  questionnaireOption: { alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.76)', borderColor: Meadow.cardBorder, borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, flexDirection: 'row', gap: 12, justifyContent: 'space-between', minHeight: 64, paddingHorizontal: 17, paddingVertical: 12 },
  questionnaireOptionText: { flex: 1, fontFamily: AppFontFamilies.manrope, fontSize: 15, fontWeight: '800', lineHeight: 21 },
  questionnaireCustom: { alignItems: 'center', alignSelf: 'flex-start', borderColor: Meadow.cardBorder, borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 7, minHeight: 42, paddingHorizontal: 14 },
  questionnaireEditor: { gap: 12 },
  questionnaireInput: { backgroundColor: '#FFF9EA', borderColor: Meadow.cardBorder, borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, color: Meadow.ink, fontFamily: AppFontFamilies.manrope, fontSize: 16, lineHeight: 23, minHeight: 130, padding: 16, textAlignVertical: 'top' },
  questionnaireLoading: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center', minHeight: 520 },
  questionnaireResult: { alignItems: 'center', flex: 1, gap: 22, justifyContent: 'center', minHeight: 580, paddingVertical: 28 },
  resultMark: { alignItems: 'center', backgroundColor: Meadow.leafDeep, borderRadius: 999, height: 72, justifyContent: 'center', width: 72 },
  resultCopy: { alignItems: 'center', gap: 8, maxWidth: 520 },
  resultEyebrow: { fontFamily: AppFontFamilies.manrope, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  resultTitle: { fontFamily: AppFontFamilies.manrope, fontSize: 30, fontWeight: '900', letterSpacing: -0.8, lineHeight: 36, textAlign: 'center' },
  resultFocus: { fontFamily: AppFontFamilies.manrope, fontSize: 18, fontWeight: '900', lineHeight: 25, textAlign: 'center' },
  resultBody: { fontFamily: AppFontFamilies.manrope, fontSize: 14, fontWeight: '600', lineHeight: 21, textAlign: 'center' },
  resultTasks: { alignSelf: 'stretch', gap: 9 },
  resultTask: { alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.76)', borderColor: Meadow.cardBorder, borderCurve: 'continuous', borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 10, minHeight: 54, paddingHorizontal: 13, paddingVertical: 9 },
  resultTaskCheck: { alignItems: 'center', backgroundColor: 'rgba(111,139,102,0.15)', borderRadius: 999, height: 28, justifyContent: 'center', width: 28 },
  resultTaskLabel: { flex: 1, fontFamily: AppFontFamilies.manrope, fontSize: 13, fontWeight: '800', lineHeight: 18 },
  resultTaskMeta: { fontFamily: AppFontFamilies.manrope, fontSize: 8.5, fontWeight: '900', letterSpacing: 0.7 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
});
