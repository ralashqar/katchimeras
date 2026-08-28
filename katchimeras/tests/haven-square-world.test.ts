import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  havenSquareZoneFrame,
  HAVEN_SQUARE_ZONE_FRAME_OVERLAP,
  MOSSPROUT_GARDEN_CELL_HEIGHT_TO_WIDTH_RATIO,
  MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS,
  MOSSPROUT_SQUARE_ZONES,
  mossproutSquareSceneMetrics,
} from '../utils/haven-square-world';
import {
  HAVEN_MERGE_BOARD_CELL_INDICES,
} from '../utils/merge-world/haven-sandbox';

test('Mossprout square Haven stacks two equal zones with tightly framed silhouettes', () => {
  assert.deepEqual(MOSSPROUT_SQUARE_ZONES, [
    { id: 'mossprout-environment', coord: { column: 0, row: 0 } },
    { id: 'mossprout-garden', coord: { column: 0, row: 1 } },
  ]);
  assert.equal(HAVEN_SQUARE_ZONE_FRAME_OVERLAP, 52);
  const environment = havenSquareZoneFrame(MOSSPROUT_SQUARE_ZONES[0].coord);
  const garden = havenSquareZoneFrame(MOSSPROUT_SQUARE_ZONES[1].coord);
  assert.equal(garden.left, environment.left);
  assert.equal(
    environment.top + environment.height - garden.top,
    HAVEN_SQUARE_ZONE_FRAME_OVERLAP,
  );
  assert.deepEqual(mossproutSquareSceneMetrics(), { width: 720, height: 1268 });
});

test('the tall unlined garden hosts all stable Haven cells on one live 6x7 playfield', () => {
  assert.equal(HAVEN_MERGE_BOARD_CELL_INDICES.length, 42);
  assert.equal(new Set(HAVEN_MERGE_BOARD_CELL_INDICES).size, 42);
  assert.ok(MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS.right > MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS.left);
  assert.ok(MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS.bottom > MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS.top);
  assert.ok(MOSSPROUT_GARDEN_CELL_HEIGHT_TO_WIDTH_RATIO > 0.9);
  assert.ok(MOSSPROUT_GARDEN_CELL_HEIGHT_TO_WIDTH_RATIO < 1);
});

test('square Haven runtime art includes full, medium, and thumbnail tiers', () => {
  for (const stem of ['mossprout-main-environment', 'mossprout-garden-6x7-flat']) {
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
  assert.match(canvas, /merge-board-base-6x7\.webp/);
  assert.match(canvas, /cellHeightToWidthRatio: MOSSPROUT_GARDEN_CELL_HEIGHT_TO_WIDTH_RATIO/);
  assert.match(canvas, /fillAvailableSpace: true/);
  assert.match(canvas, /buildKingdomHexScene/);
  assert.match(canvas, /initialFitWorld: squareWorld/);
  assert.match(canvas, /panExclusionFrame: mergeBoard \? gardenBoardFrame : null/);
  assert.match(canvas, /layer\.id === 'structure:mossprout-square-garden'[\s\S]*?\? 'full'/);
  assert.match(canvas, /kingdomHexTileSourceForLod\(layer, layerLod\)/);
});
