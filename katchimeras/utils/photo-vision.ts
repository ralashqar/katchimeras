import { requireOptionalNativeModule } from 'expo-modules-core';

import type { DayVisionSummary, PhotoVisionResult, StoredHomeDayRecord } from '@/types/home';
import { aggregatePhotoVision } from '@/utils/vision-signals';

const CAMERA_ROLL_PREFIX = 'camera-roll-photo-';
const MAX_ON_DEMAND_PHOTOS = 12;

// JS bridge to the on-device Apple Vision module (modules/katchimera-vision).
// `requireOptionalNativeModule` returns null when the native module isn't in
// the build (Expo Go, or before the dev client is rebuilt), so every caller
// degrades gracefully to "no vision signal" and the app keeps working — exactly
// how the media-library and health-route modules are accessed.

type VisionNativeModule = {
  analyzePhotoAsync: (uri: string) => Promise<{
    labels?: { name?: unknown; confidence?: unknown }[];
    text?: unknown[];
    faceCount?: unknown;
    humanCount?: unknown;
    animals?: { kind?: unknown; confidence?: unknown; region?: { x?: unknown; y?: unknown; width?: unknown; height?: unknown; confidence?: unknown } }[];
    humans?: { x?: unknown; y?: unknown; width?: unknown; height?: unknown; confidence?: unknown }[];
    faces?: { x?: unknown; y?: unknown; width?: unknown; height?: unknown; confidence?: unknown }[];
    recognizedText?: { text?: unknown; confidence?: unknown }[];
    dominantSubject?: { x?: unknown; y?: unknown; width?: unknown; height?: unknown; confidence?: unknown } | null;
    salientSubjects?: { x?: unknown; y?: unknown; width?: unknown; height?: unknown; confidence?: unknown }[];
    regionClassifications?: {
      region?: { x?: unknown; y?: unknown; width?: unknown; height?: unknown; confidence?: unknown };
      labels?: { name?: unknown; confidence?: unknown }[];
    }[];
    documentDetected?: unknown;
  }>;
  // Reliable native brightness read (local thumbnail, Apple decode) — null when
  // unavailable in the build or unreadable. Added so black/blank photos can be
  // filtered even when the Skia decode returns nothing for them.
  imageLuminanceAsync?: (assetId: string) => Promise<{
    meanLuminance?: unknown;
    luminanceRange?: unknown;
  } | null>;
  // Resized JPEG base64 of a photo (no data: prefix). Null when unreadable.
  thumbnailBase64Async?: (assetId: string, maxSize: number) => Promise<string | null>;
  // One grid JPEG base64 combining several photos. Null when unavailable.
  combineThumbnailsBase64Async?: (assetIds: string[], maxSize: number) => Promise<string | null>;
};

const nativeVision = requireOptionalNativeModule<VisionNativeModule>('KatchimeraVision');

export function isVisionAvailable(): boolean {
  return nativeVision != null;
}

export type PhotoLuminance = { meanLuminance: number; luminanceRange: number };

// Native brightness stats for one asset (by id or ph:// uri). Reliable where the
// Skia decode fails (HEIC / iCloud-optimised photos), because it reads the local
// thumbnail through Apple's pipeline. Returns null if the native module is absent
// (old build) or the frame can't be read — callers must degrade gracefully.
export async function analyzePhotoLuminance(assetId: string): Promise<PhotoLuminance | null> {
  if (!nativeVision?.imageLuminanceAsync) {
    return null;
  }
  try {
    const raw = await nativeVision.imageLuminanceAsync(assetId);
    if (!raw) {
      return null;
    }
    const mean = Number(raw.meanLuminance);
    const range = Number(raw.luminanceRange);
    if (!Number.isFinite(mean) || !Number.isFinite(range)) {
      return null;
    }
    return { meanLuminance: mean, luminanceRange: range };
  } catch {
    return null;
  }
}

// A resized JPEG data URI for one photo (by id / ph:// uri), for the day-comic
// generator. Native (reliable for HEIC / iCloud). Returns null if unavailable.
export async function getPhotoThumbnailDataUri(
  assetId: string,
  maxSize = 768
): Promise<string | null> {
  if (!nativeVision?.thumbnailBase64Async) {
    return null;
  }
  try {
    const base64 = await nativeVision.thumbnailBase64Async(assetId, maxSize);
    return base64 ? `data:image/jpeg;base64,${base64}` : null;
  } catch {
    return null;
  }
}

// One combined grid data URI of several photos (native). Null if unavailable
// (older build) — callers fall back to separate photos.
export async function getCombinedThumbnailDataUri(
  assetIds: string[],
  maxSize = 1024
): Promise<string | null> {
  if (!nativeVision?.combineThumbnailsBase64Async || assetIds.length === 0) {
    return null;
  }
  try {
    const base64 = await nativeVision.combineThumbnailsBase64Async(assetIds, maxSize);
    return base64 ? `data:image/jpeg;base64,${base64}` : null;
  } catch {
    return null;
  }
}

