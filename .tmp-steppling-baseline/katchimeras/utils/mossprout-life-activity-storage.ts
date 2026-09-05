import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import { companionIdForFamily } from '@/constants/katchimera-skins';
import { COMPANION_BOND_REWARDS, recordCompanionBondEvent, acknowledgeCompanionBondCelebration, type CompanionBondAwardReceipt } from '@/utils/companion-bond';
import { loadCompanionBondState, saveCompanionBondState } from '@/utils/companion-bond-storage';
import { rememberCompanionMoment } from '@/utils/companion-life-storage';
import { localDayId } from '@/utils/world-identity-rules';
import { MOSSPROUT_LIFE_TITLES, mossproutLifeActivityId, type MossproutLifeActivity, type NaturePhotoMatch } from './mossprout-life-activities';
import type { ClassifiedMemory, DayEvidence, DayVisionSummary } from '@/types/home';

export type MossproutNaturePhoto = {
  uri: string; capturedAt: number; memory: ClassifiedMemory; evidence: DayEvidence;
  vision: DayVisionSummary | null; match: NaturePhotoMatch; confirmedSubject?: string;
};
export type MossproutLifeCompletion = {
  id: string; kind: MossproutLifeActivity; dayId: string; occurredAt: number;
  answer: string; response: string; photo?: MossproutNaturePhoto;
  status: 'pending' | 'complete'; receipt?: CompanionBondAwardReceipt; presentedAt?: number;
};
export type MossproutNatureCapture = { id: string; phase: 'capturing' | 'ready'; photo?: MossproutNaturePhoto; error?: string };
type ActivityState = { version: 1; completions: Record<string, MossproutLifeCompletion>; capture: MossproutNatureCapture | null };
const KEY = 'companion:mossprout-life-activities:v1';
const listeners = new Set<(reset?: boolean) => void>();
let resetGeneration = 0;
export function loadMossproutLifeActivities(): ActivityState {
  const value = getStoredJson<ActivityState | null>(KEY, null);
  return value?.version === 1 && value.completions ? value : { version: 1, completions: {}, capture: null };
}
function save(state: ActivityState) { setStoredJson(KEY, state); listeners.forEach((listener) => listener()); }
export function subscribeMossproutLifeActivities(listener: (reset?: boolean) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function resetMossproutLifeActivities() {
  setStoredJson(KEY, { version: 1, completions: {}, capture: null });
  resetGeneration++;
  inFlight.clear();
  listeners.forEach((listener) => listener(true));
}
export function beginMossproutNatureCapture(now = Date.now()) {
  cancelMossproutNatureCapture();
  const capture: MossproutNatureCapture = { id: `mossprout-nature:${now}:${Math.random().toString(36).slice(2, 10)}`, phase: 'capturing' };
  save({ ...loadMossproutLifeActivities(), capture }); return capture;
}
export function finishMossproutNatureCapture(id: string, photo?: MossproutNaturePhoto, error?: string) {
  const state = loadMossproutLifeActivities();
  if (state.capture?.id !== id) return;
  save({ ...state, capture: { id, phase: 'ready', photo, error } });
}
export function cancelMossproutNatureCapture(id?: string) {
  const state = loadMossproutLifeActivities();
  if (!state.capture || (id && state.capture.id !== id)) return;
  save({ ...state, capture: null });
  const uri = state.capture.photo?.uri;
  if (uri && !Object.values(state.completions).some((item) => item.photo?.uri === uri)) {
    void import('./mossprout-nature-capture').then((module) => module.discardMossproutNaturePhoto(uri)).catch(() => {});
  }
}
export function prepareMossproutLifeCompletion(input: { kind: MossproutLifeActivity; answer: string; response: string; photo?: MossproutNaturePhoto }, now = Date.now()) {
  const occurredAt = input.photo?.capturedAt ?? now;
  const dayId = localDayId(new Date(occurredAt));
  const id = mossproutLifeActivityId(dayId, input.kind);
  const state = loadMossproutLifeActivities();
  if (state.completions[id]) return state.completions[id];
  const completion: MossproutLifeCompletion = { ...input, occurredAt, dayId, id, status: 'pending' };
  save({ ...state, completions: { ...state.completions, [id]: completion } });
  return completion;
}
const inFlight = new Map<string, Promise<MossproutLifeCompletion>>();
export function commitMossproutLifeCompletion(id: string): Promise<MossproutLifeCompletion> {
  const existing = inFlight.get(id); if (existing) return existing;
  const work = commit(id).finally(() => { if (inFlight.get(id) === work) inFlight.delete(id); }); inFlight.set(id, work); return work;
}
async function commit(id: string) {
  const generation = resetGeneration;
  const completion = loadMossproutLifeActivities().completions[id];
  if (!completion) throw new Error('Activity unavailable');
  if (completion.status === 'complete') return completion;
  if (completion.photo) {
    const { saveMossproutPhotoMemory } = await import('./mossprout-photo-memory');
    if (generation !== resetGeneration) throw new Error('Activity was reset');
    await saveMossproutPhotoMemory(completion);
  }
  if (generation !== resetGeneration) throw new Error('Activity was reset');
  rememberCompanionMoment({ id, familyId: 'mossprout', kind: 'activity', title: MOSSPROUT_LIFE_TITLES[completion.kind],
    createdAt: completion.occurredAt, updatedAt: completion.occurredAt,
    facts: { noticed: completion.answer, response: completion.response },
    photo: completion.photo ? { uri: completion.photo.uri, memoryId: completion.photo.memory.id, confirmedSubject: completion.photo.confirmedSubject } : undefined,
  });
  const bond = loadCompanionBondState();
  const award = recordCompanionBondEvent(bond, { id, kind: 'life_activity_completed', creatureId: companionIdForFamily('mossprout'),
    occurredAt: completion.occurredAt, dayId: completion.dayId, points: COMPANION_BOND_REWARDS.life_activity_completed }, { queueCelebration: true });
  const receipt = award.receipt ?? bond.pendingCelebrations?.find((item) => item.eventId === id);
  if (award.awarded) saveCompanionBondState(award.state);
  const done: MossproutLifeCompletion = { ...completion, status: 'complete', receipt };
  const state = loadMossproutLifeActivities();
  save({ ...state, completions: { ...state.completions, [id]: done }, capture: completion.photo?.uri === state.capture?.photo?.uri ? null : state.capture });
  return done;
}
export function acknowledgeMossproutLifeCompletion(id: string, now = Date.now()) {
  const state = loadMossproutLifeActivities(); const completion = state.completions[id];
  if (!completion || completion.status !== 'complete' || completion.presentedAt) return;
  if (completion.receipt) saveCompanionBondState(acknowledgeCompanionBondCelebration(loadCompanionBondState(), completion.receipt.id));
  save({ ...state, completions: { ...state.completions, [id]: { ...completion, presentedAt: now } } });
}
