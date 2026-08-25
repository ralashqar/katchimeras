import type { ConversationDefinition } from '@/types/companion-conversation';
import type { KatchimeraActionArtKey, KatchimeraActionCompletionRecord, KatchimeraActionOrigin, KatchimeraActionSlotId, KatchimeraDayAction, JourneyDayActionRecord, JourneyDayRecord } from '@/types/relationship-progression';
import { mossproutCampaignEpisodeByBeatId } from '@/constants/mossprout-campaign';

export type MossproutActionOffer = {
  id: string;
  title: string;
  hint: string;
  family?: string;
  bondReward: number;
  completedToday?: boolean;
  availableToday?: boolean;
};

export type MossproutActionGoal = {
  id: string;
  templateId?: string;
  title: string;
  completed: boolean;
};

export type MossproutActionConversation = {
  definitionId: string;
  mode: 'talk' | 'play' | 'discover' | 'plan';
  title: string;
  label?: string;
  description?: string;
  actionKind?: 'journal_prompt' | 'journey_focus';
};

/**
 * One logical dashboard card keeps this identity from its active state through
 * its completed reward/outro state. Conversation session IDs belong to the
 * narrative screen and must never be used as action-row identities.
 */
export function mossproutActionInstanceId(
  dayId: string,
  slotId: KatchimeraActionSlotId,
  sequence: number,
  actionId: string,
) {
  return `${dayId}:${slotId}:${sequence}:${actionId}`;
}

/** Captures the exact card identity before navigation can change the deck. */
export function mossproutActionOrigin(
  action: KatchimeraDayAction,
  dayId: string,
  journey?: JourneyDayRecord | null,
): KatchimeraActionOrigin {
  const sourceSlotId = action.sourceSlotId ?? slotForAction(action);
  const slotId = action.slotId ?? sourceSlotId;
  const sequence = action.sequence ?? 0;
  return {
    dayId,
    familyId: 'mossprout',
    actionId: action.id,
    instanceId: action.instanceId ?? mossproutActionInstanceId(dayId, sourceSlotId, sequence, action.id),
    sourceSlotId,
    slotId,
    sequence,
    kind: action.kind,
    title: action.title,
    subtitle: action.subtitle ?? '',
    icon: action.icon,
    ...(action.artKey ? { artKey: action.artKey } : {}),
    artworkDefinitionIds: action.artworkDefinitionIds?.length
      ? [...action.artworkDefinitionIds]
      : action.artworkDefinitionId ? [action.artworkDefinitionId] : [],
    reward: action.reward,
    ...(journey ? { journeyId: journey.id } : {}),
    ...(journey?.actions.some((candidate) => candidate.id === action.id) ? { journeyActionId: action.id } : {}),
    presentation: 'action_card',
  };
}

export type MossproutActionGardenRequest = {
  id: string;
  title: string;
  description: string;
  difficulty: 'small' | 'medium' | 'major';
  requirements: readonly { definitionId: string; quantity: number }[];
  coins: number;
  storyStep?: number | null;
  storyStepCount?: number | null;
};

export const MOSSPROUT_DAILY_FIELD_NOTE_ACTION_ID = 'mossprout:daily:field-note';
const MOSSPROUT_ACTION_SLOT_IDS = ['together', 'field', 'garden'] as const;

const MOSSPROUT_CONVERSATION_ART: Readonly<Record<string, KatchimeraActionArtKey>> = {
  'mossprout:conversation:nature-question:suspicious-path': 'mossprout:suspicious-path',
  'mossprout:conversation:nature-question:weather-committee': 'mossprout:nature-weather',
  'mossprout:conversation:nature-question:garden-guests': 'mossprout:garden-guest',
  'mossprout:conversation:nature-question:outdoor-luxury': 'mossprout:outdoor-luxury',
  'mossprout:conversation:nature-question:tree-neighbour': 'mossprout:tree-neighbour',
  'mossprout:conversation:nature-question:cloud-job': 'mossprout:cloud-job',
  'mossprout:conversation:nature-question:pocket-expedition': 'today:quest',
  'mossprout:conversation:nature-question:garden-rule': 'mossprout:garden-rules',
  'mossprout:conversation:nature-journal:three-detail-field-note': 'today:reflection',
  'mossprout:conversation:nature-journal:weather-in-the-day': 'mossprout:nature-weather',
  'mossprout:conversation:nature-journal:one-growing-thing': 'today:reflection',
  'mossprout:conversation:nature-journal:sound-map': 'mossprout:nature-sound-map',
  'mossprout:conversation:nature-journal:light-on-the-place': 'mossprout:nature-light',
  'mossprout:conversation:nature-journal:small-return': 'today:place',
  'mossprout:game:form-finder': 'mossprout:nature-card',
  'mossprout:insight:nature-connection': 'mossprout:nature-insight',
};

