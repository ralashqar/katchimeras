import { MOSSPROUT_CAMPAIGN_EPISODES, MOSSPROUT_CAMPAIGN_VERSION } from '@/constants/mossprout-campaign';
import { assertValidJourneyCampaign } from '@/game/katchimeras/journey-campaign';
import type { JourneyCampaignStep } from '@/types/journey-campaign';

export const MOSSPROUT_JOURNEY_CAMPAIGN = assertValidJourneyCampaign({
  id: 'mossprout:journey',
  version: MOSSPROUT_CAMPAIGN_VERSION + 1,
  familyId: 'mossprout',
  days: MOSSPROUT_CAMPAIGN_EPISODES.map((episode) => {
    const prefix = `mossprout:journey:${episode.beatId}`;
    const steps: JourneyCampaignStep[] = [
      { id: `${prefix}:opening`, kind: 'conversation', conversationId: episode.openingConversationId, role: 'opening' },
    ];

    if (episode.episodeNumber === 1) {
      steps.push({ id: `${prefix}:orders`, kind: 'merge_orders', objectiveId: episode.objectiveId!, orders: episode.mergeOrders });
      if (episode.resolutionConversationId) steps.push({ id: `${prefix}:resolution`, kind: 'conversation', conversationId: episode.resolutionConversationId, role: 'resolution' });
      if (episode.optionalAction) steps.push({ id: `${prefix}:optional`, kind: 'optional_action', action: episode.optionalAction });
      steps.push({ id: `${prefix}:affinity`, kind: 'questionnaire', conversationId: 'mossprout:game:form-finder', result: 'resident_affinity' });
      steps.push({ id: `${prefix}:resident`, kind: 'resident_discovery', selection: 'matched', nodeMode: 'fixed_campaign_node' });
    } else if (episode.episodeNumber >= 3 && episode.episodeNumber <= 9) {
      steps.push({ id: `${prefix}:resident`, kind: 'resident_discovery', selection: 'next_unearned', nodeMode: 'fixed_campaign_node' });
      if (episode.resolutionConversationId) steps.push({ id: `${prefix}:resolution`, kind: 'conversation', conversationId: episode.resolutionConversationId, role: 'resolution' });
      if (episode.optionalAction) steps.push({ id: `${prefix}:optional`, kind: 'optional_action', action: episode.optionalAction });
    } else {
      steps.push({ id: `${prefix}:orders`, kind: 'merge_orders', objectiveId: episode.objectiveId!, orders: episode.mergeOrders });
      if (episode.resolutionConversationId) steps.push({ id: `${prefix}:resolution`, kind: 'conversation', conversationId: episode.resolutionConversationId, role: 'resolution' });
      if (episode.optionalAction) steps.push({ id: `${prefix}:optional`, kind: 'optional_action', action: episode.optionalAction });
    }
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

