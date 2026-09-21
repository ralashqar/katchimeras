import { WISP_RUSH_PERCHES } from '@/features/mission-mechanics/wisp-rush';

/**
 * Wisp Rush: one heat of the time trial, as pure rules. A clock counts down. Pieces keep arriving on a small board,
 * wisps keep appearing over the tile, every merge shoots the wisp nearest to it, and the score is how many wisps fall
 * before the time is up. Nothing here knows about React, storage or the real Merge board: time is passed in (ms since
 * the heat's first touch), randomness comes from the heat's own seed, and the same inputs always give the same heat.
 * The screen maps `slots` onto the docked board's window; the bot and the tests play it directly.
 */
export const HEAT_SLOTS = 20;
export const HEAT_COLUMNS = 5;
export const HEAT_MAX_TIER = 6;
/** Merges this close together keep a combo going; every third merge of a combo strikes one harder. */
export const HEAT_COMBO_WINDOW_MS = 1_200;
/** A perch stays empty this long after its wisp is struck down: the last flight lands and the fall plays before another appears there. */
export const HEAT_PERCH_REST_MS = 1_500;

export type HeatPiece = { chainId: string; tier: number };
export type HeatWisp = { id: string; /** Its number in the heat: the first to appear is 0. */ n: number; hp: number; damage: number; perch: number; bornAt: number };
/** The knobs of a heat, authored as data: a row of the daily ladder, or a friend's chapter in a content pack. */
export type HeatRules = {
  chains: readonly string[];
  /** How long the clock runs. */
  durationMs: number;
  /** How many wisps can hang over the tile at once, and how often a new one appears while there is room. */
  up: number;
  wispEveryMs: number;
  /** What a wisp takes: `hp` to start with, one more every `hpRampEvery` wisps, half as much again for a Thick one. */
  hp: number;
  hpRampEvery: number;
  thickChance: number;
  /** Pieces on the board at the start, the most the dealer lets it hold, and how often a piece arrives on its own. */
  startFill: number;
  fill: number;
  dealEveryMs: number;
  /** How long a cell freed by a merge stays empty before a new piece drifts in. */
  dealDelayMs: number;
  /** Chance that a dealt piece is tier two instead of tier one. */
  tierTwoChance: number;
};
export type HeatSpec = HeatRules & { id: string; seed: number };

export type HeatState = {
  spec: HeatSpec;
  slots: (HeatPiece | null)[];
  /** Wisps over the tile now. */
  wisps: HeatWisp[];
  /** Every wisp that has appeared, in order (`roster[n]`): what the wisp layer draws from. It only ever grows. */
  roster: { id: string; hp: number; perch: number; bornAt: number }[];
  /** When each perch may hold a wisp again. */
  perchFreeAt: number[];
  nextWispAt: number;
  nextDealAt: number;
  pendingDeals: number[];
  rng: number;
  combo: number;
  lastMergeAt: number | null;
  merges: number;
  /** The score: wisps struck down. */
  cleared: number;
  /** Set when the clock runs out. */
  finishedMs: number | null;
};

export type HeatStrike = { wispId: string | null; /** The wisp's number in the roster. */ wisp: number; damage: number; fell: boolean; wasted: boolean };
export type HeatEvent = { type: 'dealt'; slot: number; piece: HeatPiece } | { type: 'appeared'; wisp: HeatWisp };

// ---- seeded randomness (mulberry32, carried in the state so a heat replays exactly) ----------------------------------
export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function next(rng: number): { rng: number; value: number } {
  const state = (rng + 0x6D2B79F5) >>> 0;
  let t = Math.imul(state ^ state >>> 15, 1 | state);
  t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
  return { rng: state, value: ((t ^ t >>> 14) >>> 0) / 4294967296 };
}

// ---- the board ------------------------------------------------------------------------------------------------------
const same = (a: HeatPiece, b: HeatPiece) => a.chainId === b.chainId && a.tier === b.tier;
const key = (piece: HeatPiece) => `${piece.chainId}:${piece.tier}`;

/** Pairs the player could merge right now: same piece twice, below the top tier. */
export function availableMerges(state: Pick<HeatState, 'slots'>): number {
  const counts = new Map<string, number>();
  for (const piece of state.slots) if (piece && piece.tier < HEAT_MAX_TIER) counts.set(key(piece), (counts.get(key(piece)) ?? 0) + 1);
  let pairs = 0;
  for (const count of counts.values()) pairs += Math.floor(count / 2);
  return pairs;
}

/**
 * What the dealer puts in an empty cell. The promise that makes a heat unstickable: whenever fewer than two merges are
 * on the board, the new piece is a twin of a piece that has no partner, so every deal that needs to makes a pair.
 */
