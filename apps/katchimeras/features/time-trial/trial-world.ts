import type { MergeWorldState } from '@/types/merge-world';
import { HEATS_PER_DAY, MEDAL_RANK, heatFor, heatPars, maxPlausibleScore, medalFor, type HeatMedal } from './ladder';

/**
 * What a time trial keeps: results, never boards. The board inside a heat is not saved (a killed app means the heat
 * did not happen); a finished heat's score (wisps struck down before the clock ran out) is, through this pure step. Records only ever improve, each heat's
 * Glow is paid once a day, and the day's chest once. Like the Lantern and the buildings, the repository serializes it.
 */
export const WISP_RUSH_TRIAL_ID = 'wisp-rush';
export const WISP_RUSH_FAMILY_ID = 'steppling';
/** Days of results kept in the save; records are kept for good. */
const DAYS_KEPT = 7;

export type TimeTrialHeatResult = { /** Most wisps struck down in this heat today. */ best: number; medal: HeatMedal | null; clearedAt: number; attempts: number };
export type TimeTrialDay = { heats: Record<number, TimeTrialHeatResult>; chestClaimedAt: number | null };
export type TimeTrialRecords = {
  /** Best score ever for each rung of the ladder (heat 1 to 10), whatever the day; and the best day's total. */
  bestHeat: Record<number, number>;
  bestDay: number | null;
  daysCompleted: number;
  streak: number;
  lastCompletedDayId: string | null;
  golds: number;
};
export type TimeTrialProgress = { days: Record<string, TimeTrialDay>; records: TimeTrialRecords };
export type TimeTrials = Record<string, TimeTrialProgress>;

const emptyRecords = (): TimeTrialRecords => ({ bestHeat: {}, bestDay: null, daysCompleted: 0, streak: 0, lastCompletedDayId: null, golds: 0 });
export const emptyTimeTrial = (): TimeTrialProgress => ({ days: {}, records: emptyRecords() });

/** Glow for a heat's first clear of the day: a little, rising with the ladder (4 to 22, 130 for the whole day). */
export const heatGlow = (index: number) => 4 + Math.max(0, Math.min(HEATS_PER_DAY - 1, index)) * 2;
export const timeTrialFor = (world: Pick<MergeWorldState, 'timeTrials'>, trialId = WISP_RUSH_TRIAL_ID): TimeTrialProgress => world.timeTrials?.[trialId] ?? emptyTimeTrial();
export const heatsCleared = (day: TimeTrialDay | undefined) => Object.keys(day?.heats ?? {}).length;
/** The heat the player may start next today: they unlock in order, and any cleared heat can be run again. */
export const nextHeatIndex = (day: TimeTrialDay | undefined) => Math.min(HEATS_PER_DAY - 1, heatsCleared(day));
const dayBefore = (dayId: string) => { const date = new Date(`${dayId}T12:00:00Z`); date.setUTCDate(date.getUTCDate() - 1); return date.toISOString().slice(0, 10); };

export function normalizeTimeTrials(source: unknown): TimeTrials | undefined {
  if (!source || typeof source !== 'object') return undefined;
  const trials: TimeTrials = {};
  for (const [trialId, raw] of Object.entries(source as Record<string, Partial<TimeTrialProgress>>)) {
    if (!raw || typeof raw !== 'object') continue;
    const days: TimeTrialProgress['days'] = {};
    for (const [dayId, day] of Object.entries(raw.days ?? {})) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dayId) || !day || typeof day !== 'object') continue;
      const heats: TimeTrialDay['heats'] = {};
      for (const [index, heat] of Object.entries(day.heats ?? {})) {
        const at = Number(index);
        if (!Number.isInteger(at) || at < 0 || at >= HEATS_PER_DAY || !heat || !(heat.best > 0)) continue;
        heats[at] = { best: Math.floor(heat.best), medal: heat.medal && heat.medal in MEDAL_RANK ? heat.medal : null, clearedAt: Number(heat.clearedAt) || 0, attempts: Math.max(1, Math.floor(Number(heat.attempts) || 1)) };
      }
      days[dayId] = { heats, chestClaimedAt: Number.isFinite(day.chestClaimedAt) ? day.chestClaimedAt! : null };
    }
    const records = { ...emptyRecords(), ...(raw.records ?? {}) };
    trials[trialId] = { days, records: { ...records, bestHeat: Object.fromEntries(Object.entries(records.bestHeat ?? {}).filter(([, score]) => Number(score) > 0)) } };
  }
  return Object.keys(trials).length ? trials : undefined;
}

export type HeatOutcome = {
  /** Enough wisps fell (the heat's Bronze): the heat is cleared and the next one opens. */
  cleared: boolean;
  /** How many more wisps a run that fell short needed. */
  short: number;
  firstClear: boolean; glow: number; medal: HeatMedal | null; improvedBy: number | null; newRecord: boolean; dayComplete: boolean;
};

