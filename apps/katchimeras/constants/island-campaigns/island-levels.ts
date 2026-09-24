import type { RegionMissionDefinition } from '@/constants/island-campaigns/types';
import { ISLAND_WISP_LINES } from '@/features/onboarding/corruption-wisps';
import { ENCOUNTER_DEFAULT_GRADES, type EncounterDefinition, type EncounterDifficulty, type EncounterMistCell } from '@/types/encounter';
import type { CorruptionWispLines } from '@/features/onboarding/corruption-wisps';
import type { DarkWisp, DarkWispKind, WispIntent } from '@/types/mission-mechanic';

/**
 * A friend's island is played as levels, each a territory battle (`docs/encounter-territory.md`): a small board
 * under the island with a Seed Pod, Dark Wisps nested on its cells inside their Mist, each showing what it will do
 * next. A merge sends a Harmony pulse out from where it lands, wearing the Mist and striking a nest in reach; the
 * wisps spread their Mist back. A turn is a merge; the level is lost when the Mist holds its share of the board.
 * Levels are data here (the board window is five columns by four rows: cells 15-19, 22-26, 29-33, 36-40; wisps
 * nest in the top rows, the pieces and the Pod start at the bottom).
 */
export const OVERRUN_BY_DIFFICULTY: Readonly<Record<EncounterDifficulty, number>> = { calm: 0.7, thick: 0.65, dark: 0.55, boss: 0.5 };

/** The Mist a wisp's nest is ringed with, by difficulty (`IslandLevelSpec.ring`). */
export const RING_BY_DIFFICULTY: Readonly<Record<EncounterDifficulty, 'light' | 'dense' | false>> = { calm: 'light', thick: 'dense', dark: 'dense', boss: false };

/** Rest turns in the turn strip by difficulty (`IslandLevelSpec.rest`): a calm level lets the player breathe. */
export const REST_BY_DIFFICULTY: Readonly<Record<EncounterDifficulty, number>> = { calm: 1, thick: 1, dark: 0, boss: 0 };

/** The board's top row: where wisps authored without a cell nest, spread out. */
const TOP_ROW = [15, 16, 17, 18, 19] as const;

export type IslandWispSpec = {
  id: string; hp: number;
  /** Its nest: the board cell it sits on (a hidden wisp's is found when it arrives). Ignored for a sky wisp. */
  cell: number;
  /** A sky wisp: it floats over the island above this board column (1-5) instead of nesting on a cell. */
  sky?: number;
  /** Places it takes in the turn strip (a boss acts twice a round). */
  slots?: number;
  /** A sky wisp that cannot be hurt while these nest wisps stand. */
  guardedBy?: readonly string[];
  /** Merge tactics: it walks the board and acts by this personality every turn (`docs/encounter-tactics.md`). */
  kind?: DarkWispKind;
  /** Merge tactics: a slow wisp acts every other turn. */
  speed?: 'normal' | 'slow';
  intents?: readonly WispIntent[]; hidden?: boolean; size?: number;
  /** Its art; absent, read off its first intent. */ look?: string;
  /** The chain that hits it for one more. */ weakTo?: 'growth' | 'water';
  /** A hidden wisp that breaks off when this one is struck to half. */ splitsInto?: string;
};

/**
 * Lanes (`docs/encounter-lanes.md`): a wisp arriving over a board column (1-5) `at` seconds in, coming down a row every
 * `step` seconds, leaving Mist on the free cell it steps off every `drop` steps.
 */
export type IslandLaneSpec = { id: string; column: number; at: number; hp: number; step: number; drop?: number; look?: string };

