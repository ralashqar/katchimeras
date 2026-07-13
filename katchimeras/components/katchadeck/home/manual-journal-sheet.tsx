import * as Haptics from 'expo-haptics';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { MeadowSheet } from '@/components/katchadeck/ui/meadow-sheet';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Lantern } from '@/constants/theme';
import { useJournalVoiceDraft } from '@/hooks/use-journal-voice-draft';
import type { JournalNoteDraft, ManualJournalSubmission } from '@/types/home';
import type { PhotoJournalFieldSuggestion } from '@/utils/intelligence/photo-journal-routing';
import { MANUAL_JOURNAL_FLOWS, manualJournalFlow, type ManualJournalChoice, type ManualJournalFlowDefinition } from '@/utils/manual-journal-registry';

type Stage = 'flow' | 'category' | 'details' | 'note';

export function ManualJournalSheet({
  initialFlowId, initialChoiceId, initialSpecific, initialSpecificSuggestions = [],
  sourceType = 'manual', sourceId, thumbnailUri, onBackFromInitial, onClose, onSave,
}: {
  initialFlowId?: string | null;
  initialChoiceId?: string | null;
  initialSpecific?: string | null;
  initialSpecificSuggestions?: PhotoJournalFieldSuggestion[];
  sourceType?: 'manual' | 'photo';
  sourceId?: string | null;
  thumbnailUri?: string | null;
  onBackFromInitial?: () => void;
  onClose: () => void;
  onSave: (submission: ManualJournalSubmission) => void;
}) {
  const initialFlow = useMemo(() => initialFlowId ? manualJournalFlow(initialFlowId) : null, [initialFlowId]);
  const initialChoice = useMemo(() => initialFlow?.choices.find((item) => item.id === initialChoiceId) ?? null, [initialChoiceId, initialFlow]);
  const [stage, setStage] = useState<Stage>(initialChoice ? 'details' : initialFlow ? 'category' : 'flow');
  const [flow, setFlow] = useState<ManualJournalFlowDefinition | null>(initialFlow);
  const [choice, setChoice] = useState<ManualJournalChoice | null>(initialChoice);
  const [specific, setSpecific] = useState(initialSpecific ?? '');
  const [feeling, setFeeling] = useState<string | null>(null);
  const [context, setContext] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [linkedNote, setLinkedNote] = useState<JournalNoteDraft | null>(null);
  const longPressRef = useRef(false);
  const redoLongPressRef = useRef(false);
  const player = useAudioPlayer();
  const playerStatus = useAudioPlayerStatus(player);
  const voice = useJournalVoiceDraft((draft) => { setLinkedNote(draft); setNote(draft.text); setStage('note'); });
  const breadcrumb = useMemo(() => [flow?.title, choice?.label].filter(Boolean).join(' › '), [choice, flow]);

  const save = () => {
    if (!flow || !choice) return;
    const trimmedNote = note.trim();
    onSave({
      flowId: flow.id, path: [flow.id, choice.id, ...(feeling ? [feeling] : [])], categoryId: choice.id,
      canonicalQualityIds: choice.qualityIds ?? [], fields: { specific: specific.trim() || null, context }, feeling,
      note: trimmedNote || null, sourceType, sourceId: sourceId ?? null, thumbnailUri: thumbnailUri ?? null,
      linkedNote: linkedNote ? { ...linkedNote, text: trimmedNote } : trimmedNote ? { kind: 'text', text: trimmedNote } : null,
    });
  };
  const back = () => {
    if (stage === 'note') setStage('details');
    else if (stage === 'details' && initialChoice && onBackFromInitial) onBackFromInitial();
    else if (stage === 'details') setStage('category');
    else if (stage === 'category') { setFlow(null); setChoice(null); setStage('flow'); }
    else if (onBackFromInitial) onBackFromInitial();
    else onClose();
  };
  const toggleAudio = () => {
    if (!linkedNote?.audioUri) return;
    if (playerStatus.playing) player.pause();
    else { player.replace({ uri: linkedNote.audioUri }); player.play(); }
  };

  return (
    <MeadowSheet onClose={onClose} kicker={breadcrumb || 'Manual journal'} title={stage === 'flow' ? 'What happened?' : stage === 'category' ? flow?.title ?? 'Choose one' : stage === 'details' ? flow?.detailTitle ?? 'Add a little context' : 'Anything you want to remember?'}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {stage === 'flow' ? <View style={styles.grid}>{MANUAL_JOURNAL_FLOWS.map((item) => <ChoiceChip key={item.id} label={item.title} icon={item.icon} onPress={() => { setFlow(item); setStage('category'); }} />)}</View> : null}
        {stage === 'category' && flow ? <View style={styles.grid}>{flow.choices.map((item) => <ChoiceChip key={item.id} label={item.label} icon={item.icon} onPress={() => { setChoice(item); setStage('details'); }} />)}</View> : null}
        {stage === 'details' && flow && choice ? (
          <View style={styles.stack}>
            {(choice.detailChoices ?? flow.contextChoices)?.length ? <>
              <ThemedText style={styles.label} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>A little more · optional</ThemedText>
              <View style={styles.feelings}>{(choice.detailChoices ?? flow.contextChoices ?? []).map((item) => <Pressable key={item.id} onPress={() => setContext((value) => value === item.id ? null : item.id)} style={[styles.feeling, context === item.id && styles.selected]}><ThemedText style={styles.feelingText} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{item.label}</ThemedText></Pressable>)}</View>
            </> : null}
            <ThemedText style={styles.label} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>{choice.specificFieldLabel ?? flow.specificFieldLabel} · optional</ThemedText>
            <TextInput value={specific} onChangeText={setSpecific} placeholder={choice.specificFieldPlaceholder ?? flow.specificFieldPlaceholder} placeholderTextColor={Lantern.moon500} style={styles.input} />
            {initialSpecificSuggestions.filter((item) => item.value !== specific).length ? <View style={styles.suggestions}>{initialSpecificSuggestions.filter((item) => item.value !== specific).slice(0, 3).map((item) => <Pressable key={`${item.provenance}:${item.value}`} onPress={() => setSpecific(item.value)} style={styles.suggestion}><ThemedText style={styles.suggestionText} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{item.value}</ThemedText></Pressable>)}</View> : null}
            <ThemedText style={styles.label} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>How was it? · optional</ThemedText>
            <View style={styles.feelings}>{flow.feelings.map((item) => <Pressable key={item.id} onPress={() => setFeeling((value) => value === item.id ? null : item.id)} style={[styles.feeling, feeling === item.id && styles.selected]}><ThemedText style={styles.feelingText} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{item.label}</ThemedText></Pressable>)}</View>
            <Pressable
              accessibilityRole="button" accessibilityLabel="Add a note. Tap to type or hold to record."
              accessibilityActions={[{ name: 'activate', label: 'Write note' }, { name: 'longpress', label: 'Record voice note' }]}
              delayLongPress={350}
              onAccessibilityAction={(event) => event.nativeEvent.actionName === 'longpress' ? void voice.start() : setStage('note')}
              onLongPress={() => { longPressRef.current = true; void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); void voice.start(); }}
              onPress={() => { if (!longPressRef.current) setStage('note'); longPressRef.current = false; }}
              onPressOut={() => { if (longPressRef.current) void voice.stop(); }} style={styles.secondary}>
              <ThemedText style={styles.secondaryText} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>Add a note</ThemedText>
              <ThemedText style={styles.noteHint} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>Tap to type · hold to speak</ThemedText>
            </Pressable>
            {voice.phase === 'recording' ? <ThemedText style={styles.recording} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>Recording 0:{String(voice.elapsed).padStart(2, '0')} · release to finish</ThemedText> : null}
            {voice.phase === 'transcribing' ? <View style={styles.reading}><ActivityIndicator color={Lantern.ember300} /><ThemedText style={styles.noteHint} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>Transcribing on device…</ThemedText></View> : null}
            {voice.error ? <ThemedText style={styles.error} lightColor="#FFB4A8" darkColor="#FFB4A8">{voice.error}</ThemedText> : null}
          </View>
        ) : null}
        {stage === 'note' ? <View style={styles.stack}>
          <TextInput value={note} onChangeText={setNote} placeholder="A detail, thought, or memory…" placeholderTextColor={Lantern.moon500} multiline style={[styles.input, styles.note]} />
          {linkedNote?.kind === 'voice' && linkedNote.audioUri ? <View style={styles.voiceRow}><Pressable onPress={toggleAudio} style={styles.voiceAction}><ThemedText style={styles.secondaryText} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{playerStatus.playing ? 'Pause audio' : 'Play audio'}</ThemedText></Pressable><Pressable delayLongPress={350} onLongPress={() => { redoLongPressRef.current = true; void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); void voice.start(); }} onPressOut={() => { if (redoLongPressRef.current) void voice.stop(); redoLongPressRef.current = false; }} style={styles.voiceAction}><ThemedText style={styles.noteHint} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>Hold to redo</ThemedText></Pressable><Pressable onPress={() => { setLinkedNote(null); voice.reset(); }} style={styles.voiceAction}><ThemedText style={styles.noteHint} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>Remove recording</ThemedText></Pressable></View> : null}
          {voice.phase === 'recording' ? <ThemedText style={styles.recording} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>Recording 0:{String(voice.elapsed).padStart(2, '0')} · release to finish</ThemedText> : null}
          {voice.phase === 'transcribing' ? <View style={styles.reading}><ActivityIndicator color={Lantern.ember300} /><ThemedText style={styles.noteHint} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>Updating transcript on device…</ThemedText></View> : null}
        </View> : null}
        <View style={styles.actions}>{stage !== 'flow' ? <Pressable onPress={back} style={styles.back}><ThemedText style={styles.backText} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>Back</ThemedText></Pressable> : null}{choice && (stage === 'details' || stage === 'note') ? <Pressable disabled={voice.phase === 'transcribing'} onPress={save} style={[styles.save, voice.phase === 'transcribing' && styles.disabled]}><ThemedText style={styles.saveText} lightColor={Lantern.ink900} darkColor={Lantern.ink900}>Save to today</ThemedText></Pressable> : null}</View>
      </ScrollView>
    </MeadowSheet>
  );
}

