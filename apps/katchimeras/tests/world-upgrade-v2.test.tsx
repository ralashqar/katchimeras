import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createInitialMergeWorldState, normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { WORLD_UPGRADE_DEFINITIONS, worldUpgradeOffers } from '@/features/world-upgrades/world-upgrade-offers';
import { WORLD_UPGRADE_STORIES, upgradePercent, upgradeSpeaker } from '@/features/world-upgrades/world-upgrade-stories';
import { reconcileUpgradeProgress } from '@/features/world-upgrades/world-upgrade-progress';
import { katchimeraSkinById } from '@/constants/katchimera-skins';
import { LEGACY_WORLD_UPGRADE_FLOWS, WORLD_UPGRADE_FLOWS } from '@/features/world-upgrades/world-upgrade-flows';
import * as upgradePanelModel from '@/features/upgrade-stage/upgrade-panel-model';
import { upgradeStageLayout } from '@/features/upgrade-stage/upgrade-stage-layout';
import { loadNativeModule, nativeMotionHarness, nativeViews } from './helpers/native-motion-harness';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const NOW = Date.UTC(2026, 8, 6);
const initial = () => ({ ...createInitialMergeWorldState(NOW, ['mossprout']), coins: 10000 });
test('shared dialogue portrait preserves the world-selector circle and art geometry', () => {
  const module = loadNativeModule('components/katchadeck/world/haven-character-portrait.tsx', {
    'react-native': nativeViews, 'expo-image': { Image: 'Image' },
  });
  for (const size of [156, 72]) {
    const portrait = module.HavenCharacterPortrait({ source: 42, size });
    const [circle, art] = portrait.props.children;
    assert.equal(portrait.props.style.width, size);
    assert.ok(Math.abs(circle.props.style.width - 112 * size / 156) < 1e-9);
    assert.ok(Math.abs(circle.props.style.borderRadius - 56 * size / 156) < 1e-9);
    assert.ok(Math.abs(circle.props.style.top - 20 * size / 156) < 1e-9);
    assert.equal(circle.props.style.borderColor, '#FFF6D8');
    assert.equal(art.props.style.width, size); assert.equal(art.props.source, 42);
  }
});
test('Glow percent cannot signal affordable before exact cost', () => {
  assert.deepEqual([0, 10, 19.99, 20, 40].map((balance) => upgradePercent(balance, 20)), [0, 50, 99, 100, 100]);
  assert.equal(upgradePercent(0, 0), 100); assert.equal(upgradePercent(-1, 20), 0);
  const offers = worldUpgradeOffers(initial());
  assert.equal(offers.find((offer) => offer.id === 'haven:mossprout')?.maxLevel, 4);
  assert.equal(offers.find((offer) => offer.id === 'mist:steppling-home')?.maxLevel, 1);
});
test('legacy fully grown islands bring their friend home once, across reload, with no story grant left behind', () => {
  const grown = initial();
  const legacy = { ...grown, version: 23, upgradeSkinGrants: { 'nature:orchard-grove:4': { skinId: 'amberleaf', grantedAt: NOW - 1 } },
    haven: { ...grown.haven, mossproutNatureIslands: { ...grown.haven.mossproutNatureIslands, 'orchard-grove': 4 as const, 'wildgrowth-grove': 4 as const } } };
  let state = normalizeMergeWorldState(JSON.parse(JSON.stringify(legacy)), NOW);
  assert.equal(state.haven.mossproutNatureIslands['orchard-grove'], 4, 'earned levels are never put back under mist');
  assert.equal(state.haven.mossproutNatureIslands['wildgrowth-grove'], 4);
  for (const [islandId, skinId] of [['orchard-grove', 'amberleaf'], ['wildgrowth-grove', 'fernip']] as const) {
    assert.equal(state.ownedKatchimeraCards.filter((card) => card.cardId === skinId).length, 1, `${skinId} is home exactly once`);
    assert.equal(state.ownedKatchimeraCards.find((card) => card.cardId === skinId)?.acquisition, 'island_campaign');
    assert.equal(reduceMergeWorld(state, { type: 'upgradeMossproutNatureIsland', islandId, level: 4, now: NOW, receiptId: `v2:${islandId}:4` }).changed, false);
  }
  assert.deepEqual(state.upgradeSkinGrants, {}, 'island stories no longer mint grants');
  state = normalizeMergeWorldState(JSON.parse(JSON.stringify(state)), NOW);
  assert.equal(state.ownedKatchimeraCards.filter((card) => card.cardId === 'amberleaf' || card.cardId === 'fernip').length, 2);
  assert.ok(state.mossproutResidentSkinIds.includes('fernip'));
});
test('read cursors clamp to available dialogue and do not mutate currency or tiles', () => {
  const state = initial();
  const reconciled = reconcileUpgradeProgress({ ...state, upgradeStoryRead: { 'haven:mossprout:1': 500, 'nature:seed-nursery:4': 2, bogus: 8 } });
  assert.deepEqual(reconciled.upgradeStoryRead, { 'haven:mossprout:1': 3 });
  assert.equal(reconciled.coins, state.coins); assert.deepEqual(reconciled.haven, state.haven);
});
