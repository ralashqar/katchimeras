import { getStoredJson, removeStoredValue, setStoredJson } from '@/utils/app-storage';
import { nextMossproutJourneyReminderDate } from '@/utils/mossprout-journey-notification-plan';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';
import { currentJourneyCycle } from '@/game/katchimeras/companion-journey-cycle';

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
  exactTarget?: Date,
) {
  const rest = relationshipProgressionRepository.load().meditations?.find((item) => item.familyId === 'mossprout');
  const target = rest ? new Date(rest.availableAt) : exactTarget ?? nextMossproutJourneyReminderDate(completedDayId);
  return enqueueReminder('mossprout', completedDayId, target, now);
}

let pendingReminder: Promise<unknown> = Promise.resolve();
function enqueueReminder(familyId: 'steppling' | 'mossprout', id: string, target: Date | null, now = new Date()) {
  pendingReminder = pendingReminder.catch(() => undefined).then(() => scheduleReminder(familyId, id, target, now));
  return pendingReminder;
}

/** Called on relationship changes; the target is always the durable clock. */
export async function syncCompanionJourneyReminders() {
  const state = relationshipProgressionRepository.load();
  for (const familyId of ['steppling', 'mossprout'] as const) {
    const cycle = currentJourneyCycle(state, familyId);
    const rest = state.meditations?.find((item) => item.familyId === familyId);
    if (!cycle && !rest) continue;
    await enqueueReminder(familyId, cycle?.id ?? rest!.sourceId ?? familyId, cycle?.returnedAt != null || !rest ? null : new Date(rest.availableAt));
  }
}

async function scheduleReminder(familyId: 'steppling' | 'mossprout', completedDayId: string, target: Date | null, now: Date) {
  const storageKey = familyId === 'mossprout' ? STORAGE_KEY : 'katchimera.steppling.journey-reminder.v1';
  const kind = familyId === 'mossprout' ? NOTIFICATION_KIND : 'steppling_journey_day_ready';
  const Notifications = await getNotifications();
  if (!Notifications) return;
  const permission = await Notifications.getPermissionsAsync().catch(() => null);
  if (!permission?.granted) return;

  const existing = getStoredJson<ReminderRecord | null>(storageKey, null);
  if (target && target > now && existing?.completedDayId === completedDayId && existing.targetAt === target.getTime()) return;
  if (existing?.identifier) {
    await Notifications.cancelScheduledNotificationAsync(existing.identifier).catch(() => {});
    removeStoredValue(storageKey);
  }

  const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  await Promise.all(scheduled
    .filter((request) => request.content.data?.kind === kind)
    .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier).catch(() => {})));
  if (!target || target <= now) return;

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      body: `${familyId === 'steppling' ? 'Steppling' : 'Mossprout'} has a chapter moment to share with you.`,
      data: {
        creatureId: `companion:${familyId}`,
        destination: 'companion',
        kind,
      },
      sound: 'default',
      title: 'Your companion has returned',
    },
    trigger: { date: target, type: Notifications.SchedulableTriggerInputTypes.DATE },
  });
  setStoredJson<ReminderRecord>(storageKey, {
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
