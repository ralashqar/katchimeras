import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createProfileRepository,
  freshProfile,
  grantResult,
  purchase,
  canPlay,
  type Profile,
} from "../state/profile";
import { DUELS } from "../data/campaign";
const win = (id: string, attemptId = id) => ({
  attemptId,
  levelId: id,
  won: true,
  accuracy: 1,
  bestStreak: 10,
  durationMs: 45000,
  coins: 999999,
  practice: false,
});
test("whole campaign funds both cosmetics and next region, and replay rewards remain available", () => {
  let p = freshProfile();
  assert.throws(() => purchase(p, "cheerlet"));
  assert.throws(() => grantResult(p, win("glade-6")));
  for (const d of DUELS.slice(0, 6)) {
    assert.ok(canPlay(p, d.id));
    p = grantResult(p, win(d.id));
  }
  assert.equal(p.coins, 300);
  assert.ok(p.skins.includes("starglow"));
  p = purchase(p, "moss");
  p = purchase(p, "glow-wisp");
  p = purchase(p, "cheerlet");
  assert.equal(p.coins, 0);
  assert.ok(canPlay(p, "cheerlet-1"));
  p = grantResult(p, win("glade-1", "replay"));
  assert.equal(p.coins, 20);
  assert.equal(grantResult(p, win("glade-1", "replay")), p);
});
test("serialized concurrent grants and purchases survive recreation without duplicates", async () => {
  let durable: Profile | null = null;
  const storage = {
    read: async () => structuredClone(durable),
    write: async (p: Profile) => {
      durable = structuredClone(p);
    },
  };
  const repo = createProfileRepository(storage);
  await Promise.all([repo.result(win("glade-1")), repo.result(win("glade-1"))]);
  await repo.result(win("glade-2"));
  await Promise.all([repo.purchase("moss"), repo.purchase("moss")]);
  const restored = await createProfileRepository(storage).load();
  assert.equal(restored.coins, 20);
  assert.equal(restored.skins.filter((id) => id === "moss").length, 1);
  assert.equal(restored.pendingResult?.levelId, "glade-2");
});
test("failed persistence retries do not lose or duplicate results", async () => {
  let durable: Profile | null = null;
  let fail = true;
  const repo = createProfileRepository({
    read: async () => durable,
    write: async (p) => {
      if (fail) throw new Error("disk full");
      durable = p;
    },
  });
  await assert.rejects(repo.result(win("glade-1")));
  fail = false;
  await repo.result(win("glade-1"));
  assert.equal((await repo.load()).coins, 40);
});
test("loss, practice, and duplicate purchases cannot generate coins", () => {
  let p = freshProfile();
  p = grantResult(p, { ...win("glade-1"), won: false });
  assert.equal(p.coins, 0);
  assert.deepEqual(p.completed, []);
  p = grantResult(p, { ...win("practice"), practice: true });
  assert.equal(p.coins, 0);
  assert.throws(() => purchase(p, "moss"));
});


test("independent sound and haptic preferences survive relaunch and old saves", async () => {
  let saved = freshProfile();
  const storage = { read: async () => structuredClone(saved), write: async (p: Profile) => { saved = structuredClone(p); } };
  const repo = createProfileRepository(storage);
  assert.equal((await repo.load()).preferences, undefined);
  await repo.preferences({ sound: false });
  assert.deepEqual((await repo.load()).preferences, { sound: false, haptics: true });
  await repo.preferences({ haptics: false });
  await repo.preferences({ sound: true });
  assert.deepEqual((await createProfileRepository(storage).load()).preferences, { sound: true, haptics: false });
});
