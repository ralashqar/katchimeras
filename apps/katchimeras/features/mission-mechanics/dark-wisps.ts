import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import type { MergeBoardCell, MergeItemDefinition, MergeWorldState } from '@/types/merge-world';
import type { DarkWisp, MechanicEffect, MissionMechanicDefinition, MissionMechanicMove, MissionMechanicState, MissionStrike, MissionWispView, WispIntent, WispIntentKind, WispPlan } from '@/types/mission-mechanic';
import { darkWispLook } from '@/constants/dark-wisp-looks';
import { chainRole, WEAKNESS_BONUS } from '@/features/encounter/chains';
import { columnCells, pulseArea, pulseReachesSky, windowArea, windowDistance } from '@/features/encounter/pulse';
import { seededUnit } from '@/features/encounter/seed';
import { planDrift, planSpread, wispFrontier, wispRegion } from '@/features/encounter/wisp-ai';
import { windowItems, type MissionWindow } from './board-window';
import { glowStrikesMove } from './glow-strikes';
import type { MissionStrikeEvent } from './mechanic';

export type DarkWispsDefinition = Extract<MissionMechanicDefinition, { kind: 'dark-wisps' }>;
export type DarkWispsState = Extract<MissionMechanicState, { kind: 'dark-wisps' }>;

/**
 * Dark Wisps: wisps that fed on the Mist long enough to learn to want. Each has hit points and a cycle of intents.
 *
 * In a territory battle (`docs/encounter-territory.md`, `docs/encounter-turns-sky-bound.md`) a nest wisp sits on a
 * board cell inside its own Mist and a sky wisp floats over the island above one of the board's columns. After every
 * merge exactly one entry of the turn strip acts: the front one plays its current intent (as planned and shown before
 * the merge), goes on to its next and moves to the back; Rest entries do nothing. A merge strikes the nest inside its
 * Harmony pulse, or the sky wisp over a column its pulse reaches past the top row; a struck wisp waiting in the strip
 * is pushed back one place. When the Mist closes over a piece it binds it (a Plant or bigger holds its ground).
 *
 * Older boards keep counting down: every wisp's countdown falls by one a turn and it acts at zero. The mission is
 * done when every wisp on the board is down; the strike that fells the last is the finale. Pure.
 */
const DEFAULT_DAMAGE: readonly number[] = [1];
const DEFAULT_STAGGER = 3;
/** Turns a spore waits on an empty cell before it turns to Mist. */
export const SPORE_TURNS = 2;
/** A Rest in the turn strip. */
export const REST = -1;
/** A piece of this tier or above holds its ground when the Mist is planned onto it. */
export const HOLDS_GROUND_TIER = 3;
const SHIELD_DEFAULT = 2;

export function darkWispsDamage(mechanic: DarkWispsDefinition, definitionId: string, items: ReadonlyMap<string, MergeItemDefinition> = MERGE_ITEMS_BY_ID): number {
  const tier = Math.max(1, Math.floor(items.get(definitionId)?.tier ?? 1));
  const table = mechanic.damageByTier?.length ? mechanic.damageByTier : DEFAULT_DAMAGE;
  return Math.max(0, Math.floor(table[Math.min(tier, table.length) - 1]!));
}

/** A wisp's cycle of intents: its own, or its v1 behaviour read as one. */
export function wispIntents(wisp: DarkWisp): WispIntent[] {
  if (wisp.intents?.length) return [...wisp.intents];
  const behaviour = wisp.behaviour;
  if (!behaviour || behaviour.kind === 'plain') return [];
  if (behaviour.kind === 'shrouder') return [{ kind: 'shroud', every: behaviour.every }];
  if (behaviour.kind === 'hungry') return [{ kind: 'devour', every: behaviour.every }];
  if (behaviour.kind === 'rootbound') return [{ kind: 'root', every: behaviour.every }];
  return [{ kind: 'mend', every: behaviour.every, ...(behaviour.amount ? { amount: behaviour.amount } : {}) }];
}

const intentEvery = (intent: WispIntent | undefined) => Math.max(1, Math.floor(intent?.every ?? 1));

/** On the board: every wisp not held back, and a held-back one once it has been called. */
const present = (mechanic: DarkWispsDefinition, state: Pick<DarkWispsState, 'called'>, index: number) => !mechanic.wisps[index]!.hidden || Boolean(state.called?.[index]);

export function darkWispsTotalHp(mechanic: DarkWispsDefinition): number {
  return mechanic.wisps.reduce((sum, wisp) => sum + (wisp.hidden ? 0 : Math.max(0, Math.floor(wisp.hp))), 0);
}

/** A territory battle: its wisps nest on board cells or float over the island, and one acts after every merge. */
export const isTerritory = (mechanic: DarkWispsDefinition): boolean => mechanic.targeting === 'adjacent' || mechanic.wisps.some((wisp) => wisp.placement.kind === 'cell' || wisp.placement.kind === 'sky');
/** Merge tactics (`docs/encounter-tactics.md`): every action a turn, every wisp acting after it, wisps walking the board. */
export const isTactics = (mechanic: DarkWispsDefinition): boolean => mechanic.mode === 'tactics';
const isSky = (wisp: DarkWisp) => wisp.placement.kind === 'sky';
const skyColumn = (wisp: DarkWisp) => (wisp.placement.kind === 'sky' ? wisp.placement.column : 0);

/** A wisp's entries in the turn strip, spread through it: a boss with two slots acts twice a round. */
function stripEntries(mechanic: DarkWispsDefinition, indices: readonly number[]): number[] {
  const acting = indices.filter((index) => wispIntents(mechanic.wisps[index]!).length || mechanic.wisps[index]!.kind);
  const most = Math.max(0, ...acting.map((index) => Math.max(1, Math.floor(mechanic.wisps[index]!.slots ?? 1))));
  const out: number[] = [];
  for (let round = 0; round < most; round += 1) for (const index of acting) if (Math.max(1, Math.floor(mechanic.wisps[index]!.slots ?? 1)) > round) out.push(index);
  return out;
}

/** The turn strip a battle opens with: every present wisp that acts, with the level's Rest turns spaced between them. */
export function initialTurnOrder(mechanic: DarkWispsDefinition, called: readonly boolean[] = []): number[] {
  const entries = stripEntries(mechanic, mechanic.wisps.map((_, index) => index).filter((index) => !mechanic.wisps[index]!.hidden || called[index]));
  const rests = Math.max(0, Math.floor(mechanic.rest ?? 0));
  if (!rests) return entries;
  if (!entries.length) return Array.from({ length: rests }, () => REST);
  const out: number[] = [];
  const ratio = entries.length / rests;
  let placed = 0;
  entries.forEach((entry, position) => {
    out.push(entry);
    while (placed < Math.min(rests, Math.floor((position + 1) / ratio + 1e-9))) { out.push(REST); placed += 1; }
  });
  while (placed < rests) { out.push(REST); placed += 1; }
  return out;
}

