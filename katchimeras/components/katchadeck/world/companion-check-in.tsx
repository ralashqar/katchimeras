import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { companionQuickGoalTemplateById } from '@/constants/companion-quick-goals';
import type { CompanionJourneyDefinition } from '@/constants/companion-journeys';
import type { KatchimeraRoleDefinition } from '@/constants/katchimera-roles';
import { Meadow } from '@/constants/meadow-theme';
import { KatchaUI } from '@/constants/katcha-ui';
import type { CompanionReflectionDraft } from '@/types/companion-interaction';
import {
  companionCheckInProgress,
  companionCheckInQuestion,
  companionCheckInSummary,
  type CompanionCheckInOption,
} from '@/utils/companion-check-in';
import type {
  CompanionJourneyCheckIn,
  CompanionJourneyCheckInAnswer,
  CompanionJourneyGoal,
} from '@/utils/companion-journey';
import type { TodayAtmosphereBackground } from '@/utils/day-background-scene';
import {
  companionQuestionnaireOptionIcon,
  type QuestionnaireImageSource,
} from '@/utils/companion-questionnaire-presentation';
import { CompanionReflectionThread } from './companion-reflection-thread';
import {
  CompanionQuestionnaireScene,
  QuestionnaireResultNotice,
} from './companion-questionnaire-scene';
import {
  CompanionPrimaryAction,
  CompanionSecondaryAction,
} from './companion-interaction-primitives';

export function CompanionCheckInCard({
  checkIn,
  companionName,
  onOpen,
}: {
  checkIn: CompanionJourneyCheckIn | null;
  companionName: string;
  onOpen: () => void;
}) {
  const complete = Boolean(checkIn?.completedAt);
  const inProgress = Boolean(checkIn && !complete && checkIn.answers.length);
  return (
    <View style={[styles.card, complete && styles.cardComplete]}>
      <View style={styles.cardTop}>
        <View style={[styles.cardIcon, complete && styles.cardIconComplete]}>
          <IconSymbol color={complete ? Meadow.chipLabel : Meadow.goldDeep} name={complete ? 'checkmark' : 'sparkles'} size={20} />
        </View>
        <View style={styles.flex}>
          <ThemedText style={styles.eyebrow} lightColor={complete ? Meadow.leafDeep : Meadow.goldDeep} darkColor={complete ? Meadow.leafDeep : Meadow.goldDeep}>
            {complete ? 'CHECKED IN TODAY' : 'TODAY'}
          </ThemedText>
          <ThemedText style={styles.cardTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>
            {complete ? 'A moment remembered' : `Check in with ${companionName}`}
          </ThemedText>
          <ThemedText numberOfLines={complete ? 3 : 2} style={styles.body} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
            {complete
              ? companionCheckInSummary(checkIn!)
              : inProgress
                ? `Question ${checkIn!.answers.length + 1} of 3. Your answers are saved.`
                : 'Three quick choices about this part of life. No writing required.'}
          </ThemedText>
        </View>
      </View>
      <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.cardButton, pressed && styles.pressed]}>
        <ThemedText style={styles.cardButtonLabel} lightColor={Meadow.ink} darkColor={Meadow.ink}>
          {complete ? 'View check-in' : inProgress ? 'Continue' : 'Start check-in'}
        </ThemedText>
        <IconSymbol color={Meadow.ink} name="arrow.right" size={16} />
      </Pressable>
    </View>
  );
}

