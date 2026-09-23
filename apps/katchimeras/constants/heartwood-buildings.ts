import type { MergeWorldState, MossproutGardenPlantSlotId } from '@/types/merge-world';

/**
 * Heartwood's base: five patches around the tree, each holding one upgradable
 * building that owns one part of the Merge economy. The Wisp Lantern already
 * holds `front-right` (collection); these four hold the rest. Each level moves
 * one number the player feels every session, and a few milestone levels add a
 * second effect. Everything here is pure data and arithmetic: the engine reads
 * the numbers, the upgrade panel shows them, and nothing else decides them.
 */
export type HeartwoodBuildingId = 'dew-spring' | 'seed-nursery' | 'root-cellar' | 'garden-stall';
export type HeartwoodBuildingState = {
  level: number;
  builtAt: number;
  /** A save from before the buildings: the memory seed that stood here and became this building. */
  from?: string;
  /** Legacy: the first session briefly planted the Dew Spring asleep. Nothing sets this any more; waking clears it. */
  dormant?: true;
};
export type HeartwoodBuildings = Partial<Record<HeartwoodBuildingId, HeartwoodBuildingState>>;
/** Three looks over ten levels, like a seed growing: 1-3, 4-6, 7-10. */
export type HeartwoodBuildingLook = 0 | 1 | 2;

export const HEARTWOOD_BUILDING_MAX_LEVEL = 10;
/** Glow to reach each level: building it (level 1), then every upgrade. */
export const HEARTWOOD_BUILDING_COSTS: readonly number[] = [20, 40, 80, 140, 220, 320, 450, 600, 800, 1000];

// The Merge economy's base numbers, before any building.
export const MERGE_ENERGY_BASE_CAP = 100;
export const MERGE_ENERGY_BASE_REGEN_MS = 2 * 60_000;
export const MERGE_ENERGY_TAP_COST = 1;

export type HeartwoodBuildingStat = {
  label: string;
  /** The stat at a level (0 = not built yet). */
  value: (level: number) => number;
  format: (value: number) => string;
  /** The gain from one value to the next, as the panel words it. */
  delta: (from: number, to: number) => string;
  icon: 'energy' | 'bolt.fill' | 'timer' | 'sparkles' | 'star.fill' | 'shippingbox.fill' | 'glow';
  tint: string;
};

export type HeartwoodBuildingDefinition = {
  id: HeartwoodBuildingId;
  name: string;
  slotId: MossproutGardenPlantSlotId;
  tagline: string;
  /** What the building is, for the hero row before it is built. */
  description: string;
  lookNames: readonly [string, string, string];
  stats: readonly HeartwoodBuildingStat[];
};

const whole = (value: number) => value.toLocaleString();
const percent = (value: number) => `${Math.round(value * 100)}%`;
const clock = (ms: number) => `${Math.floor(ms / 60_000)}:${String(Math.round((ms % 60_000) / 1000)).padStart(2, '0')}`;
const signed = (text: string, positive: boolean) => `${positive ? '+' : '-'}${text}`;
const gainWhole = (from: number, to: number) => signed(whole(Math.abs(to - from)), to >= from);
const gainPercent = (from: number, to: number) => signed(percent(Math.abs(to - from)), to >= from);
/** A shorter wait is the gain, so it reads as time taken off. */
const gainClock = (from: number, to: number) => signed(clock(Math.abs(to - from)), to > from);
const TINT = { energy: '#2FA9C4', time: '#4E9CC4', finds: '#8A63C9', rare: '#D98A1F', storage: '#9A6A3C', glow: '#E7A21B' } as const;
const clampLevel = (level: number) => Math.max(0, Math.min(HEARTWOOD_BUILDING_MAX_LEVEL, Math.floor(Number.isFinite(level) ? level : 0)));

/** Dew Spring: Resolve brought into every board, two a level; and, high up, a step of Resolve back on a Perfect clear. */
export const dewSpringResolveBonus = (level: number) => clampLevel(level) * 2;
/** Encounter v2: a flame of Light at levels 3, 6 and 9. */
/** Territory: turns before the Dark Wisps first act, one at levels 3, 6 and 9. */
export const dewSpringCalmTurns = (level: number) => Math.floor(clampLevel(level) / 3);
export const dewSpringSecondWind = (level: number) => { const at = clampLevel(level); return at >= 10 ? 2 : at >= 7 ? 1 : 0; };
/** Root Cellar: Mist cells opened before the first move, one every two levels. */
export const rootCellarOpenCells = (level: number) => Math.floor(clampLevel(level) / 2);
// The energy numbers stay for the world's dormant energy state; no building moves them any more.
export const dewSpringEnergyCap = (level: number) => MERGE_ENERGY_BASE_CAP + clampLevel(level) * 10;
export const dewSpringRegenMs = (level: number) => {
  const at = clampLevel(level);
  return at >= 10 ? 75_000 : at >= 7 ? 90_000 : at >= 4 ? 105_000 : MERGE_ENERGY_BASE_REGEN_MS;
};
/** Added to an item maker's chance of making a tier-two item. */
export const seedNurseryTierTwoBonus = (level: number) => clampLevel(level) * 0.03;
/** Chance of a tier-three item, from the Nursery alone. */
export const seedNurseryTierThreeChance = (level: number) => { const at = clampLevel(level); return at >= 10 ? 0.05 : at >= 7 ? 0.03 : 0; };
export const rootCellarStorageBonus = (level: number) => clampLevel(level);
/** Extra Glow on every served order, as a fraction of its reward. */
export const gardenStallGlowBonus = (level: number) => clampLevel(level) * 0.04;

