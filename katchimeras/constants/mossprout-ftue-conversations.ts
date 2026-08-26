import type { ConversationDefinition } from '@/types/companion-conversation';

export const MOSSPROUT_FTUE_CONVERSATION_PREFIX = 'mossprout:ftue:first-meeting';
export const MOSSPROUT_CHAPTER_ZERO_RETURN_CONVERSATION_ID = 'mossprout:ftue:chapter-zero-return';

const openingLines: Record<string, string> = {
  calm: 'I felt a quiet glow in my shell.',
  encouragement: 'I felt a brave little spark in my shell.',
  fun: 'I heard something bright and playful outside.',
  company: 'I could tell you wanted someone to share the day with.',
  discovery: 'I felt your curiosity tapping on my shell.',
  outside: 'You brought the outside with you. I could feel the air tapping on my shell.',
  family: 'There were people close to you today. Their warmth reached my shell.',
  friends: 'Your friends made today feel busy-bright.',
  relaxing: 'Your quiet found me in there. It felt like moss after rain.',
  work: 'You carried a lot today. I felt it humming through the shell.',
  tired: 'You are tired. We will grow something small.',
  rough: 'That day had thorns. Thank you for sharing a piece of it.',
  home: 'Home reached me first. That seems like a good place to start.',
  default: 'Your answers found me in the dark. That is how I knew where to hatch.',
};

function definition(key: string, opening: string): ConversationDefinition {
  return {
    id: `${MOSSPROUT_FTUE_CONVERSATION_PREFIX}:${key}`,
    version: 4,
    familyId: 'mossprout',
    title: 'Meet Mossprout',
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
        id: 'remembered', kind: 'choice', phase: 'opening', prompt: `Hi! I’m Mossprout. ${opening}`,
        options: [{ id: 'hello', label: 'Hi, Mossprout!', reply: 'I grow a garden from the little things we do together.', nextNodeId: 'ask_name' }],
      },
      { id: 'ask_name', kind: 'end', message: 'There is one thing I want to know first.' },
    ],
  };
}

const chapterZeroReturnDefinition: ConversationDefinition = {
  id: MOSSPROUT_CHAPTER_ZERO_RETURN_CONVERSATION_ID,
  version: 6,
  familyId: 'mossprout',
  title: 'Our first Sprout',
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
      prompt: 'It already feels brighter! Someone nearby heard us too.',
      options: [{ id: 'meet-them', label: 'Who is it?', reply: 'Your answers found someone who likes the same kind of nature.', nextNodeId: 'end' }],
    },
    { id: 'end', kind: 'end', message: 'A parcel is waiting in the garden.' },
  ],
};

export const mossproutFtueConversationDefinitions: readonly ConversationDefinition[] = [
  ...Object.entries(openingLines).map(([key, opening]) => definition(key, opening)),
  chapterZeroReturnDefinition,
];

export function mossproutFtueConversationDefinitionId(key: string) {
  return `${MOSSPROUT_FTUE_CONVERSATION_PREFIX}:${key in openingLines ? key : 'default'}`;
}
