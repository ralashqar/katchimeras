import assert from 'node:assert/strict';
import test from 'node:test';

import type { HomeDayRecord } from '@/types/home';
import { buildMomentTimeline } from '@/utils/moment-timeline';

const createdAt = '2026-08-15T09:00:00.000Z';

test('Moments use the selected mood face instead of generic journal artwork', () => {
  const day = {
    id: 'mood-day',
    isoDate: '2026-08-15',
    moments: [],
    promptAnswers: [{
      id: 'mood-answer',
      kind: 'feeling',
      choiceIds: ['stressed'],
      labels: ['Stormy'],
      createdAt,
      source: 'prompt_chip',
      semanticTags: [],
      scoreBias: {},
    }],
  } as unknown as HomeDayRecord;

  const entry = buildMomentTimeline(day).find((item) => item.id === 'prompt:mood-answer');
  assert.deepEqual(entry?.selectedState, { kind: 'mood', state: 'stormy' });
});

test('Moments use the selected sleep-quality artwork', () => {
  const day = {
    id: 'sleep-day',
    isoDate: '2026-08-15',
    moments: [],
    promptAnswers: [],
    sleep: { quality: 'low', source: 'manual', recordedAt: createdAt },
  } as unknown as HomeDayRecord;

  const entry = buildMomentTimeline(day).find((item) => item.id === 'sleep:2026-08-15');
  assert.deepEqual(entry?.selectedState, { kind: 'sleep', state: 'low' });
});
