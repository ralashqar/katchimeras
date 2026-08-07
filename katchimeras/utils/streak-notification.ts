import { getStoredRaw, removeStoredValue, setStoredRaw } from '@/utils/app-storage';
import type { StreakSnapshot } from '@/types/streak';

const NOTIFICATION_ID_KEY = 'katchimera.streak.notification-id.v1';
let notificationsModule: typeof import('expo-notifications') | null | undefined;

export async function syncStreakReminder(snapshot: StreakSnapshot, reminderHour = 20): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  const existingId = getStoredRaw(NOTIFICATION_ID_KEY);
  if (existingId) {
    await Notifications.cancelScheduledNotificationAsync(existingId).catch(() => {});
    removeStoredValue(NOTIFICATION_ID_KEY);
  }
  if (snapshot.todayState === 'captured' || snapshot.todayState === 'repaired') return;
  const permission = await Notifications.getPermissionsAsync().catch(() => null);
  if (!permission?.granted) return;
  const now = new Date();
  const target = new Date(now);
  target.setHours(reminderHour, 0, 0, 0);
  if (target <= now) return;
  const title = snapshot.currentStreak > 0
    ? `Keep your ${snapshot.currentStreak}-day story going`
    : 'Anything worth remembering today?';
  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      body: 'Capture one little thing from today.',
      data: { destination: 'today', kind: 'streak_reminder' },
      sound: 'default',
      title,
    },
    trigger: { date: target, type: Notifications.SchedulableTriggerInputTypes.DATE },
  });
  setStoredRaw(NOTIFICATION_ID_KEY, identifier);
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
