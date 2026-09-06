import type {
  RegisterStreakCaptureResult,
  StoredStreakState,
  StreakCaptureIntent,
  StreakDayState,
  StreakDaySummary,
  StreakMilestone,
  StreakSnapshot,
} from '@/types/streak';

export const STREAK_MILESTONE_REWARDS = new Map<number, number>([
  [3, 3],
  [7, 7],
  [14, 10],
  [30, 20],
  [50, 25],
  [100, 50],
  [365, 150],
]);

export function createEmptyStreakState(now = new Date()): StoredStreakState {
  return {
    activationDate: localDateId(now),
    celebratedDates: [],
    days: {},
    declinedRepairDates: [],
    historyImportedAt: null,
    milestones: {},
    outbox: [],
    offeredRepairDates: [],
    repairEarningProgress: 0,
    repairsAvailable: 0,
    repairsCapacity: 2,
    seenMilestoneDays: [],
    syncError: null,
    syncedAt: null,
    version: 1,
  };
}

export function registerStreakCapture(
  state: StoredStreakState,
  intent: StreakCaptureIntent,
  now = new Date(),
  options: { countTowardRepair?: boolean; queue?: boolean } = {},
): { state: StoredStreakState; result: RegisterStreakCaptureResult } {
  const existing = state.days[intent.localDate];
  if (existing?.state === 'captured' || existing?.state === 'repaired') {
    const unchanged = options.queue === false || state.outbox.some((item) => item.clientEventId === intent.clientEventId)
      ? state
      : { ...state, outbox: [...state.outbox, outboxEvent(intent)] };
    return {
      state: unchanged,
      result: {
        firstCaptureOfDay: false,
        milestone: null,
        repairEarned: false,
        snapshot: streakSnapshot(unchanged, now),
      },
    };
  }

  const nextDays = {
    ...state.days,
    [intent.localDate]: {
      firstCaptureTimestamp: intent.occurredAt,
      localDate: intent.localDate,
      qualifyingCaptureType: intent.type,
      repairedAt: null,
      repairSource: null,
      state: 'captured' as const,
      timezone: intent.timezone,
    },
  };
  let repairEarningProgress = state.repairEarningProgress;
  let repairsAvailable = state.repairsAvailable;
  let repairEarned = false;
  if (options.countTowardRepair !== false && repairsAvailable < state.repairsCapacity) {
    repairEarningProgress += 1;
    if (repairEarningProgress >= 7) {
      repairEarningProgress = 0;
      repairsAvailable += 1;
      repairEarned = true;
    }
  }
  let next: StoredStreakState = {
    ...state,
    days: nextDays,
    outbox: options.queue === false || state.outbox.some((item) => item.clientEventId === intent.clientEventId)
      ? state.outbox
      : [...state.outbox, outboxEvent(intent)],
    repairEarningProgress,
    repairsAvailable,
    syncError: null,
  };
  const currentStreak = streakSnapshot(next, now).currentStreak;
  const reward = STREAK_MILESTONE_REWARDS.get(currentStreak);
  let milestone: StreakMilestone | null = null;
  if (reward != null && !next.milestones[String(currentStreak)]) {
    milestone = { days: currentStreak, essenceReward: reward, reachedAt: intent.occurredAt };
    next = { ...next, milestones: { ...next.milestones, [String(currentStreak)]: milestone } };
  }
  return {
    state: next,
    result: {
      firstCaptureOfDay: true,
      milestone,
      repairEarned,
      snapshot: streakSnapshot(next, now),
    },
  };
}

export function repairStreakDay(
  state: StoredStreakState,
  localDate: string,
  now = new Date(),
): StoredStreakState | null {
  const snapshot = streakSnapshot(state, now);
  if (snapshot.repairableDate !== localDate || state.repairsAvailable < 1) return null;
  return {
    ...state,
    days: {
      ...state.days,
      [localDate]: {
        firstCaptureTimestamp: null,
        localDate,
        qualifyingCaptureType: null,
        repairedAt: now.toISOString(),
        repairSource: 'earned',
        state: 'repaired',
        timezone: resolvedTimezone(),
      },
    },
    repairsAvailable: state.repairsAvailable - 1,
  };
}

export function declineStreakRepair(state: StoredStreakState, localDate: string): StoredStreakState {
  if (state.declinedRepairDates.includes(localDate)) return state;
  return { ...state, declinedRepairDates: [...state.declinedRepairDates, localDate] };
}