export function mossproutConversationArtKey(
  definitionId: string,
  kind?: KatchimeraDayAction['kind'],
): KatchimeraActionArtKey {
  const exact = MOSSPROUT_CONVERSATION_ART[definitionId];
  if (exact) return exact;
  if (kind === 'goal_plan' || definitionId.endsWith(':goal-plan') || definitionId.endsWith(':goal-discovery')) return 'today:quest';
  if (kind === 'insight_chat') return 'mossprout:nature-insight';
  if (kind === 'journal_prompt') return 'today:reflection';
  if (kind === 'fun_chat' || definitionId.endsWith(':playful')) return 'mossprout:garden-rules';
  return 'mossprout:journey';
}

export function mossproutGoalArtKey(templateId?: string): KatchimeraActionArtKey {
  if (templateId?.endsWith(':step-outside') || templateId?.endsWith(':sit-outside')) return 'today:movement';
  if (templateId?.endsWith(':visit-green') || templateId?.endsWith(':same-place')) return 'today:place';
  if (templateId?.endsWith(':care-for-plant')) return 'mossprout:plant-care';
  if (templateId?.endsWith(':window-view')) return 'mossprout:nature-window';
  if (templateId?.endsWith(':notice-living-thing') || templateId?.endsWith(':season-change')) return 'mossprout:nature-observation';
  return 'today:quest';
}

/**
 * Keep the post-action queue mounted beneath a completed row. The presentation
 * coordinator reserves that row's slot through its outro, then replaces the
 * slot atomically so the cards above and below do not move twice.
 */
export function composeMossproutVisibleActions(
  actions: readonly KatchimeraDayAction[],
  completingAction: KatchimeraDayAction | null,
  limit: number = MOSSPROUT_ACTION_SLOT_IDS.length,
): KatchimeraDayAction[] {
  const active = actions.filter((action) => action.status !== 'completed');
  if (!completingAction) return active.slice(0, limit);
  const requestedIndex = completingAction.slotId
    ? MOSSPROUT_ACTION_SLOT_IDS.indexOf(completingAction.slotId)
    : 0;
  const insertionIndex = Math.min(active.length, Math.max(0, requestedIndex));
  return [
    ...active.slice(0, insertionIndex),
    completingAction,
    ...active.slice(insertionIndex),
  ].slice(0, limit);
}

