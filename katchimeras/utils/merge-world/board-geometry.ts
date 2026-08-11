export type MergeBoardGeometry = {
  columns: number;
  rows: number;
  cellSize: number;
  gap: number;
  inset: number;
};

export function mergeCellOrigin(geometry: MergeBoardGeometry, index: number) {
  const pitch = geometry.cellSize + geometry.gap;
  return {
    x: geometry.inset + (index % geometry.columns) * pitch,
    y: geometry.inset + Math.floor(index / geometry.columns) * pitch,
  };
}

export function mergeCellCenter(geometry: MergeBoardGeometry, index: number) {
  const origin = mergeCellOrigin(geometry, index);
  return {
    x: origin.x + geometry.cellSize / 2,
    y: origin.y + geometry.cellSize / 2,
  };
}

export function mergeCellFromPoint(geometry: MergeBoardGeometry, x: number, y: number) {
  const pitch = geometry.cellSize + geometry.gap;
  const column = Math.round((x - geometry.inset - geometry.cellSize / 2) / pitch);
  const row = Math.round((y - geometry.inset - geometry.cellSize / 2) / pitch);
  if (column < 0 || column >= geometry.columns || row < 0 || row >= geometry.rows) return null;

  const index = row * geometry.columns + column;
  const center = mergeCellCenter(geometry, index);
  const hitSlop = geometry.cellSize / 2 + geometry.gap / 2;
  if (Math.abs(x - center.x) > hitSlop || Math.abs(y - center.y) > hitSlop) return null;
  return index;
}

export function mergeNeighborCellInDirection(geometry: Pick<MergeBoardGeometry, 'columns' | 'rows'>, source: number, directionX: number, directionY: number) {
  'worklet';
  if (source < 0 || source >= geometry.columns * geometry.rows) return null;
  const sourceColumn = source % geometry.columns;
  const sourceRow = Math.floor(source / geometry.columns);
  const horizontal = Math.abs(directionX) >= Math.abs(directionY);
  const column = sourceColumn + (horizontal ? Math.sign(directionX) : 0);
  const row = sourceRow + (horizontal ? 0 : Math.sign(directionY));
  if (column < 0 || column >= geometry.columns || row < 0 || row >= geometry.rows) return null;
  if (column === sourceColumn && row === sourceRow) return null;
  return row * geometry.columns + column;
}
