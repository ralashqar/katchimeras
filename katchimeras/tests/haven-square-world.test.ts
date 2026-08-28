import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  baristabbitMossproutBridgeFrame,
  havenSquareZoneFrame,
  HAVEN_SQUARE_COLUMN_PITCH,
  HAVEN_JUNCTION_MINI_ISLAND_SIZE,
  HAVEN_JUNCTION_MINI_ISLAND_SPACING,
  HAVEN_JUNCTION_MINI_ISLAND_RISE,
  HAVEN_JUNCTION_TRAY_SIZE,
  HAVEN_JUNCTION_TRAY_TOP_OFFSET,
  HAVEN_SQUARE_ROW_PITCH,
  MOSSPROUT_GARDEN_CELL_HEIGHT_TO_WIDTH_RATIO,
  MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS,
  MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_CORNERS,
  MOSSPROUT_GARDEN_TOP_WIDTH_RATIO,
  MOSSPROUT_SQUARE_ZONES,
  mossproutEggHomeBridgeFrame,
  mossproutGardenJunctionMiniIslandFrame,
  mossproutGardenJunctionMiniIslandFrames,
  mossproutGardenJunctionTrayFrames,
  mossproutSquareSceneMetrics,
} from '../utils/haven-square-world';
import {
  HAVEN_MERGE_BOARD_CELL_INDICES,
} from '../utils/merge-world/haven-sandbox';

test('square Haven places Baristabbit west of Mossprout and the merge island below it', () => {
  assert.deepEqual(MOSSPROUT_SQUARE_ZONES, [
    { id: 'baristabbit-cafe', coord: { column: 0, row: 0 } },
    { id: 'mossprout-environment', coord: { column: 1, row: 0 } },
    { id: 'egg-home', coord: { column: 2, row: 0 } },
    { id: 'mossprout-garden', coord: { column: 1, row: 1 } },
  ]);
  assert.equal(HAVEN_SQUARE_COLUMN_PITCH, 720);
  assert.equal(HAVEN_SQUARE_ROW_PITCH, 480);
  const baristabbit = havenSquareZoneFrame(MOSSPROUT_SQUARE_ZONES[0].coord);
  const environment = havenSquareZoneFrame(MOSSPROUT_SQUARE_ZONES[1].coord);
  const eggHome = havenSquareZoneFrame(MOSSPROUT_SQUARE_ZONES[2].coord);
  const garden = havenSquareZoneFrame(MOSSPROUT_SQUARE_ZONES[3].coord);
  const westernBridge = baristabbitMossproutBridgeFrame();
  const easternBridge = mossproutEggHomeBridgeFrame();
  const junctionMiniIsland = mossproutGardenJunctionMiniIslandFrame();
  assert.equal(environment.left - (baristabbit.left + baristabbit.width), 120);
  assert.equal(eggHome.left - (environment.left + environment.width), 120);
  assert.equal(garden.left, environment.left);
  assert.equal(garden.top, environment.top + HAVEN_SQUARE_ROW_PITCH);
  assert.equal(environment.top + environment.height - garden.top, 120);
  assert.ok(westernBridge.left < baristabbit.left + baristabbit.width);
  assert.ok(westernBridge.left + westernBridge.width > environment.left);
  assert.ok(easternBridge.left < environment.left + environment.width);
  assert.ok(easternBridge.left + easternBridge.width > eggHome.left);
  assert.ok(easternBridge.top + easternBridge.height / 2 < environment.top + environment.height / 2);
  assert.deepEqual(westernBridge, { height: 201, left: 494, top: 207, width: 453 });
  assert.deepEqual(easternBridge, { height: 201, left: 1214, top: 207, width: 453 });
  const junctionMiniIslands = mossproutGardenJunctionMiniIslandFrames();
  const junctionTrays = mossproutGardenJunctionTrayFrames();
  assert.equal(HAVEN_JUNCTION_MINI_ISLAND_SIZE, 160);
  assert.equal(HAVEN_JUNCTION_MINI_ISLAND_SPACING, 130);
  assert.equal(HAVEN_JUNCTION_MINI_ISLAND_RISE, 10);
  assert.equal(HAVEN_JUNCTION_TRAY_SIZE, 95);
  assert.equal(HAVEN_JUNCTION_TRAY_TOP_OFFSET, 48);
  assert.deepEqual(junctionMiniIsland, { height: 160, left: 1000, top: 530, width: 160 });
  assert.deepEqual(junctionMiniIslands, [
    { height: 160, left: 870, top: 530, width: 160 },
    { height: 160, left: 1000, top: 530, width: 160 },
    { height: 160, left: 1130, top: 530, width: 160 },
  ]);
  assert.deepEqual(junctionTrays, [
    { height: 95, left: 902.5, top: 578, width: 95 },
    { height: 95, left: 1032.5, top: 578, width: 95 },
    { height: 95, left: 1162.5, top: 578, width: 95 },
  ]);
  assert.ok(junctionMiniIsland.top < environment.top + environment.height);
  assert.ok(junctionMiniIsland.top + junctionMiniIsland.height > garden.top);
  assert.deepEqual(mossproutSquareSceneMetrics(), { width: 2160, height: 1200 });
});

