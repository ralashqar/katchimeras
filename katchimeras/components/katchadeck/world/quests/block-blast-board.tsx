import { Canvas, Group, LinearGradient as SkiaGradient, RoundedRect, vec } from '@shopify/react-native-skia';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import {
  BLOCK_BLAST_BOARD_SIZE,
  blockBlastClearCascadePhase,
  canPlaceBlockBlastPiece,
  nearestSnappedBlockBlastOrigin,
  projectedBlockBlastLines,
  type BlockBlastCell,
  type BlockBlastColorId,
  type BlockBlastPiece,
  type BlockBlastResolution,
  type BlockBlastState,
} from '@/utils/quests/experiences/block-blast';

export const BLOCK_PARTY_COLORS: Record<BlockBlastColorId, { bright: string; mid: string; deep: string; label: string }> = {
  rose: { bright: '#FFB4D2', mid: '#F273AA', deep: '#A93B74', label: 'rose' },
  amber: { bright: '#FFE39A', mid: '#F4B855', deep: '#B46828', label: 'amber' },
  teal: { bright: '#9AE9DA', mid: '#52C6B6', deep: '#267B77', label: 'teal' },
  coral: { bright: '#FFB19D', mid: '#EF796B', deep: '#A84149', label: 'coral' },
  blue: { bright: '#A9C8FF', mid: '#719BE8', deep: '#3D579E', label: 'blue' },
};

export type BoardMetrics = {
  size: number;
  outer: number;
  gap: number;
  cell: number;
  pitch: number;
};

export type WindowFrame = { x: number; y: number; width: number; height: number };

const CONTROLLED_EASE = Easing.bezier(0.22, 1, 0.36, 1);
const DRAG_DELTA_GAIN = 1.42;

export function blockBlastBoardMetrics(size: number): BoardMetrics {
  const outer = 10;
  const gap = 3;
  const cell = Math.floor((size - outer * 2 - gap * (BLOCK_BLAST_BOARD_SIZE - 1)) / BLOCK_BLAST_BOARD_SIZE);
  return { size, outer, gap, cell, pitch: cell + gap };
}

