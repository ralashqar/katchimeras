import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
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
import { ThemedText } from '@/components/themed-text';
import { FeastleMergeCelebration } from '@/components/katchadeck/world/quests/feastle-merge-primitives';
import { MergeSpawnEffectsLayer } from '@/components/katchadeck/games/merge-spawn-effects-layer';
import { mergeWorldGeneratorArt, mergeWorldItemArt } from '@/constants/merge-world-art';
import { MERGE_GENERATORS_BY_ID, MERGE_HYBRID_RECIPES, MERGE_ITEMS_BY_ID, MERGE_WORLD_COLUMNS, MERGE_WORLD_ROWS } from '@/constants/merge-world-catalog';
import { COMPANION_DISCOVERIES_BY_ID } from '@/constants/companion-discovery-catalog';
import type { MergeBoardInteractionGate } from '@/features/onboarding/merge-ftue';
import type { MergeBoardOperationReceipt, MergeBoardSessionId, MergeInteractionGateReceipt } from '@/features/onboarding/merge-ftue-interaction-coordinator';
import { useDisposableTimers } from '@/hooks/use-disposable-timers';
import { mergeGeneratorArtCacheKey, mergeItemArtCacheKey, useMergeArtCache, type MergeArtCache } from '@/hooks/use-merge-art-cache';
import { acquireLifecycleResource } from '@/utils/lifecycle-performance';
import type { MergeBoardOccupant, MergeDreamMist, MergeWorldCommand, MergeWorldCommandResult, MergeWorldFailureReason, MergeWorldState } from '@/types/merge-world';
import { mergeCellFeedbackForFailure, type MergeCellFeedbackTone } from '@/utils/merge-board-feedback';
import { MERGE_MORPH_DURATION_MS, MERGE_MORPH_REDUCED_MOTION_DURATION_MS, SPAWN_MOTION_DURATION_MS, isMistMergeTransition, mergeMotionPiecewise, mergeSpriteMotionFrame, spawnSpriteMotionFrame, type MergeBoardMotionKind } from '@/utils/merge-board-motion';
import { mergeCellCenter, mergeCellFromPoint, mergeCellOrigin, mergeNeighborCellInDirection, type MergeBoardGeometry } from '@/utils/merge-world/board-geometry';

export type MergeBoardScreenMetrics = { geometry: MergeBoardGeometry; x: number; y: number };

type SpriteRecord = { occupant: MergeBoardOccupant; cell: number };
type SpriteMotion = {
  operationId: number;
  token: number;
  kind: MergeBoardMotionKind;
  startX: number;
  startY: number;
  arcHeight?: number;
};
type ActiveOperation = {
  id: number;
  kind: 'board' | 'spawn';
  remaining: Set<string>;
  finalState: MergeWorldState | null | undefined;
  settledRevision: number | null;
};
type MergeCellFeedback = { id: number; cell: number; message: string; tone: MergeCellFeedbackTone };
type DreamMistDissipationRecord = { id: number; cell: number; definitionId: string; sequenceIndex: number | null };
type MergeBoardVisualState = {
  busy: boolean;
  motions: Record<string, SpriteMotion>;
  presentation: MergeWorldState;
  sprites: SpriteRecord[];
};
type MergeBoardVisualAction =
  | { type: 'begin'; motions: Record<string, SpriteMotion>; presentation: MergeWorldState; sprites: SpriteRecord[] }
  | { type: 'reconcile'; busy: boolean; motions: Record<string, SpriteMotion>; presentation: MergeWorldState; sprites: SpriteRecord[] }
  | { type: 'sync'; presentation: MergeWorldState; sprites: SpriteRecord[] };

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

function mergeBoardVisualReducer(state: MergeBoardVisualState, action: MergeBoardVisualAction): MergeBoardVisualState {
  switch (action.type) {
    case 'begin':
      return { busy: true, motions: action.motions, presentation: action.presentation, sprites: action.sprites };
    case 'reconcile':
      return { busy: action.busy, motions: action.motions, presentation: action.presentation, sprites: action.sprites };
    case 'sync':
      return { ...state, presentation: action.presentation, sprites: action.sprites };
  }
}

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

