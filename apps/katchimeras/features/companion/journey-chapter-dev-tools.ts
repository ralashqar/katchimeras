import { journeyChaptersFor, journeyEpisodeRecordId } from '@/constants/companion-journey-chapters/registry';
import { relationshipProgressionRepository as repository } from '@/storage/repositories/relationship-progression-repository';
import type { KatchimeraFamilyId } from '@/types/katchimera';
import { gameNow } from '@/utils/game-clock';

/**
 * Developer Tools: record every episode of a friend's chapter as complete,
 * with no answers, so a continuation (a pack's arc) opens without the
 * chapter's waits, interactions and Bond. Nothing else moves: a rest that
 * is still running keeps its chapter until it returns.
 */
export function completeJourneyChapterForDebug(familyId: KatchimeraFamilyId, chapterId: string, now = gameNow()): { recorded: number } {
  const chapter = journeyChaptersFor(familyId).find((entry) => entry.chapterId === chapterId);
  if (!chapter) throw new Error(`Unknown chapter ${chapterId} for ${familyId}`);
  let recorded = 0;
  repository.update((state) => {
    const journeyEpisodes = { ...(state.journeyEpisodes ?? {}) };
    for (const episode of chapter.episodes) {
      const id = journeyEpisodeRecordId(chapter.familyId, episode.id);
      if (journeyEpisodes[id]) continue;
      journeyEpisodes[id] = { familyId, episodeId: episode.id, completedAt: now, answers: {}, facts: {}, migrated: true };
      recorded += 1;
    }
    return { ...state, journeyEpisodes };
  });
  return { recorded };
}
