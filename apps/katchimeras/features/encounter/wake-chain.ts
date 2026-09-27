import { MERGE_ITEMS_BY_ID, MERGE_WORLD_COLUMNS } from '@/constants/merge-world-catalog';
import type { EncounterDefinition } from '@/types/encounter';
import type { MergeItemDefinition } from '@/types/merge-world';

/**
 * Can a board wake everything it shows asleep? A sleeper (half Mist) wakes only when its twin is brought to it, and a
 * veiled piece (full Mist) opens only when a sleeper beside it (same row or column) wakes. So a level can show pieces
 * under the Mist it can never reach, or, with no Seeds coming in, run out of the pieces that wake them.
 *
 * This plays the chain greedily: wake any sleeper whose twin is loose, else merge two pieces into the twin a sleeper
 * needs. A Seed source on the board (the Seed Sprinkler, a Seed Pod, or Seeds landing on their own) never runs out of
 * Seeds. What is left asleep at the end could never be woken.
 */
export type WakeChainResult = {
  /** Cells still asleep (under half or full Mist) when nothing more can be woken. */
  asleep: number[];
  /** Pieces loose once every wake that could be made was made (a Seed source counts as none). */
  spare: number;
  /** Whether Seeds keep coming in (a Sprinkler, a Pod, or Seeds on their own). */
  seedSource: boolean;
};

const neighbours = (cell: number) => {
  const column = cell % MERGE_WORLD_COLUMNS;
  return [cell - MERGE_WORLD_COLUMNS, cell + MERGE_WORLD_COLUMNS, ...(column > 0 ? [cell - 1] : []), ...(column < MERGE_WORLD_COLUMNS - 1 ? [cell + 1] : [])];
};

export function wakeChain(encounter: EncounterDefinition, items: ReadonlyMap<string, MergeItemDefinition> = MERGE_ITEMS_BY_ID): WakeChainResult {
  const mechanic = encounter.mechanic?.kind === 'lanes' ? encounter.mechanic : null;
  const seedDrop = 'nature:garden:1';
  const seedSource = Boolean(mechanic?.seeds) || encounter.spawners.some((spawner) => !spawner.hidden && spawner.charges > 0 && (spawner.drops ?? []).includes(seedDrop));
  const loose = new Map<string, number>();
  const add = (id: string, count: number) => loose.set(id, (loose.get(id) ?? 0) + count);
  for (const item of encounter.seed.items) add(item.definitionId, 1);
  const have = (id: string) => (seedSource && id === seedDrop ? Infinity : loose.get(id) ?? 0);
  const take = (id: string, count: number) => { if (!(seedSource && id === seedDrop)) add(id, -count); };
  const echoes = new Map<number, string>((encounter.seed.echoes ?? []).map((echo) => [echo.cell, echo.definitionId]));
  const veiled = new Map<number, string>((encounter.seed.veiled ?? []).map((entry) => [entry.cell, entry.definitionId]));
  const previous = (id: string) => { for (const [candidate, item] of items) if (item.nextItemId === id) return candidate; return null; };

  for (;;) {
    const wakeable = [...echoes].find(([, id]) => have(id) > 0);
    if (wakeable) {
      const [cell, id] = wakeable;
      take(id, 1);
      const next = items.get(id)?.nextItemId;
      if (next) add(next, 1);
      echoes.delete(cell);
      for (const beside of neighbours(cell)) {
        const hidden = veiled.get(beside);
        if (hidden == null) continue;
        veiled.delete(beside);
        echoes.set(beside, hidden);
      }
      continue;
    }
    // Nothing wakes as it stands: merge two pieces into the twin a sleeper needs (the lowest first).
    const needs = [...echoes.values()].map((id) => ({ id, from: previous(id) })).filter((need): need is { id: string; from: string } => need.from != null && have(need.from) >= 2)
      .sort((a, b) => (items.get(a.id)?.tier ?? 0) - (items.get(b.id)?.tier ?? 0));
    if (!needs.length) break;
    take(needs[0]!.from, 2);
    add(needs[0]!.id, 1);
  }
  const spare = [...loose].reduce((sum, [id, count]) => sum + (seedSource && id === seedDrop ? 0 : Math.max(0, count)), 0);
  return { asleep: [...echoes.keys(), ...veiled.keys()].sort((a, b) => a - b), spare, seedSource };
}
