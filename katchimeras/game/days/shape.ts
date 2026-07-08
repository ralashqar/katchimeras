import type { StoredHomeDayRecord } from '@/types/home';

export function dayInputSignature(day: StoredHomeDayRecord): string {
  return `${day.locations.length}|${day.moments.length}|${day.selectedPathId ?? ''}|${day.creature ? 1 : 0}`;
}

export function dayHasShape(day: StoredHomeDayRecord) {
  return (
    day.moments.length > 0 ||
    day.stepsCount > 0 ||
    day.locationSampleCount > 0 ||
    day.visitedPlaceCount > 0 ||
    day.locations.length > 0 ||
    day.promptAnswers.some((answer) => !answer.dismissed) ||
    Boolean(day.heroPhoto)
  );
}
