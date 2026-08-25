import { mossproutCampaignEpisodeByBeatId } from '@/constants/mossprout-campaign';
import { lastMossproutJourney, resetLastMossproutJourneyForDebug } from '@/game/katchimeras/relationship-progression';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';
import { resetKatchimeraConversationDefinitionsForDebug } from '@/utils/companion-content-storage';
import { resetMergeWorldActivityForDayForDebug } from '@/utils/merge-world/repository';
import { deleteContentFlowRunsForDayForDebug } from '@/features/content-flow/content-flow-repository';

export async function resetCurrentMossproutJourneyForDebug(now = Date.now()): Promise<{
  reset: boolean;
  episodeNumber: number | null;
}> {
  const relationships = relationshipProgressionRepository.load();
  const journey = lastMossproutJourney(relationships);
  if (!journey) return { reset: false, episodeNumber: null };
  const episode = mossproutCampaignEpisodeByBeatId.get(journey.beatId);
  const definitionIds = [
    journey.openingConversationId,
    journey.profileConversationId,
    journey.returnConversationId,
    episode?.openingConversationId,
    episode?.resolutionConversationId,
  ].filter((id): id is string => typeof id === 'string');
  resetKatchimeraConversationDefinitionsForDebug(definitionIds);
  relationshipProgressionRepository.update((state) => resetLastMossproutJourneyForDebug(state, now));
  await Promise.all([
    resetMergeWorldActivityForDayForDebug(journey.dayId, now),
    deleteContentFlowRunsForDayForDebug(journey.dayId),
  ]);
  return { reset: true, episodeNumber: episode?.episodeNumber ?? null };
}
