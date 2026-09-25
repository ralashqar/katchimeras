import type { MergeCharacterId, MergeWorldState } from '@/types/merge-world';

/**
 * Hero buildings (cozy 4X, Phase 1): every friend who comes home brings a building to their own tile, the way
 * Whiteout's heroes have their posts. It grows in levels with Glow and Timber, it makes something of the Sanctuary's
 * better, and it is what lets its hero grow: a hero can never be more than one level past their building.
 *
 * The first is Steppling's Explorer's Lodge, on his trailhead: better Supply Runs. Its tile's art grows with it in
 * three looks (`constants/hero-building-art.ts`).
 */
export type HeroBuildingId = 'explorers-lodge';

export type HeroBuildingDefinition = {
  id: HeroBuildingId;
  name: string;
  /** Whose building it is, and whose growth it gates. */
  companion: MergeCharacterId;
  /** The shared-world tile it stands on (its art grows with it). */
  tileId: string;
  tagline: string;
  description: string;
  /** The three looks' names: levels 1-3, 4-6 and 7-10. */
  lookNames: readonly [string, string, string];
};

export const HERO_BUILDING_MAX_LEVEL = 10;
/** Glow and Timber to go up from each level (index = the level it is at; 0 builds it). */
const GLOW_COSTS = [30, 50, 80, 120, 170, 230, 300, 380, 470, 570] as const;
const TIMBER_COSTS = [4, 6, 8, 11, 14, 18, 22, 27, 32, 38] as const;

export const HERO_BUILDINGS: readonly HeroBuildingDefinition[] = [
  {
    id: 'explorers-lodge', name: 'Explorer’s Lodge', companion: 'steppling', tileId: 'steppling-home',
    tagline: 'Steppling’s home base: better Supply Runs, and a Steppling who can go further.',
    description: 'Every trail starts somewhere. Steppling’s starts here.',
    lookNames: ['Trailhead Hut', 'Explorer’s Lodge', 'Grand Lodge'],
  },
];

export const heroBuildingById = new Map(HERO_BUILDINGS.map((building) => [building.id, building]));
export const heroBuildingForCompanion = (companion: MergeCharacterId) => HERO_BUILDINGS.find((building) => building.companion === companion) ?? null;

export function heroBuildingLevel(world: Pick<MergeWorldState, 'heroBuildings'> | null | undefined, id: HeroBuildingId): number {
  return Math.max(0, Math.min(HERO_BUILDING_MAX_LEVEL, Math.floor(world?.heroBuildings?.[id]?.level ?? 0)));
}

/** What going up from `level` takes, or null at the top. */
export function heroBuildingCost(level: number): { glow: number; timber: number } | null {
  if (level < 0 || level >= HERO_BUILDING_MAX_LEVEL) return null;
  return { glow: GLOW_COSTS[level]!, timber: TIMBER_COSTS[level]! };
}

/** Which of the three looks a level shows (0, 1, 2); an unbuilt Lodge shows the first. */
export const heroBuildingLook = (level: number): 0 | 1 | 2 => (level >= 7 ? 2 : level >= 4 ? 1 : 0);

/** The Lodge's Supply Run gifts: extra Timber on every order, and extra Glow in every crate. */
export const lodgeTimberBonus = (level: number) => Math.floor(level / 2);
export const lodgeCrateGlowBonus = (level: number) => level * 3;

/** The highest level a hero may reach: one past their building. A hero without a building has no cap. */
export function heroLevelCap(world: Pick<MergeWorldState, 'heroBuildings'>, companion: MergeCharacterId): number | null {
  const building = heroBuildingForCompanion(companion);
  return building ? heroBuildingLevel(world, building.id) + 1 : null;
}
