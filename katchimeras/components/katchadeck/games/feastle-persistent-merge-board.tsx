import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnUI } from 'react-native-worklets';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
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
import { MergeBoardEffectsLayer, type MergeBoardEffect, type MergeBoardEffectKind } from '@/components/katchadeck/games/merge-spawn-effects-layer';
import { mergeWorldGeneratorArt, mergeWorldItemArt, mossproutRootRewardArt, RESIDENT_CARD_ART } from '@/constants/merge-world-art';
import { MERGE_CHARACTER_NAMES, MERGE_GENERATORS_BY_ID, MERGE_HYBRID_RECIPES, MERGE_ITEMS_BY_ID, MERGE_WORLD_COLUMNS, MERGE_WORLD_ROWS, MOSSPROUT_ROOTBOUND_GATES_BY_ID } from '@/constants/merge-world-catalog';
import { COMPANION_DISCOVERIES_BY_ID } from '@/constants/companion-discovery-catalog';
import type { MergeBoardInteractionGate } from '@/features/onboarding/merge-ftue';
import type { MergeBoardOperationReceipt, MergeBoardSessionId, MergeInteractionGateReceipt } from '@/features/onboarding/merge-ftue-interaction-coordinator';
import { useMergeBoardFrameProbe } from '@/features/merge-world/use-merge-board-frame-probe';
import { useDisposableTimers } from '@/hooks/use-disposable-timers';
import { mergeGeneratorArtCacheKey, mergeItemArtCacheKey, useMergeArtCache, type MergeArtCache } from '@/hooks/use-merge-art-cache';
import { acquireLifecycleResource } from '@/utils/lifecycle-performance';
import type { MergeBoardOccupant, MergeDreamMist, MergeWorldCommand, MergeWorldCommandResult, MergeWorldFailureReason, MergeWorldState } from '@/types/merge-world';
import { mergeCellFeedbackForFailure, type MergeCellFeedbackTone } from '@/utils/merge-board-feedback';
import { MERGE_MORPH_DURATION_MS, MERGE_MORPH_REDUCED_MOTION_DURATION_MS, SPAWN_MOTION_DURATION_MS, isMistMergeTransition, mergeMotionPiecewise, mergeSpriteMotionFrame, spawnSpriteMotionFrame, type MergeBoardMotionKind } from '@/utils/merge-board-motion';
import { mergeCellCenter, mergeCellFrame, mergeCellFromPoint, mergeNeighborCellInDirection, type MergeBoardGeometry, type MergeBoardProjection } from '@/utils/merge-world/board-geometry';
import { MERGE_GENERATORS_UNLIMITED } from '@/utils/merge-world/economy-policy';
import { mossproutRootConditionCopy, mossproutRootReadyCopy, mossproutRootRewardCopy } from '@/utils/merge-world/merge-board-player-copy';

export type MergeBoardScreenMetrics = { geometry: MergeBoardGeometry; x: number; y: number };
export type MergeBoardLayout = {
  accessibilityLabel: string;
  baseSource?: ImageSourcePropType;
  /** Opacity for merge-page grid art. Defaults to 0 on transparent surfaces. */
  baseArtOpacity?: number;
  /** Allows a board painted into its parent artwork to remain visible. */
  transparentSurface?: boolean;
  /** Visual cell height divided by cell width. Square boards default to 1. */
  cellHeightToWidthRatio?: number;
  /** Fill the supplied width and maxHeight exactly so no parent gesture leaks through. */
  fillAvailableSpace?: boolean;
  /** Override the default board padding when an embedded playfield is pixel-calibrated. */
  contentInset?: number;
  /** Optional native checkerboard tint used by transparent embedded boards. */
  checkerboardCellColor?: string;
  /** Omit for the dedicated board's direct row-major cell order. */
  cellIndices?: readonly number[];
  columns: number;
  rows: number;
  projection?: MergeBoardProjection;
};

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

const MERGE_BOARD_BASE = require('../../../assets/images/katchimeras/merge-world/generated/merge-board-base.webp');
const DREAM_MIST_FULL = require('../../../assets/images/katchimeras/merge-world/locked/dream-mist-full.webp');
const DREAM_MIST_LOWER = require('../../../assets/images/katchimeras/merge-world/locked/dream-mist-lower.webp');
const DEFAULT_MERGE_BOARD_LAYOUT: MergeBoardLayout = {
  accessibilityLabel: 'Merge board, seven columns by nine rows',
  columns: MERGE_WORLD_COLUMNS,
  rows: MERGE_WORLD_ROWS,
};

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

function mergeSpriteOrigin(geometry: MergeBoardGeometry, index: number) {
  const center = mergeCellCenter(geometry, index);
  return {
    x: center.x - geometry.cellSize / 2,
    y: center.y - geometry.cellSize / 2,
  };
}

