import { requireOptionalNativeModule } from 'expo-modules-core';
import { useCallback, useEffect, useRef, useState } from 'react';

import { refreshPhotoLocationsForDay } from '@/game/days/actions';
import { preserveVisibleHatchForMap } from '@/game/days/map-hatch-invariant';
import { toLocalDateId } from '@/game/days/date';
import type { HomeDayRecord, RecentPhotoAsset } from '@/types/home';
import { homeRepository } from '@/storage/repositories/home-repository';
import { loadOnboardingProfile } from '@/utils/onboarding-state';
import { resolvePhotoLocation } from '@/utils/photo-location';
import { resolvePhotoPlace } from '@/utils/photo-place-resolution';

export type DayMapPhotoPermission = 'checking' | 'granted' | 'limited' | 'denied' | 'unavailable';

const PHOTO_PAGE_SIZE = 200;
const MAX_PHOTO_PAGES = 20;
const MAX_PHOTOS_PER_DAY = 160;
const INFO_BATCH_SIZE = 8;
const MAX_PLACE_RESOLUTIONS_PER_DAY = 24;
const PLACE_BATCH_SIZE = 4;

export function useDayMapPhotoRefresh(day: HomeDayRecord | null, onStored: () => void) {
  const [permission, setPermission] = useState<DayMapPhotoPermission>('checking');
  const [refreshing, setRefreshing] = useState(false);
  const refreshedDayRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  const refresh = useCallback(async (requestPermission = false) => {
    if (!day || inFlightRef.current || process.env.EXPO_OS === 'web') return;
    const native = requireOptionalNativeModule('ExpoMediaLibrary');
    if (!native) {
      setPermission('unavailable');
      refreshedDayRef.current = day.id;
      return;
    }
    inFlightRef.current = true;
    setRefreshing(true);
    try {
      const MediaLibrary = await import('expo-media-library');
      const status = requestPermission
        ? await MediaLibrary.requestPermissionsAsync(false)
        : await MediaLibrary.getPermissionsAsync(false);
      const limited = status.accessPrivileges === 'limited';
      if (!status.granted) {
        setPermission('denied');
        refreshedDayRef.current = day.id;
        return;
      }
      setPermission(limited ? 'limited' : 'granted');
      // Do not use MediaLibrary's createdAfter/createdBefore filters here. They
      // have returned incomplete pages on-device. Page newest-first, then place
      // assets into the requested local calendar day ourselves.
      const assets = await loadPhotoAssetsForDay(MediaLibrary, day.isoDate);
      const photos: RecentPhotoAsset[] = [];
      for (let index = 0; index < assets.length; index += INFO_BATCH_SIZE) {
        const batch = await Promise.all(
          assets.slice(index, index + INFO_BATCH_SIZE).map((asset) => toLocatedPhoto(MediaLibrary, asset))
        );
        photos.push(...batch.filter((photo): photo is RecentPhotoAsset => photo != null));
      }
      for (
        let index = 0;
        index < Math.min(photos.length, MAX_PLACE_RESOLUTIONS_PER_DAY);
        index += PLACE_BATCH_SIZE
      ) {
        const batch = photos.slice(index, index + PLACE_BATCH_SIZE);
        const resolutions = await Promise.all(
          batch.map((photo) =>
            resolvePhotoPlace({
              photoId: photo.id,
              coordinate:
                photo.latitude != null && photo.longitude != null
                  ? { latitude: photo.latitude, longitude: photo.longitude }
                  : undefined,
              capturedAt: new Date(photo.createdAt).toISOString(),
              imageSource: 'photo_library',
            })
          )
        );
        resolutions.forEach((resolution, offset) => {
          const photo = photos[index + offset];
          if (photo) photo.placeResolution = resolution;
        });
      }
      // A successful scan replaces the prior passive-photo points even when no
      // valid geotags remain. This removes corrupt pins imported by older code.
      const now = new Date();
      const state = homeRepository.load();
      if (state) {
        const hatchSafeState = preserveVisibleHatchForMap(state, day);
        homeRepository.save(refreshPhotoLocationsForDay(hatchSafeState, day.id, photos, loadOnboardingProfile(), now));
        onStored();
      }
      refreshedDayRef.current = day.id;
    } catch {
      setPermission((current) => current === 'checking' ? 'denied' : current);
      refreshedDayRef.current = day.id;
    } finally {
      inFlightRef.current = false;
      setRefreshing(false);
    }
  }, [day, onStored]);

  useEffect(() => {
    if (!day || refreshedDayRef.current === day.id) return;
    void refresh(false);
  }, [day, refresh]);

  return { permission, refreshing, requestPhotoAccess: () => refresh(true), refreshPhotos: () => refresh(false) };
}

async function loadPhotoAssetsForDay(
  MediaLibrary: typeof import('expo-media-library'),
  isoDate: string
) {
  type Asset = Awaited<ReturnType<typeof MediaLibrary.getAssetsAsync>>['assets'][number];
  const assets: Asset[] = [];
  const start = new Date(`${isoDate}T00:00:00`).getTime();
  const end = new Date(`${isoDate}T00:00:00`);
  end.setDate(end.getDate() + 1);
  const endMs = end.getTime();
  let after: string | undefined;

  for (let pageIndex = 0; pageIndex < MAX_PHOTO_PAGES && assets.length < MAX_PHOTOS_PER_DAY; pageIndex += 1) {
    const page = await MediaLibrary.getAssetsAsync({
      after,
      first: PHOTO_PAGE_SIZE,
      mediaType: MediaLibrary.MediaType.photo,
      sortBy: [['creationTime', false]],
    });
    if (!page.assets.length) break;

    let newestTime = 0;
    let oldestTime = Number.POSITIVE_INFINITY;
    for (const asset of page.assets) {
      const time = resolveAssetTime(asset);
      if (time <= 0) continue;
      newestTime = Math.max(newestTime, time);
      oldestTime = Math.min(oldestTime, time);
      if (time >= start && time < endMs && toLocalDateId(new Date(time)) === isoDate) assets.push(asset);
      if (assets.length >= MAX_PHOTOS_PER_DAY) break;
    }

    if (!page.hasNextPage || newestTime < start || oldestTime < start) break;
    after = page.endCursor;
  }
  return assets;
}

async function toLocatedPhoto(
  MediaLibrary: typeof import('expo-media-library'),
  asset: Awaited<ReturnType<typeof MediaLibrary.getAssetsAsync>>['assets'][number]
): Promise<RecentPhotoAsset | null> {
  try {
    const info = await MediaLibrary.getAssetInfoAsync(asset.id);
    const exif = (info as { exif?: Record<string, unknown> | null }).exif ?? null;
    const pair = resolvePhotoLocation(info.location?.latitude, info.location?.longitude, exif);
    if (!pair) return null;
    return {
      id: asset.id,
      uri: asset.uri,
      thumbnailUri: asset.uri,
      createdAt: resolveAssetTime(asset),
      width: asset.width,
      height: asset.height,
      isScreenshot: asset.mediaSubtypes?.includes('screenshot'),
      latitude: pair.latitude,
      longitude: pair.longitude,
    };
  } catch {
    return null;
  }
}

function resolveAssetTime(asset: { creationTime?: unknown; modificationTime?: unknown }): number {
  return normalizeEpoch(asset.creationTime) || normalizeEpoch(asset.modificationTime);
}

function normalizeEpoch(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  if (numeric < 1e11) return Math.floor(numeric * 1000);
  if (numeric > 1e14) return Math.floor(numeric / 1000);
  return numeric;
}
