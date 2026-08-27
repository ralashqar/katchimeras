import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  boardCellAtWorldPoint,
  boardCellCenter,
  generateWorldBoardManifest,
  projectLabSurfacePoint,
  projectBoardCell,
  screenPointToWorldBoard,
  validateWorldManifest,
  worldPointToScreen,
} from '../utils/world-board-lab';
import {
  buildWorldBoardSurfaceMesh,
  WORLD_BOARD_BEVEL_DROP,
  WORLD_BOARD_CORNER_SEGMENTS,
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

test('beveled surface mesh is deterministic, valid, and batched', () => {
  const manifest = generateWorldBoardManifest('surface-mesh');
  const first = buildWorldBoardSurfaceMesh(manifest);
  const second = buildWorldBoardSurfaceMesh(manifest);
  const tileCount = manifest.regions.reduce((total, region) => total + region.cells.length, 0);

  assert.deepEqual(second, first);
  assert.equal(first.stats.tileCount, tileCount);
  assert.equal(first.stats.surfaceTriangleCount, first.stats.topTriangleCount + first.stats.bevelTriangleCount);
  assert.ok(first.stats.topTriangleCount >= tileCount * 2);
  assert.equal(first.stats.wallTriangleCount, first.stats.wallFaceCount * 2);
  assert.equal(first.surfaces.grass.length <= 16, true);
  assert.equal(first.surfaces.locked.length <= 16, true);
  const surfaceBatches = [...first.surfaces.grass, ...first.surfaces.locked];
  surfaceBatches.forEach((batch) => assertValidMeshBatch(batch, `surface mask ${batch.cornerMask}`));
  first.walls.forEach((batch, index) => assertValidMeshBatch(batch, `wall ${index}`));
  assert.equal(surfaceBatches.reduce((total, batch) => total + batch.indices.length / 3, 0), first.stats.surfaceTriangleCount);
  assert.equal(first.walls.reduce((total, batch) => total + batch.indices.length / 6, 0), first.stats.wallFaceCount);
  assert.ok(first.stats.roundedCornerCount > 0);
});

test('only convex exposed tile corners receive real rounded geometry', () => {
  const manifest = generateWorldBoardManifest('rounded-corners');
  const mesh = buildWorldBoardSurfaceMesh(manifest);
  const occupied = new Set(manifest.regions.flatMap((region) => region.cells.map((cell) => `${cell.col}:${cell.row}`)));
  const neighborOffsets = [{ col: 0, row: -1 }, { col: 1, row: 0 }, { col: 0, row: 1 }, { col: -1, row: 0 }];
  const cornerSides = [[3, 0], [0, 1], [1, 2], [2, 3]] as const;

  mesh.tileProfiles.forEach((profile) => {
    const roundedCorners = profile.cornerMask.toString(2).replaceAll('0', '').length;
    assert.equal(profile.outer.length, 4 + roundedCorners * WORLD_BOARD_CORNER_SEGMENTS);
    assert.equal(profile.inner.length, profile.outer.length);
    cornerSides.forEach(([firstSide, secondSide], corner) => {
      const rounded = (profile.cornerMask & (1 << corner)) !== 0;
      const neighborsAbsent = [firstSide, secondSide].every((side) => {
        const offset = neighborOffsets[side];
        return !occupied.has(`${profile.cell.col + offset.col}:${profile.cell.row + offset.row}`);
      });
      assert.equal(rounded, neighborsAbsent, `${profile.cell.col}:${profile.cell.row} corner ${corner}`);
    });
  });
});

test('neighboring beveled tiles meet at identical lowered seam vertices', () => {
  const manifest = generateWorldBoardManifest('surface-seams');
  const mesh = buildWorldBoardSurfaceMesh(manifest);
  const left = mesh.tileProfiles.find((profile) => profile.cell.col === 0 && profile.cell.row === 0);
  const right = mesh.tileProfiles.find((profile) => profile.cell.col === 1 && profile.cell.row === 0);

  assert.ok(left);
  assert.ok(right);
  assert.deepEqual(left.outer[1], right.outer[0]);
  assert.deepEqual(left.outer[2], right.outer[3]);
  assert.equal(left.outer[1].z, -WORLD_BOARD_BEVEL_DROP);
  assert.ok(left.inner.every((point) => point.z === 0));
  assert.deepEqual(
    projectLabSurfacePoint(manifest.sceneOrigin, left.outer[1]),
    projectLabSurfacePoint(manifest.sceneOrigin, right.outer[0]),
  );
  assert.deepEqual(
    projectLabSurfacePoint(manifest.sceneOrigin, left.outer[2]),
    projectLabSurfacePoint(manifest.sceneOrigin, right.outer[3]),
  );
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
  const screen = fs.readFileSync('components/katchadeck/dev/world-board-lab-screen.tsx', 'utf8');
  const haven = fs.readFileSync('components/katchadeck/roster/katchimera-kingdom-screen.tsx', 'utf8');
  const roster = fs.readFileSync('components/katchadeck/roster/katchimera-roster-route-screen.tsx', 'utf8');
  const shaders = fs.readFileSync('utils/world-board-material-shaders.ts', 'utf8');
  assert.match(route, /WorldBoardLabScreen/);
  assert.match(screen, /WORLD_BOARD_SURFACE_EFFECT/);
  assert.match(screen, /WORLD_BOARD_DEPTH_EFFECT/);
  assert.doesNotMatch(screen, /bevelLighting/);
  assert.match(shaders, /float tileSdf\(float2 uv\)/);
  assert.match(shaders, /float valueNoise\(float2 value\)/);
  assert.match(haven, /__DEV__ && onOpenWorldBoardLab/);
  assert.doesNotMatch(haven, /__DEV__ && !ftueStepId && onOpenWorldBoardLab/);
  assert.match(roster, /router\.push\('\/dev-world-board-lab'\)/);
});
