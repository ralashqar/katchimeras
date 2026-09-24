import type { CorruptionWispSpec } from '@/features/onboarding/corruption-wisps';
import type { MergeItemDefinition, MergeWorldState } from '@/types/merge-world';
import type { MechanicEffect, MissionMechanicDefinition, MissionMechanicMove, MissionMechanicState, MissionStrike, MissionWispView, WispPlan } from '@/types/mission-mechanic';
import type { MissionWindow } from './board-window';
import { applyColumnShot, columnShotComplete, columnShotMove, columnShotProgress, columnShotStrike, columnShotTotalHp, columnShotViews, createColumnShotState, normalizeColumnShotState } from './column-shot';
import { applyDarkWisps, createDarkWispsState, darkWispsAfterAction, darkWispsComplete, darkWispsMove, darkWispsPrepare, darkWispsProgress, darkWispsCleanseStrike, darkWispsStrike, darkWispsTotalHp, darkWispsTurnStrip, darkWispsViews, isTactics, normalizeDarkWispsState, planTacticsTurn, planWispTurn } from './dark-wisps';
import { glowStrikeAt, glowStrikesMove, glowStrikesViews } from './glow-strikes';
import { createLanesState, lanesComplete, lanesProgress, lanesTotalHp, lanesViews, normalizeLanesState } from './lanes';
import { applyWispRushStrike, createWispRushState, syncWispRush, wispRushFallen, wispRushViews } from './wisp-rush';

/**
 * The one door every board goes through. A host is whatever the board is
 * authored on: a mission's requirement, its wisps over the tile, and the
 * mechanic it plays by (none means glow strikes). The store resolves strikes
 * through here, the dock reads progress and the finale, the wisp layer draws
 * `wispViews`, the guidance asks for `mechanicMove`, and the wisps take
 * their turn through `afterAction`. Nothing outside this module branches on
 * the mechanic's kind.
 */
export type MissionMechanicHost = { required: number; wisps: readonly CorruptionWispSpec[]; mechanic?: MissionMechanicDefinition };

/** A board's strike, in the terms the engine's result gives: which cell holds the thing that was made. */
export type MissionStrikeEvent = { type: 'merge_completed' | 'dream_echo_cleared'; resultCell: number; resultDefinitionId: string };

/** What an action was and how the wisps may draw their luck for it. */
export type MechanicActionContext = { window: MissionWindow; action: 'merge' | 'tap' | 'ability'; rng: (label: string) => number; items?: ReadonlyMap<string, MergeItemDefinition> };

/** What a mechanic keeps in the board's save beyond the merge count (Dark Wisps: all of it, so walking wisps come back where they stood). */
export type MechanicSaveState = { damage: number[]; actions?: number; struckAt?: number[] } & Record<string, unknown>;

const GLOW_STRIKES: MissionMechanicDefinition = { kind: 'glow-strikes' };

export function resolveMechanic(host: MissionMechanicHost): MissionMechanicDefinition {
  return host.mechanic ?? GLOW_STRIKES;
}

export function createMechanicState(mechanic: MissionMechanicDefinition): MissionMechanicState {
  if (mechanic.kind === 'wisp-rush') return createWispRushState();
  if (mechanic.kind === 'dark-wisps') return createDarkWispsState(mechanic);
  if (mechanic.kind === 'lanes') return createLanesState(mechanic);
  return mechanic.kind === 'column-shot' ? createColumnShotState(mechanic) : { kind: 'glow-strikes', strikes: 0 };
}

/** Strikes (or hit points) that fill the bar. */
export function mechanicRequired(mechanic: MissionMechanicDefinition, host: MissionMechanicHost): number {
  if (mechanic.kind === 'column-shot') return columnShotTotalHp(mechanic);
  if (mechanic.kind === 'dark-wisps') return darkWispsTotalHp(mechanic);
  if (mechanic.kind === 'lanes') return lanesTotalHp(mechanic);
  return host.required;
}

