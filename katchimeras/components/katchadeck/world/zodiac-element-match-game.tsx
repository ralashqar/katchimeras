import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, type StyleProp, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Lantern } from '@/constants/theme';
import type { ZodiacElement } from '@/types/world-identity';
import {
  attemptMatchThreeSwap,
  createMatchThreeState,
  type MatchThreeConfig,
  type MatchThreeResolutionStep,
  type MatchThreeSpecial,
  type MatchThreeState,
} from '@/utils/quests/experiences/match-three';
import {
  elementalGemMotifs,
  matchThreePack,
  type MatchThreeMotif,
} from '@/utils/quests/experiences/match-three-packs';
import { formatQuestDuration } from '@/utils/quests/experiences/duration';

import {
  ExperienceAction,
  ExperienceHeader,
  ExperienceResult,
  useQuestAppActive,
} from './quests/quest-experience-ui';

type Props = {
  config: MatchThreeConfig;
  seed: string;
  element: ZodiacElement;
  familiarName: string;
  completedToday: boolean;
  onComplete: () => void;
  onExit: () => void;
  onRunningChange: (running: boolean) => void;
};

type VisualEvent = { nonce: number; kind: MatchThreeResolutionStep['kind']; cleared: number[]; cascade: number };

const GEM_SOURCES: Record<string, number> = {
  'fire-ruby': require('../../../assets/images/katchimeras/zodiac/gems/fire-ruby.png'),
  'fire-sunstone': require('../../../assets/images/katchimeras/zodiac/gems/fire-sunstone.png'),
  'earth-emerald': require('../../../assets/images/katchimeras/zodiac/gems/earth-emerald.png'),
  'earth-jade': require('../../../assets/images/katchimeras/zodiac/gems/earth-jade.png'),
  'air-opal': require('../../../assets/images/katchimeras/zodiac/gems/air-opal.png'),
  'air-celestite': require('../../../assets/images/katchimeras/zodiac/gems/air-celestite.png'),
  'water-sapphire': require('../../../assets/images/katchimeras/zodiac/gems/water-sapphire.png'),
  'water-aquamarine': require('../../../assets/images/katchimeras/zodiac/gems/water-aquamarine.png'),
};

