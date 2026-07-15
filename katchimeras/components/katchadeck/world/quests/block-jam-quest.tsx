import { BlurMask, Canvas, Group, LinearGradient, Rect, RoundedRect, vec } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Lantern } from '@/constants/theme';
import {
  BLOCK_JAM_RULESET,
  availableBlockJamDoor,
  blockJamDoorAtAnchor,
  blockJamExitOptions,
  blockJamLevel,
  blockJamReducer,
  createBlockJamState,
  reachableBlockJamAnchors,
  type BlockJamAnchor,
  type BlockJamBlockDefinition,
  type BlockJamColorId,
  type BlockJamDoor,
  type BlockJamLevel,
  type BlockJamState,
} from '@/utils/quests/experiences/block-jam';
import type { QuestResult } from '@/utils/quests/experiences/types';
import { ExperienceAction, ExperienceHeader, ExperienceResult } from './quest-experience-ui';

type Config = { packId: 'tasklet-desk'; rulesetId?: string; tier: 1 | 2 | 3; levelId: string; timeLimitMs?: number; parMoves?: number };
type Props = { config: Config; best?: { movesUsed: number; durationMs: number } | null; onAttemptStart: (config: Record<string, unknown>) => string; onAttemptCancel: (id: string) => void; onComplete: (id: string, result: QuestResult) => void; onRunningChange: (running: boolean, id?: string | null) => void };

const TASKLET = require('../../../../assets/images/katchimeras/cutouts/tasklet.png');
const COLORS: Record<BlockJamColorId, { bright: string; mid: string; deep: string; label: string }> = {
  red: { bright: '#FF7A77', mid: '#F33E45', deep: '#A9142B', label: 'coral' },
  violet: { bright: '#C985FF', mid: '#9149E9', deep: '#52209D', label: 'violet' },
  cyan: { bright: '#72F4F0', mid: '#22C8D4', deep: '#087B9B', label: 'cyan' },
  lime: { bright: '#A9FF6D', mid: '#5EDC45', deep: '#258C37', label: 'lime' },
  blue: { bright: '#79A8FF', mid: '#3972EA', deep: '#2240A1', label: 'blue' },
  amber: { bright: '#FFE878', mid: '#FFC33F', deep: '#D47B16', label: 'amber' },
};