export const FeastlePersistentMergeBoard = memo(function FeastlePersistentMergeBoard({ state, width, maxHeight, selectedCell, onSelect, onCommand, onCommandSettled, onInteractionGateCommitted, onScreenMetrics, onBlockedInteraction, onHiddenItemsRetired, interactionGate = { kind: 'open' }, interactionSessionKey = 'open', sessionId, hiddenItemInstanceIds, animateEntrance = true }: {
  state: MergeWorldState;
  width: number;
  animateEntrance?: boolean;
  maxHeight?: number;
  selectedCell: number | null;
  onSelect: (cell: number | null) => void;
  onCommand: (command: MergeWorldCommand) => MergeWorldCommandResult | null;
  onCommandSettled?: (receipt: MergeBoardOperationReceipt) => void;
  onInteractionGateCommitted?: (receipt: MergeInteractionGateReceipt) => void;
  onScreenMetrics?: (metrics: MergeBoardScreenMetrics) => void;
  onBlockedInteraction?: () => void;
  onHiddenItemsRetired?: (instanceIds: readonly string[]) => void;
  interactionGate?: MergeBoardInteractionGate;
  interactionSessionKey?: string;
  sessionId: MergeBoardSessionId;
  hiddenItemInstanceIds?: ReadonlySet<string>;
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
  const cellOrigins = useMemo(
    () => Array.from({ length: MERGE_WORLD_COLUMNS * MERGE_WORLD_ROWS }, (_, index) => mergeCellOrigin(geometry, index)),
    [geometry],
  );
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
  const [visualState, dispatchVisual] = useReducer(mergeBoardVisualReducer, state, (initialState): MergeBoardVisualState => ({
    busy: false,
    motions: {},
    presentation: initialState,
    sprites: spritesFromState(initialState),
  }));
  const { busy, motions, presentation, sprites } = visualState;
  const presentationRef = useRef(presentation);
  const introSpriteDelays = useRef(new Map(
    animateEntrance
      ? spritesFromState(state).map((sprite) => [spriteId(sprite), introDelayForCell(sprite.cell)])
      : [],
  ));
  const spritesRef = useRef(sprites);
  const motionsRef = useRef(motions);
  const [invalidFeedback, setInvalidFeedback] = useState<{ id: number; cell: number } | null>(null);
  const [mergeBursts, setMergeBursts] = useState<{ id: number; cell: number }[]>([]);
  const [spawnBursts, setSpawnBursts] = useState<{ id: number; cell: number }[]>([]);
  const [cellFeedback, setCellFeedback] = useState<MergeCellFeedback[]>([]);
  const [mistDissipations, setMistDissipations] = useState<DreamMistDissipationRecord[]>([]);
  const operationSequence = useRef(0);
  const motionSequence = useRef(0);
  const burstSequence = useRef(0);
  const mergeBurstSequence = useRef(0);
  const invalidFeedbackSequence = useRef(0);
  const cellFeedbackSequence = useRef(0);
  const mistDissipationSequence = useRef(0);
  const activeOperations = useRef(new Map<number, ActiveOperation>());
  const committedStateRef = useRef(state);
  const onSelectRef = useRef(onSelect);
  const onCommandSettledRef = useRef(onCommandSettled);
  const onInteractionGateCommittedRef = useRef(onInteractionGateCommitted);
  const selectedCellRef = useRef(selectedCell);
  const launchGeneratorRef = useRef<(generatorId: string) => void>(() => undefined);
  const dropRef = useRef<(instanceId: string, dx: number, dy: number, intendedTargetCell?: number | null) => void>(() => undefined);
  const boardDropRef = useRef<(instanceId: string, worldX: number, worldY: number, epoch: number, intendedTargetCell: number | null) => void>(() => undefined);
  const boardTapRef = useRef<(instanceId: string, worldX: number, worldY: number, epoch: number) => void>(() => undefined);
  const boardCancelRef = useRef<(instanceId: string, worldX: number, worldY: number, epoch: number) => void>(() => undefined);
  const emptyCellTapRef = useRef<(cell: number) => void>(() => undefined);
  const blockInteraction = useCallback(() => onBlockedInteraction?.(), [onBlockedInteraction]);
  const gateKind = interactionGate.kind;
  const gateFromCell = interactionGate.kind === 'drag' ? interactionGate.fromCell : -1;
  const gateToCell = interactionGate.kind === 'drag' ? interactionGate.toCell : -1;
  const gateGeneratorCell = interactionGate.kind === 'generator' ? interactionGate.cell : -1;
  const mossproutOnboarding = presentation.activeOrders.some((order) => order.id.startsWith('mossprout:chapter-0:'));
  const artCache = useMergeArtCache(presentation, mossproutOnboarding);

  presentationRef.current = presentation;
  spritesRef.current = sprites;
  motionsRef.current = motions;
  onSelectRef.current = onSelect;
  onCommandSettledRef.current = onCommandSettled;
  onInteractionGateCommittedRef.current = onInteractionGateCommitted;
  selectedCellRef.current = selectedCell;

  const showCellFeedback = useCallback((cell: number, reason: MergeWorldFailureReason) => {
    const presentation = mergeCellFeedbackForFailure(reason);
    if (!presentation || cell < 0 || cell >= MERGE_WORLD_COLUMNS * MERGE_WORLD_ROWS) return;
    const feedback = { id: ++cellFeedbackSequence.current, cell, ...presentation };
    setCellFeedback((current) => [...current.filter((entry) => entry.cell !== cell).slice(-2), feedback]);
    timers.schedule(() => setCellFeedback((current) => current.filter((entry) => entry.id !== feedback.id)), 760);
    void AccessibilityInfo.announceForAccessibility(presentation.message.toLowerCase());
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [timers]);

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
    // A retained tab must not carry pending operation bookkeeping into a new
    // GestureDetector tree.
    return () => {
      timers.cancelAll();
      mountedOperations.clear();
      motionsRef.current = {};
    };
  }, [timers]);

  useLayoutEffect(() => {
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
    onInteractionGateCommittedRef.current?.({ interactionKey: interactionSessionKey, sessionId });
  }, [activeDragId, activeSourceCell, dragPhase, dragTranslationX, dragTranslationY, gestureFinished, hoverCell, interactionSessionKey, sessionId]);

  useEffect(() => {
    if (state.revision < committedStateRef.current.revision) return;
    committedStateRef.current = state;
    occupancyIds.value = occupancyIdsFromState(state);
    occupancyDefinitions.value = occupancyDefinitionsFromState(state);
    if (activeOperations.current.size) return;
    presentationRef.current = state;
    const nextSprites = spritesFromState(state);
    spritesRef.current = nextSprites;
    dispatchVisual({ type: 'sync', presentation: state, sprites: nextSprites });
  }, [occupancyDefinitions, occupancyIds, state]);

  useEffect(() => {
    if (!hiddenItemInstanceIds?.size || !onHiddenItemsRetired) return;
    const mountedItemIds = new Set(sprites.flatMap((sprite) => sprite.occupant.kind === 'item'
      ? [sprite.occupant.instanceId]
      : []));
    const retiredIds = [...hiddenItemInstanceIds].filter((instanceId) => !mountedItemIds.has(instanceId));
    if (retiredIds.length) onHiddenItemsRetired(retiredIds);
  }, [hiddenItemInstanceIds, onHiddenItemsRetired, sprites]);

  const finishOperationIfReady = useCallback((operationId: number) => {
    const operation = activeOperations.current.get(operationId);
    if (!operation || operation.remaining.size || operation.finalState === undefined) return;
    if (operation.finalState && operation.finalState.revision >= committedStateRef.current.revision) {
      committedStateRef.current = operation.finalState;
    }
    activeOperations.current.delete(operationId);
    const remainingMotions = Object.fromEntries(Object.entries(motionsRef.current).filter(([, motion]) => motion.operationId !== operationId));
    motionsRef.current = remainingMotions;
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
    spritesRef.current = reconciledSprites;
    const hasOperations = activeOperations.current.size > 0;
    dispatchVisual({
      type: 'reconcile',
      busy: hasOperations,
      motions: remainingMotions,
      presentation: finalState,
      sprites: reconciledSprites,
    });
    if (operation.settledRevision != null) {
      onCommandSettledRef.current?.({ operationId: operation.id, revision: operation.settledRevision, sessionId });
    }
  }, [sessionId]);

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
    settledRevision = null,
  }: {
    nextState: MergeWorldState;
    nextSprites: SpriteRecord[];
    nextMotions: Record<string, Omit<SpriteMotion, 'operationId' | 'token'>>;
    kind?: ActiveOperation['kind'];
    settledRevision?: number | null;
  }) => {
    const operationId = ++operationSequence.current;
    const boundMotions = Object.fromEntries(Object.entries(nextMotions).map(([instanceId, motion]) => [instanceId, {
      ...motion,
      operationId,
      token: ++motionSequence.current,
    }]));
    activeOperations.current.set(operationId, { id: operationId, kind, remaining: new Set(Object.keys(boundMotions)), finalState: nextState, settledRevision });
    if (nextState.revision >= committedStateRef.current.revision) committedStateRef.current = nextState;
    occupancyIds.value = occupancyIdsFromState(nextState);
    occupancyDefinitions.value = occupancyDefinitionsFromState(nextState);
    presentationRef.current = nextState;
    spritesRef.current = nextSprites;
    const combinedMotions = { ...motionsRef.current, ...boundMotions };
    motionsRef.current = combinedMotions;
    dispatchVisual({ type: 'begin', motions: combinedMotions, presentation: nextState, sprites: nextSprites });
  }, [occupancyDefinitions, occupancyIds]);

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
    if (!targetCell || (targetCell.locked && targetCell.mist?.kind !== 'echo' && targetCell.mist?.kind !== 'dreambound_item')) {
      if (targetCell?.locked) {
        showCellFeedback(to, 'locked_cell');
        returnHome();
      } else returnHome(to);
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
      if (predicted.failureReason) {
        showCellFeedback(to, predicted.failureReason);
        returnHome();
      } else returnHome(to);
      return;
    }

    const from = sprite.cell;
    const sourceOrigin = mergeCellOrigin(geometry, from);
    const targetOrigin = mergeCellOrigin(geometry, to);
    const resultingOccupant = predicted.state.board[to]?.occupant;
    const merging = sprite.occupant.kind === 'item'
      && target?.occupant.kind === 'item'
      && resultingOccupant?.kind === 'item'
      && resultingOccupant.instanceId !== sprite.occupant.instanceId;
    const nextMotions: Record<string, Omit<SpriteMotion, 'operationId' | 'token'>> = {};
    let nextSprites: SpriteRecord[];

    const mistMerging = !target && isMistMergeTransition(targetCell.mist?.kind, predicted.mergedCell, to, Boolean(resultingOccupant));
    if (mistMerging && resultingOccupant) {
      const result: SpriteRecord = { occupant: resultingOccupant, cell: to };
      nextSprites = currentSprites.map((entry) => spriteId(entry) === instanceId ? { ...entry, cell: to } : entry).concat(result);
      nextMotions[instanceId] = { kind: 'merge-source', startX: sourceOrigin.x + dx, startY: sourceOrigin.y + dy };
      nextMotions[spriteId(result)] = { kind: 'merge-result', startX: targetOrigin.x, startY: targetOrigin.y };
      const mistDefinitionId = targetCell.mist?.kind === 'echo'
        ? targetCell.mist.definitionId
        : targetCell.mist?.kind === 'dreambound_item' ? targetCell.mist.boundDefinitionId : null;
      if (mistDefinitionId) {
        const dissipation: DreamMistDissipationRecord = {
          id: ++mistDissipationSequence.current,
          cell: to,
          definitionId: mistDefinitionId,
          sequenceIndex: targetCell.mist?.kind === 'dreambound_item' ? targetCell.mist.sequenceIndex : null,
        };
        setMistDissipations((current) => [...current.slice(-2), dissipation]);
        timers.schedule(() => setMistDissipations((current) => current.filter((entry) => entry.id !== dissipation.id)), reduceMotion ? 220 : 560);
      }
      if (!reduceMotion) {
        const burst = { id: ++mergeBurstSequence.current, cell: to };
        setMergeBursts((bursts) => [...bursts, burst]);
        timers.schedule(() => setMergeBursts((bursts) => bursts.filter((entry) => entry.id !== burst.id)), 520);
      }
    } else if (merging && target && resultingOccupant?.kind === 'item') {
      const result: SpriteRecord = { occupant: resultingOccupant, cell: to };
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
      void Haptics.impactAsync(merging || mistMerging
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light);
    }
    beginOperation({ nextState: predicted.state, nextSprites, nextMotions, settledRevision: predicted.state.revision });
    finishInterruptedOperation();
  }, [beginOperation, detachMotion, finishOperationIfReady, geometry, hoverCell, onCommand, onSelect, reduceMotion, returnSpriteHome, showCellFeedback, timers]);
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
      if (from >= 0 && predicted.failureReason) showCellFeedback(from, predicted.failureReason);
      return;
    }
    const start = mergeCellOrigin(geometry, from);
    const end = mergeCellOrigin(geometry, to);
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    const nextSprite: SpriteRecord = { occupant: spawned, cell: to };
    if (!reduceMotion) {
      const burst = { id: ++burstSequence.current, cell: from };
      const burstLimit = 6;
      setSpawnBursts((bursts) => [...bursts.slice(-(burstLimit - 1)), burst]);
      timers.schedule(() => setSpawnBursts((bursts) => bursts.some((entry) => entry.id === burst.id)
        ? bursts.filter((entry) => entry.id !== burst.id)
        : bursts), 620);
    }
    beginOperation({
      nextState: predicted.state,
      nextSprites: [...currentSprites, nextSprite],
      nextMotions: { [spawned.instanceId]: { kind: 'spawn', startX: start.x, startY: start.y, arcHeight: Math.max(cellSize * 1.45, Math.min(cellSize * 2.35, distance * 0.42)) } },
      kind: 'spawn',
      settledRevision: predicted.state.revision,
    });
  }, [beginOperation, cellSize, geometry, onCommand, onSelect, reduceMotion, showCellFeedback, timers]);
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
  const tapEmptyCell = useCallback((cell: number) => {
    const boardCell = presentationRef.current.board[cell];
    if (boardCell?.locked) showCellFeedback(cell, 'locked_cell');
  }, [showCellFeedback]);
  emptyCellTapRef.current = tapEmptyCell;
  const emitEmptyCellTap = useCallback((cell: number) => emptyCellTapRef.current(cell), []);

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
    const boardCell = current.board[cell];
    if (boardCell?.locked && ((boardCell.mist?.kind !== 'echo' && boardCell.mist?.kind !== 'dreambound_item') || selectedCellRef.current == null)) {
      showCellFeedback(cell, 'locked_cell');
      return;
    }
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
  }, [blockInteraction, gateFromCell, gateGeneratorCell, gateKind, gateToCell, geometry, showCellFeedback]);

  const selectedOccupant = selectedCell == null ? null : presentation.board[selectedCell]?.occupant;
  const selectedDefinitionId = selectedOccupant?.kind === 'item' ? selectedOccupant.definitionId : null;

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
      if (!touch || gestureFinished.value) return;
      const dx = touch.x - touchDownX.value;
      const dy = touch.y - touchDownY.value;
      maxGestureDistance.value = Math.max(maxGestureDistance.value, Math.hypot(dx, dy));
      if (!id) {
        if (maxGestureDistance.value <= BOARD_TAP_SLOP && activeSourceCell.value >= 0) {
          gestureFinished.value = true;
          runOnJS(emitEmptyCellTap)(activeSourceCell.value);
        }
        return;
      }
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
    }), [activeDragId, activeSourceCell, blockInteraction, dragEpoch, dragHapticTriggered, dragPhase, dragSprite, dragTranslationX, dragTranslationY, emitBoardCancel, emitBoardDrop, emitBoardTap, emitEmptyCellTap, entranceInteractive, gateFromCell, gateGeneratorCell, gateKind, gateToCell, geometry.cellSize, geometry.columns, geometry.gap, geometry.inset, geometry.rows, gestureFinished, grabX, grabY, hoverCell, maxGestureDistance, occupancyDefinitions, occupancyIds, pickSprite, touchDownX, touchDownY]);

  // Measure a stable, untransformed frame. The visual board enters with a
  // translateY animation; measuring that Animated.View cached a temporary
  // screen Y and caused parcel flights to land below their eventual cells.
  return <View onLayout={reportScreenMetrics} ref={boardRef} style={[styles.boardFrame, { height: boardHeight, width: boardWidth }]}>
    <GestureDetector gesture={boardGesture}><Animated.View accessibilityLabel="Feastle merge board, seven columns by nine rows" style={[styles.board, busy && styles.boardAnimating, { height: boardHeight, padding, width: boardWidth }, boardEntranceStyle]}>
    <LinearGradient colors={['#788143', '#55602F', '#384321']} locations={[0, 0.52, 1]} pointerEvents="none" style={styles.boardGradient} />
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {presentation.board.map((cell, index) => {
        const origin = cellOrigins[index];
        const occupant = cell.occupant;
        const item = occupant?.kind === 'item' ? occupant : null;
        const generator = occupant?.kind === 'generator' ? MERGE_GENERATORS_BY_ID.get(occupant.generatorId) : null;
        const definition = item ? MERGE_ITEMS_BY_ID.get(item.definitionId) : null;
        const echoDefinition = cell.mist?.kind === 'echo' ? MERGE_ITEMS_BY_ID.get(cell.mist.definitionId) : null;
        const echoGenerator = cell.mist?.kind === 'echo' && cell.mist.generatorId ? MERGE_GENERATORS_BY_ID.get(cell.mist.generatorId) : null;
        const companionDiscovery = cell.mist?.kind === 'dreambound_item' ? COMPANION_DISCOVERIES_BY_ID.get(cell.mist.discoveryId) : null;
        const discoveryStage = companionDiscovery && cell.mist?.kind === 'dreambound_item' ? companionDiscovery.stages[cell.mist.sequenceIndex] : null;
        const compatible = Boolean(selectedDefinitionId && selectedCell !== index && (
          (item && item.definitionId === selectedDefinitionId)
          || echoDefinition?.id === selectedDefinitionId
          || (cell.mist?.kind === 'dreambound_item' && cell.mist.active && cell.mist.boundDefinitionId === selectedDefinitionId)
        ));
        const label = generator ? `${generator.name}. Tap to generate. Costs 1 Energy.`
          : definition ? `${definition.name}, tier ${definition.tier}`
            : echoDefinition ? `Dream Echo: ${echoDefinition.name}${echoGenerator ? ` from the ${echoGenerator.name}` : ''}. Find its matching item to wake this cell.`
              : discoveryStage ? `${discoveryStage.clue}. ${cell.mist?.kind === 'dreambound_item' && cell.mist.active ? `Bring another ${MERGE_ITEMS_BY_ID.get(cell.mist.boundDefinitionId)?.name ?? 'matching item'} here.` : 'Follow the trail to wake this item.'}`
                : cell.mist?.kind === 'discovery_fork' ? 'Several paths are moving beneath the Dream Mist. Choose one to investigate.'
                : cell.mist ? 'Something is hidden in the Dream Mist.' : 'Empty board space';
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
          mist={cell.mist}
          top={origin.y}
          width={cellSize}
        />;
      })}
      <HoverCellOverlay geometry={geometry} hoverCell={hoverCell} />
    </View>
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <MergeSpawnEffectsLayer bursts={spawnBursts} geometry={geometry} size={cellSize} />
      {sprites.filter((sprite) => sprite.occupant.kind !== 'item' || !hiddenItemInstanceIds?.has(sprite.occupant.instanceId)).map((sprite) => {
        const origin = cellOrigins[sprite.cell];
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
          artCache={artCache}
          mossproutOnboarding={mossproutOnboarding}
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
      {mistDissipations.map((dissipation) => <DreamMistDissipation effect={dissipation} geometry={geometry} key={dissipation.id} reduceMotion={reduceMotion} />)}
      {mergeBursts.map((burst) => <MergeCelebrationOverlay cell={burst.cell} geometry={geometry} key={burst.id} />)}
      {invalidFeedback ? <InvalidCellFeedback cell={invalidFeedback.cell} geometry={geometry} key={invalidFeedback.id} /> : null}
      {cellFeedback.map((feedback) => <MergeCellCallout feedback={feedback} geometry={geometry} key={feedback.id} reduceMotion={reduceMotion} />)}
    </View>
    </Animated.View></GestureDetector>
  </View>;
});

const BoardCell = memo(function BoardCell({ accessibilityActionLabel, accessibilityDisabled, accessibilityLabel, blocked, invalid, selected, compatible, index, left, top, width, height, mist, onActivate }: {
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
  mist: MergeDreamMist | null;
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
      {blocked ? <Image accessibilityIgnoresInvertColors allowDownscaling cachePolicy="memory" contentFit="fill" recyclingKey="merge-locked-cloud" source={LOCKED_CELL_OVERLAY} style={[styles.lockedOverlay, mist?.kind === 'echo' && styles.echoMist, (mist?.kind === 'dreambound_item' || mist?.kind === 'discovery_fork') && styles.discoveryMist]} transition={0} /> : null}
      {mist?.kind === 'echo' ? <View pointerEvents="none" style={[styles.echoItem, compatible && styles.echoItemCompatible]}><DreamEchoItemArt compatible={compatible} definitionId={mist.definitionId} size={Math.min(width, height) - 4} /></View> : null}
      {mist?.kind === 'dreambound_item' ? <View pointerEvents="none" style={[styles.discoveryClue, compatible && styles.echoItemCompatible, !mist.active && styles.dreamboundSealed]}>
        <DreamEchoItemArt compatible={compatible} definitionId={mist.boundDefinitionId} size={Math.min(width, height) - 8} />
        <View style={styles.discoveryStageDots}>{[0, 1, 2].map((stage) => <View key={stage} style={[styles.discoveryStageDot, stage <= mist.sequenceIndex && styles.discoveryStageDotActive]} />)}</View>
      </View> : null}
      {mist?.kind === 'discovery_fork' ? <View pointerEvents="none" style={styles.discoveryClue}>
        <IconSymbol color="#F4D795" name="sparkles" size={Math.max(18, Math.min(width, height) * 0.44)} />
        <View style={styles.discoveryStageDots}>{mist.candidateIds.map((id) => <View key={id} style={[styles.discoveryStageDot, styles.discoveryStageDotActive]} />)}</View>
      </View> : null}
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

function MergeCellCallout({ feedback, geometry, reduceMotion }: {
  feedback: MergeCellFeedback;
  geometry: MergeBoardGeometry;
  reduceMotion: boolean;
}) {
  const progress = useSharedValue(0);
  const origin = mergeCellOrigin(geometry, feedback.cell);
  const row = Math.floor(feedback.cell / geometry.columns);
  const width = Math.max(82, Math.min(124, geometry.cellSize * 2.3));
  const boardWidth = geometry.inset * 2 + geometry.columns * geometry.cellSize + (geometry.columns - 1) * geometry.gap;
  const left = Math.max(2, Math.min(boardWidth - width - 2, origin.x + geometry.cellSize / 2 - width / 2));
  const top = row === geometry.rows - 1 ? origin.y - 24 : origin.y + geometry.cellSize + 3;
  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: reduceMotion ? 560 : 700, easing: Easing.out(Easing.cubic) });
    return () => cancelAnimation(progress);
  }, [progress, reduceMotion]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.1, 0.72, 1], [0, 1, 1, 0]),
    transform: [
      { translateY: reduceMotion ? 0 : interpolate(progress.value, [0, 0.24, 1], [3, 0, -4]) },
      { scale: reduceMotion ? 1 : interpolate(progress.value, [0, 0.12, 0.27, 1], [0.65, 1.08, 1, 1]) },
    ],
  }));
  return <Animated.View style={[
    styles.cellCallout,
    feedback.tone === 'warning' ? styles.cellCalloutWarning : feedback.tone === 'hint' ? styles.cellCalloutHint : styles.cellCalloutBlocked,
    { left, top, width },
    animatedStyle,
  ]}>
    <ThemedText style={styles.cellCalloutText} lightColor="#FFF6D5" darkColor="#FFF6D5">{feedback.message}</ThemedText>
  </Animated.View>;
}

