import type { Profile, ProfileStorage } from "./profile";

export const PROFILE_SCHEMA =
  "PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS egg_snap_profile (id INTEGER PRIMARY KEY CHECK(id = 1), value TEXT NOT NULL);";
export interface ProfileConnection {
  getFirstAsync<T>(sql: string): Promise<T | null>;
  runAsync(sql: string, value: string): Promise<unknown>;
}
/** One SQLite statement atomically commits progress, balance, inventory and receipt. */
export function sqliteProfileStorage(
  connection: () => Promise<ProfileConnection>,
): ProfileStorage {
  return {
    async read() {
      const row = await (
        await connection()
      ).getFirstAsync<{ value: string }>(
        "SELECT value FROM egg_snap_profile WHERE id = 1",
      );
      return row ? (JSON.parse(row.value) as Profile) : null;
    },
    async write(profile) {
      await (
        await connection()
      ).runAsync(
        "INSERT INTO egg_snap_profile(id, value) VALUES(1, ?) ON CONFLICT(id) DO UPDATE SET value = excluded.value",
        JSON.stringify(profile),
      );
    },
  };
}