export const BlockBlastBoard = memo(function BlockBlastBoard({
  state,
  size,
  selectedPiece,
  hover,
  reduceMotion,
  onCellPress,
}: {
  state: BlockBlastState;
  size: number;
  selectedPiece: BlockBlastPiece | null;
  hover: BlockBlastCell | null;
  reduceMotion: boolean;
  onCellPress: (row: number, column: number) => void;
}) {
  const metrics = blockBlastBoardMetrics(size);
  const validHover = Boolean(selectedPiece && hover && canPlaceBlockBlastPiece(state.board, selectedPiece.cells, hover.row, hover.column));
  const previewPalette = selectedPiece ? BLOCK_PARTY_COLORS[selectedPiece.colorId] : null;
  const preview = useMemo(() => new Set(validHover && selectedPiece && hover
    ? selectedPiece.cells.map((part) => `${hover.row + part.row},${hover.column + part.column}`)
    : []), [hover, selectedPiece, validHover]);
  const linePreview = useMemo(() => {
    if (!validHover || !selectedPiece || !hover) return [];
    const lines = projectedBlockBlastLines(state.board, selectedPiece.cells, hover.row, hover.column);
    const phases = new Map<number, number>();
    for (const row of lines.rows) {
      for (let column = 0; column < BLOCK_BLAST_BOARD_SIZE; column += 1) phases.set(row * BLOCK_BLAST_BOARD_SIZE + column, column);
    }
    for (const column of lines.columns) {
      for (let row = 0; row < BLOCK_BLAST_BOARD_SIZE; row += 1) {
        const index = row * BLOCK_BLAST_BOARD_SIZE + column;
        phases.set(index, Math.min(phases.get(index) ?? row, row));
      }
    }
    return [...phases].map(([index, phase]) => ({ index, phase }));
  }, [hover, selectedPiece, state.board, validHover]);
  const validOrigins = useMemo(() => {
    const origins = new Set<string>();
    if (selectedPiece) {
      for (let row = 0; row < BLOCK_BLAST_BOARD_SIZE; row += 1) {
        for (let column = 0; column < BLOCK_BLAST_BOARD_SIZE; column += 1) {
          if (canPlaceBlockBlastPiece(state.board, selectedPiece.cells, row, column)) origins.add(`${row},${column}`);
        }
      }
    }
    return origins;
  }, [selectedPiece, state.board]);
  const arrivalCells = useMemo(() => {
    if (!state.lastResolution) return [];
    const cleared = new Set(state.lastResolution.clearedIndices);
    return state.lastResolution.placedIndices.flatMap((index) => {
      const colorId = state.board[index];
      return colorId && !cleared.has(index) ? [{ colorId, index }] : [];
    });
  }, [state.board, state.lastResolution]);

  return (
    <Animated.View
      entering={reduceMotion ? ZoomIn.duration(80) : ZoomIn.duration(280).easing(CONTROLLED_EASE)}
      style={[styles.board, { height: size, width: size }]}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        <RoundedRect x={1} y={1} width={size - 2} height={size - 2} r={24}>
          <SkiaGradient start={vec(0, 0)} end={vec(size, size)} colors={['#2B2948', '#17162B', '#0D0C19']} />
        </RoundedRect>
        <RoundedRect x={metrics.outer - 5} y={metrics.outer - 5} width={metrics.pitch * 8 - metrics.gap + 10} height={metrics.pitch * 8 - metrics.gap + 10} r={15} color="#090A15" />
        {state.board.map((colorId, index) => {
          const row = Math.floor(index / 8);
          const column = index % 8;
          const x = metrics.outer + column * metrics.pitch;
          const y = metrics.outer + row * metrics.pitch;
          const palette = colorId ? BLOCK_PARTY_COLORS[colorId] : null;
          const projected = preview.has(`${row},${column}`);
          return (
            <Group key={`board-${index}`}>
              <RoundedRect x={x} y={y} width={metrics.cell} height={metrics.cell} r={Math.max(5, metrics.cell * 0.17)} color="#191B32" />
              <RoundedRect x={x + 2} y={y + 2} width={metrics.cell - 4} height={metrics.cell * 0.38} r={Math.max(3, metrics.cell * 0.12)} color="#252849" />
              {palette ? (
                <Group>
                  <RoundedRect x={x} y={y} width={metrics.cell} height={metrics.cell} r={Math.max(5, metrics.cell * 0.17)} color={palette.deep} />
                  <RoundedRect x={x + 2} y={y + 2} width={metrics.cell - 4} height={metrics.cell - 5} r={Math.max(4, metrics.cell * 0.14)}>
                    <SkiaGradient start={vec(x, y)} end={vec(x, y + metrics.cell)} colors={[palette.bright, palette.mid, palette.deep]} positions={[0, 0.5, 1]} />
                  </RoundedRect>
                  <RoundedRect x={x + metrics.cell * 0.14} y={y + metrics.cell * 0.12} width={metrics.cell * 0.72} height={metrics.cell * 0.3} r={metrics.cell * 0.12} color="#FFFFFF" opacity={0.17} />
                </Group>
              ) : null}
              {projected && previewPalette ? (
                <Group opacity={0.4}>
                  <RoundedRect x={x} y={y} width={metrics.cell} height={metrics.cell} r={Math.max(5, metrics.cell * 0.17)} color={previewPalette.deep} />
                  <RoundedRect x={x + 2} y={y + 2} width={metrics.cell - 4} height={metrics.cell - 5} r={Math.max(4, metrics.cell * 0.14)}>
                    <SkiaGradient start={vec(x, y)} end={vec(x, y + metrics.cell)} colors={[previewPalette.bright, previewPalette.mid, previewPalette.deep]} positions={[0, 0.52, 1]} />
                  </RoundedRect>
                  <RoundedRect x={x + metrics.cell * 0.14} y={y + metrics.cell * 0.12} width={metrics.cell * 0.72} height={metrics.cell * 0.3} r={metrics.cell * 0.12} color="#FFFFFF" opacity={0.17} />
                </Group>
              ) : null}
            </Group>
          );
        })}
      </Canvas>
      {arrivalCells.length ? <PlacementArrival key={`arrival-${state.lastResolution?.id}`} cells={arrivalCells} metrics={metrics} reduceMotion={reduceMotion} /> : null}
      {linePreview.length ? <LineClearPreview cells={linePreview} metrics={metrics} reduceMotion={reduceMotion} /> : null}
      {Array.from({ length: 64 }, (_, index) => {
        const row = Math.floor(index / 8);
        const column = index % 8;
        const valid = validOrigins.has(`${row},${column}`);
        return (
          <Pressable
            key={`hit-${index}`}
            accessible={valid}
            accessibilityRole="button"
            accessibilityLabel={`Board row ${row + 1}, column ${column + 1}${valid ? ', valid placement' : ''}`}
            accessibilityState={{ disabled: !valid }}
            disabled={!valid}
            onPress={() => onCellPress(row, column)}
            style={{ position: 'absolute', left: metrics.outer + column * metrics.pitch, top: metrics.outer + row * metrics.pitch, width: metrics.cell, height: metrics.cell }}
          />
        );
      })}
      {state.lastResolution?.clearedCells.length ? (
        <ClearBurst key={state.lastResolution.id} resolution={state.lastResolution} metrics={metrics} reduceMotion={reduceMotion} />
      ) : null}
    </Animated.View>
  );
});

