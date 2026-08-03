import { getStoredJson, setStoredJson } from '@/utils/app-storage';

const QUEST_LOOP_KEY = 'katchadeck.dev.quest-loop-after-complete-v1';
const FOUNDATION_ONLY_PHOTO_INTERPRETATION_KEY = 'katchadeck.dev.foundation-only-photo-interpretation-v1';
const ALL_KATCHIMERAS_AVAILABLE_KEY = 'katchadeck.dev.all-katchimeras-available-v1';
const allKatchimerasListeners = new Set<() => void>();

export function isAllKatchimerasAvailableEnabled(): boolean {
  return isDevBuild() && getStoredJson<boolean>(ALL_KATCHIMERAS_AVAILABLE_KEY, false) === true;
}

export function setAllKatchimerasAvailableEnabled(enabled: boolean): void {
  if (!isDevBuild()) return;
  setStoredJson(ALL_KATCHIMERAS_AVAILABLE_KEY, enabled);
  allKatchimerasListeners.forEach((listener) => listener());
}

export function subscribeAllKatchimerasAvailable(listener: () => void): () => void {
  allKatchimerasListeners.add(listener);
  return () => allKatchimerasListeners.delete(listener);
}

export function isQuestLoopAfterCompleteEnabled(): boolean {
  return isDevBuild() && getStoredJson<boolean>(QUEST_LOOP_KEY, false) === true;
}

export function setQuestLoopAfterCompleteEnabled(enabled: boolean): void {
  if (!isDevBuild()) return;
  setStoredJson(QUEST_LOOP_KEY, enabled);
}

export function setFoundationOnlyPhotoInterpretationEnabled(enabled: boolean): void {
  if (!isDevBuild()) return;
  setStoredJson(FOUNDATION_ONLY_PHOTO_INTERPRETATION_KEY, enabled);
}

function isDevBuild(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}
