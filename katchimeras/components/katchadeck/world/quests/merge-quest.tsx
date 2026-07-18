import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { AnimatedBorderHighlight } from '@/components/katchadeck/ui/animated-border-highlight';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { KatchaSurfaceProvider } from '@/components/katchadeck/ui/katcha-surface';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Lantern } from '@/constants/theme';
import { FEASTLE_MERGE_ART } from '@/constants/feastle-merge-art';
import {
  canMergeItems,
  createMergeRound,
  mergeBoardCellFromPoint,
  MERGE_BOARD_COLUMNS,
  MERGE_BOARD_ROWS,
  mergeItemDefinition,
  mergeRoundReducer,
  readyOrderForItem,
  selectPantrySpawnCell,
  type MergeBoardItem,
  type MergePackId,
  type MergeRoundConfig,
  type MergeRoundState,
} from '@/utils/quests/experiences/merge';
import { formatQuestDuration } from '@/utils/quests/experiences/duration';
import type { QuestResult } from '@/utils/quests/experiences/types';

import { QuestExperiencePreview } from './quest-experience-ui';
import { FeastleMergeFeastScreen } from './feastle-merge-feast-screen';

type Props = {
  config: MergeRoundConfig;
  packId: MergePackId;
  seed: string;
  recentOrderIds: string[];
  best?: { movesUsed: number; durationMs: number } | null;
  onAttemptStart: (config: Record<string, unknown>) => string;
  onAttemptCancel: (id: string) => void;
  onComplete: (id: string, result: QuestResult) => void;
  onRequestExit?: () => void;
  onRunningChange: (running: boolean, id?: string | null) => void;
};

