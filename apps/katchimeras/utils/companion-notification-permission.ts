// The companion return reminder is the only Day-1 push the Haven flow has.
// Its scheduler never prompts (see mossprout-journey-notification.ts); the
// authored "may I wake you" beat asks here, in Mossprout's voice, right before
// the first rest begins. Web and unavailable runtimes report 'unsupported'.
export type CompanionNotificationAccess = 'should_request' | 'granted' | 'denied' | 'unsupported';

let notificationsModule: typeof import('expo-notifications') | null | undefined;

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

export async function getCompanionNotificationAccess(): Promise<CompanionNotificationAccess> {
  const Notifications = await getNotifications();
  if (!Notifications) return 'unsupported';
  try {
    const settings = await Notifications.getPermissionsAsync();
    if (settings.granted) return 'granted';
    // iOS reports 'undetermined' before the system prompt; Android reports
    // 'denied' with canAskAgain until the user permanently refuses.
    if (settings.status === 'undetermined' || settings.canAskAgain !== false) return 'should_request';
    return 'denied';
  } catch {
    return 'unsupported';
  }
}

export async function requestCompanionNotificationAccess(): Promise<boolean> {
  const Notifications = await getNotifications();
  if (!Notifications) return false;
  try {
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}