// Best-effort: returns the on-device read of one photo, or null if the module
// is absent or the frame can't be analysed. `uri` should be a decodable local
// file path (info.localUri), not a ph:// asset reference.
export async function analyzePhoto(uri: string): Promise<PhotoVisionResult | null> {
  if (!nativeVision) {
    return null;
  }

  try {
    const raw = await nativeVision.analyzePhotoAsync(uri);
    const dominant = raw.dominantSubject;
    return {
      labels: (raw.labels ?? [])
        .map((label) => ({
          name: typeof label?.name === 'string' ? label.name : '',
          confidence: Number(label?.confidence) || 0,
        }))
        .filter((label) => label.name.length > 0),
      text: (raw.text ?? []).map((token) => String(token)).filter((token) => token.length > 0),
      faceCount: Number(raw.faceCount) || 0,
      humanCount: Number(raw.humanCount) || 0,
      animals: (raw.animals ?? [])
        .map((animal) => ({
          kind: (animal.kind === 'cat' || animal.kind === 'dog' ? animal.kind : 'unknown') as
            | 'cat'
            | 'dog'
            | 'unknown',
          confidence: Number(animal.confidence) || 0,
          region: normalizeRegions(animal.region ? [animal.region] : [])[0] ?? null,
        }))
        .filter((animal) => animal.confidence > 0),
      humans: normalizeRegions(raw.humans),
      faces: normalizeRegions(raw.faces),
      recognizedText: (raw.recognizedText ?? [])
        .map((item) => ({ text: typeof item.text === 'string' ? item.text.trim() : '', confidence: Number(item.confidence) || 0 }))
        .filter((item) => item.text.length > 0)
        .slice(0, 12),
      dominantSubject:
        dominant && [dominant.x, dominant.y, dominant.width, dominant.height, dominant.confidence].every((value) => Number.isFinite(Number(value)))
          ? {
              x: Number(dominant.x), y: Number(dominant.y), width: Number(dominant.width),
              height: Number(dominant.height), confidence: Number(dominant.confidence),
            }
          : null,
      salientSubjects: normalizeRegions(raw.salientSubjects),
      regionClassifications: (raw.regionClassifications ?? []).flatMap((item) => {
        const region = normalizeRegions(item.region ? [item.region] : [])[0];
        if (!region) return [];
        const labels = (item.labels ?? [])
          .map((label) => ({
            name: typeof label.name === 'string' ? label.name : '',
            confidence: Number(label.confidence) || 0,
          }))
          .filter((label) => label.name.length > 0 && label.confidence >= 0.1)
          .slice(0, 6);
        return labels.length > 0 ? [{ region, labels }] : [];
      }).slice(0, 4),
      documentDetected: raw.documentDetected === true,
    };
  } catch {
    return null;
  }
}

function normalizeRegions(
  values: { x?: unknown; y?: unknown; width?: unknown; height?: unknown; confidence?: unknown }[] | undefined
) {
  return (values ?? []).flatMap((value) => {
    const numbers = [value.x, value.y, value.width, value.height, value.confidence].map(Number);
    if (!numbers.every(Number.isFinite)) return [];
    return [{ x: numbers[0], y: numbers[1], width: numbers[2], height: numbers[3], confidence: numbers[4] }];
  }).slice(0, 8);
}

// Guarantees a day has a vision read before we ask the LLM to narrate it — so a
// comic or reflection always gets to consider what the photos actually show. If
// the day was already analysed, returns its summary unchanged; otherwise it
// re-analyses the day's camera-roll photos on the spot (best-effort, native
// only). Returns null only when there's nothing to read.
export async function ensureDayVision(day: StoredHomeDayRecord): Promise<DayVisionSummary | null> {
  if (hasUsableVision(day.vision)) {
    return day.vision ?? null;
  }
  if (!nativeVision) {
    return day.vision ?? null;
  }

  const assetIds = day.locations
    .filter((point) => point.hasPhoto && point.id.startsWith(CAMERA_ROLL_PREFIX))
    .map((point) => point.id.slice(CAMERA_ROLL_PREFIX.length))
    .slice(0, MAX_ON_DEMAND_PHOTOS);
  if (assetIds.length === 0) {
    return day.vision ?? null;
  }

  try {
    const MediaLibrary = await import('expo-media-library');
    const results: PhotoVisionResult[] = [];
    for (const assetId of assetIds) {
      const info = await MediaLibrary.getAssetInfoAsync(assetId);
      const localInfo = info as {
        localUri?: string;
        uri?: string;
        mediaSubtypes?: string[];
        location?: { latitude?: number | null; longitude?: number | null } | null;
      };
      const result = await analyzePhoto(localInfo.localUri ?? localInfo.uri ?? '');
      if (result) {
        results.push({
          ...result,
          captureSource: 'camera_roll',
          isScreenshot: localInfo.mediaSubtypes?.includes('screenshot') ?? false,
          hasLocation:
            Number.isFinite(Number(localInfo.location?.latitude)) &&
            Number.isFinite(Number(localInfo.location?.longitude)),
        });
      }
    }
    return results.length > 0 ? aggregatePhotoVision(results) : (day.vision ?? null);
  } catch {
    return day.vision ?? null;
  }
}

function hasUsableVision(vision: DayVisionSummary | undefined): boolean {
  return Boolean(
    vision && (vision.concepts.length > 0 || vision.details.length > 0 || vision.textTokens.length > 0)
  );
}
