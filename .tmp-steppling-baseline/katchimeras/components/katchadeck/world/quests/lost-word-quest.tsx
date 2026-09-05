import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppFontFamilies, Lantern } from '@/constants/theme';
import {
  createLostWordRound,
  lostWordClue,
  lostWordHintAvailable,
  lostWordKeyboardStatuses,
  lostWordReducer,
  lostWordRoundComplete,
  lostWordSolved,
  type LostWordLetterStatus,
  type LostWordRoundState,
} from '@/utils/quests/experiences/lost-word';
import type { QuestResult } from '@/utils/quests/experiences/types';
import { QuestExperiencePreview } from './quest-experience-ui';

const KEYBOARD_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

type LostWordConfig = {
  difficultyTier: 1 | 2 | 3 | 4 | 5;
  hintUnlockAfter: number | null;
};

export function LostWordQuest({ config, seed, recentPuzzleIds, onAttemptStart, onAttemptCancel, onComplete, onRunningChange }: {
  config: LostWordConfig;
  seed: string;
  recentPuzzleIds: string[];
  onAttemptStart: (config: Record<string, unknown>) => string;
  onAttemptCancel: (attemptId: string) => void;
  onComplete: (attemptId: string, result: QuestResult) => void;
  onRunningChange: (running: boolean, attemptId?: string | null) => void;
}) {
  const { height, width } = useWindowDimensions();
  const [round, dispatch] = useReducer(lostWordReducer, null, () => createRound(config, seed, recentPuzzleIds));
  const [started, setStarted] = useState(false);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const attemptId = useRef<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const complete = lostWordRoundComplete(round);
  const solved = lostWordSolved(round);
  const clue = lostWordClue(round);
  const keyboardStatuses = useMemo(() => lostWordKeyboardStatuses(round), [round]);
  const compact = width < 390 || height < 750;
  const tileSize = Math.min(compact ? 39 : 47, Math.floor((width - 92) / 5));

  useEffect(() => {
    if (started && !complete) inputRef.current?.focus();
  }, [complete, started]);

  useEffect(() => {
    if (complete && finishedAt === null) {
      setFinishedAt(Date.now());
      if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [complete, finishedAt]);

  useEffect(() => {
    if (!complete) {
      setShowResult(false);
      return;
    }
    const timer = setTimeout(() => setShowResult(true), 700);
    return () => clearTimeout(timer);
  }, [complete]);

  useEffect(() => {
    if (round.guesses.length === 0) return;
    setRevealing(true);
    const timer = setTimeout(() => setRevealing(false), 650);
    return () => clearTimeout(timer);
  }, [round.guesses.length]);

  const start = () => {
    dispatch({ type: 'start_round', startedAt: Date.now() });
    attemptId.current = onAttemptStart({
      ...config,
      gameId: 'pagelet_lost_word',
      rulesetId: 'lost-word-v1',
      puzzleId: round.puzzle.id,
      answerLength: 5,
      maxGuesses: 6,
    });
    setStarted(true);
    onRunningChange(true, attemptId.current);
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const send = (action: Parameters<typeof lostWordReducer>[1]) => {
    if (revealing) return;
    dispatch(action);
    if (process.env.EXPO_OS === 'ios' && action.type !== 'clear_error') void Haptics.selectionAsync();
  };

  const cancel = () => {
    if (attemptId.current) onAttemptCancel(attemptId.current);
    onRunningChange(false);
    dispatch({ type: 'start_round', startedAt: Date.now() });
    attemptId.current = null;
    setFinishedAt(null);
    setShowResult(false);
    setStarted(false);
  };

  const finish = () => {
    if (!attemptId.current) return;
    onComplete(attemptId.current, {
      kind: 'word_game',
      success: true,
      puzzleId: round.puzzle.id,
      solved,
      guessesUsed: round.guesses.length,
      maxGuesses: 6,
      durationMs: Math.max(0, (finishedAt ?? Date.now()) - round.startedAt),
      difficultyTier: round.difficultyTier,
      hintUsed: round.hintUsed,
    });
  };

  if (!started) return (
    <QuestExperiencePreview
      eyebrow="Lost word"
      title="A word has slipped from Pagelet’s shelves"
      body="You have six guesses to find it. A finished search still completes the quest."
      icon="book.closed.fill"
      meta="Five letters · six guesses · on-device"
      actionLabel="Find the lost word"
      onAction={start}
    />
  );

  if (complete && showResult) {
    const seconds = Math.max(1, Math.round(((finishedAt ?? Date.now()) - round.startedAt) / 1000));
    return (
      <View accessibilityLiveRegion="polite" style={styles.resultRoot}>
        <View style={styles.resultContent}>
          <Header eyebrow="ROUND COMPLETE" title={solved ? 'The word is back on the shelf' : 'The lost word was…'} body={solved ? `You found it in ${round.guesses.length} ${round.guesses.length === 1 ? 'guess' : 'guesses'}.` : 'A finished search still counts. Pagelet will remember the attempt.'} />
          <View style={styles.resultCard}>
            <ThemedText selectable style={styles.answer} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>{round.puzzle.answer.toUpperCase()}</ThemedText>
            <ThemedText selectable style={styles.explanation} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>{round.puzzle.explanation}</ThemedText>
            <ThemedText style={styles.resultMeta} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>{round.guesses.length}/6 guesses · {seconds}s{round.hintUsed ? ' · hint used' : ''}</ThemedText>
          </View>
        </View>
        <Action label="Complete and return" onPress={finish} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <TextInput
        ref={inputRef}
        accessibilityLabel="Lost Word keyboard input"
        autoCapitalize="characters"
        autoCorrect={false}
        caretHidden
        onKeyPress={({ nativeEvent }) => {
          if (nativeEvent.key === 'Backspace') send({ type: 'backspace' });
          else if (nativeEvent.key === 'Enter') send({ type: 'submit' });
          else if (/^[a-z]$/i.test(nativeEvent.key)) send({ type: 'letter', letter: nativeEvent.key });
        }}
        showSoftInputOnFocus={false}
        style={styles.hiddenInput}
        value=""
      />
      <View style={styles.progressRow}>
        <ThemedText style={styles.progressText} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>GUESS {round.guesses.length + 1} OF 6</ThemedText>
        <ThemedText style={styles.progressText} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>TIER {round.difficultyTier}</ThemedText>
      </View>
      <View style={styles.clueCard}>
        <ThemedText style={styles.clueLabel} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>{clue.label}</ThemedText>
        <ThemedText selectable style={styles.clueText} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{clue.text}</ThemedText>
        {lostWordHintAvailable(round) ? <Pressable accessibilityRole="button" onPress={() => send({ type: 'use_hint' })} style={styles.hintButton}><IconSymbol name="lightbulb" size={15} color={Lantern.ember300} /><ThemedText style={styles.hintText} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>Show a clearer clue</ThemedText></Pressable> : null}
      </View>
      <View accessibilityLabel={`Lost Word board, ${round.guesses.length} guesses submitted`} style={styles.board}>
        {Array.from({ length: 6 }, (_, rowIndex) => {
          const evaluated = round.guesses[rowIndex];
          const current = rowIndex === round.guesses.length ? round.currentGuess : '';
          return <View key={rowIndex} style={styles.tileRow}>{Array.from({ length: 5 }, (__, columnIndex) => {
            const letter = evaluated?.word[columnIndex] ?? current[columnIndex] ?? '';
            const status = evaluated?.statuses[columnIndex];
            return <LetterTile key={columnIndex} columnIndex={columnIndex} letter={letter} status={status} size={tileSize} />;
          })}</View>;
        })}
      </View>
      {round.error ? <ThemedText accessibilityLiveRegion="assertive" selectable style={styles.error} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>{errorMessage(round.error)}</ThemedText> : null}
      <View style={styles.keyboard}>{KEYBOARD_ROWS.map((letters, rowIndex) => (
        <View key={letters} style={[styles.keyRow, rowIndex === 1 && styles.keyRowMiddle, rowIndex === 2 && styles.keyRowBottom]}>
          {rowIndex === 2 ? <Key disabled={revealing} label="ENTER" wide onPress={() => send({ type: 'submit' })} /> : null}
          {letters.split('').map((letter) => <Key disabled={revealing} key={letter} label={letter.toUpperCase()} status={keyboardStatuses[letter]} onPress={() => send({ type: 'letter', letter })} />)}
          {rowIndex === 2 ? <Key disabled={revealing} label="⌫" accessibilityLabel="Delete letter" wide onPress={() => send({ type: 'backspace' })} /> : null}
        </View>
      ))}</View>
      <Pressable accessibilityRole="button" onPress={cancel} style={[styles.cancel, compact && styles.cancelCompact]}><IconSymbol name="chevron.left" size={14} color={Lantern.moon500} /><ThemedText style={styles.cancelText} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>Back to Pagelet</ThemedText></Pressable>
    </View>
  );
}

function createRound(config: LostWordConfig, seed: string, recentPuzzleIds: string[]): LostWordRoundState {
  return createLostWordRound({
    seed,
    recentPuzzleIds,
    difficultyTier: config.difficultyTier ?? 1,
    hintUnlockAfter: config.hintUnlockAfter ?? null,
  });
}

function LetterTile({ letter, status, size, columnIndex }: { letter: string; status?: LostWordLetterStatus; size: number; columnIndex: number }) {
  const reduceMotion = useReducedMotion();
  const scaleY = useSharedValue(1);
  const [displayedStatus, setDisplayedStatus] = useState<LostWordLetterStatus | undefined>(status);

  useEffect(() => {
    if (!status) {
      if (displayedStatus) setDisplayedStatus(undefined);
      scaleY.value = 1;
      return;
    }
    if (status === displayedStatus) return;
    if (reduceMotion) {
      setDisplayedStatus(status);
      return;
    }
    const delay = columnIndex * 85;
    scaleY.value = withDelay(delay, withSequence(
      withTiming(0.06, { duration: 115 }),
      withTiming(1, { duration: 155 })
    ));
    const timer = setTimeout(() => setDisplayedStatus(status), delay + 115);
    return () => clearTimeout(timer);
  }, [columnIndex, displayedStatus, reduceMotion, scaleY, status]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: scaleY.value }] }));
  const symbol = displayedStatus === 'exact' ? '✓' : displayedStatus === 'misplaced' ? '↔' : displayedStatus === 'absent' ? '·' : '';
  return <Animated.View accessibilityLabel={letter ? `${letter.toUpperCase()}, ${displayedStatus ?? 'not submitted'}` : 'Empty tile'} style={[styles.tile, { height: size, width: size }, displayedStatus && tileStatusStyle(displayedStatus), animatedStyle]}><ThemedText style={styles.tileLetter} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{letter.toUpperCase()}</ThemedText>{symbol ? <ThemedText style={styles.tileSymbol} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{symbol}</ThemedText> : null}</Animated.View>;
}

