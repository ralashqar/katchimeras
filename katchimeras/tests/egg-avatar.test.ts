import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { EGG_AVATAR_FACE_IDS, EGG_AVATAR_SKIN_IDS } from '../types/egg-avatar';
import { EGG_AVATAR_FACE_LAYOUT } from '../constants/egg-avatar-face-layout';
import {
  DEFAULT_EGG_AVATAR_SELECTION,
  isEggAvatarSkinId,
  normalizeEggAvatarSelection,
} from '../utils/egg-avatar-rules';

const root = path.resolve(import.meta.dirname, '..');

test('egg avatar selection accepts only the versioned launch catalog', () => {
  assert.deepEqual(normalizeEggAvatarSelection({ version: 1, equippedSkinId: 'moss' }), {
    version: 2,
    equippedSkinId: 'moss',
    equippedFaceId: 'classic-smile',
  });
  assert.deepEqual(normalizeEggAvatarSelection({ version: 1, equippedSkinId: 'missing' }), DEFAULT_EGG_AVATAR_SELECTION);
  assert.deepEqual(normalizeEggAvatarSelection({ version: 2, equippedSkinId: 'moss', equippedFaceId: 'classic-smile' }), {
    version: 2,
    equippedSkinId: 'moss',
    equippedFaceId: 'classic-smile',
  });
  assert.deepEqual(normalizeEggAvatarSelection({ version: 2, equippedSkinId: 'pumpkin', equippedFaceId: 'curious' }), {
    version: 2,
    equippedSkinId: 'pumpkin',
    equippedFaceId: 'curious',
  });
  assert.deepEqual(normalizeEggAvatarSelection({ version: 2, equippedSkinId: 'moss', equippedFaceId: 'missing' }), DEFAULT_EGG_AVATAR_SELECTION);
  assert.deepEqual(normalizeEggAvatarSelection(null), DEFAULT_EGG_AVATAR_SELECTION);
  assert.equal(isEggAvatarSkinId('barista'), true);
  assert.equal(isEggAvatarSkinId('robot'), true);
  assert.equal(isEggAvatarSkinId('pumpkin'), true);
  assert.equal(isEggAvatarSkinId('lattelet'), false);
});

test('launch catalog has stable unique ids and Classic is first', () => {
  assert.equal(EGG_AVATAR_SKIN_IDS.length, 10);
  assert.equal(new Set(EGG_AVATAR_SKIN_IDS).size, EGG_AVATAR_SKIN_IDS.length);
  assert.equal(EGG_AVATAR_SKIN_IDS[0], 'classic');
  assert.equal(EGG_AVATAR_FACE_IDS.length, 5);
  assert.equal(new Set(EGG_AVATAR_FACE_IDS).size, EGG_AVATAR_FACE_IDS.length);
  assert.equal(EGG_AVATAR_FACE_IDS[0], 'classic-smile');
});

