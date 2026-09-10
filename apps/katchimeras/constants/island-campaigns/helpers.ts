import type { ConversationDefinition } from '@/types/companion-conversation';
import type { KatchimeraSkinId } from '@/types/katchimera';
import type { IslandCampaignProgress, IslandRestorationProgress, MergeOrder, MergeWorldState, MossproutNatureIslandLevel } from '@/types/merge-world';
import { mossproutNatureIslandLevelDefinition } from '@/constants/mossprout-nature-islands';
import { ISLAND_CAMPAIGNS } from './registry';
import type {
  IslandCampaignChapter,
  IslandCampaignChapterStatus,
  IslandCampaignChoice,
  IslandCampaignDefinition,
  IslandCampaignPanelAction,
} from './types';

export const islandCampaignChapter = (campaign: IslandCampaignDefinition, level: MossproutNatureIslandLevel) => (
  campaign.chapters.find((chapter) => chapter.level === level) ?? null
);

export const islandCampaignChapterChoice = (campaign: IslandCampaignDefinition, level: MossproutNatureIslandLevel, choiceId?: string | null) => (
  islandCampaignChapter(campaign, level)?.choices.find((choice) => choice.id === choiceId) ?? null
);

export function islandCampaignChapterOrder(
  campaign: IslandCampaignDefinition,
  level: MossproutNatureIslandLevel,
  choiceIdOrNow?: string | number | null,
  nowArg?: number,
): MergeOrder | null {
  const chapter = islandCampaignChapter(campaign, level);
  if (!chapter) return null;
  const choiceId = typeof choiceIdOrNow === 'string' ? choiceIdOrNow : null;
  const now = typeof choiceIdOrNow === 'number' ? choiceIdOrNow : nowArg ?? Date.now();
  const selected = islandCampaignChapterChoice(campaign, level, choiceId);
  const selectedOrder = selected?.order ?? chapter.fallbackOrder;
  return {
    id: `${campaign.campaignId}:level-${level}:order${selected ? `:${selected.id}` : ''}`,
    characterId: 'mossprout', recipientSkinId: campaign.residentSkinId,
    title: selectedOrder.title, description: selectedOrder.description,
    narrativeSignal: selectedOrder.narrativeSignal, difficulty: selectedOrder.difficulty,
    requirements: selectedOrder.requirements.map((requirement) => ({ ...requirement })),
    reward: { coins: 18 + level * 4, mergeXp: 16 + level * 6, friendshipXp: 8, energy: 0 },
    createdAt: now, signature: level === 4, purpose: level === 4 ? 'signature' : 'normal',
    chapterId: `${campaign.chapterIdPrefix}-level-${level}`, storyArcId: campaign.campaignId,
    storyBeatId: `${campaign.campaignId}:level-${level}`, storyTargetLevel: level,
    storyStep: 1, storyStepCount: 1,
  };
}

export const islandCampaignProgress = (world: MergeWorldState, campaign: IslandCampaignDefinition): IslandCampaignProgress | null => (
  world.islandCampaigns?.[campaign.campaignId] ?? null
);

export function islandCampaignChapterStatus(world: MergeWorldState, campaign: IslandCampaignDefinition, level: MossproutNatureIslandLevel): IslandCampaignChapterStatus {
  const progress = islandCampaignProgress(world, campaign)?.chapters[String(level)];
  if (!progress) return 'available';
  if (progress.completedAt != null) return 'complete';
  const restored = (world.haven.mossproutNatureIslands[campaign.islandId] ?? 0) >= level;
  if (progress.restoration) {
    // A board chapter: paid up front, the board is the request, the Main Board is its delivery.
    if (restored) return 'resolution_ready';
    if (progress.restoration.completedAt != null) return 'restoration_ready';
    if (progress.restoration.deliveryRequestedAt != null && !progress.orderIds.every((id) => progress.servedOrderIds.includes(id))) return 'delivery_requested';
    return 'board_open';
  }
  if (!progress.orderIds.every((id) => progress.servedOrderIds.includes(id))) return 'orders_active';
  if (progress.returnConversationSeenAt == null) return 'return_ready';
  return restored ? 'resolution_ready' : 'restoration_ready';
}

