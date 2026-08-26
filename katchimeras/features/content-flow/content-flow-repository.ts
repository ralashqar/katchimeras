import * as SQLite from 'expo-sqlite';

import type { ContentFlowEvent, ContentFlowRun } from '@/types/content-flow';

const DATABASE_NAME = 'katchimeras-content-flow.db';
let databasePromise: ReturnType<typeof SQLite.openDatabaseAsync> | null = null;
let writeQueue: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();

function normalizeRun(run: ContentFlowRun): ContentFlowRun {
  return { ...run, revision: Number.isInteger(run.revision) ? run.revision : 0 };
}

function serialized<T>(work: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(work, work);
  writeQueue = result.then(() => undefined, () => undefined);
  return result;
}

async function database() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME).then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS content_flow_runs (
          run_id TEXT PRIMARY KEY NOT NULL,
          definition_id TEXT NOT NULL,
          definition_version INTEGER NOT NULL,
          parent_run_id TEXT,
          status TEXT NOT NULL,
          node_id TEXT NOT NULL,
          phase TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          run_json TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS content_flow_runs_active
          ON content_flow_runs(status, parent_run_id, updated_at);
        CREATE TABLE IF NOT EXISTS content_flow_events (
          event_id TEXT PRIMARY KEY NOT NULL,
          run_id TEXT NOT NULL,
          node_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          occurred_at INTEGER NOT NULL,
          event_json TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS content_flow_events_run
          ON content_flow_events(run_id, occurred_at);
        CREATE TABLE IF NOT EXISTS content_flow_effect_receipts (
          effect_key TEXT PRIMARY KEY NOT NULL,
          run_id TEXT NOT NULL,
          node_id TEXT NOT NULL,
          completed_at INTEGER NOT NULL,
          result_json TEXT
        );
        CREATE TABLE IF NOT EXISTS content_flow_presentations (
          presentation_key TEXT PRIMARY KEY NOT NULL,
          run_id TEXT NOT NULL,
          node_id TEXT NOT NULL,
          status TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          payload_json TEXT NOT NULL
        );
      `);
      return db;
    }).catch((error) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

export async function loadContentFlowRun(runId: string): Promise<ContentFlowRun | null> {
  const db = await database();
  const row = await db.getFirstAsync<{ run_json: string }>('SELECT run_json FROM content_flow_runs WHERE run_id = ?', [runId]);
  if (!row) return null;
  try { return normalizeRun(JSON.parse(row.run_json) as ContentFlowRun); } catch { return null; }
}

export async function listContentFlowRuns(options: { activeOnly?: boolean } = {}): Promise<ContentFlowRun[]> {
  const db = await database();
  const rows = await db.getAllAsync<{ run_json: string }>(
    options.activeOnly
      ? `SELECT run_json FROM content_flow_runs WHERE status = 'active' ORDER BY updated_at DESC`
      : 'SELECT run_json FROM content_flow_runs ORDER BY updated_at DESC',
  );
  return rows.flatMap((row) => {
    try { return [normalizeRun(JSON.parse(row.run_json) as ContentFlowRun)]; } catch { return []; }
  });
}

async function writeRun(db: Awaited<ReturnType<typeof database>>, run: ContentFlowRun) {
  await db.runAsync(
    `INSERT INTO content_flow_runs (run_id, definition_id, definition_version, parent_run_id, status, node_id, phase, updated_at, run_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(run_id) DO UPDATE SET
       definition_id = excluded.definition_id,
       definition_version = excluded.definition_version,
       parent_run_id = excluded.parent_run_id,
       status = excluded.status,
       node_id = excluded.node_id,
       phase = excluded.phase,
       updated_at = excluded.updated_at,
       run_json = excluded.run_json`,
    [run.runId, run.definitionId, run.definitionVersion, run.parentRunId, run.status, run.nodeId, run.phase, run.updatedAt, JSON.stringify(run)],
  );
  for (const [effectKey, receipt] of Object.entries(run.effectReceipts)) {
    const marker = ':effect:';
    const markerIndex = effectKey.indexOf(marker);
    const nodeId = markerIndex < 0 ? run.nodeId : effectKey.slice(run.runId.length + 1, markerIndex);
    await db.runAsync(
      `INSERT OR IGNORE INTO content_flow_effect_receipts (effect_key, run_id, node_id, completed_at, result_json)
       VALUES (?, ?, ?, ?, ?)`,
      [effectKey, run.runId, nodeId, receipt.completedAt, receipt.result === undefined ? null : JSON.stringify(receipt.result)],
    );
  }
}

export async function saveContentFlowTransition(run: ContentFlowRun, event?: ContentFlowEvent): Promise<void> {
  await serialized(async () => {
    const db = await database();
    await db.withTransactionAsync(async () => {
      if (event) {
        await db.runAsync(
          `INSERT OR IGNORE INTO content_flow_events (event_id, run_id, node_id, event_type, occurred_at, event_json)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [event.eventId, event.runId, event.nodeId, event.type, event.occurredAt, JSON.stringify(event)],
        );
      }
      await writeRun(db, normalizeRun(run));
    });
  });
  listeners.forEach((listener) => listener());
}

