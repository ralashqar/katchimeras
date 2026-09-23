import { MERGE_GENERATORS, MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { missionWindow } from '@/features/mission-mechanics/board-window';
import type { EncounterDefinition, EncounterSpawner } from '@/types/encounter';
import { ENCOUNTER_BUDGETS } from '@/constants/encounters/budgets.generated';
import { encounterFingerprint } from './run-id';
import { solveEncounter } from './solvability';

/**
 * A Resolve budget read off the board itself: the shortest play the search
 * finds, plus a margin (three, or two fifths of the play, whichever is more).
 * A board the search cannot clear (a column-shot board whose misses are
 * lost, whose twins cache opens only once) is given a refill spawner of its
 * own chain first, so no rung is ever authored unwinnable. A board already
 * carrying a budget, and a timed rush, are left as they are. Memoised: the
 * search runs once per authored board.
 */
export const budgetMargin = (shortest: number) => Math.max(3, Math.ceil(shortest * 0.4));

const memo = new Map<string, EncounterDefinition>();

/** The item maker whose chain the piece is from; the Garden Basket making it by name when no maker owns the chain. */
function refillSpawner(encounter: EncounterDefinition): EncounterSpawner | null {
  const seeded = [...encounter.seed.items, ...encounter.seed.echoes, ...encounter.seed.veiled];
  const first = seeded.map((entry) => MERGE_ITEMS_BY_ID.get(entry.definitionId)).find(Boolean);
  if (!first) return null;
  const tierOne = `${first.chainId}:${first.branchId}:1`;
  const drop = MERGE_ITEMS_BY_ID.has(tierOne) ? tierOne : first.id;
  const chain = `${first.chainId}:${first.branchId}`;
  const maker = MERGE_GENERATORS.find((generator) => generator.chainIds.includes(chain as never)) ?? MERGE_GENERATORS.find((generator) => generator.id === 'wild-garden')!;
  const used = new Set<number>([...seeded.map((entry) => entry.cell), ...encounter.mist.map((mist) => mist.cell), ...encounter.spawners.map((spawner) => spawner.cell)]);
  const cells = missionWindow(encounter.rows).cellIndices;
  const cell = [...cells].reverse().find((index) => !used.has(index));
  if (cell == null || encounter.spawners.some((spawner) => spawner.generatorId === maker.id)) return null;
  return { id: 'refill', generatorId: maker.id, cell, charges: Math.max(4, Math.ceil(encounter.required / 2)), drops: [drop], recharge: { kind: 'merges', every: 3, amount: 1 } };
}

/** The search's budget for a board with none: pure, slow; what the generated table is built from. */
export function solveBudget(encounter: EncounterDefinition): { resolve: number; refill: EncounterSpawner | null } {
  let board = encounter;
  let refill: EncounterSpawner | null = null;
  let solution = solveEncounter(board);
  if (solution.minActions == null) {
    refill = refillSpawner(board);
    if (refill) {
      board = { ...board, spawners: [...board.spawners, refill] };
      solution = solveEncounter(board);
    }
  }
  // Still no clear within the search's bound: a generous budget, so the soft loss is never a wall.
  return { resolve: solution.minActions == null ? 30 : solution.minActions + budgetMargin(solution.minActions), refill };
}

export const budgetKey = (encounter: EncounterDefinition) => `${encounter.id}:${encounterFingerprint(encounter)}`;

export function withSolvedBudget(encounter: EncounterDefinition, options: { rush?: boolean } = {}): EncounterDefinition {
  // A territory battle has no Resolve budget to read.
  if (options.rush || encounter.resolve != null || encounter.territory != null) return encounter;
  const key = budgetKey(encounter);
  const cached = memo.get(key);
  if (cached) return cached;
  // The bundled boards' budgets are generated ahead of time (`npm run encounters:budgets`); only a pack's new board is searched here.
  const budget = ENCOUNTER_BUDGETS[key] ?? solveBudget(encounter);
  const resolved: EncounterDefinition = { ...encounter, resolve: budget.resolve, ...(budget.refill ? { spawners: [...encounter.spawners, budget.refill] } : {}) };
  memo.set(key, resolved);
  return resolved;
}