const DREAM_MIST_PARTICLES = [
  { angle: -2.8, distance: 0.72, color: '#E8F6FF', height: 8, width: 13 },
  { angle: -2.15, distance: 0.86, color: '#F5F1FF', height: 10, width: 17 },
  { angle: -1.5, distance: 0.94, color: '#D9F2FF', height: 8, width: 14 },
  { angle: -0.82, distance: 0.82, color: '#EEE8FF', height: 9, width: 16 },
  { angle: -0.18, distance: 0.76, color: '#E9F8FF', height: 7, width: 12 },
  { angle: 0.58, distance: 0.68, color: '#DDEFFF', height: 9, width: 15 },
  { angle: 1.28, distance: 0.62, color: '#F5EDFF', height: 7, width: 13 },
  { angle: 2.38, distance: 0.7, color: '#E4F5FF', height: 8, width: 14 },
] as const;

function DreamMistDissipation({ effect, geometry, reduceMotion }: {
  effect: DreamMistDissipationRecord;
  geometry: MergeBoardGeometry;
  reduceMotion: boolean;
}) {
  const progress = useSharedValue(0);
  const origin = mergeCellOrigin(geometry, effect.cell);
  const size = geometry.cellSize;
  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: reduceMotion ? MERGE_MORPH_REDUCED_MOTION_DURATION_MS : MERGE_MORPH_DURATION_MS,
      easing: Easing.linear,
    });
    return () => cancelAnimation(progress);
  }, [progress, reduceMotion]);
  const cloudStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.16, 0.72, 1], [0.9, 0.82, 0.16, 0]),
    transform: [{ scale: reduceMotion ? 1 : interpolate(progress.value, [0, 1], [1, 1.24]) }],
  }));
  const echoStyle = useAnimatedStyle(() => {
    const frame = mergeSpriteMotionFrame('merge-target', progress.value, reduceMotion);
    return { opacity: frame.opacity, transform: [{ scale: frame.scale }] };
  });
  return <View pointerEvents="none" style={[styles.mistDissipation, { height: size, left: origin.x, top: origin.y, width: size }]}>
    <Animated.View style={[StyleSheet.absoluteFill, cloudStyle]}>
      <Image accessibilityIgnoresInvertColors allowDownscaling cachePolicy="memory" contentFit="contain" enforceEarlyResizing recyclingKey="merge-dissipating-cloud" source={LOCKED_CELL_OVERLAY} style={styles.lockedOverlay} transition={0} />
    </Animated.View>
    <Animated.View style={[styles.mistEchoGhost, { height: size - 4, width: size - 4 }, echoStyle]}>
      <DreamEchoItemArt compatible={false} definitionId={effect.definitionId} size={effect.sequenceIndex == null ? size - 4 : size - 8} />
      {effect.sequenceIndex == null ? null : <View style={styles.discoveryStageDots}>
        {[0, 1, 2].map((stage) => <View key={stage} style={[styles.discoveryStageDot, stage <= effect.sequenceIndex! && styles.discoveryStageDotActive]} />)}
      </View>}
    </Animated.View>
    {!reduceMotion ? DREAM_MIST_PARTICLES.map((particle, index) => <DreamMistParticle index={index} key={index} particle={particle} progress={progress} size={size} />) : null}
  </View>;
}

