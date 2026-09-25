import type { MissionWindow } from '@/features/mission-mechanics/board-window';
import { mechanicComplete, mechanicMove, resolveMechanic, wispViews, type MissionMechanicHost } from '@/features/mission-mechanics/mechanic';
import type { EncounterDefinition, EncounterLoadout } from '@/types/encounter';
import type { MergeWorldState } from '@/types/merge-world';
import type { MissionMechanicState } from '@/types/mission-mechanic';
import { cacheEntries } from './cache';
import { encounterMistLeft, pullBackMist, type MistOpened } from './mist';
import { hashSeed } from './seed';

/** What the Haven brings into every encounter: the buildings' benefits and the helper Wisp's perk, as numbers. */
export type EncounterProfile = {
  /** Dew Spring: Resolve added to the board's budget. */
  startingResolve: number;
  /** Charges added to every spawner at the start. */
  extraCharges: number;
  /** Seed Nursery: added to every spawner's chance of a better drop. */
  tierTwoChance: number;
  tierThreeChance: number;
  /** Root Cellar: Mist cells opened before the first move. */
  openCells: number;
  /** Turns before the Dark Wisps first act (the Dew Spring's calm, a helper Wisp). */
  delay: number;
  /** Garden Stall and the Wisp's perk: added to the Glow the board pays, as a fraction. */
  glowBonus: number;
};

export const DEFAULT_ENCOUNTER_PROFILE: EncounterProfile = { startingResolve: 0, extraCharges: 0, tierTwoChance: 0, tierThreeChance: 0, openCells: 0, delay: 0, glowBonus: 0 };

/**
 * One attempt at an encounter: what has been spent, what is charged, what
 * has opened. Saved with the board; a new attempt starts fresh under a new
 * run id (and a new seed).
 */
export type EncounterRunState = {
  attempt: number;
  seed: string;
  /** Actions that cost Resolve, spent so far. */
  actions: number;
  merges: number;
  resolve: { budget: number | null; spent: number; extra: number; continues: number };
  /**
   * A territory battle: how many of the board's cells the Mist must hold to win (`overrun`), and how many it held
   * after the last turn and at most. Null on a board played by Resolve.
   */
  territory: { overrun: number; last: number; peak: number } | null;
  /** Merge tactics (`docs/encounter-tactics.md`): the rescue comes back every time the board runs dry. */
  tactics?: boolean;
  /** Focus / Ripple: the next merge (the next Water merge) clears as if this many tiers stronger. */
  boost?: { next: number; water: number };
  /** Scout: Mist cells whose hidden contents are shown. */
  revealed?: number[];
  spawners: Record<string, { sinceRecharge: number }>;
  ability: { charge: number; uses: number } | null;
  /** A spawner under Focus: taps left with better odds. */
  focus: { generatorId: string; taps: number; tierTwoChance: number } | null;
  cacheOpened: boolean;
  delay: number;
  loadout: EncounterLoadout | null;
};

export type EncounterStatus = 'playing' | 'cleared' | 'failed' | 'stuck';

export function runSeed(encounterId: string, attempt: number, loadout: EncounterLoadout | null): string {
  return hashSeed(`${encounterId}:${attempt}:${loadout?.companionId ?? '-'}:${loadout?.wispId ?? '-'}`).toString(36);
}

export function createEncounterRun(encounter: EncounterDefinition, input: { loadout?: EncounterLoadout | null; profile?: EncounterProfile; attempt?: number; ability?: boolean } = {}): EncounterRunState {
  const profile = input.profile ?? DEFAULT_ENCOUNTER_PROFILE;
  const attempt = Math.max(1, Math.floor(input.attempt ?? 1));
  const loadout = input.loadout ?? null;
  return {
    attempt,
    seed: runSeed(encounter.id, attempt, loadout),
    actions: 0,
    merges: 0,
    // A territory battle has no Resolve budget at all.
    resolve: { budget: encounter.territory != null || encounter.resolve == null ? null : Math.max(1, Math.floor(encounter.resolve + profile.startingResolve)), spent: 0, extra: 0, continues: 0 },
    territory: encounter.territory ? { overrun: territoryOverrun(encounter), last: 0, peak: 0 } : null,
    ...((encounter.mechanic?.kind === 'dark-wisps' && encounter.mechanic.mode === 'tactics') || encounter.mechanic?.kind === 'lanes' ? { tactics: true } : {}),
    spawners: Object.fromEntries(encounter.spawners.map((spawner) => [spawner.id, { sinceRecharge: 0 }])),
    ability: input.ability ? { charge: 0, uses: 0 } : null,
    focus: null,
    cacheOpened: false,
    delay: Math.max(0, Math.floor(profile.delay)),
    loadout,
  };
}

/** Resolve left, or Infinity on a board with no budget. */
export function resolveLeft(run: EncounterRunState): number {
  if (run.resolve.budget == null) return Number.POSITIVE_INFINITY;
  return Math.max(0, run.resolve.budget + run.resolve.extra - run.resolve.spent);
}

