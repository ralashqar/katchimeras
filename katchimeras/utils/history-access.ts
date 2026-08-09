export const FREE_HISTORY_DAYS = 14;

export function historyDaysForAccess<T extends { isoDate: string }>(days: readonly T[], activePlus: boolean): T[] {
  if (activePlus || !days.length) return [...days];
  const latest = days.reduce((value, day) => day.isoDate > value ? day.isoDate : value, days[0].isoDate);
  const cutoff = new Date(`${latest}T12:00:00`);
  cutoff.setDate(cutoff.getDate() - (FREE_HISTORY_DAYS - 1));
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  return days.filter((day) => day.isoDate >= cutoffIso);
}
