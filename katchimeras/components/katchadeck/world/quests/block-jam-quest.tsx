import { BlurMask, Canvas, Group, LinearGradient, Path, RoundedRect, vec } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, type SharedValue, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import {
  BLOCK_JAM_RULESET,
  availableBlockJamDoor,
  blockJamDoorAtAnchor,
  blockJamLevel,
  blockJamPath,
  blockJamReducer,
  createBlockJamState,
  nearestBlockJamPieceAtPoint,
  type BlockJamAnchor,
  type BlockJamBlockDefinition,
  type BlockJamColorId,
  type BlockJamDoor,
  type BlockJamLevel,
  type BlockJamState,
} from '@/utils/quests/experiences/block-jam';
import type { QuestResult } from '@/utils/quests/experiences/types';
import { blockJamDragAnchorAtPose, blockJamDragExitAtPose, createBlockJamDragContext, resolveBlockJamDrag } from '@/utils/quests/experiences/block-jam-drag';
import { blockJamSilhouettePath } from '@/utils/quests/experiences/block-jam-silhouette';
import { QuestExperiencePreview } from './quest-experience-ui';
import { TaskletBlockJamResultScreen, TaskletBlockJamScreen } from './tasklet-block-jam-screen';

type Config = { packId: 'tasklet-desk'; rulesetId?: string; tier: 1 | 2 | 3; levelId: string; timeLimitMs?: number; parMoves?: number };
type Props = { config: Config; best?: { movesUsed: number; durationMs: number } | null; onAttemptStart: (config: Record<string, unknown>) => string; onAttemptCancel: (id: string) => void; onComplete: (id: string, result: QuestResult) => void; onRequestExit?: () => void; onRunningChange: (running: boolean, id?: string | null) => void };
type BlockJamPieceHandle = {
  beginDrag: () => void;
  updateDrag: (translationX: number, translationY: number) => void;
  endDrag: (translationX: number, translationY: number) => void;
  cancelDrag: () => void;
};
type BrickPieceProps = {
  level: BlockJamLevel;
  state: BlockJamState;
  block: BlockJamBlockDefinition;
  anchor: BlockJamAnchor;
  cell: number;
  gap: number;
  outer: number;
  index: number;
  selected: boolean;
  visible: boolean;
  reduceMotion: boolean;
  onAccessibilitySelect: () => void;
  onCollision: () => void;
  onMove: (anchor: BlockJamAnchor) => void;
  onExit: (door: BlockJamDoor, options?: { entryAnchor?: BlockJamAnchor; start?: { x: number; y: number } }) => void;
};

const COLORS: Record<BlockJamColorId, { bright: string; mid: string; deep: string; label: string }> = {
  red: { bright: '#FFB19D', mid: '#EF796B', deep: '#A84149', label: 'coral' },
  violet: { bright: '#D4B5FF', mid: '#9B72E8', deep: '#57419F', label: 'violet' },
  cyan: { bright: '#9AE9DA', mid: '#52C6B6', deep: '#267B77', label: 'cyan' },
  lime: { bright: '#C9EDA2', mid: '#89C965', deep: '#477F47', label: 'lime' },
  blue: { bright: '#A9C8FF', mid: '#719BE8', deep: '#3D579E', label: 'blue' },
  amber: { bright: '#FFE39A', mid: '#F4B855', deep: '#B46828', label: 'amber' },
};

const SHRED_DURATION_MS = 1_000;
const SHRED_PULSE_OFFSETS_MS = [0, 200, 400, 600, 800] as const;
const SHRED_PARTICLES_PER_PULSE = 8;

