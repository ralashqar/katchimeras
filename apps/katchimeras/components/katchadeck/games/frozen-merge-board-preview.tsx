import { Image } from 'expo-image';
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { MergeBoardLayout } from '@/components/katchadeck/games/feastle-persistent-merge-board';
import { mergeWorldGeneratorArt, mergeWorldItemArt } from '@/constants/merge-world-art';
import type { MergeWorldState } from '@/types/merge-world';
import { mergeCellFrame, type MergeBoardGeometry } from '@/utils/merge-world/board-geometry';

const DREAM_MIST_FULL = require('@incubator/art-merge-world/locked/dream-mist-full.webp');
const DREAM_MIST_LOWER = require('@incubator/art-merge-world/locked/dream-mist-lower.webp');

type FrozenMergeBoardPreviewProps = {
  layout: MergeBoardLayout;
  maxHeight: number;
  state: MergeWorldState;
  width: number;
};

export const FrozenMergeBoardPreview = memo(function FrozenMergeBoardPreview({
  layout,
  maxHeight,
  state,
  width,
}: FrozenMergeBoardPreviewProps) {
  const gap = 0;
  const padding = layout.contentInset ?? (width < 380 ? 5 : 6);
  const inset = padding;
  const ratio = layout.cellHeightToWidthRatio ?? 1;
  const widthCellSize = (width - inset * 2) / layout.columns;
  const availableCellHeight = (maxHeight - inset * 2) / layout.rows;
  const cellSize = Math.max(24, layout.fillAvailableSpace
    ? widthCellSize
    : Math.floor(Math.min(widthCellSize, availableCellHeight / ratio)));
  const cellHeight = Math.max(24, layout.fillAvailableSpace
    ? availableCellHeight
    : Math.floor(cellSize * ratio));
  const indices = useMemo(
    () => layout.cellIndices ?? Array.from({ length: layout.columns * layout.rows }, (_, index) => index),
    [layout.cellIndices, layout.columns, layout.rows],
  );
  const geometry = useMemo<MergeBoardGeometry>(() => ({
    cellHeight,
    cellIndices: layout.cellIndices,
    cellSize,
    columns: layout.columns,
    gap,
    inset,
    projection: layout.projection,
    rows: layout.rows,
  }), [cellHeight, cellSize, inset, layout.cellIndices, layout.columns, layout.projection, layout.rows]);
  const frames = useMemo(
    () => new Map(indices.map((cell) => [cell, mergeCellFrame(geometry, cell)])),
    [geometry, indices],
  );

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={StyleSheet.absoluteFill}>
      {indices.map((cell, visualIndex) => {
        const frame = frames.get(cell)!;
        const checkerboard = layout.checkerboardCellColor
          && (Math.floor(visualIndex / layout.columns) + visualIndex % layout.columns) % 2 === 1;
        return checkerboard ? (
          <View
            key={`frozen-cell-${cell}`}
            style={{
              backgroundColor: layout.checkerboardCellColor,
              borderRadius: Math.min(14, frame.bounds.width * 0.18),
              height: frame.bounds.height * 0.92,
              left: frame.center.x - frame.bounds.width * 0.46,
              position: 'absolute',
              top: frame.center.y - frame.bounds.height * 0.46,
              width: frame.bounds.width * 0.92,
            }}
          />
        ) : null;
      })}
      {indices.map((cell) => {
        const boardCell = state.board[cell];
        const occupant = boardCell?.occupant;
        const lockedDefinitionId = boardCell?.mist?.kind === 'echo'
          ? boardCell.mist.definitionId
          : boardCell?.mist?.kind === 'dreambound_item' ? boardCell.mist.boundDefinitionId : null;
        if (!occupant && !lockedDefinitionId) return null;
        const frame = frames.get(cell)!;
        const source = occupant
          ? occupant.kind === 'item'
            ? mergeWorldItemArt(occupant.definitionId)
            : mergeWorldGeneratorArt(occupant.generatorId, { level: state.generators[occupant.generatorId]?.level ?? 1 })
          : mergeWorldItemArt(lockedDefinitionId!);
        if (!source) return null;
        const size = Math.min(cellSize, frame.bounds.width, frame.bounds.height) * 0.94;
        return (
          <Image
            cachePolicy="memory-disk"
            contentFit="contain"
            key={occupant
              ? occupant.kind === 'item' ? occupant.instanceId : `generator:${occupant.generatorId}`
              : `mist-item:${cell}:${lockedDefinitionId}`}
            recyclingKey={occupant
              ? occupant.kind === 'item' ? occupant.definitionId : `generator:${occupant.generatorId}`
              : `mist-item:${lockedDefinitionId}`}
            source={source}
            style={{
              height: size,
              left: frame.center.x - size / 2,
              position: 'absolute',
              top: frame.center.y - size / 2,
              width: size,
            }}
          />
        );
      })}
      {indices.map((cell) => {
        const boardCell = state.board[cell];
        if (!boardCell) return null;
        const mist = boardCell.mist;
        const lowerMist = mist?.kind === 'echo'
          || mist?.kind === 'dreambound_item'
          || mist?.kind === 'rootbound_echo'
          || mist?.kind === 'resident_card';
        const fullMist = boardCell.locked && !boardCell.occupant && !lowerMist;
        if (!lowerMist && !fullMist) return null;
        const frame = frames.get(cell)!;
        return (
          <Image
            allowDownscaling
            cachePolicy="memory"
            contentFit="fill"
            key={`frozen-mist-${cell}-${lowerMist ? 'lower' : 'full'}`}
            recyclingKey={lowerMist ? 'merge-dream-mist-lower' : 'merge-dream-mist-full'}
            source={lowerMist ? DREAM_MIST_LOWER : DREAM_MIST_FULL}
            style={{
              height: frame.bounds.height,
              left: frame.bounds.left,
              position: 'absolute',
              top: frame.bounds.top,
              width: frame.bounds.width,
            }}
            transition={0}
          />
        );
      })}
    </View>
  );
}, (previous, next) => (
  previous.layout === next.layout
  && previous.maxHeight === next.maxHeight
  && previous.width === next.width
  && previous.state.board === next.state.board
  && previous.state.generators === next.state.generators
));
