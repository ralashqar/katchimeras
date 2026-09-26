import type { MergeCharacterId, MergeWorldState } from '@/types/merge-world';
import type { UpgradeBenefitIcon } from '@/features/upgrade-stage/upgrade-panel-model';
import { frontierHeldCount, frontierLodgeRateBonus, frontierLodgeStoreBonus } from '@/constants/frontier-tiles';

/**
 * Hero buildings (cozy 4X, Phase 1): every friend who comes home brings a building to their own tile, the way
 * Whiteout's heroes have their posts. It grows in levels with Glow and Timber, it makes something of the Sanctuary's
 * better, and it is what lets its hero grow: a hero can never be more than one level past their building.
 *
 * The first is Steppling's Explorer's Lodge, on his trailhead: more Timber from the Café. The second is Petalimp's Bloom
 * House, on the Bloom Garden island: Seeds come faster in battle. Fernip's Thicket, on the Wildgrowth Grove, tangles
 * the wisps: they drift down more slowly. Baristabbit's Café and Feastle's Kitchen grow the food the team eats: better
 * drops on the Café board, more Meals per order, bigger crates. A building's tile grows with it in three looks
 * (`constants/hero-building-art.ts`).
 */
export type HeroBuildingId = 'explorers-lodge' | 'bloom-house' | 'fern-thicket' | 'baristabbit-cafe' | 'feastle-kitchen';

/** Something a building does, shown as a benefit row and growing with its level. */
export type HeroBuildingPerk = { label: string; icon: UpgradeBenefitIcon; tint: string; value: (level: number) => number; format: 'plus' | 'percent' };

export type HeroBuildingDefinition = {
  id: HeroBuildingId;
  name: string;
  /** Whose building it is, and whose growth it gates. */
  companion: MergeCharacterId;
  /** The shared-world tile it stands on (its art grows with it): a structure tile, or a nature island by its id. */
  tileId: string;
  place: 'structure' | 'island';
  /** The island campaign that brings its friend home (a friend met in the story has a discovery record instead). */
  homeCampaignId?: string;
  perks: readonly HeroBuildingPerk[];
  /** What a level does, in a line (the level slots' description). */
  levelLine: (level: number) => string;
  tagline: string;
  description: string;
  /** The three looks' names: levels 1-3, 4-6 and 7-10. */
  lookNames: readonly [string, string, string];
};

export const HERO_BUILDING_MAX_LEVEL = 10;
/** Glow and Timber to go up from each level (index = the level it is at; 0 builds it). */
const GLOW_COSTS = [30, 50, 80, 120, 170, 230, 300, 380, 470, 570] as const;
const TIMBER_COSTS = [2, 4, 7, 10, 14, 18, 22, 27, 32, 38] as const;