export function BlockJamQuest(props: Props) {
  const { config, best = null, onAttemptStart, onAttemptCancel, onComplete, onRequestExit, onRunningChange } = props;
  const level = useMemo(() => blockJamLevel(config.levelId), [config.levelId]);
  const [state, setState] = useState(() => createBlockJamState(level));
  const [started, setStarted] = useState(false);
  const [boardReady, setBoardReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bursts, setBursts] = useState<{ block: BlockJamBlockDefinition; door: BlockJamDoor; start: { x: number; y: number } }[]>([]);
  const attempt = useRef<string | null>(null); const startedAt = useRef(0); const finishedAt = useRef(0); const deadline = useRef(0);
  const exitTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const exitingBlockIds = useRef(new Set<string>());
  const stateRef = useRef(state);
  const selectedIdRef = useRef(selectedId);
  const pieceHandles = useRef(new Map<string, BlockJamPieceHandle>());
  const touchBlockId = useRef<string | null>(null);
  const touchChangedSelection = useRef(false);
  const dragStarted = useRef(false);
  const dragEnded = useRef(false);
  const reduceMotion = useReducedMotion(); const { width, height } = useWindowDimensions();
  const compact = height < 740;
  const outer = compact ? 20 : 22; const gap = 2;
  const maxBoard = Math.min(width - 22, 500, Math.max(264, height - (compact ? 260 : 300)));
  const cell = Math.max(25, Math.floor((maxBoard - outer * 2 - gap * (level.columns - 1)) / level.columns));
  const pitch = cell + gap; const gridWidth = level.columns * cell + (level.columns - 1) * gap; const gridHeight = level.rows * cell + (level.rows - 1) * gap;
  const boardWidth = gridWidth + outer * 2; const boardHeight = gridHeight + outer * 2;
  const exit = selectedId ? availableBlockJamDoor(level, state, selectedId) : null;

  useEffect(() => {
    if (!started) { setBoardReady(false); return; }
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setBoardReady(true));
    });
    return () => { cancelAnimationFrame(firstFrame); if (secondFrame) cancelAnimationFrame(secondFrame); };
  }, [started]);

  useEffect(() => () => {
    exitTimers.current.forEach(clearTimeout);
    exitTimers.current = [];
  }, []);

  stateRef.current = state;
  selectedIdRef.current = selectedId;

  const haptic = useCallback((kind: 'pick' | 'move' | 'collision' | 'shred' | 'warning') => {
    if (process.env.EXPO_OS !== 'ios') return;
    if (kind === 'pick') void Haptics.selectionAsync();
    else if (kind === 'move' || kind === 'collision' || kind === 'shred') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, []);
  const start = () => { const now = Date.now(); attempt.current = onAttemptStart({ ...config, rulesetId: BLOCK_JAM_RULESET, levelId: level.id, timeLimitMs: level.timeLimitMs, parMoves: level.parMoves }); startedAt.current = now; deadline.current = now + level.timeLimitMs; setStarted(true); onRunningChange(true, attempt.current); };
  const reset = () => { const now = Date.now(); exitTimers.current.forEach(clearTimeout); exitTimers.current = []; exitingBlockIds.current.clear(); setState(createBlockJamState(level)); setSelectedId(null); setBursts([]); if (started) { startedAt.current = now; deadline.current = now + level.timeLimitMs; } };
  const timeout = useCallback(() => {
    setState((current) => blockJamReducer(level, current, { type: 'timeout' }));
  }, [level]);
  const leave = () => { if (attempt.current) onAttemptCancel(attempt.current); attempt.current = null; reset(); setStarted(false); onRunningChange(false); };
  const move = (blockId: string, anchor: BlockJamAnchor) => setState((current) => {
    const next = blockJamReducer(level, current, { type: 'move', blockId, anchor });
    if (next === current) { haptic('warning'); return current; }
    haptic('move'); void AccessibilityInfo.announceForAccessibility(`Move ${next.movesUsed}.`); return next;
  });
  const clear = (blockId: string, door: BlockJamDoor, options?: { entryAnchor?: BlockJamAnchor; start?: { x: number; y: number } }) => {
    if (state.status !== 'playing' || exitingBlockIds.current.has(blockId)) return;
    const block = level.blocks.find((candidate) => candidate.id === blockId); if (!block) return;
    const currentAnchor = state.anchors[blockId];
    const exitAnchor = options?.entryAnchor ?? currentAnchor;
    const lockedStart = { x: outer + exitAnchor.column * pitch, y: outer + exitAnchor.row * pitch };
    const releasedAt = options?.start ?? lockedStart;
    const start = door.edge === 'left' || door.edge === 'right'
      ? { x: releasedAt.x, y: lockedStart.y }
      : { x: lockedStart.x, y: releasedAt.y };
    exitingBlockIds.current.add(blockId);
    setState((current) => {
      const positioned = options?.entryAnchor ? blockJamReducer(level, current, { type: 'move', blockId, anchor: options.entryAnchor }) : current;
      const next = blockJamReducer(level, positioned, { type: 'exit', blockId, doorId: door.id });
      if (next === positioned) {
        exitingBlockIds.current.delete(blockId);
        return current;
      }
      if (next.status === 'won') finishedAt.current = Date.now();
      return next;
    });
    setBursts((current) => [...current, { block, door, start }]); setSelectedId(null);
    SHRED_PULSE_OFFSETS_MS.forEach((offset) => {
      if (offset === 0) haptic('shred');
      else exitTimers.current.push(setTimeout(() => haptic('shred'), offset));
    });
    exitTimers.current.push(setTimeout(() => {
      exitingBlockIds.current.delete(blockId);
      setBursts((current) => current.filter((candidate) => candidate.block.id !== blockId));
    }, SHRED_DURATION_MS + 40));
  };
  const undo = () => { setState((current) => blockJamReducer(level, current, { type: 'undo' })); setSelectedId(null); };
  const selectNearestPiece = useCallback((x: number, y: number) => {
    const blockId = nearestBlockJamPieceAtPoint(level, stateRef.current, { x, y }, { cell, gap, outer });
    const changed = Boolean(blockId && blockId !== selectedIdRef.current);
    if (changed) {
      selectedIdRef.current = blockId;
      setSelectedId(blockId);
      haptic('pick');
    }
    return { blockId, changed };
  }, [cell, gap, haptic, level, outer]);
  const boardGesture = useMemo(() => Gesture.Pan()
    .maxPointers(1)
    .minDistance(6)
    .runOnJS(true)
    .onTouchesDown((event) => {
      const touch = event.allTouches[0];
      const target = touch ? selectNearestPiece(outer + touch.x, outer + touch.y) : { blockId: null, changed: false };
      touchBlockId.current = target.blockId;
      touchChangedSelection.current = target.changed;
      dragStarted.current = false;
      dragEnded.current = false;
    })
    .onStart(() => {
      const blockId = touchBlockId.current;
      if (!blockId) return;
      dragStarted.current = true;
      if (!touchChangedSelection.current) haptic('pick');
      pieceHandles.current.get(blockId)?.beginDrag();
    })
    .onUpdate((event) => {
      const blockId = touchBlockId.current;
      if (!blockId || !dragStarted.current) return;
      pieceHandles.current.get(blockId)?.updateDrag(event.translationX, event.translationY);
    })
    .onEnd((event) => {
      const blockId = touchBlockId.current;
      if (!blockId || !dragStarted.current) return;
      dragEnded.current = true;
      pieceHandles.current.get(blockId)?.endDrag(event.translationX, event.translationY);
    })
    .onFinalize(() => {
      const blockId = touchBlockId.current;
      if (blockId && dragStarted.current && !dragEnded.current) pieceHandles.current.get(blockId)?.cancelDrag();
      touchBlockId.current = null;
      touchChangedSelection.current = false;
      dragStarted.current = false;
      dragEnded.current = false;
    }), [haptic, outer, selectNearestPiece]);

  if (!started) return <Preview level={level} best={best} onStart={start} />;
  if (state.status === 'won' && bursts.length === 0 && attempt.current) {
    const durationMs = Math.max(0, (finishedAt.current || Date.now()) - startedAt.current);
    const personalBest = !best || durationMs < best.durationMs || (durationMs === best.durationMs && state.movesUsed < best.movesUsed);
    const result: QuestResult = { kind: 'block_jam', success: true, rulesetId: BLOCK_JAM_RULESET, packId: 'tasklet-desk', levelId: level.id, blocksCleared: state.clearedBlockIds.length, totalBlocks: level.blocks.length, movesUsed: state.movesUsed, timeLimitMs: level.timeLimitMs, parMoves: level.parMoves, undoCount: state.undoCount, durationMs, personalBest };
    return <TaskletBlockJamResultScreen
      blocks={state.clearedBlockIds.length}
      completionTime={formatCountdown(Math.max(0, Math.round(durationMs / 1000)))}
      firstClear={!best}
      moves={state.movesUsed}
      onClose={onRequestExit ?? leave}
      onComplete={() => onComplete(attempt.current!, result)}
      personalBest={personalBest}
      undos={state.undoCount}
    />;
  }

  const instruction = state.status === 'failed'
    ? 'Time’s up. Restart for a fresh clock and another try.'
    : selectedId
      ? 'Move the selected block through open cells toward its matching rail.'
      : state.clearedBlockIds.length
        ? 'Good sorting. Keep matching each color to its glowing rail.'
        : 'Drag connected blocks. Match each color to its glowing rail.';

  return <TaskletBlockJamScreen
    failed={state.status === 'failed'}
    instruction={instruction}
    onClose={onRequestExit ?? leave}
    deadlineMs={deadline.current}
    onExpire={timeout}
    onRestart={reset}
    onUndo={undo}
    sorted={state.clearedBlockIds.length}
    tier={level.tier}
    total={level.blocks.length}
    undoDisabled={!state.history.length || state.status !== 'playing'}>
    <View
      pointerEvents={state.status === 'playing' ? 'auto' : 'none'}
      style={[styles.board, { width: boardWidth, height: boardHeight }]}>
      <BoardSurface level={level} cell={cell} gap={gap} outer={outer} width={boardWidth} height={boardHeight} />
      {level.doors.map((door) => <ExitRail key={door.id} door={door} cell={cell} pitch={pitch} outer={outer} boardWidth={boardWidth} boardHeight={boardHeight} active={exit?.id === door.id} exiting={bursts.some((burst) => burst.door.id === door.id)} onPress={() => selectedId && exit?.id === door.id && clear(selectedId, door)} reduceMotion={reduceMotion} />)}
      {level.blocks.map((block, index) => state.clearedBlockIds.includes(block.id) ? null : <BrickPiece
        key={block.id}
        ref={(handle) => {
          if (handle) pieceHandles.current.set(block.id, handle);
          else pieceHandles.current.delete(block.id);
        }}
        level={level}
        state={state}
        block={block}
        anchor={state.anchors[block.id]}
        cell={cell}
        gap={gap}
        outer={outer}
        index={index}
        selected={selectedId === block.id}
        visible={boardReady}
        reduceMotion={reduceMotion}
        onAccessibilitySelect={() => {
          if (selectedIdRef.current === block.id) return;
          selectedIdRef.current = block.id;
          setSelectedId(block.id);
          haptic('pick');
        }}
        onCollision={() => haptic('collision')}
        onMove={(anchor) => move(block.id, anchor)}
        onExit={(door, exitOptions) => clear(block.id, door, exitOptions)}
      />)}
      {bursts.map((burst) => <ShredExitEffect key={burst.block.id} block={burst.block} door={burst.door} start={burst.start} cell={cell} gap={gap} pitch={pitch} outer={outer} boardWidth={boardWidth} boardHeight={boardHeight} reduceMotion={reduceMotion} />)}
      <GestureDetector gesture={boardGesture}>
        <View
          accessible={false}
          pointerEvents={boardReady ? 'auto' : 'none'}
          style={{ backgroundColor: 'transparent', height: gridHeight, left: outer, position: 'absolute', top: outer, width: gridWidth, zIndex: 70 }}
        />
      </GestureDetector>
    </View>
  </TaskletBlockJamScreen>;
}

