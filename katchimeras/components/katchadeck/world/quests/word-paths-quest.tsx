import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppFontFamilies, Lantern } from '@/constants/theme';
import {
  createWordPathRound,
  wordPathCellRevealed,
  wordPathCurrentWord,
  wordPathGridCells,
  wordPathLetterAtPoint,
  wordPathReducer,
  wordPathRoundComplete,
  type WordPathFeedback,
  type WordPathRoundState,
} from '@/utils/quests/experiences/word-paths';
import type { QuestResult } from '@/utils/quests/experiences/types';
import { ExperienceAction, ExperienceHeader } from './quest-experience-ui';

type Config = { difficultyTier: 1 | 2 | 3 | 4 | 5; hintAllowance: 1 };
type Point = { x: number; y: number };

export function WordPathsQuest({ config, seed, recentPuzzleIds, onAttemptStart, onAttemptCancel, onComplete, onRunningChange }: {
  config: Config;
  seed: string;
  recentPuzzleIds: string[];
  onAttemptStart: (config: Record<string, unknown>) => string;
  onAttemptCancel: (attemptId: string) => void;
  onComplete: (attemptId: string, result: QuestResult) => void;
  onRunningChange: (running: boolean, attemptId?: string | null) => void;
}) {
  const { height, width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const makeRound = () => createWordPathRound({ seed, recentPuzzleIds, difficultyTier: config.difficultyTier ?? 1 });
  const [round, dispatch] = useReducer(wordPathReducer, null, makeRound);
  const [started, setStarted] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [dragPoint, setDragPoint] = useState<Point | null>(null);
  const attemptId = useRef<string | null>(null);
  const compact = width < 390 || height < 750;
  const wheelSize = Math.min(compact ? 218 : 252, width - 64);
  const sixLetterWheel = round.puzzle.letters.length === 6;
  const nodeSize = sixLetterWheel ? (compact ? 48 : 54) : (compact ? 52 : 58);
  const nodeRadius = nodeSize / 2;
  const wheelRadius = wheelSize * 0.335;
  const center = wheelSize / 2;
  const positions = useMemo(() => wordPathWheelPositions(round.shuffleOrder, center, wheelRadius), [center, round.shuffleOrder, wheelRadius]);
  const currentWord = wordPathCurrentWord(round);
  const complete = wordPathRoundComplete(round);
  const gridCells = useMemo(() => wordPathGridCells(round.puzzle), [round.puzzle]);
  const gridGap = compact ? 3 : 4;
  const gridCellSize = Math.max(
    sixLetterWheel ? 18 : 23,
    Math.min(
      compact ? 34 : 38,
      Math.floor((width - 48 - (round.puzzle.columns - 1) * gridGap) / round.puzzle.columns),
      Math.floor(((compact ? 234 : 282) - (round.puzzle.rows - 1) * gridGap) / round.puzzle.rows),
    ),
  );
  const gridWidth = round.puzzle.columns * gridCellSize + (round.puzzle.columns - 1) * gridGap;
  const gridHeight = round.puzzle.rows * gridCellSize + (round.puzzle.rows - 1) * gridGap;

  const lastHit = useRef(-1);
  const mergeProgress = useSharedValue(0);
  const shake = useSharedValue(0);
  const bonusScale = useSharedValue(1);

  useEffect(() => {
    if (!round.feedback) return;
    if (process.env.EXPO_OS === 'ios') {
      if (round.feedback === 'target') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      else if (round.feedback === 'bonus') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      else if (round.feedback === 'already_found') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      else if (round.feedback === 'invalid') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    if (round.feedback === 'target' && !reduceMotion) {
      mergeProgress.value = 0;
      mergeProgress.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) });
    } else if (round.feedback === 'invalid' && !reduceMotion) {
      shake.value = withSequence(withTiming(-7, { duration: 55 }), withTiming(7, { duration: 80 }), withTiming(-4, { duration: 70 }), withTiming(0, { duration: 70 }));
    } else if (round.feedback === 'bonus' && !reduceMotion) {
      bonusScale.value = withSequence(withSpring(1.12, { damping: 12, stiffness: 260 }), withSpring(1, { damping: 14, stiffness: 220 }));
    }
    const timer = setTimeout(() => dispatch({ type: 'clear_feedback' }), reduceMotion ? 220 : 680);
    return () => clearTimeout(timer);
  }, [bonusScale, mergeProgress, reduceMotion, round.feedback, shake]);

  useEffect(() => {
    if (!complete || finishedAt !== null) return;
    setFinishedAt(Date.now());
    if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [complete, finishedAt]);

  useEffect(() => {
    if (!complete || showResult) return;
    const timer = setTimeout(() => setShowResult(true), reduceMotion ? 260 : 920);
    return () => clearTimeout(timer);
  }, [complete, reduceMotion, showResult]);

  const traceLetter = (index: number) => {
    dispatch({ type: 'trace_letter', index });
  };

  const submitTrace = () => dispatch({ type: 'submit' });

  const gesture = Gesture.Pan()
    .minDistance(4)
    .runOnJS(true)
    .onBegin((event) => {
      setDragPoint({ x: event.x, y: event.y });
      const hit = wordPathLetterAtPoint(event.x, event.y, positions, nodeRadius + 11);
      lastHit.current = hit;
      if (hit >= 0) traceLetter(hit);
    })
    .onUpdate((event) => {
      setDragPoint({ x: event.x, y: event.y });
      const hit = wordPathLetterAtPoint(event.x, event.y, positions, nodeRadius + 11);
      if (hit >= 0 && hit !== lastHit.current) {
        lastHit.current = hit;
        traceLetter(hit);
      }
    })
    .onEnd(submitTrace)
    .onFinalize(() => {
      setDragPoint(null);
      lastHit.current = -1;
    });

  const capsuleStyle = useAnimatedStyle(() => ({
    opacity: round.feedback === 'target' ? interpolate(mergeProgress.value, [0, 0.72, 1], [1, 0.9, 0]) : 1,
    transform: [
      { translateX: shake.value },
      { translateY: round.feedback === 'target' ? interpolate(mergeProgress.value, [0, 1], [0, -92]) : 0 },
      { scale: round.feedback === 'target' ? interpolate(mergeProgress.value, [0, 0.25, 1], [1, 1.05, 0.72]) : 1 },
    ],
  }));
  const bonusStyle = useAnimatedStyle(() => ({ transform: [{ scale: bonusScale.value }] }));

  const start = () => {
    const startedAt = Date.now();
    dispatch({ type: 'start_round', startedAt });
    attemptId.current = onAttemptStart({
      ...config,
      gameId: 'pagelet_word_paths',
      packId: 'pagelet-word-paths',
      rulesetId: 'word-paths-v1',
      puzzleId: round.puzzle.id,
    });
    setStarted(true);
    onRunningChange(true, attemptId.current);
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const cancel = () => {
    if (attemptId.current) onAttemptCancel(attemptId.current);
    attemptId.current = null;
    onRunningChange(false);
    setStarted(false);
    setShowResult(false);
    setFinishedAt(null);
    dispatch({ type: 'replace', state: makeRound() });
  };

  const finish = () => {
    if (!attemptId.current) return;
    onComplete(attemptId.current, {
      kind: 'word_connect',
      success: true,
      packId: 'pagelet-word-paths',
      puzzleId: round.puzzle.id,
      wordsFound: round.foundWords.length,
      totalWords: round.puzzle.words.length,
      bonusWordsFound: round.bonusWordsFound.length,
      submittedWords: round.submissions,
      durationMs: Math.max(0, (finishedAt ?? Date.now()) - round.startedAt),
      difficultyTier: config.difficultyTier,
      hintsUsed: round.hintsUsed,
    });
  };

  if (!started) return (
    <View style={styles.previewRoot}>
      <ExperienceHeader eyebrow="WORD PATHS" title="Words are tangled between Pagelet’s shelves" body="Trace through the letter wheel and uncover every crossing word. There is no clock and every path can be tried again." />
      <View style={styles.previewCard}>
        <View style={styles.previewGlyph}><IconSymbol name="book.closed.fill" size={24} color={Lantern.ember300} /></View>
        <ThemedText selectable style={styles.previewTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{round.puzzle.letters.length} letters · {round.puzzle.words.length} hidden words</ThemedText>
        <ThemedText selectable style={styles.previewBody} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>Drag through letters to make a word. Shuffle as often as you like, and reveal one letter if a path stays hidden.</ThemedText>
      </View>
      <ExperienceAction label="Untangle the words" onPress={start} />
    </View>
  );

  if (complete && showResult) {
    const seconds = Math.max(1, Math.round(((finishedAt ?? Date.now()) - round.startedAt) / 1000));
    return (
      <ScrollView
        accessibilityLiveRegion="polite"
        bounces={false}
        contentContainerStyle={[styles.resultRoot, compact && styles.resultRootCompact]}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        style={styles.resultScroll}>
        <View style={styles.resultContent}>
          <ExperienceHeader eyebrow="SHELF RESTORED" title="Every word found its place" body={`You uncovered ${round.puzzle.words.length} crossing words${round.bonusWordsFound.length ? ` and banked ${round.bonusWordsFound.length} bonus ${round.bonusWordsFound.length === 1 ? 'word' : 'words'}` : ''}.`} />
          <View style={[styles.resultCard, compact && styles.resultCardCompact]}>
            <ThemedText selectable style={styles.resultWord} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>COMPLETE</ThemedText>
            <ThemedText selectable style={styles.resultMeta} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>{round.submissions} attempts · {seconds}s{round.hintsUsed ? ' · hint used' : ''}</ThemedText>
          </View>
        </View>
        <ExperienceAction label="Exit game" onPress={finish} />
      </ScrollView>
    );
  }

  const capsuleWord = currentWord || round.lastSubmittedWord || 'TRACE A WORD';
  const capsuleTone = feedbackColor(round.feedback);
  const lastTraceIndex = round.trace[round.trace.length - 1];
  const lastTracePosition = lastTraceIndex == null ? null : positions[lastTraceIndex];

  return (
    <View style={[styles.root, compact && styles.rootCompact]}>
      <View style={styles.topRow}>
        <View>
          <ThemedText style={styles.kicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>PAGELET · WORD PATHS</ThemedText>
          <ThemedText selectable style={styles.progress} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>{round.foundWords.length} OF {round.puzzle.words.length} WORDS</ThemedText>
        </View>
        <Animated.View style={[styles.bonusPill, bonusStyle]}>
          <IconSymbol name="sparkles" size={13} color={Lantern.ember300} />
          <ThemedText style={styles.bonusText} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>{round.bonusWordsFound.length} BONUS</ThemedText>
        </Animated.View>
      </View>

      <View accessibilityLabel={`Crossword grid. ${round.foundWords.length} of ${round.puzzle.words.length} words found.`} style={[styles.grid, { height: gridHeight, width: gridWidth }]}>
        {gridCells.map((cell) => (
          <GridCell
            key={cell.key}
            cell={cell}
            hinted={round.hintedCells.includes(cell.key)}
            revealed={wordPathCellRevealed(round, cell.key)}
            size={gridCellSize}
            gap={gridGap}
            revealDelay={round.feedback === 'target' && round.lastSubmittedWord ? wordPathCellSequence(round.puzzle, round.lastSubmittedWord, cell.key) * 72 : 0}
            shakeDelay={round.feedback === 'already_found' && round.lastSubmittedWord ? wordPathCellSequence(round.puzzle, round.lastSubmittedWord, cell.key) * 24 : 0}
            shakeTrigger={round.feedback === 'already_found' && round.lastSubmittedWord && cell.words.includes(round.lastSubmittedWord) ? round.submissions : 0}
            reduceMotion={reduceMotion}
          />
        ))}
      </View>

      <Animated.View accessibilityLiveRegion="polite" style={[styles.wordCapsule, { borderColor: `${capsuleTone}88` }, capsuleStyle]}>
        <ThemedText adjustsFontSizeToFit numberOfLines={1} style={[styles.wordCapsuleText, { color: capsuleTone }]}>{capsuleWord.toUpperCase()}</ThemedText>
      </Animated.View>

      <GestureDetector gesture={gesture}>
        <View accessibilityLabel="Letter wheel" style={[styles.wheel, { height: wheelSize, width: wheelSize }]}>
          {round.trace.slice(1).map((identity, sequenceIndex) => {
            const previousIdentity = round.trace[sequenceIndex];
            return <ConnectorSegment key={`${previousIdentity}:${identity}`} end={positions[identity]} start={positions[previousIdentity]} />;
          })}
          {lastTracePosition && dragPoint ? <ConnectorSegment end={dragPoint} start={lastTracePosition} /> : null}
          {round.puzzle.letters.map((letter, identity) => (
            <LetterNode
              key={identity}
              letter={letter}
              selectedIndex={round.trace.indexOf(identity)}
              point={positions[identity]}
              size={nodeSize}
              onPress={() => traceLetter(identity)}
            />
          ))}
          <Pressable accessibilityLabel="Shuffle letters" accessibilityRole="button" onPress={() => dispatch({ type: 'shuffle' })} style={({ pressed }) => [styles.shuffleButton, pressed && styles.pressed]}>
            <IconSymbol name="arrow.counterclockwise" size={21} color={Lantern.moon300} />
          </Pressable>
        </View>
      </GestureDetector>

      <View style={styles.actionRow}>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: round.hintsUsed >= config.hintAllowance }} disabled={round.hintsUsed >= config.hintAllowance} onPress={() => dispatch({ type: 'hint' })} style={({ pressed }) => [styles.toolButton, round.hintsUsed >= config.hintAllowance && styles.disabled, pressed && styles.pressed]}>
          <IconSymbol name="lightbulb" size={16} color={Lantern.ember300} />
          <ThemedText style={styles.toolText} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>{round.hintsUsed ? 'Hint used' : 'Reveal a letter'}</ThemedText>
        </Pressable>
        <Pressable accessibilityLabel="Clear traced letters" accessibilityRole="button" onPress={() => dispatch({ type: 'clear_trace' })} style={({ pressed }) => [styles.smallTool, pressed && styles.pressed]}><IconSymbol name="xmark" size={17} color={Lantern.moon300} /></Pressable>
        <Pressable accessibilityLabel="Submit traced word" accessibilityRole="button" onPress={submitTrace} style={({ pressed }) => [styles.smallTool, styles.submitTool, pressed && styles.pressed]}><IconSymbol name="checkmark" size={17} color={Lantern.emberInk} /></Pressable>
        <Pressable accessibilityLabel="Leave Word Paths" accessibilityRole="button" onPress={cancel} style={({ pressed }) => [styles.smallTool, pressed && styles.pressed]}><IconSymbol name="chevron.left" size={17} color={Lantern.moon300} /></Pressable>
      </View>
    </View>
  );
}

function LetterNode({ letter, selectedIndex, point, size, onPress }: { letter: string; selectedIndex: number; point: Point; size: number; onPress: () => void }) {
  const selected = selectedIndex >= 0;
  return (
    <Pressable
      accessibilityLabel={`${letter.toUpperCase()}${selected ? `, selected ${selectedIndex + 1}` : ''}`}
      accessibilityHint="Double tap to add this letter to the current word"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.letterNode, { height: size, left: point.x - size / 2, top: point.y - size / 2, width: size }, selected && styles.letterNodeSelected, pressed && styles.letterNodePressed]}>
      <ThemedText style={styles.letterText} lightColor={selected ? Lantern.emberInk : Lantern.moon50} darkColor={selected ? Lantern.emberInk : Lantern.moon50}>{letter.toUpperCase()}</ThemedText>
    </Pressable>
  );
}

