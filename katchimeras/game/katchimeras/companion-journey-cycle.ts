import type { CompanionJourneyCycle, JourneyParticipation } from '@/types/companion-journey-cycle';
import type { RelationshipProgressState } from '@/types/relationship-progression';
import { COMPANION_JOURNEY_PROFILES, JOURNEY_MEDITATION_ORDER_MINUTES } from '@/constants/companion-journey-profiles';

export const JOURNEY_REST_MS = 8 * 60 * 60 * 1000;
export const JOURNEY_ACCELERATION_CAP_MS = 2 * 60 * 60 * 1000;
export const JOURNEY_STEP_TARGET = 500;

export function currentJourneyCycle(state: RelationshipProgressState, familyId: string) {
  return [...(state.journeyCycles ?? [])].reverse().find((cycle) => cycle.familyId === familyId) ?? null;
}

export function createJourneyCycle(input: Pick<CompanionJourneyCycle, 'id' | 'familyId' | 'episodeId' | 'number' | 'chapterId' | 'title' | 'nextTitle' | 'completedAt' | 'finale'> & {
  participation?: JourneyParticipation;
  stepBaselines?: Record<string, number>;
}): CompanionJourneyCycle {
  const profile = COMPANION_JOURNEY_PROFILES[input.familyId];
  if (!profile) throw new Error(`Journey content has not been authored for ${input.familyId}`);
  const prefix = profile.mergeChainId;
  return {
    ...input, participation: input.participation ?? 'not_yet',
    stepBaselines: input.stepBaselines ?? {}, observedSteps: {}, stepProgress: 0,
    returnStartedAt: null, returnedAt: null, rewardId: `${input.id}:return-gift`,
    requests: [
      ...[1, 2].map((tier) => ({
        id: `${input.id}:request:${tier}`, kind: 'merge' as const,
        title: profile.requestTitles[tier - 1],
        definitionId: `${prefix}:${tier}`, orderId: `${input.id}:request:${tier}`,
        reductionMs: JOURNEY_MEDITATION_ORDER_MINUTES * 60 * 1000, completedAt: null, evidenceId: null,
      })),
      { id: `${input.id}:request:life`, kind: 'life',
        title: profile.lifeRequest,
        reductionMs: 60 * 60 * 1000, completedAt: null, evidenceId: null },
    ],
  };
}

export function installJourneyCycle(state: RelationshipProgressState, cycle: CompanionJourneyCycle): RelationshipProgressState {
  if (state.journeyCycles?.some((item) => item.id === cycle.id)) return state;
  const current = currentJourneyCycle(state, cycle.familyId);
  if (current && !current.returnedAt) return state;
  const existingRest = state.meditations?.find((item) => item.familyId === cycle.familyId && item.startedAt >= cycle.completedAt);
  return {
    ...state, journeyCycles: [...(state.journeyCycles ?? []), cycle],
    meditations: [...(state.meditations ?? []).filter((item) => item.familyId !== cycle.familyId), {
      ...(existingRest ?? { familyId: cycle.familyId, startedAt: cycle.completedAt, availableAt: cycle.completedAt + JOURNEY_REST_MS, reason: 'journey_rest' as const, settledMs: 0, settlementReceiptIds: [] }),
      sourceId: existingRest?.sourceId ?? cycle.id, cycleId: cycle.id,
    }],
  };
}

export function journeyCycleReady(state: RelationshipProgressState, cycle: CompanionJourneyCycle, now: number) {
  const rest = state.meditations?.find((item) => item.familyId === cycle.familyId && (item.cycleId ?? item.sourceId) === cycle.id);
  return now >= (rest?.availableAt ?? cycle.completedAt + JOURNEY_REST_MS);
}