function dealPiece(state: HeatState): HeatPiece {
  if (availableMerges(state) < 2) {
    const counts = new Map<string, number>();
    for (const piece of state.slots) if (piece) counts.set(key(piece), (counts.get(key(piece)) ?? 0) + 1);
    const lonely = state.slots
      .filter((piece): piece is HeatPiece => Boolean(piece) && piece!.tier < HEAT_MAX_TIER && (counts.get(key(piece!)) ?? 0) % 2 === 1)
      .sort((a, b) => a.tier - b.tier || a.chainId.localeCompare(b.chainId))[0];
    if (lonely) return { ...lonely };
  }
  const chain = next(state.rng); state.rng = chain.rng;
  const tier = next(state.rng); state.rng = tier.rng;
  return { chainId: state.spec.chains[Math.floor(chain.value * state.spec.chains.length)]!, tier: tier.value < state.spec.tierTwoChance ? 2 : 1 };
}

function dealInto(state: HeatState, events: HeatEvent[]) {
  const empty = state.slots.flatMap((piece, slot) => (piece ? [] : [slot]));
  if (!empty.length) return;
  const pick = next(state.rng); state.rng = pick.rng;
  const slot = empty[Math.floor(pick.value * empty.length)]!;
  const piece = dealPiece(state);
  state.slots[slot] = piece;
  events.push({ type: 'dealt', slot, piece });
}

// ---- the wisps ---------------------------------------------------------------------------------------------------------
const perchCount = (spec: HeatSpec) => Math.max(1, Math.min(WISP_RUSH_PERCHES.length, spec.up));

function appear(state: HeatState, atMs: number, events: HeatEvent[]): boolean {
  if (state.wisps.length >= perchCount(state.spec)) return false;
  const taken = new Set(state.wisps.map((wisp) => wisp.perch));
  const perch = Array.from({ length: perchCount(state.spec) }, (_, index) => index).find((index) => !taken.has(index) && (state.perchFreeAt[index] ?? 0) <= atMs);
  if (perch == null) return false;
  const n = state.roster.length;
  const thick = next(state.rng); state.rng = thick.rng;
  const base = state.spec.hp + Math.floor(n / Math.max(1, state.spec.hpRampEvery));
  // The first wisp of a heat is always a plain one: the clock starts on something the player can simply hit.
  const hp = n > 0 && thick.value < state.spec.thickChance ? Math.round(base * 1.5) : base;
  const wisp: HeatWisp = { id: `w${n}`, n, hp, damage: 0, perch, bornAt: atMs };
  state.wisps.push(wisp);
  state.roster.push({ id: wisp.id, hp, perch, bornAt: atMs });
  events.push({ type: 'appeared', wisp });
  return true;
}

export function startHeat(spec: HeatSpec): HeatState {
  const state: HeatState = {
    spec, slots: Array.from({ length: HEAT_SLOTS }, () => null), wisps: [], roster: [], perchFreeAt: Array.from({ length: perchCount(spec) }, () => 0),
    nextWispAt: spec.wispEveryMs, nextDealAt: spec.dealEveryMs, pendingDeals: [], rng: spec.seed >>> 0, combo: 0, lastMergeAt: null, merges: 0, cleared: 0, finishedMs: null,
  };
  const events: HeatEvent[] = [];
  for (let dealt = 0; dealt < Math.min(spec.startFill, HEAT_SLOTS); dealt++) dealInto(state, events);
  for (let up = 0; up < Math.min(2, perchCount(spec)); up++) appear(state, 0, events);
  return state;
}

const copy = (input: HeatState): HeatState => ({ ...input, slots: [...input.slots], wisps: input.wisps.map((wisp) => ({ ...wisp })), roster: [...input.roster], perchFreeAt: [...input.perchFreeAt], pendingDeals: [...input.pendingDeals] });

// ---- time: pieces arriving, wisps appearing, the clock running out -----------------------------------------------------
export function tickHeat(input: HeatState, atMs: number): { state: HeatState; events: HeatEvent[] } {
  if (input.finishedMs != null) return { state: input, events: [] };
  const at = Math.min(atMs, input.spec.durationMs);
  const dealsDue = input.pendingDeals.some((dueAt) => dueAt <= at) || input.nextDealAt <= at;
  const wispsDue = input.nextWispAt <= at || (!input.wisps.length && input.perchFreeAt.some((freeAt) => freeAt <= at));
  if (!dealsDue && !wispsDue && at < input.spec.durationMs) return { state: input, events: [] };
  const state = copy(input);
  const events: HeatEvent[] = [];

  // Cells a merge freed fill again after a beat; and whatever the player does, a piece arrives every so often.
  const due = state.pendingDeals.filter((dueAt) => dueAt <= at).length;
  state.pendingDeals = state.pendingDeals.filter((dueAt) => dueAt > at);
  for (let i = 0; i < due; i++) dealInto(state, events);
  for (; state.nextDealAt <= at; state.nextDealAt += state.spec.dealEveryMs) {
    if (state.slots.filter(Boolean).length < Math.min(state.spec.fill, HEAT_SLOTS)) dealInto(state, events);
  }
  // Wisps appear on their own clock while there is a perch for them, and the tile is never left with none.
  for (; state.nextWispAt <= at; state.nextWispAt += state.spec.wispEveryMs) appear(state, at, events);
  if (!state.wisps.length && appear(state, at, events)) state.nextWispAt = at + state.spec.wispEveryMs;

  if (at >= state.spec.durationMs) state.finishedMs = state.spec.durationMs;
  return { state, events };
}