export function BlockJamQuest(props: Props) {
  const { config, best = null, onAttemptStart, onAttemptCancel, onComplete, onRunningChange } = props;
  const level = useMemo(() => blockJamLevel(config.levelId), [config.levelId]);
  const [state, setState] = useState(() => createBlockJamState(level));
  const [started, setStarted] = useState(false);
  const [boardReady, setBoardReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [burst, setBurst] = useState<{ block: BlockJamBlockDefinition; door: BlockJamDoor; start: { x: number; y: number } } | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(() => Math.ceil(level.timeLimitMs / 1000));
  const attempt = useRef<string | null>(null); const startedAt = useRef(0); const finishedAt = useRef(0); const deadline = useRef(0);
  const reduceMotion = useReducedMotion(); const { width, height } = useWindowDimensions();
  const outer = 24; const gap = 2;
  const maxBoard = Math.min(width - 42, 430, Math.max(280, height - 278));
  const cell = Math.max(25, Math.floor((maxBoard - outer * 2 - gap * (level.columns - 1)) / level.columns));
  const pitch = cell + gap; const gridWidth = level.columns * cell + (level.columns - 1) * gap; const gridHeight = level.rows * cell + (level.rows - 1) * gap;
  const boardWidth = gridWidth + outer * 2; const boardHeight = gridHeight + outer * 2;
  const reachable = selectedId ? reachableBlockJamAnchors(level, state, selectedId) : [];
  const exit = selectedId ? availableBlockJamDoor(level, state, selectedId) : null;

  useEffect(() => {
    if (!started) { setBoardReady(false); return; }
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setBoardReady(true));
    });
    return () => { cancelAnimationFrame(firstFrame); if (secondFrame) cancelAnimationFrame(secondFrame); };
  }, [started]);

  useEffect(() => {
    if (!started || state.status !== 'playing' || burst) return;
    const tick = () => {
      const next = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setRemainingSeconds((current) => current === next ? current : next);
      if (next === 0) setState((current) => blockJamReducer(level, current, { type: 'timeout' }));
    };
    tick(); const timer = setInterval(tick, 250); return () => clearInterval(timer);
  }, [burst, level, started, state.status]);

  const haptic = (kind: 'pick' | 'move' | 'clear' | 'warning') => {
    if (process.env.EXPO_OS !== 'ios') return;
    if (kind === 'pick') void Haptics.selectionAsync();
    else if (kind === 'move') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else void Haptics.notificationAsync(kind === 'clear' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
  };
  const start = () => { const now = Date.now(); attempt.current = onAttemptStart({ ...config, rulesetId: BLOCK_JAM_RULESET, levelId: level.id, timeLimitMs: level.timeLimitMs, parMoves: level.parMoves }); startedAt.current = now; deadline.current = now + level.timeLimitMs; setRemainingSeconds(Math.ceil(level.timeLimitMs / 1000)); setStarted(true); onRunningChange(true, attempt.current); };
  const reset = () => { const now = Date.now(); setState(createBlockJamState(level)); setSelectedId(null); setBurst(null); setRemainingSeconds(Math.ceil(level.timeLimitMs / 1000)); if (started) { startedAt.current = now; deadline.current = now + level.timeLimitMs; } };
  const leave = () => { if (attempt.current) onAttemptCancel(attempt.current); attempt.current = null; reset(); setStarted(false); onRunningChange(false); };
  const move = (blockId: string, anchor: BlockJamAnchor) => setState((current) => {
    const next = blockJamReducer(level, current, { type: 'move', blockId, anchor });
    if (next === current) { haptic('warning'); return current; }
    haptic('move'); void AccessibilityInfo.announceForAccessibility(`Move ${next.movesUsed}.`); return next;
  });
  const clear = (blockId: string, door: BlockJamDoor, options?: { entryAnchor?: BlockJamAnchor; start?: { x: number; y: number } }) => {
    const block = level.blocks.find((candidate) => candidate.id === blockId); if (!block) return;
    const currentAnchor = state.anchors[blockId];
    const exitAnchor = options?.entryAnchor ?? currentAnchor;
    const lockedStart = { x: outer + exitAnchor.column * pitch, y: outer + exitAnchor.row * pitch };
    const releasedAt = options?.entryAnchor ? lockedStart : options?.start ?? lockedStart;
    const start = door.edge === 'left' || door.edge === 'right'
      ? { x: releasedAt.x, y: lockedStart.y }
      : { x: lockedStart.x, y: releasedAt.y };
    if (options?.entryAnchor) setState((current) => blockJamReducer(level, current, { type: 'move', blockId, anchor: options.entryAnchor! }));
    setBurst({ block, door, start }); setSelectedId(null); haptic('clear');
    const exitDuration = reduceMotion ? 40 : 475;
    setTimeout(() => setState((current) => { const next = blockJamReducer(level, current, { type: 'exit', blockId, doorId: door.id }); if (next.status === 'won') finishedAt.current = Date.now(); return next; }), exitDuration);
    setTimeout(() => setBurst(null), exitDuration + 40);
  };
  const undo = () => { setState((current) => blockJamReducer(level, current, { type: 'undo' })); setSelectedId(null); };
  const place = (blockId: string, anchor: BlockJamAnchor) => {
    const destinationDoor = blockJamDoorAtAnchor(level, state, blockId, anchor);
    move(blockId, anchor);
    if (destinationDoor) {
      const start = { x: outer + anchor.column * pitch, y: outer + anchor.row * pitch };
      setTimeout(() => clear(blockId, destinationDoor, { start }), reduceMotion ? 20 : 135);
    }
  };

  if (!started) return <Preview level={level} best={best} onStart={start} reduceMotion={reduceMotion} />;
  if (state.status === 'won' && attempt.current) {
    const durationMs = Math.max(0, (finishedAt.current || Date.now()) - startedAt.current);
    const personalBest = !best || durationMs < best.durationMs || (durationMs === best.durationMs && state.movesUsed < best.movesUsed);
    const result: QuestResult = { kind: 'block_jam', success: true, rulesetId: BLOCK_JAM_RULESET, packId: 'tasklet-desk', levelId: level.id, blocksCleared: state.clearedBlockIds.length, totalBlocks: level.blocks.length, movesUsed: state.movesUsed, timeLimitMs: level.timeLimitMs, parMoves: level.parMoves, undoCount: state.undoCount, durationMs, personalBest };
    return <ExperienceResult success title="Jam cleared" body={personalBest ? 'Tasklet has a glowing new fastest clear.' : 'Every bright block found its matching exit.'} metric={`${formatCountdown(Math.max(0, Math.round(durationMs / 1000)))} CLEAR`} onComplete={() => onComplete(attempt.current!, result)} />;
  }

  return <View style={styles.root}>
    <View style={styles.topLine}><View><ThemedText style={styles.kicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>TASKLET · BLOCK JAM · TIER {level.tier}</ThemedText><ThemedText style={styles.progress} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{state.clearedBlockIds.length}/{level.blocks.length} sorted</ThemedText></View><View style={[styles.movePill, remainingSeconds <= 30 && styles.movePillWarning]}><ThemedText style={styles.moveNumber} lightColor={remainingSeconds <= 30 ? '#FF9B8C' : Lantern.moon50} darkColor={remainingSeconds <= 30 ? '#FF9B8C' : Lantern.moon50}>{formatCountdown(remainingSeconds)}</ThemedText><ThemedText style={styles.moveLabel} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>TIME</ThemedText></View></View>
    <View style={styles.boardFrame}><View pointerEvents={state.status === 'playing' ? 'auto' : 'none'} accessibilityLabel={`${level.rows} by ${level.columns} color block puzzle`} style={[styles.board, { width: boardWidth, height: boardHeight }]}>
      <BoardSurface level={level} cell={cell} gap={gap} outer={outer} width={boardWidth} height={boardHeight} />
      {level.doors.map((door) => <ExitRail key={door.id} door={door} cell={cell} pitch={pitch} outer={outer} boardWidth={boardWidth} boardHeight={boardHeight} active={exit?.id === door.id} onPress={() => selectedId && exit?.id === door.id && clear(selectedId, door)} reduceMotion={reduceMotion} />)}
      {reachable.map((anchor) => <Pressable key={`${anchor.row}:${anchor.column}`} accessibilityLabel={`Move to row ${anchor.row + 1}, column ${anchor.column + 1}`} onPress={() => selectedId && place(selectedId, anchor)} style={[styles.destination, { left: outer + anchor.column * pitch + cell * .34, top: outer + anchor.row * pitch + cell * .34, width: cell * .32, height: cell * .32 }]} />)}
      {level.blocks.map((block, index) => state.clearedBlockIds.includes(block.id) || burst?.block.id === block.id ? null : <BrickPiece key={block.id} level={level} state={state} block={block} anchor={state.anchors[block.id]} reachable={reachableBlockJamAnchors(level, state, block.id)} exitOptions={blockJamExitOptions(level, state, block.id)} cell={cell} gap={gap} outer={outer} index={index} selected={selectedId === block.id} visible={boardReady} reduceMotion={reduceMotion} onPick={() => { setSelectedId(block.id); haptic('pick'); }} onMove={(anchor) => move(block.id, anchor)} onExit={(door, exitOptions) => clear(block.id, door, exitOptions)} />)}
      {burst ? <ClearBurst block={burst.block} door={burst.door} start={burst.start} cell={cell} gap={gap} pitch={pitch} boardWidth={boardWidth} boardHeight={boardHeight} reduceMotion={reduceMotion} /> : null}
    </View></View>
    {state.status === 'failed' ? <Animated.View entering={FadeInDown.duration(160)} style={styles.jammed}><ThemedText style={styles.jammedTitle} lightColor="#FF9B8C" darkColor="#FF9B8C">Time’s up</ThemedText><ThemedText style={styles.jammedBody} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>Restart for a fresh clock and keep experimenting with the layout.</ThemedText></Animated.View> : <ThemedText style={styles.help} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>{selectedId ? 'Drag anywhere in the lit area, or tap a landing dot.' : 'Drag connected blocks freely. Match each color to its glowing rail.'}</ThemedText>}
    <View style={styles.controls}><Pressable disabled={!state.history.length || state.status !== 'playing'} onPress={undo} style={[styles.iconButton, (!state.history.length || state.status !== 'playing') && styles.disabled]}><IconSymbol name="arrow.counterclockwise" size={18} color={Lantern.moon300} /></Pressable><Pressable onPress={reset} style={styles.controlButton}><ThemedText style={styles.controlText} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>Restart</ThemedText></Pressable><Pressable onPress={() => Alert.alert('Leave Block Jam?', 'This layout will reset.', [{ text: 'Keep playing', style: 'cancel' }, { text: 'Leave', style: 'destructive', onPress: leave }])} style={styles.iconButton}><IconSymbol name="xmark" size={18} color={Lantern.moon300} /></Pressable></View>
  </View>;
}

function BoardSurface({ level, cell, gap, outer, width, height }: { level: BlockJamLevel; cell: number; gap: number; outer: number; width: number; height: number }) {
  const pitch = cell + gap;
  return <Canvas style={StyleSheet.absoluteFill}><RoundedRect x={1} y={1} width={width - 2} height={height - 2} r={22}><LinearGradient start={vec(0, 0)} end={vec(width, height)} colors={['#242A48', '#121629', '#090C19']} /></RoundedRect>
    <RoundedRect x={outer - 7} y={outer - 7} width={level.columns * pitch - gap + 14} height={level.rows * pitch - gap + 14} r={13} color="#080B17" />
    {Array.from({ length: level.rows * level.columns }, (_, index) => { const x = outer + (index % level.columns) * pitch; const y = outer + Math.floor(index / level.columns) * pitch; const fixed = level.fixedCells.includes(index); return <Group key={index}><RoundedRect x={x} y={y} width={cell} height={cell} r={Math.max(4, cell * .16)} color={fixed ? '#353B51' : '#171C32'} /><RoundedRect x={x + 2} y={y + 2} width={cell - 4} height={cell * .42} r={Math.max(3, cell * .12)} color={fixed ? '#485067' : '#222A47'} /><Rect x={x + 3} y={y + cell - 4} width={cell - 6} height={2} color="#070A14" /></Group>; })}
  </Canvas>;
}

function BrickPiece({ level, state, block, anchor, reachable, exitOptions, cell, gap, outer, index, selected, visible, reduceMotion, onPick, onMove, onExit }: { level: BlockJamLevel; state: BlockJamState; block: BlockJamBlockDefinition; anchor: BlockJamAnchor; reachable: BlockJamAnchor[]; exitOptions: ReturnType<typeof blockJamExitOptions>; cell: number; gap: number; outer: number; index: number; selected: boolean; visible: boolean; reduceMotion: boolean; onPick: () => void; onMove: (anchor: BlockJamAnchor) => void; onExit: (door: BlockJamDoor, options?: { entryAnchor?: BlockJamAnchor; start?: { x: number; y: number } }) => void }) {
  const pitch = cell + gap; const columns = Math.max(...block.cells.map((part) => part.column)) + 1; const rows = Math.max(...block.cells.map((part) => part.row)) + 1;
  const x = useSharedValue(outer + anchor.column * pitch); const y = useSharedValue(outer + anchor.row * pitch); const dx = useSharedValue(0); const dy = useSharedValue(0); const scale = useSharedValue(1); const intro = useSharedValue(0); const acceptedDrop = useSharedValue(0);
  useEffect(() => {
    intro.value = visible
      ? withDelay(reduceMotion ? 0 : index * 14, withTiming(1, { duration: reduceMotion ? 40 : 150, easing: Easing.out(Easing.cubic) }))
      : 0;
  }, [index, intro, reduceMotion, visible]);
  useEffect(() => {
    const nextX = outer + anchor.column * pitch; const nextY = outer + anchor.row * pitch;
    x.value = reduceMotion ? nextX : withTiming(nextX, { duration: 125, easing: Easing.out(Easing.cubic) });
    y.value = reduceMotion ? nextY : withTiming(nextY, { duration: 125, easing: Easing.out(Easing.cubic) });
  }, [anchor.column, anchor.row, outer, pitch, reduceMotion, x, y]);
  const nearest = (tx: number, ty: number) => reachable.reduce<{ anchor: BlockJamAnchor; distance: number } | null>((best, candidate) => { const distance = Math.hypot(tx - (candidate.column - anchor.column) * pitch, ty - (candidate.row - anchor.row) * pitch); return !best || distance < best.distance ? { anchor: candidate, distance } : best; }, null);
  const gesture = Gesture.Pan().runOnJS(true).onStart(() => { acceptedDrop.value = 0; scale.value = withTiming(1.025, { duration: 65, easing: Easing.out(Easing.cubic) }); onPick(); }).onUpdate((event) => { dx.value = event.translationX; dy.value = event.translationY; }).onEnd((event) => {
    const release = { x: x.value + event.translationX, y: y.value + event.translationY };
    const outward = exitOptions.find(({ door }) => (door.edge === 'left' && event.translationX < -pitch * .32) || (door.edge === 'right' && event.translationX > pitch * .32) || (door.edge === 'top' && event.translationY < -pitch * .32) || (door.edge === 'bottom' && event.translationY > pitch * .32));
    if (outward) { acceptedDrop.value = 1; onExit(outward.door, { start: release }); return; }
    const target = nearest(event.translationX, event.translationY);
    if (target && target.distance < pitch * .78) {
      const targetDoor = blockJamDoorAtAnchor(level, state, block.id, target.anchor);
      acceptedDrop.value = 1;
      x.value = release.x; y.value = release.y; dx.value = 0; dy.value = 0;
      if (targetDoor) onExit(targetDoor, { entryAnchor: target.anchor, start: release }); else onMove(target.anchor);
    }
  }).onFinalize(() => {
    if (!acceptedDrop.value) {
      dx.value = withTiming(0, { duration: 105, easing: Easing.out(Easing.cubic) });
      dy.value = withTiming(0, { duration: 105, easing: Easing.out(Easing.cubic) });
    }
    scale.value = withTiming(1, { duration: 90, easing: Easing.out(Easing.cubic) });
  });
  const style = useAnimatedStyle(() => ({ opacity: intro.value, transform: [{ translateX: x.value + dx.value }, { translateY: y.value + dy.value + (1 - intro.value) * 6 }, { scale: scale.value }] }));
  return <GestureDetector gesture={gesture}><Animated.View pointerEvents={visible ? 'auto' : 'none'} style={[styles.piece, { width: columns * pitch - gap, height: rows * pitch - gap, zIndex: selected ? 20 : 10 }, style]}><Pressable accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`${COLORS[block.colorId].label} block, ${block.cells.length} cells`} accessibilityHint="Drag freely, or tap to show reachable positions" onPress={onPick} style={StyleSheet.absoluteFill}><BrickArt block={block} cell={cell} gap={gap} selected={selected} /></Pressable></Animated.View></GestureDetector>;
}

