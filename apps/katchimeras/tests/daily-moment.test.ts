import assert from 'node:assert/strict';
import test from 'node:test';
import { loadNativeModule } from './helpers/native-motion-harness';
import { MOSSPROUT_DAILY, MOSSPROUT_DAILY_MOMENT } from '../constants/companion-daily/mossprout';
import { MOSSPROUT_DAY_OPTIONS, MOSSPROUT_FTUE_COPY } from '../features/onboarding/mossprout-ftue-copy';
import { companionLifeActivityId } from '../utils/companion-life-activity-ids';

test('Mossprout’s Daily Moment is the first session’s weather question, one tap, with a reply for every answer', () => {
  assert.equal(MOSSPROUT_DAILY.moment, MOSSPROUT_DAILY_MOMENT);
  assert.equal(MOSSPROUT_DAILY_MOMENT.prompt, MOSSPROUT_FTUE_COPY.dayQuestion);
  assert.deepEqual(MOSSPROUT_DAILY_MOMENT.options.map((option) => option.id), MOSSPROUT_DAY_OPTIONS.map((option) => option.id), 'the ids the first session already used');
  for (const option of MOSSPROUT_DAILY_MOMENT.options) assert.ok(MOSSPROUT_DAILY_MOMENT.replies[option.id], `${option.id} has a reply`);
  assert.equal(companionLifeActivityId('mossprout', '2026-09-16', 'moment'), 'mossprout:life:2026-09-16:moment', 'once a day, in the life store');
});

test('a journey line can read today’s moment back once it is kept, and nothing before', () => {
  let completions: Record<string, { status: string; answer: string }> = {};
  const module = loadNativeModule('utils/companion-daily-moment.ts', {
    '@/utils/companion-life-activity-storage': { loadCompanionLifeActivities: () => ({ version: 1, completions, capture: null }) },
  });
  assert.equal(module.dailyMomentConfig('mossprout'), MOSSPROUT_DAILY_MOMENT);
  assert.equal(module.dailyMomentConfig('steppling'), null);
  assert.equal(module.todayMomentAnswer('mossprout', '2026-09-16'), null);
  completions = { 'mossprout:life:2026-09-16:moment': { status: 'pending', answer: 'Full sun' } };
  assert.equal(module.todayMomentAnswer('mossprout', '2026-09-16'), null, 'not until it is kept');
  completions = { 'mossprout:life:2026-09-16:moment': { status: 'complete', answer: 'Full sun' } };
  assert.equal(module.todayMomentAnswer('mossprout', '2026-09-16'), 'Full sun');
  assert.equal(module.todayMomentAnswer('mossprout', '2026-09-17'), null, 'yesterday’s weather is not today’s');
});
