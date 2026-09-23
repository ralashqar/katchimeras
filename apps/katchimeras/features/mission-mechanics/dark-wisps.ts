import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import type { MergeBoardCell, MergeItemDefinition, MergeWorldState } from '@/types/merge-world';
import type { DarkWisp, MechanicEffect, MissionMechanicDefinition, MissionMechanicMove, MissionMechanicState, MissionStrike, MissionWispView, WispIntent } from '@/types/mission-mechanic';
import { darkWispLook } from '@/constants/dark-wisp-looks';
import { chainRole, WEAKNESS_BONUS } from '@/features/encounter/chains';
import { pulseArea, windowArea, windowDistance } from '@/features/encounter/pulse';
import { windowItems, type MissionWindow } from './board-window';
import { glowStrikesMove } from './glow-strikes';
import type { MissionStrikeEvent } from './mechanic';

export type DarkWispsDefinition = Extract<MissionMechanicDefinition, { kind: 'dark-wisps' }>;
export type DarkWispsState = Extract<MissionMechanicState, { kind: 'dark-wisps' }>;

/**
 * Dark Wisps: wisps that fed on the Mist long enough to learn to want. Each
 * has hit points and a cycle of intents it shows ahead of time. In a territory
 * battle (`docs/encounter-territory.md`) each wisp nests on a board cell inside
 * its own Mist: on every turn (a merge) its countdown falls by one, and at zero
 * it acts (spread its Mist, lay thick Mist, root, eat a piece beside its Mist,
 * ward, mend, call a hidden wisp, burrow deeper, drop spores, gather a heavy
 * surge) and shows its next intent. A merge strikes the wisp whose nest sits in
 * its Harmony pulse, for the damage its tier deals; the first hit on an intent
 * pushes it back a turn. The mission is done when every wisp on the board is
 * down; the strike that fells the last is the finale. Pure.
 */
const DEFAULT_DAMAGE: readonly number[] = [1];
const DEFAULT_STAGGER = 3;
/** Turns a spore waits on an empty cell before it turns to Mist. */
export const SPORE_TURNS = 2;

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

export function createDarkWispsState(mechanic: DarkWispsDefinition): DarkWispsState {
  return {
    kind: 'dark-wisps', strikes: 0, actions: 0,
    damage: mechanic.wisps.map(() => 0), struckAt: mechanic.wisps.map(() => -1),
    countdown: mechanic.wisps.map((wisp) => intentEvery(wispIntents(wisp)[0])),
    cycle: mechanic.wisps.map(() => 0), ward: mechanic.wisps.map(() => 0), gathered: mechanic.wisps.map(() => 0), called: mechanic.wisps.map(() => false), knocked: mechanic.wisps.map(() => false),
    nest: mechanic.wisps.map((wisp) => (!wisp.hidden && wisp.placement.kind === 'cell' ? wisp.placement.cell : -1)), split: mechanic.wisps.map(() => false), spores: [],
  };
}

/** A territory battle: its wisps nest on board cells and a merge strikes the nest inside its pulse. */
export const isTerritory = (mechanic: DarkWispsDefinition): boolean => mechanic.targeting === 'adjacent' || mechanic.wisps.some((wisp) => wisp.placement.kind === 'cell');

/** A state saved before intents (or partly): the missing arrays filled as a fresh board has them. */
function withIntentState(mechanic: DarkWispsDefinition, state: DarkWispsState): Required<DarkWispsState> {
  const fresh = createDarkWispsState(mechanic) as Required<DarkWispsState>;
  const fill = <T,>(list: T[] | undefined, fallback: T[]) => (list && list.length === mechanic.wisps.length ? list : fallback);
  return { ...state, countdown: fill(state.countdown, fresh.countdown), cycle: fill(state.cycle, fresh.cycle), ward: fill(state.ward, fresh.ward), gathered: fill(state.gathered, fresh.gathered), called: fill(state.called, fresh.called), knocked: fill(state.knocked, fresh.knocked), nest: fill(state.nest, fresh.nest), split: fill(state.split, fresh.split), spores: state.spores ?? [] };
}

