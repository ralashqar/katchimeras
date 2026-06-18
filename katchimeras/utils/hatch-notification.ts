import type { StoredHomeState } from '@/types/home';
import type { OnboardingProfile } from '@/utils/onboarding-state';
import { resolveHatchHour } from '@/utils/home-engine';

// The one notification that matters: "your day is ready to hatch" at the
// user's chosen hour. A single dated notification is scheduled for the next
// upcoming hatch and rescheduled on every state change, so an already-hatched
// day never fires (the reschedule after hatching targets tomorrow).

let notificationsModule: typeof import('expo-notifications') | null | undefined;

async function getNotifications() {
  if (notificationsModule !== undefined) {
    return notificationsModule;
  }

  if (process.env.EXPO_OS === 'web') {
    notificationsModule = null;
    return notificationsModule;
  }

  try {
    notificationsModule = await import('expo-notifications');
  } catch {
    notificationsModule = null;
  }
  return notificationsModule;
}

export async function getHatchNotificationPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
  const Notifications = await getNotifications();
  if (!Notifications) {
    return 'denied';
  }

  try {
    const settings = await Notifications.getPermissionsAsync();
    if (settings.granted) return 'granted';
    if (settings.canAskAgain) return 'undetermined';
    return 'denied';
  } catch {
    return 'denied';
  }
}

// Per the implementation plan, this is asked right after the first hatch -
// the moment the user has just felt what the notification is for.
export async function requestHatchNotificationPermission(): Promise<boolean> {
  const Notifications = await getNotifications();
  if (!Notifications) {
    return false;
  }

  try {
    const settings = await Notifications.requestPermissionsAsync();
    return settings.granted;
  } catch {
    return false;
  }
}

export async function syncHatchNotification(state: StoredHomeState, profile: OnboardingProfile) {
  const Notifications = await getNotifications();
  if (!Notifications) {
    return;
  }

  try {
    const settings = await Notifications.getPermissionsAsync();
    if (!settings.granted) {
      return;
    }

    const target = resolveNextHatchDate(state, profile);
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Your day is ready to hatch',
        body: "Tonight's katchimera is waiting to be revealed.",
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: target,
      },
    });
  } catch {
    // Notification scheduling is best-effort; the in-app ritual still works.
  }
}

function resolveNextHatchDate(state: StoredHomeState, profile: OnboardingProfile) {
  const hatchHour = resolveHatchHour(profile);
  const now = new Date();
  const todayTarget = new Date(now);
  todayTarget.setHours(hatchHour, 0, 0, 0);

  const todayAlreadyHatched = state.today.state === 'hatched';
  if (!todayAlreadyHatched && todayTarget.getTime() > now.getTime()) {
    return todayTarget;
  }

  const tomorrowTarget = new Date(todayTarget);
  tomorrowTarget.setDate(tomorrowTarget.getDate() + 1);
  return tomorrowTarget;
}