const GARDEN_REQUESTS: Record<string, { title: string; subtitle: string; definitionId: string; orderId: string; coins: number }> = {
  'quiet-patch:first-flower': {
    title: 'Grow the Garden\'s first Plant',
    subtitle: 'Merge Seeds and wake the remembered Plant.',
    definitionId: 'nature:garden:3',
    orderId: 'mossprout:chapter-0:first-sprout',
    coins: 20,
  },
  'dry-pond:day-1': {
    title: 'Make a place for rain',
    subtitle: 'Create a Shell to catch the first drops.',
    definitionId: 'nature:waterside:2',
    orderId: 'merge-story:mossprout:dry-pond:place-for-rain',
    coins: 20,
  },
  'returning-pond:place-for-rain': {
    title: 'Make a place for rain',
    subtitle: 'Create a Shell to catch the first drops.',
    definitionId: 'nature:waterside:2',
    orderId: 'merge-story:mossprout:dry-pond:place-for-rain',
    coins: 20,
  },
  'dry-pond:day-2': {
    title: 'Grow roots for the pond bank',
    subtitle: 'Make a Plant to hold the soft edge together.',
    definitionId: 'nature:garden:3',
    orderId: 'merge-story:mossprout:dry-pond:bank-that-holds',
    coins: 30,
  },
  'returning-pond:bank-that-holds': {
    title: 'Grow roots for the pond bank',
    subtitle: 'Make a Plant to hold the soft edge together.',
    definitionId: 'nature:garden:3',
    orderId: 'merge-story:mossprout:dry-pond:bank-that-holds',
    coins: 30,
  },
  'dry-pond:day-3': {
    title: 'Finish the little rain garden',
    subtitle: 'Make the final Flower and Tidepool.',
    definitionId: 'nature:garden:4',
    orderId: 'merge-story:mossprout:dry-pond:little-rain-garden',
    coins: 50,
  },
  'returning-pond:rain-garden': {
    title: 'Finish the little rain garden',
    subtitle: 'Make the final Flower and Tidepool.',
    definitionId: 'nature:garden:4',
    orderId: 'merge-story:mossprout:dry-pond:little-rain-garden',
    coins: 50,
  },
};

export function mossproutConversationActionCompletion(
  definition: ConversationDefinition,
  dayId: string,
  completedAt: number,
  instanceId = `mossprout:conversation:${definition.id}`,
  sequence = 0,
): Omit<KatchimeraActionCompletionRecord, 'id'> {
  const journaling = definition.tags?.includes('nature-journal') ?? false;
  const funQuestion = definition.tags?.includes('nature-question') ?? false;
  const planning = definition.tags?.includes('goals') || definition.id.endsWith(':goal-discovery');
  const insight = definition.format === 'insight_game' && !funQuestion;
  return {
    dayId,
    familyId: 'mossprout',
    actionId: journaling ? MOSSPROUT_DAILY_FIELD_NOTE_ACTION_ID : `mossprout:conversation:${definition.id}`,
    instanceId,
    slotId: journaling ? 'field' : 'together',
    sequence,
    kind: planning ? 'goal_plan' : insight ? 'insight_chat' : journaling ? 'journal_prompt' : 'fun_chat',
    title: planning
      ? 'Make a nature plan'
      : insight
        ? 'Learn something together'
        : journaling
          ? definition.actionTitle ?? definition.title
          : definition.actionTitle ?? definition.title,
    subtitle: planning
      ? 'A new direction took root'
      : insight
        ? 'Mossprout learned something about you'
        : journaling
          ? 'Field note kept with Mossprout'
          : 'Mossprout loved that answer',
    icon: planning ? 'scope' : insight ? 'sparkles' : journaling ? 'square.and.pencil' : 'bubble.left.fill',
    artKey: mossproutConversationArtKey(definition.id, planning ? 'goal_plan' : insight ? 'insight_chat' : journaling ? 'journal_prompt' : 'fun_chat'),
    artworkDefinitionIds: [],
    reward: { kind: 'bond', amount: 4 },
    completedAt,
  };
}