export const HEARTWOOD_BUILDINGS: readonly HeartwoodBuildingDefinition[] = [
  {
    id: 'dew-spring', name: 'Dew Spring', slotId: 'back-centre',
    tagline: 'How much Resolve you bring into the Mist.',
    description: 'A spring under the roots. Drink before you go in, and the Mist takes longer to wear you down.',
    lookNames: ['Dew Pool', 'Root Spring', 'Heartwood Spring'],
    stats: [
      { label: 'Calm before the Mist', value: dewSpringCalmTurns, format: (value) => `+${whole(value)} ${Math.floor(value) === 1 ? 'turn' : 'turns'}`, delta: gainWhole, icon: 'energy', tint: TINT.energy },
      { label: 'Second wind', value: dewSpringSecondWind, format: (value) => `+${whole(value)}`, delta: gainWhole, icon: 'timer', tint: TINT.time },
    ],
  },
  {
    id: 'seed-nursery', name: 'Seed Nursery', slotId: 'front-left',
    tagline: 'How good the things your spawners make are.',
    description: 'Seedlings raised under glass. The better they are tended, the more often a spawner in the Mist makes something a step ahead.',
    lookNames: ['Seed Trays', 'Glass Nursery', 'Propagation House'],
    stats: [
      { label: 'Better finds', value: seedNurseryTierTwoBonus, format: (value) => `+${percent(value)}`, delta: gainPercent, icon: 'sparkles', tint: TINT.finds },
      { label: 'Rare finds', value: seedNurseryTierThreeChance, format: percent, delta: gainPercent, icon: 'star.fill', tint: TINT.rare },
    ],
  },
  {
    id: 'root-cellar', name: 'Root Cellar', slotId: 'back-left',
    tagline: 'How much of the Mist is open when you arrive.',
    description: 'A cool room between the roots. What is kept here goes ahead of you: a little of every board is open before the first move.',
    lookNames: ['Root Hollow', 'Root Cellar', 'Deep Cellar'],
    stats: [{ label: 'Open cells', value: rootCellarOpenCells, format: (value) => `+${whole(value)}`, delta: gainWhole, icon: 'shippingbox.fill', tint: TINT.storage }],
  },
  {
    id: 'garden-stall', name: 'Garden Stall', slotId: 'back-right',
    tagline: 'How much Glow a cleared Mist brings in.',
    description: 'A little stall by the path. What you bring back from the Mist is worth more when there is somewhere to offer it.',
    lookNames: ['Trestle Table', 'Garden Stall', 'Market Stall'],
    stats: [{ label: 'Glow from missions', value: gardenStallGlowBonus, format: (value) => `+${percent(value)}`, delta: gainPercent, icon: 'glow', tint: TINT.glow }],
  },
];

export const heartwoodBuildingById = new Map(HEARTWOOD_BUILDINGS.map((definition) => [definition.id, definition]));
export const heartwoodBuildingBySlot = new Map(HEARTWOOD_BUILDINGS.map((definition) => [definition.slotId, definition]));
export const isHeartwoodBuildingId = (value: unknown): value is HeartwoodBuildingId => typeof value === 'string' && heartwoodBuildingById.has(value as HeartwoodBuildingId);

export function heartwoodBuildingLook(level: number): HeartwoodBuildingLook {
  return level >= 7 ? 2 : level >= 4 ? 1 : 0;
}

/** Glow to go from `level` to the next one; null once it is fully grown. */
export function heartwoodBuildingCost(level: number): number | null {
  return level >= HEARTWOOD_BUILDING_MAX_LEVEL ? null : HEARTWOOD_BUILDING_COSTS[clampLevel(level)] ?? null;
}

export function heartwoodBuildingLevel(world: Pick<MergeWorldState, 'heartwoodBuildings'> | null | undefined, id: HeartwoodBuildingId): number {
  return clampLevel(world?.heartwoodBuildings?.[id]?.level ?? 0);
}

/** Saved buildings, with anything unknown or malformed dropped. */
export function normalizeHeartwoodBuildings(source: unknown, now: number): HeartwoodBuildings | undefined {
  if (!source || typeof source !== 'object') return undefined;
  const buildings: HeartwoodBuildings = {};
  for (const [id, value] of Object.entries(source as Record<string, unknown>)) {
    if (!isHeartwoodBuildingId(id) || !value || typeof value !== 'object') continue;
    const level = clampLevel(Number((value as { level?: unknown }).level));
    if (level < 1) continue;
    const builtAt = Number((value as { builtAt?: unknown }).builtAt);
    const from = (value as { from?: unknown }).from;
    buildings[id] = { level, builtAt: Number.isFinite(builtAt) ? builtAt : now, ...(typeof from === 'string' && from ? { from } : {}), ...((value as { dormant?: unknown }).dormant === true ? { dormant: true as const } : {}) };
  }
  return Object.keys(buildings).length ? buildings : undefined;
}

// What the engine reads.
export const mergeEnergyCap = (world: Pick<MergeWorldState, 'heartwoodBuildings'> | null | undefined) => dewSpringEnergyCap(heartwoodBuildingLevel(world, 'dew-spring'));
export const mergeEnergyRegenMs = (world: Pick<MergeWorldState, 'heartwoodBuildings'> | null | undefined) => dewSpringRegenMs(heartwoodBuildingLevel(world, 'dew-spring'));
