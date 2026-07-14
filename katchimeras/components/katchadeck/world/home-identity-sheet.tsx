import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useState } from 'react';
import { Image } from 'expo-image';

import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { ThemedText } from '@/components/themed-text';
import { HOME_PRESETS, PERSONALITY_QUESTIONS } from '@/constants/world-identity';
import { Lantern } from '@/constants/theme';
import type { HomeArchetypeId, WorldIdentityState } from '@/types/world-identity';
import { deriveZodiacSign, homePreset, scorePersonality } from '@/utils/world-identity';
import { KINGDOM_HOME_HEX_TILES } from '@/utils/world-visuals';

export function HomeIdentitySheet({ identity, onChange, onClose }: { identity: WorldIdentityState; onChange: (next: WorldIdentityState) => void; onClose: () => void }) {
  const [questionIndex, setQuestionIndex] = useState(Math.min(Object.keys(identity.personalityAnswers).length, PERSONALITY_QUESTIONS.length - 1));
  const [month, setMonth] = useState(identity.birthMonth ? String(identity.birthMonth) : '');
  const [day, setDay] = useState(identity.birthDay ? String(identity.birthDay) : '');
  const needsAssessment = !identity.setupCompletedAt && Object.keys(identity.personalityAnswers).length < PERSONALITY_QUESTIONS.length;
  if (needsAssessment) {
    const question = PERSONALITY_QUESTIONS[questionIndex];
    return (
      <Modal animationType="slide" presentationStyle="pageSheet" visible onRequestClose={() => {}}>
        <View style={styles.screen}>
          <View style={styles.header}><View><ThemedText type="onboardingLabel" lightColor={Lantern.ember300} darkColor={Lantern.ember300}>Find your home · {questionIndex + 1} of 3</ThemedText><ThemedText type="title">{question.question}</ThemedText></View></View>
          <ScrollView contentContainerStyle={styles.content}>
            {question.answers.map((answer) => <Pressable key={answer.id} onPress={() => {
              const answers = { ...identity.personalityAnswers, [question.id]: answer.id };
              if (questionIndex < PERSONALITY_QUESTIONS.length - 1) {
                onChange({ ...identity, personalityAnswers: answers }); setQuestionIndex((value) => value + 1);
              } else {
                const result = scorePersonality(answers) ?? 'explorer';
                onChange({ ...identity, personalityAnswers: answers, recommendedHomeArchetypeId: result, selectedHomeArchetypeId: result, setupCompletedAt: new Date().toISOString() });
              }
            }} style={styles.answer}><ThemedText style={styles.answerText}>{answer.label}</ThemedText></Pressable>)}
            <ThemedText style={styles.note}>This only shapes your Home tile. Your existing Katchimeras remain exactly as they are.</ThemedText>
          </ScrollView>
        </View>
      </Modal>
    );
  }
  const selected = homePreset(identity.selectedHomeArchetypeId);
  const choose = (id: HomeArchetypeId) => onChange({ ...identity, selectedHomeArchetypeId: id, setupCompletedAt: identity.setupCompletedAt ?? new Date().toISOString() });
  return (
    <Modal animationType="slide" presentationStyle="pageSheet" visible onRequestClose={onClose}>
      <View style={styles.screen}>
        <View style={styles.header}><View><ThemedText type="onboardingLabel" lightColor={selected.accent} darkColor={selected.accent}>Your centre tile</ThemedText><ThemedText type="title">{selected.name} Home</ThemedText></View><Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close}><ThemedText>×</ThemedText></Pressable></View>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.preview, { borderColor: selected.accent }]}><Image contentFit="contain" source={KINGDOM_HOME_HEX_TILES[selected.id].source} style={styles.previewImage} /><ThemedText style={styles.description}>{selected.description}</ThemedText><ThemedText style={styles.keywords} lightColor={selected.accent} darkColor={selected.accent}>{selected.keywords.join(' · ')}</ThemedText></View>
          <ThemedText type="subtitle">Choose another home</ThemedText>
          <View style={styles.grid}>{HOME_PRESETS.map((preset) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: preset.id === selected.id }} key={preset.id} onPress={() => choose(preset.id)} style={[styles.choice, preset.id === selected.id && { borderColor: preset.accent, backgroundColor: `${preset.accent}1F` }]}><Image contentFit="contain" source={KINGDOM_HOME_HEX_TILES[preset.id].sources?.thumb ?? KINGDOM_HOME_HEX_TILES[preset.id].source} style={styles.choiceImage} /><ThemedText style={styles.choiceName}>{preset.name}</ThemedText></Pressable>)}</View>
          <ThemedText style={styles.note}>Your home is expressive only. It never changes what hatches.</ThemedText>
          {!identity.zodiacSignId ? <View style={styles.zodiacSetup}><ThemedText type="subtitle">Add your Zodiac Tile</ThemedText><ThemedText style={styles.note}>Optional · month and day stay on this device.</ThemedText><View style={styles.birthdayRow}><TextInput keyboardType="number-pad" maxLength={2} onChangeText={setMonth} placeholder="MM" placeholderTextColor="rgba(255,255,255,0.35)" style={styles.birthdayInput} value={month} /><TextInput keyboardType="number-pad" maxLength={2} onChangeText={setDay} placeholder="DD" placeholderTextColor="rgba(255,255,255,0.35)" style={styles.birthdayInput} value={day} /></View><KatchaButton disabled={!deriveZodiacSign(Number(month), Number(day))} label="Reveal my Zodiac Tile" onPress={() => { const sign = deriveZodiacSign(Number(month), Number(day)); if (sign) onChange({ ...identity, birthMonth: Number(month), birthDay: Number(day), zodiacSignId: sign }); }} variant="secondary" /></View> : null}
          <KatchaButton label="Done" onPress={onClose} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#0D0C17', flex: 1 }, header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 22 },
  close: { alignItems: 'center', backgroundColor: Lantern.ink800, borderRadius: 20, height: 40, justifyContent: 'center', width: 40 }, content: { gap: 20, padding: 20, paddingBottom: 50 },
  preview: { alignItems: 'center', backgroundColor: Lantern.ink800, borderRadius: 28, borderWidth: 1, gap: 10, padding: 18 }, previewImage: { aspectRatio: 1, width: '100%' }, description: { fontSize: 16, lineHeight: 23, textAlign: 'center' }, keywords: { fontSize: 12, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, choice: { alignItems: 'center', backgroundColor: Lantern.ink800, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 20, borderWidth: 1, gap: 5, padding: 8, width: '31%' }, choiceImage: { aspectRatio: 1, width: '100%' }, choiceName: { fontSize: 11, fontWeight: '800' }, note: { color: Lantern.moon300, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  answer: { backgroundColor: Lantern.ink800, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 22, borderWidth: 1, minHeight: 62, paddingHorizontal: 18, justifyContent: 'center' }, answerText: { fontSize: 15, fontWeight: '700' },
  zodiacSetup: { backgroundColor: '#151426', borderRadius: 24, gap: 12, padding: 18 }, birthdayRow: { flexDirection: 'row', gap: 10 }, birthdayInput: { backgroundColor: Lantern.ink800, borderRadius: 16, color: Lantern.moon50, flex: 1, fontSize: 22, fontWeight: '800', minHeight: 58, textAlign: 'center' },
});
