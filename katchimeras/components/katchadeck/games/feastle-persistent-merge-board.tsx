import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnUI } from 'react-native-worklets';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { FeastleMergeCelebration } from '@/components/katchadeck/world/quests/feastle-merge-primitives';
import { mergeWorldGeneratorArt, mergeWorldItemArt } from '@/constants/merge-world-art';
import { MERGE_GENERATORS_BY_ID, MERGE_HYBRID_RECIPES, MERGE_ITEMS_BY_ID, MERGE_WORLD_COLUMNS, MERGE_WORLD_ROWS } from '@/constants/merge-world-catalog';
import type { MergeBoardInteractionGate } from '@/features/onboarding/merge-ftue';
import { useMergeMotionPerformanceProbe, type MergeMotionPerformanceSample } from '@/hooks/use-merge-motion-performance-probe';
import { useDisposableTimers } from '@/hooks/use-disposable-timers';
import { acquireLifecycleResource } from '@/utils/lifecycle-performance';
import type { MergeBoardOccupant, MergeWorldCommand, MergeWorldCommandResult, MergeWorldState } from '@/types/merge-world';
import { mergeCellCenter, mergeCellFromPoint, mergeCellOrigin, mergeNeighborCellInDirection, type MergeBoardGeometry } from '@/utils/merge-world/board-geometry';

export type MergeBoardScreenMetrics = { geometry: MergeBoardGeometry; x: number; y: number };

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

const MOVE_SPRING = { damping: 32, stiffness: 360, mass: 0.78, overshootClamping: true } as const;
const SWAP_SPRING = { damping: 30, stiffness: 300, mass: 0.9, overshootClamping: true } as const;
// A finger rarely lands and lifts on the exact same pixel. Keep visual movement
// immediate, but classify short jitter as a tap so generators remain responsive.
const BOARD_TAP_SLOP = 9;
const BOARD_STATIONARY_TAP_SLOP = 2;
const BOARD_FLICK_MIN_DISTANCE = 3;
const BOARD_FLICK_MIN_VELOCITY = 650;
const MERGE_RESULT_BY_PAIR = Object.fromEntries([
  ...[...MERGE_ITEMS_BY_ID.values()].filter((item) => item.nextItemId).map((item) => [[item.id, item.id].sort().join('+'), item.nextItemId!]),
  ...MERGE_HYBRID_RECIPES.entries(),
]);

const LOCKED_CELL_OVERLAY = require('../../../assets/images/katchimeras/merge-world/locked/cloud-lock.webp');

function spritesFromState(state: MergeWorldState): SpriteRecord[] {
  return state.board.flatMap((cell, index) => cell.occupant ? [{ occupant: cell.occupant, cell: index }] : []);
}

function spriteId(sprite: SpriteRecord) {
  return sprite.occupant.kind === 'item' ? sprite.occupant.instanceId : `generator:${sprite.occupant.generatorId}`;
}

function introDelayForCell(cell: number) {
  const column = cell % MERGE_WORLD_COLUMNS;
  const row = Math.floor(cell / MERGE_WORLD_COLUMNS);
  const centerColumn = (MERGE_WORLD_COLUMNS - 1) / 2;
  const centerRow = (MERGE_WORLD_ROWS - 1) / 2;
  return 230 + Math.min(160, Math.hypot(column - centerColumn, row - centerRow) * 28);
}

function occupancyIdsFromState(state: MergeWorldState) {
  return state.board.map((cell) => {
    const occupant = cell.occupant;
    return occupant?.kind === 'item' ? occupant.instanceId : occupant?.kind === 'generator' ? `generator:${occupant.generatorId}` : '';
  });
}

function occupancyDefinitionsFromState(state: MergeWorldState) {
  return state.board.map((cell) => cell.occupant?.kind === 'item' ? cell.occupant.definitionId : '');
}

function isInterruptibleMotion(motion?: SpriteMotion) {
  return motion == null || motion.kind === 'move' || motion.kind === 'swap' || motion.kind === 'return' || motion.kind === 'spawn' || motion.kind === 'merge-result';
}

