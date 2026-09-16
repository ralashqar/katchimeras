import type { ContentFlowRun } from '@/types/content-flow';
import type { CompanionJourneyChapterDefinition, JourneyEpisodeDefinition } from '@/types/companion-journey-chapter';
import type { FtueCameraDirective } from '@/features/onboarding/ftue-types';
import { COMPANION_JOURNEY_CHAPTERS } from '@/constants/companion-journey-chapters/registry';
import { episodeConsequences, JOURNEY_MISSION_CLEAR_NODE_ID, JOURNEY_MISSION_FOCUS_NODE_ID, journeyConsequenceRunId, journeyMissionOf } from '@/constants/companion-journey-chapters/consequence-flow';
import { storyTileById, type StoryTileDefinition } from '@/constants/story-tiles/registry';
import { completeMossproutBeat } from '@/game/katchimeras/mossprout-beats';
import type { RelationshipProgressState } from '@/types/relationship-progression';

/** What else an episode's completion records on the relationship state, as its definition says; nothing for most. */
export function applyEpisodeCompletes(state: RelationshipProgressState, episode: JourneyEpisodeDefinition, now: number): RelationshipProgressState {
  if (episode.completes?.kind === 'campaign_beat') return completeMossproutBeat(state, episode.completes.beatId, now);
  return state;
}

/**
 * What the Kingdom reads of an episode's world consequence, with no runtime
 * behind it: every episode that has one, and which tile mission a set of
 * saved runs says is docked right now.
 */
export type JourneyConsequenceEntry = { chapter: CompanionJourneyChapterDefinition; episode: JourneyEpisodeDefinition; runId: string };

/** Every episode with a consequence, across every chapter. */
export const JOURNEY_CONSEQUENCES: readonly JourneyConsequenceEntry[] = COMPANION_JOURNEY_CHAPTERS.flatMap((chapter) =>
  chapter.episodes.filter((episode) => episodeConsequences(episode).length).map((episode) => ({ chapter, episode, runId: journeyConsequenceRunId(chapter.familyId, episode.id) })));

export type JourneyConsequenceRuns = { ready: boolean; runs: Readonly<Record<string, ContentFlowRun | null>> };

export type ActiveJourneyMission = JourneyConsequenceEntry & {
  run: ContentFlowRun;
  tile: StoryTileDefinition;
  mission: NonNullable<ReturnType<typeof journeyMissionOf>>['mission'];
};

/** The tile mission whose board the Kingdom should dock: a consequence run waiting on its bar. */
export function activeJourneyMission(runs: JourneyConsequenceRuns): ActiveJourneyMission | null {
  for (const entry of JOURNEY_CONSEQUENCES) {
    const run = runs.runs[entry.runId];
    if (!run || run.status !== 'active' || !run.nodeId.endsWith(JOURNEY_MISSION_CLEAR_NODE_ID)) continue;
    const mission = journeyMissionOf(entry.episode);
    const tile = mission ? storyTileById(mission.tileId) : null;
    if (mission && tile) return { ...entry, run, tile, mission: mission.mission };
  }
  return null;
}

/** Rebuild the docked board's framing from the saved checkpoint, without replaying the focus presentation. */
export function journeyMissionResumeCamera(mission: ActiveJourneyMission | null): FtueCameraDirective | null {
  if (!mission || mission.run.nodeId.endsWith(JOURNEY_MISSION_FOCUS_NODE_ID)) return null;
  return mission.mission.camera;
}
