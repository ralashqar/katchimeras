import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type {
  CompanionDiscoveryPromptDefinition,
  KatchimeraRoleDefinition,
} from '@/constants/katchimera-roles';
import { AppFontFamilies } from '@/constants/theme';
import { Meadow } from '@/constants/meadow-theme';
import type { CompanionDiscoveryAnswer } from '@/utils/companion-discovery';

export function CompanionDiscoveryThread({
  answers,
  companionName,
  onAnswer,
  onRemove,
  onSetGoalStatus,
  prompts,
  role,
}: {
  answers: readonly CompanionDiscoveryAnswer[];
  companionName: string;
  onAnswer: (prompt: CompanionDiscoveryPromptDefinition, value: string) => void;
  onRemove: (promptId: string) => void;
  onSetGoalStatus: (promptId: string, status: 'active' | 'completed' | 'paused') => void;
  prompts: readonly CompanionDiscoveryPromptDefinition[];
  role: KatchimeraRoleDefinition | null;
}) {
  const answerByPrompt = useMemo(
    () => new Map(answers.map((answer) => [answer.promptId, answer])),
    [answers]
  );
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const submit = (prompt: CompanionDiscoveryPromptDefinition, value: string) => {
    if (!value.trim()) return;
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    onAnswer(prompt, value);
    setEditingPromptId(null);
    setDraft('');
  };

  return (
    <View style={styles.root}>
      <View style={styles.heading}>
        <ThemedText selectable style={styles.eyebrow} lightColor={Meadow.goldDeep} darkColor={Meadow.goldDeep}>
          GETTING TO KNOW YOU
        </ThemedText>
        <ThemedText selectable style={styles.title} lightColor={Meadow.ink} darkColor={Meadow.ink}>
          Help {companionName} understand
        </ThemedText>
        <ThemedText selectable style={styles.description} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
          {role?.role ?? 'Your answers shape future quests, goals, insights, and reflections.'}
        </ThemedText>
      </View>

      {prompts.map((prompt) => {
        const answer = answerByPrompt.get(prompt.id);
        const editing = editingPromptId === prompt.id;
        return (
          <View key={prompt.id} style={styles.card}>
            <ThemedText selectable style={styles.question} lightColor={Meadow.ink} darkColor={Meadow.ink}>
              {prompt.question}
            </ThemedText>
            <ThemedText selectable style={styles.helper} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
              {prompt.helperText}
            </ThemedText>

            {answer && !editing ? (
              <View style={styles.answerBlock}>
                <View style={styles.answerRow}>
                  <View style={styles.answerCopy}>
                    <ThemedText selectable style={styles.answerLabel} lightColor={Meadow.leafDeep} darkColor={Meadow.leafDeep}>
                      {prompt.kind === 'goal' ? `Your goal · ${answer.goalStatus ?? 'active'}` : 'Your answer'}
                    </ThemedText>
                    <ThemedText selectable style={styles.answerText} lightColor={Meadow.ink} darkColor={Meadow.ink}>
                      {answer.value}
                    </ThemedText>
                  </View>
                  <Pressable
                    accessibilityLabel="Edit answer"
                    accessibilityRole="button"
                    onPress={() => {
                      setDraft(answer.value);
                      setEditingPromptId(prompt.id);
                    }}
                    style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
                    <IconSymbol color={Meadow.inkSoft} name="pencil" size={16} />
                  </Pressable>
                  <Pressable
                    accessibilityLabel="Remove answer"
                    accessibilityRole="button"
                    onPress={() => onRemove(prompt.id)}
                    style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
                    <IconSymbol color={Meadow.inkSoft} name="trash.fill" size={16} />
                  </Pressable>
                </View>
                {prompt.kind === 'goal' ? (
                  <View style={styles.goalActions}>
                    {(['active', 'paused', 'completed'] as const).map((status) => (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: answer.goalStatus === status }}
                        key={status}
                        onPress={() => onSetGoalStatus(prompt.id, status)}
                        style={({ pressed }) => [
                          styles.goalStatus,
                          answer.goalStatus === status && styles.goalStatusSelected,
                          pressed && styles.pressed,
                        ]}>
                        <ThemedText style={styles.goalStatusLabel} lightColor={Meadow.ink} darkColor={Meadow.ink}>
                          {status === 'active' ? 'Active' : status === 'paused' ? 'Pause' : 'Complete'}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : prompt.kind === 'single_choice' && !editing ? (
              <View style={styles.options}>
                {(prompt.options ?? []).map((option) => (
                  <Pressable
                    accessibilityRole="button"
                    key={option}
                    onPress={() => submit(prompt, option)}
                    style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
                    <ThemedText selectable style={styles.optionText} lightColor={Meadow.ink} darkColor={Meadow.ink}>
                      {option}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.editor}>
                <TextInput
                  accessibilityLabel={prompt.question}
                  multiline
                  onChangeText={setDraft}
                  placeholder={prompt.kind === 'goal' ? 'A goal I want to remember…' : 'Write your answer…'}
                  placeholderTextColor={Meadow.inkFaint}
                  style={styles.input}
                  value={draft}
                />
                <View style={styles.editorActions}>
                  {editing ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setEditingPromptId(null);
                        setDraft('');
                      }}
                      style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                      <ThemedText style={styles.secondaryLabel} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>Cancel</ThemedText>
                    </Pressable>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    disabled={!draft.trim()}
                    onPress={() => submit(prompt, draft)}
                    style={({ pressed }) => [styles.saveButton, !draft.trim() && styles.disabled, pressed && styles.pressed]}>
                    <ThemedText style={styles.saveLabel} lightColor={Meadow.chipLabel} darkColor={Meadow.chipLabel}>
                      Remember this
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14, paddingBottom: 18, paddingHorizontal: 4, paddingTop: 8 },
  heading: { gap: 6, paddingBottom: 4, paddingHorizontal: 4 },
  eyebrow: { fontFamily: AppFontFamilies.manrope, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  title: { fontFamily: AppFontFamilies.manrope, fontSize: 23, fontWeight: '900', letterSpacing: -0.55, lineHeight: 28 },
  description: { fontFamily: AppFontFamilies.manrope, fontSize: 13, fontWeight: '600', lineHeight: 19 },
  card: {
    backgroundColor: 'rgba(255,248,232,0.46)',
    borderColor: Meadow.cardBorder,
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    gap: 9,
    padding: 15,
  },
  question: { fontFamily: AppFontFamilies.manrope, fontSize: 17, fontWeight: '900', lineHeight: 22 },
  helper: { fontFamily: AppFontFamilies.manrope, fontSize: 12, fontWeight: '600', lineHeight: 17 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 2 },
  option: { backgroundColor: Meadow.goldSoft, borderCurve: 'continuous', borderRadius: 14, minHeight: 40, justifyContent: 'center', paddingHorizontal: 13 },
  optionText: { fontFamily: AppFontFamilies.manrope, fontSize: 12.5, fontWeight: '800' },
  answerRow: { alignItems: 'center', backgroundColor: Meadow.goldSoft, borderCurve: 'continuous', borderRadius: 14, flexDirection: 'row', gap: 7, padding: 11 },
  answerBlock: { backgroundColor: Meadow.goldSoft, borderCurve: 'continuous', borderRadius: 14, gap: 7, padding: 4 },
  answerCopy: { flex: 1, gap: 2 },
  answerLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 9.5, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  answerText: { fontFamily: AppFontFamilies.manrope, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  iconButton: { alignItems: 'center', borderRadius: 999, height: 34, justifyContent: 'center', width: 34 },
  goalActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingBottom: 7, paddingHorizontal: 7 },
  goalStatus: { borderColor: Meadow.cardBorder, borderRadius: 999, borderWidth: 1, minHeight: 32, justifyContent: 'center', paddingHorizontal: 10 },
  goalStatusSelected: { backgroundColor: '#F5DFA8', borderColor: Meadow.goldDeep },
  goalStatusLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '800', textTransform: 'capitalize' },
  editor: { gap: 9 },
  input: {
    backgroundColor: '#FFF9EA',
    borderColor: Meadow.cardBorder,
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    color: Meadow.ink,
    fontFamily: AppFontFamilies.manrope,
    fontSize: 14,
    minHeight: 86,
    padding: 12,
    textAlignVertical: 'top',
  },
  editorActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  secondaryButton: { borderCurve: 'continuous', borderRadius: 13, justifyContent: 'center', minHeight: 40, paddingHorizontal: 13 },
  secondaryLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 12, fontWeight: '800' },
  saveButton: { backgroundColor: Meadow.goldDeep, borderCurve: 'continuous', borderRadius: 13, justifyContent: 'center', minHeight: 40, paddingHorizontal: 14 },
  saveLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 12, fontWeight: '900' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.985 }] },
});
