import type { MergeWorldState, MergeWorldCommandResult } from '@/types/merge-world';
import { GLOW_GATEWAY_ID, reduceGlowDiscovery } from '@/utils/merge-world/glow-discovery-policy';

export const STEPPLING_EGG_GUIDES = {
  intent: { eyebrow: 'A new little friend', title: 'This one stirs at the thought of adventure.', body: '' },
  reading: { eyebrow: 'A little wobble', title: 'Did it move when you did?', body: '' },
  steps: { eyebrow: 'Yesterday’s steps', title: 'Looks like your steps help wake it up.', body: '' },
  movement: { eyebrow: 'Your own rhythm', title: 'There’s more than one way to move it.', body: '' },
  ready: { eyebrow: 'Ready to meet you', title: 'Those little moments woke someone up.', body: '' },
} as const;

export const STEPPLING_EGG_TARGET = 500;
export const STEPPLING_STEPS_PER_BOND = 300;
const safeSteps = (steps: number) => Number.isFinite(steps) ? Math.max(0, Math.floor(steps)) : 0;
export const stepplingStepsBond = (steps: number) => Math.ceil(safeSteps(steps) / STEPPLING_STEPS_PER_BOND);

/** Round the cumulative total, not each tap, so partial feeds cannot farm Bond. */
export function stepplingStepFeedOffer(egg: StepplingEggProgress | undefined, observedSteps: number) {
  const previous = safeSteps(egg?.bondFedSteps ?? egg?.fedSteps ?? 0);
  const total = Math.max(previous, safeSteps(observedSteps));
  return { steps: total - previous, bond: stepplingStepsBond(total) - stepplingStepsBond(previous) };
}
export const STEPPLING_INTENT_BOND = 10;
export const STEPPLING_MOVEMENT_BOND = 20;
export const STEPPLING_INTENT_OPTIONS = [
  { id: 'breaks', label: 'Little movement breaks' },
  { id: 'exploring', label: 'Fresh air and exploring' },
  { id: 'own-pace', label: 'Moving at my own pace' },
] as const;
export const STEPPLING_MOVEMENT_OPTIONS = [
  { id: 'walk', label: 'A little walk' },
  { id: 'adapted', label: 'A stretch or seated movement' },
  { id: 'rest', label: 'Rest and a slower day' },
] as const;
export type StepplingEggProgress = {
  sourceDayId: string;
  intent: string | null;
  fedSteps: number;
  /** Full observed total explicitly fed for Bond; hatch progress stays capped at 500. */
  bondFedSteps?: number;
  alternative: string | null;
  hatchStartedAt: number | null;
  hatchedAt: number | null;
};
export type StepplingEggAction =
  | { kind: 'begin'; sourceDayId: string }
  | { kind: 'intent'; answer: string }
  | { kind: 'feed'; sourceDayId: string; observedSteps: number }
  | { kind: 'alternative'; answer: string }
  | { kind: 'hatch' }
  | { kind: 'finish' };
export const stepplingEggReady = (egg?: StepplingEggProgress) => Boolean(egg && (egg.fedSteps >= STEPPLING_EGG_TARGET || egg.alternative));

export function normalizeStepplingEgg(raw: StepplingEggProgress | undefined): StepplingEggProgress | undefined {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw.sourceDayId)) return undefined;
  const date = new Date(`${raw.sourceDayId}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== raw.sourceDayId) return undefined;
  const intent = STEPPLING_INTENT_OPTIONS.some((option) => option.id === raw.intent) ? raw.intent : null;
  const alternative = STEPPLING_MOVEMENT_OPTIONS.some((option) => option.id === raw.alternative) ? raw.alternative : null;
  const fedSteps = Number.isFinite(raw.fedSteps) ? Math.max(0, Math.min(STEPPLING_EGG_TARGET, Math.floor(raw.fedSteps))) : 0;
  const ready = Boolean(intent && (alternative || fedSteps >= STEPPLING_EGG_TARGET));
  const validTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
  return { sourceDayId: raw.sourceDayId, intent, alternative, fedSteps,
    bondFedSteps: Math.max(fedSteps, safeSteps(raw.bondFedSteps ?? fedSteps)),
    hatchStartedAt: ready && validTime(raw.hatchStartedAt) ? raw.hatchStartedAt : null,
    hatchedAt: ready && validTime(raw.hatchedAt) ? raw.hatchedAt : null };
}

/** Steps are explicitly fed, never inferred from the legacy observed-step field. */
export function reduceStepplingEgg(state: MergeWorldState, action: StepplingEggAction, now: number): MergeWorldCommandResult {
  const no = (message?: string) => ({ state, changed: false, message });
  if (!state.worldUnlocks?.[GLOW_GATEWAY_ID]) return no('Clear the mist first.');
  if (state.companionDiscovery.records.some((record) => record.characterId === 'steppling')) return no();
  let egg = state.stepplingEgg;
  if (action.kind === 'begin') {
    if (egg) return no();
    egg = normalizeStepplingEgg({ sourceDayId: action.sourceDayId, intent: null, fedSteps: 0, alternative: null, hatchStartedAt: null, hatchedAt: null });
    if (!egg) return no('The source day is invalid.');
  } else {
    if (!egg) return no('Open the Egg first.');
    if (action.kind === 'intent') {
      if (egg.intent || !STEPPLING_INTENT_OPTIONS.some((option) => option.id === action.answer)) return no();
      egg = { ...egg, intent: action.answer };
    } else if (action.kind === 'feed') {
      if (!egg.intent || egg.hatchStartedAt || action.sourceDayId !== egg.sourceDayId || !Number.isFinite(action.observedSteps)) return no();
      const fedSteps = Math.max(egg.fedSteps, Math.min(STEPPLING_EGG_TARGET, Math.max(0, Math.floor(action.observedSteps))));
      if (fedSteps === egg.fedSteps) return no();
      egg = { ...egg, fedSteps, bondFedSteps: Math.max(egg.bondFedSteps ?? egg.fedSteps, safeSteps(action.observedSteps)) };
    } else if (action.kind === 'alternative') {
      if (!egg.intent || egg.hatchStartedAt || egg.alternative || !STEPPLING_MOVEMENT_OPTIONS.some((option) => option.id === action.answer)) return no();
      egg = { ...egg, alternative: action.answer };
    } else if (action.kind === 'hatch') {
      if (!egg.intent || !stepplingEggReady(egg) || egg.hatchStartedAt) return no();
      egg = { ...egg, hatchStartedAt: now };
    } else {
      if (!egg.hatchStartedAt || !stepplingEggReady(egg)) return no('This Egg is not ready yet.');
      const transferred = reduceGlowDiscovery(state, { type: 'transferDiscoveryEgg', targetId: GLOW_GATEWAY_ID, now });
      const hatched = reduceGlowDiscovery(transferred.state, { type: 'hatchWorldEgg', targetId: GLOW_GATEWAY_ID, now });
      return { ...hatched, state: { ...hatched.state, stepplingEgg: { ...egg, hatchedAt: now } } };
    }
  }
  return { state: { ...state, stepplingEgg: egg, revision: state.revision + 1, updatedAt: now }, changed: true };
}
