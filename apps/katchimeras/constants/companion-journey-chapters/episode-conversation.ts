import type { ConversationDefinition, ConversationNode, ConversationOption } from '@/types/companion-conversation';
import type { CompanionJourneyChapterDefinition, JourneyEpisodeDefinition, JourneyLineVariant } from '@/types/companion-journey-chapter';
import { poll } from '@/constants/companion-poll-conversation';

/**
 * An episode's beats compiled into one conversation, so the conversation
 * engine plays it: a `say` is a beat with one Continue, an `ask` is a choice
 * with traits and facts, a `poll` is a village poll, an `end` closes it.
 * Lines that have variants are resolved when the conversation is served
 * (`utils/companion-journey-personalisation.ts`), from the variants kept
 * beside the definition here.
 */
export const JOURNEY_EPISODE_TAG = 'journey-episode';
export const journeyEpisodeConversationId = (familyId: string, episodeId: string) => `${familyId}:journey:${episodeId}`;

export type JourneyEpisodeConversation = {
  definition: ConversationDefinition;
  /** Line variants by node id, for the resolver. */
  variants: Readonly<Record<string, readonly JourneyLineVariant[]>>;
  /** Facts by option id, for the completion. */
  facts: Readonly<Record<string, { key: string; value: string }>>;
};

export function journeyEpisodeConversation(chapter: CompanionJourneyChapterDefinition, episode: JourneyEpisodeDefinition): JourneyEpisodeConversation | null {
  if (!episode.beats?.length || episode.conversationId) return null;
  const id = journeyEpisodeConversationId(chapter.familyId, episode.id);
  const nodes: ConversationNode[] = [];
  const variants: Record<string, readonly JourneyLineVariant[]> = {};
  const facts: Record<string, { key: string; value: string }> = {};
  const beats = episode.beats;
  const beatId = (beat: (typeof beats)[number]): string => beat.kind === 'poll' ? `poll.${beat.seed.id}` : beat.kind === 'end' ? 'end' : beat.id;
  const nextIdOf = (index: number): string | null => {
    const next = beats[index + 1];
    return next ? beatId(next) : null;
  };
  beats.forEach((beat, index) => {
    const nextId = nextIdOf(index);
    if (beat.kind === 'say') {
      if (beat.variants) variants[beat.id] = beat.variants;
      nodes.push({ id: beat.id, kind: 'choice', prompt: beat.text, options: [{ id: 'continue', label: 'Continue', reply: '', nextNodeId: nextId }] });
    } else if (beat.kind === 'ask') {
      if (beat.variants) variants[beat.id] = beat.variants;
      const options: ConversationOption[] = beat.options.map((option) => {
        const optionId = `${beat.id}:${option.id}`;
        if (option.fact) facts[optionId] = option.fact;
        return { id: optionId, label: option.label, reply: option.reply, nextNodeId: nextId, ...(option.traits ? { traits: option.traits } : {}), journalFragment: option.label };
      });
      nodes.push({ id: beat.id, kind: 'choice', prompt: beat.prompt, options });
    } else if (beat.kind === 'poll') {
      const compiled = poll(chapter.familyId, beat.seed, index);
      const pollNode = compiled.nodes.find((node) => node.kind === 'poll');
      if (pollNode?.kind === 'poll') nodes.push({ ...pollNode, id: `poll.${beat.seed.id}`, nextNodeId: nextId, options: pollNode.options.map((option) => ({ ...option, nextNodeId: nextId })) });
    } else {
      if (beat.variants) variants['end'] = beat.variants;
      nodes.push({ id: 'end', kind: 'end', message: beat.text });
    }
  });
  const first = beats[0]!;
  const definition: ConversationDefinition = {
    id, version: 1, familyId: chapter.familyId, title: episode.title,
    ...(chapter.speakerSkinId ? { speakerSkinId: chapter.speakerSkinId as ConversationDefinition['speakerSkinId'] } : {}),
    trigger: 'evergreen', minimumBondLevel: 1, cooldownDays: 3650, repeatPolicy: 'once_ever', contextualOnly: true,
    purpose: 'journey', format: 'narrative', tags: [JOURNEY_EPISODE_TAG, `flavour:${episode.flavour}`],
    entryNodeId: beatId(first),
    nodes,
  };
  return { definition, variants, facts };
}
