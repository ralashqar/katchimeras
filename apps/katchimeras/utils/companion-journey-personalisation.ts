import type { ConversationDefinition, ConversationNode, ConversationSession } from '@/types/companion-conversation';
import type { RelationshipProgressState } from '@/types/relationship-progression';
import type { JourneyLineContext, JourneyLineVariant } from '@/types/companion-journey-chapter';
import { journeyEpisodeForConversation } from '@/constants/companion-journey-chapters/registry';
import { companionConversationDefinitionById } from '@/constants/companion-conversations-v2';
import { conversationTraitTally } from '@/utils/companion-conversation';
import { fillTemplate, resolvePredicate } from '@/utils/content-predicate';
import type { ContentFacts } from '@/types/content-predicate';
import { theoryOfYou } from '@/utils/companion-theory';
import { hatchableByCompanion } from '@/constants/hatchable-companions/registry';

/**
 * A journey episode is authored once and said to this player: lines with
 * variants pick the first whose condition holds (what the theory of the
 * player says, what an earlier answer established), and tokens read the
 * facts in: `{{friend}}`, `{{fact.<key>}}`, `{{theory.style}}`,
 * `{{theory.friction}}`, `{{today}}`. Resolved when the conversation is
 * served, like Mossprout's campaign lines; the definition stays untouched.
 */
export function journeyLineContext(familyId: string, sessions: readonly ConversationSession[], relationships: RelationshipProgressState, today: string | null = null): JourneyLineContext {
  const facts: Record<string, string> = {};
  const answers: Record<string, string> = {};
  for (const [id, record] of Object.entries(relationships.journeyEpisodes ?? {})) {
    if (!id.startsWith(`${familyId}:`)) continue;
    Object.assign(facts, record.facts ?? {});
    for (const [askId, optionId] of Object.entries(record.answers ?? {})) answers[`${id.slice(familyId.length + 1)}.${askId}`] = optionId;
  }
  Object.assign(facts, relationships.stories[familyId as keyof typeof relationships.stories]?.storyFacts ?? {});
  return {
    friendName: hatchableByCompanion(familyId)?.displayName ?? (familyId === 'mossprout' ? 'Mossprout' : familyId),
    theory: theoryOfYou(conversationTraitTally(sessions, companionConversationDefinitionById)),
    facts, answers, today,
  };
}

/** The line facts a condition or token reads: `friend`, `today`, `theory.*`, `fact.<key>`, `answer.<episode>.<ask>`. */
export function journeyLineFacts(context: JourneyLineContext): ContentFacts {
  const facts: Record<string, string | null> = {
    friend: context.friendName,
    today: context.today,
    'theory.style': context.theory.style,
    'theory.friction': context.theory.friction ?? null,
    'theory.reward': context.theory.reward ?? null,
  };
  for (const [key, value] of Object.entries(context.facts)) facts[`fact.${key}`] = value;
  for (const [key, value] of Object.entries(context.answers)) facts[`answer.${key}`] = value;
  return facts;
}

export function renderJourneyLine(text: string, context: JourneyLineContext): string {
  return fillTemplate(text, journeyLineFacts(context));
}

function pick(base: string, variants: readonly JourneyLineVariant[] | undefined, context: JourneyLineContext): string {
  const facts = journeyLineFacts(context);
  const variant = variants?.find((candidate) => resolvePredicate(candidate.when, context, () => facts));
  return fillTemplate(variant?.text ?? base, facts);
}

/** The episode's conversation as this player hears it; any other definition is returned as is. */
export function resolveJourneyConversation(definition: ConversationDefinition, context: JourneyLineContext): ConversationDefinition {
  const entry = journeyEpisodeForConversation(definition.id);
  // A catalog conversation played as an episode keeps its own resolver (Mossprout's campaign lines).
  if (!entry?.compiled) return definition;
  const variants = entry.compiled.variants;
  const nodes = definition.nodes.map((node): ConversationNode => {
    if (node.kind === 'choice') {
      return { ...node, prompt: pick(node.prompt, variants[node.id], context),
        options: node.options.map((option) => ({ ...option, label: renderJourneyLine(option.label, context), reply: renderJourneyLine(option.reply, context) })) };
    }
    if (node.kind === 'poll') return { ...node, prompt: renderJourneyLine(node.prompt, context) };
    if (node.kind === 'end') return { ...node, message: pick(node.message, variants[node.id], context) };
    return node;
  });
  return { ...definition, nodes };
}