export function ZodiacElementMatchGame({ config, seed, element, familiarName, completedToday, onComplete, onExit, onRunningChange }: Props) {
  const pack = matchThreePack();
  const homeMotifs = useMemo(() => elementalGemMotifs(element), [element]);
  const accent = homeMotifs[0]?.color ?? pack.accent;
  const createRound = useCallback((roundSeed: string) => createMatchThreeState({
    seed: roundSeed,
    config,
    availableKinds: pack.motifs.map((motif) => motif.id),
    requiredKinds: homeMotifs.map((motif) => motif.id),
    objectiveRules: [{ id: element, kindIds: homeMotifs.map((motif) => motif.id), target: config.targetCounts[0] }],
  }), [config, element, homeMotifs, pack.motifs]);
  const initialState = useMemo(() => createRound(seed), [createRound, seed]);
  const motifMap = useMemo(() => new Map(pack.motifs.map((motif) => [motif.id, motif])), [pack.motifs]);
  const { height, width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const appActive = useQuestAppActive();
  const [game, setGame] = useState(initialState);
  const [displayBoard, setDisplayBoard] = useState(initialState.board);
  const [displayBlockers, setDisplayBlockers] = useState(initialState.blockers);
  const [displayObjectives, setDisplayObjectives] = useState(initialState.objectives);
  const [displayMoves, setDisplayMoves] = useState(initialState.movesRemaining);
  const [started, setStarted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [clearingIndices, setClearingIndices] = useState<number[]>([]);
  const [spawnedTileIds, setSpawnedTileIds] = useState<string[]>([]);
  const [fallingTileIds, setFallingTileIds] = useState<string[]>([]);
  const [event, setEvent] = useState<VisualEvent>({ nonce: 0, kind: 'refill', cleared: [], cascade: 0 });
  const [elapsedMs, setElapsedMs] = useState(0);
  const [finishedDurationMs, setFinishedDurationMs] = useState<number | null>(null);
  const startedAt = useRef(0);
  const playbackToken = useRef(0);
  const pendingFinal = useRef<MatchThreeState | null>(null);
  const displayBoardRef = useRef(initialState.board);
  const dragStart = useRef(-1);

  const compact = width < 390 || height < 750;
  const maxBoard = Math.min(width - (compact ? 20 : 32), height * (compact ? 0.58 : 0.62), 520);
  const gap = config.columns >= 8 ? 4 : 5;
  const boardVerticalInset = 3;
  const cellSize = Math.max(34, Math.floor((maxBoard - gap * (config.columns - 1)) / config.columns));
  const boardSize = cellSize * config.columns + gap * (config.columns - 1);
  const boardHeight = boardSize + boardVerticalInset * 2;
  const spawnedTileSet = useMemo(() => new Set(spawnedTileIds), [spawnedTileIds]);
  const fallingTileSet = useMemo(() => new Set(fallingTileIds), [fallingTileIds]);
  const spawnDepthByColumn = useMemo(() => {
    const depths = Array.from({ length: config.columns }, () => 0);
    displayBoard.forEach((tile, index) => {
      if (tile && spawnedTileSet.has(tile.id)) depths[index % config.columns] += 1;
    });
    return depths;
  }, [config.columns, displayBoard, spawnedTileSet]);

  useEffect(() => {
    if (!started || game.status !== 'playing') return;
    const update = () => setElapsedMs(Date.now() - startedAt.current);
    update();
    const timer = setInterval(update, 200);
    return () => clearInterval(timer);
  }, [game.status, started]);

  useEffect(() => {
    if (game.status === 'playing' || finishedDurationMs != null || !started) return;
    const duration = Date.now() - startedAt.current;
    setElapsedMs(duration);
    setFinishedDurationMs(duration);
    if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(game.status === 'won' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
  }, [finishedDurationMs, game.status, started]);

  useEffect(() => () => { playbackToken.current += 1; }, []);

  useEffect(() => {
    if (appActive) return;
    playbackToken.current += 1;
    const finalState = pendingFinal.current;
    if (finalState) {
      setGame(finalState);
      setDisplayBoard(finalState.board);
      setDisplayBlockers(finalState.blockers);
      setDisplayObjectives(finalState.objectives);
      setDisplayMoves(finalState.movesRemaining);
      displayBoardRef.current = finalState.board;
      pendingFinal.current = null;
    }
    setBusy(false);
    setSelected(null);
    setClearingIndices([]);
    setSpawnedTileIds([]);
    setFallingTileIds([]);
  }, [appActive]);

  const start = () => {
    const now = Date.now();
    startedAt.current = now;
    setElapsedMs(0);
    setStarted(true);
    onRunningChange(true);
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const reset = () => {
    playbackToken.current += 1;
    pendingFinal.current = null;
    const next = createRound(`${seed}:retry:${Date.now()}`);
    setGame(next);
    setDisplayBoard(next.board);
    displayBoardRef.current = next.board;
    setDisplayBlockers(next.blockers);
    setDisplayObjectives(next.objectives);
    setDisplayMoves(next.movesRemaining);
    setSelected(null);
    setClearingIndices([]);
    setSpawnedTileIds([]);
    setFallingTileIds([]);
    setBusy(false);
    setEvent({ nonce: 0, kind: 'refill', cleared: [], cascade: 0 });
    setStarted(false);
    setFinishedDurationMs(null);
    onRunningChange(false);
  };

  const leave = () => {
    reset();
    onExit();
  };

  const playSwap = async (first: number, second: number) => {
    if (!appActive || busy || game.status !== 'playing') return;
    const result = attemptMatchThreeSwap(game, first, second);
    const token = ++playbackToken.current;
    pendingFinal.current = result.state;
    setBusy(true);
    setSelected(null);
    setDisplayMoves(result.state.movesRemaining);
    for (let resolutionIndex = 0; resolutionIndex < result.steps.length; resolutionIndex += 1) {
      const resolution = result.steps[resolutionIndex];
      if (token !== playbackToken.current) return;
      if (resolution.kind === 'clear' && resolution.cleared.length > 0 && !reduceMotion) {
        setClearingIndices(resolution.cleared);
        setEvent((current) => ({ nonce: current.nonce + 1, kind: 'swap', cleared: [], cascade: resolution.cascade }));
        await wait(210);
        if (token !== playbackToken.current) return;
      }
      const following = result.steps[resolutionIndex + 1];
      const combinedRefill = resolution.kind === 'fall' && following?.kind === 'refill' ? following : null;
      const visualResolution = combinedRefill ?? resolution;
      const previousBoard = displayBoardRef.current;
      const previousIndexById = new Map(previousBoard.flatMap((tile, index) => tile ? [[tile.id, index] as const] : []));
      const previousIds = new Set(previousIndexById.keys());
      setFallingTileIds(resolution.kind === 'fall'
        ? resolution.board.flatMap((tile, index) => {
            if (!tile) return [];
            const previousIndex = previousIndexById.get(tile.id);
            return previousIndex != null && index > previousIndex ? [tile.id] : [];
          })
        : []);
      setSpawnedTileIds(visualResolution.kind === 'refill'
        ? visualResolution.board.flatMap((tile) => tile && !previousIds.has(tile.id) ? [tile.id] : [])
        : []);
      setDisplayBoard(visualResolution.board);
      displayBoardRef.current = visualResolution.board;
      setDisplayBlockers(visualResolution.blockers);
      setDisplayObjectives(visualResolution.objectives);
      setClearingIndices([]);
      setEvent((current) => ({ nonce: current.nonce + 1, kind: visualResolution.kind, cleared: visualResolution.cleared, cascade: visualResolution.cascade }));
      hapticForStep(visualResolution, reduceMotion);
      await waitForStep(visualResolution.kind, reduceMotion, visualResolution.cleared.length > 0);
      if (combinedRefill) resolutionIndex += 1;
    }
    if (token !== playbackToken.current) return;
    setGame(result.state);
    setDisplayBoard(result.state.board);
    displayBoardRef.current = result.state.board;
    setDisplayBlockers(result.state.blockers);
    setDisplayObjectives(result.state.objectives);
    pendingFinal.current = null;
    setSpawnedTileIds([]);
    setFallingTileIds([]);
    setBusy(false);
  };

  const choose = (index: number) => {
    if (busy || game.status !== 'playing') return;
    if (selected == null) {
      setSelected(index);
      if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
      return;
    }
    if (selected === index) {
      setSelected(null);
      return;
    }
    if (adjacent(selected, index, config.columns)) void playSwap(selected, index);
    else {
      setSelected(index);
      if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    }
  };

  const pan = Gesture.Pan()
    .minDistance(10)
    .runOnJS(true)
    .onBegin((gestureEvent) => {
      dragStart.current = boardIndexAt(gestureEvent.x - gestureEvent.translationX, gestureEvent.y - gestureEvent.translationY, cellSize, gap, config.rows, config.columns, boardVerticalInset);
    })
    .onEnd((gestureEvent) => {
      const from = dragStart.current;
      if (from < 0) return;
      const horizontal = Math.abs(gestureEvent.translationX) > Math.abs(gestureEvent.translationY);
      const direction = horizontal
        ? gestureEvent.translationX > 0 ? 1 : -1
        : gestureEvent.translationY > 0 ? config.columns : -config.columns;
      const to = from + direction;
      if (to >= 0 && to < displayBoard.length && adjacent(from, to, config.columns)) void playSwap(from, to);
    })
    .onFinalize(() => { dragStart.current = -1; });

  if (!started) return (
    <View style={styles.previewRoot}>
      <OneShotScaleFade reduceMotion={reduceMotion}><ExperienceHeader eyebrow={pack.eyebrow} title={pack.title} body={pack.introduction} /></OneShotScaleFade>
      <OneShotScaleFade delay={60} reduceMotion={reduceMotion} style={styles.previewCard}>
        <View style={styles.previewGems}>{homeMotifs.map((motif, index) => <OneShotScaleFade key={motif.id} delay={120 + index * 45} reduceMotion={reduceMotion}><Image source={GEM_SOURCES[motif.asset]} contentFit="contain" style={styles.previewGem} /></OneShotScaleFade>)}</View>
        <ThemedText selectable style={styles.previewTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{config.rows}×{config.columns} board · {config.moveBudget} moves</ThemedText>
        <ThemedText selectable style={styles.previewBody} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>Gather {config.targetCounts[0]} {element} gems for {familiarName}. Drag a gem, or tap two neighbours. Match four or more to make powerful clears.</ThemedText>
      </OneShotScaleFade>
      {completedToday ? <ThemedText selectable style={styles.best} lightColor={Lantern.auroraTeal} darkColor={Lantern.auroraTeal}>TODAY’S RITUAL COMPLETE · REPLAY FREELY</ThemedText> : null}
      <OneShotScaleFade delay={190} reduceMotion={reduceMotion}><ExperienceAction label={completedToday ? 'Replay ritual' : 'Begin ritual'} onPress={start} /></OneShotScaleFade>
    </View>
  );

  if (game.status !== 'playing') {
    const success = game.status === 'won';
    return (
      <ResultReveal accent={accent} reduceMotion={reduceMotion} success={success}>
        <ExperienceResult
          success={success}
          completeLabel={success ? `Reflect with ${familiarName}` : 'Back to ritual'}
          eyebrow={success ? 'RITUAL COMPLETE' : 'ROUND COMPLETE'}
          title={success ? `${familiarName} is glowing` : 'The elements need another pass'}
          body={success ? `Your element is gathered with ${game.movesRemaining} moves left. Longest chain: ×${Math.max(1, game.maxCascade)}.` : 'The final move faded before enough of your elemental gems were gathered.'}
          metric={success ? `${game.movesUsed} moves` : `${game.objectives.filter((objective) => objective.collected >= objective.target).length}/${game.objectives.length} goals`}
          onRetry={reset}
          onComplete={success ? onComplete : leave}
        />
      </ResultReveal>
    );
  }

  const frostRemaining = displayBlockers.filter((layers) => layers > 0).length;
  return (
    <View style={styles.root}>
      <View style={styles.topRow}>
        <View>
          <ThemedText style={styles.kicker} lightColor={accent} darkColor={accent}>MATCH 3 · TIER {config.tier}</ThemedText>
          <ThemedText selectable style={styles.moves} lightColor={displayMoves <= 5 ? Lantern.ember300 : Lantern.moon50} darkColor={displayMoves <= 5 ? Lantern.ember300 : Lantern.moon50}>{displayMoves} MOVES</ThemedText>
        </View>
        <View style={styles.timer}><IconSymbol name="timer" size={13} color={Lantern.auroraTeal} /><ThemedText style={styles.timerText} lightColor={Lantern.auroraTeal} darkColor={Lantern.auroraTeal}>{formatQuestDuration(elapsedMs)}</ThemedText></View>
      </View>

      <View style={styles.objectives}>
        {displayObjectives.map((objective) => <ObjectivePill key={objective.id} motifs={objective.kindIds.map((kind) => motifMap.get(kind)!).filter(Boolean)} remaining={Math.max(0, objective.target - objective.collected)} />)}
        {game.frostTarget ? <View style={[styles.objectivePill, frostRemaining === 0 && styles.objectiveComplete]}><IconSymbol name="cloud.snow.fill" size={15} color="#B9E8FF" /><ThemedText style={styles.objectiveCount} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{frostRemaining}</ThemedText></View> : null}
      </View>

      <View style={styles.boardFrame}>
        {event.cascade >= 2 && event.kind === 'clear' ? <OneShotScaleFade key={`chain-${event.nonce}`} duration={reduceMotion ? 60 : 110} reduceMotion={reduceMotion} style={styles.chainBadge}><ThemedText style={styles.chainText} lightColor={accent} darkColor={accent}>CHAIN ×{event.cascade}</ThemedText></OneShotScaleFade> : null}
        <GestureDetector gesture={pan}>
          <View accessibilityLabel={pack.boardLabel} style={[styles.board, { height: boardHeight, width: boardSize }]}>
            {displayBoard.map((tile, index) => tile ? (
              <MatchTile
                key={tile.id}
                cellSize={cellSize}
                columns={config.columns}
                gap={gap}
                index={index}
                motif={motifMap.get(tile.kind)!}
                onPress={() => choose(index)}
                clearing={clearingIndices.includes(index)}
                clearDelay={Math.min(54, Math.max(0, clearingIndices.indexOf(index)) * 6)}
                dropBounce={fallingTileSet.has(tile.id) || spawnedTileSet.has(tile.id)}
                intro={displayMoves === config.moveBudget && event.nonce === 0}
                reduceMotion={reduceMotion}
                selected={selected === index}
                spawnDepth={spawnedTileSet.has(tile.id) ? spawnDepthByColumn[index % config.columns] : 0}
                special={tile.special}
                topInset={boardVerticalInset}
              />
            ) : null)}
            {displayBlockers.map((layers, index) => layers > 0 ? <FrostOverlay key={`frost-${index}`} cellSize={cellSize} columns={config.columns} eventNonce={event.nonce} gap={gap} index={index} layers={layers} reduceMotion={reduceMotion} topInset={boardVerticalInset} /> : null)}
            {event.kind === 'clear' ? event.cleared.slice(0, 16).flatMap((index) => [0, 1, 2, 3, 4].map((spark) => <ClearSpark key={`${event.nonce}-${index}-${spark}`} cellSize={cellSize} columns={config.columns} gap={gap} index={index} ordinal={spark} reduceMotion={reduceMotion} topInset={boardVerticalInset} />)) : null}
          </View>
        </GestureDetector>
      </View>

      <ThemedText accessibilityLiveRegion="polite" selectable style={styles.status} lightColor={event.cascade >= 2 ? accent : Lantern.moon300} darkColor={event.cascade >= 2 ? accent : Lantern.moon300}>{busy ? event.kind === 'reshuffle' ? 'No paths left · reshuffling the elements' : event.cascade >= 2 ? `Cascade chain ${event.cascade}` : 'The gems are settling' : selected == null ? 'Drag a gem or tap two neighbours' : 'Choose a neighbouring gem'}</ThemedText>
      <ExperienceAction label="Leave ritual" quiet onPress={leave} />
    </View>
  );
}

function OneShotScaleFade({ children, delay = 0, duration = 220, reduceMotion, style }: { children: ReactNode; delay?: number; duration?: number; reduceMotion: boolean; style?: StyleProp<ViewStyle> }) {
  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  const scale = useSharedValue(reduceMotion ? 1 : 0.84);
  useEffect(() => {
    opacity.value = reduceMotion ? 1 : withDelay(delay, withTiming(1, { duration, easing: Easing.bezier(0.22, 0.8, 0.22, 1) }));
    scale.value = reduceMotion ? 1 : withDelay(delay, withTiming(1, { duration, easing: Easing.bezier(0.22, 0.8, 0.22, 1) }));
    return () => {
      cancelAnimation(opacity);
      cancelAnimation(scale);
    };
  }, [delay, duration, opacity, reduceMotion, scale]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

function ResultReveal({ accent, children, reduceMotion, success }: { accent: string; children: ReactNode; reduceMotion: boolean; success: boolean }) {
  return (
    <View style={styles.resultReveal}>
      {success ? <VictoryBurst accent={accent} reduceMotion={reduceMotion} /> : null}
      <OneShotScaleFade duration={reduceMotion ? 80 : 300} reduceMotion={reduceMotion} style={styles.resultRevealContent}>{children}</OneShotScaleFade>
    </View>
  );
}

function VictoryBurst({ accent, reduceMotion }: { accent: string; reduceMotion: boolean }) {
  return (
    <View pointerEvents="none" style={styles.victoryBurst}>
      <VictoryHalo accent={accent} reduceMotion={reduceMotion} />
      {Array.from({ length: 10 }, (_, ordinal) => <VictorySpark key={ordinal} accent={ordinal % 3 === 0 ? '#FFF1C9' : accent} ordinal={ordinal} reduceMotion={reduceMotion} />)}
    </View>
  );
}

function VictoryHalo({ accent, reduceMotion }: { accent: string; reduceMotion: boolean }) {
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    progress.value = reduceMotion ? 1 : withDelay(45, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
    return () => cancelAnimation(progress);
  }, [progress, reduceMotion]);
  const style = useAnimatedStyle(() => ({ opacity: reduceMotion ? 0.16 : interpolate(progress.value, [0, 0.25, 1], [0, 0.3, 0]), transform: [{ scale: reduceMotion ? 1 : interpolate(progress.value, [0, 1], [0.58, 1.5]) }] }));
  return <Animated.View style={[styles.victoryHalo, { borderColor: accent }, style]} />;
}

function VictorySpark({ accent, ordinal, reduceMotion }: { accent: string; ordinal: number; reduceMotion: boolean }) {
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  const angle = (ordinal / 10) * Math.PI * 2 - Math.PI / 2;
  const distance = 72 + (ordinal % 3) * 16;
  useEffect(() => {
    progress.value = reduceMotion ? 1 : withDelay(70 + ordinal * 12, withTiming(1, { duration: 430, easing: Easing.out(Easing.cubic) }));
    return () => cancelAnimation(progress);
  }, [ordinal, progress, reduceMotion]);
  const style = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 0 : interpolate(progress.value, [0, 0.14, 0.72, 1], [0, 1, 0.82, 0]),
    transform: [
      { translateX: Math.cos(angle) * progress.value * distance },
      { translateY: Math.sin(angle) * progress.value * distance },
      { rotateZ: `${ordinal * 29}deg` },
      { scale: interpolate(progress.value, [0, 0.25, 1], [0.25, 1.15, 0.45]) },
    ],
  }));
  return <Animated.View style={[styles.victorySpark, { backgroundColor: accent }, ordinal % 2 === 0 && styles.victorySparkDiamond, style]} />;
}

function ObjectivePill({ motifs, remaining }: { motifs: MatchThreeMotif[]; remaining: number }) {
  return <View accessibilityLabel={`${remaining} elemental gems remaining`} style={[styles.objectivePill, remaining === 0 && styles.objectiveComplete]}><View style={styles.objectiveGems}>{motifs.map((motif) => <Image key={motif.id} source={GEM_SOURCES[motif.asset]} contentFit="contain" style={styles.objectiveGem} />)}</View><ThemedText style={styles.objectiveCount} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{remaining}</ThemedText></View>;
}

function MatchTile({ cellSize, columns, gap, index, motif, special, selected, clearing, clearDelay, dropBounce, intro, spawnDepth, topInset, reduceMotion, onPress }: { cellSize: number; columns: number; gap: number; index: number; motif: MatchThreeMotif; special: MatchThreeSpecial | null; selected: boolean; clearing: boolean; clearDelay: number; dropBounce: boolean; intro: boolean; spawnDepth: number; topInset: number; reduceMotion: boolean; onPress: () => void }) {
  const pitch = cellSize + gap;
  const destinationX = (index % columns) * pitch;
  const destinationY = topInset + Math.floor(index / columns) * pitch;
  const [entrance] = useState(() => ({
    delay: intro ? (Math.floor(index / columns) + index % columns) * 14 : 0,
    initialScale: intro ? 0.78 : 1,
    duration: intro ? 220 : spawnDepth > 0 ? 110 : 130,
  }));
  const x = useSharedValue(destinationX);
  const y = useSharedValue(reduceMotion ? destinationY : destinationY - spawnDepth * pitch);
  const pulse = useSharedValue(0);
  const clearScale = useSharedValue(1);
  const entranceOpacity = useSharedValue(reduceMotion ? 1 : 0);
  const entranceScale = useSharedValue(reduceMotion ? 1 : entrance.initialScale);
  useEffect(() => {
    entranceOpacity.value = reduceMotion ? 1 : withDelay(entrance.delay, withTiming(1, { duration: entrance.duration, easing: Easing.bezier(0.22, 0.8, 0.22, 1) }));
    entranceScale.value = reduceMotion ? 1 : withDelay(entrance.delay, withTiming(1, { duration: entrance.duration, easing: Easing.bezier(0.22, 0.8, 0.22, 1) }));
    return () => {
      cancelAnimation(entranceOpacity);
      cancelAnimation(entranceScale);
    };
  }, [entrance, entranceOpacity, entranceScale, reduceMotion]);
  useEffect(() => {
    x.value = reduceMotion ? destinationX : withTiming(destinationX, { duration: 210, easing: Easing.out(Easing.cubic) });
    y.value = reduceMotion
      ? destinationY
      : dropBounce
        ? withDelay((index % columns) * 6, withSequence(
            withTiming(destinationY + Math.min(4, cellSize * 0.08), { duration: 240, easing: Easing.out(Easing.cubic) }),
            withTiming(destinationY, { duration: 70, easing: Easing.out(Easing.quad) }),
          ))
        : withTiming(destinationY, { duration: spawnDepth > 0 ? 320 : 250, easing: Easing.out(Easing.cubic) });
  }, [cellSize, columns, destinationX, destinationY, dropBounce, index, reduceMotion, spawnDepth, x, y]);
  useEffect(() => {
    cancelAnimation(pulse);
    pulse.value = selected || special
      ? reduceMotion ? 0.25 : withSequence(withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) }), withTiming(selected ? 0.34 : 0.16, { duration: 220, easing: Easing.out(Easing.cubic) }))
      : withTiming(0, { duration: 90 });
    return () => cancelAnimation(pulse);
  }, [pulse, reduceMotion, selected, special]);
  useEffect(() => {
    cancelAnimation(clearScale);
    clearScale.value = clearing && !reduceMotion
      ? withDelay(clearDelay, withSequence(
          withTiming(1.07, { duration: 40, easing: Easing.out(Easing.quad) }),
          withTiming(0.68, { duration: 45, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.06, { duration: 65, easing: Easing.in(Easing.cubic) }),
        ))
      : withTiming(1, { duration: reduceMotion ? 0 : 80 });
    return () => cancelAnimation(clearScale);
  }, [clearDelay, clearScale, clearing, reduceMotion]);
  const positionStyle = useAnimatedStyle(() => ({ opacity: entranceOpacity.value * Math.min(1, interpolate(clearScale.value, [0.06, 0.2, 1], [0, 0.86, 1])), transform: [{ translateX: x.value }, { translateY: y.value }, { scale: entranceScale.value * clearScale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: selected || special ? (reduceMotion ? selected ? 0.64 : 0.4 : 0.1 + pulse.value * 0.5) : 0, transform: [{ scale: 0.96 + pulse.value * 0.06 }] }));
  return (
    <Animated.View style={[styles.tilePosition, { height: cellSize, width: cellSize }, positionStyle]}>
      <Pressable accessibilityLabel={`${motif.accessibilityLabel}${special ? `, ${special} special` : ''}${selected ? ', selected' : ''}`} accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.tile, { borderColor: `${motif.color}8F` }, pressed && styles.tilePressed]}>
        <Animated.View pointerEvents="none" style={[styles.tileGlow, { backgroundColor: motif.color }, glowStyle]} />
        <Image source={GEM_SOURCES[motif.asset]} contentFit="contain" style={{ height: cellSize * 0.82, width: cellSize * 0.82 }} />
        {special ? <SpecialMark special={special} color={motif.color} /> : null}
      </Pressable>
    </Animated.View>
  );
}

function SpecialMark({ special, color }: { special: MatchThreeSpecial; color: string }) {
  if (special === 'row') return <View pointerEvents="none" style={[styles.rowBeam, { backgroundColor: color }]} />;
  if (special === 'column') return <View pointerEvents="none" style={[styles.columnBeam, { backgroundColor: color }]} />;
  if (special === 'burst') return <View pointerEvents="none" style={[styles.burstRing, { borderColor: color }]} />;
  return <View pointerEvents="none" style={styles.prismMark}><IconSymbol name="sparkles" size={14} color="#FFFFFF" /></View>;
}

function FrostOverlay({ cellSize, columns, gap, index, layers, eventNonce, reduceMotion, topInset }: { cellSize: number; columns: number; gap: number; index: number; layers: number; eventNonce: number; reduceMotion: boolean; topInset: number }) {
  const flash = useSharedValue(0);
  useEffect(() => {
    flash.value = reduceMotion ? 0 : withSequence(withTiming(1, { duration: 90 }), withTiming(0, { duration: 180 }));
  }, [eventNonce, flash, reduceMotion]);
  const flashStyle = useAnimatedStyle(() => ({ opacity: 0.36 + flash.value * 0.45, transform: [{ scale: 1 + flash.value * 0.05 }] }));
  return <Animated.View pointerEvents="none" style={[styles.frost, { height: cellSize, left: (index % columns) * (cellSize + gap), top: topInset + Math.floor(index / columns) * (cellSize + gap), width: cellSize }, layers === 2 && styles.frostDouble, flashStyle]}><View style={styles.frostCrackA} /><View style={styles.frostCrackB} /></Animated.View>;
}

function ClearSpark({ cellSize, columns, gap, index, ordinal, reduceMotion, topInset }: { cellSize: number; columns: number; gap: number; index: number; ordinal: number; reduceMotion: boolean; topInset: number }) {
  const travel = useSharedValue(0);
  useEffect(() => { travel.value = withTiming(1, { duration: reduceMotion ? 80 : 210, easing: Easing.out(Easing.quad) }); }, [reduceMotion, travel]);
  const angle = (ordinal / 5) * Math.PI * 2 - Math.PI / 2;
  const style = useAnimatedStyle(() => ({ opacity: interpolate(travel.value, [0, 0.18, 1], [0, 1, 0]), transform: [{ translateX: Math.cos(angle) * travel.value * cellSize * 0.68 }, { translateY: Math.sin(angle) * travel.value * cellSize * 0.68 }, { scale: interpolate(travel.value, [0, 0.34, 1], [0.2, 1.25, 0.55]) }] }));
  return <Animated.View pointerEvents="none" style={[styles.spark, { left: (index % columns) * (cellSize + gap) + cellSize / 2 - 3, top: topInset + Math.floor(index / columns) * (cellSize + gap) + cellSize / 2 - 3 }, style]} />;
}

function boardIndexAt(x: number, y: number, cellSize: number, gap: number, rows: number, columns: number, topInset: number): number {
  const contentY = y - topInset;
  if (x < 0 || contentY < 0) return -1;
  const column = Math.floor(x / (cellSize + gap));
  const row = Math.floor(contentY / (cellSize + gap));
  if (row >= rows || column >= columns || x % (cellSize + gap) > cellSize || contentY % (cellSize + gap) > cellSize) return -1;
  return row * columns + column;
}

function adjacent(first: number, second: number, columns: number): boolean {
  return Math.abs(Math.floor(first / columns) - Math.floor(second / columns)) + Math.abs((first % columns) - (second % columns)) === 1;
}

function waitForStep(kind: MatchThreeResolutionStep['kind'], reduceMotion: boolean, shrankBeforeClear = false): Promise<void> {
  const duration = reduceMotion ? 70 : kind === 'clear' ? shrankBeforeClear ? 105 : 230 : kind === 'fall' || kind === 'refill' ? 360 : kind === 'invalid' ? 150 : kind === 'reshuffle' ? 280 : 190;
  return wait(duration);
}

function wait(duration: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, duration));
}