function DreamMistParticle({ index, particle, progress, size }: {
  index: number;
  particle: (typeof DREAM_MIST_PARTICLES)[number];
  progress: SharedValue<number>;
  size: number;
}) {
  const style = useAnimatedStyle(() => {
    const delayed = Math.max(0, Math.min(1, (progress.value - index * 0.025) / (1 - index * 0.025)));
    const travel = mergeMotionPiecewise(delayed, [0, 1], [size * 0.05, size * particle.distance]);
    return {
      opacity: mergeMotionPiecewise(delayed, [0, 0.12, 0.64, 1], [0, 0.9, 0.62, 0]),
      transform: [
        { translateX: Math.cos(particle.angle) * travel },
        { translateY: Math.sin(particle.angle) * travel - delayed * size * 0.08 },
        { scale: mergeMotionPiecewise(delayed, [0, 0.22, 1], [0.5, 1.1, 0.42]) },
      ],
    };
  }, [index, particle.angle, particle.distance, size]);
  return <Animated.View style={[styles.mistParticle, { backgroundColor: particle.color, height: particle.height, width: particle.width }, style]} />;
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

const PersistentSprite = memo(function PersistentSprite({ instanceId, baseX, baseY, cellSize, activeDragId, dragEpoch, dragPhase, dragTranslationX, dragTranslationY, entranceDelay, grabX, grabY, motion, artCache, mossproutOnboarding, reduceMotion, onComplete, occupant }: {
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
  artCache: MergeArtCache;
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
  const activeMotionKind = useSharedValue<MergeBoardMotionKind | null>(motion?.kind ?? null);
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
      const spawnFrame = wasAnimating && kind === 'spawn' ? spawnSpriteMotionFrame(p, reduceMotion) : null;
      const travel = spawnFrame?.travel ?? p;
      const currentX = wasAnimating ? x.value + (targetX.value - x.value) * travel : x.value;
      const currentY = (wasAnimating ? y.value + (targetY.value - y.value) * travel : y.value)
        + (spawnFrame ? arcHeight.value * spawnFrame.arc + cellSize * spawnFrame.settleY : 0);
      let currentOpacity = spriteOpacity.value;
      let currentScale = scale.value;
      if (wasAnimating && kind?.startsWith('merge-')) {
        const frame = mergeSpriteMotionFrame(kind, p, reduceMotion);
        currentOpacity = frame.opacity;
        currentScale = frame.scale;
      } else if (spawnFrame) {
        currentOpacity = spawnFrame.opacity;
        currentScale = spawnFrame.scale;
      }
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
    [cellSize, instanceId, reduceMotion],
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
        progress.value = withTiming(1, { duration: motion.kind.startsWith('merge-') ? MERGE_MORPH_REDUCED_MOTION_DURATION_MS : 1 }, finish);
      } else if (motion.kind === 'spawn' || motion.kind.startsWith('merge-')) {
        progress.value = withTiming(1, {
          duration: motion.kind === 'spawn' ? SPAWN_MOTION_DURATION_MS : MERGE_MORPH_DURATION_MS,
          // Both authored frame functions own their phase timing. Linear time
          // preserves the spawn's pop, arc, landing, and grounded slide instead
          // of an outer ease-out rushing through most of the flight.
          easing: Easing.linear,
        }, finish);
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
    const spawnFrame = moving && motionKind === 'spawn' ? spawnSpriteMotionFrame(p, reduceMotion) : null;
    const travel = spawnFrame?.travel ?? p;
    const mergeSource = motionKind === 'merge-source';
    const mergeTarget = motionKind === 'merge-target';
    const mergeResult = motionKind === 'merge-result';
    const worldX = dragging ? grabX.value + dragTranslationX.value : moving ? x.value + (targetX.value - x.value) * travel : x.value;
    const worldY = dragging ? grabY.value + dragTranslationY.value : moving ? y.value + (targetY.value - y.value) * travel : y.value;
    const mergeFrame = moving && (mergeSource || mergeTarget || mergeResult) && motionKind
      ? mergeSpriteMotionFrame(motionKind, p, reduceMotion)
      : null;
    let opacity = mergeFrame?.opacity ?? spriteOpacity.value;
    if (spawnFrame) opacity = spawnFrame.opacity;
    const intro = Math.max(0, Math.min(1, entranceProgress.value));
    const motionScale = spawnFrame?.scale ?? mergeFrame?.scale ?? scale.value;
    return {
      opacity: opacity * intro,
      zIndex: dragging || moving || scale.value > 1.001 ? 1000 : 10,
      transform: [
        { translateX: worldX },
        { translateY: worldY + (spawnFrame ? arcHeight.value * spawnFrame.arc + cellSize * spawnFrame.settleY : 0) },
        { translateY: (1 - intro) * 8 },
        { scale: motionScale * interpolate(intro, [0, 0.68, 1], [0.72, 1.08, 1]) },
      ],
    };
  }, [activeDragId, activeMotionKind, animating, arcHeight, cellSize, dragPhase, dragTranslationX, dragTranslationY, entranceProgress, grabX, grabY, instanceId, reduceMotion, spriteOpacity, targetX, targetY]);

  return <Animated.View pointerEvents="none" style={[styles.sprite, { height: cellSize, left: 0, top: 0, width: cellSize }, animatedStyle]}>
      {occupant.kind === 'generator'
        ? <PersistentGeneratorArt artCache={artCache} generatorId={occupant.generatorId} mossproutOnboarding={mossproutOnboarding} size={cellSize} />
        : <PersistentMergeItemArt artCache={artCache} definitionId={occupant.definitionId} size={cellSize - 4} />}
    </Animated.View>;
});