function PlacementArrival({ cells, metrics, reduceMotion }: { cells: readonly { colorId: BlockBlastColorId; index: number }[]; metrics: BoardMetrics; reduceMotion: boolean }) {
  if (reduceMotion) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {cells.map((cell, order) => <PlacementArrivalCell key={`arrival-cell-${cell.index}`} {...cell} metrics={metrics} order={order} />)}
    </View>
  );
}

function PlacementArrivalCell({ colorId, index, metrics, order }: { colorId: BlockBlastColorId; index: number; metrics: BoardMetrics; order: number }) {
  const progress = useSharedValue(0);
  const palette = BLOCK_PARTY_COLORS[colorId];
  useEffect(() => {
    progress.value = withDelay(order * 45, withTiming(1, { duration: 280, easing: Easing.inOut(Easing.cubic) }));
    return () => cancelAnimation(progress);
  }, [order, progress]);
  const cellStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 0.48, 1], [1, 1.055, 1]) }],
  }));
  const row = Math.floor(index / BLOCK_BLAST_BOARD_SIZE);
  const column = index % BLOCK_BLAST_BOARD_SIZE;
  const radius = Math.max(5, metrics.cell * 0.17);
  return (
    <View style={{ height: metrics.cell, left: metrics.outer + column * metrics.pitch, position: 'absolute', top: metrics.outer + row * metrics.pitch, width: metrics.cell }}>
      <Animated.View style={[styles.arrivalCell, { backgroundColor: palette.deep, borderRadius: radius, height: metrics.cell, width: metrics.cell }, cellStyle]}>
        <LinearGradient
          colors={[palette.bright, palette.mid, palette.deep]}
          locations={[0, 0.5, 1]}
          style={{ borderRadius: Math.max(4, metrics.cell * 0.14), bottom: 3, left: 2, position: 'absolute', right: 2, top: 2 }}
        />
        <View style={[styles.arrivalShine, { borderRadius: metrics.cell * 0.12, height: metrics.cell * 0.3, left: metrics.cell * 0.14, top: metrics.cell * 0.12, width: metrics.cell * 0.72 }]} />
      </Animated.View>
    </View>
  );
}

function LineClearPreview({
  cells,
  metrics,
  reduceMotion,
}: {
  cells: readonly { index: number; phase: number }[];
  metrics: BoardMetrics;
  reduceMotion: boolean;
}) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {cells.map((cell) => <LineClearGlow key={`line-preview-${cell.index}`} {...cell} metrics={metrics} reduceMotion={reduceMotion} />)}
    </View>
  );
}