export function completeMeditationRequest(state: RelationshipProgressState, cycleId: string, requestId: string, evidenceId: string, occurredAt: number, participation?: JourneyParticipation): RelationshipProgressState {
  const cycle = state.journeyCycles?.find((item) => item.id === cycleId);
  const request = cycle?.requests.find((item) => item.id === requestId);
  if (!cycle || !request || request.completedAt != null || !evidenceId || !Number.isFinite(occurredAt) || cycle.returnStartedAt != null || cycle.returnedAt != null || occurredAt < cycle.completedAt || journeyCycleReady(state, cycle, occurredAt)) return state;
  if (cycle.requests.some((item) => item.evidenceId === evidenceId)) return state;
  return {
    ...state,
    journeyCycles: state.journeyCycles!.map((item) => item.id !== cycleId ? item : {
      ...item, participation: participation ?? item.participation,
      requests: item.requests.map((candidate) => candidate.id !== requestId ? candidate : { ...candidate, reductionMs: candidate.kind === 'merge' ? JOURNEY_MEDITATION_ORDER_MINUTES * 60 * 1000 : candidate.reductionMs, completedAt: occurredAt, evidenceId }),
    }),
    meditations: (state.meditations ?? []).map((rest) => {
      if ((rest.cycleId ?? rest.sourceId) !== cycleId) return rest;
      const applied = Math.min(request.kind === 'merge' ? JOURNEY_MEDITATION_ORDER_MINUTES * 60 * 1000 : request.reductionMs, Math.max(0, JOURNEY_ACCELERATION_CAP_MS - (rest.settledMs ?? 0)), Math.max(0, rest.availableAt - occurredAt));
      return { ...rest, availableAt: rest.availableAt - applied, settledMs: (rest.settledMs ?? 0) + applied,
        settlementReceiptIds: [...(rest.settlementReceiptIds ?? []), evidenceId] };
    }),
  };
}

/** Aggregates remain bound to their source date. A first reading establishes a
 * baseline if it cannot safely be attributed to this meditation. */
export function observeJourneySteps(state: RelationshipProgressState, cycleId: string, dayId: string, steps: number, measuredAt: number, dayStartedAt: number): RelationshipProgressState {
  const cycle = state.journeyCycles?.find((item) => item.id === cycleId);
  if (!cycle || cycle.familyId !== 'steppling' || cycle.returnedAt != null || !Number.isFinite(measuredAt) || !Number.isFinite(dayStartedAt) || measuredAt < cycle.completedAt || !Number.isFinite(steps) || steps < 0 || journeyCycleReady(state, cycle, measuredAt)) return state;
  const highest = Math.max(cycle.observedSteps[dayId] ?? 0, Math.floor(steps));
  const baseline = cycle.stepBaselines[dayId] ?? (dayStartedAt >= cycle.completedAt ? 0 : highest);
  if (cycle.observedSteps[dayId] === highest && cycle.stepBaselines[dayId] != null) return state;
  const observedSteps = { ...cycle.observedSteps, [dayId]: highest };
  const stepBaselines = { ...cycle.stepBaselines, [dayId]: baseline };
  const stepProgress = Math.min(JOURNEY_STEP_TARGET, Math.max(cycle.stepProgress, Object.entries(observedSteps).reduce((sum, [day, total]) => sum + Math.max(0, total - (stepBaselines[day] ?? total)), 0)));
  const next = { ...state, journeyCycles: state.journeyCycles!.map((item) => item.id !== cycleId ? item : { ...item, observedSteps, stepBaselines, stepProgress }) };
  const request = cycle.requests.find((item) => item.kind === 'life');
  return stepProgress >= JOURNEY_STEP_TARGET && request
    ? completeMeditationRequest(next, cycleId, request.id, `${cycleId}:steps`, measuredAt, 'walk') : next;
}

/** A pedometer window starts at this exact meditation, so it needs no calendar
 * baseline. Its total overlaps stored daily aggregates; take the maximum,
 * never add the two sources together. */
