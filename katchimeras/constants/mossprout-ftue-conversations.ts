import type { ConversationDefinition } from '@/types/companion-conversation';

export const MOSSPROUT_FTUE_CONVERSATION_PREFIX = 'mossprout:ftue:first-meeting';
export const MOSSPROUT_CHAPTER_ZERO_RETURN_CONVERSATION_ID = 'mossprout:ftue:chapter-zero-return';
export const MOSSPROUT_FIRST_REST_CONVERSATION_ID = 'mossprout:ftue:first-rest';

const openingLines: Record<string, string> = {
  trying_to_start: 'Oh! I felt that in there. Like a little root pushing against hard soil.',
  too_much_at_once: 'Oh! I felt the rain drumming on my shell. We don’t have to hold all of it at once.',
  pretty_good: 'Oh! I felt that warm patch of sunlight. I think it helped me hatch.',
  mostly_drifting: 'Oh! I felt the breeze carrying us along. Drifting can still bring you somewhere new.',
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
    version: 6,
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
        id: 'hello', kind: 'choice', phase: 'opening', prompt: `${opening}\n\nI’m Mossprout.`,
        options: [
          { id: 'hello', label: 'Hi Mossprout.', reply: 'Hi. I’m glad it was your moment that found me.', nextNodeId: 'end' },
          { id: 'garden', label: 'What happened here?', reply: 'It fell quiet. Maybe we can wake one piece of it together.', nextNodeId: 'end' },
          { id: 'tiny', label: 'You’re tiny.', reply: 'The garden is enormous. Both things can be true.', nextNodeId: 'end' },
        ],
      },
      { id: 'end', kind: 'end', message: 'Tell me one more thing, then let’s start with something small.' },
    ],
  };
}

const chapterZeroReturnDefinition: ConversationDefinition = {
  id: MOSSPROUT_CHAPTER_ZERO_RETURN_CONVERSATION_ID,
  version: 7,
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
      prompt: 'It worked. Something from your world changed mine.',
      options: [{ id: 'see-change', label: 'See what changed', reply: 'The first bloom belongs in our Grove.', nextNodeId: 'end' }],
    },
    { id: 'end', kind: 'end', message: 'There’s one little thing I want to ask before I rest.' },
  ],
};

const firstRestDefinition: ConversationDefinition = {
  id: MOSSPROUT_FIRST_REST_CONVERSATION_ID,
  version: 1,
  familyId: 'mossprout',
  title: 'Roots need quiet',
  trigger: 'evergreen',
  minimumBondLevel: 1,
  cooldownDays: 3650,
  contextualOnly: true,
  isOpener: true,
  format: 'narrative',
  purpose: 'journey',
  returnTarget: 'character_home',
  repeatPolicy: 'once_ever',
  topicKey: 'first-rest',
  tags: ['ftue', 'story', 'first-rest'],
  entryNodeId: 'seed-settles',
  nodes: [
    {
      id: 'seed-settles', kind: 'choice', phase: 'opening',
      prompt: 'There. Now the Garden can remember what we started.',
      options: [{ id: 'continue', label: 'Stay with Mossprout', reply: 'That was a lot of growing for one day.', nextNodeId: 'roots' }],
    },
    {
      id: 'roots', kind: 'choice', phase: 'deepen',
      prompt: 'Roots need quiet after they grow.',
      options: [{ id: 'rest', label: 'Rest, Mossprout', reply: 'When I wake up, tell me what you’d like us to grow next.', nextNodeId: 'end' }],
    },
    { id: 'end', kind: 'end', message: 'I’ll keep our first Seed close.' },
  ],
};

export const mossproutFtueConversationDefinitions: readonly ConversationDefinition[] = [
  ...Object.entries(openingLines).map(([key, opening]) => definition(key, opening)),
  chapterZeroReturnDefinition,
  firstRestDefinition,
];

export function mossproutFtueConversationDefinitionId(key: string) {
  return `${MOSSPROUT_FTUE_CONVERSATION_PREFIX}:${key in openingLines ? key : 'default'}`;
}
