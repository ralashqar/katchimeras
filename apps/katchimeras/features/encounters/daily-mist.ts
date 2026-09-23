import { DAILY_MIST_CHAINS, DAILY_MIST_GLOW, DAILY_MIST_SLOT_NAMES, DAILY_MIST_TEMPLATES, DAILY_MIST_XP, type DailyMistSlot, type DailyMistTemplate } from '@/constants/daily-mist-templates';
import type { RegionMissionDefinition } from '@/constants/island-campaigns/types';
import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { hashSeed, seededUnit } from '@/features/encounter/seed';
import { fairness } from '@/features/encounter/playtest';
import { OVERRUN_BY_DIFFICULTY, withNests } from '@/constants/island-campaigns/island-levels';
import { validateEncounterDefinition } from '@/features/encounter/validate-encounter';
import { missionWindow } from '@/features/mission-mechanics/board-window';
import { ISLAND_WISP_LINES } from '@/features/onboarding/corruption-wisps';
import { ENCOUNTER_DEFAULT_GRADES, type EncounterDefinition, type EncounterDifficulty, type EncounterGrade, type EncounterMistCell } from '@/types/encounter';
import type { MergeWorldState } from '@/types/merge-world';

/**
 * The Daily Mist: three patches a day, the same three for everyone, made
 * from the date alone. Each is a template filled by a seeded shuffle of the
 * window, checked by the same search every authored rung passes; a fill the
 * search cannot clear is rerolled a few times, then the template's plain
 * layout stands in, so the day is never empty. Cleared once for the day's
 * Glow; played again for the fraction.
 */
export const DAILY_MIST_SLOTS: readonly DailyMistSlot[] = [0, 1, 2];
const REROLLS = 8;
const SLOT_DIFFICULTY: readonly EncounterDifficulty[] = ['calm', 'thick', 'dark'];

export const dailyMissionId = (dayId: string, slot: DailyMistSlot) => `daily:${dayId}:${slot}`;

/** Open after the first session, once the Kingdom's goal has been introduced. */
/** The Daily Mist opens once the Grove's Thick Mist (its fifth patch) is cleared: the player has met every Mist it uses. */
export const DAILY_MIST_UNLOCK_MISSION_ID = 'sleeping-grove:5';
export function dailyMistUnlocked(world: Pick<MergeWorldState, 'encounters'>): boolean {
  return Boolean(world.encounters?.clears[DAILY_MIST_UNLOCK_MISSION_ID]);
}

/** The chains the day may use: the garden, and a friend's once they are here. */
export function dailyMistChains(world: Pick<MergeWorldState, 'unlockedCharacters'> | null | undefined) {
  return DAILY_MIST_CHAINS.filter((chain) => !chain.companion || world?.unlockedCharacters.includes(chain.companion as MergeWorldState['unlockedCharacters'][number]));
}

function shuffle<T>(list: readonly T[], seed: string): T[] {
  const out = [...list];
  for (let index = out.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(seededUnit(`${seed}:${index}`) * (index + 1));
    [out[index], out[swap]] = [out[swap]!, out[index]!];
  }
  return out;
}

