import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { FeastleMergeCelebration, FeastleMergeItemArt } from '@/components/katchadeck/world/quests/feastle-merge-primitives';
import { FEASTLE_MERGE_ART } from '@/constants/feastle-merge-art';
import { MERGE_GENERATORS_BY_ID, MERGE_ITEMS_BY_ID, MERGE_WORLD_COLUMNS, MERGE_WORLD_ROWS } from '@/constants/merge-world-catalog';
import { useMergeMotionPerformanceProbe } from '@/hooks/use-merge-motion-performance-probe';
import type { MergeBoardOccupant, MergeWorldCommand, MergeWorldCommandResult, MergeWorldState } from '@/types/merge-world';
import { mergeCellCenter, mergeCellFromPoint, mergeCellOrigin, type MergeBoardGeometry } from '@/utils/merge-world/board-geometry';
import { reduceMergeWorld } from '@/utils/merge-world/engine';

type SpriteRecord = { occupant: MergeBoardOccupant; cell: number };
type MotionKind = 'move' | 'swap' | 'return' | 'spawn' | 'merge-source' | 'merge-target' | 'merge-result';
type SpriteMotion = {
  operationId: number;
  token: number;
  kind: MotionKind;
  startX: number;
  startY: number;
  arcHeight?: number;
};
type ActiveOperation = {
  id: number;
  kind: 'board' | 'spawn';
  remaining: Set<string>;
  finalState: MergeWorldState | null | undefined;
};

const FOOD_ART = ['wheat', 'flour', 'dough', 'noodles', 'pasta', 'cake'];
const MOVE_SPRING = { damping: 32, stiffness: 360, mass: 0.78, overshootClamping: true } as const;
const SWAP_SPRING = { damping: 30, stiffness: 300, mass: 0.9, overshootClamping: true } as const;

function spritesFromState(state: MergeWorldState): SpriteRecord[] {
  return state.board.flatMap((cell, index) => cell.occupant ? [{ occupant: cell.occupant, cell: index }] : []);
}

function spriteId(sprite: SpriteRecord) {
  return sprite.occupant.kind === 'item' ? sprite.occupant.instanceId : `generator:${sprite.occupant.generatorId}`;
}

