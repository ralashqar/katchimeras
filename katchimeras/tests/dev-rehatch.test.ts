import assert from 'node:assert/strict';
import test from 'node:test';

import { prepareTodayForDevRehatch } from '@/game/days/dev';
import { preserveVisibleHatchForMap } from '@/game/days/map-hatch-invariant';
import { preserveFinalizedHatches } from '@/game/days/state-integrity';
import type { HomeDayRecord, StoredHomeState } from '@/types/home';
import { buildHatchCheckInPlan, hatchCheckInEligibility } from '@/utils/hatch-check-in';

function state(): StoredHomeState {
  return {
    version: 12,
    archivedDays: [],
    encounterHistory: {},
    personalEntities: [],
    today: {
      id: 'today',
      isoDate: '2026-07-20',
      state: 'hatched',
      creature: { id: 'creature' },
      shareReadyAt: '2026-07-20T21:00:00.000Z',
      stepsCount: 8200,
      moments: [],
      locations: [],
      promptAnswers: [],
      journalRecords: [{ id: 'book', flowId: 'studio', categoryId: 'book', fields: { specific: 'A Brief History of Time' } }],
      hatchCheckIn: { status: 'completed' },
    },
  } as unknown as StoredHomeState;
}

test('adaptive replay unhatches while preserving the day evidence', () => {
  const next = prepareTodayForDevRehatch(state(), 'adaptive');
  assert.equal(next.today.state, 'ready_to_hatch');
  assert.equal(next.today.creature, null);
  assert.equal(next.today.hatchCheckIn, undefined);
  assert.equal(next.today.stepsCount, 8200);
  assert.equal(next.today.journalRecords?.[0]?.fields.specific, 'A Brief History of Time');
  assert.equal(next.today.devHatchReflectionMode, undefined);
  assert.equal(hatchCheckInEligibility(next.today), 'regular');
});

test('forced low-signal replay bypasses the clock and chooses the hierarchy', () => {
  const next = prepareTodayForDevRehatch(state(), 'force_low_signal');
  assert.equal(next.today.devHatchReflectionMode, 'force_low_signal');
  assert.equal(next.today.devForceReadyToHatch, true);
  assert.equal(hatchCheckInEligibility(next.today), 'empty');
  assert.deepEqual(buildHatchCheckInPlan(next.today, 'empty').questionPlan, [
    'reconstruct.focus',
    'reconstruct.category',
    'reflection.meaning',
  ]);
});

test('map refresh repairs a stale egg snapshot but respects an intentional dev unhatch', () => {
  const hatched = state();
  const visible = { ...hatched.today, kind: 'day' } as unknown as HomeDayRecord;
  const stale = {
    ...hatched,
    today: { ...hatched.today, state: 'ready_to_hatch' as const, creature: null },
  };
  const repaired = preserveVisibleHatchForMap(stale, visible);
  assert.equal(repaired.today.state, 'hatched');
  assert.equal(repaired.today.creature?.id, 'creature');

  const intentional = prepareTodayForDevRehatch(hatched, 'adaptive');
  const untouched = preserveVisibleHatchForMap(intentional, visible);
  assert.equal(untouched.today.creature, null);
  assert.equal(untouched.today.devForceReadyToHatch, true);
});

test('a delayed pre-hatch full-state writer cannot remove a finalized hatch', () => {
  const hatched = state();
  const staleWriter = {
    ...hatched,
    encounterHistory: {},
    today: {
      ...hatched.today,
      state: 'ready_to_hatch' as const,
      creature: null,
      shareReadyAt: null,
      locations: [{ id: 'late-map-photo' }],
    },
  } as unknown as StoredHomeState;

  const reconciled = preserveFinalizedHatches(hatched, staleWriter);
  assert.equal(reconciled.today.state, 'hatched');
  assert.equal(reconciled.today.creature?.id, 'creature');
  assert.equal(reconciled.today.shareReadyAt, '2026-07-20T21:00:00.000Z');
  assert.equal(reconciled.today.locations[0]?.id, 'late-map-photo');
});

test('hatch finality follows a day id across today, tomorrow, and archive slots', () => {
  const current = state();
  current.encounterHistory = {
    moth: { count: 2, lastSeenIsoDate: '2026-07-20' },
  };
  const stale = {
    ...current,
    encounterHistory: {
      moth: { count: 1, lastSeenIsoDate: '2026-07-19' },
    },
    today: { ...current.today, id: 'new-today', isoDate: '2026-07-21', state: 'forming' as const, creature: null },
    archivedDays: [{ ...current.today, state: 'ready_to_hatch' as const, creature: null }],
  } as StoredHomeState;

  const reconciled = preserveFinalizedHatches(current, stale);
  assert.equal(reconciled.today.creature, null);
  assert.equal(reconciled.archivedDays[0]?.state, 'hatched');
  assert.equal(reconciled.archivedDays[0]?.creature?.id, 'creature');
  assert.deepEqual(reconciled.encounterHistory.moth, {
    count: 2,
    lastSeenIsoDate: '2026-07-20',
  });
});
