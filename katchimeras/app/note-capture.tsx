import { useRouter } from 'expo-router';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
} from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Lantern } from '@/constants/theme';
import { useHomeScreenState } from '@/hooks/use-home-screen-state';
import { queueCaptureFeed } from '@/utils/capture-feed-signal';
import { interpretNote, transcribeAudioNote, type InterpretedNote } from '@/utils/note-interpret';

const MAX_SECONDS = 30;
const MEANING_TINT: Record<string, string> = {
  calm: '#7DE8CD',
  energy: '#FFC36B',
  together: '#F49AC1',
  meaningful: '#A78BFA',
};
const BIG_MOMENT_EMOJI: Record<string, string> = {
  birthday: '🎂',
  anniversary: '💛',
  firstTime: '⭐️',
  holiday: '🎏',
  trip: '🧳',
  achievement: '🏆',
  milestone: '🗿',
};

// Write or speak a note → interpret (transcribe + infer meaning) → confirm what it
// means (incl. a Big Moment) → fold into today and fly into the Memory Vault.
export default function NoteCaptureScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addNote } = useHomeScreenState();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const player = useAudioPlayer();
  const playerStatus = useAudioPlayerStatus(player);

  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [phase, setPhase] = useState<'input' | 'interpreting' | 'review'>('input');
  const [result, setResult] = useState<InterpretedNote | null>(null);
  const [markBig, setMarkBig] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Tracks press-and-hold intent so a release mid-setup cancels cleanly.
  const recordingRef = useRef(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  // Auto-focus the box so the keyboard is up immediately — tapping the note
  // button means "I want to write". (After the modal's fade so focus sticks.)
  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(id);
  }, []);

  const stopRecording = async () => {
    recordingRef.current = false;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setRecording(false);
    let uri: string | null = null;
    try {
      await recorder.stop();
      uri = recorder.uri ?? null;
      setAudioUri(uri);
    } catch {
      // keep whatever uri we have
    }
    // Transcribe the clip straight into the editable text box (on-device first).
    if (uri) {
      setTranscribing(true);
      try {
        const transcript = await transcribeAudioNote(uri);
        if (transcript) setText(transcript);
      } catch {
        // leave the box for the user to type
      }
      setTranscribing(false);
    }
  };

  const startRecording = async () => {
    if (recordingRef.current) return;
    recordingRef.current = true;
    setAudioUri(null);
    setText('');
    setElapsed(0);
    setRecording(true);
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      recordingRef.current = false;
      setRecording(false);
      Alert.alert('Microphone needed', 'Allow microphone access to record a voice note.');
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      if (!recordingRef.current) return; // released during setup
      await recorder.prepareToRecordAsync();
      if (!recordingRef.current) return; // released during setup
      recorder.record();
    } catch {
      recordingRef.current = false;
      setRecording(false);
      Alert.alert('Could not record', 'Recording is unavailable on this device build.');
      return;
    }
    timerRef.current = setInterval(() => {
      setElapsed((prev) => {
        if (prev + 1 >= MAX_SECONDS) {
          void stopRecording();
          return MAX_SECONDS;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const playRecording = async () => {
    if (!audioUri) return;
    if (playerStatus.playing) {
      player.pause();
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch {
      // best effort — playback may still work
    }
    player.replace({ uri: audioUri });
    player.play();
  };

  // Once there's text (typed or transcribed), the big button becomes "submit";
  // otherwise it's the hold-to-record mic.
  const submitMode = text.trim().length > 0 && !recording && !transcribing;

  const submit = async () => {
    if (recording) await stopRecording();
    setPhase('interpreting');
    try {
      // The text box is the source of truth (typed, or filled from transcription).
      // If transcription failed and there's audio, interpret the audio directly.
      const interpreted = text.trim()
        ? await interpretNote({ text: text.trim() })
        : audioUri
          ? await interpretNote({ audioUri })
          : null;
      if (!interpreted) {
        setPhase('input');
        return;
      }
      setResult(interpreted);
      setMarkBig(true);
      setPhase('review');
    } catch {
      setPhase('input');
      Alert.alert('Could not read that', 'Please try again.');
    }
  };

  const commit = () => {
    if (!result) return;
    addNote({
      kind: audioUri ? 'voice' : 'text',
      text: result.transcript || text.trim(),
      audioUri,
      durationMs: audioUri ? elapsed * 1000 : null,
      archetype: result.archetype,
      label: result.label,
      bigMoment: result.bigMoment && markBig ? result.bigMoment : undefined,
      media: result.media,
      food: result.food,
      llmClassified: result.llmClassified,
      intelligenceProvider: result.intelligenceProvider,
    });
    // Celebratory flight into the Memory Vault (World consumes this on focus).
    queueCaptureFeed({ photoUri: '', icon: 'square.and.pencil', accent: MEANING_TINT[result.archetype] ?? '#7DE8CD' });
    router.back();
  };

  return (
    <View style={[styles.screen, { paddingBottom: insets.bottom }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={14} style={styles.closeButton}>
          <IconSymbol name="xmark" size={20} color={Lantern.moon50} />
        </Pressable>
        <ThemedText style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
          Add a note
        </ThemedText>
        <View style={styles.closeButton} />
      </View>

      {phase === 'input' ? (
        <View style={styles.body}>
          <ThemedText style={styles.prompt} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
            Speak or type what stood out today.
          </ThemedText>

          <View>
            <TextInput
              style={styles.input}
              placeholder="e.g. It's my son's birthday…"
              placeholderTextColor={Lantern.moon500}
              value={text}
              onChangeText={setText}
              multiline
              editable={!recording && !transcribing}
            />
            {transcribing ? (
              <View style={styles.transcribingTag}>
                <ActivityIndicator color={Lantern.ember300} size="small" />
                <ThemedText style={styles.micLabel} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
                  Transcribing…
                </ThemedText>
              </View>
            ) : null}
          </View>

          <Pressable
            disabled={transcribing}
            onPress={() => {
              if (submitMode) void submit();
            }}
            onPressIn={() => {
              if (!submitMode) void startRecording();
            }}
            onPressOut={() => {
              if (recordingRef.current) void stopRecording();
            }}
            style={[styles.mic, recording && styles.micRecording, submitMode && styles.micSubmit, transcribing && styles.ctaDisabled]}>
            <IconSymbol name={submitMode ? 'arrow.right' : 'mic.fill'} size={28} color={Lantern.ink900} />
          </Pressable>
          <ThemedText style={styles.micLabel} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
            {recording
              ? `Recording… ${elapsed}s · release to stop`
              : transcribing
                ? 'Turning your voice into text…'
                : submitMode
                  ? 'Tap to interpret'
                  : 'Hold to record · or type above'}
          </ThemedText>

          {audioUri && !recording && !transcribing ? (
            <Pressable onPress={playRecording} style={styles.playback}>
              <IconSymbol name={playerStatus.playing ? 'pause.fill' : 'play.fill'} size={16} color={Lantern.moon50} />
              <ThemedText style={styles.playbackLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                {playerStatus.playing ? 'Playing…' : 'Play recording'}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {phase === 'interpreting' ? (
        <View style={styles.center}>
          <ActivityIndicator color={Lantern.ember300} size="large" />
          <ThemedText style={styles.prompt} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
            Reading what this means…
          </ThemedText>
        </View>
      ) : null}

      {phase === 'review' && result ? (
        <View style={styles.body}>
          {result.transcript ? (
            <View style={styles.transcript}>
              <ThemedText style={styles.transcriptText} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                “{result.transcript}”
              </ThemedText>
            </View>
          ) : null}

          <ThemedText style={styles.prompt} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
            What this means
          </ThemedText>
          <View style={[styles.meaningChip, { borderColor: `${MEANING_TINT[result.archetype] ?? Lantern.moon300}88` }]}>
            <View style={[styles.dot, { backgroundColor: MEANING_TINT[result.archetype] ?? Lantern.moon300 }]} />
            <ThemedText style={styles.meaningLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
              {result.label}
            </ThemedText>
          </View>

          {result.bigMoment ? (
            <Pressable onPress={() => setMarkBig((v) => !v)} style={[styles.bigMoment, markBig && styles.bigMomentOn]}>
              <ThemedText style={styles.bigEmoji}>{BIG_MOMENT_EMOJI[result.bigMoment.type] ?? '✨'}</ThemedText>
              <ThemedText style={styles.bigLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                Mark as a Big Moment{result.bigMoment.subject ? ` (${result.bigMoment.subject})` : ''}
              </ThemedText>
              <IconSymbol name={markBig ? 'star.fill' : 'star.fill'} size={16} color={markBig ? Lantern.ember300 : Lantern.moon500} />
            </Pressable>
          ) : null}

          <Pressable onPress={commit} style={styles.cta}>
            <ThemedText style={styles.ctaLabel} lightColor={Lantern.ink900} darkColor={Lantern.ink900}>
              Add to today
            </ThemedText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Lantern.ink950 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 6 },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  title: { fontSize: 17, fontWeight: '800' },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 12, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  prompt: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  input: {
    minHeight: 120,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 16,
    color: Lantern.moon50,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  mic: {
    alignSelf: 'center',
    width: 76,
    height: 76,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Lantern.ember300,
    marginTop: 4,
  },
  micRecording: { backgroundColor: '#F49AC1' },
  micSubmit: { backgroundColor: Lantern.moon50 },
  micLabel: { fontSize: 12.5, fontWeight: '700', textAlign: 'center' },
  transcribingTag: {
    position: 'absolute',
    bottom: 10,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playback: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  playbackLabel: { fontSize: 13.5, fontWeight: '800' },
  cta: {
    marginTop: 'auto',
    marginBottom: 16,
    alignItems: 'center',
    paddingVertical: 15,
    borderRadius: 999,
    backgroundColor: Lantern.moon50,
  },
  ctaDisabled: { opacity: 0.4 },
  ctaLabel: { fontSize: 15, fontWeight: '800' },
  transcript: { borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', padding: 16 },
  transcriptText: { fontSize: 15.5, fontWeight: '600', lineHeight: 22, fontStyle: 'italic' },
  meaningChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(12,10,20,0.6)',
  },
  dot: { width: 8, height: 8, borderRadius: 999 },
  meaningLabel: { fontSize: 14, fontWeight: '700' },
  bigMoment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  bigMomentOn: { borderColor: 'rgba(255,195,107,0.6)', backgroundColor: 'rgba(255,195,107,0.12)' },
  bigEmoji: { fontSize: 20 },
  bigLabel: { flex: 1, fontSize: 14, fontWeight: '700' },
});
