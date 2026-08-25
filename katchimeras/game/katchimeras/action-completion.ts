import type { ConversationDefinition, ConversationSession } from '@/types/companion-conversation';
import type { KatchimeraActionCompletionEvent, KatchimeraActionOrigin } from '@/types/relationship-progression';
import { companionIdForFamily } from '@/constants/katchimera-skins';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';
import { mossproutActionInstanceId, mossproutConversationActionCompletion } from '@/game/katchimeras/mossprout-home';
import {
  attachKatchimeraActionRewardReceipt,
  completeMossproutJourneyConversation,
  katchimeraActionCompletionEventId,
  mossproutDailyActionDeck,
  mossproutJourneyForDay,
  recordKatchimeraActionCompletionEvent,
} from '@/game/katchimeras/relationship-progression';
import {
  companionBondProgress,
  recordCompanionBondEvent,
  syncCompanionBondEvent,
  type CompanionBondAwardReceipt,
  type CompanionBondEvent,
  type CompanionBondState,
} from '@/utils/companion-bond';
import { loadCompanionBondState, saveCompanionBondState } from '@/utils/companion-bond-storage';
import { homeRepository } from '@/storage/repositories/home-repository';
import { companionIdResolverForHomeState } from '@/utils/katchimera-identity';
import { loadCompanionQuests } from '@/utils/katchimera-quests';
import { grantStoredKatchimeraCard } from '@/utils/merge-world/repository';

export type KatchimeraActionCompletionCommit = {
  completion: KatchimeraActionCompletionEvent | null;
  rewardReceipt: CompanionBondAwardReceipt | null;
};

/**
 * The single Mossprout action completion boundary. It is intentionally safe to
 * call from the direct handler and again from the mounted recovery effect.
 */
