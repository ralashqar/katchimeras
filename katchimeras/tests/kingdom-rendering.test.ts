import assert from 'node:assert/strict';
import test from 'node:test';

import { KINGDOM_RENDERING } from '../constants/kingdom-rendering';
import { visiblePixelBoundsFromRgba } from '../utils/alpha-bounds';
import {
  cameraTranslationBounds,
  frameToRect,
  kingdomSceneMetrics,
  rectsIntersect,
  residentLodWithHysteresis,
  tileLodWithHysteresis,
  visibleWorldRect,
} from '../utils/kingdom-rendering';
import { kingdomTileArtFrame } from '../utils/kingdom-tile-alignment';
import {
  EMPTY_KINGDOM_TILE_SCHEDULER,
  kingdomTileSchedulerReducer,
} from '../utils/kingdom-tile-scheduler';
import {
  EMPTY_KINGDOM_LOD_SCHEDULER,
  kingdomLodSchedulerReducer,
} from '../utils/kingdom-lod-scheduler';
import { createKingdomRendererFixture } from './fixtures/kingdom-renderer-fixture';

const TILE_TARGET = { left: -245, top: -148, right: 245, bottom: 196 };
const BASE_BOUNDS = { left: 14, top: 147, right: 1010, bottom: 876 };
const TALL_HOME_BOUNDS = { left: 14, top: 25, right: 1010, bottom: 998 };

function assertClose(actual: number, expected: number, message?: string): void {
  assert.ok(Math.abs(actual - expected) < 1e-9, message ?? `${actual} was not close to ${expected}`);
}

function renderedAssetY(frame: { top: number; height: number }, assetY: number): number {
  return frame.top + (assetY / 1024) * frame.height;
}

function renderedAssetX(frame: { left: number; width: number }, assetX: number): number {
  return frame.left + (assetX / 1024) * frame.width;
}

test('visible pixel bounds use alpha 16 and normalize draft dimensions to 1024', () => {
  const pixels = new Uint8Array(4 * 2 * 4);
  pixels[(0 * 4 + 0) * 4 + 3] = 15;
  pixels[(0 * 4 + 1) * 4 + 3] = 16;
  pixels[(1 * 4 + 3) * 4 + 3] = 255;

  assert.deepEqual(visiblePixelBoundsFromRgba(pixels, 4, 2), {
    left: 256,
    top: 0,
    right: 1024,
    bottom: 1024,
  });
});

test('silhouette-center retains the existing tile frame calculation', () => {
  const frame = kingdomTileArtFrame({
    alignmentMode: 'silhouette-center',
    assetBounds: TALL_HOME_BOUNDS,
    referenceBounds: BASE_BOUNDS,
    target: TILE_TARGET,
  });
  const expectedSize = 490 * (1024 / 996);

  assertClose(frame.width, expectedSize);
  assertClose(frame.height, expectedSize);
  assertClose(frame.left, -((14 + 1010) / 2 / 1024) * expectedSize);
  assertClose(frame.top, 24 - ((25 + 998) / 2 / 1024) * expectedSize);
});

test('the selected reference tile does not move between vertical alignment modes', () => {
  const legacy = kingdomTileArtFrame({
    alignmentMode: 'silhouette-center',
    assetBounds: BASE_BOUNDS,
    referenceBounds: BASE_BOUNDS,
    target: TILE_TARGET,
  });
  const experimental = kingdomTileArtFrame({
    alignmentMode: 'ground-bottom',
    assetBounds: BASE_BOUNDS,
    referenceBounds: BASE_BOUNDS,
    target: TILE_TARGET,
  });

  assertClose(experimental.left, legacy.left);
  assertClose(experimental.top, legacy.top);
  assertClose(experimental.width, legacy.width);
  assertClose(experimental.height, legacy.height);
});