export function FeastlePersistentMergeBoard({ state, width, maxHeight, selectedCell, onSelect, onCommand, onScreenMetrics, onBlockedInteraction, interactionGate = { kind: 'open' }, interactionSessionKey = 'open', hiddenItemInstanceIds, effectsPaused: providedEffectsPaused, animateEntrance = true }: {
  state: MergeWorldState;
  width: number;
  animateEntrance?: boolean;
  maxHeight?: number;
  selectedCell: number | null;
  onSelect: (cell: number | null) => void;
  onCommand: (command: MergeWorldCommand) => MergeWorldCommandResult | null;
  onScreenMetrics?: (metrics: MergeBoardScreenMetrics) => void;
  onBlockedInteraction?: () => void;
  interactionGate?: MergeBoardInteractionGate;
  interactionSessionKey?: string;
  hiddenItemInstanceIds?: ReadonlySet<string>;
  effectsPaused?: SharedValue<number>;
}) {
  const gap = 1;
  const padding = width < 380 ? 5 : 6;
  const border = 0;
  const widthCellSize = (width - (padding + border) * 2 - gap * (MERGE_WORLD_COLUMNS - 1)) / MERGE_WORLD_COLUMNS;
  const heightCellSize = maxHeight == null
    ? widthCellSize
    : (maxHeight - (padding + border) * 2 - gap * (MERGE_WORLD_ROWS - 1)) / MERGE_WORLD_ROWS;
  const cellSize = Math.max(24, Math.floor(Math.min(widthCellSize, heightCellSize)));
  const inset = padding + border;
  const boardWidth = cellSize * MERGE_WORLD_COLUMNS + gap * (MERGE_WORLD_COLUMNS - 1) + inset * 2;
  const boardHeight = cellSize * MERGE_WORLD_ROWS + gap * (MERGE_WORLD_ROWS - 1) + inset * 2;
  const geometry = useMemo<MergeBoardGeometry>(() => ({ columns: MERGE_WORLD_COLUMNS, rows: MERGE_WORLD_ROWS, cellSize, gap, inset }), [cellSize, gap, inset]);
  const boardRef = useRef<View>(null);
  const reportScreenMetrics = useCallback(() => {
    const frame = requestAnimationFrame(() => {
      boardRef.current?.measureInWindow((x, y) => onScreenMetrics?.({ geometry, x, y }));
    });
    return () => cancelAnimationFrame(frame);
  }, [geometry, onScreenMetrics]);
  useEffect(reportScreenMetrics, [reportScreenMetrics]);
  const reduceMotion = useReducedMotion();
  const timers = useDisposableTimers('merge-board-feedback');
  const boardEntrance = useSharedValue(animateEntrance ? 0 : 1);
  const [entranceInteractive, setEntranceInteractive] = useState(Boolean(reduceMotion || !animateEntrance));
  useEffect(() => acquireLifecycleResource('merge_board', 'feastle-merge-board'), []);
  const hoverCell = useSharedValue(-1);
  const occupancyIds = useSharedValue(occupancyIdsFromState(state));
  const occupancyDefinitions = useSharedValue(occupancyDefinitionsFromState(state));
  const activeDragId = useSharedValue('');
  const activeSourceCell = useSharedValue(-1);
  const dragEpoch = useSharedValue(0);
  const dragPhase = useSharedValue(0); // 0 idle, 1 dragging, 2 released/cancelled
  const dragTranslationX = useSharedValue(0);
  const dragTranslationY = useSharedValue(0);
  const grabX = useSharedValue(0);
  const grabY = useSharedValue(0);
  const touchDownX = useSharedValue(0);
  const touchDownY = useSharedValue(0);
  const gestureFinished = useSharedValue(false);
  const maxGestureDistance = useSharedValue(0);
  const dragHapticTriggered = useSharedValue(false);
  const motionActive = useSharedValue(0);
  const localEffectsPaused = useSharedValue(0);
  const effectsPaused = providedEffectsPaused ?? localEffectsPaused;
  const slowOperationCount = useRef(0);
  const [reducedFx, setReducedFx] = useState(false);
  const recordMotionSample = useCallback((sample: MergeMotionPerformanceSample) => {
    if (sample.longestFrameMs <= 34 || reducedFx) return;
    slowOperationCount.current += 1;
    if (slowOperationCount.current < 2) return;
    setReducedFx(true);
    cancelAnimation(effectsPaused);
    effectsPaused.value = 1;
  }, [effectsPaused, reducedFx]);
  useMergeMotionPerformanceProbe(motionActive, recordMotionSample);
  const [presentation, setPresentation] = useState(state);
  const presentationRef = useRef(presentation);
  const [sprites, setSprites] = useState(() => spritesFromState(state));
  const introSpriteDelays = useRef(new Map(
    animateEntrance
      ? spritesFromState(state).map((sprite) => [spriteId(sprite), introDelayForCell(sprite.cell)])
      : [],
  ));
  const spritesRef = useRef(sprites);
  const [motions, setMotions] = useState<Record<string, SpriteMotion>>({});
  const motionsRef = useRef(motions);
  const [busy, setBusy] = useState(false);
  const [invalidFeedback, setInvalidFeedback] = useState<{ id: number; cell: number } | null>(null);
  const [mergeBursts, setMergeBursts] = useState<{ id: number; cell: number }[]>([]);
  const [spawnBursts, setSpawnBursts] = useState<{ id: number; cell: number }[]>([]);
  const operationSequence = useRef(0);
  const motionSequence = useRef(0);
  const burstSequence = useRef(0);
  const mergeBurstSequence = useRef(0);
  const invalidFeedbackSequence = useRef(0);
  const activeOperations = useRef(new Map<number, ActiveOperation>());
  const committedStateRef = useRef(state);
  const onSelectRef = useRef(onSelect);
  const selectedCellRef = useRef(selectedCell);
  const launchGeneratorRef = useRef<(generatorId: string) => void>(() => undefined);
  const dropRef = useRef<(instanceId: string, dx: number, dy: number, intendedTargetCell?: number | null) => void>(() => undefined);
  const boardDropRef = useRef<(instanceId: string, worldX: number, worldY: number, epoch: number, intendedTargetCell: number | null) => void>(() => undefined);
  const boardTapRef = useRef<(instanceId: string, worldX: number, worldY: number, epoch: number) => void>(() => undefined);
  const boardCancelRef = useRef<(instanceId: string, worldX: number, worldY: number, epoch: number) => void>(() => undefined);
  const blockInteraction = useCallback(() => onBlockedInteraction?.(), [onBlockedInteraction]);
  const gateKind = interactionGate.kind;
  const gateFromCell = interactionGate.kind === 'drag' ? interactionGate.fromCell : -1;
  const gateToCell = interactionGate.kind === 'drag' ? interactionGate.toCell : -1;
  const gateGeneratorCell = interactionGate.kind === 'generator' ? interactionGate.cell : -1;

  presentationRef.current = presentation;
  spritesRef.current = sprites;
  motionsRef.current = motions;
  onSelectRef.current = onSelect;
  selectedCellRef.current = selectedCell;

  useEffect(() => {
    cancelAnimation(boardEntrance);
    if (!animateEntrance) {
      boardEntrance.value = 1;
      setEntranceInteractive(true);
      return () => cancelAnimation(boardEntrance);
    }
    boardEntrance.value = 0;
    if (reduceMotion) {
      boardEntrance.value = withTiming(1, { duration: 100, easing: Easing.out(Easing.cubic) });
      setEntranceInteractive(true);
      return () => cancelAnimation(boardEntrance);
    }
    setEntranceInteractive(false);
    boardEntrance.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
    const interactiveTimer = timers.schedule(() => setEntranceInteractive(true), 120);
    return () => {
      timers.cancel(interactiveTimer);
      cancelAnimation(boardEntrance);
    };
  }, [animateEntrance, boardEntrance, reduceMotion, timers]);

  const boardEntranceStyle = useAnimatedStyle(() => {
    const progress = Math.max(0, Math.min(1, boardEntrance.value));
    return {
      opacity: interpolate(progress, [0, 0.14, 1], [0, 1, 1]),
      transform: [
        { translateY: (1 - progress) * 22 },
      ],
    };
  }, [boardEntrance]);

  useEffect(() => {
    const mountedOperations = activeOperations.current;
    // The route-level focus boundary reuses this shared value. Restore the
    // board's idle effect state after remounting from a Feastle scene.
    cancelAnimation(effectsPaused);
    effectsPaused.value = 0;
    return () => {
      timers.cancelAll();
      cancelAnimation(effectsPaused);
      effectsPaused.value = 1;
      motionActive.value = 0;
      mountedOperations.clear();
      motionsRef.current = {};
      hoverCell.value = -1;
      activeDragId.value = '';
      activeSourceCell.value = -1;
      dragPhase.value = 0;
    };
  }, [activeDragId, activeSourceCell, dragPhase, effectsPaused, hoverCell, motionActive, timers]);

  useEffect(() => {
    // A retained tab can return with worklet gesture ownership from the prior
    // FTUE node. Start every authored node with neutral touch/selection state;
    // board animations remain intact and continue reconciling normally.
    activeDragId.value = '';
    activeSourceCell.value = -1;
    dragPhase.value = 0;
    dragTranslationX.value = 0;
    dragTranslationY.value = 0;
    hoverCell.value = -1;
    gestureFinished.value = true;
    onSelectRef.current(null);
  }, [activeDragId, activeSourceCell, dragPhase, dragTranslationX, dragTranslationY, gestureFinished, hoverCell, interactionSessionKey]);

  useEffect(() => {
    if (state.revision < committedStateRef.current.revision) return;
    committedStateRef.current = state;
    occupancyIds.value = occupancyIdsFromState(state);
    occupancyDefinitions.value = occupancyDefinitionsFromState(state);
    if (activeOperations.current.size) return;
    presentationRef.current = state;
    setPresentation(state);
    const nextSprites = spritesFromState(state);
    spritesRef.current = nextSprites;
    setSprites(nextSprites);
  }, [occupancyDefinitions, occupancyIds, state]);

  const finishOperationIfReady = useCallback((operationId: number) => {
    const operation = activeOperations.current.get(operationId);
    if (!operation || operation.remaining.size || operation.finalState === undefined) return;
    if (operation.finalState && operation.finalState.revision >= committedStateRef.current.revision) {
      committedStateRef.current = operation.finalState;
    }
    activeOperations.current.delete(operationId);
    const remainingMotions = Object.fromEntries(Object.entries(motionsRef.current).filter(([, motion]) => motion.operationId !== operationId));
    motionsRef.current = remainingMotions;
    setMotions(remainingMotions);
    const finalState = committedStateRef.current;
    const canonicalSprites = spritesFromState(finalState);
    const canonicalIds = new Set(canonicalSprites.map(spriteId));
    // A merge temporarily keeps its consumed sprites mounted so they can fade
    // out. Remove those ghosts as soon as their own operation completes, while
    // retaining ghosts that still belong to another concurrent animation.
    const activeGhosts = spritesRef.current.filter((sprite) => {
      const id = spriteId(sprite);
      return !canonicalIds.has(id) && remainingMotions[id] !== undefined;
    });
    const reconciledSprites = [...canonicalSprites, ...activeGhosts];
    presentationRef.current = finalState;
    setPresentation(finalState);
    spritesRef.current = reconciledSprites;
    setSprites(reconciledSprites);
    const hasOperations = activeOperations.current.size > 0;
    setBusy(hasOperations);
    if (hasOperations) return;
    motionActive.value = 0;
    if (!reducedFx) effectsPaused.value = withDelay(500, withTiming(0, { duration: 1 }));
  }, [effectsPaused, motionActive, reducedFx]);

  const completeMotion = useCallback((operationId: number, instanceId: string) => {
    const operation = activeOperations.current.get(operationId);
    if (!operation) return;
    operation.remaining.delete(instanceId);
    finishOperationIfReady(operationId);
  }, [finishOperationIfReady]);

  const detachMotion = useCallback((instanceId: string) => {
    const motion = motionsRef.current[instanceId];
    if (!motion || !isInterruptibleMotion(motion)) return null;
    const operation = activeOperations.current.get(motion.operationId);
    operation?.remaining.delete(instanceId);
    const { [instanceId]: _detached, ...remainingMotions } = motionsRef.current;
    motionsRef.current = remainingMotions;
    return motion.operationId;
  }, []);

  const beginOperation = useCallback(({
    nextState,
    nextSprites,
    nextMotions,
    kind = 'board',
  }: {
    nextState: MergeWorldState;
    nextSprites: SpriteRecord[];
    nextMotions: Record<string, Omit<SpriteMotion, 'operationId' | 'token'>>;
    kind?: ActiveOperation['kind'];
  }) => {
    const operationId = ++operationSequence.current;
    const boundMotions = Object.fromEntries(Object.entries(nextMotions).map(([instanceId, motion]) => [instanceId, {
      ...motion,
      operationId,
      token: ++motionSequence.current,
    }]));
    activeOperations.current.set(operationId, { id: operationId, kind, remaining: new Set(Object.keys(boundMotions)), finalState: nextState });
    if (nextState.revision >= committedStateRef.current.revision) committedStateRef.current = nextState;
    occupancyIds.value = occupancyIdsFromState(nextState);
    occupancyDefinitions.value = occupancyDefinitionsFromState(nextState);
    presentationRef.current = nextState;
    setPresentation(nextState);
    spritesRef.current = nextSprites;
    setSprites(nextSprites);
    const combinedMotions = { ...motionsRef.current, ...boundMotions };
    motionsRef.current = combinedMotions;
    setMotions(combinedMotions);
    setBusy(true);
    motionActive.value = 1;
    cancelAnimation(effectsPaused);
    effectsPaused.value = 1;
  }, [effectsPaused, motionActive, occupancyDefinitions, occupancyIds]);

  const returnSpriteHome = useCallback((sprite: SpriteRecord, dx: number, dy: number, invalid?: number) => {
    if (invalid != null) {
      const feedback = { id: ++invalidFeedbackSequence.current, cell: invalid };
      setInvalidFeedback(feedback);
      timers.schedule(() => setInvalidFeedback((current) => current?.id === feedback.id ? null : current), 300);
      if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    const origin = mergeCellOrigin(geometry, sprite.cell);
    beginOperation({
      nextState: presentationRef.current,
      nextSprites: spritesRef.current,
      nextMotions: { [spriteId(sprite)]: { kind: 'return', startX: origin.x + dx, startY: origin.y + dy } },
    });
  }, [beginOperation, geometry, timers]);

  const drop = useCallback((instanceId: string, dx: number, dy: number, intendedTargetCell?: number | null) => {
    const current = presentationRef.current;
    const currentSprites = spritesRef.current;
    const sprite = currentSprites.find((entry) => spriteId(entry) === instanceId);
    if (!sprite) return;
    const activeMotion = motionsRef.current[instanceId];
    if (!isInterruptibleMotion(activeMotion)) return;
    const interruptedOperationIds = new Set<number>();
    const interruptedOperationId = activeMotion ? detachMotion(instanceId) : null;
    if (interruptedOperationId != null) interruptedOperationIds.add(interruptedOperationId);
    const finishInterruptedOperation = () => {
      interruptedOperationIds.forEach(finishOperationIfReady);
    };
    const returnHome = (invalid?: number) => {
      returnSpriteHome(sprite, dx, dy, invalid);
      onSelect(sprite.cell);
      finishInterruptedOperation();
    };
    const sourceCenter = mergeCellCenter(geometry, sprite.cell);
    const to = intendedTargetCell === undefined
      ? mergeCellFromPoint(geometry, sourceCenter.x + dx, sourceCenter.y + dy)
      : intendedTargetCell;
    if (to == null || to === sprite.cell) {
      returnHome();
      return;
    }
    const targetCell = current.board[to];
    if (!targetCell || targetCell.locked) {
      returnHome(to);
      return;
    }
    const target = currentSprites.find((entry) => entry.cell === to);
    if (target) {
      const targetId = spriteId(target);
      const targetMotion = motionsRef.current[targetId];
      if (targetMotion && !isInterruptibleMotion(targetMotion)) {
        returnHome();
        return;
      }
      const targetOperationId = targetMotion ? detachMotion(targetId) : null;
      if (targetOperationId != null) interruptedOperationIds.add(targetOperationId);
    }

    const command: MergeWorldCommand = { type: 'move', from: sprite.cell, to, now: Date.now() };
    const predicted = onCommand(command);
    if (!predicted) returnHome();
    if (!predicted) return;
    if (!predicted.changed) {
      returnHome(to);
      return;
    }

    const from = sprite.cell;
    const sourceOrigin = mergeCellOrigin(geometry, from);
    const targetOrigin = mergeCellOrigin(geometry, to);
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
      if (!reduceMotion) {
        const burst = { id: ++mergeBurstSequence.current, cell: to };
        setMergeBursts((bursts) => [...bursts, burst]);
        timers.schedule(() => setMergeBursts((bursts) => bursts.filter((entry) => entry.id !== burst.id)), 520);
      }
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
    onSelect(to);
    if (process.env.EXPO_OS === 'ios') {
      void Haptics.impactAsync(merging
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light);
    }
    beginOperation({ nextState: predicted.state, nextSprites, nextMotions });
    finishInterruptedOperation();
  }, [beginOperation, detachMotion, finishOperationIfReady, geometry, hoverCell, onCommand, onSelect, reduceMotion, returnSpriteHome, timers]);
  dropRef.current = drop;

  const launchGenerator = useCallback((generatorId: string) => {
    const current = presentationRef.current;
    const currentSprites = spritesRef.current;
    const from = current.board.findIndex((cell) => cell.occupant?.kind === 'generator' && cell.occupant.generatorId === generatorId);
    const now = Date.now();
    const command: MergeWorldCommand = { type: 'tapGenerator', generatorId, now, seed: `${now}:${current.revision}:${generatorId}` };
    const predicted = onCommand(command);
    if (!predicted) return;
    if (from >= 0) onSelect(from);
    const to = predicted.spawnedCell;
    const spawned = to == null ? null : predicted.state.board[to]?.occupant;
    if (!predicted.changed || from < 0 || to == null || spawned?.kind !== 'item') {
      return;
    }
    const start = mergeCellOrigin(geometry, from);
    const end = mergeCellOrigin(geometry, to);
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    const nextSprite: SpriteRecord = { occupant: spawned, cell: to };
    if (!reduceMotion) {
      const burst = { id: ++burstSequence.current, cell: from };
      const burstLimit = reducedFx ? 3 : 6;
      setSpawnBursts((bursts) => [...bursts.slice(-(burstLimit - 1)), burst]);
      timers.schedule(() => setSpawnBursts((bursts) => bursts.some((entry) => entry.id === burst.id)
        ? bursts.filter((entry) => entry.id !== burst.id)
        : bursts), 480);
    }
    beginOperation({
      nextState: predicted.state,
      nextSprites: [...currentSprites, nextSprite],
      nextMotions: { [spawned.instanceId]: { kind: 'spawn', startX: start.x, startY: start.y, arcHeight: Math.max(cellSize * 1.15, Math.min(cellSize * 2.1, distance * 0.22)) } },
      kind: 'spawn',
    });
  }, [beginOperation, cellSize, geometry, onCommand, onSelect, reduceMotion, reducedFx, timers]);
  launchGeneratorRef.current = launchGenerator;

  const pickSprite = useCallback((_instanceId: string) => {
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const dragSprite = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const tapSprite = useCallback((instanceId: string) => {
    const sprite = spritesRef.current.find((entry) => spriteId(entry) === instanceId);
    if (!sprite) return;
    if (sprite.occupant.kind === 'generator') launchGeneratorRef.current(sprite.occupant.generatorId);
    else onSelectRef.current(sprite.cell);
  }, []);

  const releaseBoardOwnership = useCallback((epoch: number) => {
    scheduleOnUI(() => {
      'worklet';
      if (dragEpoch.value !== epoch) return;
      activeDragId.value = '';
      activeSourceCell.value = -1;
      dragPhase.value = 0;
      dragTranslationX.value = 0;
      dragTranslationY.value = 0;
    });
  }, [activeDragId, activeSourceCell, dragEpoch, dragPhase, dragTranslationX, dragTranslationY]);

  const dropFromBoard = useCallback((instanceId: string, worldX: number, worldY: number, epoch: number, intendedTargetCell: number | null) => {
    const sprite = spritesRef.current.find((entry) => spriteId(entry) === instanceId);
    if (sprite) {
      const origin = mergeCellOrigin(geometry, sprite.cell);
      dropRef.current(instanceId, worldX - origin.x, worldY - origin.y, intendedTargetCell);
    }
    releaseBoardOwnership(epoch);
  }, [geometry, releaseBoardOwnership]);

  const settleInterruptedSprite = useCallback((instanceId: string, worldX: number, worldY: number, always: boolean) => {
    const sprite = spritesRef.current.find((entry) => spriteId(entry) === instanceId);
    if (!sprite) return;
    const activeMotion = motionsRef.current[instanceId];
    if (!activeMotion && !always) return;
    const interruptedOperationId = activeMotion && isInterruptibleMotion(activeMotion) ? detachMotion(instanceId) : null;
    const origin = mergeCellOrigin(geometry, sprite.cell);
    returnSpriteHome(sprite, worldX - origin.x, worldY - origin.y);
    if (interruptedOperationId != null) finishOperationIfReady(interruptedOperationId);
  }, [detachMotion, finishOperationIfReady, geometry, returnSpriteHome]);

  const tapFromBoard = useCallback((instanceId: string, worldX: number, worldY: number, epoch: number) => {
    settleInterruptedSprite(instanceId, worldX, worldY, false);
    tapSprite(instanceId);
    releaseBoardOwnership(epoch);
  }, [releaseBoardOwnership, settleInterruptedSprite, tapSprite]);

  const cancelFromBoard = useCallback((instanceId: string, worldX: number, worldY: number, epoch: number) => {
    settleInterruptedSprite(instanceId, worldX, worldY, true);
    releaseBoardOwnership(epoch);
  }, [releaseBoardOwnership, settleInterruptedSprite]);
  boardDropRef.current = dropFromBoard;
  boardTapRef.current = tapFromBoard;
  boardCancelRef.current = cancelFromBoard;
  const emitBoardDrop = useCallback((instanceId: string, worldX: number, worldY: number, epoch: number, intendedTargetCell: number | null) => boardDropRef.current(instanceId, worldX, worldY, epoch, intendedTargetCell), []);
  const emitBoardTap = useCallback((instanceId: string, worldX: number, worldY: number, epoch: number) => boardTapRef.current(instanceId, worldX, worldY, epoch), []);
  const emitBoardCancel = useCallback((instanceId: string, worldX: number, worldY: number, epoch: number) => boardCancelRef.current(instanceId, worldX, worldY, epoch), []);

  const accessibleAction = useCallback((cell: number) => {
    if (gateKind === 'locked') {
      blockInteraction();
      return;
    }
    if (gateKind === 'drag') {
      if (cell !== gateFromCell) {
        blockInteraction();
        return;
      }
      const source = spritesRef.current.find((entry) => entry.cell === gateFromCell);
      if (!source) return;
      const from = mergeCellCenter(geometry, gateFromCell);
      const to = mergeCellCenter(geometry, gateToCell);
      dropRef.current(spriteId(source), to.x - from.x, to.y - from.y, gateToCell);
      return;
    }
    if (gateKind === 'generator' && cell !== gateGeneratorCell) {
      blockInteraction();
      return;
    }
    const current = presentationRef.current;
    const occupant = current.board[cell]?.occupant;
    const occupantId = occupant?.kind === 'item' ? occupant.instanceId : occupant?.kind === 'generator' ? `generator:${occupant.generatorId}` : null;
    if (occupantId && motionsRef.current[occupantId]) return;
    if (occupant?.kind === 'generator') {
      launchGeneratorRef.current(occupant.generatorId);
      return;
    }
    const selectedCell = selectedCellRef.current;
    if (selectedCell == null) {
      if (occupant?.kind === 'item') onSelectRef.current(cell);
      return;
    }
    if (selectedCell === cell) onSelectRef.current(null);
    else {
      const selected = spritesRef.current.find((entry) => entry.cell === selectedCell);
      if (selected) {
        const from = mergeCellCenter(geometry, selected.cell);
        const to = mergeCellCenter(geometry, cell);
        dropRef.current(spriteId(selected), to.x - from.x, to.y - from.y);
      }
    }
  }, [blockInteraction, gateFromCell, gateGeneratorCell, gateKind, gateToCell, geometry]);

  const selectedDefinitionId = selectedCell == null || presentation.board[selectedCell]?.occupant?.kind !== 'item'
    ? null
    : presentation.board[selectedCell].occupant.definitionId;

  const boardGesture = useMemo(() => Gesture.Pan()
    .enabled(entranceInteractive)
    .maxPointers(1)
    .minDistance(0)
    .shouldCancelWhenOutside(false)
    .onTouchesDown((event) => {
      const touch = event.allTouches[0];
      if (!touch) return;
      const cell = mergeCellFromPointWorklet(touch.x, touch.y, geometry.cellSize, geometry.gap, geometry.inset, geometry.columns, geometry.rows);
      if (gateKind === 'locked' || (gateKind === 'drag' && cell !== gateFromCell) || (gateKind === 'generator' && cell !== gateGeneratorCell)) {
        activeDragId.value = '';
        activeSourceCell.value = -1;
        runOnJS(blockInteraction)();
        return;
      }
      const id = cell < 0 ? '' : occupancyIds.value[cell] ?? '';
      touchDownX.value = touch.x;
      touchDownY.value = touch.y;
      activeDragId.value = id;
      activeSourceCell.value = cell;
      dragTranslationX.value = 0;
      dragTranslationY.value = 0;
      gestureFinished.value = false;
      maxGestureDistance.value = 0;
      dragHapticTriggered.value = false;
      if (!id) return;
      runOnJS(pickSprite)(id);
      const column = cell % geometry.columns;
      const row = Math.floor(cell / geometry.columns);
      const pitch = geometry.cellSize + geometry.gap;
      grabX.value = geometry.inset + column * pitch;
      grabY.value = geometry.inset + row * pitch;
      dragEpoch.value += 1;
      dragPhase.value = 1;
      cancelAnimation(effectsPaused);
      effectsPaused.value = 1;
    })
    .onUpdate((event) => {
      if (!activeDragId.value) return;
      const distance = Math.hypot(event.translationX, event.translationY);
      const speed = Math.hypot(event.velocityX, event.velocityY);
      maxGestureDistance.value = Math.max(maxGestureDistance.value, distance);
      const hasDragIntent = distance > BOARD_TAP_SLOP
        || (distance >= BOARD_FLICK_MIN_DISTANCE && speed >= BOARD_FLICK_MIN_VELOCITY);
      if (hasDragIntent && !dragHapticTriggered.value) {
        dragHapticTriggered.value = true;
        runOnJS(dragSprite)();
      }
      dragTranslationX.value = event.translationX;
      dragTranslationY.value = event.translationY;
      hoverCell.value = mergeCellFromPointWorklet(
        grabX.value + event.translationX + geometry.cellSize / 2,
        grabY.value + event.translationY + geometry.cellSize / 2,
        geometry.cellSize,
        geometry.gap,
        geometry.inset,
        geometry.columns,
        geometry.rows,
      );
    })
    .onTouchesUp((event) => {
      const id = activeDragId.value;
      const touch = event.changedTouches[0];
      if (!id || !touch || gestureFinished.value) return;
      const dx = touch.x - touchDownX.value;
      const dy = touch.y - touchDownY.value;
      maxGestureDistance.value = Math.max(maxGestureDistance.value, Math.hypot(dx, dy));
      if (maxGestureDistance.value > BOARD_STATIONARY_TAP_SLOP) return;
      // Pan may never become ACTIVE for a perfectly still press. Commit the tap
      // from the raw touch-up lifecycle and guard onEnd so it cannot fire twice.
      gestureFinished.value = true;
      dragPhase.value = 2;
      dragTranslationX.value = dx;
      dragTranslationY.value = dy;
      hoverCell.value = -1;
      if (gateKind === 'drag') {
        runOnJS(blockInteraction)();
        runOnJS(emitBoardCancel)(id, grabX.value + dx, grabY.value + dy, dragEpoch.value);
        return;
      }
      runOnJS(emitBoardTap)(id, grabX.value + dx, grabY.value + dy, dragEpoch.value);
    })
    .onEnd((event) => {
      const id = activeDragId.value;
      if (!id || gestureFinished.value) return;
      gestureFinished.value = true;
      dragPhase.value = 2;
      dragTranslationX.value = event.translationX;
      dragTranslationY.value = event.translationY;
      hoverCell.value = -1;
      const worldX = grabX.value + event.translationX;
      const worldY = grabY.value + event.translationY;
      const epoch = dragEpoch.value;
      maxGestureDistance.value = Math.max(maxGestureDistance.value, Math.hypot(event.translationX, event.translationY));
      const speed = Math.hypot(event.velocityX, event.velocityY);
      const isFlick = maxGestureDistance.value >= BOARD_FLICK_MIN_DISTANCE && speed >= BOARD_FLICK_MIN_VELOCITY;
      if ((maxGestureDistance.value > BOARD_TAP_SLOP || isFlick) && !dragHapticTriggered.value) {
        dragHapticTriggered.value = true;
        runOnJS(dragSprite)();
      }
      if (maxGestureDistance.value <= BOARD_TAP_SLOP && !isFlick) {
        if (gateKind === 'drag') {
          runOnJS(blockInteraction)();
          runOnJS(emitBoardCancel)(id, worldX, worldY, epoch);
        } else runOnJS(emitBoardTap)(id, worldX, worldY, epoch);
      } else {
        if (gateKind === 'generator') {
          runOnJS(blockInteraction)();
          runOnJS(emitBoardCancel)(id, worldX, worldY, epoch);
          return;
        }
        const sourceCell = activeSourceCell.value;
        let targetCell = mergeCellFromPointWorklet(worldX + geometry.cellSize / 2, worldY + geometry.cellSize / 2, geometry.cellSize, geometry.gap, geometry.inset, geometry.columns, geometry.rows);
        if (isFlick && targetCell === sourceCell) {
          targetCell = mergeNeighborCellInDirection(
            { columns: geometry.columns, rows: geometry.rows },
            sourceCell,
            event.velocityX || event.translationX,
            event.velocityY || event.translationY,
          ) ?? -1;
        }
        if (gateKind === 'drag' && (sourceCell !== gateFromCell || targetCell !== gateToCell)) {
          runOnJS(blockInteraction)();
          runOnJS(emitBoardCancel)(id, worldX, worldY, epoch);
          return;
        }
        if (sourceCell >= 0 && targetCell >= 0 && sourceCell !== targetCell) {
          const ids = [...occupancyIds.value];
          const definitions = [...occupancyDefinitions.value];
          const targetId = ids[targetCell] ?? '';
          const sourceDefinition = definitions[sourceCell] ?? '';
          const targetDefinition = definitions[targetCell] ?? '';
          const mergeKey = sourceDefinition && targetDefinition ? [sourceDefinition, targetDefinition].sort().join('+') : '';
          if (!targetId) {
            ids[sourceCell] = '';
            ids[targetCell] = id;
            definitions[sourceCell] = '';
            definitions[targetCell] = sourceDefinition;
          } else if (!MERGE_RESULT_BY_PAIR[mergeKey]) {
            ids[sourceCell] = targetId;
            ids[targetCell] = id;
            definitions[sourceCell] = targetDefinition;
            definitions[targetCell] = sourceDefinition;
          }
          occupancyIds.value = ids;
          occupancyDefinitions.value = definitions;
        }
        runOnJS(emitBoardDrop)(id, worldX, worldY, epoch, targetCell < 0 ? null : targetCell);
      }
    })
    .onFinalize(() => {
      hoverCell.value = -1;
      const id = activeDragId.value;
      if (id && !gestureFinished.value) {
        dragPhase.value = 2;
        runOnJS(emitBoardCancel)(id, grabX.value + dragTranslationX.value, grabY.value + dragTranslationY.value, dragEpoch.value);
      }
      if (!reducedFx) effectsPaused.value = withDelay(500, withTiming(0, { duration: 1 }));
    }), [activeDragId, activeSourceCell, blockInteraction, dragEpoch, dragHapticTriggered, dragPhase, dragSprite, dragTranslationX, dragTranslationY, effectsPaused, emitBoardCancel, emitBoardDrop, emitBoardTap, entranceInteractive, gateFromCell, gateGeneratorCell, gateKind, gateToCell, geometry.cellSize, geometry.columns, geometry.gap, geometry.inset, geometry.rows, gestureFinished, grabX, grabY, hoverCell, maxGestureDistance, occupancyDefinitions, occupancyIds, pickSprite, reducedFx, touchDownX, touchDownY]);

  // Measure a stable, untransformed frame. The visual board enters with a
  // translateY animation; measuring that Animated.View cached a temporary
  // screen Y and caused parcel flights to land below their eventual cells.
  return <View onLayout={reportScreenMetrics} ref={boardRef} style={[styles.boardFrame, { height: boardHeight, width: boardWidth }]}>
    <GestureDetector gesture={boardGesture}><Animated.View accessibilityLabel="Feastle merge board, seven columns by nine rows" style={[styles.board, busy && styles.boardAnimating, { height: boardHeight, padding, width: boardWidth }, boardEntranceStyle]}>
    <LinearGradient colors={['#788143', '#55602F', '#384321']} locations={[0, 0.52, 1]} pointerEvents="none" style={styles.boardGradient} />
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {presentation.board.map((cell, index) => {
        const origin = mergeCellOrigin(geometry, index);
        const occupant = cell.occupant;
        const item = occupant?.kind === 'item' ? occupant : null;
        const generator = occupant?.kind === 'generator' ? MERGE_GENERATORS_BY_ID.get(occupant.generatorId) : null;
        const definition = item ? MERGE_ITEMS_BY_ID.get(item.definitionId) : null;
        const compatible = Boolean(selectedDefinitionId && item && item.definitionId === selectedDefinitionId && selectedCell !== index);
        const label = generator ? `${generator.name}. Tap to generate. Costs 1 Energy.` : definition ? `${definition.name}, tier ${definition.tier}` : cell.locked ? 'Blocked board space' : 'Empty board space';
        return <BoardCell
          accessibilityActionLabel={gateKind === 'drag' && index === gateFromCell ? 'Merge with highlighted item' : generator ? 'Generate item' : 'Select or move item'}
          accessibilityDisabled={gateKind === 'locked' || (gateKind === 'drag' && index !== gateFromCell) || (gateKind === 'generator' && index !== gateGeneratorCell)}
          accessibilityLabel={label}
          blocked={cell.locked && !occupant}
          compatible={compatible}
          height={cellSize}
          index={index}
          invalid={invalidFeedback?.cell === index}
          key={index}
          left={origin.x}
          onActivate={accessibleAction}
          selected={selectedCell === index}
          top={origin.y}
          width={cellSize}
        />;
      })}
      <HoverCellOverlay geometry={geometry} hoverCell={hoverCell} />
    </View>
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {spawnBursts.map((burst) => <SpawnParticleBurst key={burst.id} origin={mergeCellOrigin(geometry, burst.cell)} reduced={reducedFx} size={cellSize} />)}
      {sprites.filter((sprite) => sprite.occupant.kind !== 'item' || !hiddenItemInstanceIds?.has(sprite.occupant.instanceId)).map((sprite) => {
        const origin = mergeCellOrigin(geometry, sprite.cell);
        const id = spriteId(sprite);
        return <PersistentSprite
          baseX={origin.x}
          baseY={origin.y}
          cellSize={cellSize}
          activeDragId={activeDragId}
          dragEpoch={dragEpoch}
          dragPhase={dragPhase}
          dragTranslationX={dragTranslationX}
          dragTranslationY={dragTranslationY}
          entranceDelay={introSpriteDelays.current.get(id) ?? null}
          grabX={grabX}
          grabY={grabY}
          instanceId={id}
          key={id}
          motion={motions[id]}
          mossproutOnboarding={presentation.activeOrders.some((order) => order.id.startsWith('mossprout:chapter-0:'))}
          occupant={sprite.occupant}
          onComplete={completeMotion}
          reduceMotion={reduceMotion}
        />;
      })}
    </View>
    {selectedCell != null && presentation.board[selectedCell]?.occupant
      ? <SelectedCellCorners cell={selectedCell} geometry={geometry} reduceMotion={reduceMotion} />
      : null}
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.feedbackLayer]}>
      {mergeBursts.map((burst) => <MergeCelebrationOverlay cell={burst.cell} geometry={geometry} key={burst.id} />)}
      {invalidFeedback ? <InvalidCellFeedback cell={invalidFeedback.cell} geometry={geometry} key={invalidFeedback.id} /> : null}
    </View>
    </Animated.View></GestureDetector>
  </View>;
}

const BoardCell = memo(function BoardCell({ accessibilityActionLabel, accessibilityDisabled, accessibilityLabel, blocked, invalid, selected, compatible, index, left, top, width, height, onActivate }: {
  accessibilityActionLabel: string;
  accessibilityDisabled: boolean;
  accessibilityLabel: string;
  blocked: boolean;
  invalid: boolean;
  selected: boolean;
  compatible: boolean;
  index: number;
  left: number;
  top: number;
  width: number;
  height: number;
  onActivate: (cell: number) => void;
}) {
  const column = index % MERGE_WORLD_COLUMNS;
  const row = Math.floor(index / MERGE_WORLD_COLUMNS);
  const alternate = (column + row) % 2 === 1;
  return <View style={[styles.cell, {
    backgroundColor: compatible ? '#F1D995'
      : selected ? '#FFE9AD'
        : alternate ? '#ECD4A7' : '#F2DFB8',
    borderColor: invalid ? '#D95E4B' : compatible ? '#D19135' : selected ? '#C67E2C' : 'rgba(150,104,51,0.34)',
    boxShadow: 'inset 0 2px 2px rgba(255,251,226,0.34), inset 0 -3px 4px rgba(101,65,25,0.11)',
    height, left, top, width,
  }]}>
    <View
      accessible
      accessibilityActions={[{ name: 'activate', label: accessibilityActionLabel }]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: accessibilityDisabled }}
      onAccessibilityAction={() => onActivate(index)}
      style={styles.cellPressable}>
      {blocked ? <Image accessibilityIgnoresInvertColors allowDownscaling cachePolicy="memory" contentFit="fill" recyclingKey="merge-locked-cloud" source={LOCKED_CELL_OVERLAY} style={styles.lockedOverlay} transition={0} /> : null}
    </View>
  </View>;
});

