import * as Sentry from '@sentry/react-native';
import * as Updates from 'expo-updates';

import { DEV_TOOLS_ENABLED } from '@/constants/dev';

let initialized = false;

export function initializeCrashReporting() {
  if (initialized) return;
  initialized = true;
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn) return;
  Sentry.init({
    dsn,
    enableNative: true,
    enableNativeCrashHandling: true,
    enableWatchdogTerminationTracking: true,
    sendDefaultPii: false,
  });
  Sentry.setTags({
    'expo.update.channel': Updates.channel ?? 'embedded',
    'expo.update.embedded': String(Updates.isEmbeddedLaunch),
    'expo.update.id': Updates.updateId ?? 'embedded',
  });
}

export function triggerNativeCrashForDiagnostics() {
  if (!DEV_TOOLS_ENABLED || !process.env.EXPO_PUBLIC_SENTRY_DSN) return;
  Sentry.nativeCrash();
}
