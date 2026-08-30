import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { KINGDOM_RENDERING } from '../constants/kingdom-rendering';
import kingdomWorldViewConfig from '../constants/kingdom-world-view.json';
import todayScene from '../data/today-scene.json';
import { visiblePixelBoundsFromRgba } from '../utils/alpha-bounds';
import { katchimeraFamilies } from '../constants/katchimera-skins';
import {
  compactKingdomCompanionHexSlots,
  kingdomCompanionHexSlots,
} from '../utils/katchimera-kingdom-slots';
import {
  KINGDOM_FAMILY_SLOT_COORD_BY_ID,
  MOSSPROUT_GARDEN_BOARD_BOTTOM,
  MOSSPROUT_GARDEN_BOARD_MOSSPROUT_COORD,
  MOSSPROUT_GARDEN_BOARD_RESERVED_COORDS,
  MOSSPROUT_GARDEN_BOARD_TOP,
} from '../utils/kingdom-map-layout';
import {
  cameraTranslationBounds,
  clampHavenCameraScale,
  kingdomCameraSnapshotForFrame,
  kingdomCameraSnapshotForTarget,
  kingdomSceneMetrics,
  kingdomWorldViewPoint,
  nearestKingdomFocusTarget,
  screenPointIsInsideWorldFrame,
  screenPointToWorld,
} from '../utils/kingdom-rendering';
import { kingdomStructureArtFrame, kingdomTileArtFrame } from '../utils/kingdom-tile-alignment';
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
  hexSpiral,
  hexTileTopPoints,
  hexToWorld,
} from '../utils/world-hex';
import { createKingdomRendererFixture } from './fixtures/kingdom-renderer-fixture';
import {
  KINGDOM_SKY_LAYERS,
  kingdomSkyMotionEnabled,
  wrapKingdomCloudX,
} from '../utils/kingdom-sky';

test('persistent Katchimera surfaces use original cutouts instead of hatchlings', () => {
  const read = (...segments: string[]) => fs.readFileSync(path.join(process.cwd(), ...segments), 'utf8');
  const resolver = read('utils', 'creature-art.ts');
  const merge = read('components', 'katchadeck', 'games', 'merge-world-screen.tsx');
  const goalSurfaces = [
    read('components', 'katchadeck', 'goals', 'companion-quick-goals.tsx'),
    read('components', 'katchadeck', 'goals', 'goal-task-row.tsx'),
    read('components', 'katchadeck', 'goals', 'quick-goal-action-modal.tsx'),
  ].join('\n');

  assert.match(resolver, /stage = 'grown'/);
  assert.match(merge, /resolveCreatureArtSource\(record\.characterId, \{ stage: 'grown' \}\)/);
  assert.doesNotMatch(merge, /CREATURE_HATCHLING_SOURCES/);
  assert.doesNotMatch(goalSurfaces, /stage: 'hatchling'/);
});

test('organic islands use a roomier invisible hex layout profile', () => {
  const organic = kingdomWorldViewConfig.hexTiles.layoutProfiles['organic-islands-v1'];
  const current = kingdomWorldViewConfig.hexTiles.layoutProfiles['floating-neighborhood-v2'];
  assert.deepEqual(organic, { horizontalSpacing: 1.28, verticalSpacing: 1.28 });
  assert.ok(organic.horizontalSpacing > current.horizontalSpacing);
  assert.ok(organic.verticalSpacing > current.verticalSpacing);
});

test('magnetic focus selects the nearest island deterministically', () => {
  const targets = [
    { id: 'home', x: 0, y: 0 },
    { id: 'mossprout', x: 460, y: 180 },
    { id: 'zodiac', x: -420, y: 190 },
  ];
  assert.equal(nearestKingdomFocusTarget({ x: 390, y: 140 }, targets)?.id, 'mossprout');
  assert.equal(nearestKingdomFocusTarget({ x: -360, y: 160 }, targets)?.id, 'zodiac');
  assert.equal(nearestKingdomFocusTarget({ x: 20, y: 10 }, targets)?.id, 'home');
  assert.equal(nearestKingdomFocusTarget({ x: 0, y: 0 }, [])?.id, undefined);
});