export function mechanicProgress(mechanic: MissionMechanicDefinition, host: MissionMechanicHost, state: MissionMechanicState): { current: number; total: number } {
  // A rush counts wisps struck down against the host's goal.
  if (mechanic.kind === 'wisp-rush' && state.kind === 'wisp-rush') return { current: Math.min(host.required, wispRushFallen(state)), total: host.required };
  if (mechanic.kind === 'column-shot' && state.kind === 'column-shot') return columnShotProgress(mechanic, state);
  if (mechanic.kind === 'dark-wisps' && state.kind === 'dark-wisps') return darkWispsProgress(mechanic, state);
  if (mechanic.kind === 'lanes' && state.kind === 'lanes') return lanesProgress(mechanic, state);
  const total = host.required;
  return { current: Math.max(0, Math.min(total, Math.floor(state.strikes))), total };
}

export function mechanicComplete(mechanic: MissionMechanicDefinition, host: MissionMechanicHost, state: MissionMechanicState): boolean {
  // A rush is over when its clock says so, never because the wisps ran out: they do not.
  if (mechanic.kind === 'wisp-rush') return false;
  if (mechanic.kind === 'column-shot' && state.kind === 'column-shot') return columnShotComplete(mechanic, state);
  if (mechanic.kind === 'dark-wisps' && state.kind === 'dark-wisps') return darkWispsComplete(mechanic, state);
  if (mechanic.kind === 'lanes') return state.kind === 'lanes' && lanesComplete(mechanic, state);
  return state.strikes >= host.required;
}

/** The strike a board command produced, and the state after it; no strike when nothing was made. */
export function strikeFor(mechanic: MissionMechanicDefinition, host: MissionMechanicHost, window: MissionWindow, state: MissionMechanicState, event: MissionStrikeEvent | null, items?: ReadonlyMap<string, MergeItemDefinition>): { next: MissionMechanicState; strike: MissionStrike | null } {
  if (!event) return { next: state, strike: null };
  // A Wisp Rush strike is decided by the heat's own rules (tiers, combos, which wisp takes it) and handed to the layer
  // by the heat's dock; a stored board never resolves one.
  // Lanes: a merge strikes nothing itself; the pieces fire on their own clock (`lanesTick`).
  if (mechanic.kind === 'wisp-rush' || mechanic.kind === 'lanes') return { next: state, strike: null };
  if (mechanic.kind === 'column-shot' && state.kind === 'column-shot') return columnShotStrike(mechanic, window, state, event, items);
  if (mechanic.kind === 'dark-wisps' && state.kind === 'dark-wisps') return darkWispsStrike(mechanic, state, event, items, window);
  const strike = glowStrikeAt(host, state.strikes, 'glow', event.resultCell, event.resultDefinitionId);
  return { next: { kind: 'glow-strikes', strikes: state.strikes + 1 }, strike };
}

/** A landed strike applied to what the wisps show: the layer advances its own copy as each flight arrives. */
export function applyStrike(mechanic: MissionMechanicDefinition, state: MissionMechanicState, strike: MissionStrike): MissionMechanicState {
  if (mechanic.kind === 'wisp-rush' && state.kind === 'wisp-rush') return applyWispRushStrike(state, strike);
  if (mechanic.kind === 'column-shot' && state.kind === 'column-shot') return applyColumnShot(state, strike);
  if (mechanic.kind === 'dark-wisps' && state.kind === 'dark-wisps') return applyDarkWisps(state, strike);
  if (mechanic.kind === 'lanes') return state;
  return { kind: 'glow-strikes', strikes: state.strikes + 1 };
}

/**
 * What the wisp layer's own copy takes from the board's state while the board is up. For most mechanics nothing (the
 * copy moves only as flights land); a rush's wisps appear over time, so the copy gains each new one; Dark Wisps mend
 * and act between strikes, so the copy takes their damage as the board has it. The same object back means nothing changed.
 */