export function FeastlePersistentMergeBoard({ state, width, maxHeight, selectedCell, onSelect, onCommand }: {
  state: MergeWorldState;
  width: number;
  maxHeight?: number;
  selectedCell: number | null;
  onSelect: (cell: number | null) => void;
  onCommand: (command: MergeWorldCommand) => Promise<MergeWorldCommandResult | null>;
}) {
  const gap = width < 380 ? 3 : 4;
  const padding = width < 380 ? 5 : 7;
  const border = 2;
  const widthCellSize = (width - (padding + border) * 2 - gap * (MERGE_WORLD_COLUMNS - 1)) / MERGE_WORLD_COLUMNS;
  const heightCellSize = maxHeight == null
    ? widthCellSize
    : (maxHeight - (padding + border) * 2 - gap * (MERGE_WORLD_ROWS - 1)) / MERGE_WORLD_ROWS;
  const cellSize = Math.max(24, Math.floor(Math.min(widthCellSize, heightCellSize)));
  const inset = padding + border;
  const boardWidth = cellSize * MERGE_WORLD_COLUMNS + gap * (MERGE_WORLD_COLUMNS - 1) + inset * 2;
  const boardHeight = cellSize * MERGE_WORLD_ROWS + gap * (MERGE_WORLD_ROWS - 1) + inset * 2;
  const geometry = useMemo<MergeBoardGeometry>(() => ({ columns: MERGE_WORLD_COLUMNS, rows: MERGE_WORLD_ROWS, cellSize, gap, inset }), [cellSize, gap, inset]);
  const reduceMotion = useReducedMotion();
  const hoverCell = useSharedValue(-1);
  const motionActive = useSharedValue(0);
  useMergeMotionPerformanceProbe(motionActive);
  const [presentation, setPresentation] = useState(state);
  const presentationRef = useRef(presentation);
  const [sprites, setSprites] = useState(() => spritesFromState(state));
  const spritesRef = useRef(sprites);
  const [motions, setMotions] = useState<Record<string, SpriteMotion>>({});
  const [busy, setBusy] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [invalidCell, setInvalidCell] = useState<number | null>(null);
  const [feedbackCell, setFeedbackCell] = useState<number | null>(null);
  const [spawnBursts, setSpawnBursts] = useState<{ id: number; cell: number }[]>([]);
  const operationSequence = useRef(0);
  const motionSequence = useRef(0);
  const burstSequence = useRef(0);
  const activeOperations = useRef(new Map<number, ActiveOperation>());
  const committedStateRef = useRef(state);

  presentationRef.current = presentation;
  spritesRef.current = sprites;

  useEffect(() => {
    committedStateRef.current = state;
    if (activeOperations.current.size) return;
    presentationRef.current = state;
    setPresentation(state);
    const nextSprites = spritesFromState(state);
    spritesRef.current = nextSprites;
    setSprites(nextSprites);
  }, [state]);

  const finishOperationIfReady = useCallback((operationId: number) => {
    const operation = activeOperations.current.get(operationId);
    if (!operation || operation.remaining.size || operation.finalState === undefined) return;
    activeOperations.current.delete(operationId);
    setMotions((current) => Object.fromEntries(Object.entries(current).filter(([, motion]) => motion.operationId !== operationId)));
    const hasOperations = activeOperations.current.size > 0;
    setBusy(hasOperations);
    setBlocking([...activeOperations.current.values()].some((entry) => entry.kind === 'board'));
    if (hasOperations) return;
    const finalState = operation.finalState ?? committedStateRef.current;
    committedStateRef.current = finalState;
    presentationRef.current = finalState;
    setPresentation(finalState);
    const nextSprites = spritesFromState(finalState);
    spritesRef.current = nextSprites;
    setSprites(nextSprites);
    motionActive.value = 0;
  }, [motionActive]);

  const completeMotion = useCallback((operationId: number, instanceId: string) => {
    const operation = activeOperations.current.get(operationId);
    if (!operation) return;
    operation.remaining.delete(instanceId);
    finishOperationIfReady(operationId);
  }, [finishOperationIfReady]);

  const beginOperation = useCallback(({
    nextState,
    nextSprites,
    nextMotions,
    command,
    kind = 'board',
  }: {
    nextState: MergeWorldState;
    nextSprites: SpriteRecord[];
    nextMotions: Record<string, Omit<SpriteMotion, 'operationId' | 'token'>>;
    command?: MergeWorldCommand;
    kind?: ActiveOperation['kind'];
  }) => {
    const operationId = ++operationSequence.current;
    const boundMotions = Object.fromEntries(Object.entries(nextMotions).map(([instanceId, motion]) => [instanceId, {
      ...motion,
      operationId,
      token: ++motionSequence.current,
    }]));
    activeOperations.current.set(operationId, { id: operationId, kind, remaining: new Set(Object.keys(boundMotions)), finalState: command ? undefined : nextState });
    presentationRef.current = nextState;
    setPresentation(nextState);
    spritesRef.current = nextSprites;
    setSprites(nextSprites);
    setMotions((current) => ({ ...current, ...boundMotions }));
    setBusy(true);
    if (kind === 'board') setBlocking(true);
    motionActive.value = 1;
    if (!command) return;
    void onCommand(command).then((result) => {
      const operation = activeOperations.current.get(operationId);
      if (!operation) return;
      operation.finalState = result?.state ?? null;
      if (result?.state) committedStateRef.current = result.state;
      finishOperationIfReady(operationId);
    });
  }, [finishOperationIfReady, motionActive, onCommand]);

  const returnSpriteHome = useCallback((sprite: SpriteRecord, dx: number, dy: number, invalid?: number) => {
    if (invalid != null) {
      setInvalidCell(invalid);
      setTimeout(() => setInvalidCell((current) => current === invalid ? null : current), 260);
      if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    const origin = mergeCellOrigin(geometry, sprite.cell);
    beginOperation({
      nextState: presentationRef.current,
      nextSprites: sprites,
      nextMotions: { [spriteId(sprite)]: { kind: 'return', startX: origin.x + dx, startY: origin.y + dy } },
    });
  }, [beginOperation, geometry, sprites]);

  const drop = useCallback((instanceId: string, dx: number, dy: number) => {
    if (activeOperations.current.size) return;
    const current = presentationRef.current;
    const currentSprites = spritesRef.current;
    const sprite = currentSprites.find((entry) => spriteId(entry) === instanceId);
    if (!sprite) return;
    const sourceCenter = mergeCellCenter(geometry, sprite.cell);
    const to = mergeCellFromPoint(geometry, sourceCenter.x + dx, sourceCenter.y + dy);
    if (to == null || to === sprite.cell) {
      returnSpriteHome(sprite, dx, dy);
      return;
    }
    const targetCell = current.board[to];
    if (!targetCell || targetCell.locked) {
      returnSpriteHome(sprite, dx, dy, to);
      return;
    }

    const command: MergeWorldCommand = { type: 'move', from: sprite.cell, to, now: Date.now() };
    const predicted = reduceMergeWorld(current, command);
    if (!predicted.changed) {
      returnSpriteHome(sprite, dx, dy, to);
      return;
    }

    const from = sprite.cell;
    const sourceOrigin = mergeCellOrigin(geometry, from);
    const targetOrigin = mergeCellOrigin(geometry, to);
    const target = currentSprites.find((entry) => entry.cell === to);
    const resultingItem = predicted.state.board[to]?.occupant;
    const merging = sprite.occupant.kind === 'item'
      && target?.occupant.kind === 'item'
      && resultingItem?.kind === 'item'
      && resultingItem.instanceId !== sprite.occupant.instanceId;
    const nextMotions: Record<string, Omit<SpriteMotion, 'operationId' | 'token'>> = {};
    let nextSprites: SpriteRecord[];

    if (merging && target && resultingItem?.kind === 'item') {
      const result: SpriteRecord = { occupant: resultingItem, cell: to };
      nextSprites = currentSprites.map((entry) => spriteId(entry) === instanceId ? { ...entry, cell: to } : entry).concat(result);
      nextMotions[instanceId] = { kind: 'merge-source', startX: sourceOrigin.x + dx, startY: sourceOrigin.y + dy };
      nextMotions[spriteId(target)] = { kind: 'merge-target', startX: targetOrigin.x, startY: targetOrigin.y };
      nextMotions[spriteId(result)] = { kind: 'merge-result', startX: targetOrigin.x, startY: targetOrigin.y };
      setFeedbackCell(to);
      setTimeout(() => setFeedbackCell((cell) => cell === to ? null : cell), 430);
    } else if (target) {
      nextSprites = currentSprites.map((entry) => spriteId(entry) === instanceId
        ? { ...entry, cell: to }
        : spriteId(entry) === spriteId(target) ? { ...entry, cell: from } : entry);
      nextMotions[instanceId] = { kind: 'swap', startX: sourceOrigin.x + dx, startY: sourceOrigin.y + dy };
      nextMotions[spriteId(target)] = { kind: 'swap', startX: targetOrigin.x, startY: targetOrigin.y };
    } else {
      nextSprites = currentSprites.map((entry) => spriteId(entry) === instanceId ? { ...entry, cell: to } : entry);
      nextMotions[instanceId] = { kind: 'move', startX: sourceOrigin.x + dx, startY: sourceOrigin.y + dy };
    }

    hoverCell.value = -1;
    onSelect(null);
    if (merging && process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    beginOperation({ nextState: predicted.state, nextSprites, nextMotions, command });
  }, [beginOperation, geometry, hoverCell, onSelect, returnSpriteHome]);

  const launchGenerator = useCallback((generatorId: string) => {
    if ([...activeOperations.current.values()].some((operation) => operation.kind === 'board')) return;
    const current = presentationRef.current;
    const currentSprites = spritesRef.current;
    const from = current.board.findIndex((cell) => cell.occupant?.kind === 'generator' && cell.occupant.generatorId === generatorId);
    const now = Date.now();
    const command: MergeWorldCommand = { type: 'tapGenerator', generatorId, now, seed: `${now}:${current.revision}:${generatorId}` };
    const predicted = reduceMergeWorld(current, command);
    const to = predicted.spawnedCell;
    const spawned = to == null ? null : predicted.state.board[to]?.occupant;
    if (!predicted.changed || from < 0 || to == null || spawned?.kind !== 'item') {
      void onCommand(command);
      return;
    }
    const start = mergeCellOrigin(geometry, from);
    const end = mergeCellOrigin(geometry, to);
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    const nextSprite: SpriteRecord = { occupant: spawned, cell: to };
    if (!reduceMotion) {
      const burst = { id: ++burstSequence.current, cell: from };
      setSpawnBursts((bursts) => [...bursts, burst]);
      setTimeout(() => setSpawnBursts((bursts) => bursts.filter((entry) => entry.id !== burst.id)), 480);
    }
    beginOperation({
      nextState: predicted.state,
      nextSprites: [...currentSprites, nextSprite],
      nextMotions: { [spawned.instanceId]: { kind: 'spawn', startX: start.x, startY: start.y, arcHeight: Math.max(cellSize * 1.15, Math.min(cellSize * 2.1, distance * 0.22)) } },
      command,
      kind: 'spawn',
    });
    onSelect(null);
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [beginOperation, cellSize, geometry, onCommand, onSelect, reduceMotion]);

  const accessibleAction = useCallback((cell: number) => {
    const occupant = presentation.board[cell]?.occupant;
    if (busy && occupant?.kind !== 'generator') return;
    if (occupant?.kind === 'generator') {
      launchGenerator(occupant.generatorId);
      return;
    }
    if (selectedCell == null) {
      if (occupant?.kind === 'item') onSelect(cell);
      return;
    }
    if (selectedCell === cell) onSelect(null);
    else {
      const selected = sprites.find((entry) => entry.cell === selectedCell);
      if (selected) {
        const from = mergeCellCenter(geometry, selected.cell);
        const to = mergeCellCenter(geometry, cell);
        drop(spriteId(selected), to.x - from.x, to.y - from.y);
      }
    }
  }, [busy, drop, geometry, launchGenerator, onSelect, presentation.board, selectedCell, sprites]);

  const selectedDefinitionId = selectedCell == null || presentation.board[selectedCell]?.occupant?.kind !== 'item'
    ? null
    : presentation.board[selectedCell].occupant.definitionId;

  return <View accessibilityLabel="Feastle merge board, seven columns by nine rows" style={[styles.board, busy && styles.boardAnimating, { height: boardHeight, padding, width: boardWidth }]}>
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {presentation.board.map((cell, index) => {
        const origin = mergeCellOrigin(geometry, index);
        const occupant = cell.occupant;
        const item = occupant?.kind === 'item' ? occupant : null;
        const generator = occupant?.kind === 'generator' ? MERGE_GENERATORS_BY_ID.get(occupant.generatorId) : null;
        const definition = item ? MERGE_ITEMS_BY_ID.get(item.definitionId) : null;
        const compatible = Boolean(selectedDefinitionId && item && item.definitionId === selectedDefinitionId && selectedCell !== index);
        const label = generator ? `${generator.name}, ${presentation.generators[generator.id]?.charges ?? 0} charges. Tap to generate.` : definition ? `${definition.name}, tier ${definition.tier}` : cell.locked ? 'Blocked board space' : 'Empty board space';
        return <AnimatedCell
          blocked={cell.locked && !occupant}
          compatible={compatible}
          height={cellSize}
          hoverCell={hoverCell}
          index={index}
          invalid={invalidCell === index}
          key={index}
          left={origin.x}
          selected={selectedCell === index}
          top={origin.y}
          width={cellSize}>
          <Pressable accessible accessibilityActions={[{ name: 'activate', label: generator ? 'Generate item' : 'Select or move item' }]} accessibilityLabel={label} accessibilityRole="button" disabled={generator ? blocking : busy} onAccessibilityAction={() => accessibleAction(index)} onPress={generator ? () => launchGenerator(generator.id) : undefined} style={styles.cellPressable}>
            {cell.locked && !occupant ? <IconSymbol color="rgba(255,241,218,0.22)" name="leaf.fill" size={Math.max(15, cellSize * 0.38)} /> : null}
            {!reduceMotion && feedbackCell === index ? <FeastleMergeCelebration size={cellSize} /> : null}
          </Pressable>
        </AnimatedCell>;
      })}
    </View>
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {spawnBursts.map((burst) => <SpawnParticleBurst key={burst.id} origin={mergeCellOrigin(geometry, burst.cell)} size={cellSize} />)}
      {sprites.map((sprite) => {
        const origin = mergeCellOrigin(geometry, sprite.cell);
        const id = spriteId(sprite);
        const generatorId = sprite.occupant.kind === 'generator' ? sprite.occupant.generatorId : null;
        const runtimeGenerator = generatorId ? presentation.generators[generatorId] : null;
        return <PersistentSprite
          baseX={origin.x}
          baseY={origin.y}
          cellSize={cellSize}
          enabled={!busy && !motions[id]}
          geometry={geometry}
          hoverCell={hoverCell}
          instanceId={id}
          key={id}
          motion={motions[id]}
          onComplete={completeMotion}
          onDrop={drop}
          onPick={() => { if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync(); }}
          onTap={() => generatorId ? launchGenerator(generatorId) : onSelect(sprite.cell)}
          reduceMotion={reduceMotion}
        >
          {sprite.occupant.kind === 'generator'
            ? <PersistentGeneratorArt charges={runtimeGenerator?.charges ?? 0} size={cellSize} />
            : <PersistentMergeItemArt definitionId={sprite.occupant.definitionId} size={cellSize - 4} />}
        </PersistentSprite>;
      })}
    </View>
  </View>;
}

const AnimatedCell = memo(function AnimatedCell({ index, hoverCell, blocked, invalid, selected, compatible, left, top, width, height, children }: {
  index: number;
  hoverCell: SharedValue<number>;
  blocked: boolean;
  invalid: boolean;
  selected: boolean;
  compatible: boolean;
  left: number;
  top: number;
  width: number;
  height: number;
  children: React.ReactNode;
}) {
  const hoverStyle = useAnimatedStyle(() => ({
    backgroundColor: hoverCell.value === index ? '#73615F' : blocked ? '#40333F' : compatible ? '#6A554C' : selected ? '#665465' : '#5A4656',
    borderColor: hoverCell.value === index ? '#FFF0C3' : invalid ? '#F38A72' : compatible ? '#FFD681' : selected ? '#FFE09B' : blocked ? 'rgba(255,241,218,0.06)' : 'rgba(255,241,218,0.12)',
  }), [blocked, compatible, index, invalid, selected]);
  return <Animated.View style={[styles.cell, { height, left, top, width }, hoverStyle]}>{children}</Animated.View>;
});

const PersistentSprite = memo(function PersistentSprite({ instanceId, baseX, baseY, cellSize, enabled, geometry, motion, hoverCell, reduceMotion, onDrop, onPick, onTap, onComplete, children }: {
  instanceId: string;
  baseX: number;
  baseY: number;
  cellSize: number;
  enabled: boolean;
  geometry: MergeBoardGeometry;
  motion?: SpriteMotion;
  hoverCell: SharedValue<number>;
  reduceMotion: boolean;
  onDrop: (instanceId: string, dx: number, dy: number) => void;
  onPick: () => void;
  onTap: () => void;
  onComplete: (operationId: number, instanceId: string) => void;
  children: React.ReactNode;
}) {
  // World-space position is owned exclusively by Reanimated. React never
  // changes the sprite's left/top anchor during a drop, so a native layout
  // commit cannot race the release animation and expose a one-frame offset.
  const x = useSharedValue(baseX);
  const y = useSharedValue(baseY);
  const targetX = useSharedValue(baseX);
  const targetY = useSharedValue(baseY);
  const dragStartX = useSharedValue(baseX);
  const dragStartY = useSharedValue(baseY);
  const scale = useSharedValue(1);
  const progress = useSharedValue(motion ? 0 : 1);
  const animating = useSharedValue(motion ? 1 : 0);
  const arcHeight = useSharedValue(0);
  const gestureEnded = useSharedValue(false);
  const previousMotionToken = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (!motion || previousMotionToken.current === motion.token) return;
    previousMotionToken.current = motion.token;
    x.value = motion.startX;
    y.value = motion.startY;
    targetX.value = baseX;
    targetY.value = baseY;
    arcHeight.value = motion.arcHeight ?? 0;
    progress.value = 0;
    animating.value = 1;
    scale.value = 1;
    const finish = () => {
      'worklet';
      x.value = targetX.value;
      y.value = targetY.value;
      animating.value = 0;
      runOnJS(onComplete)(motion.operationId, instanceId);
    };
    if (reduceMotion) {
      progress.value = withTiming(1, { duration: 1 }, finish);
    } else if (motion.kind === 'spawn' || motion.kind.startsWith('merge-')) {
      progress.value = withTiming(1, { duration: motion.kind === 'spawn' ? 280 : 220, easing: Easing.out(Easing.cubic) }, finish);
    } else {
      progress.value = withSpring(1, motion.kind === 'swap' ? SWAP_SPRING : MOVE_SPRING, finish);
    }
  }, [animating, arcHeight, baseX, baseY, instanceId, motion, onComplete, progress, reduceMotion, scale, targetX, targetY, x, y]);

  useLayoutEffect(() => {
    if (motion) return;
    x.value = baseX;
    y.value = baseY;
    targetX.value = baseX;
    targetY.value = baseY;
    animating.value = 0;
  }, [animating, baseX, baseY, motion, targetX, targetY, x, y]);

  const panGesture = useMemo(() => Gesture.Pan().enabled(enabled).minDistance(2).averageTouches(true)
    .onBegin(() => {
      gestureEnded.value = false;
      progress.value = 1;
      dragStartX.value = x.value;
      dragStartY.value = y.value;
      scale.value = withSpring(1.035, { damping: 34, stiffness: 420, mass: 0.7 });
      runOnJS(onPick)();
    })
    .onUpdate((event) => {
      x.value = dragStartX.value + event.translationX;
      y.value = dragStartY.value + event.translationY;
      const target = mergeCellFromPointWorklet(x.value + cellSize / 2, y.value + cellSize / 2, geometry.cellSize, geometry.gap, geometry.inset, geometry.columns, geometry.rows);
      hoverCell.value = target;
    })
    .onEnd((event) => {
      gestureEnded.value = true;
      hoverCell.value = -1;
      scale.value = withTiming(1, { duration: 80 });
      runOnJS(onDrop)(instanceId, event.translationX, event.translationY);
    })
    .onFinalize(() => {
      hoverCell.value = -1;
      if (!gestureEnded.value) {
        x.value = withSpring(dragStartX.value, MOVE_SPRING);
        y.value = withSpring(dragStartY.value, MOVE_SPRING);
        scale.value = withTiming(1, { duration: 80 });
      }
    }), [cellSize, dragStartX, dragStartY, enabled, geometry.cellSize, geometry.columns, geometry.gap, geometry.inset, geometry.rows, gestureEnded, hoverCell, instanceId, onDrop, onPick, progress, scale, x, y]);

  const tapGesture = useMemo(() => Gesture.Tap().enabled(enabled).onEnd(() => runOnJS(onTap)()), [enabled, onTap]);
  const gesture = useMemo(() => Gesture.Exclusive(panGesture, tapGesture), [panGesture, tapGesture]);

  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const moving = animating.value === 1;
    const arc = moving && motion?.kind === 'spawn' ? -arcHeight.value * 4 * p * (1 - p) : 0;
    const mergeSource = motion?.kind === 'merge-source';
    const mergeTarget = motion?.kind === 'merge-target';
    const mergeResult = motion?.kind === 'merge-result';
    const worldX = moving ? x.value + (targetX.value - x.value) * p : x.value;
    const worldY = moving ? y.value + (targetY.value - y.value) * p : y.value;
    let opacity = 1;
    if (moving && (mergeSource || mergeTarget)) opacity = 1 - p;
    else if (moving && (mergeResult || motion?.kind === 'spawn')) opacity = p;
    return {
      opacity,
      zIndex: moving || scale.value > 1.001 ? 1000 : 10,
      transform: [
        { translateX: worldX },
        { translateY: worldY + arc },
        { scale: moving && motion?.kind === 'spawn'
          ? interpolate(p, [0, 0.28, 0.76, 1], [0.52, 1.18, 1.04, 1])
          : moving && mergeSource ? 1 - p * 0.14
            : moving && mergeTarget ? 1 - p * 0.08
              : moving && mergeResult ? 0.78 + p * 0.22
                : scale.value },
      ],
    };
  }, [animating, motion?.kind, targetX, targetY]);

  return <GestureDetector gesture={gesture}>
    <Animated.View pointerEvents={enabled ? 'auto' : 'none'} renderToHardwareTextureAndroid shouldRasterizeIOS style={[styles.sprite, { height: cellSize, left: 0, top: 0, width: cellSize }, animatedStyle]}>
      {children}
    </Animated.View>
  </GestureDetector>;
});

