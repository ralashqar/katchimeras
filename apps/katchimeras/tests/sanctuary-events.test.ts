import assert from 'node:assert/strict';
import test from 'node:test';
import { SANCTUARY_EVENTS, sanctuaryEventOpen, timeTrialOpen, WISP_RUSH_EVENT } from '@/constants/sanctuary-events';
import { WISP_RUSH_HOST } from '@/features/time-trial/heat-mechanic';
import { createInitialMergeWorldState } from '@/utils/merge-world/engine';
import { heatFor, HEATS_PER_DAY } from '@/features/time-trial/ladder';

test('the daily time trial stays: the Sanctuary’s first event, open after the Kitchen, or on Dashkit’s track', () => {
  assert.ok(SANCTUARY_EVENTS.includes(WISP_RUSH_EVENT));
  const fresh = createInitialMergeWorldState(0);
  assert.equal(timeTrialOpen(fresh, WISP_RUSH_HOST.islandId, WISP_RUSH_HOST.unlockLevel), false, 'not before the story reaches it');
  const afterKitchen = { ...fresh, chaptersClaimed: ['home-for-two', 'explorers-lodge', 'the-signal', 'the-kitchen'] };
  assert.equal(sanctuaryEventOpen(afterKitchen, WISP_RUSH_EVENT), true);
  assert.equal(timeTrialOpen(afterKitchen, WISP_RUSH_HOST.islandId, WISP_RUSH_HOST.unlockLevel), true);
  const dashkit = { ...fresh, haven: { ...fresh.haven, mossproutNatureIslands: { ...fresh.haven.mossproutNatureIslands, [WISP_RUSH_HOST.islandId]: 1 } } } as typeof fresh;
  assert.equal(timeTrialOpen(dashkit, WISP_RUSH_HOST.islandId, WISP_RUSH_HOST.unlockLevel), true, 'Dashkit home opens it too');
  for (let index = 0; index < HEATS_PER_DAY; index += 1) assert.ok(heatFor('2026-09-27', index), `heat ${index + 1} exists`);
  for (const line of WISP_RUSH_EVENT.intro) assert.ok(!line.text.includes('!'), 'the Mist’s voice');
});