test('ground-bottom preserves horizontal fit and aligns a tall tile to the reference bottom', () => {
  const legacyHome = kingdomTileArtFrame({
    alignmentMode: 'silhouette-center',
    assetBounds: TALL_HOME_BOUNDS,
    referenceBounds: BASE_BOUNDS,
    target: TILE_TARGET,
  });
  const alignedHome = kingdomTileArtFrame({
    alignmentMode: 'ground-bottom',
    assetBounds: TALL_HOME_BOUNDS,
    referenceBounds: BASE_BOUNDS,
    target: TILE_TARGET,
  });
  const legacyBase = kingdomTileArtFrame({
    alignmentMode: 'silhouette-center',
    assetBounds: BASE_BOUNDS,
    referenceBounds: BASE_BOUNDS,
    target: TILE_TARGET,
  });

  assertClose(alignedHome.left, legacyHome.left);
  assertClose(alignedHome.width, legacyHome.width);
  assertClose(
    renderedAssetY(alignedHome, TALL_HOME_BOUNDS.bottom),
    renderedAssetY(legacyBase, BASE_BOUNDS.bottom)
  );
  assert.ok(alignedHome.top < legacyHome.top, 'the tall home should move upward to share the ground baseline');
});

test('asymmetric visible bounds are centered from their measured midpoint', () => {
  const asymmetricBounds = { left: 80, top: 40, right: 920, bottom: 970 };
  const frame = kingdomTileArtFrame({
    alignmentMode: 'ground-bottom',
    assetBounds: asymmetricBounds,
    referenceBounds: BASE_BOUNDS,
    target: TILE_TARGET,
  });
  const targetCenterX = (TILE_TARGET.left + TILE_TARGET.right) / 2;

  assertClose(
    (renderedAssetX(frame, asymmetricBounds.left) + renderedAssetX(frame, asymmetricBounds.right)) / 2,
    targetCenterX
  );
});

test('different source silhouette widths resolve to the same canonical world width', () => {
  const narrow = { left: 120, top: 30, right: 900, bottom: 990 };
  const wide = { left: 14, top: 100, right: 1010, bottom: 930 };
  for (const bounds of [narrow, wide]) {
    const frame = kingdomTileArtFrame({
      alignmentMode: 'ground-bottom',
      assetBounds: bounds,
      referenceBounds: BASE_BOUNDS,
      target: TILE_TARGET,
    });
    assertClose(
      renderedAssetX(frame, bounds.right) - renderedAssetX(frame, bounds.left),
      TILE_TARGET.right - TILE_TARGET.left
    );
  }
});

test('scene dimensions stay stable while the kingdom grows to fifty residents', () => {
  assert.deepEqual(kingdomSceneMetrics(0), kingdomSceneMetrics(50));
});

test('the 50-resident base view retains no more than twenty preloaded tiles', () => {
  const viewport = { width: 390, height: 844 };
  const { frames, metrics } = createKingdomRendererFixture(50);
  const scale = 0.75;
  const camera = {
    scale,
    tx: viewport.width / 2 - metrics.centerX,
    ty: viewport.height / 2 - metrics.centerY - viewport.height * 0.02,
  };
  const preload = visibleWorldRect(viewport, metrics, camera, KINGDOM_RENDERING.preloadMarginScreenPx);
  assert.ok(preload);
  const retained = frames.filter((frame) => rectsIntersect(frameToRect(frame), preload)).length;
  assert.ok(retained <= 20, `expected at most 20 retained tiles, received ${retained}`);
});

test('tile LOD hysteresis prevents threshold oscillation', () => {
  assert.equal(tileLodWithHysteresis(null, 379), 'thumb');
  assert.equal(tileLodWithHysteresis('thumb', 381), 'medium');
  assert.equal(tileLodWithHysteresis('medium', 350), 'medium');
  assert.equal(tileLodWithHysteresis('medium', 319), 'thumb');
  assert.equal(tileLodWithHysteresis('medium', 821), 'full');
  assert.equal(tileLodWithHysteresis('full', 750), 'full');
  assert.equal(tileLodWithHysteresis('full', 699), 'medium');
});

test('resident sprites use only 256 and 512 world LODs', () => {
  assert.equal(residentLodWithHysteresis('thumb', 119), 'thumb');
  assert.equal(residentLodWithHysteresis('thumb', 121), 'medium');
  assert.equal(residentLodWithHysteresis('medium', 100), 'medium');
  assert.equal(residentLodWithHysteresis('medium', 95), 'thumb');
});

