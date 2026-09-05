import { defineStory, story } from '@/features/content-flow/story-manifest';
import { storyOperations, upgradeWorldTargetRecipe } from '@/features/content-flow/story-world-operations';
import { WORLD_UPGRADE_DEFINITIONS, type WorldUpgradeDefinition } from './world-upgrade-offers';

export const worldUpgradeRunId = (offer: Pick<WorldUpgradeDefinition, 'id' | 'nextLevel'>) => `world-upgrade:${offer.id}:${offer.nextLevel}`;
export const WORLD_UPGRADE_FLOWS = WORLD_UPGRADE_DEFINITIONS.map((offer) => defineStory({
  id: worldUpgradeRunId(offer), version: 1, entryNodeId: 'approach', metadata: { kind: 'story' },
  nodes: [
    storyOperations.focusCamera({ id: 'approach', target: offer.visualTarget, next: 'upgrade.focus', zoom: 1.28, anchorY: 0.4, durationMs: 440 }),
    ...upgradeWorldTargetRecipe({ id: 'upgrade', target: offer.target, focusTarget: offer.visualTarget,
      toLevel: offer.nextLevel, economy: { mode: 'normal' }, cameraAlreadyFocused: true,
      presentation: { preset: offer.action === 'Clear mist' ? 'mist-clear' : 'growth', showCoins: true }, next: 'complete' }),
    story.complete(),
  ],
}));
