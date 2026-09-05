// A tiny cross-screen hand-off: the calendar / life-map ask the Home tab to open
// a specific day, then switch to it. The Home screen consumes this on focus and
// selects the day. Module-level (not persisted) — it only bridges one navigation.
let pendingDayId: string | null = null;

export function requestSelectedDay(dayId: string): void {
  pendingDayId = dayId;
}

export function consumeSelectedDay(): string | null {
  const value = pendingDayId;
  pendingDayId = null;
  return value;
}
