import { DRIFT_FLOOR, type Progression } from '@incubator/tile-match/engine';
import type { AiProfile, DuelDefinition } from '../game/types';
import type { Profile } from '../state/profile';
import { MOVES } from './campaign';

/** One authored turn: the mechanic, how many footprints, and an optional strength override. */
export type EncounterTurn = readonly [id: keyof typeof MOVES, slots?: 1 | 2, strength?: number];

export type EncounterRow = {
  /** Opponent health. */
  hp: number;
  /** The player's own health for this fight. Low enough that the rival's volleys are felt, high enough that a first session rarely loses. */
  player: number;
  ai: AiProfile;
  /** Hold the rival and deal singles until this many exact beats have landed. */
  openingGate?: number;
  turns: readonly EncounterTurn[];
};

const ai = (minActionMs: number, maxActionMs: number, accuracy: number): AiProfile => ({ minActionMs, maxActionMs, accuracy });

/**
 * The first session: one new idea per fight, and a rival that visibly speeds up.
 *
 * Two rules from the engine's own ladder shape every row. A mechanic is **introduced on a single** — one footprint,
 * so there is exactly one thing to read — and only then doubled. And every row **ends on a plain double**: a
 * non-looping stream holds its last turn forever, so a long fight settles onto standard placements rather than
 * repeating a special.
 *
 * Health and rival speed were set with `scripts/balance-probe.ts`, a human-paced model player (about two seconds a
 * placement, 85% exact). Targets: the opening fight lasts about half a minute and the rival lands two or three volleys;
 * a casual player reaches the boss with roughly half their health and wins it; a sloppy player can lose a boss and
 * retry for free; a sharp player still takes six or seven volleys. `tests/balance.test.ts` holds the ranges.
 *
 * The gust is dealt at `DRIFT_FLOOR`, never below it: under the floor the drift reads its strength as a fade gate and
 * the targets barely move, so the first gust a player met would have been one they could not see.
 */
export const FIRST_SESSION: Record<string, EncounterRow> = {
  'glade-1': { hp: 100, player: 120, ai: ai(4200, 5600, .70), openingGate: 1,
    turns: [['tap', 1], ['tap'], ['tap'], ['tap'], ['tap'], ['tap']] },
  'glade-2': { hp: 120, player: 140, ai: ai(3600, 5000, .72),
    turns: [['tap'], ['drift', 1], ['tap'], ['drift'], ['tap'], ['tap']] },
  'glade-3': { hp: 140, player: 150, ai: ai(3200, 4400, .75),
    turns: [['tap'], ['bomb'], ['tap'], ['drift'], ['tap'], ['bomb'], ['tap']] },
  'glade-4': { hp: 150, player: 180, ai: ai(3000, 4100, .78),
    turns: [['tap'], ['armour', 1], ['tap'], ['armour'], ['drift'], ['bomb'], ['tap']] },
  'glade-5': { hp: 170, player: 200, ai: ai(2800, 3800, .80),
    turns: [['tap'], ['spin', 1], ['tap'], ['spin'], ['bomb'], ['armour'], ['drift'], ['tap']] },
  'glade-6': { hp: 240, player: 260, ai: ai(2400, 3200, .83),
    turns: [['tap'], ['bomb'], ['spin'], ['armour'], ['drift', 2, .7], ['spin'], ['bomb'], ['drift', 2, .7], ['tap']] },
  'cheerlet-1': { hp: 190, player: 240, ai: ai(2500, 3400, .82),
    turns: [['tap'], ['fuse', 1], ['tap'], ['fuse', 1], ['drift'], ['tap']] },
  'cheerlet-2': { hp: 210, player: 250, ai: ai(2400, 3200, .84),
    turns: [['tap'], ['hues', 1], ['tap'], ['bomb'], ['hues', 1], ['drift'], ['tap']] },
  'cheerlet-3': { hp: 250, player: 280, ai: ai(2200, 3000, .86),
    turns: [['tap'], ['armour'], ['spin'], ['bomb'], ['hues', 1], ['fuse', 1], ['drift', 2, .7], ['tap']] },
};

/** The mechanic each fight introduces, in the order a new player meets them. */
export const FIRST_SESSION_LESSONS: Record<string, keyof typeof MOVES | null> = {
  'glade-1': 'tap', 'glade-2': 'drift', 'glade-3': 'bomb', 'glade-4': 'armour', 'glade-5': 'spin', 'glade-6': null,
  'cheerlet-1': 'fuse', 'cheerlet-2': 'hues', 'cheerlet-3': null,
};

export function firstSessionProgression(turns: readonly EncounterTurn[]): Progression {
  return { kind: 'stream', loop: false, turns: turns.map(([id, slots = 2, strength]) => ({
    slots: id === 'fuse' || id === 'hues' ? 1 : slots,
    ...(id === 'fuse' ? { minShapeHeight: 2 } : {}),
    varieties: MOVES[id].varieties.map(variety => ({ ...variety, strength: strength ?? (id === 'drift' ? DRIFT_FLOOR : variety.strength) })),
  })) };
}

/**
 * How a replay climbs, per earlier win of the same duel.
 *
 * A curve rather than a cliff: replays used to jump straight to the base definition — for the first duel, 36 HP
 * against a four-to-six-second rival became 300 HP against one three times quicker. Each win now adds a quarter of
 * the first-session health and shaves the rival's action time by eight percent, never past the base definition,
 * which remains the ceiling and the arena's reference.
 */
export const REPLAY = { hpPerWin: .25, hpCap: 2.5, speedPerWin: .08, accuracyPerWin: .02 } as const;

/** Real wins of this duel so far. Practice and losses do not count. */
export function replayWins(profile: Profile, levelId: string): number {
  return Object.values(profile.receipts).filter(r => r.levelId === levelId && r.won && !r.practice).length;
}

/** `ceiling` is the base definition: the replay never gets a quicker or sharper rival than it. */
export function replayEncounter(session: DuelDefinition, row: EncounterRow, wins: number, ceiling: AiProfile): DuelDefinition {
  const speed = Math.max(0, 1 - REPLAY.speedPerWin * wins);
  return {
    ...session,
    opponentHealth: Math.round(row.hp * Math.min(REPLAY.hpCap, 1 + REPLAY.hpPerWin * wins)),
    ai: {
      minActionMs: Math.max(ceiling.minActionMs, Math.round(row.ai.minActionMs * speed)),
      maxActionMs: Math.max(ceiling.maxActionMs, Math.round(row.ai.maxActionMs * speed)),
      accuracy: Math.min(ceiling.accuracy, row.ai.accuracy + REPLAY.accuracyPerWin * wins),
    },
  };
}

/** First-session pacing for a new profile; replays climb from it. Legacy saves keep the base definitions. */
export function ftueEncounter(base: DuelDefinition, profile: Profile): DuelDefinition {
  if (!profile.adventure || profile.adventure.legacy) return base;
  const row = FIRST_SESSION[base.id];
  if (!row) return base;
  const session: DuelDefinition = { ...base, guided: true, health: row.player, opponentHealth: row.hp, ai: row.ai,
    progression: firstSessionProgression(row.turns), ...(row.openingGate ? { openingGate: row.openingGate } : {}) };
  if (!profile.completed.includes(base.id)) return session;
  return replayEncounter(session, row, Math.max(1, replayWins(profile, base.id)), base.ai);
}
