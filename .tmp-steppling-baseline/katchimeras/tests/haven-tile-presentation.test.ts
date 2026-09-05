import assert from 'node:assert/strict';
import test from 'node:test';

import { deriveHavenTilePresentation } from '@/utils/haven-tile-presentation';
import { createInitialMergeWorldState, normalizeMergeWorldState } from '@/utils/merge-world/engine';

const NOW = Date.UTC(2026, 7, 18, 12);

function world(coins: number, chapterComplete = false) {
  const fresh = createInitialMergeWorldState(NOW, ['mossprout']);
  return {
    ...fresh,
    coins,
    characterProgress: {
      ...fresh.characterProgress,
      mossprout: {
        friendshipLevel: 1,
        completedChapterIds: chapterComplete ? ['mossprout-chapter-0'] : [],
      },
    },
  };
}

const derive = (mergeWorld: ReturnType<typeof world>, saving = false) => deriveHavenTilePresentation({
  characterId: 'mossprout',
  creatureId: 'mossprout-creature',
  creatureName: 'Mossprout',
  mergeWorld,
  saving,
});

test('Haven tile presentation keeps story and Coin progress as separate gates', () => {
  assert.equal(derive(world(200)).hudState, 'story_locked');
  const saving = derive(world(80, true), true);
  assert.equal(saving.hudState, 'saving');
  const collecting = derive(world(10, true));
  assert.equal(collecting.hudState, 'upgrade_ready');
  assert.equal(collecting.coinProgress, 0.5);
  assert.equal(derive(world(20, true)).hudState, 'affordable');
});

test('Coin progress clamps and completed tiles have no next objective', () => {
  const rich = derive(world(20_000, true));
  assert.equal(rich.coinProgress, 1);
  const mergeWorld = world(20_000, true);
  mergeWorld.haven.tileStages.mossprout = 4;
  const complete = derive(mergeWorld);
  assert.equal(complete.hudState, 'complete');
  assert.equal(complete.next, null);
});