export const darkWispAlive = (mechanic: DarkWispsDefinition, damage: readonly number[], index: number, state?: Pick<DarkWispsState, 'called'>): boolean =>
  (!state || present(mechanic, state, index)) && (!mechanic.wisps[index]!.hidden || Boolean(state?.called?.[index])) && damage[index]! < mechanic.wisps[index]!.hp;

export function darkWispsStanding(mechanic: DarkWispsDefinition, state: DarkWispsState): number[] {
  return mechanic.wisps.map((_, index) => index).filter((index) => darkWispAlive(mechanic, state.damage, index, state));
}

export const isPlantItem = (definitionId: string, items: ReadonlyMap<string, MergeItemDefinition> = MERGE_ITEMS_BY_ID): boolean => items.get(definitionId)?.familyId === 'nature';

const tierOf = (definitionId: string, items: ReadonlyMap<string, MergeItemDefinition>) => Math.max(1, Math.floor(items.get(definitionId)?.tier ?? 1));

/**
 * Territory: the standing wisp a merge landing on `cell` with a result of `tier` would strike: one whose nest is
 * inside the pulse, the one about to act first (then the weakest). Null when no nest is in reach.
 */
export function pulseTarget(mechanic: DarkWispsDefinition, raw: DarkWispsState, cell: number, tier: number, window: MissionWindow): number | null {
  const state = withIntentState(mechanic, raw);
  const reach = new Set(pulseArea(cell, tier, window).cells);
  const inReach = darkWispsStanding(mechanic, state).filter((index) => reach.has(state.nest[index]!));
  if (!inReach.length) return null;
  const soon = (index: number) => (wispIntents(mechanic.wisps[index]!).length ? state.countdown[index]! : Number.POSITIVE_INFINITY);
  return [...inReach].sort((a, b) => soon(a) - soon(b) || (mechanic.wisps[a]!.hp - state.damage[a]!) - (mechanic.wisps[b]!.hp - state.damage[b]!) || a - b)[0]!;
}

/** The wisp a strike lands on: in a territory battle the nest in the pulse (or none); else the first standing, or the weakest. */
function targetFor(mechanic: DarkWispsDefinition, state: Required<DarkWispsState>, event: MissionStrikeEvent, items: ReadonlyMap<string, MergeItemDefinition>, window: MissionWindow | null): number | null {
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
  // The first hit on an intent knocks it back a turn (never past where it started); a gathering wisp counts what it took.
  const intents = wispIntents(wisp);
  const countdown = [...state.countdown];
  const gathered = [...state.gathered];
  const knocked = [...state.knocked];
  const touched = dealt > 0 || absorbed > 0;
  if (touched && intents.length) {
    const current = intents[state.cycle[target]! % intents.length]!;
    // Only a knock that moved the countdown uses it up.
    if (!knocked[target] && countdown[target]! < intentEvery(current)) { countdown[target] = countdown[target]! + 1; knocked[target] = true; }
    if (current.kind === 'gather') gathered[target] = gathered[target]! + dealt;
  }
  const next: DarkWispsState = { ...state, strikes: state.strikes + 1, damage, struckAt, ward, countdown, gathered, knocked };
  const finale = darkWispsComplete(mechanic, next);
  return { next, strike: { fromCell: event.resultCell, resultDefinitionId: event.resultDefinitionId, hits: touched ? [{ wisp: target, damage: dealt }] : [], target, finale, wasted: !touched } };
}

