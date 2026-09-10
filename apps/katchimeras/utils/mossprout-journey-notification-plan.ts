export function nextMossproutJourneyReminderDate(completedDayId: string, hour = 9) {
  const target = new Date(`${completedDayId}T12:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  target.setDate(target.getDate() + 1);
  target.setHours(hour, 0, 0, 0);
  return target;
}

export type CompanionReturnNotificationInput = {
  familyId: 'mossprout' | 'steppling';
  /** No completed Journey yet: the reminder that follows the first rest. */
  firstReturn: boolean;
  /** The planted Memory Seed's display name, when the first session saved one. */
  seedName?: string | null;
};

/**
 * The reminder is the first thing a new player reads from the app after
 * leaving it, so it speaks about their world, not about "a chapter moment".
 * No prices, counts or system vocabulary; the companion's name carries it.
 */
export function companionReturnNotificationContent(input: CompanionReturnNotificationInput): { title: string; body: string } {
  if (input.familyId === 'steppling') {
    return input.firstReturn
      ? { title: 'Steppling is back', body: 'He walked in circles the whole time. There is somewhere new to go.' }
      : { title: 'Steppling is back', body: 'Boots on. He has found the next stretch of path.' };
  }
  if (input.firstReturn) {
    const seed = input.seedName?.trim();
    return {
      title: 'Mossprout is awake',
      body: seed ? `Your ${seed} opened while you were away. Come and see.` : 'Something grew while you were away. Come and see.',
    };
  }
  return { title: 'Mossprout is awake', body: 'The garden kept growing. He has something to show you.' };
}
