import type { ConversationDefinition } from '@/types/companion-conversation';

export const MOSSPROUT_FTUE_CONVERSATION_PREFIX = 'mossprout:ftue:first-meeting';
export const MOSSPROUT_CHAPTER_ZERO_RETURN_CONVERSATION_ID = 'mossprout:ftue:chapter-zero-return';

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

const chapterZeroReturnDefinition: ConversationDefinition = {
  id: MOSSPROUT_CHAPTER_ZERO_RETURN_CONVERSATION_ID,
  version: 1,
  familyId: 'mossprout',
  title: 'A little place to begin',
  trigger: 'evergreen',
  minimumBondLevel: 1,
  cooldownDays: 3650,
  contextualOnly: true,
  isOpener: true,
  format: 'opener',
  tags: ['ftue', 'story', 'chapter-zero-return'],
  entryNodeId: 'home',
  nodes: [
    {
      id: 'home', kind: 'choice', phase: 'opening',
      prompt: 'You did it. I put the Plant by the door. It already thinks it owns the place.',
      options: [
        { id: 'looks-home', label: 'It looks like home.', reply: 'Our first little corner of it.', nextNodeId: 'wisp' },
        { id: 'made-together', label: 'We made it together.', reply: 'Then it has very good roots.', nextNodeId: 'wisp' },
      ],
    },
    {
      id: 'wisp', kind: 'choice', phase: 'explore',
      prompt: 'And this Wisp was tucked beneath it—a bright little piece of your story.',
      options: [{ id: 'keep-it', label: 'Let’s keep it safe.', reply: 'Close by. Things grow better when they are remembered.', nextNodeId: 'footprints' }],
    },
    {
      id: 'footprints', kind: 'choice', phase: 'explore',
      prompt: 'Wait. Those marks beyond the mist… they are definitely not mine.',
      options: [
        { id: 'follow', label: 'Should we follow them?', reply: 'Soon. First, we make sure they have somewhere lovely to lead back to.', nextNodeId: 'water' },
        { id: 'someone-else', label: 'Someone else is here.', reply: 'I hoped the world felt bigger than this doorway.', nextNodeId: 'water' },
      ],
    },
    {
      id: 'water', kind: 'choice', phase: 'resolve',
      prompt: 'The Wild Garden has started carrying Pebbles now. With enough of them, we can make a Shell and catch the rain.',
      options: [{ id: 'see-water', label: 'Let’s see what the water brings.', reply: 'A rain garden. That sounds like our next beginning.', nextNodeId: 'end' }],
    },
    { id: 'end', kind: 'end', message: 'A new trail waits beyond the garden.' },
  ],
};

export const mossproutFtueConversationDefinitions: readonly ConversationDefinition[] = [
  ...Object.entries(openingLines).map(([key, opening]) => definition(key, opening)),
  chapterZeroReturnDefinition,
];

export function mossproutFtueConversationDefinitionId(key: string) {
  return `${MOSSPROUT_FTUE_CONVERSATION_PREFIX}:${key in openingLines ? key : 'default'}`;
}
