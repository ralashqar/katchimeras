import { MOSSPROUT_CAMPAIGN_EPISODES, MOSSPROUT_CAMPAIGN_VERSION } from '@/constants/mossprout-campaign';
import { assertValidJourneyCampaign } from '@/game/katchimeras/journey-campaign';
import type { JourneyCampaignStep } from '@/types/journey-campaign';
import { MOSSPROUT_JOURNEY_WISP_IDS } from '@/utils/journey-wisp-affinity';

export const MOSSPROUT_JOURNEY_CAMPAIGN = assertValidJourneyCampaign({
  id: 'mossprout:journey',
  version: MOSSPROUT_CAMPAIGN_VERSION + 1,
  familyId: 'mossprout',
  chapters: [
    ['mossprout:chapter:quiet-patch', 'A Little Place to Begin', 'Make room for care and learn how we can support each other.'],
    ['mossprout:chapter:dry-pond', 'The Returning Pond', 'Notice what a place needs and help life return.'],
    ['mossprout:chapter:memory-nursery', 'The Memory Nursery', 'Give the moments that matter somewhere to grow.'],
    ['mossprout:chapter:heartwood', 'Heartwood', 'Bring our discoveries together into a place that holds us.'],
  ].map(([id, title, purpose]) => ({ id, title, purpose, episodeIds: MOSSPROUT_CAMPAIGN_EPISODES.filter((episode) => episode.chapterId === id).map((episode) => episode.beatId) })),
  days: MOSSPROUT_CAMPAIGN_EPISODES.map((episode) => {
    const prefix = `mossprout:journey:${episode.beatId}`;
    const steps: JourneyCampaignStep[] = [
      { id: `${prefix}:opening`, kind: 'conversation', conversationId: episode.openingConversationId, role: 'opening' },
    ];

    if (episode.mergeOrders.length) steps.push({ id: `${prefix}:orders`, kind: 'merge_orders', objectiveId: episode.objectiveId!, orders: episode.mergeOrders });
    if (episode.resolutionConversationId) steps.push({ id: `${prefix}:resolution`, kind: 'conversation', conversationId: episode.resolutionConversationId, role: 'resolution' });
    if (episode.episodeNumber >= 2 && episode.episodeNumber <= 9) steps.push({
      id: `${prefix}:wisp`, kind: 'wisp_reward', rewardId: `mossprout:journey-wisp:${episode.beatId}`,
      candidateWispIds: MOSSPROUT_JOURNEY_WISP_IDS, fallbackWispId: 'sprout',
      legacyNodeIds: [
        `${prefix}:resident`, `${prefix}:resident:open-garden`, `${prefix}:resident:parcel`,
        `${prefix}:resident:revealed`, `${prefix}:resident:dialogue`, `${prefix}:resident:orders`,
        `${prefix}:resident:card-reward`,
      ],
    });
    if (episode.optionalAction) steps.push({ id: `${prefix}:optional`, kind: 'optional_action', action: episode.optionalAction });
    steps.push({ id: `${prefix}:complete`, kind: 'complete' });

    return {
      id: episode.beatId,
      number: episode.episodeNumber,
      unlockActiveDay: episode.unlockGardenDay,
      chapterId: episode.chapterId,
      title: episode.title,
      insightKey: `mossprout:insight:journey-day-${episode.episodeNumber}`,
      milestoneGateId: episode.milestoneGateId,
      steps,
    };
  }),
});
