import * as Haptics from 'expo-haptics';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Lantern } from '@/constants/theme';
import {
  createSortingRound,
  sortingPack,
  type SortingCategory,
  type SortingPackId,
} from '@/utils/quests/experiences/sorting';
import { formatQuestDuration } from '@/utils/quests/experiences/duration';
import type { QuestResult } from '@/utils/quests/experiences/types';

import {
  ExperienceAction,
  ExperienceResult,
  QuestExperiencePreview,
  experienceStyles,
} from './quest-experience-ui';

type Config = { itemCount: number; targetCorrect: number; tier: number };
type Props = {
  config: Config;
  packId: SortingPackId;
  seed: string;
  recentIds: string[];
  bestDurationMs?: number | null;
  onAttemptStart: (config: Record<string, unknown>) => string;
  onAttemptCancel: (id: string) => void;
  onComplete: (id: string, result: QuestResult) => void;
  onRunningChange: (running: boolean, id?: string | null) => void;
};

const CATEGORY_PRESENTATION: Record<
  SortingCategory,
  { label: string; icon: IconSymbolName; travel: { x: number; y: number } }
> = {
  food: { label: 'Food', icon: 'fork.knife', travel: { x: -112, y: 205 } },
  drink: { label: 'Drink', icon: 'cup.and.saucer.fill', travel: { x: 0, y: 205 } },
  tableware: { label: 'Tableware', icon: 'circle.fill', travel: { x: 112, y: 205 } },
  quick: { label: 'Quick', icon: 'bolt.fill', travel: { x: -82, y: 175 } },
  focus: { label: 'Focus', icon: 'scope', travel: { x: 82, y: 175 } },
  scheduled: { label: 'Scheduled', icon: 'calendar', travel: { x: -82, y: 250 } },
  waiting: { label: 'Waiting', icon: 'timer', travel: { x: 82, y: 250 } },
  admin: { label: 'Admin', icon: 'calendar', travel: { x: -112, y: 205 } },
  home: { label: 'Home', icon: 'house.fill', travel: { x: 0, y: 205 } },
  out: { label: 'Out', icon: 'cart.fill', travel: { x: 112, y: 205 } },
};

const EMPTY_COUNTS: Record<SortingCategory, number> = {
  food: 0,
  drink: 0,
  tableware: 0,
  quick: 0,
  focus: 0,
  scheduled: 0,
  waiting: 0,
  admin: 0,
  home: 0,
  out: 0,
};

const PACK_COPY: Record<SortingPackId, {
  eyebrow: string;
  title: string;
  body: string;
  start: string;
  successTitle: string;
  retryTitle: string;
  finished: string;
}> = {
  'feastle-table': {
    eyebrow: 'FEASTLE',
    title: 'Set Feastle’s table',
    body: 'Sort each object into Food, Drink or Tableware.',
    start: 'Start sorting',
    successTitle: 'The table is ready',
    retryTitle: 'A few things were misplaced',
    finished: 'Table sorted',
  },
  'tasklet-triage': {
    eyebrow: 'TASKLET',
    title: 'Clear Tasklet’s desk',
    body: 'Sort each note by what the task needs next.',
    start: 'Tidy the inbox',
    successTitle: 'Everything has its place',
    retryTitle: 'A few notes are still shuffling',
    finished: 'Inbox cleared',
  },
  'errandimp-loops': {
    eyebrow: 'ERRANDIMP',
    title: 'Clear the loose loops',
    body: 'Sort each practical task into Admin, Home or Out.',
    start: 'Start the errand sweep',
    successTitle: 'The loose ends are lined up',
    retryTitle: 'A few errands escaped',
    finished: 'Loops sorted',
  },
};