/** Shared labels for the restoration-board states, for friends whose copy does not voice them. */
export const RESTORATION_ACTION_LABEL = 'Keep restoring';
export const RESTORATION_STATE_LABELS: Record<'board_open' | 'delivery_requested', string> = {
  board_open: 'Restoring',
  delivery_requested: 'Requested in Merge',
};
export function islandCampaignActionLabel(campaign: IslandCampaignDefinition, action: IslandCampaignPanelAction): string {
  return campaign.copy.actionLabels[action] ?? RESTORATION_ACTION_LABEL;
}
export function islandCampaignStateLabel(campaign: IslandCampaignDefinition, status: IslandCampaignChapterStatus): string {
  return campaign.copy.stateLabels[status] ?? (status === 'board_open' || status === 'delivery_requested' ? RESTORATION_STATE_LABELS[status] : status);
}

/** The chapter whose restoration board is open right now (paid, not yet complete), if any. */
export function activeIslandRestoration(world: MergeWorldState): { campaign: IslandCampaignDefinition; level: MossproutNatureIslandLevel; chapter: IslandCampaignChapter; progress: IslandRestorationProgress } | null {
  for (const campaign of ISLAND_CAMPAIGNS) {
    const record = islandCampaignProgress(world, campaign);
    if (!record) continue;
    for (const entry of Object.values(record.chapters)) {
      if (!entry.restoration || entry.restoration.completedAt != null || entry.completedAt != null) continue;
      const chapter = islandCampaignChapter(campaign, entry.level);
      if (chapter?.restoration) return { campaign, level: entry.level, chapter, progress: entry.restoration };
    }
  }
  return null;
}

export type IslandCampaignPanelRequest = {
  id: string;
  title: string;
  description?: string;
  definitionIds: readonly string[];
  served: boolean;
};

export type IslandCampaignChapterLogEntry = { level: MossproutNatureIslandLevel; title: string; line: string };

/** Everything the Bloom-style upgrade panel shows for a discovered island friend. */
export type IslandCampaignUpgradePanelState = {
  campaignId: string;
  residentSkinId: KatchimeraSkinId;
  residentName: string;
  action: IslandCampaignPanelAction | null;
  actionLabel?: string;
  level: MossproutNatureIslandLevel;
  order: MergeOrder | null;
  orderComplete: boolean;
  /** Machine state label; tests and analytics key on it. */
  stateLabel: string;
  /** The same state in the friend's voice, progress-aware where authored. */
  voicedStateLabel: string;
  /** The friend's return line once the request is served, until the level is restored. */
  speech: string | null;
  /** Resolved chapters, so the arc stays re-readable from the panel. */
  completedChapters: IslandCampaignChapterLogEntry[];
  status: IslandCampaignChapterStatus;
  /** Glow the panel action spends: a restoration board opening (chapter 1 is the gift). */
  actionCost: number;
};

const PANEL_ACTIONS: Record<IslandCampaignChapterStatus, IslandCampaignPanelAction | null> = {
  available: 'start_story',
  orders_active: 'open_merge',
  return_ready: 'continue_return',
  board_open: 'continue_restoring',
  delivery_requested: 'open_merge',
  restoration_ready: null,
  resolution_ready: 'continue_resolution',
  complete: null,
};

