import { useEffect, useState } from 'react';

// A tiny module-level observable for the background half of a backfill run.
//
// The foundation pass (pins, albums, hatches) finishes synchronously and hands
// the user straight to Home; the slower LLM reflections then keep generating in
// the background. This store is how the running task — which outlives the screen
// that kicked it off — tells the rest of the app "still polishing N day(s)", so
// Home can show a quiet top-right tag and pull each reflection in as it lands.

export type BackfillStatus = {
  active: boolean;
  total: number;
  // Days still awaiting their reflection (counts down to 0).
  remaining: number;
  // Bumped every time a day's reflection is written, so subscribers can re-read
  // stored state even while `remaining` is unchanged for the final settle.
  completedVersion: number;
};

const INITIAL: BackfillStatus = { active: false, total: 0, remaining: 0, completedVersion: 0 };

let current: BackfillStatus = INITIAL;
const listeners = new Set<(status: BackfillStatus) => void>();

function emit() {
  for (const listener of listeners) {
    listener(current);
  }
}

export function getBackfillStatus(): BackfillStatus {
  return current;
}

export function subscribeBackfillStatus(listener: (status: BackfillStatus) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Begin tracking a background enrichment of `total` days.
export function beginBackfillEnrichment(total: number) {
  current = { active: total > 0, total, remaining: total, completedVersion: current.completedVersion };
  emit();
}

// Mark one more day's reflection as done; auto-clears `active` at zero.
export function markBackfillDayEnriched() {
  const remaining = Math.max(0, current.remaining - 1);
  current = {
    ...current,
    remaining,
    active: remaining > 0,
    completedVersion: current.completedVersion + 1,
  };
  emit();
}

// Force-finish (used when enrichment ends early or errors out).
export function finishBackfillEnrichment() {
  current = { ...current, active: false, remaining: 0, completedVersion: current.completedVersion + 1 };
  emit();
}

// React binding for the Home tag. Re-renders whenever the status changes.
export function useBackfillStatus(): BackfillStatus {
  const [status, setStatus] = useState<BackfillStatus>(current);
  useEffect(() => subscribeBackfillStatus(setStatus), []);
  return status;
}
