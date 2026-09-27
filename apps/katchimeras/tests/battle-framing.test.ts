import assert from 'node:assert/strict';
import test from 'node:test';
import { captureSettledBattleTile, projectBattleTile, restoreBattleTileFrame } from '@/features/encounter/battle-framing';
import { kingdomCameraSnapshotForTarget } from '@incubator/environments/hex-camera-math';

test('battle preserves the world tile frame, including camera origin and local focus scale', () => {
  const viewport = { width: 390, height: 844 }, scene = { width: 2000, height: 1800 };
  const tile = { left: 1400, top: 220, width: 440, height: 440 };
  const focus = { x: 1590, y: 410, scale: 1.04 };
  const camera = kingdomCameraSnapshotForTarget(viewport, scene, focus, 0.96, { x: 195, y: 844 * 0.36 }, true);
  const frame = projectBattleTile(tile, scene, camera, { x: 0, y: 12 }, focus);
  assert.ok(Math.abs(frame.left + (focus.x - tile.left) * 0.96 * 1.04 - 195) < 0.001);
  assert.ok(Math.abs(frame.top + (focus.y - tile.top) * 0.96 * 1.04 - (844 * 0.36 + 12)) < 0.001);
  assert.equal(frame.width, 440 * 0.96 * 1.04);
  const restored = restoreBattleTileFrame({ frame, viewport }, viewport);
  for (const key of ['left', 'top', 'width', 'height'] as const) assert.ok(Math.abs(restored[key] - frame[key]) < 0.001);
  const resized = restoreBattleTileFrame({ frame, viewport }, { width: 780, height: 1000 });
  assert.equal(resized.width, frame.width * 2);
  assert.ok(Math.abs((1000 - resized.top) - (844 - frame.top) * 2) < 0.001, 'matches the bottom-docked board scaling');
});

test('a camera pan starting in a child effect cancels entry before capturing a frame', async () => {
  let current = true, frames = 0, captures = 0;
  const result = await captureSettledBattleTile(() => current, async () => { captures++; return null; }, async () => {
    frames++;
    if (frames === 1) current = false;
  });
  assert.equal(result, null);
  assert.equal(captures, 0);
});

test('a stale native measurement cannot start the curtain after retargeting or leaving', async () => {
  let current = true;
  const frame = { left: 10, top: 30, width: 300, height: 300 };
  const stale = await captureSettledBattleTile(() => current, async () => { current = false; return frame; }, async () => {});
  assert.equal(stale, null);
  const settled = await captureSettledBattleTile(() => true, async () => frame, async () => {});
  assert.equal(settled, frame);
});
