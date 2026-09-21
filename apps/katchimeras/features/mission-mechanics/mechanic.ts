import type { CorruptionWispSpec } from '@/features/onboarding/corruption-wisps';
import type { MergeItemDefinition, MergeWorldState } from '@/types/merge-world';
import type { MissionMechanicDefinition, MissionMechanicMove, MissionMechanicState, MissionStrike, MissionWispView } from '@/types/mission-mechanic';
import type { MissionWindow } from './board-window';
import { applyColumnShot, columnShotComplete, columnShotMove, columnShotProgress, columnShotStrike, columnShotTotalHp, columnShotViews, createColumnShotState, normalizeColumnShotState } from './column-shot';
import { glowStrikeAt, glowStrikesMove, glowStrikesViews } from './glow-strikes';
import { applyWispRushStrike, createWispRushState, syncWispRush, wispRushFallen, wispRushViews } from './wisp-rush';

/**
 * The one door every board goes through. A host is whatever the board is
 * authored on: a mission's requirement, its wisps over the tile, and the
 * mechanic it plays by (none means glow strikes). The store resolves strikes
 * through here, the dock reads progress and the finale, the wisp layer draws
 * `wispViews`, and the guidance asks for `mechanicMove`. Nothing outside this
 * module branches on the mechanic's kind.
 */
export type MissionMechanicHost = { required: number; wisps: readonly CorruptionWispSpec[]; mechanic?: MissionMechanicDefinition };

/** A board's strike, in the terms the engine's result gives: which cell holds the thing that was made. */
export type MissionStrikeEvent = { type: 'merge_completed' | 'dream_echo_cleared'; resultCell: number; resultDefinitionId: string };

const GLOW_STRIKES: MissionMechanicDefinition = { kind: 'glow-strikes' };

export function resolveMechanic(host: MissionMechanicHost): MissionMechanicDefinition {
  return host.mechanic ?? GLOW_STRIKES;
}

export function createMechanicState(mechanic: MissionMechanicDefinition): MissionMechanicState {
  if (mechanic.kind === 'wisp-rush') return createWispRushState();
  return mechanic.kind === 'column-shot' ? createColumnShotState(mechanic) : { kind: 'glow-strikes', strikes: 0 };
}

/** Strikes (or hit points) that fill the bar. */
export function mechanicRequired(mechanic: MissionMechanicDefinition, host: MissionMechanicHost): number {
  return mechanic.kind === 'column-shot' ? columnShotTotalHp(mechanic) : host.required;
}

export function mechanicProgress(mechanic: MissionMechanicDefinition, host: MissionMechanicHost, state: MissionMechanicState): { current: number; total: number } {
  // A rush counts wisps struck down against the host's goal.
  if (mechanic.kind === 'wisp-rush' && state.kind === 'wisp-rush') return { current: Math.min(host.required, wispRushFallen(state)), total: host.required };
  if (mechanic.kind === 'column-shot' && state.kind === 'column-shot') return columnShotProgress(mechanic, state);
  const total = host.required;
  return { current: Math.max(0, Math.min(total, Math.floor(state.strikes))), total };
}

export function mechanicComplete(mechanic: MissionMechanicDefinition, host: MissionMechanicHost, state: MissionMechanicState): boolean {
  // A rush is over when its clock says so, never because the wisps ran out: they do not.
  if (mechanic.kind === 'wisp-rush') return false;
  if (mechanic.kind === 'column-shot' && state.kind === 'column-shot') return columnShotComplete(mechanic, state);
  return state.strikes >= host.required;
}

/** The strike a board command produced, and the state after it; no strike when nothing was made. */
export function strikeFor(mechanic: MissionMechanicDefinition, host: MissionMechanicHost, window: MissionWindow, state: MissionMechanicState, event: MissionStrikeEvent | null, items?: ReadonlyMap<string, MergeItemDefinition>): { next: MissionMechanicState; strike: MissionStrike | null } {
  if (!event) return { next: state, strike: null };
  // A Wisp Rush strike is decided by the heat's own rules (tiers, combos, which wisp takes it) and handed to the layer
  // by the heat's dock; a stored board never resolves one.
  if (mechanic.kind === 'wisp-rush') return { next: state, strike: null };
  if (mechanic.kind === 'column-shot' && state.kind === 'column-shot') return columnShotStrike(mechanic, window, state, event, items);
  const strike = glowStrikeAt(host, state.strikes, 'glow', event.resultCell, event.resultDefinitionId);
  return { next: { kind: 'glow-strikes', strikes: state.strikes + 1 }, strike };
}

/** A landed strike applied to what the wisps show: the layer advances its own copy as each flight arrives. */
export function applyStrike(mechanic: MissionMechanicDefinition, state: MissionMechanicState, strike: MissionStrike): MissionMechanicState {
  if (mechanic.kind === 'wisp-rush' && state.kind === 'wisp-rush') return applyWispRushStrike(state, strike);
  if (mechanic.kind === 'column-shot' && state.kind === 'column-shot') return applyColumnShot(state, strike);
  return { kind: 'glow-strikes', strikes: state.strikes + 1 };
}

/**
 * What the wisp layer's own copy takes from the board's state while the board is up. For most mechanics nothing (the
 * copy moves only as flights land); a rush's wisps appear over time, so the copy gains each new one. The same object
 * back means nothing changed.
 */
export function syncMechanicState(mechanic: MissionMechanicDefinition, shown: MissionMechanicState, incoming: MissionMechanicState): MissionMechanicState {
  return mechanic.kind === 'wisp-rush' && shown.kind === 'wisp-rush' && incoming.kind === 'wisp-rush' ? syncWispRush(shown, incoming) : shown;
}

export function wispViews(mechanic: MissionMechanicDefinition, host: MissionMechanicHost, state: MissionMechanicState): MissionWispView[] {
  if (mechanic.kind === 'wisp-rush' && state.kind === 'wisp-rush') return wispRushViews(mechanic, state);
  if (mechanic.kind === 'column-shot' && state.kind === 'column-shot') return columnShotViews(mechanic, state);
  return glowStrikesViews(host, state);
}

export function mechanicMove(mechanic: MissionMechanicDefinition, board: MergeWorldState, state: MissionMechanicState, window: MissionWindow): MissionMechanicMove | null {
  if (mechanic.kind === 'column-shot' && state.kind === 'column-shot') return columnShotMove(mechanic, board, state, window);
  return glowStrikesMove(board, window);
}

/**
 * A saved board's mechanic state: glow strikes are the saved merge count; a
 * column-shot board must carry a readable damage vector, or, with no strike
 * yet, starts fresh. Null means the save cannot be read.
 */
export function normalizeMechanicState(mechanic: MissionMechanicDefinition, value: unknown, strikes: number): MissionMechanicState | null {
  const count = Math.max(0, Math.floor(Number.isFinite(strikes) ? strikes : 0));
  // A rush is never saved mid-run: its board starts fresh.
  if (mechanic.kind === 'wisp-rush') return createWispRushState();
  if (mechanic.kind !== 'column-shot') return { kind: 'glow-strikes', strikes: count };
  if (value == null) return count === 0 ? createColumnShotState(mechanic) : null;
  return normalizeColumnShotState(mechanic, value, count);
}

/** What a mechanic keeps in the board's save. */
export function mechanicSaveState(state: MissionMechanicState | null): { damage: number[] } | undefined {
  return state?.kind === 'column-shot' ? { damage: state.damage } : undefined;
}
