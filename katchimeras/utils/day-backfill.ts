import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

import type { StoredHomeLocationPoint } from '@/types/home';
import { resolvePhotoLatitude, resolvePhotoLongitude } from '@/utils/photo-location';

export type BackfilledDay = {
  isoDate: string;
  stepsCount: number;
  locations: StoredHomeLocationPoint[];
};

const MAX_PHOTO_SCAN_PER_DAY = 48;
const MAX_GEOTAGGED_PER_DAY = 10;
// CMPedometer history reaches 7 days back; stay safely inside it.
const MAX_BACKFILL_DAYS = 5;

// Reconstructs recent past days from what iOS can actually tell us in
// retrospect: pedometer history (steps, up to 7 days back) and photo EXIF
// geotags (places). General location history does not exist as an API -
// photos are the only retrospective place source.
export async function collectBackfillDays(
  now: Date,
  dayCount: number,
  options: { requestPhotoPermission?: boolean } = {}
): Promise<BackfilledDay[]> {
  if (Platform.OS === 'web') {
    return [];
  }

  const days = Math.min(dayCount, MAX_BACKFILL_DAYS);
  const photoAccess = await resolvePhotoAccess(options.requestPhotoPermission === true);
  const results: BackfilledDay[] = [];

  for (let offset = days; offset >= 1; offset -= 1) {
    const dayStart = new Date(now);
    dayStart.setDate(dayStart.getDate() - offset);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const [stepsCount, locations] = await Promise.all([
      readStepsBetween(dayStart, dayEnd),
      photoAccess ? readPhotoLocationsBetween(dayStart, dayEnd) : Promise.resolve([]),
    ]);

    if (stepsCount > 0 || locations.length > 0) {
      results.push({ isoDate: toLocalDateId(dayStart), stepsCount, locations });
    }
  }

  return results;
}

async function resolvePhotoAccess(request: boolean) {
  const mediaLibraryNative = requireOptionalNativeModule('ExpoMediaLibrary');
  if (!mediaLibraryNative) {
    return false;
  }

  try {
    const MediaLibrary = await import('expo-media-library');
    const current = await MediaLibrary.getPermissionsAsync(false);
    if (current.granted) {
      return true;
    }
    if (!request || !current.canAskAgain) {
      return false;
    }
    const asked = await MediaLibrary.requestPermissionsAsync(false);
    return asked.granted;
  } catch {
    return false;
  }
}

async function readStepsBetween(start: Date, end: Date) {
  try {
    const { Pedometer } = await import('expo-sensors');
    const available = await Pedometer.isAvailableAsync();
    if (!available) {
      return 0;
    }
    const result = await Pedometer.getStepCountAsync(start, end);
    return Math.max(0, Math.round(result.steps));
  } catch {
    return 0;
  }
}

async function readPhotoLocationsBetween(start: Date, end: Date): Promise<StoredHomeLocationPoint[]> {
  try {
    const MediaLibrary = await import('expo-media-library');
    const page = await MediaLibrary.getAssetsAsync({
      createdAfter: start.getTime(),
      createdBefore: end.getTime(),
      first: MAX_PHOTO_SCAN_PER_DAY,
      mediaType: MediaLibrary.MediaType.photo,
      sortBy: [['creationTime', false]],
    });

    const points: StoredHomeLocationPoint[] = [];
    for (const asset of page.assets) {
      if (points.length >= MAX_GEOTAGGED_PER_DAY) {
        break;
      }

      try {
        const info = await MediaLibrary.getAssetInfoAsync(asset.id);
        const exif = (info as { exif?: Record<string, unknown> | null }).exif ?? null;
        const latitude = info.location?.latitude ?? resolvePhotoLatitude(exif) ?? undefined;
        const longitude = info.location?.longitude ?? resolvePhotoLongitude(exif) ?? undefined;
        if (latitude == null || longitude == null) {
          continue;
        }

        points.push({
          // Same id scheme as live photo seeding so the two never duplicate
          // a photo on the same day.
          id: `camera-roll-photo-${asset.id}`,
          lat: latitude,
          lng: longitude,
          capturedAt: new Date(asset.creationTime).toISOString(),
          type: 'unknown',
          hasPhoto: true,
          source: 'photo_attachment',
          thumbnailUri: asset.uri,
        });
      } catch {
        continue;
      }
    }

    return points;
  } catch {
    return [];
  }
}

function toLocalDateId(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Dev-only: force a fresh backfill (requests photo permission) directly
// against stored state, for test preview from the dev tab.
export async function runDevBackfill(): Promise<string> {
  const { loadStoredHomeState, saveStoredHomeState } = await import('@/utils/home-storage');
  const { applyBackfilledDays, hydrateHomeState } = await import('@/utils/home-engine');
  const { loadOnboardingProfile } = await import('@/utils/onboarding-state');

  const stored = loadStoredHomeState();
  if (!stored) {
    return 'Open Home once first so a stored day exists.';
  }

  const profile = loadOnboardingProfile();
  const days = await collectBackfillDays(new Date(), 3, { requestPhotoPermission: true });
  const now = new Date();
  const hydrated = hydrateHomeState(stored, profile, now);
  saveStoredHomeState(applyBackfilledDays(hydrated.state, days, profile, now));

  if (days.length === 0) {
    return 'No retrospective data found (steps history empty and no geotagged photos).';
  }
  const photoDays = days.filter((day) => day.locations.length > 0).length;
  return `Reconstructed ${days.length} day(s): steps on ${days.length}, photo places on ${photoDays}.`;
}
