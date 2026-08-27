export type WorldPoint = { x: number; y: number };
export type WorldSurfacePoint = WorldPoint & { z: number };
export type WorldBounds = { left: number; top: number; right: number; bottom: number; width: number; height: number };
export type IsoCell = { col: number; row: number };
export type WorldRegionRole = 'board' | 'home' | 'companion' | 'decor' | 'locked' | 'connector';

export type WorldIsoRegion = {
  id: string;
  label: string;
  role: WorldRegionRole;
  cells: readonly IsoCell[];
};

export type WorldBoardSurface = {
  id: string;
  columns: 6;
  rows: 7;
  startCol: 0;
  startRow: 0;
  sceneOrigin: WorldPoint;
};

export type WorldSubjectAnchor = {
  id: 'home' | 'egg' | 'mossprout';
  position: WorldPoint;
  size: number;
  depthBias: number;
};

export type WorldDecorationMark = {
  id: string;
  cell: IsoCell;
  position: WorldPoint;
  kind: 'flower' | 'berries';
  size: number;
};

export type WorldBoardManifest = {
  seed: string;
  projection: 'front-isometric';
  tileWidth: typeof LAB_TILE_WIDTH;
  tileHeight: typeof LAB_TILE_HEIGHT;
  slabThickness: typeof LAB_SLAB_THICKNESS;
  sceneOrigin: WorldPoint;
  regions: readonly WorldIsoRegion[];
  board: WorldBoardSurface;
  subjects: readonly WorldSubjectAnchor[];
  decorations: readonly WorldDecorationMark[];
  bounds: WorldBounds;
};

export type WorldManifestValidation = { valid: boolean; errors: readonly string[] };

const BOARD_COLUMNS = 6 as const;
const BOARD_ROWS = 7 as const;
const SCENE_PADDING = 210;

// Symmetric 2:1 isometric basis: the camera faces the front corner of the board
// instead of looking across it from one side. The shallow top diamond and the
// deeper lab-only slab make the front walls materially more visible.
export const LAB_COLUMN_BASIS: WorldPoint = { x: 60, y: -30 };
export const LAB_ROW_BASIS: WorldPoint = { x: 60, y: 30 };
export const LAB_TILE_WIDTH = 120 as const;
export const LAB_TILE_HEIGHT = 60 as const;
export const LAB_SLAB_THICKNESS = 68 as const;

function labGridCorner(col: number, row: number): WorldPoint {
  return {
    x: col * LAB_COLUMN_BASIS.x + row * LAB_ROW_BASIS.x,
    y: col * LAB_COLUMN_BASIS.y + row * LAB_ROW_BASIS.y,
  };
}

function labCellCenter(col: number, row: number): WorldPoint {
  return labGridCorner(col + 0.5, row + 0.5);
}

function labCellFromPoint(x: number, y: number): { col: number; row: number } {
  const determinant = LAB_COLUMN_BASIS.x * LAB_ROW_BASIS.y - LAB_COLUMN_BASIS.y * LAB_ROW_BASIS.x;
  const cornerCol = (x * LAB_ROW_BASIS.y - LAB_ROW_BASIS.x * y) / determinant;
  const cornerRow = (LAB_COLUMN_BASIS.x * y - LAB_COLUMN_BASIS.y * x) / determinant;
  return { col: cornerCol - 0.5, row: cornerRow - 0.5 };
}

function rectCells(left: number, top: number, width: number, height: number): IsoCell[] {
  return Array.from({ length: width * height }, (_, index) => ({
    col: left + index % width,
    row: top + Math.floor(index / width),
  }));
}

function cellKey(cell: IsoCell): string {
  return `${cell.col}:${cell.row}`;
}

function addOrigin(point: WorldPoint, origin: WorldPoint): WorldPoint {
  return { x: point.x + origin.x, y: point.y + origin.y };
}

function createRegions(): WorldIsoRegion[] {
  return [
    { id: 'board', label: 'Grass Grid', role: 'board', cells: rectCells(0, 0, BOARD_COLUMNS, BOARD_ROWS) },
  ];
}

