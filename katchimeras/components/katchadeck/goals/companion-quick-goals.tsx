import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeInUp,
  LinearTransition,
  ZoomIn,
  ZoomOut,
  useReducedMotion,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QuickGoalActionModal } from '@/components/katchadeck/goals/quick-goal-action-modal';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { quickGoalTemplatesForFamily } from '@/constants/companion-quick-goals';
import { katchimeraFamilyById } from '@/constants/katchimera-skins';
import { KatchaUI } from '@/constants/katcha-ui';
import { Meadow } from '@/constants/meadow-theme';
import { AppFontFamilies, Lantern } from '@/constants/theme';
import type { KatchimeraFamilyId } from '@/types/katchimera';
import { resolveCreatureArtSource } from '@/utils/creature-art';
import {
  cadenceFromTemplate,
  quickGoalCadenceLabel,
  quickGoalsForDay,
  type CompanionQuickGoal,
  type CompanionQuickGoalCadence,
  type CompanionQuickGoalCompletion,
  type CompanionQuickGoalForDay,
  type CompanionQuickGoalState,
  type CompanionQuickGoalStatus,
} from '@/utils/companion-quick-goals';

type QuickGoalActions = {
  onAddTemplate: (templateId: string) => { added: boolean; reason: string | null };
  onAddCustom: (
    familyId: KatchimeraFamilyId,
    title: string,
    cadence: CompanionQuickGoalCadence
  ) => { added: boolean; reason: string | null };
  onEditGoal: (
    goalId: string,
    updates: {
      title?: string;
      cadence?: CompanionQuickGoalCadence;
      status?: CompanionQuickGoalStatus;
    }
  ) => void;
  onCompleteGoal: (goalId: string) => CompanionQuickGoalCompletion | null;
  onUndoGoal: (goalId: string) => boolean;
  onSnoozeGoal: (goalId: string) => boolean;
  onSkipGoal: (goalId: string) => boolean;
};

