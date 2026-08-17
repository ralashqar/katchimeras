import type { StoredHomeState } from '@/types/home';
import type { OnboardingProfile } from '@/utils/onboarding-state';
import { resolveHatchNotificationPlan } from '@/utils/hatch-notification-plan';
import {
  getStoredJson,
  getStoredRaw,
  removeStoredValue,
  setStoredJson,
} from '@/utils/app-storage';

// Hatch notification requests are tagged in native storage and serialized here.
// The old implementation only remembered the most recently-created identifier.
// Overlapping syncs could consequently create several requests while retaining
// the identifier of just one of them, leaving the others impossible to cancel.

let notificationsModule: typeof import('expo-notifications') | null | undefined;
let hatchSyncQueue: Promise<void> = Promise.resolve();

const LEGACY_HATCH_NOTIFICATION_ID_KEY = 'katchimera.hatch.notification-id.v1';
const HATCH_NOTIFICATION_RECORD_KEY = 'katchimera.hatch.notification.v2';
const HATCH_NOTIFICATION_KIND = 'hatch_ready';
const HATCH_NOTIFICATION_TITLE = 'Your day is ready to hatch';

type HatchNotificationRecord = {
  version: 2;
  dayId: string;
  targetAt: number;
  identifier: string | null;
};

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

// This is asked right after the first hatch: the moment the user has just felt
// what the notification is for.
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

/**
 * Synchronize one hatch alert at a time. Keeping the queue alive after a native
 * error is important: notification delivery is best-effort, but a failed call
 * must not disable all later days.
 */
export function syncHatchNotification(
  state: StoredHomeState,
  profile: OnboardingProfile,
): Promise<void> {
  const task = hatchSyncQueue.then(() => syncHatchNotificationNow(state, profile));
  hatchSyncQueue = task.catch(() => {});
  return task;
}

async function syncHatchNotificationNow(
  state: StoredHomeState,
  profile: OnboardingProfile,
): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;

  try {
    const settings = await Notifications.getPermissionsAsync();
    if (!settings.granted) return;

    const now = new Date();
    const plan = resolveHatchNotificationPlan(state, profile, now);
    const record = getStoredJson<HatchNotificationRecord | null>(
      HATCH_NOTIFICATION_RECORD_KEY,
      null,
    );
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const hatchRequests = scheduled.filter(
      (request) => request.content.data?.kind === HATCH_NOTIFICATION_KIND
        // v1 requests had no metadata. Match their unique title so upgrading
        // also removes the already-orphaned alerts that caused the flood.
        || request.content.title === HATCH_NOTIFICATION_TITLE,
    );

    // Clean up requests created by v1 as well as any orphaned requests left by
    // its overlapping cancel/schedule race.
    const legacyIdentifier = getStoredRaw(LEGACY_HATCH_NOTIFICATION_ID_KEY);
    if (legacyIdentifier) {
      await Notifications.cancelScheduledNotificationAsync(legacyIdentifier).catch(() => {});
      removeStoredValue(LEGACY_HATCH_NOTIFICATION_ID_KEY);
    }

    const targetAt = plan.targetAt.getTime();
    const matchingIdentifier = record?.dayId === plan.dayId && record.targetAt === targetAt
      ? record.identifier
      : null;
    const matchingRequestExists = matchingIdentifier !== null && hatchRequests.some(
      (request) => request.identifier === matchingIdentifier,
    );

    if (!plan.isReady && matchingRequestExists) {
      // The desired request already exists. Remove only accidental duplicates.
      await cancelHatchRequests(
        Notifications,
        hatchRequests.filter((request) => request.identifier !== matchingIdentifier),
      );
      return;
    }

    // Also cancel the persisted identifier directly. This covers a native
    // implementation returning a temporarily stale scheduled-request list.
    if (record?.identifier && !hatchRequests.some(
      (request) => request.identifier === record.identifier,
    )) {
      await Notifications.cancelScheduledNotificationAsync(record.identifier).catch(() => {});
    }
    await cancelHatchRequests(Notifications, hatchRequests);

    if (plan.isReady) {
      // Once today's target has passed, the foreground UI owns the reveal. Do
      // not create immediate replacements every time Energy or lifecycle state
      // refreshes. Persisting the marker makes that decision explicit.
      setStoredJson<HatchNotificationRecord>(HATCH_NOTIFICATION_RECORD_KEY, {
        version: 2,
        dayId: plan.dayId,
        targetAt,
        identifier: null,
      });
      return;
    }

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: HATCH_NOTIFICATION_TITLE,
        body: "Today's Wisp is waiting to be revealed.",
        data: {
          destination: 'today',
          kind: HATCH_NOTIFICATION_KIND,
          dayId: plan.dayId,
          targetAt,
        },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: plan.targetAt,
      },
    });

    setStoredJson<HatchNotificationRecord>(HATCH_NOTIFICATION_RECORD_KEY, {
      version: 2,
      dayId: plan.dayId,
      targetAt,
      identifier,
    });
  } catch {
    // Notification scheduling is best-effort; the in-app ritual still works.
  }
}

async function cancelHatchRequests(
  Notifications: typeof import('expo-notifications'),
  requests: Awaited<ReturnType<typeof Notifications.getAllScheduledNotificationsAsync>>,
) {
  await Promise.all(requests.map((request) =>
    Notifications.cancelScheduledNotificationAsync(request.identifier).catch(() => {}),
  ));
}