type MergeFlight = {
  id: number;
  item: MergeBoardItem;
  kind: 'move' | 'merge' | 'serve';
  from: number;
  to: number | null;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

const CHAIN_STYLE: Record<string, { color: string }> = {
  pasta: { color: '#E8B76A' },
  stew: { color: '#D98763' },
  dessert: { color: '#D99B91' },
};

export function MergeQuest({ config, packId, seed, recentOrderIds, best = null, onAttemptStart, onAttemptCancel, onComplete, onRequestExit, onRunningChange }: Props) {
  const { width, height } = useWindowDimensions();
  const compact = height < 740;
  const gap = compact ? 4 : 5;
  const boardPadding = compact ? 5 : 7;
  const boardBorder = 2;
  const maxBoardWidth = Math.min(width - 28, 540);
  const maxBoardHeight = Math.min(maxBoardWidth, Math.max(246, height - (compact ? 350 : 390)));
  const cellSize = Math.floor(Math.min(
    (maxBoardWidth - (boardPadding + boardBorder) * 2 - gap * (MERGE_BOARD_COLUMNS - 1)) / MERGE_BOARD_COLUMNS,
    (maxBoardHeight - (boardPadding + boardBorder) * 2 - gap * (MERGE_BOARD_ROWS - 1)) / MERGE_BOARD_ROWS,
  ));
  const boardWidth = cellSize * MERGE_BOARD_COLUMNS + gap * (MERGE_BOARD_COLUMNS - 1) + (boardPadding + boardBorder) * 2;
  const boardHeight = cellSize * MERGE_BOARD_ROWS + gap * (MERGE_BOARD_ROWS - 1) + (boardPadding + boardBorder) * 2;
  const reduceMotion = useReducedMotion();
  const initialRound = useMemo(() => createMergeRound(seed, config, recentOrderIds), [config, recentOrderIds, seed]);
  const [state, setState] = useState(initialRound);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [started, setStarted] = useState(false);
  const [mergedCell, setMergedCell] = useState<number | null>(null);
  const [spawnedCell, setSpawnedCell] = useState<number | null>(null);
  const [invalidCell, setInvalidCell] = useState<number | null>(null);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [draggingCell, setDraggingCell] = useState<number | null>(null);
  const [hoveredCell, setHoveredCell] = useState<number | null>(null);
  const [flights, setFlights] = useState<MergeFlight[]>([]);
  const attempt = useRef<string | null>(null);
  const startedAt = useRef(0);
  const finishedAt = useRef<number | null>(null);
  const boardRef = useRef<View>(null);
  const boardFrame = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const boardX = useSharedValue(0);
  const boardY = useSharedValue(0);
  const boardMeasuredWidth = useSharedValue(boardWidth);
  const boardMeasuredHeight = useSharedValue(boardHeight);
  const flightId = useRef(0);
  const spawnAnimationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (spawnAnimationTimer.current) clearTimeout(spawnAnimationTimer.current);
  }, []);

  const measureBoard = () => {
    boardRef.current?.measureInWindow((x, y, measuredWidth, measuredHeight) => {
      boardFrame.current = { x, y, width: measuredWidth, height: measuredHeight };
      boardX.value = x;
      boardY.value = y;
      boardMeasuredWidth.value = measuredWidth;
      boardMeasuredHeight.value = measuredHeight;
    });
  };

  const haptic = useCallback((kind: 'pick' | 'move' | 'merge' | 'warning' | 'serve') => {
    if (process.env.EXPO_OS !== 'ios') return;
    if (kind === 'pick') void Haptics.selectionAsync();
    else if (kind === 'move') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else if (kind === 'merge') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    else if (kind === 'warning') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    else void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const announce = useCallback((message: string) => { void AccessibilityInfo.announceForAccessibility(message); }, []);

  const commit = useCallback((next: MergeRoundState, message?: string) => {
    if (next.status !== 'playing' && stateRef.current.status === 'playing') finishedAt.current = Date.now();
    setState(next);
    if (message) announce(message);
  }, [announce]);

  const start = () => {
    attempt.current = onAttemptStart({ ...config, packId, orderIds: initialRound.orders.map((order) => order.targetId) });
    startedAt.current = Date.now();
    finishedAt.current = null;
    setStarted(true);
    onRunningChange(true, attempt.current);
  };

  const reset = () => {
    if (attempt.current) onAttemptCancel(attempt.current);
    attempt.current = null;
    setState(createMergeRound(seed, config, recentOrderIds));
    setStarted(false);
    setMergedCell(null);
    setSpawnedCell(null);
    if (spawnAnimationTimer.current) clearTimeout(spawnAnimationTimer.current);
    setInvalidCell(null);
    setSelectedCell(null);
    setDraggingCell(null);
    setHoveredCell(null);
    setFlights([]);
    onRunningChange(false);
  };

  const spawn = () => {
    const nextPantryItem = state.pantry[0];
    const cell = selectPantrySpawnCell(
      state.board,
      `${seed}:pantry-cell:${nextPantryItem?.instanceId ?? 'empty'}:${state.movesUsed}`,
    );
    if (cell < 0 || !state.pantry.length || state.movesUsed >= config.moveBudget) {
      haptic('warning');
      announce(cell < 0 ? 'The board is full. Merge matching items to make room.' : 'No pantry draws remain.');
      return;
    }
    const next = mergeRoundReducer(state, { type: 'spawn', cell }, config.moveBudget);
    setSpawnedCell(cell);
    if (spawnAnimationTimer.current) clearTimeout(spawnAnimationTimer.current);
    spawnAnimationTimer.current = setTimeout(() => {
      setSpawnedCell((current) => current === cell ? null : current);
      spawnAnimationTimer.current = null;
    }, reduceMotion ? 100 : 430);
    haptic('move');
    commit(next, `${mergeItemDefinition(next.board[cell]!.definitionId).name} added. ${config.moveBudget - next.movesUsed} actions left.`);
  };

  const serve = useCallback((cell: number, orderId: string) => {
    const current = stateRef.current;
    const item = current.board[cell];
    if (!item) return;
    const name = mergeItemDefinition(item.definitionId).name;
    const next = mergeRoundReducer(current, { type: 'serve', cell, orderId }, config.moveBudget);
    if (next === current) return;
    haptic('serve');
    commit(next, `${name} served. ${next.orders.filter((order) => order.completed).length} of ${next.orders.length} orders complete.`);
  }, [commit, config.moveBudget, haptic]);

  const dragOver = useCallback((cell: number | null) => {
    setHoveredCell((current) => current === cell ? current : cell);
  }, []);

  const finishDrag = useCallback(() => {
    setDraggingCell(null);
    setHoveredCell(null);
  }, []);

  const lockedCells = useMemo(() => {
    const cells = new Set<number>();
    flights.forEach((flight) => {
      cells.add(flight.from);
      if (flight.to != null) cells.add(flight.to);
    });
    return cells;
  }, [flights]);
  const lockedCellsRef = useRef(lockedCells);
  lockedCellsRef.current = lockedCells;

  const addFlight = useCallback((item: MergeBoardItem, kind: MergeFlight['kind'], from: number, to: number | null, dx: number, dy: number) => {
    const pitch = cellSize + gap;
    const inset = boardPadding + boardBorder;
    const sourceX = inset + (from % MERGE_BOARD_COLUMNS) * pitch;
    const sourceY = inset + Math.floor(from / MERGE_BOARD_COLUMNS) * pitch;
    const targetX = to == null ? sourceX + dx : inset + (to % MERGE_BOARD_COLUMNS) * pitch;
    const targetY = to == null ? sourceY + dy - cellSize * 1.35 : inset + Math.floor(to / MERGE_BOARD_COLUMNS) * pitch;
    setFlights((current) => [...current, {
      id: ++flightId.current,
      item,
      kind,
      from,
      to,
      startX: sourceX + dx,
      startY: sourceY + dy,
      endX: targetX,
      endY: targetY,
    }]);
  }, [boardBorder, boardPadding, cellSize, gap]);

  const drop = useCallback((from: number, dx: number, dy: number, absoluteX: number, absoluteY: number): boolean => {
    setDraggingCell(null);
    setHoveredCell(null);
    const current = stateRef.current;
    const source = current.board[from];
    if (!source || lockedCellsRef.current.has(from)) return false;
    const ready = readyOrderForItem(current, from);
    if (ready && dy < -Math.max(84, cellSize * 1.7)) {
      serve(from, ready.id);
      if (!reduceMotion) addFlight(source, 'serve', from, null, dx, dy);
      return true;
    }
    const frame = boardFrame.current;
    if (!frame) return false;
    const to = mergeBoardCellFromPoint({
      absoluteX,
      absoluteY,
      boardX: frame.x,
      boardY: frame.y,
      boardWidth: frame.width,
      boardHeight: frame.height,
      inset: boardPadding + boardBorder,
      gap,
      cellSize,
    });
    if (to == null || to === from || lockedCellsRef.current.has(to)) return false;
    const target = current.board[to];
    const merging = canMergeItems(source, target);
    const next = mergeRoundReducer(current, { type: 'move', from, to }, config.moveBudget);
    if (next === current) {
      setInvalidCell(to);
      setTimeout(() => setInvalidCell(null), 260);
      haptic('warning');
      announce('Those items do not match.');
      return false;
    }
    if (!reduceMotion) addFlight(source, merging ? 'merge' : 'move', from, to, dx, dy);
    if (merging) {
      const upgraded = mergeItemDefinition(next.board[to]!.definitionId);
      if (reduceMotion) {
        setMergedCell(to);
        setTimeout(() => setMergedCell(null), 100);
      }
      haptic('merge');
      commit(next, `Merged into ${upgraded.name}. ${config.moveBudget - next.movesUsed} actions left.`);
    } else {
      haptic('move');
      commit(next);
    }
    return true;
  }, [addFlight, announce, boardBorder, boardPadding, cellSize, commit, config.moveBudget, gap, haptic, reduceMotion, serve]);

  const finishFlight = useCallback((id: number, kind: MergeFlight['kind'], to: number | null) => {
    setFlights((current) => current.filter((flight) => flight.id !== id));
    if (kind === 'merge' && to != null) {
      setMergedCell(to);
      setTimeout(() => setMergedCell((current) => current === to ? null : current), 430);
    }
  }, []);

  const pickCell = useCallback((cell: number) => {
    setDraggingCell(cell);
    haptic('pick');
  }, [haptic]);

  const accessibleCellAction = useCallback((cell: number) => {
    const current = stateRef.current;
    const item = current.board[cell];
    if (selectedCell == null) {
      if (!item) return;
      const ready = readyOrderForItem(current, cell);
      if (ready) {
        serve(cell, ready.id);
        return;
      }
      setSelectedCell(cell);
      announce(`${mergeItemDefinition(item.definitionId).name} selected. Choose a matching item or empty cell.`);
      haptic('pick');
      return;
    }
    if (selectedCell === cell) {
      setSelectedCell(null);
      announce('Selection cleared.');
      return;
    }
    const before = current;
    const next = mergeRoundReducer(current, { type: 'move', from: selectedCell, to: cell }, config.moveBudget);
    if (next === before) {
      haptic('warning');
      announce('That destination cannot accept the selected item.');
      return;
    }
    const merging = Boolean(before.board[cell]);
    const name = next.board[cell] ? mergeItemDefinition(next.board[cell]!.definitionId).name : null;
    setSelectedCell(null);
    if (merging) {
      setMergedCell(cell);
      setTimeout(() => setMergedCell(null), reduceMotion ? 100 : 430);
      haptic('merge');
      commit(next, `Merged into ${name}. ${config.moveBudget - next.movesUsed} actions left.`);
    } else {
      haptic('move');
      commit(next, `${name} moved.`);
    }
  }, [announce, commit, config.moveBudget, haptic, reduceMotion, selectedCell, serve]);

  const readyDefinitionIds = useMemo(
    () => new Set(state.orders.filter((order) => !order.completed).map((order) => order.targetId)),
    [state.orders],
  );
  const hiddenFlightTargets = useMemo(
    () => new Set(flights.flatMap((flight) => flight.to == null ? [] : [flight.to])),
    [flights],
  );

  if (!started) {
    return <QuestExperiencePreview
      eyebrow="Feastle"
      title="Merge Feast"
      body={`Build two dishes across the pantry. Empty-space moves are free; draws and merges use one of ${config.moveBudget} actions.`}
      icon="fork.knife"
      meta={best ? `Fastest feast · ${formatQuestDuration(best.durationMs)}` : 'Two orders · 36-cell pantry'}
      actionLabel="Open the pantry"
      onAction={start}
    />;
  }

  const durationMs = (finishedAt.current ?? Date.now()) - startedAt.current;
  if (state.status !== 'playing' && attempt.current && flights.length === 0) {
    const success = state.status === 'won';
    const result: QuestResult = {
      kind: 'merge', success, packId, ordersCompleted: state.orders.filter((order) => order.completed).length,
      ordersTotal: state.orders.length, movesUsed: state.movesUsed, moveBudget: config.moveBudget,
      mergeCount: state.mergeCount, highestTier: state.highestTier,
      orderIds: state.orders.map((order) => order.id), contentIds: state.orders.map((order) => order.targetId), durationMs,
    };
    const finish = () => success ? onComplete(attempt.current!, result) : reset();
    return (
      <FeastleMergeFeastScreen finishedAt={finishedAt.current} onClose={onRequestExit ?? reset} startedAt={startedAt.current}>
        <View accessibilityLiveRegion="polite" style={styles.resultFrame}>
          <View style={[styles.resultCard, success ? styles.resultCardSuccess : styles.resultCardFailure]}>
            <View style={styles.resultIcon}>
              <IconSymbol color={success ? '#55762C' : '#A44E35'} name={success ? 'sparkles' : 'exclamationmark.triangle.fill'} size={30} />
            </View>
            <ThemedText style={styles.resultEyebrow} lightColor="#A85E20" darkColor="#A85E20">
              {success ? 'Feast complete' : 'Pantry paused'}
            </ThemedText>
            <ThemedText style={styles.resultTitle} lightColor="#4A291B" darkColor="#4A291B">
              {success ? 'Feastle’s orders are served' : 'The pantry is spent'}
            </ThemedText>
            <ThemedText style={styles.resultBody} lightColor="#71503B" darkColor="#71503B">
              {success
                ? `Two dishes, ${state.mergeCount} merges, and not a crumb out of place.`
                : 'Move items freely and merge matching ingredients before drawing too far ahead.'}
            </ThemedText>
            <View accessibilityLabel={`Completion time ${formatQuestDuration(durationMs)}`} style={styles.scorePanel}>
              <IconSymbol color="#B95519" name="timer" size={20} />
              <ThemedText style={styles.scoreValue} lightColor="#4A291B" darkColor="#4A291B">{formatQuestDuration(durationMs)}</ThemedText>
              <ThemedText style={styles.scoreLabel} lightColor="#856246" darkColor="#856246">Completion time</ThemedText>
            </View>
            <View style={styles.resultMetricRow}>
              <ResultMetric label="Merges" value={String(state.mergeCount)} />
              <ResultMetric label="Orders" value={`${state.orders.filter((order) => order.completed).length}/${state.orders.length}`} />
            </View>
            {success && best && durationMs < best.durationMs ? (
              <ThemedText style={styles.best} lightColor="#7B5A1E" darkColor="#7B5A1E">New local best</ThemedText>
            ) : null}
          </View>
          <KatchaSurfaceProvider surface="parchment">
            <KatchaButton fullWidth icon={success ? 'arrow.right' : 'arrow.counterclockwise'} label={success ? 'Return to Feastle' : 'Try again'} onPress={finish} variant="primary" />
          </KatchaSurfaceProvider>
        </View>
      </FeastleMergeFeastScreen>
    );
  }

  const actionsLeft = config.moveBudget - state.movesUsed;
  const nextPantry = state.pantry[0] ?? null;
  return <FeastleMergeFeastScreen onClose={onRequestExit ?? reset} startedAt={startedAt.current}><View style={styles.root}>
    <View accessibilityLabel="Feastle’s two orders" style={styles.orders}>
      {state.orders.map((order) => {
        const definition = mergeItemDefinition(order.targetId);
        const readyCell = state.board.findIndex((item) => item?.definitionId === order.targetId);
        const progressTier = order.completed
          ? definition.tier
          : state.board.reduce((highest, item) => {
              if (!item) return highest;
              const itemDefinition = mergeItemDefinition(item.definitionId);
              return itemDefinition.chainId === definition.chainId ? Math.max(highest, itemDefinition.tier) : highest;
            }, 0);
        return <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${definition.name} order, ${order.completed ? 'served' : readyCell >= 0 ? 'ready to serve' : 'not ready'}`}
          accessibilityState={{ disabled: order.completed || readyCell < 0 }}
          disabled={order.completed || readyCell < 0}
          key={order.id}
          onPress={() => serve(readyCell, order.id)}
          style={({ pressed }) => [styles.order, order.completed && styles.orderComplete, readyCell >= 0 && !order.completed && styles.orderReady, pressed && styles.pressed]}>
          {readyCell >= 0 && !order.completed ? <AnimatedBorderHighlight borderRadius={19} inset={1} orbitDurationMs={2200} pauseDurationMs={850} /> : null}
          <FoodArt item={definition} size={compact ? 48 : 56} />
          <View style={styles.orderCopy}>
            <ThemedText numberOfLines={1} style={styles.orderName} lightColor="#4A291B" darkColor="#4A291B">{definition.name}</ThemedText>
            <ThemedText style={styles.orderStatus} lightColor={order.completed ? '#55762C' : readyCell >= 0 ? '#A9581D' : '#76543C'} darkColor={order.completed ? '#55762C' : readyCell >= 0 ? '#A9581D' : '#76543C'}>{order.completed ? 'SERVED' : readyCell >= 0 ? 'TAP TO SERVE' : `TIER ${definition.tier}`}</ThemedText>
            <View accessibilityLabel={`Tier progress ${progressTier} of ${definition.tier}`} style={styles.tierProgress}>
              {Array.from({ length: definition.tier }, (_, index) => <View key={index} style={[styles.tierDot, index < progressTier && styles.tierDotFilled]} />)}
            </View>
          </View>
          {order.completed ? <View style={styles.servedBadge}><IconSymbol color="#FFF7D8" name="checkmark" size={12} /></View> : null}
        </Pressable>;
      })}
    </View>

    <View
      ref={boardRef}
      accessibilityLabel="Six by six merge board"
      onLayout={measureBoard}
      style={[
        styles.board,
        { height: boardHeight, width: boardWidth, gap, padding: boardPadding },
        spawnedCell != null && styles.boardAnimating,
      ]}>
      {state.board.map((item, index) => <MergeCell
        boardHeight={boardMeasuredHeight}
        boardWidth={boardMeasuredWidth}
        boardX={boardX}
        boardY={boardY}
        boardInset={boardPadding + boardBorder}
        cellSize={cellSize}
        gap={gap}
        index={index}
        invalid={invalidCell === index}
        item={hiddenFlightTargets.has(index) ? null : item}
        locked={lockedCells.has(index)}
        compatible={!lockedCells.has(index) && draggingCell != null && draggingCell !== index && canMergeItems(state.board[draggingCell], item)}
        dragging={draggingCell === index}
        emptyTarget={!lockedCells.has(index) && draggingCell != null && !item}
        hovered={!lockedCells.has(index) && hoveredCell === index && draggingCell !== index}
        key={index}
        merged={mergedCell === index}
        onDrop={drop}
        onDragFinish={finishDrag}
        onDragOver={dragOver}
        onPick={pickCell}
        onAccessibleAction={accessibleCellAction}
        ready={Boolean(item && readyDefinitionIds.has(item.definitionId))}
        reduceMotion={reduceMotion}
        selected={selectedCell === index}
        selectionActive={selectedCell != null}
        spawned={spawnedCell === index}
      />)}
      {flights.map((flight) => <MergeFlightOverlay
        cellSize={cellSize}
        flight={flight}
        key={flight.id}
        onComplete={finishFlight}
        reduceMotion={reduceMotion}
      />)}
    </View>

    <View style={styles.pantryRow}>
      <Pressable accessibilityRole="button" accessibilityLabel={nextPantry ? `Draw ${mergeItemDefinition(nextPantry.definitionId).name} from pantry` : 'Pantry empty'} disabled={!nextPantry || actionsLeft <= 0} onPress={spawn} style={({ pressed }) => [styles.pantry, (!nextPantry || actionsLeft <= 0) && styles.disabled, pressed && styles.pressed]}>
        <View style={styles.pantryIcon}><IconSymbol name="plus" size={28} color="#FFF4D5" /></View>
        <View style={styles.pantryCopy}>
          <ThemedText style={styles.pantryTitle} lightColor="#4A291B" darkColor="#4A291B">Pantry</ThemedText>
          <ThemedText numberOfLines={1} style={styles.pantryHint} lightColor="#76543C" darkColor="#76543C">{nextPantry ? 'Tap to generate an ingredient' : 'Every ingredient is on the board'}</ThemedText>
          <View style={styles.pantryMetaPill}><IconSymbol color="#6B4A76" name="clock" size={11} /><ThemedText style={styles.pantryMeta} lightColor="#5F405F" darkColor="#5F405F">{state.pantry.length} items left</ThemedText></View>
        </View>
        {nextPantry ? <FoodArt item={mergeItemDefinition(nextPantry.definitionId)} size={compact ? 46 : 52} /> : <Image accessibilityIgnoresInvertColors contentFit="contain" source={FEASTLE_MERGE_ART.pantry} style={styles.emptyPantryArt} />}
      </Pressable>
    </View>
  </View></FeastleMergeFeastScreen>;
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return <View style={styles.resultMetric}>
    <ThemedText style={styles.resultMetricValue} lightColor="#4A291B" darkColor="#4A291B">{value}</ThemedText>
    <ThemedText style={styles.resultMetricLabel} lightColor="#856246" darkColor="#856246">{label}</ThemedText>
  </View>;
}

type MergeCellProps = {
  item: MergeBoardItem | null; index: number; cellSize: number; gap: number; boardInset: number;
  boardX: SharedValue<number>; boardY: SharedValue<number>; boardWidth: SharedValue<number>; boardHeight: SharedValue<number>;
  merged: boolean; invalid: boolean; ready: boolean; reduceMotion: boolean; selected: boolean; selectionActive: boolean; compatible: boolean; dragging: boolean; emptyTarget: boolean; hovered: boolean; spawned: boolean; locked: boolean;
  onDrop: (index: number, dx: number, dy: number, absoluteX: number, absoluteY: number) => boolean;
  onDragFinish: () => void; onDragOver: (cell: number | null) => void; onPick: (cell: number) => void; onAccessibleAction: (cell: number) => void;
};

const MergeCell = memo(function MergeCell({ item, index, cellSize, gap, boardInset, boardX, boardY, boardWidth, boardHeight, merged, invalid, ready, reduceMotion, selected, selectionActive, compatible, dragging, emptyTarget, hovered, spawned, locked, onDrop, onDragFinish, onDragOver, onPick, onAccessibleAction }: MergeCellProps) {
  const definition = item ? mergeItemDefinition(item.definitionId) : null;
  const row = Math.floor(index / MERGE_BOARD_COLUMNS) + 1;
  const column = (index % MERGE_BOARD_COLUMNS) + 1;
  const actionLabel = selected ? 'Clear selection' : item ? ready ? 'Serve order' : 'Select item' : 'Move selected item here';
  return <View
    accessible={!locked && (Boolean(item) || selectionActive)}
    accessibilityActions={[{ name: 'activate', label: actionLabel }]}
    accessibilityLabel={definition ? `${definition.name}, tier ${definition.tier}, row ${row}, column ${column}${ready ? ', order ready' : ''}${selected ? ', selected' : ''}` : `Empty cell, row ${row}, column ${column}`}
    accessibilityRole="button"
    onAccessibilityAction={(event) => { if (!locked && event.nativeEvent.actionName === 'activate') onAccessibleAction(index); }}
    style={[styles.cell, { height: cellSize, width: cellSize }, invalid && styles.cellInvalid, ready && styles.cellReady, selected && styles.cellSelected, compatible && styles.cellCompatible, emptyTarget && styles.cellEmptyTarget, spawned && styles.cellSpawned, hovered && styles.cellHovered, dragging && styles.cellDragging]}>
    {item && definition && !locked ? <MergeItem
      boardHeight={boardHeight}
      boardInset={boardInset}
      boardWidth={boardWidth}
      boardX={boardX}
      boardY={boardY}
      cellSize={cellSize}
      definition={definition}
      gap={gap}
      index={index}
      invalid={invalid}
      onDragFinish={onDragFinish}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onPick={onPick}
      ready={ready}
      reduceMotion={reduceMotion}
      spawned={spawned}
    /> : null}
    {merged && !reduceMotion ? <MergeCelebration size={cellSize} /> : null}
  </View>;
});

function MergeItem({ index, cellSize, gap, boardInset, boardX, boardY, boardWidth, boardHeight, definition, invalid, ready, reduceMotion, spawned, onDrop, onDragFinish, onDragOver, onPick }: {
  index: number; cellSize: number; gap: number; boardInset: number;
  boardX: SharedValue<number>; boardY: SharedValue<number>; boardWidth: SharedValue<number>; boardHeight: SharedValue<number>;
  definition: ReturnType<typeof mergeItemDefinition>; invalid: boolean; ready: boolean; reduceMotion: boolean; spawned: boolean;
  onDrop: MergeCellProps['onDrop']; onDragFinish: () => void; onDragOver: (cell: number | null) => void; onPick: (cell: number) => void;
}) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const scale = useSharedValue(1);
  const landingScale = useSharedValue(1);
  const invalidX = useSharedValue(0);
  const releasePending = useSharedValue(0);
  const lastHovered = useSharedValue(-2);
  useEffect(() => {
    if (!spawned || reduceMotion) {
      landingScale.value = 1;
      return;
    }
    landingScale.value = 0.97;
    landingScale.value = withDelay(110, withSequence(
      withTiming(1.055, { duration: 90, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 115, easing: Easing.out(Easing.quad) }),
    ));
  }, [landingScale, reduceMotion, spawned]);
  useEffect(() => {
    if (!invalid || reduceMotion) {
      invalidX.value = 0;
      return;
    }
    invalidX.value = withSequence(
      withTiming(-4, { duration: 42 }),
      withTiming(4, { duration: 58 }),
      withTiming(-3, { duration: 52 }),
      withTiming(2, { duration: 46 }),
      withTiming(0, { duration: 58, easing: Easing.out(Easing.quad) }),
    );
  }, [invalid, invalidX, reduceMotion]);

  const returnHome = () => {
    const duration = reduceMotion ? 55 : 145;
    const easing = Easing.out(Easing.cubic);
    x.value = withTiming(0, { duration, easing });
    y.value = withTiming(0, { duration, easing });
    scale.value = withSequence(
      withTiming(0.99, { duration: Math.min(55, duration), easing }),
      withTiming(1, { duration: Math.max(1, duration - 55), easing }),
    );
    releasePending.value = 0;
  };
  const resolveDrop = (dx: number, dy: number, absoluteX: number, absoluteY: number) => {
    if (!onDrop(index, dx, dy, absoluteX, absoluteY)) returnHome();
  };
  const gesture = Gesture.Pan()
    .minDistance(5)
    .onBegin(() => {
      releasePending.value = 0;
      lastHovered.value = -2;
      scale.value = withTiming(1.035, { duration: reduceMotion ? 40 : 75, easing: Easing.out(Easing.cubic) });
      runOnJS(onPick)(index);
    })
    .onUpdate((event) => {
      x.value = event.translationX;
      y.value = event.translationY;
      const localX = event.absoluteX - boardX.value;
      const localY = event.absoluteY - boardY.value;
      let hovered = -1;
      if (localX >= 0 && localY >= 0 && localX < boardWidth.value && localY < boardHeight.value) {
        const pitch = cellSize + gap;
        const column = Math.max(0, Math.min(MERGE_BOARD_COLUMNS - 1, Math.round((localX - boardInset - cellSize / 2) / pitch)));
        const row = Math.max(0, Math.min(MERGE_BOARD_ROWS - 1, Math.round((localY - boardInset - cellSize / 2) / pitch)));
        hovered = row * MERGE_BOARD_COLUMNS + column;
      }
      if (hovered !== lastHovered.value) {
        lastHovered.value = hovered;
        runOnJS(onDragOver)(hovered < 0 ? null : hovered);
      }
    })
    .onEnd((event) => {
      releasePending.value = 1;
      runOnJS(resolveDrop)(event.translationX, event.translationY, event.absoluteX, event.absoluteY);
    })
    .onFinalize(() => {
      runOnJS(onDragFinish)();
      if (releasePending.value === 0) {
        x.value = withSpring(0, { damping: 19, stiffness: 260 });
        y.value = withSpring(0, { damping: 19, stiffness: 260 });
        scale.value = withTiming(1, { duration: 90 });
      }
    });
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value + invalidX.value }, { translateY: y.value }, { scale: scale.value }] }));
  const landingStyle = useAnimatedStyle(() => ({ transform: [{ scale: landingScale.value }] }));
  return <GestureDetector gesture={gesture}>
      <Animated.View accessible={false} entering={spawned && !reduceMotion ? SlideInDown.duration(175).easing(Easing.out(Easing.cubic)) : undefined} style={[styles.dragItem, animatedStyle]}>
        <Animated.View style={[styles.landingItem, landingStyle]}>
          <FoodArt bare item={definition} size={cellSize - 4} />
        </Animated.View>
      </Animated.View>
    </GestureDetector>;
}

function MergeFlightOverlay({ flight, cellSize, reduceMotion, onComplete }: { flight: MergeFlight; cellSize: number; reduceMotion: boolean; onComplete: (id: number, kind: MergeFlight['kind'], to: number | null) => void }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, {
      duration: reduceMotion ? 1 : flight.kind === 'merge' ? 185 : 155,
      easing: Easing.out(Easing.cubic),
    }, (finished) => {
      if (finished) runOnJS(onComplete)(flight.id, flight.kind, flight.to);
    });
  }, [flight.id, flight.kind, flight.to, onComplete, progress, reduceMotion]);
  const style = useAnimatedStyle(() => ({
    opacity: flight.kind === 'merge'
      ? interpolate(progress.value, [0, 0.72, 1], [1, 1, 0])
      : flight.kind === 'serve' ? interpolate(progress.value, [0, 1], [1, 0]) : 1,
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [flight.startX, flight.endX]) },
      { translateY: interpolate(progress.value, [0, 1], [flight.startY, flight.endY]) },
      { scale: flight.kind === 'merge' ? interpolate(progress.value, [0, 0.72, 1], [1.035, 0.94, 0.42]) : 1 },
    ],
  }));
  return <Animated.View pointerEvents="none" style={[styles.flight, { height: cellSize, width: cellSize }, style]}>
    <FoodArt bare item={mergeItemDefinition(flight.item.definitionId)} size={cellSize - 4} />
  </Animated.View>;
}

const FoodArt = memo(function FoodArt({ item, size, bare = false }: { item: ReturnType<typeof mergeItemDefinition>; size: number; bare?: boolean }) {
  const presentation = CHAIN_STYLE[item.chainId];
  return <View style={[
    styles.foodArt,
    { height: size, width: size },
    bare ? styles.foodArtBare : { backgroundColor: `${presentation.color}20`, borderColor: `${presentation.color}55` },
  ]}>
    <Image source={FEASTLE_MERGE_ART[item.artKey]} contentFit="contain" style={[styles.foodImage, bare && styles.foodImageBare]} />
    <View style={[styles.tierBadge, { backgroundColor: presentation.color }]}><ThemedText style={styles.tierText} lightColor={Lantern.emberInk} darkColor={Lantern.emberInk}>{item.tier}</ThemedText></View>
  </View>;
});

function MergeCelebration({ size }: { size: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
  }, [progress]);
  const haloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.18, 0.72, 1], [0, 0.92, 0.38, 0]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.42, 1.48]) }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.12, 0.8, 1], [0, 1, 0.45, 0]),
    transform: [{ scale: interpolate(progress.value, [0, 0.35, 1], [0.55, 1.04, 1.34]) }],
  }));
  return <Animated.View pointerEvents="none" entering={FadeIn.duration(40)} exiting={FadeOut.duration(80)} style={styles.burst}>
    <Animated.View style={[styles.mergeHalo, { height: size * 0.86, width: size * 0.86 }, haloStyle]} />
    <Animated.View style={[styles.mergeRing, { height: size * 0.72, width: size * 0.72 }, ringStyle]} />
    {[0, 1, 2, 3, 4, 5].map((index) => <MergeParticle index={index} key={index} progress={progress} />)}
  </Animated.View>;
}

function MergeParticle({ index, progress }: { index: number; progress: SharedValue<number> }) {
  const angle = (Math.PI * 2 * index) / 6;
  const style = useAnimatedStyle(() => {
    const travel = interpolate(progress.value, [0, 1], [4, 31]);
    return {
      opacity: interpolate(progress.value, [0, 0.22, 1], [0, 1, 0]),
      transform: [
        { translateX: Math.cos(angle) * travel },
        { translateY: Math.sin(angle) * travel },
        { scale: interpolate(progress.value, [0, 0.3, 1], [0.4, 1, 0.3]) },
      ],
    };
  });
  return <Animated.View style={[styles.crumb, style]} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: 8, justifyContent: 'space-between', minHeight: 0 },
  orders: { flexDirection: 'row', gap: 7, zIndex: 2 },
  order: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,240,206,0.97)',
    borderColor: 'rgba(173,108,42,0.72)',
    borderCurve: 'continuous',
    borderRadius: 19,
    borderWidth: 1,
    boxShadow: '0 5px 13px rgba(56,30,13,0.3), inset 0 1px 0 rgba(255,255,255,0.82)',
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 72,
    padding: 7,
    position: 'relative',
  },
  orderReady: { backgroundColor: '#FFE7AD', borderColor: '#D58C2C', boxShadow: '0 5px 14px rgba(83,43,14,0.34), inset 0 1px 0 rgba(255,255,255,0.9)' },
  orderComplete: { backgroundColor: '#E5ECC1', borderColor: '#82964A' },
  orderCopy: { flex: 1, gap: 2, minWidth: 0 },
  orderName: { fontSize: 12, fontWeight: '900' },
  orderStatus: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.5 },
  tierProgress: { alignItems: 'center', flexDirection: 'row', gap: 3, paddingTop: 2 },
  tierDot: { backgroundColor: 'rgba(117,82,56,0.16)', borderColor: 'rgba(117,82,56,0.46)', borderRadius: 999, borderWidth: 1, height: 8, width: 8 },
  tierDotFilled: { backgroundColor: '#E9A92E', borderColor: '#C87A1D', boxShadow: '0 1px 3px rgba(180,102,20,0.34)' },
  servedBadge: { alignItems: 'center', backgroundColor: '#6F8B3D', borderRadius: 999, height: 20, justifyContent: 'center', position: 'absolute', right: 5, top: 5, width: 20 },
  board: {
    alignSelf: 'center',
    backgroundColor: '#493747',
    borderColor: '#D79A4A',
    borderCurve: 'continuous',
    borderRadius: 26,
    borderWidth: 2,
    boxShadow: '0 14px 28px rgba(55,28,13,0.42), inset 0 2px 0 rgba(255,228,172,0.24), inset 0 -3px 0 rgba(47,28,42,0.48)',
    flexDirection: 'row',
    flexWrap: 'wrap',
    overflow: 'visible',
  },
  boardAnimating: { zIndex: 30 },
  cell: { alignItems: 'center', backgroundColor: '#5A4656', borderColor: 'rgba(255,241,218,0.12)', borderCurve: 'continuous', borderRadius: 11, borderWidth: 1, justifyContent: 'center', overflow: 'visible', position: 'relative', zIndex: 0 },
  cellReady: { backgroundColor: '#65504E', borderColor: 'rgba(255,206,105,0.72)', boxShadow: 'inset 0 0 12px rgba(255,193,75,0.12)' },
  cellSelected: { backgroundColor: '#665465', borderColor: '#FFE09B', boxShadow: '0 0 10px rgba(255,206,105,0.34)' },
  cellCompatible: { backgroundColor: '#6A554C', borderColor: '#FFD681', boxShadow: 'inset 0 0 12px rgba(255,195,107,0.18), 0 0 9px rgba(255,195,107,0.22)' },
  cellEmptyTarget: { borderColor: 'rgba(255,241,218,0.2)' },
  cellSpawned: { backgroundColor: '#64574A', borderColor: '#CDE06B', boxShadow: 'inset 0 0 14px rgba(190,255,112,0.13)', zIndex: 2000 },
  cellHovered: { backgroundColor: '#73615F', borderColor: '#FFF0C3', boxShadow: 'inset 0 0 0 1px rgba(255,240,195,0.28), 0 0 12px rgba(255,207,112,0.34)', zIndex: 2 },
  cellDragging: { borderColor: '#FFE1AE', zIndex: 1000 },
  cellInvalid: { backgroundColor: '#6B454A', borderColor: '#F38A72', boxShadow: '0 0 9px rgba(243,102,79,0.28)' },
  dragItem: { alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1001 },
  flight: { alignItems: 'center', justifyContent: 'center', left: 0, position: 'absolute', top: 0, zIndex: 3000 },
  landingItem: { alignItems: 'center', justifyContent: 'center' },
  foodArt: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 16, borderWidth: 1, justifyContent: 'center' },
  foodImage: { height: '96%', width: '96%' },
  foodArtBare: { backgroundColor: 'transparent', borderRadius: 0, borderWidth: 0 },
  foodImageBare: { height: '100%', width: '100%' },
  tierBadge: { alignItems: 'center', borderColor: 'rgba(91,51,25,0.42)', borderRadius: 999, borderWidth: 1, bottom: 2, height: 18, justifyContent: 'center', position: 'absolute', right: 2, width: 18 },
  tierText: {
    fontSize: 9,
    fontVariant: ['tabular-nums'],
    fontWeight: '900',
    height: 16,
    includeFontPadding: false,
    lineHeight: 16,
    textAlign: 'center',
    textAlignVertical: 'center',
    width: 16,
  },
  pantryRow: { flexDirection: 'row' },
  pantry: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,240,206,0.98)',
    borderColor: 'rgba(174,106,38,0.82)',
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: 1,
    boxShadow: '0 6px 16px rgba(58,30,13,0.34), inset 0 1px 0 rgba(255,255,255,0.88)',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 68,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  pantryIcon: { alignItems: 'center', backgroundColor: '#EAA52D', borderColor: '#B96618', borderCurve: 'continuous', borderRadius: 17, borderWidth: 1, boxShadow: '0 3px 8px rgba(119,62,12,0.3), inset 0 2px 0 rgba(255,239,173,0.62)', height: 50, justifyContent: 'center', width: 50 },
  pantryCopy: { flex: 1, gap: 1, minWidth: 0 },
  pantryTitle: { fontSize: 16, fontWeight: '900' },
  pantryHint: { fontSize: 10.5, fontWeight: '700' },
  pantryMetaPill: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: 'rgba(106,70,110,0.09)', borderRadius: 999, flexDirection: 'row', gap: 4, marginTop: 2, paddingHorizontal: 7, paddingVertical: 2 },
  pantryMeta: { fontSize: 8.5, fontVariant: ['tabular-nums'], fontWeight: '900' },
  emptyPantryArt: { height: 48, width: 48 },
  burst: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 3 },
  mergeHalo: { backgroundColor: 'rgba(255,195,107,0.30)', borderRadius: 999, position: 'absolute' },
  mergeRing: { borderColor: 'rgba(255,225,174,0.92)', borderRadius: 999, borderWidth: 2, position: 'absolute' },
  crumb: { backgroundColor: '#FFE1AE', borderRadius: 999, height: 5, position: 'absolute', width: 5, boxShadow: '0 1px 4px rgba(255,195,107,0.42)' },
  resultFrame: { alignSelf: 'center', flex: 1, gap: 14, justifyContent: 'center', maxWidth: 480, paddingHorizontal: 8, width: '100%' },
  resultCard: { alignItems: 'center', backgroundColor: 'rgba(255,240,206,0.98)', borderColor: '#C98435', borderCurve: 'continuous', borderRadius: 28, borderWidth: 1, boxShadow: '0 14px 30px rgba(57,29,13,0.4), inset 0 1px 0 rgba(255,255,255,0.86)', gap: 8, padding: 24 },
  resultCardSuccess: { borderColor: '#8EA24E' },
  resultCardFailure: { borderColor: '#C36A4E' },
  resultIcon: { alignItems: 'center', backgroundColor: 'rgba(226,184,83,0.18)', borderRadius: 22, height: 58, justifyContent: 'center', width: 58 },
  resultEyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  resultTitle: { fontSize: 25, fontWeight: '900', lineHeight: 30, textAlign: 'center' },
  resultBody: { fontSize: 13.5, lineHeight: 20, maxWidth: 340, textAlign: 'center' },
  scorePanel: { alignItems: 'center', backgroundColor: 'rgba(233,169,46,0.15)', borderColor: 'rgba(185,85,25,0.28)', borderRadius: 18, borderWidth: 1, gap: 1, paddingHorizontal: 18, paddingVertical: 10, width: '100%' },
  scoreValue: { fontSize: 28, fontVariant: ['tabular-nums'], fontWeight: '900', lineHeight: 32 },
  scoreLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase' },
  resultMetricRow: { flexDirection: 'row', gap: 7, paddingTop: 4, width: '100%' },
  resultMetric: { alignItems: 'center', backgroundColor: 'rgba(136,86,47,0.07)', borderColor: 'rgba(136,86,47,0.16)', borderRadius: 14, borderWidth: 1, flex: 1, gap: 2, paddingHorizontal: 5, paddingVertical: 8 },
  resultMetricValue: { fontSize: 15, fontVariant: ['tabular-nums'], fontWeight: '900' },
  resultMetricLabel: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.45, textTransform: 'uppercase' },
  best: { fontSize: 9.5, fontWeight: '900', letterSpacing: 0.7, paddingTop: 4 },
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});