function introDelayForCell(cell: number, geometry: MergeBoardGeometry) {
  const visualCell = geometry.cellIndices ? geometry.cellIndices.indexOf(cell) : cell;
  const column = visualCell % geometry.columns;
  const row = Math.floor(visualCell / geometry.columns);
  const centerColumn = (geometry.columns - 1) / 2;
  const centerRow = (geometry.rows - 1) / 2;
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

export const FeastlePersistentMergeBoard = memo(function FeastlePersistentMergeBoard({ state, width, maxHeight, selectedCell, onSelect, onCommand, onCommandSettled, onInteractionGateCommitted, onBoardRelease, onScreenMetrics, screenMetricsRevision = 0, onVisualReady, onBlockedInteraction, onInspectMist, onInspectRootbound, onHiddenItemsRetired, interactionGate = { kind: 'open' }, interactionSessionKey = 'open', sessionId, hiddenItemInstanceIds, animateEntrance = true, layout = DEFAULT_MERGE_BOARD_LAYOUT }: {
  state: MergeWorldState;
  width: number;
  animateEntrance?: boolean;
  maxHeight?: number;
  selectedCell: number | null;
  onSelect: (cell: number | null) => void;
  onCommand: (command: MergeWorldCommand) => MergeWorldCommandResult | null;
  onCommandSettled?: (receipt: MergeBoardOperationReceipt) => void;
  onInteractionGateCommitted?: (receipt: MergeInteractionGateReceipt) => void;
  onBoardRelease?: () => void;
  onScreenMetrics?: (metrics: MergeBoardScreenMetrics) => void;
  /** Re-measure after an ancestor camera transform settles. */
  screenMetricsRevision?: number;
  onVisualReady?: () => void;
  onBlockedInteraction?: () => void;
  onInspectMist?: (cell: number) => void;
  onInspectRootbound?: (gateId: string) => void;
  onHiddenItemsRetired?: (instanceIds: readonly string[]) => void;
  interactionGate?: MergeBoardInteractionGate;
  interactionSessionKey?: string;
  sessionId: MergeBoardSessionId;
  hiddenItemInstanceIds?: ReadonlySet<string>;
  layout?: MergeBoardLayout;
}) {
  const gap = 0;
  const padding = layout.contentInset ?? (width < 380 ? 5 : 6);
  const border = 0;
  const cellHeightToWidthRatio = layout.cellHeightToWidthRatio ?? 1;
  const widthCellSize = (width - (padding + border) * 2 - gap * (layout.columns - 1)) / layout.columns;
  const availableCellHeight = maxHeight == null
    ? widthCellSize * cellHeightToWidthRatio
    : (maxHeight - (padding + border) * 2 - gap * (layout.rows - 1)) / layout.rows;
  const fillAvailableSpace = layout.fillAvailableSpace === true && maxHeight != null;
  const cellSize = Math.max(24, fillAvailableSpace
    ? widthCellSize
    : Math.floor(Math.min(widthCellSize, availableCellHeight / cellHeightToWidthRatio)));
  const cellHeight = Math.max(24, fillAvailableSpace
    ? availableCellHeight
    : Math.floor(cellSize * cellHeightToWidthRatio));
  const inset = padding + border;
  const boardWidth = cellSize * layout.columns + gap * (layout.columns - 1) + inset * 2;
  const boardHeight = cellHeight * layout.rows + gap * (layout.rows - 1) + inset * 2;
  const baseArtOpacity = Math.max(0, Math.min(1, layout.baseArtOpacity ?? (layout.transparentSurface ? 0 : 1)));
  const showBaseArt = !layout.transparentSurface || baseArtOpacity > 0;
  const renderedCellIndices = useMemo(
    () => layout.cellIndices ?? Array.from({ length: layout.columns * layout.rows }, (_, index) => index),
    [layout.cellIndices, layout.columns, layout.rows],
  );
  const geometry = useMemo<MergeBoardGeometry>(() => ({ columns: layout.columns, rows: layout.rows, cellIndices: layout.cellIndices, cellSize, cellHeight, gap, inset, projection: layout.projection }), [cellHeight, cellSize, gap, inset, layout.cellIndices, layout.columns, layout.projection, layout.rows]);
  const visibleCellSet = useMemo(() => new Set(renderedCellIndices), [renderedCellIndices]);
  const cellFrames = useMemo(
    () => Object.fromEntries(renderedCellIndices.map((index) => [index, mergeCellFrame(geometry, index)])) as Record<number, ReturnType<typeof mergeCellFrame>>,
    [geometry, renderedCellIndices],
  );
  const boardRef = useRef<View>(null);
  const reportScreenMetrics = useCallback(() => {
    const frame = requestAnimationFrame(() => {
      boardRef.current?.measureInWindow((x, y) => onScreenMetrics?.({ geometry, x, y }));
    });
    return () => cancelAnimationFrame(frame);
  }, [geometry, onScreenMetrics]);
  useEffect(reportScreenMetrics, [reportScreenMetrics, screenMetricsRevision]);
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
      ? spritesFromState(state)
          .filter((sprite) => visibleCellSet.has(sprite.cell))
          .map((sprite) => [spriteId(sprite), introDelayForCell(sprite.cell, geometry)])
      : [],
  ));
  const spritesRef = useRef(sprites);
  const motionsRef = useRef(motions);
  const [invalidFeedback, setInvalidFeedback] = useState<{ id: number; cell: number } | null>(null);
  const [boardEffects, setBoardEffects] = useState<MergeBoardEffect[]>([]);
  const [cellFeedback, setCellFeedback] = useState<MergeCellFeedback[]>([]);
  const [mistDissipations, setMistDissipations] = useState<DreamMistDissipationRecord[]>([]);
  const operationSequence = useRef(0);
  const motionSequence = useRef(0);
  const effectSequence = useRef(0);
  const invalidFeedbackSequence = useRef(0);
  const cellFeedbackSequence = useRef(0);
  const mistDissipationSequence = useRef(0);
  const activeOperations = useRef(new Map<number, ActiveOperation>());
  const committedStateRef = useRef(state);
  const onSelectRef = useRef(onSelect);
  const onCommandSettledRef = useRef(onCommandSettled);
  const onInteractionGateCommittedRef = useRef(onInteractionGateCommitted);
  const onBoardReleaseRef = useRef(onBoardRelease);
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
  const [baseArtDisplayed, setBaseArtDisplayed] = useState(!showBaseArt);
  const [cellArtReady, setCellArtReady] = useState(false);
  const artCache = useMergeArtCache(presentation, mossproutOnboarding, () => setCellArtReady(true));
  useEffect(() => {
    if (baseArtDisplayed && cellArtReady) onVisualReady?.();
  }, [baseArtDisplayed, cellArtReady, onVisualReady]);
  useMergeBoardFrameProbe(busy || boardEffects.length > 0, dragPhase);

  const emitBoardEffect = useCallback((cell: number, kind: MergeBoardEffectKind) => {
    const effect: MergeBoardEffect = { cell, id: ++effectSequence.current, kind };
    setBoardEffects((current) => [...current.slice(-5), effect]);
    const duration = reduceMotion ? 220 : kind === 'merge' ? 700 : kind === 'spawn-settle' ? 620 : 520;
    timers.schedule(() => setBoardEffects((current) => current.filter((entry) => entry.id !== effect.id)), duration);
  }, [reduceMotion, timers]);

  presentationRef.current = presentation;
  spritesRef.current = sprites;
  motionsRef.current = motions;
  onSelectRef.current = onSelect;
  onCommandSettledRef.current = onCommandSettled;
  onInteractionGateCommittedRef.current = onInteractionGateCommitted;
  onBoardReleaseRef.current = onBoardRelease;
  selectedCellRef.current = selectedCell;

  const showCellFeedback = useCallback((cell: number, reason: MergeWorldFailureReason) => {
    const presentation = mergeCellFeedbackForFailure(reason);
    if (!presentation || !visibleCellSet.has(cell)) return;
    const feedback = { id: ++cellFeedbackSequence.current, cell, ...presentation };
    setCellFeedback((current) => [...current.filter((entry) => entry.cell !== cell).slice(-2), feedback]);
    timers.schedule(() => setCellFeedback((current) => current.filter((entry) => entry.id !== feedback.id)), 760);
    void AccessibilityInfo.announceForAccessibility(presentation.message.toLowerCase());
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [timers, visibleCellSet]);

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
    const completedMotion = motionsRef.current[instanceId];
    if (completedMotion?.kind === 'spawn') {
      const settledSprite = spritesRef.current.find((entry) => spriteId(entry) === instanceId);
      if (settledSprite) emitBoardEffect(settledSprite.cell, 'spawn-settle');
    }
    operation.remaining.delete(instanceId);
    finishOperationIfReady(operationId);
  }, [emitBoardEffect, finishOperationIfReady]);

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
    const origin = mergeSpriteOrigin(geometry, sprite.cell);
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
    if (!targetCell || (targetCell.locked && targetCell.mist?.kind !== 'echo' && targetCell.mist?.kind !== 'rootbound_echo' && targetCell.mist?.kind !== 'dreambound_item' && targetCell.mist?.kind !== 'resident_card')) {
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
    const sourceOrigin = mergeSpriteOrigin(geometry, from);
    const targetOrigin = mergeSpriteOrigin(geometry, to);
    const resultingOccupant = predicted.state.board[to]?.occupant;
    const merging = sprite.occupant.kind === 'item'
      && target?.occupant.kind === 'item'
      && resultingOccupant?.kind === 'item'
      && resultingOccupant.instanceId !== sprite.occupant.instanceId;
    const nextMotions: Record<string, Omit<SpriteMotion, 'operationId' | 'token'>> = {};
    let nextSprites: SpriteRecord[];

    const residentCardReveal = Boolean(predicted.residentCardRevealed && predicted.mergedCell === to);
    const mistMerging = !target && isMistMergeTransition(targetCell.mist?.kind, predicted.mergedCell, to, Boolean(resultingOccupant));
    if (mistMerging && resultingOccupant) {
      const result: SpriteRecord = { occupant: resultingOccupant, cell: to };
      nextSprites = currentSprites.map((entry) => spriteId(entry) === instanceId ? { ...entry, cell: to } : entry).concat(result);
      nextMotions[instanceId] = { kind: 'merge-source', startX: sourceOrigin.x + dx, startY: sourceOrigin.y + dy };
      nextMotions[spriteId(result)] = { kind: 'merge-result', startX: targetOrigin.x, startY: targetOrigin.y };
      const mistDefinitionId = targetCell.mist?.kind === 'echo'
        ? targetCell.mist.definitionId
        : targetCell.mist?.kind === 'rootbound_echo' ? targetCell.mist.definitionId
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
      emitBoardEffect(to, 'merge');
    } else if (residentCardReveal) {
      nextSprites = currentSprites.filter((entry) => spriteId(entry) !== instanceId);
      nextMotions[instanceId] = { kind: 'merge-source', startX: sourceOrigin.x + dx, startY: sourceOrigin.y + dy };
      emitBoardEffect(to, 'merge');
    } else if (merging && target && resultingOccupant?.kind === 'item') {
      const result: SpriteRecord = { occupant: resultingOccupant, cell: to };
      nextSprites = currentSprites.map((entry) => spriteId(entry) === instanceId ? { ...entry, cell: to } : entry).concat(result);
      nextMotions[instanceId] = { kind: 'merge-source', startX: sourceOrigin.x + dx, startY: sourceOrigin.y + dy };
      nextMotions[spriteId(target)] = { kind: 'merge-target', startX: targetOrigin.x, startY: targetOrigin.y };
      nextMotions[spriteId(result)] = { kind: 'merge-result', startX: targetOrigin.x, startY: targetOrigin.y };
      emitBoardEffect(to, 'merge');
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
      void Haptics.impactAsync(merging || mistMerging || residentCardReveal
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light);
    }
    beginOperation({ nextState: predicted.state, nextSprites, nextMotions, settledRevision: predicted.state.revision });
    finishInterruptedOperation();
  }, [beginOperation, detachMotion, emitBoardEffect, finishOperationIfReady, geometry, hoverCell, onCommand, onSelect, reduceMotion, returnSpriteHome, showCellFeedback, timers]);
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
    const start = mergeSpriteOrigin(geometry, from);
    const end = mergeSpriteOrigin(geometry, to);
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    const nextSprite: SpriteRecord = { occupant: spawned, cell: to };
    emitBoardEffect(from, 'spawn-origin');
    beginOperation({
      nextState: predicted.state,
      nextSprites: [...currentSprites, nextSprite],
      nextMotions: { [spawned.instanceId]: { kind: 'spawn', startX: start.x, startY: start.y, arcHeight: Math.max(cellSize * 1.45, Math.min(cellSize * 2.35, distance * 0.42)) } },
      kind: 'spawn',
      settledRevision: predicted.state.revision,
    });
  }, [beginOperation, cellSize, emitBoardEffect, geometry, onCommand, onSelect, showCellFeedback]);
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
      const origin = mergeSpriteOrigin(geometry, sprite.cell);
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
    const origin = mergeSpriteOrigin(geometry, sprite.cell);
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
    if (boardCell?.mist?.kind === 'rootbound_echo') {
      onSelectRef.current(cell);
      onInspectRootbound?.(boardCell.mist.gateId);
      return;
    }
    if (boardCell?.mist || boardCell?.locked) {
      onSelectRef.current(cell);
      onInspectMist?.(cell);
      return;
    }
  }, [onInspectMist, onInspectRootbound]);
  emptyCellTapRef.current = tapEmptyCell;
  const emitEmptyCellTap = useCallback((cell: number) => emptyCellTapRef.current(cell), []);
  const emitBoardReleaseFocus = useCallback(() => onBoardReleaseRef.current?.(), []);

  const accessibleAction = useCallback((cell: number) => {
    emitBoardReleaseFocus();
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
    if (boardCell?.mist?.kind === 'rootbound_echo') {
      onSelectRef.current(cell);
      onInspectRootbound?.(boardCell.mist.gateId);
      return;
    }
    if (boardCell?.mist || boardCell?.locked) {
      onSelectRef.current(cell);
      onInspectMist?.(cell);
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
    const selectedItem = selectedCell == null ? null : current.board[selectedCell]?.occupant;
    if (selectedCell == null || selectedItem?.kind !== 'item') {
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
  }, [blockInteraction, emitBoardReleaseFocus, gateFromCell, gateGeneratorCell, gateKind, gateToCell, geometry, onInspectMist, onInspectRootbound]);

  const selectedOccupant = selectedCell == null ? null : presentation.board[selectedCell]?.occupant;
  const selectedDefinitionId = selectedOccupant?.kind === 'item' ? selectedOccupant.definitionId : null;
  const selectedProgressionGateId = selectedOccupant?.kind === 'item' ? selectedOccupant.progressionGateId : undefined;
  const matchingCells = useMemo(() => {
    if (selectedCell == null || !selectedDefinitionId) return [];
    return presentation.board.flatMap((cell, index) => {
      if (index === selectedCell || !visibleCellSet.has(index)) return [];
      const itemMatch = !selectedProgressionGateId && cell.occupant?.kind === 'item' && !cell.occupant.progressionGateId && cell.occupant.definitionId === selectedDefinitionId;
      const echoMatch = cell.mist?.kind === 'echo' && cell.mist.definitionId === selectedDefinitionId;
      const rootboundMatch = cell.mist?.kind === 'rootbound_echo' && cell.mist.ready
        && cell.mist.definitionId === selectedDefinitionId
        && (!selectedProgressionGateId || cell.mist.gateId === selectedProgressionGateId);
      const dreamboundMatch = cell.mist?.kind === 'dreambound_item' && cell.mist.active && cell.mist.boundDefinitionId === selectedDefinitionId;
      return itemMatch || echoMatch || rootboundMatch || dreamboundMatch ? [index] : [];
    });
  }, [presentation.board, selectedCell, selectedDefinitionId, selectedProgressionGateId, visibleCellSet]);
  const matchingCellsKey = matchingCells.join(':');
  const matchingCellSet = useMemo(() => new Set(matchingCells), [matchingCells]);
  const selectedHintTarget = useMemo(() => {
    if (selectedCell == null || matchingCells.length === 0) return null;
    const selectedOrigin = cellFrames[selectedCell].center;
    return matchingCells.reduce((closest, candidate) => {
      const closestOrigin = cellFrames[closest].center;
      const candidateOrigin = cellFrames[candidate].center;
      const closestDistance = Math.hypot(closestOrigin.x - selectedOrigin.x, closestOrigin.y - selectedOrigin.y);
      const candidateDistance = Math.hypot(candidateOrigin.x - selectedOrigin.x, candidateOrigin.y - selectedOrigin.y);
      return candidateDistance < closestDistance ? candidate : closest;
    });
  }, [cellFrames, matchingCells, selectedCell]);
  const [matchHintActive, setMatchHintActive] = useState(false);
  useEffect(() => {
    setMatchHintActive(false);
    if (reduceMotion || selectedCell == null || selectedHintTarget == null) return;
    const timeout = setTimeout(() => setMatchHintActive(true), 2800);
    return () => clearTimeout(timeout);
  }, [matchingCellsKey, reduceMotion, selectedCell, selectedDefinitionId, selectedHintTarget]);
  const matchHintForCell = useCallback((cell: number) => {
    if (!matchHintActive || selectedCell == null) return null;
    const target = cell === selectedCell ? selectedHintTarget : matchingCellSet.has(cell) ? selectedCell : null;
    if (target == null) return null;
    const from = mergeCellCenter(geometry, cell);
    const to = mergeCellCenter(geometry, target);
    const distance = Math.max(1, Math.hypot(to.x - from.x, to.y - from.y));
    const strength = Math.min(2.25, cellSize * 0.045);
    return { x: (to.x - from.x) / distance * strength, y: (to.y - from.y) / distance * strength };
  }, [cellSize, geometry, matchHintActive, matchingCellSet, selectedCell, selectedHintTarget]);

  const boardGesture = useMemo(() => Gesture.Pan()
    .enabled(entranceInteractive)
    .maxPointers(1)
    .minDistance(0)
    .shouldCancelWhenOutside(false)
    .onTouchesDown((event) => {
      const touch = event.allTouches[0];
      if (!touch) return;
      const cell = mergeCellFromPointWorklet(touch.x, touch.y, geometry.cellSize, geometry.cellHeight ?? geometry.cellSize, geometry.gap, geometry.inset, geometry.columns, geometry.rows, geometry.cellIndices, geometry.projection?.topWidthRatio ?? 1);
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
      const center = mergeCellCenterWorklet(cell, geometry.cellSize, geometry.cellHeight ?? geometry.cellSize, geometry.gap, geometry.inset, geometry.columns, geometry.rows, geometry.cellIndices, geometry.projection?.topWidthRatio ?? 1);
      grabX.value = center.x - geometry.cellSize / 2;
      grabY.value = center.y - geometry.cellSize / 2;
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
        geometry.cellHeight ?? geometry.cellSize,
        geometry.gap,
        geometry.inset,
        geometry.columns,
        geometry.rows,
        geometry.cellIndices,
        geometry.projection?.topWidthRatio ?? 1,
      );
    })
    .onTouchesUp((event) => {
      const id = activeDragId.value;
      const touch = event.changedTouches[0];
      if (!touch || gestureFinished.value) return;
      const dx = touch.x - touchDownX.value;
      const dy = touch.y - touchDownY.value;
      const releaseCell = mergeCellFromPointWorklet(touch.x, touch.y, geometry.cellSize, geometry.cellHeight ?? geometry.cellSize, geometry.gap, geometry.inset, geometry.columns, geometry.rows, geometry.cellIndices, geometry.projection?.topWidthRatio ?? 1);
      maxGestureDistance.value = Math.max(maxGestureDistance.value, Math.hypot(dx, dy));
      if (!id) {
        if (maxGestureDistance.value <= BOARD_TAP_SLOP && activeSourceCell.value >= 0 && releaseCell >= 0) {
          gestureFinished.value = true;
          runOnJS(emitBoardReleaseFocus)();
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
      if (releaseCell >= 0) runOnJS(emitBoardReleaseFocus)();
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
      const releaseCell = mergeCellFromPointWorklet(worldX + geometry.cellSize / 2, worldY + geometry.cellSize / 2, geometry.cellSize, geometry.cellHeight ?? geometry.cellSize, geometry.gap, geometry.inset, geometry.columns, geometry.rows, geometry.cellIndices, geometry.projection?.topWidthRatio ?? 1);
      maxGestureDistance.value = Math.max(maxGestureDistance.value, Math.hypot(event.translationX, event.translationY));
      const speed = Math.hypot(event.velocityX, event.velocityY);
      const isFlick = maxGestureDistance.value >= BOARD_FLICK_MIN_DISTANCE && speed >= BOARD_FLICK_MIN_VELOCITY;
      if ((maxGestureDistance.value > BOARD_TAP_SLOP || isFlick) && !dragHapticTriggered.value) {
        dragHapticTriggered.value = true;
        runOnJS(dragSprite)();
      }
      if (maxGestureDistance.value <= BOARD_TAP_SLOP && !isFlick) {
        if (releaseCell >= 0) runOnJS(emitBoardReleaseFocus)();
        if (gateKind === 'drag') {
          runOnJS(blockInteraction)();
          runOnJS(emitBoardCancel)(id, worldX, worldY, epoch);
        } else runOnJS(emitBoardTap)(id, worldX, worldY, epoch);
      } else {
        if (releaseCell >= 0) runOnJS(emitBoardReleaseFocus)();
        if (gateKind === 'generator') {
          runOnJS(blockInteraction)();
          runOnJS(emitBoardCancel)(id, worldX, worldY, epoch);
          return;
        }
        const sourceCell = activeSourceCell.value;
        let targetCell = releaseCell;
        if (isFlick && targetCell === sourceCell) {
          targetCell = mergeNeighborCellInDirection(
            { columns: geometry.columns, rows: geometry.rows, cellIndices: geometry.cellIndices },
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
    }), [activeDragId, activeSourceCell, blockInteraction, dragEpoch, dragHapticTriggered, dragPhase, dragSprite, dragTranslationX, dragTranslationY, emitBoardCancel, emitBoardDrop, emitBoardReleaseFocus, emitBoardTap, emitEmptyCellTap, entranceInteractive, gateFromCell, gateGeneratorCell, gateKind, gateToCell, geometry, gestureFinished, grabX, grabY, hoverCell, maxGestureDistance, occupancyDefinitions, occupancyIds, pickSprite, touchDownX, touchDownY]);

  // Measure a stable, untransformed frame. The visual board enters with a
  // translateY animation; measuring that Animated.View cached a temporary
  // screen Y and caused parcel flights to land below their eventual cells.
  return <View onLayout={reportScreenMetrics} ref={boardRef} style={[styles.boardFrame, { height: boardHeight, width: boardWidth }]}>
    <GestureDetector gesture={boardGesture}><Animated.View accessibilityLabel={layout.accessibilityLabel} style={[styles.board, layout.transparentSurface && styles.boardTransparentSurface, busy && styles.boardAnimating, { height: boardHeight, padding, width: boardWidth }, boardEntranceStyle]}>
    {!layout.transparentSurface ? <LinearGradient colors={['#788143', '#55602F', '#384321']} locations={[0, 0.52, 1]} pointerEvents="none" style={styles.boardGradient} /> : null}
    {showBaseArt ? <Image
      accessibilityIgnoresInvertColors
      allowDownscaling
      cachePolicy="memory"
      contentFit="fill"
      enforceEarlyResizing
      pointerEvents="none"
      onDisplay={() => setBaseArtDisplayed(true)}
      recyclingKey="merge-board-static-base"
      source={layout.baseSource ?? MERGE_BOARD_BASE}
      style={{ borderRadius: 5, height: cellHeight * layout.rows, left: inset, opacity: baseArtOpacity, position: 'absolute', top: inset, width: cellSize * layout.columns }}
      transition={0}
    /> : null}
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {renderedCellIndices.map((index, visualIndex) => {
        const cell = presentation.board[index];
        if (!cell) return null;
        const frame = cellFrames[index];
        const occupant = cell.occupant;
        const item = occupant?.kind === 'item' ? occupant : null;
        const generator = occupant?.kind === 'generator' ? MERGE_GENERATORS_BY_ID.get(occupant.generatorId) : null;
        const definition = item ? MERGE_ITEMS_BY_ID.get(item.definitionId) : null;
        const nextDefinition = definition?.nextItemId ? MERGE_ITEMS_BY_ID.get(definition.nextItemId) : null;
        const echoDefinition = cell.mist?.kind === 'echo' || cell.mist?.kind === 'rootbound_echo' ? MERGE_ITEMS_BY_ID.get(cell.mist.definitionId) : null;
        const companionDiscovery = cell.mist?.kind === 'dreambound_item' ? COMPANION_DISCOVERIES_BY_ID.get(cell.mist.discoveryId) : null;
        const discoveryStage = companionDiscovery && cell.mist?.kind === 'dreambound_item' ? companionDiscovery.stages[cell.mist.sequenceIndex] : null;
        const dormantNames = cell.mist?.kind === 'discovery_dormant'
          ? cell.mist.characterIds.map((id) => MERGE_CHARACTER_NAMES[id]).filter(Boolean)
          : [];
        const generatorState = occupant?.kind === 'generator' ? state.generators[occupant.generatorId] : null;
        const generatorReadiness = MERGE_GENERATORS_UNLIMITED
          ? 'Unlimited finds ready.'
          : `${generatorState?.charges ?? 0} of ${generatorState?.capacity ?? 0} finds ready.`;
        const label = generator ? `${generator.name}. ${generatorReadiness} Tap to make an item.`
          : definition ? nextDefinition
            ? `${definition.name}. Merge with another ${definition.name} to make ${nextDefinition.name}.`
            : `${definition.name}. This item cannot be merged any further.`
            : cell.mist?.kind === 'rootbound_echo' ? rootboundAccessibilityLabel(cell.mist.gateId, cell.mist.ready)
            : cell.mist?.kind === 'resident_card' ? cell.mist.ready
              ? 'Mystery resident card. Bring the sealed card from its parcel here to reveal who is waiting.'
              : 'A locked resident card. Continue Mossprout’s Journey to discover who is waiting.'
            : echoDefinition ? `Sleeping ${echoDefinition.name}. Bring another ${echoDefinition.name} here to wake it.`
              : discoveryStage ? `${discoveryStage.clue}. ${cell.mist?.kind === 'dreambound_item' && cell.mist.active ? `Bring another ${MERGE_ITEMS_BY_ID.get(cell.mist.boundDefinitionId)?.name ?? 'matching item'} here.` : 'Follow the trail to wake this item.'}`
                : cell.mist?.kind === 'discovery_fork' ? 'Several paths are moving beneath the Dream Mist. Choose one to investigate.'
                  : cell.mist?.kind === 'garden_growth' ? `Hidden garden patch. It opens on Mossprout Journey Day ${cell.mist.revealDay}. You do not need an item.`
                    : cell.mist?.kind === 'discovery_dormant' ? dormantNames.length
                      ? `A path to ${dormantNames.join(' or ')}. Meet them to open this space.`
                      : 'A future Katchimera story will open this space.'
                : cell.mist ? 'Something is hidden in the Dream Mist.' : 'Empty board space';
        return <BoardCell
          accessibilityActionLabel={gateKind === 'drag' && index === gateFromCell
            ? 'Merge with highlighted item'
            : generator ? 'Make an item'
              : cell.mist || cell.locked ? 'Show details' : 'Select or move item'}
          accessibilityDisabled={gateKind === 'locked' || (gateKind === 'drag' && index !== gateFromCell) || (gateKind === 'generator' && index !== gateGeneratorCell)}
          accessibilityLabel={label}
          blocked={cell.locked && !occupant}
          checkerboardColor={layout.checkerboardCellColor && (
            (Math.floor(visualIndex / layout.columns) + visualIndex % layout.columns) % 2 === 1
          ) ? layout.checkerboardCellColor : null}
          height={frame.bounds.height}
          index={index}
          invalid={invalidFeedback?.cell === index}
          key={index}
          left={frame.bounds.left}
          onActivate={accessibleAction}
          mist={cell.mist}
          matchHint={matchHintForCell(index)}
          top={frame.bounds.top}
          width={frame.bounds.width}
        />;
      })}
      <HoverCellOverlay geometry={geometry} hoverCell={hoverCell} />
    </View>
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <MergeBoardEffectsLayer effects={boardEffects} geometry={geometry} reduceMotion={reduceMotion} size={cellSize} />
      {sprites.filter((sprite) => visibleCellSet.has(sprite.cell) && (sprite.occupant.kind !== 'item' || !hiddenItemInstanceIds?.has(sprite.occupant.instanceId))).map((sprite) => {
        const frame = cellFrames[sprite.cell];
        const id = spriteId(sprite);
        const matchHint = sprite.occupant.kind === 'item' ? matchHintForCell(sprite.cell) : null;
        return <PersistentSprite
          baseX={frame.center.x - cellSize / 2}
          baseY={frame.center.y - cellSize / 2}
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
          matchHint={matchHint}
          artCache={artCache}
          generatorLevel={sprite.occupant.kind === 'generator' ? presentation.generators[sprite.occupant.generatorId]?.level ?? 1 : 1}
          mossproutOnboarding={mossproutOnboarding}
          occupant={sprite.occupant}
          onComplete={completeMotion}
          projection={geometry.projection}
          projectionGridHeight={cellHeight * layout.rows + gap * (layout.rows - 1)}
          projectionInset={inset}
          reduceMotion={reduceMotion}
        />;
      })}
    </View>
    {selectedCell != null && presentation.board[selectedCell] && (presentation.board[selectedCell].occupant || presentation.board[selectedCell].locked)
      ? <SelectedCellCorners cell={selectedCell} dragPhase={dragPhase} geometry={geometry} reduceMotion={reduceMotion} staticFrame={presentation.board[selectedCell].locked} />
      : null}
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.feedbackLayer]}>
      {mistDissipations.map((dissipation) => <DreamMistDissipation effect={dissipation} geometry={geometry} key={dissipation.id} reduceMotion={reduceMotion} />)}
      {invalidFeedback ? <InvalidCellFeedback cell={invalidFeedback.cell} geometry={geometry} key={invalidFeedback.id} /> : null}
      {cellFeedback.map((feedback) => <MergeCellCallout feedback={feedback} geometry={geometry} key={feedback.id} reduceMotion={reduceMotion} />)}
    </View>
    </Animated.View></GestureDetector>
  </View>;
});

const BoardCell = memo(function BoardCell({ accessibilityActionLabel, accessibilityDisabled, accessibilityLabel, blocked, checkerboardColor, invalid, index, left, top, width, height, matchHint, mist, onActivate }: {
  accessibilityActionLabel: string;
  accessibilityDisabled: boolean;
  accessibilityLabel: string;
  blocked: boolean;
  checkerboardColor: string | null;
  invalid: boolean;
  index: number;
  left: number;
  top: number;
  width: number;
  height: number;
  matchHint: { x: number; y: number } | null;
  mist: MergeDreamMist | null;
  onActivate: (cell: number) => void;
}) {
  const checkerboardInset = Math.min(width, height) * (5 / 128);
  const checkerboardRadius = Math.max(6, Math.min(width, height) * (14 / 128));
  const rootbound = mist?.kind === 'rootbound_echo' ? mist : null;
  const residentCard = mist?.kind === 'resident_card' ? mist : null;
  const lockedDefinitionId = mist?.kind === 'echo'
    ? mist.definitionId
    : mist?.kind === 'dreambound_item' ? mist.boundDefinitionId : null;
  return <View style={[styles.cell, { height, left, top, width }]}>
    <View
      accessible
      accessibilityActions={[{ name: 'activate', label: accessibilityActionLabel }]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: accessibilityDisabled }}
      onAccessibilityAction={() => onActivate(index)}
      style={styles.cellPressable}>
      {checkerboardColor ? <View pointerEvents="none" style={{
        backgroundColor: checkerboardColor,
        borderCurve: 'continuous',
        borderRadius: checkerboardRadius,
        bottom: checkerboardInset,
        left: checkerboardInset,
        position: 'absolute',
        right: checkerboardInset,
        top: checkerboardInset,
      }} /> : null}
      {invalid ? <View pointerEvents="none" style={[
        styles.cellStateOverlay,
        invalid && styles.cellStateInvalid,
      ]} /> : null}
      {lockedDefinitionId ? <View pointerEvents="none" style={styles.echoItem}>
        <MergeMatchHint active={matchHint != null} offsetX={matchHint?.x ?? 0} offsetY={matchHint?.y ?? 0}>
          <DreamEchoItemArt definitionId={lockedDefinitionId} size={Math.min(width, height) - 4} />
        </MergeMatchHint>
      </View> : null}
      {rootbound ? <RootboundRewardArt gateId={rootbound.gateId} matchHint={matchHint} ready={rootbound.ready} size={Math.min(width, height) - 4} /> : null}
      {residentCard ? <View pointerEvents="none" style={styles.echoItem}><MergeMatchHint active={matchHint != null} offsetX={matchHint?.x ?? 0} offsetY={matchHint?.y ?? 0}><Image accessibilityIgnoresInvertColors contentFit="contain" source={RESIDENT_CARD_ART} style={{ height: Math.min(width, height) - 8, opacity: residentCard.ready ? 1 : 0.72, width: Math.min(width, height) - 8 }} transition={0} /></MergeMatchHint></View> : null}
      {lockedDefinitionId || rootbound || residentCard ? <Image accessibilityIgnoresInvertColors allowDownscaling cachePolicy="memory" contentFit="fill" pointerEvents="none" recyclingKey="merge-dream-mist-lower" source={DREAM_MIST_LOWER} style={[styles.lockedOverlay, styles.lowerMistOverlay]} transition={0} /> : null}
      {mist?.kind === 'discovery_dormant' ? <View pointerEvents="none" style={styles.mistCategoryArt}><IconSymbol color="#F4D795" name="sparkles" size={Math.max(17, Math.min(width, height) * 0.38)} /></View> : null}
      {blocked && !lockedDefinitionId && !rootbound && !residentCard ? <Image accessibilityIgnoresInvertColors allowDownscaling cachePolicy="memory" contentFit="fill" recyclingKey="merge-dream-mist-full" source={DREAM_MIST_FULL} style={[styles.lockedOverlay, styles.fullMistOverlay]} transition={0} /> : null}
      {mist?.kind === 'discovery_fork' ? <View pointerEvents="none" style={styles.discoveryClue}>
        <IconSymbol color="#F4D795" name="sparkles" size={Math.max(18, Math.min(width, height) * 0.44)} />
      </View> : null}
    </View>
  </View>;
});

function RootboundRewardArt({ gateId, matchHint, ready, size }: {
  gateId: string;
  matchHint: { x: number; y: number } | null;
  ready: boolean;
  size: number;
}) {
  const gate = MOSSPROUT_ROOTBOUND_GATES_BY_ID.get(gateId);
  if (!gate) return null;
  const image = mossproutRootRewardArt(gateId);
  if (!image) return null;
  return <View pointerEvents="none" style={[styles.echoItem, ready && styles.rootRewardReady]}>
    <MergeMatchHint active={matchHint != null} offsetX={matchHint?.x ?? 0} offsetY={matchHint?.y ?? 0}>
      <Image accessibilityIgnoresInvertColors contentFit="contain" source={image} style={{ height: size, width: size }} transition={0} />
    </MergeMatchHint>
  </View>;
}

function rootboundAccessibilityLabel(gateId: string, ready: boolean) {
  const root = MOSSPROUT_ROOTBOUND_GATES_BY_ID.get(gateId);
  if (!root) return 'Sleeping root. Select for details.';
  return ready
    ? `${root.title}. Ready to wake. ${mossproutRootReadyCopy(root)} ${mossproutRootRewardCopy(root)}`
    : `${root.title}. Sleeping root. ${mossproutRootConditionCopy(root)} ${mossproutRootRewardCopy(root)}`;
}

function InvalidCellFeedback({ cell, geometry }: { cell: number; geometry: MergeBoardGeometry }) {
  const progress = useSharedValue(0);
  const frame = mergeCellFrame(geometry, cell);
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
  return <Animated.View style={[styles.invalidCellFeedback, styles.invalidCellFeedbackRect, { height: frame.bounds.height, left: frame.bounds.left, top: frame.bounds.top, width: frame.bounds.width }, style]}>
    <IconSymbol color="#FFE1B4" name="leaf.fill" size={Math.max(15, geometry.cellSize * 0.38)} />
  </Animated.View>;
}

function MergeCellCallout({ feedback, geometry, reduceMotion }: {
  feedback: MergeCellFeedback;
  geometry: MergeBoardGeometry;
  reduceMotion: boolean;
}) {
  const progress = useSharedValue(0);
  const frame = mergeCellFrame(geometry, feedback.cell);
  const visualCell = geometry.cellIndices ? geometry.cellIndices.indexOf(feedback.cell) : feedback.cell;
  const row = Math.floor(visualCell / geometry.columns);
  const width = Math.max(82, Math.min(124, geometry.cellSize * 2.3));
  const boardWidth = geometry.inset * 2 + geometry.columns * geometry.cellSize + (geometry.columns - 1) * geometry.gap;
  const left = Math.max(2, Math.min(boardWidth - width - 2, frame.center.x - width / 2));
  const top = row === geometry.rows - 1 ? frame.bounds.top - 24 : frame.bounds.top + frame.bounds.height + 3;
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
  const origin = mergeSpriteOrigin(geometry, effect.cell);
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
      <Image accessibilityIgnoresInvertColors allowDownscaling cachePolicy="memory" contentFit="contain" enforceEarlyResizing recyclingKey="merge-dissipating-cloud" source={DREAM_MIST_LOWER} style={styles.lockedOverlay} transition={0} />
    </Animated.View>
    <Animated.View style={[styles.mistEchoGhost, { height: size - 4, width: size - 4 }, echoStyle]}>
      <DreamEchoItemArt definitionId={effect.definitionId} size={effect.sequenceIndex == null ? size - 4 : size - 8} />
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
  return <RectangularHoverCellOverlay geometry={geometry} hoverCell={hoverCell} />;
}

function RectangularHoverCellOverlay({ geometry, hoverCell }: { geometry: MergeBoardGeometry; hoverCell: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const index = hoverCell.value;
    if (index < 0) return { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }, { scaleX: 1 }] };
    const visualIndex = geometry.cellIndices ? geometry.cellIndices.indexOf(index) : index;
    const row = Math.floor(visualIndex / geometry.columns);
    const pitchY = (geometry.cellHeight ?? geometry.cellSize) + geometry.gap;
    const center = mergeCellCenterWorklet(index, geometry.cellSize, geometry.cellHeight ?? geometry.cellSize, geometry.gap, geometry.inset, geometry.columns, geometry.rows, geometry.cellIndices, geometry.projection?.topWidthRatio ?? 1);
    const logicalCenterY = row * pitchY + (geometry.cellHeight ?? geometry.cellSize) / 2;
    const gridHeight = geometry.rows * (geometry.cellHeight ?? geometry.cellSize) + Math.max(0, geometry.rows - 1) * geometry.gap;
    const depth = Math.max(0, Math.min(1, logicalCenterY / Math.max(1, gridHeight)));
    const widthScale = (geometry.projection?.topWidthRatio ?? 1) + (1 - (geometry.projection?.topWidthRatio ?? 1)) * depth;
    return {
      opacity: 1,
      transform: [
        { translateX: center.x - geometry.cellSize / 2 },
        { translateY: geometry.inset + row * pitchY },
        { scaleX: widthScale },
      ],
    };
  }, [geometry.cellHeight, geometry.cellIndices, geometry.cellSize, geometry.columns, geometry.gap, geometry.inset, geometry.projection?.topWidthRatio, geometry.rows]);
  return <Animated.View pointerEvents="none" style={[styles.hoverCell, { height: geometry.cellHeight ?? geometry.cellSize, width: geometry.cellSize }, style]} />;
}

