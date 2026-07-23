import assert from 'node:assert/strict';
import test from 'node:test';

import type { HomeDayRecord, StoredHomeDayRecord } from '../types/home';
import {
  IDLE_TODAY_HATCH_PRESENTATION,
  todayHatchPresentationReducer,
  todayHatchShowsResident,
  todayHatchShowsTomorrow,
} from '../utils/today-hatch-presentation';

const egg = {
  accentColor: '#F0C66D',
  coreColor: '#FFF1B5',
  haloColor: '#E8B95C',
  intensity: 0.8,
  label: 'A forming egg',
  shimmer: true,
  swirl: 0.4,
} as HomeDayRecord['egg'];

const day = {
  id: 'day-2026-07-22',
  isoDate: '2026-07-22',
  isToday: true,
  kind: 'day',
  egg,
} as HomeDayRecord;

const committedDay = {
  id: day.id,
  isoDate: day.isoDate,
  state: 'hatched',
  creature: { id: 'creature-1' },
} as StoredHomeDayRecord;

test('hatch presentation advances monotonically and reveals Tomorrow last', () => {
  let state = todayHatchPresentationReducer(IDLE_TODAY_HATCH_PRESENTATION, { type: 'begin', day });
  assert.equal(state.phase, 'preparing');
  assert.equal(state.egg, egg);

  state = todayHatchPresentationReducer(state, { type: 'committed', day: committedDay });
  assert.equal(state.phase, 'cracking');
  assert.equal(todayHatchShowsResident(state.phase), false);

  state = todayHatchPresentationReducer(state, { type: 'advance', phase: 'revealing' });
  state = todayHatchPresentationReducer(state, { type: 'advance', phase: 'world_shift' });
  state = todayHatchPresentationReducer(state, { type: 'advance', phase: 'settling' });
  assert.equal(todayHatchShowsResident(state.phase), true);
  assert.equal(todayHatchShowsTomorrow(state.phase), false);

  state = todayHatchPresentationReducer(state, { type: 'advance', phase: 'tomorrow_arrival' });
  assert.equal(todayHatchShowsTomorrow(state.phase), true);
});

test('late or out-of-order actions cannot rewind or replace the active hatch', () => {
  let state = todayHatchPresentationReducer(IDLE_TODAY_HATCH_PRESENTATION, { type: 'begin', day });
  state = todayHatchPresentationReducer(state, { type: 'committed', day: committedDay });
  state = todayHatchPresentationReducer(state, { type: 'advance', phase: 'world_shift' });
  const rewound = todayHatchPresentationReducer(state, { type: 'advance', phase: 'revealing' });
  assert.equal(rewound.phase, 'world_shift');

  const otherDay = { ...committedDay, id: 'different-day' };
  const replaced = todayHatchPresentationReducer(state, { type: 'committed', day: otherDay });
  assert.equal(replaced.committedDay?.id, committedDay.id);
});

test('failure and completion restore an idle, retryable presentation', () => {
  const preparing = todayHatchPresentationReducer(IDLE_TODAY_HATCH_PRESENTATION, { type: 'begin', day });
  const failed = todayHatchPresentationReducer(preparing, { type: 'failed', reason: 'Try again' });
  assert.equal(failed.phase, 'idle');
  assert.equal(failed.error, 'Try again');
  assert.equal(failed.dayId, null);

  const retried = todayHatchPresentationReducer(failed, { type: 'begin', day });
  assert.equal(retried.phase, 'preparing');
  assert.equal(retried.error, null);
  assert.deepEqual(
    todayHatchPresentationReducer(retried, { type: 'reset' }),
    IDLE_TODAY_HATCH_PRESENTATION,
  );
});