function BrickArt({ block, cell, gap, selected }: { block: BlockJamBlockDefinition; cell: number; gap: number; selected: boolean }) {
  const pitch = cell + gap; const columns = Math.max(...block.cells.map((part) => part.column)) + 1; const rows = Math.max(...block.cells.map((part) => part.row)) + 1; const palette = COLORS[block.colorId];
  return <Canvas style={{ width: columns * pitch - gap, height: rows * pitch - gap }}>
    {selected ? block.cells.map((part, index) => <RoundedRect key={`selected-${index}`} x={part.column * pitch - 1} y={part.row * pitch - 1} width={cell + 2} height={cell + 2} r={Math.max(6, cell * .19)} color={palette.bright} opacity={.52}><BlurMask blur={4} style="solid" /></RoundedRect>) : null}
    {block.cells.map((part, index) => { const x = part.column * pitch; const y = part.row * pitch; return <Group key={index}>
      {block.cells.some((other) => other.row === part.row && other.column === part.column + 1) ? <Rect x={x + cell - 3} y={y + 4} width={gap + 6} height={cell - 8} color={palette.mid} /> : null}
      {block.cells.some((other) => other.column === part.column && other.row === part.row + 1) ? <Rect x={x + 4} y={y + cell - 3} width={cell - 8} height={gap + 6} color={palette.deep} /> : null}
      <RoundedRect x={x} y={y} width={cell} height={cell} r={Math.max(5, cell * .17)} color={palette.deep} />
      <RoundedRect x={x + 2} y={y + 2} width={cell - 4} height={cell - 5} r={Math.max(4, cell * .14)}><LinearGradient start={vec(x, y)} end={vec(x, y + cell)} colors={[palette.bright, palette.mid, palette.deep]} positions={[0, .48, 1]} /></RoundedRect>
      <RoundedRect x={x + cell * .14} y={y + cell * .12} width={cell * .72} height={cell * .38} r={cell * .13} color="#FFFFFF" opacity={.17} />
    </Group>; })}
  </Canvas>;
}

