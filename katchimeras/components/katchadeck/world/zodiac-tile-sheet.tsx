import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useMemo, useState } from 'react';
import { Image } from 'expo-image';

import { ConnectStarsGame } from '@/components/katchadeck/world/connect-stars-game';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { ThemedText } from '@/components/themed-text';
import { CONSTELLATION_LEVELS } from '@/constants/world-identity';
import { zodiacFamiliarSource } from '@/constants/world-identity-art';
import { Lantern } from '@/constants/theme';
import { useInlineVoiceNote } from '@/hooks/use-inline-voice-note';
import type { WorldIdentityState } from '@/types/world-identity';
import { deriveZodiacSign, localDayId, promptForDay, zodiacProfile } from '@/utils/world-identity';

type Mode = 'menu' | 'game' | 'prompt' | 'birthday';

export function ZodiacTileSheet({ identity, onChange, onClose }: { identity: WorldIdentityState; onChange: (next: WorldIdentityState) => void; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>('menu');
  const [text, setText] = useState('');
  const [birthMonth, setBirthMonth] = useState(identity.birthMonth ? String(identity.birthMonth) : '');
  const [birthDay, setBirthDay] = useState(identity.birthDay ? String(identity.birthDay) : '');
  const profile = zodiacProfile(identity.zodiacSignId);
  const level = CONSTELLATION_LEVELS.find((item) => item.signId === identity.zodiacSignId);
  const prompt = useMemo(() => profile ? promptForDay(profile.id) : null, [profile]);
  const voice = useInlineVoiceNote({ saveNote: (note) => {
    if (!prompt) return;
    onChange({ ...identity, recentZodiacPromptIds: [prompt.id, ...identity.recentZodiacPromptIds.filter((id) => id !== prompt.id)].slice(0, 6), zodiacReflections: [...identity.zodiacReflections, { id: `zodiac-${Date.now().toString(36)}`, dayId: localDayId(), promptId: prompt.id, prompt: prompt.text, text: note.text, audioUri: note.audioUri, durationMs: note.durationMs, createdAt: new Date().toISOString(), origin: 'zodiac_prompt' }] });
    setMode('menu');
  }});
  if (!profile || !level) return null;
  const dayId = localDayId();
  const completedToday = identity.constellationCompletions.includes(dayId);

  function completeGame() {
    onChange({ ...identity, constellationCompletions: completedToday ? identity.constellationCompletions : [...identity.constellationCompletions, dayId] });
    setTimeout(() => setMode('prompt'), 350);
  }

  function saveReflection() {
    if (!prompt || !text.trim()) return;
    onChange({ ...identity, recentZodiacPromptIds: [prompt.id, ...identity.recentZodiacPromptIds.filter((id) => id !== prompt.id)].slice(0, 6), zodiacReflections: [...identity.zodiacReflections, { id: `zodiac-${Date.now().toString(36)}`, dayId, promptId: prompt.id, prompt: prompt.text, text: text.trim(), createdAt: new Date().toISOString(), origin: 'zodiac_prompt' }] });
    setText(''); setMode('menu');
  }

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" visible onRequestClose={onClose}>
      <View style={styles.screen}>
        <View style={styles.header}><Pressable accessibilityRole="button" onPress={() => mode === 'menu' ? onClose() : setMode('menu')} style={styles.close}><ThemedText>{mode === 'menu' ? '×' : '‹'}</ThemedText></Pressable><ThemedText type="onboardingLabel" lightColor={profile.accent} darkColor={profile.accent}>Star Garden</ThemedText><View style={styles.spacer} /></View>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.hero, { borderColor: `${profile.accent}88` }]}><View style={[styles.orbit, { borderColor: `${profile.accent}55` }]}><Image contentFit="contain" source={zodiacFamiliarSource(profile.element)} style={styles.familiarImage} /><View style={[styles.signBadge, { backgroundColor: profile.accent }]}><ThemedText style={styles.signBadgeText} lightColor="#14101F" darkColor="#14101F">{profile.symbol}</ThemedText></View></View><ThemedText type="title">{profile.name}</ThemedText><ThemedText style={styles.familiar} lightColor={profile.accent} darkColor={profile.accent}>{profile.familiarName} · {profile.element}</ThemedText><ThemedText style={styles.profileLine}>{profile.profileLine}</ThemedText></View>
          {mode === 'menu' ? <><KatchaButton label={completedToday ? 'Replay constellation' : 'Play tonight’s constellation'} onPress={() => setMode('game')} icon="sparkles" /><KatchaButton label="Today’s star prompt" onPress={() => setMode('prompt')} variant="secondary" /><View style={styles.info}><ThemedText type="subtitle">{profile.dateLabel}</ThemedText><ThemedText style={styles.infoText}>A playful celestial identity for reflection—not a prediction. Your sign never changes what hatches.</ThemedText></View><KatchaButton label="Edit birthday" onPress={() => setMode('birthday')} variant="secondary" /></> : null}
          {mode === 'game' ? <><ThemedText type="subtitle">Help {profile.familiarName} restore tonight’s constellation.</ThemedText><ConnectStarsGame accentColor={profile.accent} points={level.points} onComplete={completeGame} />{completedToday ? <ThemedText style={styles.status} lightColor={profile.accent} darkColor={profile.accent}>Tonight’s Star Spark is already safe. Replay just for the glow.</ThemedText> : null}</> : null}
          {mode === 'prompt' && prompt ? <><ThemedText type="title">A question from the stars</ThemedText><ThemedText style={styles.prompt}>{prompt.text}</ThemedText><TextInput accessibilityLabel="Star prompt response" multiline onChangeText={setText} placeholder="Write what comes to mind…" placeholderTextColor="rgba(255,255,255,0.35)" style={styles.input} value={text} /><KatchaButton disabled={!text.trim()} label="Save reflection" onPress={saveReflection} />
            {voice.phase === 'confirm' && voice.result ? <View style={styles.voiceConfirm}><ThemedText style={styles.voiceTranscript}>“{voice.result.transcript}”</ThemedText>{!voice.semanticChoiceMade ? <KatchaButton label="Keep as a star reflection" onPress={() => voice.chooseSemantic(null)} variant="secondary" /> : null}<View style={styles.voiceActions}><KatchaButton label="Discard" onPress={voice.discard} variant="secondary" style={{ flex: 1 }} /><KatchaButton disabled={!voice.semanticChoiceMade} label="Save voice" onPress={voice.accept} style={{ flex: 1 }} /></View></View> : <Pressable accessibilityRole="button" accessibilityLabel="Hold to record a voice reflection" onPressIn={() => { void voice.start(); }} onPressOut={() => { void voice.stop(); }} style={[styles.voiceButton, voice.phase === 'recording' && { borderColor: profile.accent }]}><ThemedText style={styles.voiceButtonText}>{voice.phase === 'recording' ? `Recording 0:${String(voice.elapsed).padStart(2, '0')} · release to finish` : voice.phase === 'analyzing' ? 'Reading your voice…' : 'Hold to answer with voice'}</ThemedText></Pressable>}
            <KatchaButton label="Skip for today" onPress={() => setMode('menu')} variant="secondary" /></> : null}
          {mode === 'birthday' ? <><ThemedText type="title">Change your birthday</ThemedText><ThemedText style={styles.infoText}>Only month and day are stored, on this device.</ThemedText><View style={styles.birthdayRow}><TextInput keyboardType="number-pad" maxLength={2} onChangeText={setBirthMonth} placeholder="MM" placeholderTextColor="rgba(255,255,255,0.35)" style={styles.birthdayInput} value={birthMonth} /><TextInput keyboardType="number-pad" maxLength={2} onChangeText={setBirthDay} placeholder="DD" placeholderTextColor="rgba(255,255,255,0.35)" style={styles.birthdayInput} value={birthDay} /></View><KatchaButton disabled={!deriveZodiacSign(Number(birthMonth), Number(birthDay))} label="Update Zodiac Tile" onPress={() => { const sign = deriveZodiacSign(Number(birthMonth), Number(birthDay)); if (sign) { onChange({ ...identity, birthMonth: Number(birthMonth), birthDay: Number(birthDay), zodiacSignId: sign }); setMode('menu'); } }} /></> : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#0B0B18', flex: 1 }, header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20 }, close: { alignItems: 'center', backgroundColor: Lantern.ink800, borderRadius: 20, height: 40, justifyContent: 'center', width: 40 }, spacer: { width: 40 }, content: { gap: 18, padding: 20, paddingBottom: 50 },
  hero: { alignItems: 'center', backgroundColor: '#16152A', borderRadius: 30, borderWidth: 1, gap: 7, padding: 24 }, orbit: { alignItems: 'center', borderRadius: 70, borderWidth: 1, height: 138, justifyContent: 'center', width: 138 }, familiarImage: { height: 128, width: 128 }, signBadge: { alignItems: 'center', borderRadius: 18, bottom: -2, height: 36, justifyContent: 'center', position: 'absolute', right: -2, width: 36 }, signBadgeText: { fontSize: 21, fontWeight: '900' }, familiar: { fontSize: 13, fontWeight: '900', textTransform: 'uppercase' }, profileLine: { color: Lantern.moon300, lineHeight: 21, textAlign: 'center' },
  info: { backgroundColor: Lantern.ink800, borderRadius: 22, gap: 6, padding: 18 }, infoText: { color: Lantern.moon300, fontSize: 13, lineHeight: 19 }, status: { fontSize: 12, fontWeight: '800', textAlign: 'center' }, prompt: { fontSize: 23, lineHeight: 31 }, input: { backgroundColor: Lantern.ink800, borderRadius: 22, color: Lantern.moon50, fontSize: 16, minHeight: 150, padding: 18, textAlignVertical: 'top' },
  voiceButton: { alignItems: 'center', backgroundColor: Lantern.ink800, borderColor: 'rgba(255,255,255,0.14)', borderRadius: 999, borderWidth: 1, minHeight: 58, justifyContent: 'center', paddingHorizontal: 18 }, voiceButtonText: { fontSize: 14, fontWeight: '800' }, voiceConfirm: { backgroundColor: Lantern.ink800, borderRadius: 22, gap: 12, padding: 16 }, voiceTranscript: { fontSize: 15, fontStyle: 'italic', lineHeight: 21 }, voiceActions: { flexDirection: 'row', gap: 10 },
  birthdayRow: { flexDirection: 'row', gap: 10 }, birthdayInput: { backgroundColor: Lantern.ink800, borderRadius: 18, color: Lantern.moon50, flex: 1, fontSize: 24, fontWeight: '800', minHeight: 64, textAlign: 'center' },
});
