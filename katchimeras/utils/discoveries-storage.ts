import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import type { DiscoveryRecord, DiscoveryState } from '@/types/discoveries';

// Persistence for unlocked Discoveries. Only the unlock records live here
// (unlockedAt / source / seenAnimation) — names, rules and progress are re-derived
// from the catalog + day history every evaluation. See discoveries-system-design §5.

const STORAGE_KEY = 'katchimera.discoveries.v1';
const EMPTY: DiscoveryState = { version: 1, unlocked: {} };

export function loadDiscoveryState(): DiscoveryState {
  const stored = getStoredJson<DiscoveryState>(STORAGE_KEY, EMPTY);
  if (!stored || stored.version !== 1 || typeof stored.unlocked !== 'object' || stored.unlocked === null) {
    return EMPTY;
  }
  return stored;
}

export function saveDiscoveryState(state: DiscoveryState): void {
  setStoredJson(STORAGE_KEY, state);
}

// Merge newly unlocked records in, never overwriting an existing one (so unlockedAt
// + seenAnimation are preserved). Idempotent.
export function recordUnlocks(state: DiscoveryState, records: DiscoveryRecord[]): DiscoveryState {
  if (records.length === 0) return state;
  let changed = false;
  const unlocked = { ...state.unlocked };
  for (const record of records) {
    if (!unlocked[record.id]) {
      unlocked[record.id] = record;
      changed = true;
    }
  }
  return changed ? { ...state, version: 1, unlocked } : state;
}

export function markAnimationSeen(state: DiscoveryState, id: string): DiscoveryState {
  const existing = state.unlocked[id];
  if (!existing || existing.seenAnimation) return state;
  return { ...state, version: 1, unlocked: { ...state.unlocked, [id]: { ...existing, seenAnimation: true } } };
}