export type IslandLevelSpec = {
  title: string;
  objective: string;
  difficulty: EncounterDifficulty;
  /** Pieces on the board at the start: [cell, tier] of the level's chain, or of the Water chain when marked 'water'. */
  pieces: readonly (readonly [number, number] | readonly [number, number, 'water'])[];
  mist: readonly EncounterMistCell[];
  /** The Seed Pod: where it stands, how many pieces it holds, and a piece back every few merges. */
  pod: { cell: number; charges: number; every: number };
  /**
   * A Spring: it makes the Water chain (Pebble, Shell, Tidepool), whose merges wash the Mist twice as hard. `under`
   * hides it under Mist of that kind at its cell: clearing that cell is how it is found.
   */
  spring?: { cell: number; charges: number; every: number; under?: 'light' | 'dense' };
  wisps: readonly IslandWispSpec[];
  /** Lanes: a real-time level whose wisps come down the columns (its `wisps` stay empty). */
  lanes?: readonly IslandLaneSpec[];
  /** A named wisp to bring down instead of every wisp. */
  target?: string;
  /** The share of the board the Mist must hold to win; the difficulty's by default. */
  overrun?: number;
  /**
   * The Mist each wisp nests in: its free neighbouring cells start misted (light on a calm level, thick after), so a
   * wisp has to be cut through to before it can be struck. `false` leaves the nests open.
   */
  ring?: 'light' | 'dense' | false;
  /** Rest turns in the turn strip; the difficulty's by default (a calm level breathes). */
  rest?: number;
  /** Pieces caught in the Mist at the start: [cell, tier] of the level's chain. A pulse frees them, or their twin merged in. */
  bound?: readonly (readonly [number, number])[];
  /** Board rows: a merge-tactics level plays on five (cells 43-47 under the usual four). */
  rows?: 4 | 5;
  chain?: string;
  rewards?: { glow: number; xp: number };
};

const WATER_CHAIN = 'nature:waterside';
const WINDOW_4 = new Set([15, 16, 17, 18, 19, 22, 23, 24, 25, 26, 29, 30, 31, 32, 33, 36, 37, 38, 39, 40]);
const WINDOW_5 = new Set([...WINDOW_4, 43, 44, 45, 46, 47]);

/** A territory wisp's placement: on its nest cell, a little under a cell's size (a boss fills it). */
export const nestPlacement = (cell: number, size = 0.9): DarkWisp['placement'] => ({ kind: 'cell', cell, size });

/** Nests for wisps authored without one (the Grove, the Daily Mist): spread along the top row; a hidden one's is found on arrival. */
export function withNests(wisps: readonly DarkWisp[]): DarkWisp[] {
  const shown = wisps.filter((wisp) => !wisp.hidden && wisp.placement.kind !== 'cell');
  const spread = shown.length <= 1 ? [17] : shown.length === 2 ? [16, 18] : shown.length === 3 ? [15, 17, 19] : [15, 16, 18, 19, 17];
  let next = 0;
  return wisps.map((wisp) => {
    if (wisp.placement.kind === 'cell') return wisp;
    const size = wisp.placement.kind === 'tile' ? Math.min(1, Math.max(0.7, wisp.placement.size * 4)) : 0.9;
    const cell = wisp.hidden ? TOP_ROW[2] : spread[next++ % spread.length]!;
    return { ...wisp, placement: nestPlacement(cell, size) };
  });
}