/** One fill of a template: pieces on the lower rows, the wisps nested along the top row with Mist around them, the spawner in the bottom corner, from the seed. */
export function fillDailyTemplate(template: DailyMistTemplate, dayId: string, attempt: number, chain: { chainId: string; generatorId: string }): EncounterDefinition {
  const seed = `${template.id}:${dayId}:${attempt}`;
  const window = missionWindow(template.rows);
  const cells = window.cellIndices;
  const rows = template.rows;
  const spawnerCell = cells[cells.length - 1]!;
  const lower = cells.slice(cells.length - window.columns * 2, cells.length - 1);
  const upper = cells.slice(0, cells.length - window.columns * 2);
  const tierOne = `${chain.chainId}:1`;
  const tierTwo = `${chain.chainId}:2`;
  const pieceCells = shuffle(lower, `${seed}:pieces`).slice(0, template.pieces.tierOne + template.pieces.tierTwo);
  const items = pieceCells.map((cell, index) => ({ cell, definitionId: index < template.pieces.tierTwo ? tierTwo : tierOne }));
  const wisps = withNests(template.wisps.map((wisp, index) => ({ id: `daily-${index}`, hp: wisp.hp, placement: { kind: 'tile' as const, fx: 0.5, fy: 0.3, size: index === 0 ? 0.24 : 0.2 }, behaviour: wisp.behaviour, ...(wisp.intents ? { intents: wisp.intents } : {}) })));
  const nests = new Set(wisps.flatMap((wisp) => (wisp.placement.kind === 'cell' ? [wisp.placement.cell] : [])));
  const mistCells = shuffle(upper.filter((cell) => !nests.has(cell)), `${seed}:mist`);
  const mist: EncounterMistCell[] = [];
  let at = 0;
  const take = (count: number, type: EncounterMistCell['type']) => { for (let n = 0; n < count && at < mistCells.length; n += 1, at += 1) mist.push({ cell: mistCells[at]!, type, ...(type === 'dense' && n === 0 ? { holds: { kind: 'item', definitionId: tierTwo } } : {}) }); };
  take(template.mist.light, 'light');
  take(template.mist.dense, 'dense');
  take(template.mist.root, 'root');
  const required = wisps.reduce((sum, wisp) => sum + wisp.hp, 0);
  return {
    id: `daily:${dayId}:${template.slot}`,
    storageKey: `katchimeras.daily-mist.${dayId}.${template.slot}.v4`,
    rows,
    difficulty: SLOT_DIFFICULTY[template.slot]!,
    seed: { items, echoes: [], veiled: [] },
    mist,
    spawners: template.spawner ? [{ id: 'pod', generatorId: chain.generatorId, cell: spawnerCell, charges: template.spawner.charges, drops: [tierOne], recharge: { kind: 'merges', every: template.spawner.every, amount: 1 } }] : [],
    // v2: the islands' damage table (a Sprout one, a Plant two), so the Daily Mist asks as much of the player.
    mechanic: { kind: 'dark-wisps', wisps, damageByTier: [1, 1, 2, 3], targeting: 'adjacent' },
    required,
    wisps: [],
    objective: { kind: 'wisps' },
    // A territory battle; the fill is checked by the careful player (`dailyMistMission`).
    resolve: null,
    territory: { overrun: OVERRUN_BY_DIFFICULTY[SLOT_DIFFICULTY[template.slot]!] },
    grades: ENCOUNTER_DEFAULT_GRADES,
    rewards: { glow: DAILY_MIST_GLOW[template.slot]!, xp: DAILY_MIST_XP[template.slot]! },
    lines: ISLAND_WISP_LINES,
  };
}

/** The day's mission for a slot: a template picked by the date, filled and searched; rerolled until it clears, else its plain fill. */
export function dailyMistMission(dayId: string, slot: DailyMistSlot, world?: Pick<MergeWorldState, 'unlockedCharacters'> | null): RegionMissionDefinition {
  const templates = DAILY_MIST_TEMPLATES.filter((template) => template.slot === slot);
  const chains = dailyMistChains(world);
  const template = templates[hashSeed(`daily-mist:${dayId}:${slot}`) % templates.length]!;
  const chain = chains[hashSeed(`daily-mist-chain:${dayId}:${slot}`) % chains.length]!;
  let chosen: EncounterDefinition | null = null;
  for (let attempt = 0; attempt < REROLLS && !chosen; attempt += 1) {
    const filled = fillDailyTemplate(template, dayId, attempt, chain);
    if (!MERGE_ITEMS_BY_ID.has(`${chain.chainId}:1`)) break;
    // A fair fill: the careful player wins it on every one of a few seeds.
    if (validateEncounterDefinition(filled).length) continue;
    const check = fairness(filled, 'careful', 3);
    if (check.wins === check.seeds) chosen = filled;
  }
  // No fill passed: the garden's plain fill of the template, with more room before the Mist wins, stands in.
  const fallback = fillDailyTemplate(template, 'fallback', 0, DAILY_MIST_CHAINS[0]!);
  const encounter = chosen ?? { ...fallback, id: `daily:${dayId}:${slot}`, storageKey: `katchimeras.daily-mist.${dayId}.${slot}.v4`, territory: { overrun: Math.min(0.85, (fallback.territory?.overrun ?? 0.65) + 0.1) } };
  return {
    id: encounter.id,
    title: DAILY_MIST_SLOT_NAMES[slot]!,
    objective: slot === 2 ? 'Drive the Dark Wisps off before the Mist wears you down.' : 'Clear the patch: every wisp down.',
    difficulty: encounter.difficulty,
    encounter,
    rewards: encounter.rewards,
  };
}

export function dailyMistMissions(dayId: string, world?: Pick<MergeWorldState, 'unlockedCharacters'> | null): RegionMissionDefinition[] {
  return DAILY_MIST_SLOTS.map((slot) => dailyMistMission(dayId, slot, world));
}

/** How the day stands: each slot's clear, if any. */
export function dailyMistDay(world: Pick<MergeWorldState, 'encounters'>, dayId: string): { slot: DailyMistSlot; cleared: { clearedAt: number; grade: EncounterGrade } | null }[] {
  const slots = world.encounters?.daily[dayId]?.slots ?? {};
  return DAILY_MIST_SLOTS.map((slot) => ({ slot, cleared: slots[String(slot)] ?? null }));
}