export function resolveMossproutDayActions(input: {
  activeQuestId?: string | null;
  conversations?: readonly MossproutActionConversation[];
  consumedActionIds?: Partial<Record<KatchimeraActionSlotId, readonly string[]>>;
  dayId?: string;
  goals: readonly MossproutActionGoal[];
  hasActiveFocus?: boolean;
  includeActionIds?: readonly string[];
  gardenRequests?: readonly MossproutActionGardenRequest[];
  journeyGardenRequest?: MossproutActionGardenRequest | null;
  journeyDayNumber?: number;
  journey: JourneyDayRecord | null;
  offers: readonly MossproutActionOffer[];
  skippedActionIds?: readonly string[];
  slotSequences?: Partial<Record<KatchimeraActionSlotId, number>>;
  storyComplete: boolean;
}): KatchimeraDayAction[] {
  const actions: KatchimeraDayAction[] = [];
  const journey = input.journey;
  const includedActionIds = input.includeActionIds ? new Set(input.includeActionIds) : null;
  const mainRecord = journey?.actions.find((action) => action.kind === 'journey') ?? null;
  const pendingMainOutro = mainRecord?.status === 'completed' && !mainRecord.outroAcknowledgedAt;
  if (pendingMainOutro && journey) actions.push(completedJourneyAction(journey, mainRecord));
  else if (!journey) actions.push({
    id: 'mossprout:start-journey', kind: 'story_chat', title: input.journeyDayNumber && input.journeyDayNumber > 1
      ? `Begin Journey Day ${input.journeyDayNumber}`
      : 'Spend today with Mossprout',
    subtitle: input.journeyDayNumber && input.journeyDayNumber > 1
      ? 'A new day opens the next part of Mossprout\'s story.'
      : 'Begin today\'s story and see what the Garden needs.', icon: 'leaf.fill', required: true,
    artKey: 'mossprout:journey',
    disabled: false, status: 'ready', reward: { kind: 'bond', amount: 12 }, destination: { kind: 'journey' },
    completedAt: null, outroAcknowledgedAt: null,
  });
  else if (journey.status !== 'complete' && !input.storyComplete) actions.push(activeJourneyAction(journey, mainRecord, input.journeyGardenRequest));

  // An active Journey Day owns the action stack. Its opening, required Merge
  // work, and return scene must read as one uninterrupted story; routine goals,
  // conversations, quests, and Garden requests resume only after completion.
  if (journey && journey.status !== 'complete') {
    const journeyAction = actions[0];
    if (!journeyAction) return [];
    const pendingCompletionOutros = journey.actions
      .filter((action) => action.kind !== 'journey' && action.status === 'completed' && !action.outroAcknowledgedAt)
      .map((action) => mapConversationAction(action, true));
    return [journeyAction, ...pendingCompletionOutros].map((action) => {
      const slotId = slotForAction(action);
      const sequence = input.slotSequences?.[slotId] ?? 0;
      return {
        ...action,
        instanceId: mossproutActionInstanceId(input.dayId ?? journey.dayId, slotId, sequence, action.id),
        sourceSlotId: slotId,
        sequence,
        slotId,
      };
    });
  }

  const unfinishedGoals = input.goals.filter((goal) => !goal.completed);
  for (const goal of unfinishedGoals) actions.push({
    id: `mossprout:goal:${goal.id}`, kind: 'goal_checkoff', title: goal.title,
    subtitle: 'A small focus you chose with Mossprout.', icon: 'checkmark.circle.fill', required: false,
    artKey: mossproutGoalArtKey(goal.templateId),
    disabled: false, status: 'active', reward: { kind: 'bond', amount: 5 }, destination: { kind: 'goal', goalId: goal.id },
    completedAt: null, outroAcknowledgedAt: null,
  });

  for (const request of input.gardenRequests ?? []) actions.push({
    id: `mossprout:garden:${request.id}`,
    kind: 'garden_request',
    title: request.title,
    subtitle: request.description || (request.requirements.length > 1 ? 'Bring Mossprout both Garden items.' : 'Make this for Mossprout in the Garden.'),
    icon: 'leaf.fill',
    artworkDefinitionId: request.requirements[0]?.definitionId,
    artworkDefinitionIds: expandRequirementDefinitionIds(request.requirements),
    progressLabel: request.storyStep && request.storyStepCount ? `Order ${request.storyStep} of ${request.storyStepCount}` : null,
    required: false,
    disabled: false,
    status: 'ready',
    reward: { kind: 'coins', amount: request.coins },
    destination: { kind: 'garden', orderId: request.id },
    completedAt: null,
    outroAcknowledgedAt: null,
  });

  for (const action of journey?.actions ?? []) {
    if (action.kind === 'journey') continue;
    if (action.status === 'skipped') continue;
    if (action.status === 'completed') {
      if (!action.outroAcknowledgedAt) actions.push(mapConversationAction(action, true));
      continue;
    }
    if (action.kind === 'goal_plan' && (unfinishedGoals.length || input.hasActiveFocus) && !includedActionIds?.has(action.id)) continue;
    actions.push(mapConversationAction(action, false));
  }

  const hasJourneyGoal = journey?.actions.some((action) => action.kind === 'goal_plan' && (action.status === 'ready' || action.status === 'active'));
  const hasJourneyFun = journey?.actions.some((action) => action.kind === 'playful_game' && (action.status === 'ready' || action.status === 'active'));
  for (const conversation of input.conversations ?? []) {
    if (journey?.actions.some((action) => action.definitionId === conversation.definitionId)) continue;
    if (conversation.mode === 'plan' && (unfinishedGoals.length > 0 || input.hasActiveFocus || hasJourneyGoal)) continue;
    if (conversation.actionKind !== 'journal_prompt' && (conversation.mode === 'talk' || conversation.mode === 'play') && hasJourneyFun) continue;
    const planning = conversation.mode === 'plan';
    const insight = conversation.mode === 'discover';
    const journaling = conversation.actionKind === 'journal_prompt';
    actions.push({
      id: journaling ? MOSSPROUT_DAILY_FIELD_NOTE_ACTION_ID : `mossprout:conversation:${conversation.definitionId}`,
      kind: planning ? 'goal_plan' : insight ? 'insight_chat' : journaling ? 'journal_prompt' : 'fun_chat',
      title: conversation.label ?? conversation.title,
      subtitle: conversation.description ?? conversation.title,
      icon: planning ? 'scope' : insight ? 'sparkles' : journaling ? 'square.and.pencil' : 'bubble.left.fill',
      artKey: mossproutConversationArtKey(conversation.definitionId, planning ? 'goal_plan' : insight ? 'insight_chat' : journaling ? 'journal_prompt' : 'fun_chat'),
      required: false,
      disabled: false,
      status: 'ready',
      reward: { kind: 'bond', amount: 4 },
      destination: planning
        ? { kind: 'focus_questionnaire' }
        : { kind: 'conversation', definitionId: conversation.definitionId },
      completedAt: null,
      outroAcknowledgedAt: null,
    });
  }

  for (const offer of input.offers) {
    if (!['quest-mossprout-green-photo', 'quest-mossprout-nature-note'].includes(offer.id)) continue;
    if (offer.completedToday || offer.availableToday === false) continue;
    if (input.activeQuestId && input.activeQuestId !== offer.id) continue;
    const isPhoto = offer.family === 'photo';
    actions.push({
      id: `mossprout:quest:${offer.id}`,
      kind: isPhoto ? 'photo_request' : 'note_request',
      title: offer.title,
      subtitle: offer.hint,
      icon: isPhoto ? 'camera.fill' : 'square.and.pencil',
      artKey: isPhoto ? 'today:photo' : 'today:reflection',
      required: false,
      disabled: false,
      status: input.activeQuestId === offer.id ? 'active' : 'ready',
      reward: { kind: 'bond', amount: offer.bondReward },
      destination: { kind: 'quest', questId: offer.id },
      completedAt: null,
      outroAcknowledgedAt: null,
    });
  }

  const dayId = input.dayId ?? journey?.dayId ?? '';
  const skipped = new Set(input.skippedActionIds ?? []);
  const consumed = new Set(Object.values(input.consumedActionIds ?? {}).flat());
  const skippedSourcePrefix = `${dayId}:source:`;
  const fieldNoteUsedToday = [...consumed].some(isFieldNoteActionId)
    || [...skipped].some((id) => id.startsWith(skippedSourcePrefix) && isFieldNoteActionId(id.slice(skippedSourcePrefix.length)));
  const eligible = prioritize(dedupe(includedActionIds
    ? actions.filter((action) => includedActionIds.has(action.id))
    : actions)).filter((action) => (
    action.status === 'completed'
    || (!action.disabled
      && (action.required
        || (!consumed.has(action.id)
          && !skipped.has(`${dayId}:source:${action.id}`)
          && !(action.id === MOSSPROUT_DAILY_FIELD_NOTE_ACTION_ID && fieldNoteUsedToday))))
  ));
  const sequences = input.slotSequences ?? {};
  const selected = new Map<KatchimeraActionSlotId, KatchimeraDayAction>();
  const selectedActionIds = new Set<string>();
  for (const slotId of MOSSPROUT_ACTION_SLOT_IDS) {
    const candidates = eligible.filter((action) => slotForAction(action) === slotId);
    const chosen = chooseSlotAction(slotId, candidates, sequences[slotId] ?? 0);
    if (!chosen) continue;
    selected.set(slotId, chosen);
    selectedActionIds.add(chosen.id);
  }

  // Slot families are preferences, not capacity limits. Once every family has
  // had first refusal, lend empty presentation slots to the deepest remaining
  // queue so eligible actions are not hidden behind an occupied sibling slot.
  for (const presentationSlotId of MOSSPROUT_ACTION_SLOT_IDS) {
    if (selected.has(presentationSlotId)) continue;
    const overflowQueues = MOSSPROUT_ACTION_SLOT_IDS
      .map((sourceSlotId) => ({
        sourceSlotId,
        actions: eligible.filter((action) => (
          slotForAction(action) === sourceSlotId
          && action.status !== 'completed'
          && !action.required
          && !selectedActionIds.has(action.id)
        )),
      }))
      .filter((queue) => queue.actions.length > 0)
      .sort((left, right) => right.actions.length - left.actions.length
        || eligible.indexOf(left.actions[0]!) - eligible.indexOf(right.actions[0]!));
    const sourceQueue = overflowQueues[0];
    if (!sourceQueue) break;
    const chosen = chooseSlotAction(
      sourceQueue.sourceSlotId,
      sourceQueue.actions,
      sequences[sourceQueue.sourceSlotId] ?? 0,
    );
    if (!chosen) continue;
    selected.set(presentationSlotId, chosen);
    selectedActionIds.add(chosen.id);
  }

  return MOSSPROUT_ACTION_SLOT_IDS.flatMap((slotId) => {
    const action = selected.get(slotId);
    if (!action) return [];
    const sourceSlotId = slotForAction(action);
    const sequence = sequences[sourceSlotId] ?? 0;
    return [{
      ...action,
      // Status changes must not change a rendered row's identity. Keeping the
      // same instance id lets the active card become its completed outro in
      // place instead of unmounting and re-entering as a different row. Use
      // its logical queue rather than its temporary overflow display slot.
      instanceId: mossproutActionInstanceId(dayId, sourceSlotId, sequence, action.id),
      sourceSlotId,
      sequence,
      slotId,
    }];
  });
}