const BoardSurface = memo(function BoardSurface({ level, cell, gap, outer, width, height }: { level: BlockJamLevel; cell: number; gap: number; outer: number; width: number; height: number }) {
  const pitch = cell + gap;
  return <Canvas style={StyleSheet.absoluteFill}>
    <RoundedRect x={0} y={0} width={width} height={height} r={25} color="#9A5F2D" />
    <RoundedRect x={2} y={2} width={width - 4} height={height - 4} r={23}><LinearGradient start={vec(0, 0)} end={vec(width, height)} colors={['#FFE6AF', '#DFA35A', '#B96F31']} /></RoundedRect>
    <RoundedRect x={7} y={7} width={width - 14} height={height - 14} r={19} color="#5A3544" />
    <RoundedRect x={10} y={10} width={width - 20} height={height - 20} r={17}><LinearGradient start={vec(0, 0)} end={vec(width, height)} colors={['#684154', '#3D293E', '#2B2032']} /></RoundedRect>
    <RoundedRect x={outer - 6} y={outer - 6} width={level.columns * pitch - gap + 12} height={level.rows * pitch - gap + 12} r={13} color="#291D30" />
    {Array.from({ length: level.rows * level.columns }, (_, index) => { const x = outer + (index % level.columns) * pitch; const y = outer + Math.floor(index / level.columns) * pitch; const fixed = level.fixedCells.includes(index); return <Group key={index}><RoundedRect x={x} y={y} width={cell} height={cell} r={Math.max(5, cell * .17)} color={fixed ? '#604E61' : '#493448'} />{fixed ? <RoundedRect x={x + 2} y={y + 2} width={cell - 4} height={cell * .38} r={Math.max(3, cell * .12)} color="#756276" /> : <RoundedRect x={x + 2} y={y + 2} width={cell - 4} height={2} r={1} color="#FFFFFF" opacity={.05} />}</Group>; })}
  </Canvas>;
});

