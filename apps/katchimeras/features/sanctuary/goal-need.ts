import { hatchableByTile } from '@/constants/hatchable-companions/registry';
import type { ChapterGoal } from '@/constants/sanctuary-chapters';
import { buildingUpgradeModel, companionUpgradeModel, heartTreeUpgradeModel, heroBuildingUpgradeModel, type UpgradePanelModel } from '@/features/upgrade-stage/upgrade-panel-model';
import type { MergeWorldState } from '@/types/merge-world';

/** Where a missing thing is earned: the Grove's levels (Glow and XP) or the Caf\u00e9 (Timber and Meals). */
export type GoalNeedSource = 'grove' | 'cafe';
export type GoalNeed = { text: string; source: GoalNeedSource };

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
    return world.coins < price ? { text: `Needs ${price - world.coins} more Glow \u00b7 play the Grove`, source: 'grove' } : null;
  }
  if (!model || model.locked || !model.primary) return null;
  const missing = model.requirements.find((requirement) => !requirement.met);
  if (!missing) return null;
  const short = Math.max(0, (missing.total ?? 0) - (missing.current ?? 0));
  if (missing.id === 'timber' || missing.id === 'meals') {
    const what = missing.id === 'timber' ? 'Timber' : 'Meals';
    return home(world, 'baristabbit') ? { text: `Needs ${short} more ${what} \u00b7 serve at the Caf\u00e9`, source: 'cafe' } : { text: `Needs ${short} more ${what}`, source: 'grove' };
  }
  if (missing.id === 'xp') return { text: `Needs ${short} more XP \u00b7 battle in the Grove`, source: 'grove' };
  if (missing.id === 'glow') return { text: `Needs ${short} more Glow \u00b7 play the Grove`, source: 'grove' };
  return null;
}
