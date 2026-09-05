import { COMPANION_BOARD_ALLOCATIONS, type CompanionDiscoveryDefinition } from '@/constants/companion-discovery-catalog';
import {
  MOSSPROUT_GARDEN_GROWTH_BY_CELL,
  MOSSPROUT_GARDEN_GROWTH_CLEARINGS,
  MOSSPROUT_ROOTBOUND_GATES,
  MERGE_STARTING_OPEN_CELLS,
} from '@/constants/merge-world-catalog';
import type { MergeBoardCell, MergeCharacterId, MergeDreamMist, MergeWorldState } from '@/types/merge-world';

const ROOTBOUND_CELLS = new Set(MOSSPROUT_ROOTBOUND_GATES.map((gate) => gate.cell));

const DISCOVERY_CHARACTERS_BY_CELL = new Map<number, MergeCharacterId[]>();
for (const allocation of COMPANION_BOARD_ALLOCATIONS) {
  for (const cell of allocation.cells) {
    if (ROOTBOUND_CELLS.has(cell) || MOSSPROUT_GARDEN_GROWTH_BY_CELL.has(cell)) continue;
    const characters = DISCOVERY_CHARACTERS_BY_CELL.get(cell) ?? [];
    if (!characters.includes(allocation.characterId)) characters.push(allocation.characterId);
    DISCOVERY_CHARACTERS_BY_CELL.set(cell, characters);
  }
}

/** Classifies every covered non-root cell so legacy dormant fog has an owner. */
export function authoredDormantMistForCell(cell: number): MergeDreamMist {
  const clearing = MOSSPROUT_GARDEN_GROWTH_BY_CELL.get(cell);
  if (clearing) return { kind: 'garden_growth', clearingId: clearing.id, revealDay: clearing.revealDay };
  // Personal worlds reserve their remaining mist for that companion's future
  // regions. Discovering another Katchimera must never annex Mossprout's board.
  return { kind: 'dormant' };
}

export function reconcileGardenGrowthMist(state: MergeWorldState, activeJourneyDays: number, now: number): MergeWorldState {
  const eligible = MOSSPROUT_GARDEN_GROWTH_CLEARINGS.filter((clearing) => activeJourneyDays >= clearing.revealDay);
  if (!eligible.length) return state;
  let board = state.board;
  let expansions = state.expansions;
  let receipts = state.boardAwakeningReceipts;

  for (const clearing of eligible) {
    const clearedCells: number[] = [];
    for (const cell of clearing.cells) {
      const current = board[cell];
      if (current?.mist?.kind !== 'garden_growth' || current.occupant) continue;
      if (board === state.board) board = [...state.board];
      board[cell] = { ...current, locked: false, blocker: null, mist: null };
      clearedCells.push(cell);
    }
    if (!expansions.includes(clearing.id)) expansions = [...expansions, clearing.id];
    const receiptId = `garden-growth:${clearing.id}`;
    if (!receipts.some((receipt) => receipt.id === receiptId)) {
      receipts = [...receipts, { id: receiptId, source: 'story', clearedCells, createdAt: now }];
    }
  }

  if (board === state.board && expansions === state.expansions && receipts === state.boardAwakeningReceipts) return state;
  return { ...state, board, expansions, boardAwakeningReceipts: receipts };
}

/** Companion-owned mist opens when that companion joins by any supported route. */
export function reconcileDiscoveryMist(state: MergeWorldState, now: number): MergeWorldState {
  const owned = new Set(state.unlockedCharacters);
  let board = state.board;
  const clearedByCharacter = new Map<MergeCharacterId, number[]>();
  state.board.forEach((cell, index) => {
    if (cell.mist?.kind !== 'discovery_dormant' || cell.occupant) return;
    const owner = cell.mist.characterIds.find((characterId) => owned.has(characterId));
    if (!owner) return;
    if (board === state.board) board = [...state.board];
    board[index] = { ...cell, locked: false, blocker: null, mist: null };
    clearedByCharacter.set(owner, [...(clearedByCharacter.get(owner) ?? []), index]);
  });
  if (board === state.board) return state;

  let receipts = state.boardAwakeningReceipts;
  for (const [characterId, clearedCells] of clearedByCharacter) {
    const id = `discovery-mist:${characterId}`;
    if (!receipts.some((receipt) => receipt.id === id)) receipts = [...receipts, { id, source: 'story', clearedCells, createdAt: now }];
  }
  return { ...state, board, boardAwakeningReceipts: receipts };
}

function pathCellAvailable(cell: MergeBoardCell | undefined) {
  if (!cell || cell.occupant) return false;
  return cell.mist == null
    || cell.mist.kind === 'dormant'
    || cell.mist.kind === 'garden_growth'
    || cell.mist.kind === 'discovery_dormant';
}

/** Avoids deleting an item or overwriting a Mossprout root when a trail wakes. */
export function allocateCompanionDiscoveryPath(
  board: readonly MergeBoardCell[],
  definition: CompanionDiscoveryDefinition,
): number[] | null {
  const result: number[] = [];
  const add = (cell: number) => {
    if (result.length >= definition.stages.length || result.includes(cell) || !pathCellAvailable(board[cell])) return;
    result.push(cell);
  };
  definition.pathCells.forEach(add);
  board.forEach((cell, index) => {
    if (cell.mist?.kind === 'discovery_dormant' && cell.mist.characterIds.includes(definition.characterId)) add(index);
  });
  board.forEach((cell, index) => { if (cell.mist?.kind === 'discovery_dormant') add(index); });
  board.forEach((cell, index) => { if (cell.mist?.kind === 'garden_growth') add(index); });
  board.forEach((_cell, index) => add(index));
  return result.length === definition.stages.length ? result : null;
}

export function allocateDiscoveryForkAnchor(board: readonly MergeBoardCell[], preferred: number) {
  if (pathCellAvailable(board[preferred])) return preferred;
  const discoveryCell = board.findIndex((cell) => cell.mist?.kind === 'discovery_dormant' && !cell.occupant);
  if (discoveryCell >= 0) return discoveryCell;
  const growthCell = board.findIndex((cell) => cell.mist?.kind === 'garden_growth' && !cell.occupant);
  if (growthCell >= 0) return growthCell;
  return board.findIndex((cell) => pathCellAvailable(cell));
}

export function boardMistPartitionIssues() {
  const issues: string[] = [];
  const open = MERGE_STARTING_OPEN_CELLS.size;
  const roots = ROOTBOUND_CELLS.size;
  const growth = MOSSPROUT_GARDEN_GROWTH_BY_CELL.size;
  const reserved = 63 - open - roots - growth;
  if (reserved < 0 || open + roots + growth + reserved !== 63) issues.push(`Board mist partition covers ${open + roots + growth + reserved} of 63 cells.`);
  return issues;
}
