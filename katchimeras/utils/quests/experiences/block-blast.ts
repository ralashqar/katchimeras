export const BLOCK_BLAST_RULESET = 'cheerlet-block-party-v1' as const;
export const BLOCK_BLAST_PACK = 'cheerlet-party' as const;
export const BLOCK_BLAST_BOARD_SIZE = 8;

export type BlockBlastColorId = 'rose' | 'amber' | 'teal' | 'coral' | 'blue';
export type BlockBlastCell = { row: number; column: number };
export type BlockBlastRotation = 0 | 1 | 2 | 3;
export type BlockBlastShape = {
  id: string;
  familyId: string;
  rotation: BlockBlastRotation;
  cells: readonly BlockBlastCell[];
  weight: number;
};
export type BlockBlastPiece = {
  id: string;
  shapeId: string;
  cells: readonly BlockBlastCell[];
  colorId: BlockBlastColorId;
  used: boolean;
};

export type BlockBlastResolution = {
  id: number;
  placedIndices: number[];
  clearedIndices: number[];
  clearedCells: { index: number; colorId: BlockBlastColorId }[];
  clearedRows: number[];
  clearedColumns: number[];
  scoreDelta: number;
  perfectClear: boolean;
};

export type BlockBlastState = {
  rulesetId: typeof BLOCK_BLAST_RULESET;
  seed: string;
  board: (BlockBlastColorId | null)[];
  tray: BlockBlastPiece[];
  score: number;
  linesCleared: number;
  piecesPlaced: number;
  combo: number;
  maxCombo: number;
  rngState: number;
  trayGeneration: number;
  eventSequence: number;
  startedAt: number;
  updatedAt: number;
  status: 'playing' | 'lost';
  lastResolution: BlockBlastResolution | null;
};

export type BlockBlastAction =
  | { type: 'place'; pieceId: string; row: number; column: number; now?: number }
  | { type: 'new_run'; seed: string; now?: number };

const COLORS: readonly BlockBlastColorId[] = ['rose', 'amber', 'teal', 'coral', 'blue'];

const cells = (...coordinates: [number, number][]): readonly BlockBlastCell[] =>
  coordinates.map(([row, column]) => ({ row, column }));

type BlockBlastShapeFamily = Omit<BlockBlastShape, 'id' | 'familyId' | 'rotation'> & { id: string };

export const BLOCK_BLAST_SHAPE_FAMILIES: readonly BlockBlastShapeFamily[] = [
  { id: 'single', cells: cells([0, 0]), weight: 5 },
  { id: 'domino', cells: cells([0, 0], [0, 1]), weight: 5 },
  { id: 'line-3', cells: cells([0, 0], [0, 1], [0, 2]), weight: 5 },
  { id: 'corner-3', cells: cells([0, 0], [1, 0], [1, 1]), weight: 4 },
  { id: 'square-2', cells: cells([0, 0], [0, 1], [1, 0], [1, 1]), weight: 4 },
  { id: 'line-4', cells: cells([0, 0], [0, 1], [0, 2], [0, 3]), weight: 3 },
  { id: 'l-4', cells: cells([0, 0], [1, 0], [2, 0], [2, 1]), weight: 3 },
  { id: 'j-4', cells: cells([0, 1], [1, 1], [2, 0], [2, 1]), weight: 3 },
  { id: 't-4', cells: cells([0, 0], [0, 1], [0, 2], [1, 1]), weight: 3 },
  { id: 's-4', cells: cells([0, 1], [0, 2], [1, 0], [1, 1]), weight: 3 },
  { id: 'z-4', cells: cells([0, 0], [0, 1], [1, 1], [1, 2]), weight: 3 },
  { id: 'line-5', cells: cells([0, 0], [0, 1], [0, 2], [0, 3], [0, 4]), weight: 2 },
  { id: 'l-5', cells: cells([0, 0], [1, 0], [2, 0], [2, 1], [2, 2]), weight: 2 },
  { id: 'j-5', cells: cells([0, 2], [1, 2], [2, 0], [2, 1], [2, 2]), weight: 2 },
  { id: 't-5', cells: cells([0, 0], [0, 1], [0, 2], [1, 1], [2, 1]), weight: 2 },
  { id: 'plus-5', cells: cells([0, 1], [1, 0], [1, 1], [1, 2], [2, 1]), weight: 2 },
  { id: 'u-5', cells: cells([0, 0], [0, 2], [1, 0], [1, 1], [1, 2]), weight: 2 },
  { id: 'p-5', cells: cells([0, 0], [0, 1], [1, 0], [1, 1], [2, 0]), weight: 2 },
  { id: 'q-5', cells: cells([0, 0], [0, 1], [1, 0], [1, 1], [2, 1]), weight: 2 },
  { id: 'rectangle-2x3', cells: cells([0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]), weight: 2 },
  { id: 'square-3', cells: cells([0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]), weight: 1 },
] as const;