test('Organic-island runtime LODs and bounds are bundled', () => {
  const keys = [
    'organic_island_v1_mossprout_hex_tile',
    'organic_island_v1_mossprout_haven_stage_4_hex_tile',
    'organic_island_v1_baristabbit_hex_tile',
    'organic_island_v1_gatherglow_hex_tile',
  ];
  for (const key of keys) {
    for (const suffix of ['.webp', '_512.webp', '_256.webp']) {
      const asset = path.join(process.cwd(), 'assets', 'images', 'katchimeras', 'world', 'hex', `${key}${suffix}`);
      assert.ok(fs.existsSync(asset), `missing ${asset}`);
      assert.ok(fs.statSync(asset).size > 0, `empty ${asset}`);
    }
  }
  const bounds = fs.readFileSync(path.join(process.cwd(), 'constants', 'kingdom-hex-tile-bounds.gen.ts'), 'utf8');
  assert.match(bounds, /organic_island_v1_mossprout_hex_tile\.webp/);
  assert.match(bounds, /organic_island_v1_mossprout_haven_stage_4_hex_tile\.webp/);
  assert.match(bounds, /organic_island_v1_baristabbit_hex_tile\.webp/);
  assert.match(bounds, /organic_island_v1_gatherglow_hex_tile\.webp/);
});

test('Floating neighbourhood v2 bundles and maps its new resident environments', () => {
  const residentKeys = ['baristabbit', 'mendle', 'dawnle', 'pixooka', 'museling', 'encora'];
  for (const residentKey of residentKeys) {
    const key = `floating_neighborhood_v2_${residentKey}_hex_tile`;
    for (const suffix of ['.webp', '_512.webp', '_256.webp']) {
      const asset = path.join(process.cwd(), 'assets', 'images', 'katchimeras', 'world', 'hex', `${key}${suffix}`);
      assert.ok(fs.existsSync(asset), `missing ${asset}`);
      assert.ok(fs.statSync(asset).size > 0, `empty ${asset}`);
    }
  }

  const bounds = fs.readFileSync(path.join(process.cwd(), 'constants', 'kingdom-hex-tile-bounds.gen.ts'), 'utf8');
  const visuals = fs.readFileSync(path.join(process.cwd(), 'utils', 'world-visuals.ts'), 'utf8');
  for (const residentKey of residentKeys) {
    assert.match(bounds, new RegExp(`floating_neighborhood_v2_${residentKey}_hex_tile\\.webp`));
    assert.match(visuals, new RegExp(`${residentKey}:\\s*{[\\s\\S]*floating_neighborhood_v2_${residentKey}_hex_tile\\.webp`));
  }
});

test('Organic Islands art pipeline locks soft-toy thumbnail and packaging contracts', () => {
  const contract = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'design', 'organic-islands-v1', 'art-pipeline.json'), 'utf8')
  );
  assert.deepEqual(contract.style.thumbnailReviewSizes, [128, 256]);
  assert.deepEqual(contract.packaging.lods, [1024, 512, 256]);
  assert.equal(contract.style.principle, 'Add hierarchy, not noise');
  assert.equal(contract.render.background, '#FF00FF');
  assert.equal(contract.render.environmentOnly, true);
  assert.equal(contract.style.residentClearZoneWidthRatio, 0.15);
  assert.ok(contract.qualityGates.includes('resident zone remains unobstructed'));
});

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

test('Kingdom assigns every family to the stable structure-aware layout', () => {
  const locked = kingdomCompanionHexSlots([], []);
  const reserved = new Set(MOSSPROUT_GARDEN_BOARD_RESERVED_COORDS.map((coord) => `${coord.q}:${coord.r}`));
  assert.equal(locked.length, 25);
  assert.deepEqual(locked.map((slot) => slot.familyId), katchimeraFamilies.map((family) => family.id));
  assert.equal(new Set(locked.map((slot) => slot.id)).size, locked.length);
  assert.equal(new Set(locked.map((slot) => `${slot.coord.q}:${slot.coord.r}`)).size, locked.length);
  assert.ok(locked.every((slot) => slot.kind === 'locked'));
  assert.ok(locked.every((slot) => !reserved.has(`${slot.coord.q}:${slot.coord.r}`)));
  assert.deepEqual(locked.find((slot) => slot.familyId === 'mossprout')?.coord, MOSSPROUT_GARDEN_BOARD_MOSSPROUT_COORD);
  assert.deepEqual(Object.fromEntries(locked.map((slot) => [slot.familyId, slot.coord])), KINGDOM_FAMILY_SLOT_COORD_BY_ID);
});

