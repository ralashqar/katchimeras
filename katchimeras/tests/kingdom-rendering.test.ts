import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { KINGDOM_RENDERING } from '../constants/kingdom-rendering';
import kingdomWorldViewConfig from '../constants/kingdom-world-view.json';
import todayScene from '../data/today-scene.json';
import { visiblePixelBoundsFromRgba } from '../utils/alpha-bounds';
import {
  cameraTranslationBounds,
  frameToRect,
  kingdomCameraSnapshotForTarget,
  kingdomSceneMetrics,
  kingdomWorldViewPoint,
  rectsIntersect,
  residentLodWithHysteresis,
  tileLodWithHysteresis,
  visibleWorldRect,
  screenPointToWorld,
} from '../utils/kingdom-rendering';
import { kingdomTileArtFrame } from '../utils/kingdom-tile-alignment';
import {
  TODAY_EGG_GLOBAL_SCALE,
  TODAY_EGG_VERTICAL_SHIFT_HEIGHT_RATIO,
  TODAY_KINGDOM_STAGE_HEIGHT,
  TODAY_KINGDOM_TILE_CENTER_Y,
  todayEggStageFrame,
  todayKingdomHeroLayout,
} from '../utils/today-kingdom-hero-layout';
import {
  todayHexCameraTarget,
  todayHexDayWorldPosition,
  todayHexKingdomSpacing,
} from '../utils/today-hex-neighborhood-layout';
import {
  HEX_TILE_H,
  HEX_TILE_W,
  KINGDOM_HEX_LAYOUT_PROFILES,
  hexTileTopPoints,
  hexToWorld,
} from '../utils/world-hex';
import {
  EMPTY_KINGDOM_TILE_SCHEDULER,
  kingdomTileSchedulerReducer,
} from '../utils/kingdom-tile-scheduler';
import {
  activeKingdomTileLod,
  EMPTY_KINGDOM_LOD_SCHEDULER,
  kingdomLodSchedulerReducer,
  visibleKingdomTileLod,
} from '../utils/kingdom-lod-scheduler';
import { createKingdomRendererFixture } from './fixtures/kingdom-renderer-fixture';
import {
  KINGDOM_SKY_LAYERS,
  kingdomSkyMotionEnabled,
  wrapKingdomCloudX,
} from '../utils/kingdom-sky';

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

test('Today day tiles retain a stable alternating row while the camera recenters selection', () => {
  const viewportWidth = 400;
  const spacing = todayHexKingdomSpacing(viewportWidth, 18, 1.15);
  const first = todayHexDayWorldPosition(0, spacing.horizontalStride, spacing.verticalStep);
  const second = todayHexDayWorldPosition(1, spacing.horizontalStride, spacing.verticalStep);
  const third = todayHexDayWorldPosition(2, spacing.horizontalStride, spacing.verticalStep);
  const camera = todayHexCameraTarget(1, spacing.horizontalStride, spacing.verticalStep);

  assert.deepEqual(first, { x: 0, y: 0 });
  assertClose(second.x, (viewportWidth - 36) * 1.15 * 0.75 * 1.168);
  assertClose(
    second.y,
    (viewportWidth - 36) * 1.15 * (HEX_TILE_H / HEX_TILE_W) * 0.5 * 1.168,
  );
  assertClose(third.x, second.x * 2);
  assert.equal(third.y, 0);
  assertClose(camera.x, -second.x);
  assertClose(camera.y, -second.y);
  assert.deepEqual(
    { x: second.x + camera.x, y: second.y + camera.y },
    { x: 0, y: 0 },
  );
});

test('home egg world placement is driven by kingdom-world-view JSON offsets', () => {
  const center = { x: 400, y: 600 };
  const point = kingdomWorldViewPoint(center, kingdomWorldViewConfig.egg);

  assertClose(
    point.x,
    center.x + HEX_TILE_W * kingdomWorldViewConfig.egg.horizontalOffsetHexTileWidth
  );
  assertClose(
    point.y,
    center.y + HEX_TILE_H * kingdomWorldViewConfig.egg.verticalOffsetHexTileHeight
  );
});