/**
 * Reads, reduces and persists one command inside the same serialized SQLite
 * transaction. Callers cannot overwrite a newer cursor with a stale snapshot.
 */
export async function reduceContentFlowRunAtomically(input: {
  runId: string;
  event?: ContentFlowEvent;
  reduce: (current: ContentFlowRun) => ContentFlowRun;
}): Promise<{ run: ContentFlowRun | null; eventRecorded: boolean }> {
  const result = await serialized(async () => {
    const db = await database();
    let output: { run: ContentFlowRun | null; eventRecorded: boolean } = { run: null, eventRecorded: false };
    await db.withTransactionAsync(async () => {
      const row = await db.getFirstAsync<{ run_json: string }>('SELECT run_json FROM content_flow_runs WHERE run_id = ?', [input.runId]);
      if (!row) return;
      let current: ContentFlowRun;
      try { current = normalizeRun(JSON.parse(row.run_json) as ContentFlowRun); } catch { return; }
      if (input.event) {
        const duplicate = await db.getFirstAsync('SELECT event_id FROM content_flow_events WHERE event_id = ?', [input.event.eventId]);
        if (duplicate) {
          output = { run: current, eventRecorded: false };
          return;
        }
        await db.runAsync(
          `INSERT INTO content_flow_events (event_id, run_id, node_id, event_type, occurred_at, event_json)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [input.event.eventId, input.event.runId, input.event.nodeId, input.event.type, input.event.occurredAt, JSON.stringify(input.event)],
        );
      }
      const reduced = normalizeRun(input.reduce(current));
      const next = { ...reduced, revision: current.revision + 1 };
      await writeRun(db, next);
      output = { run: next, eventRecorded: Boolean(input.event) };
    });
    return output;
  });
  if (result.run) listeners.forEach((listener) => listener());
  return result;
}

export async function contentFlowEventWasRecorded(eventId: string): Promise<boolean> {
  const db = await database();
  return Boolean(await db.getFirstAsync('SELECT event_id FROM content_flow_events WHERE event_id = ?', [eventId]));
}

export async function resetContentFlowJournalForDebug(): Promise<void> {
  await serialized(async () => {
    const db = await database();
    await db.withTransactionAsync(async () => {
      await db.execAsync('DELETE FROM content_flow_presentations; DELETE FROM content_flow_effect_receipts; DELETE FROM content_flow_events; DELETE FROM content_flow_runs;');
    });
  });
  listeners.forEach((listener) => listener());
}

export async function deleteContentFlowRunsForDebug(runIds: readonly string[]): Promise<void> {
  const unique = [...new Set(runIds)].filter(Boolean);
  if (!unique.length) return;
  await serialized(async () => {
    const db = await database();
    await db.withTransactionAsync(async () => {
      for (const runId of unique) {
        await db.runAsync('DELETE FROM content_flow_presentations WHERE run_id = ?', [runId]);
        await db.runAsync('DELETE FROM content_flow_effect_receipts WHERE run_id = ?', [runId]);
        await db.runAsync('DELETE FROM content_flow_events WHERE run_id = ?', [runId]);
        await db.runAsync('DELETE FROM content_flow_runs WHERE run_id = ?', [runId]);
      }
    });
  });
  listeners.forEach((listener) => listener());
}

export async function deleteContentFlowRunsForDayForDebug(dayId: string): Promise<void> {
  const runs = await listContentFlowRuns();
  await deleteContentFlowRunsForDebug(runs.filter((run) => run.variables.dayId === dayId).map((run) => run.runId));
}

export async function captureContentFlowJournal(): Promise<{ schemaVersion: 1; runs: ContentFlowRun[] }> {
  return { schemaVersion: 1, runs: await listContentFlowRuns() };
}

export async function installContentFlowJournalForDebug(input: { schemaVersion: 1; runs: readonly ContentFlowRun[] }): Promise<void> {
  await resetContentFlowJournalForDebug();
  for (const run of input.runs) await saveContentFlowTransition(run);
}

export function subscribeContentFlowJournal(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export async function flushContentFlowJournal() {
  await writeQueue;
}
