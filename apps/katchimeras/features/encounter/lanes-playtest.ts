import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { laneArrived, laneAlive, laneColumn, laneFire, laneOf, lanesTick, laneRowOf, laneZap, SEED_SPRINKLER_ID, STORM_CHAIN, STORM_POT_ID } from '@/features/mission-mechanics/lanes';
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
import { DEFAULT_ENCOUNTER_PROFILE, type EncounterProfile } from './encounter-run';
import { combatChain, combatFire, SECONDARY_CHAINS } from '@/features/mission-mechanics/combat-rules';

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

export function lanesPlaytest(encounter: EncounterDefinition, input: { style: LanesStyle; attempt?: number; maxMs?: number; items?: ReadonlyMap<string, MergeItemDefinition>; profile?: EncounterProfile; heroLevel?: number }): LanesPlaytestResult {
  const items = input.items ?? MERGE_ITEMS_BY_ID;
  const host = encounterMechanicHost(encounter, { wispSlow: input.profile?.wispSlow ?? 0 });
  const mechanic = resolveMechanic(host);
  if (mechanic.kind !== 'lanes') throw new Error(`${encounter.id} is not a Lanes level`);
  const window = encounterWindow(encounter);
  const binding = { encounter, host, window, items };
  const attempt = input.attempt ?? 1;
  const profile = input.profile ?? DEFAULT_ENCOUNTER_PROFILE;
  let node: SettleBefore = { state: createEncounterState(encounter, 'mossprout', NOW, profile), run: createEncounterRun(encounter, { attempt, profile, loadout: { companionId: 'mossprout', level: input.heroLevel ?? 1 } }), mechanicState: createMechanicState(mechanic) };
  const maxMs = input.maxMs ?? 300_000;
  const think = THINK_MS[input.style];
  let nextThink = think;
  let ms = 0;
  let actions = 0;

  const loose = (state: MergeWorldState, cell: number) => { const entry = state.board[cell]; return entry && !entry.locked && !entry.mist && entry.occupant?.kind === 'item' ? entry.occupant : null; };
  const isFree = (state: MergeWorldState, cell: number) => { const entry = state.board[cell]; return Boolean(entry) && !entry!.locked && !entry!.mist && !entry!.occupant; };
  const tierOf = (definitionId: string) => Math.floor(items.get(definitionId)?.tier ?? 1);
  // The Spark chain zaps what is near it instead of shooting up its column (`laneZap`).
  const isSpark = (definitionId: string) => items.get(definitionId)?.chainId === STORM_CHAIN;
  const shootsUp = (definitionId: string) => isSpark(definitionId) ? null : mechanic.rulesVersion === 2 ? combatFire(tierOf(definitionId), combatChain(definitionId) ?? 'garden') : laneFire(tierOf(definitionId));
  const move = (from: SettleBefore, a: number, b: number): SettleBefore | null => {
    if (encounter.fixedCells?.includes(a) || encounter.fixedCells?.includes(b)) return null;
    const command: MergeWorldCommand = { type: 'move', from: a, to: b, now: NOW };
    const result = reduceMissionMove(from.state, a, b, NOW, items);
    if (!result.changed) return null;
    const settled = settleAction(binding, from, command, result);
    return settled.refused ? null : { state: settled.state, run: settled.run, mechanicState: settled.mechanicState };
  };
  const tap = (from: SettleBefore): SettleBefore | null => {
    for (const cell of window.cellIndices) {
      const occupant = from.state.board[cell]?.occupant;
      if (occupant?.kind !== 'generator' || (!encounter.discoveryChain && (occupant.generatorId === SEED_SPRINKLER_ID || occupant.generatorId === STORM_POT_ID)) || (from.state.generators[occupant.generatorId]?.charges ?? 0) <= 0) continue;
      const command = { type: 'tapGenerator' as const, generatorId: occupant.generatorId, now: NOW, seed: tapSeed(from.run), spendEnergy: false as const, enforceCharges: true as const };
      const result = reduceMergeWorld(from.state, command);
      if (!result.changed || result.spawnedCell == null) continue;
      const settled = settleAction(binding, from, command, result);
      if (settled.refused) continue;
      return { state: settled.state, run: { ...settled.run, actions: settled.run.actions + 1 }, mechanicState: settled.mechanicState };
    }
    return null;
  };
  const standing = (at: SettleBefore): { column: number; row: number }[] => {
    if (at.mechanicState.kind !== 'lanes') return [];
    const state = at.mechanicState;
    return mechanic.wisps.flatMap((_, index) => (laneArrived(mechanic, state, index) && laneAlive(mechanic, state, index) ? [{ column: laneColumn(mechanic, state, index), row: laneRowOf(state.wisps[index]!.row) }] : []));
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
      const fire = piece ? shootsUp(piece.definitionId) : null;
      return place.column === column && place.row > row && fire ? sum + fire.damage / fire.periodMs : sum;
    }, 0)));
  };

  const act = (from: SettleBefore): SettleBefore | null => {
    const cells = window.cellIndices;
    const rows = threats(from);
    const pairs: { a: number; b: number; tier: number; wake?: boolean }[] = [];
    for (const a of cells) {
      const pa = loose(from.state, a);
      if (!pa || (from.mechanicState.kind === 'lanes' && from.mechanicState.combat?.plants[pa.instanceId]?.charge)) continue;
      for (const b of cells) {
        const pb = a === b ? null : loose(from.state, b);
        if (pb && from.mechanicState.kind === 'lanes' && from.mechanicState.combat?.plants[pb.instanceId]?.charge) continue;
        if (pb && pb.definitionId === pa.definitionId && items.get(pa.definitionId)?.nextItemId) pairs.push({ a, b, tier: tierOf(pa.definitionId) + 1 });
        // A sleeper under half Mist wakes when its twin is brought to it (and opens the full Mist beside it).
        const sleeper = from.state.board[b]?.mist;
        if (sleeper?.kind === 'echo' && sleeper.definitionId === pa.definitionId) pairs.push({ a, b, tier: tierOf(pa.definitionId) + 1, wake: true });
      }
    }
    // Discovery teaches matching the half-mist chain, then observing its ability.
    if (encounter.discoveryChain) {
      const match = pairs.find(pair => pair.wake);
      if (match) return move(from, match.a, match.b);
    }
    const room = cells.filter((cell) => isFree(from.state, cell)).length;
    // Careful: the best of a merge, a reposition and a tap.
    const covered = cover(from);
    type Choice = { score: number; run: () => SettleBefore | null };
    const choices: Choice[] = [];
    // Wisps close enough to the board for a Spark plant to reach: where each stands.
    const nearBoard = standing(from).filter((wisp) => wisp.row >= -2);
    const reaches = (cell: number, reach: number) => { const at = laneOf(window, cell)!; return nearBoard.some((wisp) => Math.max(Math.abs(wisp.column - at.column), Math.abs(wisp.row - at.row)) <= reach); };
    for (const pair of pairs) {
      const place = laneOf(window, pair.b)!;
      const pa = loose(from.state, pair.a);
      if (pa && isSpark(pa.definitionId)) {
        const zap = laneZap(pair.tier);
        choices.push({ score: pair.tier * 10 + (zap && reaches(pair.b, zap.reach) ? 35 : 0) - (safe(from, pair.b) ? 0 : 100), run: () => move(from, pair.a, pair.b) });
        continue;
      }
      const row = rows[place.column];
      const under = row != null && place.row > row;
      choices.push({ score: pair.tier * 10 + (pair.wake ? 20 : 0) + (under ? 30 + (5 - covered[place.column]! * 1_000) : 0) - (safe(from, pair.b) ? 0 : 100), run: () => move(from, pair.a, pair.b) });
    }
    // The column most in danger that has the least cover: bring a firing piece from a column nobody is coming down.
    const danger = rows.map((row, column) => (row == null ? -1 : row + 3 - covered[column]! * 1_500)).map((score, column) => ({ score, column })).filter((entry) => entry.score >= 0).sort((x, y) => y.score - x.score)[0];
    if (danger) {
      const targets = cells.filter((cell) => laneOf(window, cell)!.column === danger.column && isFree(from.state, cell) && safe(from, cell)).sort((x, y) => laneOf(window, y)!.row - laneOf(window, x)!.row);
      const shooter = cells
        .filter((cell) => { const piece = loose(from.state, cell); const place = laneOf(window, cell)!; return piece && shootsUp(piece.definitionId) && (rows[place.column] == null || covered[place.column]! > 0.0009); })
        .sort((x, y) => tierOf(loose(from.state, y)!.definitionId) - tierOf(loose(from.state, x)!.definitionId))[0];
      if (targets[0] != null && shooter != null) choices.push({ score: 25 + danger.score * 4, run: () => move(from, shooter, targets[0]!) });
    }
    if (nearBoard.length) {
      for (const cell of cells) {
        const piece = loose(from.state, cell);
        const zap = piece && isSpark(piece.definitionId) ? laneZap(tierOf(piece.definitionId)) : null;
        if (!zap || reaches(cell, zap.reach)) continue;
        const spot = cells.filter((target) => isFree(from.state, target) && safe(from, target) && reaches(target, zap.reach))[0];
        if (spot != null) { choices.push({ score: 28 + tierOf(piece!.definitionId) * 4, run: () => move(from, cell, spot) }); break; }
      }
    }
    if (encounter.discoveryChain === 'dew') for (const cell of cells) {
      const p = loose(from.state, cell);
      if (!p || combatChain(p.definitionId) !== 'dew' || tierOf(p.definitionId) < 2) continue;
      const scoreAt = (target: number) => {
        const at = laneOf(window, target)!;
        return (encounter.fixedCells ?? []).reduce((score, defender) => {
          const d = laneOf(window, defender)!;
          if (Math.max(Math.abs(d.column - at.column), Math.abs(d.row - at.row)) > 1) return score;
          const covered = cells.some(other => { const q = loose(from.state, other); const place = laneOf(window, other)!;
            return other !== cell && q && combatChain(q.definitionId) === 'dew' && tierOf(q.definitionId) >= 2 && Math.max(Math.abs(d.column - place.column), Math.abs(d.row - place.row)) <= 1; });
          return score + (covered ? 1 : 10);
        }, 0);
      };
      const spot = cells.filter(target => isFree(from.state, target)).sort((a,b) => scoreAt(b) - scoreAt(a))[0];
      if (spot != null && scoreAt(spot) > scoreAt(cell)) choices.push({ score: 90, run: () => move(from, cell, spot) });
    }
    // Sacrificial walls must be actively placed near approaching enemies.
    if (encounter.discoveryChain === 'bulwark') for (const cell of cells) {
      const p = loose(from.state, cell);
      if (!p || tierOf(p.definitionId) < 2 || from.mechanicState.kind !== 'lanes' || from.mechanicState.combat?.plants[p.instanceId]?.charge) continue;
      const at = laneOf(window, cell)!;
      if (nearBoard.some(w => Math.hypot(w.column - at.column, w.row - at.row) <= 1.5)) continue;
      const spot = cells.find(target => isFree(from.state, target) && nearBoard.some(w => {
        const to = laneOf(window, target)!; return to.row >= w.row && Math.hypot(w.column - to.column, w.row - to.row) <= 1;
      }));
      if (spot != null) choices.push({ score: 85, run: () => move(from, cell, spot) });
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
    const ticked = lanesTick(mechanic, node.mechanicState, node.state, TICK_MS, window, items, profile);
    node = { ...node, state: ticked.board, mechanicState: ticked.state };
    ms += TICK_MS;
    if (ms >= nextThink) {
      nextThink += think;
      // The Seed Sprinkler is a quick tap between moves: a player launches a Seed when there is room and fewer than three
      // loose Seeds to merge (never flooding the board with them).
      // The Storm Pot the same way, for its own chain's Seeds.
      for (const [engine, chain] of [[SEED_SPRINKLER_ID, 'nature:garden'], [mechanic.secondary?.generatorId ?? STORM_POT_ID, mechanic.secondary ? `nature:${SECONDARY_CHAINS[mechanic.secondary.generatorId]}` : STORM_CHAIN]] as const) {
      const sprinkler = node.state.generators[engine];
      const seedsLoose = window.cellIndices.filter((cell) => { const piece = loose(node.state, cell); return piece && tierOf(piece.definitionId) === 1 && items.get(piece.definitionId)?.chainId === chain; }).length;
      if (!encounter.discoveryChain && sprinkler && sprinkler.charges > 0 && seedsLoose < (engine === STORM_POT_ID ? 2 : 3) && window.cellIndices.filter((cell) => isFree(node.state, cell)).length >= 2) {
        const command = { type: 'tapGenerator' as const, generatorId: engine, now: NOW, seed: tapSeed(node.run), spendEnergy: false as const, enforceCharges: true as const, dropProfile: { tierTwoChance: profile.tierTwoChance, tierThreeChance: profile.tierThreeChance } };
        const result = reduceMergeWorld(node.state, command);
        if (result.changed && result.spawnedCell != null) {
          const settled = settleAction(binding, node, command, result);
          if (!settled.refused) node = { state: settled.state, run: settled.run, mechanicState: settled.mechanicState };
        }
      }
      }
      const next = act(node);
      if (next) { node = next; actions += 1; }
    }
  }
  const status = encounterStatus(encounter, host, node.mechanicState, node.run, node.state, window);
  const breached = node.mechanicState.kind === 'lanes' && node.mechanicState.breached != null ? mechanic.wisps[node.mechanicState.breached]?.id ?? null : null;
  return { won: status === 'cleared', reason: status === 'cleared' ? null : lossReason(encounter, host, node.mechanicState, node.run, node.state, window) ?? 'spent', ms, actions, breached };
}

/** A Lanes level's record over several seeds. */
export function lanesFairness(encounter: EncounterDefinition, style: LanesStyle, seeds = 10, profile?: EncounterProfile): { wins: number; seeds: number; seconds: number } {
  let wins = 0;
  let total = 0;
  for (let attempt = 1; attempt <= seeds; attempt += 1) {
    const result = lanesPlaytest(encounter, { style, attempt, profile, heroLevel: profile ? encounter.recommendedLevel : undefined });
    if (result.won) wins += 1;
    total += result.ms;
  }
  return { wins, seeds, seconds: Math.round(total / seeds / 1_000) };
}