test('the top-level Haven selector packs every family into separated consecutive rings', () => {
  const authored = kingdomCompanionHexSlots([], []);
  const compact = compactKingdomCompanionHexSlots(authored);
  assert.deepEqual(compact.map((slot) => slot.coord), hexSpiral(compact.length, false));
  assert.deepEqual(authored.map((slot) => slot.coord), katchimeraFamilies.map((family) => (
    KINGDOM_FAMILY_SLOT_COORD_BY_ID[family.id]
  )));
  assert.equal(new Set(compact.map((slot) => `${slot.coord.q}:${slot.coord.r}`)).size, compact.length);

  const selector = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'haven-hex-selector-canvas.tsx'),
    'utf8',
  );
  assert.match(selector, /compactKingdomCompanionHexSlots\(companionSlots\)/);
  assert.match(selector, /layoutProfile: 'haven-selector-v1'/);
  assert.deepEqual(kingdomWorldViewConfig.hexTiles.layoutProfiles['haven-selector-v1'], {
    horizontalSpacing: 1.4,
    verticalSpacing: 1.4,
  });
  assert.ok(
    kingdomWorldViewConfig.hexTiles.layoutProfiles['haven-selector-v1'].horizontalSpacing
      > kingdomWorldViewConfig.hexTiles.layoutProfiles['floating-neighborhood-v2'].horizontalSpacing,
  );
});

