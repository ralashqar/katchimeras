import * as SQLite from 'expo-sqlite';

import type { MergeWorldState } from '@/types/merge-world';
import { createInitialMergeWorldState, normalizeMergeWorldState } from '@/utils/merge-world/engine';

const DATABASE_NAME = 'katchimeras-merge-world.db';
const LOCAL_PROFILE_ID = 'local';

let databasePromise: ReturnType<typeof SQLite.openDatabaseAsync> | null = null;

async function database() {
  databasePromise ??= SQLite.openDatabaseAsync(DATABASE_NAME);
  const db = await databasePromise;
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

export async function saveMergeWorldState(state: MergeWorldState): Promise<void> {
  const db = await database();
  const serialized = JSON.stringify(state);
  await db.withTransactionAsync(async () => {
    const previous = await db.getFirstAsync<{ state_json: string }>(
      'SELECT state_json FROM merge_world_snapshot WHERE profile_id = ?',
      [LOCAL_PROFILE_ID],
    );
    await db.runAsync(
      `INSERT INTO merge_world_snapshot (profile_id, schema_version, revision, updated_at, state_json, backup_json)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(profile_id) DO UPDATE SET
         schema_version = excluded.schema_version,
         revision = excluded.revision,
         updated_at = excluded.updated_at,
         backup_json = merge_world_snapshot.state_json,
         state_json = excluded.state_json`,
      [LOCAL_PROFILE_ID, state.version, state.revision, state.updatedAt, serialized, previous?.state_json ?? null],
    );
    for (const receipt of state.externalRewardReceipts) {
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
}

export async function resetMergeWorldStateForDebug(): Promise<void> {
  const db = await database();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM merge_world_snapshot WHERE profile_id = ?', [LOCAL_PROFILE_ID]);
    await db.runAsync('DELETE FROM merge_world_outbox');
  });
}
