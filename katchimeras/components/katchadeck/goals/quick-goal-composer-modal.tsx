import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
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
import type { CompanionQuickGoalCadence } from '@/utils/companion-quick-goals';

type SaveResult = { added: boolean; reason: string | null };

export function QuickGoalComposerModal({
  dayId,
  familyName,
  onRequestClose,
  onSave,
}: {
  dayId: string;
  familyName: string;
  onRequestClose: () => void;
  onSave: (title: string, cadence: CompanionQuickGoalCadence) => SaveResult;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [title, setTitle] = useState('');
  const [cadence, setCadence] = useState<CompanionQuickGoalCadence>({ kind: 'once', dayId });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const voice = useJournalVoiceDraft((draft) => {
    const transcript = draft.text.trim();
    if (transcript) {
      setTitle(transcript);
      setFeedback(null);
    }
  });
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

  const close = () => {
    if (voice.phase === 'recording') {
      void voice.stop();
      return;
    }
    if (voice.phase === 'transcribing') return;
    voice.reset();
    Keyboard.dismiss();
    onRequestClose();
  };
  const toggleVoice = () => {
    Keyboard.dismiss();
    setFeedback(null);
    if (voice.phase === 'recording') {
      void voice.stop();
      return;
    }
    if (voice.phase === 'transcribing') return;
    if (voice.phase === 'ready') voice.reset();
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void voice.start();
  };
  const save = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setFeedback('Write or record a short goal first.');
      return;
    }
    if (cadence.kind === 'weekdays' && !cadence.weekdays.length) {
      setFeedback('Choose at least one day.');
      return;
    }
    const result = onSave(trimmed, cadence);
    if (!result.added) {
      setFeedback(result.reason === 'duplicate' ? 'That goal is already active.' : 'This goal could not be added.');
      return;
    }
    if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    close();
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
          <Pressable
            accessibilityLabel="Close custom goal"
            disabled={busy}
            onPress={close}
            style={StyleSheet.absoluteFill}
          />
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
                    YOUR GOAL
                  </ThemedText>
                  <ThemedText selectable style={[styles.heading, keyboardVisible && styles.headingKeyboard]} lightColor={Meadow.ink} darkColor={Meadow.ink}>
                    Write my own goal
                  </ThemedText>
                  {!keyboardVisible ? (
                    <ThemedText selectable style={styles.subtitle} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
                      Keep it small and specific. {familyName} will keep it with your Goals.
                    </ThemedText>
                  ) : null}
                </View>
                <Pressable
                  accessibilityLabel={busy ? 'Finish voice recording before closing' : 'Close'}
                  accessibilityRole="button"
                  disabled={voice.phase === 'transcribing'}
                  hitSlop={8}
                  onPress={close}
                  style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
                  <IconSymbol color={Meadow.inkSoft} name="xmark" size={14} />
                </Pressable>
              </View>

              <TextInput
                accessibilityLabel="Goal"
                autoCapitalize="sentences"
                autoFocus
                editable={!busy}
                maxLength={120}
                multiline
                onChangeText={(value) => {
                  setTitle(value);
                  setFeedback(null);
                }}
                placeholder="For example, step outside for five minutes"
                placeholderTextColor="rgba(91,67,44,0.52)"
                selectionColor={Meadow.goldDeep}
                style={[styles.input, keyboardVisible && styles.inputKeyboard]}
                textAlignVertical="top"
                value={title}
              />

              <View style={[styles.voiceSection, keyboardVisible && styles.voiceSectionKeyboard]}>
                <Pressable
                  accessibilityHint="Tap once to start and tap again to finish"
                  accessibilityLabel={voice.phase === 'recording' ? 'Finish recording goal' : 'Record goal with voice'}
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
                        ? 'Turning your voice into a goal…'
                        : voice.phase === 'ready'
                          ? 'Goal text ready'
                          : 'Or say it out loud'}
                  </ThemedText>
                  <ThemedText style={styles.voiceHint} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
                    {voice.phase === 'recording' ? 'Tap again to finish' : 'Tap the microphone to record'}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.cadenceSection}>
                <ThemedText style={styles.cadenceLabel} lightColor={Meadow.inkFaint} darkColor={Meadow.inkFaint}>
                  WHEN SHOULD IT APPEAR?
                </ThemedText>
                <View style={styles.cadenceRow}>
                  <CadenceChoice label="Today" selected={cadence.kind === 'once'} onPress={() => setCadence({ kind: 'once', dayId })} />
                  <CadenceChoice label="Daily" selected={cadence.kind === 'daily'} onPress={() => setCadence({ kind: 'daily' })} />
                  <CadenceChoice
                    label="Weekdays"
                    selected={cadence.kind === 'weekdays'}
                    onPress={() => setCadence({ kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] })}
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
                          onPress={() => setCadence({
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
              </View>

              {voice.error || feedback ? (
                <ThemedText
                  accessibilityRole="alert"
                  selectable
                  style={styles.feedback}
                  lightColor="#8C3F36"
                  darkColor="#8C3F36">
                  {feedback ?? voice.error}
                </ThemedText>
              ) : null}

              <Pressable
                accessibilityRole="button"
                disabled={busy || !title.trim()}
                onPress={save}
                style={({ pressed }) => [
                  styles.saveButton,
                  (busy || !title.trim()) && styles.disabled,
                  pressed && !busy && styles.pressed,
                ]}>
                <ThemedText style={styles.saveButtonText} lightColor={Meadow.ink} darkColor={Meadow.ink}>
                  Add goal
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

function CadenceChoice({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.cadenceChoice, selected && styles.cadenceChoiceSelected, pressed && styles.pressed]}>
      {selected ? <IconSymbol color={Meadow.ink} name="checkmark" size={12} /> : null}
      <ThemedText style={styles.cadenceChoiceText} lightColor={Meadow.ink} darkColor={Meadow.ink}>
        {label}
      </ThemedText>
    </Pressable>
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
  subtitle: { fontFamily: AppFontFamilies.manrope, fontSize: 12, fontWeight: '600', lineHeight: 17 },
  closeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,249,234,0.50)',
    borderColor: 'rgba(119,86,43,0.18)',
    borderRadius: 999,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  input: {
    backgroundColor: '#FFF9EC',
    borderColor: 'rgba(184,137,54,0.42)',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    color: Meadow.ink,
    fontFamily: AppFontFamilies.manrope,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
    minHeight: 88,
    padding: 14,
  },
  inputKeyboard: { minHeight: 68, paddingVertical: 10 },
  voiceSection: { alignItems: 'center', gap: 9 },
  voiceSectionKeyboard: { gap: 5 },
  voiceButton: {
    alignItems: 'center',
    backgroundColor: '#211A13',
    borderColor: 'rgba(255,248,230,0.32)',
    borderRadius: 999,
    borderWidth: 1,
    boxShadow: '0 10px 26px rgba(52,33,18,0.32)',
    height: 82,
    justifyContent: 'center',
    width: 82,
  },
  voiceButtonKeyboard: { height: 66, width: 66 },
  voiceButtonRecording: { backgroundColor: '#F2C967', borderColor: '#D7A93C' },
  voiceButtonPressed: { transform: [{ scale: 0.95 }] },
  voiceCopy: { alignItems: 'center', gap: 1 },
  voiceTitle: { fontFamily: AppFontFamilies.manrope, fontSize: 13.5, fontVariant: ['tabular-nums'], fontWeight: '900' },
  voiceHint: { fontFamily: AppFontFamilies.manrope, fontSize: 11.5, fontWeight: '600' },
  cadenceSection: { gap: 8 },
  cadenceLabel: { ...KatchaUI.type.label, fontSize: 8.5, letterSpacing: 1 },
  cadenceRow: { flexDirection: 'row', gap: 6 },
  cadenceChoice: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,249,234,0.46)',
    borderColor: 'rgba(119,86,43,0.20)',
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 6,
  },
  cadenceChoiceSelected: { backgroundColor: '#F2C967', borderColor: '#D7A93C' },
  cadenceChoiceText: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '900' },
  weekdayRow: { flexDirection: 'row', gap: 5 },
  weekday: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,249,234,0.46)',
    borderColor: 'rgba(119,86,43,0.20)',
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    height: 34,
    justifyContent: 'center',
  },
  weekdaySelected: { backgroundColor: '#F2C967', borderColor: '#D7A93C' },
  weekdayText: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '900' },
  feedback: { fontFamily: AppFontFamilies.manrope, fontSize: 11.5, fontWeight: '800', lineHeight: 16, textAlign: 'center' },
  saveButton: {
    alignItems: 'center',
    backgroundColor: '#F2C967',
    borderColor: '#D7A93C',
    borderCurve: 'continuous',
    borderRadius: 17,
    borderWidth: 1,
    boxShadow: '0 7px 18px rgba(92,57,20,0.24), inset 0 1px 0 rgba(255,255,255,0.4)',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
  },
  saveButtonText: { fontFamily: AppFontFamilies.manrope, fontSize: 13.5, fontWeight: '900' },
  disabled: { opacity: 0.46 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