/** Trailfinder: every standing wisp's next move a turn further off (never past where it started). */
export function pushBackDarkWisps(mechanic: DarkWispsDefinition, raw: DarkWispsState): DarkWispsState {
  const state = withIntentState(mechanic, raw);
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

export function darkWispsViews(mechanic: DarkWispsDefinition, raw: DarkWispsState): MissionWispView[] {
  const state = withIntentState(mechanic, raw);
  const stagger = Math.max(1, Math.floor(mechanic.stagger ?? DEFAULT_STAGGER));
  return mechanic.wisps.map((wisp, index) => {
    const alive = darkWispAlive(mechanic, state.damage, index, state);
    const intents = wispIntents(wisp);
    const current = intents.length ? intents[state.cycle[index]! % intents.length]! : null;
    const nest = state.nest[index]!;
    const spores = state.spores.filter((spore) => spore.wisp === index).map(({ cell, turns }) => ({ cell, turns }));
    return {
      id: wisp.id, hp: wisp.hp, damage: Math.min(wisp.hp, state.damage[index] ?? 0), alive,
      // A territory wisp is drawn on its nest, wherever it has burrowed or been called to.
      placement: wisp.placement.kind === 'cell' && nest >= 0 ? { ...wisp.placement, cell: nest } : wisp.placement,
      ...(spores.length && alive ? { spores } : {}),
      look: darkWispLook(wisp, intents[0]?.kind ?? null),
      ...(wisp.weakTo ? { weakTo: wisp.weakTo } : {}),
      intent: alive && current ? { kind: current.kind, countdown: state.countdown[index]!, ...(current.amount ? { amount: current.amount } : {}), ...(state.ward[index] ? { ward: state.ward[index] } : {}), ...(current.kind === 'gather' ? { gathered: state.gathered[index], stagger } : {}) } : null,
    };
  });
}

export function darkWispsMove(board: MergeWorldState, window: MissionWindow): MissionMechanicMove | null {
  return glowStrikesMove(board, window);
}

export function normalizeDarkWispsState(mechanic: DarkWispsDefinition, value: unknown, strikes: number): DarkWispsState | null {
  const raw = value as Partial<DarkWispsState> | null;
  if (!raw || !Array.isArray(raw.damage) || raw.damage.length !== mechanic.wisps.length) return null;
  const n = mechanic.wisps.length;
  const ints = (list: unknown, fallback: number[], min = 0) => (Array.isArray(list) && list.length === n ? list.map((entry, index) => Math.max(min, Math.floor(Number.isFinite(entry) ? Number(entry) : fallback[index]!))) : fallback);
  const fresh = createDarkWispsState(mechanic) as Required<DarkWispsState>;
  const damage = raw.damage.map((entry, index) => Math.max(0, Math.min(mechanic.wisps[index]!.hp, Math.floor(Number.isFinite(entry) ? Number(entry) : 0))));
  return {
    kind: 'dark-wisps', strikes, actions: Math.max(0, Math.floor(Number.isFinite(raw.actions) ? Number(raw.actions) : 0)), damage,
    struckAt: ints(raw.struckAt, mechanic.wisps.map(() => -1), -1),
    countdown: ints(raw.countdown, fresh.countdown), cycle: ints(raw.cycle, fresh.cycle), ward: ints(raw.ward, fresh.ward), gathered: ints(raw.gathered, fresh.gathered),
    called: Array.isArray(raw.called) && raw.called.length === n ? raw.called.map(Boolean) : fresh.called,
    knocked: Array.isArray(raw.knocked) && raw.knocked.length === n ? raw.knocked.map(Boolean) : fresh.knocked,
    nest: ints(raw.nest, fresh.nest, -1),
    split: Array.isArray(raw.split) && raw.split.length === n ? raw.split.map(Boolean) : fresh.split,
    spores: Array.isArray(raw.spores) ? raw.spores.filter((spore) => spore && Number.isInteger(spore.cell) && Number.isInteger(spore.turns) && Number.isInteger(spore.wisp) && spore.wisp >= 0 && spore.wisp < n).map((spore) => ({ cell: spore.cell, turns: Math.max(0, spore.turns), wisp: spore.wisp })) : [],
  };
}

/** Open cells of the window with nothing on them and no Mist. */
export function windowEmptyCells(board: MergeWorldState, window: MissionWindow): number[] {
  return window.cellIndices.filter((index) => { const cell = board.board[index]; return Boolean(cell) && !cell.locked && !cell.mist && !cell.occupant; });
}

const encounterMistAt = (board: MergeWorldState, cell: number) => { const mist = board.board[cell]?.mist; return mist?.kind === 'encounter' ? mist : null; };

/** Territory: a wisp's Mist, every Mist cell joined to its nest along the board, with its steps from the nest. */
export function wispRegion(board: MergeWorldState, nest: number, window: MissionWindow): Map<number, number> {
  const region = new Map<number, number>();
  if (nest < 0 || !encounterMistAt(board, nest)) return region;
  region.set(nest, 0);
  const queue = [nest];
  while (queue.length) {
    const cell = queue.shift()!;
    for (const other of windowArea(cell, window, 'cross')) {
      if (region.has(other) || !encounterMistAt(board, other)) continue;
      region.set(other, region.get(cell)! + 1);
      queue.push(other);
    }
  }
  return region;
}

/** Territory: the free cells touching a wisp's Mist, each with its steps from the nest; where its Mist spreads next. */
export function wispFrontier(board: MergeWorldState, nest: number, window: MissionWindow): Map<number, number> {
  const region = wispRegion(board, nest, window);
  const free = new Set(windowEmptyCells(board, window));
  const frontier = new Map<number, number>();
  for (const [cell, steps] of region) {
    for (const other of windowArea(cell, window, 'cross')) {
      if (!free.has(other)) continue;
      frontier.set(other, Math.min(frontier.get(other) ?? Number.POSITIVE_INFINITY, steps + 1));
    }
  }
  return frontier;
}

/**
 * The wisps' turn, once the player has taken one (a merge). Spores laid
 * earlier ripen or wither; a wisp struck to half breaks off its twin; every
 * wisp on the board counts down, and one at zero acts on its intent and shows
 * its next. In a territory battle what it does starts from its own Mist; on an
 * older board, anywhere free. `rng` gives a number in [0, 1) for a label, so
 * the same board and seed act the same way.
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
  /** Called in this turn: it starts counting on the next. */
  const arrived = new Set<number>();
  const effects: MechanicEffect[] = [];
  const stagger = Math.max(1, Math.floor(mechanic.stagger ?? DEFAULT_STAGGER));
  const pick = <T,>(list: readonly T[], label: string): T | null => (list.length ? list[Math.min(list.length - 1, Math.floor(rng(`${label}:${actions}`) * list.length))]! : null);
  const current = (): MergeWorldState => (cells ? { ...board, board: cells } : board);
  const alive = (index: number) => darkWispAlive(mechanic, damage, index, { called });
  const setMist = (cell: number, mist: { type: 'light' | 'dense' | 'root' } | { type: 'wisp-bound'; wispId: string }) => {
    cells ??= [...board.board];
    const hp = mist.type === 'dense' ? 2 : 1;
    cells[cell] = { ...cells[cell]!, locked: true, blocker: null, occupant: null, mist: { kind: 'encounter', hp, ...mist } };
  };
  const itemsNear = (cell: number) => windowArea(cell, window, 'cross').filter((other) => current().board[other]?.occupant?.kind === 'item').length;
  /** Where a wisp's Mist can go: in a territory battle the free cells touching its Mist (with their steps); else any free cell. */
  const spots = (index: number): Map<number, number> => {
    if (territory && nest[index]! >= 0) return wispFrontier(current(), nest[index]!, window);
    return new Map(windowEmptyCells(current(), window).map((cell) => [cell, 0]));
  };
  const nearest = (candidates: Map<number, number>, label: string) => {
    const best = Math.min(...candidates.values());
    return pick([...candidates].filter(([, steps]) => steps === best).map(([cell]) => cell), label);
  };
  const crowded = (candidates: readonly number[]) => {
    const best = Math.max(-1, ...candidates.map(itemsNear));
    return candidates.filter((cell) => itemsNear(cell) === best);
  };
  /** Loose pieces a wisp can reach: beside its Mist in a territory battle, anywhere otherwise; never one of the last two. */
  const meals = (index: number) => {
    const all = windowItems(current(), window.cellIndices);
    if (all.length <= 2) return [];
    if (!territory || nest[index]! < 0) return all;
    const region = wispRegion(current(), nest[index]!, window);
    const touching = new Set([...region.keys()].flatMap((cell) => windowArea(cell, window, 'cross')));
    return all.filter((item) => touching.has(item.cell));
  };
  const lowest = (list: { cell: number; definitionId: string }[]) => {
    const tiers = list.map((item) => ({ ...item, tier: items.get(item.definitionId)?.tier ?? 1 }));
    const floor = Math.min(...tiers.map((item) => item.tier));
    return tiers.filter((item) => item.tier === floor);
  };
  /** Its Mist spreads `amount` cells, nearest first; with nowhere free beside it, it swallows the smallest piece it touches. */
  const surge = (index: number, amount: number, label: string) => {
    for (let step = 0; step < amount; step += 1) {
      const free = spots(index);
      const cell = free.size ? nearest(free, `${label}:${step}`) : null;
      if (cell != null) { setMist(cell, { type: 'light' }); effects.push({ kind: 'surged', wisp: index, cell }); continue; }
      if (!territory) return;
      const meal = pick(lowest(meals(index)), `${label}:swallow:${step}`);
      if (!meal) return;
      setMist(meal.cell, { type: 'light' });
      effects.push({ kind: 'surged', wisp: index, cell: meal.cell, swallowed: meal.definitionId });
    }
  };
  /** Somewhere for a new wisp to nest near `from`: deep in its Mist first (the most closed-in cell), else beside it. */
  const nestNear = (from: number, label: string): number | null => {
    const taken = new Set(nest.filter((cell) => cell >= 0));
    const region = from >= 0 ? wispRegion(current(), from, window) : new Map<number, number>();
    const inner = [...region.keys()].filter((cell) => !taken.has(cell) && (encounterMistAt(current(), cell)?.type ?? 'wisp-bound') !== 'wisp-bound');
    if (inner.length) {
      const open = (cell: number) => windowArea(cell, window, 'cross').filter((other) => !encounterMistAt(current(), other)).length;
      const best = Math.min(...inner.map(open));
      return pick(inner.filter((cell) => open(cell) === best), label);
    }
    const free = from >= 0 ? wispFrontier(current(), from, window) : new Map(windowEmptyCells(current(), window).map((cell) => [cell, 0]));
    return free.size ? nearest(free, label) : null;
  };
  const arrive = (index: number, cell: number | null) => {
    called[index] = true;
    arrived.add(index);
    countdown[index] = intentEvery(wispIntents(mechanic.wisps[index]!)[0]);
    if (territory && cell != null) { nest[index] = cell; setMist(cell, { type: 'wisp-bound', wispId: mechanic.wisps[index]!.id }); }
  };
  const act = (index: number, intent: WispIntent) => {
    const wisp = mechanic.wisps[index]!;
    switch (intent.kind) {
      case 'surge':
      case 'snuff': surge(index, Math.max(1, Math.floor(intent.amount ?? 1)), `surge:${wisp.id}`); return;
      case 'gather':
        if (gathered[index]! >= stagger) { effects.push({ kind: 'staggered', wisp: index }); return; }
        surge(index, Math.max(1, Math.floor(intent.amount ?? 3)), `gather:${wisp.id}`);
        return;
      case 'shroud': {
        const cell = pick(crowded([...spots(index).keys()]), `shroud:${wisp.id}`);
        if (cell != null) { setMist(cell, { type: territory ? 'dense' : 'light' }); effects.push({ kind: 'shrouded', wisp: index, cell }); }
        return;
      }
      case 'root': {
        const free = [...spots(index).keys()];
        const rooted = window.cellIndices.filter((cell) => encounterMistAt(current(), cell)?.type === 'root');
        const spread = free.filter((cell) => windowArea(cell, window, 'cross').some((other) => rooted.includes(other)));
        const cell = pick(spread.length ? spread : free, `root:${wisp.id}`);
        if (cell != null) { setMist(cell, { type: 'root' }); effects.push({ kind: 'root_mist', wisp: index, cell }); }
        return;
      }
      case 'devour': {
        const meal = pick(lowest(meals(index)), `eat:${wisp.id}`);
        // Nothing it can reach: its Mist creeps a cell closer instead.
        if (!meal) { if (territory) surge(index, 1, `eat:${wisp.id}`); return; }
        cells ??= [...board.board];
        cells[meal.cell] = { ...cells[meal.cell]!, occupant: null };
        effects.push({ kind: 'ate', wisp: index, cell: meal.cell, definitionId: meal.definitionId });
        return;
      }
      case 'ward': { const amount = Math.max(1, Math.floor(intent.amount ?? 2)); ward[index] = amount; effects.push({ kind: 'warded', wisp: index, amount }); return; }
      case 'mend': {
        if (damage[index]! <= 0) return;
        const amount = Math.min(damage[index]!, Math.max(1, Math.floor(intent.amount ?? 1)));
        damage[index] = damage[index]! - amount;
        effects.push({ kind: 'mended', wisp: index, amount });
        return;
      }
      case 'call': {
        const next = mechanic.wisps.findIndex((candidate, candidateIndex) => candidate.hidden && !called[candidateIndex] && !mechanic.wisps.some((other) => other.splitsInto === candidate.id));
        if (next < 0) return;
        const cell = territory ? nestNear(nest[index]!, `call:${wisp.id}`) : null;
        if (territory && cell == null) return;
        arrive(next, cell);
        effects.push({ kind: 'called', wisp: next, caller: index, ...(cell != null ? { cell } : {}) });
        return;
      }
      case 'burrow': {
        if (!territory || nest[index]! < 0) return;
        const from = nest[index]!;
        const taken = new Set(nest.filter((cell) => cell >= 0));
        const region = wispRegion(current(), from, window);
        const deeper = [...region.keys()].filter((cell) => cell !== from && !taken.has(cell) && encounterMistAt(current(), cell)?.type !== 'wisp-bound');
        if (!deeper.length) return;
        // Away from the player: the cell with the fewest open cells around it, then the furthest from its old nest.
        const open = (cell: number) => windowArea(cell, window, 'cross').filter((other) => !encounterMistAt(current(), other)).length;
        const best = Math.min(...deeper.map(open));
        const snug = deeper.filter((cell) => open(cell) === best);
        const far = Math.max(...snug.map((cell) => windowDistance(cell, from, window)));
        const to = pick(snug.filter((cell) => windowDistance(cell, from, window) === far), `burrow:${wisp.id}`)!;
        setMist(from, { type: 'light' });
        setMist(to, { type: 'wisp-bound', wispId: wisp.id });
        nest[index] = to;
        effects.push({ kind: 'burrowed', wisp: index, from, to });
        return;
      }
      case 'spores': {
        const near = new Set(spots(index).keys());
        const marked = new Set(spores.map((spore) => spore.cell));
        const free = windowEmptyCells(current(), window).filter((cell) => !marked.has(cell));
        // Away from its own Mist where it can: a spore is a second front.
        const away = free.filter((cell) => !near.has(cell));
        for (let step = 0; step < Math.max(1, Math.floor(intent.amount ?? 1)); step += 1) {
          const pool = (away.length ? away : free).filter((cell) => !spores.some((spore) => spore.cell === cell));
          const cell = pick(pool, `spores:${wisp.id}:${step}`);
          if (cell == null) return;
          spores.push({ cell, turns: SPORE_TURNS, wisp: index });
          effects.push({ kind: 'spored', wisp: index, cell });
        }
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
    const cell = territory ? nestNear(nest[index]!, `split:${wisp.id}`) : null;
    split[index] = true;
    if (territory && cell == null) return;
    arrive(twin, cell);
    effects.push({ kind: 'split', wisp: index, twin, cell: cell ?? -1 });
  });
  mechanic.wisps.forEach((wisp, index) => {
    const intents = wispIntents(wisp);
    if (!intents.length || arrived.has(index) || !alive(index)) return;
    countdown[index] = countdown[index]! - 1;
    if (countdown[index]! > 0) return;
    act(index, intents[cycle[index]! % intents.length]!);
    cycle[index] = (cycle[index]! + 1) % intents.length;
    countdown[index] = intentEvery(intents[cycle[index]!]);
    gathered[index] = 0;
    knocked[index] = false;
  });
  return { state: { ...state, actions, damage, countdown, cycle, ward, gathered, called, knocked, nest, split, spores }, board: current(), effects };
}