export function CompanionCheckInPage({
  checkIn,
  accentColor,
  background,
  companionName,
  creature,
  definition,
  goal,
  onAddTasks,
  onAnswer,
  onBack,
  onBackQuestion,
  onSaveNote,
  onSetTaskStatus,
  role,
}: {
  checkIn: CompanionJourneyCheckIn;
  accentColor: string;
  background: TodayAtmosphereBackground;
  companionName: string;
  creature: QuestionnaireImageSource;
  definition: CompanionJourneyDefinition | null;
  goal: CompanionJourneyGoal | null;
  onAddTasks: (templateIds: readonly string[]) => readonly string[];
  onAnswer: (
    checkInId: string,
    answer: Omit<CompanionJourneyCheckInAnswer, 'answeredAt'>
  ) => CompanionJourneyCheckIn | null;
  onBack: () => void;
  onBackQuestion: (checkInId: string) => void;
  onEdit: (checkInId: string) => void;
  onSaveNote: (checkIn: CompanionJourneyCheckIn, draft: CompanionReflectionDraft | null) => void;
  onSetTaskStatus: (checkInId: string, status: 'added' | 'dismissed') => void;
  role: KatchimeraRoleDefinition | null;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [draft, setDraft] = useState<CompanionReflectionDraft | null>(null);
  const [newlyAddedTaskIds, setNewlyAddedTaskIds] = useState<readonly string[] | null>(null);
  const autoAddedCheckInRef = useRef<string | null>(null);
  const question = companionCheckInQuestion({ checkIn, definition, role, goal });
  const progress = companionCheckInProgress(checkIn);
  const suggestions = useMemo(
    () => checkIn.suggestedQuickGoalIds
      .map((id) => companionQuickGoalTemplateById.get(id))
      .flatMap((template) => template ? [template] : []),
    [checkIn.suggestedQuickGoalIds]
  );
  useEffect(() => {
    setDetailOpen(false);
    setDraft(null);
    setNewlyAddedTaskIds(null);
  }, [checkIn.id, checkIn.completedAt]);

  useEffect(() => {
    if (
      !checkIn.completedAt ||
      !checkIn.suggestedQuickGoalIds.length ||
      checkIn.taskSuggestionStatus !== 'pending' ||
      autoAddedCheckInRef.current === checkIn.id
    ) {
      return;
    }
    autoAddedCheckInRef.current = checkIn.id;
    setNewlyAddedTaskIds(onAddTasks(checkIn.suggestedQuickGoalIds));
    onSetTaskStatus(checkIn.id, 'added');
  }, [
    checkIn.completedAt,
    checkIn.id,
    checkIn.suggestedQuickGoalIds,
    checkIn.taskSuggestionStatus,
    onAddTasks,
    onSetTaskStatus,
  ]);
  const displayedTasks = suggestions
    .filter((template) => newlyAddedTaskIds !== null
      ? newlyAddedTaskIds.includes(template.id)
      : checkIn.taskSuggestionStatus === 'added')
    .map((template) => template.title);

  const answer = (option: CompanionCheckInOption) => {
    if (!question) return;
    const updated = onAnswer(checkIn.id, {
      questionId: question.id,
      optionId: option.id,
      label: option.label,
      suggestsTasks: option.suggestsTasks,
    });
    if (updated?.completedAt) onSaveNote(updated, null);
  };

  if (checkIn.completedAt) {
    return (
      <CompanionQuestionnaireScene
        accentColor={accentColor}
        background={background}
        companionName={companionName}
        creature={creature}
        helperText={displayedTasks.length
          ? 'I turned your answers into a few gentle steps for today.'
          : 'I’ll remember what you shared for next time.'}
        onBack={onBack}
        result
        stepLabel="Today’s check-in"
        title="All set for today">

        <QuestionnaireResultNotice tasks={displayedTasks} />

        {detailOpen ? (
          <View style={styles.detail}>
            <CompanionReflectionThread
              initialDraft={draft}
              onDraftChange={setDraft}
              promptId={`companion-check-in-note:${checkIn.id}`}
              promptText="Anything else you want to remember? This is optional."
            />
            <CompanionPrimaryAction
              disabled={!draft?.text.trim() && !draft?.audioUri}
              icon="checkmark"
              label="Save detail"
              onPress={() => {
                onSaveNote(checkIn, draft);
                setDetailOpen(false);
              }}
            />
          </View>
        ) : (
          <CompanionSecondaryAction
            icon="mic.fill"
            label="Add an optional note"
            onPress={() => setDetailOpen(true)}
          />
        )}

        <CompanionPrimaryAction icon="checkmark" label="Done" onPress={onBack} />
      </CompanionQuestionnaireScene>
    );
  }

  if (!question) return null;
  return (
    <CompanionQuestionnaireScene
      accentColor={accentColor}
      background={background}
      companionName={companionName}
      creature={creature}
      helperText={question.helperText}
      onBack={checkIn.answers.length ? () => onBackQuestion(checkIn.id) : onBack}
      onSelect={(option) => {
        const source = question.options.find((candidate) => candidate.id === option.id);
        if (source) answer(source);
      }}
      options={question.options.map((option) => ({
        id: option.id,
        label: option.label,
        icon: companionQuestionnaireOptionIcon(option.id, option.label),
      }))}
      progress={progress.ratio}
      stepLabel={`Question ${progress.current} of ${progress.total}`}
      title={question.prompt}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  card: { backgroundColor: 'rgba(255,248,232,0.62)', borderColor: Meadow.cardBorder, borderCurve: 'continuous', borderRadius: 22, borderWidth: 1, gap: 14, padding: 16 },
  cardComplete: { backgroundColor: 'rgba(91,132,91,0.09)', borderColor: 'rgba(91,132,91,0.25)' },
  cardTop: { alignItems: 'flex-start', flexDirection: 'row', gap: 12 },
  cardIcon: { alignItems: 'center', backgroundColor: 'rgba(231,185,81,0.18)', borderRadius: 15, height: 44, justifyContent: 'center', width: 44 },
  cardIconComplete: { backgroundColor: Meadow.leafDeep },
  eyebrow: { ...KatchaUI.type.meta, fontSize: 10.5, fontWeight: '900', letterSpacing: 1.2 },
  cardTitle: { ...KatchaUI.type.sectionTitle, fontSize: 18, lineHeight: 23, marginTop: 3 },
  body: { ...KatchaUI.type.companionBody, fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  cardButton: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: 'rgba(231,185,81,0.18)', borderRadius: 14, flexDirection: 'row', justifyContent: 'center', minHeight: 44, paddingHorizontal: 14 },
  cardButtonLabel: { ...KatchaUI.type.companionAction, fontSize: 13, fontWeight: '900', marginRight: 7 },
  page: { gap: 18, paddingBottom: 28 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  back: { alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.62)', borderColor: Meadow.cardBorder, borderRadius: 999, borderWidth: 1, height: 42, justifyContent: 'center', width: 42 },
  headerMeta: { fontSize: 12, fontWeight: '800', marginTop: 2 },
  track: { backgroundColor: 'rgba(116,88,52,0.13)', borderRadius: 999, height: 7, overflow: 'hidden' },
  trackFill: { backgroundColor: Meadow.goldDeep, borderRadius: 999, height: '100%' },
  prompt: { gap: 8, paddingTop: 10 },
  question: { fontSize: 27, fontWeight: '900', letterSpacing: -0.5, lineHeight: 34 },
  helper: { fontSize: 14, lineHeight: 21 },
  options: { gap: 10 },
  option: { alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.70)', borderColor: Meadow.cardBorder, borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, flexDirection: 'row', gap: 12, minHeight: 62, paddingHorizontal: 16, paddingVertical: 12 },
  optionPressed: { backgroundColor: 'rgba(231,185,81,0.18)', borderColor: Meadow.goldDeep, transform: [{ scale: 0.99 }] },
  optionLabel: { flex: 1, fontSize: 15, fontWeight: '800', lineHeight: 21 },
  result: { alignItems: 'center', gap: 9, paddingHorizontal: 12, paddingVertical: 4 },
  resultMark: { alignItems: 'center', backgroundColor: Meadow.leafDeep, borderRadius: 999, height: 54, justifyContent: 'center', width: 54 },
  resultTitle: { fontSize: 26, fontWeight: '900', letterSpacing: -0.4 },
  resultBody: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  answerList: { gap: 8 },
  answerRow: { alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.52)', borderRadius: 15, flexDirection: 'row', gap: 11, padding: 12 },
  answerNumber: { alignItems: 'center', backgroundColor: 'rgba(231,185,81,0.18)', borderRadius: 999, height: 27, justifyContent: 'center', width: 27 },
  answerNumberText: { ...KatchaUI.type.meta, fontSize: 11, fontWeight: '900' },
  answerLabel: { ...KatchaUI.type.companionAction, flex: 1, fontSize: 13.5, lineHeight: 19 },
  taskCard: { backgroundColor: 'rgba(231,185,81,0.12)', borderColor: 'rgba(160,113,30,0.20)', borderCurve: 'continuous', borderRadius: 20, borderWidth: 1, gap: 10, padding: 15 },
  taskTitle: { ...KatchaUI.type.sectionTitle, fontSize: 17, lineHeight: 22 },
  taskRow: { alignItems: 'center', flexDirection: 'row', gap: 9, paddingVertical: 3 },
  taskLabel: { ...KatchaUI.type.companionAction, flex: 1, fontSize: 13.5 },
  primary: { alignItems: 'center', backgroundColor: Meadow.goldDeep, borderRadius: 15, flexDirection: 'row', gap: 7, justifyContent: 'center', minHeight: 48, paddingHorizontal: 16 },
  primaryLabel: { ...KatchaUI.type.companionAction, fontSize: 13.5, fontWeight: '900' },
  secondary: { alignItems: 'center', borderColor: Meadow.cardBorder, borderRadius: 15, borderWidth: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 46, paddingHorizontal: 14 },
  secondaryLabel: { ...KatchaUI.type.companionAction, fontSize: 12.5 },
  textButton: { alignItems: 'center', alignSelf: 'center', flexDirection: 'row', gap: 6, minHeight: 38, paddingHorizontal: 10 },
  textButtonLabel: { ...KatchaUI.type.companionAction, fontSize: 12.5 },
  statusRow: { alignItems: 'center', backgroundColor: 'rgba(91,132,91,0.09)', borderRadius: 14, flexDirection: 'row', gap: 8, padding: 12 },
  statusText: { ...KatchaUI.type.companionAction, flex: 1, fontSize: 12.5 },
  detail: { gap: 12 },
  pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.45 },
});