const BrickPiece = forwardRef<BlockJamPieceHandle, BrickPieceProps>(function BrickPiece({ level, state, block, anchor, cell, gap, outer, index, selected, visible, reduceMotion, onAccessibilitySelect, onCollision, onMove, onExit }, ref) {
  const pitch = cell + gap; const columns = Math.max(...block.cells.map((part) => part.column)) + 1; const rows = Math.max(...block.cells.map((part) => part.row)) + 1;
  const x = useSharedValue(outer + anchor.column * pitch); const y = useSharedValue(outer + anchor.row * pitch); const dx = useSharedValue(0); const dy = useSharedValue(0); const scale = useSharedValue(1); const intro = useSharedValue(0); const highlight = useSharedValue(selected ? 1 : 0); const contactKey = useSharedValue(''); const impactX = useSharedValue(0); const impactY = useSharedValue(0); const dragAnchorRow = useSharedValue(anchor.row); const dragAnchorColumn = useSharedValue(anchor.column); const dragExiting = useSharedValue(0);
  const collisionContext = useMemo(() => createBlockJamDragContext(level, state, block, anchor, { cell, gap, outer }), [anchor, block, cell, gap, level, outer, state]);
  useEffect(() => {
    intro.value = visible
      ? withDelay(reduceMotion ? 0 : index * 14, withTiming(1, { duration: reduceMotion ? 40 : 150, easing: Easing.out(Easing.cubic) }))
      : 0;
  }, [index, intro, reduceMotion, visible]);
  useEffect(() => {
    highlight.value = withTiming(selected ? 1 : 0, { duration: reduceMotion ? 30 : selected ? 140 : 90, easing: Easing.out(Easing.cubic) });
  }, [highlight, reduceMotion, selected]);
  useEffect(() => {
    const nextX = outer + anchor.column * pitch; const nextY = outer + anchor.row * pitch;
    x.value = nextX; y.value = nextY; dx.value = 0; dy.value = 0; dragAnchorRow.value = anchor.row; dragAnchorColumn.value = anchor.column;
  }, [anchor.column, anchor.row, dragAnchorColumn, dragAnchorRow, dx, dy, outer, pitch, x, y]);
  const finishDrag = (target: BlockJamAnchor, resolvedX: number, resolvedY: number, fingerX: number, fingerY: number) => {
    const changedAnchor = target.row !== anchor.row || target.column !== anchor.column;
    if (changedAnchor && !blockJamPath(level, state, block.id, target)) {
      dx.value = withSpring(0, { damping: 20, stiffness: 320 });
      dy.value = withSpring(0, { damping: 20, stiffness: 320 });
      return;
    }
    const targetDoor = blockJamDoorAtAnchor(level, state, block.id, target);
    const outward = targetDoor && (
      (targetDoor.edge === 'left' && fingerX < resolvedX - pitch * .15) ||
      (targetDoor.edge === 'right' && fingerX > resolvedX + pitch * .15) ||
      (targetDoor.edge === 'top' && fingerY < resolvedY - pitch * .15) ||
      (targetDoor.edge === 'bottom' && fingerY > resolvedY + pitch * .15)
    );
    if (targetDoor && outward) onExit(targetDoor, { entryAnchor: target, start: { x: x.value + resolvedX, y: y.value + resolvedY } });
    else if (changedAnchor) onMove(target);
  };
  const beginDrag = () => {
    dragExiting.value = 0;
    contactKey.value = '';
    scale.value = withTiming(1.025, { duration: 65, easing: Easing.out(Easing.cubic) });
  };
  const updateDrag = (translationX: number, translationY: number) => {
    if (dragExiting.value) return;
    const resolved = resolveBlockJamDrag(collisionContext, { x: dx.value, y: dy.value }, { x: translationX, y: translationY });
    dx.value = resolved.x; dy.value = resolved.y;
    const reachedAnchor = blockJamDragAnchorAtPose(collisionContext, resolved);
    if (reachedAnchor) { dragAnchorRow.value = reachedAnchor.row; dragAnchorColumn.value = reachedAnchor.column; }
    const exitCandidate = blockJamDragExitAtPose(level, state, block.id, collisionContext, resolved);
    if (exitCandidate) {
      dragExiting.value = 1;
      scale.value = withTiming(1, { duration: 70, easing: Easing.out(Easing.cubic) });
      onExit(exitCandidate.door, {
        entryAnchor: exitCandidate.anchor,
        start: { x: x.value + resolved.x, y: y.value + resolved.y },
      });
      return;
    }
    const nextContact = resolved.contactKey ? `${resolved.contactKey}:${resolved.contactAxis}` : '';
    if (nextContact && nextContact !== contactKey.value) {
      if (!reduceMotion) {
        if (resolved.contactAxis === 'x') impactX.value = withSequence(withTiming(1, { duration: 30 }), withSpring(0, { damping: 16, stiffness: 360 }));
        else impactY.value = withSequence(withTiming(1, { duration: 30 }), withSpring(0, { damping: 16, stiffness: 360 }));
      }
      onCollision();
    }
    contactKey.value = nextContact;
  };
  const endDrag = (translationX: number, translationY: number) => {
    if (dragExiting.value) return;
    const resolvedX = dx.value; const resolvedY = dy.value;
    const target = { row: dragAnchorRow.value, column: dragAnchorColumn.value };
    const snappedX = (target.column - anchor.column) * pitch;
    const snappedY = (target.row - anchor.row) * pitch;
    dx.value = reduceMotion ? snappedX : withSpring(snappedX, { damping: 20, stiffness: 320 });
    dy.value = reduceMotion ? snappedY : withSpring(snappedY, { damping: 20, stiffness: 320 });
    finishDrag(target, resolvedX, resolvedY, translationX, translationY);
    scale.value = withTiming(1, { duration: 90, easing: Easing.out(Easing.cubic) });
  };
  const cancelDrag = () => {
    if (!dragExiting.value) {
      dx.value = withSpring(0, { damping: 20, stiffness: 320 });
      dy.value = withSpring(0, { damping: 20, stiffness: 320 });
    }
    scale.value = withTiming(1, { duration: 90, easing: Easing.out(Easing.cubic) });
  };
  useImperativeHandle(ref, () => ({ beginDrag, updateDrag, endDrag, cancelDrag }));
  const style = useAnimatedStyle(() => ({ opacity: intro.value, transform: [{ translateX: x.value + dx.value }, { translateY: y.value + dy.value + (1 - intro.value) * 6 }, { scaleX: scale.value * (1 - impactX.value * .014) }, { scaleY: scale.value * (1 - impactY.value * .014) }] }));
  const highlightStyle = useAnimatedStyle(() => ({ opacity: highlight.value, transform: [{ scale: .97 + highlight.value * .03 }] }));
  return <Animated.View
    accessible
    accessibilityRole="button"
    accessibilityState={{ selected }}
    accessibilityLabel={`${COLORS[block.colorId].label} block, ${block.cells.length} cells`}
    accessibilityHint="Select this block"
    onAccessibilityTap={onAccessibilitySelect}
    pointerEvents="none"
    style={[styles.piece, { width: columns * pitch - gap, height: rows * pitch - gap, zIndex: selected ? 50 : 10 }, style]}>
    <BrickArt block={block} cell={cell} gap={gap} />
    {selected ? <Animated.View pointerEvents="none" style={[styles.silhouetteHighlight, { height: rows * pitch - gap + 16, width: columns * pitch - gap + 16 }, highlightStyle]}><SelectionSilhouette block={block} cell={cell} gap={gap} /></Animated.View> : null}
  </Animated.View>;
});

