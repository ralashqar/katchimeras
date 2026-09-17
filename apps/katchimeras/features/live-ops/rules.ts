import { DEFAULT_HARMONY } from './local-catalog';
import type { HarmonyDefinition } from '@/types/local-live-ops';
import type { GameplayEvent } from '@/types/gameplay-event';
import type { HarmonyState, LiveEventDefinition, LiveEventProgress } from '@/types/live-ops';

export const emptyHarmony = (): HarmonyState => ({ version: 1, points: 0, milestones: {} });

/** Stable milestone receipts prevent replay and backfill from inflating world progress. */
export function applyHarmonyEvent(state: HarmonyState, event: GameplayEvent, definition: HarmonyDefinition = DEFAULT_HARMONY): HarmonyState {
  const points = definition.awards[event.kind];
  if (!points || !event.context.targetId) return state;
  const key = JSON.stringify([event.kind, event.context.targetId, event.context.level ?? 0]);
  if (Object.hasOwn(state.milestones, key)) return state;
  return { version: 1, points: state.points + points, milestones: { ...state.milestones, [key]: points } };
}

export function eventPhase(event: LiveEventDefinition, now: number): 'disabled' | 'upcoming' | 'active' | 'claim' | 'ended' {
  if (!event.enabled) return 'disabled';
  if (now < Date.parse(event.startsAt)) return 'upcoming';
  if (now < Date.parse(event.endsAt)) return 'active';
  if (now < Date.parse(event.claimEndsAt)) return 'claim';
  return 'ended';
}

export function emptyEventProgress(event: LiveEventDefinition): LiveEventProgress {
  return { eventId: event.id, definitionVersion: event.version, points: 0, ruleCounts: {} };
}

/** The repository deduplicates event IDs transactionally before calling this projection. */
export function scoreGameplayEvent(progress: LiveEventProgress, definition: LiveEventDefinition, event: GameplayEvent): LiveEventProgress {
  if (progress.eventId !== definition.id || progress.definitionVersion !== definition.version) throw new Error('Event definition changed during a run');
  if (event.historical || eventPhase(definition, event.occurredAt) !== 'active' || !Number.isSafeInteger(event.quantity) || event.quantity < 1) return progress;
  let points = progress.points;
  const ruleCounts = { ...progress.ruleCounts };
  for (const rule of definition.rules) {
    if (rule.kind !== event.kind) continue;
    const filter = rule.filter;
    if (filter?.companionId && filter.companionId !== event.context.companionId) continue;
    if (filter?.regionId && filter.regionId !== event.context.regionId) continue;
    if (filter?.targetId && filter.targetId !== event.context.targetId) continue;
    if (filter?.minItemTier && (event.context.itemTier ?? 0) < filter.minItemTier) continue;
    if (filter?.tags?.some((tag) => !event.context.tags?.includes(tag))) continue;
    const count = Object.hasOwn(ruleCounts, rule.id) ? ruleCounts[rule.id]! : 0;
    const amount = Math.min(event.quantity, Math.max(0, rule.limit - count));
    Object.defineProperty(ruleCounts, rule.id, { value: count + amount, enumerable: true, writable: true, configurable: true });
    points += amount * rule.points;
  }
  return points === progress.points ? progress : { ...progress, points, ruleCounts };
}

/** Incursions are a view over permanent hex state, never a mutation of restoration. */
export function activeIncursionNodes(definition: LiveEventDefinition, clearedNodeIds: ReadonlySet<string>, now: number) {
  return eventPhase(definition, now) === 'active' ? (definition.incursion?.nodes ?? []).filter((node) => !clearedNodeIds.has(node.id)) : [];
}
