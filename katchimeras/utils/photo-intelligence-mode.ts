export const FOUNDATION_ONLY_PHOTO_INTERPRETATION_KEY = 'katchadeck.dev.foundation-only-photo-interpretation-v1';

// Keep this read platform-neutral: photo classification is also exercised by
// Node verification scripts, where importing React Native storage is invalid.
export function isFoundationOnlyPhotoInterpretationEnabled(): boolean {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return false;
  try {
    const raw = globalThis.localStorage?.getItem(FOUNDATION_ONLY_PHOTO_INTERPRETATION_KEY);
    return raw ? JSON.parse(raw) === true : false;
  } catch {
    return false;
  }
}
