import type { HomeTomorrowRecord } from '@/types/home';

const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export function shiftLocalDate(date: Date, dayOffset: number) {
  const nextDate = new Date(date);
  nextDate.setHours(12, 0, 0, 0);
  nextDate.setDate(nextDate.getDate() + dayOffset);
  return nextDate;
}

export function toLocalDateId(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function tomorrowDateId(now: Date): string {
  return toLocalDateId(shiftLocalDate(now, 1));
}

export function formatDateLabel(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00`);
  return `${monthNames[date.getMonth()]} ${date.getDate()}`;
}

export function getDayLabel(isoDate: string, isToday: boolean) {
  if (isToday) {
    return 'Today';
  }
  const date = new Date(`${isoDate}T12:00:00`);
  return weekdayNames[date.getDay()];
}

export function createTomorrowRecord(now: Date): HomeTomorrowRecord {
  const tomorrowDate = shiftLocalDate(now, 1);

  return {
    kind: 'tomorrow',
    id: 'tomorrow',
    isoDate: toLocalDateId(tomorrowDate),
    dayLabel: 'Tomorrow',
    dateLabel: 'Forming',
    title: 'Not yet formed',
    subtitle: 'Another day needs a little movement before it becomes visible.',
    accentColor: '#D8E2FF',
  };
}