function GridCell({ cell, revealed, hinted, size, gap, revealDelay, shakeDelay, shakeTrigger, reduceMotion }: { cell: ReturnType<typeof wordPathGridCells>[number]; revealed: boolean; hinted: boolean; size: number; gap: number; revealDelay: number; shakeDelay: number; shakeTrigger: number; reduceMotion: boolean }) {
  const tileScale = useSharedValue(1);
  const letterScale = useSharedValue(1);
  const letterOpacity = useSharedValue(revealed ? 1 : 0);
  const shakeX = useSharedValue(0);
  const [showLetter, setShowLetter] = useState(revealed);
  useEffect(() => {
    if (!revealed) {
      setShowLetter(false);
      tileScale.value = 1;
      letterScale.value = 1;
      letterOpacity.value = 0;
      return;
    }
    if (showLetter) return;
    if (reduceMotion) {
      setShowLetter(true);
      tileScale.value = 1;
      letterScale.value = 1;
      letterOpacity.value = 1;
      return;
    }
    const timer = setTimeout(() => {
      tileScale.value = withSequence(
        withTiming(0.88, { duration: 65, easing: Easing.out(Easing.quad) }),
        withTiming(1.055, { duration: 105, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 85, easing: Easing.out(Easing.quad) }),
      );
      letterScale.value = 0.35;
      letterOpacity.value = 0;
      setShowLetter(true);
      letterOpacity.value = withTiming(1, { duration: 105, easing: Easing.out(Easing.cubic) });
      letterScale.value = withSequence(
        withTiming(1.13, { duration: 125, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 90, easing: Easing.out(Easing.quad) }),
      );
    }, revealDelay);
    return () => clearTimeout(timer);
  }, [letterOpacity, letterScale, reduceMotion, revealDelay, revealed, showLetter, tileScale]);
  useEffect(() => {
    if (!shakeTrigger || reduceMotion) return;
    const timer = setTimeout(() => {
      shakeX.value = withSequence(
        withTiming(-3, { duration: 45 }),
        withTiming(3, { duration: 55 }),
        withTiming(-2, { duration: 48 }),
        withTiming(2, { duration: 48 }),
        withTiming(0, { duration: 55 }),
      );
    }, shakeDelay);
    return () => clearTimeout(timer);
  }, [reduceMotion, shakeDelay, shakeTrigger, shakeX]);
  const tileStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }, { scale: tileScale.value }] }));
  const letterStyle = useAnimatedStyle(() => ({ opacity: letterOpacity.value, transform: [{ scale: letterScale.value }] }));
  return (
    <Animated.View
      accessibilityLabel={revealed ? `${cell.letter.toUpperCase()}, revealed` : 'Hidden letter'}
      entering={FadeIn.duration(reduceMotion ? 80 : 160)}
      exiting={FadeOut.duration(80)}
      style={[styles.gridCell, { height: size, left: cell.column * (size + gap), top: cell.row * (size + gap), width: size }, showLetter && styles.gridCellRevealed, hinted && styles.gridCellHinted, tileStyle]}>
      {showLetter ? <Animated.View style={letterStyle}><ThemedText style={[styles.gridLetter, { fontSize: Math.max(12, size * 0.52), lineHeight: Math.max(14, size * 0.64) }]} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{cell.letter.toUpperCase()}</ThemedText></Animated.View> : null}
    </Animated.View>
  );
}

