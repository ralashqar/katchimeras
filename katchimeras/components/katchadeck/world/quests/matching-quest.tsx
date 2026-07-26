import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
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
import {
  createMatchingDeck,
  createMemoryMatchState,
  memoryMatchPresentation,
  memoryMatchPack,
  memoryMatchReducer,
  shuffleMatchingDeck,
  type MatchingMotif,
  type MemoryMatchPackId,
} from '@/utils/quests/experiences/matching';
import { formatQuestDuration } from '@/utils/quests/experiences/duration';
import type { QuestResult } from '@/utils/quests/experiences/types';
import { worldAssetSource } from '@/utils/world-visuals';

import {
  ExperienceAction,
  ExperienceResult,
  QuestExperiencePreview,
  experienceStyles,
  useQuestAppActive,
} from './quest-experience-ui';
import { MossproutMemoryGardenScreen } from './mossprout-memory-garden-screen';

type Config = { pairCount: number; moveBudget: number; tier: number };
type Props = {
  config: Config;
  packId: MemoryMatchPackId;
  seed: string;
  recentIds: string[];
  bestDurationMs?: number | null;
  startImmediately?: boolean;
  onAttemptStart: (config: Record<string, unknown>) => string;
  onAttemptCancel: (id: string) => void;
  onComplete: (id: string, result: QuestResult) => void;
  onRequestExit?: () => void;
  onRunningChange: (running: boolean, id?: string | null) => void;
};

type GridLayout = { width: number; height: number };
type MemoryMatchTheme = 'gallery' | 'garden' | 'feast';

function matchTheme(packId: MemoryMatchPackId): MemoryMatchTheme {
  if (packId === 'mossprout-garden') return 'garden';
  if (packId === 'feastle-food') return 'feast';
  return 'gallery';
}

