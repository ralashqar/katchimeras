import { islandCampaignChapterOrder } from '@/constants/island-campaigns/helpers';
import type { IslandCampaignDefinition } from '@/constants/island-campaigns/types';
import { mossproutNatureIslandLevelDefinition } from '@/constants/mossprout-nature-islands';
import type { MergeWorldState, MossproutNatureIslandLevel } from '@/types/merge-world';
import { reduceMergeWorld } from '@/utils/merge-world/engine';

/** Clears an island's mist and lets its friend appear, exactly as the world upgrade flow does. */
export function revealIsland(state: MergeWorldState, campaign: IslandCampaignDefinition, now: number, receiptId = `test:${campaign.islandId}:reveal`): MergeWorldState {
  return reduceMergeWorld(state, {
    type: 'revealMossproutNatureIsland', islandId: campaign.islandId, campaignId: campaign.campaignId,
    residentSkinId: campaign.residentSkinId, cost: mossproutNatureIslandLevelDefinition(campaign.islandId, 1)!.coinCost,
    receiptId, now,
  }).state;
}

export function greetIslandFriend(state: MergeWorldState, campaign: IslandCampaignDefinition, now: number): MergeWorldState {
  return reduceMergeWorld(state, { type: 'ackIslandCampaignResidentDiscovery', campaignId: campaign.campaignId, now }).state;
}

/** Starts a chapter with its first authored answer and marks the request served. */
export function startAndServeChapter(state: MergeWorldState, campaign: IslandCampaignDefinition, level: MossproutNatureIslandLevel, now: number, choiceIndex = 0): MergeWorldState {
  const chapter = campaign.chapters.find((candidate) => candidate.level === level)!;
  const selectedOptionId = chapter.choices[choiceIndex]!.id;
  const order = islandCampaignChapterOrder(campaign, level, selectedOptionId, now)!;
  let started = reduceMergeWorld(state, {
    type: 'activateIslandCampaignChapter', campaignId: campaign.campaignId, islandId: campaign.islandId,
    residentSkinId: campaign.residentSkinId, level, selectedOptionId, orders: [order], now,
  }).state;
  // A board chapter asks for its delivery once the beds are stuck; the ladder skips straight to that.
  if (chapter.restoration) {
    started = reduceMergeWorld(started, { type: 'requestIslandCampaignDelivery', campaignId: campaign.campaignId, level, orders: [order], now: now + 1 }).state;
  }
  const progress = started.islandCampaigns![campaign.campaignId]!;
  const chapterProgress = progress.chapters[String(level)];
  if (!chapterProgress) throw new Error(`${campaign.residentName} level ${level} did not start (Glow ${state.coins}, island level ${state.haven.mossproutNatureIslands[campaign.islandId] ?? 0})`);
  const restoration = chapterProgress.restoration;
  const served = {
    ...chapterProgress,
    servedOrderIds: [...chapterProgress.orderIds],
    ...(restoration ? { restoration: {
      ...restoration,
      delivered: order.requirements.flatMap((requirement) => Array.from({ length: requirement.quantity }, () => ({ definitionId: requirement.definitionId, deliveredAt: now + 2 }))),
    } } : {}),
  };
  return {
    ...started,
    islandCampaigns: {
      ...started.islandCampaigns,
      [campaign.campaignId]: { ...progress, chapters: { ...progress.chapters, [String(level)]: served } },
    },
  };
}

/** Every bed at its target and the board closed; a no-op for a chapter without a board. */
export function completeRestoration(state: MergeWorldState, campaign: IslandCampaignDefinition, level: MossproutNatureIslandLevel, now: number): MergeWorldState {
  const progress = state.islandCampaigns?.[campaign.campaignId];
  const chapter = progress?.chapters[String(level)];
  if (!progress || !chapter?.restoration) return state;
  const full = { ...state, islandCampaigns: { ...state.islandCampaigns, [campaign.campaignId]: { ...progress, chapters: { ...progress.chapters, [String(level)]: {
    ...chapter, restoration: { ...chapter.restoration, progress: { current: chapter.restoration.progress.total, total: chapter.restoration.progress.total } },
  } } } } };
  return reduceMergeWorld(full, { type: 'completeIslandRestoration', campaignId: campaign.campaignId, level, now }).state;
}

export function acknowledgeChapterReturn(state: MergeWorldState, campaign: IslandCampaignDefinition, level: MossproutNatureIslandLevel, now: number): MergeWorldState {
  return reduceMergeWorld(state, { type: 'ackIslandCampaignChapterReturn', campaignId: campaign.campaignId, level, now }).state;
}

export function restoreIslandLevel(state: MergeWorldState, campaign: IslandCampaignDefinition, level: MossproutNatureIslandLevel, now: number): MergeWorldState {
  // The first restoration is the friend's gift; a board chapter was paid when its board opened.
  const board = Boolean(campaign.chapters.find((chapter) => chapter.level === level)?.restoration);
  return reduceMergeWorld(state, {
    type: 'upgradeMossproutNatureIsland', islandId: campaign.islandId, level,
    ...(level === 1 || board ? { economyMode: 'free' as const } : {}), receiptId: `test:${campaign.islandId}:restore:${level}`, now,
  }).state;
}

export function completeChapter(state: MergeWorldState, campaign: IslandCampaignDefinition, level: MossproutNatureIslandLevel, now: number): MergeWorldState {
  return reduceMergeWorld(state, { type: 'completeIslandCampaignChapter', campaignId: campaign.campaignId, level, now }).state;
}

/** Reveal → greet → every chapter served, returned, restored and resolved. Ends with the friend's card earned. */
export function completeIslandCampaign(state: MergeWorldState, campaign: IslandCampaignDefinition, now: number): MergeWorldState {
  let next = greetIslandFriend(revealIsland(state, campaign, now), campaign, now + 1);
  campaign.chapters.forEach((chapter, index) => {
    const at = now + 10 * (index + 1);
    next = startAndServeChapter(next, campaign, chapter.level, at);
    next = acknowledgeChapterReturn(next, campaign, chapter.level, at + 1);
    next = completeRestoration(next, campaign, chapter.level, at + 1);
    next = restoreIslandLevel(next, campaign, chapter.level, at + 2);
    next = completeChapter(next, campaign, chapter.level, at + 3);
  });
  return next;
}
