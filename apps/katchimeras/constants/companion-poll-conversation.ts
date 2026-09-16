import { spokenAnswerText } from '@/utils/companion-conversation';
import type { ConversationDefinition, ConversationPollSeed, ConversationV2FamilyId } from '@/types/companion-conversation';

/**
 * The village poll builder, on its own so a journey episode can compile a
 * poll beat without importing the whole catalog (which imports the episodes).
 */
/** Fictional village splits by answer count; rotated per poll so the same slot does not always win. */
const POLL_WEIGHTS: Readonly<Record<number, readonly number[]>> = { 2: [58, 42], 3: [42, 34, 24], 4: [36, 28, 21, 15], 5: [30, 24, 19, 15, 12] };

const endNode = (message: string) => ({ id: 'end', kind: 'end' as const, message });

export function poll(
  familyId: ConversationV2FamilyId,
  seed: ConversationPollSeed,
  index: number
): ConversationDefinition {
  const weights = POLL_WEIGHTS[seed.labels.length] ?? POLL_WEIGHTS[3]!;
  const pollOptions = seed.labels.map((label, optionIndex) => {
    const traits = seed.traits?.[optionIndex];
    const spokenText = spokenAnswerText(label);
    return {
      id: `choice-${optionIndex + 1}`,
      label,
      ...(spokenText ? { spokenText } : {}),
      reply: seed.replies?.[optionIndex] ?? (optionIndex === 0
        ? `I thought ${label.toLowerCase()} might win you over.`
        : optionIndex === 1
          ? `A good choice. ${label} has a loyal little corner of the village.`
          : `You picked ${label.toLowerCase()}. I like the less obvious answer.`),
      nextNodeId: 'end',
      villageWeight: weights[(optionIndex + index) % weights.length]!,
      ...(traits ? { traits } : {}),
    };
  });
  return {
    id: `${familyId}:poll:${seed.id}`,
    version: 2,
    familyId,
    title: seed.title ?? seed.prompt,
    trigger: 'poll',
    minimumBondLevel: seed.bond ?? 1,
    cooldownDays: 14,
    tags: ['play', 'preferences'],
    format: 'poll',
    entryNodeId: 'poll',
    nodes: [
      { id: 'poll', kind: 'poll', prompt: seed.prompt, helperText: seed.replies ? 'The village answers too. Just for fun.' : 'Pick quickly. The village result is just for fun.', options: pollOptions, nextNodeId: 'end' },
      endNode(seed.ending ?? 'That one belongs in the village ledger now.'),
    ],
  };
}

/** A friend's daily questions: their scenario polls, one served a day. */
export function familyPack(familyId: ConversationV2FamilyId, polls: readonly ConversationPollSeed[]): ConversationDefinition[] {
  return polls.map((seed, index) => poll(familyId, seed, index));
}
