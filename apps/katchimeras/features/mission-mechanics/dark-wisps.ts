import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import type { MergeBoardCell, MergeItemDefinition, MergeWorldState } from '@/types/merge-world';
import type { MechanicEffect, MissionMechanicDefinition, MissionMechanicMove, MissionMechanicState, MissionStrike, MissionWispView } from '@/types/mission-mechanic';
import { windowItems, type MissionWindow } from './board-window';
import { glowStrikesMove } from './glow-strikes';
import type { MissionStrikeEvent } from './mechanic';

export type DarkWispsDefinition = Extract<MissionMechanicDefinition, { kind: 'dark-wisps' }>;
export type DarkWispsState = Extract<MissionMechanicState, { kind: 'dark-wisps' }>;

/**
 * Dark Wisps: wisps that fed on the Mist long enough to learn to want. Each
 * has hit points; a merge strikes one of them for the damage its result's
 * tier deals, and what is left over is lost. Between the player's actions
 * they act by their behaviour: covering a cell in Mist again, eating a loose
 * piece, spreading root Mist, mending. The mission is done when every one is
 * down, and the strike that fells the last is the finale. Pure.
 */
const DEFAULT_DAMAGE: readonly number[] = [1];

export function darkWispsDamage(mechanic: DarkWispsDefinition, definitionId: string, items: ReadonlyMap<string, MergeItemDefinition> = MERGE_ITEMS_BY_ID): number {
  const tier = Math.max(1, Math.floor(items.get(definitionId)?.tier ?? 1));
  const table = mechanic.damageByTier?.length ? mechanic.damageByTier : DEFAULT_DAMAGE;
  return Math.max(0, Math.floor(table[Math.min(tier, table.length) - 1]!));
}

export function darkWispsTotalHp(mechanic: DarkWispsDefinition): number {
  return mechanic.wisps.reduce((sum, wisp) => sum + Math.max(0, Math.floor(wisp.hp)), 0);
}

export function createDarkWispsState(mechanic: DarkWispsDefinition): DarkWispsState {
  return { kind: 'dark-wisps', strikes: 0, actions: 0, damage: mechanic.wisps.map(() => 0), struckAt: mechanic.wisps.map(() => -1) };
}

export const darkWispAlive = (mechanic: DarkWispsDefinition, damage: readonly number[], index: number): boolean => damage[index]! < mechanic.wisps[index]!.hp;

export function darkWispsStanding(mechanic: DarkWispsDefinition, state: DarkWispsState): number[] {
  return mechanic.wisps.map((_, index) => index).filter((index) => darkWispAlive(mechanic, state.damage, index));
}

export const isPlantItem = (definitionId: string, items: ReadonlyMap<string, MergeItemDefinition> = MERGE_ITEMS_BY_ID): boolean => items.get(definitionId)?.familyId === 'nature';

/** The wisp a strike lands on: the first standing, or the one with the least left. */
function targetFor(mechanic: DarkWispsDefinition, state: DarkWispsState): number | null {
  const standing = darkWispsStanding(mechanic, state);
  if (!standing.length) return null;
  if (mechanic.targeting !== 'weakest') return standing[0]!;
  return standing.sort((a, b) => (mechanic.wisps[a]!.hp - state.damage[a]!) - (mechanic.wisps[b]!.hp - state.damage[b]!) || a - b)[0]!;
}

export function darkWispsStrike(mechanic: DarkWispsDefinition, state: DarkWispsState, event: MissionStrikeEvent, items: ReadonlyMap<string, MergeItemDefinition> = MERGE_ITEMS_BY_ID): { next: DarkWispsState; strike: MissionStrike | null } {
  const target = targetFor(mechanic, state);
  if (target == null) return { next: state, strike: null };
  const wisp = mechanic.wisps[target]!;
  const bonus = wisp.behaviour?.kind === 'rootbound' && isPlantItem(event.resultDefinitionId, items) ? Math.max(0, Math.floor(wisp.behaviour.plantBonus)) : 0;
  const amount = darkWispsDamage(mechanic, event.resultDefinitionId, items) + bonus;
  const dealt = Math.max(0, Math.min(amount, wisp.hp - state.damage[target]!));
  const damage = [...state.damage];
  damage[target] = damage[target]! + dealt;
  const struckAt = [...state.struckAt];
  struckAt[target] = state.actions;
  const next: DarkWispsState = { ...state, strikes: state.strikes + 1, damage, struckAt };
  const finale = mechanic.wisps.every((_, index) => !darkWispAlive(mechanic, damage, index));
  return { next, strike: { fromCell: event.resultCell, resultDefinitionId: event.resultDefinitionId, hits: dealt > 0 ? [{ wisp: target, damage: dealt }] : [], target, finale, wasted: dealt <= 0 } };
}

/** A landed strike on the layer's own copy. */
export function applyDarkWisps(state: DarkWispsState, strike: MissionStrike): DarkWispsState {
  const damage = [...state.damage];
  for (const hit of strike.hits) damage[hit.wisp] = (damage[hit.wisp] ?? 0) + hit.damage;
  return { ...state, strikes: state.strikes + 1, damage };
}

export function darkWispsProgress(mechanic: DarkWispsDefinition, state: DarkWispsState): { current: number; total: number } {
  const total = darkWispsTotalHp(mechanic);
  return { current: Math.max(0, Math.min(total, state.damage.reduce((sum, value) => sum + value, 0))), total };
}