/** One durable view model owns what an island's upgrade panel shows and where its explicit action leads. */
export function islandCampaignUpgradePanelState(world: MergeWorldState, campaign: IslandCampaignDefinition): IslandCampaignUpgradePanelState | null {
  const progress = islandCampaignProgress(world, campaign);
  if (!progress?.discoveryRevealSeenAt) return null;
  const chapter = campaign.chapters.find((candidate) => islandCampaignChapterStatus(world, campaign, candidate.level) !== 'complete');
  if (!chapter) return null;
  const chapterProgress = progress.chapters[String(chapter.level)];
  const status = islandCampaignChapterStatus(world, campaign, chapter.level);
  const orderId = chapterProgress?.orderIds[0];
  const savedOrder = orderId ? world.activeOrders.find((candidate) => candidate.id === orderId) : null;
  const authoredOrder = chapterProgress ? islandCampaignChapterOrder(campaign, chapter.level, chapterProgress.selectedOptionId) : null;
  // A board chapter records its request's id at activation but only asks for it at the checkpoint.
  const requested = !chapterProgress?.restoration || chapterProgress.restoration.deliveryRequestedAt != null;
  const order = requested ? savedOrder ?? (authoredOrder && orderId ? { ...authoredOrder, id: orderId } : null) : null;
  const orderComplete = Boolean(orderId && chapterProgress?.servedOrderIds.includes(orderId));
  const action = PANEL_ACTIONS[status];
  const choice = islandCampaignChapterChoice(campaign, chapter.level, chapterProgress?.selectedOptionId);
  const cost = chapter.level === 1 ? 0 : mossproutNatureIslandLevelDefinition(campaign.islandId, chapter.level)?.coinCost ?? 0;
  const voiced = campaign.copy.speech?.[status]?.({ chapter, choice, coins: world.coins, cost });
  // A board chapter's return happens at the beds: the served delivery is greeted with the same line.
  const deliveredToBeds = status === 'board_open' && orderComplete && chapterProgress?.restoration?.deliveryRequestedAt != null;
  const speech = status === 'return_ready' || status === 'restoration_ready' || deliveredToBeds
    ? choice?.returnLine ?? campaign.copy.fallbackReturn(chapter.title)
    : null;
  const completedChapters = campaign.chapters
    .filter((candidate) => islandCampaignChapterStatus(world, campaign, candidate.level) === 'complete')
    .map((candidate) => ({
      level: candidate.level,
      title: candidate.title,
      line: islandCampaignChapterChoice(campaign, candidate.level, progress.chapters[String(candidate.level)]?.selectedOptionId)?.resolutionLine
        ?? campaign.copy.fallbackResolution(candidate.level),
    }));
  return {
    campaignId: campaign.campaignId,
    residentSkinId: campaign.residentSkinId,
    residentName: campaign.residentName,
    action,
    actionLabel: action ? islandCampaignActionLabel(campaign, action) : undefined,
    level: chapter.level,
    order,
    orderComplete,
    stateLabel: islandCampaignStateLabel(campaign, status),
    voicedStateLabel: voiced ?? islandCampaignStateLabel(campaign, status),
    speech,
    completedChapters,
    status,
    actionCost: status === 'available' && chapter.restoration ? cost : 0,
  };
}

export type IslandCampaignPanelPresentation = {
  actionLabel?: string;
  actionCost?: number;
  order: IslandCampaignPanelRequest | null;
  residentName: string;
  residentSkinId: KatchimeraSkinId;
  stateLabel: string;
  speech?: string | null;
  completedChapters?: IslandCampaignChapterLogEntry[];
};

/** The panel's props, so screens pass state through without mapping it. */
export function islandCampaignPanelPresentation(world: MergeWorldState, campaign: IslandCampaignDefinition): IslandCampaignPanelPresentation | null {
  const state = islandCampaignUpgradePanelState(world, campaign);
  if (!state) return null;
  return {
    actionLabel: state.actionLabel,
    actionCost: state.actionCost || undefined,
    order: state.order ? {
      id: state.order.id,
      title: state.order.title,
      description: state.order.description,
      definitionIds: state.order.requirements.flatMap((requirement) => (
        Array.from({ length: requirement.quantity }, () => requirement.definitionId)
      )),
      served: state.orderComplete,
    } : null,
    residentName: state.residentName,
    residentSkinId: state.residentSkinId,
    stateLabel: state.voicedStateLabel,
    speech: state.speech,
    completedChapters: state.completedChapters,
  };
}