function isFieldNoteActionId(actionId: string) {
  return actionId === MOSSPROUT_DAILY_FIELD_NOTE_ACTION_ID || actionId.includes(':nature-journal:');
}

function chooseSlotAction(slotId: KatchimeraActionSlotId, actions: readonly KatchimeraDayAction[], sequence: number) {
  if (!actions.length) return null;
  const fixed = actions.find((action) => action.required || action.status === 'completed' || action.kind === 'goal_checkoff');
  if (fixed) return fixed;
  const rotation = slotId === 'together'
    ? (['fun_chat', 'insight_chat', 'goal_plan'] as const)
    : slotId === 'field'
      ? (['journal_prompt', 'photo_request', 'note_request'] as const)
      : (['garden_request'] as const);
  for (let offset = 0; offset < rotation.length; offset += 1) {
    const kind = rotation[(sequence + offset) % rotation.length];
    const candidate = actions.find((action) => action.kind === kind);
    if (candidate) return candidate;
  }
  return actions[0] ?? null;
}

function slotForAction(action: KatchimeraDayAction): KatchimeraActionSlotId {
  if (action.kind === 'garden_request') return 'garden';
  if (action.kind === 'journal_prompt' || action.kind === 'photo_request' || action.kind === 'note_request') return 'field';
  return 'together';
}