test('top-level Haven selector environments ship independent transparent LODs and runtime mappings', () => {
  const keys = [
    'floating_neighborhood_v2_baristabbit_selector_cupheart_hex_tile',
    'floating_neighborhood_v2_feastle_selector_harvest_hearth_hex_tile',
    'floating_neighborhood_v2_mossprout_selector_emblem_hex_tile',
    'floating_neighborhood_v2_steppling_selector_starstep_hex_tile',
  ];
  const bounds = fs.readFileSync(path.join(process.cwd(), 'constants', 'kingdom-hex-tile-bounds.gen.ts'), 'utf8');
  for (const key of keys) {
    for (const suffix of ['.webp', '_512.webp', '_256.webp']) {
      const asset = path.join(process.cwd(), 'assets', 'images', 'katchimeras', 'world', 'hex', `${key}${suffix}`);
      assert.ok(fs.existsSync(asset), `missing ${asset}`);
      assert.ok(fs.statSync(asset).size > 0, `empty ${asset}`);
    }
    assert.match(bounds, new RegExp(`${key}\\.webp`));
  }
  const visuals = fs.readFileSync(path.join(process.cwd(), 'utils', 'world-visuals.ts'), 'utf8');
  const selector = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'haven-hex-selector-canvas.tsx'),
    'utf8',
  );
  assert.match(
    visuals,
    /steppling:\s*{[\s\S]*?source: KINGDOM_FLOATING_NEIGHBORHOOD_V2_STEPPLING_SELECTOR_STARSTEP_HEX_TILE/,
  );
  assert.match(
    visuals,
    /baristabbit:\s*{[\s\S]*?source: KINGDOM_FLOATING_NEIGHBORHOOD_V2_BARISTABBIT_SELECTOR_CUPHEART_HEX_TILE/,
  );
  assert.match(
    visuals,
    /feastle:\s*{[\s\S]*?source: KINGDOM_FLOATING_NEIGHBORHOOD_V2_FEASTLE_SELECTOR_HARVEST_HEARTH_HEX_TILE/,
  );
  assert.match(visuals, /worldSelectorResidentTiles: FLOATING_NEIGHBORHOOD_V2_WORLD_SELECTOR_TILES/);
  assert.match(selector, /useWorldSelectorTiles: true/);
});

test('Mossprout garden reserves two cells, four end ports, and sealed middle neighbours', () => {
  assert.deepEqual(MOSSPROUT_GARDEN_BOARD_TOP, { q: -1, r: 1 });
  assert.deepEqual(MOSSPROUT_GARDEN_BOARD_BOTTOM, { q: -1, r: 2 });
  assert.deepEqual(MOSSPROUT_GARDEN_BOARD_MOSSPROUT_COORD, { q: -2, r: 3 });

  const source = fs.readFileSync(path.join(process.cwd(), 'utils', 'kingdom-map-structures.ts'), 'utf8');
  assert.match(source, /direction: 'upper-right', connectsTo: 'kingdom'/);
  assert.match(source, /direction: 'upper-left', connectsTo: null/);
  assert.match(source, /direction: 'lower-left', connectsTo: 'mossprout'/);
  assert.match(source, /direction: 'lower-right', connectsTo: null/);
  assert.equal(MOSSPROUT_GARDEN_BOARD_RESERVED_COORDS.length, 8);
});

test('Mossprout garden ships fixed 512 by 768 runtime states with its painted grid', () => {
  const root = path.join(process.cwd(), 'assets', 'images', 'katchimeras', 'world', 'hex');
  for (const state of ['', '_locked']) {
    const name = `floating_neighborhood_v2_mossprout_garden_board${state}_512x768.webp`;
    const asset = fs.readFileSync(path.join(root, name));
    assert.equal(asset.subarray(0, 4).toString('ascii'), 'RIFF');
    assert.equal(asset.subarray(8, 12).toString('ascii'), 'WEBP');
  }
  const structure = fs.readFileSync(path.join(process.cwd(), 'utils', 'kingdom-map-structures.ts'), 'utf8');
  assert.match(structure, /GARDEN_REVEALED_MERGE_SURFACE_BOUNDS = \{ left: 238, top: 289, right: 800, bottom: 1033 \}/);
  assert.doesNotMatch(structure, /revealed: \{[\s\S]*?overlaySource:/);
  assert.equal(fs.existsSync(path.join(root, 'floating_neighborhood_v2_mossprout_garden_board.webp')), false);
  assert.equal(fs.existsSync(path.join(root, 'floating_neighborhood_v2_mossprout_garden_board_1024.webp')), false);
});

test('discovering a Katchimera transforms its existing Kingdom slot without moving it', () => {
  const before = kingdomCompanionHexSlots([], []);
  const family = katchimeraFamilies[0];
  const creature = {
    accentColor: '#D6B36A',
    aspectId: family.aspectId,
    creatureId: 'test-owned-companion',
    dayId: 'test-day',
    familyId: family.id,
    isoDate: '2026-08-18',
    name: family.displayName,
    rarity: 'common' as const,
    visualKey: family.anchorVisualKey!,
  };
  const resident = {
    arrivalIndex: 0,
    cell: { col: 1.5, row: 1.5 },
    creatureId: creature.creatureId,
    hatchCount: 1,
    houseLevel: 1,
    quad: 0 as const,
    tileIndex: 0,
  };
  const after = kingdomCompanionHexSlots([resident], [creature]);
  const lockedSlot = before.find((slot) => slot.familyId === family.id)!;
  const ownedSlot = after.find((slot) => slot.familyId === family.id)!;

  assert.equal(ownedSlot.kind, 'owned');
  assert.equal(ownedSlot.id, lockedSlot.id);
  assert.deepEqual(ownedSlot.coord, lockedSlot.coord);
  assert.deepEqual(
    after.filter((slot) => slot.familyId !== family.id).map((slot) => slot.coord),
    before.filter((slot) => slot.familyId !== family.id).map((slot) => slot.coord),
  );
});

test('Today day tiles retain a stable alternating row while the camera recenters selection', () => {
  const viewportWidth = 400;
  const spacing = todayHexKingdomSpacing(viewportWidth, 18, 1.15);
  const neighborhoodSpacing = kingdomWorldViewConfig.hexTiles.layoutProfiles['floating-neighborhood-v2'];
  const first = todayHexDayWorldPosition(0, spacing.horizontalStride, spacing.verticalStep);
  const second = todayHexDayWorldPosition(1, spacing.horizontalStride, spacing.verticalStep);
  const third = todayHexDayWorldPosition(2, spacing.horizontalStride, spacing.verticalStep);
  const camera = todayHexCameraTarget(1, spacing.horizontalStride, spacing.verticalStep);

  assert.deepEqual(first, { x: 0, y: 0 });
  assertClose(second.x, (viewportWidth - 36) * 1.15 * 0.75 * neighborhoodSpacing.horizontalSpacing);
  assertClose(
    second.y,
    (viewportWidth - 36) * 1.15 * (HEX_TILE_H / HEX_TILE_W) * 0.5 * neighborhoodSpacing.verticalSpacing,
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

test('camera hit testing keeps a transformed merge-board frame reserved', () => {
  const scene = { width: 720, height: 1304 };
  const frame = { height: 420, left: 160, top: 720, width: 400 };
  const camera = { scale: 1.05, tx: -24, ty: -310 };
  const toScreen = (world: { x: number; y: number }) => ({
    x: scene.width / 2 + camera.tx + (world.x - scene.width / 2) * camera.scale,
    y: scene.height / 2 + camera.ty + (world.y - scene.height / 2) * camera.scale,
  });

  assert.equal(screenPointIsInsideWorldFrame(toScreen({ x: 160, y: 720 }), frame, scene, camera), true);
  assert.equal(screenPointIsInsideWorldFrame(toScreen({ x: 360, y: 930 }), frame, scene, camera), true);
  assert.equal(screenPointIsInsideWorldFrame(toScreen({ x: 559.9, y: 1139.9 }), frame, scene, camera), true);
  assert.equal(screenPointIsInsideWorldFrame(toScreen({ x: 159.9, y: 930 }), frame, scene, camera), false);
  assert.equal(screenPointIsInsideWorldFrame(toScreen({ x: 360, y: 1140.1 }), frame, scene, camera), false);
});

test('Kingdom entry discards stale camera state and mounts the complete scene', () => {
  const worldSource = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'kingdom-companion-screen.tsx'),
    'utf8',
  );
  const canvasSource = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'kingdom-hex-canvas.tsx'),
    'utf8',
  );

  assert.doesNotMatch(worldSource, /initialCameraSnapshot/);
  assert.doesNotMatch(worldSource, /cameraSnapshotRef/);
  assert.match(canvasSource, /scene\.tileArtLayers\.map/);
  assert.doesNotMatch(canvasSource, /preloadIds|visibleTileIds|phase === 'exiting'/);
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
  assert.match(canvasSource, /source=\{background\.havenSource\}/);
  assert.match(canvasSource, /cachePolicy="disk"/);
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

test('portrait structure frames preserve source aspect and align visible width', () => {
  const bounds = { left: 57, top: 60, right: 967, bottom: 1487 };
  const sourceSize = { width: 1024, height: 1536 };
  const frame = kingdomStructureArtFrame({ assetBounds: bounds, sourceSize, target: TILE_TARGET });
  assertClose(frame.height / frame.width, 1.5);
  assertClose(frame.left + (bounds.left / sourceSize.width) * frame.width, TILE_TARGET.left);
  assertClose(frame.left + (bounds.right / sourceSize.width) * frame.width, TILE_TARGET.right);
  assertClose(frame.top + (bounds.top / sourceSize.height) * frame.height, TILE_TARGET.top);
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

test('floating neighbourhood v2 applies a uniform two-percent air gap', () => {
  const center = hexToWorld({ q: 0, r: 0 }, 'floating-neighborhood-v2');
  const southEast = hexToWorld({ q: 1, r: 0 }, 'floating-neighborhood-v2');
  const spacing = kingdomWorldViewConfig.hexTiles.layoutProfiles['floating-neighborhood-v2'];
  assertClose(southEast.x - center.x, HEX_TILE_W * 0.75 * spacing.horizontalSpacing);
  assertClose(southEast.y - center.y, HEX_TILE_H * 0.5 * spacing.verticalSpacing);
  assert.deepEqual(spacing, { horizontalSpacing: 1.02, verticalSpacing: 1.02 });
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

test('Haven keeps every configured tile in the persistent render set', () => {
  const { frames } = createKingdomRendererFixture(50);
  assert.equal(frames.length, 51);
  assert.equal(new Set(frames.map((frame) => frame.id)).size, frames.length);
});

test('the merge island mounts the shared Merge board without giving cell taps or drags to the camera', () => {
  const scene = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'kingdom-hex-scene.ts'),
    'utf8',
  );
  const canvas = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'kingdom-hex-canvas.tsx'),
    'utf8',
  );
  const board = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'games', 'feastle-persistent-merge-board.tsx'),
    'utf8',
  );
  const camera = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'use-kingdom-hex-camera.ts'),
    'utf8',
  );
  assert.match(scene, /id: MOSSPROUT_GARDEN_BOARD\.id/);
  assert.match(scene, /mossprout && mossprout\.kind !== 'locked'[\s\S]*?art\.revealed[\s\S]*?art\.locked/);
  assert.match(scene, /kind: 'structure'/);
  assert.match(scene, /overlaySource: art\.overlaySource/);
  assert.match(scene, /interactionFrame/);
  assert.match(canvas, /<FeastlePersistentMergeBoard/);
  assert.ok(canvas.indexOf('<FeastlePersistentMergeBoard') > canvas.indexOf('</GestureDetector>'));
  assert.match(canvas, /key=\{`haven-merge-board-\$\{activeMergeBoard\.id\}-\$\{assetRevision\}`\}/);
  assert.match(canvas, /pointerEvents=\{liveMergeBoardReadyId === activeMergeBoard\.id \? 'box-none' : 'none'\}[\s\S]*?styles\.mergeBoardInteractionLayer/);
  assert.match(canvas, /board\.id !== activeMergeBoardId \|\| liveMergeBoardReadyId !== board\.id/);
  assert.match(canvas, /opacity: liveMergeBoardReadyId === activeMergeBoard\.id \? 1 : 0/);
  assert.match(canvas, /onVisualReady=\{\(\) => handleMergeBoardVisualReady\(activeMergeBoard\.id\)\}/);
  assert.doesNotMatch(canvas, /externalPanGesture|camera\.panGesture/);
  assert.doesNotMatch(board, /blocksExternalGesture|externalPanGesture/);
  assert.doesNotMatch(camera, /panExclusionFrame|stateManager\.fail/);
  assert.match(canvas, /layout=\{havenMergeBoardLayout\(activeMergeBoard\.id, squareWorld\)\}/);
  assert.match(canvas, /cellHeightToWidthRatio: 1\.14/);
  assert.match(canvas, /cellHeightToWidthRatio: MOSSPROUT_GARDEN_CELL_HEIGHT_TO_WIDTH_RATIO/);
  assert.match(canvas, /topWidthRatio: MOSSPROUT_GARDEN_TOP_WIDTH_RATIO/);
  assert.match(canvas, /farScale: 0\.94/);
  assert.match(canvas, /checkerboardCellColor: 'rgba\(38, 61, 10, 0\.188\)'/);
  assert.doesNotMatch(canvas, /HAVEN_MERGE_GRID_SOURCE|haven-merge-grid-7x6\.webp/);
  assert.match(board, /checkerboardColor=\{layout\.checkerboardCellColor/);
  assert.match(board, /mergeLogicalPointFromProjectedWorklet/);
  assert.match(board, /RectangularHoverCellOverlay/);
  assert.match(canvas, /fillAvailableSpace: true/);
  assert.match(canvas, /transparentSurface: true/);
  assert.doesNotMatch(canvas, /focusedSquareZoneId/);
  assert.doesNotMatch(canvas, /structure:mossprout-garden/);
});

