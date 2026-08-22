import type { CompanionQuestState } from '@/utils/katchimera-quests';
import type { StoredHomeState } from '@/types/home';
import { identityForCreature } from '@/utils/katchimera-identity';
import { questDefinition, type QuestDefinition } from '@/utils/quests/definitions';
import {
  companionIdForFamily,
  canonicalFamilyId,
  familyIdFromCompanionId,
} from '@/constants/katchimera-skins';

export type CompanionBondEventKind =
  | 'hatch'
  | 'ideal_skin_questionnaire_completed'
  | 'goal_created'
  | 'goal_completed'
  | 'real_life_quest_completed'
  | 'mini_game_completed'
  | 'quick_goal_completed'
  | 'discovery_answered'
  | 'quest_completed'
  | 'reflection_saved'
  | 'check_in_completed'
  | 'insight_saved'
  | 'insight_engaged'
  | 'conversation_completed'
  | 'journey_day_completed'
  | 'merge_order_completed';

export type CompanionBondEvent = {
  id: string;
  creatureId: string;
  kind: CompanionBondEventKind;
  points: number;
  occurredAt: number;
  dayId?: string | null;
};

export type CompanionBondAwardReceipt = {
  id: string;
  eventId: string;
  creatureId: string;
  kind: CompanionBondEventKind;
  points: number;
  occurredAt: number;
  beforeTotal: number;
  afterTotal: number;
  beforeLevel: 1 | 2 | 3 | 4;
  afterLevel: 1 | 2 | 3 | 4;
};

export type CompanionBondState = {
  schemaVersion: 1 | 2;
  events: CompanionBondEvent[];
  pendingCelebrations?: CompanionBondAwardReceipt[];
  resetCutoffsByCreature?: Record<string, number>;
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
  relationshipStage: 'Stranger' | 'Familiar' | 'Friend' | 'Close Friend' | 'Confidant' | 'Kindred';
  relationshipStageIndex: 0 | 1 | 2 | 3 | 4 | 5;
  relationshipStageRatio: number;
  nextRelationshipStage: 'Familiar' | 'Friend' | 'Close Friend' | 'Confidant' | 'Kindred' | null;
  relationshipPointsRemaining: number;
};

export const COMPANION_BOND_REWARDS: Record<CompanionBondEventKind, number> = {
  hatch: 10,
  ideal_skin_questionnaire_completed: 20,
  goal_created: 15,
  goal_completed: 20,
  real_life_quest_completed: 25,
  mini_game_completed: 8,
  quick_goal_completed: 5,
  discovery_answered: 15,
  // Retained for events created before quest lanes existed.
  quest_completed: 25,
  reflection_saved: 10,
  check_in_completed: 10,
  insight_saved: 15,
  insight_engaged: 10,
  conversation_completed: 8,
  journey_day_completed: 20,
  merge_order_completed: 0,
};

export type CompanionFriendshipProgress = {
  level: number;
  totalPoints: number;
  segmentPoints: number;
  segmentTarget: number;
  ratio: number;
  nextLevel: number | null;
  pointsRemaining: number;
  mastery: number;
};

// Legacy Bond thresholds remain exact anchors at Friendship levels 1, 3, 6,
// and 10, so no existing relationship ever appears to move backwards.
export const COMPANION_FRIENDSHIP_THRESHOLDS = [
  0, 20, 50, 80, 115, 150, 220, 300, 360, 400,
  520, 650, 800, 980, 1_180, 1_400, 1_650, 1_950, 2_300, 2_700,
] as const;

export function companionFriendshipProgress(state: CompanionBondState, creatureId: string): CompanionFriendshipProgress {
  const totalPoints = companionBondProgress(state, creatureId).totalPoints;
  let level = 1;
  for (let index = 0; index < COMPANION_FRIENDSHIP_THRESHOLDS.length; index += 1) {
    if (totalPoints >= COMPANION_FRIENDSHIP_THRESHOLDS[index]) level = index + 1;
  }
  const maxThreshold = COMPANION_FRIENDSHIP_THRESHOLDS[COMPANION_FRIENDSHIP_THRESHOLDS.length - 1];
  const mastery = totalPoints > maxThreshold ? Math.floor((totalPoints - maxThreshold) / 500) : 0;
  const currentThreshold = COMPANION_FRIENDSHIP_THRESHOLDS[level - 1];
  const nextThreshold = level < COMPANION_FRIENDSHIP_THRESHOLDS.length
    ? COMPANION_FRIENDSHIP_THRESHOLDS[level]
    : maxThreshold + (mastery + 1) * 500;
  const segmentPoints = Math.max(0, totalPoints - (level === 20 ? maxThreshold + mastery * 500 : currentThreshold));
  const segmentTarget = Math.max(1, nextThreshold - (level === 20 ? maxThreshold + mastery * 500 : currentThreshold));
  return {
    level,
    totalPoints,
    segmentPoints,
    segmentTarget,
    ratio: Math.min(1, segmentPoints / segmentTarget),
    nextLevel: level < 20 ? level + 1 : null,
    pointsRemaining: Math.max(0, segmentTarget - segmentPoints),
    mastery,
  };
}

