import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveHomeLoopPresentation } from '../features/today/home-loop-presentation';
import type { HomeDayRecord, HomeTomorrowRecord } from '../types/home';

const today = {
  id: 'day-2026-08-05',
  isoDate: '2026-08-05',
  isToday: true,
  kind: 'day',
  state: 'forming',
} as HomeDayRecord;
const tomorrowDay = {
  ...today,
  id: 'day-2026-08-06',
  isoDate: '2026-08-06',
  isToday: false,
} as HomeDayRecord;
const tomorrow = {
  id: 'tomorrow',
  isoDate: '2026-08-06',
  kind: 'tomorrow',
} as HomeTomorrowRecord;

function resolve(overrides: Partial<Parameters<typeof resolveHomeLoopPresentation>[0]> = {}) {
  return resolveHomeLoopPresentation({
    activeDayPrompt: null,
    availableDayPrompts: [],
    isHatching: false,
    isTodayHatched: false,
    selectedDay: today,
    tomorrowActivePrompt: null,
    tomorrowAvailablePrompts: [],
    tomorrowDay,
    ...overrides,
  });
}

test('Today and unlocked Tomorrow resolve to one target-aware forming contract', () => {
  const current = resolve();
  assert.equal(current.mode, 'forming-today');
  assert.equal(current.forming?.day.id, today.id);
  assert.equal(current.forming?.target, 'today');

  const next = resolve({ selectedDay: tomorrow, isTodayHatched: true });
  assert.equal(next.mode, 'forming-tomorrow');
  assert.equal(next.forming?.day.id, tomorrowDay.id);
  assert.equal(next.forming?.target, 'tomorrow');
  assert.equal(next.forming?.isTomorrow, true);
});

test('Tomorrow stays locked before hatch and hatch presentation owns the surface', () => {
  assert.deepEqual(resolve({ selectedDay: tomorrow }), {
    forming: null,
    mode: 'locked-tomorrow',
  });
  assert.deepEqual(resolve({ isHatching: true }), {
    forming: null,
    mode: 'hatching',
  });
});

