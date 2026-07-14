import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppFontFamilies, Lantern } from '@/constants/theme';
import { advanceTriviaRound, answerTriviaQuestion, createTriviaRound, triviaRoundComplete, triviaRoundScore, type TriviaRoundState } from '@/utils/quests/experiences/trivia';
import type { QuestResult } from '@/utils/quests/experiences/types';

export function TriviaQuest({ config, seed, recentQuestionIds, onAttemptStart, onAttemptCancel, onComplete, onRunningChange }: {
  config: { packIds: ('film' | 'books' | 'city')[]; questionCount: number };
  seed: string;
  recentQuestionIds: string[];
  onAttemptStart: (config: Record<string, unknown>) => string;
  onAttemptCancel: (attemptId: string) => void;
  onComplete: (attemptId: string, result: QuestResult) => void;
  onRunningChange: (running: boolean, attemptId?: string | null) => void;
}) {
  const [round, setRound] = useState<TriviaRoundState | null>(null);
  const attemptId = useRef<string | null>(null);
  const [finished, setFinished] = useState(false);
  const current = round?.questions[round.index] ?? null;
  const selected = current && round ? round.answers[current.id] : null;
  const score = round ? triviaRoundScore(round) : 0;
  const title = config.packIds.includes('film') ? 'Flickerbun’s film round' : config.packIds.includes('city') ? 'Skylo’s city circuit' : 'Pagelet’s book round';

  const start = () => {
    const next = createTriviaRound({ ...config, seed, recentQuestionIds });
    attemptId.current = onAttemptStart({ ...config, questionIds: next.questions.map((question) => question.id) });
    setRound(next); setFinished(false); onRunningChange(true, attemptId.current);
  };
  const answer = (choiceId: string) => {
    if (!round || selected) return;
    setRound(answerTriviaQuestion(round, choiceId));
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
  };
  const advance = () => {
    if (!round) return;
    if (triviaRoundComplete(round)) { setFinished(true); return; }
    setRound(advanceTriviaRound(round));
  };
  const elapsed = round ? Math.max(0, Date.now() - round.startedAt) : 0;

  if (!round) return (
    <View style={styles.root}>
      <Header title={title} body={`Five quick questions. Finish the round to complete the quest — your score and time are yours to beat.`} />
      <View style={styles.info}><IconSymbol name="sparkles" size={18} color={Lantern.ember300} /><ThemedText style={styles.infoText} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>Questions and answers are predefined. No AI judges your result.</ThemedText></View>
      <Action label="Play five questions" onPress={start} />
    </View>
  );

  if (finished && attemptId.current) return (
    <View accessibilityLiveRegion="polite" style={[styles.root, styles.resultRoot]}>
      <View style={styles.resultContent}>
        <Header title="Round complete" body={`You scored ${score} out of ${round.questions.length}.`} />
        <View style={styles.score}><ThemedText style={styles.scoreNumber} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>{score}/{round.questions.length}</ThemedText><ThemedText style={styles.scoreCaption} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>Finished in {Math.max(1, Math.round(elapsed / 1000))} seconds</ThemedText></View>
      </View>
      <Action label="Complete and return" onPress={() => onComplete(attemptId.current!, { kind: 'trivia', success: true, score, questionCount: round.questions.length, durationMs: elapsed, questionIds: round.questions.map((question) => question.id) })} />
    </View>
  );

  if (!current) return null;
  const correct = selected === current.correctChoiceId;
  return (
    <View style={styles.root}>
      <View style={styles.progressRow}><ThemedText style={styles.progressText} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>QUESTION {round.index + 1} OF {round.questions.length}</ThemedText><ThemedText style={styles.progressText} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>SCORE {score}</ThemedText></View>
      <ThemedText selectable style={styles.question} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{current.prompt}</ThemedText>
      <View style={styles.choices}>{current.choices.map((choice, index) => {
        const chosen = selected === choice.id;
        const revealCorrect = Boolean(selected) && choice.id === current.correctChoiceId;
        return <Pressable key={choice.id} accessibilityRole="button" accessibilityState={{ selected: chosen }} disabled={Boolean(selected)} onPress={() => answer(choice.id)} style={({ pressed }) => [styles.choice, chosen && styles.choiceChosen, revealCorrect && styles.choiceCorrect, pressed && styles.pressed]}><View style={styles.choiceIndex}><ThemedText style={styles.choiceIndexText} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>{String.fromCharCode(65 + index)}</ThemedText></View><ThemedText style={styles.choiceText} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{choice.text}</ThemedText>{revealCorrect ? <IconSymbol name="checkmark" size={17} color={Lantern.auroraTeal} /> : null}</Pressable>;
      })}</View>
      {selected ? <View accessibilityLiveRegion="polite" style={styles.feedback}><ThemedText style={styles.feedbackTitle} lightColor={correct ? Lantern.auroraTeal : Lantern.ember300} darkColor={correct ? Lantern.auroraTeal : Lantern.ember300}>{correct ? 'Correct' : 'Not this time'}</ThemedText><ThemedText selectable style={styles.feedbackBody} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>{current.explanation}</ThemedText></View> : null}
      {selected ? <Action label={triviaRoundComplete(round) ? 'See result' : 'Next question'} onPress={advance} /> : <Pressable accessibilityRole="button" onPress={() => { if (attemptId.current) onAttemptCancel(attemptId.current); onRunningChange(false); setRound(null); }} style={styles.cancel}><ThemedText style={styles.cancelText} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>Cancel round</ThemedText></Pressable>}
    </View>
  );
}

