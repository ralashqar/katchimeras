import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  type CompanionJourneyConversationNode,
  type CompanionJourneyDefinition,
  type CompanionJourneyGoalStatus,
} from '@/constants/companion-journeys';
import { AppFontFamilies } from '@/constants/theme';
import { KatchaUI } from '@/constants/katcha-ui';
import { Meadow } from '@/constants/meadow-theme';
import type { HomeVisualKey } from '@/types/home';
import {
  type CompanionGoalJourneyProgress,
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
import {
  CompanionQuestionnaireScene,
  QuestionnaireResultNotice,
} from './companion-questionnaire-scene';
import { CompanionPrimaryAction } from './companion-interaction-primitives';

export function CompanionJourneyDiscoveryThread({
  companionName,
  conversation,
  definition,
  goals,
  onOpenQuestionnaire,
  onSetGoalStatus,
  showHeading = true,
}: {
  companionName: string;
  conversation: CompanionJourneyConversationSession | null;
  definition: CompanionJourneyDefinition;
  goals: readonly CompanionJourneyGoal[];
  onOpenQuestionnaire: () => void;
  onSetGoalStatus: (goalId: string, status: CompanionJourneyGoalStatus) => void;
  showHeading?: boolean;
}) {
  const activeFocus = goals.find((goal) => goal.status === 'active' && goal.isPrimary)
    ?? goals.find((goal) => goal.status === 'active')
    ?? null;
  const focusCard = activeFocus ? (
    <View style={[styles.goalCard, styles.youGoalCard]}>
      <View style={styles.goalTopRow}>
        <View style={styles.goalCopy}>
          <ThemedText style={styles.goalMeta} lightColor="#806126" darkColor="#806126">
            YOUR CURRENT FOCUS
          </ThemedText>
          <ThemedText selectable style={styles.goalTitle} lightColor={KatchaUI.companionPanel.ink} darkColor={KatchaUI.companionPanel.ink}>
            {activeFocus.title}
          </ThemedText>
        </View>
      </View>
      <View style={styles.goalActions}>
        <GoalAction icon="pause.fill" label="Pause" night onPress={() => onSetGoalStatus(activeFocus.id, 'paused')} />
        <GoalAction icon="checkmark" label="Complete" night onPress={() => onSetGoalStatus(activeFocus.id, 'completed')} />
      </View>
    </View>
  ) : null;
  const startCard = (
    <View style={[styles.startCard, styles.youStartCard, !activeFocus && styles.startCardPrimary]}>
      <View style={styles.startHeading}>
        <View style={[styles.startIcon, styles.youStartIcon]}>
          <IconSymbol color="#806126" name="bubble.left.and.bubble.right.fill" size={22} />
        </View>
        <View style={styles.startCopy}>
          <ThemedText style={styles.startTitle} lightColor={KatchaUI.companionPanel.ink} darkColor={KatchaUI.companionPanel.ink}>
            {conversation ? 'Continue where you left off' : activeFocus ? 'Choose a different focus' : 'Choose your first focus'}
          </ThemedText>
          <ThemedText style={styles.helper} lightColor={KatchaUI.companionPanel.inkSoft} darkColor={KatchaUI.companionPanel.inkSoft}>
            {conversation
              ? 'Your completed answers are saved.'
              : activeFocus
                ? 'I’ll ask three quick questions about a new direction. Your current focus stays until you finish.'
                : 'I’ll ask three quick questions, then help you choose a direction that fits.'}
          </ThemedText>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onOpenQuestionnaire}
        style={({ pressed }) => [styles.primaryButton, styles.startButton, pressed && styles.pressed]}>
        <ThemedText style={styles.primaryButtonLabel} lightColor={Meadow.chipLabel} darkColor={Meadow.chipLabel}>
          {conversation ? 'Continue' : definition.conversationStartLabel}
        </ThemedText>
        <IconSymbol color={Meadow.chipLabel} name="arrow.right" size={17} />
      </Pressable>
    </View>
  );

  return (
    <View style={styles.root}>
      {showHeading ? <View style={styles.heading}>
        <ThemedText selectable style={styles.eyebrow} lightColor={Meadow.goldDeep} darkColor={Meadow.goldDeep}>
          YOU &amp; {companionName.toUpperCase()}
        </ThemedText>
        <ThemedText selectable style={styles.title} lightColor={Meadow.ink} darkColor={Meadow.ink}>
          Your focus
        </ThemedText>
        <ThemedText selectable style={styles.description} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
          Answer a few quick questions when you want more direction. I’ll turn them into a focus and suggest optional small steps.
        </ThemedText>
      </View> : null}

      {conversation ? startCard : focusCard}
      {conversation ? focusCard : startCard}
    </View>
  );
}