function prioritize(actions: KatchimeraDayAction[]) {
  let gardenIndex = 0;
  return actions
    .map((action, index) => ({ action, index, gardenIndex: action.kind === 'garden_request' ? gardenIndex++ : -1 }))
    .sort((left, right) => actionPriority(left.action, left.gardenIndex) - actionPriority(right.action, right.gardenIndex) || left.index - right.index)
    .map(({ action }) => action);
}

function actionPriority(action: KatchimeraDayAction, gardenIndex: number) {
  if (action.required || action.status === 'completed') return 0;
  if (action.kind === 'goal_checkoff' || action.kind === 'goal_plan') return 10;
  if (action.kind === 'garden_request') return gardenIndex === 0 ? 20 : 60 + gardenIndex;
  if (action.kind === 'journal_prompt') return 30;
  if (action.kind === 'fun_chat') return 35;
  if (action.kind === 'photo_request' || action.kind === 'note_request') return 40;
  if (action.kind === 'insight_chat') return 50;
  return 70;
}

function activeJourneyAction(
  journey: JourneyDayRecord,
  record: JourneyDayActionRecord | null,
  liveRequest?: MossproutActionGardenRequest | null,
): KatchimeraDayAction {
  const campaignEpisode = mossproutCampaignEpisodeByBeatId.get(journey.beatId);
  const campaignRequirement = campaignEpisode?.requirements[0];
  const garden = GARDEN_REQUESTS[journey.beatId] ?? (campaignEpisode?.completionMode === 'merge' && campaignRequirement && campaignEpisode.mergeOrderId ? {
    title: campaignEpisode.title,
    subtitle: campaignEpisode.requirements.length > 1 ? 'Bring Mossprout every piece for this part of the garden.' : 'Make this living piece for Mossprout.',
    definitionId: campaignRequirement.definitionId,
    orderId: campaignEpisode.mergeOrderId,
    coins: 20,
  } : null);
  const gardenActive = journey.status === 'activity_available' || journey.status === 'activity_in_progress';
  if (gardenActive && garden) return {
    id: record?.id ?? `${journey.id}:garden`, kind: 'garden_request', title: liveRequest?.title ?? garden.title, subtitle: liveRequest?.description ?? garden.subtitle,
    icon: 'leaf.fill', artworkDefinitionId: liveRequest?.requirements[0]?.definitionId ?? garden.definitionId,
    artworkDefinitionIds: liveRequest ? expandRequirementDefinitionIds(liveRequest.requirements) : [garden.definitionId],
    progressLabel: liveRequest?.storyStep && liveRequest.storyStepCount ? `Order ${liveRequest.storyStep} of ${liveRequest.storyStepCount}` : null,
    required: true, disabled: false, status: 'active',
    reward: { kind: 'coins', amount: liveRequest?.coins ?? garden.coins }, destination: { kind: 'garden', orderId: liveRequest?.id ?? journey.activity?.mergeOrderId ?? garden.orderId },
    completedAt: null, outroAcknowledgedAt: null,
  };
  const returning = journey.status === 'return_available' || journey.status === 'resolution_ready';
  const living = journey.status === 'living';
  return {
    id: record?.id ?? `${journey.id}:story`, kind: 'story_chat',
    title: returning ? 'Mossprout: “I have something for you”' : living ? 'Mossprout is still noticing today' : 'Continue today\'s story',
    subtitle: returning ? 'Go back to Mossprout to finish today’s story.' : living ? 'This will open when today has had a little more time.' : 'Talk with Mossprout before choosing what to do next.',
    icon: returning ? 'bubble.left.fill' : 'leaf.fill', required: true, disabled: living, status: 'active',
    artKey: 'mossprout:journey',
    reward: { kind: 'bond', amount: record?.bondContribution ?? 12 }, destination: { kind: 'journey' },
    completedAt: null, outroAcknowledgedAt: null,
  };
}