export function questBondEventKind(
  definition: Pick<QuestDefinition, 'lane'> | null | undefined
): CompanionBondEventKind {
  return definition?.lane === 'mini_game' ? 'mini_game_completed' : 'real_life_quest_completed';
}

export const COMPANION_BOND_LEVELS = [
  { level: 1, label: 'New', threshold: 0 },
  { level: 2, label: 'Familiar', threshold: 50 },
  { level: 3, label: 'Devoted', threshold: 150 },
  { level: 4, label: 'Kindred', threshold: 400 },
] as const;

export const COMPANION_RELATIONSHIP_STAGES = [
  { index: 0, label: 'Stranger', threshold: 0 },
  { index: 1, label: 'Familiar', threshold: 20 },
  { index: 2, label: 'Friend', threshold: 100 },
  { index: 3, label: 'Close Friend', threshold: 240 },
  { index: 4, label: 'Confidant', threshold: 450 },
  { index: 5, label: 'Kindred', threshold: 800 },
] as const;

export function emptyCompanionBondState(): CompanionBondState {
  return { schemaVersion: 2, events: [], pendingCelebrations: [], resetCutoffsByCreature: {} };
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
  event: Omit<CompanionBondEvent, 'points'> & { points?: number },
  options: { queueCelebration?: boolean } = {}
): { state: CompanionBondState; awarded: boolean; points: number; receipt: CompanionBondAwardReceipt | null } {
  // The event ID is the only award guard. Distinct completed tasks must always
  // pay their advertised Bond and queue their own flight receipt, even when
  // several conversations are completed with the same companion on one day.
  if (state.events.some((item) => item.id === event.id)) return { state, awarded: false, points: 0, receipt: null };
  const points = event.points ?? COMPANION_BOND_REWARDS[event.kind];
  const before = companionBondProgress(state, event.creatureId);
  const nextEvents = [...state.events, { ...event, points }];
  const progressState = { ...state, events: nextEvents };
  const after = companionBondProgress(progressState, event.creatureId);
  const receipt: CompanionBondAwardReceipt = {
    id: `bond-reward:${event.id}`,
    eventId: event.id,
    creatureId: event.creatureId,
    kind: event.kind,
    points,
    occurredAt: event.occurredAt,
    beforeTotal: before.totalPoints,
    afterTotal: after.totalPoints,
    beforeLevel: before.level,
    afterLevel: after.level,
  };
  const next = normaliseCompanionBondState({
    ...state,
    schemaVersion: 2,
    events: nextEvents,
    pendingCelebrations: options.queueCelebration
      ? [...(state.pendingCelebrations ?? []), receipt]
      : state.pendingCelebrations ?? [],
  });
  return { state: next, awarded: true, points, receipt };
}

/** Keeps one aggregate Journey event in sync as optional actions are finished. */
export function syncCompanionBondEvent(
  state: CompanionBondState,
  event: Omit<CompanionBondEvent, 'points'> & { points: number },
  options: { queueCelebration?: boolean } = {}
): { state: CompanionBondState; awarded: boolean; points: number; receipt: CompanionBondAwardReceipt | null } {
  const existing = state.events.find((item) => item.id === event.id);
  if (!existing) return recordCompanionBondEvent(state, event, options);
  const targetPoints = Math.max(existing.points, event.points);
  const delta = targetPoints - existing.points;
  if (delta <= 0) return { state, awarded: false, points: 0, receipt: null };
  const before = companionBondProgress(state, event.creatureId);
  const nextEvents = state.events.map((item) => item.id === event.id ? { ...item, ...event, points: targetPoints } : item);
  const after = companionBondProgress({ ...state, events: nextEvents }, event.creatureId);
  const receipt: CompanionBondAwardReceipt = {
    id: `bond-reward:${event.id}:${targetPoints}`,
    eventId: event.id,
    creatureId: event.creatureId,
    kind: event.kind,
    points: delta,
    occurredAt: event.occurredAt,
    beforeTotal: before.totalPoints,
    afterTotal: after.totalPoints,
    beforeLevel: before.level,
    afterLevel: after.level,
  };
  return {
    state: normaliseCompanionBondState({
      ...state,
      events: nextEvents,
      pendingCelebrations: options.queueCelebration
        ? [...(state.pendingCelebrations ?? []), receipt]
        : state.pendingCelebrations ?? [],
    }),
    awarded: true,
    points: delta,
    receipt,
  };
}

