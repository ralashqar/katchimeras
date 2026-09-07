/**
 * The fuse variety's visual: a chrome plate framing both halves of the split footprint.
 *
 * One rectangle spanning the bounding box of both groups, drawn as a View rather than a Skia
 * canvas — it is a single shape and decoration does not earn a canvas. The plate peeks out
 * behind the footprint cells as a frame, signalling that the two halves are one job.
 *
 * Rendered inside the field container, so it inherits the field's coordinate space and drifts
 * with it automatically. `pointerEvents="none"` throughout.
 */

import { View } from 'react-native';

import { alpha } from '../../../../ui/color';
import { palette, semantic } from '../../../../ui/tokens';
import { cellOrigin, cellRadius } from '../../view/metrics';
import { varietyData } from '../contract';
import { FUSE_VARIETY, type FuseData } from './fuse';
import type { VarietyLayerProps } from '../view-registry';

/** How far the plate extends beyond the outermost cells on each side, in points. */
const INSET = 4;

export function FuseLayer({ metrics, beat }: VarietyLayerProps) {
  const data = varietyData<FuseData>(beat, FUSE_VARIETY.id);
  if (!data) return null;

  const fuseGroups = beat.groups.filter((g) => data.groupIds.includes(g.id));
  if (fuseGroups.length < 2) return null;

  const allCells = fuseGroups.flatMap((g) => g.cells);
  const coords = allCells.map((idx) => ({
    row: Math.floor(idx / metrics.cols),
    column: idx % metrics.cols,
  }));

  const minRow = Math.min(...coords.map((c) => c.row));
  const maxRow = Math.max(...coords.map((c) => c.row));
  const minCol = Math.min(...coords.map((c) => c.column));
  const maxCol = Math.max(...coords.map((c) => c.column));

  const tl = cellOrigin(metrics, minRow, minCol);
  const br = cellOrigin(metrics, maxRow, maxCol);

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: tl.x - INSET,
        top: tl.y - INSET,
        width: br.x + metrics.cell - tl.x + INSET * 2,
        height: br.y + metrics.cell - tl.y + INSET * 2,
        borderRadius: cellRadius(metrics.cell) + INSET,
        borderWidth: 1.5,
        borderColor: alpha(palette.chromeEdge, 0.7),
        backgroundColor: alpha(semantic.boardBezelMid, 0.55),
      }}
    />
  );
}