function MergeCelebrationOverlay({ cell, geometry }: { cell: number; geometry: MergeBoardGeometry }) {
  const origin = mergeCellOrigin(geometry, cell);
  return <View style={[styles.mergeCelebrationOverlay, { height: geometry.cellSize, left: origin.x, top: origin.y, width: geometry.cellSize }]}>
    <FeastleMergeCelebration size={geometry.cellSize} />
  </View>;
}

function InvalidCellFeedback({ cell, geometry }: { cell: number; geometry: MergeBoardGeometry }) {
  const progress = useSharedValue(0);
  const origin = mergeCellOrigin(geometry, cell);
  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.quad) });
    return () => cancelAnimation(progress);
  }, [progress]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.12, 0.78, 1], [0.35, 1, 0.82, 0]),
    transform: [
      { translateX: interpolate(progress.value, [0, 0.15, 0.33, 0.52, 0.7, 1], [0, -5, 5, -4, 2.5, 0]) },
      { scale: interpolate(progress.value, [0, 0.18, 0.72, 1], [1, 1.025, 1.01, 1]) },
    ],
  }));
  return <Animated.View style={[styles.invalidCellFeedback, { height: geometry.cellSize, left: origin.x, top: origin.y, width: geometry.cellSize }, style]}>
    <IconSymbol color="#FFE1B4" name="leaf.fill" size={Math.max(15, geometry.cellSize * 0.38)} />
  </Animated.View>;
}

