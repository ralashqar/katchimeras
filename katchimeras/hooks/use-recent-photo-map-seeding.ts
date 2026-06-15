import { requireOptionalNativeModule } from 'expo-modules-core';
import { useEffect, useRef } from 'react';

import type { RecentPhotoAsset } from '@/types/home';
import { resolvePhotoLatitude, resolvePhotoLongitude } from '@/utils/photo-location';
import { computePhotoHash } from '@/utils/photo-similarity';
import { analyzePhoto, isVisionAvailable } from '@/utils/photo-vision';

// Scan a multi-day window so photos land on the days they were actually taken
// (today and recent past), not just the newest handful that might all be old.
const MAX_RECENT_PHOTO_SEEDS = 40;
const RECENT_PHOTO_SCAN_SIZE = 120;
const RECENT_PHOTO_WINDOW_DAYS = 6;

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

    if (lastSeededDayIdRef.current === dayId) {
      return;
    }

    let active = true;

    async function seedRecentPhotos() {
      const mediaLibraryNative = requireOptionalNativeModule('ExpoMediaLibrary');
      if (!mediaLibraryNative) {
        lastSeededDayIdRef.current = dayId;
        return;
      }

      try {
        const MediaLibrary = await import('expo-media-library');
        const permission = await MediaLibrary.requestPermissionsAsync(false);
        if (!permission.granted) {
          lastSeededDayIdRef.current = dayId;
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
            // Perceptual hash + vision read both run on the decodable local file
            // (ph:// asset URIs aren't directly decodable). Skipped for
            // screenshots, which curation drops anyway. Both best-effort: they
            // no-op when the native modules aren't in the build.
            const hashSource = info.localUri ?? asset.uri;
            const similarityHash = isScreenshot ? undefined : (await computePhotoHash(hashSource)) ?? undefined;
            const vision =
              isScreenshot || !isVisionAvailable() ? undefined : (await analyzePhoto(hashSource)) ?? undefined;

            recentGeotaggedPhotos.push({
              createdAt: asset.creationTime,
              height: asset.height,
              id: asset.id,
              isScreenshot,
              latitude,
              longitude,
              similarityHash,
              vision,
              thumbnailUri: asset.uri,
              uri: asset.uri,
              width: asset.width,
            });
          } catch {
            continue;
          }
        }

        if (!active) {
          return;
        }

        lastSeededDayIdRef.current = dayId;
        if (recentGeotaggedPhotos.length > 0) {
          onSeed(recentGeotaggedPhotos);
        }
      } catch {
        lastSeededDayIdRef.current = dayId;
      }
    }

    void seedRecentPhotos();

    return () => {
      active = false;
    };
  }, [dayId, enabled, onSeed]);
}
