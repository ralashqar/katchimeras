import { getStoredJson, setStoredJson } from '@/utils/app-storage';

// A persistent record of camera-roll photos the user has ALREADY added to a day
// (gave meaning to / captured). The photo-prompt loader consults this so a photo
// is never offered twice — across app restarts — and near-duplicates (same image
// re-saved, matched by perceptual hash) are skipped too. Kept tiny + capped.

const KEY = 'katchadeck.processed_photos_v1';
const MAX = 800;

type ProcessedPhoto = { assetId: string; hash?: string; at: number };

export function loadProcessedPhotos(): ProcessedPhoto[] {
  return getStoredJson<ProcessedPhoto[]>(KEY, []);
}

// Mark a photo as processed. Idempotent by assetId; fills in the hash if a later
// call learns it.
export function markPhotoProcessed(assetId: string, hash?: string, now: number = Date.now()): void {
  if (!assetId) return;
  const list = loadProcessedPhotos();
  const existing = list.find((entry) => entry.assetId === assetId);
  if (existing) {
    if (hash && !existing.hash) {
      existing.hash = hash;
      setStoredJson(KEY, list.slice(-MAX));
    }
    return;
  }
  setStoredJson(KEY, [...list, { assetId, hash, at: now }].slice(-MAX));
}

// A fast lookup built from the stored set: by exact asset id, and by perceptual
// hash so a duplicate of an already-added photo is also skipped.
export function buildProcessedPhotoFilter(): { has: (assetId: string, hash?: string) => boolean } {
  const list = loadProcessedPhotos();
  const ids = new Set(list.map((entry) => entry.assetId));
  const hashes = new Set(list.map((entry) => entry.hash).filter((hash): hash is string => !!hash));
  return {
    has: (assetId: string, hash?: string) => ids.has(assetId) || (!!hash && hashes.has(hash)),
  };
}
