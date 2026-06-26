import type { DiscoveryDef, DiscoveryRecord } from '@/types/discoveries';

// World artefacts — the permanent monuments unlocked discoveries leave around your
// world. Each worldRewardId maps to bespoke isometric diorama art (generated via the
// katchimera-assets skill). See discoveries-system-design §6.

export type WorldArtefact = { rewardId: string; name: string; assetKey: string };
export type PlacedArtefact = WorldArtefact & { col: number; row: number };

// rewardId → artefact. assetKey must exist in utils/world-visuals.ts.
export const ARTEFACT_DEFS: Record<string, WorldArtefact> = {
  artefact_museum_banner: { rewardId: 'artefact_museum_banner', name: 'Museum Banner', assetKey: 'artefact_museum_banner' },
  artefact_voice_crystal: { rewardId: 'artefact_voice_crystal', name: 'Voice Crystal', assetKey: 'artefact_voice_crystal' },
  artefact_festival_tree: { rewardId: 'artefact_festival_tree', name: 'Festival Tree', assetKey: 'artefact_festival_tree' },
  artefact_golden_arch: { rewardId: 'artefact_golden_arch', name: 'Golden Arch', assetKey: 'artefact_golden_arch' },
  artefact_life_monument: { rewardId: 'artefact_life_monument', name: 'Life Monument', assetKey: 'artefact_life_monument' },
  artefact_journey_monument: { rewardId: 'artefact_journey_monument', name: 'Journey Monument', assetKey: 'artefact_journey_monument' },
  artefact_trail_bridge: { rewardId: 'artefact_trail_bridge', name: 'Trail Bridge', assetKey: 'artefact_trail_bridge' },
  artefact_memory_lantern: { rewardId: 'artefact_memory_lantern', name: 'Memory Lantern', assetKey: 'artefact_memory_lantern' },
};

export function artefactForReward(rewardId: string | undefined | null): WorldArtefact | null {
  return rewardId ? ARTEFACT_DEFS[rewardId] ?? null : null;
}

type EntryLike = { def: Pick<DiscoveryDef, 'worldRewardId'>; record: DiscoveryRecord | null };

// The unique artefacts the user has earned (one per rewardId, unlocked, known),
// in catalog order.
export function collectUnlockedArtefacts(entries: EntryLike[]): WorldArtefact[] {
  const seen = new Set<string>();
  const out: WorldArtefact[] = [];
  for (const entry of entries) {
    const rewardId = entry.def.worldRewardId;
    if (!entry.record || !rewardId || seen.has(rewardId)) continue;
    const artefact = ARTEFACT_DEFS[rewardId];
    if (!artefact) continue;
    seen.add(rewardId);
    out.push(artefact);
  }
  return out;
}

// Deterministic placement around the patch's outer ring (patch cells are 0..3;
// ring=1 grows the ground to -1..4). Slots hug the visible left / front / right
// edges and steer clear of the front-right egg/creature corner (3,3). Positions
// will want device tuning — they're decorative, never interactive.
export const ARTEFACT_RING_SLOTS: { col: number; row: number }[] = [
  { col: -1, row: 1 },
  { col: -1, row: 2 },
  { col: -1, row: 3 },
  { col: 0, row: 4 },
  { col: 1, row: 4 },
  { col: 2, row: 4 },
  { col: 4, row: 0 },
  { col: 4, row: 1 },
];

export function placeArtefacts(artefacts: WorldArtefact[]): PlacedArtefact[] {
  return artefacts.slice(0, ARTEFACT_RING_SLOTS.length).map((artefact, index) => ({
    ...artefact,
    col: ARTEFACT_RING_SLOTS[index].col,
    row: ARTEFACT_RING_SLOTS[index].row,
  }));
}
