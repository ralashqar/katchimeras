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
    version: 3,
    familyId: 'mossprout',
    title: 'A little place to begin',
    trigger: 'evergreen',
    minimumBondLevel: 1,
    cooldownDays: 3650,
    contextualOnly: true,
    isOpener: true,
    format: 'opener',
    purpose: 'journey',
    returnTarget: 'garden',
    repeatPolicy: 'once_ever',
    topicKey: 'first-meeting',
    tags: ['ftue', 'story', 'first-meeting'],
    entryNodeId: 'remembered',
    nodes: [
      {
        id: 'remembered', kind: 'choice', phase: 'opening', prompt: opening,
        options: [{ id: 'felt-that', label: 'You felt that?', reply: 'Every bit. Days seem to turn into something alive around you.', nextNodeId: 'arrived' }],
      },
      {
        id: 'arrived', kind: 'choice', phase: 'explore',
        prompt: 'I meant to arrive with a garden. The doorway disagreed. I have two Seeds, an empty patch, and several extremely confident weeds.',
        options: [
          { id: 'small-start', label: 'We can start with two Seeds.', reply: 'Exactly. Small beginnings are still beginnings.', nextNodeId: 'purpose' },
          { id: 'not-much', label: 'That is not much of a garden.', reply: "Not yet. 'Not yet' is one of my favourite kinds of magic.", nextNodeId: 'purpose' },
        ],
      },
      {
        id: 'purpose', kind: 'choice', phase: 'deepen',
        prompt: 'I do not want to rebuild the old garden exactly. I want this one to learn from the days you bring here. What should it give back to you?',
        options: [
          { id: 'quiet', label: 'A quiet place', reply: 'Then we will leave room for stillness. Even the weeds may whisper.', nextNodeId: 'plan' },
          { id: 'surprise', label: 'Little surprises', reply: 'Excellent. Gardens should occasionally behave like they know a secret.', nextNodeId: 'plan' },
          { id: 'change', label: 'Proof things can change', reply: 'Then every new leaf can be evidence. Small evidence still counts.', nextNodeId: 'plan' },
        ],
      },
      {
        id: 'plan', kind: 'choice', phase: 'resolve',
        prompt: 'The mist kept a Dream Echo of a Plant that used to grow here. Make a Sprout, match it to the sleeping Echo, and we can wake its shape into something real.',
        options: [{ id: 'grow', label: 'Let’s wake it.', reply: 'Two Seeds, one Sprout, one half-remembered Plant. I will keep the request where we can see it.', nextNodeId: 'end' }],
      },
      { id: 'end', kind: 'end', message: 'The first Plant is waiting inside the mist.' },
    ],
  };
}

const chapterZeroReturnDefinition: ConversationDefinition = {
  id: MOSSPROUT_CHAPTER_ZERO_RETURN_CONVERSATION_ID,
  version: 4,
  familyId: 'mossprout',
  title: 'A little place to begin',
  trigger: 'evergreen',
  minimumBondLevel: 1,
  cooldownDays: 3650,
  contextualOnly: true,
  isOpener: true,
  format: 'narrative',
  purpose: 'journey',
  returnTarget: 'character_home',
  repeatPolicy: 'once_ever',
  topicKey: 'chapter-zero-return',
  tags: ['ftue', 'story', 'chapter-zero-return'],
  entryNodeId: 'home',
  nodes: [
    {
      id: 'home', kind: 'choice', phase: 'opening',
      prompt: 'You did it. I put the Plant by the door. It already looks braver out here.',
      options: [{ id: 'made-together', label: 'We made it together.', reply: 'Then it has very good roots.', nextNodeId: 'promise' }],
    },
    {
      id: 'promise', kind: 'choice', phase: 'resolve',
      prompt: 'Before we go: what should this garden always make room for?',
      options: [
        { id: 'promise-quiet', label: 'Quiet', reply: 'Then we will never fill every corner.', nextNodeId: 'end' },
        { id: 'promise-surprise', label: 'Surprise', reply: 'Good. I will distrust any path that behaves too sensibly.', nextNodeId: 'end' },
        { id: 'promise-care', label: 'Care', reply: 'Then everything we grow will have a reason beyond looking pretty.', nextNodeId: 'end' },
      ],
    },
    { id: 'end', kind: 'end', message: 'The first Plant is home. Mossprout keeps your promise for the road ahead.' },
  ],
};

export const mossproutFtueConversationDefinitions: readonly ConversationDefinition[] = [
  ...Object.entries(openingLines).map(([key, opening]) => definition(key, opening)),
  chapterZeroReturnDefinition,
];

export function mossproutFtueConversationDefinitionId(key: string) {
  return `${MOSSPROUT_FTUE_CONVERSATION_PREFIX}:${key in openingLines ? key : 'default'}`;
}
