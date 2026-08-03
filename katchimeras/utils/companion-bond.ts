import type { CompanionQuestState } from '@/utils/katchimera-quests';
import type { StoredHomeState } from '@/types/home';
import { identityForCreature } from '@/utils/katchimera-identity';
import { questDefinition, type QuestDefinition } from '@/utils/quests/definitions';
import {
  companionIdForFamily,
  familyIdFromCompanionId,
} from '@/constants/katchimera-skins';

export type CompanionBondEventKind =
  | 'hatch'
  | 'real_life_quest_completed'
  | 'mini_game_completed'
  | 'quick_goal_completed'
  | 'discovery_answered'
  | 'quest_completed'
  | 'reflection_saved'
  | 'insight_engaged';

export type CompanionBondEvent = {
  id: string;
  creatureId: string;
  kind: CompanionBondEventKind;
  points: number;
  occurredAt: number;
  dayId?: string | null;
};

export type CompanionBondState = {
  schemaVersion: 1;
  events: CompanionBondEvent[];
};

export type CompanionBondProgress = {
  level: 1 | 2 | 3 | 4;
  label: 'New' | 'Familiar' | 'Devoted' | 'Kindred';
  totalPoints: number;
  segmentPoints: number;
  segmentTarget: number;
  ratio: number;
  nextLevel: 2 | 3 | 4 | null;
  nextLabel: 'Familiar' | 'Devoted' | 'Kindred' | null;
  pointsRemaining: number;
  isMax: boolean;
};

export const COMPANION_BOND_REWARDS: Record<CompanionBondEventKind, number> = {
  hatch: 10,
  real_life_quest_completed: 25,
  mini_game_completed: 10,
  quick_goal_completed: 5,
  discovery_answered: 15,
  // Retained for events created before quest lanes existed.
  quest_completed: 25,
  reflection_saved: 15,
  insight_engaged: 10,
};

export function questBondEventKind(
  definition: Pick<QuestDefinition, 'lane'> | null | undefined
): CompanionBondEventKind {
  return definition?.lane === 'mini_game' ? 'mini_game_completed' : 'real_life_quest_completed';
}

export const COMPANION_BOND_LEVELS = [
  { level: 1, label: 'New', threshold: 0 },
  { level: 2, label: 'Familiar', threshold: 100 },
  { level: 3, label: 'Devoted', threshold: 250 },
  { level: 4, label: 'Kindred', threshold: 500 },
] as const;

export function emptyCompanionBondState(): CompanionBondState {
  return { schemaVersion: 1, events: [] };
}

export function migrateCompanionBondIdentity(
  state: CompanionBondState,
  resolveCompanionId: (value: string) => string
): CompanionBondState {
  let changed = false;
  const events = state.events.map((event) => {
    const creatureId = resolveCompanionId(event.creatureId);
    if (creatureId !== event.creatureId) changed = true;
    return creatureId === event.creatureId ? event : { ...event, creatureId };
  });
  return changed ? normaliseCompanionBondState({ ...state, events }) : state;
}

export function recordCompanionBondEvent(
  state: CompanionBondState,
  event: Omit<CompanionBondEvent, 'points'> & { points?: number }
): { state: CompanionBondState; awarded: boolean; points: number } {
  if (state.events.some((item) => item.id === event.id)) return { state, awarded: false, points: 0 };
  const points = event.points ?? COMPANION_BOND_REWARDS[event.kind];
  const next = normaliseCompanionBondState({
    schemaVersion: 1,
    events: [...state.events, { ...event, points }],
  });
  return { state: next, awarded: true, points };
}

export function removeCompanionBondEvent(
  state: CompanionBondState,
  eventId: string
): { state: CompanionBondState; removed: boolean; points: number } {
  const event = state.events.find((item) => item.id === eventId);
  if (!event) return { state, removed: false, points: 0 };
  return {
    state: normaliseCompanionBondState({
      ...state,
      events: state.events.filter((item) => item.id !== eventId),
    }),
    removed: true,
    points: event.points,
  };
}