export function SortingQuest({
  config,
  packId,
  seed,
  recentIds,
  bestDurationMs = null,
  onAttemptStart,
  onAttemptCancel,
  onComplete,
  onRunningChange,
}: Props) {
  const pack = sortingPack(packId);
  const categories = useMemo(() => pack.categoriesForTier(config.tier), [config.tier, pack]);
  const copy = PACK_COPY[packId];
  const isTasklet = packId === 'tasklet-triage';
  const items = useMemo(
    () => createSortingRound(seed, config.itemCount, recentIds, packId, config.tier),
    [config.itemCount, config.tier, packId, recentIds, seed],
  );
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [firstTry, setFirstTry] = useState(true);
  const [animating, setAnimating] = useState(false);
  const [stageWidth, setStageWidth] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [finishedDurationMs, setFinishedDurationMs] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{
    category: SortingCategory;
    correct: boolean;
  } | null>(null);
  const [sortedCounts, setSortedCounts] =
    useState<Record<SortingCategory, number>>(EMPTY_COUNTS);
  const attempt = useRef<string | null>(null);
  const startedAt = useRef(0);
  const drag = useRef(new Animated.ValueXY()).current;
  const queueX = useRef(new Animated.Value(0)).current;
  const flight = useRef(new Animated.ValueXY()).current;
  const flightOpacity = useRef(new Animated.Value(0)).current;
  const flightScale = useRef(new Animated.Value(1)).current;
  const binPulses = useRef<Record<SortingCategory, Animated.Value>>({
    food: new Animated.Value(0),
    drink: new Animated.Value(0),
    tableware: new Animated.Value(0),
    quick: new Animated.Value(0),
    focus: new Animated.Value(0),
    scheduled: new Animated.Value(0),
    waiting: new Animated.Value(0),
    admin: new Animated.Value(0),
    home: new Animated.Value(0),
    out: new Animated.Value(0),
  }).current;
  const reduceMotion = useReducedMotion();
  const item = items[index];
  const nextItem = items[index + 1];
  const complete = index >= items.length;
  const success = complete && correct >= config.targetCorrect;

  useLayoutEffect(() => {
    queueX.setValue(0);
  }, [index, queueX]);

  useEffect(() => {
    if (!started || complete) return;
    const update = () => setElapsedMs(Date.now() - startedAt.current);
    update();
    const timer = setInterval(update, 100);
    return () => clearInterval(timer);
  }, [complete, started]);

  const start = () => {
    attempt.current = onAttemptStart({
      ...config,
      itemIds: items.map((value) => value.id),
    });
    startedAt.current = Date.now();
    setElapsedMs(0);
    setFinishedDurationMs(null);
    setStarted(true);
    onRunningChange(true, attempt.current);
  };

  const resetItemAnimation = () => {
    drag.stopAnimation();
    flight.stopAnimation();
    flightOpacity.stopAnimation();
    flightScale.stopAnimation();
    drag.setValue({ x: 0, y: 0 });
    flight.setValue({ x: 0, y: 0 });
    flightOpacity.setValue(0);
    flightScale.setValue(1);
  };

  const reset = () => {
    if (attempt.current) onAttemptCancel(attempt.current);
    onRunningChange(false);
    resetItemAnimation();
    queueX.stopAnimation();
    queueX.setValue(0);
    categories.forEach((category) => binPulses[category].setValue(0));
    setStarted(false);
    setIndex(0);
    setCorrect(0);
    setMistakes(0);
    setFirstTry(true);
    setAnimating(false);
    setFeedback(null);
    setSortedCounts(EMPTY_COUNTS);
    setElapsedMs(0);
    setFinishedDurationMs(null);
  };

  const pulseBin = (category: SortingCategory, isCorrect: boolean) => {
    setFeedback({ category, correct: isCorrect });
    const pulse = binPulses[category];
    pulse.stopAnimation();
    pulse.setValue(0);
    Animated.sequence([
      Animated.timing(pulse, {
        duration: reduceMotion ? 80 : 150,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(pulse, {
        duration: reduceMotion ? 100 : 300,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start(() => setFeedback(null));
  };

  const returnWithShake = () => {
    Animated.sequence([
      Animated.spring(drag, {
        damping: 16,
        stiffness: 220,
        toValue: { x: 0, y: 0 },
        useNativeDriver: true,
      }),
      Animated.timing(drag, {
        duration: reduceMotion ? 0 : 55,
        toValue: { x: -10, y: 0 },
        useNativeDriver: true,
      }),
      Animated.timing(drag, {
        duration: reduceMotion ? 0 : 90,
        toValue: { x: 10, y: 0 },
        useNativeDriver: true,
      }),
      Animated.timing(drag, {
        duration: reduceMotion ? 0 : 55,
        toValue: { x: 0, y: 0 },
        useNativeDriver: true,
      }),
    ]).start();
  };

  const choose = (category: SortingCategory, origin = { x: 0, y: 0 }) => {
    if (!item || animating) return;

    if (category !== item.category) {
      setMistakes((value) => value + 1);
      setFirstTry(false);
      pulseBin(category, false);
      returnWithShake();
      if (process.env.EXPO_OS === 'ios') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      return;
    }

    const wasFirstTry = firstTry;
    const finishingRound = index + 1 >= items.length;
    setAnimating(true);
    drag.setValue({ x: 0, y: 0 });
    flight.setValue(origin);
    flightOpacity.setValue(1);
    flightScale.setValue(1);
    pulseBin(category, true);
    if (process.env.EXPO_OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    Animated.parallel([
      Animated.timing(queueX, {
        duration: reduceMotion ? 120 : 360,
        toValue: -(stageWidth || 260),
        useNativeDriver: true,
      }),
      Animated.timing(flight, {
        duration: reduceMotion ? 120 : 420,
        toValue: {
          x: reduceMotion ? 0 : CATEGORY_PRESENTATION[category].travel.x,
          y: reduceMotion ? 24 : CATEGORY_PRESENTATION[category].travel.y,
        },
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(flightScale, {
          duration: reduceMotion ? 60 : 170,
          toValue: reduceMotion ? 1 : 1.08,
          useNativeDriver: true,
        }),
        Animated.timing(flightScale, {
          duration: reduceMotion ? 60 : 250,
          toValue: 0.42,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(reduceMotion ? 60 : 230),
        Animated.timing(flightOpacity, {
          duration: reduceMotion ? 60 : 190,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    ]).start(({ finished }) => {
      if (!finished) return;
      if (wasFirstTry) setCorrect((value) => value + 1);
      setSortedCounts((value) => ({ ...value, [category]: value[category] + 1 }));
      setFirstTry(true);
      if (finishingRound) {
        const duration = Date.now() - startedAt.current;
        setElapsedMs(duration);
        setFinishedDurationMs(duration);
      }
      resetItemAnimation();
      setIndex((value) => value + 1);
      setAnimating(false);
      if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    });
  };

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) =>
      !animating && (Math.abs(gesture.dx) > 8 || Math.abs(gesture.dy) > 8),
    onPanResponderMove: Animated.event([null, { dx: drag.x, dy: drag.y }], {
      useNativeDriver: false,
    }),
    onPanResponderRelease: (_, gesture) => {
      if (isTasklet) {
        const taskCategory = categories.length === 2
            ? (gesture.dx < 0 ? 'quick' : 'focus')
          : categories.length === 3
            ? (gesture.dy > 45 ? 'scheduled' : gesture.dx < 0 ? 'quick' : 'focus')
            : gesture.dy > 45
              ? (gesture.dx < 0 ? 'scheduled' : 'waiting')
              : (gesture.dx < 0 ? 'quick' : 'focus');
        choose(taskCategory, { x: gesture.dx, y: gesture.dy });
        return;
      }
      choose(
        gesture.dx < -55 ? 'food' : gesture.dx > 55 ? 'tableware' : 'drink',
        { x: gesture.dx, y: gesture.dy },
      );
    },
    onPanResponderTerminate: () =>
      Animated.spring(drag, {
        toValue: { x: 0, y: 0 },
        useNativeDriver: true,
      }).start(),
  });

  if (!started) {
    return (
        <QuestExperiencePreview
          eyebrow={copy.eyebrow}
          title={copy.title}
          body={copy.body}
          icon={packId === 'feastle-table' ? 'fork.knife' : packId === 'errandimp-loops' ? 'cart.fill' : 'circle.grid.2x2.fill'}
          meta={bestDurationMs != null ? `Local fastest · ${formatQuestDuration(bestDurationMs)}` : null}
          actionLabel={copy.start}
          onAction={start}
        />
    );
  }

  if (complete && attempt.current) {
    const duration = finishedDurationMs ?? elapsedMs;
    const newFastest = success && (bestDurationMs == null || duration < bestDurationMs);
    return (
      <ExperienceResult
        success={success}
        title={success ? copy.successTitle : copy.retryTitle}
        body={`${correct} of ${items.length} sorted correctly first time. ${newFastest ? 'New local fastest time.' : bestDurationMs != null ? `Local fastest: ${formatQuestDuration(bestDurationMs)}.` : ''}`}
        metric={formatQuestDuration(duration)}
        onRetry={reset}
        onComplete={() =>
          success
            ? onComplete(attempt.current!, {
                kind: 'sorting',
                success: true,
                correctFirstPlacements: correct,
                totalItems: items.length,
                mistakes,
                durationMs: duration,
                itemIds: items.map((value) => value.id),
                packId,
              })
            : reset()
        }
      />
    );
  }

  const itemRotation = drag.x.interpolate({
    inputRange: [-160, 0, 160],
    outputRange: ['-6deg', '0deg', '6deg'],
    extrapolate: 'clamp',
  });
  const flightRotation = flight.x.interpolate({
    inputRange: [-160, 0, 160],
    outputRange: ['-8deg', '0deg', '8deg'],
    extrapolate: 'clamp',
  });

  return (
    <View style={experienceStyles.root}>
      <View style={styles.progressRow}>
        <ThemedText style={styles.progress} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
          {index + 1} OF {items.length} · {correct} FIRST TRY
        </ThemedText>
        <View style={styles.timerPill}>
          <IconSymbol name="timer" size={13} color={Lantern.auroraTeal} />
          <ThemedText style={styles.timerText} lightColor={Lantern.auroraTeal} darkColor={Lantern.auroraTeal}>
            {formatQuestDuration(elapsedMs)}
          </ThemedText>
        </View>
      </View>

      <View style={[experienceStyles.card, styles.itemCard]}>
        <View
          onLayout={(event) => setStageWidth(event.nativeEvent.layout.width)}
          style={styles.itemViewport}>
          <Animated.View
            style={[
              styles.queueTrack,
              { transform: [{ translateX: queueX }] },
            ]}>
            <View style={[styles.itemSlide, { width: stageWidth || '100%' }]}>
              <Animated.View
                accessibilityHint={isTasklet ? 'Drag toward a task tray, or tap a destination.' : 'Drag left for Food, keep centred for Drink, or drag right for Tableware. You can also tap a destination.'}
                accessibilityState={{ disabled: animating }}
                {...panResponder.panHandlers}
                style={[
                  styles.itemContent,
                  { transform: [...drag.getTranslateTransform(), { rotate: itemRotation }] },
                ]}>
                <View style={styles.itemIconHalo}>
                  <IconSymbol name={item.symbol as never} size={54} color={Lantern.ember300} />
                </View>
                <ThemedText selectable style={[styles.item, isTasklet && styles.taskItem]} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                  {item.label}
                </ThemedText>
              </Animated.View>
            </View>

            <View style={[styles.itemSlide, { width: stageWidth || '100%' }]}>
              {nextItem ? (
                <View pointerEvents="none" style={[styles.itemContent, styles.nextItemContent]}>
                  <View style={[styles.itemIconHalo, styles.nextItemIconHalo]}>
                    <IconSymbol name={nextItem.symbol as never} size={50} color={Lantern.ember300} />
                  </View>
                  <ThemedText style={[styles.item, isTasklet && styles.taskItem]} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                    {nextItem.label}
                  </ThemedText>
                </View>
              ) : (
                <View style={styles.finishedSlide}>
                  <IconSymbol name="checkmark" size={34} color={Lantern.auroraTeal} />
                  <ThemedText style={styles.finishedSlideText} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
                    {copy.finished}
                  </ThemedText>
                </View>
              )}
            </View>
          </Animated.View>
        </View>

        {animating ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.flightCopy,
              {
                opacity: flightOpacity,
                transform: [
                  ...flight.getTranslateTransform(),
                  { rotate: flightRotation },
                  { scale: flightScale },
                ],
              },
            ]}>
            <View style={styles.flightIconHalo}>
              <IconSymbol name={item.symbol as never} size={34} color={Lantern.ember300} />
            </View>
            <ThemedText numberOfLines={1} style={styles.flightLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
              {item.label}
            </ThemedText>
          </Animated.View>
        ) : null}

        {animating ? (
          <ThemedText style={experienceStyles.help} lightColor={Lantern.auroraTeal} darkColor={Lantern.auroraTeal}>
            Next item coming in…
          </ThemedText>
        ) : !firstTry ? (
          <ThemedText style={experienceStyles.help} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
            Try another place
          </ThemedText>
        ) : (
          <ThemedText style={experienceStyles.help} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
            Drag it or tap a place
          </ThemedText>
        )}
      </View>

      <View style={[styles.bins, isTasklet && styles.taskBins]}>
        {categories.map((category) => {
          const presentation = CATEGORY_PRESENTATION[category];
          const pulse = binPulses[category];
          const activeFeedback = feedback?.category === category;
          return (
            <Pressable
              key={category}
              accessibilityRole="button"
              accessibilityLabel={`Sort ${item.label} as ${category}. ${sortedCounts[category]} sorted here.`}
              disabled={animating}
              onPress={() => choose(category)}
              style={({ pressed }) => [styles.bin, isTasklet && styles.taskBin, pressed && styles.pressed]}>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.binPulse,
                  {
                    backgroundColor:
                      activeFeedback && feedback.correct
                        ? 'rgba(125,232,205,0.24)'
                        : 'rgba(255,195,107,0.2)',
                    opacity: pulse,
                    transform: [
                      {
                        scale: pulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.82, 1.08],
                        }),
                      },
                    ],
                  },
                ]}
              />
              <IconSymbol
                name={presentation.icon}
                size={22}
                color={activeFeedback && feedback.correct ? Lantern.auroraTeal : Lantern.moon300}
              />
              <ThemedText style={styles.binText} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                {presentation.label}
              </ThemedText>
              <Animated.View
                style={[
                  styles.counter,
                  {
                    transform: [
                      {
                        scale: pulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.18],
                        }),
                      },
                    ],
                  },
                ]}>
                <ThemedText
                  style={styles.counterNumber}
                  lightColor={Lantern.auroraTeal}
                  darkColor={Lantern.auroraTeal}>
                  {sortedCounts[category]}
                </ThemedText>
                <ThemedText style={styles.counterLabel} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                  sorted
                </ThemedText>
              </Animated.View>
            </Pressable>
          );
        })}
      </View>

      <ExperienceAction label="Cancel sorting" quiet onPress={reset} />
    </View>
  );
}