export const canAfford = (run: EncounterRunState, cost: number): boolean => cost <= 0 || resolveLeft(run) >= cost;

/** The cells of Mist that lose a territory battle: its share of the board, never less than one cell. */
export function territoryOverrun(encounter: EncounterDefinition): number {
  const cells = encounter.rows * 5;
  return Math.max(1, Math.min(cells, Math.ceil((encounter.territory?.overrun ?? 0.8) * cells - 1e-9)));
}

/** The Mist's hold after a turn, remembered for the bar and the grade. */
export function recordCoverage(run: EncounterRunState, board: MergeWorldState, window: MissionWindow): EncounterRunState {
  if (!run.territory) return run;
  const last = encounterMistLeft(board, window);
  if (last === run.territory.last && last <= run.territory.peak) return run;
  return { ...run, territory: { ...run.territory, last, peak: Math.max(run.territory.peak, last) } };
}

/** Keep going on a territory battle: the Mist pulled back this many cells, and every spawner this many pieces more. */
export const KEEP_GOING_PULLBACK = 4;
export const KEEP_GOING_CHARGES = 2;

export function spend(run: EncounterRunState, cost: number): EncounterRunState {
  if (cost <= 0) return run;
  return { ...run, resolve: { ...run.resolve, spent: run.resolve.spent + cost }, actions: run.actions + 1 };
}

/** Keep going: more Resolve, remembered against the grade. */
export function extendResolve(run: EncounterRunState, amount: number): EncounterRunState {
  if (run.territory) return { ...run, resolve: { ...run.resolve, continues: run.resolve.continues + 1 } };
  if (run.resolve.budget == null) return run;
  return { ...run, resolve: { ...run.resolve, extra: run.resolve.extra + Math.max(0, Math.floor(amount)), continues: run.resolve.continues + 1 } };
}

/**
 * Keep going, board and attempt together: on a territory battle the Mist is pulled back and the spawners topped up
 * (so a board lost to the Mist, closed in, or spent can be played on); elsewhere, more Resolve.
 */
export function keepGoing(board: MergeWorldState, run: EncounterRunState, window: MissionWindow, amount: number): { board: MergeWorldState; run: EncounterRunState; opened: MistOpened[] } {
  const extended = extendResolve(run, amount);
  if (!run.territory) return { board, run: extended, opened: [] };
  const pulled = pullBackMist(board, window, KEEP_GOING_PULLBACK);
  let next = pulled.board;
  for (const index of window.cellIndices) {
    const occupant = next.board[index]?.occupant;
    const generator = occupant?.kind === 'generator' ? next.generators[occupant.generatorId] : null;
    if (!occupant || occupant.kind !== 'generator' || !generator) continue;
    const charges = generator.charges + KEEP_GOING_CHARGES;
    next = { ...next, generators: { ...next.generators, [occupant.generatorId]: { ...generator, charges, capacity: Math.max(generator.capacity, charges) } } };
  }
  return { board: next, run: recordCoverage(extended, next, window), opened: pulled.opened };
}

/** Whether the board's objective is met: every wisp down, one named Dark Wisp down, or the cache opened. */
export function objectiveMet(encounter: EncounterDefinition, host: MissionMechanicHost, mechanicState: MissionMechanicState, run: EncounterRunState, board?: MergeWorldState): boolean {
  const mechanic = resolveMechanic(host);
  if (encounter.objective.kind === 'cache') return run.cacheOpened;
  // A rescue: the wisps down is not enough; the trapped cell must be out of the Mist too (a board unseen is not).
  if (encounter.objective.kind === 'rescue') return Boolean(board && !board.board[encounter.objective.cell]?.mist) && mechanicComplete(mechanic, host, mechanicState);
  if (encounter.objective.kind === 'dark-wisp') {
    const wispId = encounter.objective.wispId;
    const named = wispViews(mechanic, host, mechanicState).find((wisp) => wisp.id === wispId);
    return named ? !named.alive : mechanicComplete(mechanic, host, mechanicState);
  }
  return mechanicComplete(mechanic, host, mechanicState);
}

/** Spawners on the board with a charge left. */
export function chargedSpawners(board: MergeWorldState, window: MissionWindow): string[] {
  return window.cellIndices.flatMap((index) => {
    const occupant = board.board[index]?.occupant;
    if (occupant?.kind !== 'generator') return [];
    const generator = board.generators[occupant.generatorId];
    return generator && generator.charges > 0 ? [occupant.generatorId] : [];
  });
}

/**
 * Where the attempt stands. Cleared is checked before the budget, so the
 * merge that finishes the board on its last Resolve counts. Stuck is a board
 * with Resolve left and nothing to do: no move, no charge, the cache still
 * shut (or spent).
 */
