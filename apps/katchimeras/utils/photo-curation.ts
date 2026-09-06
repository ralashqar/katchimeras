// On-device photo curation — the pipeline's "Curate" step. Given the day's
// photos, it kills the junk (screenshots, burst duplicates, tiny throwaways)
// and keeps the keepers. It reads only metadata the app already holds —
// timestamps, coordinates, the screenshot flag, dimensions — so no pixels ever
// leave the device and no vision model is needed. The keepers feed both the
// hatch read and the per-place albums on the day map; the quiet by-product is a
// tidier camera roll the user did nothing to earn.
//
// Real blur detection needs pixels and belongs to the future on-device vision
// pass; this module deliberately does not pretend to detect it.

export type CuratablePhoto = {
  id: string;
  createdAt: number; // epoch milliseconds
  latitude?: number | null;
  longitude?: number | null;
  isScreenshot?: boolean;
  width?: number;
  height?: number;
  // Optional perceptual hash (hex dHash) of the frame. When present on two
  // photos, it lets curation collapse look-alikes over a wider time window than
  // time+place alone would dare. Produced by the on-device vision pass; absent
  // for now, so curation falls back to the time+place heuristic.
  similarityHash?: string | null;
  // Optional on-device brightness signals (0-255), from the same decode that
  // produced the hash. When present they let the curator drop fully-black frames
  // (near-zero mean) and flat/structureless throwaways (near-zero range — a
  // lens-cap shot, a blank wall, an over-blurred frame). Absent → never dropped
  // on a guess.
  meanLuminance?: number | null;
  luminanceRange?: number | null;
};

export type CurationDropReason =
  | 'screenshot'
  | 'burst_duplicate'
  | 'low_resolution'
  | 'too_dark'
  | 'low_detail';

export type CurationDrop<T> = { photo: T; reason: CurationDropReason };

export type CurationResult<T> = {
  keepers: T[];
  dropped: CurationDrop<T>[];
  summary: {
    total: number;
    kept: number;
    screenshots: number;
    burstDuplicates: number;
    lowResolution: number;
    tooDark: number;
    lowDetail: number;
  };
};

export type CurationOptions = {
  burstWindowMs?: number;
  burstDistanceMeters?: number;
  minResolutionPixels?: number;
  nearDuplicateWindowMs?: number;
  similarityHammingThreshold?: number;
  darkLuminanceThreshold?: number;
  flatLuminanceRangeThreshold?: number;
};

// Time alone is a blunt signal, so the pure-time window is deliberately tight —
// it only catches true rapid-fire bursts (shots a few seconds apart). The real
// work is done by visual similarity (perceptual hash) when it's available.
const DEFAULT_BURST_WINDOW_MS = 8_000;
const DEFAULT_BURST_DISTANCE_METERS = 60;
const DEFAULT_MIN_RESOLUTION_PIXELS = 160 * 160;
// When both frames carry a perceptual hash, similarity decides — within this
// window, collapse only the frames that genuinely look alike (Hamming distance
// at or under the threshold). Tuned to be decisive but not heavy-handed: near
// dupes go, distinct shots of the same place stay.
const DEFAULT_NEAR_DUPLICATE_WINDOW_MS = 120_000;
const DEFAULT_SIMILARITY_HAMMING_THRESHOLD = 6;
// Brightness gates (0-255). Tuned to be decisive about junk: a fully-black /
// camera-covered frame, or a single-colour / structureless one (a wall, a lens
// cap, a blank), goes. A dim-but-real night photo keeps real tonal range across
// the frame (a wide max-min), so the FLATNESS gate is the main signal and spares
// it; the dark gate only adds the pure-black corner.
const DEFAULT_DARK_LUMINANCE_THRESHOLD = 16;
const DEFAULT_FLAT_LUMINANCE_RANGE_THRESHOLD = 14;