function LineClearGlow({ index, phase, metrics, reduceMotion }: { index: number; phase: number; metrics: BoardMetrics; reduceMotion: boolean }) {
  const opacity = useSharedValue(reduceMotion ? 0.28 : 0.12);
  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 0.28;
      return;
    }
    opacity.value = withDelay(phase * 42, withRepeat(withSequence(
      withTiming(0.36, { duration: 220, easing: Easing.inOut(Easing.cubic) }),
      withTiming(0.12, { duration: 260, easing: Easing.inOut(Easing.cubic) }),
    ), -1));
    return () => cancelAnimation(opacity);
  }, [opacity, phase, reduceMotion]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const row = Math.floor(index / BLOCK_BLAST_BOARD_SIZE);
  const column = index % BLOCK_BLAST_BOARD_SIZE;
  return (
    <Animated.View
      style={[
        styles.lineClearGlow,
        {
          borderRadius: Math.max(5, metrics.cell * 0.17),
          height: metrics.cell,
          left: metrics.outer + column * metrics.pitch,
          top: metrics.outer + row * metrics.pitch,
          width: metrics.cell,
        },
        animatedStyle,
      ]}
    />
  );
}

function ClearBurst({ resolution, metrics, reduceMotion }: { resolution: BlockBlastResolution; metrics: BoardMetrics; reduceMotion: boolean }) {
  if (reduceMotion) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {resolution.clearedCells.map(({ index, colorId }) => {
        const row = Math.floor(index / 8);
        const column = index % 8;
        return (
          <ClearBurstCell
            key={`clear-${resolution.id}-${index}`}
            colorId={colorId}
            column={column}
            metrics={metrics}
            phase={blockBlastClearCascadePhase(index, resolution.clearedRows, resolution.clearedColumns)}
            row={row}
          />
        );
      })}
    </View>
  );
}

function ClearBurstCell({
  colorId,
  column,
  metrics,
  phase,
  row,
}: {
  colorId: BlockBlastColorId;
  column: number;
  metrics: BoardMetrics;
  phase: number;
  row: number;
}) {
  const progress = useSharedValue(0);
  const direction = (row + column) % 2 === 0 ? 1 : -1;
  const palette = BLOCK_PARTY_COLORS[colorId];
  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(Math.min(phase * 24, 220), withTiming(1, { duration: 300, easing: Easing.bezier(0.2, 0.76, 0.28, 1) }));
    return () => cancelAnimation(progress);
  }, [phase, progress]);
  const cellStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.16, 0.58, 0.8, 1], [0.9, 1, 0.92, 0.48, 0]),
    transform: [
      { scale: interpolate(progress.value, [0, 0.22, 0.55, 0.78, 1], [1, 1.13, 1.02, 0.88, 0.5]) },
      { rotate: `${interpolate(progress.value, [0, 0.58, 1], [0, direction * 2, direction * 7])}deg` },
    ],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.18, 0.58, 1], [0, 0.72, 0.32, 0]),
    transform: [{ scale: interpolate(progress.value, [0, 0.2, 1], [0.72, 0.92, 1.72]) }],
  }));
  const particleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.42, 0.58, 1], [0, 0, 0.9, 0]),
    transform: [
      { scale: interpolate(progress.value, [0, 0.42, 0.68, 1], [0.4, 0.4, 1.1, 1.82]) },
      { rotate: `${interpolate(progress.value, [0.42, 1], [0, direction * 24])}deg` },
    ],
  }));
  const radius = Math.max(5, metrics.cell * 0.17);
  return (
    <View
      style={{
        height: metrics.cell,
        left: metrics.outer + column * metrics.pitch,
        overflow: 'visible',
        position: 'absolute',
        top: metrics.outer + row * metrics.pitch,
        width: metrics.cell,
      }}
    >
      <Animated.View style={[styles.clearRing, { borderRadius: radius, height: metrics.cell, width: metrics.cell }, ringStyle]} />
      <Animated.View style={[styles.clearCell, { borderRadius: radius, height: metrics.cell, width: metrics.cell }, cellStyle]}>
        <LinearGradient colors={[palette.bright, palette.mid, palette.deep]} locations={[0, 0.5, 1]} style={[StyleSheet.absoluteFill, { borderRadius: radius }]} />
        <View style={[styles.clearCellShine, { borderRadius: radius, width: metrics.cell * 0.7 }]} />
      </Animated.View>
      <Animated.View style={[styles.clearParticles, { height: metrics.cell, width: metrics.cell }, particleStyle]}>
        <View style={[styles.clearShard, { backgroundColor: palette.bright, left: 2, top: 3, transform: [{ rotate: '-22deg' }] }]} />
        <View style={[styles.clearShard, { backgroundColor: '#FFF4C4', right: 2, top: 5, transform: [{ rotate: '28deg' }] }]} />
        <View style={[styles.clearShard, { backgroundColor: palette.mid, bottom: 2, left: 5, transform: [{ rotate: '38deg' }] }]} />
        <View style={[styles.clearShard, { backgroundColor: palette.deep, bottom: 4, right: 4, transform: [{ rotate: '-36deg' }] }]} />
      </Animated.View>
    </View>
  );
}