export const BLOCK_BLAST_SHAPES: readonly BlockBlastShape[] = BLOCK_BLAST_SHAPE_FAMILIES.flatMap((family) => {
  const rotations = uniqueBlockBlastRotations(family.cells);
  return rotations.map(({ rotation, cells: rotatedCells }) => ({
    id: rotations.length === 1 ? family.id : `${family.id}-r${rotation}`,
    familyId: family.id,
    rotation,
    cells: rotatedCells,
    // A family keeps the same overall frequency regardless of how many unique rotations it has.
    weight: family.weight / rotations.length,
  }));
});

export function rotateBlockBlastCells(
  pieceCells: readonly BlockBlastCell[],
  quarterTurns: BlockBlastRotation,
): readonly BlockBlastCell[] {
  let rotated = pieceCells.map((cell) => ({ ...cell }));
  for (let turn = 0; turn < quarterTurns; turn += 1) {
    rotated = rotated.map((cell) => ({ row: cell.column, column: -cell.row }));
  }
  return normaliseBlockBlastCells(rotated);
}

function uniqueBlockBlastRotations(pieceCells: readonly BlockBlastCell[]) {
  const rotations: { rotation: BlockBlastRotation; cells: readonly BlockBlastCell[] }[] = [];
  const seen = new Set<string>();
  for (const rotation of [0, 1, 2, 3] as const) {
    const rotatedCells = rotateBlockBlastCells(pieceCells, rotation);
    const key = rotatedCells.map((cell) => `${cell.row},${cell.column}`).join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    rotations.push({ rotation, cells: rotatedCells });
  }
  return rotations;
}

function normaliseBlockBlastCells(pieceCells: readonly BlockBlastCell[]): readonly BlockBlastCell[] {
  const minimumRow = Math.min(...pieceCells.map((cell) => cell.row));
  const minimumColumn = Math.min(...pieceCells.map((cell) => cell.column));
  return pieceCells
    .map((cell) => ({ row: cell.row - minimumRow, column: cell.column - minimumColumn }))
    .sort((left, right) => left.row - right.row || left.column - right.column);
}

export function createBlockBlastState(seed: string, now = Date.now()): BlockBlastState {
  const board = emptyBoard();
  const initialRng = hashSeed(seed);
  const generated = generateBlockBlastTray(board, initialRng, 0);
  return {
    rulesetId: BLOCK_BLAST_RULESET,
    seed,
    board,
    tray: generated.tray,
    score: 0,
    linesCleared: 0,
    piecesPlaced: 0,
    combo: 0,
    maxCombo: 0,
    rngState: generated.rngState,
    trayGeneration: 0,
    eventSequence: 0,
    startedAt: now,
    updatedAt: now,
    status: 'playing',
    lastResolution: null,
  };
}