function ExitRail({ door, cell, pitch, outer, boardWidth, boardHeight, active, onPress, reduceMotion }: { door: BlockJamDoor; cell: number; pitch: number; outer: number; boardWidth: number; boardHeight: number; active: boolean; onPress: () => void; reduceMotion: boolean }) {
  const pulse = useSharedValue(active ? 1 : 0); useEffect(() => { pulse.value = active && !reduceMotion ? withRepeat(withSequence(withTiming(.35, { duration: 500 }), withTiming(1, { duration: 500 })), -1, true) : withTiming(active ? 1 : .42); }, [active, pulse, reduceMotion]); const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));
  const horizontal = door.edge === 'top' || door.edge === 'bottom'; const long = door.span * cell + (door.span - 1) * (pitch - cell); const palette = COLORS[door.colorId]; const position = horizontal ? { width: long, height: 16, left: outer + door.offset * pitch, top: door.edge === 'top' ? 4 : boardHeight - 20 } : { width: 16, height: long, left: door.edge === 'left' ? 4 : boardWidth - 20, top: outer + door.offset * pitch };
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !active }} accessibilityLabel={`${palette.label} exit`} disabled={!active} onPress={onPress} style={[styles.railHit, position]}><Animated.View style={[styles.rail, { borderColor: palette.bright, backgroundColor: palette.mid, shadowColor: palette.bright }, animated]}><ThemedText style={[styles.arrow, { transform: [{ rotate: door.edge === 'top' ? '0deg' : door.edge === 'right' ? '90deg' : door.edge === 'bottom' ? '180deg' : '-90deg' }] }]} lightColor="#FFFFFF" darkColor="#FFFFFF">↑</ThemedText></Animated.View></Pressable>;
}