function Header({ title, body }: { title: string; body: string }) { return <View style={styles.header}><ThemedText style={styles.eyebrow} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>QUICK TRIVIA</ThemedText><ThemedText selectable style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{title}</ThemedText><ThemedText selectable style={styles.body} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>{body}</ThemedText></View>; }
function Action({ label, onPress }: { label: string; onPress: () => void }) { return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><ThemedText style={styles.actionText} lightColor={Lantern.emberInk} darkColor={Lantern.emberInk}>{label}</ThemedText><IconSymbol name="arrow.right" size={17} color={Lantern.emberInk} /></Pressable>; }

const styles = StyleSheet.create({
  root: { gap: 18, paddingBottom: 20, paddingTop: 8 }, header: { gap: 8 }, eyebrow: { fontSize: 10.5, fontWeight: '900', letterSpacing: 1.05 },
  title: { fontFamily: AppFontFamilies.instrumentSerif, fontSize: 29, lineHeight: 34 }, body: { fontSize: 14, lineHeight: 21 },
  info: { alignItems: 'center', backgroundColor: 'rgba(255,195,107,0.07)', borderCurve: 'continuous', borderRadius: 18, flexDirection: 'row', gap: 10, padding: 14 }, infoText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' }, progressText: { fontSize: 10.5, fontWeight: '900', letterSpacing: 0.8 },
  question: { fontFamily: AppFontFamilies.instrumentSerif, fontSize: 26, lineHeight: 32 }, choices: { gap: 9 },
  choice: { alignItems: 'center', backgroundColor: Lantern.ink900, borderColor: 'rgba(201,194,232,0.15)', borderCurve: 'continuous', borderRadius: 17, borderWidth: 1, flexDirection: 'row', gap: 11, minHeight: 58, padding: 11 },
  choiceChosen: { backgroundColor: 'rgba(255,195,107,0.08)', borderColor: Lantern.ember300 }, choiceCorrect: { backgroundColor: 'rgba(125,232,205,0.08)', borderColor: Lantern.auroraTeal },
  choiceIndex: { alignItems: 'center', backgroundColor: Lantern.dusk700, borderRadius: 999, height: 30, justifyContent: 'center', width: 30 }, choiceIndexText: { fontSize: 12, fontWeight: '900' }, choiceText: { flex: 1, fontSize: 13.5, fontWeight: '800', lineHeight: 19 },
  feedback: { backgroundColor: 'rgba(201,194,232,0.07)', borderCurve: 'continuous', borderRadius: 17, gap: 5, padding: 14 }, feedbackTitle: { fontSize: 14, fontWeight: '900' }, feedbackBody: { fontSize: 12.5, lineHeight: 18 },
  action: { alignItems: 'center', backgroundColor: Lantern.ember300, borderCurve: 'continuous', borderRadius: 18, flexDirection: 'row', gap: 9, justifyContent: 'center', minHeight: 54, paddingHorizontal: 18 }, actionText: { fontSize: 15, fontWeight: '900' },
  cancel: { alignItems: 'center', minHeight: 44, justifyContent: 'center' }, cancelText: { fontSize: 13, fontWeight: '800' },
  resultRoot: { flex: 1, justifyContent: 'space-between', minHeight: 0, paddingBottom: 4, paddingTop: 10 },
  resultContent: { flex: 1, gap: 20, justifyContent: 'center', minHeight: 0 },
  score: { alignItems: 'center', backgroundColor: 'rgba(255,195,107,0.07)', borderCurve: 'continuous', borderRadius: 24, gap: 5, justifyContent: 'center', minHeight: 190, padding: 28 }, scoreNumber: { fontSize: 46, fontVariant: ['tabular-nums'], fontWeight: '900', lineHeight: 58, paddingVertical: 2 }, scoreCaption: { fontSize: 12.5, fontWeight: '800' }, pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