export function createDarkWispsState(mechanic: DarkWispsDefinition): DarkWispsState {
  const territory = isTerritory(mechanic);
  return {
    kind: 'dark-wisps', strikes: 0, actions: 0,
    damage: mechanic.wisps.map(() => 0), struckAt: mechanic.wisps.map(() => -1),
    countdown: mechanic.wisps.map((wisp) => intentEvery(wispIntents(wisp)[0])),
    cycle: mechanic.wisps.map(() => 0), ward: mechanic.wisps.map(() => 0), gathered: mechanic.wisps.map(() => 0), called: mechanic.wisps.map(() => false), knocked: mechanic.wisps.map(() => false),
    nest: mechanic.wisps.map((wisp) => (!wisp.hidden && wisp.placement.kind === 'cell' ? wisp.placement.cell : -1)), split: mechanic.wisps.map(() => false), spores: [],
    order: territory ? initialTurnOrder(mechanic) : [], plan: null, pushed: mechanic.wisps.map(() => false),
    plans: mechanic.wisps.map(() => null),
  };
}

type FullState = Required<DarkWispsState>;

/** A state saved before intents (or partly): the missing arrays filled as a fresh board has them. */
function withIntentState(mechanic: DarkWispsDefinition, state: DarkWispsState): FullState {
  const fresh = createDarkWispsState(mechanic) as FullState;
  const fill = <T,>(list: T[] | undefined, fallback: T[]) => (list && list.length === mechanic.wisps.length ? list : fallback);
  const called = fill(state.called, fresh.called);
  return {
    ...state, countdown: fill(state.countdown, fresh.countdown), cycle: fill(state.cycle, fresh.cycle), ward: fill(state.ward, fresh.ward), gathered: fill(state.gathered, fresh.gathered), called, knocked: fill(state.knocked, fresh.knocked),
    nest: fill(state.nest, fresh.nest), split: fill(state.split, fresh.split), spores: state.spores ?? [],
    order: state.order ?? (isTerritory(mechanic) ? initialTurnOrder(mechanic, called) : []), plan: state.plan ?? null, pushed: fill(state.pushed, fresh.pushed),
    plans: fill(state.plans, fresh.plans),
  };
}

export const darkWispAlive = (mechanic: DarkWispsDefinition, damage: readonly number[], index: number, state?: Pick<DarkWispsState, 'called'>): boolean =>
  (!state || present(mechanic, state, index)) && (!mechanic.wisps[index]!.hidden || Boolean(state?.called?.[index])) && damage[index]! < mechanic.wisps[index]!.hp;

export function darkWispsStanding(mechanic: DarkWispsDefinition, state: DarkWispsState): number[] {
  return mechanic.wisps.map((_, index) => index).filter((index) => darkWispAlive(mechanic, state.damage, index, state));
}

/** A sky wisp whose guards still stand cannot be hurt. */
function guarded(mechanic: DarkWispsDefinition, state: Pick<DarkWispsState, 'damage' | 'called'>, index: number): boolean {
  const guards = mechanic.wisps[index]!.guardedBy;
  if (!guards?.length) return false;
  return guards.some((id) => {
    const guard = mechanic.wisps.findIndex((wisp) => wisp.id === id);
    return guard >= 0 && darkWispAlive(mechanic, state.damage, guard, state);
  });
}

export const isPlantItem = (definitionId: string, items: ReadonlyMap<string, MergeItemDefinition> = MERGE_ITEMS_BY_ID): boolean => items.get(definitionId)?.familyId === 'nature';

const tierOf = (definitionId: string, items: ReadonlyMap<string, MergeItemDefinition>) => Math.max(1, Math.floor(items.get(definitionId)?.tier ?? 1));

/** Where a wisp stands in the turn strip (0: it acts next); Infinity when it is not in it. */
function stripPlace(state: FullState, index: number): number {
  const place = state.order.indexOf(index);
  return place < 0 ? Number.POSITIVE_INFINITY : place;
}

/**
 * Territory: the standing wisp a merge landing on `cell` with a result of `tier` would strike: a nest inside the
 * pulse first; else a sky wisp over a column the pulse reaches past the top row (never one its guards still shield).
 * The one acting soonest, then the weakest. Null when nothing is in reach.
 */
export function pulseTarget(mechanic: DarkWispsDefinition, raw: DarkWispsState, cell: number, tier: number, window: MissionWindow): number | null {
  const state = withIntentState(mechanic, raw);
  const standing = darkWispsStanding(mechanic, state);
  const soon = (index: number) => (isTerritory(mechanic) ? stripPlace(state, index) : wispIntents(mechanic.wisps[index]!).length ? state.countdown[index]! : Number.POSITIVE_INFINITY);
  const best = (list: number[]) => (list.length ? [...list].sort((a, b) => soon(a) - soon(b) || (mechanic.wisps[a]!.hp - state.damage[a]!) - (mechanic.wisps[b]!.hp - state.damage[b]!) || a - b)[0]! : null);
  const reach = new Set(pulseArea(cell, tier, window).cells);
  const nests = best(standing.filter((index) => !isSky(mechanic.wisps[index]!) && reach.has(state.nest[index]!)));
  if (nests != null) return nests;
  const sky = new Set(pulseReachesSky(cell, tier, window));
  return best(standing.filter((index) => isSky(mechanic.wisps[index]!) && sky.has(skyColumn(mechanic.wisps[index]!)) && !guarded(mechanic, state, index)));
}

/** The wisp a strike lands on: in a territory battle the one in the pulse (or none); else the first standing, or the weakest. */
function targetFor(mechanic: DarkWispsDefinition, state: FullState, event: MissionStrikeEvent, items: ReadonlyMap<string, MergeItemDefinition>, window: MissionWindow | null): number | null {
  if (isTerritory(mechanic)) return window ? pulseTarget(mechanic, state, event.resultCell, tierOf(event.resultDefinitionId, items), window) : null;
  const standing = darkWispsStanding(mechanic, state);
  if (!standing.length) return null;
  if (mechanic.targeting !== 'weakest') return standing[0]!;
  return [...standing].sort((a, b) => (mechanic.wisps[a]!.hp - state.damage[a]!) - (mechanic.wisps[b]!.hp - state.damage[b]!) || a - b)[0]!;
}

