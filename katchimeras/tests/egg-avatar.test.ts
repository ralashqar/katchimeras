import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { EGG_AVATAR_SKIN_IDS } from '../types/egg-avatar';
import {
  DEFAULT_EGG_AVATAR_SELECTION,
  isEggAvatarSkinId,
  normalizeEggAvatarSelection,
} from '../utils/egg-avatar-rules';

const root = path.resolve(import.meta.dirname, '..');

test('egg avatar selection accepts only the versioned launch catalog', () => {
  assert.deepEqual(normalizeEggAvatarSelection({ version: 1, equippedSkinId: 'moss' }), {
    version: 1,
    equippedSkinId: 'moss',
  });
  assert.deepEqual(normalizeEggAvatarSelection({ version: 1, equippedSkinId: 'missing' }), DEFAULT_EGG_AVATAR_SELECTION);
  assert.deepEqual(normalizeEggAvatarSelection({ version: 2, equippedSkinId: 'moss' }), DEFAULT_EGG_AVATAR_SELECTION);
  assert.deepEqual(normalizeEggAvatarSelection(null), DEFAULT_EGG_AVATAR_SELECTION);
  assert.equal(isEggAvatarSkinId('barista'), true);
  assert.equal(isEggAvatarSkinId('lattelet'), false);
});

test('launch catalog has stable unique ids and Classic is first', () => {
  assert.equal(EGG_AVATAR_SKIN_IDS.length, 8);
  assert.equal(new Set(EGG_AVATAR_SKIN_IDS).size, EGG_AVATAR_SKIN_IDS.length);
  assert.equal(EGG_AVATAR_SKIN_IDS[0], 'classic');
});

test('every launch skin has approved production assets and manifest provenance', () => {
  const assetRoot = path.join(root, 'assets', 'images', 'katchimeras', 'egg-avatars');
  const manifest = JSON.parse(readFileSync(path.join(assetRoot, 'manifest.json'), 'utf8')) as {
    artDirectionVersion?: number;
    effects?: Record<string, unknown>;
    skins?: Record<string, { version?: number }>;
  };

  assert.equal(manifest.artDirectionVersion, 2);

  for (const skinId of EGG_AVATAR_SKIN_IDS) {
    assert.equal(existsSync(path.join(assetRoot, `${skinId}.png`)), true, `${skinId} png`);
    assert.equal(existsSync(path.join(assetRoot, `${skinId}.webp`)), true, `${skinId} webp`);
    assert.equal(existsSync(path.join(assetRoot, 'thumbnails', `${skinId}.webp`)), true, `${skinId} thumbnail`);
    assert.ok(manifest.skins?.[skinId], `${skinId} manifest entry`);
    assert.equal(manifest.skins?.[skinId]?.version, 2, `${skinId} art version`);
  }

  for (const stage of ['crack-1', 'crack-2']) {
    assert.equal(existsSync(path.join(assetRoot, 'effects', `${stage}.png`)), true, `${stage} png`);
    assert.equal(existsSync(path.join(assetRoot, 'effects', `${stage}.webp`)), true, `${stage} webp`);
    assert.ok(manifest.effects?.[stage], `${stage} manifest entry`);
  }
});

test('Today egg renders the equipped skin instead of a fixed Classic asset', () => {
  const sources = [
    path.join('components', 'katchadeck', 'home', 'egg-shell.tsx'),
    path.join('components', 'katchadeck', 'home', 'today-kingdom-egg-hero.tsx'),
    path.join('components', 'katchadeck', 'home', 'today-tile-hatch-reveal.tsx'),
    path.join('components', 'katchadeck', 'home', 'today-deck', 'forming-egg-item.tsx'),
  ].map((relativePath) => readFileSync(path.join(root, relativePath), 'utf8'));

  for (const source of sources) {
    assert.match(source, /useEggAvatar\(\)/);
    assert.match(source, /equippedSkin\.(fullSource|highResolutionSource)/);
    assert.doesNotMatch(source, /cutouts\/egg-base/);
  }
});