test('the scheduler never starts more than three image loads', () => {
  const ids = Array.from({ length: 10 }, (_, index) => `tile:${index}`);
  let state = kingdomTileSchedulerReducer(EMPTY_KINGDOM_TILE_SCHEDULER, {
    type: 'sync',
    paused: false,
    preloadIds: ids,
    priority: ids,
  });
  assert.equal(Object.values(state.entries).filter((entry) => entry.phase === 'loading').length, 3);

  state = kingdomTileSchedulerReducer(state, { type: 'loaded', id: ids[0] });
  assert.equal(Object.values(state.entries).filter((entry) => entry.loadStarted && !entry.loaded).length, 3);
  assert.equal(state.entries[ids[3]].phase, 'loading');
});

test('an exiting tile can re-enter without losing its loaded state', () => {
  const ids = ['kingdom', 'resident:1'];
  let state = kingdomTileSchedulerReducer(EMPTY_KINGDOM_TILE_SCHEDULER, {
    type: 'sync',
    paused: false,
    preloadIds: ids,
    priority: ids,
  });
  state = kingdomTileSchedulerReducer(state, { type: 'loaded', id: 'kingdom' });
  state = kingdomTileSchedulerReducer(state, {
    type: 'sync',
    paused: false,
    preloadIds: ['resident:1'],
    priority: ['resident:1'],
  });
  assert.equal(state.entries.kingdom.phase, 'exiting');

  state = kingdomTileSchedulerReducer(state, {
    type: 'sync',
    paused: false,
    preloadIds: ids,
    priority: ids,
  });
  assert.equal(state.entries.kingdom.phase, 'visible');
  assert.equal(state.entries.kingdom.loaded, true);
});

test('a terminal tile failure frees a load slot and remains ready for resident rendering', () => {
  const ids = ['kingdom', 'resident:1', 'resident:2', 'resident:3'];
  let state = kingdomTileSchedulerReducer(EMPTY_KINGDOM_TILE_SCHEDULER, {
    type: 'sync',
    paused: false,
    preloadIds: ids,
    priority: ids,
  });
  state = kingdomTileSchedulerReducer(state, { type: 'failed', id: 'kingdom' });
  assert.equal(state.entries.kingdom.phase, 'failed');
  assert.equal(state.entries.kingdom.loaded, true);
  assert.equal(state.entries['resident:3'].phase, 'loading');
});

test('camera bounds center a scene smaller than the viewport and clamp larger scenes', () => {
  assert.deepEqual(cameraTranslationBounds({ width: 400, height: 800 }, { width: 200, height: 300 }, 1), {
    x: [100, 100],
    y: [250, 250],
  });
  const bounds = cameraTranslationBounds({ width: 390, height: 844 }, { width: 3200, height: 3000 }, 0.75);
  assert.ok(bounds.x[0] < bounds.x[1]);
  assert.ok(bounds.y[0] < bounds.y[1]);
});

test('tile decoding does not promote queued work while the camera is moving', () => {
  const ids = Array.from({ length: 6 }, (_, index) => `tile:${index}`);
  let state = kingdomTileSchedulerReducer(EMPTY_KINGDOM_TILE_SCHEDULER, {
    type: 'sync',
    paused: true,
    preloadIds: ids,
    priority: ids,
  });
  assert.equal(Object.values(state.entries).filter((entry) => entry.phase === 'loading').length, 0);

  state = kingdomTileSchedulerReducer(state, {
    type: 'sync',
    paused: false,
    preloadIds: ids,
    priority: ids,
  });
  assert.equal(Object.values(state.entries).filter((entry) => entry.phase === 'loading').length, 3);
});

test('LOD changes are limited to three tiles and pause during camera motion', () => {
  const desired = Object.fromEntries(
    Array.from({ length: 7 }, (_, index) => [`tile:${index}`, 'medium' as const])
  );
  const priority = Object.keys(desired);
  let state = kingdomLodSchedulerReducer(EMPTY_KINGDOM_LOD_SCHEDULER, {
    type: 'sync',
    desired,
    paused: true,
    priority,
  });
  assert.equal(Object.keys(state.loading).length, 0);

  state = kingdomLodSchedulerReducer(state, { type: 'sync', desired, paused: false, priority });
  assert.equal(Object.keys(state.loading).length, 3);
  assert.deepEqual(Object.values(state.active).filter((lod) => lod === 'medium').length, 3);

  state = kingdomLodSchedulerReducer(state, { type: 'loaded', id: priority[0], lod: 'medium' });
  assert.equal(Object.keys(state.loading).length, 3);
  assert.equal(state.active[priority[3]], 'medium');
});