/**
 * A finished heat. Refused if it is not today's, if its heat is not unlocked yet, or if no hand could have scored it.
 * A run that falls short of the heat's Bronze changes nothing: run it again. Otherwise: the first clear of the day pays
 * its Glow; a better score replaces the old one and may raise the medal; the all-time records move only towards better.
 */
export function recordTimeTrialHeat(input: MergeWorldState, run: { trialId?: string; dayId: string; index: number; score: number }, todayId: string, now: number): { state: MergeWorldState; outcome: HeatOutcome } {
  const trialId = run.trialId ?? WISP_RUSH_TRIAL_ID;
  if (run.dayId !== todayId) throw new Error('That ladder has closed. Today has a new one.');
  if (!Number.isInteger(run.index) || run.index < 0 || run.index >= HEATS_PER_DAY) throw new Error('Unknown heat.');
  const spec = heatFor(run.dayId, run.index, trialId);
  if (!Number.isInteger(run.score) || run.score < 0 || run.score > maxPlausibleScore(spec)) throw new Error('That run could not be recorded.');
  const progress = structuredClone(timeTrialFor(input, trialId));
  const day = progress.days[run.dayId] ??= { heats: {}, chestClaimedAt: null };
  if (run.index > heatsCleared(day)) throw new Error('Clear the heat before it first.');

  const pars = heatPars(spec);
  const medal = medalFor(run.score, pars);
  if (!medal) return { state: input, outcome: { cleared: false, short: pars.bronze - run.score, firstClear: false, glow: 0, medal: null, improvedBy: null, newRecord: false, dayComplete: false } };
  const before = day.heats[run.index];
  const firstClear = !before;
  const better = !before || run.score > before.best;
  const bestMedal = before?.medal && MEDAL_RANK[before.medal] >= MEDAL_RANK[medal] ? before.medal : medal;
  if (bestMedal === 'gold' && before?.medal !== 'gold') progress.records.golds += 1;
  day.heats[run.index] = { best: better ? run.score : before!.best, medal: bestMedal, clearedAt: before?.clearedAt ?? now, attempts: (before?.attempts ?? 0) + 1 };

  const recordBefore = progress.records.bestHeat[run.index];
  const newRecord = recordBefore == null || run.score > recordBefore;
  if (newRecord) progress.records.bestHeat[run.index] = run.score;

  const dayComplete = heatsCleared(day) >= HEATS_PER_DAY;
  if (dayComplete) {
    const total = Object.values(day.heats).reduce((sum, heat) => sum + heat.best, 0);
    if (progress.records.bestDay == null || total > progress.records.bestDay) progress.records.bestDay = total;
    if (progress.records.lastCompletedDayId !== run.dayId) {
      progress.records.streak = progress.records.lastCompletedDayId === dayBefore(run.dayId) ? progress.records.streak + 1 : 1;
      progress.records.daysCompleted += 1;
      progress.records.lastCompletedDayId = run.dayId;
    }
  }
  // Old days fall away; what they proved lives on in the records.
  for (const old of Object.keys(progress.days).sort().slice(0, -DAYS_KEPT)) delete progress.days[old];

  const glow = firstClear ? heatGlow(run.index) : 0;
  const state: MergeWorldState = { ...input, coins: input.coins + glow, timeTrials: { ...input.timeTrials, [trialId]: progress } };
  return { state, outcome: { cleared: true, short: 0, firstClear, glow, medal, improvedBy: before && better ? run.score - before.best : null, newRecord, dayComplete } };
}

export type DayChest = { receiptId: string; familyId: string; kind: 'gift' | 'gift-rare' };
/** The chest for a finished ladder: a friend pack for Steppling, a better one with five or more Golds. Once a day. */
export function dayChestFor(world: Pick<MergeWorldState, 'timeTrials'>, dayId: string, trialId = WISP_RUSH_TRIAL_ID): DayChest | null {
  const day = timeTrialFor(world, trialId).days[dayId];
  if (!day || heatsCleared(day) < HEATS_PER_DAY || day.chestClaimedAt != null) return null;
  const golds = Object.values(day.heats).filter((heat) => heat.medal === 'gold').length;
  return { receiptId: `friend:${WISP_RUSH_FAMILY_ID}:rush:${dayId}`, familyId: WISP_RUSH_FAMILY_ID, kind: golds >= 5 ? 'gift-rare' : 'gift' };
}
export function claimDayChest(input: MergeWorldState, dayId: string, now: number, trialId = WISP_RUSH_TRIAL_ID): MergeWorldState {
  if (!dayChestFor(input, dayId, trialId)) return input;
  const progress = structuredClone(timeTrialFor(input, trialId));
  progress.days[dayId]!.chestClaimedAt = now;
  return { ...input, timeTrials: { ...input.timeTrials, [trialId]: progress } };
}
