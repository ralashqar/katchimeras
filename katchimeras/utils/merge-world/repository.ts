import * as SQLite from 'expo-sqlite';

import type { MergeWorldState } from '@/types/merge-world';
import { createInitialMergeWorldState, normalizeMergeWorldState, resetMergeActivityForDay } from '@/utils/merge-world/engine';

const DATABASE_NAME = 'katchimeras-merge-world.db';
const LOCAL_PROFILE_ID = 'local';

let databasePromise: ReturnType<typeof SQLite.openDatabaseAsync> | null = null;
let resetGeneration = 0;
let resetInProgress = false;
let writeQueue: Promise<void> = Promise.resolve();
const resetListeners = new Set<(state: MergeWorldState) => void>();
const snapshotListeners = new Set<(state: MergeWorldState) => void>();

function publishSnapshot(state: MergeWorldState) {
  snapshotListeners.forEach((listener) => listener(state));
}

function serializeWrite<T>(task: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(task, task);
  writeQueue = result.then(() => undefined, () => undefined);
  return result;
}

async function database() {
  if (!databasePromise) {
    const opening = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS merge_world_snapshot (
          profile_id TEXT PRIMARY KEY NOT NULL,
          schema_version INTEGER NOT NULL,
          revision INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          state_json TEXT NOT NULL,
          backup_json TEXT
        );
        CREATE TABLE IF NOT EXISTS merge_world_outbox (
          receipt_id TEXT PRIMARY KEY NOT NULL,
          receipt_kind TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          payload_json TEXT NOT NULL,
          synced_at INTEGER
        );
      `);
      return db;
    })();
    databasePromise = opening.catch((caught) => {
      databasePromise = null;
      throw caught;
    });
  }
  return databasePromise;
}

export async function loadMergeWorldState(now = Date.now()): Promise<MergeWorldState> {
  const db = await database();
  const row = await db.getFirstAsync<{ state_json: string; backup_json: string | null }>(
    'SELECT state_json, backup_json FROM merge_world_snapshot WHERE profile_id = ?',
    [LOCAL_PROFILE_ID],
  );
  if (!row) return createInitialMergeWorldState(now);
  try {
    return normalizeMergeWorldState(JSON.parse(row.state_json), now);
  } catch {
    if (row.backup_json) {
      try {
        return normalizeMergeWorldState(JSON.parse(row.backup_json), now);
      } catch {
        // Fall through to a recoverable new world.
      }
    }
    return createInitialMergeWorldState(now);
  }
}

export async function saveMergeWorldState(state: MergeWorldState, receiptIds?: readonly string[]): Promise<void> {
  // Companion/story resets notify their subscribers asynchronously. Do not
  // allow a subscriber holding the pre-reset board to queue it behind the
  // destructive reset and restore generators after the database is cleared.
  if (resetInProgress) return;
  const generation = resetGeneration;
  const serialized = JSON.stringify(state);
  const selectedReceipts = receiptIds == null
    ? state.externalRewardReceipts
    : state.externalRewardReceipts.filter((receipt) => receiptIds.includes(receipt.id));

  await serializeWrite(async () => {
    if (generation !== resetGeneration) return;
    if (resetInProgress) return;
    const db = await database();
    if (generation !== resetGeneration) return;
    if (resetInProgress) return;
    await db.withTransactionAsync(async () => {
      if (generation !== resetGeneration) return;
      if (resetInProgress) return;
      await db.runAsync(
        `INSERT INTO merge_world_snapshot (profile_id, schema_version, revision, updated_at, state_json, backup_json)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(profile_id) DO UPDATE SET
           schema_version = excluded.schema_version,
           revision = excluded.revision,
           updated_at = excluded.updated_at,
           backup_json = merge_world_snapshot.state_json,
           state_json = excluded.state_json`,
        [LOCAL_PROFILE_ID, state.version, state.revision, state.updatedAt, serialized, null],
      );
      for (const receipt of selectedReceipts) {
        await db.runAsync(
          `INSERT OR IGNORE INTO merge_world_outbox (receipt_id, receipt_kind, created_at, payload_json, synced_at)
           VALUES (?, ?, ?, ?, ?)`,
          [receipt.id, receipt.kind, receipt.createdAt, JSON.stringify(receipt), receipt.appliedAt],
        );
        if (receipt.appliedAt != null) {
          await db.runAsync('UPDATE merge_world_outbox SET synced_at = ? WHERE receipt_id = ?', [receipt.appliedAt, receipt.id]);
        }
      }
    });
  });
  if (generation === resetGeneration && !resetInProgress) publishSnapshot(state);
}

export async function resetMergeWorldStateForDebug(now = Date.now()): Promise<void> {
  resetGeneration += 1;
  resetInProgress = true;
  try {
    await serializeWrite(async () => {
      const db = await database();
      await db.withTransactionAsync(async () => {
        await db.runAsync('DELETE FROM merge_world_snapshot WHERE profile_id = ?', [LOCAL_PROFILE_ID]);
        await db.runAsync('DELETE FROM merge_world_outbox');
      });
    });
    const freshState = createInitialMergeWorldState(now);
    resetListeners.forEach((listener) => listener(freshState));
    publishSnapshot(freshState);
  } finally {
    resetInProgress = false;
  }
}

/** Makes one day eligible for real-life Merge Energy without resetting board progress. */
export async function resetMergeWorldActivityForDayForDebug(dayId: string, now = Date.now()): Promise<void> {
  // Preserve a board command that was queued immediately before Reset Today.
  // Once drained, resetInProgress rejects any stale writes until the scoped
  // snapshot and its mounted-provider notification are complete.
  await serializeWrite(async () => undefined);
  resetGeneration += 1;
  resetInProgress = true;
  let resetState: MergeWorldState | null = null;
  try {
    await serializeWrite(async () => {
      const db = await database();
      const row = await db.getFirstAsync<{ state_json: string; backup_json: string | null }>(
        'SELECT state_json, backup_json FROM merge_world_snapshot WHERE profile_id = ?',
        [LOCAL_PROFILE_ID],
      );
      let current = createInitialMergeWorldState(now);
      if (row) {
        try {
          current = normalizeMergeWorldState(JSON.parse(row.state_json), now);
        } catch {
          if (row.backup_json) {
            try {
              current = normalizeMergeWorldState(JSON.parse(row.backup_json), now);
            } catch {
              // Keep the recoverable new world.
            }
          }
        }
      }
      resetState = resetMergeActivityForDay(current, dayId, now);
      await db.runAsync(
        `INSERT INTO merge_world_snapshot (profile_id, schema_version, revision, updated_at, state_json, backup_json)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(profile_id) DO UPDATE SET
           schema_version = excluded.schema_version,
           revision = excluded.revision,
           updated_at = excluded.updated_at,
           backup_json = merge_world_snapshot.state_json,
           state_json = excluded.state_json`,
        [LOCAL_PROFILE_ID, resetState.version, resetState.revision, resetState.updatedAt, JSON.stringify(resetState), null],
      );
    });
  } finally {
    resetInProgress = false;
  }
  if (resetState) resetListeners.forEach((listener) => listener(resetState!));
  if (resetState) publishSnapshot(resetState);
}

export function subscribeMergeWorldResets(listener: (state: MergeWorldState) => void): () => void {
  resetListeners.add(listener);
  return () => resetListeners.delete(listener);
}

export function subscribeMergeWorldSnapshots(listener: (state: MergeWorldState) => void): () => void {
  snapshotListeners.add(listener);
  return () => snapshotListeners.delete(listener);
}