export function darkWispsStrike(mechanic: DarkWispsDefinition, raw: DarkWispsState, event: MissionStrikeEvent, items: ReadonlyMap<string, MergeItemDefinition> = MERGE_ITEMS_BY_ID, window: MissionWindow | null = null): { next: DarkWispsState; strike: MissionStrike | null } {
  const state = withIntentState(mechanic, raw);
  const target = targetFor(mechanic, state, event, items, window);
  if (target == null) return { next: raw, strike: null };
  const wisp = mechanic.wisps[target]!;
  const bonus = wisp.behaviour?.kind === 'rootbound' && isPlantItem(event.resultDefinitionId, items) ? Math.max(0, Math.floor(wisp.behaviour.plantBonus)) : 0;
  // A wisp weak to the chain the merge made takes one more.
  const weakness = wisp.weakTo && chainRole(event.resultDefinitionId, items) === wisp.weakTo ? WEAKNESS_BONUS : 0;
  let amount = darkWispsDamage(mechanic, event.resultDefinitionId, items) + bonus + weakness;
  // A ward takes the hit first.
  const ward = [...state.ward];
  const absorbed = Math.min(ward[target]!, amount);
  ward[target] = ward[target]! - absorbed;
  amount -= absorbed;
  const dealt = Math.max(0, Math.min(amount, wisp.hp - state.damage[target]!));
  const damage = [...state.damage];
  damage[target] = damage[target]! + dealt;
  const struckAt = [...state.struckAt];
  struckAt[target] = state.actions;
  const intents = wispIntents(wisp);
  const countdown = [...state.countdown];
  const gathered = [...state.gathered];
  const knocked = [...state.knocked];
  const pushed = [...state.pushed];
  let order = [...state.order];
  const touched = dealt > 0 || absorbed > 0;
  if (touched && intents.length) {
    const current = intents[state.cycle[target]! % intents.length]!;
    if (current.kind === 'gather') gathered[target] = gathered[target]! + dealt;
    if (isTerritory(mechanic)) {
      // A struck wisp waiting in the strip is pushed back one place (once a turn); the one about to act still acts.
      const place = order.indexOf(target);
      if (place >= 1 && place < order.length - 1 && !pushed[target]) {
        [order[place], order[place + 1]] = [order[place + 1]!, order[place]!];
        pushed[target] = true;
      }
    } else if (!knocked[target] && countdown[target]! < intentEvery(current)) {
      // Older boards: the first hit on an intent knocks it back a turn, once, and only when that moves it.
      countdown[target] = countdown[target]! + 1;
      knocked[target] = true;
    }
  }
  // A fallen wisp leaves the strip; one felled before it could act simply does not.
  if (damage[target]! >= wisp.hp && order.length) order = order.filter((entry, place) => entry !== target || place === 0);
  const next: DarkWispsState = { ...state, strikes: state.strikes + 1, damage, struckAt, ward, countdown, gathered, knocked, pushed, order };
  const finale = darkWispsComplete(mechanic, next);
  return { next, strike: { fromCell: event.resultCell, resultDefinitionId: event.resultDefinitionId, hits: touched ? [{ wisp: target, damage: dealt }] : [], target, finale, wasted: !touched } };
}

/**
 * Trailfinder: every wisp's next move a turn further off. In the strip a Rest goes to the front (the plan it would
 * have acted on is dropped); on an older board every countdown goes back one, never past where it started.
 */
export function pushBackDarkWisps(mechanic: DarkWispsDefinition, raw: DarkWispsState): DarkWispsState {
  const state = withIntentState(mechanic, raw);
  if (isTerritory(mechanic)) return { ...state, order: [REST, ...state.order], plan: null };
  const countdown = state.countdown.map((value, index) => {
    const intents = wispIntents(mechanic.wisps[index]!);
    if (!intents.length || !darkWispAlive(mechanic, state.damage, index, state)) return value;
    return Math.min(value + 1, intentEvery(intents[state.cycle[index]! % intents.length]));
  });
  return { ...state, countdown };
}

/** A landed strike on the layer's own copy. */
export function applyDarkWisps(state: DarkWispsState, strike: MissionStrike): DarkWispsState {
  const damage = [...state.damage];
  for (const hit of strike.hits) damage[hit.wisp] = (damage[hit.wisp] ?? 0) + hit.damage;
  return { ...state, strikes: state.strikes + 1, damage };
}

export function darkWispsProgress(mechanic: DarkWispsDefinition, state: DarkWispsState): { current: number; total: number } {
  const indices = mechanic.wisps.map((_, index) => index).filter((index) => present(mechanic, state, index));
  const total = indices.reduce((sum, index) => sum + mechanic.wisps[index]!.hp, 0);
  const current = indices.reduce((sum, index) => sum + Math.min(mechanic.wisps[index]!.hp, state.damage[index] ?? 0), 0);
  return { current: Math.max(0, Math.min(total, current)), total };
}

export function darkWispsComplete(mechanic: DarkWispsDefinition, state: DarkWispsState): boolean {
  return mechanic.wisps.every((_, index) => !present(mechanic, state, index) || state.damage[index]! >= mechanic.wisps[index]!.hp);
}

/** Where a sky wisp floats over the tile when its data says only its column: left to right, neighbours staggered. */
export function skyPlacement(column: number, size = 0.2) {
  const clamped = Math.max(1, Math.min(5, Math.round(column)));
  return { fx: 0.16 + (clamped - 1) * 0.17, fy: clamped % 2 === 0 ? 0.2 : 0.32, size };
}

export function darkWispsViews(mechanic: DarkWispsDefinition, raw: DarkWispsState): MissionWispView[] {
  const state = withIntentState(mechanic, raw);
  const territory = isTerritory(mechanic);
  const stagger = Math.max(1, Math.floor(mechanic.stagger ?? DEFAULT_STAGGER));
  return mechanic.wisps.map((wisp, index) => {
    const alive = darkWispAlive(mechanic, state.damage, index, state);
    const intents = wispIntents(wisp);
    const current = intents.length ? intents[state.cycle[index]! % intents.length]! : null;
    const nest = state.nest[index]!;
    const spores = state.spores.filter((spore) => spore.wisp === index).map(({ cell, turns }) => ({ cell, turns }));
    // In the strip, "turns until it acts" is its place in the strip.
    const place = stripPlace(state, index);
    const countdown = territory ? (Number.isFinite(place) ? place + 1 : null) : state.countdown[index]!;
    // Merge tactics: what it will do after the player's next action, and its place in the order the wisps act.
    const planned = isTactics(mechanic) ? state.plans[index] : null;
    const placement: MissionWispView['placement'] = wisp.placement.kind === 'cell' && nest >= 0 ? { ...wisp.placement, cell: nest }
      : wisp.placement.kind === 'sky' ? { kind: 'tile', ...skyPlacement(wisp.placement.column, wisp.placement.size), ...(wisp.placement.fx != null ? { fx: wisp.placement.fx } : {}), ...(wisp.placement.fy != null ? { fy: wisp.placement.fy } : {}) }
      : wisp.placement;
    return {
      id: wisp.id, hp: wisp.hp, damage: Math.min(wisp.hp, state.damage[index] ?? 0), alive,
      // A territory wisp is drawn on its nest, wherever it has burrowed or been called to; a sky wisp over the tile.
      placement,
      ...(spores.length && alive ? { spores } : {}),
      look: darkWispLook(wisp, intents[0]?.kind ?? null),
      ...(wisp.weakTo ? { weakTo: wisp.weakTo } : {}),
      ...(alive && territory && !isTactics(mechanic) && state.order[0] === index ? { acting: true } : {}),
      ...(alive && guarded(mechanic, state, index) ? { guarded: true } : {}),
      intent: planned && alive && countdown != null ? { kind: planned.kind, countdown, ...(state.ward[index] ? { ward: state.ward[index] } : {}) }
        : alive && current && countdown != null && !isTactics(mechanic) ? { kind: current.kind, countdown, ...(current.amount ? { amount: current.amount } : {}), ...(state.ward[index] ? { ward: state.ward[index] } : {}), ...(current.kind === 'gather' ? { gathered: state.gathered[index], stagger } : {}) } : null,
    };
  });
}

