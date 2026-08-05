import { useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InlineVoiceNote } from '@/components/katchadeck/world/inline-voice-note';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Meadow } from '@/constants/meadow-theme';
import { AppFontFamilies, Lantern } from '@/constants/theme';
import type { InlineVoiceNotePhase } from '@/hooks/use-inline-voice-note';

type QuickNoteComposerProps = {
  initialMode?: 'text' | 'voice';
  onClose: () => void;
  onCancel?: () => void;
  onSubmit: (text: string) => Promise<void>;
  onVoiceStart: () => void;
  onVoiceStop: () => void;
  voiceElapsed: number;
  voicePhase: InlineVoiceNotePhase;
  contextTitle?: string | null;
  contextBody?: string | null;
};

export function QuickNoteComposer({
  initialMode = 'text',
  onClose,
  onCancel = onClose,
  onSubmit,
  onVoiceStart,
  onVoiceStop,
  voiceElapsed,
  voicePhase,
  contextTitle,
  contextBody,
}: QuickNoteComposerProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [text, setText] = useState('');
  const [reading, setReading] = useState(false);
  const voiceHoldRef = useRef(false);
  const voiceActive = voicePhase !== 'idle';
  const interactionLocked = reading || voiceActive;

  const submit = async () => {
    const trimmed = text.trim();
    if (interactionLocked) return;
    if (!trimmed) {
      onCancel();
      return;
    }
    Keyboard.dismiss();
    setReading(true);
    try {
      await onSubmit(trimmed);
      onClose();
    } catch {
      setReading(false);
    }
  };

  const startVoice = () => {
    if (reading || voicePhase !== 'idle') return;
    voiceHoldRef.current = true;
    Keyboard.dismiss();
    onVoiceStart();
  };

  const stopVoice = () => {
    if (!voiceHoldRef.current) return;
    voiceHoldRef.current = false;
    onVoiceStop();
  };

  return (
    <View style={styles.overlay}>
      <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(160)} style={styles.backdrop}>
        <Pressable disabled={interactionLocked} onPressIn={onCancel} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(220)}
        exiting={FadeOutUp.duration(180)}
        style={[styles.card, { top: insets.top + 96 }]}>
        {contextTitle && !voiceActive && !reading ? (
          <View style={styles.questContext}>
            <ThemedText style={styles.questKicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>QUEST NOTE</ThemedText>
            <ThemedText style={styles.questTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{contextTitle}</ThemedText>
            {contextBody ? <ThemedText style={styles.questBody} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>{contextBody}</ThemedText> : null}
          </View>
        ) : null}
        {voiceActive ? (
          <View style={styles.voiceProgress}>
            <InlineVoiceNote elapsed={voiceElapsed} phase={voicePhase} />
          </View>
        ) : reading ? (
          <View accessibilityLabel="Reading written note" accessibilityRole="progressbar" style={styles.readingRow}>
            <ActivityIndicator color={Lantern.ember300} size="small" />
            <ThemedText style={styles.readingLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
              Reading…
            </ThemedText>
          </View>
        ) : (
          <View style={styles.inputRow}>
            <TextInput
              autoFocus={initialMode === 'text'}
              onChangeText={setText}
              onSubmitEditing={submit}
              placeholder="What happened?"
              placeholderTextColor="rgba(251, 243, 228, 0.45)"
              returnKeyType="send"
              selectionColor={Lantern.ember300}
              style={styles.input}
              value={text}
            />
            <Pressable accessibilityLabel="Cancel" accessibilityRole="button" hitSlop={10} onPress={onCancel} style={styles.closeX}>
              <IconSymbol name="xmark" size={12} color="rgba(251, 243, 228, 0.75)" />
            </Pressable>
          </View>
        )}
      </Animated.View>

      {!reading && voicePhase !== 'analyzing' ? (
        <Animated.View
          entering={FadeInDown.delay(70).duration(220)}
          exiting={FadeOut.duration(140)}
          style={[styles.voicePrompt, { top: Math.max(insets.top + 218, windowHeight * 0.36) }]}>
          <Pressable
            accessibilityHint="Hold, speak, then release to finish"
            accessibilityLabel="Hold to record a voice note"
            accessibilityRole="button"
            delayLongPress={250}
            onLongPress={startVoice}
            onPressOut={stopVoice}
            style={({ pressed }) => [
              styles.voiceButton,
              voicePhase === 'recording' && styles.voiceButtonRecording,
              pressed && styles.voiceButtonPressed,
            ]}>
            <IconSymbol
              color={voicePhase === 'recording' ? Meadow.ink : Lantern.moon50}
              name={voicePhase === 'recording' ? 'waveform' : 'mic.fill'}
              size={34}
            />
          </Pressable>
          <View style={styles.voiceCopyPanel}>
            <ThemedText style={styles.voiceTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
              {voicePhase === 'recording' ? 'Release to finish' : 'Tap and hold to record'}
            </ThemedText>
            <ThemedText style={styles.voiceHint} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
              {voicePhase === 'recording' ? 'Your voice stays linked to this memory' : 'Or write your note above'}
            </ThemedText>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    elevation: 60,
    zIndex: 60,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4, 7, 15, 0.48)',
  },
  card: {
    backgroundColor: Meadow.overlay.sheetBg,
    borderColor: Meadow.overlay.sheetBorder,
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 1,
    boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
    left: 14,
    minHeight: 62,
    paddingHorizontal: 14,
    paddingVertical: 10,
    position: 'absolute',
    right: 14,
  },
  questContext: { gap: 3, paddingBottom: 8, paddingRight: 28 },
  questKicker: { fontSize: 9.5, fontWeight: '900', letterSpacing: 1.1 },
  questTitle: { fontFamily: AppFontFamilies.instrumentSerif, fontSize: 21, lineHeight: 24 },
  questBody: { fontSize: 11.5, lineHeight: 16 },
  inputRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    color: '#FBF3E4',
    flex: 1,
    fontFamily: AppFontFamilies.manrope,
    fontSize: 16,
    paddingVertical: 8,
  },
  closeX: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,248,230,0.18)',
    borderRadius: 999,
    borderWidth: 1,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  readingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 40,
  },
  readingLabel: {
    fontFamily: AppFontFamilies.manrope,
    fontSize: 14.5,
    fontWeight: '700',
  },
  voiceProgress: {
    alignItems: 'center',
    minHeight: 40,
  },
  voicePrompt: {
    alignItems: 'center',
    gap: 12,
    left: 24,
    position: 'absolute',
    right: 24,
  },
  voiceButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(20,17,31,0.92)',
    borderColor: Meadow.overlay.sheetBorder,
    borderRadius: 999,
    borderWidth: 1,
    boxShadow: '0 12px 34px rgba(0,0,0,0.42)',
    height: 92,
    justifyContent: 'center',
    width: 92,
  },
  voiceButtonRecording: {
    backgroundColor: Meadow.gold,
    borderColor: Meadow.goldDeep,
  },
  voiceButtonPressed: {
    transform: [{ scale: 0.96 }],
  },
  voiceCopyPanel: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(16,14,25,0.88)',
    borderColor: 'rgba(255,248,230,0.18)',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    boxShadow: '0 8px 24px rgba(0,0,0,0.36)',
    gap: 3,
    maxWidth: 340,
    minWidth: 280,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  voiceTitle: {
    fontFamily: AppFontFamilies.manrope,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  voiceHint: {
    fontFamily: AppFontFamilies.manrope,
    fontSize: 12.5,
    lineHeight: 17,
    textAlign: 'center',
  },
});