test('Mossprout Merge art is packaged into two guttered shared atlas pages without mounting full pages per sprite', () => {
  const generated = path.join(process.cwd(), 'assets', 'images', 'katchimeras', 'merge-world', 'generated');
  const manifest = JSON.parse(fs.readFileSync(path.join(generated, 'mossprout-merge-atlas.json'), 'utf8')) as {
    atlasSize: number;
    contentSize: number;
    entries: Record<string, { height: number; page: string; width: number; x: number; y: number }>;
    pages: Record<string, string>;
  };
  assert.equal(manifest.atlasSize, 1024);
  assert.equal(manifest.contentSize, 128);
  assert.deepEqual(Object.keys(manifest.pages).sort(), ['core', 'progression']);
  assert.equal(Object.keys(manifest.entries).length, 38);
  Object.values(manifest.entries).forEach((entry) => {
    assert.equal(entry.width, 128);
    assert.equal(entry.height, 128);
    assert.ok(entry.x >= 8 && entry.y >= 8);
    assert.ok(entry.x + entry.width <= manifest.atlasSize - 8);
    assert.ok(entry.y + entry.height <= manifest.atlasSize - 8);
  });
  Object.values(manifest.pages).forEach((file) => {
    const atlas = path.join(generated, file);
    assert.ok(fs.existsSync(atlas));
    assert.ok(fs.statSync(atlas).size < 512 * 1024);
  });
  const renderer = fs.readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'games', 'feastle-persistent-merge-board.tsx'), 'utf8');
  const cache = fs.readFileSync(path.join(process.cwd(), 'hooks', 'use-merge-art-cache.ts'), 'utf8');
  assert.doesNotMatch(renderer, /PersistentMergeAtlasArt|usePathValue/);
  assert.doesNotMatch(cache, /mossproutAtlasPagesForArt/);
});

