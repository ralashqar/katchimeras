import type { ConversationDefinition } from '@/types/companion-conversation';

export const MOSSPROUT_FTUE_CONVERSATION_PREFIX = 'mossprout:ftue:first-meeting';

const openingLines: Record<string, string> = {
  outside: 'You brought the outside with you. I could feel the air tapping on my shell.',
  family: 'There were people close to you today. Their warmth reached all the way into my shell.',
  friends: 'Your friends made today feel busy-bright. It rattled the leaves I do not have yet.',
  relaxing: 'Your quiet found me in there. It felt like moss after rain.',
  work: 'You carried a lot today. I felt it humming through the shell.',
  tired: 'You are tired. I felt the day land heavily. We will grow something small.',
  rough: 'That day had thorns. Thank you for giving me a piece of it anyway.',
  home: 'Home reached me first. That seems like a good place to start.',
  default: 'Those pieces of your day found me in the dark. That is how I knew where to hatch.',
};

function definition(key: string, opening: string): ConversationDefinition {
  return {
    id: `${MOSSPROUT_FTUE_CONVERSATION_PREFIX}:${key}`,
    version: 2,
    familyId: 'mossprout',
    title: 'A little place to begin',
    trigger: 'evergreen',
    minimumBondLevel: 1,
    cooldownDays: 3650,
    contextualOnly: true,
    isOpener: true,
    format: 'opener',
    tags: ['ftue', 'story', 'first-meeting'],
    entryNodeId: 'remembered',
    nodes: [
      {
        id: 'remembered', kind: 'choice', phase: 'opening', prompt: opening,
        options: [{ id: 'felt-that', label: 'You felt that?', reply: 'Every bit. Days seem to turn into something alive around you.', nextNodeId: 'arrived' }],
      },
      {
        id: 'arrived', kind: 'choice', phase: 'explore',
        prompt: 'I meant to arrive with a garden. The doorway disagreed. I have two Seeds and a very empty patch.',
        options: [
          { id: 'small-start', label: 'We can start with two Seeds.', reply: 'Exactly. Small beginnings are still beginnings.', nextNodeId: 'plan' },
          { id: 'not-much', label: 'That is not much of a garden.', reply: "Not yet. 'Not yet' is one of my favourite kinds of magic.", nextNodeId: 'plan' },
        ],
      },
      {
        id: 'plan', kind: 'choice', phase: 'resolve',
        prompt: 'First, a Sprout. Then a Plant tall enough to make this place feel like ours.',
        options: [{ id: 'grow', label: 'Let’s grow them.', reply: 'I will keep both requests where we can see them.', nextNodeId: 'end' }],
      },
      { id: 'end', kind: 'end', message: 'Two little requests. One garden waiting.' },
    ],
  };
}

export const mossproutFtueConversationDefinitions: readonly ConversationDefinition[] = Object.entries(openingLines)
  .map(([key, opening]) => definition(key, opening));

export function mossproutFtueConversationDefinitionId(key: string) {
  return `${MOSSPROUT_FTUE_CONVERSATION_PREFIX}:${key in openingLines ? key : 'default'}`;
}
