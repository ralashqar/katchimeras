import { mossproutCampaignEpisodeByBeatId } from '@/constants/mossprout-campaign';
import { MOSSPROUT_CHAPTER } from '@/constants/companion-journey-chapters/mossprout';
import { journeyEpisodeConversationId } from '@/constants/companion-journey-chapters/episode-conversation';
import { journeyEpisodeRecordId } from '@/constants/companion-journey-chapters/registry';
import { journeyConsequenceRunId } from '@/constants/companion-journey-chapters/consequence-flow';
import { journeyCycleId } from '@/features/companion/companion-journey-service';
import { lastMossproutJourney, resetLastMossproutJourneyForDebug } from '@/game/katchimeras/relationship-progression';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';
import { resetKatchimeraConversationDefinitionsForDebug } from '@/utils/companion-content-storage';
import { removeCompanionBondEvent } from '@/utils/companion-bond';
import { loadCompanionBondState, saveCompanionBondState } from '@/utils/companion-bond-storage';
import { resetMergeWorldActivityForDayForDebug } from '@/utils/merge-world/repository';
import { deleteContentFlowRunsForDayForDebug, deleteContentFlowRunsForDebug } from '@/features/content-flow/content-flow-repository';

/**
 * Developer rewind for Mossprout's journey: the latest episode recorded on the
 * journey system is forgotten (its record, its Bond, its conversation, its
 * consequence run and its pause), so it can be played again. Before any
 * episode of the arc exists, the first session's own day is rewound the way
 * it always was. A resolution's story summary (beats, habitat stage) stays.
 */
export async function resetCurrentMossproutJourneyForDebug(now = Date.now()): Promise<{
  reset: boolean;
  episodeNumber: number | null;
}> {
  const relationships = relationshipProgressionRepository.load();
  const records = Object.values(relationships.journeyEpisodes ?? {})
    .filter((record) => record.familyId === 'mossprout' && !MOSSPROUT_CHAPTER.episodes.find((episode) => episode.id === record.episodeId)?.dayOne)
    .sort((a, b) => b.completedAt - a.completedAt);
  const latest = records[0];
  if (latest) {
    const episode = MOSSPROUT_CHAPTER.episodes.find((item) => item.id === latest.episodeId);
    const recordId = journeyEpisodeRecordId('mossprout', latest.episodeId);
    const cycleId = journeyCycleId('mossprout', latest.episodeId);
    resetKatchimeraConversationDefinitionsForDebug([episode?.conversationId ?? journeyEpisodeConversationId('mossprout', latest.episodeId)]);
    relationshipProgressionRepository.update((state) => {
      const journeyEpisodes = { ...(state.journeyEpisodes ?? {}) };
      delete journeyEpisodes[recordId];
      return { ...state, journeyEpisodes,
        journeyCycles: (state.journeyCycles ?? []).filter((cycle) => cycle.id !== cycleId),
        meditations: (state.meditations ?? []).filter((record) => (record.cycleId ?? record.sourceId) !== cycleId) };
    });
    const bond = removeCompanionBondEvent(loadCompanionBondState(), `journey:${recordId}`);
    if (bond.removed) saveCompanionBondState(bond.state);
    await deleteContentFlowRunsForDebug([journeyConsequenceRunId('mossprout', latest.episodeId)]);
    return { reset: true, episodeNumber: episode ? MOSSPROUT_CHAPTER.episodes.indexOf(episode) + 1 : null };
  }
  const journey = lastMossproutJourney(relationships);
  if (!journey) return { reset: false, episodeNumber: null };
  const beat = mossproutCampaignEpisodeByBeatId.get(journey.beatId);
  const definitionIds = [
    journey.openingConversationId, journey.profileConversationId, journey.returnConversationId,
    beat?.openingConversationId, beat?.resolutionConversationId,
  ].filter((id): id is string => typeof id === 'string');
  resetKatchimeraConversationDefinitionsForDebug(definitionIds);
  relationshipProgressionRepository.update((state) => resetLastMossproutJourneyForDebug(state, now));
  await Promise.all([
    resetMergeWorldActivityForDayForDebug(journey.dayId, now),
    deleteContentFlowRunsForDayForDebug(journey.dayId),
  ]);
  return { reset: true, episodeNumber: beat?.episodeNumber ?? null };
}
