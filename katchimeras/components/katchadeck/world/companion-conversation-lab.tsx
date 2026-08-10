import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchaUI } from '@/constants/katcha-ui';
import type {
  ConversationDefinition,
  ConversationSession,
  ConversationTriggerKind,
} from '@/types/companion-conversation';

type LabFilter = 'all' | 'outcome' | ConversationTriggerKind;

const FILTERS: readonly { id: LabFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'outcome', label: 'Actions' },
  { id: 'signature_game', label: 'Games' },
  { id: 'evergreen', label: 'Dialogue' },
  { id: 'journal', label: 'Journal' },
  { id: 'goal_debrief', label: 'Goals' },
  { id: 'quest_debrief', label: 'Quest' },
  { id: 'bond', label: 'Bond' },
  { id: 'poll', label: 'Polls' },
];

const TRIGGER_LABELS: Readonly<Record<ConversationTriggerKind, string>> = {
  evergreen: 'DIALOGUE',
  journal: 'JOURNAL CALLBACK',
  bond: 'BOND MOMENT',
  goal_debrief: 'GOAL DEBRIEF',
  quest_debrief: 'QUEST DEBRIEF',
  signature_game: 'DISCOVERY GAME',
  poll: 'FICTIONAL POLL',
};

const FORMAT_LABELS: Readonly<Record<NonNullable<ConversationDefinition['format']>, string>> = {
  opener: 'NPC opener',
  narrative: 'authored thread beat',
  poll: 'one-off game',
  profile_game: 'form game',
  insight_game: 'insight game',
  outcome: 'decision path',
};

function definitionDetails(definition: ConversationDefinition): string {
  const outcomes = new Set<string>();
  for (const node of definition.nodes) {
    if (node.kind === 'memory_proposal') outcomes.add('Long Memory');
    if (node.kind === 'goal_proposal') outcomes.add('goals');
    if (node.kind === 'quick_goal_proposal') outcomes.add('small task');
    if (node.kind === 'quest_handoff') outcomes.add('quest handoff');
  }
  const parts = [definition.format ? FORMAT_LABELS[definition.format] : 'legacy flow'];
  if (definition.format === 'narrative' || definition.format === 'opener') parts.push('branches by answer');
  if (outcomes.size > 0) parts.push([...outcomes].join(' + '));
  return parts.join(' · ');
}

