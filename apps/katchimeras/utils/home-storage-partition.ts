import type { StoredHomeState } from '@/types/home';

export type ActiveHomeEnvelope = {
  schemaVersion: 1;
  revision: number;
  state: Omit<StoredHomeState, 'archivedDays'>;
};

export type ArchiveHomeEnvelope = {
  schemaVersion: 1;
  revision: number;
  days: StoredHomeState['archivedDays'];
};

export function splitStoredHomeState(
  state: StoredHomeState,
  activeRevision: number,
  archiveRevision: number,
): { active: ActiveHomeEnvelope; archive: ArchiveHomeEnvelope } {
  const { archivedDays, ...activeState } = state;
  return {
    active: { schemaVersion: 1, revision: activeRevision, state: activeState },
    archive: { schemaVersion: 1, revision: archiveRevision, days: archivedDays },
  };
}

export function mergeStoredHomeState(
  active: ActiveHomeEnvelope | null,
  archive: ArchiveHomeEnvelope | null,
): StoredHomeState | null {
  if (active?.schemaVersion !== 1 || archive?.schemaVersion !== 1) return null;
  if (!active.state || !Array.isArray(archive.days)) return null;
  return { ...active.state, archivedDays: archive.days };
}