export function curatePhotos<T extends CuratablePhoto>(
  photos: T[],
  options: CurationOptions = {}
): CurationResult<T> {
  const burstWindowMs = options.burstWindowMs ?? DEFAULT_BURST_WINDOW_MS;
  const burstDistanceMeters = options.burstDistanceMeters ?? DEFAULT_BURST_DISTANCE_METERS;
  const minResolutionPixels = options.minResolutionPixels ?? DEFAULT_MIN_RESOLUTION_PIXELS;
  const nearDuplicateWindowMs = options.nearDuplicateWindowMs ?? DEFAULT_NEAR_DUPLICATE_WINDOW_MS;
  const similarityHammingThreshold =
    options.similarityHammingThreshold ?? DEFAULT_SIMILARITY_HAMMING_THRESHOLD;
  const darkLuminanceThreshold = options.darkLuminanceThreshold ?? DEFAULT_DARK_LUMINANCE_THRESHOLD;
  const flatLuminanceRangeThreshold =
    options.flatLuminanceRangeThreshold ?? DEFAULT_FLAT_LUMINANCE_RANGE_THRESHOLD;

  const dropped: CurationDrop<T>[] = [];
  const survivors: T[] = [];

  // Pass 1 — drop the obvious junk before clustering, so a burst of keepers is
  // never collapsed against a screenshot that happened to land in the window.
  for (const photo of photos) {
    if (photo.isScreenshot) {
      dropped.push({ photo, reason: 'screenshot' });
      continue;
    }
    if (isBelowResolution(photo, minResolutionPixels)) {
      dropped.push({ photo, reason: 'low_resolution' });
      continue;
    }
    if (isTooDark(photo, darkLuminanceThreshold)) {
      dropped.push({ photo, reason: 'too_dark' });
      continue;
    }
    if (isLowDetail(photo, flatLuminanceRangeThreshold)) {
      dropped.push({ photo, reason: 'low_detail' });
      continue;
    }
    survivors.push(photo);
  }

  // Pass 2 — collapse bursts. Walk survivors in time order; a photo joins the
  // open burst when it lands within the time window of the previous one and,
  // when both are geotagged, within the distance window. One representative per
  // burst survives (highest resolution, earliest on ties).
  const ordered = [...survivors].sort((left, right) => left.createdAt - right.createdAt);
  const keepers: T[] = [];
  let burst: T[] = [];

  const flush = () => {
    if (burst.length === 0) {
      return;
    }
    const keeper = pickBurstKeeper(burst);
    keepers.push(keeper);
    for (const photo of burst) {
      if (photo !== keeper) {
        dropped.push({ photo, reason: 'burst_duplicate' });
      }
    }
    burst = [];
  };

  for (const photo of ordered) {
    if (burst.length === 0) {
      burst.push(photo);
      continue;
    }
    const previous = burst[burst.length - 1];
    if (
      isSameBurst(previous, photo, {
        burstWindowMs,
        burstDistanceMeters,
        nearDuplicateWindowMs,
        similarityHammingThreshold,
      })
    ) {
      burst.push(photo);
    } else {
      flush();
      burst.push(photo);
    }
  }
  flush();

  // Restore the caller's original ordering for the kept set.
  const keeperIds = new Set(keepers.map((photo) => photo.id));
  const orderedKeepers = photos.filter((photo) => keeperIds.has(photo.id));

  return {
    keepers: orderedKeepers,
    dropped,
    summary: {
      total: photos.length,
      kept: orderedKeepers.length,
      screenshots: dropped.filter((entry) => entry.reason === 'screenshot').length,
      burstDuplicates: dropped.filter((entry) => entry.reason === 'burst_duplicate').length,
      lowResolution: dropped.filter((entry) => entry.reason === 'low_resolution').length,
      tooDark: dropped.filter((entry) => entry.reason === 'too_dark').length,
      lowDetail: dropped.filter((entry) => entry.reason === 'low_detail').length,
    },
  };
}

function isBelowResolution(photo: CuratablePhoto, minResolutionPixels: number): boolean {
  if (!photo.width || !photo.height || photo.width <= 0 || photo.height <= 0) {
    return false; // unknown dimensions — never drop on a guess
  }
  return photo.width * photo.height < minResolutionPixels;
}

// A fully black / blacked-out frame (camera covered): average brightness sits on
// the floor. Only acts when the signal is present (never drops on a guess). A
// black frame is junk even with a GPS tag — a pointless pin is worse than none —
// so this no longer spares geotagged photos. (Backfill keeps non-geotagged
// photos placeable via separate coordinate sources, so dropping a black anchor
// can't strand a day's other photos.)
function isTooDark(photo: { meanLuminance?: number | null }, threshold: number): boolean {
  return typeof photo.meanLuminance === 'number' && photo.meanLuminance <= threshold;
}