export function islandLevel(campaignId: string, key: string, spec: IslandLevelSpec, lines: CorruptionWispLines = ISLAND_WISP_LINES): RegionMissionDefinition {
  const chain = spec.chain ?? 'nature:garden';
  // A level with walking wisps is a merge-tactics battle: five rows, every action a turn, no Mist rings.
  const tactics = spec.wisps.some((wisp) => wisp.kind);
  const lanes = spec.lanes?.length ? spec.lanes : null;
  const rows = spec.rows ?? (tactics || lanes ? 5 : 4);
  const WINDOW = rows === 5 ? WINDOW_5 : WINDOW_4;
  const tier = (value: number, water?: 'water') => `${water ? WATER_CHAIN : chain}:${value}`;
  for (const [cell] of spec.pieces) if (!WINDOW.has(cell)) throw new Error(`${campaignId}:${key}: piece outside the board at ${cell}`);
  for (const wisp of spec.wisps) if (wisp.sky == null && !WINDOW.has(wisp.cell)) throw new Error(`${campaignId}:${key}: wisp ${wisp.id} nests outside the board at ${wisp.cell}`);
  const wisps: DarkWisp[] = spec.wisps.map((wisp) => ({
    id: wisp.id, hp: wisp.hp, placement: wisp.sky != null ? { kind: 'sky' as const, column: wisp.sky, size: wisp.size ?? 0.2 } : nestPlacement(wisp.cell, wisp.size ?? 0.9),
    ...(wisp.slots ? { slots: wisp.slots } : {}), ...(wisp.guardedBy?.length ? { guardedBy: wisp.guardedBy } : {}),
    ...(wisp.kind ? { kind: wisp.kind } : {}), ...(wisp.speed ? { speed: wisp.speed } : {}),
    ...(wisp.intents?.length ? { intents: wisp.intents } : {}), ...(wisp.hidden ? { hidden: true } : {}), ...(wisp.look ? { look: wisp.look } : {}),
    ...(wisp.weakTo ? { weakTo: wisp.weakTo } : {}), ...(wisp.splitsInto ? { splitsInto: wisp.splitsInto } : {}),
  }));
  const id = `${campaignId}:${key}`;
  // Each shown wisp's nest ringed with Mist on the cells nothing else uses.
  const ringType = spec.ring ?? (tactics || lanes ? false : RING_BY_DIFFICULTY[spec.difficulty]);
  const used = new Set<number>([...spec.pieces.map(([cell]) => cell), ...spec.mist.map((mist) => mist.cell), ...(spec.bound ?? []).map(([cell]) => cell), spec.pod.cell, ...(spec.spring ? [spec.spring.cell] : []), ...spec.wisps.filter((wisp) => !wisp.hidden && wisp.sky == null).map((wisp) => wisp.cell)]);
  const ring: EncounterMistCell[] = [];
  if (ringType) {
    for (const wisp of spec.wisps) {
      if (wisp.hidden || wisp.sky != null) continue;
      for (const cell of [wisp.cell - 1, wisp.cell + 1, wisp.cell - 7, wisp.cell + 7]) {
        if (!WINDOW.has(cell) || used.has(cell) || Math.abs((cell % 7) - (wisp.cell % 7)) > 1) continue;
        used.add(cell);
        ring.push({ cell, type: ringType });
      }
    }
  }
  const bound: EncounterMistCell[] = (spec.bound ?? []).map(([cell, value]) => ({ cell, type: 'bound', holds: { kind: 'item', definitionId: tier(value) } }));
  const mist = [...spec.mist, ...bound, ...ring];
  const encounter: EncounterDefinition = {
    id,
    storageKey: `katchimeras.encounter.${campaignId.replace(/:/g, '.')}.${key}.${lanes ? 'lanes2' : tactics ? 'v6' : 'v5'}`,
    rows,
    difficulty: spec.difficulty,
    seed: { items: spec.pieces.map(([cell, value, water]) => ({ cell, definitionId: tier(value, water) })), echoes: [], veiled: [] },
    mist: spec.spring?.under ? [...mist, { cell: spec.spring.cell, type: spec.spring.under, holds: { kind: 'spawner', spawnerId: 'spring' } }] : mist,
    spawners: [
      { id: 'pod', generatorId: 'wild-garden', cell: spec.pod.cell, charges: spec.pod.charges, drops: [tier(1)], recharge: { kind: 'merges', every: spec.pod.every, amount: 1 } },
      ...(spec.spring ? [{ id: 'spring', generatorId: 'mist-spring', cell: spec.spring.cell, charges: spec.spring.charges, drops: [`${WATER_CHAIN}:1`], recharge: { kind: 'merges' as const, every: spec.spring.every, amount: 1 }, ...(spec.spring.under ? { hidden: true } : {}) }] : []),
    ],
    mechanic: lanes
      ? { kind: 'lanes', wisps: lanes.map((lane) => ({ id: lane.id, hp: lane.hp, column: lane.column - 1, at: Math.round(lane.at * 1_000), stepMs: Math.round(lane.step * 1_000), ...(lane.drop ? { dropEvery: lane.drop } : {}), ...(lane.look ? { look: lane.look } : {}) })) }
      : { kind: 'dark-wisps', wisps, damageByTier: [1, 1, 2, 3], targeting: 'adjacent', ...(tactics ? { mode: 'tactics' as const } : { rest: spec.rest ?? REST_BY_DIFFICULTY[spec.difficulty] }) },
    required: lanes ? lanes.reduce((sum, lane) => sum + lane.hp, 0) : wisps.filter((wisp) => !wisp.hidden).reduce((sum, wisp) => sum + wisp.hp, 0),
    wisps: [],
    objective: spec.target ? { kind: 'dark-wisp', wispId: spec.target } : { kind: 'wisps' },
    resolve: null,
    // Lanes are lost when a wisp gets through, never to the Mist's hold: the line is the whole board.
    territory: { overrun: lanes ? 1 : spec.overrun ?? OVERRUN_BY_DIFFICULTY[spec.difficulty] },
    grades: ENCOUNTER_DEFAULT_GRADES,
    rewards: spec.rewards ?? { glow: 0, xp: 0 },
    lines,
  };
  return { id, title: spec.title, objective: spec.objective, difficulty: spec.difficulty, encounter, rewards: encounter.rewards };
}

