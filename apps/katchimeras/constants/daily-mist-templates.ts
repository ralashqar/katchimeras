import type { DarkWispBehaviour, WispIntent } from '@/types/mission-mechanic';

/**
 * The Daily Mist's three patches, as skeletons the day fills in: how many
 * pieces and of which tiers, how much Mist of each kind, a spawner's charges,
 * the wisps and what they do, the budget over the shortest play. Calm is a
 * warm-up; Thick brings one behaviour; Dark brings a Dark Wisp with two.
 * Chains widen as friends are hatched (`DAILY_MIST_CHAINS`).
 */
export type DailyMistSlot = 0 | 1 | 2;
export type DailyMistTemplate = {
  id: string;
  slot: DailyMistSlot;
  title: string;
  rows: 3 | 4;
  /** Loose pieces by tier: how many tier ones, how many tier twos. */
  pieces: { tierOne: number; tierTwo: number };
  mist: { light: number; dense: number; root: number };
  spawner: { charges: number; every: number } | null;
  /** Each wisp's v1 behaviour; `intents` (encounter v2) when given, what it shows and does. */
  wisps: readonly { hp: number; behaviour: DarkWispBehaviour; intents?: readonly WispIntent[] }[];
  damageByTier: readonly number[];
  /** Resolve over the shortest play the search finds. */
  margin: number;
};

export const DAILY_MIST_SLOT_NAMES: readonly string[] = ['A calm patch', 'A thick patch', 'Something dark'];

export const DAILY_MIST_TEMPLATES: readonly DailyMistTemplate[] = [
  { id: 'calm-clearing', slot: 0, title: 'A calm patch', rows: 4, pieces: { tierOne: 4, tierTwo: 1 }, mist: { light: 2, dense: 0, root: 0 }, spawner: { charges: 3, every: 3 }, wisps: [{ hp: 3, behaviour: { kind: 'plain' } }, { hp: 3, behaviour: { kind: 'plain' } }], damageByTier: [1, 2, 4], margin: 5 },
  { id: 'calm-edge', slot: 0, title: 'A calm patch', rows: 3, pieces: { tierOne: 4, tierTwo: 0 }, mist: { light: 1, dense: 1, root: 0 }, spawner: { charges: 2, every: 3 }, wisps: [{ hp: 4, behaviour: { kind: 'plain' }, intents: [{ kind: 'shroud', every: 4 }] }], damageByTier: [1, 2, 4], margin: 5 },
  { id: 'thick-wall', slot: 1, title: 'A thick patch', rows: 4, pieces: { tierOne: 4, tierTwo: 2 }, mist: { light: 2, dense: 2, root: 0 }, spawner: { charges: 4, every: 3 }, wisps: [{ hp: 5, behaviour: { kind: 'shrouder', every: 3 }, intents: [{ kind: 'shroud', every: 3 }, { kind: 'surge', every: 3 }] }, { hp: 3, behaviour: { kind: 'plain' } }], damageByTier: [1, 2, 4], margin: 4 },
  { id: 'thick-roots', slot: 1, title: 'A thick patch', rows: 4, pieces: { tierOne: 6, tierTwo: 0 }, mist: { light: 1, dense: 1, root: 2 }, spawner: { charges: 3, every: 3 }, wisps: [{ hp: 5, behaviour: { kind: 'rootbound', every: 3, plantBonus: 1 }, intents: [{ kind: 'root', every: 3 }, { kind: 'surge', every: 3 }] }, { hp: 3, behaviour: { kind: 'plain' } }], damageByTier: [1, 2, 4], margin: 4 },
  { id: 'dark-keeper', slot: 2, title: 'Something dark', rows: 4, pieces: { tierOne: 6, tierTwo: 1 }, mist: { light: 2, dense: 2, root: 1 }, spawner: { charges: 4, every: 3 }, wisps: [{ hp: 8, behaviour: { kind: 'shrouder', every: 2 }, intents: [{ kind: 'ward', every: 3, amount: 2 }, { kind: 'surge', every: 2 }] }, { hp: 4, behaviour: { kind: 'hungry', every: 3, maxTier: 1 } }], damageByTier: [1, 2, 4], margin: 3 },
  { id: 'dark-mender', slot: 2, title: 'Something dark', rows: 4, pieces: { tierOne: 6, tierTwo: 2 }, mist: { light: 3, dense: 1, root: 1 }, spawner: { charges: 3, every: 2 }, wisps: [{ hp: 6, behaviour: { kind: 'mender', every: 2 } }, { hp: 5, behaviour: { kind: 'shrouder', every: 3 }, intents: [{ kind: 'shroud', every: 3 }, { kind: 'spores', every: 2 }] }], damageByTier: [1, 2, 4], margin: 3 },
];

/** The chains the day may draw pieces from, in the order friends bring them; the first is always open. */
export const DAILY_MIST_CHAINS: readonly { chainId: string; generatorId: string; companion: string | null }[] = [
  { chainId: 'nature:garden', generatorId: 'wild-garden', companion: null },
  { chainId: 'adventure:trail', generatorId: 'journey-locker', companion: 'steppling' },
  { chainId: 'drink:refresh', generatorId: 'ritual-bar', companion: 'baristabbit' },
];

export const DAILY_MIST_GLOW: readonly number[] = [8, 14, 22];
export const DAILY_MIST_XP: readonly number[] = [6, 10, 16];