export function commitKatchimeraActionCompletion(input: {
  session: ConversationSession;
  definition: ConversationDefinition;
}): KatchimeraActionCompletionCommit {
  const { definition, session } = input;
  if (session.preview || session.status !== 'completed' || session.familyId !== 'mossprout') {
    return { completion: null, rewardReceipt: null };
  }
  const completedAt = session.completedAt ?? session.updatedAt;
  let relatedJourneyId: string | null = null;
  let origin = session.actionOrigin ?? null;

  let relationships = relationshipProgressionRepository.update((current) => {
    const relatedJourney = [...current.journeyDays].reverse().find((journey) => (
      journey.familyId === 'mossprout'
      && (journey.openingConversationId === session.definitionId
        || journey.profileConversationId === session.definitionId
        || journey.returnConversationId === session.definitionId
        || journey.actions.some((action) => action.definitionId === session.definitionId))
    ));
    relatedJourneyId = relatedJourney?.id ?? null;
    const progressed = relatedJourney
      ? completeMossproutJourneyConversation(current, session, completedAt)
      : current;
    origin ??= relatedJourney
      ? journeyConversationOrigin(current, relatedJourney, session, definition, completedAt)
      : legacyConversationOrigin(progressed, session, definition, completedAt);
    if (!origin) return progressed;

    // A Journey card remains active across its opening and Merge interlude.
    // Only publish its outro after the authored Journey action is truly done.
    if (origin.journeyActionId) {
      const progressedJourney = progressed.journeyDays.find((journey) => journey.id === origin!.journeyId)
        ?? progressed.journeyDays.find((journey) => journey.actions.some((action) => action.id === origin!.journeyActionId));
      if (!progressedJourney?.actions.some((action) => action.id === origin!.journeyActionId && action.status === 'completed')) {
        return progressed;
      }
    }
    return recordKatchimeraActionCompletionEvent(progressed, { source: origin, completedAt });
  });

  if (session.definitionId === 'mossprout:campaign-v2:returning-pond:place-for-rain:opening') {
    const residentId = relationships.stories.mossprout?.coStarSkinId;
    if (residentId) void grantStoredKatchimeraCard(
      'mossprout', residentId, `journey-card:${session.servedDayId}:mossprout`, completedAt,
    );
  }

  if (!origin) return { completion: null, rewardReceipt: null };
  const completionId = katchimeraActionCompletionEventId(origin);
  let completion = relationships.actionCompletionEvents.find((event) => event.id === completionId)
    ?? relationships.actionCompletionEvents.find((event) => event.source.dayId === origin!.dayId && event.source.actionId === origin!.actionId)
    ?? null;
  if (!completion) return { completion: null, rewardReceipt: null };

  const homeState = homeRepository.load();
  const resolveCompanionId = companionIdResolverForHomeState(homeState);
  const questState = loadCompanionQuests(resolveCompanionId);
  let bondState = loadCompanionBondState(questState, resolveCompanionId, homeState);
  let rewardReceipt = completion.rewardReceipt as CompanionBondAwardReceipt | null;
  const relatedJourney = relatedJourneyId
    ? relationships.journeyDays.find((journey) => journey.id === relatedJourneyId) ?? null
    : null;

  if (relatedJourney?.completionReceipt && journeyBondCanSettle(relatedJourney)) {
    const receipt = relatedJourney.completionReceipt;
    const points = remainingJourneyBondPoints(relationships, bondState, relatedJourney.id, receipt.bondPoints);
    const result = syncCompanionBondEvent(bondState, {
      id: receipt.id,
      creatureId: companionIdForFamily('mossprout'),
      kind: 'journey_day_completed',
      points,
      occurredAt: receipt.createdAt,
      dayId: receipt.dayId,
    }, { queueCelebration: false });
    bondState = result.state;
    rewardReceipt = result.receipt ?? rewardReceipt ?? receiptForBondEvent(bondState, receipt.id);
  } else if (origin.reward?.kind === 'bond') {
    const rewardEventId = completion.rewardEventId ?? `katchimera-action:${completion.id}`;
    const result = recordCompanionBondEvent(bondState, {
      id: rewardEventId,
      creatureId: companionIdForFamily('mossprout'),
      kind: 'conversation_completed',
      points: origin.reward.amount,
      occurredAt: completedAt,
      dayId: origin.dayId,
    }, { queueCelebration: false });
    bondState = result.state;
    rewardReceipt = result.receipt ?? rewardReceipt ?? receiptForBondEvent(bondState, rewardEventId);
  }

  saveCompanionBondState(bondState);
  if (rewardReceipt && completion.rewardReceipt?.id !== rewardReceipt.id) {
    relationships = relationshipProgressionRepository.update((current) => (
      attachKatchimeraActionRewardReceipt(current, completion!.id, rewardReceipt!)
    ));
    completion = relationships.actionCompletionEvents.find((event) => event.id === completion!.id) ?? completion;
  }
  return { completion, rewardReceipt };
}

function remainingJourneyBondPoints(
  relationships: ReturnType<typeof relationshipProgressionRepository.load>,
  bondState: CompanionBondState,
  journeyId: string,
  authoredPoints: number,
) {
  const individuallyAwarded = relationships.actionCompletionEvents.reduce((total, event) => {
    if (event.source.journeyId !== journeyId || event.source.kind === 'story_chat' || !event.rewardEventId) return total;
    const awarded = bondState.events.find((bondEvent) => bondEvent.id === event.rewardEventId)?.points ?? 0;
    return total + awarded;
  }, 0);
  return Math.max(0, authoredPoints - individuallyAwarded);
}

function legacyConversationOrigin(
  relationships: ReturnType<typeof relationshipProgressionRepository.load>,
  session: ConversationSession,
  definition: ConversationDefinition,
  completedAt: number,
): KatchimeraActionOrigin {
  const completion = mossproutConversationActionCompletion(definition, session.servedDayId, completedAt);
  const slotId = completion.slotId;
  const sequence = mossproutDailyActionDeck(relationships, session.servedDayId).slotSequences[slotId];
  return {
    dayId: completion.dayId,
    familyId: completion.familyId,
    actionId: completion.actionId,
    instanceId: mossproutActionInstanceId(completion.dayId, slotId, sequence, completion.actionId),
    sourceSlotId: slotId,
    slotId,
    sequence,
    kind: completion.kind,
    title: completion.title,
    subtitle: completion.subtitle,
    icon: completion.icon,
    ...(completion.artKey ? { artKey: completion.artKey } : {}),
    artworkDefinitionIds: completion.artworkDefinitionIds,
    reward: completion.reward,
    presentation: 'action_card',
  };
}