function HoverCellOverlay({ geometry, hoverCell }: { geometry: MergeBoardGeometry; hoverCell: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const index = hoverCell.value;
    if (index < 0) return { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }] };
    const column = index % geometry.columns;
    const row = Math.floor(index / geometry.columns);
    const pitch = geometry.cellSize + geometry.gap;
    return {
      opacity: 1,
      transform: [
        { translateX: geometry.inset + column * pitch },
        { translateY: geometry.inset + row * pitch },
      ],
    };
  }, [geometry.cellSize, geometry.columns, geometry.gap, geometry.inset]);
  return <Animated.View pointerEvents="none" style={[styles.hoverCell, { height: geometry.cellSize, width: geometry.cellSize }, style]} />;
}

const PersistentSprite = memo(function PersistentSprite({ instanceId, baseX, baseY, cellSize, activeDragId, dragEpoch, dragPhase, dragTranslationX, dragTranslationY, entranceDelay, grabX, grabY, motion, mossproutOnboarding, reduceMotion, onComplete, occupant }: {
  instanceId: string;
  baseX: number;
  baseY: number;
  cellSize: number;
  activeDragId: SharedValue<string>;
  dragEpoch: SharedValue<number>;
  dragPhase: SharedValue<number>;
  dragTranslationX: SharedValue<number>;
  dragTranslationY: SharedValue<number>;
  entranceDelay: number | null;
  grabX: SharedValue<number>;
  grabY: SharedValue<number>;
  motion?: SpriteMotion;
  mossproutOnboarding: boolean;
  reduceMotion: boolean;
  onComplete: (operationId: number, instanceId: string) => void;
  occupant: MergeBoardOccupant;
}) {
  const x = useSharedValue(baseX);
  const y = useSharedValue(baseY);
  const targetX = useSharedValue(baseX);
  const targetY = useSharedValue(baseY);
  const scale = useSharedValue(1);
  const spriteOpacity = useSharedValue(1);
  const progress = useSharedValue(motion ? 0 : 1);
  const animating = useSharedValue(motion ? 1 : 0);
  const arcHeight = useSharedValue(0);
  const activeMotionKind = useSharedValue<MotionKind | null>(motion?.kind ?? null);
  const capturedDragEpoch = useSharedValue(-1);
  const previousMotionToken = useRef<number | null>(null);
  const entranceProgress = useSharedValue(entranceDelay == null ? 1 : 0);
  const entranceReduceMotion = useRef(reduceMotion).current;

  useEffect(() => {
    if (entranceDelay == null) return;
    entranceProgress.value = 0;
    entranceProgress.value = entranceReduceMotion
      ? withTiming(1, { duration: 90, easing: Easing.out(Easing.cubic) })
      : withDelay(entranceDelay, withSpring(1, { damping: 13, mass: 0.58, stiffness: 240 }));
    return () => cancelAnimation(entranceProgress);
  }, [entranceDelay, entranceProgress, entranceReduceMotion]);

  useAnimatedReaction(
    () => activeDragId.value === instanceId ? dragEpoch.value : -1,
    (epoch) => {
      if (epoch < 0 || capturedDragEpoch.value === epoch) return;
      const p = progress.value;
      const wasAnimating = animating.value === 1;
      const kind = activeMotionKind.value;
      const arc = wasAnimating && kind === 'spawn' ? -arcHeight.value * 4 * p * (1 - p) : 0;
      const currentX = wasAnimating ? x.value + (targetX.value - x.value) * p : x.value;
      const currentY = (wasAnimating ? y.value + (targetY.value - y.value) * p : y.value) + arc;
      let currentOpacity = spriteOpacity.value;
      let currentScale = scale.value;
      if (wasAnimating && (kind === 'merge-result' || kind === 'spawn')) currentOpacity = p;
      if (wasAnimating && kind === 'spawn') currentScale = interpolate(p, [0, 0.28, 0.76, 1], [0.52, 1.18, 1.04, 1]);
      else if (wasAnimating && kind === 'merge-result') currentScale = 0.78 + p * 0.22;
      cancelAnimation(progress);
      x.value = currentX;
      y.value = currentY;
      animating.value = 0;
      spriteOpacity.value = currentOpacity;
      scale.value = currentScale;
      grabX.value = currentX;
      grabY.value = currentY;
      capturedDragEpoch.value = epoch;
      spriteOpacity.value = withTiming(1, { duration: 70 });
      scale.value = withSpring(1.035, { damping: 34, stiffness: 420, mass: 0.7 });
    },
    [instanceId],
  );

  useAnimatedReaction(
    () => activeDragId.value === instanceId ? dragPhase.value : 0,
    (phase, previousPhase) => {
      if (phase !== 2 || previousPhase === 2) return;
      x.value = grabX.value + dragTranslationX.value;
      y.value = grabY.value + dragTranslationY.value;
      animating.value = 0;
      scale.value = withTiming(1, { duration: 80 });
    },
    [instanceId],
  );

  useLayoutEffect(() => {
    if (!motion || previousMotionToken.current === motion.token) return;
    previousMotionToken.current = motion.token;
    scheduleOnUI(() => {
      'worklet';
      // A newer finger always wins. A React commit from the previous drop may
      // arrive after the next pan has already started; never let that stale
      // settle setup overwrite coordinates currently owned by the gesture.
      if (activeDragId.value === instanceId && dragPhase.value !== 0) return;
      activeMotionKind.value = motion.kind;
      x.value = motion.startX;
      y.value = motion.startY;
      targetX.value = baseX;
      targetY.value = baseY;
      arcHeight.value = motion.arcHeight ?? 0;
      progress.value = 0;
      animating.value = 1;
      spriteOpacity.value = 1;
      scale.value = 1;
      const finish = (finished?: boolean) => {
        'worklet';
        if (!finished) return;
        x.value = targetX.value;
        y.value = targetY.value;
        // Keep the terminal animated state until React removes the motion prop.
        // In particular, merge sources must remain at opacity 0; clearing this
        // flag here made the consumed artwork flash fully opaque for one frame.
        runOnJS(onComplete)(motion.operationId, instanceId);
      };
      if (reduceMotion) {
        progress.value = withTiming(1, { duration: 1 }, finish);
      } else if (motion.kind === 'spawn' || motion.kind.startsWith('merge-')) {
        progress.value = withTiming(1, { duration: motion.kind === 'spawn' ? 280 : 220, easing: Easing.out(Easing.cubic) }, finish);
      } else {
        progress.value = withSpring(1, motion.kind === 'swap' ? SWAP_SPRING : MOVE_SPRING, finish);
      }
    });
  }, [activeDragId, activeMotionKind, animating, arcHeight, baseX, baseY, dragPhase, instanceId, motion, onComplete, progress, reduceMotion, scale, spriteOpacity, targetX, targetY, x, y]);

  useLayoutEffect(() => {
    if (motion) return;
    scheduleOnUI(() => {
      'worklet';
      if (activeDragId.value === instanceId && dragPhase.value !== 0) return;
      activeMotionKind.value = null;
      x.value = baseX;
      y.value = baseY;
      targetX.value = baseX;
      targetY.value = baseY;
      animating.value = 0;
      spriteOpacity.value = 1;
    });
  }, [activeDragId, activeMotionKind, animating, baseX, baseY, dragPhase, instanceId, motion, spriteOpacity, targetX, targetY, x, y]);

  useEffect(() => () => {
    cancelAnimation(entranceProgress);
    cancelAnimation(progress);
    cancelAnimation(scale);
    cancelAnimation(spriteOpacity);
    cancelAnimation(x);
    cancelAnimation(y);
  }, [entranceProgress, progress, scale, spriteOpacity, x, y]);

  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const moving = animating.value === 1;
    const dragging = activeDragId.value === instanceId && dragPhase.value !== 0;
    const motionKind = activeMotionKind.value;
    const arc = moving && motionKind === 'spawn' ? -arcHeight.value * 4 * p * (1 - p) : 0;
    const mergeSource = motionKind === 'merge-source';
    const mergeTarget = motionKind === 'merge-target';
    const mergeResult = motionKind === 'merge-result';
    const worldX = dragging ? grabX.value + dragTranslationX.value : moving ? x.value + (targetX.value - x.value) * p : x.value;
    const worldY = dragging ? grabY.value + dragTranslationY.value : moving ? y.value + (targetY.value - y.value) * p : y.value;
    let opacity = spriteOpacity.value;
    if (moving && (mergeSource || mergeTarget)) opacity = 1 - p;
    else if (moving && (mergeResult || motionKind === 'spawn')) opacity = p;
    const intro = Math.max(0, Math.min(1, entranceProgress.value));
    const motionScale = moving && motionKind === 'spawn'
      ? interpolate(p, [0, 0.28, 0.76, 1], [0.52, 1.18, 1.04, 1])
      : moving && mergeSource ? 1 - p * 0.14
        : moving && mergeTarget ? 1 - p * 0.08
          : moving && mergeResult ? 0.78 + p * 0.22
            : scale.value;
    return {
      opacity: opacity * intro,
      zIndex: dragging || moving || scale.value > 1.001 ? 1000 : 10,
      transform: [
        { translateX: worldX },
        { translateY: worldY + arc },
        { translateY: (1 - intro) * 8 },
        { scale: motionScale * interpolate(intro, [0, 0.68, 1], [0.72, 1.08, 1]) },
      ],
    };
  }, [activeDragId, activeMotionKind, animating, dragPhase, dragTranslationX, dragTranslationY, entranceProgress, grabX, grabY, instanceId, spriteOpacity, targetX, targetY]);

  return <Animated.View pointerEvents="none" style={[styles.sprite, { height: cellSize, left: 0, top: 0, width: cellSize }, animatedStyle]}>
      {occupant.kind === 'generator'
        ? <PersistentGeneratorArt generatorId={occupant.generatorId} mossproutOnboarding={mossproutOnboarding} size={cellSize} />
        : <PersistentMergeItemArt definitionId={occupant.definitionId} size={cellSize - 4} />}
    </Animated.View>;
});