/** The opening conversation, remembering the previous chapter's answer when one was given. */
export function islandCampaignOpeningConversationId(campaign: IslandCampaignDefinition, level: MossproutNatureIslandLevel, previousStyle?: string | null): string | null {
  const chapter = islandCampaignChapter(campaign, level);
  if (!chapter) return null;
  return previousStyle && chapter.callbackLine?.[previousStyle] ? `${chapter.conversationId}:after-${previousStyle}` : chapter.conversationId;
}

/** The style the player chose in the chapter before this one, if any. */
export function islandCampaignPreviousStyle(world: MergeWorldState, campaign: IslandCampaignDefinition, level: MossproutNatureIslandLevel): string | null {
  const previousLevel = (level - 1) as MossproutNatureIslandLevel;
  const selectedOptionId = islandCampaignProgress(world, campaign)?.chapters[String(previousLevel)]?.selectedOptionId;
  return islandCampaignChapterChoice(campaign, previousLevel, selectedOptionId)?.style ?? null;
}

export function islandCampaignReturnLevel(world: MergeWorldState, campaign: IslandCampaignDefinition): MossproutNatureIslandLevel | null {
  const record = islandCampaignProgress(world, campaign);
  if (!record?.discoveryRevealSeenAt) return null;
  return campaign.chapters.find((chapter) => {
    const status = islandCampaignChapterStatus(world, campaign, chapter.level);
    if (status === 'return_ready') return true;
    // A board chapter's served delivery is waiting on the beds: the note leads back to them.
    const progress = record.chapters[String(chapter.level)];
    return status === 'board_open' && progress?.restoration?.deliveryRequestedAt != null
      && progress.orderIds.length > 0 && progress.orderIds.every((id) => progress.servedOrderIds.includes(id));
  })?.level ?? null;
}

/** The island whose served request is waiting for its friend's return scene. */
export function activeIslandCampaignReturn(world: MergeWorldState): { campaign: IslandCampaignDefinition; level: MossproutNatureIslandLevel } | null {
  for (const campaign of ISLAND_CAMPAIGNS) {
    const level = islandCampaignReturnLevel(world, campaign);
    if (level != null) return { campaign, level };
  }
  return null;
}

export type ActiveIslandCampaign = {
  campaign: IslandCampaignDefinition;
  progress: IslandCampaignProgress;
  chapter: IslandCampaignChapter;
  status: IslandCampaignChapterStatus;
};

/** The first discovered island whose story is still in progress. */
export function activeIslandCampaign(world: MergeWorldState): ActiveIslandCampaign | null {
  for (const campaign of ISLAND_CAMPAIGNS) {
    const progress = islandCampaignProgress(world, campaign);
    if (!progress?.discoveryRevealSeenAt) continue;
    const chapter = campaign.chapters.find((candidate) => islandCampaignChapterStatus(world, campaign, candidate.level) !== 'complete');
    if (chapter) return { campaign, progress, chapter, status: islandCampaignChapterStatus(world, campaign, chapter.level) };
  }
  return null;
}

/** Progress records whose friend has appeared but not yet been greeted, in wake order. */
export function pendingIslandCampaignDiscovery(world: MergeWorldState): { campaign: IslandCampaignDefinition; progress: IslandCampaignProgress } | null {
  for (const campaign of ISLAND_CAMPAIGNS) {
    const progress = islandCampaignProgress(world, campaign);
    if (progress && progress.discoveryRevealSeenAt == null) return { campaign, progress };
  }
  return null;
}

export function pendingIslandCampaignCardReveal(world: MergeWorldState): { campaign: IslandCampaignDefinition; progress: IslandCampaignProgress } | null {
  for (const campaign of ISLAND_CAMPAIGNS) {
    const progress = islandCampaignProgress(world, campaign);
    if (progress && progress.cardEarnedAt != null && progress.cardRevealSeenAt == null) return { campaign, progress };
  }
  return null;
}