function expandRequirementDefinitionIds(requirements: MossproutActionGardenRequest['requirements']) {
  return requirements.flatMap((requirement) => (
    Array.from({ length: Math.max(1, requirement.quantity) }, () => requirement.definitionId)
  ));
}

function completedJourneyAction(journey: JourneyDayRecord, record: JourneyDayActionRecord): KatchimeraDayAction {
  return {
    id: record.id, kind: 'story_chat', title: journey.beatId === 'quiet-patch:first-flower' ? 'The first Garden is restored' : 'Today\'s Journey is complete',
    subtitle: 'Mossprout will remember what you did together.', icon: 'leaf.fill', required: true, disabled: true,
    artKey: 'mossprout:journey',
    status: 'completed', reward: { kind: 'bond', amount: record.bondContribution }, destination: { kind: 'journey' },
    completedAt: record.completedAt, outroAcknowledgedAt: record.outroAcknowledgedAt,
  };
}

function mapConversationAction(action: JourneyDayActionRecord, completed: boolean): KatchimeraDayAction {
  const goal = action.kind === 'goal_plan';
  const formFinder = action.definitionId === 'mossprout:game:form-finder';
  const fieldNote = action.kind === 'journal_prompt';
  return {
    id: action.id,
    kind: goal ? 'goal_plan' : fieldNote ? 'journal_prompt' : 'fun_chat',
    title: goal ? 'Find a nature direction' : fieldNote ? 'Keep one growing thing' : formFinder ? 'Find your nature-side card' : 'The official garden survey',
    subtitle: goal ? 'Choose a small direction for tomorrow.' : fieldNote ? 'Notice one living detail worth remembering.' : formFinder ? 'Answer a few questions and discover your first card.' : 'Three quick nature questions, taken unnecessarily seriously.',
    icon: goal ? 'scope' : fieldNote ? 'square.and.pencil' : 'sparkles', required: false, disabled: completed, status: completed ? 'completed' : 'ready',
    artKey: mossproutConversationArtKey(action.definitionId ?? '', goal ? 'goal_plan' : fieldNote ? 'journal_prompt' : 'fun_chat'),
    reward: { kind: 'bond', amount: action.bondContribution },
    destination: goal ? { kind: 'focus_questionnaire' } : { kind: 'conversation', definitionId: action.definitionId ?? '' },
    completedAt: action.completedAt, outroAcknowledgedAt: action.outroAcknowledgedAt,
  };
}