export function blockBlastReducer(state: BlockBlastState, action: BlockBlastAction): BlockBlastState {
  if (action.type === 'new_run') return createBlockBlastState(action.seed, action.now);
  if (state.status !== 'playing') return state;
  const piece = state.tray.find((candidate) => candidate.id === action.pieceId && !candidate.used);
  if (!piece || !canPlaceBlockBlastPiece(state.board, piece.cells, action.row, action.column)) return state;

  const board = [...state.board];
  const placedIndices = piece.cells.map((cell) => boardIndex(action.row + cell.row, action.column + cell.column));
  placedIndices.forEach((index) => { board[index] = piece.colorId; });
  const cleared = completedLines(board);
  const clearedIndexSet = new Set<number>();
  cleared.rows.forEach((row) => {
    for (let column = 0; column < BLOCK_BLAST_BOARD_SIZE; column += 1) clearedIndexSet.add(boardIndex(row, column));
  });
  cleared.columns.forEach((column) => {
    for (let row = 0; row < BLOCK_BLAST_BOARD_SIZE; row += 1) clearedIndexSet.add(boardIndex(row, column));
  });
  clearedIndexSet.forEach((index) => { board[index] = null; });

  const clearedLineCount = cleared.rows.length + cleared.columns.length;
  const combo = clearedLineCount ? state.combo + 1 : 0;
  const perfectClear = clearedLineCount > 0 && board.every((cell) => cell === null);
  const scoreDelta = piece.cells.length * 10
    + 100 * clearedLineCount * clearedLineCount
    + 50 * Math.max(0, combo - 1) * clearedLineCount
    + (perfectClear ? 500 : 0);
  let tray = state.tray.map((candidate) => candidate.id === piece.id ? { ...candidate, used: true } : candidate);
  let rngState = state.rngState;
  let trayGeneration = state.trayGeneration;
  if (tray.every((candidate) => candidate.used)) {
    trayGeneration += 1;
    const generated = generateBlockBlastTray(board, rngState, trayGeneration);
    tray = generated.tray;
    rngState = generated.rngState;
  }
  const status = hasAnyBlockBlastMove(board, tray) ? 'playing' : 'lost';
  const eventSequence = state.eventSequence + 1;
  const now = action.now ?? Date.now();
  return {
    ...state,
    board,
    tray,
    score: state.score + scoreDelta,
    linesCleared: state.linesCleared + clearedLineCount,
    piecesPlaced: state.piecesPlaced + 1,
    combo,
    maxCombo: Math.max(state.maxCombo, combo),
    rngState,
    trayGeneration,
    eventSequence,
    updatedAt: now,
    status,
    lastResolution: {
      id: eventSequence,
      placedIndices,
      clearedIndices: [...clearedIndexSet],
      clearedCells: [...clearedIndexSet].map((index) => ({ index, colorId: state.board[index] ?? piece.colorId })),
      clearedRows: cleared.rows,
      clearedColumns: cleared.columns,
      scoreDelta,
      perfectClear,
    },
  };
}

export function canPlaceBlockBlastPiece(
  board: readonly (BlockBlastColorId | null)[],
  pieceCells: readonly BlockBlastCell[],
  row: number,
  column: number,
): boolean {
  return pieceCells.every((cell) => {
    const targetRow = row + cell.row;
    const targetColumn = column + cell.column;
    return targetRow >= 0 && targetColumn >= 0
      && targetRow < BLOCK_BLAST_BOARD_SIZE && targetColumn < BLOCK_BLAST_BOARD_SIZE
      && board[boardIndex(targetRow, targetColumn)] == null;
  });
}

export function projectedBlockBlastLines(
  board: readonly (BlockBlastColorId | null)[],
  pieceCells: readonly BlockBlastCell[],
  row: number,
  column: number,
): { rows: number[]; columns: number[] } {
  if (!canPlaceBlockBlastPiece(board, pieceCells, row, column)) return { rows: [], columns: [] };
  const projected = [...board];
  pieceCells.forEach((cell) => {
    projected[boardIndex(row + cell.row, column + cell.column)] = 'rose';
  });
  return completedLines(projected);
}

export function blockBlastClearCascadePhase(
  index: number,
  clearedRows: readonly number[],
  clearedColumns: readonly number[],
): number {
  const row = Math.floor(index / BLOCK_BLAST_BOARD_SIZE);
  const column = index % BLOCK_BLAST_BOARD_SIZE;
  const rowLine = clearedRows.indexOf(row);
  const columnLine = clearedColumns.indexOf(column);
  const rowPhase = rowLine >= 0 ? column + rowLine * 1.5 : Number.POSITIVE_INFINITY;
  const columnPhase = columnLine >= 0 ? row + columnLine * 1.5 : Number.POSITIVE_INFINITY;
  return Math.min(rowPhase, columnPhase);
}

