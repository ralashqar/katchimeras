import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createInitialMergeWorldState, normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { mossproutFtueStep } from '@/features/onboarding/mossprout-ftue-script';

const NOW = Date.UTC(2026, 7, 18, 12);

function mossproutWorld() {
  const fresh = createInitialMergeWorldState(NOW, ['mossprout']);
  return normalizeMergeWorldState({
    ...fresh,
    coins: 2_000,
    characterProgress: {
      ...fresh.characterProgress,
      mossprout: { friendshipLevel: 4, completedChapterIds: ['mossprout-chapter-0'] },
    },
  }, NOW);
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

test('v13 Mossprout saves backfill a restored tile without charging again', () => {
  const current = mossproutWorld();
  const legacy = { ...current, version: 13, haven: undefined };
  const migrated = normalizeMergeWorldState(legacy, NOW);
  assert.equal(migrated.version, 14);
  assert.equal(migrated.haven.tileStages.mossprout, 1);
  assert.equal(migrated.haven.revealState, 'revealed');
  assert.equal(migrated.coins, current.coins);
});

test('procedural Merge orders fill three slots and remain separate from story orders', () => {
  const fresh = createInitialMergeWorldState(NOW, ['mossprout', 'steppling']);
  fresh.unlockedChains = ['nature:garden', 'nature:waterside', 'adventure:trail', 'adventure:travel'];
  const state = normalizeMergeWorldState(fresh, NOW);
  const procedural = state.activeOrders.filter((order) => !order.storyArcId);
  assert.equal(procedural.length, 3);
  assert.ok(procedural.every((order) => order.purpose === 'normal' && !order.signature && !order.chapterId));
});

test('Mossprout FTUE teaches the tile HUD before restore, then reveals Haven before the trail merge', () => {
  assert.equal(mossproutFtueStep('companion.chapter_zero_return')?.actions[0]?.nextStepId, 'haven.mossprout.focus');
  assert.equal(mossproutFtueStep('haven.mossprout.focus')?.camera?.kind, 'focus_target');
  assert.equal(mossproutFtueStep('haven.mossprout.focus')?.actions[0]?.nextStepId, 'haven.mossprout.restore');
  assert.equal(mossproutFtueStep('haven.mossprout.restore')?.surface, 'haven');
  assert.equal(mossproutFtueStep('haven.mossprout.restore')?.cue?.kind, 'tap');
  assert.equal(mossproutFtueStep('haven.mossprout.restore')?.edges?.[0]?.nextStepId, 'haven.reveal');
  assert.equal(mossproutFtueStep('haven.reveal')?.actions[0]?.nextStepId, 'discovery.steppling.parcel');
  assert.equal(mossproutFtueStep('haven.reveal')?.actions[0]?.title, 'Continue to Merge');
  assert.equal(mossproutFtueStep('discovery.steppling.parcel')?.edges?.[0]?.nextStepId, 'discovery.steppling.sock');
});

test('Mossprout restore stays in Haven and legacy Merge saves require an explicit return', () => {
  const rosterRoute = readFileSync('components/katchadeck/roster/katchimera-roster-route-screen.tsx', 'utf8');
  const mergeRoute = readFileSync('components/katchadeck/games/merge-world-screen.tsx', 'utf8');
  const restoreHandler = rosterRoute.match(/onFtueRestore=\{\(\) => \{[\s\S]*?\n\s*\}\}\n\s*onFtueReveal=/)?.[0] ?? '';

  assert.match(restoreHandler, /dispatchFtueEvent\(\{[\s\S]*?type: 'haven_upgrade_completed'/);
  assert.doesNotMatch(restoreHandler, /transitionTo|router\.(?:push|dismissTo)/);
  assert.match(rosterRoute, /onFtueReveal=\{\(\) => \{[\s\S]*?transitionTo\(\{[\s\S]*?target: 'merge'[\s\S]*?router\.navigate\(\{ pathname: '\/games'/);
  assert.match(mergeRoute, /label="Visit Haven" onPress=\{openFtueHavenReveal\}/);
  assert.doesNotMatch(mergeRoute, /useEffect\(\(\) => \{[\s\S]{0,400}ftueRun\.stepId !== 'haven\.reveal'/);
});
