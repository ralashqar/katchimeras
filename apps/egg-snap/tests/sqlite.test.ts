import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DUELS } from "../data/campaign";
import { createProfileRepository } from "../state/profile";
import { PROFILE_SCHEMA, sqliteProfileStorage } from "../state/sqlite-storage";
import type { DuelResult } from "../game/types";

test("SQLite commits the campaign, purchases and receipts together and recovers after reopen", async () => {
  const directory = mkdtempSync(join(tmpdir(), "egg-snap-sqlite-"));
  const filename = join(directory, "profile.db");
  let connection = new DatabaseSync(filename);
  const open = () => {
    connection.exec(PROFILE_SCHEMA);
    return createProfileRepository(
      sqliteProfileStorage(async () => ({
        async getFirstAsync<T>(sql: string) {
          return (connection.prepare(sql).get() ?? null) as T | null;
        },
        async runAsync(sql: string, value: string) {
          return connection.prepare(sql).run(value);
        },
      })),
    );
  };
  try {
    let repository = open();
    const result = (levelId: string): DuelResult => ({
      attemptId: levelId,
      levelId,
      won: true,
      accuracy: 1,
      bestStreak: 12,
      durationMs: 40000,
      coins: 999,
      practice: false,
    });
    for (const duel of DUELS.slice(0, 6))
      await repository.result(result(duel.id));
    await repository.purchase("moss");
    await repository.purchase("glow-wisp");
    await repository.purchase("cheerlet");
    await repository.equip("skin", "moss");
    await repository.equip("wisp", "glow-wisp");
    connection.close();
    connection = new DatabaseSync(filename);
    repository = open();
    const recovered = await repository.load();
    assert.equal(recovered.coins, 0);
    assert.equal(recovered.completed.length, 6);
    assert.equal(recovered.skin, "moss");
    assert.equal(recovered.wisp, "glow-wisp");
    assert.ok(recovered.skins.includes("starglow"));
    assert.ok(recovered.regions.includes("cheerlet"));
    assert.equal(recovered.pendingResult?.attemptId, "glade-6");
    assert.equal((await repository.result(result("glade-6"))).coins, 0);
    assert.equal((await repository.result(result("cheerlet-1"))).coins, 40);
  } finally {
    connection.close();
    rmSync(filename, { force: true });
  }
});
