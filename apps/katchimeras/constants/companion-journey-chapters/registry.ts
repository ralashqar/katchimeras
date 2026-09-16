import type { CompanionJourneyChapterDefinition, JourneyEpisodeDefinition } from '@/types/companion-journey-chapter';
import { journeyEpisodeConversation, journeyEpisodeConversationId, type JourneyEpisodeConversation } from './episode-conversation';
import { STEPPLING_CHAPTER } from './steppling';
import { MOSSPROUT_CHAPTER } from './mossprout';

/**
 * Every authored journey chapter. A friend with one gets episodes that open
 * on progress, a reflecting pause after each, and optional Garden orders;
 * a friend without one shows their daily cards and idle line. Mossprout's
 * Garden campaign runs beside his arc and keeps his rests.
 */
export const COMPANION_JOURNEY_CHAPTERS: readonly CompanionJourneyChapterDefinition[] = [MOSSPROUT_CHAPTER, STEPPLING_CHAPTER];

const byFamily = new Map(COMPANION_JOURNEY_CHAPTERS.map((chapter) => [chapter.familyId as string, chapter]));

export function journeyChapterFor(familyId: string): CompanionJourneyChapterDefinition | null {
  return byFamily.get(familyId) ?? null;
}

/** The record id an episode's completion is kept under. */
export const journeyEpisodeRecordId = (familyId: string, episodeId: string) => `${familyId}:${episodeId}`;

const conversations = new Map<string, { chapter: CompanionJourneyChapterDefinition; episode: JourneyEpisodeDefinition; compiled: JourneyEpisodeConversation | null }>();
for (const chapter of COMPANION_JOURNEY_CHAPTERS) {
  for (const episode of chapter.episodes) {
    // An episode that plays a catalog conversation by id is known by that id; its lines are the catalog's.
    if (episode.conversationId) { conversations.set(episode.conversationId, { chapter, episode, compiled: null }); continue; }
    const compiled = journeyEpisodeConversation(chapter, episode);
    if (compiled) conversations.set(compiled.definition.id, { chapter, episode, compiled });
  }
}

/** Every authored episode conversation, for the conversation catalog. */
export const JOURNEY_EPISODE_CONVERSATIONS = [...conversations.values()].flatMap((entry) => (entry.compiled ? [entry.compiled.definition] : []));

/** The chapter and episode a conversation belongs to, or null for any other conversation. */
export function journeyEpisodeForConversation(definitionId: string) {
  return conversations.get(definitionId) ?? null;
}

export function journeyEpisodeById(familyId: string, episodeId: string) {
  const chapter = journeyChapterFor(familyId);
  const episode = chapter?.episodes.find((item) => item.id === episodeId) ?? null;
  return chapter && episode ? { chapter, episode, compiled: conversations.get(episode.conversationId ?? journeyEpisodeConversationId(familyId, episodeId))?.compiled ?? null } : null;
}
