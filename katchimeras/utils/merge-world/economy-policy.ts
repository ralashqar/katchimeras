import type { HomeDayRecord, JournalRecord } from '@/types/home';

export const MERGE_ENERGY_REGEN_CAP = 50;
export const MERGE_INITIAL_ENERGY = 20;
export const MERGE_ENERGY_REGEN_MS = 3 * 60_000;
export const MERGE_DAILY_ACTIVITY_ENERGY_LIMIT = 20;
export const MERGE_DAILY_JOURNAL_ENERGY = 10;
export const MERGE_DAILY_COMPANION_ENERGY = 5;
export const MERGE_DAILY_QUEST_ENERGY = 5;
export const STEPS_PER_MERGE_ENERGY = 300;
export const MERGE_DAILY_STEP_ENERGY_LIMIT = 20;
export const MOSSPROUT_FTUE_JOURNAL_ENERGY = 20;

export type MergeJournalRewardPreview = {
  dailyJournalEnergy: number;
  companionEnergy: number;
  totalEnergy: number;
};

export function mergeStepEnergyPreview(observedSteps: number): number {
  const safeSteps = Number.isFinite(observedSteps) ? Math.max(0, Math.floor(observedSteps)) : 0;
  return Math.min(MERGE_DAILY_STEP_ENERGY_LIMIT, Math.floor(safeSteps / STEPS_PER_MERGE_ENERGY));
}

export function mergeJournalRewardPreview(
  days: readonly HomeDayRecord[],
  options: { companion: boolean; now?: Date; targetDayId?: string },
): MergeJournalRewardPreview {
  const now = options.now ?? new Date();
  const dayId = options.targetDayId ?? mergeLocalDayId(now);
  const records = journalRecordsForEggDay(days, dayId);
  const hasJournal = records.length > 0;
  const hasCompanionJournal = records.some(isCompanionJournalRecord);
  const dailyJournalEnergy = hasJournal ? 0 : MERGE_DAILY_JOURNAL_ENERGY;
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
