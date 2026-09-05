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
import {
  buildWorldBoardSurfaceMesh,
  WORLD_BOARD_CONTOUR_SEGMENTS,
  type WorldBoardMeshBatch,
} from '../utils/world-board-surface-mesh';

function assertValidMeshBatch(batch: WorldBoardMeshBatch, label: string) {
  assert.equal(batch.indices.length % 3, 0, `${label}: indices must describe triangles`);
  assert.equal(batch.colors.length, batch.vertices.length, `${label}: vertex colors must align`);
  assert.equal(batch.textureCoordinates.length, batch.vertices.length, `${label}: texture coordinates must align`);
  batch.indices.forEach((index) => assert.ok(index >= 0 && index < batch.vertices.length, `${label}: invalid vertex index ${index}`));
  for (let index = 0; index < batch.indices.length; index += 3) {
    const first = batch.vertices[batch.indices[index]];
    const second = batch.vertices[batch.indices[index + 1]];
    const third = batch.vertices[batch.indices[index + 2]];
    const twiceArea = Math.abs(
      (second.x - first.x) * (third.y - first.y) -
      (second.y - first.y) * (third.x - first.x),
    );
    assert.ok(twiceArea > 0.001, `${label}: degenerate triangle ${index / 3}`);
  }
}

test('world-board generation is deterministic and produces only a 6x7 grass grid', () => {
  const first = generateWorldBoardManifest('mossprout-lab-001');
  const second = generateWorldBoardManifest('mossprout-lab-001');

  assert.deepEqual(second, first);
  assert.equal(first.projection, 'front-isometric');
  assert.equal(first.tileWidth, 120);
  assert.equal(first.tileHeight, 60);
  assert.equal(first.slabThickness, 68);
  assert.equal(first.regions.length, 1);
  assert.equal(first.board.columns, 6);
  assert.equal(first.board.rows, 7);
  assert.deepEqual(first.regions.map((region) => region.role), ['board']);
  assert.equal(first.regions[0].cells.length, 42);
  assert.deepEqual(first.subjects, []);
  assert.deepEqual(first.decorations, []);
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
    assert.equal(Math.max(...polygon.map((point) => point.y)) - Math.min(...polygon.map((point) => point.y)), 60);
  }
  assert.equal(boardCellAtWorldPoint(board, { x: -10_000, y: -10_000 }), null);
  assert.deepEqual(projectBoardCell(board, -1), []);
  assert.deepEqual(projectBoardCell(board, 63), []);
});

test('procedural seeds do not add dressing or move structural cells', () => {
  const first = generateWorldBoardManifest('detail-a');
  const second = generateWorldBoardManifest('detail-b');
  assert.deepEqual(second.regions, first.regions);
  assert.deepEqual(second.decorations, first.decorations);
});

test('filleted landmass mesh is deterministic, valid, and material-batched', () => {
  const manifest = generateWorldBoardManifest('surface-mesh');
  const first = buildWorldBoardSurfaceMesh(manifest);
  const second = buildWorldBoardSurfaceMesh(manifest);
  const tileCount = manifest.regions.reduce((total, region) => total + region.cells.length, 0);

  assert.deepEqual(second, first);
  assert.equal(first.stats.tileCount, tileCount);
  assert.equal(first.stats.surfaceTriangleCount, first.terrain.indices.length / 3);
  assert.equal(first.stats.wallTriangleCount, first.stats.wallFaceCount * 2);
  assert.equal(first.walls.length <= 16, true);
  assertValidMeshBatch(first.terrain, 'terrain');
  assertValidMeshBatch(first.boardOverlay, 'board overlay');
  assertValidMeshBatch(first.lockedOverlay, 'locked overlay');
  assertValidMeshBatch(first.holeMasks, 'hole masks');
  first.walls.forEach((batch, index) => assertValidMeshBatch(batch, `wall ${index}`));
  assert.equal(first.walls.reduce((total, batch) => total + batch.indices.length / 6, 0), first.stats.wallFaceCount);
  assert.equal(first.stats.boardOverlayTriangleCount, 2);
});

test('the single grass grid produces one rounded exterior contour', () => {
  const manifest = generateWorldBoardManifest('filleted-contours');
  const mesh = buildWorldBoardSurfaceMesh(manifest);
  assert.equal(mesh.stats.contourCount, 1);
  assert.equal(mesh.stats.holeContourCount, 0);
  assert.ok(mesh.stats.convexCornerCount > 0);
  assert.equal(mesh.stats.concaveCornerCount, 0);
  assert.equal(mesh.holeMasks.indices.length, 0);
  mesh.contours.forEach((contour) => {
    assert.equal(contour.boundary.length % (WORLD_BOARD_CONTOUR_SEGMENTS + 1), 0);
    assert.ok(contour.boundary.every((point) => point.z === 0));
  });
});

test('merge-board seams are one shader overlay instead of subdivided terrain geometry', () => {
  const manifest = generateWorldBoardManifest('board-overlay');
  const mesh = buildWorldBoardSurfaceMesh(manifest);
  assert.equal(mesh.boardOverlay.indices.length / 3, 2);
  assert.deepEqual(mesh.boardOverlay.textureCoordinates, [
    { x: 0, y: 0 },
    { x: 6, y: 0 },
    { x: 6, y: 7 },
    { x: 0, y: 7 },
  ]);
  assert.ok(mesh.terrain.indices.length / 3 < mesh.stats.tileCount * 2);
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

test('the lab route remains available without a Haven-page entry', () => {
  const route = fs.readFileSync('app/dev-world-board-lab.tsx', 'utf8');
  const screen = fs.readFileSync('components/katchadeck/dev/world-board-lab-screen.tsx', 'utf8');
  const haven = fs.readFileSync('components/katchadeck/roster/katchimera-kingdom-screen.tsx', 'utf8');
  const roster = fs.readFileSync('components/katchadeck/roster/katchimera-roster-route-screen.tsx', 'utf8');
  const shaders = fs.readFileSync('utils/world-board-material-shaders.ts', 'utf8');
  assert.match(route, /WorldBoardLabScreen/);
  assert.match(screen, /WORLD_BOARD_SURFACE_EFFECT/);
  assert.doesNotMatch(screen, /WORLD_BOARD_BEVEL_EFFECT/);
  assert.match(screen, /WORLD_BOARD_GRID_EFFECT/);
  assert.match(screen, /WORLD_BOARD_DEPTH_EFFECT/);
  assert.doesNotMatch(screen, /GRASS_GROUND_TEXTURE|ImageShader|bevelLighting/);
  assert.match(shaders, /const float blockWidth = 0\.56/);
  assert.match(shaders, /float valueNoise\(float2 value\)/);
  assert.doesNotMatch(shaders, /WORLD_BOARD_BEVEL_SHADER_SOURCE/);
  assert.match(shaders, /mod\(floor\(position\.x\) \+ floor\(position\.y\), 2\.0\)/);
  assert.match(shaders, /float roundedDistance = length/);
  assert.match(shaders, /checker \* roundedMask \* checkerOpacity/);
  assert.doesNotMatch(haven, /onOpenWorldBoardLab|Open World and Board Lab|>LAB</);
  assert.doesNotMatch(roster, /router\.push\('\/dev-world-board-lab'\)|onOpenWorldBoardLab/);
});