test('Haven uses one fixed 512 image tier for tiles and residents', () => {
  assert.equal(KINGDOM_RENDERING.havenImageLod, 'medium');

  const canvas = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'kingdom-hex-canvas.tsx'),
    'utf8',
  );
  assert.match(canvas, /scene\.tileArtLayers\.map/);
  assert.match(canvas, /KINGDOM_RENDERING\.havenImageLod/);
  assert.doesNotMatch(canvas, /useKingdom(?:Tile|Lod)Scheduler|visibleTileIds|promotedFullTileId/);
  assert.doesNotMatch(canvas, /kingdomHexTileSourceForLod\([^\n]*,\s*'full'/);
});

test('every Haven camera path shares the balanced 1.25 zoom ceiling', () => {
  assert.equal(KINGDOM_RENDERING.havenMaxScale, 1.25);
  assert.equal(clampHavenCameraScale(0.1), 0.54);
  assert.equal(clampHavenCameraScale(1.1), 1.1);
  assert.equal(clampHavenCameraScale(1.25), 1.25);
  assert.equal(clampHavenCameraScale(2.25), 1.25);
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

test('Haven camera frame focus fits the complete merge grid with screen padding', () => {
  const viewport = { width: 390, height: 844 };
  const scene = { width: 2100, height: 1170 };
  const frame = { left: 908, top: 636, width: 342, height: 278 };
  const snapshot = kingdomCameraSnapshotForFrame(viewport, scene, frame, {
    horizontalPadding: 16,
    maximumScale: KINGDOM_RENDERING.havenMaxScale,
    minimumScale: 0.28,
    screenCenterY: viewport.height / 2,
    verticalPadding: 72,
  });
  const screenX = (worldX: number) => scene.width / 2 + snapshot.tx + (worldX - scene.width / 2) * snapshot.scale;
  const screenY = (worldY: number) => scene.height / 2 + snapshot.ty + (worldY - scene.height / 2) * snapshot.scale;

  assert.ok(Math.abs(screenX(frame.left) - 16) < 0.001);
  assert.ok(Math.abs(screenX(frame.left + frame.width) - (viewport.width - 16)) < 0.001);
  assert.ok(screenY(frame.top) >= 72);
  assert.ok(screenY(frame.top + frame.height) <= viewport.height - 72);
  assert.ok(snapshot.scale <= KINGDOM_RENDERING.havenMaxScale);
});

test('Haven merge board requests frame focus only after an in-grid tap or drag release', () => {
  const board = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'games', 'feastle-persistent-merge-board.tsx'),
    'utf8',
  );
  const canvas = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'kingdom-hex-canvas.tsx'),
    'utf8',
  );
  const touchDownPath = board.slice(board.indexOf('.onTouchesDown'), board.indexOf('.onUpdate'));

  assert.doesNotMatch(touchDownPath, /emitBoardReleaseFocus/);
  assert.ok((board.match(/releaseCell >= 0\) runOnJS\(emitBoardReleaseFocus\)\(\)/g) ?? []).length >= 3);
  assert.match(canvas, /focusCameraFrame\(frame/);
  assert.match(canvas, /onBoardRelease=\{\(\) => focusMergeBoard\(activeMergeBoard\.id\)\}/);
});