function PersistentGeneratorArt({ charges, size }: { charges: number; size: number }) {
  return <View style={[styles.generatorSprite, { height: size, width: size }]}>
    <Image accessibilityIgnoresInvertColors contentFit="contain" source={FEASTLE_MERGE_ART.pantry} style={styles.generatorArt} />
    <View style={styles.generatorCharge}>
      <IconSymbol color="#FFF4D5" name={charges ? 'bolt.fill' : 'clock'} size={9} />
      <ThemedText darkColor="#FFF4D5" style={styles.generatorChargeText}>{charges}</ThemedText>
    </View>
  </View>;
}

function SpawnParticleBurst({ origin, size }: { origin: { x: number; y: number }; size: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) });
  }, [progress]);
  const haloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.14, 0.7, 1], [0, 0.72, 0.22, 0]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.35, 1.55]) }],
  }));
  return <View pointerEvents="none" style={[styles.spawnBurst, { height: size, left: origin.x, top: origin.y, width: size }]}>
    <Animated.View style={[styles.spawnHalo, { height: size * 0.78, width: size * 0.78 }, haloStyle]} />
    {SPAWN_PARTICLES.map((particle, index) => <SpawnParticle index={index} key={index} particle={particle} progress={progress} size={size} />)}
  </View>;
}

