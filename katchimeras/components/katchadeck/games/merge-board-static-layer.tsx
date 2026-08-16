import {
  Atlas,
  BlurMask,
  Canvas,
  Group,
  RoundedRect,
  Skia,
  useImage,
  type SkRect,
  type SkRSXform,
} from '@shopify/react-native-skia';
import { memo, useLayoutEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';

import {
  MERGE_BOARD_ATLAS_ENTRIES,
  MERGE_BOARD_ATLAS_SOURCE,
  MERGE_BOARD_ATLAS_TILE_SIZE,
} from '@/constants/merge-board-atlas.generated';
import type { MergeWorldState } from '@/types/merge-world';
import { mergeCellOrigin, type MergeBoardGeometry } from '@/utils/merge-world/board-geometry';

type AtlasBatch = {
  sprites: SkRect[];
  transforms: SkRSXform[];
};

type EchoVisual = {
  compatible: boolean;
  height: number;
  width: number;
  x: number;
  y: number;
};

type MergeBoardStaticLayerProps = {
  geometry: MergeBoardGeometry;
  invalidCell: number | null;
  onReady?: () => void;
  selectedCell: number | null;
  selectedDefinitionId: string | null;
  state: MergeWorldState;
};

const atlasEntries = MERGE_BOARD_ATLAS_ENTRIES as Record<string, {
  height: number;
  width: number;
  x: number;
  y: number;
}>;

/**
 * Draws cells, locks, and Dream Echoes as a handful of GPU atlas batches.
 * The interactive and animated item layer remains native/Reanimated, so drag,
 * merge, spawn, accessibility, and FTUE behavior keep their mature semantics.
 */
export const MergeBoardStaticLayer = memo(function MergeBoardStaticLayer({
  geometry,
  invalidCell,
  onReady,
  selectedCell,
  selectedDefinitionId,
  state,
}: MergeBoardStaticLayerProps) {
  const image = useImage(MERGE_BOARD_ATLAS_SOURCE);

  useLayoutEffect(() => {
    if (image) onReady?.();
  }, [image, onReady]);

  const batches = useMemo(() => {
    const cells = emptyBatch();
    const lockedClouds = emptyBatch();
    const echoClouds = emptyBatch();
    const dormantEchoes = emptyBatch();
    const compatibleEchoes = emptyBatch();
    const echoVisuals: EchoVisual[] = [];

    state.board.forEach((cell, index) => {
      const origin = mergeCellOrigin(geometry, index);
      const occupantDefinitionId = cell.occupant?.kind === 'item'
        ? cell.occupant.definitionId
        : null;
      const echoDefinitionId = cell.mist?.kind === 'echo'
        ? cell.mist.definitionId
        : null;
      const compatible = Boolean(
        selectedDefinitionId
        && selectedCell !== index
        && (occupantDefinitionId === selectedDefinitionId || echoDefinitionId === selectedDefinitionId),
      );
      const column = index % geometry.columns;
      const row = Math.floor(index / geometry.columns);
      const cellEntryId = invalidCell === index
        ? '__cell.invalid'
        : compatible
          ? '__cell.compatible'
          : selectedCell === index
            ? '__cell.selected'
            : (column + row) % 2 === 1
              ? '__cell.alternate'
              : '__cell.normal';
      appendAtlasEntry(cells, cellEntryId, origin.x, origin.y, geometry.cellSize);

      if (cell.locked && !cell.occupant) {
        appendAtlasEntry(
          cell.mist?.kind === 'echo' ? echoClouds : lockedClouds,
          '__cloud.lock',
          origin.x,
          origin.y,
          geometry.cellSize,
        );
      }

      if (echoDefinitionId) {
        const targetSize = Math.max(1, geometry.cellSize - 4);
        const scale = compatible ? 1.06 : 1;
        const drawnSize = targetSize * scale;
        const x = origin.x + (geometry.cellSize - drawnSize) / 2;
        const y = origin.y + (geometry.cellSize - drawnSize) / 2;
        appendAtlasEntry(
          compatible ? compatibleEchoes : dormantEchoes,
          echoDefinitionId,
          x,
          y,
          drawnSize,
        );
        echoVisuals.push({ compatible, height: drawnSize, width: drawnSize, x, y });
      }
    });

    return {
      cells,
      compatibleEchoes,
      dormantEchoes,
      echoClouds,
      echoVisuals,
      lockedClouds,
    };
  }, [geometry, invalidCell, selectedCell, selectedDefinitionId, state]);

  if (!image) return null;

  return (
    <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Atlas image={image} sprites={batches.cells.sprites} transforms={batches.cells.transforms} />
      <Atlas image={image} sprites={batches.lockedClouds.sprites} transforms={batches.lockedClouds.transforms} />
      <Group opacity={0.78}>
        <Atlas image={image} sprites={batches.echoClouds.sprites} transforms={batches.echoClouds.transforms} />
      </Group>
      <Group opacity={0.5376}>
        <Atlas image={image} sprites={batches.dormantEchoes.sprites} transforms={batches.dormantEchoes.transforms} />
      </Group>
      <Group opacity={0.9}>
        <Atlas image={image} sprites={batches.compatibleEchoes.sprites} transforms={batches.compatibleEchoes.transforms} />
      </Group>
      {batches.echoVisuals.map((echo, index) => (
        <Group key={`${echo.x}:${echo.y}:${index}`}>
          {echo.compatible ? (
            <RoundedRect
              color="rgba(133, 237, 255, 0.72)"
              height={echo.height}
              r={echo.height / 2}
              style="stroke"
              strokeWidth={2}
              width={echo.width}
              x={echo.x}
              y={echo.y}>
              <BlurMask blur={6} style="solid" />
            </RoundedRect>
          ) : null}
          <RoundedRect
            color={echo.compatible ? 'rgba(183,242,249,0.14)' : 'rgba(177,190,213,0.34)'}
            height={echo.height}
            r={Math.min(16, echo.height / 2)}
            width={echo.width}
            x={echo.x}
            y={echo.y}
          />
          {echo.compatible ? (
            <RoundedRect
              color="rgba(209,252,255,0.9)"
              height={echo.height}
              r={echo.height / 2}
              style="stroke"
              strokeWidth={1.5}
              width={echo.width}
              x={echo.x}
              y={echo.y}
            />
          ) : null}
        </Group>
      ))}
    </Canvas>
  );
});

function emptyBatch(): AtlasBatch {
  return { sprites: [], transforms: [] };
}

function appendAtlasEntry(batch: AtlasBatch, entryId: string, x: number, y: number, size: number) {
  const entry = atlasEntries[entryId];
  if (!entry) return;
  const scale = size / MERGE_BOARD_ATLAS_TILE_SIZE;
  batch.sprites.push(Skia.XYWHRect(entry.x, entry.y, entry.width, entry.height));
  batch.transforms.push(Skia.RSXform(scale, 0, x, y));
}
