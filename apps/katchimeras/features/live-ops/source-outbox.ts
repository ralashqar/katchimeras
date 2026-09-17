import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import type { GameplayEvent } from '@/types/gameplay-event';

const SOURCES = ['katchadeck.companion-bond-v1', 'katchimera.wisps.v2', 'katchimeras.relationship-progression-v2'] as const;
const listeners = new Set<() => void>();
export function subscribeGameplayOutbox(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
type Envelope = Record<string, unknown> & { liveOpsOutbox?: GameplayEvent[]; liveOpsBaselined?: boolean };

/** Stable source facts, containing no journal answers, photos or other private content. */
export function sourceGameplayFacts(key: string, value: Record<string, unknown>): GameplayEvent[] {
  const result: GameplayEvent[] = [];
  const add = (kind: GameplayEvent['kind'], id: string, at: number, quantity: number, companionId?: string) => {
    if (!Number.isFinite(at) || !Number.isSafeInteger(quantity) || quantity < 1) return;
    result.push({ version: 1, id: `${kind}:${id}`, kind, source: kind === 'wisp_discovered' ? 'collection' : 'relationship', sourceRevision: 1, contentRevision: 0, occurredAt: at, quantity, context: { targetId: id, companionId } });
  };
  if (key === SOURCES[0]) for (const e of (value.events ?? []) as { id: string; occurredAt: number; points: number; creatureId: string }[]) add('bond_gained', e.id, e.occurredAt, e.points, e.creatureId.replace(/^companion[-:]/, ''));
  if (key === SOURCES[1]) for (const [id, w] of Object.entries((value.unlocked ?? {}) as Record<string, { unlockedAt: number }>)) add('wisp_discovered', id, w.unlockedAt, 1);
  if (key === SOURCES[2]) for (const [id, j] of Object.entries((value.journeyEpisodes ?? {}) as Record<string, { completedAt: number; familyId: string; migrated?: boolean }>)) {
    add('journey_completed', id, j.completedAt, 1, j.familyId);
    if (j.migrated && result.at(-1)) result.at(-1)!.historical = true;
  }
  return result;
}

/** Source snapshot and its outbox land in the same synchronous SQLite KV write. */
export function saveWithGameplayOutbox(key: string, value: object): void {
  const previous = getStoredJson<Envelope>(key, {});
  const old = sourceGameplayFacts(key, previous);
  const ids = new Set(old.map(e => e.id));
  const pending = new Map((previous.liveOpsOutbox ?? []).map(e => [e.id, e]));
  if (!previous.liveOpsBaselined) for (const e of old) pending.set(e.id, { ...e, historical: true });
  for (const e of sourceGameplayFacts(key, value as Record<string, unknown>)) if (!ids.has(e.id)) pending.set(e.id, e);
  setStoredJson(key, { ...value, liveOpsBaselined: true, liveOpsOutbox: [...pending.values()] });
  if (pending.size) queueMicrotask(() => listeners.forEach(listener => listener()));
}

let draining: Promise<void> | null = null;
export function drainGameplaySourceOutboxes(deliver: (events: GameplayEvent[]) => Promise<unknown>): Promise<void> {
  if (draining) return draining;
  draining = (async () => {
    for (const key of SOURCES) {
      let source = getStoredJson<Envelope>(key, {});
      if (!Object.keys(source).length) continue;
      if (!source.liveOpsBaselined) {
        saveWithGameplayOutbox(key, source);
        source = getStoredJson<Envelope>(key, {});
      }
      const events = source.liveOpsOutbox ?? [];
      if (!events.length) continue;
      await deliver(events);
      // A source may have changed during the await; acknowledge only this batch.
      const current = getStoredJson<Envelope>(key, {});
      const ids = new Set(events.map(e => e.id));
      setStoredJson(key, { ...current, liveOpsOutbox: (current.liveOpsOutbox ?? []).filter(e => !ids.has(e.id)) });
    }
  })().finally(() => { draining = null; });
  return draining;
}
