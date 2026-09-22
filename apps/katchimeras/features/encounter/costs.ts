import type { MergeWorldCommand, MergeWorldCommandResult } from '@/types/merge-world';

/**
 * What an action costs in Resolve. A merge (waking a sleeper is a merge) and
 * a spawner tap each spend one; sliding a piece, using an ability and opening
 * the cache spend nothing. Numbers only here.
 */
export const RESOLVE_COSTS = { merge: 1, tap: 1, move: 0, ability: 0, cache: 0 } as const;
export type EncounterAction = keyof typeof RESOLVE_COSTS;

/** The action a board command turned out to be, by its result; null when nothing happened. */
export function actionOf(command: MergeWorldCommand, result: MergeWorldCommandResult): EncounterAction | null {
  if (!result.changed) return null;
  if (command.type === 'move') return result.mergedCell != null ? 'merge' : 'move';
  if (command.type === 'tapGenerator') return result.spawnedCell != null ? 'tap' : null;
  return null;
}

export const resolveCost = (action: EncounterAction): number => RESOLVE_COSTS[action];
