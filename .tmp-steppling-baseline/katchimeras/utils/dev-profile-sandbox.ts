import { DEV_TOOLS_ENABLED } from '@/constants/dev';
import type { DevProfileSession, PlayerProfileSnapshot } from '@/types/player-profile-snapshot';
import { getStoredJson, removeStoredValue, setStoredJson } from '@/utils/app-storage';

export const DEV_PROFILE_SESSION_KEY = 'katchadeck.dev.profile-snapshot-session-v1';

export function setDevProfileSession(session: DevProfileSession): void {
  if (!DEV_TOOLS_ENABLED) return;
  setStoredJson(DEV_PROFILE_SESSION_KEY, session);
}

export function clearDevProfileSession(): void {
  removeStoredValue(DEV_PROFILE_SESSION_KEY);
}

export function getDevProfileSession(): DevProfileSession | null {
  if (!DEV_TOOLS_ENABLED) return null;
  const session = getStoredJson<DevProfileSession | null>(DEV_PROFILE_SESSION_KEY, null);
  return session?.schemaVersion === 1 && session.sandboxed ? session : null;
}

export function isDevProfileSandboxActive(): boolean {
  return getDevProfileSession() != null;
}

export function consumeDevProfileLaunchRoute(): PlayerProfileSnapshot['launchRoute'] | null {
  const session = getDevProfileSession();
  if (!session?.pendingLaunchRoute) return null;
  setDevProfileSession({ ...session, pendingLaunchRoute: null });
  return session.pendingLaunchRoute;
}