function rawBounds(regions: readonly WorldIsoRegion[]): WorldBounds {
  const points = regions.flatMap((region) => region.cells.flatMap((cell) => [
    labGridCorner(cell.col, cell.row),
    labGridCorner(cell.col + 1, cell.row),
    { ...labGridCorner(cell.col + 1, cell.row + 1), y: labGridCorner(cell.col + 1, cell.row + 1).y + LAB_SLAB_THICKNESS },
    { ...labGridCorner(cell.col, cell.row + 1), y: labGridCorner(cell.col, cell.row + 1).y + LAB_SLAB_THICKNESS },
  ]));
  const left = Math.min(...points.map((point) => point.x));
  const top = Math.min(...points.map((point) => point.y));
  const right = Math.max(...points.map((point) => point.x));
  const bottom = Math.max(...points.map((point) => point.y));
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

export function isoCellPolygon(sceneOrigin: WorldPoint, cell: IsoCell): readonly WorldPoint[] {
  return [
    addOrigin(labGridCorner(cell.col, cell.row), sceneOrigin),
    addOrigin(labGridCorner(cell.col + 1, cell.row), sceneOrigin),
    addOrigin(labGridCorner(cell.col + 1, cell.row + 1), sceneOrigin),
    addOrigin(labGridCorner(cell.col, cell.row + 1), sceneOrigin),
  ];
}

export function isoCellCenter(sceneOrigin: WorldPoint, cell: IsoCell): WorldPoint {
  return addOrigin(labCellCenter(cell.col, cell.row), sceneOrigin);
}

export function projectLabSurfacePoint(sceneOrigin: WorldPoint, point: WorldSurfacePoint): WorldPoint {
  const ground = addOrigin(labGridCorner(point.x, point.y), sceneOrigin);
  return { x: ground.x, y: ground.y - point.z };
}

export function projectBoardCell(surface: WorldBoardSurface, cell: number): readonly WorldPoint[] {
  if (cell < 0 || cell >= surface.columns * surface.rows) return [];
  return isoCellPolygon(surface.sceneOrigin, {
    col: surface.startCol + cell % surface.columns,
    row: surface.startRow + Math.floor(cell / surface.columns),
  });
}

export function boardCellCenter(surface: WorldBoardSurface, cell: number): WorldPoint | null {
  if (cell < 0 || cell >= surface.columns * surface.rows) return null;
  return isoCellCenter(surface.sceneOrigin, {
    col: surface.startCol + cell % surface.columns,
    row: surface.startRow + Math.floor(cell / surface.columns),
  });
}

export function boardCellAtWorldPoint(surface: WorldBoardSurface, point: WorldPoint): number | null {
  const local = labCellFromPoint(point.x - surface.sceneOrigin.x, point.y - surface.sceneOrigin.y);
  const col = Math.round(local.col);
  const row = Math.round(local.row);
  if (col < surface.startCol || col >= surface.startCol + surface.columns) return null;
  if (row < surface.startRow || row >= surface.startRow + surface.rows) return null;
  return (row - surface.startRow) * surface.columns + col - surface.startCol;
}

export function regionAtWorldPoint(manifest: WorldBoardManifest, point: WorldPoint): WorldIsoRegion | null {
  const local = labCellFromPoint(point.x - manifest.sceneOrigin.x, point.y - manifest.sceneOrigin.y);
  const key = `${Math.round(local.col)}:${Math.round(local.row)}`;
  return [...manifest.regions].reverse().find((region) => region.cells.some((cell) => cellKey(cell) === key)) ?? null;
}

export function validateWorldManifest(manifest: Pick<WorldBoardManifest, 'regions' | 'board'>): WorldManifestValidation {
  const errors: string[] = [];
  const occupied = new Map<string, string>();
  for (const region of manifest.regions) {
    if (!region.cells.length) errors.push(`empty region: ${region.id}`);
    for (const cell of region.cells) {
      const key = cellKey(cell);
      const previous = occupied.get(key);
      if (previous) errors.push(`overlapping cell: ${previous}/${region.id}/${key}`);
      occupied.set(key, region.id);
    }
  }
  const boardRegion = manifest.regions.find((region) => region.role === 'board');
  if (!boardRegion || boardRegion.cells.length !== BOARD_COLUMNS * BOARD_ROWS) errors.push('board must contain 6x7 cells');
  if (manifest.board.columns !== BOARD_COLUMNS || manifest.board.rows !== BOARD_ROWS) errors.push('board dimensions changed');
  const start = occupied.keys().next().value as string | undefined;
  const visited = new Set<string>();
  const queue = start ? [start] : [];
  while (queue.length) {
    const key = queue.shift()!;
    if (visited.has(key)) continue;
    visited.add(key);
    const [col, row] = key.split(':').map(Number);
    for (const neighbor of [`${col + 1}:${row}`, `${col - 1}:${row}`, `${col}:${row + 1}`, `${col}:${row - 1}`]) {
      if (occupied.has(neighbor) && !visited.has(neighbor)) queue.push(neighbor);
    }
  }
  if (visited.size !== occupied.size) errors.push(`world is disconnected: ${visited.size}/${occupied.size} cells reachable`);
  return { valid: errors.length === 0, errors };
}

export function generateWorldBoardManifest(seed: string): WorldBoardManifest {
  const regions = createRegions();
  const sourceBounds = rawBounds(regions);
  const sceneOrigin = { x: SCENE_PADDING - sourceBounds.left, y: SCENE_PADDING - sourceBounds.top };
  const bounds = {
    left: 0,
    top: 0,
    right: sourceBounds.width + SCENE_PADDING * 2,
    bottom: sourceBounds.height + SCENE_PADDING * 2,
    width: sourceBounds.width + SCENE_PADDING * 2,
    height: sourceBounds.height + SCENE_PADDING * 2,
  };
  const board: WorldBoardSurface = { id: 'mossprout-board', columns: BOARD_COLUMNS, rows: BOARD_ROWS, startCol: 0, startRow: 0, sceneOrigin };
  return {
    seed,
    projection: 'front-isometric',
    tileWidth: LAB_TILE_WIDTH,
    tileHeight: LAB_TILE_HEIGHT,
    slabThickness: LAB_SLAB_THICKNESS,
    sceneOrigin,
    regions,
    board,
    subjects: [],
    decorations: [],
    bounds,
  };
}

export function calculateWorldBounds(manifest: WorldBoardManifest): WorldBounds {
  return manifest.bounds;
}

export function worldPointToScreen(point: WorldPoint, scene: { width: number; height: number }, camera: { tx: number; ty: number; scale: number }): WorldPoint {
  return {
    x: scene.width / 2 + camera.tx + (point.x - scene.width / 2) * camera.scale,
    y: scene.height / 2 + camera.ty + (point.y - scene.height / 2) * camera.scale,
  };
}

export function screenPointToWorldBoard(point: WorldPoint, scene: { width: number; height: number }, camera: { tx: number; ty: number; scale: number }): WorldPoint {
  return {
    x: scene.width / 2 + (point.x - scene.width / 2 - camera.tx) / camera.scale,
    y: scene.height / 2 + (point.y - scene.height / 2 - camera.ty) / camera.scale,
  };
}