export const HERO_BUILDINGS: readonly HeroBuildingDefinition[] = [
  {
    id: 'explorers-lodge', name: 'Explorer’s Lodge', companion: 'steppling', tileId: 'steppling-home', place: 'structure',
    tagline: 'Steppling’s home base: more Timber from every Café order, and a Steppling who can go further.',
    description: 'Every trail starts somewhere. Steppling’s starts here.',
    lookNames: ['Trailhead Hut', 'Explorer’s Lodge', 'Grand Lodge'],
    perks: [
      { label: 'Timber per order', icon: 'shippingbox.fill', tint: '#B07A3E', value: (level) => lodgeTimberBonus(level), format: 'plus' },
      { label: 'Glow per crate', icon: 'glow', tint: '#D98A1F', value: (level) => lodgeCrateGlowBonus(level), format: 'plus' },
    ],
    levelLine: (level) => `Café orders +${lodgeTimberBonus(level)} Timber`,
  },
  {
    id: 'bloom-house', name: 'Bloom House', companion: 'petalimp', tileId: 'bloom-garden', place: 'island', homeCampaignId: 'island-campaign:petalimp-bloom',
    tagline: 'Petalimp’s home: Seeds come faster in every battle, and a Petalimp who can grow further.',
    description: 'Everything Petalimp plants grows. Starting with a house.',
    lookNames: ['Petal Cottage', 'Bloom House', 'Grand Bloom House'],
    perks: [
      { label: 'Seeds in battle', icon: 'sparkles', tint: '#E0679C', value: (level) => Math.round(bloomSeedPace(level) * 100), format: 'percent' },
    ],
    levelLine: (level) => `Seeds arrive ${Math.round(bloomSeedPace(level) * 100)}% faster in battle`,
  },
  {
    id: 'fern-thicket', name: 'Fernip’s Thicket', companion: 'fernip', tileId: 'wildgrowth-grove', place: 'island', homeCampaignId: 'island-campaign:fernip-wildgrowth',
    tagline: 'Fernip’s home: a tangle that slows the wisps in every battle, and a Fernip who can grow further.',
    description: 'Wherever Fernip settles, things grow wild. The wisps hate it.',
    lookNames: ['Fern Nook', 'Fernip’s Thicket', 'Great Thicket'],
    perks: [
      { label: 'Wisps slowed', icon: 'timer', tint: '#5E9E4A', value: (level) => Math.round(fernWispSlow(level) * 100), format: 'percent' },
    ],
    levelLine: (level) => `Wisps drift ${Math.round(fernWispSlow(level) * 100)}% slower in battle`,
  },
  {
    id: 'baristabbit-cafe', name: 'Baristabbit’s Café', companion: 'baristabbit', tileId: 'baristabbit-home', place: 'structure',
    tagline: 'Baristabbit’s counter: better drinks and pastries, more Meals from every order, and a Baristabbit who can go further.',
    description: 'The kettle never goes cold here. Now it has a proper café around it.',
    lookNames: ['Window Kiosk', 'Corner Café', 'Grand Café'],
    perks: [
      { label: 'Better drinks & pastries', icon: 'sparkles', tint: '#C98A66', value: (level) => Math.round(cafeTierTwoChance(level) * 100), format: 'percent' },
      { label: 'Meals per order', icon: 'star.fill', tint: '#D9534F', value: (level) => cafeMealsBonus(level), format: 'plus' },
    ],
    levelLine: (level) => `Café orders +${cafeMealsBonus(level)} Meals · ${Math.round(cafeTierTwoChance(level) * 100)}% better drinks`,
  },
  {
    id: 'feastle-kitchen', name: 'Feastle’s Kitchen', companion: 'feastle', tileId: 'feastle-home', place: 'structure',
    tagline: 'Feastle’s hearth: better dishes and desserts, and bigger Kitchen crates.',
    description: 'Every good feast starts with one warm stove.',
    lookNames: ['Hearth Cottage', 'Farmhouse Kitchen', 'Grand Kitchen Hall'],
    perks: [
      { label: 'Better dishes & desserts', icon: 'sparkles', tint: '#C97847', value: (level) => Math.round(kitchenTierTwoChance(level) * 100), format: 'percent' },
      { label: 'Meals per crate', icon: 'shippingbox.fill', tint: '#D9534F', value: (level) => kitchenCrateMealsBonus(level), format: 'plus' },
    ],
    levelLine: (level) => `Kitchen crates +${kitchenCrateMealsBonus(level)} Meals · ${Math.round(kitchenTierTwoChance(level) * 100)}% better dishes`,
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

/** The tile's art slot a level shows: 0 is the tile's own art (nothing built), 1-3 the building's three looks. */
export const heroTileSlot = (level: number): 0 | 1 | 2 | 3 => (level < 1 ? 0 : (heroBuildingLook(level) + 1) as 1 | 2 | 3);

/** The Kingdom scene's layer for a building's tile. */
export function heroTileLayerId(tileId: string): string {
  const building = HERO_BUILDINGS.find((candidate) => candidate.tileId === tileId);
  return building?.place === 'island' ? `nature:mossprout:${tileId}` : `structure:${tileId}`;
}

/** Whether a building's friend is home: met in the story (a discovery record), or brought home by their island campaign. */
export function heroCompanionHome(world: Pick<MergeWorldState, 'companionDiscovery'> & Partial<Pick<MergeWorldState, 'ownedKatchimeraCards' | 'islandCampaigns'>>, definition: HeroBuildingDefinition): boolean {
  if (world.companionDiscovery.records.some((record) => record.characterId === definition.companion)) return true;
  if (world.ownedKatchimeraCards?.some((card) => card.cardId === definition.companion)) return true;
  return Boolean(definition.homeCampaignId && world.islandCampaigns?.[definition.homeCampaignId]?.cardEarnedAt != null);
}

/** The Bloom House's gift: Seeds land this much sooner in battle (4% a level). */
export const bloomSeedPace = (level: number) => Math.max(0, Math.min(10, level)) * 0.04;

/** Fernip's Thicket's gift: wisps take this much longer over every row in battle (3% a level). */
export const fernWispSlow = (level: number) => Math.max(0, Math.min(10, level)) * 0.03;

/** Baristabbit's Café: the Ritual Bar and the Café Counter pour a tier-2 piece this often (5% a level), and every order pays more Meals. */
export const cafeTierTwoChance = (level: number) => Math.max(0, Math.min(10, level)) * 0.05;
export const cafeMealsBonus = (level: number) => Math.ceil(Math.max(0, Math.min(10, level)) / 2);
/** Feastle's Kitchen: the Hearth Pantry's tier-2 odds (5% a level), and Meals added to every crate. */
export const kitchenTierTwoChance = (level: number) => Math.max(0, Math.min(10, level)) * 0.05;
export const kitchenCrateMealsBonus = (level: number) => Math.max(0, Math.min(10, level)) * 2;

/** The odds a Café board's generator pours with, from the two buildings (Feastle's Kitchen for the Hearth Pantry). */
export function cafeDropProfile(world: Pick<MergeWorldState, 'heroBuildings'>, generatorId: string): { tierTwoChance: number; tierThreeChance: number } {
  const chance = generatorId === 'hearth-pantry' ? kitchenTierTwoChance(heroBuildingLevel(world, 'feastle-kitchen')) : cafeTierTwoChance(heroBuildingLevel(world, 'baristabbit-cafe'));
  return { tierTwoChance: chance, tierThreeChance: 0 };
}

/** The Lodge's Café gifts: extra Timber on every order, and extra Glow in every crate. */
export const lodgeTimberBonus = (level: number) => Math.floor(level / 2);
export const lodgeCrateGlowBonus = (level: number) => level * 3;

/** The Lodge makes Timber while you are away: `level` every half hour, up to a store of `4 + level * 4`. */
export const LODGE_PRODUCTION_INTERVAL_MS = 30 * 60 * 1000;
export const lodgeTimberPerInterval = (level: number) => Math.max(0, level);
export const lodgeTimberStore = (level: number) => (level < 1 ? 0 : 4 + level * 4);

/**
 * Timber waiting at the Lodge, from its level and when it was last collected. Land taken back from the Mist feeds it
 * (`constants/frontier-tiles.ts`): a bigger store for every Frontier tile reclaimed, a faster stream for every three.
 */
export function lodgeTimberWaiting(world: Pick<MergeWorldState, 'heroBuildings'> & Partial<Pick<MergeWorldState, 'encounters' | 'frontierSurges'>>, now: number): number {
  const lodge = world.heroBuildings?.['explorers-lodge'];
  if (!lodge || lodge.level < 1) return 0;
  const since = Math.max(0, now - (lodge.collectedAt ?? lodge.builtAt));
  // Land the Mist has taken again (contested) feeds nothing until it is taken back.
  const reclaimed = frontierHeldCount(world);
  return Math.min(lodgeTimberStore(lodge.level) + frontierLodgeStoreBonus(reclaimed), Math.floor(since / LODGE_PRODUCTION_INTERVAL_MS) * (lodgeTimberPerInterval(lodge.level) + frontierLodgeRateBonus(reclaimed)));
}

/** The highest level a hero may reach: one past their building. A hero without a building has no cap. */
export function heroLevelCap(world: Pick<MergeWorldState, 'heroBuildings'>, companion: MergeCharacterId): number | null {
  const building = heroBuildingForCompanion(companion);
  return building ? heroBuildingLevel(world, building.id) + 1 : null;
}