export function BlockBlastPieceArt({ piece, cell, gap: gapOverride }: { piece: BlockBlastPiece; cell: number; gap?: number }) {
  const columns = Math.max(...piece.cells.map((part) => part.column)) + 1;
  const rows = Math.max(...piece.cells.map((part) => part.row)) + 1;
  const gap = gapOverride ?? Math.max(1.5, cell * 0.08);
  const palette = BLOCK_PARTY_COLORS[piece.colorId];
  return (
    <View style={{ height: rows * (cell + gap) - gap, width: columns * (cell + gap) - gap }}>
      {piece.cells.map((part, index) => (
        <LinearGradient
          key={`${piece.id}-cell-${index}`}
          colors={[palette.bright, palette.mid, palette.deep]}
          locations={[0, 0.52, 1]}
          style={{
            borderColor: `${palette.bright}90`,
            borderCurve: 'continuous',
            borderRadius: Math.max(4, cell * 0.18),
            borderWidth: 0.75,
            height: cell,
            left: part.column * (cell + gap),
            position: 'absolute',
            top: part.row * (cell + gap),
            width: cell,
          }}
        >
          <View style={{ backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: cell, height: Math.max(2, cell * 0.22), left: cell * 0.14, position: 'absolute', top: cell * 0.13, width: cell * 0.72 }} />
        </LinearGradient>
      ))}
    </View>
  );
}