function PersistentGeneratorArt({ generatorId, mossproutOnboarding, size }: { generatorId: string; mossproutOnboarding: boolean; size: number }) {
  const art = mergeWorldGeneratorArt(generatorId, { mossproutOnboarding });
  return <View style={[styles.generatorSprite, { height: size, width: size }]}>
    <GeneratorSparkles size={size} />
    {art ? <Image accessibilityIgnoresInvertColors allowDownscaling cachePolicy="memory" contentFit="contain" recyclingKey={`merge-generator-${generatorId}`} source={art} style={styles.generatorArt} transition={0} /> : null}
    <View style={styles.generatorBolt}>
      <IconSymbol color="#FFD45F" name="bolt.fill" size={13} />
    </View>
  </View>;
}

function SelectedCellCorners({ cell, geometry, reduceMotion }: { cell: number; geometry: MergeBoardGeometry; reduceMotion: boolean }) {
  const pulse = useSharedValue(0);
  const origin = mergeCellOrigin(geometry, cell);
  useEffect(() => {
    pulse.value = reduceMotion
      ? 0
      : withRepeat(withSequence(
          withTiming(1, { duration: 720, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 720, easing: Easing.inOut(Easing.quad) }),
        ), -1, false);
    return () => cancelAnimation(pulse);
  }, [pulse, reduceMotion]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.84, 1]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.96, 1.035]) }],
  }));
  const cornerSize = Math.max(14, geometry.cellSize * 0.29);
  const arm = Math.max(4, geometry.cellSize * 0.075);
  return <Animated.View
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
    pointerEvents="none"
    style={[
      styles.selectedCorners,
      { height: geometry.cellSize, left: origin.x, top: origin.y, width: geometry.cellSize },
      animatedStyle,
    ]}>
    {(['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const).map((position) => <View
      key={position}
      style={[
        styles.selectionCorner,
        { height: cornerSize, width: cornerSize },
        position === 'topLeft' && styles.selectionCornerTopLeft,
        position === 'topRight' && styles.selectionCornerTopRight,
        position === 'bottomLeft' && styles.selectionCornerBottomLeft,
        position === 'bottomRight' && styles.selectionCornerBottomRight,
      ]}>
      <View style={[styles.selectionCornerHorizontal, { height: arm }]} />
      <View style={[styles.selectionCornerVertical, { width: arm }]} />
    </View>)}
  </Animated.View>;
}