function hapticForStep(step: MatchThreeResolutionStep, reduceMotion: boolean) {
  if (process.env.EXPO_OS !== 'ios') return;
  if (step.kind === 'invalid') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  else if (step.kind === 'clear') void Haptics.impactAsync(step.cascade >= 3 ? Haptics.ImpactFeedbackStyle.Heavy : step.cascade === 2 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
  else if (step.kind === 'swap' && !reduceMotion) void Haptics.selectionAsync();
}

const styles = StyleSheet.create({
  resultReveal: { flex: 1, minHeight: 0, position: 'relative' },
  resultRevealContent: { flex: 1, minHeight: 0, zIndex: 1 },
  victoryBurst: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', pointerEvents: 'none', zIndex: 2 },
  victoryHalo: { borderRadius: 999, borderWidth: 2, height: 154, left: '50%', marginLeft: -77, marginTop: -77, position: 'absolute', top: '38%', width: 154 },
  victorySpark: { borderRadius: 999, height: 8, left: '50%', marginLeft: -4, marginTop: -4, position: 'absolute', top: '38%', width: 8 },
  victorySparkDiamond: { borderRadius: 2, height: 9, width: 9 },
  previewRoot: { flexGrow: 1, gap: 18, justifyContent: 'space-between', padding: 4 },
  previewCard: { alignItems: 'center', backgroundColor: 'rgba(217,149,255,0.07)', borderColor: 'rgba(217,149,255,0.18)', borderCurve: 'continuous', borderRadius: 24, borderWidth: 1, gap: 10, justifyContent: 'center', minHeight: 210, padding: 22 },
  previewGems: { alignItems: 'center', flexDirection: 'row', height: 76, justifyContent: 'center' },
  previewGem: { height: 76, marginHorizontal: -5, width: 76 },
  previewTitle: { fontSize: 17, fontWeight: '900', textAlign: 'center' },
  previewBody: { fontSize: 13.5, lineHeight: 20, textAlign: 'center' },
  best: { fontSize: 11.5, fontVariant: ['tabular-nums'], fontWeight: '900', letterSpacing: 0.6, textAlign: 'center' },
  root: { flex: 1, gap: 10, minHeight: 0, padding: 4 },
  topRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  kicker: { fontSize: 10.5, fontWeight: '900', letterSpacing: 0.85 },
  moves: { fontSize: 22, fontVariant: ['tabular-nums'], fontWeight: '900', lineHeight: 28 },
  timer: { alignItems: 'center', backgroundColor: 'rgba(125,232,205,0.09)', borderColor: 'rgba(125,232,205,0.23)', borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 5, paddingHorizontal: 10, paddingVertical: 6 },
  timerText: { fontSize: 12, fontVariant: ['tabular-nums'], fontWeight: '900' },
  objectives: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  objectivePill: { alignItems: 'center', backgroundColor: 'rgba(201,194,232,0.08)', borderColor: 'rgba(201,194,232,0.16)', borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 5, minWidth: 48, paddingHorizontal: 9, paddingVertical: 5 },
  objectiveGems: { alignItems: 'center', flexDirection: 'row' },
  objectiveGem: { height: 23, marginHorizontal: -3, width: 23 },
  objectiveComplete: { backgroundColor: 'rgba(125,232,205,0.12)', borderColor: 'rgba(125,232,205,0.4)', opacity: 0.68 },
  objectiveCount: { fontSize: 11.5, fontVariant: ['tabular-nums'], fontWeight: '900' },
  boardFrame: { alignItems: 'center', flex: 1, justifyContent: 'center', minHeight: 0, position: 'relative' },
  board: { backgroundColor: 'rgba(18,14,29,0.74)', borderColor: 'rgba(217,149,255,0.18)', borderCurve: 'circular', borderRadius: 9, borderWidth: 1, boxShadow: '0 14px 34px rgba(5,3,12,0.38)', overflow: 'hidden', position: 'relative' },
  tilePosition: { left: 0, position: 'absolute', top: 0, zIndex: 2 },
  tile: { alignItems: 'center', backgroundColor: '#251E34', borderCurve: 'continuous', borderRadius: 12, borderWidth: 1, height: '100%', justifyContent: 'center', overflow: 'hidden', width: '100%' },
  tilePressed: { transform: [{ scale: 0.94 }] },
  tileGlow: { ...StyleSheet.absoluteFillObject, borderRadius: 12 },
  rowBeam: { borderRadius: 999, height: 5, left: 4, opacity: 0.8, position: 'absolute', right: 4 },
  columnBeam: { borderRadius: 999, bottom: 4, opacity: 0.8, position: 'absolute', top: 4, width: 5 },
  burstRing: { borderRadius: 999, borderWidth: 3, height: '72%', position: 'absolute', width: '72%' },
  prismMark: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 999, height: 24, justifyContent: 'center', position: 'absolute', width: 24 },
  frost: { backgroundColor: 'rgba(185,232,255,0.18)', borderColor: 'rgba(215,245,255,0.78)', borderRadius: 12, borderWidth: 1.5, position: 'absolute', zIndex: 4 },
  frostDouble: { backgroundColor: 'rgba(185,232,255,0.34)', borderWidth: 2.5 },
  frostCrackA: { backgroundColor: 'rgba(255,255,255,0.7)', height: 1, left: '20%', position: 'absolute', top: '48%', transform: [{ rotateZ: '28deg' }], width: '58%' },
  frostCrackB: { backgroundColor: 'rgba(255,255,255,0.52)', height: 1, left: '42%', position: 'absolute', top: '30%', transform: [{ rotateZ: '-52deg' }], width: '35%' },
  spark: { backgroundColor: '#FFF1C9', borderRadius: 999, height: 6, position: 'absolute', width: 6, zIndex: 8 },
  chainBadge: { backgroundColor: 'rgba(24,15,37,0.94)', borderColor: 'rgba(217,149,255,0.36)', borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7, position: 'absolute', top: 2, zIndex: 10 },
  chainText: { fontSize: 13, fontWeight: '900', letterSpacing: 0.9 },
  status: { fontSize: 12.5, fontWeight: '800', minHeight: 18, textAlign: 'center' },
});