/** The turn strip as shown: its next entries (wisp indices, `REST` for a Rest). */
export function darkWispsTurnStrip(mechanic: DarkWispsDefinition, raw: DarkWispsState, count = 4): number[] {
  const state = withIntentState(mechanic, raw);
  const order = state.order.filter((entry) => entry === REST || darkWispAlive(mechanic, state.damage, entry, state));
  if (!order.length) return [];
  return Array.from({ length: Math.min(count, Math.max(order.length, count)) }, (_, place) => order[place % order.length]!);
}

export function darkWispsMove(board: MergeWorldState, window: MissionWindow): MissionMechanicMove | null {
  return glowStrikesMove(board, window);
}

export function normalizeDarkWispsState(mechanic: DarkWispsDefinition, value: unknown, strikes: number): DarkWispsState | null {
  const raw = value as Partial<DarkWispsState> | null;
  if (!raw || !Array.isArray(raw.damage) || raw.damage.length !== mechanic.wisps.length) return null;
  const n = mechanic.wisps.length;
  const ints = (list: unknown, fallback: number[], min = 0) => (Array.isArray(list) && list.length === n ? list.map((entry, index) => Math.max(min, Math.floor(Number.isFinite(entry) ? Number(entry) : fallback[index]!))) : fallback);
  const fresh = createDarkWispsState(mechanic) as FullState;
  const damage = raw.damage.map((entry, index) => Math.max(0, Math.min(mechanic.wisps[index]!.hp, Math.floor(Number.isFinite(entry) ? Number(entry) : 0))));
  const called = Array.isArray(raw.called) && raw.called.length === n ? raw.called.map(Boolean) : fresh.called;
  const order = Array.isArray(raw.order) && raw.order.every((entry) => Number.isInteger(entry) && entry >= REST && entry < n) ? raw.order.map(Number) : isTerritory(mechanic) ? initialTurnOrder(mechanic, called) : [];
  const plan = raw.plan && typeof raw.plan === 'object' && Number.isInteger(raw.plan.wisp) && raw.plan.wisp >= 0 && raw.plan.wisp < n && Array.isArray(raw.plan.cells) ? raw.plan : null;
  return {
    kind: 'dark-wisps', strikes, actions: Math.max(0, Math.floor(Number.isFinite(raw.actions) ? Number(raw.actions) : 0)), damage,
    struckAt: ints(raw.struckAt, mechanic.wisps.map(() => -1), -1),
    countdown: ints(raw.countdown, fresh.countdown), cycle: ints(raw.cycle, fresh.cycle), ward: ints(raw.ward, fresh.ward), gathered: ints(raw.gathered, fresh.gathered),
    called,
    knocked: Array.isArray(raw.knocked) && raw.knocked.length === n ? raw.knocked.map(Boolean) : fresh.knocked,
    nest: ints(raw.nest, fresh.nest, -1),
    split: Array.isArray(raw.split) && raw.split.length === n ? raw.split.map(Boolean) : fresh.split,
    spores: Array.isArray(raw.spores) ? raw.spores.filter((spore) => spore && Number.isInteger(spore.cell) && Number.isInteger(spore.turns) && Number.isInteger(spore.wisp) && spore.wisp >= 0 && spore.wisp < n).map((spore) => ({ cell: spore.cell, turns: Math.max(0, spore.turns), wisp: spore.wisp })) : [],
    order, plan, pushed: Array.isArray(raw.pushed) && raw.pushed.length === n ? raw.pushed.map(Boolean) : fresh.pushed,
    plans: Array.isArray(raw.plans) && raw.plans.length === n ? raw.plans.map((entry) => (entry && typeof entry === 'object' && Array.isArray(entry.cells) ? entry : null)) : fresh.plans,
  };
}

/** Open cells of the window with nothing on them and no Mist. */
export function windowEmptyCells(board: MergeWorldState, window: MissionWindow): number[] {
  return window.cellIndices.filter((index) => { const cell = board.board[index]; return Boolean(cell) && !cell.locked && !cell.mist && !cell.occupant; });
}

const encounterMistAt = (board: MergeWorldState, cell: number) => { const mist = board.board[cell]?.mist; return mist?.kind === 'encounter' ? mist : null; };
const looseItemAt = (board: MergeWorldState, cell: number) => { const entry = board.board[cell]; return entry && !entry.locked && !entry.mist && entry.occupant?.kind === 'item' ? entry.occupant : null; };

export { wispFrontier, wispRegion };

/** What a wisp's actions reach on a board: the cells its Mist spreads to, and the pieces it touches. */
type Reach = { spots: Map<number, number>; touching: Set<number> };

function reachOf(mechanic: DarkWispsDefinition, territory: boolean, nest: readonly number[], index: number, board: MergeWorldState, window: MissionWindow): Reach {
  const wisp = mechanic.wisps[index]!;
  if (territory && isSky(wisp)) {
    // A sky wisp works down its column from the top.
    const cells = columnCells(skyColumn(wisp), window);
    return { spots: new Map(cells.flatMap((cell, row) => (windowEmptyCells(board, window).includes(cell) ? [[cell, row] as const] : []))), touching: new Set(cells) };
  }
  if (territory && nest[index]! >= 0) {
    const region = wispRegion(board, nest[index]!, window);
    return { spots: wispFrontier(board, nest[index]!, window), touching: new Set([...region.keys()].flatMap((cell) => windowArea(cell, window, 'cross'))) };
  }
  return { spots: new Map(windowEmptyCells(board, window).map((cell) => [cell, 0])), touching: new Set(window.cellIndices) };
}

const markMist = (board: MergeWorldState, cell: number): MergeWorldState => {
  const cells = [...board.board];
  cells[cell] = { ...cells[cell]!, locked: true, occupant: null, mist: { kind: 'encounter', type: 'light', hp: 1 } };
  return { ...board, board: cells };
};

const SPREAD_KINDS: ReadonlySet<WispIntentKind> = new Set(['surge', 'snuff', 'gather', 'rain', 'shroud', 'root']);
/** Intents that take cells of the board: the plan outlines them. */
export const isSpreadIntent = (kind: WispIntentKind): boolean => SPREAD_KINDS.has(kind);

/**
 * What the wisp at the front of the turn strip will do after the player's next merge (`docs/encounter-turns-sky-bound.md`):
 * worked out on the board as it stands and locked in, so what the board shows is what happens. The same labels draw
 * the same luck, so a preview and the action agree. Null for a Rest, an empty strip, or an older board.
 */
export function planWispTurn(mechanic: DarkWispsDefinition, raw: DarkWispsState, board: MergeWorldState, window: MissionWindow, items: ReadonlyMap<string, MergeItemDefinition> = MERGE_ITEMS_BY_ID): WispPlan | null {
  const state = withIntentState(mechanic, raw);
  if (!isTerritory(mechanic)) return null;
  const front = state.order.find((entry) => entry === REST || darkWispAlive(mechanic, state.damage, entry, state));
  if (front == null || front === REST) return null;
  const intents = wispIntents(mechanic.wisps[front]!);
  if (!intents.length) return null;
  const intent = intents[state.cycle[front]! % intents.length]!;
  return planIntent(mechanic, state, front, intent, board, window, items, `plan:${state.actions}`);
}