export function markStreakDateCelebrated(state: StoredStreakState, localDate: string): StoredStreakState {
  if (state.celebratedDates.includes(localDate)) return state;
  return { ...state, celebratedDates: [...state.celebratedDates, localDate].slice(-40) };
}

export function streakSnapshot(state: StoredStreakState, now = new Date()): StreakSnapshot {
  const today = localDateId(now);
  const yesterday = shiftDateId(today, -1);
  const todayState = dayState(state, today, today);
  const currentEnd = isCounted(todayState) ? today : yesterday;
  const currentStreak = consecutiveCount(state, currentEnd);
  const repairableDate = repairableMissedDate(state, today);
  const repairableStreak = repairableDate ? consecutiveCount(state, shiftDateId(repairableDate, -1)) : 0;
  const earliest = earliestDate(state);
  let longestStreak = 0;
  let running = 0;
  for (let cursor = earliest; cursor <= today; cursor = shiftDateId(cursor, 1)) {
    if (isCounted(dayState(state, cursor, today))) {
      running += 1;
      longestStreak = Math.max(longestStreak, running);
    } else {
      running = 0;
    }
  }
  const lifetimeCapturedDays = Object.values(state.days).filter((day) => day.state === 'captured').length;
  return {
    currentStreak,
    lifetimeCapturedDays,
    longestStreak,
    pendingMilestones: Object.values(state.milestones).filter((milestone) => !state.seenMilestoneDays.includes(milestone.days)),
    recentDays: rangeSummaries(state, shiftDateId(today, -27), 28, today),
    repairableDate,
    repairableStreak,
    repairsAvailable: state.repairsAvailable,
    repairsCapacity: state.repairsCapacity,
    syncState: state.syncError ? 'error' : state.outbox.length > 0 ? 'pending' : 'synced',
    todayState,
    week: weekSummaries(state, today),
  };
}

export function dayState(state: StoredStreakState, localDate: string, today = localDateId(new Date())): StreakDayState {
  if (localDate > today) return 'future';
  const stored = state.days[localDate];
  if (stored) return stored.state;
  if (localDate === today) return 'uncaptured';
  return localDate >= state.activationDate ? 'missed' : 'future';
}

export function localDateId(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function shiftDateId(dateId: string, offset: number): string {
  const date = new Date(`${dateId}T12:00:00`);
  date.setDate(date.getDate() + offset);
  return localDateId(date);
}

export function resolvedTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function defaultStreakCaptureTarget(
  now: Date,
  yesterdayState: StreakDayState | undefined,
): 'today' | 'yesterday' {
  return now.getHours() < 3 && yesterdayState === 'missed' ? 'yesterday' : 'today';
}

function repairableMissedDate(state: StoredStreakState, today: string): string | null {
  const yesterday = shiftDateId(today, -1);
  if (state.declinedRepairDates.includes(yesterday)) return null;
  if (dayState(state, yesterday, today) !== 'missed') return null;
  const before = shiftDateId(yesterday, -1);
  if (!isCounted(dayState(state, before, today))) return null;
  return yesterday;
}

function consecutiveCount(state: StoredStreakState, endDate: string): number {
  let count = 0;
  let cursor = endDate;
  while (cursor >= state.activationDate && isCounted(dayState(state, cursor, endDate))) {
    count += 1;
    cursor = shiftDateId(cursor, -1);
  }
  return count;
}

function isCounted(state: StreakDayState): boolean {
  return state === 'captured' || state === 'repaired';
}

function earliestDate(state: StoredStreakState): string {
  const dates = Object.keys(state.days).sort();
  return dates[0] && dates[0] < state.activationDate ? dates[0] : state.activationDate;
}

function weekSummaries(state: StoredStreakState, today: string): StreakDaySummary[] {
  const current = new Date(`${today}T12:00:00`);
  const offset = (current.getDay() - 1 + 7) % 7;
  return rangeSummaries(state, shiftDateId(today, -offset), 7, today);
}

function rangeSummaries(
  state: StoredStreakState,
  start: string,
  count: number,
  today: string,
): StreakDaySummary[] {
  return Array.from({ length: count }, (_, index) => {
    const localDate = shiftDateId(start, index);
    const label = new Intl.DateTimeFormat(undefined, { weekday: 'short' })
      .format(new Date(`${localDate}T12:00:00`));
    return { label, localDate, state: dayState(state, localDate, today) };
  });
}

function outboxEvent(intent: StreakCaptureIntent) {
  return { ...intent, attempts: 0, queuedAt: new Date().toISOString() };
}
