import { getStoredJson, removeStoredValue, setStoredJson } from '@/utils/app-storage';
import { nextMossproutJourneyReminderDate } from '@/utils/mossprout-journey-notification-plan';

const STORAGE_KEY = 'katchimera.mossprout.journey-reminder.v1';
const NOTIFICATION_KIND = 'mossprout_journey_day_ready';
let notificationsModule: typeof import('expo-notifications') | null | undefined;

type ReminderRecord = {
  completedDayId: string;
  identifier: string;
  targetAt: number;
  version: 1;
};

export async function scheduleMossproutJourneyDayReminder(
  completedDayId: string,
  now = new Date(),
) {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  const permission = await Notifications.getPermissionsAsync().catch(() => null);
  if (!permission?.granted) return;

  const target = nextMossproutJourneyReminderDate(completedDayId);
  if (!target || target <= now) return;

  const existing = getStoredJson<ReminderRecord | null>(STORAGE_KEY, null);
  if (existing?.completedDayId === completedDayId && existing.targetAt === target.getTime()) return;
  if (existing?.identifier) {
    await Notifications.cancelScheduledNotificationAsync(existing.identifier).catch(() => {});
    removeStoredValue(STORAGE_KEY);
  }

  const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  await Promise.all(scheduled
    .filter((request) => request.content.data?.kind === NOTIFICATION_KIND)
    .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier).catch(() => {})));

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      body: 'Mossprout noticed something near the pond.',
      data: {
        creatureId: 'companion:mossprout',
        destination: 'companion',
        kind: NOTIFICATION_KIND,
      },
      sound: 'default',
      title: 'A new Journey Day is ready',
    },
    trigger: { date: target, type: Notifications.SchedulableTriggerInputTypes.DATE },
  });
  setStoredJson<ReminderRecord>(STORAGE_KEY, {
    completedDayId,
    identifier,
    targetAt: target.getTime(),
    version: 1,
  });
}

async function getNotifications() {
  if (notificationsModule !== undefined) return notificationsModule;
  if (process.env.EXPO_OS === 'web') {
    notificationsModule = null;
    return null;
  }
  try {
    notificationsModule = await import('expo-notifications');
  } catch {
    notificationsModule = null;
  }
  return notificationsModule;
}
