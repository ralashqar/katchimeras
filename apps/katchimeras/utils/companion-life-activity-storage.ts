import { getStoredJson, getStoredKeys, setStoredJson } from '@/utils/app-storage';
import { companionIdForFamily } from '@/constants/katchimera-skins';
import { companionDailyConfig } from '@/constants/companion-daily/registry';
import { COMPANION_BOND_REWARDS, recordCompanionBondEvent, acknowledgeCompanionBondCelebration, type CompanionBondAwardReceipt } from '@/utils/companion-bond';
import { loadCompanionBondState, saveCompanionBondState } from '@/utils/companion-bond-storage';
import { rememberCompanionMoment } from '@/utils/companion-life-storage';
import { localDayId } from '@/utils/world-identity-rules';
import type { KatchimeraFamilyId } from '@/types/katchimera';
import type { LifeCompanionFamily } from '@/constants/companion-life-content';
import type { CompanionPhotoMatch } from '@/types/companion-daily';
import type { ClassifiedMemory, DayEvidence, DayVisionSummary } from '@/types/home';

/**
 * A friend's daily life activities: a photo shown to them and one small
 * thing noticed, once a day each, worth Bond once. One store per friend
 * (`companion:<family>-life-activities:v1`; Mossprout's key and ids are the
 * ones he always had), and one capture in flight per friend, begun by the
 * card and finished by the camera. What a photo is graded against and
 * whether it is kept come from the friend's daily config.
 */
import { companionLifeActivityId, companionLifeActivityKey, type CompanionLifeActivity } from '@/utils/companion-life-activity-ids';

export { companionLifeActivityId, companionLifeActivityKey, type CompanionLifeActivity };
export type CompanionLifePhoto = {
  uri: string; capturedAt: number; memory: ClassifiedMemory; evidence: DayEvidence;
  vision: DayVisionSummary | null; match: CompanionPhotoMatch; categoryId?: string | null; confirmedSubject?: string;
};
export type CompanionLifeCompletion = {
  id: string; companion: string; kind: CompanionLifeActivity; dayId: string; occurredAt: number;
  answer: string; response: string; photo?: CompanionLifePhoto;
  status: 'pending' | 'complete'; receipt?: CompanionBondAwardReceipt; presentedAt?: number;
};
export type CompanionLifeCapture = { id: string; phase: 'capturing' | 'ready'; photo?: CompanionLifePhoto; error?: string };
type ActivityState = { version: 1; completions: Record<string, CompanionLifeCompletion>; capture: CompanionLifeCapture | null };

const KEY_PATTERN = /^companion:([a-z-]+)-life-activities:v1$/;
const listeners = new Set<(reset?: boolean) => void>();
let resetGeneration = 0;
const empty = (): ActivityState => ({ version: 1, completions: {}, capture: null });