export function islandCampaignPayoffStyle(campaign: IslandCampaignDefinition, choiceIds: readonly (string | null | undefined)[]): string {
  const scores = Object.fromEntries(campaign.payoff.styles.map((style) => [style, 0])) as Record<string, number>;
  const lastChapterIndex = campaign.chapters.length - 1;
  choiceIds.forEach((choiceId, index) => {
    const choice = campaign.chapters.flatMap((chapter) => chapter.choices).find((candidate) => candidate.id === choiceId);
    if (choice) scores[choice.style] = (scores[choice.style] ?? 0) + (index === lastChapterIndex ? campaign.payoff.finalChapterWeight : 1);
  });
  const preference = campaign.payoff.styles;
  return Object.entries(scores)
    .sort((left, right) => right[1] - left[1] || preference.indexOf(left[0]) - preference.indexOf(right[0]))[0]![0];
}

/** The style the player has shown so far, from every chapter answered. */
export function islandCampaignSelectedStyle(world: MergeWorldState, campaign: IslandCampaignDefinition): string {
  const progress = islandCampaignProgress(world, campaign);
  return islandCampaignPayoffStyle(campaign, campaign.chapters.map((chapter) => progress?.chapters[String(chapter.level)]?.selectedOptionId));
}

const branchConversationId = (baseId: string, choiceId?: string | null) => choiceId ? `${baseId}:${choiceId}` : baseId;
export const islandCampaignReturnBaseId = (chapter: IslandCampaignChapter) => `${chapter.conversationId}:return`;
export const islandCampaignResolutionBaseId = (chapter: IslandCampaignChapter) => `${chapter.conversationId}:restored`;

export function islandCampaignReturnConversationId(campaign: IslandCampaignDefinition, level: MossproutNatureIslandLevel, choiceId?: string | null) {
  const chapter = islandCampaignChapter(campaign, level);
  return chapter ? branchConversationId(islandCampaignReturnBaseId(chapter), islandCampaignChapterChoice(campaign, level, choiceId)?.id) : null;
}

export function islandCampaignResolutionConversationId(campaign: IslandCampaignDefinition, level: MossproutNatureIslandLevel, choiceId?: string | null, style?: string | null) {
  const chapter = islandCampaignChapter(campaign, level);
  if (!chapter) return null;
  const branchId = branchConversationId(islandCampaignResolutionBaseId(chapter), islandCampaignChapterChoice(campaign, level, choiceId)?.id);
  const finalLevel = campaign.chapters[campaign.chapters.length - 1]?.level;
  return level === finalLevel && style ? `${branchId}:${style}` : branchId;
}

const baseDefinition = (campaign: IslandCampaignDefinition, id: string, title: string) => ({
  id, version: 2, familyId: 'mossprout' as const, speakerSkinId: campaign.residentSkinId, title,
  trigger: 'evergreen' as const, minimumBondLevel: 1 as const, cooldownDays: 0, contextualOnly: true,
  format: 'narrative' as const, purpose: 'journey' as const, returnTarget: 'character_home' as const,
  repeatPolicy: 'once_ever' as const,
});

const endNode = (message: string) => ({ id: 'end', kind: 'end' as const, message });