function ChoiceChip({ label, icon, onPress }: { label: string; icon: ManualJournalFlowDefinition['icon']; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.choice}><IconSymbol name={icon} size={19} color={Lantern.ember300} /><ThemedText style={styles.choiceText} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{label}</ThemedText></Pressable>;
}

const styles = StyleSheet.create({
  content: { gap: 18, paddingBottom: 20 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, stack: { gap: 12 },
  choice: { width: '48%', minHeight: 72, gap: 9, padding: 14, borderRadius: 17, borderCurve: 'continuous', borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)', backgroundColor: 'rgba(255,255,255,0.05)' },
  choiceText: { fontSize: 14, lineHeight: 18, fontWeight: '800' }, label: { fontSize: 12.5, fontWeight: '700' },
  input: { minHeight: 50, borderRadius: 14, borderCurve: 'continuous', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.05)', color: Lantern.moon50, paddingHorizontal: 14, fontSize: 15 },
  note: { minHeight: 130, paddingTop: 14, textAlignVertical: 'top' }, feelings: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  feeling: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' }, selected: { borderColor: Lantern.ember300, backgroundColor: 'rgba(255,195,107,0.12)' },
  feelingText: { fontSize: 13, fontWeight: '700' }, secondary: { alignSelf: 'flex-start', gap: 2, paddingVertical: 9 }, secondaryText: { fontSize: 13.5, fontWeight: '800' }, noteHint: { fontSize: 11.5, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 6 }, back: { flex: 1, alignItems: 'center', paddingVertical: 14 }, backText: { fontSize: 14, fontWeight: '800' },
  save: { flex: 2, alignItems: 'center', paddingVertical: 14, borderRadius: 999, backgroundColor: Lantern.moon50 }, saveText: { fontSize: 14, fontWeight: '900' }, disabled: { opacity: 0.45 },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, suggestion: { borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,195,107,0.4)', paddingHorizontal: 11, paddingVertical: 7 }, suggestionText: { fontSize: 12.5, fontWeight: '700' },
  recording: { fontSize: 13, fontWeight: '800' }, reading: { alignItems: 'center', flexDirection: 'row', gap: 8 }, error: { fontSize: 12.5, lineHeight: 17 }, voiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, voiceAction: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)' },
});
