import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Meadow } from '@/constants/meadow-theme';
import { useJournalVoiceDraft } from '@/hooks/use-journal-voice-draft';
import type { CompanionReflectionDraft } from '@/types/companion-interaction';
import { CompanionSecondaryAction, CompanionSection } from './companion-interaction-primitives';

export function CompanionReflectionThread({
  promptId,
  promptText,
  initialDraft,
  onDraftChange,
}: {
  promptId: string;
  promptText: string;
  initialDraft?: CompanionReflectionDraft | null;
  onDraftChange: (draft: CompanionReflectionDraft | null) => void;
}) {
  const [text, setText] = useState(initialDraft?.text ?? '');
  const [voiceDraft, setVoiceDraft] = useState<CompanionReflectionDraft | null>(initialDraft ?? null);
  const inputRef = useRef<TextInput>(null);
  const longPress = useRef(false);
  const player = useAudioPlayer();
  const playerStatus = useAudioPlayerStatus(player);
  const voice = useJournalVoiceDraft((draft) => {
    const next = { ...draft, promptId, promptText };
    setVoiceDraft(next);
    setText(draft.text);
    onDraftChange(next);
  });

  useEffect(() => {
    const next = text.trim() || voiceDraft?.audioUri
      ? { ...(voiceDraft ?? { kind: 'text' as const }), text, promptId, promptText }
      : null;
    onDraftChange(next);
  }, [onDraftChange, promptId, promptText, text, voiceDraft]);

  const togglePlayback = () => {
    if (!voiceDraft?.audioUri) return;
    if (playerStatus.playing) player.pause();
    else { player.replace({ uri: voiceDraft.audioUri }); player.play(); }
  };

  return (
    <View style={styles.root}>
      <CompanionSection label="A question for you">
        <ThemedText selectable style={styles.prompt} lightColor={Meadow.ink} darkColor={Meadow.ink}>{promptText}</ThemedText>
      </CompanionSection>
      <CompanionSection label="Your answer">
        <TextInput
          ref={inputRef}
          accessibilityLabel="Reflection answer"
          accessibilityHint="Write an answer to your companion's reflection question"
          multiline
          onChangeText={setText}
          placeholder="Write whatever comes to mind…"
          placeholderTextColor={Meadow.inkSoft}
          selectionColor={Meadow.goldDeep}
          style={styles.input}
          textAlignVertical="top"
          value={text}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={voice.phase === 'recording' ? 'Stop recording' : 'Write or record reflection'}
          accessibilityHint="Tap to focus the text field. Hold to record a voice answer."
          delayLongPress={350}
          onLongPress={() => {
            longPress.current = true;
            if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            void voice.start();
          }}
          onPress={() => { if (!longPress.current) inputRef.current?.focus(); longPress.current = false; }}
          onPressOut={() => { if (longPress.current) void voice.stop(); }}
          style={({ pressed }) => [styles.voiceControl, voice.phase === 'recording' && styles.recording, pressed && styles.pressed]}>
          <IconSymbol name={voice.phase === 'recording' ? 'waveform' : 'mic.fill'} size={16} color={voice.phase === 'recording' ? Meadow.ink : Meadow.goldDeep} />
          <ThemedText style={[styles.voiceLabel, voice.phase === 'recording' && styles.recordingLabel]} lightColor={voice.phase === 'recording' ? Meadow.ink : Meadow.inkSoft} darkColor={voice.phase === 'recording' ? Meadow.ink : Meadow.inkSoft}>
            {voice.phase === 'recording' ? `Recording  0:${String(voice.elapsed).padStart(2, '0')}` : voice.phase === 'transcribing' ? 'Transcribing…' : 'Tap to type · hold to speak'}
          </ThemedText>
        </Pressable>
      </CompanionSection>
      {voiceDraft?.audioUri ? (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)} style={styles.audioRow}>
          <CompanionSecondaryAction label={playerStatus.playing ? 'Pause' : 'Play answer'} icon={playerStatus.playing ? 'pause.fill' : 'play.fill'} onPress={togglePlayback} />
          <CompanionSecondaryAction label="Remove" icon="trash" destructive onPress={() => { player.pause(); setVoiceDraft(null); voice.reset(); }} />
        </Animated.View>
      ) : null}
      {voice.error ? <ThemedText selectable style={styles.error} lightColor="#A84F43" darkColor="#A84F43">{voice.error}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 22, paddingBottom: 20, paddingTop: 8 },
  prompt: { fontSize: 20, lineHeight: 29 },
  input: {
    backgroundColor: 'rgba(255,248,232,0.42)', borderColor: Meadow.cardBorder, borderCurve: 'continuous', borderRadius: 18, borderWidth: 1,
    color: Meadow.ink, fontFamily: 'Manrope', fontSize: 15, lineHeight: 22, minHeight: 126, padding: 15,
  },
  voiceControl: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: 'rgba(255,248,232,0.42)', borderColor: Meadow.cardBorder, borderCurve: 'continuous', borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 8, minHeight: 46, paddingHorizontal: 14 },
  recording: { backgroundColor: '#E7B951' },
  voiceLabel: { fontSize: 12.5, fontWeight: '800', fontVariant: ['tabular-nums'] },
  recordingLabel: { color: Meadow.ink },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  audioRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  error: { fontSize: 12.5, lineHeight: 18 },
});