export function darkWispsComplete(mechanic: DarkWispsDefinition, state: DarkWispsState): boolean {
  return mechanic.wisps.every((_, index) => !darkWispAlive(mechanic, state.damage, index));
}

export function darkWispsViews(mechanic: DarkWispsDefinition, state: DarkWispsState): MissionWispView[] {
  return mechanic.wisps.map((wisp, index) => ({ id: wisp.id, hp: wisp.hp, damage: Math.min(wisp.hp, state.damage[index] ?? 0), alive: darkWispAlive(mechanic, state.damage, index), placement: wisp.placement }));
}

export function darkWispsMove(board: MergeWorldState, window: MissionWindow): MissionMechanicMove | null {
  return glowStrikesMove(board, window);
}

export function normalizeDarkWispsState(mechanic: DarkWispsDefinition, value: unknown, strikes: number): DarkWispsState | null {
  const raw = value as { damage?: unknown; actions?: unknown; struckAt?: unknown } | null;
  if (!raw || !Array.isArray(raw.damage) || raw.damage.length !== mechanic.wisps.length) return null;
  const damage = raw.damage.map((entry, index) => Math.max(0, Math.min(mechanic.wisps[index]!.hp, Math.floor(Number.isFinite(entry) ? Number(entry) : 0))));
  const struckAt = Array.isArray(raw.struckAt) && raw.struckAt.length === mechanic.wisps.length ? raw.struckAt.map((entry) => Math.floor(Number.isFinite(entry) ? Number(entry) : -1)) : mechanic.wisps.map(() => -1);
  return { kind: 'dark-wisps', strikes, actions: Math.max(0, Math.floor(Number.isFinite(raw.actions) ? Number(raw.actions) : 0)), damage, struckAt };
}

/** Open cells of the window with nothing on them and no Mist. */
export function windowEmptyCells(board: MergeWorldState, window: MissionWindow): number[] {
  return window.cellIndices.filter((index) => { const cell = board.board[index]; return Boolean(cell) && !cell.locked && !cell.mist && !cell.occupant; });
}

/**
 * The wisps' turn, once the player has spent an action. Every wisp still
 * standing whose behaviour is due acts on the board, in order. `rng` gives a
 * number in [0, 1) for a label, so the same board and seed act the same way.
 */
export function darkWispsAfterAction(mechanic: DarkWispsDefinition, state: DarkWispsState, board: MergeWorldState, window: MissionWindow, rng: (label: string) => number, items: ReadonlyMap<string, MergeItemDefinition> = MERGE_ITEMS_BY_ID): { state: DarkWispsState; board: MergeWorldState; effects: MechanicEffect[] } {
  const actions = state.actions + 1;
  let cells: MergeBoardCell[] | null = null;
  const damage = [...state.damage];
  const effects: MechanicEffect[] = [];
  const pick = <T,>(list: readonly T[], label: string): T | null => (list.length ? list[Math.min(list.length - 1, Math.floor(rng(`${label}:${actions}`) * list.length))]! : null);
  const current = (): MergeWorldState => (cells ? { ...board, board: cells } : board);
  const mistCell = (cell: number, type: 'light' | 'root', wisp: number, kind: 'shrouded' | 'root_mist') => {
    cells ??= [...board.board];
    cells[cell] = { ...cells[cell]!, locked: true, blocker: null, occupant: null, mist: { kind: 'encounter', type, hp: 1 } };
    effects.push({ kind, wisp, cell });
  };
  mechanic.wisps.forEach((wisp, index) => {
    const behaviour = wisp.behaviour;
    if (!behaviour || behaviour.kind === 'plain' || !darkWispAlive(mechanic, damage, index)) return;
    const every = Math.max(1, Math.floor(behaviour.every));
    if (actions % every !== 0) return;
    if (behaviour.kind === 'shrouder') {
      const cell = pick(windowEmptyCells(current(), window), `shroud:${wisp.id}`);
      if (cell != null) mistCell(cell, 'light', index, 'shrouded');
    } else if (behaviour.kind === 'rootbound') {
      const cell = pick(windowEmptyCells(current(), window), `root:${wisp.id}`);
      if (cell != null) mistCell(cell, 'root', index, 'root_mist');
    } else if (behaviour.kind === 'hungry') {
      // The lowest loose piece it may eat; never one of the last two on the board, so a pair always remains.
      const loose = windowItems(current(), window.cellIndices).map((item) => ({ ...item, tier: items.get(item.definitionId)?.tier ?? 1 })).filter((item) => item.tier <= behaviour.maxTier);
      if (windowItems(current(), window.cellIndices).length <= 2 || !loose.length) return;
      const lowest = Math.min(...loose.map((item) => item.tier));
      const meal = pick(loose.filter((item) => item.tier === lowest), `eat:${wisp.id}`);
      if (!meal) return;
      cells ??= [...board.board];
      cells[meal.cell] = { ...cells[meal.cell]!, occupant: null };
      effects.push({ kind: 'ate', wisp: index, cell: meal.cell, definitionId: meal.definitionId });
    } else if (behaviour.kind === 'mender') {
      // Left alone since its last turn: it mends.
      if (state.struckAt[index]! > actions - every - 1 || damage[index]! <= 0) return;
      const amount = Math.min(damage[index]!, Math.max(1, Math.floor(behaviour.amount ?? 1)));
      damage[index] = damage[index]! - amount;
      effects.push({ kind: 'mended', wisp: index, amount });
    }
  });
  return { state: { ...state, actions, damage }, board: current(), effects };
}