function ClearBurst({ block, door, start, cell, gap, pitch, boardWidth, boardHeight, reduceMotion }: { block: BlockJamBlockDefinition; door: BlockJamDoor; start: { x: number; y: number }; cell: number; gap: number; pitch: number; boardWidth: number; boardHeight: number; reduceMotion: boolean }) {
  const travel = useSharedValue(0); const opacity = useSharedValue(1);
  const columns = Math.max(...block.cells.map((part) => part.column)) + 1; const rows = Math.max(...block.cells.map((part) => part.row)) + 1;
  const pieceWidth = columns * pitch - gap; const pieceHeight = rows * pitch - gap;
  const startX = start.x; const startY = start.y;
  const targetX = door.edge === 'left' ? Math.min(-pieceWidth - 10, startX - cell) : door.edge === 'right' ? Math.max(boardWidth + 10, startX + cell) : startX;
  const targetY = door.edge === 'top' ? Math.min(-pieceHeight - 10, startY - cell) : door.edge === 'bottom' ? Math.max(boardHeight + 10, startY + cell) : startY;
  useEffect(() => {
    const travelDuration = reduceMotion ? 20 : 345;
    travel.value = withTiming(1, { duration: travelDuration, easing: Easing.in(Easing.cubic) });
    opacity.value = withDelay(travelDuration, withTiming(0, { duration: reduceMotion ? 10 : 75, easing: Easing.linear }));
  }, [opacity, reduceMotion, travel]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateX: startX + (targetX - startX) * travel.value }, { translateY: startY + (targetY - startY) * travel.value }, { scale: 1 - travel.value * .04 }] }));
  return <Animated.View pointerEvents="none" style={[styles.piece, { height: pieceHeight, width: pieceWidth, zIndex: 40 }, style]}><BrickArt block={block} cell={cell} gap={gap} selected /></Animated.View>;
}

