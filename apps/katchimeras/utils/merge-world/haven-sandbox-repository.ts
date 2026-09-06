import * as SQLite from 'expo-sqlite';

import type { MergeWorldState } from '@/types/merge-world';
import {
  createHavenMergeSandboxState,
  normalizeHavenMergeSandboxState,
} from '@/utils/merge-world/haven-sandbox';

const DATABASE_NAME = 'katchimeras-haven-merge-sandbox.db';
const PROFILE_ID = 'haven-merge-sandbox-v1';

let databasePromise: ReturnType<typeof SQLite.openDatabaseAsync> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function database() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME).then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS haven_merge_sandbox (
          profile_id TEXT PRIMARY KEY NOT NULL,
          schema_version INTEGER NOT NULL,
          revision INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          state_json TEXT NOT NULL,
          backup_json TEXT
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

function serializeWrite(task: () => Promise<void>): Promise<void> {
  const result = writeQueue.then(task, task);
  writeQueue = result.catch(() => undefined);
  return result;
}

export async function loadHavenMergeSandboxState(now = Date.now()): Promise<MergeWorldState> {
  const db = await database();
  const row = await db.getFirstAsync<{ backup_json: string | null; state_json: string }>(
    'SELECT state_json, backup_json FROM haven_merge_sandbox WHERE profile_id = ?',
    [PROFILE_ID],
  );
  if (!row) return createHavenMergeSandboxState(now);
  try {
    return normalizeHavenMergeSandboxState(JSON.parse(row.state_json), now);
  } catch {
    if (row.backup_json) {
      try {
        return normalizeHavenMergeSandboxState(JSON.parse(row.backup_json), now);
      } catch {
        // Fall through to the repeatable starter board.
      }
    }
    return createHavenMergeSandboxState(now);
  }
}

export function saveHavenMergeSandboxState(state: MergeWorldState): Promise<void> {
  const serialized = JSON.stringify(state);
  return serializeWrite(async () => {
    const db = await database();
    await db.runAsync(
      `INSERT INTO haven_merge_sandbox (profile_id, schema_version, revision, updated_at, state_json, backup_json)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(profile_id) DO UPDATE SET
         schema_version = excluded.schema_version,
         revision = excluded.revision,
         updated_at = excluded.updated_at,
         backup_json = haven_merge_sandbox.state_json,
         state_json = excluded.state_json`,
      [PROFILE_ID, state.version, state.revision, state.updatedAt, serialized, null],
    );
  });
}

export function resetHavenMergeSandboxState(now = Date.now()): Promise<void> {
  return serializeWrite(async () => {
    const db = await database();
    await db.runAsync('DELETE FROM haven_merge_sandbox WHERE profile_id = ?', [PROFILE_ID]);
    const fresh = createHavenMergeSandboxState(now);
    await db.runAsync(
      `INSERT INTO haven_merge_sandbox (profile_id, schema_version, revision, updated_at, state_json, backup_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [PROFILE_ID, fresh.version, fresh.revision, fresh.updatedAt, JSON.stringify(fresh), null],
    );
  });
}
