import assert from 'node:assert/strict';
import test from 'node:test';

import {
  todayHexCameraPositionForProgress,
  todayHexCameraTarget,
} from '../utils/today-hex-neighborhood-layout';

test('continuous Today camera path lands exactly on every hex target', () => {
  for (let index = 0; index < 6; index += 1) {
    const continuous = todayHexCameraPositionForProgress(index, 240, 96);
    const target = todayHexCameraTarget(index, 240, 96);
    assert.ok(Math.abs(continuous.x - target.x) < 0.000_001);
    assert.ok(Math.abs(continuous.y - target.y) < 0.000_001);
  }
});

test('continuous Today camera path moves smoothly between alternating rows', () => {
  assert.deepEqual(todayHexCameraPositionForProgress(0, 240, 96), { x: -0, y: -0 });

  const halfwayDown = todayHexCameraPositionForProgress(0.5, 240, 96);
  assert.ok(Math.abs(halfwayDown.x + 120) < 0.000_001);
  assert.ok(Math.abs(halfwayDown.y + 48) < 0.000_001);

  const halfwayUp = todayHexCameraPositionForProgress(1.5, 240, 96);
  assert.ok(Math.abs(halfwayUp.x + 360) < 0.000_001);
  assert.ok(Math.abs(halfwayUp.y + 48) < 0.000_001);
});