function BrickArt({ block, cell, gap }: { block: BlockJamBlockDefinition; cell: number; gap: number }) {
  const pitch = cell + gap; const columns = Math.max(...block.cells.map((part) => part.column)) + 1; const rows = Math.max(...block.cells.map((part) => part.row)) + 1; const palette = COLORS[block.colorId];
  return <Canvas style={{ width: columns * pitch - gap, height: rows * pitch - gap }}>
    {block.cells.map((part, index) => { const x = part.column * pitch; const y = part.row * pitch; return <Group key={index}>
      <RoundedRect x={x} y={y} width={cell} height={cell} r={Math.max(5, cell * .17)} color={palette.deep} />
      <RoundedRect x={x + 2} y={y + 2} width={cell - 4} height={cell - 5} r={Math.max(4, cell * .14)}><LinearGradient start={vec(x, y)} end={vec(x, y + cell)} colors={[palette.bright, palette.mid, palette.deep]} positions={[0, .48, 1]} /></RoundedRect>
      <RoundedRect x={x + cell * .14} y={y + cell * .12} width={cell * .72} height={cell * .3} r={cell * .12} color="#FFFFFF" opacity={.17} />
    </Group>; })}
  </Canvas>;
}

function SelectionSilhouette({ block, cell, gap }: { block: BlockJamBlockDefinition; cell: number; gap: number }) {
  const padding = 8; const pitch = cell + gap;
  const columns = Math.max(...block.cells.map((part) => part.column)) + 1; const rows = Math.max(...block.cells.map((part) => part.row)) + 1;
  const width = columns * pitch - gap; const height = rows * pitch - gap; const palette = COLORS[block.colorId];
  const path = useMemo(() => blockJamSilhouettePath(block.cells, { pitch, width, height, padding, radius: Math.max(5, cell * .17) }), [block.cells, cell, height, pitch, width]);
  return <Canvas pointerEvents="none" style={{ height: height + padding * 2, width: width + padding * 2 }}>
    <Path path={path} color={palette.bright} opacity={.55} style="stroke" strokeCap="round" strokeJoin="round" strokeWidth={6}>
      <BlurMask blur={1.5} style="normal" />
    </Path>
    <Path path={path} color={palette.bright} style="stroke" strokeCap="round" strokeJoin="round" strokeWidth={4} />
    <Path path={path} color="#FFFFFF" opacity={.9} style="stroke" strokeCap="round" strokeJoin="round" strokeWidth={1.35} />
  </Canvas>;
}