export function observeJourneyStepWindow(state: RelationshipProgressState, cycleId: string, steps: number, now: number): RelationshipProgressState {
  const cycle = state.journeyCycles?.find((item) => item.id === cycleId);
  if (!cycle || cycle.familyId !== 'steppling' || !Number.isFinite(steps) || steps < 0 || !Number.isFinite(now) || now < cycle.completedAt || cycle.returnedAt != null || journeyCycleReady(state, cycle, now)) return state;
  const stepProgress = Math.min(JOURNEY_STEP_TARGET, Math.max(cycle.stepProgress, Math.floor(steps)));
  if (stepProgress === cycle.stepProgress) return state;
  const next = { ...state, journeyCycles: state.journeyCycles!.map((item) => item.id === cycleId ? { ...item, stepProgress } : item) };
  const request = cycle.requests.find((item) => item.kind === 'life');
  return stepProgress >= JOURNEY_STEP_TARGET && request ? completeMeditationRequest(next, cycleId, request.id, `${cycleId}:steps`, now, 'walk') : next;
}

export function finishJourneyReturn(state: RelationshipProgressState, cycleId: string, now: number): RelationshipProgressState {
  const cycle = state.journeyCycles?.find((item) => item.id === cycleId);
  if (!cycle || cycle.returnedAt != null || !journeyCycleReady(state, cycle, now)) return state;
  return { ...state, journeyCycles: state.journeyCycles!.map((item) => item.id !== cycleId ? item : { ...item, returnStartedAt: item.returnStartedAt ?? now, returnedAt: now }) };
}

export function beginJourneyReturnPresentation(state: RelationshipProgressState, cycleId: string, now: number): RelationshipProgressState {
  const cycle = state.journeyCycles?.find((item) => item.id === cycleId);
  if (!cycle || cycle.returnStartedAt != null || cycle.returnedAt != null || !journeyCycleReady(state, cycle, now)) return state;
  return { ...state, journeyCycles: state.journeyCycles!.map((item) => item.id === cycleId ? { ...item, returnStartedAt: now } : item) };
}

export function journeyReturnLine(cycle: CompanionJourneyCycle): string {
  const name = COMPANION_JOURNEY_PROFILES[cycle.familyId]?.worldName ?? 'our little world';
  const callback: Record<JourneyParticipation, string> = {
    walk: `You shared some walking with me. I kept a little of that journey for ${name}.`,
    adapted: `You found a way to move that suited you. There is room for that in ${name}.`,
    rest: `You chose a gentler moment. There is room to pause beside ${name}.`,
    noticed: `You stopped to notice something. I brought that attention back to ${name}.`,
    not_yet: `Welcome back. We can pick up ${name} from right here.`,
  };
  return `${callback[cycle.participation]} ${cycle.nextTitle ? `Next, ${cycle.nextTitle.toLowerCase()}.` : 'This chapter is ours to remember. We can keep spending little moments together.'}`;
}

export function normalizeJourneyCycles(value: unknown): CompanionJourneyCycle[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((item): item is CompanionJourneyCycle => {
    if (!item || typeof item.id !== 'string' || seen.has(item.id) || typeof item.familyId !== 'string' || !Number.isFinite(item.completedAt) || !Array.isArray(item.requests)) return false;
    seen.add(item.id); return true;
  }).map((item) => ({ ...item, participation: ['walk', 'adapted', 'rest', 'noticed', 'not_yet'].includes(item.participation) ? item.participation : 'not_yet',
    stepBaselines: item.stepBaselines ?? {}, observedSteps: item.observedSteps ?? {}, stepProgress: Math.max(0, Math.min(500, item.stepProgress || 0)),
    requests: item.requests.filter((request) => request && typeof request.id === 'string' && (request.kind === 'merge' || request.kind === 'life')).map((request) => request.kind === 'merge' && request.completedAt == null ? { ...request, reductionMs: JOURNEY_MEDITATION_ORDER_MINUTES * 60 * 1000 } : request),
    returnedAt: Number.isFinite(item.returnedAt) ? item.returnedAt : null, returnStartedAt: Number.isFinite(item.returnStartedAt) ? item.returnStartedAt : null,
  }));
}