export function companionBondProgress(state: CompanionBondState, creatureId: string): CompanionBondProgress {
  const familyId = familyIdFromCompanionId(creatureId);
  const canonicalCreatureId = familyId ? companionIdForFamily(familyId) : creatureId;
  const totalPoints = state.events
    .filter((event) => {
      const eventFamilyId = familyIdFromCompanionId(event.creatureId);
      return (eventFamilyId ? companionIdForFamily(eventFamilyId) : event.creatureId) === canonicalCreatureId;
    })
    .reduce((sum, event) => sum + event.points, 0);
  const current = [...COMPANION_BOND_LEVELS].reverse().find((item) => totalPoints >= item.threshold) ?? COMPANION_BOND_LEVELS[0];
  const next = COMPANION_BOND_LEVELS.find((item) => item.level === current.level + 1) ?? null;
  const segmentTarget = next ? next.threshold - current.threshold : 0;
  const segmentPoints = next ? Math.min(segmentTarget, Math.max(0, totalPoints - current.threshold)) : 0;
  return {
    level: current.level,
    label: current.label,
    totalPoints,
    segmentPoints,
    segmentTarget,
    ratio: next && segmentTarget > 0 ? segmentPoints / segmentTarget : 1,
    nextLevel: (next?.level as 2 | 3 | 4 | undefined) ?? null,
    nextLabel: (next?.label as 'Familiar' | 'Devoted' | 'Kindred' | undefined) ?? null,
    pointsRemaining: next ? Math.max(0, next.threshold - totalPoints) : 0,
    isMax: !next,
  };
}

export function questBondEventId(creatureId: string, questId: string, acceptedAt: number): string {
  return `quest:${creatureId}:${questId}:${acceptedAt}`;
}

export function backfillQuestBondEvents(state: CompanionBondState, quests: CompanionQuestState): CompanionBondState {
  let next = state;
  const completedRows = quests.quests.filter((quest) => typeof quest.completedAt === 'number');
  for (const quest of completedRows) {
    const matchingSubmission = quests.submissions.find((item) => item.creatureId === quest.creatureId && item.questId === quest.questId && item.submittedAt === quest.completedAt);
    const matchingAttempt = quests.attempts.find((item) => item.creatureId === quest.creatureId && item.questId === quest.questId && item.status === 'succeeded' && item.endedAt === quest.completedAt);
    const kind = questBondEventKind(questDefinition(quest.questId));
    next = recordCompanionBondEvent(next, {
      id: matchingSubmission
        ? `quest-submission:${matchingSubmission.id}`
        : matchingAttempt && kind === 'mini_game_completed'
          ? `mini-game:${quest.creatureId}:${matchingAttempt.dayId}`
          : matchingAttempt
            ? `quest-attempt:${matchingAttempt.id}`
            : questBondEventId(quest.creatureId, quest.questId, quest.acceptedAt),
      creatureId: quest.creatureId,
      kind,
      occurredAt: quest.completedAt!,
      dayId: quest.completedDayId,
    }).state;
  }
  for (const submission of quests.submissions) {
    next = recordCompanionBondEvent(next, {
      id: `quest-submission:${submission.id}`,
      creatureId: submission.creatureId,
      kind: questBondEventKind(questDefinition(submission.questId)),
      occurredAt: submission.submittedAt,
      dayId: submission.dayId,
    }).state;
  }
  for (const attempt of quests.attempts.filter((item) => item.status === 'succeeded')) {
    const kind = questBondEventKind(questDefinition(attempt.questId));
    next = recordCompanionBondEvent(next, {
      id: kind === 'mini_game_completed'
        ? `mini-game:${attempt.creatureId}:${attempt.dayId}`
        : `quest-attempt:${attempt.id}`,
      creatureId: attempt.creatureId,
      kind,
      occurredAt: attempt.endedAt ?? attempt.startedAt ?? 0,
      dayId: attempt.dayId,
    }).state;
  }
  return next;
}

export function backfillHatchBondEvents(
  state: CompanionBondState,
  homeState: Pick<StoredHomeState, 'archivedDays' | 'today' | 'tomorrow'> | null | undefined
): CompanionBondState {
  if (!homeState) return state;
  let next = state;
  const days = [
    ...homeState.archivedDays,
    homeState.today,
    ...(homeState.tomorrow ? [homeState.tomorrow] : []),
  ];
  for (const day of days) {
    if (!day.creature) continue;
    const identity = identityForCreature(day.creature);
    if (!identity) continue;
    next = recordCompanionBondEvent(next, {
      id: `hatch:${day.id}:${identity.companionId}`,
      creatureId: identity.companionId,
      kind: 'hatch',
      occurredAt: new Date(`${day.isoDate}T12:00:00`).getTime(),
      dayId: day.isoDate,
    }).state;
  }
  return next;
}

export function normaliseCompanionBondState(value: CompanionBondState): CompanionBondState {
  const seen = new Set<string>();
  const events = Array.isArray(value?.events)
    ? value.events.filter((event) => {
        if (!event?.id || !event.creatureId || seen.has(event.id) || !Number.isFinite(event.points) || event.points <= 0) return false;
        seen.add(event.id);
        return true;
      })
    : [];
  return { schemaVersion: 1, events };
}
