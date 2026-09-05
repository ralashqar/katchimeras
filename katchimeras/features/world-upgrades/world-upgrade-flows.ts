import { defineStory, story } from '@/features/content-flow/story-manifest';
import { storyOperations, upgradeWorldTargetRecipe } from '@/features/content-flow/story-world-operations';
import { WORLD_UPGRADE_DEFINITIONS, type WorldUpgradeDefinition } from './world-upgrade-offers';

export const worldUpgradeRunId = (offer: Pick<WorldUpgradeDefinition, 'id' | 'nextLevel'>) => `world-upgrade:${offer.id}:${offer.nextLevel}`;
export const WORLD_UPGRADE_FLOWS = WORLD_UPGRADE_DEFINITIONS.map((offer) => defineStory({
  id: worldUpgradeRunId(offer), version: 2, entryNodeId: 'approach', metadata: { kind: 'story' },
  nodes: [
    // Selecting the marker already frames the tile. Keep that exact camera
    // through payment and reveal instead of starting a second pan/zoom.
    storyOperations.preserveCamera({ id: 'approach', next: 'upgrade.focus' }),
    ...upgradeWorldTargetRecipe({ id: 'upgrade', target: offer.target, focusTarget: offer.visualTarget,
      toLevel: offer.nextLevel, economy: { mode: 'normal' }, cameraAlreadyFocused: true,
      presentation: { preset: offer.action === 'Clear mist' ? 'mist-clear' : 'growth', showCoins: true }, next: 'complete' }),
    story.complete(),
  ],
}));
