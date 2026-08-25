import { mossproutCampaignEpisodeByBeatId } from '@/constants/mossprout-campaign';
import { lastMossproutJourney, resetLastMossproutJourneyForDebug } from '@/game/katchimeras/relationship-progression';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';
import { resetKatchimeraConversationDefinitionsForDebug } from '@/utils/companion-content-storage';
import { resetMergeWorldActivityForDayForDebug } from '@/utils/merge-world/repository';

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
  await resetMergeWorldActivityForDayForDebug(journey.dayId, now);
  return { reset: true, episodeNumber: episode?.episodeNumber ?? null };
}