export function validBlockBlastOrigins(
  board: readonly (BlockBlastColorId | null)[],
  pieceCells: readonly BlockBlastCell[],
): BlockBlastCell[] {
  const origins: BlockBlastCell[] = [];
  for (let row = 0; row < BLOCK_BLAST_BOARD_SIZE; row += 1) {
    for (let column = 0; column < BLOCK_BLAST_BOARD_SIZE; column += 1) {
      if (canPlaceBlockBlastPiece(board, pieceCells, row, column)) origins.push({ row, column });
    }
  }
  return origins;
}

export function nearestBlockBlastOrigin(
  pieceCells: readonly BlockBlastCell[],
  targetRow: number,
  targetColumn: number,
  boardCaptureMargin = 0.85,
): BlockBlastCell | null {
  const pieceRows = Math.max(...pieceCells.map((cell) => cell.row)) + 1;
  const pieceColumns = Math.max(...pieceCells.map((cell) => cell.column)) + 1;
  const maximumRow = BLOCK_BLAST_BOARD_SIZE - pieceRows;
  const maximumColumn = BLOCK_BLAST_BOARD_SIZE - pieceColumns;

  // Use the whole floating piece, not only its origin: even a mostly-outside long piece
  // remains eligible while any of its footprint overlaps or sits just beside the board.
  if (targetRow + pieceRows < -boardCaptureMargin
    || targetColumn + pieceColumns < -boardCaptureMargin
    || targetRow > BLOCK_BLAST_BOARD_SIZE + boardCaptureMargin
    || targetColumn > BLOCK_BLAST_BOARD_SIZE + boardCaptureMargin) return null;

  const clampedRow = Math.max(0, Math.min(maximumRow, targetRow));
  const clampedColumn = Math.max(0, Math.min(maximumColumn, targetColumn));
  return { row: Math.round(clampedRow), column: Math.round(clampedColumn) };
}

export function nearestSnappedBlockBlastOrigin(
  board: readonly (BlockBlastColorId | null)[],
  pieceCells: readonly BlockBlastCell[],
  targetRow: number,
  targetColumn: number,
  localSnapRadius = 0.72,
): BlockBlastCell | null {
  const geometricOrigin = nearestBlockBlastOrigin(pieceCells, targetRow, targetColumn);
  if (!geometricOrigin || canPlaceBlockBlastPiece(board, pieceCells, geometricOrigin.row, geometricOrigin.column)) {
    return geometricOrigin;
  }

  // Near a half-cell boundary, prefer an almost-equally-close valid neighbour.
  // Keep the geometric (invalid) origin when the next valid position is farther
  // away so a piece never jumps across occupied cells or to a remote opening.
  let nearestValid: BlockBlastCell | null = null;
  let nearestDistanceSquared = Number.POSITIVE_INFINITY;
  const searchRadius = Math.ceil(localSnapRadius);
  for (let row = Math.floor(targetRow) - searchRadius; row <= Math.ceil(targetRow) + searchRadius; row += 1) {
    for (let column = Math.floor(targetColumn) - searchRadius; column <= Math.ceil(targetColumn) + searchRadius; column += 1) {
      if (!canPlaceBlockBlastPiece(board, pieceCells, row, column)) continue;
      const distanceSquared = (row - targetRow) ** 2 + (column - targetColumn) ** 2;
      if (distanceSquared < nearestDistanceSquared) {
        nearestValid = { row, column };
        nearestDistanceSquared = distanceSquared;
      }
    }
  }
  return nearestValid && nearestDistanceSquared <= localSnapRadius ** 2 ? nearestValid : geometricOrigin;
}

export function hasAnyBlockBlastMove(
  board: readonly (BlockBlastColorId | null)[],
  tray: readonly BlockBlastPiece[],
): boolean {
  return tray.some((piece) => !piece.used && validBlockBlastOrigins(board, piece.cells).length > 0);
}

