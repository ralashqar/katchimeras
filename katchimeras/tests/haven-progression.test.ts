import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createInitialMergeWorldState, normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { mossproutFtueStep } from '@/features/onboarding/mossprout-ftue-script';
import type { MergeWorldState } from '@/types/merge-world';

const NOW = Date.UTC(2026, 7, 18, 12);

function mossproutWorld(): MergeWorldState {
  const fresh = createInitialMergeWorldState(NOW, ['mossprout']);
  return {
    ...fresh,
    coins: 2_000,
    characterProgress: {
      ...fresh.characterProgress,
      mossprout: { friendshipLevel: 4, completedChapterIds: ['mossprout-chapter-0'] },
    },
  };
}

test('Haven upgrades are linear, story-gated, and debit Merge Coins atomically', () => {
  let state = mossproutWorld();
  const skipped = reduceMergeWorld(state, { type: 'upgradeHavenTile', characterId: 'mossprout', stage: 2, now: NOW + 1 });
  assert.equal(skipped.changed, false);

  const first = reduceMergeWorld(state, { type: 'upgradeHavenTile', characterId: 'mossprout', stage: 1, now: NOW + 2 });
  assert.equal(first.changed, true);
  assert.equal(first.state.haven.tileStages.mossprout, 1);
  assert.equal(first.state.coins, 1_850);
  assert.equal(first.state.haven.revealState, 'first_restore_complete');

  const locked = reduceMergeWorld(first.state, { type: 'upgradeHavenTile', characterId: 'mossprout', stage: 2, now: NOW + 3 });
  assert.equal(locked.changed, false);
  state = reduceMergeWorld(first.state, { type: 'reconcileHavenStory', characterId: 'mossprout', storyLevel: 2, now: NOW + 4 }).state;
  const second = reduceMergeWorld(state, { type: 'upgradeHavenTile', characterId: 'mossprout', stage: 2, now: NOW + 5 });
  assert.equal(second.changed, true);
  assert.equal(second.state.haven.tileStages.mossprout, 2);
  assert.equal(second.state.coins, 1_450);
});

test('v13 Mossprout saves reset into the v18 personal-world contract', () => {
  const current = mossproutWorld();
  const legacy = { ...current, version: 13, haven: undefined };
  const migrated = normalizeMergeWorldState(legacy, NOW);
  assert.equal(migrated.version, 18);
  assert.equal(migrated.ownerCharacterId, 'mossprout');
  assert.equal(migrated.haven.tileStages.mossprout, undefined);
  assert.equal(migrated.haven.revealState, 'hidden');
});

test('procedural Merge orders fill three slots and remain separate from story orders', () => {
  const fresh = createInitialMergeWorldState(NOW, ['mossprout', 'steppling']);
  fresh.unlockedChains = ['nature:garden', 'nature:waterside', 'adventure:trail', 'adventure:travel'];
  const state = normalizeMergeWorldState(fresh, NOW);
  const procedural = state.activeOrders.filter((order) => !order.storyArcId);
  assert.equal(procedural.length, 3);
  assert.ok(procedural.every((order) => order.purpose === 'normal' && !order.signature && !order.chapterId));
});

test('Mossprout FTUE returns after the first order and completes on the companion page', () => {
  assert.equal(mossproutFtueStep('merge.serve_sprout')?.edges?.[0]?.nextStepId, 'companion.chapter_zero_return');
  assert.equal(mossproutFtueStep('companion.chapter_zero_return')?.actions[0]?.nextStepId, 'complete');
  assert.equal(mossproutFtueStep('haven.reveal')?.surface, 'haven');
  assert.equal(mossproutFtueStep('haven.reveal')?.actions[0]?.nextStepId, 'complete');
  assert.equal(mossproutFtueStep('haven.reveal')?.actions[0]?.title, 'Finish');
});

test('the later Haven reveal remains standalone without reopening the global Merge route', () => {
  const rosterRoute = readFileSync('components/katchadeck/roster/katchimera-roster-route-screen.tsx', 'utf8');
  const mergeRoute = readFileSync('components/katchadeck/games/merge-world-screen.tsx', 'utf8');
  const restoreHandler = rosterRoute.match(/onFtueRestore=\{\(\) => \{[\s\S]*?\n\s*\}\}\n\s*onFtueReveal=/)?.[0] ?? '';

  assert.match(restoreHandler, /dispatchFtueEvent\(\{[\s\S]*?type: 'haven_upgrade_completed'/);
  assert.doesNotMatch(restoreHandler, /beginMossproutChapterOne/);
  assert.doesNotMatch(restoreHandler, /transitionTo|router\.(?:push|dismissTo)/);
  assert.match(rosterRoute, /onFtueReveal=\{\(\) => \{[\s\S]*?commitFtueAction\(\{ actionId: 'haven\.reveal_world'/);
  assert.doesNotMatch(rosterRoute, /onFtueReveal=\{\(\) => \{[\s\S]*?target: 'merge'/);
  assert.match(mergeRoute, /ftueRun\.stepId !== 'companion\.chapter_zero_return'[\s\S]*?target: 'companion'/);
});
