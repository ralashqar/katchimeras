import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import type { MissionWindow } from '@/features/mission-mechanics/board-window';
import { afterAction, resolveMechanic, strikeFor, wispViews, type MissionMechanicHost, type MissionStrikeEvent } from '@/features/mission-mechanics/mechanic';
import type { EncounterDefinition } from '@/types/encounter';
import type { MergeItemDefinition, MergeWorldCommand, MergeWorldCommandResult, MergeWorldFailureReason, MergeWorldState } from '@/types/merge-world';
import type { MechanicEffect, MissionMechanicState, MissionStrike } from '@/types/mission-mechanic';
import { actionOf, resolveCost } from './costs';
import { placeSpawner } from './create-state';
import { canAfford, encounterStatus, objectiveMet, recordCoverage, spend, type EncounterRunState, type EncounterStatus } from './encounter-run';
import { clearBoundMist, harmonyPulse, type MistOpened } from './mist';
import { seededUnit } from './seed';

/**
 * Everything that follows a board command on an encounter, in one place and
 * in one order: the action's cost against Resolve (refused when it cannot be
 * paid); the strike it makes by the board's mechanic; the Mist beside the
 * merge worn down; wisp-bound Mist let go by wisps that fell; spawners
 * recharged; the ability charged; the wisps' own turn. The store and the
 * solver both settle through here, so a board plays the same way whether a
 * finger or a search is driving it.
 */
export type SettleBinding = { encounter: EncounterDefinition; host: MissionMechanicHost; window: MissionWindow; items?: ReadonlyMap<string, MergeItemDefinition> };

export type SettleBefore = { state: MergeWorldState; run: EncounterRunState; mechanicState: MissionMechanicState };

export type SettleResult = {
  state: MergeWorldState;
  run: EncounterRunState;
  mechanicState: MissionMechanicState;
  strike: MissionStrike | null;
  effects: MechanicEffect[];
  opened: MistOpened[];
  status: EncounterStatus;
  /** The action was refused; nothing above changed. */
  refused?: MergeWorldFailureReason;
};

/** The strike a command's result describes: the cell holding what a merge or waking made. */
export function strikeEventFor(result: MergeWorldCommandResult): MissionStrikeEvent | null {
  if (result.mergedCell == null) return null;
  const made = result.state.board[result.mergedCell]?.occupant;
  if (made?.kind !== 'item') return null;
  return { type: result.dreamEchoClearedId ? 'dream_echo_cleared' : 'merge_completed', resultCell: result.mergedCell, resultDefinitionId: made.definitionId };
}

/** The seed a spawner tap on this attempt draws from: the attempt's, and the actions spent so far. */
export const tapSeed = (run: EncounterRunState): string => `${run.seed}:${run.actions}`;

export function settleAction(binding: SettleBinding, before: SettleBefore, command: MergeWorldCommand, result: MergeWorldCommandResult): SettleResult {
  const { encounter, host, window } = binding;
  const items = binding.items ?? MERGE_ITEMS_BY_ID;
  const mechanic = resolveMechanic(host);
  const unchanged = (refused?: MergeWorldFailureReason): SettleResult => ({ ...before, strike: null, effects: [], opened: [], status: encounterStatus(encounter, host, before.mechanicState, before.run, before.state, window), ...(refused ? { refused } : {}) });
  const action = actionOf(command, result);
  if (!action) return unchanged();
  // A territory battle: nothing costs; a turn is a merge, and only merges give the wisps their turn.
  const territory = Boolean(before.run.territory);
  const cost = territory ? 0 : resolveCost(action);
  if (!canAfford(before.run, cost)) return unchanged('out_of_resolve');

  let state = result.state;
  let run = territory && action === 'merge' ? { ...before.run, actions: before.run.actions + 1 } : spend(before.run, cost);
  let mechanicState = before.mechanicState;
  let strike: MissionStrike | null = null;
  const opened: MistOpened[] = [];
  let effects: MechanicEffect[] = [];
  const rng = (label: string) => seededUnit(`${run.seed}:${run.actions}:${label}`);

  if (action === 'merge' && result.mergedCell != null) {
    run = { ...run, merges: run.merges + 1 };
    const event = strikeEventFor(result);
    const aliveBefore = new Set(wispViews(mechanic, host, mechanicState).filter((wisp) => wisp.alive).map((wisp) => wisp.id));
    const resolved = strikeFor(mechanic, host, window, mechanicState, event, items);
    mechanicState = resolved.next;
    strike = resolved.strike;
    // The Harmony pulse wears the Mist in reach of what was made; the Mist bound to a wisp that fell lets go.
    if (event) {
      const around = harmonyPulse(state, result.mergedCell, event.resultDefinitionId, window, items);
      state = around.board;
      opened.push(...around.opened);
    }
    const fallen = wispViews(mechanic, host, mechanicState).filter((wisp) => !wisp.alive && aliveBefore.has(wisp.id)).map((wisp) => wisp.id);
    if (fallen.length) {
      const bound = clearBoundMist(state, fallen, window);
      state = bound.board;
      opened.push(...bound.opened);
    }
    // Spawners recharge: every so many merges, or when a wisp falls.
    for (const spawner of encounter.spawners) {
      const generator = state.generators[spawner.generatorId];
      const recharge = spawner.recharge;
      if (!generator || !recharge || recharge.kind === 'none') continue;
      let gained = 0;
      if (recharge.kind === 'merges') {
        const since = (run.spawners[spawner.id]?.sinceRecharge ?? 0) + 1;
        if (since >= Math.max(1, Math.floor(recharge.every))) { gained = recharge.amount; run = { ...run, spawners: { ...run.spawners, [spawner.id]: { sinceRecharge: 0 } } }; }
        else run = { ...run, spawners: { ...run.spawners, [spawner.id]: { sinceRecharge: since } } };
      } else if (fallen.length) gained = recharge.amount * fallen.length;
      if (gained > 0) state = { ...state, generators: { ...state.generators, [spawner.generatorId]: { ...generator, charges: generator.charges + gained, capacity: Math.max(generator.capacity, generator.charges + gained) } } };
    }
    if (run.ability) run = { ...run, ability: { ...run.ability, charge: run.ability.charge + 1 } };
  }
  if (action === 'tap' && run.focus && command.type === 'tapGenerator' && command.generatorId === run.focus.generatorId) {
    const taps = run.focus.taps - 1;
    run = { ...run, focus: taps > 0 ? { ...run.focus, taps } : null };
  }
  // A cell that opened held a spawner: it stands there now.
  for (const entry of opened) {
    if (entry.holds?.kind !== 'spawner') continue;
    const spawnerId = entry.holds.spawnerId;
    const spawner = encounter.spawners.find((candidate) => candidate.id === spawnerId);
    if (spawner) state = placeSpawner(state, spawner, entry.cell);
  }
  // The wisps' turn, once the player's action has cost them something and the Dark Wisps' delay is spent.
  // A territory battle: after every merge that did not just win the level.
  const wispsTurn = territory ? action === 'merge' && run.merges > run.delay && !objectiveMet(encounter, host, mechanicState, run) : cost > 0 && run.actions > run.delay;
  if (wispsTurn) {
    const turn = afterAction(mechanic, host, mechanicState, state, { window, action: action === 'tap' ? 'tap' : 'merge', rng, items });
    mechanicState = turn.state;
    state = turn.board;
    effects = turn.effects;
  }
  run = recordCoverage(run, state, window);
  return { state, run, mechanicState, strike, effects, opened, status: encounterStatus(encounter, host, mechanicState, run, state, window) };
}
