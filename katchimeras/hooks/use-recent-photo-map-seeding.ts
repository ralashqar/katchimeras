import { requireOptionalNativeModule } from 'expo-modules-core';
import { useEffect, useRef } from 'react';
import { InteractionManager } from 'react-native';

import type { RecentPhotoAsset } from '@/types/home';
import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import { resolvePhotoLocation } from '@/utils/photo-location';
import { analyzePassivePhoto, PASSIVE_FOUNDATION_DAILY_LIMIT } from '@/utils/intelligence/passive-photo-analysis';
import { loadRecentPhotoAssetPage } from '@/utils/recent-photo-assets';

// Scan a multi-day window so photos land on the days they were actually taken
// (today and recent past), not just the newest handful that might all be old.
const LAST_SCANNED_PHOTO_CREATED_AT_KEY = 'katchadeck.recent-photo-map-cursor-v1';
const MAX_RECENT_PHOTO_SEEDS = 24;
const RECENT_PHOTO_SCAN_SIZE = 60;
const RECENT_PHOTO_WINDOW_DAYS = 6;
const inFlightSeedDays = new Set<string>();

type UseRecentPhotoMapSeedingOptions = {
  enabled: boolean;
  dayId: string | null;
  onSeed: (photos: RecentPhotoAsset[]) => void;
  requestKey: number;
};

export function useRecentPhotoMapSeeding({ enabled, dayId, onSeed, requestKey }: UseRecentPhotoMapSeedingOptions) {
  const lastSeededDayIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !dayId || requestKey <= 0) {
      return;
    }
    const seedDayId = dayId;

    if (
      lastSeededDayIdRef.current === seedDayId ||
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

        const lastScannedCreatedAt = getStoredJson<number | null>(LAST_SCANNED_PHOTO_CREATED_AT_KEY, null);
        const createdAfter = Math.max(
          windowStart.getTime(),
          lastScannedCreatedAt == null ? 0 : lastScannedCreatedAt + 1,
        );
        const assets = await loadRecentPhotoAssetPage(
          MediaLibrary,
          createdAfter,
          RECENT_PHOTO_SCAN_SIZE,
        );

        const recentGeotaggedPhotos: RecentPhotoAsset[] = [];
        let foundationUpgradeCount = 0;
        for (const asset of assets) {
          if (!active || recentGeotaggedPhotos.length >= MAX_RECENT_PHOTO_SEEDS) {
            break;
          }

          try {
            const info = await MediaLibrary.getAssetInfoAsync(asset.id);
            const exif = (info as { exif?: Record<string, unknown> | null }).exif ?? null;
            const coordinate = resolvePhotoLocation(info.location?.latitude, info.location?.longitude, exif);
            if (!coordinate) {
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
              latitude: coordinate.latitude,
              longitude: coordinate.longitude,
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
        const newestCreationTime = assets.reduce(
          (latest, asset) => Math.max(latest, asset.creationTime),
          lastScannedCreatedAt ?? 0,
        );
        if (newestCreationTime > 0) {
          setStoredJson(LAST_SCANNED_PHOTO_CREATED_AT_KEY, newestCreationTime);
        }
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
  }, [dayId, enabled, onSeed, requestKey]);
}
