import * as Sentry from '@sentry/react-native';
import * as Updates from 'expo-updates';

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
    tracesSampleRate: 0.05,
  });
  Sentry.setTags({
    'expo.update.channel': Updates.channel ?? 'embedded',
    'expo.update.embedded': String(Updates.isEmbeddedLaunch),
    'expo.update.id': Updates.updateId ?? 'embedded',
  });
}

export type MergeFtueDiagnosticData = Record<string, boolean | number | string | null | undefined>;

export function addMergeFtueBreadcrumb(message: string, data: MergeFtueDiagnosticData = {}) {
  if (!process.env.EXPO_PUBLIC_SENTRY_DSN) return;
  Sentry.addBreadcrumb({ category: 'merge.ftue', data, level: 'info', message });
}

export function setMergeFtueDiagnosticContext(data: MergeFtueDiagnosticData | null) {
  if (!process.env.EXPO_PUBLIC_SENTRY_DSN) return;
  Sentry.setContext('merge_ftue', data);
  if (!data) return;
  if (data.sessionId != null) Sentry.setTag('merge.ftue.session_id', String(data.sessionId));
  if (data.stepId != null) Sentry.setTag('merge.ftue.step_id', String(data.stepId));
  if (data.phase != null) Sentry.setTag('merge.ftue.phase', String(data.phase));
  if (data.mountOrdinal != null) Sentry.setTag('merge.mount_ordinal', String(data.mountOrdinal));
}

export function triggerNativeCrashForDiagnostics() {
  if (!__DEV__ || !process.env.EXPO_PUBLIC_SENTRY_DSN) return;
  Sentry.nativeCrash();
}
