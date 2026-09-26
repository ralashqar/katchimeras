import { hatchableByTile } from '@/constants/hatchable-companions/registry';
import type { ChapterGoal } from '@/constants/sanctuary-chapters';
import { buildingUpgradeModel, companionUpgradeModel, heartTreeUpgradeModel, heroBuildingUpgradeModel, type UpgradePanelModel } from '@/features/upgrade-stage/upgrade-panel-model';
import type { MergeWorldState } from '@/types/merge-world';
import { heroBuildingForCompanion, type HeroBuildingId } from '@/constants/hero-buildings';
import { battleSourceCampaign } from './battle-source';
import { frontierOpen, nextFrontierTile } from '@/constants/frontier-tiles';

/**
 * Where a missing thing is earned: the Frontier's next tile in the Tree's light (Glow and XP, and its land's Timber),
 * else battles on the latest friend island (`battleSourceCampaign`), or the Caf\u00e9 (Timber and Meals, and Glow before
 * any of those). Never the old Grove.
 */
export type GoalNeedSource = 'frontier' | 'battle' | 'cafe' | 'building';
/** `building`: a hero held back by their own building (the Lodge): the goal card opens that building. `frontier`: that tile's battle. */
export type GoalNeed = { text: string; source: GoalNeedSource; buildingId?: HeroBuildingId; tileId?: string; /** The hero short of experience: the battle it sends to brings them. */ heroId?: string };

/** The first goal's pointer, remembered with the chapter openings once the card has been tapped. */
export const FIRST_GOAL_COACH_ID = 'coach:first-goal';

const home = (world: MergeWorldState, id: string) => world.companionDiscovery.records.some((record) => record.characterId === id);

/**
 * What stands between the player and a chapter goal right now, in a line for the goal card, with where to get it; null
 * when the goal can be done as soon as its panel opens. Read off the same panel models the goal opens, so the card and
 * the panel always agree.
 */
export function goalNeed(world: MergeWorldState, goal: ChapterGoal): GoalNeed | null {
  const action = goal.action;
  let model: UpgradePanelModel | null = null;
  if (action.kind === 'building') model = buildingUpgradeModel(world, action.buildingId);
  else if (action.kind === 'hero_building') model = heroBuildingUpgradeModel(world, action.id);
  else if (action.kind === 'heart_tree') model = heartTreeUpgradeModel(world);
  else if (action.kind === 'hero') model = companionUpgradeModel(world, action.characterId);
  else if (action.kind === 'world_offer' && action.offerId.startsWith('mist:')) {
    const price = hatchableByTile(action.offerId.slice('mist:'.length))?.tile.price ?? 0;
    return world.coins < price ? glowNeed(world, price - world.coins) : null;
  }
  if (!model || model.locked || !model.primary) return null;
  const missing = model.requirements.find((requirement) => !requirement.met);
  if (!missing) return null;
  const short = Math.max(0, (missing.total ?? 0) - (missing.current ?? 0));
  if (missing.id === 'timber' || missing.id === 'meals') {
    const what = missing.id === 'timber' ? 'Timber' : 'Meals';
    return home(world, 'baristabbit') ? { text: `Needs ${short} more ${what} \u00b7 serve at the Caf\u00e9`, source: 'cafe' } : { text: `Needs ${short} more ${what}`, source: 'battle' };
  }
  if (missing.id === 'xp') {
    const heroId = action.kind === 'hero' ? action.characterId : undefined;
    const frontier = frontierBattle(world);
    if (frontier) return { text: `Needs ${short} more XP \u00b7 take back the Frontier`, source: 'frontier', tileId: frontier, ...(heroId ? { heroId } : {}) };
    const battles = battleSourceCampaign(world);
    return { text: `Needs ${short} more XP \u00b7 ${battles ? `battle at ${battles.place}` : 'win battles'}`, source: 'battle', ...(heroId ? { heroId } : {}) };
  }
  if (missing.id === 'glow') return glowNeed(world, short);
  // A hero grows no further than one past their own building: the building first. When the building is itself short
  // of something, that is what the card says (and where it sends); otherwise the card opens the building.
  if (missing.id === 'building' && action.kind === 'hero') {
    const building = heroBuildingForCompanion(action.characterId);
    if (!building) return null;
    const upgrade = heroBuildingUpgradeModel(world, building.id);
    const blocking = upgrade.requirements.find((requirement) => !requirement.met);
    if (blocking && !upgrade.locked) {
      const inner = goalNeed(world, { ...goal, action: { kind: 'hero_building', id: building.id } });
      if (inner) return { ...inner, text: `${building.name} first: ${inner.text.charAt(0).toLowerCase()}${inner.text.slice(1)}` };
    }
    return { text: `Needs ${building.name} at level ${missing.total ?? 0} \u00b7 upgrade it`, source: 'building', buildingId: building.id };
  }
  return null;
}

/** The Frontier tile a player short of Glow or XP is sent to: the next in the Tree's light, once the Frontier is open. */
function frontierBattle(world: MergeWorldState): string | null {
  return frontierOpen(world) ? nextFrontierTile(world)?.id ?? null : null;
}

/** Glow: from the Frontier, else the latest island's battles, else the Caf\u00e9's orders. */
function glowNeed(world: MergeWorldState, short: number): GoalNeed {
  const frontier = frontierBattle(world);
  if (frontier) return { text: `Needs ${short} more Glow \u00b7 take back the Frontier`, source: 'frontier', tileId: frontier };
  const battles = battleSourceCampaign(world);
  if (battles) return { text: `Needs ${short} more Glow \u00b7 battle at ${battles.place}`, source: 'battle' };
  return { text: `Needs ${short} more Glow \u00b7 serve at the Caf\u00e9`, source: 'cafe' };
}
