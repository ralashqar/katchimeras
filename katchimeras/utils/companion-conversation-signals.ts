import type { JournalRecord, StoredHomeDayRecord } from '@/types/home';
import { isConversationV2Family, type ConversationV2FamilyId, type QueuedConversationSignal } from '@/types/companion-conversation';
import { authoredFamilyConversationManifests } from '@/constants/companion-conversation-authored-families';
import {
  baselineConversationEvidence,
  enqueueConversationSignal,
  markConversationEvidenceProcessed,
  type CompanionContentState,
} from '@/utils/companion-content';

const SIGNAL_LIFETIME_MS = 14 * 86_400_000;

const pilotRoutes: readonly (readonly [string, ConversationV2FamilyId])[] = [
  ['food.coffee', 'baristabbit'], ['food.tea', 'baristabbit'], ['food.drink', 'baristabbit'],
  ['went_somewhere.cafe', 'baristabbit'], ['movement.walk', 'steppling'], ['movement.run', 'steppling'],
  ['movement.hike', 'steppling'], ['movement.errands', 'steppling'], ['movement.commute', 'steppling'],
  ['went_somewhere.forest', 'steppling'], ['movement.workout', 'flexel'], ['movement.sport', 'flexel'],
];

const routeFamilies = new Map<string, ConversationV2FamilyId[]>();
for (const [routeKey, familyId] of [
  ...pilotRoutes,
  ...authoredFamilyConversationManifests.flatMap((item) => item.journalRouteKeys.map((routeKey) => [routeKey, item.familyId] as const)),
]) {
  const families = routeFamilies.get(routeKey) ?? [];
  if (!families.includes(familyId)) routeFamilies.set(routeKey, [...families, familyId]);
}

export function conversationFamiliesForJournalRoute(routeKey: string): readonly ConversationV2FamilyId[] {
  return (routeFamilies.get(routeKey) ?? []).filter(isConversationV2Family);
}

export function conversationFamilyForJournalRoute(routeKey: string): ConversationV2FamilyId | null {
  return conversationFamiliesForJournalRoute(routeKey)[0] ?? null;
}

export function reconcileConversationJournalSignals(
  state: CompanionContentState,
  days: readonly StoredHomeDayRecord[],
  now = Date.now()
): CompanionContentState {
  const records = days.flatMap((day) => (day.journalRecords ?? []).map((record) => ({ day, record })));
  if (!state.conversationSignalBaselineComplete) {
    return baselineConversationEvidence(state, records.map(({ record }) => record.id));
  }
  let next = state;
  for (const { day, record } of records) {
    if (next.processedConversationEvidenceIds.includes(record.id)) continue;
    next = markConversationEvidenceProcessed(next, record.id);
    const signals = signalsForRecord(record, day.isoDate, now);
    for (const signal of signals) next = enqueueConversationSignal(next, signal);
  }
  return next;
}

function signalsForRecord(
  record: JournalRecord,
  dayId: string,
  now: number
): readonly QueuedConversationSignal[] {
  const origin = record.source.origin;
  if (origin?.kind === 'companion_reflection') return [];
  const createdAt = Number.isFinite(Date.parse(record.createdAt)) ? Date.parse(record.createdAt) : now;
  const expiresAt = createdAt + SIGNAL_LIFETIME_MS;
  if (expiresAt <= now) return [];
  if (origin?.kind === 'quick_goal_completion' && isConversationV2Family(origin.familyId)) {
    return [{
      id: `conversation-signal:goal:${record.id}`,
      kind: 'goal_debrief',
      familyId: origin.familyId,
      sourceId: record.id,
      dayId,
      createdAt,
      expiresAt,
    }];
  }
  if (origin?.kind === 'companion_quest') {
    const familyId = familyFromCreatureId(origin.creatureId);
    if (familyId) {
      return [{
        id: `conversation-signal:quest:${record.id}`,
        kind: 'quest_debrief',
        familyId,
        sourceId: record.id,
        dayId,
        createdAt,
        expiresAt,
      }];
    }
  }
  const routeKey = `${record.flowId}.${record.categoryId}`;
  const familyIds = conversationFamiliesForJournalRoute(routeKey);
  if (!familyIds.length) return [];
  const context = typeof record.fields.context === 'string' ? record.fields.context : null;
  return familyIds.map((familyId) => ({
    id: familyIds.length === 1
      ? `conversation-signal:journal:${record.id}`
      : `conversation-signal:journal:${familyId}:${record.id}`,
    kind: 'journal',
    familyId,
    sourceId: record.id,
    dayId,
    routeKey,
    feeling: record.feeling ?? null,
    context,
    createdAt,
    expiresAt,
  }));
}

function familyFromCreatureId(creatureId: string): ConversationV2FamilyId | null {
  const value = creatureId.startsWith('companion:') ? creatureId.slice('companion:'.length) : creatureId;
  return isConversationV2Family(value) ? value : null;
}
