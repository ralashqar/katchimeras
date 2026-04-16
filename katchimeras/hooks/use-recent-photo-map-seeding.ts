import { requireOptionalNativeModule } from 'expo-modules-core';
import { useEffect, useRef } from 'react';

import type { RecentPhotoAsset } from '@/types/home';
import { resolvePhotoLatitude, resolvePhotoLongitude } from '@/utils/photo-location';

const MAX_RECENT_PHOTO_SEEDS = 8;
const RECENT_PHOTO_SCAN_SIZE = 32;

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

        const page = await MediaLibrary.getAssetsAsync({
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

            recentGeotaggedPhotos.push({
              createdAt: asset.creationTime,
              height: asset.height,
              id: asset.id,
              isScreenshot: asset.mediaSubtypes?.includes('screenshot'),
              latitude,
              longitude,
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
