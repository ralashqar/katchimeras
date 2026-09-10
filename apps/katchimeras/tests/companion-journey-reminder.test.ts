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
    '@/utils/onboarding-state': { loadOnboardingProfile: () => ({ mossproutAnswers: { growthIntentId: 'desired-help:calm' } }) },
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
  const first = [...scheduled.values()][0].content as unknown as { title: string; body: string };
  assert.equal(first.title, 'Steppling is back');
  assert.match(first.body, /somewhere new to go/, 'the first return speaks in voice, not about chapter moments');
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

test('Mossprout’s first return names the planted Memory Seed; later returns do not', async () => {
  const now = Date.now();
  const rest = { familyId: 'mossprout', startedAt: now, availableAt: now + 8 * 60 * 60 * 1000, reason: 'journey_rest', sourceId: 'ftue:run:first-rest' };
  let state: Record<string, unknown> = { ...emptyRelationshipProgressState(), meditations: [rest] };
  const scheduled: { content: { title: string; body: string } }[] = [];
  const module = loadNativeModule('utils/mossprout-journey-notification.ts', {
    '@/utils/app-storage': { getStoredJson: (_key: string, fallback: unknown) => fallback, removeStoredValue: () => undefined, setStoredJson: () => undefined },
    '@/storage/repositories/relationship-progression-repository': { relationshipProgressionRepository: { load: () => state } },
    '@/utils/onboarding-state': { loadOnboardingProfile: () => ({ mossproutAnswers: { growthIntentId: 'desired-help:calm' } }) },
    'expo-notifications': {
      getPermissionsAsync: async () => ({ granted: true }),
      getAllScheduledNotificationsAsync: async () => [],
      cancelScheduledNotificationAsync: async () => undefined,
      scheduleNotificationAsync: async (value: { content: { title: string; body: string } }) => { scheduled.push(value); return `notification:${scheduled.length}`; },
      SchedulableTriggerInputTypes: { DATE: 'date' },
    },
  }, { process: { env: {} } });
  await module.syncCompanionJourneyReminders();
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].content.title, 'Mossprout is awake');
  assert.equal(scheduled[0].content.body, 'Your Seed of Stillness opened while you were away. Come and see.');
  state = { ...state, journeyDays: [{ familyId: 'mossprout', status: 'complete', beatId: 'quiet-patch:first-flower' }] };
  await module.syncCompanionJourneyReminders();
  assert.equal(scheduled.length, 2);
  assert.equal(scheduled[1].content.title, 'Mossprout is awake');
  assert.doesNotMatch(scheduled[1].content.body, /Seed of/);
});
