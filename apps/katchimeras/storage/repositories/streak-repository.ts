import type {
  RegisterStreakCaptureResult,
  StoredStreakState,
  StreakCaptureIntent,
  StreakSnapshot,
} from '@/types/streak';
import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import {
  createEmptyStreakState,
  declineStreakRepair,
  markStreakDateCelebrated,
  registerStreakCapture,
  repairStreakDay,
  streakSnapshot,
} from '@/utils/streak-engine';

const STORAGE_KEY = 'katchimera.streak.v1';
const listeners = new Set<() => void>();
let cache: StoredStreakState | null = null;

export type StreakCelebrationEvent = {
  localDate: string;
  result: RegisterStreakCaptureResult;
};

let latestCelebration: StreakCelebrationEvent | null = null;
const celebrationListeners = new Set<(event: StreakCelebrationEvent) => void>();

export const streakRepository = {
  capture(intent: StreakCaptureIntent, options?: { countTowardRepair?: boolean; queue?: boolean }) {
    const current = load();
    const registered = registerStreakCapture(current, intent, new Date(), options);
    save(registered.state);
    if (registered.result.firstCaptureOfDay && !current.celebratedDates.includes(intent.localDate)) {
      latestCelebration = { localDate: intent.localDate, result: registered.result };
      celebrationListeners.forEach((listener) => listener(latestCelebration!));
    }
    return registered.result;
  },
  declineRepair(localDate: string) {
    save(declineStreakRepair(load(), localDate));
  },
  load,
  markCelebrated(localDate: string) {
    save(markStreakDateCelebrated(load(), localDate));
    if (latestCelebration?.localDate === localDate) latestCelebration = null;
  },
  markMilestoneSeen(days: number) {
    const current = load();
    if (current.seenMilestoneDays.includes(days)) return;
    save({ ...current, seenMilestoneDays: [...current.seenMilestoneDays, days] });
  },
  markRepairOffered(localDate: string) {
    const current = load();
    if (current.offeredRepairDates.includes(localDate)) return;
    save({ ...current, offeredRepairDates: [...current.offeredRepairDates, localDate].slice(-20) });
  },
  replace(state: StoredStreakState) {
    save(state);
  },
  repair(localDate: string) {
    const next = repairStreakDay(load(), localDate);
    if (!next) return false;
    save(next);
    return true;
  },
  snapshot(now = new Date()): StreakSnapshot {
    return streakSnapshot(load(), now);
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  subscribeCelebrations(listener: (event: StreakCelebrationEvent) => void) {
    celebrationListeners.add(listener);
    if (latestCelebration) listener(latestCelebration);
    return () => { celebrationListeners.delete(listener); };
  },
};

function load(): StoredStreakState {
  if (cache) return cache;
  const value = getStoredJson<StoredStreakState | null>(STORAGE_KEY, null);
  cache = validState(value)
    ? {
        ...value,
        offeredRepairDates: Array.isArray(value.offeredRepairDates) ? value.offeredRepairDates : [],
        seenMilestoneDays: Array.isArray(value.seenMilestoneDays) ? value.seenMilestoneDays : [],
      }
    : createEmptyStreakState();
  return cache;
}

function save(state: StoredStreakState): void {
  cache = state;
  setStoredJson(STORAGE_KEY, state);
  listeners.forEach((listener) => listener());
}

function validState(value: StoredStreakState | null): value is StoredStreakState {
  return Boolean(
    value
    && value.version === 1
    && typeof value.activationDate === 'string'
    && value.days
    && Array.isArray(value.outbox)
    && Array.isArray(value.celebratedDates)
    && Array.isArray(value.declinedRepairDates),
  );
}
