import type {
  ActionBoardSnapshot,
  ActionCompletionCommand,
  ActionCompletionRecord,
  ActionPresentationRecord,
  KatchimeraActionOrigin,
  KatchimeraActionRewardReceipt,
  KatchimeraDayAction,
  RelationshipProgressState,
} from '@/types/relationship-progression';

const SLOT_IDS = ['together', 'field', 'garden'] as const;
const MAX_COMPLETIONS = 160;
const MAX_PRESENTATIONS = 80;
const MEDITATION_SETTLEMENT_PER_BOND_POINT_MS = 5 * 60 * 1000;
const MEDITATION_SETTLEMENT_PER_ACTION_MAX_MS = 30 * 60 * 1000;
export const KATCHIMERA_MEDITATION_MAX_SETTLEMENT_MS = 2 * 60 * 60 * 1000;

export function actionCommandFromOrigin(
  origin: KatchimeraActionOrigin,
  completedAt: number,
): ActionCompletionCommand {
  return {
    commandId: `${origin.dayId}:${origin.instanceId}`,
    actionInstanceId: origin.instanceId,
    actionId: origin.actionId,
    dayId: origin.dayId,
    familyId: origin.familyId,
    owner: actionOwnerForOrigin(origin),
    sourceSlotId: origin.sourceSlotId,
    slotId: origin.slotId,
    sequence: origin.sequence,
    outcome: 'completed',
    rotationEffect: origin.rotationEffect,
    rewardIntent: origin.reward,
    presentation: origin.presentation,
    card: {
      kind: origin.kind,
      title: origin.title,
      subtitle: origin.subtitle,
      icon: origin.icon,
      ...(origin.artKey ? { artKey: origin.artKey } : {}),
      artworkDefinitionIds: [...origin.artworkDefinitionIds],
    },
    completedAt,
  };
}

function actionOwnerForOrigin(origin: KatchimeraActionOrigin): ActionCompletionCommand['owner'] {
  if (origin.journeyId && origin.journeyActionId) {
    return { kind: 'journey', journeyId: origin.journeyId, journeyActionId: origin.journeyActionId };
  }
  if (origin.kind === 'goal_checkoff' || origin.kind === 'goal_plan') {
    return { kind: 'goal', goalId: origin.actionId.replace(/^mossprout:goal:/, '') };
  }
  if (origin.kind === 'garden_request') {
    return { kind: 'garden', orderId: origin.actionId.replace(/^mossprout:garden:/, '') || null };
  }
  if (origin.kind === 'quest' || origin.kind === 'photo_request' || origin.kind === 'note_request') {
    return { kind: 'quest', questId: origin.actionId.replace(/^mossprout:quest:/, '') };
  }
  return { kind: 'daily_action' };
}

/**
 * Canonical action transaction. All durable progression happens here, before
 * any component can begin an animation. Replaying a command is a no-op.
 */
