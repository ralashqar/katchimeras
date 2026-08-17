import * as SQLite from 'expo-sqlite';

import { DEV_TOOLS_ENABLED } from '@/constants/dev';
import type { PlayerProfileSnapshot } from '@/types/player-profile-snapshot';

const DATABASE_NAME = 'katchimeras-dev-profile-snapshots.db';
const ROLLBACK_ID = '__rollback__';
let databasePromise: ReturnType<typeof SQLite.openDatabaseAsync> | null = null;

function assertDevTools() {
  if (!DEV_TOOLS_ENABLED) throw new Error('Profile snapshot storage is disabled in this build.');
}

async function database() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME).then(async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS profile_snapshots (
          id TEXT PRIMARY KEY NOT NULL,
          source TEXT NOT NULL,
          name TEXT NOT NULL,
          created_at TEXT NOT NULL,
          snapshot_json TEXT NOT NULL
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

export async function listCapturedPlayerProfileSnapshots(): Promise<PlayerProfileSnapshot[]> {
  if (!DEV_TOOLS_ENABLED) return [];
  const db = await database();
  const rows = await db.getAllAsync<{ snapshot_json: string }>(
    'SELECT snapshot_json FROM profile_snapshots WHERE id <> ? ORDER BY created_at DESC',
    [ROLLBACK_ID],
  );
  return rows.flatMap((row) => {
    try { return [JSON.parse(row.snapshot_json) as PlayerProfileSnapshot]; } catch { return []; }
  });
}

export async function saveCapturedPlayerProfileSnapshot(snapshot: PlayerProfileSnapshot): Promise<void> {
  assertDevTools();
  const db = await database();
  await db.runAsync(
    `INSERT INTO profile_snapshots (id, source, name, created_at, snapshot_json)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET source = excluded.source, name = excluded.name,
       created_at = excluded.created_at, snapshot_json = excluded.snapshot_json`,
    [snapshot.id, snapshot.source, snapshot.name, snapshot.createdAt, JSON.stringify(snapshot)],
  );
}

export async function deleteCapturedPlayerProfileSnapshot(id: string): Promise<void> {
  assertDevTools();
  if (id === ROLLBACK_ID) return;
  const db = await database();
  await db.runAsync('DELETE FROM profile_snapshots WHERE id = ?', [id]);
}

export async function savePlayerProfileRollback(snapshot: PlayerProfileSnapshot): Promise<void> {
  await saveCapturedPlayerProfileSnapshot({ ...snapshot, id: ROLLBACK_ID, source: 'rollback', name: 'Before snapshot load' });
}

export async function loadPlayerProfileRollback(): Promise<PlayerProfileSnapshot | null> {
  if (!DEV_TOOLS_ENABLED) return null;
  const db = await database();
  const row = await db.getFirstAsync<{ snapshot_json: string }>('SELECT snapshot_json FROM profile_snapshots WHERE id = ?', [ROLLBACK_ID]);
  if (!row) return null;
  try { return JSON.parse(row.snapshot_json) as PlayerProfileSnapshot; } catch { return null; }
}

export async function clearPlayerProfileRollback(): Promise<void> {
  assertDevTools();
  const db = await database();
  await db.runAsync('DELETE FROM profile_snapshots WHERE id = ?', [ROLLBACK_ID]);
}