function planIntent(mechanic: DarkWispsDefinition, state: FullState, index: number, intent: WispIntent, board: MergeWorldState, window: MissionWindow, items: ReadonlyMap<string, MergeItemDefinition>, seed: string): WispPlan {
  const wisp = mechanic.wisps[index]!;
  const territory = isTerritory(mechanic);
  const pick = <T,>(list: readonly T[], label: string): T | null => (list.length ? list[Math.min(list.length - 1, Math.floor(seededUnit(`${seed}:${wisp.id}:${label}`) * list.length))]! : null);
  const base = { wisp: index, kind: intent.kind, ...(intent.amount ? { amount: intent.amount } : {}) };
  const amountOf = (fallback: number) => Math.max(1, Math.floor(intent.amount ?? fallback));
  const tierAt = (cell: number) => { const item = looseItemAt(board, cell); return item ? items.get(item.definitionId)?.tier ?? 1 : 0; };
  /** The smallest loose pieces it can reach; never one of the last two on the board. */
  const bindable = (reach: Reach, exclude: ReadonlySet<number>) => {
    const all = windowItems(board, window.cellIndices);
    if (all.length <= 2) return [];
    const within = all.filter((item) => reach.touching.has(item.cell) && !exclude.has(item.cell));
    const floor = Math.min(...within.map((item) => tierAt(item.cell)));
    return within.filter((item) => tierAt(item.cell) === floor).map((item) => item.cell);
  };
  const nearestOf = (spots: Map<number, number>, label: string) => {
    const best = Math.min(...spots.values());
    return pick([...spots].filter(([, steps]) => steps === best).map(([cell]) => cell), label);
  };
  /** `n` cells for its Mist, nearest first, the Mist growing as it goes; walled in, the smallest piece it touches. */
  const spread = (n: number, choose: (spots: Map<number, number>, sim: MergeWorldState, step: number) => number | null) => {
    const cells: number[] = [];
    let sim = board;
    for (let step = 0; step < n; step += 1) {
      const reach = reachOf(mechanic, territory, state.nest, index, sim, window);
      for (const cell of cells) reach.spots.delete(cell);
      let cell = reach.spots.size ? choose(reach.spots, sim, step) : null;
      if (cell == null && territory) cell = pick(bindable(reach, new Set(cells)), `bind:${step}`);
      if (cell == null) break;
      cells.push(cell);
      sim = markMist(sim, cell);
    }
    return cells;
  };
  const itemsNear = (sim: MergeWorldState, cell: number) => windowArea(cell, window, 'cross').filter((other) => sim.board[other]?.occupant?.kind === 'item').length;
  switch (intent.kind) {
    case 'surge': case 'snuff': case 'rain':
      return { ...base, cells: spread(amountOf(1), (spots, _sim, step) => nearestOf(spots, `spread:${step}`)) };
    case 'gather':
      return { ...base, cells: spread(amountOf(3), (spots, _sim, step) => nearestOf(spots, `gather:${step}`)) };
    case 'shroud':
      return { ...base, cells: spread(1, (spots, sim) => {
        const best = Math.max(-1, ...[...spots.keys()].map((cell) => itemsNear(sim, cell)));
        return pick([...spots.keys()].filter((cell) => itemsNear(sim, cell) === best), 'shroud');
      }) };
    case 'root':
      return { ...base, cells: spread(1, (spots) => {
        const rooted = window.cellIndices.filter((cell) => encounterMistAt(board, cell)?.type === 'root');
        const free = [...spots.keys()];
        const beside = free.filter((cell) => windowArea(cell, window, 'cross').some((other) => rooted.includes(other)));
        return pick(beside.length ? beside : free, 'root');
      }) };
    case 'spores': {
      const reach = reachOf(mechanic, territory, state.nest, index, board, window);
      const free = windowEmptyCells(board, window).filter((cell) => !state.spores.some((spore) => spore.cell === cell));
      // A nest wisp drops them away from its own Mist (a second front); a sky wisp down its column.
      const pool = isSky(wisp) ? free.filter((cell) => reach.touching.has(cell)) : free.filter((cell) => !reach.spots.has(cell));
      const source = pool.length ? pool : free;
      const cells: number[] = [];
      for (let step = 0; step < amountOf(1); step += 1) {
        const cell = pick(source.filter((entry) => !cells.includes(entry)), `spores:${step}`);
        if (cell == null) break;
        cells.push(cell);
      }
      return { ...base, cells };
    }
    case 'devour': case 'bind': {
      const reach = reachOf(mechanic, territory, state.nest, index, board, window);
      const cell = pick(bindable(reach, new Set()), intent.kind);
      const item = cell != null ? looseItemAt(board, cell) : null;
      // Nothing to eat: its Mist creeps a cell closer instead.
      if (!item && intent.kind === 'devour' && territory) return { ...base, kind: isSky(wisp) ? 'rain' : 'surge', cells: spread(1, (spots) => nearestOf(spots, 'creep')) };
      return { ...base, cells: item ? [cell!] : [], ...(item ? { piece: { cell: cell!, instanceId: item.instanceId } } : {}) };
    }
    case 'burrow': {
      if (!territory || state.nest[index]! < 0) return { ...base, cells: [] };
      const from = state.nest[index]!;
      const taken = new Set(state.nest.filter((cell) => cell >= 0));
      const deeper = [...wispRegion(board, from, window).keys()].filter((cell) => cell !== from && !taken.has(cell) && encounterMistAt(board, cell)?.type !== 'wisp-bound' && encounterMistAt(board, cell)?.type !== 'bound');
      if (!deeper.length) return { ...base, cells: [] };
      // Away from the player: the cell with the fewest open cells around it, then the furthest from its old nest.
      const open = (cell: number) => windowArea(cell, window, 'cross').filter((other) => !encounterMistAt(board, other)).length;
      const snug = deeper.filter((cell) => open(cell) === Math.min(...deeper.map(open)));
      const far = Math.max(...snug.map((cell) => windowDistance(cell, from, window)));
      return { ...base, cells: [pick(snug.filter((cell) => windowDistance(cell, from, window) === far), 'burrow')!] };
    }
    case 'call': {
      const cell = arrivalCell(mechanic, state, index, board, window, (list, label) => pick(list, label));
      return { ...base, cells: cell != null ? [cell] : [] };
    }
    case 'shield': {
      // The nest wisp most worn down (the one the player is closest to felling).
      const standing = darkWispsStanding(mechanic, state).filter((other) => other !== index && !isSky(mechanic.wisps[other]!));
      const target = [...standing].sort((a, b) => (mechanic.wisps[a]!.hp - state.damage[a]!) - (mechanic.wisps[b]!.hp - state.damage[b]!) || a - b)[0];
      return { ...base, cells: target != null && state.nest[target]! >= 0 ? [state.nest[target]!] : [], target: target ?? index };
    }
    default:
      return { ...base, cells: [] };
  }
}

