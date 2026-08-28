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
  /** Optional shallow perspective used by the embedded Haven board. */
  projection?: MergeBoardProjection;
};

export type MergeBoardProjection = {
  kind: 'trapezoid';
  /** Width of the back edge relative to the front edge. */
  topWidthRatio: number;
  /** Upright-object scale at the back edge. The front edge is always 1. */
  farScale: number;
};

export type MergeCellFrame = {
  bounds: { height: number; left: number; top: number; width: number };
  center: { x: number; y: number };
  depthScale: number;
  polygon: readonly [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }];
};

function gridWidth(geometry: MergeBoardGeometry) {
  return geometry.columns * geometry.cellSize + Math.max(0, geometry.columns - 1) * geometry.gap;
}

function gridHeight(geometry: MergeBoardGeometry) {
  const cellHeight = geometry.cellHeight ?? geometry.cellSize;
  return geometry.rows * cellHeight + Math.max(0, geometry.rows - 1) * geometry.gap;
}

export function mergeProjectPoint(geometry: MergeBoardGeometry, logicalX: number, logicalY: number) {
  const projection = geometry.projection;
  if (!projection) return { x: geometry.inset + logicalX, y: geometry.inset + logicalY };
  const width = gridWidth(geometry);
  const height = gridHeight(geometry);
  const depth = Math.max(0, Math.min(1, logicalY / Math.max(1, height)));
  const widthScale = projection.topWidthRatio + (1 - projection.topWidthRatio) * depth;
  return {
    x: geometry.inset + width / 2 + (logicalX - width / 2) * widthScale,
    y: geometry.inset + logicalY,
  };
}

export function mergeUnprojectPoint(geometry: MergeBoardGeometry, x: number, y: number) {
  const localY = y - geometry.inset;
  const projection = geometry.projection;
  if (!projection) return { x: x - geometry.inset, y: localY };
  const width = gridWidth(geometry);
  const height = gridHeight(geometry);
  const depth = Math.max(0, Math.min(1, localY / Math.max(1, height)));
  const widthScale = projection.topWidthRatio + (1 - projection.topWidthRatio) * depth;
  return {
    x: width / 2 + (x - geometry.inset - width / 2) / Math.max(0.001, widthScale),
    y: localY,
  };
}

export function mergeDepthScaleAtY(geometry: MergeBoardGeometry, y: number) {
  const projection = geometry.projection;
  if (!projection) return 1;
  const depth = Math.max(0, Math.min(1, (y - geometry.inset) / Math.max(1, gridHeight(geometry))));
  return projection.farScale + (1 - projection.farScale) * depth;
}

export function mergeCellFrame(geometry: MergeBoardGeometry, index: number): MergeCellFrame {
  const visualIndex = geometry.cellIndices ? geometry.cellIndices.indexOf(index) : index;
  const column = visualIndex % geometry.columns;
  const row = Math.floor(visualIndex / geometry.columns);
  const cellHeight = geometry.cellHeight ?? geometry.cellSize;
  const pitchX = geometry.cellSize + geometry.gap;
  const pitchY = cellHeight + geometry.gap;
  const left = column * pitchX;
  const top = row * pitchY;
  const right = left + geometry.cellSize;
  const bottom = top + cellHeight;
  if (!geometry.projection) {
    const bounds = {
      left: geometry.inset + left,
      top: geometry.inset + top,
      width: geometry.cellSize,
      height: cellHeight,
    };
    const polygon = [
      { x: bounds.left, y: bounds.top },
      { x: bounds.left + bounds.width, y: bounds.top },
      { x: bounds.left + bounds.width, y: bounds.top + bounds.height },
      { x: bounds.left, y: bounds.top + bounds.height },
    ] as const;
    return {
      bounds,
      center: { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 },
      depthScale: 1,
      polygon,
    };
  }
  const polygon = [
    mergeProjectPoint(geometry, left, top),
    mergeProjectPoint(geometry, right, top),
    mergeProjectPoint(geometry, right, bottom),
    mergeProjectPoint(geometry, left, bottom),
  ] as const;
  const xs = polygon.map((point) => point.x);
  const ys = polygon.map((point) => point.y);
  const bounds = {
    left: Math.min(...xs),
    top: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
  const center = mergeProjectPoint(geometry, left + geometry.cellSize / 2, top + cellHeight / 2);
  return { bounds, center, depthScale: mergeDepthScaleAtY(geometry, center.y), polygon };
}

export function mergeCellOrigin(geometry: MergeBoardGeometry, index: number) {
  const frame = mergeCellFrame(geometry, index);
  return { x: frame.bounds.left, y: frame.bounds.top };
}

export function mergeCellCenter(geometry: MergeBoardGeometry, index: number) {
  return mergeCellFrame(geometry, index).center;
}

export function mergeCellFromPoint(geometry: MergeBoardGeometry, x: number, y: number) {
  const cellHeight = geometry.cellHeight ?? geometry.cellSize;
  const pitchX = geometry.cellSize + geometry.gap;
  const pitchY = cellHeight + geometry.gap;
  const logical = mergeUnprojectPoint(geometry, x, y);
  const column = Math.round((logical.x - geometry.cellSize / 2) / pitchX);
  const row = Math.round((logical.y - cellHeight / 2) / pitchY);
  if (column < 0 || column >= geometry.columns || row < 0 || row >= geometry.rows) return null;

  const visualIndex = row * geometry.columns + column;
  const index = geometry.cellIndices?.[visualIndex] ?? visualIndex;
  const logicalCenterX = column * pitchX + geometry.cellSize / 2;
  const logicalCenterY = row * pitchY + cellHeight / 2;
  const hitSlopX = geometry.cellSize / 2 + geometry.gap / 2;
  const hitSlopY = cellHeight / 2 + geometry.gap / 2;
  if (Math.abs(logical.x - logicalCenterX) > hitSlopX || Math.abs(logical.y - logicalCenterY) > hitSlopY) return null;
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