const surge = (every: number, amount?: number): WispIntent => ({ kind: 'surge', every, ...(amount ? { amount } : {}) });
const shroud = (every: number): WispIntent => ({ kind: 'shroud', every });
const root = (every: number): WispIntent => ({ kind: 'root', every });
const devour = (every: number): WispIntent => ({ kind: 'devour', every });
const ward = (every: number, amount = 2): WispIntent => ({ kind: 'ward', every, amount });
const mend = (every: number, amount = 1): WispIntent => ({ kind: 'mend', every, amount });
const call = (every: number): WispIntent => ({ kind: 'call', every });
const gather = (every: number, amount = 3): WispIntent => ({ kind: 'gather', every, amount });
const burrow = (every: number): WispIntent => ({ kind: 'burrow', every });
const spores = (every: number, amount?: number): WispIntent => ({ kind: 'spores', every, ...(amount ? { amount } : {}) });
const light = (cell: number): EncounterMistCell => ({ cell, type: 'light' });
const dense = (cell: number, holds?: string): EncounterMistCell => ({ cell, type: 'dense', ...(holds ? { holds: { kind: 'item', definitionId: holds } } : {}) });
const rooted = (cell: number, holds?: string): EncounterMistCell => ({ cell, type: 'root', ...(holds ? { holds: { kind: 'item', definitionId: holds } } : {}) });
const SPROUT = 'nature:garden:2';

/** Lanes: the Seed Pod stands in the bottom cell of the middle column, and a level starts with six Seeds around it. */
const POD = { cell: 45, charges: 16, every: 2 };
const SEEDS = [[36, 1], [37, 1], [38, 1], [39, 1], [44, 1], [46, 1]] as const;

/**
 * Lanes: a stream of wisps down these columns (1-5), one every `every` seconds from `first`. The middle column has the
 * Pod in its bottom cell, one row less to defend from, so its wisps are a little weaker.
 */
function stream(prefix: string, columns: readonly number[], first: number, every: number, hp: number, step: number, drop?: number): IslandLaneSpec[] {
  return columns.map((column, index) => ({ id: `${prefix}${index + 1}`, column, at: first + index * every, hp: column === 3 ? Math.max(3, Math.round(hp * 0.7)) : hp, step, ...(drop ? { drop } : {}) }));
}

/**
 * Lift the Mist: every friend's first level, and the first Lanes board anyone plays (`docs/encounter-lanes.md`).
 * Three wisps, one at a time, down the middle and either side.
 */
export const MIST_LEVEL_SPEC: IslandLevelSpec = {
  title: 'Lift the Mist', objective: 'Wisps are coming down. Merge Seeds into Sprouts under them: every piece shoots Glow up its column.', difficulty: 'calm',
  pieces: SEEDS, mist: [light(23), light(25)], pod: POD, wisps: [],
  lanes: stream('wisp', [3, 2, 4], 2, 9, 5, 4),
};

