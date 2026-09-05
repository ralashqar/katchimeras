import assert from 'node:assert/strict';
import test from 'node:test';

import {
  todayHexCameraPositionForProgress,
  todayHexCameraTarget,
} from '../utils/today-hex-neighborhood-layout';
import {
  todayEggCountdownTop,
  todayEggStageFrame,
} from '../utils/today-kingdom-hero-layout';

test('continuous Today camera path lands exactly on every hex target', () => {
  for (let index = 0; index < 6; index += 1) {
    const continuous = todayHexCameraPositionForProgress(index, 240, 96);
    const target = todayHexCameraTarget(index, 240, 96);
    assert.ok(Math.abs(continuous.x - target.x) < 0.000_001);
    assert.ok(Math.abs(continuous.y - target.y) < 0.000_001);
  }
});

test('continuous Today camera path lerps in a straight line between alternating rows', () => {
  assert.deepEqual(todayHexCameraPositionForProgress(0, 240, 96), { x: -0, y: -0 });

  const quarterDown = todayHexCameraPositionForProgress(0.25, 240, 96);
  assert.ok(Math.abs(quarterDown.x + 60) < 0.000_001);
  assert.ok(Math.abs(quarterDown.y + 24) < 0.000_001);

  const halfwayDown = todayHexCameraPositionForProgress(0.5, 240, 96);
  assert.ok(Math.abs(halfwayDown.x + 120) < 0.000_001);
  assert.ok(Math.abs(halfwayDown.y + 48) < 0.000_001);

  const quarterUp = todayHexCameraPositionForProgress(1.25, 240, 96);
  assert.ok(Math.abs(quarterUp.x + 300) < 0.000_001);
  assert.ok(Math.abs(quarterUp.y + 72) < 0.000_001);

  const halfwayUp = todayHexCameraPositionForProgress(1.5, 240, 96);
  assert.ok(Math.abs(halfwayUp.x + 360) < 0.000_001);
  assert.ok(Math.abs(halfwayUp.y + 48) < 0.000_001);
});

test('Today hatch countdown is anchored below the rendered egg shell', () => {
  const eggCenterY = 128;
  const eggStageScale = 0.82;
  const renderedShellBottom = eggCenterY + (224 * eggStageScale) / 2;
  assert.ok(todayEggCountdownTop(eggCenterY, eggStageScale) > renderedShellBottom);
});

test('Today egg uses a native-size frame centred on its Kingdom anchor', () => {
  const frame = todayEggStageFrame(128, 0.42);
  assert.ok(frame.height > 0);
  assert.ok(Math.abs(frame.top + frame.height / 2 - 128) < 0.000_001);
});
