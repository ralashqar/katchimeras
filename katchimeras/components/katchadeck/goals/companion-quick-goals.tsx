import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { quickGoalTemplatesForFamily } from '@/constants/companion-quick-goals';
import { katchimeraFamilyById } from '@/constants/katchimera-skins';
import { Meadow } from '@/constants/meadow-theme';
import { AppFontFamilies, Lantern } from '@/constants/theme';
import type { KatchimeraFamilyId } from '@/types/katchimera';
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
  const name = katchimeraFamilyById.get(familyId)?.displayName ?? 'Companion';
  return (
    <View style={styles.companionPanel}>
      <View style={styles.panelHeading}>
        <View style={styles.panelCopy}>
          <ThemedText style={styles.panelEyebrow} lightColor={Meadow.goldDeep} darkColor={Meadow.goldDeep}>
            SMALL GOALS
          </ThemedText>
          <ThemedText selectable style={styles.panelTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>
            Today with {name}
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
    <View style={styles.scopedPicker}>
      <Pressable
        accessibilityRole="button"
        onPress={onBack}
        style={({ pressed }) => [styles.scopedBack, pressed && styles.pressed]}>
        <IconSymbol color={Meadow.inkSoft} name="chevron.left" size={16} />
        <ThemedText style={styles.scopedBackText} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
          Back to Do
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
  const [familyId, setFamilyId] = useState<KatchimeraFamilyId>(
    initialFamilyId && familyIds.includes(initialFamilyId) ? initialFamilyId : familyIds[0] ?? 'vesperitt'
  );
  const [customOpen, setCustomOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<CompanionQuickGoal | null>(null);
  const [title, setTitle] = useState('');
  const [cadence, setCadence] = useState<CompanionQuickGoalCadence>({ kind: 'once', dayId });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [recentCompletion, setRecentCompletion] = useState<{
    completion: CompanionQuickGoalCompletion;
    goal: CompanionQuickGoal;
  } | null>(null);
  const goals = quickGoalsForDay(state, dayId);
  const familyGoals = state.goals.filter((goal) => goal.familyId === familyId && goal.status !== 'archived');
  const templates = quickGoalTemplatesForFamily(familyId);
  const completeInSheet = (goalId: string) => {
    const goal = state.goals.find((candidate) => candidate.id === goalId);
    const completion = actions.onCompleteGoal(goalId);
    if (goal && completion) setRecentCompletion({ completion, goal });
    return completion;
  };
  const undoInSheet = (goalId: string) => {
    const undone = actions.onUndoGoal(goalId);
    if (undone) setRecentCompletion((current) => current?.goal.id === goalId ? null : current);
    return undone;
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
        title: 'Small goals',
        subtitle: 'Tap to complete. Add only what feels useful.',
      }}
      keyboardAvoiding
      onRequestClose={onClose}
      scroll
      scrollContentStyle={styles.sheetContent}
      size="tall"
      surface="parchment">
      {goals.length ? (
        <View style={styles.sheetSection}>
          <ThemedText style={styles.sectionLabel} lightColor={Meadow.inkFaint} darkColor={Meadow.inkFaint}>
            TODAY
          </ThemedText>
          <View style={styles.goalList}>
            {goals.map((item) => (
              <QuickGoalRow
                item={item}
                key={item.goal.id}
                onCompleteGoal={completeInSheet}
                onUndoGoal={undoInSheet}
                tone="parchment"
              />
            ))}
          </View>
          <QuickGoalCompletionPrompt
            completion={recentCompletion?.completion ?? null}
            goal={recentCompletion?.goal ?? null}
            onRemember={(completion, goal) => {
              setRecentCompletion(null);
              onRemember?.(completion, goal);
            }}
            onUndo={undoInSheet}
          />
        </View>
      ) : null}

      <View style={styles.sheetSection}>
        <ThemedText style={styles.sectionLabel} lightColor={Meadow.inkFaint} darkColor={Meadow.inkFaint}>
          ADD FOR
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
                <ThemedText style={styles.familyPillText} lightColor={Meadow.ink} darkColor={Meadow.ink}>
                  {katchimeraFamilyById.get(id)?.displayName ?? id}
                </ThemedText>
              </Pressable>
            );
          })}
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
                  const result = actions.onAddTemplate(template.id);
                  setFeedback(result.added ? 'Goal added' : 'That goal is already active');
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
      </View>

      {familyGoals.length ? (
        <View style={styles.sheetSection}>
          <ThemedText style={styles.sectionLabel} lightColor={Meadow.inkFaint} darkColor={Meadow.inkFaint}>
            MANAGE {katchimeraFamilyById.get(familyId)?.displayName.toUpperCase() ?? 'GOALS'}
          </ThemedText>
          {familyGoals.map((goal) => (
            <View key={goal.id} style={styles.manageRow}>
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
        </View>
      ) : null}

      {feedback ? (
        <ThemedText accessibilityLiveRegion="polite" selectable style={styles.feedback} lightColor={Meadow.leafDeep} darkColor={Meadow.leafDeep}>
          {feedback}
        </ThemedText>
      ) : null}
    </KatchaSheet>
  );
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
  companionPanel: { backgroundColor: 'rgba(255,248,232,0.54)', borderColor: Meadow.cardBorder, borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, gap: 10, marginBottom: 12, padding: 14 },
  scopedPicker: { gap: 14, paddingBottom: 24, paddingHorizontal: 4, paddingTop: 6 },
  scopedBack: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 5, minHeight: 38, paddingHorizontal: 4 },
  scopedBackText: { fontFamily: AppFontFamilies.manrope, fontSize: 11.5, fontWeight: '900' },
  scopedHeading: { gap: 5, paddingBottom: 2 },
  scopedTitle: { fontFamily: AppFontFamilies.manrope, fontSize: 22, fontWeight: '900', letterSpacing: -0.4, lineHeight: 27 },
  scopedDescription: { fontFamily: AppFontFamilies.manrope, fontSize: 12.5, fontWeight: '600', lineHeight: 18 },
  panelHeading: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  panelCopy: { flex: 1, gap: 2 },
  panelEyebrow: { fontFamily: AppFontFamilies.manrope, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  panelTitle: { fontFamily: AppFontFamilies.manrope, fontSize: 15, fontWeight: '900' },
  manageButton: { alignItems: 'center', borderColor: Meadow.cardBorder, borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 4, minHeight: 34, paddingHorizontal: 10 },
  manageButtonText: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '900' },
  emptyGoals: { alignItems: 'center', backgroundColor: Meadow.goldSoft, borderCurve: 'continuous', borderRadius: 14, flexDirection: 'row', gap: 8, minHeight: 44, paddingHorizontal: 12 },
  emptyGoalsText: { fontFamily: AppFontFamilies.manrope, fontSize: 12.5, fontWeight: '800' },
  goalList: { gap: 7 },
  goalRow: { alignItems: 'center', backgroundColor: 'rgba(255,249,234,0.72)', borderColor: Meadow.cardBorder, borderCurve: 'continuous', borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 10, minHeight: 50, paddingHorizontal: 11, paddingVertical: 8 },
  goalRowCompact: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', minHeight: 36, paddingVertical: 5 },
  goalRowNight: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' },
  checkbox: { alignItems: 'center', borderColor: Meadow.goldDeep, borderRadius: 999, borderWidth: 1.5, height: 23, justifyContent: 'center', width: 23 },
  checkboxNight: { borderColor: Lantern.ember300 },
  checkboxComplete: { backgroundColor: Meadow.leafDeep, borderColor: Meadow.leafDeep },
  goalRowCopy: { flex: 1, gap: 2 },
  goalRowTitle: { fontFamily: AppFontFamilies.manrope, fontSize: 12.5, fontWeight: '800', lineHeight: 17 },
  goalRowTitleComplete: { opacity: 0.58, textDecorationLine: 'line-through' },
  goalRowMeta: { fontFamily: AppFontFamilies.manrope, fontSize: 9.5, fontWeight: '700' },
  completionPrompt: { alignItems: 'center', backgroundColor: 'rgba(111,139,102,0.14)', borderColor: 'rgba(78,112,72,0.34)', borderCurve: 'continuous', borderRadius: 15, borderWidth: 1, flexDirection: 'row', gap: 9, padding: 11 },
  completionCopy: { flex: 1, gap: 4 },
  completionTitle: { fontFamily: AppFontFamilies.manrope, fontSize: 12, fontWeight: '900' },
  completionActions: { flexDirection: 'row', gap: 14 },
  completionAction: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '900' },
  completionActionSecondary: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '800' },
  sheetContent: { gap: 18, paddingBottom: 28 },
  sheetSection: { gap: 9 },
  sectionLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 9.5, fontWeight: '900', letterSpacing: 1.1 },
  familyPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  familyPill: { borderColor: Meadow.cardBorder, borderRadius: 999, borderWidth: 1, minHeight: 36, paddingHorizontal: 11, justifyContent: 'center' },
  familyPillSelected: { backgroundColor: Meadow.goldSoft, borderColor: Meadow.goldDeep },
  familyPillText: { fontFamily: AppFontFamilies.manrope, fontSize: 11, fontWeight: '900' },
  presetList: { gap: 7 },
  presetRow: { alignItems: 'center', backgroundColor: 'rgba(255,249,234,0.66)', borderColor: Meadow.cardBorder, borderCurve: 'continuous', borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 8, minHeight: 50, paddingHorizontal: 12, paddingVertical: 8 },
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
  manageRow: { alignItems: 'center', borderBottomColor: Meadow.cardBorder, borderBottomWidth: 1, flexDirection: 'row', gap: 5, minHeight: 52, paddingVertical: 6 },
  manageIcon: { alignItems: 'center', borderColor: Meadow.cardBorder, borderRadius: 999, borderWidth: 1, height: 34, justifyContent: 'center', width: 34 },
  feedback: { fontFamily: AppFontFamilies.manrope, fontSize: 11.5, fontWeight: '900', textAlign: 'center' },
  disabled: { opacity: 0.46 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.985 }] },
});