const SPAWN_PARTICLES = [
  { angle: -2.74, distance: 0.64, color: '#FFE7A5', size: 5 },
  { angle: -2.05, distance: 0.78, color: '#FFBF68', size: 4 },
  { angle: -1.46, distance: 0.86, color: '#FFF2C6', size: 6 },
  { angle: -0.82, distance: 0.76, color: '#FFCF74', size: 4 },
  { angle: -0.18, distance: 0.68, color: '#FFE9AE', size: 5 },
  { angle: 0.58, distance: 0.58, color: '#F8B95E', size: 4 },
  { angle: 1.34, distance: 0.52, color: '#FFF0BE', size: 5 },
  { angle: 2.36, distance: 0.6, color: '#FFD47D', size: 4 },
] as const;

function SpawnParticle({ index, particle, progress, size }: {
  index: number;
  particle: (typeof SPAWN_PARTICLES)[number];
  progress: SharedValue<number>;
  size: number;
}) {
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const delayed = Math.max(0, Math.min(1, (p - index * 0.018) / (1 - index * 0.018)));
    const travel = interpolate(delayed, [0, 1], [size * 0.08, size * particle.distance]);
    return {
      opacity: interpolate(delayed, [0, 0.16, 0.72, 1], [0, 1, 0.72, 0]),
      transform: [
        { translateX: Math.cos(particle.angle) * travel },
        { translateY: Math.sin(particle.angle) * travel + delayed * delayed * size * 0.12 },
        { scale: interpolate(delayed, [0, 0.24, 1], [0.3, 1.1, 0.25]) },
      ],
    };
  }, [index, particle.angle, particle.distance, size]);
  return <Animated.View style={[styles.spawnParticle, { backgroundColor: particle.color, height: particle.size, width: particle.size }, style]} />;
}