export function acknowledgeCompanionBondCelebration(state: CompanionBondState, receiptId: string): CompanionBondState {
  if (!(state.pendingCelebrations ?? []).some((item) => item.id === receiptId)) return state;
  return { ...state, pendingCelebrations: (state.pendingCelebrations ?? []).filter((item) => item.id !== receiptId) };
}

export function resetCompanionBondForCreatures(
  state: CompanionBondState,
  creatureIds: readonly string[],
  resetAt = Date.now()
): CompanionBondState {
  const familyFor = (id: string) => familyIdFromCompanionId(id) ?? canonicalFamilyId(id);
  const targets = new Set(creatureIds.map(familyFor).filter(Boolean));
  const matches = (creatureId: string) => targets.has(familyFor(creatureId));
  const resetCutoffsByCreature = { ...(state.resetCutoffsByCreature ?? {}) };
  for (const creatureId of creatureIds) {
    const familyId = familyFor(creatureId);
    if (familyId) resetCutoffsByCreature[companionIdForFamily(familyId)] = resetAt;
  }
  return normaliseCompanionBondState({
    ...state,
    events: state.events.filter((event) => !matches(event.creatureId)),
    pendingCelebrations: (state.pendingCelebrations ?? []).filter((receipt) => !matches(receipt.creatureId)),
    resetCutoffsByCreature,
  });
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
      pendingCelebrations: (state.pendingCelebrations ?? []).filter((item) => item.eventId !== eventId),
    }),
    removed: true,
    points: event.points,
  };
}

export function companionBondProgress(state: CompanionBondState, creatureId: string): CompanionBondProgress {
  const familyId = familyIdFromCompanionId(creatureId) ?? canonicalFamilyId(creatureId);
  const canonicalCreatureId = familyId ? companionIdForFamily(familyId) : creatureId;
  const totalPoints = state.events
    .filter((event) => {
      const eventFamilyId = familyIdFromCompanionId(event.creatureId) ?? canonicalFamilyId(event.creatureId);
      return (eventFamilyId ? companionIdForFamily(eventFamilyId) : event.creatureId) === canonicalCreatureId;
    })
    .reduce((sum, event) => sum + event.points, 0);
  return companionBondProgressForTotal(totalPoints);
}

export function companionBondProgressForTotal(totalPoints: number): CompanionBondProgress {
  const current = [...COMPANION_BOND_LEVELS].reverse().find((item) => totalPoints >= item.threshold) ?? COMPANION_BOND_LEVELS[0];
  const next = COMPANION_BOND_LEVELS.find((item) => item.level === current.level + 1) ?? null;
  const segmentTarget = next ? next.threshold - current.threshold : 0;
  const segmentPoints = next ? Math.min(segmentTarget, Math.max(0, totalPoints - current.threshold)) : 0;
  const relationship = [...COMPANION_RELATIONSHIP_STAGES].reverse().find((item) => totalPoints >= item.threshold)
    ?? COMPANION_RELATIONSHIP_STAGES[0];
  const nextRelationship = COMPANION_RELATIONSHIP_STAGES.find((item) => item.index === relationship.index + 1) ?? null;
  const relationshipSegmentTarget = nextRelationship ? nextRelationship.threshold - relationship.threshold : 0;
  const relationshipSegmentPoints = nextRelationship ? Math.max(0, totalPoints - relationship.threshold) : 0;
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
    relationshipStage: relationship.label,
    relationshipStageIndex: relationship.index,
    relationshipStageRatio: nextRelationship && relationshipSegmentTarget > 0
      ? Math.min(1, relationshipSegmentPoints / relationshipSegmentTarget)
      : 1,
    nextRelationshipStage: nextRelationship ? nextRelationship.label as Exclude<CompanionBondProgress['relationshipStage'], 'Stranger'> : null,
    relationshipPointsRemaining: nextRelationship ? Math.max(0, nextRelationship.threshold - totalPoints) : 0,
  };
}

export function questBondEventId(creatureId: string, questId: string, acceptedAt: number): string {
  return `quest:${creatureId}:${questId}:${acceptedAt}`;
}