// One continuous sparkle cycles through deliberately irregular launch lanes.
// Keeping a single particle in flight avoids the synchronized three-star
// "burst, pause, burst" rhythm while still making the generator feel alive.
const GENERATOR_SPARKLE_LANES = [0.12, 0.68, 0.35, 0.79, 0.22, 0.55, 0.43, 0.72] as const;
const GENERATOR_SPARKLE_CYCLE_MS = 700;

function GeneratorSparkles({ size }: { size: number }) {
  const reduceMotion = useReducedMotion();
  return <View pointerEvents="none" style={[styles.generatorSparkles, { height: size * 0.82, width: size * 0.88 }]}>
    <GeneratorSparkle reduceMotion={reduceMotion} size={size} />
  </View>;
}

function GeneratorSparkle({ reduceMotion, size }: {
  reduceMotion: boolean;
  size: number;
}) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = reduceMotion
      ? 0.46
      : withRepeat(
          withTiming(GENERATOR_SPARKLE_LANES.length, {
            duration: GENERATOR_SPARKLE_CYCLE_MS * GENERATOR_SPARKLE_LANES.length,
            easing: Easing.linear,
          }),
          -1,
          false,
        );
    return () => cancelAnimation(progress);
  }, [progress, reduceMotion]);
  const sparkleStyle = useAnimatedStyle(() => {
    const wholeCycle = Math.floor(progress.value);
    const cycle = Math.min(GENERATOR_SPARKLE_LANES.length - 1, wholeCycle % GENERATOR_SPARKLE_LANES.length);
    const p = reduceMotion ? 0.46 : progress.value - wholeCycle;
    const lane = GENERATOR_SPARKLE_LANES[cycle] ?? 0.5;
    const nextLane = GENERATOR_SPARKLE_LANES[(cycle + 1) % GENERATOR_SPARKLE_LANES.length] ?? 0.5;
    return {
      opacity: reduceMotion ? 0.72 : interpolate(p, [0, 0.05, 0.82, 1], [0, 1, 0.8, 0]),
      transform: [
        { translateX: size * lane + interpolate(p, [0, 1], [0, size * (nextLane - lane) * 0.1]) },
        { translateY: interpolate(p, [0, 1], [size * 0.24, -size * 0.62]) },
        { rotate: `${interpolate(p, [0, 1], [-10, 34])}deg` },
        { scale: interpolate(p, [0, 0.14, 0.8, 1], [0.38, 1, 0.86, 0.42]) },
      ],
    };
  }, [reduceMotion, size]);
  const sparkleSize = Math.max(11, size * 0.18);
  return <Animated.View style={[styles.generatorSparkle, { height: sparkleSize, width: sparkleSize }, sparkleStyle]}>
    <IconSymbol color="#FFF5B8" name="sparkles" size={sparkleSize} />
  </Animated.View>;
}