export function generateBlockBlastTray(
  board: readonly (BlockBlastColorId | null)[],
  startingRngState: number,
  generation: number,
): { tray: BlockBlastPiece[]; rngState: number } {
  let rngState = startingRngState || 1;
  const playable = BLOCK_BLAST_SHAPES.filter((shape) => validBlockBlastOrigins(board, shape.cells).length > 0);
  if (!playable.length) return { tray: [], rngState };
  const selected: BlockBlastShape[] = [];
  let pick: BlockBlastShape;
  [pick, rngState] = weightedPick(playable, rngState);
  selected.push(pick);
  for (let index = 1; index < 3; index += 1) {
    [pick, rngState] = weightedPick(BLOCK_BLAST_SHAPES, rngState);
    selected.push(pick);
  }
  const tray: BlockBlastPiece[] = [];
  for (let index = 0; index < selected.length; index += 1) {
    const random = nextRandom(rngState);
    rngState = random.state;
    tray.push({
      id: `tray-${generation}-${index}-${rngState.toString(36)}`,
      shapeId: selected[index].id,
      cells: selected[index].cells,
      colorId: COLORS[Math.floor(random.value * COLORS.length) % COLORS.length],
      used: false,
    });
  }
  return { tray, rngState };
}

export function blockBlastShapeIsConnected(shape: BlockBlastShape): boolean {
  if (!shape.cells.length) return false;
  const keys = new Set(shape.cells.map((cell) => `${cell.row},${cell.column}`));
  const queue = [shape.cells[0]];
  const seen = new Set([`${shape.cells[0].row},${shape.cells[0].column}`]);
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    for (const [rowDelta, columnDelta] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const next = { row: current.row + rowDelta, column: current.column + columnDelta };
      const key = `${next.row},${next.column}`;
      if (keys.has(key) && !seen.has(key)) {
        seen.add(key);
        queue.push(next);
      }
    }
  }
  return seen.size === shape.cells.length;
}

export function blockBlastShapeIsNormalised(shape: BlockBlastShape): boolean {
  return Math.min(...shape.cells.map((cell) => cell.row)) === 0
    && Math.min(...shape.cells.map((cell) => cell.column)) === 0
    && new Set(shape.cells.map((cell) => `${cell.row},${cell.column}`)).size === shape.cells.length;
}

function completedLines(board: readonly (BlockBlastColorId | null)[]) {
  const rows: number[] = [];
  const columns: number[] = [];
  for (let row = 0; row < BLOCK_BLAST_BOARD_SIZE; row += 1) {
    if (Array.from({ length: BLOCK_BLAST_BOARD_SIZE }, (_, column) => board[boardIndex(row, column)]).every(Boolean)) rows.push(row);
  }
  for (let column = 0; column < BLOCK_BLAST_BOARD_SIZE; column += 1) {
    if (Array.from({ length: BLOCK_BLAST_BOARD_SIZE }, (_, row) => board[boardIndex(row, column)]).every(Boolean)) columns.push(column);
  }
  return { rows, columns };
}

function weightedPick(shapes: readonly BlockBlastShape[], rngState: number): [BlockBlastShape, number] {
  const random = nextRandom(rngState);
  const total = shapes.reduce((sum, shape) => sum + shape.weight, 0);
  let cursor = random.value * total;
  for (const shape of shapes) {
    cursor -= shape.weight;
    if (cursor <= 0) return [shape, random.state];
  }
  return [shapes[shapes.length - 1], random.state];
}

function nextRandom(state: number): { state: number; value: number } {
  const next = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
  return { state: next || 1, value: next / 0x1_0000_0000 };
}

function hashSeed(seed: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0 || 1;
}

function emptyBoard(): (BlockBlastColorId | null)[] {
  return Array.from({ length: BLOCK_BLAST_BOARD_SIZE * BLOCK_BLAST_BOARD_SIZE }, () => null);
}

function boardIndex(row: number, column: number): number {
  return row * BLOCK_BLAST_BOARD_SIZE + column;
}
