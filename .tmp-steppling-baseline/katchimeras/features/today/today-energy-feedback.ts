import { useSyncExternalStore } from 'react';

export type TodayEnergyFeedback = {
  amount: number;
  count: number;
  index: number;
  key: number;
  publishedAt: number | null;
};

const listeners = new Set<() => void>();
let snapshot: TodayEnergyFeedback = { amount: 0, count: 0, index: -1, key: 0, publishedAt: null };

const FINAL_ARRIVAL_ACTIVATION_GRACE_MS = 1200;

export function publishTodayEnergyFeedback(amount: number, index: number, count: number): void {
  snapshot = { amount, count, index, key: snapshot.key + 1, publishedAt: Date.now() };
  listeners.forEach((listener) => listener());
}

export function clearTodayEnergyFeedback(): void {
  snapshot = { amount: 0, count: 0, index: -1, key: snapshot.key + 1, publishedAt: null };
  listeners.forEach((listener) => listener());
}

export function isRecentFinalTodayEnergyArrival(
  feedback: TodayEnergyFeedback,
  now = Date.now(),
): boolean {
  return feedback.count > 0
    && feedback.index === feedback.count - 1
    && feedback.publishedAt != null
    && now - feedback.publishedAt <= FINAL_ARRIVAL_ACTIVATION_GRACE_MS;
}

export function getTodayEnergyFeedbackSnapshot(): TodayEnergyFeedback {
  return snapshot;
}

export function subscribeTodayEnergyFeedback(listener: () => void): () => void {
  return subscribe(listener);
}

export function useTodayEnergyFeedback(): TodayEnergyFeedback {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): TodayEnergyFeedback {
  return snapshot;
}
