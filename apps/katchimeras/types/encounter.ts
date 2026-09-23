import type { WispId } from './wisp';
import type { MergeCharacterId } from './merge-world';
import type { HatchableMissionGuides, HatchableMissionSeed } from './hatchable-companion';
import type { MissionMechanicDefinition } from './mission-mechanic';
import type { CorruptionWispLines, CorruptionWispSpec } from '@/features/onboarding/corruption-wisps';
import type { FtueCameraDirective } from '@/features/onboarding/ftue-types';

/**
 * An encounter: one self-contained Mist board, the whole of a mission. It is
 * the docked board every friend's clearing has played on (a seed of items,
 * echoes and veiled cells; wisps over the tile; a mechanic that turns merges
 * into strikes), with what the campaign pivot adds: Mist of its own that
 * merges wear down, spawners with charges, a Resolve budget, an objective,
 * grades and rewards. A board authored the old way (a hatchable's mission, a
 * chapter's restoration board) is read through `features/encounter/adapt.ts`
 * into this shape with `resolve: null`, so nothing shipped changes.
 */
export type EncounterDifficulty = 'calm' | 'thick' | 'dark' | 'boss';
export type EncounterGrade = 'cleared' | 'bright' | 'perfect';

/** Mist a merge wears down: light (one hit), dense (two), root (plant merges only), wisp-bound (falls with its wisp). */
export type EncounterMistType = 'light' | 'dense' | 'root' | 'wisp-bound';
export type EncounterMistHolds = { kind: 'item'; definitionId: string } | { kind: 'spawner'; spawnerId: string };
export type EncounterMistCell = {
  cell: number;
  type: EncounterMistType;
  /** Hits to clear; light 1, dense 2 by default. Ignored by wisp-bound mist. */
  hp?: number;
  /** Wisp-bound mist: the wisp whose fall clears it. */
  wispId?: string;
  /** What the cleared cell reveals. */
  holds?: EncounterMistHolds;
};

/** How a spawner's charges come back inside the encounter. */
export type EncounterRecharge =
  | { kind: 'merges'; every: number; amount: number }
  | { kind: 'wisp'; amount: number }
  | { kind: 'none' };

export type EncounterSpawner = {
  id: string;
  /** The item maker it is (its chains and art), from the merge catalog. */
  generatorId: string;
  cell: number;
  charges: number;
  recharge?: EncounterRecharge;
  /** Tier-one drops that override the maker's own. */
  drops?: readonly string[];
  /** Placed by the mist that holds it, not at the start. */
  hidden?: boolean;
};

/** What a cache brings when it opens: named pieces, or one twin for each of the board's highest loose pieces. */
export type EncounterCacheContents =
  | { kind: 'items'; items: readonly { definitionId: string; quantity: number }[] }
  | { kind: 'twins'; max: number };

/**
 * The board's cache: opened when the local pieces are spent and the objective
 * is not met (the beat the Main Board delivery used to be). What it brings
 * lands on `landOn` first, then on any free cell.
 */
export type EncounterCache = { contents: EncounterCacheContents; landOn?: readonly number[] };

export type EncounterObjective =
  | { kind: 'wisps' }
  | { kind: 'dark-wisp'; wispId: string }
  | { kind: 'cache' };

export type EncounterCompanion = { slot: 'any' | readonly MergeCharacterId[]; required?: boolean };

export type EncounterRewards = { glow: number; xp: number; firstClear?: { wispId?: WispId; glow?: number } };

export type EncounterDefinition = {
  id: string;
  storageKey: string;
  rows: 3 | 4;
  difficulty: EncounterDifficulty;
  seed: HatchableMissionSeed;
  mist: readonly EncounterMistCell[];
  spawners: readonly EncounterSpawner[];
  cache?: EncounterCache;
  /** How merges strike the wisps; absent, glow strikes. */
  mechanic?: MissionMechanicDefinition;
  /** Strikes that fill the bar (the mechanic host's requirement). */
  required: number;
  /** The wisps over the tile, for glow strikes. */
  wisps: readonly CorruptionWispSpec[];
  objective: EncounterObjective;
  /** Actions the Mist allows; null is a board with no budget (every board from before the pivot). Ignored once `light` is set. */
  resolve: number | null;
  /**
   * Territory battles (`docs/encounter-territory.md`): Dark Wisps nest on the board and spread their Mist; merges
   * cleanse it. A turn is a merge. The level is lost when the Mist holds `overrun` of the board (a fraction), or with
   * no free cell and no merge left. `stars` are the most of the board still misted at the end for a Perfect and a
   * Bright clear (fractions; default 0.25 and 0.45).
   */
  territory?: EncounterTerritory;
  companion?: EncounterCompanion;
  /** Resolve left for a Bright and a Perfect clear. */
  grades: { bright: number; perfect: number };
  rewards: EncounterRewards;
  guides?: HatchableMissionGuides;
  lines: CorruptionWispLines;
  barTitle?: string;
  /** The solver's least margin between the shortest play and the budget (default 2). */
  safetyMargin?: number;
  /** For a hatchable's mission, the camera its tile is framed with. */
  camera?: FtueCameraDirective;
};

export type EncounterTerritory = { overrun: number; stars?: readonly [number, number] };
export const TERRITORY_DEFAULT_STARS: readonly [number, number] = [0.25, 0.45];

/** What the player brings in: the Katchimera and its level, and one helper Wisp. */
export type EncounterLoadout = { companionId: MergeCharacterId; level: number; wispId?: WispId };

export const ENCOUNTER_MIST_DEFAULT_HP: Readonly<Record<EncounterMistType, number>> = { light: 1, dense: 2, root: 1, 'wisp-bound': 1 };
export const ENCOUNTER_DEFAULT_GRADES: EncounterDefinition['grades'] = { bright: 5, perfect: 10 };
export const ENCOUNTER_DEFAULT_SAFETY_MARGIN = 2;