export function MatchingQuest({
  config,
  packId,
  seed,
  recentIds,
  bestDurationMs = null,
  startImmediately = false,
  onAttemptStart,
  onAttemptCancel,
  onComplete,
  onRequestExit,
  onRunningChange,
}: Props) {
  const pack = memoryMatchPack(packId);
  const theme = matchTheme(packId);
  const immersiveGarden = memoryMatchPresentation(packId) === 'memory_garden';
  // Parent quest persistence creates a fresh array when an attempt starts even
  // though the completed-content ids have not changed. Key by values so that
  // rerender cannot rebuild the preset deck and overwrite the cell shuffle.
  const recentIdsKey = recentIds.join('\u001f');
  const baseDeck = useMemo(
    () => createMatchingDeck(
      seed,
      config.pairCount,
      recentIdsKey ? recentIdsKey.split('\u001f') : [],
      packId,
    ),
    [config.pairCount, packId, recentIdsKey, seed],
  );
  const [deck, setDeck] = useState(baseDeck);
  const [started, setStarted] = useState(false);
  const [game, dispatch] = useReducer(memoryMatchReducer, undefined, createMemoryMatchState);
  const [gridLayout, setGridLayout] = useState<GridLayout>({ width: 0, height: 0 });
  const [elapsedMs, setElapsedMs] = useState(0);
  const [finishedDurationMs, setFinishedDurationMs] = useState<number | null>(null);
  const attempt = useRef<string | null>(null);
  const immediateStartRequested = useRef(false);
  const layoutAttempt = useRef(0);
  const startedAt = useRef(0);
  const appActive = useQuestAppActive();
  const complete = game.matchedMotifIds.length >= config.pairCount;
  const failed =
    pack.completionRule === 'within_move_budget' &&
    !complete &&
    !game.locked &&
    game.moves >= config.moveBudget;
  const success =
    complete &&
    (pack.completionRule === 'find_all' || game.moves <= config.moveBudget);
  const ended = complete || failed;

  useEffect(() => {
    if (!started) setDeck(baseDeck);
  }, [baseDeck, started]);

  useEffect(() => {
    if (!started || ended) return;
    const update = () => setElapsedMs(Date.now() - startedAt.current);
    update();
    const timer = setInterval(update, 100);
    return () => clearInterval(timer);
  }, [ended, started]);

  useEffect(() => {
    if (!started || !ended || finishedDurationMs != null) return;
    const duration = Date.now() - startedAt.current;
    setElapsedMs(duration);
    setFinishedDurationMs(duration);
  }, [ended, finishedDurationMs, started]);

  useEffect(() => {
    if (!game.comparison) return;
    const matched = game.comparison.matched;
    if (process.env.EXPO_OS === 'ios') {
      void Haptics.notificationAsync(
        matched
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
      );
    }
    const timer = setTimeout(
      () => dispatch({ type: 'resolve_comparison' }),
      matched ? 430 : 760,
    );
    return () => clearTimeout(timer);
  }, [game.comparison]);

  useEffect(() => {
    if (!appActive && game.openCards.length > 0) dispatch({ type: 'hide_open' });
  }, [appActive, game.openCards.length]);

  const start = useCallback(() => {
    layoutAttempt.current += 1;
    setDeck((current) => shuffleMatchingDeck(
      current,
      `${seed}:layout:${Date.now()}:${layoutAttempt.current}:${Math.random()}`,
    ));
    attempt.current = onAttemptStart({
      ...config,
      packId,
      contentIds: [...new Set(deck.map((card) => card.motif.id))],
    });
    startedAt.current = Date.now();
    setElapsedMs(0);
    setFinishedDurationMs(null);
    setStarted(true);
    onRunningChange(true, attempt.current);
  }, [config, deck, onAttemptStart, onRunningChange, packId, seed]);

  useEffect(() => {
    if (!startImmediately || started || immediateStartRequested.current) return;
    immediateStartRequested.current = true;
    start();
  }, [start, startImmediately, started]);

  const reset = () => {
    if (attempt.current) onAttemptCancel(attempt.current);
    attempt.current = null;
    onRunningChange(false);
    setStarted(false);
    setElapsedMs(0);
    setFinishedDurationMs(null);
    dispatch({ type: 'reset' });
  };

  const choose = (cardId: string, motifId: string) => {
    if (!appActive || complete || failed) return;
    dispatch({ type: 'reveal', cardId, motifId });
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
  };

  if (!started) {
    if (startImmediately) return null;
    return (
        <QuestExperiencePreview
          eyebrow={pack.eyebrow}
          title={pack.title}
          body={pack.completionRule === 'find_all'
            ? `Find ${config.pairCount} matching ${theme === 'garden' ? 'plant' : 'food'} pairs. Take as many turns as you need.`
            : `Find ${config.pairCount} matching artefact pairs before the move counter runs out.`}
          media={<View style={styles.previewPair}>{baseDeck.slice(0, 2).map((card) => <View key={card.cardId} style={[styles.previewMiniCard, theme === 'garden' && styles.mossCardRevealed, theme === 'feast' && styles.feastCardRevealed]}><MotifVisual motif={card.motif} size={58} theme={theme} /></View>)}</View>}
          mediaLabel={`A pair of ${theme} matching cards`}
          meta={bestDurationMs != null ? `Local fastest · ${formatQuestDuration(bestDurationMs)}` : null}
          actionLabel={theme === 'garden' ? 'Enter the garden' : theme === 'feast' ? 'Match the feast' : 'Open the gallery'}
          onAction={start}
        />
    );
  }

  if (ended && attempt.current) {
    const duration = finishedDurationMs ?? Math.max(elapsedMs, Date.now() - startedAt.current);
    const newFastest = success && (bestDurationMs == null || duration < bestDurationMs);
    const completeAttempt = () =>
      success
        ? onComplete(attempt.current!, {
            kind: 'matching',
            success: true,
            pairs: config.pairCount,
            moves: game.moves,
            durationMs: duration,
            contentIds: game.matchedMotifIds,
            packId,
          })
        : reset();
    if (immersiveGarden) {
      return (
        <MossproutMemoryGardenScreen
          elapsed={formatQuestDuration(duration)}
          moves={game.moves}
          onClose={completeAttempt}
          onPrimary={completeAttempt}
          pairsFound={game.matchedMotifIds.length}
          pairCount={config.pairCount}
          primaryLabel="Return to Mossprout"
          result
          status="Every plant found its pair">
          <View accessibilityLiveRegion="polite" style={styles.gardenResultCard}>
            <View style={styles.gardenResultIcon}>
              <IconSymbol color="#476A35" name="leaf.fill" size={30} />
            </View>
            <ThemedText style={styles.gardenResultEyebrow} lightColor="#668348" darkColor="#668348">
              Garden complete
            </ThemedText>
            <ThemedText style={styles.gardenResultTitle} lightColor="#3D2D1D" darkColor="#3D2D1D">
              The garden remembers
            </ThemedText>
            <ThemedText style={styles.gardenResultBody} lightColor="#66533D" darkColor="#66533D">
              {`${game.matchedMotifIds.length} pairs found in ${game.moves} moves.`}
            </ThemedText>
            <ThemedText style={styles.gardenResultMetric} lightColor="#476A35" darkColor="#476A35">
              {formatQuestDuration(duration)}
            </ThemedText>
            {newFastest ? (
              <ThemedText style={styles.gardenBest} lightColor="#8A641F" darkColor="#8A641F">
                New local fastest time
              </ThemedText>
            ) : bestDurationMs != null ? (
              <ThemedText style={styles.gardenBest} lightColor="#8A641F" darkColor="#8A641F">
                {`Local fastest · ${formatQuestDuration(bestDurationMs)}`}
              </ThemedText>
            ) : null}
          </View>
        </MossproutMemoryGardenScreen>
      );
    }
    return (
      <ExperienceResult
        success={success}
        title={
          success
            ? theme === 'feast'
              ? 'Every bite found its pair'
              : 'Every relic reunited'
            : 'The gallery reshuffled'
        }
        body={`${game.matchedMotifIds.length} pairs found in ${game.moves} moves. ${newFastest ? 'New local fastest time.' : bestDurationMs != null ? `Local fastest: ${formatQuestDuration(bestDurationMs)}.` : ''}`}
        metric={formatQuestDuration(duration)}
        onRetry={reset}
        onComplete={completeAttempt}
      />
    );
  }

  const columns = config.pairCount === 6 ? 3 : 4;
  const rows = Math.ceil(deck.length / columns);
  const gap = config.pairCount >= 8 ? 7 : 9;
  const availableWidth = gridLayout.width || 340;
  const availableHeight = gridLayout.height || 420;
  const cardSize = Math.max(
    theme === 'garden' ? 46 : 54,
    Math.min(
      112,
      Math.floor(
      Math.min(
        (availableWidth - gap * (columns - 1)) / columns,
        (availableHeight - gap * (rows - 1)) / rows,
      ),
      ),
    ),
  );
  const gridWidth = cardSize * columns + gap * (columns - 1);
  const gridHeight = cardSize * rows + gap * (rows - 1);
  const statusMessage = game.comparison
    ? game.comparison.matched
      ? 'A pair found'
      : 'Remember their places'
    : game.openCards.length === 1
      ? 'Find its pair'
      : 'Pick two cards';

  if (immersiveGarden) {
    return (
      <MossproutMemoryGardenScreen
        elapsed={formatQuestDuration(elapsedMs)}
        moves={game.moves}
        onBoardLayout={(event) => setGridLayout({
          width: event.nativeEvent.layout.width,
          height: event.nativeEvent.layout.height,
        })}
        onClose={onRequestExit ?? reset}
        pairsFound={game.matchedMotifIds.length}
        pairCount={config.pairCount}
        status={statusMessage}>
        <View style={[styles.grid, { gap, height: gridHeight, width: gridWidth }]}>
          {deck.map((card) => {
            const visible =
              game.openCards.some((openCard) => openCard.cardId === card.cardId) ||
              game.matchedMotifIds.includes(card.motif.id);
            const matched =
              game.matchedMotifIds.includes(card.motif.id) ||
              (game.comparison?.matched === true && game.comparison.motifId === card.motif.id);
            return (
              <MemoryMatchCard
                key={card.cardId}
                cardBackLabel={pack.cardBackLabel}
                disabled={game.locked || matched}
                matched={matched}
                theme={theme}
                motif={card.motif}
                onPress={() => choose(card.cardId, card.motif.id)}
                size={cardSize}
                visible={visible}
              />
            );
          })}
        </View>
      </MossproutMemoryGardenScreen>
    );
  }

  return (
    <View style={experienceStyles.root}>
      <View style={styles.progressRow}>
        <ThemedText style={styles.progress} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
          {game.matchedMotifIds.length}/{config.pairCount} PAIRS
        </ThemedText>
        <ThemedText style={styles.progress} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
          {game.moves} {game.moves === 1 ? 'MOVE' : 'MOVES'}
        </ThemedText>
        <View accessibilityLabel={`Elapsed time ${formatQuestDuration(elapsedMs)}`} style={styles.timerPill}>
          <IconSymbol name="timer" size={13} color={Lantern.auroraTeal} />
          <ThemedText style={styles.timerText} lightColor={Lantern.auroraTeal} darkColor={Lantern.auroraTeal}>
            {formatQuestDuration(elapsedMs)}
          </ThemedText>
        </View>
      </View>

      <View
        accessibilityLabel={`${pack.eyebrow} memory match cards`}
        onLayout={(event) =>
          setGridLayout({
            width: event.nativeEvent.layout.width,
            height: event.nativeEvent.layout.height,
          })
        }
        style={styles.gridFrame}>
        <View
          style={[
            styles.grid,
            {
              gap,
              height: gridHeight,
              width: gridWidth,
            },
          ]}>
          {deck.map((card) => {
            const visible =
              game.openCards.some((openCard) => openCard.cardId === card.cardId) ||
              game.matchedMotifIds.includes(card.motif.id);
            const matched =
              game.matchedMotifIds.includes(card.motif.id) ||
              (game.comparison?.matched === true && game.comparison.motifId === card.motif.id);
            return (
              <MemoryMatchCard
                key={card.cardId}
                cardBackLabel={pack.cardBackLabel}
                disabled={game.locked || matched}
                matched={matched}
                theme={theme}
                motif={card.motif}
                onPress={() => choose(card.cardId, card.motif.id)}
                size={cardSize}
                visible={visible}
              />
            );
          })}
        </View>
      </View>

      <ThemedText
        accessibilityLiveRegion="polite"
        style={styles.status}
        lightColor={game.comparison?.matched ? Lantern.auroraTeal : Lantern.moon300}
        darkColor={game.comparison?.matched ? Lantern.auroraTeal : Lantern.moon300}>
        {game.comparison
          ? game.comparison.matched
            ? 'A pair is growing together'
            : 'Not this time — remember their places'
          : game.openCards.length === 1
            ? 'Now find its pair'
            : 'Turn over two cards'}
      </ThemedText>

      <ExperienceAction
        label={
          theme === 'feast'
            ? 'Leave the table'
            : 'Cancel gallery'
        }
        quiet
        onPress={reset}
      />
    </View>
  );
}

