import { DEV_TOOLS_ENABLED } from '@/constants/dev';
import { getStoredJson, setStoredJson } from '@/utils/app-storage';

const QUEST_LOOP_KEY = 'katchadeck.dev.quest-loop-after-complete-v1';
const FOUNDATION_ONLY_PHOTO_INTERPRETATION_KEY = 'katchadeck.dev.foundation-only-photo-interpretation-v1';
const ALL_KATCHIMERAS_AVAILABLE_KEY = 'katchadeck.dev.all-katchimeras-available-v1';
const JOURNEY_QUICK_MODE_KEY = 'katchadeck.dev.mossprout-journey-quick-mode-v1';
const HAVEN_ORDER_FILLERS_KEY = 'katchadeck.dev.haven-order-fillers-v1';
const HAVEN_ORDER_FILLER_SEED_KEY = 'katchadeck.dev.haven-order-filler-seed-v1';
const HAVEN_ORDER_FILLER_SLOT_SEEDS_KEY = 'katchadeck.dev.haven-order-filler-slot-seeds-v1';
const allKatchimerasListeners = new Set<() => void>();
const journeyQuickModeListeners = new Set<() => void>();
const havenOrderFillerListeners = new Set<() => void>();

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

export function isHavenOrderFillersEnabled(): boolean {
  return isDevBuild() && getStoredJson<boolean>(HAVEN_ORDER_FILLERS_KEY, false) === true;
}

export function getHavenOrderFillerSeed(): number {
  return isDevBuild() ? getStoredJson<number>(HAVEN_ORDER_FILLER_SEED_KEY, 1) : 1;
}

export function getHavenOrderFillerSlotSeeds(): readonly [number, number, number] {
  const base = getHavenOrderFillerSeed();
  if (!isDevBuild()) return [1, 2, 3];
  const stored = getStoredJson<unknown>(HAVEN_ORDER_FILLER_SLOT_SEEDS_KEY, null);
  if (!Array.isArray(stored) || stored.length !== 3 || stored.some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
    return [base, base + 1, base + 2];
  }
  return [stored[0], stored[1], stored[2]];
}

export function setHavenOrderFillersEnabled(enabled: boolean): void {
  if (!isDevBuild()) return;
  setStoredJson(HAVEN_ORDER_FILLERS_KEY, enabled);
  if (enabled) {
    const seed = Date.now();
    setStoredJson(HAVEN_ORDER_FILLER_SEED_KEY, seed);
    setStoredJson(HAVEN_ORDER_FILLER_SLOT_SEEDS_KEY, [seed, seed + 1, seed + 2]);
  }
  havenOrderFillerListeners.forEach((listener) => listener());
}

export function advanceHavenOrderFillerSlotSeed(slotIndex: number): void {
  if (!isDevBuild() || !Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= 3) return;
  const current = [...getHavenOrderFillerSlotSeeds()] as [number, number, number];
  current[slotIndex] = Math.max(Date.now(), current[slotIndex] + 1);
  setStoredJson(HAVEN_ORDER_FILLER_SLOT_SEEDS_KEY, current);
  havenOrderFillerListeners.forEach((listener) => listener());
}

export function subscribeHavenOrderFillers(listener: () => void): () => void {
  havenOrderFillerListeners.add(listener);
  return () => havenOrderFillerListeners.delete(listener);
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
