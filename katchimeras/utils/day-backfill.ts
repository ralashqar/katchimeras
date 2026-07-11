import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

import type {
  DayVisionSummary,
  EncounterHistoryMap,
  HomeScoreKey,
  PhotoVisionResult,
  StoredHomeDayRecord,
  StoredHomeLocationPoint,
} from '@/types/home';
import { curatePhotos, type CuratablePhoto } from '@/utils/photo-curation';
import { resolvePhotoLatitude, resolvePhotoLongitude } from '@/utils/photo-location';
import { computePhotoSignature } from '@/utils/photo-similarity';
import { analyzePhoto, analyzePhotoLuminance, getPhotoThumbnailDataUri, isVisionAvailable } from '@/utils/photo-vision';
import { aggregatePhotoVision } from '@/utils/vision-signals';
import {
  beginBackfillEnrichment,
  finishBackfillEnrichment,
  markBackfillDayEnriched,
} from '@/utils/backfill-status';

export type BackfilledDay = {
  isoDate: string;
  stepsCount: number;
  locations: StoredHomeLocationPoint[];
  // Aggregated on-device vision read of the day's photos, when analysed during
  // backfill (so reflections/comics for past days can be specific).
  vision?: DayVisionSummary | null;
  // Diagnostics: raw assets the library returned, how many survived the detail
  // read, and how many carried a GPS geotag. Distinguishes "library returned
  // nothing" (rawAssets 0) from "detail read failed" (rawAssets high, scanned
  // low) from "no GPS" (scanned high, geotagged 0).
  photosRaw?: number;
  photosScanned?: number;
  photosGeotagged?: number;
};

// We page the library newest-first (no date filter) and bucket in JS. These
// bound the work: at ~10 photos/day a few pages cover the last 5 days, and we
// stop early once we page past the oldest wanted day.
const SCAN_PAGE_SIZE = 200;
const MAX_SCAN_PAGES = 20;
// Assets processed per day. Generous so a busy day's whole roll is considered.
const MAX_PHOTO_SCAN_PER_DAY = 120;
// Frames we decode (Skia) for the dedup hash + brightness signals, per day. Set
// to the scan cap so EVERY photo that can become a point gets a brightness signal
// — otherwise black frames past the cap have no signal and can't be filtered.
const MAX_SIGNATURE_PER_DAY = MAX_PHOTO_SCAN_PER_DAY;
// Mean luminance (0-255) at/below which a frame reads as black — used only to spot
// a degenerate/broken decode across a day, never to drop a single frame directly.
const DEGENERATE_DARK_LUMINANCE = 4;
// Photos that become located points (map markers + album frames) per day.
const MAX_LOCATION_POINTS_PER_DAY = 60;
// Frames read by the on-device Vision pass (labels/OCR/faces).
const MAX_VISION_PER_DAY = 8;
// How many recent days we reconstruct. Kept small (3) so a fresh profile fills
// in just the last few days rather than a long, confusing tail. CMPedometer
// history reaches 7 days back, so this stays safely inside it.
const MAX_BACKFILL_DAYS = 3;

