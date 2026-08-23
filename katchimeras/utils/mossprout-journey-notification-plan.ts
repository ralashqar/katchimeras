export function nextMossproutJourneyReminderDate(completedDayId: string, hour = 9) {
  const target = new Date(`${completedDayId}T12:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  target.setDate(target.getDate() + 1);
  target.setHours(hour, 0, 0, 0);
  return target;
}