function MemoryMatchCard({
  motif,
  size,
  visible,
  matched,
  disabled,
  theme,
  cardBackLabel,
  onPress,
}: {
  motif: MatchingMotif;
  size: number;
  visible: boolean;
  matched: boolean;
  disabled: boolean;
  theme: MemoryMatchTheme;
  cardBackLabel: string;
  onPress: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const flip = useSharedValue(visible ? 1 : 0);
  const revealScale = useSharedValue(1);
  const matchScale = useSharedValue(1);
  const wasVisible = useRef(visible);
  const wasMatched = useRef(matched);

  useEffect(() => {
    flip.value = withTiming(visible ? 1 : 0, {
      duration: reduceMotion ? 100 : 260,
    });
  }, [flip, reduceMotion, visible]);

  useEffect(() => {
    const becomingVisible = visible && !wasVisible.current;
    wasVisible.current = visible;
    cancelAnimation(revealScale);
    if (reduceMotion || !becomingVisible) {
      revealScale.value = 1;
      return;
    }
    revealScale.value = 0.96;
    revealScale.value = withDelay(90, withSequence(
      withTiming(1.055, { duration: 145, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 175, easing: Easing.out(Easing.quad) }),
    ));
  }, [reduceMotion, revealScale, visible]);

  useEffect(() => {
    const becomingMatched = matched && !wasMatched.current;
    wasMatched.current = matched;
    cancelAnimation(matchScale);
    if (reduceMotion || !becomingMatched) {
      matchScale.value = 1;
      return;
    }
    matchScale.value = 1;
    matchScale.value = withDelay(80, withSequence(
      withTiming(1.11, { duration: 120, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 170, easing: Easing.inOut(Easing.quad) }),
    ));
  }, [matchScale, matched, reduceMotion]);

  const hiddenStyle = useAnimatedStyle(() => ({
    opacity: flip.value < 0.5 ? 1 : 0,
    transform: [
      { perspective: 700 },
      { rotateY: `${flip.value * 180}deg` },
      { scale: revealScale.value * matchScale.value },
    ],
  }));
  const revealedStyle = useAnimatedStyle(() => ({
    opacity: flip.value >= 0.5 ? 1 : 0,
    transform: [
      { perspective: 700 },
      { rotateY: `${(flip.value - 1) * 180}deg` },
      { scale: revealScale.value * matchScale.value },
    ],
  }));

  return (
    <Pressable
      accessibilityLabel={visible ? `${motif.accessibilityLabel}, revealed` : cardBackLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: visible }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { height: size, width: size },
        pressed && styles.cardPressed,
      ]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.cardFace,
          styles.cardBack,
          theme === 'garden' && styles.mossCardBack,
          theme === 'feast' && styles.feastCardBack,
          hiddenStyle,
        ]}>
        {theme === 'garden' ? (
          <LinearGradient
            colors={['#779C55', '#5F8646', '#486C38']}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        {theme === 'garden' ? <View style={styles.mossBackInset} /> : null}
        <View
          style={[
            styles.backHalo,
            theme === 'garden' && styles.mossBackHalo,
            theme === 'feast' && styles.feastBackHalo,
          ]}>
          <IconSymbol
            name={
              theme === 'garden'
                ? 'leaf.fill'
                : theme === 'feast'
                  ? 'fork.knife'
                  : 'diamond.fill'
            }
            size={Math.max(20, size * 0.3)}
            color={theme === 'garden' ? '#DDEB95' : Lantern.ember300}
          />
        </View>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.cardFace,
          styles.cardRevealed,
          theme === 'garden' && styles.mossCardRevealed,
          theme === 'feast' && styles.feastCardRevealed,
          matched && styles.cardMatched,
          revealedStyle,
        ]}>
        {theme === 'garden' ? (
          <LinearGradient
            colors={matched ? ['#D9DEA2', '#AEBB70', '#758B48'] : ['#E2CF99', '#BE9F64', '#8D7045']}
            end={{ x: 0.8, y: 1 }}
            locations={[0, 0.58, 1]}
            start={{ x: 0.2, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <MotifVisual motif={motif} size={size} theme={theme} />
        {theme !== 'garden' ? (
          <ThemedText
            adjustsFontSizeToFit
            minimumFontScale={0.72}
            numberOfLines={1}
            style={[styles.cardLabel, size < 72 && styles.cardLabelCompact]}
            lightColor={Lantern.moon50}
            darkColor={Lantern.moon50}>
            {motif.label}
          </ThemedText>
        ) : null}
        {matched ? (
          <View style={[styles.matchedBadge, theme === 'garden' && styles.gardenMatchedBadge]}>
            <IconSymbol name="checkmark" size={11} color={theme === 'garden' ? '#3F5F2F' : Lantern.ink950} />
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

function MotifVisual({
  motif,
  size,
  theme,
}: {
  motif: MatchingMotif;
  size: number;
  theme: MemoryMatchTheme;
}) {
  const visual = motif.visual;
  const visualSize = Math.max(26, Math.min(size * 0.62, 68));
  if (visual.kind === 'world_asset') {
    const source =
      worldAssetSource(visual.assetKey, 'thumb') ?? worldAssetSource(visual.assetKey, 'full');
    if (source) {
      return (
        <Image
          accessibilityIgnoresInvertColors
          contentFit="contain"
          source={source}
          style={{ height: visualSize, width: visualSize }}
          transition={100}
        />
      );
    }
  }
  if (visual.kind === 'local_image') {
    return (
      <Image
        accessibilityIgnoresInvertColors
        contentFit="cover"
        source={{ uri: visual.uri }}
        style={[styles.localImage, { height: visualSize, width: visualSize }]}
        transition={100}
      />
    );
  }
  if (visual.kind === 'emoji') {
    return (
      <ThemedText
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.emojiVisual,
          {
            fontSize: Math.max(27, Math.min(size * 0.5, 48)),
            lineHeight: Math.max(34, Math.min(size * 0.58, 56)),
          },
        ]}>
        {visual.emoji}
      </ThemedText>
    );
  }
  const symbol = visual.kind === 'icon' ? visual.symbol : 'leaf.fill';
  return (
    <IconSymbol
      name={symbol as never}
      size={visualSize * 0.72}
      color={theme === 'garden' ? Lantern.auroraTeal : Lantern.ember300}
    />
  );
}

const styles = StyleSheet.create({
  previewPair: { alignItems: 'center', flexDirection: 'row', gap: 5, justifyContent: 'center', transform: [{ rotate: '-4deg' }] },
  previewMiniCard: { alignItems: 'center', backgroundColor: '#2A2338', borderColor: 'rgba(255,248,232,0.22)', borderCurve: 'continuous', borderRadius: 10, borderWidth: 1, height: 62, justifyContent: 'center', width: 46 },
  progressRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  progress: {
    fontSize: 11.5,
    fontVariant: ['tabular-nums'],
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  timerPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(125,232,205,0.1)',
    borderColor: 'rgba(125,232,205,0.26)',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    minWidth: 72,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  timerText: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    fontWeight: '900',
  },
  bestTime: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    fontWeight: '900',
    letterSpacing: 0.7,
    textAlign: 'center',
  },
  gridFrame: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 0,
    width: '100%',
  },
  grid: {
    alignContent: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  card: {
    borderCurve: 'continuous',
    borderRadius: 16,
  },
  cardPressed: {
    transform: [{ scale: 0.97 }],
  },
  cardFace: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backfaceVisibility: 'hidden',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardBack: {
    backgroundColor: Lantern.ink800,
    borderColor: 'rgba(255,195,107,0.24)',
  },
  mossCardBack: {
    backgroundColor: '#5F8646',
    borderColor: '#E4C879',
    borderWidth: 2,
    boxShadow: '0 5px 10px rgba(9, 28, 12, 0.42), inset 0 1px 0 rgba(255, 247, 195, 0.58)',
  },
  mossBackInset: {
    ...StyleSheet.absoluteFillObject,
    borderColor: 'rgba(255, 241, 173, 0.3)',
    borderCurve: 'continuous',
    borderRadius: 12,
    borderWidth: 1,
    margin: 3,
  },
  feastCardBack: {
    backgroundColor: '#2B1D19',
    borderColor: 'rgba(255,195,107,0.34)',
  },
  backHalo: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,195,107,0.08)',
    borderRadius: 999,
    height: '58%',
    justifyContent: 'center',
    width: '58%',
  },
  mossBackHalo: {
    backgroundColor: 'rgba(48, 91, 43, 0.72)',
    borderColor: 'rgba(230, 217, 126, 0.42)',
    borderWidth: 1,
    boxShadow: '0 3px 7px rgba(23, 50, 24, 0.34), inset 0 1px 0 rgba(255,255,255,0.14)',
  },
  feastBackHalo: {
    backgroundColor: 'rgba(255,195,107,0.12)',
  },
  cardRevealed: {
    backgroundColor: Lantern.ink900,
    borderColor: 'rgba(255,195,107,0.38)',
    gap: 2,
    padding: 5,
  },
  mossCardRevealed: {
    backgroundColor: '#FFF8E4',
    borderColor: '#D9BA70',
    borderWidth: 2,
    boxShadow: '0 5px 10px rgba(9, 28, 12, 0.36), inset 0 1px 0 rgba(255,255,255,0.74)',
  },
  feastCardRevealed: {
    backgroundColor: '#2A2019',
    borderColor: 'rgba(255,195,107,0.46)',
  },
  cardMatched: {
    backgroundColor: '#EDF3C8',
    borderColor: '#B8DA65',
    boxShadow: '0 0 13px rgba(190, 237, 91, 0.82), 0 5px 10px rgba(9, 28, 12, 0.36), inset 0 1px 0 rgba(255,255,255,0.8)',
  },
  cardLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    maxWidth: '100%',
    textAlign: 'center',
  },
  cardLabelCompact: {
    fontSize: 8.5,
  },
  matchedBadge: {
    alignItems: 'center',
    backgroundColor: Lantern.auroraTeal,
    borderRadius: 999,
    height: 17,
    justifyContent: 'center',
    position: 'absolute',
    right: 4,
    top: 4,
    width: 17,
  },
  gardenMatchedBadge: {
    backgroundColor: '#F5EDB8',
    borderColor: '#7DA343',
    borderWidth: 1,
  },
  localImage: {
    borderRadius: 10,
  },
  emojiVisual: {
    includeFontPadding: false,
    textAlign: 'center',
  },
  status: {
    fontSize: 12.5,
    fontWeight: '800',
    minHeight: 18,
    textAlign: 'center',
  },
  gardenResultCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 246, 220, 0.97)',
    borderColor: 'rgba(143, 106, 50, 0.58)',
    borderCurve: 'continuous',
    borderRadius: 28,
    borderWidth: 1,
    boxShadow: '0 12px 28px rgba(8, 24, 12, 0.38), inset 0 1px 0 rgba(255,255,255,0.86)',
    gap: 7,
    maxWidth: 390,
    paddingHorizontal: 28,
    paddingVertical: 25,
    width: '100%',
  },
  gardenResultIcon: {
    alignItems: 'center',
    backgroundColor: '#E6EDB9',
    borderColor: '#A6BD66',
    borderRadius: 18,
    borderWidth: 1,
    height: 58,
    justifyContent: 'center',
    marginBottom: 3,
    width: 58,
  },
  gardenResultEyebrow: { fontSize: 10.5, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  gardenResultTitle: { fontSize: 27, fontWeight: '900', lineHeight: 32, textAlign: 'center' },
  gardenResultBody: { fontSize: 13.5, lineHeight: 20, textAlign: 'center' },
  gardenResultMetric: { fontSize: 38, fontVariant: ['tabular-nums'], fontWeight: '900', lineHeight: 45, paddingTop: 3 },
  gardenBest: { fontSize: 11, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase' },
});