function Preview({ level, best, onStart, reduceMotion }: { level: BlockJamLevel; best: Props['best']; onStart: () => void; reduceMotion: boolean }) {
  return <View style={styles.previewRoot}><ExperienceHeader eyebrow="TASKLET" title="Tasklet’s Block Jam" body="Unclog the desk. Experiment freely, open routes, and slide every connected color block through its matching edge rail before time runs out." /><Animated.View entering={FadeIn.duration(reduceMotion ? 80 : 240)} style={styles.previewScene}><View style={styles.previewBoard}>{(['red','violet','cyan','lime','blue','amber'] as BlockJamColorId[]).map((color, index) => <View key={color} style={[styles.previewBrick, { backgroundColor: COLORS[color].mid, borderColor: COLORS[color].bright, left: 18 + (index % 3) * 39, top: 24 + Math.floor(index / 3) * 43, width: index % 2 ? 66 : 34 }]} />)}</View><Image source={TASKLET} contentFit="contain" style={styles.tasklet} /><View style={styles.previewBadge}><ThemedText style={styles.previewBadgeText} lightColor={Lantern.emberInk} darkColor={Lantern.emberInk}>{level.rows}×{level.columns} · {level.blocks.length} BLOCKS</ThemedText></View></Animated.View><View style={styles.previewFooter}><ThemedText style={styles.best} lightColor={best ? Lantern.auroraTeal : Lantern.moon500} darkColor={best ? Lantern.auroraTeal : Lantern.moon500}>{best ? `FASTEST ${formatCountdown(Math.max(1, Math.round(best.durationMs / 1000)))}` : `${formatCountdown(Math.ceil(level.timeLimitMs / 1000))} TO CLEAR · MOVES ARE FREE`}</ThemedText><ExperienceAction label="Clear the jam" onPress={onStart} /></View></View>;
}

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60); const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: 8, justifyContent: 'space-between', minHeight: 0, padding: 4 }, topLine: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, kicker: { fontSize: 10, fontWeight: '900', letterSpacing: .8 }, progress: { fontSize: 18, fontVariant: ['tabular-nums'], fontWeight: '900', lineHeight: 25 }, movePill: { alignItems: 'center', backgroundColor: 'rgba(125,232,205,.09)', borderColor: 'rgba(125,232,205,.25)', borderRadius: 16, borderWidth: 1, minWidth: 64, paddingHorizontal: 11, paddingVertical: 5 }, movePillWarning: { backgroundColor: 'rgba(255,110,95,.1)', borderColor: 'rgba(255,110,95,.36)' }, moveNumber: { fontSize: 21, fontVariant: ['tabular-nums'], fontWeight: '900', lineHeight: 23 }, moveLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 1 }, boardFrame: { alignItems: 'center', flex: 1, justifyContent: 'center', minHeight: 0 }, board: { borderRadius: 22, elevation: 14, overflow: 'visible', position: 'relative', shadowColor: '#05030A', shadowOffset: { width: 0, height: 16 }, shadowOpacity: .55, shadowRadius: 22 }, destination: { backgroundColor: 'rgba(255,241,181,.8)', borderColor: '#FFF4C9', borderRadius: 99, borderWidth: 1, position: 'absolute', zIndex: 6 }, piece: { left: 0, position: 'absolute', top: 0 }, railHit: { padding: 0, position: 'absolute', zIndex: 25 }, rail: { alignItems: 'center', borderRadius: 7, borderWidth: 2, elevation: 7, height: '100%', justifyContent: 'center', shadowOffset: { width: 0, height: 0 }, shadowOpacity: .7, shadowRadius: 9, width: '100%' }, arrow: { fontSize: 15, fontWeight: '900', lineHeight: 17 }, help: { fontSize: 11, lineHeight: 15, minHeight: 15, textAlign: 'center' }, controls: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'center' }, iconButton: { alignItems: 'center', borderColor: 'rgba(201,194,232,.16)', borderRadius: 14, borderWidth: 1, height: 40, justifyContent: 'center', width: 46 }, controlButton: { alignItems: 'center', borderColor: 'rgba(201,194,232,.16)', borderRadius: 14, borderWidth: 1, height: 40, justifyContent: 'center', paddingHorizontal: 20 }, controlText: { fontSize: 12, fontWeight: '800' }, disabled: { opacity: .3 }, jammed: { backgroundColor: 'rgba(242,110,95,.08)', borderColor: 'rgba(242,110,95,.3)', borderRadius: 15, borderWidth: 1, padding: 10 }, jammedTitle: { fontSize: 14, fontWeight: '900' }, jammedBody: { fontSize: 11, lineHeight: 15 }, previewRoot: { flex: 1, gap: 16, justifyContent: 'space-between', minHeight: 0, padding: 4 }, previewScene: { alignItems: 'flex-end', backgroundColor: 'rgba(108,115,226,.09)', borderColor: 'rgba(130,149,255,.24)', borderRadius: 25, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 230, overflow: 'hidden', padding: 16, position: 'relative' }, previewBoard: { backgroundColor: '#10152A', borderColor: '#3C456C', borderRadius: 18, borderWidth: 5, height: 128, marginBottom: 18, position: 'relative', transform: [{ rotate: '-3deg' }], width: 144 }, previewBrick: { borderRadius: 8, borderWidth: 1, height: 34, position: 'absolute', shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: .4, shadowRadius: 5 }, tasklet: { height: 190, marginBottom: -8, marginRight: -20, width: 154 }, previewBadge: { backgroundColor: Lantern.ember300, borderRadius: 999, left: 16, paddingHorizontal: 11, paddingVertical: 6, position: 'absolute', top: 14 }, previewBadgeText: { fontSize: 9, fontWeight: '900', letterSpacing: .5 }, previewFooter: { gap: 10 }, best: { fontSize: 10, fontVariant: ['tabular-nums'], fontWeight: '900', letterSpacing: .8, textAlign: 'center' },
});
