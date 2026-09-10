import assert from 'node:assert/strict';
import test from 'node:test';
import { mossproutEggGuide } from '@/features/onboarding/mossprout-egg-echo';
import { MOSSPROUT_DAY_OPTIONS, MOSSPROUT_FTUE_COPY, MOSSPROUT_HELP_OPTIONS } from '@/features/onboarding/mossprout-ftue-copy';
import { MOSSPROUT_FTUE_SCRIPT, mossproutFtueStep } from '@/features/onboarding/mossprout-ftue-script';
import { ftueDialoguePages, FTUE_DIALOGUE_MAX_CHARACTERS } from '@/features/onboarding/ftue-dialogue-pages';

const answer = (actionId: string, optionId: string) => ({ [actionId]: { actionId, optionId, label: optionId, private: false, committedAt: 'now' } });

test('the Egg echoes every day and help answer in Mossprout’s voice before the next question', () => {
  const context = mossproutFtueStep('egg.context')!;
  for (const option of MOSSPROUT_DAY_OPTIONS) {
    const guide = mossproutEggGuide(context, { answers: answer('egg.day_texture', option.id) })!;
    assert.notEqual(guide.title, context.guide.title, option.id);
    assert.ok(guide.title.length <= 60, `${option.id}: one short line`);
  }
  const ready = mossproutFtueStep('egg.ready')!;
  for (const option of MOSSPROUT_HELP_OPTIONS) {
    assert.notEqual(mossproutEggGuide(ready, { answers: answer('egg.desired_help', option.id) })!.title, ready.guide.title, option.id);
  }
  assert.deepEqual(mossproutEggGuide(context, { answers: {} }), context.guide, 'no answer keeps the authored line');
  assert.deepEqual(mossproutEggGuide(context, null), context.guide);
  assert.deepEqual(mossproutEggGuide(mossproutFtueStep('egg.opening'), { answers: answer('egg.day_texture', 'heavy') }), mossproutFtueStep('egg.opening')!.guide, 'only the two echo beats change');
  assert.equal(mossproutEggGuide(null, null), null);
});

test('first-session copy stays short, in voice, and free of system nouns', () => {
  const SYSTEM_NOUNS = /\b(Glow|Bond|Merge|Journey|Chapter|Meditat\w*|Upgrade|Katchimera)\b/;
  const spoken = [
    MOSSPROUT_FTUE_COPY.opening, MOSSPROUT_FTUE_COPY.seedOrigin, MOSSPROUT_FTUE_COPY.planted, MOSSPROUT_FTUE_COPY.mergePurpose,
    MOSSPROUT_FTUE_COPY.growth, MOSSPROUT_FTUE_COPY.waterQuestion, MOSSPROUT_FTUE_COPY.farewell, MOSSPROUT_FTUE_COPY.meditationHelp,
  ];
  for (const line of spoken) {
    assert.doesNotMatch(line, SYSTEM_NOUNS, line);
    for (const page of ftueDialoguePages(line)) assert.ok(page.length <= FTUE_DIALOGUE_MAX_CHARACTERS, page);
  }
  assert.equal(ftueDialoguePages(MOSSPROUT_FTUE_COPY.farewell).length, 2, 'the farewell carries one idea per page');
  const shippingMergeSteps = ['merge.serve_sprout', 'world.first_bloom_offer', 'world.first_bloom_restore', 'world.first_seed_grew'];
  for (const stepId of shippingMergeSteps) {
    const guide = mossproutFtueStep(stepId)!.guide;
    assert.doesNotMatch(guide.title, SYSTEM_NOUNS, `${stepId} title speaks as Mossprout`);
    assert.ok(guide.title.length <= 60, `${stepId}: ${guide.title}`);
  }
  const firstTenMinutes = MOSSPROUT_FTUE_SCRIPT.steps.filter((step) => ['world.mist_open', 'world.mist_clear', 'world.mist_lift', 'world.egg_intro', 'egg.opening', 'egg.context', 'egg.ready', 'companion.first_meeting'].includes(step.id));
  for (const step of firstTenMinutes) {
    for (const action of step.actions) assert.doesNotMatch(`${action.title} ${action.description}`, /Katchimera/, `${step.id}: the brand word waits until after the hatch`);
  }
});