export function backfillQuestBondEvents(state: CompanionBondState, quests: CompanionQuestState): CompanionBondState {
  let next = state;
  const completedRows = quests.quests.filter((quest) => typeof quest.completedAt === 'number');
  for (const quest of completedRows) {
    const cutoff = resetCutoffForCreature(next, quest.creatureId);
    if ((quest.completedAt ?? 0) <= cutoff) continue;
    const matchingSubmission = quests.submissions.find((item) => item.creatureId === quest.creatureId && item.questId === quest.questId && item.submittedAt === quest.completedAt);
    const matchingAttempt = quests.attempts.find((item) => item.creatureId === quest.creatureId && item.questId === quest.questId && item.status === 'succeeded' && item.endedAt === quest.completedAt);
    const kind = questBondEventKind(questDefinition(quest.questId));
    const legacyMiniGameId = `mini-game:${quest.creatureId}:${matchingAttempt?.dayId ?? quest.completedDayId}`;
    next = recordCompanionBondEvent(next, {
      id: matchingSubmission
        ? `quest-submission:${matchingSubmission.id}`
        : matchingAttempt && kind === 'mini_game_completed'
          ? state.events.some((event) => event.id === legacyMiniGameId)
            ? legacyMiniGameId
            : `mini-game:${quest.creatureId}:${quest.questId}:${matchingAttempt.dayId}`
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
    if (submission.submittedAt <= resetCutoffForCreature(next, submission.creatureId)) continue;
    next = recordCompanionBondEvent(next, {
      id: `quest-submission:${submission.id}`,
      creatureId: submission.creatureId,
      kind: questBondEventKind(questDefinition(submission.questId)),
      occurredAt: submission.submittedAt,
      dayId: submission.dayId,
    }).state;
  }
  for (const attempt of quests.attempts.filter((item) => item.status === 'succeeded')) {
    if ((attempt.endedAt ?? attempt.startedAt ?? 0) <= resetCutoffForCreature(next, attempt.creatureId)) continue;
    const kind = questBondEventKind(questDefinition(attempt.questId));
    const legacyMiniGameId = `mini-game:${attempt.creatureId}:${attempt.dayId}`;
    next = recordCompanionBondEvent(next, {
      id: kind === 'mini_game_completed'
        ? state.events.some((event) => event.id === legacyMiniGameId)
          ? legacyMiniGameId
          : `mini-game:${attempt.creatureId}:${attempt.questId}:${attempt.dayId}`
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
    const occurredAt = new Date(`${day.isoDate}T12:00:00`).getTime();
    if (occurredAt <= resetCutoffForCreature(next, identity.companionId)) continue;
    next = recordCompanionBondEvent(next, {
      id: `hatch:${day.id}:${identity.companionId}`,
      creatureId: identity.companionId,
      kind: 'hatch',
      occurredAt,
      dayId: day.isoDate,
    }).state;
  }
  return next;
}

function resetCutoffForCreature(state: CompanionBondState, creatureId: string): number {
  const familyId = familyIdFromCompanionId(creatureId) ?? canonicalFamilyId(creatureId);
  const canonical = familyId ? companionIdForFamily(familyId) : creatureId;
  return state.resetCutoffsByCreature?.[canonical] ?? 0;
}

export function normaliseCompanionBondState(value: CompanionBondState | Record<string, unknown>): CompanionBondState {
  const candidate = value as Partial<CompanionBondState>;
  const seen = new Set<string>();
  const events = Array.isArray(candidate?.events)
    ? candidate.events.filter((event) => {
        if (!event?.id || !event.creatureId || seen.has(event.id) || !Number.isFinite(event.points) || event.points <= 0) return false;
        seen.add(event.id);
        return true;
    })
    : [];
  const eventIds = new Set(events.map((event) => event.id));
  const pendingCelebrations = Array.isArray(candidate.pendingCelebrations)
    ? candidate.pendingCelebrations.filter((receipt) => receipt?.id
      && eventIds.has(receipt.eventId)
      && !receipt.eventId.startsWith('merge-friendship:merge-story:feastle:'))
    : [];
  const resetCutoffsByCreature = candidate.resetCutoffsByCreature && typeof candidate.resetCutoffsByCreature === 'object'
    ? Object.fromEntries(Object.entries(candidate.resetCutoffsByCreature).filter(([, cutoff]) => Number.isFinite(cutoff) && cutoff > 0))
    : {};
  return { schemaVersion: 2, events, pendingCelebrations, resetCutoffsByCreature };
}