export function CompanionQuickGoalsPanel({
  dayId,
  familyId,
  onCompleteGoal,
  onOpen,
  onUndoGoal,
  state,
}: Pick<QuickGoalActions, 'onCompleteGoal' | 'onUndoGoal'> & {
  dayId: string;
  familyId: KatchimeraFamilyId;
  onOpen: () => void;
  state: CompanionQuickGoalState;
}) {
  const goals = quickGoalsForDay(state, dayId, familyId);
  return (
    <View style={styles.companionPanel}>
      <View style={styles.panelHeading}>
        <View style={styles.panelCopy}>
          <ThemedText style={styles.panelEyebrow} lightColor={Meadow.goldDeep} darkColor={Meadow.goldDeep}>
            SMALL GOALS
          </ThemedText>
          <ThemedText selectable style={styles.panelTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>
            Today
          </ThemedText>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onOpen}
          style={({ pressed }) => [styles.manageButton, pressed && styles.pressed]}>
          <IconSymbol color={Meadow.inkSoft} name="plus" size={14} />
          <ThemedText style={styles.manageButtonText} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
            Add
          </ThemedText>
        </Pressable>
      </View>
      {goals.length ? (
        <View style={styles.goalList}>
          {goals.map((item) => (
            <QuickGoalRow
              item={item}
              key={item.goal.id}
              onCompleteGoal={onCompleteGoal}
              onUndoGoal={onUndoGoal}
              tone="parchment"
            />
          ))}
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={onOpen}
          style={({ pressed }) => [styles.emptyGoals, pressed && styles.pressed]}>
          <IconSymbol color={Meadow.goldDeep} name="plus" size={17} />
          <ThemedText style={styles.emptyGoalsText} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
            Choose one small thing to do
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

export function QuickGoalCompletionPrompt({
  completion,
  goal,
  onRemember,
  onUndo,
}: {
  completion: CompanionQuickGoalCompletion | null;
  goal: CompanionQuickGoal | null;
  onRemember: (completion: CompanionQuickGoalCompletion, goal: CompanionQuickGoal) => void;
  onUndo: (goalId: string) => void;
}) {
  if (!completion || !goal) return null;
  return (
    <View accessibilityLiveRegion="polite" style={styles.completionPrompt}>
      <IconSymbol color={Meadow.leafDeep} name="checkmark" size={17} />
      <View style={styles.completionCopy}>
        <ThemedText numberOfLines={1} style={styles.completionTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>
          Goal complete · +5 bond
        </ThemedText>
        <View style={styles.completionActions}>
          <Pressable accessibilityRole="button" onPress={() => onRemember(completion, goal)}>
            <ThemedText style={styles.completionAction} lightColor={Meadow.goldDeep} darkColor={Meadow.goldDeep}>
              Remember this
            </ThemedText>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => onUndo(goal.id)}>
            <ThemedText style={styles.completionActionSecondary} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
              Undo
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function CompanionQuickGoalPicker({
  dayId,
  familyId,
  onAddCustom,
  onAddTemplate,
  onBack,
  state,
}: {
  dayId: string;
  familyId: KatchimeraFamilyId;
  onAddCustom: QuickGoalActions['onAddCustom'];
  onAddTemplate: QuickGoalActions['onAddTemplate'];
  onBack: () => void;
  state: CompanionQuickGoalState;
}) {
  const insets = useSafeAreaInsets();
  const [customOpen, setCustomOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [cadence, setCadence] = useState<CompanionQuickGoalCadence>({ kind: 'once', dayId });
  const [feedback, setFeedback] = useState<string | null>(null);
  const family = katchimeraFamilyById.get(familyId);
  const familyGoals = state.goals.filter((goal) => goal.familyId === familyId && goal.status !== 'archived');
  const templates = quickGoalTemplatesForFamily(familyId);

  const saveCustom = () => {
    if (!title.trim()) {
      setFeedback('Write a short goal first');
      return;
    }
    if (cadence.kind === 'weekdays' && !cadence.weekdays.length) {
      setFeedback('Choose at least one day');
      return;
    }
    const result = onAddCustom(familyId, title, cadence);
    if (!result.added) {
      setFeedback(result.reason === 'duplicate' ? 'That goal is already active' : 'Could not add that goal');
      return;
    }
    if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setFeedback('Added to today');
    setCustomOpen(false);
    setTitle('');
  };

  return (
    <View style={[styles.scopedPicker, { paddingTop: insets.top + 10 }]}>
      <Pressable
        accessibilityRole="button"
        onPress={onBack}
        style={({ pressed }) => [styles.scopedBack, pressed && styles.pressed]}>
        <IconSymbol color={Meadow.inkSoft} name="chevron.left" size={16} />
        <ThemedText style={styles.scopedBackText} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
          Back to Goals
        </ThemedText>
      </Pressable>

      <View style={styles.scopedHeading}>
        <ThemedText style={styles.sectionLabel} lightColor={Meadow.goldDeep} darkColor={Meadow.goldDeep}>
          {family?.displayName.toUpperCase() ?? 'COMPANION'} GOALS
        </ThemedText>
        <ThemedText selectable style={styles.scopedTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>
          Choose something small
        </ThemedText>
        <ThemedText selectable style={styles.scopedDescription} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
          Only goals connected to {family?.displayName ?? 'this companion'} and its part of your life.
        </ThemedText>
      </View>

      <View style={styles.presetList}>
        {templates.map((template) => {
          const added = familyGoals.some((goal) => goal.templateId === template.id);
          return (
            <Pressable
              accessibilityRole="button"
              disabled={added}
              key={template.id}
              onPress={() => {
                const result = onAddTemplate(template.id);
                if (result.added && process.env.EXPO_OS === 'ios') {
                  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
                setFeedback(result.added ? 'Added to today' : 'That goal is already active');
              }}
              style={({ pressed }) => [styles.presetRow, added && styles.disabled, pressed && styles.pressed]}>
              <View style={styles.presetCopy}>
                <ThemedText selectable style={styles.presetTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>
                  {template.title}
                </ThemedText>
                <ThemedText style={styles.presetCadence} lightColor={Meadow.inkFaint} darkColor={Meadow.inkFaint}>
                  {quickGoalCadenceLabel(cadenceFromTemplate(template, dayId))}
                </ThemedText>
              </View>
              <IconSymbol color={added ? Meadow.leafDeep : Meadow.goldDeep} name={added ? 'checkmark' : 'plus'} size={17} />
            </Pressable>
          );
        })}
      </View>

      {!customOpen ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setCadence({ kind: 'once', dayId });
            setFeedback(null);
            setCustomOpen(true);
          }}
          style={({ pressed }) => [styles.customButton, pressed && styles.pressed]}>
          <IconSymbol color={Meadow.inkSoft} name="pencil" size={15} />
          <ThemedText style={styles.customButtonText} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
            Write my own {family?.displayName ?? 'companion'} goal
          </ThemedText>
        </Pressable>
      ) : (
        <GoalEditor
          cadence={cadence}
          dayId={dayId}
          editing={false}
          onCadenceChange={setCadence}
          onCancel={() => setCustomOpen(false)}
          onSave={saveCustom}
          onTitleChange={setTitle}
          title={title}
        />
      )}

      {feedback ? (
        <ThemedText accessibilityLiveRegion="polite" selectable style={styles.feedback} lightColor={Meadow.leafDeep} darkColor={Meadow.leafDeep}>
          {feedback}
        </ThemedText>
      ) : null}
    </View>
  );
}

export function QuickGoalsSheet({
  actions,
  dayId,
  familyIds,
  initialFamilyId,
  onClose,
  onRemember,
  state,
}: {
  actions: QuickGoalActions;
  dayId: string;
  familyIds: readonly KatchimeraFamilyId[];
  initialFamilyId?: KatchimeraFamilyId | null;
  onClose: () => void;
  onRemember?: (completion: CompanionQuickGoalCompletion, goal: CompanionQuickGoal) => void;
  state: CompanionQuickGoalState;
}) {
  const reduceMotion = useReducedMotion();
  const [mode, setMode] = useState<'today' | 'add' | 'manage'>('today');
  const [familyId, setFamilyId] = useState<KatchimeraFamilyId>(
    initialFamilyId && familyIds.includes(initialFamilyId) ? initialFamilyId : familyIds[0] ?? 'vesperitt'
  );
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<CompanionQuickGoal | null>(null);
  const [title, setTitle] = useState('');
  const [cadence, setCadence] = useState<CompanionQuickGoalCadence>({ kind: 'once', dayId });
  const [feedback, setFeedback] = useState<string | null>(null);
  const goals = quickGoalsForDay(state, dayId);
  const completedCount = goals.filter((item) => item.completion).length;
  const remainingCount = goals.length - completedCount;
  const selectedGoal = selectedGoalId
    ? goals.find((item) => item.goal.id === selectedGoalId) ??
      state.goals
        .filter((goal) => goal.id === selectedGoalId)
        .map((goal) => ({
          goal,
          completion:
            state.completions.find(
              (completion) => completion.goalId === selectedGoalId && completion.dayId === dayId
            ) ?? null,
        }))[0] ??
      null
    : null;
  const familyGoals = state.goals.filter((goal) => goal.familyId === familyId && goal.status !== 'archived');
  const templates = quickGoalTemplatesForFamily(familyId);
  const completeInSheet = (goalId: string) => {
    const goal = state.goals.find((candidate) => candidate.id === goalId);
    const completion = actions.onCompleteGoal(goalId);
    if (goal && completion) {
      setFeedback(null);
    }
    return completion;
  };
  const undoInSheet = (goalId: string) => {
    const undone = actions.onUndoGoal(goalId);
    if (undone) {
      setFeedback('Completion undone');
    }
    return undone;
  };
  const snoozeInSheet = (goalId: string) => {
    if (!actions.onSnoozeGoal(goalId)) return;
    setSelectedGoalId(null);
    setFeedback('Snoozed until the next useful day');
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
  };
  const skipInSheet = (goalId: string) => {
    if (!actions.onSkipGoal(goalId)) return;
    setSelectedGoalId(null);
    setFeedback('Skipped for today');
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
  };

  useEffect(() => {
    if (!familyIds.includes(familyId) && familyIds[0]) setFamilyId(familyIds[0]);
  }, [familyId, familyIds]);

  const beginCustom = () => {
    setEditingGoal(null);
    setTitle('');
    setCadence({ kind: 'once', dayId });
    setCustomOpen(true);
    setFeedback(null);
  };
  const beginEdit = (goal: CompanionQuickGoal) => {
    setEditingGoal(goal);
    setTitle(goal.title);
    setCadence(goal.cadence);
    setCustomOpen(true);
    setFeedback(null);
  };
  const save = () => {
    if (!title.trim()) {
      setFeedback('Write a short goal first');
      return;
    }
    if (cadence.kind === 'weekdays' && !cadence.weekdays.length) {
      setFeedback('Choose at least one day');
      return;
    }
    if (editingGoal) {
      actions.onEditGoal(editingGoal.id, { title, cadence });
      setFeedback('Goal updated');
    } else {
      const result = actions.onAddCustom(familyId, title, cadence);
      if (!result.added) {
        setFeedback(result.reason === 'duplicate' ? 'That goal is already active' : 'Could not add that goal');
        return;
      }
      setFeedback('Goal added');
    }
    setCustomOpen(false);
    setEditingGoal(null);
    setTitle('');
  };

  return (
    <KatchaSheet
      header={{
        eyebrow: 'TODAY',
        title: mode === 'today' ? 'Today’s goals' : mode === 'add' ? 'Add a small goal' : 'Manage goals',
        subtitle: mode === 'today'
          ? goals.length
            ? remainingCount
              ? `${remainingCount} to-do · Tap any goal to check in.`
              : 'Everything is complete. Take the win.'
            : 'A short list for the life you want to live.'
          : mode === 'add'
            ? 'Choose a companion and keep it achievable.'
            : 'Adjust what repeats or pause what you do not need.',
      }}
      keyboardAvoiding
      onRequestClose={onClose}
      scroll
      scrollContentStyle={styles.sheetContent}
      size="tall"
      surface="parchment">
      {mode === 'today' ? (
        <View style={styles.todayGoalsView}>
          <View style={styles.todaySectionHeading}>
            <ThemedText style={styles.sectionLabel} lightColor={Meadow.inkFaint} darkColor={Meadow.inkFaint}>
              YOUR LIST
            </ThemedText>
            <ThemedText style={styles.todayCount} lightColor={Meadow.inkFaint} darkColor={Meadow.inkFaint}>
              {completedCount}/{goals.length}
            </ThemedText>
          </View>
          {goals.length ? (
            <View
              accessibilityLabel={`${completedCount} of ${goals.length} goals complete`}
              style={styles.todayProgressTrack}>
              <View
                style={[
                  styles.todayProgressFill,
                  { width: `${Math.round((completedCount / goals.length) * 100)}%` },
                ]}
              />
            </View>
          ) : null}
          {goals.length ? (
            <View style={styles.todayGoalList}>
              {goals.map((item, index) => {
                return (
                  <Animated.View
                    key={item.goal.id}
                    layout={reduceMotion ? undefined : LinearTransition.duration(170).easing(Easing.out(Easing.cubic))}>
                    <Animated.View
                      entering={reduceMotion ? undefined : FadeInUp.delay(Math.min(index, 6) * 32).duration(180)}>
                      <TodayQuickGoalCard
                        item={item}
                        onPress={() => {
                          setFeedback(null);
                          setSelectedGoalId(item.goal.id);
                          if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
                        }}
                      />
                    </Animated.View>
                  </Animated.View>
                );
              })}
            </View>
          ) : (
            <Animated.View entering={FadeInDown.duration(180)} style={styles.goalsEmptyState}>
              <IconSymbol color={Meadow.goldDeep} name="sparkles" size={22} />
              <View style={styles.goalsEmptyCopy}>
                <ThemedText style={styles.goalsEmptyTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>
                  Your list is clear
                </ThemedText>
                <ThemedText style={styles.goalsEmptyBody} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
                  Add one small thing if it would help.
                </ThemedText>
              </View>
            </Animated.View>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setMode('add');
              setSelectedGoalId(null);
              setFeedback(null);
            }}
            style={({ pressed }) => [styles.addGoalButton, pressed && styles.pressed]}>
            <IconSymbol color={Meadow.ink} name="plus" size={18} />
            <ThemedText style={styles.addGoalButtonText} lightColor={Meadow.ink} darkColor={Meadow.ink}>
              Add small goal
            </ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setMode('manage');
              setFeedback(null);
            }}
            style={({ pressed }) => [styles.manageGoalsLink, pressed && styles.pressed]}>
            <IconSymbol color={Meadow.inkFaint} name="gearshape.fill" size={13} />
            <ThemedText style={styles.manageGoalsLinkText} lightColor={Meadow.inkFaint} darkColor={Meadow.inkFaint}>
              Manage repeating goals
            </ThemedText>
          </Pressable>
        </View>
      ) : (
        <View style={styles.sheetSection}>
          <SheetBack
            label="Back to today"
            onPress={() => {
              setMode('today');
              setCustomOpen(false);
              setEditingGoal(null);
              setFeedback(null);
            }}
          />
          <ThemedText style={styles.sectionLabel} lightColor={Meadow.inkFaint} darkColor={Meadow.inkFaint}>
            {mode === 'add' ? 'CHOOSE A COMPANION' : 'GOALS FOR'}
          </ThemedText>
          <View style={styles.familyPills}>
            {familyIds.map((id) => {
              const selected = id === familyId;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={id}
                  onPress={() => {
                    setFamilyId(id);
                    setCustomOpen(false);
                    setFeedback(null);
                  }}
                  style={({ pressed }) => [styles.familyPill, selected && styles.familyPillSelected, pressed && styles.pressed]}>
                  <CompanionThumb familyId={id} size={28} />
                  <ThemedText style={styles.familyPillText} lightColor={Meadow.ink} darkColor={Meadow.ink}>
                    {katchimeraFamilyById.get(id)?.displayName ?? id}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          {mode === 'add' ? (
            <>
              <View style={styles.presetList}>
                {templates.map((template) => {
                  const added = familyGoals.some((goal) => goal.templateId === template.id);
                  return (
                    <Pressable
                      accessibilityRole="button"
                      disabled={added}
                      key={template.id}
                      onPress={() => {
                        const result = actions.onAddTemplate(template.id);
                        setFeedback(result.added ? 'Goal added' : 'That goal is already active');
                      }}
                      style={({ pressed }) => [styles.presetRow, added && styles.disabled, pressed && styles.pressed]}>
                      <CompanionThumb bleed familyId={template.familyId} size={48} />
                      <View style={styles.presetCopy}>
                        <ThemedText selectable style={styles.presetTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>
                          {template.title}
                        </ThemedText>
                        <ThemedText style={styles.presetCadence} lightColor={Meadow.inkFaint} darkColor={Meadow.inkFaint}>
                          {quickGoalCadenceLabel(cadenceFromTemplate(template, dayId))}
                        </ThemedText>
                      </View>
                      <View style={[styles.presetAdd, added && styles.presetAdded]}>
                        <IconSymbol color={added ? Meadow.chipLabel : Meadow.goldDeep} name={added ? 'checkmark' : 'plus'} size={16} />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              {!customOpen ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={beginCustom}
                  style={({ pressed }) => [styles.customButton, pressed && styles.pressed]}>
                  <IconSymbol color={Meadow.inkSoft} name="pencil" size={15} />
                  <ThemedText style={styles.customButtonText} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
                    Write my own
                  </ThemedText>
                </Pressable>
              ) : (
                <GoalEditor
                  cadence={cadence}
                  dayId={dayId}
                  editing={Boolean(editingGoal)}
                  onCadenceChange={setCadence}
                  onCancel={() => {
                    setCustomOpen(false);
                    setEditingGoal(null);
                  }}
                  onSave={save}
                  onTitleChange={setTitle}
                  title={title}
                />
              )}
            </>
          ) : familyGoals.length ? (
            <View style={styles.manageList}>
              {familyGoals.map((goal) => (
                <View key={goal.id} style={styles.manageRow}>
                  <CompanionThumb bleed familyId={goal.familyId} size={42} />
                  <View style={styles.presetCopy}>
                    <ThemedText selectable style={styles.presetTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>
                      {goal.title}
                    </ThemedText>
                    <ThemedText style={styles.presetCadence} lightColor={Meadow.inkFaint} darkColor={Meadow.inkFaint}>
                      {goal.status === 'paused' ? 'Paused' : quickGoalCadenceLabel(goal.cadence)}
                    </ThemedText>
                  </View>
                  <GoalManageButton icon="pencil" label="Edit" onPress={() => beginEdit(goal)} />
                  <GoalManageButton
                    icon={goal.status === 'paused' ? 'play.fill' : 'pause.fill'}
                    label={goal.status === 'paused' ? 'Resume' : 'Pause'}
                    onPress={() => actions.onEditGoal(goal.id, { status: goal.status === 'paused' ? 'active' : 'paused' })}
                  />
                  <GoalManageButton icon="trash.fill" label="Archive" onPress={() => actions.onEditGoal(goal.id, { status: 'archived' })} />
                </View>
              ))}
              {customOpen ? (
                <GoalEditor
                  cadence={cadence}
                  dayId={dayId}
                  editing={Boolean(editingGoal)}
                  onCadenceChange={setCadence}
                  onCancel={() => {
                    setCustomOpen(false);
                    setEditingGoal(null);
                  }}
                  onSave={save}
                  onTitleChange={setTitle}
                  title={title}
                />
              ) : null}
            </View>
          ) : (
            <View style={styles.goalsEmptyState}>
              <ThemedText style={styles.goalsEmptyBody} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
                No goals added for this companion yet.
              </ThemedText>
            </View>
          )}
        </View>
      )}

      {feedback ? (
        <ThemedText accessibilityLiveRegion="polite" selectable style={styles.feedback} lightColor={Meadow.leafDeep} darkColor={Meadow.leafDeep}>
          {feedback}
        </ThemedText>
      ) : null}
      {selectedGoal ? (
        <QuickGoalActionModal
          item={selectedGoal}
          onComplete={() => completeInSheet(selectedGoal.goal.id)}
          onDismiss={() => setSelectedGoalId(null)}
          onRemember={() => {
            const completion =
              state.completions.find(
                (candidate) => candidate.goalId === selectedGoal.goal.id && candidate.dayId === dayId
              ) ?? selectedGoal.completion;
            if (completion) onRemember?.(completion, selectedGoal.goal);
          }}
          onSkip={() => skipInSheet(selectedGoal.goal.id)}
          onSnooze={() => snoozeInSheet(selectedGoal.goal.id)}
          onUndo={() => undoInSheet(selectedGoal.goal.id)}
        />
      ) : null}
    </KatchaSheet>
  );
}

function TodayQuickGoalCard({
  item,
  onPress,
}: {
  item: CompanionQuickGoalForDay;
  onPress: () => void;
}) {
  const complete = Boolean(item.completion);
  const familyName = katchimeraFamilyById.get(item.goal.familyId)?.displayName ?? item.goal.familyId;
  return (
    <Pressable
      accessibilityHint={complete ? 'Opens completed goal actions' : 'Opens complete, snooze, and skip actions'}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.todayGoalCard,
        complete && styles.todayGoalCardComplete,
        pressed && styles.todayGoalCardPressed,
      ]}>
      <CompanionThumb bleed familyId={item.goal.familyId} size={64} />
      <View style={styles.todayGoalCopy}>
        <ThemedText
          numberOfLines={2}
          selectable
          style={[styles.todayGoalTitle, complete && styles.todayGoalTitleComplete]}
          lightColor={Meadow.ink}
          darkColor={Meadow.ink}>
          {item.goal.title}
        </ThemedText>
        <ThemedText style={styles.todayGoalSubtitle} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
          {goalEncouragement(item.goal.cadence)}
        </ThemedText>
        <View style={styles.goalTags}>
          <GoalTag label={familyName} />
          <GoalTag label={quickGoalCadenceLabel(item.goal.cadence)} />
        </View>
      </View>
      <View style={[styles.todayGoalStatus, complete && styles.todayGoalStatusComplete]}>
        {complete ? (
          <Animated.View
            entering={ZoomIn.duration(190).easing(Easing.out(Easing.back(1.06)))}
            exiting={ZoomOut.duration(110).easing(Easing.in(Easing.quad))}>
            <IconSymbol color={Meadow.chipLabel} name="checkmark" size={22} />
          </Animated.View>
        ) : null}
      </View>
    </Pressable>
  );
}

function CompanionThumb({
  bleed = false,
  familyId,
  size,
}: {
  bleed?: boolean;
  familyId: KatchimeraFamilyId;
  size: number;
}) {
  const family = katchimeraFamilyById.get(familyId);
  const visualKey = family?.anchorVisualKey ?? null;
  const artSize = bleed ? size * 1.38 : size;
  return (
    <View style={[styles.companionThumb, { height: size, width: size }]}>
      {visualKey ? (
        <Image
          contentFit="contain"
          source={resolveCreatureArtSource(visualKey, { lod: 'thumb', stage: 'hatchling' })}
          style={{
            height: artSize,
            width: artSize,
          }}
          transition={120}
        />
      ) : (
        <IconSymbol color={Meadow.goldDeep} name="sparkles" size={Math.round(size * 0.4)} />
      )}
    </View>
  );
}

function GoalTag({ label }: { label: string }) {
  return (
    <View style={styles.goalTag}>
      <ThemedText style={styles.goalTagText} lightColor={Meadow.goldDeep} darkColor={Meadow.goldDeep}>
        {label}
      </ThemedText>
    </View>
  );
}

function SheetBack({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.sheetBack, pressed && styles.pressed]}>
      <IconSymbol color={Meadow.inkSoft} name="chevron.left" size={16} />
      <ThemedText style={styles.sheetBackText} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function goalEncouragement(cadence: CompanionQuickGoalCadence): string {
  if (cadence.kind === 'daily') return 'Build the rhythm one small day at a time.';
  if (cadence.kind === 'weekdays') return 'Keep the weekday rhythm gently moving.';
  return 'One small, finishable win for today.';
}

function QuickGoalRow({
  compact = false,
  item,
  onCompleteGoal,
  onUndoGoal,
  tone,
}: Pick<QuickGoalActions, 'onCompleteGoal' | 'onUndoGoal'> & {
  compact?: boolean;
  item: CompanionQuickGoalForDay;
  tone: 'night' | 'parchment';
}) {
  const complete = Boolean(item.completion);
  const textColor = tone === 'night' ? Lantern.moon50 : Meadow.ink;
  const secondary = tone === 'night' ? Lantern.moon300 : Meadow.inkFaint;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: complete }}
      onPress={() => {
        if (process.env.EXPO_OS === 'ios') {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        if (complete) onUndoGoal(item.goal.id);
        else onCompleteGoal(item.goal.id);
      }}
      style={({ pressed }) => [
        styles.goalRow,
        compact && styles.goalRowCompact,
        tone === 'night' && styles.goalRowNight,
        pressed && styles.pressed,
      ]}>
      <View style={[
        styles.checkbox,
        tone === 'night' && styles.checkboxNight,
        complete && styles.checkboxComplete,
      ]}>
        {complete ? <IconSymbol color={Meadow.chipLabel} name="checkmark" size={13} /> : null}
      </View>
      <View style={styles.goalRowCopy}>
        <ThemedText
          numberOfLines={compact ? 1 : 2}
          style={[styles.goalRowTitle, complete && styles.goalRowTitleComplete]}
          lightColor={textColor}
          darkColor={textColor}>
          {item.goal.title}
        </ThemedText>
        {!compact ? (
          <ThemedText style={styles.goalRowMeta} lightColor={secondary} darkColor={secondary}>
            {katchimeraFamilyById.get(item.goal.familyId)?.displayName ?? item.goal.familyId} · {quickGoalCadenceLabel(item.goal.cadence)}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

function GoalEditor({
  cadence,
  dayId,
  editing,
  onCadenceChange,
  onCancel,
  onSave,
  onTitleChange,
  title,
}: {
  cadence: CompanionQuickGoalCadence;
  dayId: string;
  editing: boolean;
  onCadenceChange: (cadence: CompanionQuickGoalCadence) => void;
  onCancel: () => void;
  onSave: () => void;
  onTitleChange: (value: string) => void;
  title: string;
}) {
  const mode = cadence.kind;
  return (
    <View style={styles.editor}>
      <ThemedText style={styles.editorLabel} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
        GOAL
      </ThemedText>
      <TextInput
        accessibilityLabel="Goal"
        autoFocus
        onChangeText={onTitleChange}
        placeholder="Something small and finishable"
        placeholderTextColor={Meadow.inkFaint}
        style={styles.input}
        value={title}
      />
      <ThemedText style={styles.editorLabel} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
        REPEAT
      </ThemedText>
      <View style={styles.cadenceRow}>
        <CadenceButton label="Today" selected={mode === 'once'} onPress={() => onCadenceChange({ kind: 'once', dayId })} />
        <CadenceButton label="Daily" selected={mode === 'daily'} onPress={() => onCadenceChange({ kind: 'daily' })} />
        <CadenceButton
          label="Weekdays"
          selected={mode === 'weekdays'}
          onPress={() => onCadenceChange({ kind: 'weekdays', weekdays: mode === 'weekdays' ? cadence.weekdays : [1, 2, 3, 4, 5] })}
        />
      </View>
      {cadence.kind === 'weekdays' ? (
        <View style={styles.weekdayRow}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, weekday) => {
            const selected = cadence.weekdays.includes(weekday);
            return (
              <Pressable
                accessibilityLabel={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][weekday]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={`${label}:${weekday}`}
                onPress={() => onCadenceChange({
                  kind: 'weekdays',
                  weekdays: selected
                    ? cadence.weekdays.filter((day) => day !== weekday)
                    : [...cadence.weekdays, weekday].sort(),
                })}
                style={({ pressed }) => [styles.weekday, selected && styles.weekdaySelected, pressed && styles.pressed]}>
                <ThemedText style={styles.weekdayText} lightColor={Meadow.ink} darkColor={Meadow.ink}>
                  {label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <View style={styles.editorActions}>
        <Pressable accessibilityRole="button" onPress={onCancel} style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}>
          <ThemedText style={styles.cancelButtonText} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
            Cancel
          </ThemedText>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onSave} style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}>
          <ThemedText style={styles.saveButtonText} lightColor={Meadow.chipLabel} darkColor={Meadow.chipLabel}>
            {editing ? 'Save changes' : 'Add goal'}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

function CadenceButton({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.cadenceButton, selected && styles.cadenceButtonSelected, pressed && styles.pressed]}>
      <ThemedText style={styles.cadenceButtonText} lightColor={Meadow.ink} darkColor={Meadow.ink}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function GoalManageButton({
  icon,
  label,
  onPress,
}: {
  icon: 'pencil' | 'pause.fill' | 'play.fill' | 'trash.fill';
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.manageIcon, pressed && styles.pressed]}>
      <IconSymbol color={Meadow.inkSoft} name={icon} size={14} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  companionPanel: { backgroundColor: 'rgba(255,248,232,0.93)', borderColor: Meadow.cardBorder, borderCurve: 'continuous', borderRadius: 22, borderWidth: 1, boxShadow: '0 8px 22px rgba(37,42,29,0.18), inset 0 1px 0 rgba(255,255,255,0.76)', gap: 10, marginBottom: 12, padding: 14 },
  scopedPicker: { gap: KatchaUI.spacing.md, paddingBottom: KatchaUI.spacing.xl, paddingHorizontal: 4, paddingTop: 6 },
  scopedBack: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 5, minHeight: 38, paddingHorizontal: 4 },
  scopedBackText: { ...KatchaUI.type.companionAction, fontSize: 11.5 },
  scopedHeading: { gap: 5, paddingBottom: 2 },
  scopedTitle: { ...KatchaUI.type.screenTitle, fontSize: 22, letterSpacing: -0.4, lineHeight: 27 },
  scopedDescription: { ...KatchaUI.type.companionBody, fontSize: 12.5, lineHeight: 18 },
  panelHeading: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  panelCopy: { flex: 1, gap: 2 },
  panelEyebrow: { ...KatchaUI.type.label, fontSize: 9, letterSpacing: 1 },
  panelTitle: { ...KatchaUI.type.sectionTitle, fontSize: 15, lineHeight: 20 },
  manageButton: { alignItems: 'center', borderColor: Meadow.cardBorder, borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 4, minHeight: 34, paddingHorizontal: 10 },
  manageButtonText: { ...KatchaUI.type.companionAction, fontSize: 10.5 },
  emptyGoals: { alignItems: 'center', backgroundColor: Meadow.goldSoft, borderCurve: 'continuous', borderRadius: 14, flexDirection: 'row', gap: 8, minHeight: 44, paddingHorizontal: 12 },
  emptyGoalsText: { ...KatchaUI.type.companionAction, fontSize: 12.5 },
  goalList: { gap: 7 },
  goalRow: { alignItems: 'center', backgroundColor: 'rgba(255,249,234,0.72)', borderColor: Meadow.cardBorder, borderCurve: 'continuous', borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 10, minHeight: 50, paddingHorizontal: 11, paddingVertical: 8 },
  goalRowCompact: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', minHeight: 36, paddingVertical: 5 },
  goalRowNight: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' },
  checkbox: { alignItems: 'center', borderColor: Meadow.goldDeep, borderRadius: 999, borderWidth: 1.5, height: 23, justifyContent: 'center', width: 23 },
  checkboxNight: { borderColor: Lantern.ember300 },
  checkboxComplete: { backgroundColor: Meadow.leafDeep, borderColor: Meadow.leafDeep },
  goalRowCopy: { flex: 1, gap: 2 },
  goalRowTitle: { ...KatchaUI.type.companionAction, fontSize: 12.5, lineHeight: 17 },
  goalRowTitleComplete: { opacity: 0.58, textDecorationLine: 'line-through' },
  goalRowMeta: { ...KatchaUI.type.meta, fontSize: 9.5 },
  completionPrompt: { alignItems: 'center', backgroundColor: 'rgba(111,139,102,0.14)', borderColor: 'rgba(78,112,72,0.34)', borderCurve: 'continuous', borderRadius: 15, borderWidth: 1, flexDirection: 'row', gap: 9, padding: 11 },
  completionCopy: { flex: 1, gap: 4 },
  completionTitle: { ...KatchaUI.type.companionAction, fontSize: 12 },
  completionActions: { flexDirection: 'row', gap: 14 },
  completionAction: { ...KatchaUI.type.companionAction, fontSize: 10.5 },
  completionActionSecondary: { ...KatchaUI.type.companionAction, fontSize: 10.5, fontWeight: '800' },
  sheetContent: { gap: 18, paddingBottom: 28 },
  sheetSection: { gap: 9 },
  sectionLabel: { ...KatchaUI.type.label, fontSize: 9.5, letterSpacing: 1.1 },
  todayGoalsView: { gap: 12 },
  todaySectionHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 },
  todayCount: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontVariant: ['tabular-nums'], fontWeight: '900' },
  todayProgressTrack: { backgroundColor: 'rgba(104,77,43,0.16)', borderRadius: 999, height: 5, overflow: 'hidden' },
  todayProgressFill: { backgroundColor: Meadow.leafDeep, borderRadius: 999, height: '100%' },
  todayGoalList: { gap: 10 },
  todayGoalCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,249,234,0.88)',
    borderColor: 'rgba(185,145,77,0.24)',
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 1,
    boxShadow: '0 5px 14px rgba(91,61,24,0.10)',
    flexDirection: 'row',
    gap: 11,
    minHeight: 76,
    paddingLeft: 7,
    paddingRight: 11,
    paddingVertical: 7,
  },
  todayGoalCardComplete: { backgroundColor: 'rgba(244,248,232,0.92)', borderColor: 'rgba(78,112,72,0.28)' },
  todayGoalCardPressed: { opacity: 0.9, transform: [{ scale: 0.988 }] },
  todayGoalCopy: { flex: 1, gap: 3, minWidth: 0 },
  todayGoalTitle: { fontFamily: AppFontFamilies.manrope, fontSize: 14, fontWeight: '900', letterSpacing: -0.15, lineHeight: 18 },
  todayGoalTitleComplete: { opacity: 0.62, textDecorationLine: 'line-through' },
  todayGoalSubtitle: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '600', lineHeight: 14 },
  goalTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, paddingTop: 2 },
  goalTag: { backgroundColor: 'rgba(223,181,94,0.17)', borderRadius: 999, minHeight: 21, justifyContent: 'center', paddingHorizontal: 7 },
  goalTagText: { fontFamily: AppFontFamilies.manrope, fontSize: 8.5, fontWeight: '900' },
  todayGoalStatus: { alignItems: 'center', borderColor: Meadow.goldDeep, borderRadius: 999, borderWidth: 1.5, height: 42, justifyContent: 'center', width: 42 },
  todayGoalStatusComplete: { backgroundColor: Meadow.leafDeep, borderColor: Meadow.leafDeep },
  companionThumb: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  addGoalButton: {
    alignItems: 'center',
    backgroundColor: '#F2BD43',
    borderColor: '#D8A32E',
    borderCurve: 'continuous',
    borderRadius: 17,
    borderWidth: 1,
    boxShadow: '0 6px 16px rgba(168,113,23,0.20)',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
  },
  addGoalButtonText: { fontFamily: AppFontFamilies.manrope, fontSize: 13, fontWeight: '900' },
  manageGoalsLink: { alignItems: 'center', alignSelf: 'center', flexDirection: 'row', gap: 5, minHeight: 38, paddingHorizontal: 10 },
  manageGoalsLinkText: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '800' },
  goalsEmptyState: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,249,234,0.64)',
    borderColor: Meadow.cardBorder,
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 72,
    padding: 13,
  },
  goalsEmptyCopy: { flex: 1, gap: 2 },
  goalsEmptyTitle: { fontFamily: AppFontFamilies.manrope, fontSize: 13, fontWeight: '900' },
  goalsEmptyBody: { fontFamily: AppFontFamilies.manrope, fontSize: 11, fontWeight: '600', lineHeight: 15 },
  sheetBack: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 4, minHeight: 34, paddingRight: 10 },
  sheetBackText: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '900' },
  familyPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  familyPill: { alignItems: 'center', borderColor: Meadow.cardBorder, borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 5, minHeight: 38, paddingHorizontal: 7, paddingRight: 11, justifyContent: 'center' },
  familyPillSelected: { backgroundColor: Meadow.goldSoft, borderColor: Meadow.goldDeep },
  familyPillText: { fontFamily: AppFontFamilies.manrope, fontSize: 11, fontWeight: '900' },
  presetList: { gap: 7 },
  presetRow: { alignItems: 'center', backgroundColor: 'rgba(255,249,234,0.78)', borderColor: Meadow.cardBorder, borderCurve: 'continuous', borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 9, minHeight: 60, paddingHorizontal: 8, paddingVertical: 6 },
  presetAdd: { alignItems: 'center', borderColor: Meadow.goldDeep, borderRadius: 999, borderWidth: 1, height: 32, justifyContent: 'center', width: 32 },
  presetAdded: { backgroundColor: Meadow.leafDeep, borderColor: Meadow.leafDeep },
  presetCopy: { flex: 1, gap: 2 },
  presetTitle: { fontFamily: AppFontFamilies.manrope, fontSize: 12.5, fontWeight: '800', lineHeight: 17 },
  presetCadence: { fontFamily: AppFontFamilies.manrope, fontSize: 9.5, fontWeight: '700' },
  customButton: { alignItems: 'center', alignSelf: 'flex-start', borderColor: Meadow.cardBorder, borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 6, minHeight: 38, paddingHorizontal: 12 },
  customButtonText: { fontFamily: AppFontFamilies.manrope, fontSize: 11.5, fontWeight: '900' },
  editor: { backgroundColor: Meadow.goldSoft, borderCurve: 'continuous', borderRadius: 16, gap: 8, padding: 12 },
  editorLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 8.5, fontWeight: '900', letterSpacing: 1 },
  input: { backgroundColor: '#FFF9EA', borderColor: Meadow.cardBorder, borderCurve: 'continuous', borderRadius: 13, borderWidth: 1, color: Meadow.ink, fontFamily: AppFontFamilies.manrope, fontSize: 14, minHeight: 46, paddingHorizontal: 11, paddingVertical: 9 },
  cadenceRow: { flexDirection: 'row', gap: 6 },
  cadenceButton: { alignItems: 'center', borderColor: Meadow.cardBorder, borderRadius: 999, borderWidth: 1, flex: 1, minHeight: 36, justifyContent: 'center', paddingHorizontal: 7 },
  cadenceButtonSelected: { backgroundColor: '#F1D38E', borderColor: Meadow.goldDeep },
  cadenceButtonText: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '900' },
  weekdayRow: { flexDirection: 'row', gap: 5 },
  weekday: { alignItems: 'center', borderColor: Meadow.cardBorder, borderRadius: 999, borderWidth: 1, flex: 1, height: 34, justifyContent: 'center' },
  weekdaySelected: { backgroundColor: '#F1D38E', borderColor: Meadow.goldDeep },
  weekdayText: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '900' },
  editorActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end', paddingTop: 2 },
  cancelButton: { alignItems: 'center', borderColor: Meadow.cardBorder, borderRadius: 12, borderWidth: 1, minHeight: 40, justifyContent: 'center', paddingHorizontal: 12 },
  cancelButtonText: { fontFamily: AppFontFamilies.manrope, fontSize: 11, fontWeight: '900' },
  saveButton: { alignItems: 'center', backgroundColor: Meadow.goldDeep, borderCurve: 'continuous', borderRadius: 12, minHeight: 40, justifyContent: 'center', paddingHorizontal: 13 },
  saveButtonText: { fontFamily: AppFontFamilies.manrope, fontSize: 11, fontWeight: '900' },
  manageList: { gap: 4 },
  manageRow: { alignItems: 'center', borderBottomColor: Meadow.cardBorder, borderBottomWidth: 1, flexDirection: 'row', gap: 6, minHeight: 58, paddingVertical: 7 },
  manageIcon: { alignItems: 'center', borderColor: Meadow.cardBorder, borderRadius: 999, borderWidth: 1, height: 34, justifyContent: 'center', width: 34 },
  feedback: { fontFamily: AppFontFamilies.manrope, fontSize: 11.5, fontWeight: '900', textAlign: 'center' },
  disabled: { opacity: 0.46 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.985 }] },
});