// A flat, structureless frame: almost no tonal range across the image — a blank
// wall, a lens-cap shot, a single-colour / covered frame, an over-blurred or
// over-exposed throwaway. A dim-but-real photo keeps a wide tonal range and
// survives. Like the dark gate, this acts on geotagged frames too.
function isLowDetail(photo: { luminanceRange?: number | null }, threshold: number): boolean {
  return typeof photo.luminanceRange === 'number' && photo.luminanceRange <= threshold;
}

// Shared predicate: is this frame black / single-colour junk? Used both at
// curation time AND at display time (the day-map album), so a black photo is
// never shown on a pin even if it slipped into stored points. Returns false when
// brightness signals are absent (never guesses).
export function isBlackOrFlatFrame(signals: {
  meanLuminance?: number | null;
  luminanceRange?: number | null;
}): boolean {
  return (
    isTooDark(signals, DEFAULT_DARK_LUMINANCE_THRESHOLD) ||
    isLowDetail(signals, DEFAULT_FLAT_LUMINANCE_RANGE_THRESHOLD)
  );
}

function isSameBurst(
  previous: CuratablePhoto,
  next: CuratablePhoto,
  opts: {
    burstWindowMs: number;
    burstDistanceMeters: number;
    nearDuplicateWindowMs: number;
    similarityHammingThreshold: number;
  }
): boolean {
  // Same place is a prerequisite: distinct spots are never one burst, however
  // close in time. (Missing coordinates on either side can't rule it out.)
  if (hasCoordinates(previous) && hasCoordinates(next)) {
    const distance = distanceMeters(previous.latitude!, previous.longitude!, next.latitude!, next.longitude!);
    if (distance > opts.burstDistanceMeters) {
      return false;
    }
  }

  const timeDelta = Math.abs(next.createdAt - previous.createdAt);

  // Similarity is the primary signal: when both frames carry a perceptual hash,
  // the decision is how alike they look (within a generous window) — NOT how
  // close in time. Two different quick shots at the same spot are kept; two
  // look-alikes minutes apart are collapsed.
  if (previous.similarityHash && next.similarityHash) {
    if (timeDelta > opts.nearDuplicateWindowMs) {
      return false;
    }
    const distance = hammingDistanceHex(previous.similarityHash, next.similarityHash);
    return distance != null && distance <= opts.similarityHammingThreshold;
  }

  // No visual signal available — fall back to a tight rapid-fire time burst.
  return timeDelta <= opts.burstWindowMs;
}

// Hamming distance between two equal-length hex strings (perceptual hashes),
// or null if they are malformed/mismatched in length.
function hammingDistanceHex(left: string, right: string): number | null {
  if (left.length !== right.length || left.length === 0) {
    return null;
  }
  let distance = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftNibble = Number.parseInt(left[index], 16);
    const rightNibble = Number.parseInt(right[index], 16);
    if (Number.isNaN(leftNibble) || Number.isNaN(rightNibble)) {
      return null;
    }
    let xor = leftNibble ^ rightNibble;
    while (xor > 0) {
      distance += xor & 1;
      xor >>= 1;
    }
  }
  return distance;
}

function pickBurstKeeper<T extends CuratablePhoto>(burst: T[]): T {
  return burst.reduce((best, candidate) => {
    const bestPixels = resolutionPixels(best);
    const candidatePixels = resolutionPixels(candidate);
    if (candidatePixels > bestPixels) {
      return candidate;
    }
    if (candidatePixels === bestPixels && candidate.createdAt < best.createdAt) {
      return candidate;
    }
    return best;
  }, burst[0]);
}

function resolutionPixels(photo: CuratablePhoto): number {
  if (!photo.width || !photo.height) {
    return 0;
  }
  return photo.width * photo.height;
}

function hasCoordinates(photo: CuratablePhoto): boolean {
  return typeof photo.latitude === 'number' && typeof photo.longitude === 'number';
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const earthRadius = 6_371_000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}