/** Petalimp's Bloom Garden, all Lanes (`docs/encounter-lanes.md`): two levels a chapter, each with one new idea, the Colour Thief last. */
export const PETALIMP_LEVEL_SPECS: Readonly<Record<1 | 2 | 3 | 4, readonly IslandLevelSpec[]>> = {
  1: [
    {
      title: 'Seeds Under the Mist', objective: 'They come down every column now. Move your pieces under them: a piece only shoots up its own column.', difficulty: 'calm',
      pieces: SEEDS, mist: [light(22), light(26)], pod: POD, wisps: [],
      lanes: stream('wisp', [2, 4, 3, 1, 5], 2, 9, 4, 5, 3),
    },
    {
      title: 'The First Bed', objective: 'Bigger pieces shoot harder and faster. A wisp that reaches a piece hides it in Mist: merge beside it to free it.', difficulty: 'calm',
      pieces: [[36, 2], [40, 2], [37, 1], [39, 1], [44, 1], [46, 1]], mist: [light(23), light(25)], pod: POD, wisps: [],
      lanes: stream('wisp', [1, 3, 5, 2, 4, 3], 2, 7, 6, 4.2, 2),
    },
  ],
  2: [
    {
      title: 'Colour in the Rows', objective: 'They come faster now, and leave Mist behind them. Keep a strong piece under each one.', difficulty: 'thick',
      pieces: SEEDS, mist: [light(22), dense(24), light(26)], pod: POD, wisps: [],
      lanes: [...stream('wisp', [2, 4, 3, 1, 5], 2, 6.5, 8, 4, 2), { id: 'last', column: 3, at: 34, hp: 7, step: 3.8, drop: 2 }],
    },
    {
      title: 'Pollinators', objective: 'A big one comes down among the rest. Merge big where it matters most.', difficulty: 'thick',
      pieces: [[36, 1], [37, 1], [38, 2], [39, 1], [44, 1], [46, 1]], mist: [light(22), light(26)], pod: POD, wisps: [],
      lanes: [...stream('wisp', [1, 5, 2, 4, 1, 5], 2, 7, 7, 3.8, 2), { id: 'big', column: 2, at: 16, hp: 12, step: 4.5, drop: 2, look: 'warden' }],
    },
  ],
  3: [
    {
      title: 'The Trellis', objective: 'These drop Mist on every cell they pass. Merge beside the Mist to clear it, and keep room to merge.', difficulty: 'thick',
      pieces: SEEDS, mist: [light(22), dense(24), light(26), light(30), light(32)], pod: POD, wisps: [],
      lanes: stream('wisp', [2, 4, 1, 5, 3, 2], 2, 6, 9, 3.8, 1),
    },
    {
      title: 'They Came Back at Night', objective: 'Quick ones, one after another, down every column. Keep every column covered.', difficulty: 'dark',
      pieces: [[36, 2], [37, 1], [38, 2], [39, 1], [44, 1], [46, 1]], mist: [light(22), light(26)], pod: POD, wisps: [],
      lanes: stream('wisp', [1, 5, 3, 2, 4, 1, 5], 2, 5.5, 6, 3.3, 2),
    },
  ],
  4: [
    {
      title: 'The Long Border', objective: 'Two slow, tough ones hold the middle while fast ones run the edges. Split your pieces.', difficulty: 'dark',
      pieces: [[36, 2], [37, 1], [38, 1], [39, 1], [40, 2], [44, 1]], mist: [light(23), light(25)], pod: POD, wisps: [],
      lanes: [
        { id: 'wall-left', column: 2, at: 2, hp: 14, step: 5, drop: 2, look: 'warden' },
        { id: 'wall-right', column: 4, at: 8, hp: 14, step: 5, drop: 2, look: 'warden' },
        ...stream('fast', [1, 5, 3, 1, 5], 14, 6, 4, 3),
      ],
    },
    {
      title: 'The Colour Thief', objective: 'It took the colour first. It comes down the middle, slow and strong, dropping Mist all the way, and it does not come alone.', difficulty: 'boss',
      pieces: [[36, 1], [37, 1], [38, 2], [39, 1], [40, 1], [44, 1]], mist: [light(22), dense(24), light(26)], pod: POD, wisps: [],
      lanes: [{ id: 'thief', column: 3, at: 3, hp: 24, step: 6, drop: 1, look: 'thief' }, ...stream('escort', [1, 5, 2, 4, 1, 5], 8, 8, 7, 3.5, 2)],
      rewards: { glow: 50, xp: 30 },
    },
  ],
};

