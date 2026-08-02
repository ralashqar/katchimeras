import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchaUI } from '@/constants/katcha-ui';
import { Meadow } from '@/constants/meadow-theme';
import { AppFontFamilies } from '@/constants/theme';
import { useJournalVoiceDraft } from '@/hooks/use-journal-voice-draft';
import type { CompanionReflectionDraft } from '@/types/companion-interaction';

export function CompanionReflectionComposerModal({
  initialDraft,
  onCancel,
  onSave,
  promptId,
  promptText,
  eyebrow = 'OPTIONAL NOTE',
  hapticOnSave = true,
  initialVoiceRecording = false,
  saveLabel = 'Save note',
  title = 'Add a note',
}: {
  initialDraft?: CompanionReflectionDraft | null;
  onCancel: () => void;
  onSave: (draft: CompanionReflectionDraft) => void;
  promptId: string;
  promptText: string;
  eyebrow?: string;
  hapticOnSave?: boolean;
  initialVoiceRecording?: boolean;
  saveLabel?: string;
  title?: string;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [text, setText] = useState(initialDraft?.text ?? '');
  const [voiceDraft, setVoiceDraft] = useState<CompanionReflectionDraft | null>(initialDraft ?? null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const player = useAudioPlayer();
  const playerStatus = useAudioPlayerStatus(player);
  const voice = useJournalVoiceDraft((draft) => {
    setVoiceDraft({ ...draft, promptId, promptText });
    if (draft.text.trim()) setText(draft.text);
  });
  const voiceStartRef = useRef(voice.start);
  const initialVoiceStarted = useRef(false);
  const busy = voice.phase === 'recording' || voice.phase === 'transcribing';
  const compact = height < 720;

  useEffect(() => {
    const showEvent = process.env.EXPO_OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = process.env.EXPO_OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    voiceStartRef.current = voice.start;
  }, [voice.start]);

  useEffect(() => {
    if (!initialVoiceRecording || initialVoiceStarted.current) return;
    initialVoiceStarted.current = true;
    const timeout = setTimeout(() => {
      Keyboard.dismiss();
      void voiceStartRef.current();
    }, 260);
    return () => clearTimeout(timeout);
  }, [initialVoiceRecording]);

  const close = () => {
    if (voice.phase === 'recording') {
      void voice.stop();
      return;
    }
    if (voice.phase === 'transcribing') return;
    player.pause();
    Keyboard.dismiss();
    onCancel();
  };
  const toggleVoice = () => {
    Keyboard.dismiss();
    if (voice.phase === 'recording') {
      void voice.stop();
      return;
    }
    if (voice.phase === 'transcribing') return;
    if (voice.phase === 'ready') voice.reset();
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void voice.start();
  };
  const togglePlayback = () => {
    if (!voiceDraft?.audioUri) return;
    if (playerStatus.playing) player.pause();
    else {
      player.replace({ uri: voiceDraft.audioUri });
      player.play();
    }
  };
  const save = () => {
    if (!text.trim() && !voiceDraft?.audioUri) return;
    const draft: CompanionReflectionDraft = {
      ...(voiceDraft ?? { kind: 'text' as const }),
      promptId,
      promptText,
      text: text.trim(),
    };
    if (hapticOnSave && process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Keyboard.dismiss();
    onSave(draft);
  };

  return (
    <Modal
      animationType="none"
      navigationBarTranslucent
      onRequestClose={close}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible>
      <View accessibilityViewIsModal style={styles.root}>
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(160)}
          exiting={FadeOut.duration(130)}
          style={styles.backdrop}>
          <Pressable accessibilityLabel="Close note" disabled={busy} onPress={close} style={StyleSheet.absoluteFill} />
        </Animated.View>

        <KeyboardAvoidingView
          behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
          style={[
            styles.keyboardFrame,
            keyboardVisible && styles.keyboardFrameOpen,
            {
              paddingBottom: Math.max(insets.bottom, keyboardVisible ? 8 : 16),
              paddingTop: insets.top + (keyboardVisible ? 6 : 16),
            },
          ]}>
          <Animated.View
            entering={reduceMotion ? undefined : FadeInDown.duration(220)}
            style={[styles.card, compact && styles.cardCompact, keyboardVisible && styles.cardKeyboard]}>
            <ScrollView
              contentContainerStyle={[styles.content, keyboardVisible && styles.contentKeyboard]}
              contentInsetAdjustmentBehavior="automatic"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <View style={styles.header}>
                <View style={styles.headerCopy}>
                  <ThemedText style={styles.eyebrow} lightColor={Meadow.goldDeep} darkColor={Meadow.goldDeep}>
                    {eyebrow}
                  </ThemedText>
                  <ThemedText selectable style={[styles.heading, keyboardVisible && styles.headingKeyboard]} lightColor={Meadow.ink} darkColor={Meadow.ink}>
                    {title}
                  </ThemedText>
                </View>
                <Pressable
                  accessibilityLabel={busy ? 'Finish voice recording before closing' : 'Close'}
                  accessibilityRole="button"
                  disabled={voice.phase === 'transcribing'}
                  onPress={close}
                  style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
                  <IconSymbol color={Meadow.inkSoft} name="xmark" size={14} />
                </Pressable>
              </View>

              {!keyboardVisible ? (
                <View style={styles.promptCard}>
                  <ThemedText selectable style={styles.promptText} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
                    {promptText}
                  </ThemedText>
                </View>
              ) : null}

              <TextInput
                accessibilityLabel="Reflection note"
                autoFocus={!initialVoiceRecording}
                editable={!busy}
                maxLength={600}
                multiline
                onChangeText={setText}
                placeholder="Write whatever you want to remember…"
                placeholderTextColor="rgba(91,67,44,0.52)"
                selectionColor={Meadow.goldDeep}
                style={[styles.input, keyboardVisible && styles.inputKeyboard]}
                textAlignVertical="top"
                value={text}
              />

              <View style={[styles.voiceSection, keyboardVisible && styles.voiceSectionKeyboard]}>
                <Pressable
                  accessibilityHint="Tap once to start and tap again to finish"
                  accessibilityLabel={voice.phase === 'recording' ? 'Finish recording note' : 'Record note with voice'}
                  accessibilityRole="button"
                  disabled={voice.phase === 'transcribing'}
                  onPress={toggleVoice}
                  style={({ pressed }) => [
                    styles.voiceButton,
                    keyboardVisible && styles.voiceButtonKeyboard,
                    voice.phase === 'recording' && styles.voiceButtonRecording,
                    pressed && styles.voiceButtonPressed,
                    voice.phase === 'transcribing' && styles.disabled,
                  ]}>
                  {voice.phase === 'transcribing' ? (
                    <ActivityIndicator color={Meadow.ink} size="large" />
                  ) : (
                    <IconSymbol
                      color={voice.phase === 'recording' ? Meadow.ink : '#FFF8E7'}
                      name={voice.phase === 'recording' ? 'stop.fill' : 'mic.fill'}
                      size={31}
                    />
                  )}
                </Pressable>
                <View style={styles.voiceCopy}>
                  <ThemedText style={styles.voiceTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>
                    {voice.phase === 'recording'
                      ? `Recording · 0:${String(voice.elapsed).padStart(2, '0')}`
                      : voice.phase === 'transcribing'
                        ? 'Turning your voice into text…'
                        : voice.phase === 'ready'
                          ? 'Voice note ready'
                          : 'Or say it out loud'}
                  </ThemedText>
                  <ThemedText style={styles.voiceHint} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
                    {voice.phase === 'recording' ? 'Tap again to finish' : 'Tap the microphone to record'}
                  </ThemedText>
                </View>
              </View>

              {voiceDraft?.audioUri ? (
                <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)} style={styles.audioRow}>
                  <Pressable accessibilityRole="button" onPress={togglePlayback} style={({ pressed }) => [styles.audioButton, pressed && styles.pressed]}>
                    <IconSymbol color={Meadow.goldDeep} name={playerStatus.playing ? 'pause.fill' : 'play.fill'} size={15} />
                    <ThemedText style={styles.audioButtonText} lightColor={Meadow.ink} darkColor={Meadow.ink}>
                      {playerStatus.playing ? 'Pause' : 'Play note'}
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    accessibilityLabel="Remove audio"
                    accessibilityRole="button"
                    onPress={() => {
                      player.pause();
                      setVoiceDraft(null);
                      voice.reset();
                    }}
                    style={({ pressed }) => [styles.audioRemove, pressed && styles.pressed]}>
                    <IconSymbol color="#8C3F36" name="trash" size={15} />
                  </Pressable>
                </Animated.View>
              ) : null}
              {voice.error ? (
                <ThemedText accessibilityRole="alert" selectable style={styles.error} lightColor="#8C3F36" darkColor="#8C3F36">
                  {voice.error}
                </ThemedText>
              ) : null}

              <Pressable
                accessibilityRole="button"
                disabled={busy || (!text.trim() && !voiceDraft?.audioUri)}
                onPress={save}
                style={({ pressed }) => [
                  styles.saveButton,
                  (busy || (!text.trim() && !voiceDraft?.audioUri)) && styles.disabled,
                  pressed && !busy && styles.pressed,
                ]}>
                <ThemedText style={styles.saveButtonText} lightColor={Meadow.ink} darkColor={Meadow.ink}>
                  {saveLabel}
                </ThemedText>
                <IconSymbol color={Meadow.ink} name="arrow.right" size={17} />
              </Pressable>
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(25,17,12,0.76)' },
  keyboardFrame: { flex: 1, justifyContent: 'center', paddingHorizontal: 14 },
  keyboardFrameOpen: { justifyContent: 'flex-start' },
  card: {
    alignSelf: 'center',
    backgroundColor: '#EAD3AA',
    borderColor: 'rgba(255,244,217,0.72)',
    borderCurve: 'continuous',
    borderRadius: 30,
    borderWidth: 1,
    boxShadow: '0 26px 70px rgba(30,18,8,0.52), inset 0 1px 0 rgba(255,248,230,0.70)',
    maxHeight: '92%',
    maxWidth: 520,
    overflow: 'hidden',
    width: '100%',
  },
  cardCompact: { maxHeight: '96%' },
  cardKeyboard: { maxHeight: '100%' },
  content: { gap: 15, padding: 18, paddingBottom: 20 },
  contentKeyboard: { gap: 9, padding: 14, paddingBottom: 14 },
  header: { alignItems: 'flex-start', flexDirection: 'row', gap: 12 },
  headerCopy: { flex: 1, gap: 3 },
  eyebrow: { ...KatchaUI.type.label, fontSize: 9.5, letterSpacing: 1.1 },
  heading: { ...KatchaUI.type.display, fontSize: 25, lineHeight: 29 },
  headingKeyboard: { fontSize: 22, lineHeight: 25 },
  closeButton: { alignItems: 'center', backgroundColor: 'rgba(255,249,234,0.50)', borderColor: 'rgba(119,86,43,0.18)', borderRadius: 999, borderWidth: 1, height: 40, justifyContent: 'center', width: 40 },
  promptCard: { backgroundColor: 'rgba(255,249,234,0.48)', borderCurve: 'continuous', borderRadius: 16, paddingHorizontal: 13, paddingVertical: 11 },
  promptText: { fontFamily: AppFontFamilies.manrope, fontSize: 12.5, fontStyle: 'italic', fontWeight: '600', lineHeight: 18 },
  input: { backgroundColor: '#FFF9EC', borderColor: 'rgba(184,137,54,0.42)', borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, color: Meadow.ink, fontFamily: AppFontFamilies.manrope, fontSize: 15, fontWeight: '700', lineHeight: 21, minHeight: 106, padding: 14 },
  inputKeyboard: { minHeight: 72, paddingVertical: 10 },
  voiceSection: { alignItems: 'center', gap: 9 },
  voiceSectionKeyboard: { gap: 5 },
  voiceButton: { alignItems: 'center', backgroundColor: '#211A13', borderColor: 'rgba(255,248,230,0.32)', borderRadius: 999, borderWidth: 1, boxShadow: '0 10px 26px rgba(52,33,18,0.32)', height: 82, justifyContent: 'center', width: 82 },
  voiceButtonKeyboard: { height: 66, width: 66 },
  voiceButtonRecording: { backgroundColor: '#F2C967', borderColor: '#D7A93C' },
  voiceButtonPressed: { transform: [{ scale: 0.95 }] },
  voiceCopy: { alignItems: 'center', gap: 1 },
  voiceTitle: { fontFamily: AppFontFamilies.manrope, fontSize: 13.5, fontVariant: ['tabular-nums'], fontWeight: '900' },
  voiceHint: { fontFamily: AppFontFamilies.manrope, fontSize: 11.5, fontWeight: '600' },
  audioRow: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'center' },
  audioButton: { alignItems: 'center', backgroundColor: 'rgba(255,249,234,0.52)', borderColor: 'rgba(119,86,43,0.20)', borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 6, minHeight: 38, paddingHorizontal: 12 },
  audioButtonText: { fontFamily: AppFontFamilies.manrope, fontSize: 11, fontWeight: '800' },
  audioRemove: { alignItems: 'center', backgroundColor: 'rgba(255,249,234,0.52)', borderColor: 'rgba(140,63,54,0.22)', borderRadius: 999, borderWidth: 1, height: 38, justifyContent: 'center', width: 38 },
  error: { fontFamily: AppFontFamilies.manrope, fontSize: 11.5, fontWeight: '800', lineHeight: 16, textAlign: 'center' },
  saveButton: { alignItems: 'center', backgroundColor: '#F2C967', borderColor: '#D7A93C', borderCurve: 'continuous', borderRadius: 17, borderWidth: 1, boxShadow: '0 7px 18px rgba(92,57,20,0.24), inset 0 1px 0 rgba(255,255,255,0.4)', flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 52 },
  saveButtonText: { fontFamily: AppFontFamilies.manrope, fontSize: 13.5, fontWeight: '900' },
  disabled: { opacity: 0.46 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
