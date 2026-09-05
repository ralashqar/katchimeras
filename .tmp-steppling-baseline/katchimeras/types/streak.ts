export type StreakDayState = 'future' | 'uncaptured' | 'captured' | 'missed' | 'repaired';

export type PersistedStreakDayState = Extract<StreakDayState, 'captured' | 'missed' | 'repaired'>;

export type StreakCaptureType =
  | 'mood'
  | 'journal'
  | 'voice'
  | 'photo'
  | 'meal'
  | 'activity'
  | 'sleep_manual'
  | 'place_confirmed'
  | 'reflection'
  | 'other_saved_artifact';

export type StreakCaptureIntent = {
  clientEventId: string;
  localDate: string;
  occurredAt: string;
  sourceIdHash: string;
  timezone: string;
  type: StreakCaptureType;
};

export type StreakDayRecord = {
  firstCaptureTimestamp: string | null;
  localDate: string;
  qualifyingCaptureType: StreakCaptureType | null;
  repairedAt: string | null;
  repairSource: 'earned' | 'support' | 'migration' | null;
  state: PersistedStreakDayState;
  timezone: string;
};

export type StreakMilestone = {
  days: number;
  essenceReward: number;
  reachedAt: string;
};

export type StreakOutboxEvent = StreakCaptureIntent & {
  attempts: number;
  queuedAt: string;
};

export type StoredStreakState = {
  activationDate: string;
  celebratedDates: string[];
  days: Record<string, StreakDayRecord>;
  declinedRepairDates: string[];
  historyImportedAt: string | null;
  milestones: Record<string, StreakMilestone>;
  outbox: StreakOutboxEvent[];
  offeredRepairDates: string[];
  repairEarningProgress: number;
  repairsAvailable: number;
  repairsCapacity: number;
  seenMilestoneDays: number[];
  syncError: string | null;
  syncedAt: string | null;
  version: 1;
};

export type StreakDaySummary = {
  label: string;
  localDate: string;
  state: StreakDayState;
};

export type StreakSnapshot = {
  currentStreak: number;
  lifetimeCapturedDays: number;
  longestStreak: number;
  pendingMilestones: StreakMilestone[];
  recentDays: StreakDaySummary[];
  repairableDate: string | null;
  repairableStreak: number;
  repairsAvailable: number;
  repairsCapacity: number;
  syncState: 'synced' | 'pending' | 'offline' | 'error';
  todayState: StreakDayState;
  week: StreakDaySummary[];
};

export type RegisterStreakCaptureResult = {
  firstCaptureOfDay: boolean;
  milestone: StreakMilestone | null;
  repairEarned: boolean;
  snapshot: StreakSnapshot;
};