function mergeCellFromPointWorklet(x: number, y: number, cellSize: number, gap: number, inset: number, columns: number, rows: number) {
  'worklet';
  const pitch = cellSize + gap;
  const column = Math.round((x - inset - cellSize / 2) / pitch);
  const row = Math.round((y - inset - cellSize / 2) / pitch);
  return column < 0 || column >= columns || row < 0 || row >= rows ? -1 : row * columns + column;
}

export function PersistentMergeItemArt({ definitionId, size }: { definitionId: string; size: number }) {
  const definition = MERGE_ITEMS_BY_ID.get(definitionId);
  if (!definition) return null;
  const artKey = definition.familyId === 'food' ? FOOD_ART[Math.min(definition.tier - 1, FOOD_ART.length - 1)] : null;
  if (artKey) return <FeastleMergeItemArt artKey={artKey} bare color={definition.color} size={size} tier={definition.tier} />;
  return <View style={[styles.familyArt, { height: size, width: size }]}><View style={[styles.familyDisc, { backgroundColor: definition.color }]}><IconSymbol color="#4A291B" name={definition.icon} size={Math.max(17, size * 0.48)} /></View><View style={[styles.familyTier, { backgroundColor: definition.color }]}><ThemedText darkColor="#4A291B" style={styles.familyTierText}>{definition.tier}</ThemedText></View></View>;
}