/** Where a called (or split-off) wisp arrives: deep in its caller's Mist (the most closed-in cell), else beside it; from the sky, the top of its column. */
function arrivalCell(mechanic: DarkWispsDefinition, state: Pick<FullState, 'nest'>, caller: number, board: MergeWorldState, window: MissionWindow, pick: (list: readonly number[], label: string) => number | null): number | null {
  const taken = new Set(state.nest.filter((cell) => cell >= 0));
  const usable = (cell: number) => !taken.has(cell) && (windowEmptyCells(board, window).includes(cell) || ['light', 'dense', 'root'].includes(encounterMistAt(board, cell)?.type ?? ''));
  const wisp = mechanic.wisps[caller]!;
  if (isSky(wisp)) return columnCells(skyColumn(wisp), window).find(usable) ?? null;
  const from = state.nest[caller]!;
  const region = from >= 0 ? wispRegion(board, from, window) : new Map<number, number>();
  const inner = [...region.keys()].filter((cell) => !taken.has(cell) && ['light', 'dense', 'root'].includes(encounterMistAt(board, cell)?.type ?? ''));
  if (inner.length) {
    const open = (cell: number) => windowArea(cell, window, 'cross').filter((other) => !encounterMistAt(board, other)).length;
    return pick(inner.filter((cell) => open(cell) === Math.min(...inner.map(open))), 'arrive');
  }
  const free = from >= 0 ? [...wispFrontier(board, from, window).keys()] : windowEmptyCells(board, window);
  return pick(free.filter(usable), 'arrive');
}

/**
 * The wisps' turn, once the player has taken one (a merge). Spores laid earlier ripen or wither; a wisp struck to
 * half breaks off its twin. In a territory battle the front of the turn strip acts on its locked plan (a Rest does
 * nothing), goes to the back, and the next entry's plan is worked out and locked for the player to see; on an older
 * board every wisp counts down and one at zero acts. `rng` gives a number in [0, 1) for a label, so the same board and
 * seed act the same way.
 */