/** How hard a merge strikes: by what it makes (tier two = 1, tier three = 2...), plus one on every third merge of a combo. */
export const strikeDamage = (resultTier: number, combo: number) => Math.max(1, resultTier - 1) + (combo > 0 && combo % 3 === 0 ? 1 : 0);

/** The wisp a merge shoots: the one hanging nearest to the column it was made in; of two as near, the one that has waited longer. */
function nearestWisp(state: HeatState, slot: number): HeatWisp | null {
  const fx = ((slot % HEAT_COLUMNS) + 0.5) / HEAT_COLUMNS;
  const x = (wisp: HeatWisp) => { const perch = WISP_RUSH_PERCHES[wisp.perch]; return perch?.kind === 'tile' ? perch.fx : 0.5; };
  return [...state.wisps].sort((a, b) => Math.abs(x(a) - fx) - Math.abs(x(b) - fx) || a.n - b.n)[0] ?? null;
}

/**
 * What a merge does once it has happened, whoever moved the pieces: the combo, the freed cell's deal, and the strike.
 * `mergeHeat` uses it for the bot and the tests; the docked board uses it after the real Merge engine has made the
 * merge, so both play by exactly the same rules. Mutates the (already copied) state it is given.
 */
function applyStrike(state: HeatState, made: HeatPiece, slot: number, atMs: number): HeatStrike {
  state.merges += 1;
  state.combo = state.lastMergeAt != null && atMs - state.lastMergeAt <= HEAT_COMBO_WINDOW_MS ? state.combo + 1 : 1;
  state.lastMergeAt = atMs;
  state.pendingDeals.push(atMs + state.spec.dealDelayMs);
  const target = nearestWisp(state, slot);
  if (!target) return { wispId: null, wisp: -1, damage: 0, fell: false, wasted: true };
  const damage = strikeDamage(made.tier, state.combo);
  target.damage += damage;
  const fell = target.damage >= target.hp;
  if (fell) {
    state.wisps = state.wisps.filter((wisp) => wisp.id !== target.id);
    state.perchFreeAt[target.perch] = atMs + HEAT_PERCH_REST_MS;
    state.cleared += 1;
  }
  return { wispId: target.id, wisp: target.n, damage, fell, wasted: false };
}

/** A merge made on the real board: the slots are already as the board has them; this applies everything else. */
export function strikeHeat(input: HeatState, slots: (HeatPiece | null)[], made: HeatPiece, slot: number, atMs: number): { state: HeatState; strike: HeatStrike | null; events: HeatEvent[] } {
  const ticked = tickHeat({ ...input, slots }, atMs);
  if (ticked.state.finishedMs != null) return { state: ticked.state, strike: null, events: ticked.events };
  const state = copy(ticked.state);
  return { state, strike: applyStrike(state, made, slot, atMs), events: ticked.events };
}

// ---- a merge ---------------------------------------------------------------------------------------------------------
export type HeatMergeResult = { state: HeatState; ok: boolean; strike: HeatStrike | null; events: HeatEvent[]; reason?: 'not_a_pair' | 'top_tier' | 'finished' };

export function mergeHeat(input: HeatState, from: number, to: number, atMs: number): HeatMergeResult {
  const ticked = tickHeat(input, atMs);
  const refuse = (reason: HeatMergeResult['reason']): HeatMergeResult => ({ state: ticked.state, ok: false, strike: null, events: ticked.events, reason });
  if (ticked.state.finishedMs != null) return refuse('finished');
  const state = copy(ticked.state);
  const [a, b] = [state.slots[from], state.slots[to]];
  if (from === to || !a || !b || !same(a, b)) return refuse('not_a_pair');
  if (a.tier >= HEAT_MAX_TIER) return refuse('top_tier');
  const made: HeatPiece = { chainId: a.chainId, tier: a.tier + 1 };
  state.slots[from] = null;
  state.slots[to] = made;
  return { state, ok: true, strike: applyStrike(state, made, to, atMs), events: ticked.events };
}
