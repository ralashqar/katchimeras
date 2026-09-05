import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import { emptyRelationshipProgressState, normalizeRelationshipProgressState } from '@/game/katchimeras/relationship-progression';
import type { RelationshipProgressState } from '@/types/relationship-progression';

const STORAGE_KEY = 'katchimeras.relationship-progression-v2';
const listeners = new Set<(state: RelationshipProgressState) => void>();
let cache: RelationshipProgressState | null = null;

function hydrateRelationshipProgression(): RelationshipProgressState {
  const stored = getStoredJson<unknown>(STORAGE_KEY, emptyRelationshipProgressState());
  const normalized = normalizeRelationshipProgressState(stored);
  // Hydration dismisses presentations that were already claimed before an
  // interrupted animation. Visual work is never replayed as progression.
  if (JSON.stringify(stored) !== JSON.stringify(normalized)) setStoredJson(STORAGE_KEY, normalized);
  return normalized;
}

export const relationshipProgressionRepository = {
  load(): RelationshipProgressState {
    cache ??= hydrateRelationshipProgression();
    return cache;
  },
  save(state: RelationshipProgressState) {
    const normalized = normalizeRelationshipProgressState(state);
    cache = normalized;
    setStoredJson(STORAGE_KEY, normalized);
    listeners.forEach((listener) => listener(normalized));
  },
  update(reducer: (state: RelationshipProgressState) => RelationshipProgressState) {
    const current = this.load();
    const next = reducer(current);
    if (next !== current) this.save(next);
    return next;
  },
  subscribe(listener: (state: RelationshipProgressState) => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  resetForDebug() {
    this.save(emptyRelationshipProgressState());
  },
  reloadFromStorageForDebug(): RelationshipProgressState {
    cache = hydrateRelationshipProgression();
    listeners.forEach((listener) => listener(cache!));
    return cache;
  },
};
