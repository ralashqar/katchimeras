import { harmonyDefinition } from './local-catalog';
import type { GameplayEvent } from '@/types/gameplay-event';
import type { HarmonyState, LiveEventDefinition, LiveEventProgress } from '@/types/live-ops';
import { applyHarmonyEvent, emptyHarmony, emptyEventProgress, scoreGameplayEvent } from './rules';

/** Minimal SQLite interface keeps journal transactions testable without native modules. */
type JournalDatabase = Pick<import('expo-sqlite').SQLiteDatabase, 'runAsync' | 'getFirstAsync'>;

export const GAMEPLAY_JOURNAL_SCHEMA = `
  CREATE TABLE IF NOT EXISTS gameplay_events (
    event_id TEXT PRIMARY KEY NOT NULL,
    payload_json TEXT NOT NULL,
    occurred_at INTEGER NOT NULL,
    acknowledged_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS gameplay_projections (
    projection_id TEXT PRIMARY KEY NOT NULL,
    payload_json TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS gameplay_events_pending ON gameplay_events(acknowledged_at, occurred_at);
`;

/** Called inside the same transaction as the source snapshot, never independently. */
export async function appendGameplayEvents(db: JournalDatabase, events: readonly GameplayEvent[], definitions: readonly LiveEventDefinition[] = []): Promise<void> {
  if (!events.length) return;
  const row = await db.getFirstAsync<{ payload_json: string }>('SELECT payload_json FROM gameplay_projections WHERE projection_id = ?', ['harmony:v1']);
  let harmony: HarmonyState = row ? JSON.parse(row.payload_json) : emptyHarmony();
  for (const event of events) {
    const inserted = await db.runAsync('INSERT OR IGNORE INTO gameplay_events (event_id, payload_json, occurred_at) VALUES (?, ?, ?)', [event.id, JSON.stringify(event), event.occurredAt]);
    if (!inserted.changes) continue;
    harmony = applyHarmonyEvent(harmony, event, harmonyDefinition());
    for (const definition of definitions) {
      if (definition.authority === 'local' || !definition.enabled || harmony.points < definition.minHarmony) continue;
      const key = `event:${definition.id}`;
      const stored = await db.getFirstAsync<{ payload_json: string }>('SELECT payload_json FROM gameplay_projections WHERE projection_id = ?', [key]);
      const progress: LiveEventProgress = stored ? JSON.parse(stored.payload_json) : emptyEventProgress(definition);
      const next = scoreGameplayEvent(progress, definition, event);
      if (next === progress) continue;
      await db.runAsync('INSERT INTO gameplay_projections (projection_id, payload_json) VALUES (?, ?) ON CONFLICT(projection_id) DO UPDATE SET payload_json = excluded.payload_json', [key, JSON.stringify(next)]);
    }
  }
  await db.runAsync('INSERT INTO gameplay_projections (projection_id, payload_json) VALUES (?, ?) ON CONFLICT(projection_id) DO UPDATE SET payload_json = excluded.payload_json', ['harmony:v1', JSON.stringify(harmony)]);
}