test('the compact merge island hosts all stable Haven cells on one 7x6 playfield', () => {
  assert.equal(HAVEN_MERGE_BOARD_CELL_INDICES.length, 42);
  assert.equal(new Set(HAVEN_MERGE_BOARD_CELL_INDICES).size, 42);
  assert.ok(MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS.right > MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS.left);
  assert.ok(MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS.bottom > MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS.top);
  assert.deepEqual(MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_CORNERS, {
    bottomLeft: { x: 220, y: 690 },
    bottomRight: { x: 804, y: 690 },
    topLeft: { x: 245, y: 215 },
    topRight: { x: 779, y: 215 },
  });
  assert.equal((MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS.right - MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS.left) / 7, 584 / 7);
  assert.equal((MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS.bottom - MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS.top) / 6, 475 / 6);
  assert.equal(MOSSPROUT_GARDEN_CELL_HEIGHT_TO_WIDTH_RATIO, (475 / 6) / (584 / 7));
  assert.equal(MOSSPROUT_GARDEN_TOP_WIDTH_RATIO, 534 / 584);
});

test('square Haven runtime art includes full, medium, and thumbnail tiers', () => {
  for (const stem of ['baristabbit-cafe-island', 'mossprout-main-environment', 'mossprout-merge-island']) {
    const master = fs.readFileSync(path.join(process.cwd(), 'design', 'square-haven-v1', `${stem}-1024.png`));
    assert.equal(master.readUInt32BE(16), 1024);
    assert.equal(master.readUInt32BE(20), 1024);
    assert.equal(master[25], 6, `${stem} master must be RGBA PNG`);
    for (const suffix of ['', '-512', '-256']) {
      const asset = path.join(process.cwd(), 'assets', 'images', 'katchimeras', 'world', 'square', `${stem}${suffix}.webp`);
      assert.ok(fs.existsSync(asset), `missing ${asset}`);
      assert.ok(fs.statSync(asset).size > 0, `empty ${asset}`);
      const bytes = fs.readFileSync(asset);
      assert.equal(bytes.toString('ascii', 12, 16), 'VP8X', `${asset} must use extended WebP`);
      assert.ok((bytes[20] & 0x10) !== 0, `${asset} must preserve alpha`);
    }
  }
});

test('connected Egg Home and perspective bridge include transparent runtime tiers', () => {
  const specs = [
    { height: 1024, stem: 'egg-home-island', width: 1024 },
    { height: 455, stem: 'bridge-straight-horizontal-perspective', width: 1024 },
  ] as const;
  for (const spec of specs) {
    const master = fs.readFileSync(path.join(
      process.cwd(),
      'design',
      'connected-island-system-v1',
      `${spec.stem}-1024.png`,
    ));
    assert.equal(master.readUInt32BE(16), spec.width);
    assert.equal(master.readUInt32BE(20), spec.height);
    assert.equal(master[25], 6, `${spec.stem} master must be RGBA PNG`);
    for (const suffix of ['', '-512', '-256']) {
      const asset = path.join(
        process.cwd(),
        'assets',
        'images',
        'katchimeras',
        'world',
        'square',
        `${spec.stem}${suffix}.webp`,
      );
      assert.ok(fs.existsSync(asset), `missing ${asset}`);
      const bytes = fs.readFileSync(asset);
      assert.equal(bytes.toString('ascii', 12, 16), 'VP8X');
      assert.ok((bytes[20] & 0x10) !== 0, `${asset} must preserve alpha`);
    }
  }
});

