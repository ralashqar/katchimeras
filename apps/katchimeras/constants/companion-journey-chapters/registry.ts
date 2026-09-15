import type { CompanionJourneyChapterDefinition } from '@/types/companion-journey-chapter';
import { STEPPLING_CHAPTER } from './steppling';

/**
 * Every authored journey chapter. A friend with one gets journey days,
 * rests and Garden orders from the shared service and stage; a friend
 * without one shows their daily cards and idle line. Mossprout's campaign
 * is his own chapter, adopted by the service as it always was.
 */
export const COMPANION_JOURNEY_CHAPTERS: readonly CompanionJourneyChapterDefinition[] = [STEPPLING_CHAPTER];

const byFamily = new Map(COMPANION_JOURNEY_CHAPTERS.map((chapter) => [chapter.familyId as string, chapter]));

export function journeyChapterFor(familyId: string): CompanionJourneyChapterDefinition | null {
  return byFamily.get(familyId) ?? null;
}

/** The chapter an episode flow (or a run of one) belongs to, by its definition id. */
export function journeyChapterForEpisode(definitionId: string): CompanionJourneyChapterDefinition | null {
  return COMPANION_JOURNEY_CHAPTERS.find((chapter) => definitionId.startsWith(chapter.episodeIdPrefix)) ?? null;
}
