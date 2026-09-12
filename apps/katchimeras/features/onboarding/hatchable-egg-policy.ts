import type { MergeWorldCommandResult, MergeWorldState } from '@/types/merge-world';
import type { HatchableCompanionDefinition, HatchableEggPolicy } from '@/types/hatchable-companion';
import { reduceGlowDiscovery } from '@/utils/merge-world/glow-discovery-policy';

/**
 * A hatchable companion's Egg: found under the cleared tile, asked one
 * question, fed with the light its policy names (yesterday's steps, a photo
 * of today's drink, or an answer alone), and hatched. The policy is data on
 * the companion's definition; this module is the same for every friend.
 *
 * `fedSteps` is the progress toward the feed target whatever the feed is: for
 * a photo, one matching photo fills it; for an answer-only Egg it stays zero
 * and the alternative answer readies it.
 */
export type HatchableEggProgress = {
  sourceDayId: string;
  intent: string | null;
  fedSteps: number;
  /** Full observed total explicitly fed for Bond; hatch progress stays capped at the target. */
  bondFedSteps?: number;
  alternative: string | null;
  hatchStartedAt: number | null;
  hatchedAt: number | null;
};
export type HatchableEggAction =
  | { kind: 'begin'; sourceDayId: string }
  | { kind: 'intent'; answer: string }
  | { kind: 'feed'; sourceDayId: string; observedSteps: number }
  | { kind: 'alternative'; answer: string }
  | { kind: 'hatch' }
  | { kind: 'finish' };

const safeSteps = (steps: number) => Number.isFinite(steps) ? Math.max(0, Math.floor(steps)) : 0;

/** The feed target: steps to count, or one for a photo; an answer-only Egg has no feed. */
export function eggFeedTarget(policy: HatchableEggPolicy): number {
  return policy.feed.kind === 'steps' ? policy.feed.target : policy.feed.kind === 'photo' ? 1 : 0;
}

/** Bond for a cumulative feed total: steps per Bond, or the photo's Bond once. */
export function eggFeedBond(policy: HatchableEggPolicy, fed: number): number {
  if (policy.feed.kind === 'steps') return Math.ceil(safeSteps(fed) / policy.feed.perBond);
  if (policy.feed.kind === 'photo') return safeSteps(fed) > 0 ? policy.feed.bond : 0;
  return 0;
}

/** Round the cumulative total, not each tap, so partial feeds cannot farm Bond. */
export function eggFeedOffer(policy: HatchableEggPolicy, egg: HatchableEggProgress | undefined, observed: number) {
  const previous = safeSteps(egg?.bondFedSteps ?? egg?.fedSteps ?? 0);
  const total = Math.max(previous, safeSteps(observed));
  return { steps: total - previous, bond: eggFeedBond(policy, total) - eggFeedBond(policy, previous) };
}

// A discovered Egg sleeps until a saved answer/feed gives it its first Bond.
export const hatchableEggHasBeenFed = (egg?: HatchableEggProgress) => Boolean(egg && (egg.intent || egg.fedSteps > 0 || egg.alternative));
export const hatchableEggReady = (policy: HatchableEggPolicy, egg?: HatchableEggProgress) => {
  const target = eggFeedTarget(policy);
  return Boolean(egg && ((target > 0 && egg.fedSteps >= target) || egg.alternative));
};

