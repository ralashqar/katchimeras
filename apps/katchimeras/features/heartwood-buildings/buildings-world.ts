import {
  HEARTWOOD_BUILDING_MAX_LEVEL,
  heartwoodBuildingById,
  heartwoodBuildingCost,
  heartwoodBuildingLevel,
  mergeEnergyCap,
  type HeartwoodBuildingId,
} from '@/constants/heartwood-buildings';
import type { MergeWorldState } from '@/types/merge-world';

/**
 * Building and upgrading one of Heartwood's four economy buildings. A pure
 * step over the world, like the Lantern's: the repository serializes it, and
 * a repeated or stale request changes nothing.
 */

/** Heartwood's patches open for building once the first session is behind the player and the tree has stirred. */
export function heartwoodBuildingsEligible(world: MergeWorldState): boolean {
  return world.kingdomGoal?.introducedAt != null || (world.haven.tileStages.mossprout ?? 0) >= 1;
}

export function canUpgradeHeartwoodBuilding(world: MergeWorldState, id: HeartwoodBuildingId): boolean {
  const cost = heartwoodBuildingCost(heartwoodBuildingLevel(world, id));
  return cost != null && heartwoodBuildingsEligible(world) && world.coins >= cost;
}

/** The first thing built at Heartwood, by the first session, in the patch the Mist let go of. */
export const FIRST_SEED_BUILDING_ID: HeartwoodBuildingId = 'dew-spring';

const sendPlantHome = (state: MergeWorldState, slotId: string) => {
  for (const plant of state.haven.plantableMemories) {
    if (plant.status !== 'planted' || plant.slotId !== slotId) continue;
    plant.plantedAt ??= plant.earnedAt;
    plant.status = 'earned';
    plant.slotId = null;
  }
};

/**
 * The first session's planting beat: the Dew Spring, Level 1, free. It is planted as it will stay: restoring the
 * tree's tile afterwards does not change it. Already built (a repeated tap, a recovery after an interrupted effect, a
 * replay), this changes nothing.
 */
export function buildFirstSpring(input: MergeWorldState, now: number): MergeWorldState {
  if (heartwoodBuildingLevel(input, FIRST_SEED_BUILDING_ID) > 0) return input;
  const state = structuredClone(input);
  // A save caught mid-session by this change may have the old memory seed in the patch.
  sendPlantHome(state, heartwoodBuildingById.get(FIRST_SEED_BUILDING_ID)!.slotId);
  state.heartwoodBuildings = { ...state.heartwoodBuildings, [FIRST_SEED_BUILDING_ID]: { level: 1, builtAt: now } };
  state.energy = { ...state.energy, value: state.energy.value + (mergeEnergyCap(state) - mergeEnergyCap(input)), regenCap: mergeEnergyCap(state) };
  return state;
}

/**
 * The garden has woken. The Spring was planted running, so this normally changes nothing; it is the story's safety
 * net: if the planting beat never landed it plants the Spring now, and a save from the short time the Spring was
 * planted asleep has that cleared.
 */
export function wakeFirstSpring(input: MergeWorldState, now: number): MergeWorldState {
  const built = buildFirstSpring(input, now);
  const spring = built.heartwoodBuildings?.[FIRST_SEED_BUILDING_ID];
  if (!spring?.dormant) return built;
  const { dormant: _dormant, ...awake } = spring;
  return { ...built, heartwoodBuildings: { ...built.heartwoodBuildings, [FIRST_SEED_BUILDING_ID]: awake } };
}

export const firstSpringBuilt = (world: Pick<MergeWorldState, 'heartwoodBuildings'>) => heartwoodBuildingLevel(world, FIRST_SEED_BUILDING_ID) > 0;
export const firstSpringAwake = (world: Pick<MergeWorldState, 'heartwoodBuildings'>) => firstSpringBuilt(world) && !world.heartwoodBuildings?.[FIRST_SEED_BUILDING_ID]?.dormant;

/** A save from before the buildings: the first session's old seed, sprouted in its patch, with no Spring yet. */
export function firstSeedReadyForSpring(world: MergeWorldState) {
  if (heartwoodBuildingLevel(world, FIRST_SEED_BUILDING_ID) > 0) return undefined;
  const slotId = heartwoodBuildingById.get(FIRST_SEED_BUILDING_ID)!.slotId;
  return world.haven.plantableMemories.find((plant) => plant.source.kind === 'ftue' && plant.status === 'planted' && plant.slotId === slotId && plant.growthPoints >= 1);
}

/**
 * Older saves only. The first session used to plant a memory seed here; such a save gets the Dew Spring it would have
 * built instead: Level 1, free, in the same patch. The seed goes back to the collection with its growth, and the
 * Spring remembers which seed it came from. Nothing happens twice.
 */
export function growFirstSeedIntoSpring(input: MergeWorldState, now: number): MergeWorldState {
  const seed = firstSeedReadyForSpring(input);
  if (!seed) return input;
  const state = structuredClone(input);
  const planted = state.haven.plantableMemories.find((plant) => plant.id === seed.id)!;
  planted.plantedAt ??= planted.earnedAt;
  planted.status = 'earned';
  planted.slotId = null;
  state.heartwoodBuildings = { ...state.heartwoodBuildings, [FIRST_SEED_BUILDING_ID]: { level: 1, builtAt: now, from: seed.definitionId } };
  state.energy = { ...state.energy, value: state.energy.value + (mergeEnergyCap(state) - mergeEnergyCap(input)), regenCap: mergeEnergyCap(state) };
  return state;
}

/**
 * Raises a building one level, from `expectedLevel` (0 builds it). Building it
 * takes its patch: a memory plant standing there goes back to the collection
 * with all its growth, exactly as one does when the Lantern is planted.
 */
export function upgradeHeartwoodBuilding(input: MergeWorldState, id: HeartwoodBuildingId, expectedLevel: number, now: number): MergeWorldState {
  const definition = heartwoodBuildingById.get(id);
  if (!definition) throw new Error('That building does not exist.');
  const level = heartwoodBuildingLevel(input, id);
  // A second tap, or a request made against an older world: already done.
  if (level !== expectedLevel) return input;
  if (level >= HEARTWOOD_BUILDING_MAX_LEVEL) return input;
  if (!heartwoodBuildingsEligible(input)) throw new Error('Heartwood is not ready for this yet.');
  const cost = heartwoodBuildingCost(level)!;
  if (input.coins < cost) throw new Error(`You need ${(cost - input.coins).toLocaleString()} more Glow.`);
  const state = structuredClone(input);
  if (level === 0) sendPlantHome(state, definition.slotId);
  state.coins -= cost;
  // Spending on a building brings it to life, whatever the story was doing with it.
  const { dormant: _dormant, ...standing } = state.heartwoodBuildings?.[id] ?? { builtAt: now };
  state.heartwoodBuildings = { ...state.heartwoodBuildings, [id]: { ...standing, level: level + 1 } };
  // A bigger spring holds more at once: the new room arrives full, so an upgrade is felt the moment it lands.
  if (id === 'dew-spring') state.energy = { ...state.energy, value: state.energy.value + (mergeEnergyCap(state) - mergeEnergyCap(input)), regenCap: mergeEnergyCap(state) };
  // The Cellar's new shelf is there at once, not after the next order recounts storage.
  if (id === 'root-cellar') state.storageCapacity += 1;
  return state;
}
