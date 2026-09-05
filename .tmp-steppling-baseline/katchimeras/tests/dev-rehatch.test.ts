import assert from 'node:assert/strict';
import test from 'node:test';

import { prepareLatestDailyHatchForDevReplay } from '@/game/days/dev';
import { preserveVisibleHatchForMap } from '@/game/days/map-hatch-invariant';
import {
  preserveActiveTodayFromEmptyDowngrade,
  preserveFinalizedHatches,
} from '@/game/days/state-integrity';
import type { HomeDayRecord, StoredHomeState } from '@/types/home';
import { todayGrowthSummary } from '@/utils/today-growth';

function state(): StoredHomeState {
  return {
    version: 14,
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

test('daily replay re-seals the latest collectible day for the full cinematic', () => {
  const source = state();
  source.archivedDays = [{
    ...source.today,
    id: 'yesterday',
    isoDate: '2026-07-19',
    state: 'hatched',
    card: { id: 'card-yesterday', isoDate: '2026-07-19' } as never,
    dailyHatch: {
      schemaVersion: 1,
      primaryWispId: 'sunbeam',
      sceneVariantId: 'home',
      primaryTheme: 'reflection',
      secondaryTheme: null,
      traits: [],
      evidence: [],
      sealedInputSignature: 'signature',
      sealedAt: '2026-07-19T21:00:00.000Z',
      revealedAt: '2026-07-20T09:00:00.000Z',
      claimedAt: '2026-07-20T09:01:00.000Z',
      provenance: 'rollover',
    },
  } as never];
  source.today.card = { id: 'card-today', isoDate: '2026-07-20' } as never;
  source.today.dailyHatch = {
    ...source.archivedDays[0].dailyHatch!,
    sealedInputSignature: 'today-signature',
    sealedAt: '2026-07-20T21:00:00.000Z',
  };

  const replay = prepareLatestDailyHatchForDevReplay(source);
  assert.equal(replay?.dayId, 'yesterday');
  assert.equal(replay?.stepEnergyDayId, '2026-07-19');
  assert.equal(replay?.state.archivedDays[0]?.state, 'sealed');
  assert.equal(replay?.state.archivedDays[0]?.dailyHatch?.revealedAt, null);
  assert.equal(replay?.state.archivedDays[0]?.dailyHatch?.claimedAt, null);
  assert.equal(replay?.state.archivedDays[0]?.card?.id, 'card-yesterday');
  assert.equal(replay?.state.archivedDays[0]?.devForceReadyToHatch, undefined);
});

test('map refresh repairs a stale egg snapshot', () => {
  const hatched = state();
  const visible = { ...hatched.today, kind: 'day' } as unknown as HomeDayRecord;
  const stale = {
    ...hatched,
    today: { ...hatched.today, state: 'ready_to_hatch' as const, creature: null },
  };
  const repaired = preserveVisibleHatchForMap(stale, visible);
  assert.equal(repaired.today.state, 'hatched');
  assert.equal(repaired.today.creature?.id, 'creature');
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

test('a stale camera-route writer cannot replace Today progress with an empty day', () => {
  const current = state();
  current.today.state = 'forming';
  current.today.creature = null;
  current.today.card = null;
  current.today.growth = {
    schemaVersion: 1,
    events: [{
      id: 'mood-reward',
      source: 'mood',
      sourceId: 'mood-answer',
      amount: 20,
      awardedAt: '2026-07-20T09:00:00.000Z',
    }],
    careActions: [],
  };
  current.today.promptAnswers = [{ id: 'mood-answer' }] as never;
  const stale = {
    ...current,
    today: {
      ...current.today,
      growth: { schemaVersion: 1 as const, events: [], careActions: [] },
      journalRecords: [],
      promptAnswers: [],
    },
  };

  const reconciled = preserveActiveTodayFromEmptyDowngrade(current, stale);
  assert.equal(reconciled.today.growth?.events[0]?.id, 'mood-reward');
  assert.equal(reconciled.today.promptAnswers[0]?.id, 'mood-answer');
});

test('a stale writer cannot restore the completed Egg cycle after a hatch claim', () => {
  const current = state();
  current.today.state = 'forming';
  current.today.creature = null;
  current.today.card = null;
  current.today.growth = {
    schemaVersion: 1,
    cycleStartedAt: '2026-07-20T09:30:00.000Z',
    events: [{
      id: 'growth:journal:before-claim',
      source: 'journal',
      sourceId: 'before-claim',
      amount: 100,
      awardedAt: '2026-07-20T08:00:00.000Z',
    }],
    careActions: [],
  };
  const stale = {
    ...current,
    today: {
      ...current.today,
      growth: {
        schemaVersion: 1 as const,
        events: current.today.growth.events,
        careActions: [{
          instanceId: 'care:stale',
          definitionId: 'journal',
          status: 'completed' as const,
          completedAt: '2026-07-20T08:00:00.000Z',
          updatedAt: '2026-07-20T08:00:00.000Z',
        }],
      },
    },
  };

  const reconciled = preserveActiveTodayFromEmptyDowngrade(current, stale);
  assert.equal(reconciled.today.growth?.cycleStartedAt, '2026-07-20T09:30:00.000Z');
  assert.equal(reconciled.today.growth?.careActions.length, 0);
  assert.equal(todayGrowthSummary(reconciled.today, 0).contextState, 'fresh');
});