function SpawnParticleBurst({ origin, reduced, size }: { origin: { x: number; y: number }; reduced: boolean; size: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) });
    return () => cancelAnimation(progress);
  }, [progress]);
  const haloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.14, 0.7, 1], [0, 0.72, 0.22, 0]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.35, 1.55]) }],
  }));
  return <View pointerEvents="none" style={[styles.spawnBurst, { height: size, left: origin.x, top: origin.y, width: size }]}>
    <Animated.View style={[styles.spawnHalo, { height: size * 0.78, width: size * 0.78 }, haloStyle]} />
    {SPAWN_PARTICLES.slice(0, reduced ? 4 : 8).map((particle, index) => <SpawnParticle index={index} key={index} particle={particle} progress={progress} size={size} />)}
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
  const authoredArt = mergeWorldItemArt(definitionId);
  if (authoredArt) return <View style={[styles.familyArt, { height: size, width: size }]}><Image accessibilityIgnoresInvertColors allowDownscaling cachePolicy="memory" contentFit="contain" recyclingKey={definitionId} source={authoredArt} style={{ height: size, width: size }} transition={0} /></View>;
  return <View style={[styles.familyArt, { height: size, width: size }]}><View style={[styles.familyDisc, { backgroundColor: definition.color }]}><IconSymbol color="#4A291B" name={definition.icon} size={Math.max(17, size * 0.48)} /></View></View>;
}