const styles = StyleSheet.create({
  board: { alignSelf: 'center', backgroundColor: '#493747', borderColor: '#D79A4A', borderCurve: 'continuous', borderRadius: 26, borderWidth: 2, boxShadow: '0 14px 28px rgba(55,28,13,0.42), inset 0 2px 0 rgba(255,228,172,0.24), inset 0 -3px 0 rgba(47,28,42,0.48)', overflow: 'visible', position: 'relative' },
  boardAnimating: { zIndex: 30 },
  cell: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 11, borderWidth: 1, justifyContent: 'center', overflow: 'visible', position: 'absolute' },
  cellPressable: { alignItems: 'center', height: '100%', justifyContent: 'center', width: '100%' },
  sprite: { alignItems: 'center', justifyContent: 'center', position: 'absolute' },
  spawnBurst: { alignItems: 'center', justifyContent: 'center', position: 'absolute', zIndex: 900 },
  spawnHalo: { backgroundColor: 'rgba(255,205,112,0.24)', borderColor: 'rgba(255,239,190,0.72)', borderRadius: 999, borderWidth: 1.5, position: 'absolute' },
  spawnParticle: { borderRadius: 999, boxShadow: '0 1px 5px rgba(255,188,83,0.5)', position: 'absolute' },
  familyArt: { alignItems: 'center', justifyContent: 'center' },
  familyDisc: { alignItems: 'center', borderColor: 'rgba(255,244,213,0.65)', borderRadius: 16, borderWidth: 2, boxShadow: '0 3px 8px rgba(38,19,11,0.32)', height: '76%', justifyContent: 'center', width: '76%' },
  familyTier: { alignItems: 'center', borderColor: 'rgba(91,51,25,0.42)', borderRadius: 999, borderWidth: 1, bottom: 2, height: 18, justifyContent: 'center', position: 'absolute', right: 2, width: 18 },
  familyTierText: { fontSize: 9, fontWeight: '900' },
  generatorArt: { height: '92%', width: '92%' },
  generatorSprite: { alignItems: 'center', justifyContent: 'center' },
  generatorCharge: { alignItems: 'center', backgroundColor: '#6B4A76', borderColor: '#D6B8DB', borderRadius: 999, borderWidth: 1, bottom: 1, flexDirection: 'row', gap: 2, paddingHorizontal: 4, position: 'absolute', right: 1 },
  generatorChargeText: { fontSize: 8, fontVariant: ['tabular-nums'], fontWeight: '900' },
});