export function normalizeHatchableEgg(policy: HatchableEggPolicy, raw: HatchableEggProgress | undefined): HatchableEggProgress | undefined {
  if (!raw || typeof raw !== 'object' || typeof raw.sourceDayId !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.sourceDayId)) return undefined;
  const date = new Date(`${raw.sourceDayId}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== raw.sourceDayId) return undefined;
  const intent = policy.intent.options.some((option) => option.id === raw.intent) ? raw.intent : null;
  const alternative = policy.alternative.options.some((option) => option.id === raw.alternative) ? raw.alternative : null;
  const target = eggFeedTarget(policy);
  const fedSteps = Number.isFinite(raw.fedSteps) ? Math.max(0, Math.min(target, Math.floor(raw.fedSteps))) : 0;
  const ready = Boolean(intent && (alternative || (target > 0 && fedSteps >= target)));
  const validTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
  return { sourceDayId: raw.sourceDayId, intent, alternative, fedSteps,
    bondFedSteps: Math.max(fedSteps, safeSteps(raw.bondFedSteps ?? fedSteps)),
    hatchStartedAt: ready && validTime(raw.hatchStartedAt) ? raw.hatchStartedAt : null,
    hatchedAt: ready && validTime(raw.hatchedAt) ? raw.hatchedAt : null };
}

/** A companion's Egg as the world holds it: the map first, Steppling's older field behind it. */
export function hatchableEggProgress(world: Pick<MergeWorldState, 'stepplingEgg' | 'hatchableEggs'>, definition: { companion: string }): HatchableEggProgress | undefined {
  return world.hatchableEggs?.[definition.companion as keyof NonNullable<MergeWorldState['hatchableEggs']>]
    ?? (definition.companion === 'steppling' ? world.stepplingEgg : undefined);
}

/** Writes a companion's Egg, mirroring Steppling's into the field older builds read. */
export function withHatchableEgg(state: MergeWorldState, definition: HatchableCompanionDefinition, egg: HatchableEggProgress | undefined): MergeWorldState {
  const hatchableEggs = { ...state.hatchableEggs };
  if (egg) hatchableEggs[definition.companion] = egg; else delete hatchableEggs[definition.companion];
  return { ...state, hatchableEggs, ...(definition.companion === 'steppling' ? { stepplingEgg: egg } : {}) };
}

/** Feeds are explicitly fed, never inferred from an observed field. */
export function reduceHatchableEgg(state: MergeWorldState, definition: HatchableCompanionDefinition, action: HatchableEggAction, now: number): MergeWorldCommandResult {
  const policy = definition.egg;
  const no = (message?: string) => ({ state, changed: false, message });
  if (!state.worldUnlocks?.[definition.tile.unlockId]) return no('Clear the mist first.');
  if (state.companionDiscovery.records.some((record) => record.characterId === definition.companion)) return no();
  let egg = hatchableEggProgress(state, definition);
  if (action.kind === 'begin') {
    if (egg) return no();
    egg = normalizeHatchableEgg(policy, { sourceDayId: action.sourceDayId, intent: null, fedSteps: 0, alternative: null, hatchStartedAt: null, hatchedAt: null });
    if (!egg) return no('The source day is invalid.');
  } else {
    if (!egg) return no('Open the Egg first.');
    if (action.kind === 'intent') {
      if (egg.intent || !policy.intent.options.some((option) => option.id === action.answer)) return no();
      egg = { ...egg, intent: action.answer };
    } else if (action.kind === 'feed') {
      const target = eggFeedTarget(policy);
      if (!egg.intent || egg.hatchStartedAt || target === 0 || action.sourceDayId !== egg.sourceDayId || !Number.isFinite(action.observedSteps)) return no();
      const fedSteps = Math.max(egg.fedSteps, Math.min(target, safeSteps(action.observedSteps)));
      if (fedSteps === egg.fedSteps) return no();
      egg = { ...egg, fedSteps, bondFedSteps: Math.max(egg.bondFedSteps ?? egg.fedSteps, safeSteps(action.observedSteps)) };
    } else if (action.kind === 'alternative') {
      if (!egg.intent || egg.hatchStartedAt || egg.alternative || !policy.alternative.options.some((option) => option.id === action.answer)) return no();
      egg = { ...egg, alternative: action.answer };
    } else if (action.kind === 'hatch') {
      if (!egg.intent || !hatchableEggReady(policy, egg) || egg.hatchStartedAt) return no();
      egg = { ...egg, hatchStartedAt: now };
    } else {
      if (!egg.hatchStartedAt || !hatchableEggReady(policy, egg)) return no('This Egg is not ready yet.');
      const transferred = reduceGlowDiscovery(state, { type: 'transferDiscoveryEgg', targetId: definition.tile.unlockId, now });
      const hatched = reduceGlowDiscovery(transferred.state, { type: 'hatchWorldEgg', targetId: definition.tile.unlockId, now });
      return { ...hatched, state: withHatchableEgg(hatched.state, definition, { ...egg, hatchedAt: now }) };
    }
  }
  return { state: { ...withHatchableEgg(state, definition, egg), revision: state.revision + 1, updatedAt: now }, changed: true };
}
