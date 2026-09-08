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
  const started = reduceMergeWorld(state, {
    type: 'activateIslandCampaignChapter', campaignId: campaign.campaignId, islandId: campaign.islandId,
    residentSkinId: campaign.residentSkinId, level, selectedOptionId, orders: [order], now,
  }).state;
  const progress = started.islandCampaigns![campaign.campaignId]!;
  const chapterProgress = progress.chapters[String(level)]!;
  return {
    ...started,
    islandCampaigns: {
      ...started.islandCampaigns,
      [campaign.campaignId]: {
        ...progress,
        chapters: { ...progress.chapters, [String(level)]: { ...chapterProgress, servedOrderIds: [...chapterProgress.orderIds] } },
      },
    },
  };
}

export function acknowledgeChapterReturn(state: MergeWorldState, campaign: IslandCampaignDefinition, level: MossproutNatureIslandLevel, now: number): MergeWorldState {
  return reduceMergeWorld(state, { type: 'ackIslandCampaignChapterReturn', campaignId: campaign.campaignId, level, now }).state;
}

export function restoreIslandLevel(state: MergeWorldState, campaign: IslandCampaignDefinition, level: MossproutNatureIslandLevel, now: number): MergeWorldState {
  return reduceMergeWorld(state, {
    type: 'upgradeMossproutNatureIsland', islandId: campaign.islandId, level,
    ...(level === 1 ? { economyMode: 'free' as const } : {}), receiptId: `test:${campaign.islandId}:restore:${level}`, now,
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
    next = restoreIslandLevel(next, campaign, chapter.level, at + 2);
    next = completeChapter(next, campaign, chapter.level, at + 3);
  });
  return next;
}