const styles = StyleSheet.create({
  progressRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  progress: {
    fontSize: 11.5,
    fontVariant: ['tabular-nums'],
    fontWeight: '900',
    letterSpacing: 0.8,
    flex: 1,
    textAlign: 'left',
  },
  timerPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(125,232,205,0.08)',
    borderColor: 'rgba(125,232,205,0.2)',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    minWidth: 68,
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
  itemCard: {
    flex: 1,
    maxHeight: 248,
    overflow: 'visible',
    paddingHorizontal: 0,
    paddingVertical: 16,
    zIndex: 4,
  },
  itemViewport: {
    flex: 1,
    overflow: 'hidden',
    width: '100%',
  },
  queueTrack: {
    flexDirection: 'row',
    height: '100%',
  },
  itemSlide: {
    alignItems: 'center',
    flexShrink: 0,
    justifyContent: 'center',
  },
  itemContent: {
    alignItems: 'center',
    gap: 12,
  },
  nextItemContent: {
    opacity: 0.82,
  },
  nextItemIconHalo: {
    transform: [{ scale: 0.94 }],
  },
  finishedSlide: {
    alignItems: 'center',
    gap: 10,
  },
  finishedSlideText: {
    fontSize: 17,
    fontWeight: '800',
  },
  itemIconHalo: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,195,107,0.08)',
    borderColor: 'rgba(255,195,107,0.18)',
    borderRadius: 26,
    borderWidth: 1,
    height: 82,
    justifyContent: 'center',
    width: 82,
  },
  item: {
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 40,
    textAlign: 'center',
  },
  taskItem: {
    fontSize: 23,
    lineHeight: 29,
    maxWidth: 270,
  },
  flightCopy: {
    alignItems: 'center',
    backgroundColor: Lantern.ink800,
    borderColor: 'rgba(255,195,107,0.28)',
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    left: '50%',
    marginLeft: -93,
    marginTop: -31,
    minHeight: 62,
    paddingHorizontal: 11,
    position: 'absolute',
    top: '50%',
    width: 186,
    zIndex: 8,
  },
  flightIconHalo: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,195,107,0.09)',
    borderRadius: 14,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  flightLabel: {
    flex: 1,
    fontSize: 17,
    fontWeight: '900',
  },
  bins: {
    flexDirection: 'row',
    gap: 8,
    zIndex: 1,
  },
  taskBins: {
    flexWrap: 'wrap',
  },
  bin: {
    alignItems: 'center',
    backgroundColor: Lantern.dusk700,
    borderColor: 'rgba(201,194,232,0.18)',
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    gap: 5,
    justifyContent: 'center',
    minHeight: 112,
    overflow: 'hidden',
    paddingHorizontal: 5,
    paddingVertical: 10,
  },
  taskBin: {
    flexBasis: '47%',
    minHeight: 82,
  },
  binPulse: {
    borderRadius: 20,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  binText: {
    fontSize: 12.5,
    fontWeight: '900',
    textAlign: 'center',
  },
  counter: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 3,
  },
  counterNumber: {
    fontSize: 18,
    fontVariant: ['tabular-nums'],
    fontWeight: '900',
  },
  counterLabel: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  pressed: {
    backgroundColor: 'rgba(255,195,107,0.12)',
    transform: [{ scale: 0.98 }],
  },
});
