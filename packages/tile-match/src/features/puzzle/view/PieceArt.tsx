import { useTileColors } from '../../../ui/theme';
/**
 * A puzzle piece, drawn as gradient Views.
 *
 * Geometry and treatment are ported from the reference implementation, whose
 * proportions are already well tuned:
 *   - gap defaults to `cell * 0.08`, so pieces stay legible at tray scale
 *   - corner radius `cell * 0.18`
 *   - a hairline border in the bright tint at 90/255 alpha, which is what makes
 *     each block read as a separate object rather than a blob of colour
 *   - a shine bar at 18% white across the top ~quarter
 *
 * Views rather than Skia so the piece can be scaled and translated by
 * Reanimated on the UI thread while dragging.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { cellsExtent } from '../engine/board';
import type { BlockColorId, Cell } from '../engine/types';
import { alpha } from '../../../ui/color';
import { opacity } from '../../../ui/tokens';

export type PieceArtProps = {
  cells: readonly Cell[];
  colorId: BlockColorId;
  /** Size of one block, in points. */
  cell: number;
  gap?: number;
  style?: StyleProp<ViewStyle>;
};

export const PieceArt = memo(function PieceArt({
  cells,
  colorId,
  cell,
  gap,
  style,
}: PieceArtProps) {
  const { height, width } = cellsExtent(cells);
  const swatch = useTileColors()[colorId];
  const resolvedGap = gap ?? Math.max(1.5, cell * 0.08);
  const pitch = cell + resolvedGap;
  const radius = Math.max(4, cell * 0.18);

  return (
    <View
      style={[
        { width: width * pitch - resolvedGap, height: height * pitch - resolvedGap },
        style,
      ]}
    >
      {cells.map((position, index) => (
        <LinearGradient
          key={index}
          colors={[swatch.bright, swatch.mid, swatch.deep]}
          locations={[0, 0.52, 1]}
          style={{
            position: 'absolute',
            left: position.column * pitch,
            top: position.row * pitch,
            width: cell,
            height: cell,
            borderRadius: radius,
            borderWidth: 0.75,
            borderColor: `${swatch.bright}90`,
            borderCurve: 'continuous',
          }}
        >
          <View
            style={{
              position: 'absolute',
              left: cell * 0.14,
              top: cell * 0.13,
              width: cell * 0.72,
              height: Math.max(2, cell * 0.22),
              borderRadius: cell,
              backgroundColor: alpha('#FFFFFF', opacity.subtle),
            }}
          />
        </LinearGradient>
      ))}
    </View>
  );
});

/** Pixel size of a piece at a given cell size — used for layout and drag maths. */
export function pieceArtSize(cells: readonly Cell[], cell: number, gap?: number) {
  const { height, width } = cellsExtent(cells);
  const resolvedGap = gap ?? Math.max(1.5, cell * 0.08);
  return {
    width: width * (cell + resolvedGap) - resolvedGap,
    height: height * (cell + resolvedGap) - resolvedGap,
  };
}
