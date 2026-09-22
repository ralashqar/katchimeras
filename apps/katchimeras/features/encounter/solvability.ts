import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { createMechanicState, resolveMechanic, wispViews } from '@/features/mission-mechanics/mechanic';
import { ENCOUNTER_DEFAULT_SAFETY_MARGIN, type EncounterDefinition, type EncounterLoadout } from '@/types/encounter';
import type { MergeItemDefinition, MergeWorldState } from '@/types/merge-world';
import type { MissionMechanicState } from '@/types/mission-mechanic';
import { reduceMergeWorld, reduceMissionMove } from '@/utils/merge-world/engine';
import { encounterMechanicHost } from './adapt';
import { canOpenCache, openCache } from './cache';
import { createEncounterState, encounterWindow } from './create-state';
import { createEncounterRun, encounterStatus, type EncounterRunState } from './encounter-run';
import { settleAction, tapSeed } from './settle';

/** How many distinct positions the search may pass through before it is called off: a guard, not a rule. */
export const MAX_SOLVE_STATES = 60_000;
/**
 * Past this many positions at one cost, the search keeps only the most promising (least wisp health left, least
 * Mist): a board with spawners branches on every tap, and a full search would never end. The shortest play it then
 * finds is an upper bound, reported as not proven.
 */
export const SOLVE_BEAM = 300;

export type EncounterSolution = {
  /** The fewest Resolve-costing actions that clear the board, or null when none was found within the bound. */
  minActions: number | null;
  /** The search finished: every reachable position was seen. */
  proven: boolean;
  /** Resolve minus the shortest play; null without a budget or a solution. */
  margin: number | null;
  states: number;
};

type Node = { state: MergeWorldState; run: EncounterRunState; mechanicState: MissionMechanicState };

/**
 * The shortest play through an encounter, by search over the same settling
 * the store uses. Spawner taps draw from the attempt's seed, so a tap's drop
 * is what the player would get on that attempt; the search is a model of one
 * seed, not a proof over every drop. Cheap actions (the cache) never cost;
 * the search is a 0-1 breadth-first walk, so the first clear found is the
 * shortest.
 */