export function darkWispsAfterAction(mechanic: DarkWispsDefinition, raw: DarkWispsState, board: MergeWorldState, window: MissionWindow, rng: (label: string) => number, items: ReadonlyMap<string, MergeItemDefinition> = MERGE_ITEMS_BY_ID): { state: DarkWispsState; board: MergeWorldState; effects: MechanicEffect[] } {
  const state = withIntentState(mechanic, raw);
  const territory = isTerritory(mechanic);
  const actions = state.actions + 1;
  let cells: MergeBoardCell[] | null = null;
  const damage = [...state.damage];
  const countdown = [...state.countdown];
  const cycle = [...state.cycle];
  const ward = [...state.ward];
  const gathered = [...state.gathered];
  const called = [...state.called];
  const knocked = [...state.knocked];
  const nest = [...state.nest];
  const split = [...state.split];
  let spores = [...state.spores];
  let order = [...state.order];
  /** Called in this turn: it starts counting on the next. */
  const arrived = new Set<number>();
  const effects: MechanicEffect[] = [];
  const stagger = Math.max(1, Math.floor(mechanic.stagger ?? DEFAULT_STAGGER));
  const pick = <T,>(list: readonly T[], label: string): T | null => (list.length ? list[Math.min(list.length - 1, Math.floor(rng(`${label}:${actions}`) * list.length))]! : null);
  const current = (): MergeWorldState => (cells ? { ...board, board: cells } : board);
  const alive = (index: number) => darkWispAlive(mechanic, damage, index, { called });
  const setMist = (cell: number, mist: { type: 'light' | 'dense' | 'root' } | { type: 'wisp-bound'; wispId: string } | { type: 'bound'; holds: { kind: 'item'; definitionId: string } }) => {
    cells ??= [...board.board];
    const hp = mist.type === 'dense' ? 2 : 1;
    cells[cell] = { ...cells[cell]!, locked: true, blocker: null, occupant: null, mist: { kind: 'encounter', hp, ...mist } };
  };
  const freeNow = (cell: number) => windowEmptyCells(current(), window).includes(cell);
  const snapshot = (): FullState => ({ ...state, damage, countdown, cycle, ward, gathered, called, knocked, nest, split, spores, order });
  const arrive = (index: number, cell: number | null) => {
    called[index] = true;
    arrived.add(index);
    countdown[index] = intentEvery(wispIntents(mechanic.wisps[index]!)[0]);
    if (territory) order.push(...stripEntries(mechanic, [index]));
    if (territory && cell != null && !isSky(mechanic.wisps[index]!)) { nest[index] = cell; setMist(cell, { type: 'wisp-bound', wispId: mechanic.wisps[index]!.id }); }
  };
  /**
   * The Mist lands on a cell: a free one mists over; a piece of Plant size or bigger holds its ground; a smaller piece
   * is bound in the Mist (not lost). A cell that has since gone to Mist or holds a spawner is skipped.
   */
  const land = (index: number, cell: number, type: 'light' | 'dense' | 'root', kind: 'surged' | 'rained' | 'shrouded' | 'root_mist' | 'corrupted') => {
    if (freeNow(cell)) { setMist(cell, { type }); effects.push({ kind, wisp: index, cell }); return true; }
    const item = looseItemAt(current(), cell);
    if (!item || !territory) return false;
    if ((items.get(item.definitionId)?.tier ?? 1) >= HOLDS_GROUND_TIER) { effects.push({ kind: 'held', wisp: index, cell }); return true; }
    setMist(cell, { type: 'bound', holds: { kind: 'item', definitionId: item.definitionId } });
    effects.push({ kind: 'bound', wisp: index, cell, definitionId: item.definitionId });
    return true;
  };
  const act = (index: number, intent: WispIntent, locked: WispPlan | null) => {
    const wisp = mechanic.wisps[index]!;
    // The plan it showed, or (an older board, or a plan that no longer fits) one worked out now.
    const plan = locked && locked.wisp === index && locked.kind === intent.kind ? locked : planIntent(mechanic, snapshot(), index, intent, current(), window, items, `act:${actions}`);
    switch (plan.kind) {
      case 'surge': case 'snuff': case 'rain': case 'gather': case 'shroud': case 'root': {
        if (plan.kind === 'gather' && gathered[index]! >= stagger) { effects.push({ kind: 'staggered', wisp: index }); return; }
        const type = plan.kind === 'shroud' && territory ? 'dense' : plan.kind === 'root' ? 'root' : 'light';
        const kind = plan.kind === 'shroud' ? 'shrouded' : plan.kind === 'root' ? 'root_mist' : plan.kind === 'rain' || isSky(wisp) ? 'rained' : 'surged';
        for (const cell of plan.cells) {
          if (land(index, cell, type, kind)) continue;
          // Its cell has gone (Mist already, a spawner): the nearest cell it can still reach instead.
          const again = planIntent(mechanic, snapshot(), index, { ...intent, kind: plan.kind, amount: 1 }, current(), window, items, `retry:${actions}:${cell}`);
          if (again.cells[0] != null) land(index, again.cells[0], type, kind);
        }
        return;
      }
      case 'spores': {
        for (const cell of plan.cells) {
          const target = freeNow(cell) ? cell : pick(windowEmptyCells(current(), window).filter((entry) => !spores.some((spore) => spore.cell === entry)), `spores:${wisp.id}:${cell}`);
          if (target == null) continue;
          spores.push({ cell: target, turns: SPORE_TURNS, wisp: index });
          effects.push({ kind: 'spored', wisp: index, cell: target });
        }
        return;
      }
      case 'devour': case 'bind': {
        // The piece it showed, still there: moved or merged away, it goes hungry.
        const item = plan.piece ? looseItemAt(current(), plan.piece.cell) : null;
        if (!item || item.instanceId !== plan.piece!.instanceId) return;
        if (plan.kind === 'bind') { setMist(plan.piece!.cell, { type: 'bound', holds: { kind: 'item', definitionId: item.definitionId } }); effects.push({ kind: 'bound', wisp: index, cell: plan.piece!.cell, definitionId: item.definitionId }); return; }
        cells ??= [...board.board];
        cells[plan.piece!.cell] = { ...cells[plan.piece!.cell]!, occupant: null };
        effects.push({ kind: 'ate', wisp: index, cell: plan.piece!.cell, definitionId: item.definitionId });
        return;
      }
      case 'ward': { const amount = Math.max(1, Math.floor(intent.amount ?? 2)); ward[index] = amount; effects.push({ kind: 'warded', wisp: index, amount }); return; }
      case 'shield': {
        const target = plan.target ?? index;
        if (!alive(target)) return;
        const amount = Math.max(1, Math.floor(intent.amount ?? SHIELD_DEFAULT));
        ward[target] = Math.max(ward[target]!, amount);
        effects.push({ kind: 'shielded', wisp: index, target, amount });
        return;
      }
      case 'mend': {
        if (damage[index]! <= 0) return;
        // The Mist feeds it: one more for every bound piece touching its Mist.
        const fed = territory && nest[index]! >= 0 ? [...new Set([...wispRegion(current(), nest[index]!, window).keys()].flatMap((cell) => [cell, ...windowArea(cell, window, 'cross')]))].filter((cell) => encounterMistAt(current(), cell)?.type === 'bound').length : 0;
        const amount = Math.min(damage[index]!, Math.max(1, Math.floor(intent.amount ?? 1)) + fed);
        damage[index] = damage[index]! - amount;
        effects.push({ kind: 'mended', wisp: index, amount });
        return;
      }
      case 'call': {
        const next = mechanic.wisps.findIndex((candidate, candidateIndex) => candidate.hidden && !called[candidateIndex] && !mechanic.wisps.some((other) => other.splitsInto === candidate.id));
        if (next < 0) return;
        const planned = plan.cells[0];
        const usable = planned != null && (freeNow(planned) || ['light', 'dense', 'root'].includes(encounterMistAt(current(), planned)?.type ?? '')) && !nest.includes(planned);
        const cell = !territory ? null : isSky(mechanic.wisps[next]!) ? null : usable ? planned : arrivalCell(mechanic, snapshot(), index, current(), window, pick);
        if (territory && !isSky(mechanic.wisps[next]!) && cell == null) return;
        arrive(next, cell);
        effects.push({ kind: 'called', wisp: next, caller: index, ...(cell != null ? { cell } : {}) });
        return;
      }
      case 'burrow': {
        if (!territory || nest[index]! < 0) return;
        const from = nest[index]!;
        const to = plan.cells[0];
        const region = wispRegion(current(), from, window);
        if (to == null || !region.has(to) || nest.includes(to) || ['wisp-bound', 'bound'].includes(encounterMistAt(current(), to)?.type ?? '')) return;
        setMist(from, { type: 'light' });
        setMist(to, { type: 'wisp-bound', wispId: wisp.id });
        nest[index] = to;
        effects.push({ kind: 'burrowed', wisp: index, from, to });
        return;
      }
    }
  };
  // Spores ripen: one on a cell still empty after its turns turns to Mist; a piece on it (or its wisp falling) ends it.
  spores = spores.flatMap((spore) => {
    const cell = current().board[spore.cell];
    if (!alive(spore.wisp) || !cell || cell.locked || cell.mist || cell.occupant) return [];
    if (spore.turns - 1 > 0) return [{ ...spore, turns: spore.turns - 1 }];
    setMist(spore.cell, { type: 'light' });
    effects.push({ kind: 'spore_bloomed', wisp: spore.wisp, cell: spore.cell });
    return [];
  });
  // A wisp struck to half breaks off its twin.
  mechanic.wisps.forEach((wisp, index) => {
    if (!wisp.splitsInto || split[index] || !alive(index) || damage[index]! * 2 < wisp.hp) return;
    const twin = mechanic.wisps.findIndex((candidate) => candidate.id === wisp.splitsInto);
    if (twin < 0 || called[twin]) return;
    split[index] = true;
    const sky = isSky(mechanic.wisps[twin]!);
    const cell = territory && !sky ? arrivalCell(mechanic, snapshot(), index, current(), window, pick) : null;
    if (territory && !sky && cell == null) return;
    arrive(twin, cell);
    effects.push({ kind: 'split', wisp: index, twin, cell: cell ?? -1 });
  });
  if (isTactics(mechanic)) {
    // Merge vs Mist: every wisp spreads, in order, onto the cells the board showed. Moving is free, so a piece set on a
    // shown cell does not stop it: the Mist takes the next nearest free cell instead (a Snare Wisp's locks the piece).
    for (const index of [...new Set(order)]) {
      if (index === REST || !alive(index) || arrived.has(index)) continue;
      const wisp = mechanic.wisps[index]!;
      const planned = state.plans[index];
      if (!planned || planned.kind === 'rest') continue;
      if (!wisp.kind || isSky(wisp)) {
        const intents = wispIntents(wisp);
        if (!intents.length) continue;
        act(index, intents[cycle[index]! % intents.length]!, planned);
        cycle[index] = (cycle[index]! + 1) % intents.length;
        continue;
      }
      // A Drifter drifts through its Mist, leaving Mist where it was; its step gone (the player's Glow cleared it), it
      // drifts elsewhere, or spreads like a Creeper when it has nowhere to drift.
      if (planned.kind === 'move') {
        const nestAt = nest[index]!;
        const ctx = { board: current(), window, nest: nestAt, turn: 1, pick: <T,>(list: readonly T[], label: string) => pick(list, `drift:${label}`), items };
        const plannedTo = planned.cells[0];
        const stillMist = plannedTo != null && ['light', 'dense', 'root'].includes(encounterMistAt(current(), plannedTo)?.type ?? '') && !nest.includes(plannedTo) && windowArea(nestAt, window, 'cross').includes(plannedTo);
        const to = stillMist ? plannedTo : planDrift(ctx);
        if (to != null) {
          setMist(nestAt, { type: 'light' });
          setMist(to, { type: 'wisp-bound', wispId: wisp.id });
          nest[index] = to;
          effects.push({ kind: 'drifted', wisp: index, from: nestAt, to });
          continue;
        }
        const instead = planSpread('creeper', index, ctx).cells[0];
        if (instead != null && freeNow(instead)) { setMist(instead, { type: 'light' }); effects.push({ kind: 'corrupted', wisp: index, cell: instead }); }
        continue;
      }
      const type = planned.kind === 'shroud' ? 'dense' : 'light';
      for (const cell of planned.cells) {
        if (freeNow(cell)) { setMist(cell, { type }); effects.push({ kind: 'corrupted', wisp: index, cell }); continue; }
        const item = looseItemAt(current(), cell);
        if (item && wisp.kind === 'snare') {
          setMist(cell, { type: 'bound', holds: { kind: 'item', definitionId: item.definitionId } });
          effects.push({ kind: 'bound', wisp: index, cell, definitionId: item.definitionId });
          continue;
        }
        const instead = planSpread(wisp.kind === 'snare' || wisp.kind === 'drifter' ? 'creeper' : wisp.kind, index, { board: current(), window, nest: nest[index]!, turn: 1, pick: (list, label) => pick(list, `instead:${label}`), items }).cells[0];
        if (instead != null && freeNow(instead)) { setMist(instead, { type }); effects.push({ kind: 'corrupted', wisp: index, cell: instead }); }
      }
    }
    order = order.filter((other) => other === REST || alive(other));
    const next: FullState = { ...snapshot(), actions, pushed: mechanic.wisps.map(() => false), plan: null, plans: mechanic.wisps.map(() => null) };
    return { state: { ...next, plans: planTacticsTurn(mechanic, next, current(), window, items) }, board: current(), effects };
  }
  let plan: WispPlan | null = state.plan;
  if (territory) {
    // The front of the strip acts: a Rest rests; a wisp felled before its turn simply does not act.
    order = order.filter((entry, place) => entry === REST || alive(entry) || place === 0);
    const entry = order.shift();
    if (entry === REST) { effects.push({ kind: 'rested' }); order.push(REST); }
    else if (entry != null && alive(entry)) {
      const intents = wispIntents(mechanic.wisps[entry]!);
      if (intents.length) {
        act(entry, intents[cycle[entry]! % intents.length]!, plan);
        cycle[entry] = (cycle[entry]! + 1) % intents.length;
        gathered[entry] = 0;
      }
      order.push(entry);
    }
    order = order.filter((other) => other === REST || alive(other));
    const next: FullState = { ...snapshot(), actions, pushed: mechanic.wisps.map(() => false), plan: null };
    plan = planWispTurn(mechanic, next, current(), window, items);
    return { state: { ...next, plan }, board: current(), effects };
  }
  mechanic.wisps.forEach((wisp, index) => {
    const intents = wispIntents(wisp);
    if (!intents.length || arrived.has(index) || !alive(index)) return;
    countdown[index] = countdown[index]! - 1;
    if (countdown[index]! > 0) return;
    act(index, intents[cycle[index]! % intents.length]!, null);
    cycle[index] = (cycle[index]! + 1) % intents.length;
    countdown[index] = intentEvery(intents[cycle[index]!]);
    gathered[index] = 0;
    knocked[index] = false;
  });
  return { state: { ...state, actions, damage, countdown, cycle, ward, gathered, called, knocked, nest, split, spores }, board: current(), effects };
}

