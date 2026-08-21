import type { HomeDayRecord, JournalRecord } from '@/types/home';
import type { MergeStepEnergyDay } from '@/types/merge-world';

export const MERGE_ENERGY_REGEN_CAP = 50;
export const MERGE_INITIAL_ENERGY = 20;
export const MERGE_ENERGY_REGEN_MS = 3 * 60_000;
export const MERGE_DAILY_JOURNAL_ENERGY = 10;
export const MERGE_JOURNAL_ENERGY_CURVE = [10, 6, 3, 1] as const;
export const MERGE_DAILY_COMPANION_ENERGY = 5;
export const MERGE_DAILY_QUEST_ENERGY = 5;
export const STEPS_PER_MERGE_ENERGY = 300;
export const MOSSPROUT_FTUE_JOURNAL_ENERGY = 20;

export type MergeJournalRewardPreview = {
  dailyJournalEnergy: number;
  companionEnergy: number;
  totalEnergy: number;
};

export type YesterdayStepEnergyOffer = {
  dayId: string;
  energy: number;
  observedAt: string;
  observedSteps: number;
};

export function mergeJournalEnergyForCapture(index: number): number {
  // Journaling never becomes worthless. The first captures taper quickly, then
  // every additional completed action keeps a small one-Energy floor instead
  // of disabling the card once the authored curve is exhausted.
  return MERGE_JOURNAL_ENERGY_CURVE[Math.max(0, Math.floor(index))] ?? 1;
}

export function mergeStepEnergyPreview(observedSteps: number): number {
  const safeSteps = Number.isFinite(observedSteps) ? Math.max(0, Math.floor(observedSteps)) : 0;
  return Math.floor(safeSteps / STEPS_PER_MERGE_ENERGY);
}

/** A completed bootstrap is the one daily conversion for this source day. */
export function mergeYesterdayStepEnergyPreview(
  observedSteps: number,
  existing?: MergeStepEnergyDay | null,
): number {
  if (existing?.bootstrapClaimed) return 0;
  return mergeStepEnergyPreview(observedSteps);
}

/** Returns no UI offer unless the reading can award at least one Energy. */
export function buildYesterdayStepEnergyOffer(input: {
  dayId: string;
  existing?: MergeStepEnergyDay | null;
  observedAt: string;
  observedSteps: number;
}): YesterdayStepEnergyOffer | null {
  const energy = mergeYesterdayStepEnergyPreview(input.observedSteps, input.existing);
  if (energy <= 0) return null;
  return {
    dayId: input.dayId,
    energy,
    observedAt: input.observedAt,
    observedSteps: Math.max(0, Math.floor(input.observedSteps)),
  };
}

export function mergeJournalRewardPreview(
  days: readonly HomeDayRecord[],
  options: { companion: boolean; now?: Date; targetDayId?: string },
): MergeJournalRewardPreview {
  const now = options.now ?? new Date();
  const dayId = options.targetDayId ?? mergeLocalDayId(now);
  const records = journalRecordsForEggDay(days, dayId);
  const hasCompanionJournal = records.some(isCompanionJournalRecord);
  const dailyJournalEnergy = mergeJournalEnergyForCapture(records.length);
  const companionEnergy = options.companion && !hasCompanionJournal ? MERGE_DAILY_COMPANION_ENERGY : 0;
  return { dailyJournalEnergy, companionEnergy, totalEnergy: dailyJournalEnergy + companionEnergy };
}

export function journalRecordsForEggDay(days: readonly HomeDayRecord[], dayId: string): JournalRecord[] {
  return days.filter((day) => day.isoDate === dayId)
    .flatMap((day) => day.journalRecords ?? [])
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function journalRecordsCreatedOn(days: readonly HomeDayRecord[], dayId: string): JournalRecord[] {
  return days.flatMap((day) => day.journalRecords ?? [])
    .filter((record) => mergeLocalDayIdForTimestamp(record.createdAt) === dayId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function isCompanionJournalRecord(record: JournalRecord): boolean {
  return record.source?.origin?.kind === 'companion_reflection';
}

export function mergeLocalDayId(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function mergeTomorrowDayId(value: Date): string {
  return mergeLocalDayId(new Date(value.getFullYear(), value.getMonth(), value.getDate() + 1, 12));
}

export function mergeLocalDayIdForTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
  return mergeLocalDayId(parsed);
}
