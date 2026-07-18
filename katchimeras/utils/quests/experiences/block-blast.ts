export const BLOCK_BLAST_RULESET = 'cheerlet-block-party-v2' as const;
export const BLOCK_BLAST_LEGACY_RULESET = 'cheerlet-block-party-v1' as const;
export const BLOCK_BLAST_PACK = 'cheerlet-party' as const;
export const BLOCK_BLAST_BOARD_SIZE = 8;
export const BLOCK_BLAST_TRAY_ALGORITHM_VERSION = 2 as const;

export type BlockBlastColorId = 'rose' | 'amber' | 'teal' | 'coral' | 'blue';
export type BlockBlastCell = { row: number; column: number };
export type BlockBlastRotation = 0 | 1 | 2 | 3;
export type BlockBlastShapeRole = 'standard' | 'rescue' | 'last_resort';
export type BlockBlastShape = {
  id: string;
  familyId: string;
  rotation: BlockBlastRotation;
  cells: readonly BlockBlastCell[];
  weight: number;
  role: BlockBlastShapeRole;
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
  trayAlgorithmVersion: typeof BLOCK_BLAST_TRAY_ALGORITHM_VERSION;
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

// Mirrors the enabled PRESET_LIBRARY from the shared BlockTray implementation.
// The wider catalog remains available for compatibility, but normal V2 refills
// draw from this explicit pool so its signature pieces are not diluted.
export const BLOCK_BLAST_PRIMARY_TRAY_FAMILY_IDS = [
  'line-4',
  'line-5',
  'j-4',
  'l-4',
  'square-2',
  'z-4',
  't-4',
  'l-5',
  'square-3',
  'rectangle-2x3',
] as const;

const cells = (...coordinates: [number, number][]): readonly BlockBlastCell[] =>
  coordinates.map(([row, column]) => ({ row, column }));

type BlockBlastShapeFamily = Omit<BlockBlastShape, 'id' | 'familyId' | 'rotation'> & { id: string };

export const BLOCK_BLAST_SHAPE_FAMILIES: readonly BlockBlastShapeFamily[] = [
  { id: 'single', cells: cells([0, 0]), weight: 5, role: 'last_resort' },
  { id: 'domino', cells: cells([0, 0], [0, 1]), weight: 5, role: 'rescue' },
  { id: 'line-3', cells: cells([0, 0], [0, 1], [0, 2]), weight: 5, role: 'rescue' },
  { id: 'corner-3', cells: cells([0, 0], [1, 0], [1, 1]), weight: 4, role: 'rescue' },
  { id: 'square-2', cells: cells([0, 0], [0, 1], [1, 0], [1, 1]), weight: 3, role: 'standard' },
  { id: 'line-4', cells: cells([0, 0], [0, 1], [0, 2], [0, 3]), weight: 3, role: 'standard' },
  { id: 'l-4', cells: cells([0, 0], [1, 0], [2, 0], [2, 1]), weight: 3, role: 'standard' },
  { id: 'j-4', cells: cells([0, 1], [1, 1], [2, 0], [2, 1]), weight: 3, role: 'standard' },
  { id: 't-4', cells: cells([0, 0], [0, 1], [0, 2], [1, 1]), weight: 3, role: 'standard' },
  { id: 's-4', cells: cells([0, 1], [0, 2], [1, 0], [1, 1]), weight: 3, role: 'standard' },
  { id: 'z-4', cells: cells([0, 0], [0, 1], [1, 1], [1, 2]), weight: 3, role: 'standard' },
  { id: 'line-5', cells: cells([0, 0], [0, 1], [0, 2], [0, 3], [0, 4]), weight: 3, role: 'standard' },
  { id: 'l-5', cells: cells([0, 0], [1, 0], [2, 0], [2, 1], [2, 2]), weight: 3, role: 'standard' },
  { id: 'j-5', cells: cells([0, 2], [1, 2], [2, 0], [2, 1], [2, 2]), weight: 2, role: 'standard' },
  { id: 't-5', cells: cells([0, 0], [0, 1], [0, 2], [1, 1], [2, 1]), weight: 2, role: 'standard' },
  { id: 'plus-5', cells: cells([0, 1], [1, 0], [1, 1], [1, 2], [2, 1]), weight: 2, role: 'standard' },
  { id: 'u-5', cells: cells([0, 0], [0, 2], [1, 0], [1, 1], [1, 2]), weight: 2, role: 'standard' },
  { id: 'p-5', cells: cells([0, 0], [0, 1], [1, 0], [1, 1], [2, 0]), weight: 2, role: 'standard' },
  { id: 'q-5', cells: cells([0, 0], [0, 1], [1, 0], [1, 1], [2, 1]), weight: 2, role: 'standard' },
  { id: 'rectangle-2x3', cells: cells([0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]), weight: 3, role: 'standard' },
  { id: 'square-3', cells: cells([0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]), weight: 3, role: 'standard' },
] as const;

export const BLOCK_BLAST_SHAPES: readonly BlockBlastShape[] = BLOCK_BLAST_SHAPE_FAMILIES.flatMap((family) => {
  const rotations = uniqueBlockBlastRotations(family.cells);
  return rotations.map(({ rotation, cells: rotatedCells }) => ({
    id: rotations.length === 1 ? family.id : `${family.id}-r${rotation}`,
    familyId: family.id,
    rotation,
    cells: rotatedCells,
    role: family.role,
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
    trayAlgorithmVersion: BLOCK_BLAST_TRAY_ALGORITHM_VERSION,
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
  const combo = clearedLineCount ? state.combo + clearedLineCount : 0;
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

export function blockBlastStreakWord(combo: number): 'GOOD' | 'GREAT' | 'EPIC' | 'LEGENDARY' | 'GODLIKE' {
  const words = ['GOOD', 'GREAT', 'EPIC', 'LEGENDARY', 'GODLIKE'] as const;
  return words[Math.min(words.length - 1, Math.floor(Math.max(0, combo - 1) / 2))];
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

/** Compact, allocation-light lookup used by board hit targets and drag snapping. */
export function blockBlastValidOriginMask(
  board: readonly (BlockBlastColorId | null)[],
  pieceCells: readonly BlockBlastCell[],
): number[] {
  const mask = new Array<number>(BLOCK_BLAST_BOARD_SIZE * BLOCK_BLAST_BOARD_SIZE).fill(0);
  for (let row = 0; row < BLOCK_BLAST_BOARD_SIZE; row += 1) {
    for (let column = 0; column < BLOCK_BLAST_BOARD_SIZE; column += 1) {
      if (canPlaceBlockBlastPiece(board, pieceCells, row, column)) {
        mask[row * BLOCK_BLAST_BOARD_SIZE + column] = 1;
      }
    }
  }
  return mask;
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

export function blockBlastOriginFromFootprintCenter(
  pieceCells: readonly BlockBlastCell[],
  floatingCenterRow: number,
  floatingCenterColumn: number,
): { row: number; column: number } {
  const minimumRow = Math.min(...pieceCells.map((cell) => cell.row));
  const maximumRow = Math.max(...pieceCells.map((cell) => cell.row));
  const minimumColumn = Math.min(...pieceCells.map((cell) => cell.column));
  const maximumColumn = Math.max(...pieceCells.map((cell) => cell.column));
  return {
    row: floatingCenterRow - (minimumRow + maximumRow) / 2,
    column: floatingCenterColumn - (minimumColumn + maximumColumn) / 2,
  };
}

export function nearestBlockBlastWorldOrigin(
  board: readonly (BlockBlastColorId | null)[],
  pieceCells: readonly BlockBlastCell[],
  floatingFootprintCenter: { x: number; y: number },
  boardFirstCellCenter: { x: number; y: number },
  pitch: number,
  localSnapRadius = 1.65,
  boardCaptureMargin = 0.85,
): BlockBlastCell | null {
  if (!pieceCells.length || pitch <= 0) return null;

  let minimumPieceRow = Number.POSITIVE_INFINITY;
  let maximumPieceRow = Number.NEGATIVE_INFINITY;
  let minimumPieceColumn = Number.POSITIVE_INFINITY;
  let maximumPieceColumn = Number.NEGATIVE_INFINITY;
  for (const cell of pieceCells) {
    minimumPieceRow = Math.min(minimumPieceRow, cell.row);
    maximumPieceRow = Math.max(maximumPieceRow, cell.row);
    minimumPieceColumn = Math.min(minimumPieceColumn, cell.column);
    maximumPieceColumn = Math.max(maximumPieceColumn, cell.column);
  }
  const footprintCenterRow = (minimumPieceRow + maximumPieceRow) / 2;
  const footprintCenterColumn = (minimumPieceColumn + maximumPieceColumn) / 2;

  const capturePadding = (0.5 + boardCaptureMargin) * pitch;
  const boardLastCellCenterX = boardFirstCellCenter.x + (BLOCK_BLAST_BOARD_SIZE - 1) * pitch;
  const boardLastCellCenterY = boardFirstCellCenter.y + (BLOCK_BLAST_BOARD_SIZE - 1) * pitch;
  const floatingMinimumX = floatingFootprintCenter.x + (minimumPieceColumn - footprintCenterColumn) * pitch;
  const floatingMaximumX = floatingFootprintCenter.x + (maximumPieceColumn - footprintCenterColumn) * pitch;
  const floatingMinimumY = floatingFootprintCenter.y + (minimumPieceRow - footprintCenterRow) * pitch;
  const floatingMaximumY = floatingFootprintCenter.y + (maximumPieceRow - footprintCenterRow) * pitch;
  if (floatingMaximumX < boardFirstCellCenter.x - capturePadding
    || floatingMinimumX > boardLastCellCenterX + capturePadding
    || floatingMaximumY < boardFirstCellCenter.y - capturePadding
    || floatingMinimumY > boardLastCellCenterY + capturePadding) return null;

  const maximumOriginRow = BLOCK_BLAST_BOARD_SIZE - maximumPieceRow - 1;
  const maximumOriginColumn = BLOCK_BLAST_BOARD_SIZE - maximumPieceColumn - 1;
  const targetRow = (floatingFootprintCenter.y - boardFirstCellCenter.y) / pitch - footprintCenterRow;
  const targetColumn = (floatingFootprintCenter.x - boardFirstCellCenter.x) / pitch - footprintCenterColumn;
  const clampedTargetRow = Math.max(0, Math.min(maximumOriginRow, targetRow));
  const clampedTargetColumn = Math.max(0, Math.min(maximumOriginColumn, targetColumn));
  const geometricOrigin = { row: Math.round(clampedTargetRow), column: Math.round(clampedTargetColumn) };
  if (canPlaceBlockBlastPiece(board, pieceCells, geometricOrigin.row, geometricOrigin.column)) return geometricOrigin;

  let nearestValidOrigin: BlockBlastCell | null = null;
  let nearestValidDistanceSquared = Number.POSITIVE_INFINITY;
  const searchRadius = Math.ceil(localSnapRadius);
  for (let row = Math.max(0, geometricOrigin.row - searchRadius); row <= Math.min(maximumOriginRow, geometricOrigin.row + searchRadius); row += 1) {
    for (let column = Math.max(0, geometricOrigin.column - searchRadius); column <= Math.min(maximumOriginColumn, geometricOrigin.column + searchRadius); column += 1) {
      if (!canPlaceBlockBlastPiece(board, pieceCells, row, column)) continue;
      const localDistanceSquared = (row - geometricOrigin.row) ** 2 + (column - geometricOrigin.column) ** 2;
      if (localDistanceSquared > localSnapRadius ** 2) continue;
      const distanceSquared = (row - clampedTargetRow) ** 2 + (column - clampedTargetColumn) ** 2;
      if (distanceSquared < nearestValidDistanceSquared) {
        nearestValidOrigin = { row, column };
        nearestValidDistanceSquared = distanceSquared;
      }
    }
  }
  return nearestValidOrigin ?? geometricOrigin;
}

export function nearestSnappedBlockBlastOrigin(
  board: readonly (BlockBlastColorId | null)[],
  pieceCells: readonly BlockBlastCell[],
  targetRow: number,
  targetColumn: number,
  localSnapRadius = 1.65,
): BlockBlastCell | null {
  const geometricOrigin = nearestBlockBlastOrigin(pieceCells, targetRow, targetColumn);
  if (!geometricOrigin || canPlaceBlockBlastPiece(board, pieceCells, geometricOrigin.row, geometricOrigin.column)) {
    return geometricOrigin;
  }

  const pieceRows = Math.max(...pieceCells.map((cell) => cell.row)) + 1;
  const pieceColumns = Math.max(...pieceCells.map((cell) => cell.column)) + 1;
  const maximumRow = BLOCK_BLAST_BOARD_SIZE - pieceRows;
  const maximumColumn = BLOCK_BLAST_BOARD_SIZE - pieceColumns;
  const clampedTargetRow = Math.max(0, Math.min(maximumRow, targetRow));
  const clampedTargetColumn = Math.max(0, Math.min(maximumColumn, targetColumn));

  // If the nearest geometric origin is blocked, search for the closest nearby
  // origin where the complete piece fits. Measure from the board-clamped floating
  // origin so placements along an edge remain as forgiving as interior ones.
  // The radius includes cardinal and diagonal adjacent origins without allowing
  // a jump of two or more cells to a remote board opening.
  let nearestValid: BlockBlastCell | null = null;
  let nearestDistanceSquared = Number.POSITIVE_INFINITY;
  const searchRadius = Math.ceil(localSnapRadius);
  for (let row = Math.max(0, Math.floor(clampedTargetRow) - searchRadius); row <= Math.min(maximumRow, Math.ceil(clampedTargetRow) + searchRadius); row += 1) {
    for (let column = Math.max(0, Math.floor(clampedTargetColumn) - searchRadius); column <= Math.min(maximumColumn, Math.ceil(clampedTargetColumn) + searchRadius); column += 1) {
      if (!canPlaceBlockBlastPiece(board, pieceCells, row, column)) continue;
      const distanceSquared = (row - clampedTargetRow) ** 2 + (column - clampedTargetColumn) ** 2;
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

type BlockBlastPieceLike = { cells: readonly BlockBlastCell[] };

export function blockBlastTrayHasReservedPlacements(
  board: readonly (BlockBlastColorId | null)[],
  pieces: readonly BlockBlastPieceLike[],
): boolean {
  if (!pieces.length) return false;
  const ordered = pieces
    .map((piece, index) => ({ index, piece, originCount: validBlockBlastOrigins(board, piece.cells).length }))
    .sort((left, right) => left.originCount - right.originCount || left.index - right.index);

  const reserve = (shadowBoard: readonly (BlockBlastColorId | null)[], pieceIndex: number): boolean => {
    if (pieceIndex >= ordered.length) return true;
    const piece = ordered[pieceIndex].piece;
    for (const origin of validBlockBlastOrigins(shadowBoard, piece.cells)) {
      const next = [...shadowBoard];
      piece.cells.forEach((cell) => {
        next[boardIndex(origin.row + cell.row, origin.column + cell.column)] = 'rose';
      });
      if (reserve(next, pieceIndex + 1)) return true;
    }
    return false;
  };

  return ordered.every((entry) => entry.originCount > 0) && reserve(board, 0);
}

export function blockBlastTrayIsCompletable(
  board: readonly (BlockBlastColorId | null)[],
  pieces: readonly BlockBlastPieceLike[],
  maximumVisitedStates = 20_000,
): boolean {
  if (!pieces.length) return false;
  if (blockBlastTrayHasReservedPlacements(board, pieces)) return true;

  const failed = new Set<string>();
  let visitedStates = 0;
  const search = (currentBoard: readonly (BlockBlastColorId | null)[], remaining: readonly number[]): boolean => {
    if (!remaining.length) return true;
    const key = `${remaining.join(',')}:${currentBoard.map((cell) => cell ? '1' : '0').join('')}`;
    if (failed.has(key)) return false;
    if (visitedStates >= maximumVisitedStates) return false;
    visitedStates += 1;

    for (const pieceIndex of remaining) {
      const piece = pieces[pieceIndex];
      const outcomes = validBlockBlastOrigins(currentBoard, piece.cells).map((origin) => {
        const nextBoard = proofBoardAfterPlacement(currentBoard, piece.cells, origin);
        return { nextBoard, origin, emptyCount: nextBoard.filter((cell) => cell == null).length };
      }).sort((left, right) => right.emptyCount - left.emptyCount
        || left.origin.row - right.origin.row
        || left.origin.column - right.origin.column);
      const nextRemaining = remaining.filter((candidate) => candidate !== pieceIndex);
      for (const outcome of outcomes) {
        if (search(outcome.nextBoard, nextRemaining)) return true;
      }
    }

    failed.add(key);
    return false;
  };

  return search(board, pieces.map((_, index) => index));
}

export function generateBlockBlastTray(
  board: readonly (BlockBlastColorId | null)[],
  startingRngState: number,
  generation: number,
): { tray: BlockBlastPiece[]; rngState: number } {
  let rngState = startingRngState || 1;
  if (board.every(Boolean)) return { tray: [], rngState };
  const primaryFamilies: ReadonlySet<string> = new Set(BLOCK_BLAST_PRIMARY_TRAY_FAMILY_IDS);
  const standardShapes = BLOCK_BLAST_SHAPES.filter((shape) => primaryFamilies.has(shape.familyId));
  const rescueShapes = BLOCK_BLAST_SHAPES.filter((shape) => shape.role === 'rescue');
  const sequenceFallbacks: BlockBlastShape[][] = [];
  let selected: BlockBlastShape[] | null = null;

  for (let attempt = 0; attempt < 32 && !selected; attempt += 1) {
    const generated = pickDiverseShapes(standardShapes, 3, rngState, new Set(), 1);
    rngState = generated.rngState;
    if (!generated.shapes) continue;
    if (blockBlastTrayHasReservedPlacements(board, generated.shapes)) selected = generated.shapes;
    else sequenceFallbacks.push(generated.shapes);
  }

  for (let attempt = 0; attempt < 24 && !selected; attempt += 1) {
    const rescueCount = 1 + attempt % 2;
    const rescue = pickDiverseShapes(rescueShapes, rescueCount, rngState);
    rngState = rescue.rngState;
    if (!rescue.shapes) continue;
    const usedFamilies = new Set(rescue.shapes.map((shape) => shape.familyId));
    const standard = pickDiverseShapes(standardShapes, 3 - rescueCount, rngState, usedFamilies, 1);
    rngState = standard.rngState;
    if (!standard.shapes) continue;
    const shuffled = seededShuffle([...rescue.shapes, ...standard.shapes], rngState);
    rngState = shuffled.rngState;
    if (blockBlastTrayHasReservedPlacements(board, shuffled.values)) selected = shuffled.values;
    else sequenceFallbacks.push(shuffled.values);
  }

  const rescueLadder = [
    ['domino', 'line-3', 'corner-3'],
    ['domino', 'domino', 'corner-3'],
    ['single', 'domino', 'corner-3'],
    ['single', 'single', 'domino'],
    ['single', 'single', 'single'],
  ] as const;
  for (const families of rescueLadder) {
    for (let attempt = 0; attempt < 16 && !selected; attempt += 1) {
      const candidate: BlockBlastShape[] = [];
      for (const familyId of families) {
        const familyShapes = BLOCK_BLAST_SHAPES.filter((shape) => shape.familyId === familyId);
        const picked = weightedPick(familyShapes, rngState);
        candidate.push(picked[0]);
        rngState = picked[1];
      }
      const shuffled = seededShuffle(candidate, rngState);
      rngState = shuffled.rngState;
      if (blockBlastTrayHasReservedPlacements(board, shuffled.values)) selected = shuffled.values;
      else sequenceFallbacks.push(shuffled.values);
    }
    if (selected) break;
  }

  // Only use a line-clear-dependent sequence after every bounded reserved
  // standard, mixed, and emergency option has failed. In ordinary play this
  // means all three visible pieces have valid, non-overlapping homes immediately.
  if (!selected) {
    selected = sequenceFallbacks.find((candidate) => blockBlastTrayIsCompletable(board, candidate)) ?? null;
  }

  if (!selected) return { tray: [], rngState };
  const colors = seededShuffle([...COLORS], rngState);
  rngState = colors.rngState;
  const tray = selected.map((shape, index): BlockBlastPiece => ({
    id: `tray-${generation}-${index}-${shape.id}-${rngState.toString(36)}`,
    shapeId: shape.id,
    cells: shape.cells,
    colorId: colors.values[index],
    used: false,
  }));
  return { tray, rngState };
}

function pickDiverseShapes(
  pool: readonly BlockBlastShape[],
  count: number,
  startingRngState: number,
  initialFamilies = new Set<string>(),
  maximumLargePieces = Number.POSITIVE_INFINITY,
): { shapes: BlockBlastShape[] | null; rngState: number } {
  let rngState = startingRngState;
  const families = new Set(initialFamilies);
  const shapes: BlockBlastShape[] = [];
  let largePieces = 0;
  for (let index = 0; index < count; index += 1) {
    const eligible = pool.filter((shape) => !families.has(shape.familyId)
      && (shape.cells.length < 6 || largePieces < maximumLargePieces));
    if (!eligible.length) return { shapes: null, rngState };
    const picked = weightedPick(eligible, rngState);
    const shape = picked[0];
    rngState = picked[1];
    shapes.push(shape);
    families.add(shape.familyId);
    if (shape.cells.length >= 6) largePieces += 1;
  }
  return { shapes, rngState };
}

function seededShuffle<T>(values: readonly T[], startingRngState: number): { values: T[]; rngState: number } {
  const shuffled = [...values];
  let rngState = startingRngState;
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const random = nextRandom(rngState);
    rngState = random.state;
    const swapIndex = Math.floor(random.value * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return { values: shuffled, rngState };
}

function proofBoardAfterPlacement(
  board: readonly (BlockBlastColorId | null)[],
  pieceCells: readonly BlockBlastCell[],
  origin: BlockBlastCell,
): (BlockBlastColorId | null)[] {
  const next = [...board];
  pieceCells.forEach((cell) => {
    next[boardIndex(origin.row + cell.row, origin.column + cell.column)] = 'rose';
  });
  const cleared = completedLines(next);
  cleared.rows.forEach((row) => {
    for (let column = 0; column < BLOCK_BLAST_BOARD_SIZE; column += 1) next[boardIndex(row, column)] = null;
  });
  cleared.columns.forEach((column) => {
    for (let row = 0; row < BLOCK_BLAST_BOARD_SIZE; row += 1) next[boardIndex(row, column)] = null;
  });
  return next;
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