function ExitRail({ door, cell, pitch, outer, boardWidth, boardHeight, active, exiting, onPress, reduceMotion }: { door: BlockJamDoor; cell: number; pitch: number; outer: number; boardWidth: number; boardHeight: number; active: boolean; exiting: boolean; onPress: () => void; reduceMotion: boolean }) {
  const energy = useSharedValue(exiting ? 1 : active ? .72 : .16);
  useEffect(() => {
    if (exiting) {
      energy.value = reduceMotion
        ? 1
        : withRepeat(withSequence(withTiming(.7, { duration: 100 }), withTiming(1, { duration: 100, easing: Easing.out(Easing.cubic) })), SHRED_PULSE_OFFSETS_MS.length, false);
    } else if (active && !reduceMotion) {
      energy.value = withRepeat(withSequence(withTiming(.55, { duration: 440 }), withTiming(.82, { duration: 440 })), -1, false);
    } else {
      energy.value = withTiming(active ? .72 : .16, { duration: reduceMotion ? 30 : 150, easing: Easing.out(Easing.cubic) });
    }
  }, [active, energy, exiting, reduceMotion]);
  const coreAnimated = useAnimatedStyle(() => ({ opacity: .48 + energy.value * .52, transform: [{ scale: 1 + energy.value * .035 }] }));
  const auraAnimated = useAnimatedStyle(() => ({ opacity: energy.value * .72, transform: [{ scale: .94 + energy.value * .12 }] }));
  const horizontal = door.edge === 'top' || door.edge === 'bottom'; const long = door.span * cell + (door.span - 1) * (pitch - cell); const palette = COLORS[door.colorId]; const position = horizontal ? { width: long, height: 16, left: outer + door.offset * pitch, top: door.edge === 'top' ? 4 : boardHeight - 20 } : { width: 16, height: long, left: door.edge === 'left' ? 4 : boardWidth - 20, top: outer + door.offset * pitch };
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !active }} accessibilityLabel={`${palette.label} exit`} disabled={!active} onPress={onPress} style={[styles.railHit, position, { zIndex: exiting ? 60 : 25 }]}>
    <Animated.View style={[styles.railAura, { backgroundColor: palette.bright, boxShadow: `0 0 18px ${palette.bright}` }, auraAnimated]} />
    <Animated.View style={[styles.rail, { borderColor: palette.bright, backgroundColor: palette.mid, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.55), 0 0 9px ${palette.bright}` }, coreAnimated]}><View style={styles.railSheen} /><ThemedText style={[styles.arrow, { transform: [{ rotate: door.edge === 'top' ? '0deg' : door.edge === 'right' ? '90deg' : door.edge === 'bottom' ? '180deg' : '-90deg' }] }]} lightColor="#FFFFFF" darkColor="#FFFFFF">↑</ThemedText></Animated.View>
  </Pressable>;
}

function ShredExitEffect({ block, door, start, cell, gap, pitch, outer, boardWidth, boardHeight, reduceMotion }: { block: BlockJamBlockDefinition; door: BlockJamDoor; start: { x: number; y: number }; cell: number; gap: number; pitch: number; outer: number; boardWidth: number; boardHeight: number; reduceMotion: boolean }) {
  const travel = useSharedValue(0); const opacity = useSharedValue(1); const particleTimeline = useSharedValue(0);
  const columns = Math.max(...block.cells.map((part) => part.column)) + 1; const rows = Math.max(...block.cells.map((part) => part.row)) + 1;
  const pieceWidth = columns * pitch - gap; const pieceHeight = rows * pitch - gap;
  const startX = start.x; const startY = start.y;
  const targetX = door.edge === 'left' ? Math.min(-pieceWidth - 10, startX - cell) : door.edge === 'right' ? Math.max(boardWidth + 10, startX + cell) : startX;
  const targetY = door.edge === 'top' ? Math.min(-pieceHeight - 10, startY - cell) : door.edge === 'bottom' ? Math.max(boardHeight + 10, startY + cell) : startY;
  const railLength = door.span * pitch - gap;
  const origin = door.edge === 'top' || door.edge === 'bottom'
    ? { x: outer + door.offset * pitch + railLength / 2, y: door.edge === 'top' ? 12 : boardHeight - 12 }
    : { x: door.edge === 'left' ? 12 : boardWidth - 12, y: outer + door.offset * pitch + railLength / 2 };
  const palette = COLORS[block.colorId];
  useEffect(() => {
    const travelDuration = reduceMotion ? 100 : 420;
    travel.value = withTiming(1, { duration: travelDuration, easing: Easing.in(Easing.cubic) });
    opacity.value = withDelay(Math.max(0, travelDuration - 90), withTiming(0, { duration: reduceMotion ? 80 : 160, easing: Easing.linear }));
    particleTimeline.value = withTiming(1, { duration: reduceMotion ? 320 : 1_080, easing: Easing.linear });
  }, [opacity, particleTimeline, reduceMotion, travel]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateX: startX + (targetX - startX) * travel.value }, { translateY: startY + (targetY - startY) * travel.value }, { scale: 1 - travel.value * .12 }] }));
  return <>
    <Animated.View pointerEvents="none" style={[styles.piece, { height: pieceHeight, width: pieceWidth, zIndex: 40 }, style]}><BrickArt block={block} cell={cell} gap={gap} /></Animated.View>
    {SHRED_PULSE_OFFSETS_MS.flatMap((delay, pulseIndex) => Array.from({ length: SHRED_PARTICLES_PER_PULSE }, (_, particleIndex) => <ShredParticle
      key={`${pulseIndex}-${particleIndex}`}
      color={[palette.bright, palette.mid, palette.deep][(pulseIndex + particleIndex) % 3]}
      delay={delay + particleIndex * 8}
      door={door}
      index={pulseIndex * SHRED_PARTICLES_PER_PULSE + particleIndex}
      origin={origin}
      timeline={particleTimeline}
      reduceMotion={reduceMotion}
    />))}
  </>;
}

function ShredParticle({ color, delay, door, index, origin, reduceMotion, timeline }: { color: string; delay: number; door: BlockJamDoor; index: number; origin: { x: number; y: number }; reduceMotion: boolean; timeline: SharedValue<number> }) {
  const size = 5 + (index * 7 % 7);
  const spread = ((index * 17 % 17) - 8) * (reduceMotion ? .45 : 2.6);
  const distance = reduceMotion ? 10 : 38 + (index * 13 % 44);
  const outwardX = door.edge === 'left' ? -distance : door.edge === 'right' ? distance : spread;
  const outwardY = door.edge === 'top' ? -distance : door.edge === 'bottom' ? distance : spread;
  const rotation = (index % 2 === 0 ? 1 : -1) * (45 + index * 19 % 100);
  const style = useAnimatedStyle(() => ({
    opacity: (() => {
      const elapsed = timeline.value * (reduceMotion ? 320 : 1_080);
      const effectiveDelay = reduceMotion ? delay * .2 : delay;
      const local = Math.max(0, Math.min(1, (elapsed - effectiveDelay) / (reduceMotion ? 120 : 220)));
      return elapsed < effectiveDelay ? 0 : 1 - local;
    })(),
    transform: (() => {
      const elapsed = timeline.value * (reduceMotion ? 320 : 1_080);
      const effectiveDelay = reduceMotion ? delay * .2 : delay;
      const linear = Math.max(0, Math.min(1, (elapsed - effectiveDelay) / (reduceMotion ? 120 : 220)));
      const progress = 1 - (1 - linear) ** 3;
      return [
        { translateX: outwardX * progress },
        { translateY: outwardY * progress },
        { rotate: `${rotation * progress}deg` },
        { scale: .7 + progress * .3 },
      ];
    })(),
  }));
  return <Animated.View pointerEvents="none" style={[styles.shredParticle, { backgroundColor: color, height: size, left: origin.x - size / 2, top: origin.y - size / 2, width: size }, style]} />;
}

function Preview({ level, best, onStart }: { level: BlockJamLevel; best: Props['best']; onStart: () => void }) {
  return <QuestExperiencePreview
    eyebrow="Tasklet"
    title="Tasklet’s Block Jam"
    body="Open routes and slide every connected color block through its matching edge rail before time runs out."
    media={<View style={styles.previewMediaBoard}><PreviewBoard level={level} /></View>}
    mediaLabel={`${level.rows} by ${level.columns} Block Jam board with ${level.blocks.length} blocks`}
    meta={best ? `Fastest · ${formatCountdown(Math.max(1, Math.round(best.durationMs / 1000)))}` : `${formatCountdown(Math.ceil(level.timeLimitMs / 1000))} to clear · moves are free`}
    actionLabel="Clear the jam"
    onAction={onStart}
  />;
}

const PREVIEW_BOARD_CANVAS_STYLE = { backgroundColor: 'transparent', borderWidth: 0, overflow: 'hidden' as const };

function PreviewBoard({ level }: { level: BlockJamLevel }) {
  const width = 150; const height = 140; const padding = 10; const gap = 1;
  const cell = Math.floor(Math.min((width - padding * 2 - gap * (level.columns - 1)) / level.columns, (height - padding * 2 - gap * (level.rows - 1)) / level.rows));
  const pitch = cell + gap; const gridWidth = level.columns * cell + (level.columns - 1) * gap; const gridHeight = level.rows * cell + (level.rows - 1) * gap;
  const originX = (width - gridWidth) / 2; const originY = (height - gridHeight) / 2;
  return <View style={[styles.previewBoard, PREVIEW_BOARD_CANVAS_STYLE, { height, width }]}><Canvas style={StyleSheet.absoluteFill}>
    <RoundedRect x={1} y={1} width={width - 2} height={height - 2} r={17}><LinearGradient start={vec(0, 0)} end={vec(width, height)} colors={['#2B2948', '#17162B', '#0D0C19']} /></RoundedRect>
    <RoundedRect x={originX - 4} y={originY - 4} width={gridWidth + 8} height={gridHeight + 8} r={9} color="#070A17" />
    {Array.from({ length: level.rows * level.columns }, (_, index) => { const x = originX + (index % level.columns) * pitch; const y = originY + Math.floor(index / level.columns) * pitch; const fixed = level.fixedCells.includes(index); return <Group key={`preview-cell-${index}`}><RoundedRect x={x} y={y} width={cell} height={cell} r={Math.max(2, cell * .18)} color={fixed ? '#353B51' : '#191B32'} />{fixed ? <RoundedRect x={x + 1} y={y + 1} width={Math.max(1, cell - 2)} height={cell * .36} r={Math.max(1.5, cell * .12)} color="#485067" /> : null}</Group>; })}
    {level.blocks.flatMap((block) => block.cells.map((part, index) => { const x = originX + (block.anchor.column + part.column) * pitch; const y = originY + (block.anchor.row + part.row) * pitch; const palette = COLORS[block.colorId]; return <Group key={`preview-${block.id}-${index}`}>
      <RoundedRect x={x} y={y} width={cell} height={cell} r={Math.max(2.5, cell * .2)} color={palette.deep} />
      <RoundedRect x={x + 1} y={y + 1} width={cell - 2} height={cell - 2} r={Math.max(2, cell * .15)}><LinearGradient start={vec(x, y)} end={vec(x, y + cell)} colors={[palette.bright, palette.mid, palette.deep]} positions={[0, .52, 1]} /></RoundedRect>
      <RoundedRect x={x + cell * .14} y={y + cell * .12} width={cell * .72} height={cell * .3} r={Math.max(1.5, cell * .12)} color="#FFFFFF" opacity={.17} />
    </Group>; }))}
    {level.doors.map((door) => { const palette = COLORS[door.colorId]; const horizontal = door.edge === 'top' || door.edge === 'bottom'; const railLength = door.span * cell + (door.span - 1) * gap; const x = horizontal ? originX + door.offset * pitch : door.edge === 'left' ? originX - 5 : originX + gridWidth + 2; const y = horizontal ? door.edge === 'top' ? originY - 5 : originY + gridHeight + 2 : originY + door.offset * pitch; return <RoundedRect key={`preview-door-${door.id}`} x={x} y={y} width={horizontal ? railLength : 3} height={horizontal ? 3 : railLength} r={2} color={palette.bright} />; })}
  </Canvas></View>;
}

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60); const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  previewMediaBoard: { alignItems: 'center', height: 128, justifyContent: 'center', transform: [{ scale: 0.68 }], width: 144 },
  board: { borderCurve: 'continuous', borderRadius: 25, boxShadow: '0 16px 28px rgba(49,27,13,0.42)', overflow: 'visible', position: 'relative' },
  piece: { left: 0, position: 'absolute', top: 0 },
  silhouetteHighlight: { left: -8, position: 'absolute', top: -8 },
  shredParticle: { position: 'absolute', zIndex: 45 },
  railHit: { padding: 0, position: 'absolute', zIndex: 25 },
  railAura: { borderRadius: 10, bottom: -3, left: -3, position: 'absolute', right: -3, top: -3 },
  rail: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 7, borderWidth: 2, height: '100%', justifyContent: 'center', overflow: 'hidden', width: '100%' },
  railSheen: { backgroundColor: 'rgba(255,255,255,0.32)', borderRadius: 99, height: '28%', left: 3, position: 'absolute', right: 3, top: 2 },
  arrow: { fontSize: 15, fontWeight: '900', lineHeight: 17 },
  previewBoard: { backgroundColor: '#33243A', borderColor: '#B9824D', borderRadius: 18, borderWidth: 5, height: 128, position: 'relative', width: 144 },
});
