import assert from 'node:assert/strict';
import {test} from 'node:test';
import {healthCrackOpacity, defeatProgress, DEFEAT_SHAKE_MS, DEFEAT_PUFF_MS, DEFEAT_FINISH_MS, DEFEAT_REWARD_AT_MS} from '../game/hatch-presentation';

test('cracks map full health to transparent and ten percent health to fully visible', () => {
  assert.equal(healthCrackOpacity(1), 0);
  assert.ok(Math.abs(healthCrackOpacity(.55) - .5) < 1e-10);
  assert.equal(healthCrackOpacity(.1), 1);
  assert.equal(healthCrackOpacity(0), 1);
  assert.equal(healthCrackOpacity(2), 0);
});
test('hatch gives a full second of shaking before the puff; rewards fit before results', () => {
  assert.equal(defeatProgress(0), 0);
  assert.equal(defeatProgress(DEFEAT_SHAKE_MS), 0);
  assert.equal(defeatProgress(DEFEAT_SHAKE_MS + DEFEAT_PUFF_MS / 2), .5);
  assert.equal(defeatProgress(DEFEAT_SHAKE_MS + DEFEAT_PUFF_MS), 1);
  assert.ok(DEFEAT_REWARD_AT_MS >= DEFEAT_SHAKE_MS);
  assert.ok(DEFEAT_FINISH_MS > DEFEAT_REWARD_AT_MS + 930);
});