export function encounterStatus(encounter: EncounterDefinition, host: MissionMechanicHost, mechanicState: MissionMechanicState, run: EncounterRunState, board: MergeWorldState, window: MissionWindow): EncounterStatus {
  if (objectiveMet(encounter, host, mechanicState, run, board)) return 'cleared';
  if (run.territory) {
    const reason = lossReason(encounter, host, mechanicState, run, board, window);
    // Lanes: pieces keep arriving on their own, so a board with nothing to merge is only waiting, never stuck.
    if (mechanicState.kind === 'lanes') return reason ? 'failed' : 'playing';
    return reason ? 'failed' : (hasMerge(host, mechanicState, board, window) || (chargedSpawners(board, window).length && freeCells(board, window) > 0)) ? 'playing' : 'stuck';
  }
  if (resolveLeft(run) <= 0) return 'failed';
  const mechanic = resolveMechanic(host);
  if (mechanicMove(mechanic, board, mechanicState, window) || chargedSpawners(board, window).length) return 'playing';
  return 'stuck';
}

const hasMerge = (host: MissionMechanicHost, mechanicState: MissionMechanicState, board: MergeWorldState, window: MissionWindow) => Boolean(mechanicMove(resolveMechanic(host), board, mechanicState, window));
const freeCells = (board: MergeWorldState, window: MissionWindow) => window.cellIndices.filter((index) => { const cell = board.board[index]; return Boolean(cell) && !cell.locked && !cell.mist && !cell.occupant; }).length;

/**
 * Why a territory attempt is lost, or null while it is not: the Mist holds too much of the board (overrun); it closed
 * in (no free cell and no merge); or the board is spent (no merge, no Pod charge) with its one rescue already used.
 */
export type EncounterLossReason = 'overrun' | 'choked' | 'spent' | 'resolve' | 'breached';
export function lossReason(encounter: EncounterDefinition, host: MissionMechanicHost, mechanicState: MissionMechanicState, run: EncounterRunState, board: MergeWorldState, window: MissionWindow): EncounterLossReason | null {
  if (objectiveMet(encounter, host, mechanicState, run, board)) return null;
  if (!run.territory) return resolveLeft(run) <= 0 ? 'resolve' : null;
  // Lanes: lost only when a wisp gets past the bottom row (a dry board brings the rescue, again and again).
  if (mechanicState.kind === 'lanes') return mechanicState.breached != null ? 'breached' : null;
  if (encounterMistLeft(board, window) >= run.territory.overrun) return 'overrun';
  if (hasMerge(host, mechanicState, board, window)) return null;
  if (freeCells(board, window) === 0) return 'choked';
  if (chargedSpawners(board, window).length) return null;
  // A tactics battle's rescue comes back every time the board runs dry: lost only when it has nothing to bring.
  if (run.tactics) return cacheEntries(encounter, board, window).length ? null : 'spent';
  return run.cacheOpened ? 'spent' : null;
}

export function normalizeEncounterRun(value: unknown, encounter: EncounterDefinition): EncounterRunState | null {
  const raw = value as Partial<EncounterRunState> | null;
  if (!raw || typeof raw !== 'object' || typeof raw.seed !== 'string' || !raw.resolve || typeof raw.resolve !== 'object') return null;
  const int = (entry: unknown, fallback: number) => Math.max(0, Math.floor(Number.isFinite(entry) ? Number(entry) : fallback));
  const fresh = createEncounterRun(encounter, { attempt: int(raw.attempt, 1), loadout: raw.loadout ?? null, ability: Boolean(raw.ability) });
  const budget = raw.resolve.budget == null ? null : int(raw.resolve.budget, 0);
  // A board whose budget was authored since it was saved cannot be read.
  if ((budget == null) !== (encounter.resolve == null)) return null;
  return {
    ...fresh,
    seed: raw.seed,
    actions: int(raw.actions, 0),
    merges: int(raw.merges, 0),
    resolve: { budget, spent: int(raw.resolve.spent, 0), extra: int(raw.resolve.extra, 0), continues: int(raw.resolve.continues, 0) },
    spawners: Object.fromEntries(encounter.spawners.map((spawner) => [spawner.id, { sinceRecharge: int(raw.spawners?.[spawner.id]?.sinceRecharge, 0) }])),
    ability: raw.ability && typeof raw.ability === 'object' ? { charge: int(raw.ability.charge, 0), uses: int(raw.ability.uses, 0) } : fresh.ability,
    focus: raw.focus && typeof raw.focus === 'object' && typeof raw.focus.generatorId === 'string' ? { generatorId: raw.focus.generatorId, taps: int(raw.focus.taps, 0), tierTwoChance: Math.max(0, Math.min(1, Number(raw.focus.tierTwoChance) || 0)) } : null,
    cacheOpened: Boolean(raw.cacheOpened),
    territory: fresh.territory && raw.territory && typeof raw.territory === 'object' ? { overrun: fresh.territory.overrun, last: int(raw.territory.last, 0), peak: int(raw.territory.peak, 0) } : fresh.territory,
    delay: int(raw.delay, 0),
  };
}
