import type { JournalRecord, StoredHomeDayRecord } from '@/types/home';

export function journalRecordsForDay(day: StoredHomeDayRecord | null | undefined): JournalRecord[] {
  return day?.journalRecords ?? [];
}

export function journalRecordBySource(day: StoredHomeDayRecord | null | undefined, kind: JournalRecord['source']['kind'], sourceId: string): JournalRecord | null {
  return journalRecordsForDay(day).find((record) => record.source.kind === kind && record.source.sourceId === sourceId) ?? null;
}

export function journalCategoryCounts(day: StoredHomeDayRecord | null | undefined): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const record of journalRecordsForDay(day)) counts[record.flowId] = (counts[record.flowId] ?? 0) + 1;
  return counts;
}

export function validateJournalProjections(day: StoredHomeDayRecord): string[] {
  const errors: string[] = [];
  const keys = new Set<string>();
  for (const record of day.journalRecords ?? []) {
    if (keys.has(record.idempotencyKey)) errors.push(`Duplicate journal idempotency key ${record.idempotencyKey}`);
    keys.add(record.idempotencyKey);
    if (!(day.manualJournalEntries ?? []).some((entry) => entry.id === `manual-${record.id}`) && !record.id.startsWith('journal:legacy:')) {
      errors.push(`Missing compatibility entry for ${record.id}`);
    }
  }
  return errors;
}