export function solveEncounter(encounter: EncounterDefinition, input: { loadout?: EncounterLoadout | null; attempt?: number; maxStates?: number; items?: ReadonlyMap<string, MergeItemDefinition> } = {}): EncounterSolution {
  const items = input.items ?? MERGE_ITEMS_BY_ID;
  const host = encounterMechanicHost(encounter);
  const mechanic = resolveMechanic(host);
  const window = encounterWindow(encounter);
  const binding = { encounter, host, window, items };
  const now = Date.UTC(2026, 0, 1);
  const maxStates = input.maxStates ?? MAX_SOLVE_STATES;
  const start: Node = { state: createEncounterState(encounter, 'mossprout', now), run: createEncounterRun(encounter, { loadout: input.loadout ?? null, attempt: input.attempt ?? 1 }), mechanicState: createMechanicState(mechanic) };
  const key = (node: Node) => JSON.stringify([
    window.cellIndices.map((cell) => {
      const entry = node.state.board[cell]!;
      const mist = entry.mist;
      return [entry.occupant?.kind === 'item' ? entry.occupant.definitionId : entry.occupant?.kind === 'generator' ? `#${entry.occupant.generatorId}:${node.state.generators[entry.occupant.generatorId]?.charges ?? 0}` : null,
        mist ? [mist.kind, mist.kind === 'echo' ? mist.definitionId : mist.kind === 'veiled' ? mist.echo.definitionId : mist.kind === 'encounter' ? `${mist.type}:${mist.hp}` : null] : null];
    }),
    node.mechanicState, node.run.cacheOpened, node.run.actions,
  ]);
  const seen = new Set<string>();
  // Two queues: positions at the current cost, and at cost + 1.
  let frontier: Node[] = [start];
  let cost = 0;
  let states = 0;
  let truncated = false;
  const promise = (node: Node) => {
    const left = wispViews(mechanic, host, node.mechanicState).reduce((sum, wisp) => sum + (wisp.alive ? wisp.hp - wisp.damage : 0), 0);
    const mist = window.cellIndices.filter((cell) => node.state.board[cell]?.mist).length;
    return left * 10 + mist;
  };
  while (frontier.length) {
    const nextFrontier: Node[] = [];
    // Zero-cost moves stay in this frontier: the cache opening.
    const queue = [...frontier];
    while (queue.length) {
      const node = queue.shift()!;
      const signature = key(node);
      if (seen.has(signature)) continue;
      seen.add(signature);
      states += 1;
      if (states > maxStates) return { minActions: null, proven: false, margin: null, states };
      const status = encounterStatus(encounter, host, node.mechanicState, node.run, node.state, window);
      if (status === 'cleared') return { minActions: cost, proven: !truncated, margin: encounter.resolve == null ? null : encounter.resolve - cost, states };
      if (status === 'failed') continue;
      if (canOpenCache(status, node.run)) {
        const cache = openCache(encounter, node.state, window, node.run, items);
        if (cache.placed.length) queue.push({ state: cache.board, run: cache.run, mechanicState: node.mechanicState });
        continue;
      }
      const itemCells = window.cellIndices.filter((index) => node.state.board[index]?.occupant?.kind === 'item');
      const targets = window.cellIndices.filter((index) => node.state.board[index]?.occupant?.kind === 'item' || node.state.board[index]?.mist?.kind === 'echo');
      for (const from of itemCells) for (const to of targets) {
        if (from === to) continue;
        const result = reduceMissionMove(node.state, from, to, now, items);
        if (!result.changed || result.mergedCell == null) continue;
        const settled = settleAction(binding, node, { type: 'move', from, to, now }, result);
        if (settled.refused) continue;
        nextFrontier.push({ state: settled.state, run: settled.run, mechanicState: settled.mechanicState });
      }
      for (const index of window.cellIndices) {
        const occupant = node.state.board[index]?.occupant;
        if (occupant?.kind !== 'generator') continue;
        const command = { type: 'tapGenerator' as const, generatorId: occupant.generatorId, now, seed: tapSeed(node.run), spendEnergy: false as const, enforceCharges: true as const };
        const result = reduceMergeWorld(node.state, command);
        if (!result.changed || result.spawnedCell == null) continue;
        const settled = settleAction(binding, node, command, result);
        if (settled.refused) continue;
        nextFrontier.push({ state: settled.state, run: settled.run, mechanicState: settled.mechanicState });
      }
    }
    if (nextFrontier.length > SOLVE_BEAM) {
      truncated = true;
      frontier = nextFrontier.map((node) => ({ node, score: promise(node) })).sort((a, b) => a.score - b.score).slice(0, SOLVE_BEAM).map((entry) => entry.node);
    } else frontier = nextFrontier;
    cost += 1;
  }
  return { minActions: null, proven: !truncated, margin: null, states };
}

/** Issues the solver raises for an authored encounter: no clear found, or a budget too tight for the shortest play. */
export function encounterSolvabilityIssues(encounter: EncounterDefinition, solution: EncounterSolution = solveEncounter(encounter)): string[] {
  const issues: string[] = [];
  if (solution.minActions == null) {
    issues.push(solution.proven ? `${encounter.id}: the board cannot be finished` : `${encounter.id}: the board has more positions than can be checked (${MAX_SOLVE_STATES})`);
    return issues;
  }
  if (encounter.resolve != null) {
    const margin = encounter.resolve - solution.minActions;
    const safety = encounter.safetyMargin ?? ENCOUNTER_DEFAULT_SAFETY_MARGIN;
    if (margin < safety) issues.push(`${encounter.id}: Resolve ${encounter.resolve} leaves ${margin} over the shortest play of ${solution.minActions}; at least ${safety} is needed`);
  }
  return issues;
}