export function syncMechanicState(mechanic: MissionMechanicDefinition, shown: MissionMechanicState, incoming: MissionMechanicState): MissionMechanicState {
  if (mechanic.kind === 'wisp-rush' && shown.kind === 'wisp-rush' && incoming.kind === 'wisp-rush') return syncWispRush(shown, incoming);
  // Lanes: the board's clock decides everything (Glow lands when the board says); the layer shows it as it is.
  if (mechanic.kind === 'lanes') return incoming;
  if (mechanic.kind === 'dark-wisps' && shown.kind === 'dark-wisps' && incoming.kind === 'dark-wisps') {
    // v2: the intents, wards and calls move with the board too.
    const same = (a?: readonly unknown[], b?: readonly unknown[]) => (a ?? []).length === (b ?? []).length && (a ?? []).every((value, index) => value === b![index]);
    // Territory: nests move (a burrow, a call) and spores come and go with them.
    if (shown.actions === incoming.actions && same(shown.damage, incoming.damage) && same(shown.countdown, incoming.countdown) && same(shown.ward, incoming.ward) && same(shown.called, incoming.called) && same(shown.cycle, incoming.cycle) && same(shown.nest, incoming.nest) && same(shown.order, incoming.order) && (shown.spores ?? []).length === (incoming.spores ?? []).length) return shown;
    return { ...shown, actions: incoming.actions, damage: [...incoming.damage], countdown: incoming.countdown && [...incoming.countdown], cycle: incoming.cycle && [...incoming.cycle], ward: incoming.ward && [...incoming.ward], gathered: incoming.gathered && [...incoming.gathered], called: incoming.called && [...incoming.called], nest: incoming.nest && [...incoming.nest], split: incoming.split && [...incoming.split], spores: incoming.spores && incoming.spores.map((spore) => ({ ...spore })), order: incoming.order && [...incoming.order], plan: incoming.plan ?? null };
  }
  return shown;
}

export function wispViews(mechanic: MissionMechanicDefinition, host: MissionMechanicHost, state: MissionMechanicState): MissionWispView[] {
  if (mechanic.kind === 'wisp-rush' && state.kind === 'wisp-rush') return wispRushViews(mechanic, state);
  if (mechanic.kind === 'column-shot' && state.kind === 'column-shot') return columnShotViews(mechanic, state);
  if (mechanic.kind === 'dark-wisps' && state.kind === 'dark-wisps') return darkWispsViews(mechanic, state);
  if (mechanic.kind === 'lanes') return state.kind === 'lanes' ? lanesViews(mechanic, state) : [];
  return glowStrikesViews(host, state);
}

export function mechanicMove(mechanic: MissionMechanicDefinition, board: MergeWorldState, state: MissionMechanicState, window: MissionWindow): MissionMechanicMove | null {
  if (mechanic.kind === 'column-shot' && state.kind === 'column-shot') return columnShotMove(mechanic, board, state, window);
  if (mechanic.kind === 'dark-wisps') return darkWispsMove(board, window);
  return glowStrikesMove(board, window);
}

/**
 * The wisps' turn once the player has spent an action: what they do to the
 * board and to themselves, and the effects for the layer to show. Every
 * mechanic but Dark Wisps leaves the board as it is.
 */
export function afterAction(mechanic: MissionMechanicDefinition, host: MissionMechanicHost, state: MissionMechanicState, board: MergeWorldState, context: MechanicActionContext): { state: MissionMechanicState; board: MergeWorldState; effects: MechanicEffect[] } {
  if (mechanic.kind === 'dark-wisps' && state.kind === 'dark-wisps') return darkWispsAfterAction(mechanic, state, board, context.window, context.rng, context.items);
  return { state, board, effects: [] };
}

/**
 * Before a command is settled: a territory battle locks in the plan the player is looking at (its first turn has
 * none saved yet). Every other mechanic, and a state with its plan already locked, comes back as it is.
 */
export function prepareMechanic(mechanic: MissionMechanicDefinition, state: MissionMechanicState, board: MergeWorldState, window: MissionWindow, items?: ReadonlyMap<string, MergeItemDefinition>): MissionMechanicState {
  if (mechanic.kind === 'dark-wisps' && state.kind === 'dark-wisps') return darkWispsPrepare(mechanic, state, board, window, items);
  return state;
}

/** Merge tactics (`docs/encounter-tactics.md`): every player action is a turn and every wisp acts after it. */
export const mechanicIsTactics = (mechanic: MissionMechanicDefinition): boolean => mechanic.kind === 'dark-wisps' && isTactics(mechanic);

/**
 * A merge's strike, read off the board: in Merge vs Mist a merge beside an exposed wisp cleanses it (the board is read
 * after the pulse); every other board strikes as `strikeFor` does.
 */
