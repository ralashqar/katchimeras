import assert from 'node:assert/strict';
import test from 'node:test';

import {
  companionDestinationSpeechBubbleTop,
  companionDestinationStageLift,
  companionHomeStageLayout,
  companionQuestListSpacer,
  companionSpeechBubbleDrop,
} from '../utils/companion-home-layout';

test('companion home moves its environment and resident up and to the right', () => {
  const layout = companionHomeStageLayout(390, 844, 'mossprout');

  assert.ok(layout.translateX >= 82 && layout.translateX <= 126);
  assert.ok(layout.translateY <= -32 && layout.translateY >= -52);
  assert.ok(layout.backgroundImageSize > 844);
  assert.ok(layout.creatureFrame.size > 240);
});

test('companion home framing remains bounded on compact and tablet viewports', () => {
  const compact = companionHomeStageLayout(320, 568, 'steppling');
  const tablet = companionHomeStageLayout(834, 1194, 'vesperitt');

  assert.equal(compact.translateX, 83.2);
  assert.equal(compact.translateY, -32);
  assert.equal(tablet.translateX, 126);
  assert.equal(tablet.translateY, -52);
});

test('the creature contact point is preserved before the shared stage transform', () => {
  const layout = companionHomeStageLayout(390, 844, 'feastle');
  const visibleBottom = layout.creatureFrame.top
    + layout.creatureFrame.size * 0.894531;

  assert.ok(
    Math.abs(
      visibleBottom
      - layout.creatureFrame.stageContactY
      - layout.creatureDropY
    ) < 0.0001,
  );
  assert.ok(Math.abs(layout.creatureDropY - 25.32) < 0.0001);
});

test('destination pose lifts the complete cinematic stage toward the top', () => {
  assert.equal(companionDestinationStageLift(568), 118);
  assert.equal(companionDestinationStageLift(844), 135.04);
  assert.equal(companionDestinationStageLift(1194), 150);
});

test('every companion page keeps its speech bubble lower beside the creature', () => {
  assert.equal(companionSpeechBubbleDrop(568), 64);
  assert.equal(companionSpeechBubbleDrop(844), 75.96);
  assert.equal(companionSpeechBubbleDrop(1194), 84);
});

test('destination speech bubble remains below top chrome after the stage lift', () => {
  for (const height of [568, 844, 1194]) {
    const safeTop = height === 568 ? 20 : 47;
    const authoredTop = companionDestinationSpeechBubbleTop(height, safeTop);
    const visibleTop = authoredTop - companionDestinationStageLift(height);
    assert.ok(Math.abs(visibleTop - (safeTop + 92)) < 0.0001);
  }
});

test('quest list uses a compact responsive handoff beneath the cinematic stage', () => {
  assert.equal(companionQuestListSpacer(568), 176);
  assert.ok(Math.abs(companionQuestListSpacer(844) - 198.34) < 0.0001);
  assert.equal(companionQuestListSpacer(1194), 216);
});