function MergeMatchHint({ active, children, offsetX, offsetY }: { active: boolean; children: ReactNode; offsetX: number; offsetY: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(progress);
    progress.value = active
      ? withRepeat(withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        ), -1, false)
      : withTiming(0, { duration: 160, easing: Easing.out(Easing.quad) });
    return () => cancelAnimation(progress);
  }, [active, progress]);
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: offsetX * progress.value },
      { translateY: offsetY * progress.value },
      { scale: 1 + progress.value * 0.055 },
    ],
  }), [offsetX, offsetY]);
  return <Animated.View style={[styles.matchHint, style]}>{children}</Animated.View>;
}

const PersistentSprite = memo(function PersistentSprite({ instanceId, baseX, baseY, cellSize, activeDragId, dragEpoch, dragPhase, dragTranslationX, dragTranslationY, entranceDelay, generatorLevel, grabX, grabY, matchHint, motion, artCache, mossproutOnboarding, projection, projectionGridHeight, projectionInset, reduceMotion, onComplete, occupant }: {
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
  generatorLevel: number;
  grabX: SharedValue<number>;
  grabY: SharedValue<number>;
  matchHint: { x: number; y: number } | null;
  motion?: SpriteMotion;
  artCache: MergeArtCache;
  mossproutOnboarding: boolean;
  projection?: MergeBoardProjection;
  projectionGridHeight: number;
  projectionInset: number;
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
  const matchHintProgress = useSharedValue(0);
  const entranceReduceMotion = useRef(reduceMotion).current;
  const matchHintActive = matchHint != null && !motion;
  const matchHintOffsetX = matchHint?.x ?? 0;
  const matchHintOffsetY = matchHint?.y ?? 0;
  const artBaseSize = occupant.kind === 'generator' ? cellSize : cellSize - 4;

  useEffect(() => {
    if (entranceDelay == null) return;
    entranceProgress.value = 0;
    entranceProgress.value = entranceReduceMotion
      ? withTiming(1, { duration: 90, easing: Easing.out(Easing.cubic) })
      : withDelay(entranceDelay, withSpring(1, { damping: 13, mass: 0.58, stiffness: 240 }));
    return () => cancelAnimation(entranceProgress);
  }, [entranceDelay, entranceProgress, entranceReduceMotion]);

  useEffect(() => {
    cancelAnimation(matchHintProgress);
    matchHintProgress.value = matchHintActive
      ? withRepeat(withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        ), -1, false)
      : withTiming(0, { duration: 160, easing: Easing.out(Easing.quad) });
    return () => cancelAnimation(matchHintProgress);
  }, [matchHintActive, matchHintProgress]);

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
    cancelAnimation(matchHintProgress);
    cancelAnimation(progress);
    cancelAnimation(scale);
    cancelAnimation(spriteOpacity);
    cancelAnimation(x);
    cancelAnimation(y);
  }, [entranceProgress, matchHintProgress, progress, scale, spriteOpacity, x, y]);

  // Resize the native image view for scale animation instead of transforming
  // a cell-sized compositor texture. The resting image remains true 1x.
  const visualScale = useDerivedValue(() => {
    const p = progress.value;
    const moving = animating.value === 1;
    const motionKind = activeMotionKind.value;
    const spawnFrame = moving && motionKind === 'spawn' ? spawnSpriteMotionFrame(p, reduceMotion) : null;
    const mergeFrame = moving && motionKind?.startsWith('merge-')
      ? mergeSpriteMotionFrame(motionKind, p, reduceMotion)
      : null;
    const intro = Math.max(0, Math.min(1, entranceProgress.value));
    const motionScale = spawnFrame?.scale ?? mergeFrame?.scale ?? scale.value;
    let depth = 1;
    if (projection) {
      const travel = spawnFrame?.travel ?? p;
      // Keep finger-drag scale at its source depth. Reading the global drag Y
      // here subscribed every sprite's scale mapper to every pointer frame,
      // including all sprites on the flat dedicated board.
      const worldY = moving ? y.value + (targetY.value - y.value) * travel : y.value;
      depth = projection.farScale + (1 - projection.farScale) * Math.max(0, Math.min(1, (worldY + cellSize / 2 - projectionInset) / Math.max(1, projectionGridHeight)));
    }
    return motionScale
      * depth
      * interpolate(intro, [0, 0.68, 1], [0.72, 1.08, 1])
      * (1 + matchHintProgress.value * 0.055);
  }, [cellSize, projection, projectionGridHeight, projectionInset, reduceMotion]);

  const artLayoutStyle = useAnimatedStyle(() => {
    const renderedSize = artBaseSize * visualScale.value;
    return {
      height: renderedSize,
      left: (cellSize - renderedSize) / 2,
      top: (cellSize - renderedSize) / 2,
      width: renderedSize,
    };
  }, [artBaseSize, cellSize]);

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
    const hintProgress = matchHintProgress.value;
    return {
      opacity: opacity * intro,
      // The original dedicated board stays in one flat compositor layer. Only
      // Haven's projected board needs per-row depth ordering at rest.
      zIndex: dragging || moving || visualScale.value > (projection ? 1.05 : 1.001) || hintProgress > 0.001
        ? 1000
        : projection ? Math.round(20 + worldY) : 10,
      transform: [
        { translateX: worldX + matchHintOffsetX * hintProgress },
        { translateY: worldY + matchHintOffsetY * hintProgress + (spawnFrame ? arcHeight.value * spawnFrame.arc + cellSize * spawnFrame.settleY : 0) },
        { translateY: (1 - intro) * 8 },
      ],
    };
  }, [activeDragId, activeMotionKind, animating, arcHeight, cellSize, dragPhase, dragTranslationX, dragTranslationY, entranceProgress, grabX, grabY, instanceId, matchHintOffsetX, matchHintOffsetY, matchHintProgress, projection, reduceMotion, spriteOpacity, targetX, targetY, visualScale]);

  return <Animated.View pointerEvents="none" style={[styles.sprite, { height: cellSize, left: 0, top: 0, width: cellSize }, animatedStyle]}>
    <Animated.View pointerEvents="none" style={[styles.spriteArtSurface, artLayoutStyle]}>
      {occupant.kind === 'generator'
        ? <PersistentGeneratorArt artCache={artCache} fill generatorId={occupant.generatorId} level={generatorLevel} mossproutOnboarding={mossproutOnboarding} size={artBaseSize} />
        : <PersistentMergeItemArt artCache={artCache} definitionId={occupant.definitionId} fill size={artBaseSize} />}
    </Animated.View>
  </Animated.View>;
});

