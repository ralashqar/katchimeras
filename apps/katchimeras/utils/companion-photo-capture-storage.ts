import { getStoredJson, removeStoredValue, setStoredJson } from '@/utils/app-storage';
import type { MergeCharacterId } from '@/types/merge-world';

/**
 * One photo for a companion, in flight: begun by the card or panel that asked
 * for it, finished by the camera screen (which says whether the photo showed
 * the category asked for), read back on the way out of the camera or on the
 * next launch. Only the fact is kept, never the photo: the companion wants
 * to be shown something, not to keep a picture.
 */
export type CompanionPhotoCapturePurpose = 'egg' | 'daily';
export type CompanionPhotoCapture = {
  id: string;
  companion: MergeCharacterId;
  /** The day the photo is for: a photo from another day is not that day's. */
  dayId: string;
  /** The photo category asked for (`drink`, `nature`, ...). */
  category: string;
  /** Who asked: a hatchable Egg being fed, or a friend's daily photo card. */
  purpose: CompanionPhotoCapturePurpose;
  phase: 'capturing' | 'ready';
  /** Whether the photo showed the category. True when the photo could not be read: the moment still counts. */
  matched?: boolean;
  categoryId?: string | null;
  error?: string;
};

const KEY = 'katchimeras.companion-photo-capture.v1';
const listeners = new Set<() => void>();

export function loadCompanionPhotoCapture(): CompanionPhotoCapture | null {
  const value = getStoredJson<CompanionPhotoCapture | null>(KEY, null);
  return value && typeof value.id === 'string' && typeof value.companion === 'string' ? value : null;
}

function save(capture: CompanionPhotoCapture | null) {
  if (capture) setStoredJson(KEY, capture); else removeStoredValue(KEY);
  listeners.forEach((listener) => listener());
}

export function subscribeCompanionPhotoCapture(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function beginCompanionPhotoCapture(companion: MergeCharacterId, dayId: string, category: string, purpose: CompanionPhotoCapturePurpose, now = Date.now()): CompanionPhotoCapture {
  const capture: CompanionPhotoCapture = { id: `${companion}-${purpose}:${now}:${Math.random().toString(36).slice(2, 10)}`, companion, dayId, category, purpose, phase: 'capturing' };
  save(capture);
  return capture;
}

export function finishCompanionPhotoCapture(id: string, result: { matched: boolean; categoryId: string | null } | { error: string }) {
  const capture = loadCompanionPhotoCapture();
  if (capture?.id !== id) return;
  save({ ...capture, phase: 'ready', ...result });
}

export function cancelCompanionPhotoCapture(id?: string) {
  const capture = loadCompanionPhotoCapture();
  if (!capture || (id && capture.id !== id)) return;
  save(null);
}