export function commitActionCompletion(
  state: RelationshipProgressState,
  command: ActionCompletionCommand,
): RelationshipProgressState {
  const existing = state.actionCompletions.find((item) => item.commandId === command.commandId);
  if (existing) return state;

  const completion: ActionCompletionRecord = {
    id: command.commandId,
    commandId: command.commandId,
    actionInstanceId: command.actionInstanceId,
    actionId: command.actionId,
    dayId: command.dayId,
    familyId: command.familyId,
    kind: command.card.kind,
    owner: command.owner,
    sourceSlotId: command.sourceSlotId,
    slotId: command.slotId,
    sequence: command.sequence,
    outcome: command.outcome,
    rotationEffect: command.rotationEffect,
    rewardIntent: command.rewardIntent,
    rewardEventId: command.rewardIntent?.kind === 'bond' ? `action-reward:${command.commandId}` : null,
    rewardReceipt: null,
    completedAt: command.completedAt,
  };
  let next: RelationshipProgressState = {
    ...state,
    actionCompletions: [...state.actionCompletions, completion].slice(-MAX_COMPLETIONS),
  };

  if (command.owner.kind === 'journey') {
    const owner = command.owner;
    next = {
      ...next,
      journeyDays: next.journeyDays.map((journey) => journey.id !== owner.journeyId
        ? journey
        : {
          ...journey,
          actions: journey.actions.map((action) => action.id !== owner.journeyActionId
            ? action
            : { ...action, status: command.outcome === 'completed' ? 'completed' : 'skipped', completedAt: command.outcome === 'completed' ? command.completedAt : null }),
        }),
    };
  }

  if (command.rotationEffect === 'consume') next = consumeSlot(next, command);
  if (command.presentation === 'action_card') {
    const presentation: ActionPresentationRecord = {
      id: `presentation:${command.commandId}`,
      completionId: completion.id,
      dayId: command.dayId,
      slotId: command.slotId,
      status: 'pending',
      card: { ...command.card, reward: command.rewardIntent },
      createdAt: command.completedAt,
      claimedAt: null,
      dismissedAt: null,
    };
    next = { ...next, actionPresentations: [...next.actionPresentations, presentation].slice(-MAX_PRESENTATIONS) };
  }

  // Ordinary Bond actions remain useful while a companion is reflecting.
  // The completion command is the receipt, so retries cannot reduce the same
  // meditation twice and the durable total can never exceed two hours.
  if (command.outcome === 'completed' && command.rewardIntent?.kind === 'bond' && command.rewardIntent.amount > 0) {
    const receiptId = `action-settlement:${command.commandId}`;
    const requestedMs = Math.min(
      MEDITATION_SETTLEMENT_PER_ACTION_MAX_MS,
      command.rewardIntent.amount * MEDITATION_SETTLEMENT_PER_BOND_POINT_MS,
    );
    next = {
      ...next,
      meditations: (next.meditations ?? []).map((record) => {
        if (
          record.familyId !== command.familyId
          || command.completedAt < record.startedAt
          || next.journeyCycles?.some((cycle) => cycle.id === (record.cycleId ?? record.sourceId) && cycle.requests.some((request) => request.orderId === (command.owner.kind === 'garden' ? command.owner.orderId : '') || request.evidenceId === command.commandId))
          || command.completedAt >= record.availableAt
          || record.settlementReceiptIds?.includes(receiptId)
        ) return record;
        const settledMs = Math.min(
          KATCHIMERA_MEDITATION_MAX_SETTLEMENT_MS,
          (record.settledMs ?? 0) + requestedMs,
        );
        const appliedMs = settledMs - (record.settledMs ?? 0);
        if (appliedMs <= 0) return record;
        return {
          ...record,
          availableAt: Math.max(record.startedAt + 1, record.availableAt - appliedMs),
          settledMs,
          settlementReceiptIds: [...(record.settlementReceiptIds ?? []), receiptId],
        };
      }),
    };
  }

  return next;
}

export function attachActionRewardReceipt(
  state: RelationshipProgressState,
  completionId: string,
  receipt: KatchimeraActionRewardReceipt,
): RelationshipProgressState {
  const completion = state.actionCompletions.find((item) => item.id === completionId);
  if (!completion || completion.rewardReceipt?.id === receipt.id) return state;
  return {
    ...state,
    actionCompletions: state.actionCompletions.map((item) => item.id === completionId
      ? { ...item, rewardEventId: receipt.eventId, rewardReceipt: receipt }
      : item),
  };
}

export function completeDayOneLesson(
  state: RelationshipProgressState,
  input: { completedAt: number; flowRunId: string },
): RelationshipProgressState {
  if (state.milestones.dayOneLessonCompletedAt) return state;
  return {
    ...state,
    milestones: {
      dayOneLessonCompletedAt: input.completedAt,
      dayOneLessonFlowRunId: input.flowRunId,
    },
  };
}

export function claimActionPresentation(
  state: RelationshipProgressState,
  presentationId: string,
  now = Date.now(),
): RelationshipProgressState {
  const target = state.actionPresentations.find((item) => item.id === presentationId);
  if (!target || target.status !== 'pending') return state;
  return {
    ...state,
    actionPresentations: state.actionPresentations.map((item) => item.id === presentationId
      ? { ...item, status: 'claimed', claimedAt: now }
      : item),
  };
}