export function DraggableBlockBlastPiece({
  piece,
  board,
  boardFrame,
  metrics,
  selected,
  reduceMotion,
  onPick,
  onHover,
  onValidHoverChange,
  onPlace,
  onInvalid,
}: {
  piece: BlockBlastPiece;
  board: BlockBlastState['board'];
  boardFrame: WindowFrame | null;
  metrics: BoardMetrics;
  selected: boolean;
  reduceMotion: boolean;
  onPick: () => void;
  onHover: (origin: BlockBlastCell | null) => void;
  onValidHoverChange: () => void;
  onPlace: (row: number, column: number) => boolean;
  onInvalid: () => void;
}) {
  const trayCell = Math.max(9.5, Math.min(14.5, metrics.cell * 0.38));
  const trayGap = trayCell * metrics.gap / metrics.cell;
  const columns = Math.max(...piece.cells.map((part) => part.column)) + 1;
  const rows = Math.max(...piece.cells.map((part) => part.row)) + 1;
  const pieceWidth = columns * metrics.pitch - metrics.gap;
  const pieceHeight = rows * metrics.pitch - metrics.gap;
  const fingerLift = Math.max(72, pieceHeight / 2 + 34);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const returningToTray = useSharedValue(false);
  const placedSuccessfully = useSharedValue(false);
  const grabOffsetX = useSharedValue(0);
  const grabOffsetY = useSharedValue(0);
  const hitboxWidth = useSharedValue(0);
  const hitboxHeight = useSharedValue(0);
  const lastHoverKey = useRef<string | null>(null);
  const lastValidHoverKey = useRef<string | null>(null);

  useEffect(() => {
    if (!selected) scale.value = withTiming(1, { duration: reduceMotion ? 30 : 95, easing: CONTROLLED_EASE });
  }, [reduceMotion, scale, selected]);

  const targetOrigin = (absoluteX: number, absoluteY: number, deltaX = 0, deltaY = 0): BlockBlastCell | null => {
    if (!boardFrame) return null;
    const floatingCenterX = absoluteX + deltaX * (DRAG_DELTA_GAIN - 1);
    const floatingCenterY = absoluteY + deltaY * (DRAG_DELTA_GAIN - 1) - fingerLift;
    const floatingFirstCellCenterX = floatingCenterX - pieceWidth / 2 + metrics.cell / 2;
    const floatingFirstCellCenterY = floatingCenterY - pieceHeight / 2 + metrics.cell / 2;
    const boardFirstCellCenterX = boardFrame.x + metrics.outer + metrics.cell / 2;
    const boardFirstCellCenterY = boardFrame.y + metrics.outer + metrics.cell / 2;
    const targetColumn = (floatingFirstCellCenterX - boardFirstCellCenterX) / metrics.pitch;
    const targetRow = (floatingFirstCellCenterY - boardFirstCellCenterY) / metrics.pitch;
    return nearestSnappedBlockBlastOrigin(board, piece.cells, targetRow, targetColumn);
  };
  const updateHover = (absoluteX: number, absoluteY: number, deltaX = 0, deltaY = 0) => {
    const origin = targetOrigin(absoluteX, absoluteY, deltaX, deltaY);
    const key = origin ? `${origin.row}:${origin.column}` : null;
    if (key === lastHoverKey.current) return;
    lastHoverKey.current = key;
    onHover(origin);
    const validKey = origin && canPlaceBlockBlastPiece(board, piece.cells, origin.row, origin.column) ? key : null;
    if (validKey !== lastValidHoverKey.current) {
      lastValidHoverKey.current = validKey;
      if (validKey) onValidHoverChange();
    }
  };
  const clearHover = () => {
    lastHoverKey.current = null;
    lastValidHoverKey.current = null;
    onHover(null);
  };
  const returnToTray = () => {
    if (placedSuccessfully.value || returningToTray.value) return;
    returningToTray.value = true;
    const settleDuration = reduceMotion ? 30 : 110;
    translateX.value = withTiming(0, { duration: settleDuration, easing: CONTROLLED_EASE });
    translateY.value = withTiming(0, { duration: settleDuration, easing: CONTROLLED_EASE });
    scale.value = withTiming(1, { duration: reduceMotion ? 30 : 90, easing: CONTROLLED_EASE });
    opacity.value = withTiming(1, { duration: reduceMotion ? 30 : 70, easing: CONTROLLED_EASE });
  };
  const finishDrag = (absoluteX: number, absoluteY: number, deltaX: number, deltaY: number) => {
    if (placedSuccessfully.value) return;
    const origin = targetOrigin(absoluteX, absoluteY, deltaX, deltaY);
    if (origin && canPlaceBlockBlastPiece(board, piece.cells, origin.row, origin.column)) {
      placedSuccessfully.value = true;
      returningToTray.value = true;
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      cancelAnimation(scale);
      cancelAnimation(opacity);
      opacity.value = 0;
      clearHover();
      if (!onPlace(origin.row, origin.column)) {
        placedSuccessfully.value = false;
        returningToTray.value = false;
        returnToTray();
      }
    } else {
      returnToTray();
      onInvalid();
      clearHover();
    }
  };
  const gesture = Gesture.Pan()
    .minDistance(6)
    .runOnJS(true)
    .onBegin((event) => {
      grabOffsetX.value = event.x - hitboxWidth.value / 2;
      grabOffsetY.value = event.y - hitboxHeight.value / 2;
    })
    .onStart((event) => {
      onPick();
      lastHoverKey.current = null;
      lastValidHoverKey.current = null;
      placedSuccessfully.value = false;
      returningToTray.value = false;
      opacity.value = 1;
      translateX.value = event.translationX * DRAG_DELTA_GAIN + grabOffsetX.value;
      translateY.value = event.translationY * DRAG_DELTA_GAIN + grabOffsetY.value - fingerLift;
      scale.value = withTiming(metrics.cell / trayCell, { duration: reduceMotion ? 30 : 90, easing: CONTROLLED_EASE });
      updateHover(event.absoluteX, event.absoluteY, event.translationX, event.translationY);
    })
    .onUpdate((event) => {
      if (placedSuccessfully.value) return;
      translateX.value = event.translationX * DRAG_DELTA_GAIN + grabOffsetX.value;
      translateY.value = event.translationY * DRAG_DELTA_GAIN + grabOffsetY.value - fingerLift;
      updateHover(event.absoluteX, event.absoluteY, event.translationX, event.translationY);
    })
    .onEnd((event) => finishDrag(event.absoluteX, event.absoluteY, event.translationX, event.translationY))
    .onFinalize(() => {
      if (!placedSuccessfully.value) returnToTray();
      clearHover();
    });
  const animated = useAnimatedStyle(() => ({
    opacity: placedSuccessfully.value ? 0 : opacity.value,
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${BLOCK_PARTY_COLORS[piece.colorId].label} ${piece.cells.length} block piece`}
        accessibilityHint="Drag anywhere within this tray section onto the board, or select then tap a valid board cell"
        accessibilityState={{ selected }}
        onLayout={(event) => {
          hitboxWidth.value = event.nativeEvent.layout.width;
          hitboxHeight.value = event.nativeEvent.layout.height;
        }}
        onPress={onPick}
        style={({ pressed }) => [styles.pieceHitbox, pressed && styles.pieceHitboxPressed]}
      >
        <Animated.View pointerEvents="none" style={[styles.trayPiece, { zIndex: selected ? 40 : 1 }, animated]}>
          <BlockBlastPieceArt piece={piece} cell={trayCell} gap={trayGap} />
        </Animated.View>
      </Pressable>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  arrivalCell: { left: 0, overflow: 'hidden', position: 'absolute', top: 0 },
  arrivalShine: { backgroundColor: 'rgba(255,255,255,0.17)', position: 'absolute' },
  board: {
    borderCurve: 'continuous',
    borderRadius: 24,
    boxShadow: '0 18px 32px rgba(5,4,14,0.46)',
    overflow: 'hidden',
    position: 'relative',
  },
  lineClearGlow: {
    backgroundColor: '#FFF0A8',
    borderColor: '#FFF8DE',
    borderWidth: 1.5,
    boxShadow: '0 0 9px rgba(255, 230, 142, 0.72)',
    position: 'absolute',
  },
  pieceHitbox: { alignItems: 'center', height: '100%', justifyContent: 'center', overflow: 'visible', width: '100%' },
  pieceHitboxPressed: { opacity: 0.9 },
  clearCell: { borderColor: '#FFF8DE', borderWidth: 1, boxShadow: '0 0 10px rgba(255,238,176,0.48)', overflow: 'hidden', position: 'absolute' },
  clearCellShine: { backgroundColor: 'rgba(255,255,255,0.32)', height: 5, left: '15%', position: 'absolute', top: 4 },
  clearParticles: { left: 0, position: 'absolute', top: 0 },
  clearRing: { borderColor: 'rgba(255,244,196,0.92)', borderWidth: 1.5, left: 0, position: 'absolute', top: 0 },
  clearShard: { borderRadius: 2, height: 5, position: 'absolute', width: 7 },
  trayPiece: { alignItems: 'center', justifyContent: 'center', padding: 5 },
});