test('every launch skin has approved production assets and manifest provenance', () => {
  const assetRoot = path.join(root, 'assets', 'images', 'katchimeras', 'egg-avatars');
  const manifest = JSON.parse(readFileSync(path.join(assetRoot, 'manifest.json'), 'utf8')) as {
    artDirectionVersion?: number;
    effects?: Record<string, unknown>;
    faceLayout?: typeof EGG_AVATAR_FACE_LAYOUT;
    faces?: Record<string, { faceLayoutVersion?: number }>;
    skins?: Record<string, { version?: number; faceLayoutVersion?: number; baseOutputs?: unknown }>;
  };

  assert.equal(manifest.artDirectionVersion, 4);
  assert.deepEqual(manifest.faceLayout, EGG_AVATAR_FACE_LAYOUT);

  for (const skinId of EGG_AVATAR_SKIN_IDS) {
    assert.equal(existsSync(path.join(assetRoot, `${skinId}.png`)), true, `${skinId} png`);
    assert.equal(existsSync(path.join(assetRoot, `${skinId}.webp`)), true, `${skinId} webp`);
    assert.equal(existsSync(path.join(assetRoot, 'thumbnails', `${skinId}.webp`)), true, `${skinId} thumbnail`);
    assert.ok(manifest.skins?.[skinId], `${skinId} manifest entry`);
    assert.ok((manifest.skins?.[skinId]?.version ?? 0) >= 2, `${skinId} art version`);
    assert.equal(existsSync(path.join(assetRoot, 'bases', `${skinId}.png`)), true, `${skinId} base png`);
    assert.equal(existsSync(path.join(assetRoot, 'bases', `${skinId}.webp`)), true, `${skinId} base webp`);
    assert.equal(existsSync(path.join(assetRoot, 'bases', 'thumbnails', `${skinId}.webp`)), true, `${skinId} base thumbnail`);
    assert.ok(manifest.skins?.[skinId]?.baseOutputs, `${skinId} layered base manifest`);
  }

  for (const faceId of EGG_AVATAR_FACE_IDS) {
    assert.equal(existsSync(path.join(assetRoot, 'faces', `${faceId}.png`)), true, `${faceId} face png`);
    assert.equal(existsSync(path.join(assetRoot, 'faces', `${faceId}.webp`)), true, `${faceId} face webp`);
    assert.equal(existsSync(path.join(assetRoot, 'faces', 'thumbnails', `${faceId}.webp`)), true, `${faceId} face thumbnail`);
    assert.ok(manifest.faces?.[faceId], `${faceId} face manifest`);
  }

  for (const stage of ['crack-1', 'crack-2']) {
    assert.equal(existsSync(path.join(assetRoot, 'effects', `${stage}.png`)), true, `${stage} png`);
    assert.equal(existsSync(path.join(assetRoot, 'effects', `${stage}.webp`)), true, `${stage} webp`);
    assert.ok(manifest.effects?.[stage], `${stage} manifest entry`);
  }
});

test('canonical face anchors stay inside the protected compositing zone', () => {
  const { anchors, safeZone } = EGG_AVATAR_FACE_LAYOUT;
  for (const [name, anchor] of Object.entries(anchors)) {
    assert.ok(anchor.x >= safeZone.left && anchor.x <= safeZone.right, `${name} x`);
    assert.ok(anchor.y >= safeZone.top && anchor.y <= safeZone.bottom, `${name} y`);
  }
});

test('Today egg uses the shared calibrated body and face compositor', () => {
  const sources = [
    path.join('components', 'katchadeck', 'home', 'egg-shell.tsx'),
    path.join('components', 'katchadeck', 'home', 'today-kingdom-egg-hero.tsx'),
    path.join('components', 'katchadeck', 'home', 'today-tile-hatch-reveal.tsx'),
    path.join('components', 'katchadeck', 'home', 'today-deck', 'forming-egg-item.tsx'),
  ].map((relativePath) => readFileSync(path.join(root, relativePath), 'utf8'));

  for (const source of sources) {
    assert.match(source, /useEggAvatar\(\)/);
    assert.match(source, /EggAvatarArtwork/);
    assert.match(source, /equippedSkinId/);
    assert.match(source, /equippedFaceId/);
    assert.doesNotMatch(source, /cutouts\/egg-base/);
  }

  const compositor = readFileSync(
    path.join(root, 'components', 'katchadeck', 'egg-avatar', 'egg-avatar-artwork.tsx'),
    'utf8'
  );
  assert.match(compositor, /EGG_AVATAR_FACE_PRESENTATION_SCALE = 0\.92/);
  assert.ok(compositor.indexOf('egg-body-') < compositor.indexOf('egg-face-'), 'body renders before face');
});

test('accessory-heavy skins carry explicit core-silhouette calibration', () => {
  const catalog = readFileSync(path.join(root, 'constants', 'egg-avatar-skins.ts'), 'utf8');
  for (const skinId of ['moss', 'barista', 'pumpkin']) {
    const start = catalog.indexOf(`id: '${skinId}'`);
    const next = catalog.indexOf("id: '", start + 5);
    const entry = catalog.slice(start, next < 0 ? undefined : next);
    assert.match(entry, /presentation: \{ scale: 1\.0[5-8], offsetX: 0, offsetY: -0\.0(?:1|12|18) \}/);
  }
});
