import type { RelationshipProgressState } from '@/types/relationship-progression';
import { MOSSPROUT_HEARTWOOD_CHAPTER_ID } from '@/constants/mossprout-journey-chapters';
import { MOSSPROUT_CAMPAIGN_EPISODES, mossproutCampaignEpisodeByBeatId, nextMossproutCampaignEpisode } from '@/constants/mossprout-campaign';
import { mossproutStory } from './relationship-progression';

/**
 * A Garden campaign beat completed on the journey system: the story summary
 * the campaign day used to write (the beat, the chapter, the objective, the
 * habitat stage, what comes next) is written the same way, so everything
 * that reads `stories.mossprout` sees the campaign move on. The beats are
 * sequential, so every earlier beat counts as complete too (a summary that
 * lagged behind a migrated save catches up). Idempotent: a beat already in
 * the summary changes nothing.
 */
export function completeMossproutBeat(state: RelationshipProgressState, beatId: string, now = Date.now()): RelationshipProgressState {
  const episode = mossproutCampaignEpisodeByBeatId.get(beatId);
  const story = mossproutStory(state, now);
  if (!episode || story.completedBeatIds?.includes(beatId)) return state;
  const completedBeatIds = unique([...(story.completedBeatIds ?? []), ...MOSSPROUT_CAMPAIGN_EPISODES.filter((beat) => beat.episodeNumber <= episode.episodeNumber).map((beat) => beat.beatId)]);
  const completedObjectiveIds = episode.objectiveId && !story.completedObjectiveIds.includes(episode.objectiveId)
    ? [...story.completedObjectiveIds, episode.objectiveId]
    : story.completedObjectiveIds;
  const nextEpisode = nextMossproutCampaignEpisode(completedBeatIds);
  const completesChapter = !nextEpisode || nextEpisode.chapterId !== episode.chapterId;
  const completedChapterIds = completesChapter ? unique([...story.completedChapterIds, episode.chapterId]) : story.completedChapterIds;
  const habitatStage = Math.max(story.habitatStage, episode.episodeNumber >= 13 ? 4 : episode.episodeNumber >= 9 ? 3 : episode.episodeNumber >= 5 ? 2 : episode.episodeNumber >= 2 ? 1 : 0) as 0 | 1 | 2 | 3 | 4;
  return {
    ...state,
    stories: {
      ...state.stories,
      mossprout: {
        ...story,
        activeChapterId: nextEpisode?.chapterId ?? MOSSPROUT_HEARTWOOD_CHAPTER_ID,
        activeBeatId: nextEpisode?.beatId ?? 'heartwood:complete',
        completedBeatIds, completedChapterIds, completedObjectiveIds, habitatStage, updatedAt: now,
      },
    },
  };
}

function unique(values: readonly string[]) {
  return [...new Set(values)];
}
