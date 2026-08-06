import { useSyncExternalStore } from 'react';

export type TodayEnergyFeedback = {
  amount: number;
  count: number;
  index: number;
  key: number;
};

const listeners = new Set<() => void>();
let snapshot: TodayEnergyFeedback = { amount: 0, count: 0, index: -1, key: 0 };

export function publishTodayEnergyFeedback(amount: number, index: number, count: number): void {
  snapshot = { amount, count, index, key: snapshot.key + 1 };
  listeners.forEach((listener) => listener());
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
