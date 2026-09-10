import assert from 'node:assert/strict';
import test from 'node:test';
import { loadNativeModule } from './helpers/native-motion-harness';

test('the streak reminder stays off while Today is unreachable, and clears anything scheduled earlier', async () => {
  const storage = new Map<string, string>([['katchimera.streak.notification-id.v1', 'stale']]);
  const cancelled: string[] = [];
  let scheduled = 0;
  const module = loadNativeModule('utils/streak-notification.ts', {
    '@/utils/app-storage': { getStoredRaw: (key: string) => storage.get(key) ?? null, removeStoredValue: (key: string) => storage.delete(key), setStoredRaw: (key: string, value: string) => storage.set(key, value) },
    'expo-notifications': {
      cancelScheduledNotificationAsync: async (id: string) => { cancelled.push(id); },
      getPermissionsAsync: async () => ({ granted: true }),
      scheduleNotificationAsync: async () => { scheduled++; return 'new'; },
      SchedulableTriggerInputTypes: { DATE: 'date' },
    },
  }, { process: { env: {} } });
  assert.equal(module.STREAK_REMINDER_ENABLED, false);
  await module.syncStreakReminder({ todayState: 'pending', currentStreak: 3 });
  assert.deepEqual(cancelled, ['stale']);
  assert.equal(storage.has('katchimera.streak.notification-id.v1'), false);
  assert.equal(scheduled, 0, 'nothing may deep-link to the retired Today route');
});