export function dismissActionPresentation(
  state: RelationshipProgressState,
  presentationId: string,
  now = Date.now(),
): RelationshipProgressState {
  const target = state.actionPresentations.find((item) => item.id === presentationId);
  if (!target || target.status === 'dismissed') return state;
  return {
    ...state,
    actionPresentations: state.actionPresentations.map((item) => item.id === presentationId
      ? { ...item, status: 'dismissed', dismissedAt: now }
      : item),
  };
}

/** A claimed visual was already offered to the user. Never replay it after a process restart. */
export function reconcileActionPresentationsAfterHydration(
  state: RelationshipProgressState,
  now = Date.now(),
): RelationshipProgressState {
  if (!state.actionPresentations.some((item) => item.status === 'claimed')) return state;
  return {
    ...state,
    actionPresentations: state.actionPresentations.map((item) => item.status === 'claimed'
      ? { ...item, status: 'dismissed', dismissedAt: now }
      : item),
  };
}

export function createActionBoardSnapshot(
  dayId: string,
  actions: readonly KatchimeraDayAction[],
  presentations: readonly ActionPresentationRecord[],
): ActionBoardSnapshot {
  const active = actions.filter((action) => action.status === 'ready' || action.status === 'active');
  const bySlot = new Map(active.map((action) => [action.slotId, action]));
  const slots = SLOT_IDS.map((slotId) => {
    const action = bySlot.get(slotId) ?? null;
    return { slotId, action, enabled: Boolean(action && !action.disabled) };
  }) as unknown as ActionBoardSnapshot['slots'];
  const queue = presentations
    .filter((item) => item.dayId === dayId && item.status === 'pending')
    .sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id));
  return { dayId, slots, presentations: queue };
}

export function actionPresentationAsDayAction(
  presentation: ActionPresentationRecord,
  completion: ActionCompletionRecord | undefined,
): KatchimeraDayAction | null {
  if (!completion || presentation.completionId !== completion.id) return null;
  return {
    id: completion.actionId,
    instanceId: completion.actionInstanceId,
    sourceSlotId: completion.sourceSlotId,
    slotId: presentation.slotId,
    sequence: completion.sequence,
    kind: presentation.card.kind,
    title: presentation.card.title,
    subtitle: presentation.card.subtitle,
    icon: presentation.card.icon,
    ...(presentation.card.artKey ? { artKey: presentation.card.artKey } : {}),
    artworkDefinitionId: presentation.card.artworkDefinitionIds[0],
    artworkDefinitionIds: presentation.card.artworkDefinitionIds,
    required: false,
    disabled: true,
    status: 'completed',
    reward: presentation.card.reward,
    destination: { kind: 'journey' },
    completedAt: completion.completedAt,
    outroAcknowledgedAt: null,
    completionEventId: presentation.id,
    rewardReceipt: completion.rewardReceipt,
  };
}

function consumeSlot(state: RelationshipProgressState, command: ActionCompletionCommand): RelationshipProgressState {
  const current = state.mossproutDailyActionDecks.find((deck) => deck.dayId === command.dayId) ?? {
    dayId: command.dayId,
    slotSequences: { together: 0, field: 0, garden: 0 },
    consumedActionIds: { together: [], field: [], garden: [] },
  };
  const slotId = command.sourceSlotId;
  const consumed = current.consumedActionIds[slotId].includes(command.actionId)
    ? current.consumedActionIds[slotId]
    : [...current.consumedActionIds[slotId], command.actionId];
  const next = {
    ...current,
    slotSequences: { ...current.slotSequences, [slotId]: current.slotSequences[slotId] + 1 },
    consumedActionIds: { ...current.consumedActionIds, [slotId]: consumed },
  };
  return {
    ...state,
    mossproutDailyActionDecks: [
      ...state.mossproutDailyActionDecks.filter((deck) => deck.dayId !== command.dayId),
      next,
    ].slice(-14),
  };
}
