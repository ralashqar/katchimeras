import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { DEV_TOOLS_ENABLED } from '@/constants/dev';
import { companionConversationDefinitionsForFamily } from '@/constants/companion-conversations-v2';
import { CONVERSATION_V2_FAMILIES, type ConversationDefinition, type ConversationOption, type ConversationV2FamilyId } from '@/types/companion-conversation';

/**
 * Developer page: every daily question each katchimera can ask, one family at a
 * time, stepped through or listed in full. Polls, two-question narratives,
 * insight games and form games, with each answer's reply, hidden trait tags and
 * fictional village weight, so copy can be read end to end without playing a
 * day per question.
 */
function isDailyQuestion(definition: ConversationDefinition): boolean {
  return definition.format === 'poll' || definition.format === 'insight_game' || definition.format === 'profile_game' || Boolean(definition.tags?.includes('nature-question'));
}

function kindLabel(definition: ConversationDefinition): string {
  if (definition.tags?.includes('nature-question')) return definition.format === 'poll' ? 'daily question · poll' : 'daily question · two beats';
  if (definition.format === 'poll') return 'daily poll';
  if (definition.format === 'insight_game') return 'insight game';
  if (definition.format === 'profile_game') return 'form game';
  return definition.format ?? 'conversation';
}

function traitsLabel(option: ConversationOption): string | null {
  const entries = Object.entries(option.traits ?? {});
  return entries.length ? entries.map(([trait, weight]) => `${trait}${weight === 2 ? ' ×2' : ''}`).join(', ') : null;
}

function OptionRow({ option, weight }: { option: ConversationOption; weight?: number }) {
  const traits = traitsLabel(option);
  return <View style={styles.option}>
    <ThemedText selectable style={styles.optionLabel}>{option.label}{weight != null ? <ThemedText style={styles.weight}>  {weight}</ThemedText> : null}</ThemedText>
    {option.reply ? <ThemedText selectable style={styles.reply}>{option.reply}</ThemedText> : null}
    {traits ? <ThemedText selectable style={styles.traits}>{traits}</ThemedText> : null}
  </View>;
}

function QuestionCard({ definition, position }: { definition: ConversationDefinition; position: string }) {
  return <View style={styles.card}>
    <ThemedText selectable style={styles.position}>{position}</ThemedText>
    <ThemedText selectable style={styles.title}>{definition.actionTitle ?? definition.title}</ThemedText>
    <ThemedText selectable style={styles.meta}>{kindLabel(definition)} · bond {definition.minimumBondLevel} · every {definition.cooldownDays} day{definition.cooldownDays === 1 ? '' : 's'}{definition.contextualOnly ? ' · story only' : ''}</ThemedText>
    <ThemedText selectable style={styles.id}>{definition.id}</ThemedText>
    {definition.nodes.map((node) => {
      if (node.kind === 'choice' || node.kind === 'poll') {
        return <View key={node.id} style={styles.beat}>
          <ThemedText selectable style={styles.prompt}>{node.prompt}</ThemedText>
          {node.helperText ? <ThemedText selectable style={styles.helper}>{node.helperText}</ThemedText> : null}
          {node.options.map((option) => <OptionRow key={option.id} option={option} weight={'villageWeight' in option ? option.villageWeight : undefined} />)}
        </View>;
      }
      if (node.kind === 'insight_game' || node.kind === 'profile_game') {
        return <View key={node.id} style={styles.beat}>
          {node.questions.map((question, index) => <View key={question.id} style={styles.gameQuestion}>
            <ThemedText selectable style={styles.prompt}>{index + 1}. {question.prompt}</ThemedText>
            {question.options.map((option) => <OptionRow key={option.id} option={option} />)}
          </View>)}
        </View>;
      }
      if (node.kind === 'insight_reveal') {
        return <View key={node.id} style={styles.beat}>
          <ThemedText selectable style={styles.section}>Results · {node.title}</ThemedText>
          {node.results.map((result) => <View key={result.id} style={styles.result}>
            <ThemedText selectable style={styles.optionLabel}>{result.title}</ThemedText>
            <ThemedText selectable style={styles.reply}>{result.reflection}</ThemedText>
            <ThemedText selectable style={styles.traits}>{result.summary}</ThemedText>
          </View>)}
        </View>;
      }
      if (node.kind === 'form_reveal') {
        return <View key={node.id} style={styles.beat}>
          <ThemedText selectable style={styles.section}>Forms · {node.title}</ThemedText>
          {Object.entries(node.descriptions).map(([skinId, description]) => <ThemedText key={skinId} selectable style={styles.reply}>{skinId}: {description}</ThemedText>)}
        </View>;
      }
      if (node.kind === 'end') return <ThemedText key={node.id} selectable style={styles.ending}>{node.message}</ThemedText>;
      return null;
    })}
  </View>;
}

