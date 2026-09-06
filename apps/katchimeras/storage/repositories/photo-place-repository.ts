import Storage from 'expo-sqlite/kv-store';

import type {
  NativePlaceLookupResult,
  PhotoPlaceResolution,
  PreviousPlaceSelection,
  UserPlaceCluster,
} from '@/types/photo-place';
import { fallbackPlaceKey } from '@/utils/photo-place-scoring';

const RESOLUTIONS_KEY = 'katchimeras.photo-place.resolutions-v1';
const CLUSTERS_KEY = 'katchimeras.photo-place.clusters-v1';
const HISTORY_KEY = 'katchimeras.photo-place.history-v1';
const SETTINGS_KEY = 'katchimeras.photo-place.settings-v1';
// v2 includes reverse-geocoded areas of interest and their resolved MapKit
// items. Keep old entries isolated so they cannot mask the new native fields.
const CACHE_PREFIX = 'katchimeras.photo-place.cache-v2:';

type CachedLookup = {
  value: NativePlaceLookupResult;
  expiresAt: number;
};

export type PhotoPlaceSettings = {
  enabled: boolean;
  historicalBackfillEnabled: boolean;
};

const DEFAULT_SETTINGS: PhotoPlaceSettings = {
  enabled: true,
  historicalBackfillEnabled: false,
};

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await Storage.getItemAsync(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(key: string, value: T): Promise<void> {
  await Storage.setItemAsync(key, JSON.stringify(value));
}

export function buildPlaceCacheKey(latitude: number, longitude: number, radius: number): string {
  return [
    latitude.toFixed(4),
    longitude.toFixed(4),
    Math.round(radius / 25) * 25,
  ].join(':');
}

export const photoPlaceRepository = {
  async settings(): Promise<PhotoPlaceSettings> {
    return readJson(SETTINGS_KEY, DEFAULT_SETTINGS);
  },

  async updateSettings(patch: Partial<PhotoPlaceSettings>): Promise<PhotoPlaceSettings> {
    const next = { ...(await this.settings()), ...patch };
    await writeJson(SETTINGS_KEY, next);
    return next;
  },

  async resolution(photoId: string): Promise<PhotoPlaceResolution | null> {
    const rows = await readJson<Record<string, PhotoPlaceResolution>>(RESOLUTIONS_KEY, {});
    return rows[photoId] ?? null;
  },

  async saveResolution(resolution: PhotoPlaceResolution): Promise<void> {
    const rows = await readJson<Record<string, PhotoPlaceResolution>>(RESOLUTIONS_KEY, {});
    rows[resolution.photoId] = resolution;
    await writeJson(RESOLUTIONS_KEY, rows);
  },

  async resolutions(photoIds?: string[]): Promise<PhotoPlaceResolution[]> {
    const rows = await readJson<Record<string, PhotoPlaceResolution>>(RESOLUTIONS_KEY, {});
    if (!photoIds) return Object.values(rows);
    return photoIds.flatMap((photoId) => (rows[photoId] ? [rows[photoId]] : []));
  },

  async removeResolution(photoId: string): Promise<void> {
    const rows = await readJson<Record<string, PhotoPlaceResolution>>(RESOLUTIONS_KEY, {});
    delete rows[photoId];
    await writeJson(RESOLUTIONS_KEY, rows);
  },

  async clusters(): Promise<UserPlaceCluster[]> {
    return readJson(CLUSTERS_KEY, []);
  },

  async saveCluster(cluster: UserPlaceCluster): Promise<void> {
    const rows = await this.clusters();
    const index = rows.findIndex((item) => item.id === cluster.id);
    if (index >= 0) rows[index] = cluster;
    else rows.push(cluster);
    await writeJson(CLUSTERS_KEY, rows);
  },

  async removeCluster(clusterId: string): Promise<void> {
    await writeJson(CLUSTERS_KEY, (await this.clusters()).filter((item) => item.id !== clusterId));
  },

  async history(): Promise<PreviousPlaceSelection[]> {
    return readJson(HISTORY_KEY, []);
  },

  async recordSelection(resolution: PhotoPlaceResolution): Promise<void> {
    const candidate = resolution.selectedCandidate;
    if (!candidate) return;
    const history = await this.history();
    const fallbackKey = fallbackPlaceKey(
      candidate.name,
      candidate.latitude,
      candidate.longitude
    );
    const index = history.findIndex(
      (item) =>
        (candidate.applePlaceId && item.applePlaceId === candidate.applePlaceId) ||
        item.fallbackKey === fallbackKey
    );
    const next: PreviousPlaceSelection = {
      applePlaceId: candidate.applePlaceId,
      fallbackKey,
      placeType: candidate.normalizedCategory,
      selectionCount: index >= 0 ? history[index].selectionCount + 1 : 1,
      lastSelectedAt: new Date().toISOString(),
    };
    if (index >= 0) history[index] = next;
    else history.push(next);
    await writeJson(HISTORY_KEY, history);
  },

  async cachedLookup(key: string): Promise<NativePlaceLookupResult | null> {
    const cached = await readJson<CachedLookup | null>(`${CACHE_PREFIX}${key}`, null);
    if (!cached) return null;
    if (cached.expiresAt <= Date.now()) {
      await Storage.removeItemAsync(`${CACHE_PREFIX}${key}`);
      return null;
    }
    return cached.value;
  },

  async cacheLookup(
    key: string,
    value: NativePlaceLookupResult,
    ttlMs = 7 * 24 * 60 * 60 * 1000
  ): Promise<void> {
    await writeJson(`${CACHE_PREFIX}${key}`, { value, expiresAt: Date.now() + ttlMs });
  },

  async clearPrivateData(): Promise<void> {
    const cacheKeys = (await Storage.getAllKeysAsync()).filter((key) =>
      key.startsWith(CACHE_PREFIX)
    );
    await Promise.all([
      Storage.removeItemAsync(RESOLUTIONS_KEY),
      Storage.removeItemAsync(CLUSTERS_KEY),
      Storage.removeItemAsync(HISTORY_KEY),
      ...cacheKeys.map((key) => Storage.removeItemAsync(key)),
    ]);
  },
};