test('Kingdom entry camera places the home tile at the requested screen anchor', () => {
  const viewport = { width: 390, height: 844 };
  const scene = { width: 3200, height: 3000 };
  const home = { x: 1600, y: 1500 };
  const screenAnchor = { x: viewport.width / 2, y: viewport.height * 0.48 };
  const snapshot = kingdomCameraSnapshotForTarget(
    viewport,
    scene,
    home,
    0.75,
    screenAnchor,
  );

  const resolved = screenPointToWorld(screenAnchor, scene, snapshot);
  assertClose(resolved.x, home.x);
  assertClose(resolved.y, home.y);
});

test('Kingdom entry discards stale camera state and bootstraps loading from home', () => {
  const worldSource = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'kingdom-companion-screen.tsx'),
    'utf8',
  );
  const schedulerSource = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'use-kingdom-tile-scheduler.ts'),
    'utf8',
  );

  assert.doesNotMatch(worldSource, /initialCameraSnapshot/);
  assert.doesNotMatch(worldSource, /cameraSnapshotRef/);
  assert.match(schedulerSource, /if \(!cameraReady\)/);
  assert.match(schedulerSource, /preloadIds: \[scene\.centerTile\.id\]/);
  assert.match(schedulerSource, /priority: \[scene\.centerTile\.id\]/);
});

test('Kingdom uses the resolved Today sky plate without legacy clouds or atmosphere layers', () => {
  const worldSource = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'kingdom-companion-screen.tsx'),
    'utf8',
  );
  const canvasSource = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'kingdom-hex-canvas.tsx'),
    'utf8',
  );
  const cameraSource = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'use-kingdom-hex-camera.ts'),
    'utf8',
  );

  assert.match(worldSource, /todayAtmosphereBackgroundForDay\(today, days\)/);
  assert.match(worldSource, /background=\{kingdomBackground\}/);
  assert.match(canvasSource, /source=\{background\.source\}/);
  assert.match(canvasSource, /cachePolicy="memory-disk"/);
  assert.doesNotMatch(canvasSource, /KingdomSkyBackground|DevAtmosphereLayer/);
  assert.doesNotMatch(cameraSource, /skyCamera|skyOrigin/);
});

test('Today applies its resident and egg framing ratios while enlarging the tile', () => {
  const faceBounds = { left: 46, top: 167, right: 978, bottom: 697 };
  const assetBounds = { left: 14, top: 110, right: 1010, bottom: 900 };
  const layout = todayKingdomHeroLayout(390, {
    alignmentMode: 'ground-bottom',
    assetBounds,
    faceBounds,
    referenceBounds: assetBounds,
  });
  const kingdomCreatureWorldSize = 58 * kingdomWorldViewConfig.katchimera.globalScale;
  const kingdomEggWorldWidth = 200 * kingdomWorldViewConfig.egg.globalScale;
  const kingdomScale = layout.logicalTileWidth / HEX_TILE_W;
  const expectedCreatureTop = TODAY_KINGDOM_TILE_CENTER_Y + (
    HEX_TILE_H * kingdomWorldViewConfig.katchimera.verticalOffsetHexTileHeight
    - 58 * 0.63
    - (kingdomCreatureWorldSize - 58)
  ) * kingdomScale
    - layout.creatureSize * todayScene.homeKatchimera.verticalLiftCreatureHeightRatio;
  const expectedEggCenterY = TODAY_KINGDOM_TILE_CENTER_Y
    + HEX_TILE_H * kingdomWorldViewConfig.egg.verticalOffsetHexTileHeight * kingdomScale;
  const renderedFaceTop = layout.tileFrame.top
    + (faceBounds.top / 1024) * layout.tileFrame.height;
  const expectedFaceTop = TODAY_KINGDOM_TILE_CENTER_Y - (HEX_TILE_H * kingdomScale) / 2;

  assertClose(
    layout.tileSize,
    todayScene.homeEnvironment.fitToViewport
      ? (390 - todayScene.homeEnvironment.fitHorizontalPadding * 2)
        * todayScene.homeEnvironment.fitScale
      : 390 * 1.15 * 1.2 * 1.2 * 1.2 * todayScene.homeEnvironment.zoomScale,
  );
  assertClose(layout.tileFrame.width, layout.tileSize);
  assertClose(renderedFaceTop, expectedFaceTop);
  assertClose(layout.creatureSize / layout.logicalTileWidth, kingdomCreatureWorldSize / HEX_TILE_W);
  assertClose(
    (layout.eggStageScale * 196) / layout.logicalTileWidth,
    (kingdomEggWorldWidth * todayScene.homeEgg.scale * TODAY_EGG_GLOBAL_SCALE) / HEX_TILE_W,
  );
  assertClose(layout.creatureTop, expectedCreatureTop);
  assertClose(layout.eggCenterY, expectedEggCenterY);

  const unshiftedTop = expectedEggCenterY
    + TODAY_KINGDOM_STAGE_HEIGHT * todayScene.homeEgg.verticalLowerStageHeightRatio
    - (TODAY_KINGDOM_STAGE_HEIGHT * layout.eggStageScale) / 2;
  const eggFrame = todayEggStageFrame(layout.eggCenterY, layout.eggStageScale);
  assertClose(
    eggFrame.top - unshiftedTop,
    eggFrame.height * TODAY_EGG_VERTICAL_SHIFT_HEIGHT_RATIO,
  );
});