export function QuestionLabScreen() {
  const [family, setFamily] = useState<ConversationV2FamilyId>('steppling');
  const [index, setIndex] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const questions = useMemo(() => companionConversationDefinitionsForFamily(family).filter(isDailyQuestion), [family]);
  const current = questions[Math.min(index, Math.max(0, questions.length - 1))] ?? null;
  if (!DEV_TOOLS_ENABLED) return <View style={styles.center}><ThemedText>Question Lab is available in developer builds.</ThemedText></View>;
  return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
    <Stack.Screen options={{ title: 'Question Lab' }} />
    <ThemedText selectable style={styles.heading}>Every daily question, by katchimera</ThemedText>
    <View style={styles.chips}>
      {CONVERSATION_V2_FAMILIES.map((candidate) => <Pressable key={candidate} accessibilityRole="button" accessibilityState={{ selected: candidate === family }}
        onPress={() => { setFamily(candidate); setIndex(0); }} style={[styles.chip, candidate === family && styles.chipSelected]}>
        <ThemedText style={[styles.chipLabel, candidate === family && styles.chipLabelSelected]}>{candidate}</ThemedText>
      </Pressable>)}
    </View>
    <View style={styles.controls}>
      <Pressable accessibilityRole="button" disabled={showAll || index <= 0} onPress={() => setIndex((value) => Math.max(0, value - 1))} style={[styles.button, (showAll || index <= 0) && styles.buttonDisabled]}>
        <ThemedText style={styles.buttonLabel}>Previous</ThemedText>
      </Pressable>
      <ThemedText selectable style={styles.counter}>{questions.length ? `${showAll ? questions.length : index + 1} / ${questions.length}` : 'none'}</ThemedText>
      <Pressable accessibilityRole="button" disabled={showAll || index >= questions.length - 1} onPress={() => setIndex((value) => Math.min(questions.length - 1, value + 1))} style={[styles.button, (showAll || index >= questions.length - 1) && styles.buttonDisabled]}>
        <ThemedText style={styles.buttonLabel}>Next</ThemedText>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: showAll }} onPress={() => setShowAll((value) => !value)} style={[styles.button, showAll && styles.buttonSelected]}>
        <ThemedText style={styles.buttonLabel}>{showAll ? 'One at a time' : 'Show all'}</ThemedText>
      </Pressable>
    </View>
    {!questions.length ? <ThemedText selectable style={styles.meta}>This family has no daily questions authored yet.</ThemedText> : null}
    {showAll
      ? questions.map((definition, position) => <QuestionCard key={definition.id} definition={definition} position={`${position + 1} of ${questions.length}`} />)
      : current ? <QuestionCard definition={current} position={`${index + 1} of ${questions.length}`} /> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  heading: { fontSize: 22, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: 'rgba(120,120,140,0.16)' },
  chipSelected: { backgroundColor: '#2E4A66' },
  chipLabel: { fontSize: 13, fontWeight: '600' },
  chipLabelSelected: { color: '#FFFFFF' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  button: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(120,120,140,0.16)' },
  buttonSelected: { backgroundColor: 'rgba(46,74,102,0.35)' },
  buttonDisabled: { opacity: 0.4 },
  buttonLabel: { fontSize: 13, fontWeight: '700' },
  counter: { fontSize: 13, fontVariant: ['tabular-nums'], minWidth: 56, textAlign: 'center' },
  card: { gap: 8, padding: 14, borderRadius: 16, backgroundColor: 'rgba(120,120,140,0.10)' },
  position: { fontSize: 11, opacity: 0.6 },
  title: { fontSize: 18, fontWeight: '700' },
  meta: { fontSize: 12, opacity: 0.75 },
  id: { fontSize: 11, opacity: 0.5, fontFamily: 'Menlo' },
  beat: { gap: 6, paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(120,120,140,0.4)' },
  gameQuestion: { gap: 4, paddingBottom: 6 },
  prompt: { fontSize: 15, fontWeight: '600' },
  helper: { fontSize: 12, opacity: 0.7 },
  section: { fontSize: 13, fontWeight: '700', opacity: 0.8 },
  option: { paddingLeft: 10, gap: 1 },
  optionLabel: { fontSize: 14, fontWeight: '600' },
  weight: { fontSize: 11, opacity: 0.55 },
  reply: { fontSize: 13, opacity: 0.85, fontStyle: 'italic' },
  traits: { fontSize: 11, opacity: 0.6 },
  result: { paddingLeft: 10, gap: 2 },
  ending: { fontSize: 13, opacity: 0.85, paddingTop: 6 },
});
