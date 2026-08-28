export type MergeBoardGeometry = {
  columns: number;
  rows: number;
  cellSize: number;
  /** Optional visual cell height. Defaults to cellSize for square boards. */
  cellHeight?: number;
  gap: number;
  inset: number;
  /** Maps each visual slot to its stable logical board-cell index. */
  cellIndices?: readonly number[];
};

export function mergeCellOrigin(geometry: MergeBoardGeometry, index: number) {
  const visualIndex = geometry.cellIndices ? geometry.cellIndices.indexOf(index) : index;
  const pitchX = geometry.cellSize + geometry.gap;
  const pitchY = (geometry.cellHeight ?? geometry.cellSize) + geometry.gap;
  return {
    x: geometry.inset + (visualIndex % geometry.columns) * pitchX,
    y: geometry.inset + Math.floor(visualIndex / geometry.columns) * pitchY,
  };
}

export function mergeCellCenter(geometry: MergeBoardGeometry, index: number) {
  const origin = mergeCellOrigin(geometry, index);
  return {
    x: origin.x + geometry.cellSize / 2,
    y: origin.y + (geometry.cellHeight ?? geometry.cellSize) / 2,
  };
}

export function mergeCellFromPoint(geometry: MergeBoardGeometry, x: number, y: number) {
  const cellHeight = geometry.cellHeight ?? geometry.cellSize;
  const pitchX = geometry.cellSize + geometry.gap;
  const pitchY = cellHeight + geometry.gap;
  const column = Math.round((x - geometry.inset - geometry.cellSize / 2) / pitchX);
  const row = Math.round((y - geometry.inset - cellHeight / 2) / pitchY);
  if (column < 0 || column >= geometry.columns || row < 0 || row >= geometry.rows) return null;

  const visualIndex = row * geometry.columns + column;
  const index = geometry.cellIndices?.[visualIndex] ?? visualIndex;
  const center = mergeCellCenter(geometry, index);
  const hitSlopX = geometry.cellSize / 2 + geometry.gap / 2;
  const hitSlopY = cellHeight / 2 + geometry.gap / 2;
  if (Math.abs(x - center.x) > hitSlopX || Math.abs(y - center.y) > hitSlopY) return null;
  return index;
}

export function mergeNeighborCellInDirection(geometry: Pick<MergeBoardGeometry, 'cellIndices' | 'columns' | 'rows'>, source: number, directionX: number, directionY: number) {
  'worklet';
  const visualSource = geometry.cellIndices ? geometry.cellIndices.indexOf(source) : source;
  if (visualSource < 0 || visualSource >= geometry.columns * geometry.rows) return null;
  const sourceColumn = visualSource % geometry.columns;
  const sourceRow = Math.floor(visualSource / geometry.columns);
  const horizontal = Math.abs(directionX) >= Math.abs(directionY);
  const column = sourceColumn + (horizontal ? Math.sign(directionX) : 0);
  const row = sourceRow + (horizontal ? 0 : Math.sign(directionY));
  if (column < 0 || column >= geometry.columns || row < 0 || row >= geometry.rows) return null;
  if (column === sourceColumn && row === sourceRow) return null;
  const visualTarget = row * geometry.columns + column;
  return geometry.cellIndices?.[visualTarget] ?? visualTarget;
}
