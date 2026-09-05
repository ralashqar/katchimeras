import test from 'node:test';
import assert from 'node:assert/strict';

import {
  INTENTIONALLY_NEUTRAL_JOURNAL_ROUTES,
  KATCHIMERA_JOURNAL_AFFINITIES,
} from '@/constants/katchimera-journal-affinities';
import { katchimeraFamilies } from '@/constants/katchimera-skins';
import type { JournalRecord, StoredHomeDayRecord } from '@/types/home';
import { deriveHatchDiagnostics } from '@/utils/hatch-diagnostics';
import { withStepsInterpretation } from '@/game/days/mutations/day-fields';
import { aggregateJournalHatchSignals, journalHatchContributions } from '@/utils/journal-hatch-contributions';
import { MANUAL_JOURNAL_FLOWS } from '@/utils/manual-journal-registry';
import { stepsNeedInterpreting } from '@/utils/today-categories';

function record(id: string, flowId: string, categoryId: string, context?: string, note = 'private prose'): JournalRecord {
  return {
    id,
    schemaVersion: 1,
    idempotencyKey: id,
    source: { kind: 'manual', sourceId: id },
    flowId,
    flowVersion: 1,
    categoryId,
    canonicalQualityIds: [],
    fields: { specific: 'private name', context: context ?? null },
    feeling: null,
    note,
    attachments: [],
    confirmedFacets: [],
    createdAt: '2026-08-04T12:00:00.000Z',
  };
}

function day(records: JournalRecord[], keyJournalRecordId: string | null = null): StoredHomeDayRecord {
  return {
    id: 'day-2026-08-04', isoDate: '2026-08-04', state: 'forming', stepsCount: 0,
    visitedPlaceCount: 0, newPlaceCount: 0, locationSampleCount: 0, shareReadyAt: null,
    moments: [], locations: [], healthRouteImport: null, exactRouteSegments: [], selectedPathId: null,
    creature: null, card: null, promptAnswers: [], heroPhoto: null, journalRecords: records,
    keyJournalRecordId,
  };
}

test('every canonical family and journal leaf has an explicit ownership decision', () => {
  const ownedFamilies = new Set(KATCHIMERA_JOURNAL_AFFINITIES.map((entry) => entry.familyId));
  assert.deepEqual(
    katchimeraFamilies.map((family) => family.id).filter((familyId) => !ownedFamilies.has(familyId)),
    []
  );
  const ownedRoutes = new Set(KATCHIMERA_JOURNAL_AFFINITIES.map((entry) => `${entry.flowId}.${entry.categoryId}`));
  const unresolved = MANUAL_JOURNAL_FLOWS.flatMap((flow) => flow.choices.map((choice) => `${flow.id}.${choice.id}`))
    .filter((route) => !ownedRoutes.has(route) && !INTENTIONALLY_NEUTRAL_JOURNAL_ROUTES.has(route));
  assert.deepEqual(unresolved, []);
});

test('specific contexts make swimming, care, and contribution the strongest reads', () => {
  const scenarios = [
    [record('swim', 'movement', 'sport', 'swimming'), 'shellio'],
    [record('care', 'people', 'family', 'care'), 'snuglet'],
    [record('volunteer', 'people', 'group', 'volunteering'), 'kindling'],
  ] as const;
  for (const [journalRecord, expectedFamily] of scenarios) {
    const signals = aggregateJournalHatchSignals(day([journalRecord])).sort((left, right) => right.intensity - left.intensity);
    assert.equal(signals[0]?.familyId, expectedFamily);
    assert.equal(signals[0]?.intensity, 0.95);
  }
});

test('repeat entries reinforce with diminishing returns and cap at 1.15', () => {
  const one = aggregateJournalHatchSignals(day([record('a', 'movement', 'walk')])).find((row) => row.familyId === 'steppling');
  const two = aggregateJournalHatchSignals(day([record('a', 'movement', 'walk'), record('b', 'movement', 'walk')])).find((row) => row.familyId === 'steppling');
  const many = aggregateJournalHatchSignals(day([
    record('a', 'movement', 'walk'), record('b', 'movement', 'walk'), record('c', 'movement', 'walk'), record('d', 'movement', 'walk'),
  ])).find((row) => row.familyId === 'steppling');
  assert.equal(one?.intensity, 0.78);
  assert.equal(two?.intensity, 0.92);
  assert.equal(many?.intensity, 0.983);
});