test('Today anchors every visible environment bottom before placing its resident', () => {
  const faceBounds = { left: 46, top: 167, right: 978, bottom: 697 };
  const referenceBounds = { left: 43, top: 98, right: 981, bottom: 952 };
  const homeAlignment = {
    alignmentMode: 'ground-bottom' as const,
    assetBounds: { left: 43, top: 54, right: 988, bottom: 1014 },
    faceBounds,
    referenceBounds,
  };
  const residentAlignment = {
    alignmentMode: 'ground-bottom' as const,
    assetBounds: { left: 42, top: 35, right: 982, bottom: 952 },
    faceBounds,
    referenceBounds,
  };
  const home = todayKingdomHeroLayout(390, homeAlignment);
  const resident = todayKingdomHeroLayout(390, residentAlignment, homeAlignment);
  const expectedResidentShift = ((1014 - 952) / 1024) * home.tileSize;

  assertClose(resident.environmentBottomY, home.environmentBottomY);
  assertClose(resident.tileFrame.top - home.tileFrame.top, expectedResidentShift);
  assertClose(resident.tileCenterY - home.tileCenterY, expectedResidentShift);
  assertClose(resident.creatureTop - home.creatureTop, expectedResidentShift);
});

test('Kingdom sky cloud wrapping remains inside the overscanned viewport', () => {
  const viewportWidth = 390;
  const cloudWidth = 240;
  const overscan = 55;
  const minimum = -overscan - cloudWidth;
  const maximum = viewportWidth + overscan;
  for (const value of [-4000, -620, -1, 0, 390, 4000]) {
    const wrapped = wrapKingdomCloudX(value, viewportWidth, cloudWidth, overscan);
    assert.ok(wrapped >= minimum && wrapped < maximum, `${wrapped} was outside wrap range`);
  }
});

test('Kingdom sky layers have increasing camera parallax and faster foreground drift', () => {
  assert.ok(KINGDOM_SKY_LAYERS.far.horizontalParallax < KINGDOM_SKY_LAYERS.middle.horizontalParallax);
  assert.ok(KINGDOM_SKY_LAYERS.middle.horizontalParallax < KINGDOM_SKY_LAYERS.near.horizontalParallax);
  assert.equal(KINGDOM_SKY_LAYERS.far.verticalParallax, KINGDOM_SKY_LAYERS.far.horizontalParallax / 2);
  assert.equal(KINGDOM_SKY_LAYERS.middle.verticalParallax, KINGDOM_SKY_LAYERS.middle.horizontalParallax / 2);
  assert.equal(KINGDOM_SKY_LAYERS.near.verticalParallax, KINGDOM_SKY_LAYERS.near.horizontalParallax / 2);
  assert.ok(KINGDOM_SKY_LAYERS.far.durationMs > KINGDOM_SKY_LAYERS.middle.durationMs);
  assert.ok(KINGDOM_SKY_LAYERS.middle.durationMs > KINGDOM_SKY_LAYERS.near.durationMs);
});

test('Kingdom sky motion stops for reduced motion, blur, and inactive app state', () => {
  assert.equal(kingdomSkyMotionEnabled(true, true, false), true);
  assert.equal(kingdomSkyMotionEnabled(true, true, true), false);
  assert.equal(kingdomSkyMotionEnabled(false, true, false), false);
  assert.equal(kingdomSkyMotionEnabled(true, false, false), false);
});

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

