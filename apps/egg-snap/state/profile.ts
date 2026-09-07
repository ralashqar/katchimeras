import { COLLECTION, getDuel, getRegion } from "../data/campaign";
import type { DuelResult } from "../game/types";

export type Profile = {
  version: 1;
  preferences?: { sound: boolean; haptics: boolean };
  coins: number;
  completed: string[];
  regions: string[];
  skins: string[];
  wisps: string[];
  skin: string;
  wisp: string | null;
  seen: string[];
  receipts: Record<string, DuelResult>;
  pendingResult: DuelResult | null;
};
export const freshProfile = (): Profile => ({
  version: 1,
  coins: 0,
  completed: [],
  regions: ["glade"],
  skins: ["classic"],
  wisps: [],
  skin: "classic",
  wisp: null,
  seen: [],
  receipts: {},
  pendingResult: null,
});
export function canPlay(p: Profile, levelId: string) {
  const d = getDuel(levelId);
  const r = getRegion(d.regionId);
  const index = r.levels.indexOf(levelId);
  return (
    p.regions.includes(r.id) &&
    (index === 0 || p.completed.includes(r.levels[index - 1]))
  );
}
export function grantResult(p: Profile, result: DuelResult): Profile {
  if (p.receipts[result.attemptId]) return p;
  if (result.practice) return { ...p, pendingResult: { ...result, coins: 0 } };
  if (!canPlay(p, result.levelId)) throw new Error("This duel is locked");
  const duel = getDuel(result.levelId);
  const first = !p.completed.includes(duel.id);
  const coins = result.won ? (first ? duel.reward : 20) : 0;
  const receipt = { ...result, coins };
  return {
    ...p,
    coins: p.coins + coins,
    completed: result.won && first ? [...p.completed, duel.id] : p.completed,
    skins:
      result.won && duel.boss && !p.skins.includes("starglow")
        ? [...p.skins, "starglow"]
        : p.skins,
    receipts: { ...p.receipts, [result.attemptId]: receipt },
    pendingResult: receipt,
  };
}
export function purchase(p: Profile, id: string): Profile {
  const item = COLLECTION.find((i) => i.id === id);
  if (item) {
    const list = item.kind === "skin" ? p.skins : p.wisps;
    if (list.includes(id)) return p;
    if (!p.completed.includes(item.discovery))
      throw new Error("Discover this in the campaign first");
    if (p.coins < item.price)
      throw new Error("Not enough coins. Replay a duel to earn more.");
    return {
      ...p,
      coins: p.coins - item.price,
      [item.kind === "skin" ? "skins" : "wisps"]: [...list, id],
    };
  }
  const r = getRegion(id);
  if (p.regions.includes(id)) return p;
  if (r.prerequisite && !p.completed.includes(r.prerequisite))
    throw new Error("Defeat the keeper first");
  if (p.coins < r.price)
    throw new Error("Not enough coins. Replay a duel to earn more.");
  return { ...p, coins: p.coins - r.price, regions: [...p.regions, id] };
}
export function equip(
  p: Profile,
  kind: "skin" | "wisp",
  id: string | null,
): Profile {
  if (kind === "skin" && (!id || !p.skins.includes(id)))
    throw new Error("Skin not owned");
  if (kind === "wisp" && id && !p.wisps.includes(id))
    throw new Error("Wisp not owned");
  return kind === "skin" ? { ...p, skin: id! } : { ...p, wisp: id };
}

export interface ProfileStorage {
  read(): Promise<Profile | null>;
  write(profile: Profile): Promise<void>;
}
/** One serial service owns all profile changes; a single durable write includes every reward receipt. */
export function createProfileRepository(storage: ProfileStorage) {
  let queue: Promise<unknown> = Promise.resolve();
  const update = (change: (p: Profile) => Profile) => {
    const work = queue.then(async () => {
      const p = (await storage.read()) ?? freshProfile();
      if (p.version !== 1) throw new Error("Unsupported save version");
      const next = change(p);
      if (next !== p) await storage.write(next);
      return next;
    });
    queue = work.catch(() => {});
    return work;
  };
  return {
    load: () => update((p) => p),
    update,
    preferences: (preferences: Partial<{ sound: boolean; haptics: boolean }>) =>
      update((p) => ({ ...p, preferences: { sound: true, haptics: true, ...p.preferences, ...preferences } })),
    result: (r: DuelResult) => update((p) => grantResult(p, r)),
    purchase: (id: string) => update((p) => purchase(p, id)),
    equip: (kind: "skin" | "wisp", id: string | null) =>
      update((p) => equip(p, kind, id)),
    seen: (id: string) =>
      update((p) =>
        p.seen.includes(id) ? p : { ...p, seen: [...p.seen, id] },
      ),
    dismissResult: () => update((p) => ({ ...p, pendingResult: null })),
  };
}
