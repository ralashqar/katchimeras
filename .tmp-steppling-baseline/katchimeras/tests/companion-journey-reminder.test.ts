import assert from 'node:assert/strict';
import test from 'node:test';
import { loadNativeModule } from './helpers/native-motion-harness';
import { emptyRelationshipProgressState } from '../game/katchimeras/relationship-progression';
import { createJourneyCycle, installJourneyCycle, completeMeditationRequest, finishJourneyReturn, JOURNEY_REST_MS } from '../game/katchimeras/companion-journey-cycle';

test('reminders follow acceleration, remain unique, and cancel after return', async () => {
  const now = Date.now();
  const cycle = createJourneyCycle({ id: 'journey-cycle:steppling:test', familyId: 'steppling', episodeId: 'test', number: 1, chapterId: 'steppling-chapter-1', title: 'A little way', nextTitle: 'A reason to go', completedAt: now, finale: false });
  let state = installJourneyCycle(emptyRelationshipProgressState(), cycle);
  const storage = new Map<string, unknown>();
  const scheduled = new Map<string, { content: { data: { kind: string } }; trigger: { date: Date } }>();
  let count = 0;
  let permitted = true;
  const module = loadNativeModule('utils/mossprout-journey-notification.ts', {
    '@/utils/app-storage': { getStoredJson: (key: string, fallback: unknown) => storage.get(key) ?? fallback, removeStoredValue: (key: string) => storage.delete(key), setStoredJson: (key: string, value: unknown) => storage.set(key, value) },
    '@/storage/repositories/relationship-progression-repository': { relationshipProgressionRepository: { load: () => state } },
    'expo-notifications': {
      getPermissionsAsync: async () => ({ granted: permitted }),
      getAllScheduledNotificationsAsync: async () => [...scheduled.entries()].map(([identifier, value]) => ({ identifier, ...value })),
      cancelScheduledNotificationAsync: async (id: string) => { scheduled.delete(id); },
      scheduleNotificationAsync: async (value: { content: { data: { kind: string } }; trigger: { date: Date } }) => { const id = `notification:${++count}`; scheduled.set(id, value); return id; },
      SchedulableTriggerInputTypes: { DATE: 'date' },
    },
  }, { process: { env: {} } });
  await module.syncCompanionJourneyReminders();
  await module.syncCompanionJourneyReminders();
  assert.equal(count, 1);
  assert.equal([...scheduled.values()][0].trigger.date.getTime(), now + JOURNEY_REST_MS);
  state = completeMeditationRequest(state, cycle.id, cycle.requests[0].id, 'served', now + 1);
  await module.syncCompanionJourneyReminders();
  assert.equal(scheduled.size, 1);
  assert.equal([...scheduled.values()][0].trigger.date.getTime(), now + JOURNEY_REST_MS - cycle.requests[0].reductionMs);
  state = finishJourneyReturn(state, cycle.id, now + JOURNEY_REST_MS);
  await module.syncCompanionJourneyReminders();
  assert.equal(scheduled.size, 0);
  permitted = false;
  state = installJourneyCycle(emptyRelationshipProgressState(), cycle);
  await module.syncCompanionJourneyReminders();
  assert.equal(scheduled.size, 0, 'no notification permission is requested or assumed');
});
