import { getStoredJson, setStoredJson } from '@/utils/app-storage';

const QUEST_LOOP_KEY = 'katchadeck.dev.quest-loop-after-complete-v1';
const FOUNDATION_ONLY_PHOTO_INTERPRETATION_KEY = 'katchadeck.dev.foundation-only-photo-interpretation-v1';

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