function ConnectorSegment({ end, start }: { end: Point; start: Point }) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  return <View pointerEvents="none" style={[styles.connector, {
    left: (start.x + end.x - length) / 2,
    top: (start.y + end.y - 9) / 2,
    transform: [{ rotateZ: `${Math.atan2(dy, dx)}rad` }],
    width: length,
  }]} />;
}

function wordPathWheelPositions(order: number[], center: number, radius: number): Point[] {
  const result: Point[] = Array.from({ length: order.length }, () => ({ x: center, y: center }));
  order.forEach((identity, slot) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * slot) / order.length;
    result[identity] = { x: center + Math.cos(angle) * radius, y: center + Math.sin(angle) * radius };
  });
  return result;
}

function wordPathCellSequence(puzzle: WordPathRoundState['puzzle'], word: string, cellKey: string): number {
  const placement = puzzle.placements.find((item) => item.word === word);
  if (!placement) return 0;
  const [row, column] = cellKey.split(':').map(Number);
  return placement.direction === 'across' ? Math.max(0, column - placement.column) : Math.max(0, row - placement.row);
}

function feedbackColor(feedback: WordPathFeedback): string {
  if (feedback === 'target') return Lantern.auroraTeal;
  if (feedback === 'bonus') return Lantern.ember300;
  if (feedback === 'invalid') return '#F2A38B';
  return Lantern.moon50;
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: 9, justifyContent: 'space-between', minHeight: 0, paddingHorizontal: 2, paddingTop: 2 },
  rootCompact: { gap: 5 },
  previewRoot: { flex: 1, gap: 18, justifyContent: 'space-between', padding: 4 },
  previewCard: { alignItems: 'center', backgroundColor: 'rgba(255,195,107,0.06)', borderColor: 'rgba(255,195,107,0.15)', borderCurve: 'continuous', borderRadius: 24, borderWidth: 1, gap: 10, padding: 22 },
  previewGlyph: { alignItems: 'center', backgroundColor: 'rgba(255,195,107,0.10)', borderRadius: 18, height: 54, justifyContent: 'center', width: 54 },
  previewTitle: { fontSize: 15, fontWeight: '900', textAlign: 'center' },
  previewBody: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  topRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  kicker: { fontSize: 9.5, fontWeight: '900', letterSpacing: 0.95 },
  progress: { fontSize: 11.5, fontVariant: ['tabular-nums'], fontWeight: '800', paddingTop: 3 },
  bonusPill: { alignItems: 'center', backgroundColor: 'rgba(255,195,107,0.08)', borderColor: 'rgba(255,195,107,0.18)', borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 5, paddingHorizontal: 10, paddingVertical: 7 },
  bonusText: { fontSize: 8.5, fontVariant: ['tabular-nums'], fontWeight: '900', letterSpacing: 0.55 },
  grid: { alignSelf: 'center', position: 'relative' },
  gridCell: { alignItems: 'center', backgroundColor: '#211A2D', borderColor: 'rgba(201,194,232,0.19)', borderCurve: 'continuous', borderRadius: 9, borderWidth: 1, justifyContent: 'center', position: 'absolute' },
  gridCellRevealed: { backgroundColor: 'rgba(174,122,47,0.92)', borderColor: Lantern.ember300, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)' },
  gridCellHinted: { backgroundColor: 'rgba(65,151,128,0.86)', borderColor: Lantern.auroraTeal },
  gridLetter: { fontWeight: '900' },
  wordCapsule: { alignItems: 'center', alignSelf: 'center', backgroundColor: '#1B1524', borderCurve: 'continuous', borderRadius: 999, borderWidth: 1, height: 40, justifyContent: 'center', minWidth: 156, paddingHorizontal: 22, zIndex: 4 },
  wordCapsuleText: { fontSize: 16, fontWeight: '900', letterSpacing: 2 },
  wheel: { alignSelf: 'center', backgroundColor: '#17121F', borderColor: 'rgba(255,195,107,0.14)', borderCurve: 'continuous', borderRadius: 999, borderWidth: 1, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 14px 30px rgba(8,5,10,0.28)', position: 'relative' },
  letterNode: { alignItems: 'center', backgroundColor: '#30273F', borderColor: 'rgba(201,194,232,0.30)', borderRadius: 999, borderWidth: 1, boxShadow: '0 5px 14px rgba(7,5,12,0.30)', justifyContent: 'center', position: 'absolute', zIndex: 2 },
  letterNodeSelected: { backgroundColor: Lantern.ember300, borderColor: '#FFE1AE', transform: [{ scale: 1.06 }] },
  letterNodePressed: { transform: [{ scale: 0.96 }] },
  letterText: { fontSize: 23, fontWeight: '900' },
  shuffleButton: { alignItems: 'center', backgroundColor: 'rgba(201,194,232,0.08)', borderColor: 'rgba(201,194,232,0.14)', borderRadius: 999, borderWidth: 1, height: 48, justifyContent: 'center', left: '50%', position: 'absolute', top: '50%', transform: [{ translateX: -24 }, { translateY: -24 }], width: 48, zIndex: 3 },
  connector: { backgroundColor: Lantern.ember500, borderRadius: 999, height: 9, position: 'absolute', zIndex: 1 },
  actionRow: { flexDirection: 'row', gap: 7, minHeight: 48 },
  toolButton: { alignItems: 'center', backgroundColor: 'rgba(255,195,107,0.07)', borderColor: 'rgba(255,195,107,0.18)', borderCurve: 'continuous', borderRadius: 16, borderWidth: 1, flex: 1, flexDirection: 'row', gap: 7, justifyContent: 'center', paddingHorizontal: 10 },
  toolText: { fontSize: 11, fontWeight: '900' },
  smallTool: { alignItems: 'center', borderColor: 'rgba(201,194,232,0.16)', borderCurve: 'continuous', borderRadius: 16, borderWidth: 1, justifyContent: 'center', width: 46 },
  submitTool: { backgroundColor: Lantern.ember300, borderColor: Lantern.ember300 },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.97 }] },
  resultScroll: { flex: 1 },
  resultRoot: { flexGrow: 1, gap: 16, justifyContent: 'space-between', padding: 4 },
  resultRootCompact: { gap: 12 },
  resultContent: { flexGrow: 1, gap: 20, justifyContent: 'center' },
  resultCard: { alignItems: 'center', backgroundColor: 'rgba(255,195,107,0.07)', borderColor: 'rgba(255,195,107,0.15)', borderCurve: 'continuous', borderRadius: 24, borderWidth: 1, gap: 8, justifyContent: 'center', minHeight: 180, padding: 24 },
  resultCardCompact: { minHeight: 140, padding: 18 },
  resultWord: { fontFamily: AppFontFamilies.instrumentSerif, fontSize: 34, letterSpacing: 2, lineHeight: 44, textAlign: 'center' },
  resultMeta: { fontSize: 12, fontVariant: ['tabular-nums'], fontWeight: '800' },
});
