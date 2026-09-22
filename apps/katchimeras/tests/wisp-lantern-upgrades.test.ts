import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialMergeWorldState } from '@/utils/merge-world/engine';
import { canUpgradeLantern, projectLanternWorld, startLanternWorld, upgradeLanternWorld } from '@/features/wisps/lantern-world';
import { normalizeWispLantern, reduceWispLantern } from '@/utils/wisp-lantern-state';
import { EMPTY_WISP_STATE, normalizeWispState } from '@/utils/wisp-state';
import * as lanternDefinitions from '@/constants/wisp-lantern';
import { albumPhase, wispAlbums, type WispAlbum } from '@/constants/wisp-albums';
import { lanternPackGroups, packOddsText } from '@/utils/wisp-lantern-hub';
import { buildPlayerProfileFixtures } from '@/utils/player-profile-fixtures';
import type { GameplayEvent } from '@/types/gameplay-event';
import { loadNativeModule } from './helpers/native-motion-harness';
import { wispDefinition } from '@/constants/wisps';
import { DEV_TOOLS_ENABLED } from '@/constants/dev';

const NOW = Date.parse('2026-09-20T12:00:00Z');
const { ORDINARY_PACK, ORDINARY_PROTECTION, RARE_PACK, WELCOME_RECEIPT, lanternPackDefinition } = lanternDefinitions;
const event = (n: number, tags = ['first-clear']): GameplayEvent => ({ version: 1, id: `clear:${n}`, kind: 'encounter_cleared', source: 'merge-world', sourceRevision: 1, contentRevision: 1, occurredAt: NOW + n, quantity: 1, context: { targetId: `clear:${n}`, tags } });
const events = (start: number, count: number) => Array.from({ length: count }, (_, i) => event(start + i));
function world() {
  const state = createInitialMergeWorldState(NOW);
  state.kingdomGoal = { introducedAt: NOW, coachmarkSeenAt: NOW };
  state.gardenLessons = { feastle: { preparedAt: NOW, servedAt: NOW } };
  return startLanternWorld(state, NOW);
}
test('milestone upgrades, daily cap, recurring carry and reward versions survive replay', () => {
  let state = world();
  // Ten clears: the first two welcome the Lantern, the eight after count (the day caps at five). A historical clear never counts.
  state = projectLanternWorld(state, [...events(1, 10), { ...event(101), historical: true }]);
  assert.equal(state.wispLanternProgress!.welcomeServed.length, 2);
  assert.equal(state.wispLanternProgress!.lifetimeOrders, 8);
  assert.equal(state.wispLanternProgress!.dailyOrders, 5);
  assert.equal(canUpgradeLantern(state.wispLanternProgress), true);
  assert.throws(() => upgradeLanternWorld(state, 3), 'one level at a time');
  state = upgradeLanternWorld(state, 2);
  assert.equal(upgradeLanternWorld(state, 2), state);
  assert.equal(state.wispLanternProgress!.recurringOrders, 0);
  state = projectLanternWorld(state, events(11, 30));
  const earned = state.wispLanternProgress!.rewards['lantern:recurring:1'];
  assert.equal(earned.packId, ORDINARY_PACK);
  assert.equal(earned.definitionVersion, 1);
  assert.equal(state.wispLanternProgress!.recurringGranted, 3, 'thirty clears at level two: a pack every ten');
  assert.equal(state.wispLanternProgress!.recurringOrders, 0);
  assert.equal(state.wispLanternProgress!.lifetimeOrders, 38);
  state = upgradeLanternWorld(state, 3);
  state = projectLanternWorld(state, events(41, 10));
  assert.equal(state.wispLanternProgress!.rewards['lantern:recurring:4'].packId, RARE_PACK);
  assert.deepEqual(state.wispLanternProgress!.rewards['lantern:recurring:1'], earned);
  const saved = structuredClone(state.wispLanternProgress);
  state = projectLanternWorld(state, events(1, 50));
  assert.deepEqual(state.wispLanternProgress, saved);
  state = projectLanternWorld(state, [{ ...event(51), occurredAt: NOW + 86400000 }]);
  assert.equal(state.wispLanternProgress!.recurringOrders, 1);
  assert.equal(state.wispLanternProgress!.dailyOrders, 1);
});
test('legacy save migration retains opened outcomes and maps ordinary protection', () => {
  let state = reduceWispLantern(EMPTY_WISP_STATE, { type: 'unlock' }, NOW);
  state = reduceWispLantern(state, { type: 'open_pack', packId: WELCOME_RECEIPT }, NOW);
  const raw = { ...state.lantern, version: 1, dryPacks: 2, dryPacksByGroup: undefined };
  const next = normalizeWispLantern(raw);
  assert.equal(next.version, 2);
  assert.equal(next.dryPacksByGroup[ORDINARY_PROTECTION], 2);
  assert.deepEqual(next.packs, raw.packs);
  assert.deepEqual(normalizeWispLantern(next), next);
});
test('rare slot never weakens for missing-card protection and groups stay independent', () => {
  for (let seed = 0; seed < 100; seed++) {
    let state = reduceWispLantern(EMPTY_WISP_STATE, { type: 'unlock' }, NOW);
    state.lantern!.dryPacksByGroup[ORDINARY_PROTECTION] = 2;
    state.lantern!.dryPacksByGroup['lantern-visitors:rare'] = 2;
    state = reduceWispLantern(state, { type: 'grant_pack', receiptId: 'rare', definitionId: RARE_PACK, seed }, NOW);
    state = reduceWispLantern(state, { type: 'open_pack', packId: 'rare' }, NOW, 1, ['crystal']);
    assert.equal(state.lantern!.packs.rare.outcomes![2].id, 'crystal');
    assert.equal(state.lantern!.packs.rare.outcomes![2].echoes, 5);
    assert.equal(state.lantern!.dryPacksByGroup[ORDINARY_PROTECTION], 2);
    assert.equal(reduceWispLantern(state, { type: 'open_pack', packId: 'rare' }, NOW + 1), state);
  }
  assert.match(packOddsText(lanternPackDefinition(RARE_PACK)), /Crystal 100%/);
});
test('season boundaries and dev-only registry do not enable production seasons', () => {
  assert.ok(wispAlbums().every(a => !a.seasonal));
  const album: WispAlbum = { id: 'test', name: 'Test', description: '', seasonal: true, artKey: 'pack', sets: [], reward: { id: 'r', label: 'R' }, startsAt: 100, endsAt: 200, claimEndsAt: 300 };
  assert.equal(albumPhase(album, 99), 'upcoming');
  assert.equal(albumPhase(album, 100), 'active');
  assert.equal(albumPhase(album, 200), 'claim');
  assert.equal(albumPhase(album, 300), 'archived');
});
test('season packs retain identity after expiry; claims have a deadline and cannot buy story Wisps', () => {
  const registry = loadNativeModule('constants/wisp-albums.ts', {
    './wisp-lantern': lanternDefinitions, './dev': { DEV_TOOLS_ENABLED: true }, './wisps': { wispDefinition },
  });
  const reducer = loadNativeModule('utils/wisp-lantern-state.ts', { '@/constants/wisp-albums': registry }, { structuredClone });
  let state = reducer.reduceWispLantern(EMPTY_WISP_STATE, { type: 'unlock' }, NOW);
  state.lantern.previewSeasonStartedAt = NOW;
  state = reducer.reduceWispLantern(state, { type: 'grant_pack', receiptId: 'season', definitionId: 'dev-moonlit-pack', seed: 3 }, NOW);
  const late = NOW + 20 * 86400000;
  state = reducer.reduceWispLantern(state, { type: 'open_pack', packId: 'season' }, late);
  assert.equal(state.lantern.packs.season.definitionId, 'dev-moonlit-pack');
  assert.equal(state.lantern.packs.season.outcomes.length, 3);
  assert.throws(() => reducer.reduceWispLantern(state, { type: 'claim_collection', collectionId: 'dev-moonlit-preview' }, late), /claim period/);
  assert.throws(() => reducer.reduceWispLantern(state, { type: 'grant_pack', receiptId: 'too-late', definitionId: 'dev-moonlit-pack', seed: 3 }, late), /not awarding/);
  state.lantern.echoes = 100;
  assert.throws(() => reducer.reduceWispLantern(state, { type: 'exchange', receiptId: 'story', wispId: 'sprout' }, NOW), /missing Lantern visitor/);
});
test('upgrade snapshots preserve played-through world and expose grouped owned packs', () => {
  for (const target of [2, 3]) {
    const snapshot = buildPlayerProfileFixtures(NOW).find(f => f.id === `fixture:lantern-level-${target}-ready`)!;
    assert.ok(snapshot.domains.mergeWorld.state.wispLanternPlacement);
    assert.equal(canUpgradeLantern(snapshot.domains.mergeWorld.state.wispLanternProgress), true);
    const state = normalizeWispState(JSON.parse(snapshot.domains.keyValue.values['katchimera.wisps.v2']));
    assert.ok(state.lantern!.introducedAt);
    const groups = lanternPackGroups(state.lantern, NOW);
    assert.equal(groups.length, 2);
    assert.equal(groups[0].packs.length, 2);
    assert.equal(groups[0].packs[0].id, 'fixture:pack:0');
    assert.equal(groups[1].definition.id, RARE_PACK);
  }
});

test('season preview is explicitly dev-gated and its pack sorts before permanent groups', () => {
  const fixture = buildPlayerProfileFixtures(NOW).find(f => f.id === 'fixture:lantern-season-preview');
  if (!DEV_TOOLS_ENABLED) { assert.equal(fixture, undefined); return; }
  assert.ok(fixture);
  const state = normalizeWispState(JSON.parse(fixture.domains.keyValue.values['katchimera.wisps.v2']));
  assert.equal(lanternPackGroups(state.lantern, NOW)[0].definition.id, 'dev-moonlit-pack');
  assert.equal(lanternPackGroups(state.lantern, NOW + 20 * 86400000).at(-1)!.definition.id, 'dev-moonlit-pack');
  assert.equal(wispAlbums(state.lantern!.previewSeasonStartedAt).length, 2);
});
