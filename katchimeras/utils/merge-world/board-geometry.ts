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