test('Haven preserves already-visible order trays when activating a frozen board', () => {
  const canvas = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'kingdom-hex-canvas.tsx'),
    'utf8',
  );

  assert.match(canvas, /activationOrderSnapshotRef = useRef/);
  assert.match(canvas, /orderIds: havenOrderSlotFrames\(target\.id\)\.map\(\(_, index\) => target\.orders\?\.\[index\]\?\.id \?\? null\)/);
  assert.match(canvas, /activationOrderSnapshot\.orderIds\[index\] !== entry\?\.id/);
  assert.match(canvas, /entering=\{reduceMotion \|\| !animateEntry \? undefined : FadeInUp\.duration\(230\)\}/);
  assert.match(canvas, /animateEntrance=\{animateEntry\}/);

  const tray = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'games', 'merge-order-rail.tsx'),
    'utf8',
  );
  assert.match(tray, /animateEntrance = true/);
  assert.match(tray, /useState\(animateEntrance\)/);
  assert.ok((tray.match(/entering=\{!entryMotionEnabled \? undefined/g) ?? []).length >= 6);
});

test('inactive Haven merge boards retain full and lower locked-cell mist', () => {
  const preview = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'games', 'frozen-merge-board-preview.tsx'),
    'utf8',
  );

  assert.match(preview, /dream-mist-full\.webp/);
  assert.match(preview, /dream-mist-lower\.webp/);
  assert.match(preview, /const lowerMist = mist\?\.kind === 'echo'/);
  assert.match(preview, /const fullMist = boardCell\.locked && !boardCell\.occupant && !lowerMist/);
  assert.match(preview, /source=\{lowerMist \? DREAM_MIST_LOWER : DREAM_MIST_FULL\}/);
});