function PersistentGeneratorArt({ artCache, generatorId, mossproutOnboarding, size }: { artCache: MergeArtCache; generatorId: string; mossproutOnboarding: boolean; size: number }) {
  const art = mergeWorldGeneratorArt(generatorId, { mossproutOnboarding });
  const source = artCache.get(mergeGeneratorArtCacheKey(generatorId, mossproutOnboarding)) ?? art;
  return <View style={[styles.generatorSprite, { height: size, width: size }]}>
    <GeneratorSparkles size={size} />
    {source ? <Image accessibilityIgnoresInvertColors allowDownscaling cachePolicy="memory" contentFit="contain" recyclingKey={`merge-generator-${generatorId}`} source={source} style={styles.generatorArt} transition={0} /> : null}
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

function mergeCellFromPointWorklet(x: number, y: number, cellSize: number, gap: number, inset: number, columns: number, rows: number) {
  'worklet';
  const pitch = cellSize + gap;
  const column = Math.round((x - inset - cellSize / 2) / pitch);
  const row = Math.round((y - inset - cellSize / 2) / pitch);
  return column < 0 || column >= columns || row < 0 || row >= rows ? -1 : row * columns + column;
}

export function PersistentMergeItemArt({ artCache, definitionId, size }: { artCache?: MergeArtCache; definitionId: string; size: number }) {
  const definition = MERGE_ITEMS_BY_ID.get(definitionId);
  if (!definition) return null;
  const authoredArt = mergeWorldItemArt(definitionId);
  const source = artCache?.get(mergeItemArtCacheKey(definitionId)) ?? authoredArt;
  if (source) return <View style={[styles.familyArt, { height: size, width: size }]}><Image accessibilityIgnoresInvertColors allowDownscaling cachePolicy="memory" contentFit="contain" recyclingKey={definitionId} source={source} style={{ height: size, width: size }} transition={0} /></View>;
  return <View style={[styles.familyArt, { height: size, width: size }]}><View style={[styles.familyDisc, { backgroundColor: definition.color }]}><IconSymbol color="#4A291B" name={definition.icon} size={Math.max(17, size * 0.48)} /></View></View>;
}

function DreamEchoItemArt({ compatible, definitionId, size }: { compatible: boolean; definitionId: string; size: number }) {
  const definition = MERGE_ITEMS_BY_ID.get(definitionId);
  if (!definition) return null;
  // Keep Dream Echoes on the same Expo Image decode/cache path as ordinary
  // merge sprites. A newly unlocked generator can put the same cold WebP into
  // its spawned sprite, merge result, and dissolving Echo in one frame. Having
  // Skia decode that source while Expo Image mounted the other two could crash
  // the native renderer after the reducer had already persisted the merge.
  return <View style={[
    styles.dreamEchoArt,
    compatible ? styles.dreamEchoArtCompatible : styles.dreamEchoArtDormant,
    { height: size, width: size },
  ]}>
    <PersistentMergeItemArt definitionId={definitionId} size={size} />
    <View pointerEvents="none" style={[styles.dreamEchoWash, compatible && styles.dreamEchoWashCompatible]} />
  </View>;
}

const styles = StyleSheet.create({
  boardFrame: { alignSelf: 'center', overflow: 'visible', position: 'relative' },
  board: { alignSelf: 'center', backgroundColor: '#4D582B', borderRadius: 0, borderWidth: 0, boxShadow: '0 13px 24px rgba(39,31,16,0.38), 0 3px 5px rgba(39,31,16,0.22), inset 0 3px 2px rgba(255,242,193,0.24), inset 0 -4px 5px rgba(29,38,16,0.34)', overflow: 'visible', position: 'relative' },
  boardGradient: { ...StyleSheet.absoluteFillObject, borderRadius: 0 },
  boardAnimating: { zIndex: 30 },
  cell: { alignItems: 'center', borderRadius: 0, borderWidth: 0.5, justifyContent: 'center', overflow: 'visible', position: 'absolute' },
  cellPressable: { alignItems: 'center', height: '100%', justifyContent: 'center', width: '100%' },
  lockedOverlay: { ...StyleSheet.absoluteFillObject, height: '100%', width: '100%' },
  echoMist: { opacity: 0.78 },
  discoveryMist: { opacity: 0.92 },
  discoveryClue: { alignItems: 'center', backgroundColor: 'rgba(72,57,88,0.56)', borderColor: 'rgba(244,215,149,0.72)', borderRadius: 999, borderWidth: 1, height: '76%', justifyContent: 'center', position: 'absolute', width: '76%', zIndex: 3 },
  dreamboundSealed: { opacity: 0.46 },
  discoveryStageDots: { bottom: 5, flexDirection: 'row', gap: 3, position: 'absolute' },
  discoveryStageDot: { backgroundColor: 'rgba(255,255,255,0.28)', borderRadius: 3, height: 4, width: 4 },
  discoveryStageDotActive: { backgroundColor: '#F4D795' },
  echoItem: { alignItems: 'center', justifyContent: 'center', opacity: 0.84, position: 'absolute', zIndex: 2 },
  echoItemCompatible: { backgroundColor: 'rgba(205, 249, 255, 0.2)', borderColor: 'rgba(209, 252, 255,0.9)', borderRadius: 999, borderWidth: 1.5, boxShadow: '0 0 12px rgba(133, 237, 255, 0.92)', opacity: 1, transform: [{ scale: 1.06 }] },
  hoverCell: { backgroundColor: 'rgba(244,204,110,0.34)', borderColor: '#E1A644', borderRadius: 0, borderWidth: 2, left: 0, position: 'absolute', top: 0, zIndex: 20 },
  feedbackLayer: { zIndex: 2000 },
  mergeCelebrationOverlay: { alignItems: 'center', justifyContent: 'center', position: 'absolute', zIndex: 1400 },
  invalidCellFeedback: { alignItems: 'center', backgroundColor: 'rgba(205,76,56,0.38)', borderColor: '#F38A72', borderRadius: 0, borderWidth: 2, boxShadow: '0 0 12px rgba(225,91,67,0.42)', justifyContent: 'center', position: 'absolute', zIndex: 1450 },
  cellCallout: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 8, borderWidth: 1, justifyContent: 'center', minHeight: 21, paddingHorizontal: 7, position: 'absolute', zIndex: 1700 },
  cellCalloutBlocked: { backgroundColor: 'rgba(63,54,81,0.94)', borderColor: 'rgba(214,203,242,0.72)' },
  cellCalloutWarning: { backgroundColor: 'rgba(133,61,48,0.95)', borderColor: 'rgba(255,190,132,0.82)' },
  cellCalloutHint: { backgroundColor: 'rgba(42,91,102,0.95)', borderColor: 'rgba(176,240,242,0.78)' },
  cellCalloutText: { fontSize: 9.5, fontWeight: '900', letterSpacing: 0.75, lineHeight: 12, textAlign: 'center' },
  mistDissipation: { alignItems: 'center', justifyContent: 'center', overflow: 'visible', position: 'absolute', zIndex: 1500 },
  mistEchoGhost: { alignItems: 'center', justifyContent: 'center', position: 'absolute', zIndex: 2 },
  mistParticle: { borderRadius: 999, boxShadow: '0 0 7px rgba(211,239,255,0.7)', position: 'absolute', zIndex: 3 },
  sprite: { alignItems: 'center', justifyContent: 'center', position: 'absolute' },
  selectedCorners: { position: 'absolute', zIndex: 1300 },
  selectionCorner: { position: 'absolute' },
  selectionCornerTopLeft: { left: -2, top: -2 },
  selectionCornerTopRight: { right: -2, top: -2, transform: [{ rotate: '90deg' }] },
  selectionCornerBottomLeft: { bottom: -2, left: -2, transform: [{ rotate: '-90deg' }] },
  selectionCornerBottomRight: { bottom: -2, right: -2, transform: [{ rotate: '180deg' }] },
  selectionCornerHorizontal: { backgroundColor: '#147F91', borderColor: '#C8FCFF', borderRadius: 3, borderWidth: 1.5, boxShadow: '0 1px 0 rgba(3,54,69,0.95), 0 0 7px rgba(57,218,231,0.96)', left: 0, position: 'absolute', right: 0, top: 0 },
  selectionCornerVertical: { backgroundColor: '#147F91', borderColor: '#C8FCFF', borderRadius: 3, borderWidth: 1.5, bottom: 0, boxShadow: '1px 0 0 rgba(3,54,69,0.95), 0 0 7px rgba(57,218,231,0.96)', left: 0, position: 'absolute', top: 0 },
  familyArt: { alignItems: 'center', justifyContent: 'center' },
  familyDisc: { alignItems: 'center', borderColor: 'rgba(255,244,213,0.65)', borderRadius: 16, borderWidth: 2, boxShadow: '0 3px 8px rgba(38,19,11,0.32)', height: '76%', justifyContent: 'center', width: '76%' },
  dreamEchoArt: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  dreamEchoArtDormant: { opacity: 0.64 },
  dreamEchoArtCompatible: { opacity: 0.9 },
  dreamEchoWash: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(177,190,213,0.34)', borderRadius: 16 },
  dreamEchoWashCompatible: { backgroundColor: 'rgba(183,242,249,0.14)' },
  generatorArt: { height: '92%', width: '92%' },
  generatorSprite: { alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  generatorSparkles: { left: '6%', overflow: 'visible', position: 'absolute', top: '-28%', zIndex: 4 },
  generatorSparkle: { alignItems: 'center', justifyContent: 'center', left: 0, position: 'absolute', top: '42%' },
  generatorBolt: { alignItems: 'center', backgroundColor: '#68517A', borderColor: '#E2C9E7', borderRadius: 999, borderWidth: 1, bottom: 1, boxShadow: '0 2px 5px rgba(48,30,49,0.28)', height: 20, justifyContent: 'center', position: 'absolute', right: 1, width: 20 },
});