function dedupe(actions: KatchimeraDayAction[]) {
  const seen = new Set<string>();
  return actions.filter((action) => !seen.has(action.id) && Boolean(seen.add(action.id)));
}

export type MossproutHomeViewModel = {
  body: string;
  primaryLabel: string;
  title: string;
  waitingForTomorrow: boolean;
};

export function resolveMossproutHome(input: {
  beatBody: string;
  beatTitle: string;
  journey: JourneyDayRecord | null;
  postJourneyAnswered: boolean;
  storyComplete: boolean;
}): MossproutHomeViewModel {
  if (input.storyComplete) return {
    title: 'The rain garden remembers',
    body: 'The pond is flowing again, and the Little Rain Garden has become part of the Haven.',
    primaryLabel: input.postJourneyAnswered ? 'Talk a little longer' : 'Mossprout has one more question',
    waitingForTomorrow: true,
  };
  if (input.journey?.status === 'complete') return {
    title: "Today's Journey is complete",
    body: 'Everything will wait here. Mossprout will have more to say tomorrow.',
    primaryLabel: input.postJourneyAnswered ? 'Talk a little longer' : 'Mossprout has one more question',
    waitingForTomorrow: true,
  };
  const status = input.journey?.status;
  return {
    title: status === 'return_available' || status === 'resolution_ready'
      ? 'Mossprout noticed what changed'
      : input.beatTitle,
    body: status === 'living'
      ? 'See if you notice water or nature today. There is no wrong kind of day.'
      : input.beatBody,
    primaryLabel: !input.journey
      ? 'Spend today with Mossprout'
      : status === 'opening'
        ? 'Hear what happened'
        : status === 'profile_available'
          ? 'Discover your Mossprout card'
          : status === 'living'
            ? 'See what Mossprout is thinking'
            : status === 'activity_available'
              ? 'Continue in the Garden'
              : status === 'activity_in_progress'
                ? 'Continue the request'
                : status === 'return_available'
                  ? 'Take it to Mossprout'
                  : 'Talk with Mossprout',
    waitingForTomorrow: false,
  };
}