test('Haven hosts resident interaction over the focused world and freezes merge boards', () => {
  const screen = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'roster', 'katchimera-kingdom-screen.tsx'),
    'utf8',
  );
  const canvas = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'kingdom-hex-canvas.tsx'),
    'utf8',
  );
  const route = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'katchimera-companion-route-screen.tsx'),
    'utf8',
  );

  assert.match(screen, /<KatchimeraCompanionRouteScreen[\s\S]*?hostedInHaven[\s\S]*?reuseUnderlyingStage/);
  assert.match(screen, /interactionEnabled=\{!interactionCreatureId/);
  assert.match(screen, /mergeBoardFocusRequest=\{mergeBoardFocusRequest\}/);
  assert.match(screen, /interactionCreatureIdRef\.current === creatureId/);
  assert.match(screen, /cameraFallbackTimer = setTimeout/);
  assert.match(canvas, /if \(!interactionResidentId\) return;[\s\S]*?setActiveMergeBoardId\(null\)/);
  assert.match(canvas, /handledMergeBoardRequestRef/);
  assert.match(route, /onHostedClose/);
  assert.match(route, /onHostedOpenMerge/);
});

test('hosted resident dashboard dismisses from the world while deep achievements mount progressively', () => {
  const interaction = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-interaction-sheet.tsx'),
    'utf8',
  );
  const stage = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-cinematic-stage.tsx'),
    'utf8',
  );
  const trophies = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-trophy-room-screen.tsx'),
    'utf8',
  );

  assert.match(interaction, /dismissOnSwipe: props\.reuseUnderlyingStage && dashboardRouteActive \? requestClose : undefined/);
  assert.match(interaction, /onBackdropPress=\{props\.reuseUnderlyingStage && dashboardRouteActive \? requestClose : undefined\}/);
  assert.match(interaction, /const LazyCompanionTrophyRoomScreen = lazy/);
  assert.match(stage, /onBackdropPress/);
  assert.match(trophies, /visibleSectionCount/);
  assert.match(trophies, /maxToRenderPerBatch=\{4\}/);
});
