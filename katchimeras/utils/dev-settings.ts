import { DEV_TOOLS_ENABLED } from '@/constants/dev';
import { getStoredJson, setStoredJson } from '@/utils/app-storage';

const QUEST_LOOP_KEY = 'katchadeck.dev.quest-loop-after-complete-v1';
const FOUNDATION_ONLY_PHOTO_INTERPRETATION_KEY = 'katchadeck.dev.foundation-only-photo-interpretation-v1';
const ALL_KATCHIMERAS_AVAILABLE_KEY = 'katchadeck.dev.all-katchimeras-available-v1';
const JOURNEY_QUICK_MODE_KEY = 'katchadeck.dev.mossprout-journey-quick-mode-v1';
const allKatchimerasListeners = new Set<() => void>();
const journeyQuickModeListeners = new Set<() => void>();

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

export function isJourneyQuickModeEnabled(): boolean {
  return isDevBuild() && getStoredJson<boolean>(JOURNEY_QUICK_MODE_KEY, false) === true;
}

export function setJourneyQuickModeEnabled(enabled: boolean): void {
  if (!isDevBuild()) return;
  setStoredJson(JOURNEY_QUICK_MODE_KEY, enabled);
  journeyQuickModeListeners.forEach((listener) => listener());
}

export function subscribeJourneyQuickMode(listener: () => void): () => void {
  journeyQuickModeListeners.add(listener);
  return () => journeyQuickModeListeners.delete(listener);
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
  return DEV_TOOLS_ENABLED;
}