/**
 * Fernip's Wildgrowth: the island that teaches the Water chain. A Spring waits under the Mist in the first level;
 * Pebbles wash Mist away twice as hard and bite the wisps weak to Water, Seeds cut the roots and bite the ones weak to
 * Growth.
 */
export const FERNIP_LEVEL_SPECS: Readonly<Record<1 | 2 | 3 | 4, readonly IslandLevelSpec[]>> = {
  1: [
    {
      title: 'The Old Spring', objective: 'Something bubbles under the thick Mist on the left. Clear it and see.', difficulty: 'calm',
      pieces: [[36, 1], [37, 1], [38, 1]], mist: [light(23), light(25)],
      pod: { cell: 40, charges: 6, every: 3 }, spring: { cell: 29, charges: 5, every: 3, under: 'dense' },
      wisps: [{ id: 'shroud', hp: 4, cell: 16, intents: [shroud(3)], weakTo: 'water' }, { id: 'drift', hp: 3, cell: 18 }],
    },
    {
      title: 'Wash the Beds', objective: 'Pebbles wash the Mist away twice as hard, and these wisps hate the water.', difficulty: 'calm',
      pieces: [[37, 1], [38, 1], [39, 1, 'water'], [33, 1, 'water']], mist: [light(22), dense(23), light(24), light(25), light(17)],
      pod: { cell: 40, charges: 5, every: 3 }, spring: { cell: 36, charges: 5, every: 3 },
      wisps: [{ id: 'shroud', hp: 4, cell: 16, intents: [shroud(2)], weakTo: 'water' }, { id: 'shroud-b', hp: 4, cell: 18, intents: [shroud(3)], weakTo: 'water' }],
    },
  ],
  2: [
    {
      title: 'Roots and Rain', objective: 'Seeds cut roots; Pebbles cannot. Find the Spring for the rest.', difficulty: 'thick',
      pieces: [[36, 1], [37, 1], [38, 1]], mist: [rooted(16), rooted(18), dense(24)],
      pod: { cell: 40, charges: 6, every: 3 }, spring: { cell: 22, charges: 5, every: 3, under: 'light' },
      wisps: [{ id: 'creep', hp: 5, cell: 17, intents: [root(3)], weakTo: 'growth' }, { id: 'shroud', hp: 4, cell: 15, intents: [shroud(3)], weakTo: 'water' }],
    },
    {
      title: 'Two Streams', objective: 'One fears the water, one fears the seeds. Feed each its own.', difficulty: 'thick',
      pieces: [[37, 1], [38, 1], [29, 1, 'water'], [30, 1, 'water']], mist: [light(23), light(25), light(17)],
      pod: { cell: 40, charges: 6, every: 3 }, spring: { cell: 36, charges: 6, every: 3 },
      wisps: [{ id: 'surge', hp: 5, cell: 16, intents: [surge(3)], weakTo: 'water' }, { id: 'nibble', hp: 5, cell: 18, intents: [devour(3)], weakTo: 'growth' }],
    },
  ],
  3: [
    {
      title: 'The Drowned Path', objective: 'The Spring is buried in the middle of the Mist. Wash your way to it.', difficulty: 'thick',
      pieces: [[36, 1], [37, 1], [38, 1], [39, 1]], mist: [dense(16), dense(18), light(24), light(22)],
      pod: { cell: 40, charges: 6, every: 3 }, spring: { cell: 31, charges: 5, every: 3, under: 'dense' },
      wisps: [{ id: 'warden', hp: 6, cell: 17, intents: [ward(3, 2), surge(3)] }, { id: 'shroud', hp: 4, cell: 15, intents: [shroud(3)], weakTo: 'water' }],
    },
    {
      title: 'Night Ferns', objective: 'Spores drift onto empty beds. Put a piece on one before it turns.', difficulty: 'dark',
      pieces: [[37, 1], [38, 1], [29, 1, 'water']], mist: [rooted(16), light(22), dense(24), light(26)],
      pod: { cell: 40, charges: 6, every: 3 }, spring: { cell: 36, charges: 6, every: 3 },
      wisps: [
        { id: 'nibble', hp: 5, cell: 15, intents: [devour(3)], weakTo: 'growth' },
        { id: 'spore', hp: 4, cell: 17, intents: [spores(3), surge(3)], weakTo: 'water' },
        { id: 'caller', hp: 5, cell: 19, intents: [shroud(3), call(4)] },
        { id: 'mistling', hp: 2, cell: 19, intents: [surge(4)], hidden: true, size: 0.7 },
      ],
    },
  ],
  4: [
    {
      title: 'Thorn Wall', objective: 'Roots and thorns. It burrows deeper when you get close. Only Growth gets through.', difficulty: 'dark',
      pieces: [[36, 1], [37, 1], [38, 2]], mist: [rooted(16), rooted(18), light(24), light(26)],
      pod: { cell: 40, charges: 6, every: 3 }, spring: { cell: 33, charges: 5, every: 3, under: 'light' },
      wisps: [{ id: 'creep', hp: 10, cell: 17, intents: [root(2), burrow(3)], weakTo: 'growth' }, { id: 'mend', hp: 4, cell: 19, intents: [mend(2), surge(2)] }],
    },
    {
      title: 'Deep Water', objective: 'The Mist is thick and it keeps coming back. The Spring is your answer.', difficulty: 'dark',
      pieces: [[37, 1], [38, 1], [39, 1, 'water']], mist: [dense(22), light(23), dense(24), light(17)],
      pod: { cell: 40, charges: 6, every: 3 }, spring: { cell: 36, charges: 6, every: 3 },
      wisps: [{ id: 'shroud', hp: 7, cell: 16, intents: [shroud(2), surge(3)], weakTo: 'water' }, { id: 'warden', hp: 5, cell: 18, intents: [ward(3, 2), surge(2)] }],
    },
  ],
};

