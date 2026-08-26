import assert from 'node:assert/strict';
import test from 'node:test';

import {
  companionDestinationSpeechBubbleTop,
  companionDestinationStageLift,
  companionFtueSubjectHandoffLayout,
  companionHomeHeroSpacer,
  companionHubHeroSpacer,
  companionHomeStageLayout,
  companionQuestionnaireHeroSpacer,
  companionQuestListSpacer,
  companionSpeechTitleTier,
  companionSpeechBubbleDrop,
} from '../utils/companion-home-layout';
import { resolveCreatureGroundShadowLayout } from '../utils/creature-ground-shadow';

test('companion home centres its grown resident on the Today platform', () => {
  const layout = companionHomeStageLayout(390, 844, 'mossprout');

  assert.equal(layout.translateX, 0);
  assert.ok(layout.translateY >= 8 && layout.translateY <= 14);
  assert.ok(layout.backgroundImageSize > 844);
  assert.ok(layout.creatureFrame.size > 200);
});

test('companion home framing remains bounded on compact and tablet viewports', () => {
  const compact = companionHomeStageLayout(320, 568, 'steppling');
  const tablet = companionHomeStageLayout(834, 1194, 'vesperitt');

  assert.equal(compact.translateX, 0);
  assert.equal(compact.translateY, 8);
  assert.equal(tablet.translateX, 0);
  assert.equal(tablet.translateY, 14);
});

test('the creature sits slightly below the environment contact point', () => {
  const layout = companionHomeStageLayout(390, 844, 'feastle');
  const visibleBottom = layout.creatureFrame.top
    + layout.creatureFrame.size * 0.94;

  assert.ok(
    Math.abs(
      visibleBottom
      - layout.creatureFrame.stageContactY
      - layout.creatureDropY
    ) < 0.0001,
  );
  assert.ok(layout.creatureDropY >= 4 && layout.creatureDropY <= 6);
});

test('destination pose lifts the complete cinematic stage toward the top', () => {
  assert.ok(Math.abs(companionDestinationStageLift(568, 320) - 57.12) < 0.0001);
  assert.ok(Math.abs(companionDestinationStageLift(844, 390) - 85.776) < 0.0001);
  assert.ok(Math.abs(companionDestinationStageLift(1194, 834) - 119.46) < 0.0001);
});

test('FTUE hatch and regular Companion subjects share one continuous handoff frame', () => {
  for (const [width, height] of [[320, 568], [390, 844], [834, 1194]]) {
    const handoff = companionFtueSubjectHandoffLayout(width, height, 'mossprout');
    const centerY = height / 2;
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      const incomingScale = handoff.incomingStartScale
        + (1 - handoff.incomingStartScale) * progress;
      const incomingTranslateY = handoff.incomingStartTranslateY
        + (-handoff.destinationLift - handoff.incomingStartTranslateY) * progress;
      const incomingCenterY = centerY
        + (handoff.regularRawCenterY - centerY) * incomingScale
        + incomingTranslateY;
      const incomingSize = handoff.regularSize * incomingScale;

      const outgoingScale = 1 + (handoff.outgoingEndScale - 1) * progress;
      const outgoingTranslateY = handoff.outgoingEndTranslateY * progress;
      const outgoingCenterY = centerY
        + (handoff.hatchCenterY - centerY) * outgoingScale
        + outgoingTranslateY;
      const outgoingSize = handoff.hatchSize * outgoingScale;

      assert.ok(Math.abs(incomingCenterY - outgoingCenterY) < 0.0001);
      assert.ok(Math.abs(incomingSize - outgoingSize) < 0.0001);
    }
  }
});

test('compact hub reserves the lower interaction zone across phone and tablet sizes', () => {
  assert.equal(companionHubHeroSpacer(568), 338);
  assert.ok(Math.abs(companionHubHeroSpacer(844) - 472.64) < 0.0001);
  assert.equal(companionHubHeroSpacer(1194), 500);
});

test('grown companion shadows use the mature canvas baseline', () => {
  const mossprout = resolveCreatureGroundShadowLayout('mossprout', 200, 1, 'grown');
  const feastle = resolveCreatureGroundShadowLayout('feastle', 200, 1, 'grown');
  assert.equal(mossprout.contactY, 188);
  assert.equal(feastle.contactY, 188);
});

test('top-level companion home hands content off closer to the lifted art', () => {
  assert.ok(Math.abs(companionHomeHeroSpacer(568) - 193.12) < 0.0001);
  assert.ok(Math.abs(companionHomeHeroSpacer(844) - 244.76) < 0.0001);
  assert.equal(companionHomeHeroSpacer(1194), 270);
});

test('long home greetings step down before they overgrow the speech bubble', () => {
  assert.equal(companionSpeechTitleTier('Where shall we begin today?'), 'standard');
  assert.equal(companionSpeechTitleTier('I’m ready to take the next step with you.'), 'medium');
  assert.equal(
    companionSpeechTitleTier('I’m here for both the person you care for and the caregiver in you.'),
    'long',
  );
});

test('every companion page keeps its speech bubble lower beside the creature', () => {
  assert.equal(companionSpeechBubbleDrop(568), 64);
  assert.equal(companionSpeechBubbleDrop(844), 75.96);
  assert.equal(companionSpeechBubbleDrop(1194), 84);
});

test('destination speech bubble remains below top chrome after the coverage-safe stage lift', () => {
  for (const [width, height] of [[320, 568], [390, 844], [834, 1194]]) {
    const safeTop = height === 568 ? 20 : 47;
    const authoredTop = companionDestinationSpeechBubbleTop(height, safeTop, width);
    const visibleTop = authoredTop - companionDestinationStageLift(height, width);
    assert.ok(Math.abs(visibleTop - (safeTop + 92)) < 0.0001);
  }
});

test('quest list uses a compact responsive handoff beneath the cinematic stage', () => {
  assert.equal(companionQuestListSpacer(568), 176);
  assert.ok(Math.abs(companionQuestListSpacer(844) - 198.34) < 0.0001);
  assert.equal(companionQuestListSpacer(1194), 216);
});

test('questionnaire spacer grows with measured speech copy instead of allowing overlap', () => {
  assert.equal(companionQuestionnaireHeroSpacer(700, 0), 210);
  assert.equal(companionQuestionnaireHeroSpacer(700, 160), 210);
  assert.equal(companionQuestionnaireHeroSpacer(700, 228), 278);
  assert.equal(companionQuestionnaireHeroSpacer(844, 160), 238);
  assert.equal(companionQuestionnaireHeroSpacer(844, 250), 328);
});