/**
 * Before the player's merge is settled: the plan the board is showing is locked into the state, worked out on the
 * board the player saw. A territory battle's first turn has no plan saved yet; this is where it gets one.
 */
export function darkWispsPrepare(mechanic: DarkWispsDefinition, raw: DarkWispsState, board: MergeWorldState, window: MissionWindow, items: ReadonlyMap<string, MergeItemDefinition> = MERGE_ITEMS_BY_ID): DarkWispsState {
  if (isTactics(mechanic)) {
    if (raw.plans?.some(Boolean)) return raw;
    const state = withIntentState(mechanic, raw);
    return { ...state, plans: planTacticsTurn(mechanic, state, board, window, items) };
  }
  if (!isTerritory(mechanic) || raw.plan) return raw;
  const plan = planWispTurn(mechanic, raw, board, window, items);
  return plan ? { ...withIntentState(mechanic, raw), plan } : raw;
}

/**
 * Merge vs Mist: every wisp's plan for after the player's next merge, worked out in order, each on the board as the ones
 * before it will have left it (two wisps never want the same cell), and locked in for the player to see.
 */
export function planTacticsTurn(mechanic: DarkWispsDefinition, raw: DarkWispsState, board: MergeWorldState, window: MissionWindow, items: ReadonlyMap<string, MergeItemDefinition> = MERGE_ITEMS_BY_ID): (WispPlan | null)[] {
  const state = withIntentState(mechanic, raw);
  const plans: (WispPlan | null)[] = mechanic.wisps.map(() => null);
  const turn = state.actions + 1;
  let sim = board;
  const seed = `tactics:${state.actions}`;
  for (const index of [...new Set(state.order)]) {
    if (index === REST || !darkWispAlive(mechanic, state.damage, index, state)) continue;
    const wisp = mechanic.wisps[index]!;
    const pick = <T,>(list: readonly T[], label: string): T | null => (list.length ? list[Math.min(list.length - 1, Math.floor(seededUnit(`${seed}:${wisp.id}:${label}`) * list.length))]! : null);
    let plan: WispPlan;
    if (wisp.kind && !isSky(wisp)) plan = planSpread(wisp.kind, index, { board: sim, window, nest: state.nest[index]!, turn, pick, items });
    else {
      const intents = wispIntents(wisp);
      if (!intents.length) continue;
      plan = planIntent(mechanic, state, index, intents[state.cycle[index]! % intents.length]!, sim, window, items, seed);
    }
    plans[index] = plan;
    // What the ones after it will see: its Mist laid (a Drifter's trail where it was).
    if (plan.kind === 'move') sim = markMist(sim, state.nest[index]!);
    else for (const cell of plan.cells) if (plan.kind !== 'shield') sim = markMist(sim, cell);
  }
  return plans;
}

/** Merge vs Mist: a wisp is exposed once none of the four cells beside it holds Mist (another wisp does not count). */
export function wispExposed(board: MergeWorldState, cell: number, window: MissionWindow): boolean {
  return windowArea(cell, window, 'cross').every((other) => { const mist = encounterMistAt(board, other); return !mist || mist.type === 'wisp-bound'; });
}

/**
 * Merge vs Mist (`docs/encounter-tactics.md`): no health, no damage numbers. A merge that lands right beside a wisp
 * whose four neighbouring cells are clear of Mist cleanses it. Read after the merge's pulse has cleared what it can.
 */
export function darkWispsCleanseStrike(mechanic: DarkWispsDefinition, raw: DarkWispsState, event: MissionStrikeEvent, board: MergeWorldState, window: MissionWindow): { next: DarkWispsState; strike: MissionStrike | null } {
  const state = withIntentState(mechanic, raw);
  const beside = new Set(windowArea(event.resultCell, window, 'cross'));
  const cleansed = darkWispsStanding(mechanic, state).filter((index) => !isSky(mechanic.wisps[index]!) && beside.has(state.nest[index]!) && wispExposed(board, state.nest[index]!, window));
  if (!cleansed.length) return { next: raw, strike: null };
  const damage = [...state.damage];
  const hits = cleansed.map((index) => { const dealt = mechanic.wisps[index]!.hp - damage[index]!; damage[index] = mechanic.wisps[index]!.hp; return { wisp: index, damage: dealt }; });
  const next: DarkWispsState = { ...state, strikes: state.strikes + 1, damage, order: state.order.filter((entry) => entry === REST || !cleansed.includes(entry)) };
  return { next, strike: { fromCell: event.resultCell, resultDefinitionId: event.resultDefinitionId, hits, target: cleansed[0]!, finale: darkWispsComplete(mechanic, next), wasted: false } };
}
