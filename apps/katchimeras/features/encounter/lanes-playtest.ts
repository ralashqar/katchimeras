import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { laneArrived, laneAlive, laneColumn, laneFire, laneOf, lanesTick } from '@/features/mission-mechanics/lanes';
import { createMechanicState, resolveMechanic } from '@/features/mission-mechanics/mechanic';
import type { EncounterDefinition } from '@/types/encounter';
import type { MergeItemDefinition, MergeWorldCommand, MergeWorldState } from '@/types/merge-world';
import { reduceMergeWorld, reduceMissionMove } from '@/utils/merge-world/engine';
import { encounterMechanicHost } from './adapt';
import { canOpenCache, openCache } from './cache';
import { createEncounterState, encounterWindow } from './create-state';
import { createEncounterRun, encounterStatus, lossReason, type EncounterLossReason } from './encounter-run';
import { seededUnit } from './seed';
import { settleAction, tapSeed, type SettleBefore } from './settle';

/**
 * A Lanes level played on its clock (`docs/encounter-lanes.md`), for tuning and tests. The level ticks every 100 ms;
 * the player acts every so often:
 * - careful (every 1.2 s): merges up under the wisps, moves a firing piece into a column nobody is covering, taps the Pod;
 * - careless (every 3 s), a novice: reads the board as the careful player does, but two times in five does something
 *   else it could do instead;
 * - idle: never touches the board.
 */
export type LanesStyle = 'careful' | 'careless' | 'idle';
export type LanesPlaytestResult = { won: boolean; reason: EncounterLossReason | null; ms: number; actions: number; /** The wisp that got through, if one did. */ breached: string | null };

const NOW = 1_000;
const TICK_MS = 100;
const THINK_MS: Record<LanesStyle, number> = { careful: 1_200, careless: 3_000, idle: Number.POSITIVE_INFINITY };