function Key({ label, onPress, wide = false, status, accessibilityLabel, disabled = false }: { label: string; onPress: () => void; wide?: boolean; status?: LostWordLetterStatus; accessibilityLabel?: string; disabled?: boolean }) {
  return <Pressable accessibilityLabel={accessibilityLabel ?? label} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.key, wide && styles.keyWide, status && keyStatusStyle(status), disabled && styles.keyDisabled, pressed && styles.pressed]}><ThemedText adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={[styles.keyText, wide && styles.keyWideText]} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{label}</ThemedText></Pressable>;
}

function Header({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return <View style={styles.header}><ThemedText style={styles.eyebrow} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>{eyebrow}</ThemedText><ThemedText selectable style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{title}</ThemedText><ThemedText selectable style={styles.body} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>{body}</ThemedText></View>;
}

function Action({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><ThemedText style={styles.actionText} lightColor={Lantern.emberInk} darkColor={Lantern.emberInk}>{label}</ThemedText><IconSymbol name="arrow.right" size={17} color={Lantern.emberInk} /></Pressable>;
}

function tileStatusStyle(status: LostWordLetterStatus) {
  if (status === 'exact') return styles.exact;
  if (status === 'misplaced') return styles.misplaced;
  return styles.absent;
}

function keyStatusStyle(status: LostWordLetterStatus) {
  if (status === 'exact') return styles.keyExact;
  if (status === 'misplaced') return styles.keyMisplaced;
  return styles.keyAbsent;
}

function errorMessage(error: NonNullable<LostWordRoundState['error']>): string {
  if (error === 'not_enough_letters') return 'The word needs five letters.';
  return 'You already tried that word.';
}

const styles = StyleSheet.create({
  root: { gap: 15, paddingBottom: 20, paddingTop: 8 },
  gameRoot: { flex: 1, gap: 10, justifyContent: 'space-between', paddingBottom: 4, paddingHorizontal: 4, paddingTop: 4 },
  gameRootCompact: { gap: 6 },
  resultRoot: { flex: 1, gap: 16, justifyContent: 'space-between', minHeight: 0, paddingBottom: 4, paddingHorizontal: 4, paddingTop: 10 },
  resultContent: { flex: 1, gap: 20, justifyContent: 'center', minHeight: 0 },
  header: { gap: 8 },
  eyebrow: { fontSize: 10.5, fontWeight: '900', letterSpacing: 1.05 },
  title: { fontFamily: AppFontFamilies.instrumentSerif, fontSize: 29, lineHeight: 34 },
  body: { fontSize: 14, lineHeight: 21 },
  info: { alignItems: 'center', backgroundColor: 'rgba(255,195,107,0.07)', borderCurve: 'continuous', borderRadius: 18, flexDirection: 'row', gap: 10, padding: 14 },
  infoText: { flex: 1, fontSize: 12.5, fontWeight: '700', lineHeight: 18 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressText: { fontSize: 10.5, fontWeight: '900', letterSpacing: 0.8 },
  clueCard: { backgroundColor: 'rgba(255,195,107,0.07)', borderCurve: 'continuous', borderRadius: 18, gap: 6, padding: 13 },
  clueLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 0.9 },
  clueText: { fontFamily: AppFontFamilies.instrumentSerif, fontSize: 19, lineHeight: 24 },
  hintButton: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 6, minHeight: 44 },
  hintText: { fontSize: 12, fontWeight: '900' },
  board: { alignItems: 'center', gap: 5 },
  tileRow: { flexDirection: 'row', gap: 5 },
  tile: { alignItems: 'center', backgroundColor: Lantern.ink900, borderColor: 'rgba(201,194,232,0.2)', borderCurve: 'continuous', borderRadius: 10, borderWidth: 1, justifyContent: 'center' },
  tileLetter: { fontSize: 21, fontWeight: '900' },
  tileSymbol: { bottom: 1, fontSize: 8, fontWeight: '900', position: 'absolute', right: 4 },
  exact: { backgroundColor: 'rgba(65,151,128,0.9)', borderColor: Lantern.auroraTeal },
  misplaced: { backgroundColor: 'rgba(174,122,47,0.92)', borderColor: Lantern.ember300 },
  absent: { backgroundColor: Lantern.dusk700, borderColor: 'rgba(201,194,232,0.18)' },
  error: { fontSize: 12.5, fontWeight: '800', textAlign: 'center' },
  keyboard: { alignSelf: 'center', gap: 5, maxWidth: 560, width: '100%' },
  keyRow: { flexDirection: 'row', gap: 4, width: '100%' },
  keyRowMiddle: { paddingHorizontal: '5%' },
  keyRowBottom: { paddingHorizontal: '1%' },
  key: { alignItems: 'center', backgroundColor: Lantern.dusk700, borderCurve: 'continuous', borderRadius: 7, flexBasis: 0, flexGrow: 1, height: 44, justifyContent: 'center', minWidth: 0 },
  keyWide: { flexGrow: 1.5 },
  keyText: { fontSize: 12, fontWeight: '900' },
  keyWideText: { fontSize: 8.5 },
  keyExact: { backgroundColor: 'rgba(65,151,128,0.9)' },
  keyMisplaced: { backgroundColor: 'rgba(174,122,47,0.92)' },
  keyAbsent: { opacity: 0.48 },
  keyDisabled: { opacity: 0.72 },
  hiddenInput: { height: 1, opacity: 0, position: 'absolute', width: 1 },
  cancel: { alignItems: 'center', flexDirection: 'row', gap: 6, justifyContent: 'center', minHeight: 44 },
  cancelCompact: { minHeight: 36 },
  cancelText: { fontSize: 13, fontWeight: '800' },
  action: { alignItems: 'center', backgroundColor: Lantern.ember300, borderCurve: 'continuous', borderRadius: 18, flexDirection: 'row', gap: 9, justifyContent: 'center', minHeight: 54, paddingHorizontal: 18 },
  actionText: { fontSize: 15, fontWeight: '900' },
  resultCard: { alignItems: 'center', backgroundColor: 'rgba(255,195,107,0.07)', borderCurve: 'continuous', borderRadius: 24, gap: 8, justifyContent: 'center', minHeight: 190, paddingHorizontal: 22, paddingVertical: 24 },
  answer: { fontSize: 38, fontVariant: ['tabular-nums'], fontWeight: '900', letterSpacing: 5, lineHeight: 52, paddingVertical: 2, textAlign: 'center' },
  explanation: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  resultMeta: { fontSize: 11.5, fontVariant: ['tabular-nums'], fontWeight: '800' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