type JourneyActions = {
  onAnswer: (sessionId: string, value: string) => void;
  onLogMoment: (kindId: string, note?: string) => void;
  onSetGoalStatus: (goalId: string, status: CompanionJourneyGoalStatus) => void;
  onSetPrimaryGoal: (goalId: string) => void;
  onStart: () => void;
};

export function LegacyCompanionJourneyDiscoveryThread({
  companionName,
  conversation,
  definition,
  goals,
  momentLoggedToday,
  node,
  onAnswer,
  onLogMoment,
  onSetGoalStatus,
  onSetPrimaryGoal,
  onStart,
  progress,
  quickGoalSuggestionIds = [],
  onAddQuickGoalSuggestions,
  onDismissQuickGoalSuggestions,
}: JourneyActions & {
  companionName: string;
  conversation: CompanionJourneyConversationSession | null;
  definition: CompanionJourneyDefinition;
  goals: readonly CompanionJourneyGoal[];
  momentLoggedToday: boolean;
  node: CompanionJourneyConversationNode | null;
  progress: CompanionGoalJourneyProgress | null;
  quickGoalSuggestionIds?: readonly string[];
  onAddQuickGoalSuggestions?: (templateIds: readonly string[]) => void;
  onDismissQuickGoalSuggestions?: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [customTextOpen, setCustomTextOpen] = useState(false);
  const activeFocus = goals.find((goal) => goal.status === 'active' && goal.isPrimary)
    ?? goals.find((goal) => goal.status === 'active')
    ?? null;

  useEffect(() => {
    setDraft('');
    setCustomTextOpen(false);
  }, [node?.id]);

  const answer = (value: string) => {
    if (!conversation || !value.trim()) return;
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    onAnswer(conversation.id, value);
    setDraft('');
  };

  return (
    <View style={styles.root}>
      <View style={styles.heading}>
        <ThemedText selectable style={styles.eyebrow} lightColor={Meadow.goldDeep} darkColor={Meadow.goldDeep}>
          YOU &amp; {companionName.toUpperCase()}
        </ThemedText>
        <ThemedText selectable style={styles.title} lightColor={Meadow.ink} darkColor={Meadow.ink}>
          Your focus
        </ThemedText>
        <ThemedText selectable style={styles.description} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
          I’ll ask a few deeper questions about what matters. Your focus can then shape optional goals, quests, and reflections.
        </ThemedText>
      </View>

      {activeFocus ? (
        <View style={[styles.goalCard, styles.goalCardPrimary]}>
          <View style={styles.goalTopRow}>
            <View style={styles.goalCopy}>
              <ThemedText style={styles.goalMeta} lightColor={Meadow.leafDeep} darkColor={Meadow.leafDeep}>
                CURRENT FOCUS
              </ThemedText>
              <ThemedText selectable style={styles.goalTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>
                {activeFocus.title}
              </ThemedText>
            </View>
          </View>
          <View style={styles.goalActions}>
            <GoalAction icon="pause.fill" label="Pause" onPress={() => onSetGoalStatus(activeFocus.id, 'paused')} />
            <GoalAction icon="checkmark" label="Complete" onPress={() => onSetGoalStatus(activeFocus.id, 'completed')} />
          </View>
        </View>
      ) : null}

      {conversation && node ? (
        <View style={styles.conversationCard}>
          <View style={styles.conversationLabel}>
            <IconSymbol color={Meadow.goldDeep} name="bubble.left.and.bubble.right.fill" size={16} />
            <ThemedText style={styles.conversationLabelText} lightColor={Meadow.goldDeep} darkColor={Meadow.goldDeep}>
              {definition.conversationTitle}
            </ThemedText>
          </View>
          <ThemedText selectable style={styles.question} lightColor={Meadow.ink} darkColor={Meadow.ink}>
            {node.prompt}
          </ThemedText>
          <ThemedText selectable style={styles.helper} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
            {node.helperText}
          </ThemedText>
          {node.kind === 'single_choice' ? (
            <>
              <View style={styles.options}>
                {(node.options ?? []).map((option) => (
                  <Pressable
                    accessibilityRole="button"
                    key={option.id}
                    onPress={() => answer(option.id)}
                    style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
                    <ThemedText style={styles.optionText} lightColor={Meadow.ink} darkColor={Meadow.ink}>
                      {option.label}
                    </ThemedText>
                    <IconSymbol color={Meadow.goldDeep} name="chevron.right" size={17} />
                  </Pressable>
                ))}
                {node.allowCustomText ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: customTextOpen }}
                    onPress={() => setCustomTextOpen((current) => !current)}
                    style={({ pressed }) => [styles.customOption, customTextOpen && styles.customOptionOpen, pressed && styles.pressed]}>
                    <IconSymbol color={Meadow.inkSoft} name="pencil" size={16} />
                    <ThemedText style={styles.customOptionText} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
                      Write my own
                    </ThemedText>
                  </Pressable>
                ) : null}
              </View>
              {node.allowCustomText && customTextOpen ? (
                <View style={styles.editor}>
                  <TextInput
                    accessibilityLabel="Write your own direction"
                    autoFocus
                    multiline
                    onChangeText={setDraft}
                    placeholder="A direction that fits me…"
                    placeholderTextColor={Meadow.inkFaint}
                    style={styles.input}
                    value={draft}
                  />
                  <Pressable
                    accessibilityRole="button"
                    disabled={!draft.trim()}
                    onPress={() => answer(draft)}
                    style={({ pressed }) => [styles.primaryButton, !draft.trim() && styles.disabled, pressed && styles.pressed]}>
                    <ThemedText style={styles.primaryButtonLabel} lightColor={Meadow.chipLabel} darkColor={Meadow.chipLabel}>
                      Use my answer
                    </ThemedText>
                    <IconSymbol color={Meadow.chipLabel} name="arrow.right" size={17} />
                  </Pressable>
                </View>
              ) : null}
            </>
          ) : (
            <View style={styles.editor}>
              <TextInput
                accessibilityLabel={node.prompt}
                multiline
                onChangeText={setDraft}
                placeholder="Write what you want to remember…"
                placeholderTextColor={Meadow.inkFaint}
                style={styles.input}
                value={draft}
              />
              <Pressable
                accessibilityRole="button"
                disabled={!draft.trim()}
                onPress={() => answer(draft)}
                style={({ pressed }) => [styles.primaryButton, !draft.trim() && styles.disabled, pressed && styles.pressed]}>
                <ThemedText style={styles.primaryButtonLabel} lightColor={Meadow.chipLabel} darkColor={Meadow.chipLabel}>
                  Keep this direction
                </ThemedText>
                <IconSymbol color={Meadow.chipLabel} name="arrow.right" size={17} />
              </Pressable>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.startCard}>
          <View style={styles.startCopy}>
            <ThemedText style={styles.startTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>
              {activeFocus ? 'Change your focus' : 'Choose a focus'}
            </ThemedText>
            <ThemedText style={styles.helper} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
              I’ll ask a short set of questions, then suggest a direction and a few small goals. Choosing a new focus pauses the old one.
            </ThemedText>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onStart}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <IconSymbol color={Meadow.chipLabel} name="sparkles" size={17} />
            <ThemedText style={styles.primaryButtonLabel} lightColor={Meadow.chipLabel} darkColor={Meadow.chipLabel}>
              {definition.conversationStartLabel}
            </ThemedText>
          </Pressable>
        </View>
      )}

      {quickGoalSuggestionIds.length ? (
        <View style={styles.suggestionCard}>
          <View style={styles.startCopy}>
            <ThemedText style={styles.startTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>
              Turn this into small goals?
            </ThemedText>
            <ThemedText style={styles.helper} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
              These are optional, tappable actions for the Do tab.
            </ThemedText>
          </View>
          <View style={styles.suggestionList}>
            {quickGoalSuggestionIds.map((templateId) => {
              const template = companionQuickGoalTemplateById.get(templateId);
              return template ? (
                <View key={template.id} style={styles.suggestionRow}>
                  <IconSymbol color={Meadow.goldDeep} name="checkmark" size={14} />
                  <ThemedText style={styles.optionText} lightColor={Meadow.ink} darkColor={Meadow.ink}>
                    {template.title}
                  </ThemedText>
                </View>
              ) : null;
            })}
          </View>
          <View style={styles.goalActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => onAddQuickGoalSuggestions?.(quickGoalSuggestionIds)}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <ThemedText style={styles.primaryButtonLabel} lightColor={Meadow.chipLabel} darkColor={Meadow.chipLabel}>
                Add these goals
              </ThemedText>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onDismissQuickGoalSuggestions} style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}>
              <ThemedText style={styles.smallButtonLabel} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
                Not now
              </ThemedText>
            </Pressable>
          </View>
        </View>
      ) : null}

    </View>
  );
}