test('one key moment adds influence without exposing journal contents', () => {
  const journalRecord = record('swim', 'movement', 'sport', 'swimming', 'I swam with a private person');
  const normal = aggregateJournalHatchSignals(day([journalRecord])).find((row) => row.familyId === 'shellio');
  const keyedDay = day([journalRecord], journalRecord.id);
  const keyed = aggregateJournalHatchSignals(keyedDay).find((row) => row.familyId === 'shellio');
  assert.equal(normal?.intensity, 0.95);
  assert.equal(keyed?.intensity, 1);
  const serialized = JSON.stringify(journalHatchContributions(keyedDay));
  assert.equal(serialized.includes('private person'), false);
  assert.equal(serialized.includes('private name'), false);
});

test('the steps clarification saves one replaceable canonical movement journal record', () => {
  const now = new Date('2026-08-04T18:00:00.000Z');
  const walking = withStepsInterpretation(day([]), {
    movement: 'walk', label: 'A long walk', emoji: '🚶', subtype: 'exploring',
  }, now);
  assert.equal(walking.journalRecords?.length, 1);
  assert.equal(walking.journalRecords?.[0]?.flowId, 'movement');
  assert.equal(walking.journalRecords?.[0]?.categoryId, 'walk');
  assert.equal(walking.journalRecords?.[0]?.source.origin?.kind, 'steps_interpretation');
  assert.equal(walking.stepsInterpretation?.movement, 'walk');

  const corrected = withStepsInterpretation(walking, {
    movement: 'hike', label: 'A hike', emoji: '🥾', subtype: null,
  }, new Date('2026-08-04T18:05:00.000Z'));
  assert.equal(corrected.journalRecords?.length, 1);
  assert.equal(corrected.journalRecords?.[0]?.categoryId, 'hike');
  assert.equal(corrected.stepsInterpretation?.movement, 'hike');
});

test('a detected Health walking route requests clarification even below the step threshold', () => {
  const routed = day([]);
  routed.stepsCount = 4_000;
  routed.exactRouteSegments = [{
    id: 'route', workoutId: 'workout', activityType: 'walking',
    startedAt: '2026-08-04T10:00:00.000Z', endedAt: '2026-08-04T11:00:00.000Z', coordinates: [],
  }];
  assert.equal(stepsNeedInterpreting(routed, null), true);
});

test('diagnostics are derived from immutable decision snapshots', () => {
  const hatched = day([]);
  hatched.state = 'hatched';
  hatched.creature = {
    id: 'c', name: 'Shellio', primaryTrait: 'calm', secondaryTrait: 'exploration', rarity: 'common',
    visualKey: 'shellio', accentColor: '#fff', highlightMomentId: null, highlight: '', reflection: '', motifTags: [],
    encounterProfileId: 'location_beach_shellio', repeatDepth: 0, familyId: 'shellio', skinId: 'shellio',
    hatchDecision: {
      version: 1, engineVersion: 'journal-field-v1', leaderFamilyId: 'shellio', winnerFamilyId: 'shellio',
      candidates: [{
        profileId: 'location_beach_shellio', familyId: 'shellio', skinId: 'shellio', seedId: 'beach', score: 1.15,
        probability: 1, selected: true,
        modifiers: { novelty: 0.22, intent: 0.15, bond: 0, seasonal: 0, rarity: 0, recency: 0, previousDay: 0 },
        contributions: [{ journalRecordId: 'swim', routeKey: 'journal.route:movement.sport.swimming', sourceKind: 'manual', weight: 1, keyMoment: true, explanation: 'your swim' }],
      }],
    },
  };
  const result = deriveHatchDiagnostics([hatched]);
  assert.equal(result.measuredHatches, 1);
  assert.equal(result.journalLedHatches, 1);
  assert.equal(result.keyMomentAlignedHatches, 1);
  assert.equal(result.contributingRoutes['journal.route:movement.sport.swimming'], 1);
});