function PersistentGeneratorArt({ artCache, fill = false, generatorId, level, mossproutOnboarding, size }: { artCache: MergeArtCache; fill?: boolean; generatorId: string; level: number; mossproutOnboarding: boolean; size: number }) {
  const art = mergeWorldGeneratorArt(generatorId, { mossproutOnboarding, level });
  const usesProgressionArt = (generatorId === 'wild-garden' && level > 1) || generatorId === 'memory-nursery';
  const source = usesProgressionArt ? art : artCache.get(mergeGeneratorArtCacheKey(generatorId, mossproutOnboarding)) ?? art;
  return <View style={[styles.generatorSprite, fill ? StyleSheet.absoluteFillObject : { height: size, width: size }]}>
    <GeneratorSparkles size={size} />
    {source ? <Image accessibilityIgnoresInvertColors allowDownscaling={false} cachePolicy="memory" contentFit="contain" recyclingKey={`merge-generator-${generatorId}`} source={source} style={styles.generatorArt} transition={0} /> : null}
    <View style={styles.generatorBolt}>
      <IconSymbol color="#FFD45F" name="bolt.fill" size={13} />
    </View>
  </View>;
}

function SelectedCellCorners({ cell, dragPhase, geometry, reduceMotion, staticFrame }: { cell: number; dragPhase: SharedValue<number>; geometry: MergeBoardGeometry; reduceMotion: boolean; staticFrame: boolean }) {
  const pulse = useSharedValue(0);
  const visibility = useSharedValue(dragPhase.value === 1 ? 0 : 1);
  const dropScale = useSharedValue(1);
  const frame = mergeCellFrame(geometry, cell);
  useEffect(() => {
    pulse.value = reduceMotion || staticFrame
      ? 0
      : withRepeat(withSequence(
          withTiming(1, { duration: 720, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 720, easing: Easing.inOut(Easing.quad) }),
        ), -1, false);
    return () => cancelAnimation(pulse);
  }, [pulse, reduceMotion, staticFrame]);
  useAnimatedReaction(
    () => dragPhase.value,
    (phase, previousPhase) => {
      if (staticFrame) {
        cancelAnimation(visibility);
        cancelAnimation(dropScale);
        visibility.value = 1;
        dropScale.value = 1;
        return;
      }
      if (phase === 1) {
        cancelAnimation(visibility);
        cancelAnimation(dropScale);
        visibility.value = withTiming(0, { duration: reduceMotion ? 1 : 80, easing: Easing.out(Easing.quad) });
        dropScale.value = reduceMotion ? 1 : 0.82;
      } else if (previousPhase === 1) {
        visibility.value = withTiming(1, { duration: reduceMotion ? 1 : 100, easing: Easing.out(Easing.cubic) });
        dropScale.value = reduceMotion
          ? 1
          : withSequence(
              withTiming(1.12, { duration: 130, easing: Easing.out(Easing.cubic) }),
              withSpring(1, { damping: 10, mass: 0.48, stiffness: 250 }),
            );
      }
    },
    [reduceMotion, staticFrame],
  );
  useEffect(() => () => {
    cancelAnimation(visibility);
    cancelAnimation(dropScale);
  }, [dropScale, visibility]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: staticFrame ? 1 : visibility.value * interpolate(pulse.value, [0, 1], [0.96, 1]),
    transform: [{ scale: staticFrame ? 1 : dropScale.value * interpolate(pulse.value, [0, 1], [1, 1.045]) }],
  }));
  const cornerSize = Math.max(14, geometry.cellSize * 0.29);
  const arm = Math.max(4, geometry.cellSize * 0.075);
  const cornerRadius = Math.max(6, arm * 1.65);
  const outset = Math.max(1.5, geometry.cellSize * 0.04);
  return <Animated.View
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
    pointerEvents="none"
    style={[
      styles.selectedCorners,
      { height: frame.bounds.height + outset * 2, left: frame.bounds.left - outset, top: frame.bounds.top - outset, width: frame.bounds.width + outset * 2 },
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
      <View style={[styles.selectionCornerOutline, { borderLeftWidth: arm + 2, borderTopLeftRadius: cornerRadius + 1, borderTopWidth: arm + 2 }]} />
      <View style={[styles.selectionCornerFill, { borderLeftWidth: arm, borderTopLeftRadius: cornerRadius, borderTopWidth: arm }]} />
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

function mergeLogicalPointFromProjectedWorklet(x: number, y: number, cellSize: number, cellHeight: number, gap: number, inset: number, columns: number, rows: number, topWidthRatio: number) {
  'worklet';
  const localY = y - inset;
  if (topWidthRatio >= 0.9999) return { x: x - inset, y: localY };
  const width = columns * cellSize + Math.max(0, columns - 1) * gap;
  const height = rows * cellHeight + Math.max(0, rows - 1) * gap;
  const depth = Math.max(0, Math.min(1, localY / Math.max(1, height)));
  const widthScale = topWidthRatio + (1 - topWidthRatio) * depth;
  return { x: width / 2 + (x - inset - width / 2) / Math.max(0.001, widthScale), y: localY };
}

function mergeCellCenterWorklet(index: number, cellSize: number, cellHeight: number, gap: number, inset: number, columns: number, rows: number, cellIndices: readonly number[] | undefined, topWidthRatio: number) {
  'worklet';
  const visualCell = cellIndices ? cellIndices.indexOf(index) : index;
  const column = visualCell % columns;
  const row = Math.floor(visualCell / columns);
  const logicalX = column * (cellSize + gap) + cellSize / 2;
  const logicalY = row * (cellHeight + gap) + cellHeight / 2;
  if (topWidthRatio >= 0.9999) return { x: inset + logicalX, y: inset + logicalY };
  const width = columns * cellSize + Math.max(0, columns - 1) * gap;
  const height = rows * cellHeight + Math.max(0, rows - 1) * gap;
  const depth = Math.max(0, Math.min(1, logicalY / Math.max(1, height)));
  const widthScale = topWidthRatio + (1 - topWidthRatio) * depth;
  return { x: inset + width / 2 + (logicalX - width / 2) * widthScale, y: inset + logicalY };
}

function mergeCellFromPointWorklet(x: number, y: number, cellSize: number, cellHeight: number, gap: number, inset: number, columns: number, rows: number, cellIndices: readonly number[] | undefined, topWidthRatio: number) {
  'worklet';
  const pitchX = cellSize + gap;
  const pitchY = cellHeight + gap;
  const logical = mergeLogicalPointFromProjectedWorklet(x, y, cellSize, cellHeight, gap, inset, columns, rows, topWidthRatio);
  const column = Math.round((logical.x - cellSize / 2) / pitchX);
  const row = Math.round((logical.y - cellHeight / 2) / pitchY);
  if (column < 0 || column >= columns || row < 0 || row >= rows) return -1;
  const logicalCenterX = column * pitchX + cellSize / 2;
  const logicalCenterY = row * pitchY + cellHeight / 2;
  if (Math.abs(logical.x - logicalCenterX) > cellSize / 2 + gap / 2 || Math.abs(logical.y - logicalCenterY) > cellHeight / 2 + gap / 2) return -1;
  const visualCell = row * columns + column;
  return cellIndices?.[visualCell] ?? visualCell;
}

export function PersistentMergeItemArt({ artCache, desaturateOpacity = 0, definitionId, fill = false, size }: { artCache?: MergeArtCache; desaturateOpacity?: number; definitionId: string; fill?: boolean; size: number }) {
  const definition = MERGE_ITEMS_BY_ID.get(definitionId);
  if (!definition) return null;
  const authoredArt = mergeWorldItemArt(definitionId);
  const source = artCache?.get(mergeItemArtCacheKey(definitionId)) ?? authoredArt;
  if (source) return <View style={[styles.familyArt, fill ? StyleSheet.absoluteFillObject : { height: size, width: size }]}>
    <Image accessibilityIgnoresInvertColors allowDownscaling={false} cachePolicy="memory" contentFit="contain" recyclingKey={definitionId} source={source} style={StyleSheet.absoluteFillObject} transition={0} />
    {desaturateOpacity > 0 ? <Image accessibilityIgnoresInvertColors allowDownscaling={false} cachePolicy="memory" contentFit="contain" recyclingKey={`${definitionId}-dream-desaturate`} source={source} style={[StyleSheet.absoluteFillObject, { opacity: desaturateOpacity }]} tintColor="#A3A2AA" transition={0} /> : null}
  </View>;
  const desaturated = desaturateOpacity > 0;
  return <View style={[styles.familyArt, fill ? StyleSheet.absoluteFillObject : { height: size, width: size }]}><View style={[styles.familyDisc, { backgroundColor: desaturated ? '#A3A2AA' : definition.color }]}><IconSymbol color={desaturated ? '#56555D' : '#4A291B'} name={definition.icon} size={Math.max(17, size * 0.48)} /></View></View>;
}

function DreamEchoItemArt({ definitionId, size }: { definitionId: string; size: number }) {
  const definition = MERGE_ITEMS_BY_ID.get(definitionId);
  if (!definition) return null;
  // Keep Dream Echoes on the same Expo Image decode/cache path as ordinary
  // merge sprites. A newly unlocked generator can put the same cold WebP into
  // its spawned sprite, merge result, and dissolving Echo in one frame. Having
  // Skia decode that source while Expo Image mounted the other two could crash
  // the native renderer after the reducer had already persisted the merge.
  return <View style={[styles.dreamEchoArt, { height: size, width: size }]}>
    <PersistentMergeItemArt desaturateOpacity={0.26} definitionId={definitionId} size={size} />
  </View>;
}

const styles = StyleSheet.create({
  boardFrame: { alignSelf: 'center', overflow: 'visible', position: 'relative' },
  board: { alignSelf: 'center', backgroundColor: '#4D582B', borderCurve: 'continuous', borderRadius: 9, borderWidth: 0, boxShadow: '0 13px 24px rgba(39,31,16,0.38), 0 3px 5px rgba(39,31,16,0.22), inset 0 3px 2px rgba(255,242,193,0.24), inset 0 -4px 5px rgba(29,38,16,0.34)', overflow: 'visible', position: 'relative' },
  boardTransparentSurface: { backgroundColor: 'transparent', boxShadow: '0 0 0 rgba(0,0,0,0)' },
  boardGradient: { ...StyleSheet.absoluteFillObject, borderRadius: 9 },
  boardAnimating: { zIndex: 30 },
  cell: { alignItems: 'center', justifyContent: 'center', overflow: 'visible', position: 'absolute' },
  cellPressable: { alignItems: 'center', height: '100%', justifyContent: 'center', width: '100%' },
  cellStateOverlay: { ...StyleSheet.absoluteFillObject, borderCurve: 'continuous', borderRadius: 4, borderWidth: 1.5, zIndex: 1 },
  cellStateInvalid: { backgroundColor: 'rgba(217,94,75,0.2)', borderColor: '#D95E4B' },
  lockedOverlay: { ...StyleSheet.absoluteFillObject, height: '100%', width: '100%' },
  fullMistOverlay: { zIndex: 1 },
  lowerMistOverlay: { zIndex: 4 },
  discoveryClue: { alignItems: 'center', backgroundColor: 'transparent', borderColor: 'rgba(244,215,149,0.72)', borderRadius: 999, borderWidth: 1, height: '76%', justifyContent: 'center', position: 'absolute', width: '76%', zIndex: 3 },
  echoItem: { alignItems: 'center', justifyContent: 'center', opacity: 1, position: 'absolute', zIndex: 2 },
  rootRewardReady: { filter: 'brightness(1.12)', opacity: 1 },
  mistCategoryArt: { alignItems: 'center', justifyContent: 'center', opacity: 0.82, position: 'absolute', zIndex: 2 },
  hoverCell: { backgroundColor: 'rgba(244,204,110,0.34)', borderColor: '#E1A644', borderCurve: 'continuous', borderRadius: 4, borderWidth: 2, left: 0, position: 'absolute', top: 0, zIndex: 20 },
  feedbackLayer: { zIndex: 2000 },
  invalidCellFeedback: { alignItems: 'center', justifyContent: 'center', position: 'absolute', zIndex: 1450 },
  invalidCellFeedbackRect: { backgroundColor: 'rgba(205,76,56,0.38)', borderColor: '#F38A72', borderCurve: 'continuous', borderRadius: 4, borderWidth: 2, boxShadow: '0 0 12px rgba(225,91,67,0.42)' },
  cellCallout: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 8, borderWidth: 1, justifyContent: 'center', minHeight: 21, paddingHorizontal: 7, position: 'absolute', zIndex: 1700 },
  cellCalloutBlocked: { backgroundColor: 'rgba(63,54,81,0.94)', borderColor: 'rgba(214,203,242,0.72)' },
  cellCalloutWarning: { backgroundColor: 'rgba(133,61,48,0.95)', borderColor: 'rgba(255,190,132,0.82)' },
  cellCalloutHint: { backgroundColor: 'rgba(42,91,102,0.95)', borderColor: 'rgba(176,240,242,0.78)' },
  cellCalloutText: { fontSize: 9.5, fontWeight: '900', letterSpacing: 0.75, lineHeight: 12, textAlign: 'center' },
  mistDissipation: { alignItems: 'center', justifyContent: 'center', overflow: 'visible', position: 'absolute', zIndex: 1500 },
  mistEchoGhost: { alignItems: 'center', justifyContent: 'center', position: 'absolute', zIndex: 2 },
  mistParticle: { borderRadius: 999, boxShadow: '0 0 7px rgba(211,239,255,0.7)', position: 'absolute', zIndex: 3 },
  sprite: { alignItems: 'center', justifyContent: 'center', position: 'absolute' },
  spriteArtSurface: { position: 'absolute' },
  matchHint: { alignItems: 'center', justifyContent: 'center' },
  selectedCorners: { position: 'absolute', zIndex: 1300 },
  selectionCorner: { position: 'absolute' },
  selectionCornerOutline: { ...StyleSheet.absoluteFillObject, borderColor: '#075B69', borderCurve: 'continuous' },
  selectionCornerFill: { borderColor: '#18D5E6', borderCurve: 'continuous', bottom: 1, left: 1, position: 'absolute', right: 1, top: 1 },
  selectionCornerTopLeft: { left: 0, top: 0 },
  selectionCornerTopRight: { right: 0, top: 0, transform: [{ rotate: '90deg' }] },
  selectionCornerBottomLeft: { bottom: 0, left: 0, transform: [{ rotate: '-90deg' }] },
  selectionCornerBottomRight: { bottom: 0, right: 0, transform: [{ rotate: '180deg' }] },
  familyArt: { alignItems: 'center', justifyContent: 'center' },
  familyDisc: { alignItems: 'center', borderColor: 'rgba(255,244,213,0.65)', borderRadius: 16, borderWidth: 2, boxShadow: '0 3px 8px rgba(38,19,11,0.32)', height: '76%', justifyContent: 'center', width: '76%' },
  dreamEchoArt: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  generatorArt: { height: '92%', width: '92%' },
  generatorSprite: { alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  generatorSparkles: { left: '6%', overflow: 'visible', position: 'absolute', top: '-28%', zIndex: 4 },
  generatorSparkle: { alignItems: 'center', justifyContent: 'center', left: 0, position: 'absolute', top: '42%' },
  generatorBolt: { alignItems: 'center', backgroundColor: '#68517A', borderColor: '#E2C9E7', borderRadius: 999, borderWidth: 1, bottom: 1, boxShadow: '0 2px 5px rgba(48,30,49,0.28)', height: 20, justifyContent: 'center', position: 'absolute', right: 1, width: 20 },
});