function journeyConversationOrigin(
  relationships: ReturnType<typeof relationshipProgressionRepository.load>,
  journey: ReturnType<typeof relationshipProgressionRepository.load>['journeyDays'][number],
  session: ConversationSession,
  definition: ConversationDefinition,
  completedAt: number,
): KatchimeraActionOrigin | null {
  const journeyAction = journey.actions.find((action) => action.definitionId === session.definitionId)
    ?? journey.actions.find((action) => action.kind === 'journey');
  if (!journeyAction) return null;
  const fallback = mossproutConversationActionCompletion(definition, journey.dayId, completedAt);
  const slotId = journeyAction.kind === 'journal_prompt' ? 'field' : 'together';
  const sequence = mossproutDailyActionDeck(relationships, journey.dayId).slotSequences[slotId];
  const actionId = journeyAction.id;
  return {
    dayId: journey.dayId,
    familyId: 'mossprout',
    actionId,
    instanceId: mossproutActionInstanceId(journey.dayId, slotId, sequence, actionId),
    sourceSlotId: slotId,
    slotId,
    sequence,
    kind: journeyAction.kind === 'goal_plan'
      ? 'goal_plan'
      : journeyAction.kind === 'journal_prompt' ? 'journal_prompt' : journeyAction.kind === 'journey' ? 'story_chat' : 'fun_chat',
    title: journeyAction.kind === 'journey' ? 'Today\'s Journey is complete' : fallback.title,
    subtitle: journeyAction.kind === 'journey' ? 'Mossprout will remember what you did together.' : fallback.subtitle,
    icon: journeyAction.kind === 'journey' ? 'leaf.fill' : fallback.icon,
    artKey: journeyAction.kind === 'journey' ? 'mossprout:journey' : fallback.artKey,
    artworkDefinitionIds: [],
    reward: { kind: 'bond', amount: journeyAction.bondContribution },
    journeyId: journey.id,
    journeyActionId: journeyAction.id,
    presentation: 'action_card',
  };
}

function journeyBondCanSettle(journey: NonNullable<ReturnType<typeof mossproutJourneyForDay>>) {
  if (journey.status !== 'complete') return false;
  if (journey.beatId !== 'quiet-patch:first-flower') return true;
  return journey.actions.some((action) => action.kind !== 'journey' && action.status === 'completed');
}

function receiptForBondEvent(state: CompanionBondState, eventId: string): CompanionBondAwardReceipt | null {
  const pending = state.pendingCelebrations?.find((receipt) => receipt.eventId === eventId);
  if (pending) return pending;
  const eventIndex = state.events.findIndex((event) => event.id === eventId);
  const event = state.events[eventIndex];
  if (!event) return null;
  const beforeState = { ...state, pendingCelebrations: [], events: state.events.slice(0, eventIndex) };
  const afterState = { ...state, pendingCelebrations: [], events: state.events.slice(0, eventIndex + 1) };
  const before = companionBondProgress(beforeState, event.creatureId);
  const after = companionBondProgress(afterState, event.creatureId);
  return bondReceipt(event, before.totalPoints, after.totalPoints, before.level, after.level);
}

function bondReceipt(
  event: CompanionBondEvent,
  beforeTotal: number,
  afterTotal: number,
  beforeLevel: 1 | 2 | 3 | 4,
  afterLevel: 1 | 2 | 3 | 4,
): CompanionBondAwardReceipt {
  return {
    id: `bond-reward:${event.id}`,
    eventId: event.id,
    creatureId: event.creatureId,
    kind: event.kind,
    points: event.points,
    occurredAt: event.occurredAt,
    beforeTotal,
    afterTotal,
    beforeLevel,
    afterLevel,
  };
}