export function strikeOnBoard(mechanic: MissionMechanicDefinition, host: MissionMechanicHost, window: MissionWindow, state: MissionMechanicState, event: MissionStrikeEvent | null, board: MergeWorldState, items?: ReadonlyMap<string, MergeItemDefinition>): { next: MissionMechanicState; strike: MissionStrike | null } {
  if (event && mechanic.kind === 'dark-wisps' && state.kind === 'dark-wisps' && isTactics(mechanic)) return darkWispsCleanseStrike(mechanic, state, event, board, window);
  return strikeFor(mechanic, host, window, state, event, items);
}

/**
 * Merge tactics: every wisp's plan for after the player's next action (index by wisp; null when it has none). Before
 * the first action none is saved yet: it is worked out from the board, exactly as the first action will lock it.
 */
export function mechanicPlans(mechanic: MissionMechanicDefinition, state: MissionMechanicState, board: MergeWorldState, window: MissionWindow, items?: ReadonlyMap<string, MergeItemDefinition>): (WispPlan | null)[] {
  if (mechanic.kind !== 'dark-wisps' || state.kind !== 'dark-wisps' || !isTactics(mechanic)) return [];
  return state.plans?.some(Boolean) ? state.plans : planTacticsTurn(mechanic, state, board, window, items);
}

/** A territory battle's plan: what the next wisp to act will do after the player's merge; null when nothing is planned. */
export function mechanicPlan(mechanic: MissionMechanicDefinition, state: MissionMechanicState, board: MergeWorldState, window: MissionWindow, items?: ReadonlyMap<string, MergeItemDefinition>): WispPlan | null {
  if (mechanic.kind !== 'dark-wisps' || state.kind !== 'dark-wisps') return null;
  return state.plan ?? planWispTurn(mechanic, state, board, window, items);
}

/** A territory battle's turn strip: the next entries to act (wisp indices; -1 a Rest). Empty on every other board. */
export function mechanicTurnStrip(mechanic: MissionMechanicDefinition, state: MissionMechanicState, count = 4): number[] {
  if (mechanic.kind !== 'dark-wisps' || state.kind !== 'dark-wisps') return [];
  return darkWispsTurnStrip(mechanic, state, count);
}

/**
 * A saved board's mechanic state: glow strikes are the saved merge count; a
 * column-shot or Dark Wisps board must carry a readable damage vector, or,
 * with no strike yet, starts fresh. Null means the save cannot be read.
 */
export function normalizeMechanicState(mechanic: MissionMechanicDefinition, value: unknown, strikes: number): MissionMechanicState | null {
  const count = Math.max(0, Math.floor(Number.isFinite(strikes) ? strikes : 0));
  // A rush is never saved mid-run: its board starts fresh.
  if (mechanic.kind === 'wisp-rush') return createWispRushState();
  if (mechanic.kind === 'lanes') return normalizeLanesState(mechanic, value, count);
  if (mechanic.kind === 'dark-wisps') {
    if (value == null) return count === 0 ? createDarkWispsState(mechanic) : null;
    return normalizeDarkWispsState(mechanic, value, count);
  }
  if (mechanic.kind !== 'column-shot') return { kind: 'glow-strikes', strikes: count };
  if (value == null) return count === 0 ? createColumnShotState(mechanic) : null;
  return normalizeColumnShotState(mechanic, value, count);
}

/** What a mechanic keeps in the board's save. */
export function mechanicSaveState(state: MissionMechanicState | null): MechanicSaveState | undefined {
  if (state?.kind === 'column-shot') return { damage: state.damage };
  if (state?.kind === 'dark-wisps') { const { kind: _kind, strikes: _strikes, ...saved } = state; return saved; }
  if (state?.kind === 'lanes') { const { kind: _kind, ...saved } = state; return { ...saved, damage: state.wisps.map((wisp) => wisp.damage) }; }
  return undefined;
}

/** Lanes (`docs/encounter-lanes.md`): a real-time board whose wisps come down its columns on their own clock. */
export const mechanicIsLanes = (mechanic: MissionMechanicDefinition): mechanic is Extract<MissionMechanicDefinition, { kind: 'lanes' }> => mechanic.kind === 'lanes';
