import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { MeadowSheet } from '@/components/katchadeck/ui/meadow-sheet';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Lantern } from '@/constants/theme';
import type { ManualJournalSubmission } from '@/types/home';
import { MANUAL_JOURNAL_FLOWS, manualJournalFlow, type ManualJournalChoice, type ManualJournalFlowDefinition } from '@/utils/manual-journal-registry';

type Stage = 'flow' | 'category' | 'details' | 'note';

export function ManualJournalSheet({
  initialFlowId,
  initialChoiceId,
  initialSpecific,
  onClose,
  onSave,
}: {
  initialFlowId?: string | null;
  initialChoiceId?: string | null;
  initialSpecific?: string | null;
  onClose: () => void;
  onSave: (submission: ManualJournalSubmission) => void;
}) {
  const initialFlow = useMemo(() => initialFlowId ? manualJournalFlow(initialFlowId) : null, [initialFlowId]);
  const initialChoice = useMemo(
    () => initialFlow?.choices.find((item) => item.id === initialChoiceId) ?? null,
    [initialChoiceId, initialFlow]
  );
  const [stage, setStage] = useState<Stage>(initialChoice ? 'details' : initialFlow ? 'category' : 'flow');
  const [flow, setFlow] = useState<ManualJournalFlowDefinition | null>(initialFlow);
  const [choice, setChoice] = useState<ManualJournalChoice | null>(initialChoice);
  const [specific, setSpecific] = useState(initialSpecific ?? '');
  const [feeling, setFeeling] = useState<string | null>(null);
  const [context, setContext] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const breadcrumb = useMemo(() => [flow?.title, choice?.label].filter(Boolean).join(' › '), [choice, flow]);

  const save = () => {
    if (!flow || !choice) return;
    onSave({
      flowId: flow.id,
      path: [flow.id, choice.id, ...(feeling ? [feeling] : [])],
      categoryId: choice.id,
      canonicalQualityIds: choice.qualityIds ?? [],
      fields: { specific: specific.trim() || null, context },
      feeling,
      note: note.trim() || null,
    });
  };
  const back = () => {
    if (stage === 'note') setStage('details');
    else if (stage === 'details') setStage('category');
    else if (stage === 'category') { setFlow(null); setChoice(null); setStage('flow'); }
    else onClose();
  };

  return (
    <MeadowSheet onClose={onClose} kicker={breadcrumb || 'Manual journal'} title={stage === 'flow' ? 'What happened?' : stage === 'category' ? flow?.title ?? 'Choose one' : stage === 'details' ? flow?.detailTitle ?? 'Add a little context' : 'Anything you want to remember?'}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {stage === 'flow' ? (
          <View style={styles.grid}>
            {MANUAL_JOURNAL_FLOWS.map((item) => <ChoiceChip key={item.id} label={item.title} icon={item.icon} onPress={() => { setFlow(item); setStage('category'); }} />)}
          </View>
        ) : null}
        {stage === 'category' && flow ? (
          <View style={styles.grid}>
            {flow.choices.map((item) => <ChoiceChip key={item.id} label={item.label} icon={item.icon} onPress={() => { setChoice(item); setStage('details'); }} />)}
          </View>
        ) : null}
        {stage === 'details' && flow && choice ? (
          <View style={styles.stack}>
            {(choice.detailChoices ?? flow.contextChoices)?.length ? <>
              <ThemedText style={styles.label} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>A little more · optional</ThemedText>
              <View style={styles.feelings}>
                {(choice.detailChoices ?? flow.contextChoices ?? []).map((item) => (
                  <Pressable key={item.id} onPress={() => setContext((value) => value === item.id ? null : item.id)} style={[styles.feeling, context === item.id && styles.selected]}>
                    <ThemedText style={styles.feelingText} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{item.label}</ThemedText>
                  </Pressable>
                ))}
              </View>
            </> : null}
            <ThemedText style={styles.label} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>{flow.specificFieldLabel} · optional</ThemedText>
            <TextInput value={specific} onChangeText={setSpecific} placeholder={flow.specificFieldPlaceholder} placeholderTextColor={Lantern.moon500} style={styles.input} />
            <ThemedText style={styles.label} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>How was it? · optional</ThemedText>
            <View style={styles.feelings}>
              {flow.feelings.map((item) => (
                <Pressable key={item.id} onPress={() => setFeeling((value) => value === item.id ? null : item.id)} style={[styles.feeling, feeling === item.id && styles.selected]}>
                  <ThemedText style={styles.feelingText} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{item.label}</ThemedText>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => setStage('note')} style={styles.secondary}><ThemedText style={styles.secondaryText} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>Add a note</ThemedText></Pressable>
          </View>
        ) : null}
        {stage === 'note' ? (
          <View style={styles.stack}>
            <TextInput value={note} onChangeText={setNote} placeholder="A detail, thought, or memory…" placeholderTextColor={Lantern.moon500} multiline style={[styles.input, styles.note]} />
          </View>
        ) : null}
        <View style={styles.actions}>
          {stage !== 'flow' ? <Pressable onPress={back} style={styles.back}><ThemedText style={styles.backText} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>Back</ThemedText></Pressable> : null}
          {choice && (stage === 'details' || stage === 'note') ? <Pressable onPress={save} style={styles.save}><ThemedText style={styles.saveText} lightColor={Lantern.ink900} darkColor={Lantern.ink900}>Save to today</ThemedText></Pressable> : null}
        </View>
      </ScrollView>
    </MeadowSheet>
  );
}

function ChoiceChip({ label, icon, onPress }: { label: string; icon: ManualJournalFlowDefinition['icon']; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.choice}><IconSymbol name={icon} size={19} color={Lantern.ember300} /><ThemedText style={styles.choiceText} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{label}</ThemedText></Pressable>;
}

const styles = StyleSheet.create({
  content: { gap: 18, paddingBottom: 20 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, stack: { gap: 12 },
  choice: { width: '48%', minHeight: 72, gap: 9, padding: 14, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)', backgroundColor: 'rgba(255,255,255,0.05)' },
  choiceText: { fontSize: 14, lineHeight: 18, fontWeight: '800' }, label: { fontSize: 12.5, fontWeight: '700' },
  input: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.05)', color: Lantern.moon50, paddingHorizontal: 14, fontSize: 15 },
  note: { minHeight: 130, paddingTop: 14, textAlignVertical: 'top' }, feelings: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  feeling: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' }, selected: { borderColor: Lantern.ember300, backgroundColor: 'rgba(255,195,107,0.12)' },
  feelingText: { fontSize: 13, fontWeight: '700' }, secondary: { alignSelf: 'flex-start', paddingVertical: 9 }, secondaryText: { fontSize: 13.5, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 6 }, back: { flex: 1, alignItems: 'center', paddingVertical: 14 }, backText: { fontSize: 14, fontWeight: '800' },
  save: { flex: 2, alignItems: 'center', paddingVertical: 14, borderRadius: 999, backgroundColor: Lantern.moon50 }, saveText: { fontSize: 14, fontWeight: '900' },
});
