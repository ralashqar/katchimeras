import type { StoredHomeDayRecord } from '@/types/home';

export function dayInputSignature(day: StoredHomeDayRecord): string {
  const journalSignature = (day.journalRecords ?? [])
    .map((record) => `${record.id}:${record.flowId}.${record.categoryId}.${typeof record.fields.context === 'string' ? record.fields.context : ''}`)
    .sort()
    .join(',');
  return `${day.locations.length}|${day.moments.length}|${day.selectedPathId ?? ''}|${day.hatchCheckIn?.moodId ?? ''}|${day.hatchCheckIn?.flowId ?? ''}|${day.hatchCheckIn?.categoryId ?? ''}|${journalSignature}|${day.keyJournalRecordId ?? ''}|${day.creature ? 1 : 0}`;
}

export function dayHasShape(day: StoredHomeDayRecord) {
  return (
    day.moments.length > 0 ||
    day.stepsCount > 0 ||
    day.locationSampleCount > 0 ||
    day.visitedPlaceCount > 0 ||
    day.locations.length > 0 ||
    day.promptAnswers.some((answer) => !answer.dismissed) ||
    (day.hatchCheckIn != null && day.hatchCheckIn.status !== 'skipped') ||
    Boolean(day.heroPhoto)
  );
}
