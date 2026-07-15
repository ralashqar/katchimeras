import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
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
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
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

import { ExperienceResult, QuestExperiencePreview } from './quest-experience-ui';

type Props = {
  config: MergeRoundConfig;
  packId: MergePackId;
  seed: string;
  recentOrderIds: string[];
  best?: { movesUsed: number; durationMs: number } | null;
  onAttemptStart: (config: Record<string, unknown>) => string;
  onAttemptCancel: (id: string) => void;
  onComplete: (id: string, result: QuestResult) => void;
  onRunningChange: (running: boolean, id?: string | null) => void;
};

const CHAIN_STYLE: Record<string, { color: string }> = {
  pasta: { color: '#E8B76A' },
  stew: { color: '#D98763' },
  dessert: { color: '#D99B91' },
};

export function MergeQuest({ config, packId, seed, recentOrderIds, best = null, onAttemptStart, onAttemptCancel, onComplete, onRunningChange }: Props) {
  const { width, height } = useWindowDimensions();
  const gap = height < 680 ? 4 : 5;
  const boardPadding = 6;
  const boardBorder = 1;
  const maxBoardWidth = Math.min(width - 36, 390);
  const maxBoardHeight = Math.min(390, Math.max(292, height - 270));
  const cellSize = Math.floor(Math.min(
    (maxBoardWidth - (boardPadding + boardBorder) * 2 - gap * (MERGE_BOARD_COLUMNS - 1)) / MERGE_BOARD_COLUMNS,
    (maxBoardHeight - (boardPadding + boardBorder) * 2 - gap * (MERGE_BOARD_ROWS - 1)) / MERGE_BOARD_ROWS,
  ));
  const boardWidth = cellSize * MERGE_BOARD_COLUMNS + gap * (MERGE_BOARD_COLUMNS - 1) + (boardPadding + boardBorder) * 2;
  const boardHeight = cellSize * MERGE_BOARD_ROWS + gap * (MERGE_BOARD_ROWS - 1) + (boardPadding + boardBorder) * 2;
  const reduceMotion = useReducedMotion();
  const initialRound = useMemo(() => createMergeRound(seed, config, recentOrderIds), [config, recentOrderIds, seed]);
  const [state, setState] = useState(initialRound);
  const [started, setStarted] = useState(false);
  const [mergedCell, setMergedCell] = useState<number | null>(null);
  const [spawnedCell, setSpawnedCell] = useState<number | null>(null);
  const [invalidCell, setInvalidCell] = useState<number | null>(null);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [draggingCell, setDraggingCell] = useState<number | null>(null);
  const [hoveredCell, setHoveredCell] = useState<number | null>(null);
  const [dropLanding, setDropLanding] = useState<{ cell: number; offsetX: number; offsetY: number } | null>(null);
  const attempt = useRef<string | null>(null);
  const startedAt = useRef(0);
  const finishedAt = useRef<number | null>(null);
  const boardRef = useRef<View>(null);
  const boardFrame = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const spawnAnimationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropLandingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (spawnAnimationTimer.current) clearTimeout(spawnAnimationTimer.current);
    if (dropLandingTimer.current) clearTimeout(dropLandingTimer.current);
  }, []);

  const measureBoard = () => {
    boardRef.current?.measureInWindow((x, y, measuredWidth, measuredHeight) => {
      boardFrame.current = { x, y, width: measuredWidth, height: measuredHeight };
    });
  };

  const haptic = (kind: 'pick' | 'move' | 'merge' | 'warning' | 'serve') => {
    if (process.env.EXPO_OS !== 'ios') return;
    if (kind === 'pick') void Haptics.selectionAsync();
    else if (kind === 'move') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else if (kind === 'merge') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    else if (kind === 'warning') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    else void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const announce = (message: string) => { void AccessibilityInfo.announceForAccessibility(message); };

  const commit = (next: MergeRoundState, message?: string) => {
    if (next.status !== 'playing' && state.status === 'playing') finishedAt.current = Date.now();
    setState(next);
    if (message) announce(message);
  };

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
    if (dropLandingTimer.current) clearTimeout(dropLandingTimer.current);
    setInvalidCell(null);
    setSelectedCell(null);
    setDraggingCell(null);
    setHoveredCell(null);
    setDropLanding(null);
    onRunningChange(false);
  };

  const confirmReset = () => {
    Alert.alert(
      'Leave Merge Feast?',
      'Your current board and order progress will be lost.',
      [
        { text: 'Keep playing', style: 'cancel' },
        { text: 'Leave game', style: 'destructive', onPress: reset },
      ],
    );
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

  const serve = (cell: number, orderId: string) => {
    const item = state.board[cell];
    if (!item) return;
    const name = mergeItemDefinition(item.definitionId).name;
    const next = mergeRoundReducer(state, { type: 'serve', cell, orderId }, config.moveBudget);
    if (next === state) return;
    haptic('serve');
    commit(next, `${name} served. ${next.orders.filter((order) => order.completed).length} of ${next.orders.length} orders complete.`);
  };

  const dragOver = (absoluteX: number, absoluteY: number) => {
    const frame = boardFrame.current;
    if (!frame) return;
    setHoveredCell(mergeBoardCellFromPoint({
      absoluteX,
      absoluteY,
      boardX: frame.x,
      boardY: frame.y,
      boardWidth: frame.width,
      boardHeight: frame.height,
      inset: boardPadding + boardBorder,
      gap,
      cellSize,
    }));
  };

  const finishDrag = () => {
    setDraggingCell(null);
    setHoveredCell(null);
  };

  const drop = (from: number, dx: number, dy: number, absoluteX: number, absoluteY: number) => {
    setDraggingCell(null);
    setHoveredCell(null);
    const source = state.board[from];
    if (!source) return;
    const ready = readyOrderForItem(state, from);
    if (ready && dy < -Math.max(84, cellSize * 1.7)) {
      serve(from, ready.id);
      return;
    }
    const frame = boardFrame.current;
    if (!frame) return;
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
    if (to == null) return;
    if (to === from) return;
    const target = state.board[to];
    const merging = canMergeItems(source, target);
    const next = mergeRoundReducer(state, { type: 'move', from, to }, config.moveBudget);
    if (next === state) {
      setInvalidCell(to);
      setTimeout(() => setInvalidCell(null), 260);
      haptic('warning');
      announce('Those items do not match.');
      return;
    }
    if (!reduceMotion) {
      const sourceRow = Math.floor(from / MERGE_BOARD_COLUMNS);
      const sourceColumn = from % MERGE_BOARD_COLUMNS;
      const targetRow = Math.floor(to / MERGE_BOARD_COLUMNS);
      const targetColumn = to % MERGE_BOARD_COLUMNS;
      const pitch = cellSize + gap;
      setDropLanding({
        cell: to,
        offsetX: dx - (targetColumn - sourceColumn) * pitch,
        offsetY: dy - (targetRow - sourceRow) * pitch,
      });
      if (dropLandingTimer.current) clearTimeout(dropLandingTimer.current);
      dropLandingTimer.current = setTimeout(() => {
        setDropLanding(null);
        dropLandingTimer.current = null;
      }, 180);
    }
    if (merging) {
      const upgraded = mergeItemDefinition(next.board[to]!.definitionId);
      setMergedCell(to);
      setTimeout(() => setMergedCell(null), reduceMotion ? 100 : 430);
      haptic('merge');
      commit(next, `Merged into ${upgraded.name}. ${config.moveBudget - next.movesUsed} actions left.`);
    } else {
      haptic('move');
      commit(next);
    }
  };

  const accessibleCellAction = (cell: number) => {
    const item = state.board[cell];
    if (selectedCell == null) {
      if (!item) return;
      const ready = readyOrderForItem(state, cell);
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
    const before = state;
    const next = mergeRoundReducer(state, { type: 'move', from: selectedCell, to: cell }, config.moveBudget);
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
  };

  if (!started) {
    return <QuestExperiencePreview
      eyebrow="Feastle"
      title="Merge Feast"
      body={`Build two dishes across the pantry. Empty-space moves are free; draws and merges use one of ${config.moveBudget} actions.`}
      icon="fork.knife"
      meta={best ? `Local best · ${best.movesUsed} actions · ${formatQuestDuration(best.durationMs)}` : 'Two orders · 36-cell pantry'}
      actionLabel="Open the pantry"
      onAction={start}
    />;
  }

  const durationMs = (finishedAt.current ?? Date.now()) - startedAt.current;
  if (state.status !== 'playing' && attempt.current) {
    const success = state.status === 'won';
    const result: QuestResult = {
      kind: 'merge', success, packId, ordersCompleted: state.orders.filter((order) => order.completed).length,
      ordersTotal: state.orders.length, movesUsed: state.movesUsed, moveBudget: config.moveBudget,
      mergeCount: state.mergeCount, highestTier: state.highestTier,
      orderIds: state.orders.map((order) => order.id), contentIds: state.orders.map((order) => order.targetId), durationMs,
    };
    return <ExperienceResult
      success={success}
      title={success ? 'Feastle’s orders are served' : 'The pantry is spent'}
      body={success ? `Two dishes, ${state.mergeCount} merges, and not a crumb out of place.` : 'The same kitchen is ready for another try. Move items freely and merge before drawing too far ahead.'}
      metric={`${state.movesUsed}/${config.moveBudget}`}
      onRetry={reset}
      onComplete={() => success ? onComplete(attempt.current!, result) : reset()}
    />;
  }

  const actionsLeft = config.moveBudget - state.movesUsed;
  const nextPantry = state.pantry[0] ?? null;
  return <View style={styles.root}>
    <View style={styles.topLine}>
      <ThemedText selectable style={styles.kicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>MERGE FEAST</ThemedText>
      <View style={[styles.actionPill, actionsLeft <= 3 && styles.actionPillWarning]}>
        <ThemedText selectable style={styles.actionNumber} lightColor={actionsLeft <= 3 ? '#F2A38B' : Lantern.moon50} darkColor={actionsLeft <= 3 ? '#F2A38B' : Lantern.moon50}>{actionsLeft}</ThemedText>
        <ThemedText style={styles.actionLabel} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>ACTIONS</ThemedText>
      </View>
    </View>

    <View accessibilityLabel="Feastle’s two orders" style={styles.orders}>
      {state.orders.map((order) => {
        const definition = mergeItemDefinition(order.targetId);
        const readyCell = state.board.findIndex((item) => item?.definitionId === order.targetId);
        return <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${definition.name} order, ${order.completed ? 'served' : readyCell >= 0 ? 'ready to serve' : 'not ready'}`}
          accessibilityState={{ disabled: order.completed || readyCell < 0 }}
          disabled={order.completed || readyCell < 0}
          key={order.id}
          onPress={() => serve(readyCell, order.id)}
          style={({ pressed }) => [styles.order, order.completed && styles.orderComplete, readyCell >= 0 && !order.completed && styles.orderReady, pressed && styles.pressed]}>
          <FoodArt item={definition} size={44} />
          <View style={styles.orderCopy}>
            <ThemedText numberOfLines={1} style={styles.orderName} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{definition.name}</ThemedText>
            <ThemedText style={styles.orderStatus} lightColor={order.completed ? Lantern.auroraTeal : readyCell >= 0 ? Lantern.ember300 : Lantern.moon500} darkColor={order.completed ? Lantern.auroraTeal : readyCell >= 0 ? Lantern.ember300 : Lantern.moon500}>{order.completed ? 'SERVED' : readyCell >= 0 ? 'TAP TO SERVE' : `TIER ${definition.tier}`}</ThemedText>
          </View>
        </Pressable>;
      })}
    </View>

    <View ref={boardRef} accessibilityLabel="Six by six merge board" onLayout={measureBoard} style={[styles.board, { height: boardHeight, width: boardWidth, gap, padding: boardPadding }]}>
      {state.board.map((item, index) => <MergeCell
        cellSize={cellSize}
        index={index}
        invalid={invalidCell === index}
        item={item}
        compatible={draggingCell != null && draggingCell !== index && canMergeItems(state.board[draggingCell], item)}
        dragging={draggingCell === index}
        emptyTarget={draggingCell != null && !item}
        hovered={hoveredCell === index && draggingCell !== index}
        key={`${index}:${item?.instanceId ?? 'empty'}`}
        dropOffset={dropLanding?.cell === index ? dropLanding : null}
        merged={mergedCell === index}
        onDrop={drop}
        onDragFinish={finishDrag}
        onDragOver={dragOver}
        onPick={() => { measureBoard(); setDraggingCell(index); haptic('pick'); }}
        onAccessibleAction={() => accessibleCellAction(index)}
        ready={Boolean(item && state.orders.some((order) => !order.completed && order.targetId === item.definitionId))}
        reduceMotion={reduceMotion}
        selected={selectedCell === index}
        selectionActive={selectedCell != null}
        spawned={spawnedCell === index}
      />)}
    </View>

    <View style={styles.pantryRow}>
      <Pressable accessibilityRole="button" accessibilityLabel={nextPantry ? `Draw ${mergeItemDefinition(nextPantry.definitionId).name} from pantry` : 'Pantry empty'} disabled={!nextPantry} onPress={spawn} style={({ pressed }) => [styles.pantry, !nextPantry && styles.disabled, pressed && styles.pressed]}>
        <View style={styles.pantryIcon}><IconSymbol name="plus" size={19} color={Lantern.emberInk} /></View>
        <View style={styles.pantryCopy}>
          <ThemedText style={styles.pantryTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{nextPantry ? 'Draw from pantry' : 'Pantry empty'}</ThemedText>
          <ThemedText style={styles.pantryMeta} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>{state.pantry.length} ITEMS LEFT</ThemedText>
        </View>
        {nextPantry ? <FoodArt item={mergeItemDefinition(nextPantry.definitionId)} size={44} /> : null}
      </Pressable>
      <Pressable accessibilityLabel="Leave Merge Feast" accessibilityRole="button" onPress={confirmReset} style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}><IconSymbol name="xmark" size={17} color={Lantern.moon300} /></Pressable>
    </View>
  </View>;
}

function MergeCell({ item, index, cellSize, merged, invalid, ready, reduceMotion, selected, selectionActive, compatible, dragging, emptyTarget, hovered, spawned, dropOffset, onDrop, onDragFinish, onDragOver, onPick, onAccessibleAction }: {
  item: MergeBoardItem | null; index: number; cellSize: number; merged: boolean; invalid: boolean; ready: boolean; reduceMotion: boolean; selected: boolean; selectionActive: boolean; compatible: boolean; dragging: boolean; emptyTarget: boolean; hovered: boolean; spawned: boolean; dropOffset: { offsetX: number; offsetY: number } | null;
  onDrop: (index: number, dx: number, dy: number, absoluteX: number, absoluteY: number) => void; onDragFinish: () => void; onDragOver: (absoluteX: number, absoluteY: number) => void; onPick: () => void; onAccessibleAction: () => void;
}) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const scale = useSharedValue(1);
  const landingScale = useSharedValue(1);
  const dropX = useSharedValue(dropOffset?.offsetX ?? 0);
  const dropY = useSharedValue(dropOffset?.offsetY ?? 0);
  useEffect(() => {
    if (!spawned || reduceMotion) {
      landingScale.value = 1;
      return;
    }
    landingScale.value = 0.97;
    landingScale.value = withDelay(130, withSequence(
      withTiming(1.045, { duration: 85, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 105, easing: Easing.out(Easing.quad) }),
    ));
  }, [landingScale, reduceMotion, spawned]);
  useEffect(() => {
    if (!dropOffset || reduceMotion) {
      dropX.value = 0;
      dropY.value = 0;
      return;
    }
    dropX.value = dropOffset.offsetX;
    dropY.value = dropOffset.offsetY;
    const easing = Easing.out(Easing.cubic);
    dropX.value = withTiming(0, { duration: 115, easing });
    dropY.value = withTiming(0, { duration: 115, easing });
  }, [dropOffset, dropX, dropY, reduceMotion]);
  const gesture = Gesture.Pan()
    .enabled(Boolean(item))
    .minDistance(5)
    .onBegin(() => {
      scale.value = withTiming(1.035, { duration: reduceMotion ? 40 : 75, easing: Easing.out(Easing.cubic) });
      runOnJS(onPick)();
    })
    .onUpdate((event) => {
      x.value = event.translationX;
      y.value = event.translationY;
      runOnJS(onDragOver)(event.absoluteX, event.absoluteY);
    })
    .onEnd((event) => {
      runOnJS(onDrop)(index, event.translationX, event.translationY, event.absoluteX, event.absoluteY);
    })
    .onFinalize(() => {
      runOnJS(onDragFinish)();
      const settleDuration = reduceMotion ? 55 : 135;
      const releaseHold = reduceMotion ? 32 : 80;
      const settleEasing = Easing.out(Easing.cubic);
      // Keep the source tile at its exact final drag transform until the JS
      // board commit mounts the destination tile. This prevents a one-frame
      // flash back toward the source before a successful drop lands.
      x.value = withDelay(releaseHold, withTiming(0, { duration: settleDuration, easing: settleEasing }));
      y.value = withDelay(releaseHold, withTiming(0, { duration: settleDuration, easing: settleEasing }));
      scale.value = withDelay(releaseHold, reduceMotion
        ? withTiming(1, { duration: settleDuration, easing: settleEasing })
        : withSequence(
          withTiming(0.99, { duration: 55, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: 80, easing: settleEasing }),
        ));
    });
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }] }));
  const landingStyle = useAnimatedStyle(() => ({ transform: [{ translateX: dropX.value }, { translateY: dropY.value }, { scale: landingScale.value }] }));
  const definition = item ? mergeItemDefinition(item.definitionId) : null;
  const row = Math.floor(index / MERGE_BOARD_COLUMNS) + 1;
  const column = (index % MERGE_BOARD_COLUMNS) + 1;
  const actionLabel = selected ? 'Clear selection' : item ? ready ? 'Serve order' : 'Select item' : 'Move selected item here';
  return <View
    accessible={Boolean(item) || selectionActive}
    accessibilityActions={[{ name: 'activate', label: actionLabel }]}
    accessibilityLabel={definition ? `${definition.name}, tier ${definition.tier}, row ${row}, column ${column}${ready ? ', order ready' : ''}${selected ? ', selected' : ''}` : `Empty cell, row ${row}, column ${column}`}
    accessibilityRole="button"
    onAccessibilityAction={(event) => { if (event.nativeEvent.actionName === 'activate') onAccessibleAction(); }}
    style={[styles.cell, { height: cellSize, width: cellSize }, invalid && styles.cellInvalid, ready && styles.cellReady, selected && styles.cellSelected, compatible && styles.cellCompatible, emptyTarget && styles.cellEmptyTarget, spawned && styles.cellSpawned, hovered && styles.cellHovered, dragging && styles.cellDragging]}>
    {item && definition ? <GestureDetector gesture={gesture}>
      <Animated.View
        accessibilityHint={ready ? 'Drag upward to serve, or drag onto an identical item to merge.' : 'Drag onto an identical item to merge or an empty space to move.'}
        accessible={false}
        entering={dropOffset && !reduceMotion
          ? FadeIn.duration(30)
          : spawned && !reduceMotion
          ? SlideInDown.duration(175).easing(Easing.out(Easing.cubic))
          : FadeIn.duration(reduceMotion ? 60 : 90).easing(Easing.out(Easing.cubic))}
        exiting={FadeOut.duration(reduceMotion ? 60 : 130)}
        style={[styles.dragItem, animatedStyle]}>
        <Animated.View style={[styles.landingItem, landingStyle]}>
          <FoodArt bare item={definition} size={cellSize - 4} />
        </Animated.View>
      </Animated.View>
    </GestureDetector> : null}
    {merged && !reduceMotion ? <MergeCelebration size={cellSize} /> : null}
  </View>;
}

function FoodArt({ item, size, bare = false }: { item: ReturnType<typeof mergeItemDefinition>; size: number; bare?: boolean }) {
  const presentation = CHAIN_STYLE[item.chainId];
  return <View style={[
    styles.foodArt,
    { height: size, width: size },
    bare ? styles.foodArtBare : { backgroundColor: `${presentation.color}20`, borderColor: `${presentation.color}55` },
  ]}>
    <Image source={FEASTLE_MERGE_ART[item.artKey]} contentFit="contain" transition={80} style={[styles.foodImage, bare && styles.foodImageBare]} />
    <View style={[styles.tierBadge, { backgroundColor: presentation.color }]}><ThemedText style={styles.tierText} lightColor={Lantern.emberInk} darkColor={Lantern.emberInk}>{item.tier}</ThemedText></View>
  </View>;
}

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
  root: { flex: 1, gap: 10, justifyContent: 'space-between', minHeight: 0, paddingHorizontal: 2 },
  topLine: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  kicker: { fontSize: 10.5, fontWeight: '900', letterSpacing: 1.1 },
  actionPill: { alignItems: 'baseline', backgroundColor: 'rgba(201,194,232,0.08)', borderCurve: 'continuous', borderRadius: 999, flexDirection: 'row', gap: 5, paddingHorizontal: 12, paddingVertical: 6 },
  actionPillWarning: { backgroundColor: 'rgba(242,163,139,0.10)' },
  actionNumber: { fontSize: 16, fontVariant: ['tabular-nums'], fontWeight: '900' },
  actionLabel: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.8 },
  orders: { flexDirection: 'row', gap: 8 },
  order: { alignItems: 'center', backgroundColor: 'rgba(201,194,232,0.07)', borderColor: 'rgba(201,194,232,0.12)', borderCurve: 'continuous', borderRadius: 17, borderWidth: 1, flex: 1, flexDirection: 'row', gap: 8, minHeight: 64, padding: 7 },
  orderReady: { backgroundColor: 'rgba(255,195,107,0.10)', borderColor: 'rgba(255,195,107,0.55)' },
  orderComplete: { backgroundColor: 'rgba(125,232,205,0.08)', borderColor: 'rgba(125,232,205,0.34)' },
  orderCopy: { flex: 1, gap: 2, minWidth: 0 },
  orderName: { fontSize: 11.5, fontWeight: '900' },
  orderStatus: { fontSize: 8, fontWeight: '900', letterSpacing: 0.55 },
  board: { alignSelf: 'center', backgroundColor: '#171217', borderColor: 'rgba(255,195,107,0.18)', borderCurve: 'continuous', borderRadius: 24, borderWidth: 1, flexDirection: 'row', flexWrap: 'wrap', overflow: 'hidden', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 14px 30px rgba(8,5,10,0.34)' },
  cell: { alignItems: 'center', backgroundColor: '#241B23', borderColor: 'rgba(255,255,255,0.052)', borderCurve: 'continuous', borderRadius: 12, borderWidth: 1, justifyContent: 'center', overflow: 'visible', position: 'relative', zIndex: 0 },
  cellReady: { borderColor: 'rgba(255,195,107,0.56)', backgroundColor: '#2C2022' },
  cellSelected: { borderColor: Lantern.auroraTeal, backgroundColor: 'rgba(125,232,205,0.10)' },
  cellCompatible: { borderColor: 'rgba(255,195,107,0.76)', backgroundColor: 'rgba(255,195,107,0.12)', boxShadow: 'inset 0 0 12px rgba(255,195,107,0.10)' },
  cellEmptyTarget: { borderColor: 'rgba(255,255,255,0.10)' },
  cellSpawned: { backgroundColor: 'rgba(190,255,112,0.09)', borderColor: 'rgba(190,255,112,0.62)', boxShadow: 'inset 0 0 14px rgba(190,255,112,0.12)' },
  cellHovered: { backgroundColor: 'rgba(246,243,255,0.12)', borderColor: 'rgba(246,243,255,0.90)', boxShadow: 'inset 0 0 0 1px rgba(246,243,255,0.24), 0 0 12px rgba(125,232,205,0.22)', zIndex: 2 },
  cellDragging: { borderColor: 'rgba(255,225,174,0.48)', zIndex: 1000 },
  cellInvalid: { borderColor: 'rgba(242,163,139,0.8)', backgroundColor: 'rgba(242,163,139,0.10)' },
  dragItem: { alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1001 },
  landingItem: { alignItems: 'center', justifyContent: 'center' },
  foodArt: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 16, borderWidth: 1, justifyContent: 'center' },
  foodImage: { height: '92%', width: '92%' },
  foodArtBare: { backgroundColor: 'transparent', borderRadius: 0, borderWidth: 0 },
  foodImageBare: { height: '100%', width: '100%' },
  tierBadge: { alignItems: 'center', borderRadius: 999, bottom: 3, height: 17, justifyContent: 'center', position: 'absolute', right: 3, width: 17 },
  tierText: { fontSize: 9, fontWeight: '900' },
  pantryRow: { flexDirection: 'row', gap: 8 },
  pantry: { alignItems: 'center', backgroundColor: 'rgba(255,195,107,0.08)', borderColor: 'rgba(255,195,107,0.22)', borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, flex: 1, flexDirection: 'row', gap: 10, minHeight: 58, paddingHorizontal: 10 },
  pantryIcon: { alignItems: 'center', backgroundColor: Lantern.ember300, borderRadius: 12, height: 34, justifyContent: 'center', width: 34 },
  pantryCopy: { flex: 1, gap: 2 },
  pantryTitle: { fontSize: 12.5, fontWeight: '900' },
  pantryMeta: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.7 },
  cancel: { alignItems: 'center', borderColor: 'rgba(201,194,232,0.16)', borderRadius: 18, borderWidth: 1, justifyContent: 'center', width: 54 },
  burst: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 3 },
  mergeHalo: { backgroundColor: 'rgba(255,195,107,0.30)', borderRadius: 999, position: 'absolute' },
  mergeRing: { borderColor: 'rgba(255,225,174,0.92)', borderRadius: 999, borderWidth: 2, position: 'absolute' },
  crumb: { backgroundColor: '#FFE1AE', borderRadius: 999, height: 5, position: 'absolute', width: 5, boxShadow: '0 1px 4px rgba(255,195,107,0.42)' },
  best: { fontSize: 9.5, fontWeight: '900', letterSpacing: 0.7, paddingTop: 4 },
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});
