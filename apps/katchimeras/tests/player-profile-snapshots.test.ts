import assert from 'node:assert/strict';
import { readFileSync } from './helpers/content-fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { MOSSPROUT_FTUE_SCRIPT } from '@/features/onboarding/mossprout-ftue-script';
import { buildPlayerProfileFixtures, PLAYER_PROFILE_FIXTURE_COUNT } from '@/utils/player-profile-fixtures';

const NOW = Date.parse('2026-08-17T12:00:00Z');
const root = resolve(__dirname, '..');
const read = (relative: string) => readFileSync(resolve(root, relative), 'utf8');

test('profile fixture catalog covers every planned discovery milestone', () => {
  const fixtures = buildPlayerProfileFixtures(NOW);
  assert.equal(PLAYER_PROFILE_FIXTURE_COUNT, 17);
  assert.equal(fixtures.length, 17);
  assert.equal(new Set(fixtures.map((fixture) => fixture.id)).size, fixtures.length);
  assert.deepEqual(fixtures.map((fixture) => fixture.id), [
    'fixture:fresh-first-launch', 'fixture:mossprout-merge-start', 'fixture:mossprout-haven-restore',
    'fixture:steppling-parcel', 'fixture:steppling-final-clue', 'fixture:steppling-first-order',
    'fixture:gate-3-fork', 'fixture:gate-3-feastle-parcel', 'fixture:gate-3-feastle-final', 'fixture:gate-4-queued',
    'fixture:gate-4-fork', 'fixture:gate-4-baristabbit-parcel', 'fixture:gate-4-baristabbit-final', 'fixture:gate-5-queued',
    'fixture:gate-5-bedrotte-parcel', 'fixture:gate-5-bedrotte-final', 'fixture:early-pool-complete',
  ]);
});

test('Mossprout Haven fixture opens immediately before the first environment restore', () => {
  const fixture = buildPlayerProfileFixtures(NOW).find((candidate) => candidate.id === 'fixture:mossprout-haven-restore');
  assert.ok(fixture);
  assert.equal(fixture.launchRoute, '/(tabs)/katchimeras');
  assert.equal(fixture.summary.ftueStep, 'haven.mossprout.restore');
  assert.equal(fixture.domains.mergeWorld.state.coins, 170);
  assert.equal(fixture.domains.mergeWorld.state.haven.tileStages.mossprout, 0);
  assert.equal(fixture.domains.mergeWorld.state.haven.revealState, 'hidden');
  assert.ok(fixture.domains.mergeWorld.state.characterProgress.mossprout?.completedChapterIds.includes('mossprout-chapter-0'));
  assert.equal(fixture.summary.pendingParcelCount, 1);

  const run = JSON.parse(fixture.domains.keyValue.values['katchimeras.ftue-run.v4'] ?? '{}') as {
    mergeInstalled?: boolean;
    scriptVersion?: number;
    stepId?: string;
  };
  assert.equal(run.stepId, 'haven.mossprout.restore');
  assert.equal(run.scriptVersion, MOSSPROUT_FTUE_SCRIPT.version);
  assert.equal(run.mergeInstalled, true);
});

test('every authored profile fixture is internally coherent and synthetic', () => {
  for (const fixture of buildPlayerProfileFixtures(NOW)) {
    assert.equal(fixture.schemaVersion, 1);
    assert.equal(fixture.source, 'fixture');
    assert.equal(fixture.timePolicy, 'relative');
    assert.equal(fixture.domains.mergeWorld.state.board.length, 63);
    const ids = fixture.domains.mergeWorld.state.board.flatMap((cell) => cell.occupant?.kind === 'item' ? [cell.occupant.instanceId] : []);
    assert.equal(new Set(ids).size, ids.length, `${fixture.id} has duplicate item instances`);
    assert.ok(Object.keys(fixture.domains.keyValue.values).every((key) => !key.includes('.dev.')));
    assert.doesNotMatch(JSON.stringify(fixture.domains.keyValue.values), /localUri|latitude|longitude/);
    const active = fixture.domains.mergeWorld.state.companionDiscovery.active;
    if (active?.selectedCharacterId) assert.ok(active.candidateIds.includes(active.selectedCharacterId));
  }
});

test('parcel and final-clue fixtures land on the requested discovery stages', () => {
  const byId = new Map(buildPlayerProfileFixtures(NOW).map((fixture) => [fixture.id, fixture]));
  for (const id of ['fixture:steppling-parcel', 'fixture:gate-3-feastle-parcel', 'fixture:gate-4-baristabbit-parcel', 'fixture:gate-5-bedrotte-parcel']) {
    assert.equal(byId.get(id)?.summary.pendingParcelCount, 1, id);
    assert.equal(byId.get(id)?.summary.discoveryStage, 0, id);
  }
  for (const id of ['fixture:steppling-final-clue', 'fixture:gate-3-feastle-final', 'fixture:gate-4-baristabbit-final', 'fixture:gate-5-bedrotte-final']) {
    assert.equal(byId.get(id)?.summary.pendingParcelCount, 0, id);
    assert.equal(byId.get(id)?.summary.discoveryStage, 2, id);
  }
  assert.deepEqual(byId.get('fixture:early-pool-complete')?.summary.unlockedCharacters, [
    'mossprout', 'steppling', 'feastle', 'baristabbit', 'bedrotte',
  ]);
});

test('checked-in fixtures rebase their clocks at load time', () => {
  const first = buildPlayerProfileFixtures(NOW);
  const later = buildPlayerProfileFixtures(NOW + 7 * 86_400_000);
  assert.equal(Date.parse(later[0].createdAt) - Date.parse(first[0].createdAt), 7 * 86_400_000);
  assert.equal(later[2].domains.mergeWorld.state.createdAt - first[2].domains.mergeWorld.state.createdAt, 7 * 86_400_000);
});

test('profile tooling stays dev-gated, sandboxed, and reachable from the Dev page', () => {
  const manager = read('components/katchadeck/dev/profile-snapshot-manager-screen.tsx');
  const layout = read('app/_layout.tsx');
  const devPage = read('app/(tabs)/explore.tsx');
  const ftueSync = read('features/onboarding/ftue-sync.ts');
  const economy = read('features/economy/economy-provider.tsx');
  const streak = read('utils/streak-sync.ts');
  const service = read('utils/player-profile-snapshots.ts');
  const profileRegistry = read('utils/player-profile-domain-registry.ts');

  assert.match(manager, /DEV_TOOLS_ENABLED/);
  assert.match(service, /assertDevTools\(\)/);
  assert.match(layout, /dev-profile-snapshots/);
  assert.match(devPage, /Profile Snapshots/);
  assert.match(ftueSync, /isDevProfileSandboxActive\(\)/);
  assert.match(economy, /isDevProfileSandboxActive\(\)/);
  assert.match(streak, /isDevProfileSandboxActive\(\)/);
  assert.match(service, /savePlayerProfileRollback/);
  assert.match(service, /recoverInterruptedPlayerProfileRestore/);
  assert.match(profileRegistry, /katchimeras\.relationship-progression-v2/);
  assert.match(service, /relationshipProgressionRepository\.reloadFromStorageForDebug\(\)/);
});