export function loadCompanionLifeActivities(companion: string): ActivityState {
  const value = getStoredJson<ActivityState | null>(companionLifeActivityKey(companion), null);
  if (value?.version !== 1 || !value.completions) return empty();
  // Records from before the store was shared name no friend; they are this store's.
  for (const completion of Object.values(value.completions)) if (!completion.companion) completion.companion = companion;
  return value;
}
function save(companion: string, state: ActivityState) { setStoredJson(companionLifeActivityKey(companion), state); listeners.forEach((listener) => listener()); }
export function subscribeCompanionLifeActivities(listener: (reset?: boolean) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function resetCompanionLifeActivities(companion: string) {
  setStoredJson(companionLifeActivityKey(companion), empty());
  resetGeneration++;
  inFlight.clear();
  listeners.forEach((listener) => listener(true));
}
/** Every friend's store, whoever has one: a profile reset. */
export function resetAllCompanionLifeActivities() {
  const companions = new Set<string>(['mossprout']);
  try { for (const key of getStoredKeys()) { const match = KEY_PATTERN.exec(key); if (match) companions.add(match[1]!); } } catch { /* the known store still resets */ }
  for (const companion of companions) setStoredJson(companionLifeActivityKey(companion), empty());
  resetGeneration++;
  inFlight.clear();
  listeners.forEach((listener) => listener(true));
}
export function beginCompanionLifeCapture(companion: string, now = Date.now()) {
  cancelCompanionLifeCapture(companion);
  const capture: CompanionLifeCapture = { id: `${companion}-photo:${now}:${Math.random().toString(36).slice(2, 10)}`, phase: 'capturing' };
  save(companion, { ...loadCompanionLifeActivities(companion), capture }); return capture;
}
export function finishCompanionLifeCapture(companion: string, id: string, photo?: CompanionLifePhoto, error?: string) {
  const state = loadCompanionLifeActivities(companion);
  if (state.capture?.id !== id) return;
  save(companion, { ...state, capture: { id, phase: 'ready', photo, error } });
}
export function cancelCompanionLifeCapture(companion: string, id?: string) {
  const state = loadCompanionLifeActivities(companion);
  if (!state.capture || (id && state.capture.id !== id)) return;
  save(companion, { ...state, capture: null });
  const uri = state.capture.photo?.uri;
  const directory = companionDailyConfig(companion)?.photo?.keepPhoto?.directory;
  if (uri && directory && !Object.values(state.completions).some((item) => item.photo?.uri === uri)) {
    void import('./companion-life-photo').then((module) => module.discardCompanionLifePhoto(uri, directory)).catch(() => {});
  }
}
export function prepareCompanionLifeCompletion(companion: string, input: { kind: CompanionLifeActivity; answer: string; response: string; photo?: CompanionLifePhoto }, now = Date.now()) {
  const occurredAt = input.photo?.capturedAt ?? now;
  const dayId = localDayId(new Date(occurredAt));
  const id = companionLifeActivityId(companion, dayId, input.kind);
  const state = loadCompanionLifeActivities(companion);
  if (state.completions[id]) return state.completions[id];
  const completion: CompanionLifeCompletion = { ...input, companion, occurredAt, dayId, id, status: 'pending' };
  save(companion, { ...state, completions: { ...state.completions, [id]: completion } });
  return completion;
}
const inFlight = new Map<string, Promise<CompanionLifeCompletion>>();
export function commitCompanionLifeCompletion(companion: string, id: string): Promise<CompanionLifeCompletion> {
  const existing = inFlight.get(id); if (existing) return existing;
  const work = commit(companion, id).finally(() => { if (inFlight.get(id) === work) inFlight.delete(id); }); inFlight.set(id, work); return work;
}
async function commit(companion: string, id: string) {
  const generation = resetGeneration;
  const completion = loadCompanionLifeActivities(companion).completions[id];
  if (!completion) throw new Error('Activity unavailable');
  if (completion.status === 'complete') return completion;
  const config = companionDailyConfig(companion);
  const keepPhoto = config?.photo?.keepPhoto ?? null;
  if (completion.photo && keepPhoto) {
    const { saveCompanionPhotoMemory } = await import('./companion-photo-memory');
    if (generation !== resetGeneration) throw new Error('Activity was reset');
    await saveCompanionPhotoMemory(completion, keepPhoto);
  }
  if (generation !== resetGeneration) throw new Error('Activity was reset');
  const title = completion.kind === 'photo' ? config?.photo?.title ?? 'A photo shared' : config?.notice?.title ?? 'One small thing noticed';
  rememberCompanionMoment({ id, familyId: companion as LifeCompanionFamily, kind: 'activity', title,
    createdAt: completion.occurredAt, updatedAt: completion.occurredAt,
    facts: { noticed: completion.answer, response: completion.response },
    // A photo that was not kept lives in the camera roll; the journal remembers the moment, not a file.
    photo: completion.photo && keepPhoto ? { uri: completion.photo.uri, memoryId: completion.photo.memory.id, confirmedSubject: completion.photo.confirmedSubject } : undefined,
  });
  const bond = loadCompanionBondState();
  const award = recordCompanionBondEvent(bond, { id, kind: 'life_activity_completed', creatureId: companionIdForFamily(companion as KatchimeraFamilyId),
    occurredAt: completion.occurredAt, dayId: completion.dayId, points: COMPANION_BOND_REWARDS.life_activity_completed }, { queueCelebration: true });
  const receipt = award.receipt ?? bond.pendingCelebrations?.find((item) => item.eventId === id);
  if (award.awarded) saveCompanionBondState(award.state);
  const done: CompanionLifeCompletion = { ...completion, status: 'complete', receipt };
  const state = loadCompanionLifeActivities(companion);
  save(companion, { ...state, completions: { ...state.completions, [id]: done }, capture: completion.photo?.uri === state.capture?.photo?.uri ? null : state.capture });
  return done;
}
export function acknowledgeCompanionLifeCompletion(companion: string, id: string, now = Date.now()) {
  const state = loadCompanionLifeActivities(companion); const completion = state.completions[id];
  if (!completion || completion.status !== 'complete' || completion.presentedAt) return;
  if (completion.receipt) saveCompanionBondState(acknowledgeCompanionBondCelebration(loadCompanionBondState(), completion.receipt.id));
  save(companion, { ...state, completions: { ...state.completions, [id]: { ...completion, presentedAt: now } } });
}
