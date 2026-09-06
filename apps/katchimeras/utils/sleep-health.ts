import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

import type { DaySleep, SleepQuality } from '@/types/home';

// On-device Apple Health sleep read for the Sleep Atmosphere. Best-effort: when
// HealthKit is unavailable, not installed, or access isn't granted, it returns
// null and the UI falls back to the one-tap "how was your sleep?" prompt. Reads
// only the night's total — never leaves the device, never a score.
type NativeSleepModule = {
  getSleepForDayAsync: (isoDate: string) => Promise<{ available?: boolean; totalSleepMinutes?: number }>;
  // Requests Health read access (readTypes now includes sleepAnalysis). HealthKit
  // authorization is PER-TYPE, so a prior routes-only grant does NOT cover sleep —
  // we must request again, which surfaces the sleep toggle the first time.
  requestHealthRoutePermissionAsync?: () => Promise<unknown>;
};

const nativeHealth = requireOptionalNativeModule<NativeSleepModule>('KatchimeraHealthRoutes');

// Gentle, non-judgmental thresholds (~7h good, ~5–7h normal, under 5h low).
function qualityFromMinutes(minutes: number): SleepQuality {
  if (minutes >= 7 * 60) return 'good';
  if (minutes >= 5 * 60) return 'normal';
  return 'low';
}

// Request Health authorization once per app session before the first sleep read.
// requestAuthorization is idempotent (no sheet once a type is determined), so this
// only ever prompts for the newly-added sleep type — never re-prompts for routes.
let sleepAuthRequested = false;
async function ensureSleepAuthorization(): Promise<void> {
  if (sleepAuthRequested || !nativeHealth?.requestHealthRoutePermissionAsync) return;
  sleepAuthRequested = true;
  try {
    await nativeHealth.requestHealthRoutePermissionAsync();
  } catch {
    // best-effort — the read below still attempts and falls back to null
  }
}

export async function loadSleepForDay(isoDate: string): Promise<DaySleep | null> {
  if (Platform.OS !== 'ios' || !nativeHealth?.getSleepForDayAsync) return null;
  try {
    await ensureSleepAuthorization();
    const result = await nativeHealth.getSleepForDayAsync(isoDate);
    const minutes = result?.totalSleepMinutes ?? 0;
    if (!result?.available || minutes <= 0) return null;
    return { quality: qualityFromMinutes(minutes), source: 'appleHealth', totalSleepMinutes: minutes };
  } catch {
    return null;
  }
}
