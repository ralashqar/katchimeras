import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  HAVEN_UPGRADE_REDUCED_TIMING,
  HAVEN_UPGRADE_TIMING,
  havenUpgradePhaseAt,
} from '@/utils/haven-upgrade-presentation';

test('Haven upgrade presentation advances through the full restoration sequence', () => {
  assert.equal(havenUpgradePhaseAt(0, false), 'payment');
  assert.equal(havenUpgradePhaseAt(HAVEN_UPGRADE_TIMING.coverAtMs, false), 'cover');
  assert.equal(havenUpgradePhaseAt(HAVEN_UPGRADE_TIMING.revealAtMs, false), 'reveal');
  assert.equal(havenUpgradePhaseAt(HAVEN_UPGRADE_TIMING.reactAtMs, false), 'react');
  assert.equal(havenUpgradePhaseAt(HAVEN_UPGRADE_TIMING.completeAtMs, false), 'complete');
});

test('reduced motion omits payment and cover phases and completes quickly', () => {
  assert.equal(havenUpgradePhaseAt(0, true), 'focus');
  assert.equal(havenUpgradePhaseAt(HAVEN_UPGRADE_REDUCED_TIMING.revealAtMs, true), 'reveal');
  assert.equal(havenUpgradePhaseAt(HAVEN_UPGRADE_REDUCED_TIMING.reactAtMs, true), 'react');
  assert.equal(havenUpgradePhaseAt(HAVEN_UPGRADE_REDUCED_TIMING.completeAtMs, true), 'complete');
  assert.ok(HAVEN_UPGRADE_REDUCED_TIMING.completeAtMs < 500);
});

test('negative presentation time is clamped to the first phase', () => {
  assert.equal(havenUpgradePhaseAt(-250, false), 'payment');
  assert.equal(havenUpgradePhaseAt(-250, true), 'focus');
});

test('upgrade energy follows the tile silhouette without central capsule layers', () => {
  const effects = readFileSync('components/katchadeck/world/haven-upgrade-effects.tsx', 'utf8');
  const canvas = readFileSync('components/katchadeck/world/kingdom-hex-canvas.tsx', 'utf8');
  const scene = readFileSync('components/katchadeck/world/kingdom-hex-scene.ts', 'utf8');

  assert.doesNotMatch(effects, /styles\.(?:aura|mist)|borderRadius:\s*999[^\n]*height:\s*(?:142|210)/);
  assert.match(effects, /RISING_PARTICLES = Array\.from\(\{ length: 34 \}/);
  assert.match(effects, /LIGHT_RAYS[\s\S]*?RisingArrow/);
  assert.match(effects, /silhouetteSource[\s\S]*?tintColor=\{presentation\.palette\.glow\}/);
  assert.match(scene, /alphaBounds: selectedBounds/);
  assert.match(canvas, /layer\.alphaBounds\.left \/ layer\.sourceSize\.width[\s\S]*?layer\.alphaBounds\.bottom \/ layer\.sourceSize\.height/);
});

test('upgrade art has one forward-only crossfade owned by the presentation renderer', () => {
  const canvas = readFileSync('components/katchadeck/world/kingdom-hex-canvas.tsx', 'utf8');

  assert.match(canvas, /upgradeOwnsLayer[\s\S]*?havenUpgradeLayerArtChanges/);
  assert.match(canvas, /<KingdomTileArt[\s\S]*?settlingOwnsLayer[\s\S]*?finishSettlingUpgrade/);
  assert.match(canvas, /setSettlingUpgrade\(\{ layers, nonce: presentation\.nonce \}\)/);
  assert.match(canvas, /phase=\{upgradeOwnsLayer \? upgradePhase : 'complete'\}/);
  assert.match(canvas, /const revealProgress = useSharedValue\(revealActive \? 1 : 0\)/);
  assert.match(canvas, /opacity: 1 - revealProgress\.value[\s\S]*?opacity: revealProgress\.value/);
  assert.doesNotMatch(canvas, /oldOpacity\.value = withTiming\(0/);
  assert.doesNotMatch(canvas, /newOpacity\.value = withTiming\(1/);
});