export function islandCampaignConversationDefinitions(campaign: IslandCampaignDefinition): ConversationDefinition[] {
  const finalLevel = campaign.chapters[campaign.chapters.length - 1]?.level;
  return campaign.chapters.flatMap((chapter): ConversationDefinition[] => {
    const openingDefinition = (id: string, prompt: string): ConversationDefinition => ({
      ...baseDefinition(campaign, id, chapter.title), entryNodeId: 'choice', returnTarget: 'garden',
      tags: [...campaign.tags],
      nodes: [
        {
          id: 'choice', kind: 'choice', phase: 'explore', prompt,
          ...(campaign.copy.helperText ? { helperText: campaign.copy.helperText } : {}),
          options: chapter.choices.map((choice) => ({
            id: choice.id, label: choice.label, reply: choice.reply, nextNodeId: `end-${choice.id}`,
            wispAffinity: choice.wispAffinity,
          })),
        },
        ...chapter.choices.map((choice) => ({ id: `end-${choice.id}`, kind: 'end' as const, message: choice.openingConclusion })),
      ],
    });
    const opening = openingDefinition(chapter.conversationId, chapter.prompt);
    // One variant per remembered answer: the friend opens by recalling what the player said last time.
    const callbackOpenings = Object.entries(chapter.callbackLine ?? {}).flatMap(([style, line]) => (
      line ? [openingDefinition(`${chapter.conversationId}:after-${style}`, `${line}\n\n${chapter.prompt}`)] : []
    ));
    const returnTags = [...campaign.tags, 'return', 'required-narrative-overlay'];
    const resolutionTags = [...campaign.tags, 'resolution', 'required-narrative-overlay'];
    const fallbackReturn: ConversationDefinition = {
      ...baseDefinition(campaign, islandCampaignReturnBaseId(chapter), chapter.title), entryNodeId: 'end', tags: returnTags,
      nodes: [endNode(campaign.copy.fallbackReturn(chapter.title))],
    };
    const fallbackResolution: ConversationDefinition = {
      ...baseDefinition(campaign, islandCampaignResolutionBaseId(chapter), chapter.title), entryNodeId: 'end', tags: resolutionTags,
      nodes: [endNode(campaign.copy.fallbackResolution(chapter.level))],
    };
    const branches = chapter.choices.flatMap((choice): ConversationDefinition[] => {
      const choiceReturn: ConversationDefinition = {
        ...baseDefinition(campaign, branchConversationId(islandCampaignReturnBaseId(chapter), choice.id), chapter.title), entryNodeId: 'end', tags: returnTags,
        nodes: [endNode(choice.returnLine)],
      };
      const resolutionId = branchConversationId(islandCampaignResolutionBaseId(chapter), choice.id);
      if (chapter.level !== finalLevel) return [choiceReturn, {
        ...baseDefinition(campaign, resolutionId, chapter.title), entryNodeId: 'end', tags: resolutionTags,
        nodes: [endNode(choice.resolutionLine)],
      }];
      const finalResolutions = campaign.payoff.styles.map((style): ConversationDefinition => ({
        ...baseDefinition(campaign, `${resolutionId}:${style}`, chapter.title), entryNodeId: 'payoff',
        tags: [...resolutionTags, 'final-insight'],
        nodes: [
          {
            id: 'payoff', kind: 'choice', phase: 'resolve', prompt: choice.resolutionLine,
            options: [{
              id: 'see-growth-insight', label: campaign.payoff.insightChoices[style]!.label,
              reply: `${campaign.payoff.insightChoices[style]!.reply} I noticed something about your way of growing, too.`, nextNodeId: 'insight',
            }],
          },
          {
            id: 'insight', kind: 'insight_reveal', title: campaign.payoff.revealTitle,
            insightKey: campaign.payoff.insightKey, category: campaign.payoff.category, persistence: 'offer_save',
            allowSecondary: false, results: [campaign.payoff.insights[style]!], nextNodeId: 'end',
          },
          endNode(campaign.payoff.closingLine),
        ],
      }));
      return [choiceReturn, ...finalResolutions];
    });
    return [opening, ...callbackOpenings, fallbackReturn, fallbackResolution, ...branches];
  });
}

export const ALL_ISLAND_CAMPAIGN_CONVERSATION_DEFINITIONS: readonly ConversationDefinition[] = ISLAND_CAMPAIGNS.flatMap(islandCampaignConversationDefinitions);

/** The choice the player just made inside an opening conversation session. */
export function islandCampaignSelectedChoice(campaign: IslandCampaignDefinition, level: MossproutNatureIslandLevel, optionIds: readonly (string | null | undefined)[]): IslandCampaignChoice | null {
  for (const optionId of optionIds) {
    const choice = islandCampaignChapterChoice(campaign, level, optionId);
    if (choice) return choice;
  }
  return null;
}
