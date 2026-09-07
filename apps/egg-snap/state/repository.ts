import { openDatabaseAsync } from "expo-sqlite";
import { createProfileRepository } from "./profile";
import { PROFILE_SCHEMA, sqliteProfileStorage } from "./sqlite-storage";

let database: ReturnType<typeof openDatabaseAsync> | null = null;
function db() {
  return (database ??= openDatabaseAsync("egg-snap-profile.db")
    .then(async (connection) => {
      await connection.execAsync(PROFILE_SCHEMA);
      return connection;
    })
    .catch((error) => {
      database = null;
      throw error;
    }));
}
export const repository = createProfileRepository(sqliteProfileStorage(db));
