import { requireOptionalNativeModule } from 'expo-modules-core';

import { getStoredJson, removeStoredValue, setStoredJson } from '@/utils/app-storage';
import { curatePhotos } from '@/utils/photo-curation';
import { analyzePhotoLuminance, getPhotoThumbnailDataUri } from '@/utils/photo-vision';
import { computePhotoSignature } from '@/utils/photo-similarity';
import { buildProcessedPhotoFilter } from '@/utils/processed-photos';
import type { DayPromptPhotoCandidate } from '@/utils/day-prompt-engine';

export const DEV_PROMPT_PHOTO_CANDIDATES_KEY = 'katchadeck.dev_prompt_photo_candidates_v1';

type PromptPhotoScanMode = 'production' | 'dev_recent';

type PromptPhotoScanOptions = {
  mode: PromptPhotoScanMode;
  now?: Date;
  limit?: number;
};

type PromptPhotoAsset = {
  id: string;
  uri: string;
  thumbnailUri: string;
  localUri?: string;
  createdAt: number;
  dayIsoDate: string;
  width: number;
  height: number;
  isScreenshot?: boolean;
  similarityHash?: string;
  meanLuminance?: number;
  luminanceRange?: number;
};

const PRODUCTION_SCAN_SIZE = 80;
const PRODUCTION_CANDIDATE_LIMIT = 8;
const DEV_SCAN_SIZE = 80;

// Scan throttle: a candidate scan decodes thumbnails for dozens of photos —
// re-running within a few minutes can't surface anything new, so foreground
// churn is served from the last result.
let scanCache: { key: string; at: number; result: DayPromptPhotoCandidate[] } | null = null;
const SCAN_TTL_MS = 3 * 60_000;

export async function loadProductionDayPromptPhotoCandidates(
  now: Date = new Date()
): Promise<DayPromptPhotoCandidate[]> {
  const key = now.toDateString();
  if (scanCache && scanCache.key === key && Date.now() - scanCache.at < SCAN_TTL_MS) {
    return scanCache.result;
  }
  const result = await loadDayPromptPhotoCandidates({ mode: 'production', now, limit: PRODUCTION_CANDIDATE_LIMIT });
  scanCache = { key, at: Date.now(), result };
  return result;
}

export async function loadDevRecentDayPromptPhotoCandidates(limit = 12): Promise<DayPromptPhotoCandidate[]> {
  return loadDayPromptPhotoCandidates({ mode: 'dev_recent', now: new Date(), limit });
}

export function loadStoredDevPromptPhotoCandidates() {
  return getStoredJson<DayPromptPhotoCandidate[]>(DEV_PROMPT_PHOTO_CANDIDATES_KEY, []);
}

export function saveStoredDevPromptPhotoCandidates(candidates: DayPromptPhotoCandidate[]) {
  setStoredJson(DEV_PROMPT_PHOTO_CANDIDATES_KEY, candidates);
}

export function clearStoredDevPromptPhotoCandidates() {
  removeStoredValue(DEV_PROMPT_PHOTO_CANDIDATES_KEY);
}

async function loadDayPromptPhotoCandidates({
  mode,
  now = new Date(),
  limit = PRODUCTION_CANDIDATE_LIMIT,
}: PromptPhotoScanOptions): Promise<DayPromptPhotoCandidate[]> {
  const mediaLibraryNative = requireOptionalNativeModule('ExpoMediaLibrary');
  if (!mediaLibraryNative) {
    return [];
  }

  try {
    const MediaLibrary = await import('expo-media-library');
    const permission = await MediaLibrary.requestPermissionsAsync(false);
    if (!permission.granted) {
      return [];
    }

    const page = await MediaLibrary.getAssetsAsync({
      ...(mode === 'production' ? { createdAfter: startOfYesterday(now).getTime() } : {}),
      first: mode === 'production' ? PRODUCTION_SCAN_SIZE : DEV_SCAN_SIZE,
      mediaType: MediaLibrary.MediaType.photo,
      sortBy: [['creationTime', false]],
    });

    const scanned: PromptPhotoAsset[] = [];
    const todayIso = toLocalDateId(now);
    const yesterdayIso = toLocalDateId(shiftDate(now, -1));
    const allowedDates = new Set([todayIso, yesterdayIso]);

    for (const asset of page.assets) {
      if (mode === 'production' && !allowedDates.has(toLocalDateId(new Date(asset.creationTime)))) {
        continue;
      }

      const isScreenshot = asset.mediaSubtypes?.includes('screenshot');
      let localUri: string | undefined;
      let luminance: { meanLuminance: number; luminanceRange: number } | null = null;
      let signature: { hash: string; meanLuminance: number; luminanceRange: number } | null = null;

      try {
        const info = await MediaLibrary.getAssetInfoAsync(asset.id);
        localUri = (info as { localUri?: string | null }).localUri ?? undefined;
      } catch {
        localUri = undefined;
      }

      if (!isScreenshot) {
        luminance = await analyzePhotoLuminance(asset.id);
        // MEMORY: hash a small native thumbnail, NEVER the full-res original —
        // decoding dozens of 12-48MP photos on foreground is what used to get
        // the app jetsam-killed. No thumbnail (older build) → no signature.
        const thumb = await getPhotoThumbnailDataUri(asset.id, 256);
        signature = thumb ? await computePhotoSignature(thumb) : null;
        // Let the UI breathe between photos.
        await new Promise((resolve) => setTimeout(resolve, 8));
      }

      scanned.push({
        createdAt: asset.creationTime,
        dayIsoDate: toLocalDateId(new Date(asset.creationTime)),
        height: asset.height,
        id: asset.id,
        isScreenshot,
        localUri,
        meanLuminance: luminance?.meanLuminance ?? signature?.meanLuminance ?? undefined,
        luminanceRange: luminance?.luminanceRange ?? signature?.luminanceRange ?? undefined,
        similarityHash: signature?.hash,
        thumbnailUri: asset.uri,
        uri: asset.uri,
        width: asset.width,
      });
    }

    // Drop photos the user has already added to a day (by asset id, or by
    // perceptual hash for re-saved duplicates) — these never prompt again, even
    // after an app restart. Dev mode keeps everything for testing.
    const processed = buildProcessedPhotoFilter();
    const usable = mode === 'production' ? scanned.filter((asset) => !processed.has(asset.id, asset.similarityHash)) : scanned;
    const keepers = curatePhotos(usable).keepers;
    const ordered = keepers.sort((left, right) => right.createdAt - left.createdAt);
    return ordered.slice(0, limit).map((asset) => ({
      assetId: asset.id,
      capturedAt: new Date(asset.createdAt).toISOString(),
      dayIsoDate: asset.dayIsoDate,
      localUri: asset.localUri,
      source: mode === 'dev_recent' ? 'dev_override' : 'camera_roll',
      thumbnailUri: asset.thumbnailUri || asset.uri,
    }));
  } catch {
    return [];
  }
}

function startOfYesterday(now: Date) {
  const date = shiftDate(now, -1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function shiftDate(input: Date, days: number) {
  const date = new Date(input);
  date.setDate(date.getDate() + days);
  return date;
}

function toLocalDateId(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}
