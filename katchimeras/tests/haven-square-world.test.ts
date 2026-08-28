import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  baristabbitMossproutBridgeFrame,
  havenSquareZoneFrame,
  HAVEN_SQUARE_COLUMN_PITCH,
  HAVEN_SQUARE_ROW_PITCH,
  MOSSPROUT_GARDEN_CELL_HEIGHT_TO_WIDTH_RATIO,
  MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS,
  MOSSPROUT_SQUARE_ZONES,
  mossproutEggHomeBridgeFrame,
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
  assert.equal(HAVEN_SQUARE_ROW_PITCH, 450);
  const baristabbit = havenSquareZoneFrame(MOSSPROUT_SQUARE_ZONES[0].coord);
  const environment = havenSquareZoneFrame(MOSSPROUT_SQUARE_ZONES[1].coord);
  const eggHome = havenSquareZoneFrame(MOSSPROUT_SQUARE_ZONES[2].coord);
  const garden = havenSquareZoneFrame(MOSSPROUT_SQUARE_ZONES[3].coord);
  const westernBridge = baristabbitMossproutBridgeFrame();
  const easternBridge = mossproutEggHomeBridgeFrame();
  assert.equal(environment.left - (baristabbit.left + baristabbit.width), 120);
  assert.equal(eggHome.left - (environment.left + environment.width), 120);
  assert.equal(garden.left, environment.left);
  assert.equal(garden.top, environment.top + HAVEN_SQUARE_ROW_PITCH);
  assert.equal(environment.top + environment.height - garden.top, 150);
  assert.ok(westernBridge.left < baristabbit.left + baristabbit.width);
  assert.ok(westernBridge.left + westernBridge.width > environment.left);
  assert.ok(easternBridge.left < environment.left + environment.width);
  assert.ok(easternBridge.left + easternBridge.width > eggHome.left);
  assert.ok(easternBridge.top + easternBridge.height / 2 < environment.top + environment.height / 2);
  assert.deepEqual(westernBridge, { height: 201, left: 494, top: 207, width: 453 });
  assert.deepEqual(easternBridge, { height: 201, left: 1214, top: 207, width: 453 });
  assert.deepEqual(mossproutSquareSceneMetrics(), { width: 2160, height: 1170 });
});

test('the compact merge island hosts all stable Haven cells on one square-cell 7x6 playfield', () => {
  assert.equal(HAVEN_MERGE_BOARD_CELL_INDICES.length, 42);
  assert.equal(new Set(HAVEN_MERGE_BOARD_CELL_INDICES).size, 42);
  assert.ok(MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS.right > MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS.left);
  assert.ok(MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS.bottom > MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS.top);
  assert.equal((MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS.right - MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS.left) / 7, 76);
  assert.equal((MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS.bottom - MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS.top) / 6, 76);
  assert.equal(MOSSPROUT_GARDEN_CELL_HEIGHT_TO_WIDTH_RATIO, 1);
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
  assert.match(canvas, /buildMossproutSquareScene/);
  assert.match(canvas, /baseArtOpacity: 0\.34/);
  assert.match(canvas, /merge-board-base-7x6\.webp/);
  assert.ok(fs.existsSync(path.join(
    process.cwd(),
    'assets',
    'images',
    'katchimeras',
    'merge-world',
    'generated',
    'merge-board-base-7x6.webp',
  )));
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
  assert.match(squareScene, /baristabbitBridgeLayer/);
  assert.match(squareScene, /eggHomeBridgeLayer/);
  assert.match(squareScene, /baristabbit-cafe-island\.webp/);
  assert.match(squareScene, /bridge-straight-horizontal-perspective\.webp/);
  assert.match(squareScene, /egg-home-island\.webp/);
  assert.match(squareScene, /mossprout-merge-island\.webp/);
});
