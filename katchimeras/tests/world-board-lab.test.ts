import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  boardCellAtWorldPoint,
  boardCellCenter,
  generateWorldBoardManifest,
  projectBoardCell,
  screenPointToWorldBoard,
  validateWorldManifest,
  worldPointToScreen,
} from '../utils/world-board-lab';

test('world-board generation is deterministic and preserves the authored topology', () => {
  const first = generateWorldBoardManifest('mossprout-lab-001');
  const second = generateWorldBoardManifest('mossprout-lab-001');

  assert.deepEqual(second, first);
  assert.equal(first.projection, 'oblique-top-down');
  assert.equal(first.tileWidth, 120);
  assert.equal(first.tileHeight, 96);
  assert.equal(first.slabThickness, 46);
  assert.equal(first.regions.length, 13);
  assert.equal(first.board.columns, 7);
  assert.equal(first.board.rows, 9);
  assert.deepEqual(
    first.regions.map((region) => region.role).sort(),
    ['board', 'companion', 'connector', 'connector', 'connector', 'connector', 'connector', 'decor', 'decor', 'home', 'locked', 'locked', 'connector'].sort(),
  );
});

test('250 consecutive seeds preserve a connected, non-overlapping isometric world', () => {
  for (let index = 1; index <= 250; index += 1) {
    const manifest = generateWorldBoardManifest(`mossprout-lab-${String(index).padStart(3, '0')}`);
    const validation = validateWorldManifest(manifest);
    assert.equal(validation.valid, true, `${index}: ${validation.errors.join(', ')}`);
    assert.ok(manifest.bounds.width > 0);
    assert.ok(manifest.bounds.height > 0);
  }
});

test('every projected board cell resolves back to its stable logical index', () => {
  const board = generateWorldBoardManifest('projection-roundtrip').board;
  for (let cell = 0; cell < board.columns * board.rows; cell += 1) {
    const center = boardCellCenter(board, cell);
    assert.ok(center);
    assert.equal(boardCellAtWorldPoint(board, center), cell);
    const polygon = projectBoardCell(board, cell);
    assert.equal(polygon.length, 4);
    assert.equal(Math.max(...polygon.map((point) => point.x)) - Math.min(...polygon.map((point) => point.x)), 120);
    assert.equal(Math.max(...polygon.map((point) => point.y)) - Math.min(...polygon.map((point) => point.y)), 96);
  }
  assert.equal(boardCellAtWorldPoint(board, { x: -10_000, y: -10_000 }), null);
  assert.deepEqual(projectBoardCell(board, -1), []);
  assert.deepEqual(projectBoardCell(board, 63), []);
});

test('procedural seeds vary detail dressing without moving structural cells', () => {
  const first = generateWorldBoardManifest('detail-a');
  const second = generateWorldBoardManifest('detail-b');
  assert.deepEqual(second.regions, first.regions);
  assert.notDeepEqual(second.decorations, first.decorations);
});

test('world and screen camera transforms round-trip', () => {
  const scene = { width: 2400, height: 2800 };
  const camera = { tx: -830, ty: -1010, scale: 0.62 };
  const world = { x: 1264, y: 1418 };
  const screen = worldPointToScreen(world, scene, camera);
  const restored = screenPointToWorldBoard(screen, scene, camera);
  assert.ok(Math.abs(restored.x - world.x) < 1e-9);
  assert.ok(Math.abs(restored.y - world.y) < 1e-9);
});

test('the lab route and Haven entry remain development-only presentation', () => {
  const route = fs.readFileSync('app/dev-world-board-lab.tsx', 'utf8');
  const haven = fs.readFileSync('components/katchadeck/roster/katchimera-kingdom-screen.tsx', 'utf8');
  const roster = fs.readFileSync('components/katchadeck/roster/katchimera-roster-route-screen.tsx', 'utf8');
  assert.match(route, /WorldBoardLabScreen/);
  assert.match(haven, /__DEV__ && !ftueStepId && onOpenWorldBoardLab/);
  assert.match(roster, /router\.push\('\/dev-world-board-lab'\)/);
});
