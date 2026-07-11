import { requireOptionalNativeModule } from 'expo-modules-core';
import { useEffect, useRef } from 'react';
import { InteractionManager } from 'react-native';

import type { RecentPhotoAsset } from '@/types/home';
import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import { resolvePhotoLatitude, resolvePhotoLongitude } from '@/utils/photo-location';
import { analyzePassivePhoto, PASSIVE_FOUNDATION_DAILY_LIMIT } from '@/utils/intelligence/passive-photo-analysis';

// Scan a multi-day window so photos land on the days they were actually taken
// (today and recent past), not just the newest handful that might all be old.
const LAST_SEEDED_DAY_KEY = 'katchadeck.recent-photo-map-seeded-day-v1';
const MAX_RECENT_PHOTO_SEEDS = 24;
const RECENT_PHOTO_SCAN_SIZE = 60;
const RECENT_PHOTO_WINDOW_DAYS = 6;
const inFlightSeedDays = new Set<string>();

type UseRecentPhotoMapSeedingOptions = {
  enabled: boolean;
  dayId: string | null;
  onSeed: (photos: RecentPhotoAsset[]) => void;
};

export function useRecentPhotoMapSeeding({ enabled, dayId, onSeed }: UseRecentPhotoMapSeedingOptions) {
  const lastSeededDayIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !dayId) {
      return;
    }
    const seedDayId = dayId;

    if (
      lastSeededDayIdRef.current === seedDayId ||
      getStoredJson<string | null>(LAST_SEEDED_DAY_KEY, null) === seedDayId ||
      inFlightSeedDays.has(seedDayId)
    ) {
      return;
    }

    let active = true;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    async function seedRecentPhotos() {
      inFlightSeedDays.add(seedDayId);
      const mediaLibraryNative = requireOptionalNativeModule('ExpoMediaLibrary');
      if (!mediaLibraryNative) {
        lastSeededDayIdRef.current = seedDayId;
        setStoredJson(LAST_SEEDED_DAY_KEY, seedDayId);
        inFlightSeedDays.delete(seedDayId);
        return;
      }

      try {
        const MediaLibrary = await import('expo-media-library');
        const permission = await MediaLibrary.getPermissionsAsync(false);
        if (!permission.granted) {
          lastSeededDayIdRef.current = seedDayId;
          inFlightSeedDays.delete(seedDayId);
          return;
        }

        const windowStart = new Date();
        windowStart.setDate(windowStart.getDate() - RECENT_PHOTO_WINDOW_DAYS);
        windowStart.setHours(0, 0, 0, 0);

        const page = await MediaLibrary.getAssetsAsync({
          createdAfter: windowStart.getTime(),
          first: RECENT_PHOTO_SCAN_SIZE,
          mediaType: MediaLibrary.MediaType.photo,
          sortBy: [['creationTime', false]],
        });

        const recentGeotaggedPhotos: RecentPhotoAsset[] = [];
        let foundationUpgradeCount = 0;
        for (const asset of page.assets) {
          if (!active || recentGeotaggedPhotos.length >= MAX_RECENT_PHOTO_SEEDS) {
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

            const isScreenshot = asset.mediaSubtypes?.includes('screenshot');
            const localUri = (info as { localUri?: string; uri?: string }).localUri ?? info.uri ?? asset.uri;
            const analysis = await analyzePassivePhoto({
              uri: localUri,
              isScreenshot,
              hasLocation: true,
              allowFoundation: foundationUpgradeCount < PASSIVE_FOUNDATION_DAILY_LIMIT,
            });
            if (analysis.scene?.source === 'llm') foundationUpgradeCount += 1;

            recentGeotaggedPhotos.push({
              createdAt: asset.creationTime,
              height: asset.height,
              id: asset.id,
              isScreenshot,
              latitude,
              longitude,
              thumbnailUri: asset.uri,
              uri: asset.uri,
              width: asset.width,
              vision: analysis.vision ?? undefined,
              visionSummary: analysis.summary ?? undefined,
              sceneRead: analysis.scene ?? undefined,
            });
          } catch {
            continue;
          }
        }

        if (!active) {
          return;
        }

        lastSeededDayIdRef.current = seedDayId;
        setStoredJson(LAST_SEEDED_DAY_KEY, seedDayId);
        if (recentGeotaggedPhotos.length > 0) {
          onSeed(recentGeotaggedPhotos);
        }
      } catch {
        lastSeededDayIdRef.current = seedDayId;
      } finally {
        inFlightSeedDays.delete(seedDayId);
      }
    }

    const interactionTask = InteractionManager.runAfterInteractions(() => {
      timeout = setTimeout(() => {
        void seedRecentPhotos();
      }, 650);
    });

    return () => {
      active = false;
      interactionTask.cancel();
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [dayId, enabled, onSeed]);
}