test('canonical face alignment ignores different overall island silhouettes', () => {
  const faceBounds = { left: 16, top: 158, right: 1009, bottom: 760 };
  const empty = kingdomTileArtFrame({
    alignmentMode: 'ground-bottom',
    assetBounds: { left: 16, top: 158, right: 1009, bottom: 987 },
    faceBounds,
    referenceBounds: BASE_BOUNDS,
    target: TILE_TARGET,
  });
  const home = kingdomTileArtFrame({
    alignmentMode: 'ground-bottom',
    assetBounds: { left: 27, top: 160, right: 1013, bottom: 988 },
    faceBounds,
    referenceBounds: BASE_BOUNDS,
    target: TILE_TARGET,
  });
  assert.deepEqual(home, empty);
  assertClose(empty.left + (faceBounds.left / 1024) * empty.width, TILE_TARGET.left);
  assertClose(empty.top + (faceBounds.top / 1024) * empty.height, TILE_TARGET.top);
});

test('connected floating layout applies the measured two-percent seam overlap', () => {
  const center = hexToWorld({ q: 0, r: 0 }, 'connected-floating-v1');
  const southEast = hexToWorld({ q: 1, r: 0 }, 'connected-floating-v1');
  const spacing = kingdomWorldViewConfig.hexTiles.layoutProfiles['connected-floating-v1'];
  assertClose(southEast.x - center.x, HEX_TILE_W * 0.75 * spacing.horizontalSpacing);
  assertClose(southEast.y - center.y, HEX_TILE_H * 0.5 * spacing.verticalSpacing);

  const centerPoints = hexTileTopPoints(center.x, center.y);
  const neighborPoints = hexTileTopPoints(southEast.x, southEast.y);
  assert.ok(neighborPoints[4].x < centerPoints[0].x);
  assert.ok(neighborPoints[4].y < centerPoints[0].y);
  assert.ok(neighborPoints[3].x < centerPoints[1].x);
  assert.ok(neighborPoints[3].y < centerPoints[1].y);
});

test('floating neighbourhood v2 applies a uniform sixteen-point-eight-percent air gap', () => {
  const center = hexToWorld({ q: 0, r: 0 }, 'floating-neighborhood-v2');
  const southEast = hexToWorld({ q: 1, r: 0 }, 'floating-neighborhood-v2');
  const spacing = kingdomWorldViewConfig.hexTiles.layoutProfiles['floating-neighborhood-v2'];
  assertClose(southEast.x - center.x, HEX_TILE_W * 0.75 * spacing.horizontalSpacing);
  assertClose(southEast.y - center.y, HEX_TILE_H * 0.5 * spacing.verticalSpacing);
  assert.ok(southEast.x > hexToWorld({ q: 1, r: 0 }, 'connected-floating-v1').x);
});

test('kingdom tile geometry and layout profiles are sourced from world-view JSON', () => {
  assert.equal(HEX_TILE_W, kingdomWorldViewConfig.hexTiles.width);
  assertClose(
    HEX_TILE_H,
    kingdomWorldViewConfig.hexTiles.width *
      (Math.sqrt(3) / 2) *
      kingdomWorldViewConfig.hexTiles.projectionTilt
  );
  assert.deepEqual(KINGDOM_HEX_LAYOUT_PROFILES, kingdomWorldViewConfig.hexTiles.layoutProfiles);
});

test('legacy separated layout retains breathing room between tiles', () => {
  const connected = hexToWorld({ q: 1, r: 0 }, 'connected-floating-v1');
  const separated = hexToWorld({ q: 1, r: 0 }, 'separated-v1');
  assert.ok(separated.x > connected.x);
  assert.ok(separated.y > connected.y);
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

test('visible environment tiles use at least 512px while off-screen preload may stay 256px', () => {
  assert.equal(visibleKingdomTileLod('thumb'), 'medium');
  assert.equal(visibleKingdomTileLod('medium'), 'medium');
  assert.equal(visibleKingdomTileLod('full'), 'full');

  const desired = {
    visible: visibleKingdomTileLod('thumb'),
    preload: 'thumb' as const,
  };
  let state = kingdomLodSchedulerReducer(EMPTY_KINGDOM_LOD_SCHEDULER, {
    type: 'sync',
    desired,
    paused: false,
    priority: ['visible', 'preload'],
  });
  assert.equal(activeKingdomTileLod(state, 'visible'), 'medium');
  assert.equal(activeKingdomTileLod(state, 'preload'), 'thumb');

  state = kingdomLodSchedulerReducer(state, { type: 'loaded', id: 'visible', lod: 'medium' });
  assert.equal(state.loading.visible, undefined);
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