export function lanesPlaytest(encounter: EncounterDefinition, input: { style: LanesStyle; attempt?: number; maxMs?: number; items?: ReadonlyMap<string, MergeItemDefinition> }): LanesPlaytestResult {
  const items = input.items ?? MERGE_ITEMS_BY_ID;
  const host = encounterMechanicHost(encounter);
  const mechanic = resolveMechanic(host);
  if (mechanic.kind !== 'lanes') throw new Error(`${encounter.id} is not a Lanes level`);
  const window = encounterWindow(encounter);
  const binding = { encounter, host, window, items };
  const attempt = input.attempt ?? 1;
  let node: SettleBefore = { state: createEncounterState(encounter, 'mossprout', NOW), run: createEncounterRun(encounter, { attempt }), mechanicState: createMechanicState(mechanic) };
  const maxMs = input.maxMs ?? 300_000;
  const think = THINK_MS[input.style];
  let nextThink = think;
  let ms = 0;
  let actions = 0;

  const loose = (state: MergeWorldState, cell: number) => { const entry = state.board[cell]; return entry && !entry.locked && !entry.mist && entry.occupant?.kind === 'item' ? entry.occupant : null; };
  const isFree = (state: MergeWorldState, cell: number) => { const entry = state.board[cell]; return Boolean(entry) && !entry!.locked && !entry!.mist && !entry!.occupant; };
  const tierOf = (definitionId: string) => Math.floor(items.get(definitionId)?.tier ?? 1);
  const move = (from: SettleBefore, a: number, b: number): SettleBefore | null => {
    const command: MergeWorldCommand = { type: 'move', from: a, to: b, now: NOW };
    const result = reduceMissionMove(from.state, a, b, NOW, items);
    if (!result.changed) return null;
    const settled = settleAction(binding, from, command, result);
    return settled.refused ? null : { state: settled.state, run: settled.run, mechanicState: settled.mechanicState };
  };
  const tap = (from: SettleBefore): SettleBefore | null => {
    for (const cell of window.cellIndices) {
      const occupant = from.state.board[cell]?.occupant;
      if (occupant?.kind !== 'generator' || (from.state.generators[occupant.generatorId]?.charges ?? 0) <= 0) continue;
      const command = { type: 'tapGenerator' as const, generatorId: occupant.generatorId, now: NOW, seed: tapSeed(from.run), spendEnergy: false as const, enforceCharges: true as const };
      const result = reduceMergeWorld(from.state, command);
      if (!result.changed || result.spawnedCell == null) continue;
      const settled = settleAction(binding, from, command, result);
      if (settled.refused) continue;
      return { state: settled.state, run: { ...settled.run, actions: settled.run.actions + 1 }, mechanicState: settled.mechanicState };
    }
    return null;
  };
  // Each column's lowest standing wisp's row, or null.
  const threats = (at: SettleBefore): (number | null)[] => {
    const rows: (number | null)[] = Array.from({ length: window.columns }, () => null);
    if (at.mechanicState.kind !== 'lanes') return rows;
    const state = at.mechanicState;
    mechanic.wisps.forEach((_, index) => {
      if (!laneArrived(mechanic, state, index) || !laneAlive(mechanic, state, index)) return;
      const row = state.wisps[index]!.row;
      const column = laneColumn(mechanic, state, index);
      rows[column] = Math.max(rows[column] ?? -Infinity, row);
    });
    return rows;
  };
  // A cell is safe to put a piece on when no wisp is on it or about to come down onto it.
  const safe = (at: SettleBefore, cell: number) => { const place = laneOf(window, cell); const row = place ? threats(at)[place.column] : null; return !place || row == null || place.row > row + 1; };
  // Firepower already under each column's wisp.
  const cover = (at: SettleBefore) => {
    const rows = threats(at);
    return rows.map((row, column) => (row == null ? 0 : window.cellIndices.reduce((sum, cell) => {
      const place = laneOf(window, cell)!;
      const piece = loose(at.state, cell);
      const fire = piece ? laneFire(tierOf(piece.definitionId)) : null;
      return place.column === column && place.row > row && fire ? sum + fire.damage / fire.periodMs : sum;
    }, 0)));
  };

  const act = (from: SettleBefore): SettleBefore | null => {
    const cells = window.cellIndices;
    const rows = threats(from);
    const pairs: { a: number; b: number; tier: number; wake?: boolean }[] = [];
    for (const a of cells) {
      const pa = loose(from.state, a);
      if (!pa) continue;
      for (const b of cells) {
        const pb = a === b ? null : loose(from.state, b);
        if (pb && pb.definitionId === pa.definitionId && items.get(pa.definitionId)?.nextItemId) pairs.push({ a, b, tier: tierOf(pa.definitionId) + 1 });
        // A sleeper under half Mist wakes when its twin is brought to it (and opens the full Mist beside it).
        const sleeper = from.state.board[b]?.mist;
        if (sleeper?.kind === 'echo' && sleeper.definitionId === pa.definitionId) pairs.push({ a, b, tier: tierOf(pa.definitionId) + 1, wake: true });
      }
    }
    const room = cells.filter((cell) => isFree(from.state, cell)).length;
    // Careful: the best of a merge, a reposition and a tap.
    const covered = cover(from);
    type Choice = { score: number; run: () => SettleBefore | null };
    const choices: Choice[] = [];
    for (const pair of pairs) {
      const place = laneOf(window, pair.b)!;
      const row = rows[place.column];
      const under = row != null && place.row > row;
      choices.push({ score: pair.tier * 10 + (pair.wake ? 20 : 0) + (under ? 30 + (5 - covered[place.column]! * 1_000) : 0) - (safe(from, pair.b) ? 0 : 100), run: () => move(from, pair.a, pair.b) });
    }
    // The column most in danger that has the least cover: bring a firing piece from a column nobody is coming down.
    const danger = rows.map((row, column) => (row == null ? -1 : row + 3 - covered[column]! * 1_500)).map((score, column) => ({ score, column })).filter((entry) => entry.score >= 0).sort((x, y) => y.score - x.score)[0];
    if (danger) {
      const targets = cells.filter((cell) => laneOf(window, cell)!.column === danger.column && isFree(from.state, cell) && safe(from, cell)).sort((x, y) => laneOf(window, y)!.row - laneOf(window, x)!.row);
      const shooter = cells
        .filter((cell) => { const piece = loose(from.state, cell); const place = laneOf(window, cell)!; return piece && laneFire(tierOf(piece.definitionId)) && (rows[place.column] == null || covered[place.column]! > 0.0009); })
        .sort((x, y) => tierOf(loose(from.state, y)!.definitionId) - tierOf(loose(from.state, x)!.definitionId))[0];
      if (targets[0] != null && shooter != null) choices.push({ score: 25 + danger.score * 4, run: () => move(from, shooter, targets[0]!) });
    }
    const pieces = cells.filter((cell) => loose(from.state, cell)).length;
    if (room >= 2) choices.push({ score: pieces < 6 ? 45 : 12, run: () => tap(from) });
    choices.sort((x, y) => y.score - x.score);
    // A novice sees the same board but misjudges it: two times in five it does something else it could do.
    if (input.style === 'careless' && choices.length > 1 && seededUnit(`${attempt}:${ms}:slip`) < 0.4) {
      const pick = choices[1 + Math.floor(seededUnit(`${attempt}:${ms}:pick`) * (choices.length - 1))]!;
      const next = pick.run();
      if (next) return next;
    }
    for (const choice of choices) { const next = choice.run(); if (next) return next; }
    return null;
  };

  while (ms < maxMs) {
    const status = encounterStatus(encounter, host, node.mechanicState, node.run, node.state, window);
    if (status === 'cleared' || status === 'failed') break;
    if (canOpenCache(status, node.run)) {
      const cache = openCache(encounter, node.state, window, node.run, items);
      node = { ...node, state: cache.board, run: cache.run };
    }
    if (node.mechanicState.kind !== 'lanes') break;
    const ticked = lanesTick(mechanic, node.mechanicState, node.state, TICK_MS, window, items);
    node = { ...node, state: ticked.board, mechanicState: ticked.state };
    ms += TICK_MS;
    if (ms >= nextThink) {
      nextThink += think;
      const next = act(node);
      if (next) { node = next; actions += 1; }
    }
  }
  const status = encounterStatus(encounter, host, node.mechanicState, node.run, node.state, window);
  const breached = node.mechanicState.kind === 'lanes' && node.mechanicState.breached != null ? mechanic.wisps[node.mechanicState.breached]?.id ?? null : null;
  return { won: status === 'cleared', reason: status === 'cleared' ? null : lossReason(encounter, host, node.mechanicState, node.run, node.state, window) ?? 'spent', ms, actions, breached };
}

/** A Lanes level's record over several seeds. */
export function lanesFairness(encounter: EncounterDefinition, style: LanesStyle, seeds = 10): { wins: number; seeds: number; seconds: number } {
  let wins = 0;
  let total = 0;
  for (let attempt = 1; attempt <= seeds; attempt += 1) {
    const result = lanesPlaytest(encounter, { style, attempt });
    if (result.won) wins += 1;
    total += result.ms;
  }
  return { wins, seeds, seconds: Math.round(total / seeds / 1_000) };
}