export function CompanionJourneyQuestionnairePage({
  accentColor,
  background,
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
  onDismissTasks,
  onViewTasks,
  quickGoalSuggestionIds,
  resultReady,
  visualKey,
}: {
  accentColor: string;
  background: TodayAtmosphereBackground;
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
  onDismissTasks: () => void;
  onViewTasks: () => void;
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
        companionName={companionName}
        creature={creature}
        environmentKey={environmentKey}
        helperText="This direction can shape future questions, quests, and reflections."
        onBack={onBack}
        result
        stepLabel="Your direction"
        title={activeFocus?.title ?? 'Your focus is ready'}
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
                onBack();
              }}
              style={({ pressed }) => [styles.resultTextAction, pressed && styles.pressed]}>
              <ThemedText style={styles.resultTextActionLabel} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
                Not now
              </ThemedText>
            </Pressable>
          </>
        ) : (
          <CompanionPrimaryAction
            icon={added || alreadyAdded ? 'arrow.right' : 'checkmark'}
            label={added || alreadyAdded ? 'View tasks' : 'Done'}
            onPress={added || alreadyAdded ? onViewTasks : onBack}
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
        companionName={companionName}
        creature={creature}
        environmentKey={environmentKey}
        helperText="Give me a moment to gather the right choices."
        onBack={onBack}
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
      companionName={companionName}
      creature={creature}
      environmentKey={environmentKey}
      helperText={node.helperText}
      onBack={onBack}
      onSelect={(option) => onAnswer(conversation.id, option.id)}
      options={(node.options ?? []).map((option) => ({
        id: option.id,
        label: option.label,
        icon: companionQuestionnaireOptionIcon(option.id, option.label),
      }))}
      progress={progress.ratio}
      stepLabel={`Question ${progress.current} of ${progress.total}`}
      title={node.prompt}
      visualKey={visualKey}
    />
  );
}