const styles = StyleSheet.create({
  boardFrame: { alignSelf: 'center', overflow: 'visible', position: 'relative' },
  board: { alignSelf: 'center', backgroundColor: '#4D582B', borderRadius: 0, borderWidth: 0, boxShadow: '0 13px 24px rgba(39,31,16,0.38), 0 3px 5px rgba(39,31,16,0.22), inset 0 3px 2px rgba(255,242,193,0.24), inset 0 -4px 5px rgba(29,38,16,0.34)', overflow: 'visible', position: 'relative' },
  boardGradient: { ...StyleSheet.absoluteFillObject, borderRadius: 0 },
  boardAnimating: { zIndex: 30 },
  cell: { alignItems: 'center', borderRadius: 0, borderWidth: 0.5, justifyContent: 'center', overflow: 'visible', position: 'absolute' },
  cellPressable: { alignItems: 'center', height: '100%', justifyContent: 'center', width: '100%' },
  lockedOverlay: { ...StyleSheet.absoluteFillObject, height: '100%', width: '100%' },
  hoverCell: { backgroundColor: 'rgba(244,204,110,0.34)', borderColor: '#E1A644', borderRadius: 0, borderWidth: 2, left: 0, position: 'absolute', top: 0, zIndex: 20 },
  feedbackLayer: { zIndex: 2000 },
  mergeCelebrationOverlay: { alignItems: 'center', justifyContent: 'center', position: 'absolute', zIndex: 1400 },
  invalidCellFeedback: { alignItems: 'center', backgroundColor: 'rgba(205,76,56,0.38)', borderColor: '#F38A72', borderRadius: 0, borderWidth: 2, boxShadow: '0 0 12px rgba(225,91,67,0.42)', justifyContent: 'center', position: 'absolute', zIndex: 1450 },
  sprite: { alignItems: 'center', justifyContent: 'center', position: 'absolute' },
  selectedCorners: { position: 'absolute', zIndex: 1300 },
  selectionCorner: { position: 'absolute' },
  selectionCornerTopLeft: { left: -2, top: -2 },
  selectionCornerTopRight: { right: -2, top: -2, transform: [{ rotate: '90deg' }] },
  selectionCornerBottomLeft: { bottom: -2, left: -2, transform: [{ rotate: '-90deg' }] },
  selectionCornerBottomRight: { bottom: -2, right: -2, transform: [{ rotate: '180deg' }] },
  selectionCornerHorizontal: { backgroundColor: '#147F91', borderColor: '#C8FCFF', borderRadius: 3, borderWidth: 1.5, boxShadow: '0 1px 0 rgba(3,54,69,0.95), 0 0 7px rgba(57,218,231,0.96)', left: 0, position: 'absolute', right: 0, top: 0 },
  selectionCornerVertical: { backgroundColor: '#147F91', borderColor: '#C8FCFF', borderRadius: 3, borderWidth: 1.5, bottom: 0, boxShadow: '1px 0 0 rgba(3,54,69,0.95), 0 0 7px rgba(57,218,231,0.96)', left: 0, position: 'absolute', top: 0 },
  spawnBurst: { alignItems: 'center', justifyContent: 'center', position: 'absolute', zIndex: 900 },
  spawnHalo: { backgroundColor: 'rgba(255,205,112,0.24)', borderColor: 'rgba(255,239,190,0.72)', borderRadius: 999, borderWidth: 1.5, position: 'absolute' },
  spawnParticle: { borderRadius: 999, position: 'absolute' },
  familyArt: { alignItems: 'center', justifyContent: 'center' },
  familyDisc: { alignItems: 'center', borderColor: 'rgba(255,244,213,0.65)', borderRadius: 16, borderWidth: 2, boxShadow: '0 3px 8px rgba(38,19,11,0.32)', height: '76%', justifyContent: 'center', width: '76%' },
  generatorArt: { height: '92%', width: '92%' },
  generatorSprite: { alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  generatorSparkles: { left: '6%', overflow: 'visible', position: 'absolute', top: '-28%', zIndex: 4 },
  generatorSparkle: { alignItems: 'center', justifyContent: 'center', left: 0, position: 'absolute', top: '42%' },
  generatorBolt: { alignItems: 'center', backgroundColor: '#68517A', borderColor: '#E2C9E7', borderRadius: 999, borderWidth: 1, bottom: 1, boxShadow: '0 2px 5px rgba(48,30,49,0.28)', height: 20, justifyContent: 'center', position: 'absolute', right: 1, width: 20 },
});
