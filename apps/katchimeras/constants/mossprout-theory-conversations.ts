import type { ConversationDefinition } from '@/types/companion-conversation';
import { MOSSPROUT_THEORY_OBSERVATIONS, theoryDefinitionId } from '@/utils/companion-theory';

/**
 * "Mossprout thinks he knows you": one short conversation per observation. He
 * says what he has put together from the player's answers, and the player
 * tells him whether he is right. The answer is evidence in its own right (see
 * utils/companion-theory.ts), and the exchange is kept in the journal. Never
 * picked from a pool: the Kingdom offers it once the theory has enough behind it.
 */
export const MOSSPROUT_THEORY_TITLE = 'Mossprout thinks he knows you';

export const mossproutTheoryConversationDefinitions: readonly ConversationDefinition[] = MOSSPROUT_THEORY_OBSERVATIONS.map((observation) => ({
  id: theoryDefinitionId(observation.id),
  version: 1,
  familyId: 'mossprout',
  title: MOSSPROUT_THEORY_TITLE,
  actionTitle: MOSSPROUT_THEORY_TITLE,
  trigger: 'evergreen',
  minimumBondLevel: 2,
  cooldownDays: 3650,
  contextualOnly: true,
  format: 'narrative',
  purpose: 'learned_insight',
  returnTarget: 'character_home',
  repeatPolicy: 'once_ever',
  topicKey: `theory:${observation.id}`,
  tags: ['mossprout', 'theory'],
  entryNodeId: 'confirm',
  nodes: [
    {
      id: 'confirm', kind: 'choice', phase: 'resolve',
      prompt: `I think I’ve figured something out about you.\n\n${observation.text}`,
      options: [
        { id: 'very_me', label: '🌱 That’s very me', spokenText: 'That’s very me', reply: 'Thought so. I’ll remember it.', nextNodeId: 'end' },
        { id: 'sometimes', label: '🌿 Sometimes', spokenText: 'Sometimes', reply: 'Sometimes is honest. I’ll hold it loosely.', nextNodeId: 'end' },
        { id: 'not_really', label: '🍂 Not really', spokenText: 'Not really', reply: 'Then I’ve got that wrong. Good. I’d rather know.', nextNodeId: 'end' },
      ],
    },
    { id: 'end', kind: 'end', message: 'Keep answering. I keep learning.' },
  ],
}));