// Reconstructs recent past days from what iOS can actually tell us in
// retrospect: pedometer history (steps, up to 7 days back) and photo EXIF
// geotags (places). General location history does not exist as an API -
// photos are the only retrospective place source.
export async function collectBackfillDays(
  now: Date,
  dayCount: number,
  options: { requestPhotoPermission?: boolean; analyzeVision?: boolean; includeToday?: boolean } = {}
): Promise<BackfilledDay[]> {
  if (Platform.OS === 'web') {
    return [];
  }

  const days = Math.min(dayCount, MAX_BACKFILL_DAYS);
  const photoAccess = await resolvePhotoAccess(options.requestPhotoPermission === true);

  // The local day-ids we care about. Normally oldest..yesterday (today is the
  // live day, handled elsewhere), but includeToday extends it through today —
  // needed because the user's newest photos are dated today.
  const oldestOffset = options.includeToday ? 0 : 1;
  const windows: { isoDate: string; dayStart: Date; dayEnd: Date }[] = [];
  for (let offset = days; offset >= oldestOffset; offset -= 1) {
    const dayStart = new Date(now);
    dayStart.setDate(dayStart.getDate() - offset);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);
    windows.push({ isoDate: toLocalDateId(dayStart), dayStart, dayEnd });
  }

  // Scan the library with NO date filter at all (the date filter was returning
  // almost nothing on-device even though the unfiltered query returns the whole
  // 8.5k-photo library), then bucket photos into days IN JS by their timestamp.
  const photosByDay =
    photoAccess && windows.length > 0
      ? await scanPhotosByDay(
          windows[0].dayStart,
          new Set(windows.map((window) => window.isoDate)),
          options.analyzeVision === true
        )
      : new Map<string, PhotoScanResult>();

  const results: BackfilledDay[] = [];
  for (const window of windows) {
    const stepsCount = await readStepsBetween(window.dayStart, window.dayEnd);
    const photoData = photosByDay.get(window.isoDate) ?? EMPTY_PHOTO_SCAN;

    // Keep a day if it has ANY signal — steps, located photos, OR raw photos the
    // library returned (so a day full of photos that lack GPS still shows up in
    // the diagnostic instead of vanishing as "no data").
    if (stepsCount > 0 || photoData.rawAssets > 0) {
      results.push({
        isoDate: window.isoDate,
        stepsCount,
        locations: photoData.locations,
        vision: photoData.visionResults.length > 0 ? aggregatePhotoVision(photoData.visionResults) : null,
        photosRaw: photoData.rawAssets,
        photosScanned: photoData.scanned,
        photosGeotagged: photoData.geotagged,
      });
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

export type PhotoAccessLevel = 'all' | 'limited' | 'none' | 'unknown';

// READ-ONLY access level, for the diagnostic only. Deliberately does NOT call
// requestPermissionsAsync or presentPermissionsPickerAsync — presenting the
// limited-library picker can flip the app from full access into limited mode
// (then getAssetsAsync returns nothing), so we never touch it. Permission is
// requested the proven way inside collectBackfillDays (resolvePhotoAccess).
async function readPhotoAccessLevel(): Promise<PhotoAccessLevel> {
  const mediaLibraryNative = requireOptionalNativeModule('ExpoMediaLibrary');
  if (!mediaLibraryNative) {
    return 'unknown';
  }
  try {
    const MediaLibrary = await import('expo-media-library');
    const perm = await MediaLibrary.getPermissionsAsync(false);
    return (perm as { accessPrivileges?: PhotoAccessLevel }).accessPrivileges ?? (perm.granted ? 'all' : 'none');
  } catch {
    return 'unknown';
  }
}

// How many photos the library exposes to the app AT ALL — no date filter, no
// location requirement. This is the ground-truth count that separates "the app
// can't see your photos" (limited access / empty library) from "the date
// bucketing is wrong" (this is high but per-day counts are 0). iCloud never
// affects it: getAssetsAsync reads the local catalog, not the cloud. Returns -1
// if the query itself fails.
async function probePhotoLibraryTotal(): Promise<number> {
  try {
    const MediaLibrary = await import('expo-media-library');
    const page = await MediaLibrary.getAssetsAsync({ first: 1, mediaType: MediaLibrary.MediaType.photo });
    return (page as { totalCount?: number }).totalCount ?? page.assets.length;
  } catch {
    return -1;
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

// The device's current coordinates (last-known first, then a fresh read) — used
// ONLY as a fallback anchor for a reconstructed day that has no other location.
// iOS exposes no retrospective location history, so "where you are now" is the
// best stand-in to give the first hatches a map pin instead of an empty map.
async function resolveCurrentLocationCoord(): Promise<{ lat: number; lng: number } | null> {
  if (Platform.OS === 'web') {
    return null;
  }
  try {
    const Location = await import('expo-location');
    const permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) {
      return null;
    }
    const known = await Location.getLastKnownPositionAsync();
    const position = known ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    if (!position) {
      return null;
    }
    const { latitude, longitude } = position.coords;
    return Number.isFinite(latitude) && Number.isFinite(longitude) ? { lat: latitude, lng: longitude } : null;
  } catch {
    return null;
  }
}

type ScannedPhoto = {
  id: string;
  thumbnailUri: string;
  localUri: string;
  createdAt: number;
  latitude: number | null;
  longitude: number | null;
  width: number;
  height: number;
  isScreenshot: boolean;
  // On-device pixel signals (best-effort, may be null). Drive black/blur/dup
  // filtering — but never trusted blindly (see isDegenerateSignal).
  meanLuminance: number | null;
  luminanceRange: number | null;
  similarityHash: string | null;
};

type PhotoScanResult = {
  locations: StoredHomeLocationPoint[];
  visionResults: PhotoVisionResult[];
  // Diagnostics that pin a "too few photos" failure to a specific stage:
  //  - rawAssets: how many the library's getAssetsAsync returned for the window.
  //    Low here → window/permission/library filter problem.
  //  - scanned: how many survived per-asset detail reads. rawAssets high but
  //    scanned low → getAssetInfoAsync is failing (e.g. iCloud).
  //  - geotagged: how many carried GPS. scanned high but geotagged 0 → no GPS.
  rawAssets: number;
  scanned: number;
  geotagged: number;
};

const EMPTY_PHOTO_SCAN: PhotoScanResult = {
  locations: [],
  visionResults: [],
  rawAssets: 0,
  scanned: 0,
  geotagged: 0,
};

// Scans the library WITHOUT any date filter (the date filter was returning
// almost nothing on-device while the unfiltered query returns the whole library),
// then buckets photos into the requested local days IN JAVASCRIPT by each
// photo's own timestamp. Pages newest-first and stops once it has paged past the
// oldest wanted day, so it examines only as many photos as needed.
async function scanPhotosByDay(
  scanStart: Date,
  wantedDays: Set<string>,
  analyzeVision: boolean
): Promise<Map<string, PhotoScanResult>> {
  const byDay = new Map<string, PhotoScanResult>();
  try {
    const MediaLibrary = await import('expo-media-library');
    const scanStartMs = scanStart.getTime();
    type Asset = Awaited<ReturnType<typeof MediaLibrary.getAssetsAsync>>['assets'][number];
    const assetsByDay = new Map<string, Asset[]>();

    let after: string | undefined;
    for (let pageIndex = 0; pageIndex < MAX_SCAN_PAGES; pageIndex += 1) {
      const page = await MediaLibrary.getAssetsAsync({
        first: SCAN_PAGE_SIZE,
        after,
        mediaType: MediaLibrary.MediaType.photo,
        sortBy: [['creationTime', false]],
      });
      if (page.assets.length === 0) {
        break;
      }

      let pageHadInWindow = false;
      for (const asset of page.assets) {
        const timeMs = resolveAssetTimeMs(asset);
        if (timeMs <= 0 || timeMs < scanStartMs) {
          continue; // undatable, or older than the window — can't place it
        }
        pageHadInWindow = true;
        const isoDate = toLocalDateId(new Date(timeMs));
        if (!wantedDays.has(isoDate)) {
          continue;
        }
        const bucket = assetsByDay.get(isoDate) ?? [];
        if (bucket.length >= MAX_PHOTO_SCAN_PER_DAY) {
          continue;
        }
        bucket.push(asset);
        assetsByDay.set(isoDate, bucket);
      }

      // Stop only when a WHOLE page had nothing in the window (robust to a sort
      // that isn't perfectly newest-first), not on the first stray old photo.
      if (!pageHadInWindow || !page.hasNextPage) {
        break;
      }
      after = page.endCursor;
    }

    for (const [isoDate, assets] of assetsByDay) {
      byDay.set(isoDate, await buildDayPhotos(MediaLibrary, assets, analyzeVision));
    }
  } catch {
    // Leave whatever buckets we managed to build (possibly none).
  }
  return byDay;
}

// Turns one day's bucket of assets into located points + a vision read. The
// per-asset detail read (getAssetInfoAsync) surfaces GPS. We use the plain call
// (no options — the shouldDownloadFromNetwork option was throwing on-device) and
// NEVER drop a photo when the read fails (keep it without a geotag), so a flaky
// read can't erase the day.
async function buildDayPhotos(
  MediaLibrary: typeof import('expo-media-library'),
  assets: Awaited<ReturnType<typeof MediaLibrary.getAssetsAsync>>['assets'],
  analyzeVision: boolean
): Promise<PhotoScanResult> {
  try {
    const rawAssets = assets.length;
    const scanned: ScannedPhoto[] = [];
    let signaturesComputed = 0;
    for (const asset of assets) {
      let latitude: number | null = null;
      let longitude: number | null = null;
      let localUri = asset.uri;
      try {
        // Plain call (no shouldDownloadFromNetwork option) — that's what the
        // known-working committed code used; the option appears to throw here.
        const info = await MediaLibrary.getAssetInfoAsync(asset.id);
        const exif = (info as { exif?: Record<string, unknown> | null }).exif ?? null;
        localUri = (info as { localUri?: string }).localUri ?? asset.uri;
        // Coerce — native location fields can arrive as strings on some devices.
        latitude = toFiniteNumber(info.location?.latitude) ?? resolvePhotoLatitude(exif) ?? null;
        longitude = toFiniteNumber(info.location?.longitude) ?? resolvePhotoLongitude(exif) ?? null;
      } catch {
        // Keep the photo anyway — base asset fields are enough to show it.
      }

      const isScreenshot = asset.mediaSubtypes?.includes('screenshot') ?? false;
      let meanLuminance: number | null = null;
      let luminanceRange: number | null = null;
      let similarityHash: string | null = null;
      if (!isScreenshot) {
        // Brightness from the NATIVE module (reliable — local thumbnail, Apple
        // decode) so black/blank frames are caught even when Skia can't decode
        // the photo. This is the black-filter signal.
        const luminance = await analyzePhotoLuminance(asset.id);
        if (luminance) {
          meanLuminance = luminance.meanLuminance;
          luminanceRange = luminance.luminanceRange;
        }
        // Skia signature only for the dedup HASH (best-effort, capped); fall back
        // to its brightness only if the native read was unavailable.
        if (signaturesComputed < MAX_SIGNATURE_PER_DAY) {
          const thumbForHash = await getPhotoThumbnailDataUri(asset.id, 256);
          const signature = thumbForHash ? await computePhotoSignature(thumbForHash) : null;
          if (signature) {
            similarityHash = signature.hash;
            if (meanLuminance == null) meanLuminance = signature.meanLuminance;
            if (luminanceRange == null) luminanceRange = signature.luminanceRange;
            signaturesComputed += 1;
          }
        }
      }

      scanned.push({
        id: asset.id,
        thumbnailUri: asset.uri,
        localUri,
        createdAt: resolveAssetTimeMs(asset) || asset.creationTime,
        latitude,
        longitude,
        width: asset.width,
        height: asset.height,
        isScreenshot,
        meanLuminance,
        luminanceRange,
        similarityHash,
      });
    }

    // If the Skia signal looks broken, discard ONLY the dedup hash (so a
    // degenerate hash can't over-collapse near-duplicates). The brightness now
    // comes from the reliable native read, so it's kept — the black filter still
    // works even when the hash is junk.
    if (isDegenerateSignal(scanned)) {
      for (const photo of scanned) {
        photo.similarityHash = null;
      }
    }

    // Curate: drops screenshots, tiny throwaways, fully-black, flat/blurry, and
    // near-duplicate frames. The curator NEVER drops a geotagged frame on the
    // brightness gates, and we additionally guarantee every geotagged photo stays
    // an anchor below — so cleanup can tidy albums but never erase a map pin.
    const curatable: (CuratablePhoto & { source: ScannedPhoto })[] = scanned.map((photo) => ({
      id: photo.id,
      createdAt: photo.createdAt,
      latitude: photo.latitude,
      longitude: photo.longitude,
      isScreenshot: photo.isScreenshot,
      width: photo.width,
      height: photo.height,
      similarityHash: photo.similarityHash,
      meanLuminance: photo.meanLuminance,
      luminanceRange: photo.luminanceRange,
      source: photo,
    }));
    const keeperIds = new Set(curatePhotos(curatable).keepers.map((photo) => photo.id));

    // 3. Turn photos into located points. ONLY curation keepers become points, so
    //    junk (screenshots/tiny/black/blur/dup) — geotagged or not — never shows
    //    as a pin. But borrowing uses ALL geotagged photos as coordinate sources
    //    (even dropped black ones), so dropping a black anchor can never strand a
    //    day's other good photos: a non-geotagged keeper can still borrow that
    //    place and become the pin there. No time cap — show the whole day.
    const coordSources = scanned
      .filter((photo) => photo.latitude != null && photo.longitude != null)
      .sort((left, right) => left.createdAt - right.createdAt);

    const placed: { photo: ScannedPhoto; lat: number; lng: number }[] = [];
    for (const photo of scanned) {
      if (!keeperIds.has(photo.id)) {
        continue; // dropped by curation (screenshot/tiny/black/blur/dup)
      }
      if (photo.latitude != null && photo.longitude != null) {
        placed.push({ photo, lat: photo.latitude, lng: photo.longitude });
        continue;
      }
      const anchor = nearestAnchorByTime(coordSources, photo.createdAt);
      if (anchor) {
        placed.push({ photo, lat: anchor.latitude, lng: anchor.longitude });
      }
    }

    const boundedLocations: StoredHomeLocationPoint[] = placed
      .sort((left, right) => left.photo.createdAt - right.photo.createdAt)
      .slice(-MAX_LOCATION_POINTS_PER_DAY)
      .map(({ photo, lat, lng }) => ({
        // Same id scheme as live photo seeding so the two never duplicate a
        // photo on the same day.
        id: `camera-roll-photo-${photo.id}`,
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        capturedAt: new Date(photo.createdAt).toISOString(),
        type: 'unknown' as const,
        hasPhoto: true,
        source: 'photo_attachment' as const,
        thumbnailUri: photo.thumbnailUri,
        // Carry the hash + brightness so the day-map's display-time pass can
        // collapse look-alikes AND drop any black frame within each cluster.
        similarityHash: photo.similarityHash ?? undefined,
        meanLuminance: photo.meanLuminance ?? undefined,
        luminanceRange: photo.luminanceRange ?? undefined,
      }));

    // 4. On-device Vision read for the day's narrative (labels/OCR/faces) —
    //    geotagged frames first, capped to keep the pass quick. Best-effort.
    const visionResults: PhotoVisionResult[] = [];
    if (analyzeVision) {
      const visionTargets = scanned
        .filter((photo) => keeperIds.has(photo.id))
        .sort((left, right) => Number(right.latitude != null) - Number(left.latitude != null))
        .slice(0, MAX_VISION_PER_DAY);
      for (const photo of visionTargets) {
        const vision = await analyzePhoto(photo.localUri);
        if (vision) {
          visionResults.push({
            ...vision,
            captureSource: 'camera_roll',
            isScreenshot: photo.isScreenshot,
            hasLocation: photo.latitude != null && photo.longitude != null,
          });
        }
      }
    }

    return {
      locations: boundedLocations,
      visionResults,
      rawAssets,
      scanned: scanned.length,
      geotagged: coordSources.length,
    };
  } catch {
    return { ...EMPTY_PHOTO_SCAN };
  }
}

// The place of the nearest-in-time geotagged keeper, so a non-geotagged photo
// joins the most plausible cluster's album. No time cap: on a day that has at
// least one anchor we'd rather place every photo somewhere sensible than hide it
// — the goal is to show the whole day, and same-day photos belong to the day's
// places. Returns null only when there are no anchors at all.
function nearestAnchorByTime(
  anchors: ScannedPhoto[],
  createdAt: number
): { latitude: number; longitude: number } | null {
  let best: { latitude: number; longitude: number } | null = null;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const anchor of anchors) {
    if (anchor.latitude == null || anchor.longitude == null) {
      continue;
    }
    const delta = Math.abs(anchor.createdAt - createdAt);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = { latitude: anchor.latitude, longitude: anchor.longitude };
    }
  }
  return best;
}

function toLocalDateId(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Coerce an asset timestamp to epoch MILLISECONDS regardless of the unit the
// native layer hands us. `getAssetsAsync` is documented as ms, but in practice
// the value can arrive in seconds (~1.7e9) or microseconds (~1.7e15) depending on
// platform/version — and if we misread the unit, every photo buckets to 1970 and
// the day match fails (the "0 found" bug). Recent ms is ~1.7e12.
function normalizeEpochMs(value: unknown): number {
  let n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) {
    // Not a plain number — try an ISO/date string or a Date object.
    n =
      typeof value === 'string'
        ? Date.parse(value)
        : value instanceof Date
          ? value.getTime()
          : NaN;
  }
  if (!Number.isFinite(n) || n <= 0) {
    return 0;
  }
  if (n < 1e11) {
    return n * 1000; // looks like seconds
  }
  if (n > 1e14) {
    return Math.floor(n / 1000); // looks like microseconds
  }
  return n; // already milliseconds
}

// The best epoch-ms timestamp for an asset: normalized creationTime, falling back
// to modificationTime when creation is missing/zero (some assets carry only one).
function resolveAssetTimeMs(asset: { creationTime?: unknown; modificationTime?: unknown }): number {
  const created = normalizeEpochMs(asset.creationTime);
  if (created > 0) {
    return created;
  }
  return normalizeEpochMs(asset.modificationTime);
}

// Coerce a coordinate to a finite number, or null. On some devices the native
// media layer returns latitude/longitude as STRINGS, which then blew up downstream
// (`"37.4".toFixed` is not a function), discarding the whole day. Never trust the
// numeric type of native location fields — always run them through this.
function toFiniteNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

// True when a day's on-device signatures look broken rather than real (the Skia
// decode is unverified across devices). A real roll is essentially never mostly
// black, and rarely has one identical hash dominating — either pattern means the
// signal must NOT be used to drop photos. When degenerate, callers null it out so
// curation falls back to the safe screenshot/resolution/time heuristics.
function isDegenerateSignal(scanned: ScannedPhoto[]): boolean {
  const signed = scanned.filter((photo) => photo.similarityHash != null);
  if (signed.length < 4) {
    return false;
  }
  // Only a TRULY broken decode reads most of the roll as pure black — a real
  // night-out day can legitimately have many dark frames, and we must not let
  // that disable black filtering. So this is deliberately high (0.7); the more
  // reliable broken-decode tell is one identical hash dominating every frame.
  const blackish = signed.filter(
    (photo) => typeof photo.meanLuminance === 'number' && photo.meanLuminance <= DEGENERATE_DARK_LUMINANCE
  ).length;
  if (blackish / signed.length > 0.7) {
    return true;
  }
  const hashCounts = new Map<string, number>();
  let topHashCount = 0;
  for (const photo of signed) {
    const next = (hashCounts.get(photo.similarityHash as string) ?? 0) + 1;
    hashCounts.set(photo.similarityHash as string, next);
    if (next > topHashCount) {
      topHashCount = next;
    }
  }
  return topHashCount / signed.length > 0.6;
}

// Diagnostic: dump the newest few photos' resolved DAY and whether they carry a
// GPS location — the two things that decide if a photo can become a map pin. A
// "0 placed" run is almost always one of: wrong day (timestamp) or no geotag.
async function sampleNewestTimestamps(): Promise<string> {
  try {
    const MediaLibrary = await import('expo-media-library');
    const page = await MediaLibrary.getAssetsAsync({
      first: 4,
      mediaType: MediaLibrary.MediaType.photo,
      sortBy: [['creationTime', false]],
    });
    if (page.assets.length === 0) {
      return 'sample: getAssetsAsync returned 0 assets (no sort/no filter)';
    }
    const lines: string[] = [];
    for (const asset of page.assets) {
      const raw = asset as { creationTime?: unknown; modificationTime?: unknown };
      const resolved = resolveAssetTimeMs(raw);
      const day = resolved > 0 ? toLocalDateId(new Date(resolved)) : 'n/a';
      let loc = 'loc?';
      try {
        const info = await MediaLibrary.getAssetInfoAsync(asset.id);
        const lat = toFiniteNumber(info.location?.latitude);
        const lng = toFiniteNumber(info.location?.longitude);
        loc = lat != null && lng != null ? `loc=${lat.toFixed(2)},${lng.toFixed(2)}` : 'loc=NONE';
      } catch (error) {
        loc = `err:${String((error as { message?: string })?.message ?? error).slice(0, 34)}`;
      }
      // Native brightness — confirms the black filter has real numbers to act on.
      const lum = await analyzePhotoLuminance(asset.id);
      const lumStr = lum ? `lum=${lum.meanLuminance.toFixed(0)} rng=${lum.luminanceRange.toFixed(0)}` : 'lum=NULL';
      lines.push(`  ${day} ${loc} ${lumStr}`);
    }
    return lines.join('\n');
  } catch (error) {
    return `sample failed: ${String(error)}`;
  }
}

// An auto-seeded camera-roll photo point (from backfill or the live seeder) —
// NOT a user-attached moment photo, route point, or GPS sample.
function isAutoSeededPhotoPoint(point: StoredHomeLocationPoint): boolean {
  return (
    point.source === 'photo_attachment' &&
    point.id.startsWith('camera-roll-photo-') &&
    point.momentId == null
  );
}

// REPLACES a day's auto-seeded photo points with the freshly-curated scan
// (`incoming` already has black/blur/dup removed). A plain additive union could
// never prune a black photo a previous run stored, so cleanup never "took". This
// preserves everything else (moment-linked photos, route, GPS samples) and only
// swaps the auto-seeded set — so re-pressing Backfill actually removes junk.
function mergeFreshPhotoPoints(
  existing: StoredHomeLocationPoint[],
  incoming: StoredHomeLocationPoint[]
): StoredHomeLocationPoint[] {
  const preserved = existing.filter((point) => !isAutoSeededPhotoPoint(point));
  const preservedIds = new Set(preserved.map((point) => point.id));
  const fresh = incoming.filter((point) => !preservedIds.has(point.id));
  return [...preserved, ...fresh].sort(
    (left, right) => new Date(left.capturedAt).getTime() - new Date(right.capturedAt).getTime()
  );
}

export type BackfillFoundationResult = {
  // Human-readable diagnostics for the dev alert / toast.
  summary: string;
  // Hatched backfilled days still awaiting their LLM reflection. The caller can
  // navigate Home immediately and hand these to enrichBackfillReflections to
  // finish in the background.
  pendingReflectionDayIds: string[];
};

// Foundation pass — everything the user needs to SEE the moment they land on
// Home: reconstruct recent days, curate + cluster their photos into map pins and
// per-place albums (on-device vision included so each day matches the right
// creature), HATCH each day, and persist. Deliberately does NOT call the LLM —
// reflections are slow and run afterwards via enrichBackfillReflections, so the
// app can hand the user straight to a ready Home.
// RUTHLESS TEST PATH — photos → pins only. No vision, no place-category network
// call, no hatching, no LLM. Just: scan each recent day's photos, place the
// geotagged ones (and borrow the nearest anchor for the rest), and persist so the
// day map shows clustered pins. Nothing here can throw on the network or hide a
// photo, so it isolates the one thing we're verifying: do the photos land on the
// map. Re-add hatching/cleanup/LLM once this is confirmed working.
export async function runBackfillPhotosOnly(): Promise<string> {
  const { homeRepository } = await import('@/storage/repositories/home-repository');
  const { applyBackfilledDays, hydrateHomeState } = await import('@/game/days');
  const { loadOnboardingProfile } = await import('@/utils/onboarding-state');

  const stored = homeRepository.load();
  if (!stored) {
    return 'Open Home once first so a stored day exists.';
  }

  const profile = loadOnboardingProfile();
  const now = new Date();
  // Read-only access level for the diagnostic (no picker — that can flip us into
  // limited mode). Permission itself is requested inside collectBackfillDays.
  const access = await readPhotoAccessLevel();
  // Ground-truth: how many photos the app can see in the whole library, ignoring
  // dates entirely. Separates "app can't see your photos" from "date logic wrong".
  const libraryTotal = await probePhotoLibraryTotal();
  // No analyzeVision → fast. includeToday because the user's newest photos are
  // dated today, which the normal backfill (past days only) would skip.
  const richDays = await collectBackfillDays(now, MAX_BACKFILL_DAYS, {
    requestPhotoPermission: true,
    includeToday: true,
  });

  const totalRaw = richDays.reduce((sum, day) => sum + (day.photosRaw ?? 0), 0);
  const totalScanned = richDays.reduce((sum, day) => sum + (day.photosScanned ?? 0), 0);
  const totalGeotagged = richDays.reduce((sum, day) => sum + (day.photosGeotagged ?? 0), 0);

  // ALWAYS lead with the dump at the very top so it can't be hidden below the
  // fold, and the "PHOTO CHECK v3" banner confirms this fresh code is running.
  const dump = await sampleNewestTimestamps();
  const top =
    `PHOTO CHECK v6\n` +
    `newest photos (day + GPS + brightness):\n${dump}\n` +
    `— access:${access} library:${libraryTotal} raw:${totalRaw} scanned:${totalScanned} geo:${totalGeotagged}`;

  if (totalRaw === 0) {
    return `${top}\n→ 0 photos matched the last 5 days (incl. today). The days above didn't match the window.`;
  }

  // Merge into archived days (past) AND into the live today record (since the
  // newest photos are dated today and applyBackfilledDays skips today). Union
  // top-up everywhere so nothing is clobbered. No hatch/network/LLM.
  const todayIso = toLocalDateId(now);
  const hydrated = hydrateHomeState(stored, profile, now);
  const baseState = applyBackfilledDays(hydrated.state, richDays, profile, now);
  const richByDate = new Map(richDays.map((day) => [day.isoDate, day]));

  const mergeDay = (day: StoredHomeDayRecord): StoredHomeDayRecord => {
    const rich = richByDate.get(day.isoDate);
    if (!rich || rich.locations.length === 0) {
      return day; // no fresh photos this run — never wipe a day on a blank scan
    }
    const merged = mergeFreshPhotoPoints(day.locations, rich.locations);
    return { ...day, locations: merged, locationSampleCount: merged.length };
  };

  const archivedDays = baseState.archivedDays.map(mergeDay);
  const todayRecord = mergeDay(baseState.today);
  homeRepository.save({ ...baseState, today: todayRecord, archivedDays });

  const totalPlaced = [todayRecord, ...archivedDays]
    .filter((day) => richByDate.has(day.isoDate))
    .reduce((sum, day) => sum + day.locations.length, 0);

  return `${top}\n→ placed ${totalPlaced} pins (incl. today=${todayIso}).${totalGeotagged === 0 ? ' BUT geo:0 — none have GPS, so no map pins. The photos lack location metadata.' : ' Open the day map.'}`;
}

export async function runBackfillFoundation(): Promise<BackfillFoundationResult> {
  const { homeRepository } = await import('@/storage/repositories/home-repository');
  const { applyBackfilledDays, hydrateHomeState } = await import('@/game/days');
  const { loadOnboardingProfile } = await import('@/utils/onboarding-state');
  const { loadOnboardingRecap } = await import('@/utils/onboarding-recap');

  const stored = homeRepository.load();
  if (!stored) {
    return { summary: 'Open Home once first so a stored day exists.', pendingReflectionDayIds: [] };
  }

  const profile = loadOnboardingProfile();
  // The onboarding recap's answers (how the week felt + what it held) steer the
  // first hatches when a reconstructed day has no real signal of its own.
  const preferredFloorSeeds = loadOnboardingRecap()?.preferredSeedIds ?? [];
  const now = new Date();
  const todayIso = toLocalDateId(now);
  // includeToday so the user's newest photos (dated today) are captured too.
  const richDays = await collectBackfillDays(now, MAX_BACKFILL_DAYS, {
    requestPhotoPermission: true,
    analyzeVision: true,
    includeToday: true,
  });

  // GUARANTEE the last MAX_BACKFILL_DAYS past days all exist, even when a day had
  // no photos or steps to scan. Every recent day must still become a (distinct)
  // character, so a fresh start always reveals 3 — never 2, never 0. Days with no
  // signal get an empty record here and hatch from the distinct floor below.
  const presentDates = new Set(richDays.map((day) => day.isoDate));
  for (let offset = 1; offset <= MAX_BACKFILL_DAYS; offset += 1) {
    const past = new Date(now);
    past.setDate(past.getDate() - offset);
    past.setHours(0, 0, 0, 0);
    const isoDate = toLocalDateId(past);
    if (!presentDates.has(isoDate)) {
      richDays.push({ isoDate, stepsCount: 0, locations: [] });
    }
  }

  // STEP 1 — PERSIST PHOTOS → PINS FIRST. This is the reliable part (no network,
  // no LLM): merge each day's freshly-scanned points (union, never clobbering)
  // into the archived days AND the live today record, then save immediately. Even
  // if hatching/LLM below fails, the pins are already safe.
  const richByDate = new Map(richDays.map((day) => [day.isoDate, day]));
  const mergeDay = (day: StoredHomeDayRecord): StoredHomeDayRecord => {
    const rich = richByDate.get(day.isoDate);
    if (!rich || rich.locations.length === 0) {
      return day; // no fresh photos this run — never wipe a day on a blank scan
    }
    const merged = mergeFreshPhotoPoints(day.locations, rich.locations);
    return { ...day, locations: merged, locationSampleCount: merged.length };
  };

  const hydrated = hydrateHomeState(stored, profile, now);
  const baseState = applyBackfilledDays(hydrated.state, richDays, profile, now);
  const todayRecord = mergeDay(baseState.today);
  const photoState = {
    ...baseState,
    today: todayRecord,
    archivedDays: baseState.archivedDays.map(mergeDay),
  };
  homeRepository.save(photoState);

  const visionByDate = new Map(richDays.map((day) => [day.isoDate, day.vision ?? null]));
  const isReconstructedPastDay = (isoDate: string) => richByDate.has(isoDate) && isoDate !== todayIso;

  // STEP 1.5 — MAP LOCATION beyond photos, so reconstructed days are never
  // map-less. iOS exposes NO general retrospective location history to apps, so
  // the only sources for a past day are: photo geotags (above), Apple Health
  // workout routes, and — as a last resort — where the phone is right now.
  //   (a) Apple Health workout routes: a walk / run / hike day gets its real GPS
  //       route + pins even with zero photos.
  //   (b) Current device location: a day with neither photos nor a workout still
  //       drops a single pin (the hatch is "planted" there) instead of opening to
  //       an empty map.
  let locationedState = photoState;
  try {
    const { importHealthRoutesForDay } = await import('@/game/days');
    const { getHealthRouteAvailability, importRoutesForDay } = await import('@/utils/health-route-import');
    const healthAvailability = await getHealthRouteAvailability();
    if (healthAvailability.platformSupported && healthAvailability.permissionState === 'granted') {
      for (const day of locationedState.archivedDays) {
        if (!isReconstructedPastDay(day.isoDate)) {
          continue;
        }
        try {
          const payload = await importRoutesForDay({ isoDate: day.isoDate });
          if (payload.status === 'success' && (payload.segments?.length ?? 0) > 0) {
            locationedState = importHealthRoutesForDay(locationedState, day.id, payload, profile, now);
          }
        } catch {
          // Workout-route import is best-effort — a failure just means no route.
        }
      }
    }
  } catch {
    // Health module unavailable (Expo Go / non-iOS) — skip routes entirely.
  }

  const currentCoord = await resolveCurrentLocationCoord();
  if (currentCoord) {
    locationedState = {
      ...locationedState,
      archivedDays: locationedState.archivedDays.map((day) => {
        if (!isReconstructedPastDay(day.isoDate) || day.locations.length > 0) {
          return day;
        }
        const anchor: StoredHomeLocationPoint = {
          id: `current-location-${day.isoDate}`,
          lat: Number(currentCoord.lat.toFixed(6)),
          lng: Number(currentCoord.lng.toFixed(6)),
          capturedAt: new Date(`${day.isoDate}T12:00:00`).toISOString(),
          type: 'unknown',
          hasPhoto: false,
          source: 'foreground',
          momentId: null,
        };
        return { ...day, locations: [anchor], locationSampleCount: 1 };
      }),
    };
  }
  // Tag any reconstructed point within the home radius as 'home', so the day map
  // shows a home pin and the hatch can tell you were home (the current-location
  // fallback above is at home when the user set home during onboarding).
  const { loadHomeAnchor, tagHomeLocations } = await import('@/utils/home-location');
  const homeAnchor = loadHomeAnchor();
  if (homeAnchor) {
    locationedState = {
      ...locationedState,
      archivedDays: locationedState.archivedDays.map((day) =>
        isReconstructedPastDay(day.isoDate)
          ? { ...day, locations: tagHomeLocations(day.locations, homeAnchor) }
          : day
      ),
    };
  }
  homeRepository.save(locationedState);

  // STEP 2 — HATCH PAST DAYS (best-effort). Today is the live day and is never
  // hatched here.
  const { buildDistinctEncounterCreature, recordEncounterHatch } = await import('@/utils/encounter-engine');
  const { resolvePlaceSeedsForDay } = await import('@/utils/place-categories');
  let history: EncounterHistoryMap = { ...locationedState.encounterHistory };
  const priorDays: StoredHomeDayRecord[] = [];
  const archived = [...locationedState.archivedDays];
  const pendingReflectionDayIds: string[] = [];
  let hatchedCount = 0;
  // Every species hatched this run, so the reconstructed days are always DIFFERENT
  // characters — no two backfilled days ever share a creature.
  const usedProfileIds = new Set<string>();

  for (let index = 0; index < archived.length; index += 1) {
    const day = archived[index];
    // Only the just-reconstructed PAST days; never today.
    if (!visionByDate.has(day.isoDate) || day.isoDate === todayIso) {
      priorDays.push(day);
      continue;
    }
    // A day that somehow already has a creature keeps it, but still reserves its
    // species so the remaining days stay distinct from it.
    if (day.creature) {
      if (day.creature.encounterProfileId) {
        usedProfileIds.add(day.creature.encounterProfileId);
      }
      priorDays.push(day);
      continue;
    }
    // Place-category seeds need the network. A failure here must NEVER skip the
    // hatch — that was the "hatch your past hatches nothing" bug: when the place
    // API was down, every day's resolve threw and the whole hatch (including the
    // floor fallback below) was skipped. Resolve defensively so the day still
    // hatches from steps / vision / the guaranteed real-cast floor.
    let seeds: string[] = [];
    try {
      seeds = await resolvePlaceSeedsForDay(day, priorDays);
    } catch {
      seeds = [];
    }

    const enriched: StoredHomeDayRecord = {
      ...day,
      placeCategorySeeds: seeds,
      vision: visionByDate.get(day.isoDate) ?? day.vision,
    };
    const [primary, secondary] = deriveBackfillTraits(enriched);

    let hatched = enriched;
    try {
      // Every reconstructed day hatches a real character that is DISTINCT from the
      // other backfilled days: the day's best unused candidate, or a rotating
      // generic floor when it has no specific signal. Never null, never a repeat —
      // so a 3-day backfill is always 3 different creatures.
      const creature = buildDistinctEncounterCreature(
        enriched,
        history,
        usedProfileIds,
        primary,
        secondary,
        preferredFloorSeeds
      );

      if (creature?.encounterProfileId) {
        hatchedCount += 1;
        usedProfileIds.add(creature.encounterProfileId);
        history = recordEncounterHatch(history, creature.encounterProfileId, day.isoDate);
        hatched = {
          ...enriched,
          state: 'hatched',
          shareReadyAt: enriched.shareReadyAt ?? new Date(`${day.isoDate}T21:00:00`).toISOString(),
          creature,
        };
        // The reflection (LLM) is the slow part — defer it to the background pass.
        pendingReflectionDayIds.push(hatched.id);
      }
    } catch {
      // Building the creature failed unexpectedly — keep the day (and its pins).
      hatched = enriched;
    }

    archived[index] = hatched;
    priorDays.push(hatched);
  }

  homeRepository.save({ ...locationedState, archivedDays: archived, encounterHistory: history });

  // Diagnostics.
  const totalPlaced = [locationedState.today, ...archived]
    .filter((day) => richByDate.has(day.isoDate))
    .reduce((sum, day) => sum + day.locations.length, 0);
  const totalScanned = richDays.reduce((sum, day) => sum + (day.photosScanned ?? 0), 0);
  const totalGeotagged = richDays.reduce((sum, day) => sum + (day.photosGeotagged ?? 0), 0);
  const visionStatus = isVisionAvailable() ? 'present' : 'absent';
  const perDay = richDays
    .map(
      (day) =>
        `  ${day.isoDate.slice(5)}: scanned ${day.photosScanned ?? 0}, geo ${day.photosGeotagged ?? 0}, placed ${day.locations.length}`
    )
    .join('\n');

  return {
    summary: `scanned ${totalScanned} · geo ${totalGeotagged} · placed ${totalPlaced} · hatched ${hatchedCount} · vision ${visionStatus}\n${perDay}\nPins are ready. Quotes finishing in the background.`,
    pendingReflectionDayIds,
  };
}

// Background pass — request the real LLM reflection for each just-hatched day and
// persist it the moment it lands, so each day's specific quote fills in on Home
// without blocking navigation. Drives the backfill-status store so Home can show
// a quiet "polishing" tag and pull each reflection in as it completes. Re-reads
// stored state every iteration so it never clobbers concurrent writes.
export async function enrichBackfillReflections(dayIds: string[]): Promise<void> {
  if (dayIds.length === 0) {
    return;
  }

  const { homeRepository } = await import('@/storage/repositories/home-repository');
  const { applyGeneratedReflection } = await import('@/game/days');
  const { loadOnboardingProfile } = await import('@/utils/onboarding-state');
  const { requestDayReflection } = await import('@/utils/day-reflection');
  const profile = loadOnboardingProfile();

  beginBackfillEnrichment(dayIds.length);
  try {
    for (const dayId of dayIds) {
      const stored = homeRepository.load();
      if (!stored) {
        break;
      }
      const day = [stored.today, ...stored.archivedDays].find((candidate) => candidate.id === dayId);
      if (!day?.creature || day.creature.reflectionSource === 'generated') {
        markBackfillDayEnriched();
        continue;
      }

      // Specific because day.vision (photoDetails/signText) was stored at hatch.
      // The other stored days give the temporal/bond context for this one.
      const pastDays = [stored.today, ...stored.archivedDays].filter(
        (candidate) => candidate.id !== dayId
      );
      const generated = await requestDayReflection(day, profile, pastDays);
      if (generated) {
        const fresh = homeRepository.load() ?? stored;
        homeRepository.save(applyGeneratedReflection(fresh, dayId, generated, profile, new Date()));
      }
      markBackfillDayEnriched();
    }
  } finally {
    finishBackfillEnrichment();
  }
}

function deriveBackfillTraits(day: StoredHomeDayRecord): [HomeScoreKey, HomeScoreKey] {
  if (day.stepsCount >= 7000) {
    return ['energy', 'exploration'];
  }
  if (day.visitedPlaceCount >= 3) {
    return ['exploration', 'energy'];
  }
  return ['calm', 'focus'];
}