/**
 * Bundled islands without authored levels get two a chapter from this pattern: a gentle bed, then a harder one whose
 * wisps fight back the way the chapter's number says. Always a Seed Pod; never an item that arrives by itself.
 */
export function patternLevelSpecs(level: number, residentName: string): IslandLevelSpec[] {
  const first: IslandLevelSpec = {
    title: `${residentName}’s Patch`, objective: 'Merge right next to a wisp to strike it.', difficulty: level <= 1 ? 'calm' : 'thick',
    pieces: [[36, 1], [37, 1], [38, 1], [30, 2]], mist: [light(23), light(25), ...(level >= 2 ? [dense(24)] : [])],
    pod: { cell: 40, charges: 5, every: 3 },
    wisps: [{ id: 'drift', hp: 2, cell: 16 }, { id: 'keeper', hp: 2 + level, cell: 18, intents: level >= 3 ? [shroud(3), surge(3)] : level >= 2 ? [shroud(3)] : [surge(4)] }],
  };
  const keeperIntents: WispIntent[] = level >= 4 ? [ward(3, 2), gather(4)] : level >= 3 ? [devour(3), surge(3)] : level >= 2 ? [shroud(3), surge(3)] : [surge(4)];
  const second: IslandLevelSpec = {
    title: 'Deeper In', objective: 'The Mist is thicker here, and the wisps hold on.', difficulty: level <= 1 ? 'calm' : level <= 2 ? 'thick' : 'dark',
    pieces: [[36, 1], [37, 1], [38, 1], [39, 1], [29, 2]],
    mist: [light(16), dense(18, SPROUT), light(24), ...(level >= 3 ? [rooted(23)] : [])],
    pod: { cell: 40, charges: 5, every: level >= 3 ? 4 : 3 },
    wisps: [
      { id: 'drift', hp: 2, cell: 15 },
      { id: 'keeper', hp: 3 + level, cell: 17, intents: keeperIntents, size: 1 },
      ...(level >= 4 ? [{ id: 'mend', hp: 3, cell: 19, intents: [mend(3)] }] : []),
    ],
  };
  return [first, second];
}