function GoalAction({
  icon,
  label,
  night = false,
  onPress,
}: {
  icon: 'pause.fill' | 'checkmark' | 'xmark' | 'play.fill';
  label: string;
  night?: boolean;
  onPress: () => void;
}) {
  const color = Meadow.inkSoft;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.goalAction, night && styles.youGoalAction, pressed && styles.pressed]}>
      <IconSymbol color={color} name={icon} size={14} />
      <ThemedText style={styles.goalActionLabel} lightColor={color} darkColor={color}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function CompanionJourneyProgressCard({
  definition,
  momentLoggedToday = false,
  onLogMoment,
  progress,
  showCheckIn = false,
}: {
  definition: CompanionJourneyDefinition | null;
  momentLoggedToday?: boolean;
  onLogMoment?: (kindId: string, note?: string) => void;
  progress: CompanionGoalJourneyProgress | null;
  showCheckIn?: boolean;
}) {
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [customMomentOpen, setCustomMomentOpen] = useState(false);
  const [momentNote, setMomentNote] = useState('');

  useEffect(() => {
    setCheckInOpen(false);
    setCustomMomentOpen(false);
    setMomentNote('');
  }, [progress?.goal.id, momentLoggedToday]);

  if (!definition || !progress) return null;
  return (
    <View style={styles.progressCard}>
      <View style={styles.progressHeading}>
        <IconSymbol color={Meadow.goldDeep} name="scope" size={18} />
        <View style={styles.progressCopy}>
          <ThemedText style={styles.progressEyebrow} lightColor={Meadow.goldDeep} darkColor={Meadow.goldDeep}>
            CURRENT GOAL
          </ThemedText>
          <ThemedText selectable numberOfLines={2} style={styles.progressTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>
            {progress.goal.title}
          </ThemedText>
        </View>
      </View>
      <View style={styles.stageTrack}>
        {progress.stages.map((stage, index) => (
          <View key={stage.id} style={styles.stageItem}>
            <View style={[
              styles.stageDot,
              stage.complete && styles.stageDotComplete,
              stage.currentStage && !stage.complete && styles.stageDotCurrent,
            ]}>
              {stage.complete ? <IconSymbol color={Meadow.chipLabel} name="checkmark" size={11} /> : null}
            </View>
            {index < progress.stages.length - 1 ? (
              <View style={[styles.stageLine, stage.complete && styles.stageLineComplete]} />
            ) : null}
          </View>
        ))}
      </View>
      <View style={styles.currentStageRow}>
        <View style={styles.progressCopy}>
          <ThemedText style={styles.currentStageTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>
            {progress.currentStage.title}
          </ThemedText>
          <ThemedText style={styles.helper} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
            {progress.currentStage.description}
          </ThemedText>
        </View>
        <View style={styles.stageCountBlock}>
          {progress.currentStage.requirementKind === 'quest_completions' ? (
            <ThemedText style={styles.stageCountLabel} lightColor={Meadow.inkFaint} darkColor={Meadow.inkFaint}>
              MOMENTS NOTICED
            </ThemedText>
          ) : null}
          <ThemedText style={styles.stageCount} lightColor={Meadow.goldDeep} darkColor={Meadow.goldDeep}>
            {progress.currentStage.current} of {progress.currentStage.target}
          </ThemedText>
        </View>
      </View>
      {showCheckIn && progress.goal.status === 'active' ? (
        momentLoggedToday ? (
          <View style={styles.loggedToday}>
            <IconSymbol color={Meadow.leafDeep} name="checkmark" size={17} />
            <ThemedText style={styles.loggedTodayText} lightColor={Meadow.leafDeep} darkColor={Meadow.leafDeep}>
              Today&apos;s moment is logged
            </ThemedText>
          </View>
        ) : checkInOpen ? (
          <View style={styles.checkIn}>
            <ThemedText selectable style={styles.checkInPrompt} lightColor={Meadow.ink} darkColor={Meadow.ink}>
              {definition.checkIn.prompt}
            </ThemedText>
            <View style={styles.options}>
              {definition.checkIn.options.map((option) => (
                <Pressable
                  accessibilityRole="button"
                  key={option.id}
                  onPress={() => {
                    if (option.id === 'other') {
                      setCustomMomentOpen(true);
                      return;
                    }
                    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
                    onLogMoment?.(option.id);
                  }}
                  style={({ pressed }) => [styles.momentOption, pressed && styles.pressed]}>
                  <ThemedText style={styles.optionText} lightColor={Meadow.ink} darkColor={Meadow.ink}>
                    {option.label}
                  </ThemedText>
                  <IconSymbol color={Meadow.goldDeep} name={option.id === 'other' ? 'pencil' : 'plus'} size={15} />
                </Pressable>
              ))}
            </View>
            {customMomentOpen ? (
              <View style={styles.editor}>
                <TextInput
                  accessibilityLabel="Describe what you noticed"
                  autoFocus
                  multiline
                  onChangeText={setMomentNote}
                  placeholder="What did you notice?"
                  placeholderTextColor={Meadow.inkFaint}
                  style={styles.momentInput}
                  value={momentNote}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={!momentNote.trim()}
                  onPress={() => onLogMoment?.('other', momentNote)}
                  style={({ pressed }) => [styles.primaryButton, !momentNote.trim() && styles.disabled, pressed && styles.pressed]}>
                  <ThemedText style={styles.primaryButtonLabel} lightColor={Meadow.chipLabel} darkColor={Meadow.chipLabel}>
                    Log this moment
                  </ThemedText>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => setCheckInOpen(true)}
            style={({ pressed }) => [styles.logMomentButton, pressed && styles.pressed]}>
            <IconSymbol color={Meadow.chipLabel} name="plus" size={16} />
            <ThemedText style={styles.primaryButtonLabel} lightColor={Meadow.chipLabel} darkColor={Meadow.chipLabel}>
              Log a moment
            </ThemedText>
          </Pressable>
        )
      ) : null}
    </View>
  );
}

export function CompanionJourneyQuestContext({
  advancesGoal,
  loggedToday,
  progress,
}: {
  advancesGoal: boolean;
  loggedToday: boolean;
  progress: CompanionGoalJourneyProgress | null;
}) {
  if (!advancesGoal || !progress) return null;
  return (
    <View style={styles.questContext}>
      <IconSymbol color={Meadow.leafDeep} name="arrow.right" size={15} />
      <View style={styles.progressCopy}>
        <ThemedText style={styles.questContextLabel} lightColor={Meadow.leafDeep} darkColor={Meadow.leafDeep}>
          {loggedToday ? 'TODAY’S GOAL MOMENT IS LOGGED' : 'ADVANCES YOUR CURRENT GOAL'}
        </ThemedText>
        <ThemedText numberOfLines={1} style={styles.questContextTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>
          {progress.goal.title}
        </ThemedText>
      </View>
    </View>
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
  primaryButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: Meadow.goldDeep, borderCurve: 'continuous', borderRadius: 14, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 44, paddingHorizontal: 14 },
  primaryButtonLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 12.5, fontWeight: '900' },
  startCard: { backgroundColor: KatchaUI.companionPanel.cardBackground, borderColor: KatchaUI.companionPanel.cardBorder, borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, boxShadow: KatchaUI.companionPanel.cardShadow, gap: 14, padding: 16 },
  youStartCard: { backgroundColor: KatchaUI.companionPanel.cardBackground, borderColor: KatchaUI.companionPanel.cardBorder },
  startCardPrimary: { borderColor: Meadow.goldDeep, borderWidth: 1.5 },
  startHeading: { alignItems: 'flex-start', flexDirection: 'row', gap: 12 },
  startIcon: { alignItems: 'center', backgroundColor: Meadow.goldSoft, borderRadius: 15, height: 44, justifyContent: 'center', width: 44 },
  youStartIcon: { backgroundColor: 'rgba(128,97,38,0.14)', borderColor: 'rgba(128,97,38,0.24)', borderWidth: 1 },
  startButton: { alignSelf: 'stretch' },
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
  logMomentButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: Meadow.leafDeep, borderCurve: 'continuous', borderRadius: 14, flexDirection: 'row', gap: 7, minHeight: 42, paddingHorizontal: 13 },
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
  questionnaireOptionPressed: { backgroundColor: Meadow.goldSoft, borderColor: Meadow.goldDeep, transform: [{ scale: 0.99 }] },
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
  resultActions: { alignSelf: 'stretch', gap: 8 },
  resultPrimaryButton: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: Meadow.goldDeep, borderCurve: 'continuous', borderRadius: 16, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 52, paddingHorizontal: 16 },
  resultPrimaryLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 14, fontWeight: '900' },
  resultSecondaryButton: { alignItems: 'center', alignSelf: 'stretch', justifyContent: 'center', minHeight: 44 },
  resultSecondaryLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 12, fontWeight: '800' },
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
});