export function CompanionConversationLab({
  currentSession,
  definitions,
  onExitPreview,
  onSelectDefinition,
}: {
  currentSession: ConversationSession | null;
  definitions: readonly ConversationDefinition[];
  onExitPreview: () => void;
  onSelectDefinition: (definitionId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<LabFilter>('all');
  const visible = useMemo(
    () => definitions.filter((definition) => (
      filter === 'all' || (filter === 'outcome' ? definition.format === 'outcome' : definition.trigger === filter)
    )),
    [definitions, filter]
  );

  return (
    <View style={styles.shell}>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen((value) => !value)}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}>
        <View style={styles.devIcon}>
          <IconSymbol color="#FFF6DB" name="hammer.fill" size={17} />
        </View>
        <View style={styles.headerCopy}>
          <ThemedText selectable style={styles.headerTitle} lightColor="#3F3022" darkColor="#3F3022">
            Conversation Lab
          </ThemedText>
          <ThemedText selectable style={styles.headerBody} lightColor="#74604B" darkColor="#74604B">
            Developer preview · {definitions.length} authored beats · no rewards or saved outcomes
          </ThemedText>
        </View>
        <IconSymbol color="#795A34" name={open ? 'chevron.up' : 'chevron.down'} size={15} />
      </Pressable>

      {open ? (
        <View style={styles.content}>
          {currentSession?.preview ? (
            <View style={styles.previewNotice}>
              <View style={styles.previewCopy}>
                <ThemedText selectable style={styles.previewTitle} lightColor="#4A3725" darkColor="#4A3725">
                  Preview active
                </ThemedText>
                <ThemedText selectable numberOfLines={2} style={styles.previewBody} lightColor="#745E48" darkColor="#745E48">
                  {definitions.find((definition) => definition.id === currentSession.definitionId)?.title ?? currentSession.definitionId}
                </ThemedText>
              </View>
              <Pressable accessibilityRole="button" onPress={onExitPreview} style={({ pressed }) => [styles.exit, pressed && styles.pressed]}>
                <ThemedText style={styles.exitLabel} lightColor="#694226" darkColor="#694226">Exit</ThemedText>
              </Pressable>
            </View>
          ) : null}

          <ScrollView
            contentContainerStyle={styles.filters}
            horizontal
            showsHorizontalScrollIndicator={false}>
            {FILTERS.map((item) => (
              <Pressable
                accessibilityRole="button"
                key={item.id}
                onPress={() => setFilter(item.id)}
                style={({ pressed }) => [styles.filter, filter === item.id && styles.filterActive, pressed && styles.pressed]}>
                <ThemedText style={styles.filterLabel} lightColor={filter === item.id ? '#FFF8E7' : '#654D35'} darkColor={filter === item.id ? '#FFF8E7' : '#654D35'}>
                  {item.label}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.list}>
            {visible.map((definition) => {
              const active = currentSession?.preview && currentSession.definitionId === definition.id;
              return (
                <Pressable
                  accessibilityHint={`Launch ${definition.title} without saving player outcomes`}
                  accessibilityRole="button"
                  key={definition.id}
                  onPress={() => onSelectDefinition(definition.id)}
                  style={({ pressed }) => [styles.row, active && styles.rowActive, pressed && styles.pressed]}>
                  <View style={styles.rowCopy}>
                    <ThemedText selectable style={styles.kind} lightColor="#91692F" darkColor="#91692F">
                      {TRIGGER_LABELS[definition.trigger]}
                    </ThemedText>
                    <ThemedText selectable style={styles.title} lightColor="#3F3022" darkColor="#3F3022">
                      {definition.title}
                    </ThemedText>
                    <ThemedText selectable numberOfLines={1} style={styles.details} lightColor="#6E573F" darkColor="#6E573F">
                      {definitionDetails(definition)}
                    </ThemedText>
                    <ThemedText selectable numberOfLines={1} style={styles.id} lightColor="#806B56" darkColor="#806B56">
                      {definition.id}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.testLabel} lightColor="#634720" darkColor="#634720">
                    {active ? 'Restart' : 'Test'}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { backgroundColor: KatchaUI.companionPanel.background, borderColor: 'rgba(143,91,39,0.28)', borderCurve: 'continuous', borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  header: { alignItems: 'center', flexDirection: 'row', gap: 10, minHeight: 70, padding: 12 },
  devIcon: { alignItems: 'center', backgroundColor: '#9A6A33', borderRadius: 14, height: 40, justifyContent: 'center', width: 40 },
  headerCopy: { flex: 1, gap: 2 },
  headerTitle: { fontSize: 15, fontWeight: '900' },
  headerBody: { fontSize: 11, lineHeight: 15 },
  content: { borderTopColor: 'rgba(109,78,43,0.12)', borderTopWidth: 1, gap: 10, padding: 10 },
  previewNotice: { alignItems: 'center', backgroundColor: '#FFF3C9', borderRadius: 16, flexDirection: 'row', gap: 8, padding: 10 },
  previewCopy: { flex: 1, gap: 2 },
  previewTitle: { fontSize: 12, fontWeight: '900' },
  previewBody: { fontSize: 11, lineHeight: 15 },
  exit: { backgroundColor: 'rgba(255,255,255,0.56)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  exitLabel: { fontSize: 11, fontWeight: '900' },
  filters: { gap: 6, paddingRight: 6 },
  filter: { backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 },
  filterActive: { backgroundColor: '#8C6335' },
  filterLabel: { fontSize: 11, fontWeight: '900' },
  list: { gap: 6 },
  row: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.42)', borderColor: 'transparent', borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 8, minHeight: 66, padding: 10 },
  rowActive: { backgroundColor: '#FFF3C9', borderColor: 'rgba(154,106,51,0.3)' },
  rowCopy: { flex: 1, gap: 2 },
  kind: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  title: { fontSize: 13, fontWeight: '900', lineHeight: 17 },
  details: { fontSize: 10, fontWeight: '700', lineHeight: 14 },
  id: { fontSize: 9 },
  testLabel: { fontSize: 11, fontWeight: '900' },
  pressed: { opacity: 0.7 },
});
