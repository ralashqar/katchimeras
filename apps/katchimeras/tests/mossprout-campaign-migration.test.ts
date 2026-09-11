import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from './helpers/content-fs';

import { createInitialMergeWorldState } from '@/utils/merge-world/engine';
import { worldAlreadyOnMossproutCampaignV2 } from '@/utils/merge-world/mossprout-campaign-v2-guard';
import { buildPlayerProfileFixtures } from '@/utils/player-profile-fixtures';

const NOW = Date.parse('2026-09-11T12:00:00Z');

test('the campaign migration never resets a world that is already on the campaign, only one with nothing of it', () => {
  // Every Kingdom snapshot is on the campaign: a lesson, a wish, an island story, a cleared mist.
  for (const fixture of buildPlayerProfileFixtures(NOW)) {
    assert.equal(worldAlreadyOnMossproutCampaignV2(fixture.domains.mergeWorld.state), true, `${fixture.id} must never be reset by the migration`);
  }
  const fresh = createInitialMergeWorldState(NOW);
  assert.equal(worldAlreadyOnMossproutCampaignV2(fresh), true, 'a brand-new world has nothing to migrate');
  // A world with commands behind it but nothing the campaign writes: the only kind the reset is for.
  const legacy = { ...fresh, revision: 40, kingdomGoal: undefined, islandCampaigns: undefined, worldUnlocks: undefined, glowDiscoveryLesson: undefined, stepplingGardenLesson: undefined };
  assert.equal(worldAlreadyOnMossproutCampaignV2(legacy), false);
  assert.equal(worldAlreadyOnMossproutCampaignV2({ ...legacy, kingdomGoal: { introducedAt: NOW, coachmarkSeenAt: null } }), true, 'the Kingdom wish is proof');
  assert.equal(worldAlreadyOnMossproutCampaignV2({ ...legacy, haven: { ...legacy.haven, mossproutNatureIslands: { ...legacy.haven.mossproutNatureIslands, 'bloom-garden': 1 } } }), true, 'a grown island is proof');
  assert.equal(worldAlreadyOnMossproutCampaignV2({ ...legacy, haven: { ...legacy.haven, mossproutNatureIslandReveals: { 'bloom-garden': { revealedAt: NOW, receiptId: 'r', paid: 40 } } } }), true, 'a cleared mist is proof');
  assert.equal(worldAlreadyOnMossproutCampaignV2({ ...legacy, stepplingGardenLesson: { preparedAt: NOW } }), true, 'Steppling’s lesson is proof');

  const migration = readFileSync('utils/mossprout-campaign-v2-migration.ts', 'utf8');
  assert.match(migration, /const previousWorld = await loadMergeWorldState\(now\);\s*if \(worldAlreadyOnMossproutCampaignV2\(previousWorld\)\) \{\s*markMossproutCampaignMigrated\(now\);\s*return false;\s*\}/, 'the world is checked before anything is touched');
  assert.match(migration, /export function markMossproutCampaignMigrated\(now = Date\.now\(\)\): void \{\s*setStoredJson<MigrationMarker>\(MARKER_KEY, \{ version: MOSSPROUT_CAMPAIGN_VERSION, completedAt: now \}\);/);
  // A loaded snapshot and a dev reset both leave a world on the campaign, and say so.
  assert.match(readFileSync('utils/player-profile-snapshots.ts', 'utf8'), /\]\);\s*\/\/ The world just installed is on the current campaign[^\n]*\n\s*markMossproutCampaignMigrated\(\);\s*\}/);
  assert.match(readFileSync('utils/reset-katchimera-progress-for-debug.ts', 'utf8'), /await resetContentFlowJournalForDebug\(\);[\s\S]*?markMossproutCampaignMigrated\(resetAt\);/);
  // The loader never falls back in silence.
  const repository = readFileSync('utils/merge-world/repository.ts', 'utf8');
  assert.match(repository, /console\.warn\('Merge world: the stored world could not be read; falling back', error\);/);
});