test('the junction mini-island and separate tray include fixed alpha tiers', () => {
  for (const stem of ['haven-junction-mini-island', 'haven-junction-mini-island-tray']) {
    for (const suffix of ['-512', '-256']) {
      const asset = path.join(
        process.cwd(),
        'assets',
        'images',
        'katchimeras',
        'world',
        'square',
        `${stem}${suffix}.webp`,
      );
      assert.ok(fs.existsSync(asset), `missing ${asset}`);
      const bytes = fs.readFileSync(asset);
      assert.equal(bytes.toString('ascii', 12, 16), 'VP8X');
      assert.ok((bytes[20] & 0x10) !== 0, `${asset} must preserve alpha`);
    }
  }
});

test('the player Haven mounts the square scene and keeps the hex renderer as a fallback', () => {
  const screen = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'roster', 'katchimera-kingdom-screen.tsx'),
    'utf8',
  );
  const canvas = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'kingdom-hex-canvas.tsx'),
    'utf8',
  );
  assert.match(screen, /squareWorld/);
  assert.match(screen, /familyId === 'mossprout'/);
  assert.doesNotMatch(screen, /YOUR HAVEN|Tap a home or a mist tile|Open World and Board Lab/);
  assert.match(screen, /<GameHudBar[\s\S]*?<GameCurrencyHud[\s\S]*?GAME_CURRENCY_ART\.coins/);
  assert.match(screen, /targetRef: coinHudRef/);
  assert.match(screen, /animateValue: presentedCoins != null/);
  assert.match(canvas, /buildMossproutSquareScene/);
  assert.match(canvas, /coinAmount: order\.reward\.coins/);
  assert.match(canvas, /coinRect\.x - rootRect\.x \+ coinRect\.width \/ 2/);
  assert.match(canvas, /onItemsArrive=\{handleHavenServeItemsArrive\}/);
  assert.match(canvas, /onCoinArrive=\{handleHavenCoinArrive\}/);
  assert.doesNotMatch(canvas, /baseArtOpacity: 0\.34|merge-board-base-7x6\.webp/);
  assert.match(canvas, /HAVEN_MERGE_BOARD_PROJECTION/);
  assert.match(canvas, /cellHeightToWidthRatio: MOSSPROUT_GARDEN_CELL_HEIGHT_TO_WIDTH_RATIO/);
  assert.match(canvas, /fillAvailableSpace: true/);
  assert.match(canvas, /buildKingdomHexScene/);
  assert.match(canvas, /initialFitWorld: squareWorld/);
  assert.match(canvas, /minimumScale: squareWorld \? 0\.28 : undefined/);
  assert.doesNotMatch(canvas, /panExclusionFrame/);
  assert.doesNotMatch(canvas, /focusedSquareZoneId/);
  assert.match(canvas, /layer\.id === 'structure:mossprout-square-garden'[\s\S]*?\? 'full'/);
  assert.match(canvas, /kingdomHexTileSourceForLod\(layer, layerLod\)/);
  assert.match(canvas, /scene\.tiles\.find\(\(tile\) => tile\.kind === 'home'\)/);
  const squareScene = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'mossprout-square-scene.ts'),
    'utf8',
  );
  const orderRail = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'games', 'merge-order-rail.tsx'),
    'utf8',
  );
  assert.match(squareScene, /baristabbitBridgeLayer/);
  assert.match(squareScene, /eggHomeBridgeLayer/);
  assert.match(squareScene, /baristabbit-cafe-island\.webp/);
  assert.match(squareScene, /bridge-straight-horizontal-perspective\.webp/);
  assert.match(squareScene, /egg-home-island\.webp/);
  assert.match(squareScene, /mossprout-merge-island-perspective\.webp/);
  assert.match(squareScene, /haven-junction-mini-island-512\.webp/);
  assert.doesNotMatch(squareScene, /haven-junction-mini-island-tray-512\.webp/);
  assert.doesNotMatch(orderRail, /haven-junction-mini-island-tray-512\.webp/);
  assert.match(orderRail, /order-service-tray\.webp/);
  assert.match(squareScene, /junctionMiniIslandLayers/);
  assert.match(canvas, /MergeOrderTrayCard/);
  assert.match(canvas, /HAVEN_ORDER_SLOT_FRAMES = \[\s*JUNCTION_TRAY_FRAMES\[1\],\s*JUNCTION_TRAY_FRAMES\[0\],\s*JUNCTION_TRAY_FRAMES\[2\]/);
  assert.match(squareScene, /depth: 3/);
  assert.match(squareScene, /\.sort\(\(left, right\) => left\.depth - right\.depth\)/);
  assert.ok(fs.existsSync(path.join(process.cwd(), 'assets', 'images', 'katchimeras', 'world', 'square', 'mossprout-merge-island-perspective-512.webp')));
});
