import type { ConversationDefinition } from '@/types/companion-conversation';

export const MOSSPROUT_FTUE_CONVERSATION_PREFIX = 'mossprout:ftue:first-meeting';
export const MOSSPROUT_CHAPTER_ZERO_RETURN_CONVERSATION_ID = 'mossprout:ftue:chapter-zero-return';

const openingLines: Record<string, string> = {
  more_energy: 'You said you wanted more energy. This garden definitely does.',
  more_calm: 'You said you wanted more calm. I think this place could use some too.',
  something_new: 'You wanted something new. Well… this is pretty new.',
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
    version: 5,
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
    entryNodeId: 'hello',
    nodes: [
      {
        id: 'hello', kind: 'choice', phase: 'opening', prompt: '…Oh.\nI was hoping it would look better out here.\nI’m Mossprout.',
        options: [
          { id: 'hello', label: 'Hi Mossprout.', reply: 'Hi.', nextNodeId: 'stuck' },
          { id: 'what-happened', label: 'What happened here?', reply: 'I wish I knew.', nextNodeId: 'stuck' },
          { id: 'tiny', label: 'You’re tiny.', reply: 'The garden is also enormous. Both things can be true.', nextNodeId: 'stuck' },
        ],
      },
      {
        id: 'stuck', kind: 'choice', phase: 'deepen',
        prompt: 'This place used to grow.\nNow everything seems stuck.\nDo you ever feel like that?',
        options: [
          { id: 'sometimes', label: 'Sometimes.', reply: 'Then maybe we can figure some things out together.', nextNodeId: 'remembered' },
          { id: 'not-really', label: 'Not really.', reply: 'Then maybe you can help me figure it out.', nextNodeId: 'remembered' },
          { id: 'all-the-time', label: 'All the time.', reply: 'Then maybe we can figure some things out together.', nextNodeId: 'remembered' },
        ],
      },
      {
        id: 'remembered', kind: 'choice', phase: 'resolve',
        prompt: opening,
        options: [{ id: 'continue', label: 'Continue', reply: 'Maybe this place can grow again.', nextNodeId: 'end' }],
      },
      { id: 'end', kind: 'end', message: 'Let’s start with something small.' },
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
      prompt: 'It worked. Maybe this place can grow again.',
      options: [{ id: 'see-change', label: 'See what changed', reply: 'The first bloom belongs in the Grove.', nextNodeId: 'end' }],
    },
    { id: 'end', kind: 'end', message: 'Come on. You should see it from the Haven.' },
  ],
};

export const mossproutFtueConversationDefinitions: readonly ConversationDefinition[] = [
  ...Object.entries(openingLines).map(([key, opening]) => definition(key, opening)),
  chapterZeroReturnDefinition,
];

export function mossproutFtueConversationDefinitionId(key: string) {
  return `${MOSSPROUT_FTUE_CONVERSATION_PREFIX}:${key in openingLines ? key : 'default'}`;
}
