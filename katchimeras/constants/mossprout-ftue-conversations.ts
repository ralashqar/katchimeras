import type { ConversationDefinition } from '@/types/companion-conversation';
import { MOSSPROUT_GREETING_OPTIONS, MOSSPROUT_FTUE_COPY } from '@/features/onboarding/mossprout-ftue-copy';
import { mossproutFollowup } from '@/constants/companion-life-content';

export const MOSSPROUT_FTUE_CONVERSATION_PREFIX = 'mossprout:ftue:first-meeting';
export const MOSSPROUT_CHAPTER_ZERO_RETURN_CONVERSATION_ID = 'mossprout:ftue:chapter-zero-return';
export const MOSSPROUT_FIRST_REST_CONVERSATION_ID = 'mossprout:ftue:first-rest';

const openingLines: Record<string, string> = {
  trying_to_start: 'Oh! Getting started can be tricky. Hatching took me a while too.',
  too_much_at_once: 'There was a lot happening outside my shell. We can start with one thing.',
  pretty_good: 'So that little patch of sunshine was you.',
  mostly_drifting: 'Oh! I felt the breeze carrying us along. Drifting can still bring you somewhere new.',
  taking_today_as_it_comes: 'Seeing where the day takes us? I’ve only just acquired feet. Excellent timing.',
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
    version: 8,
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
        options: MOSSPROUT_GREETING_OPTIONS.map((option) => ({ ...option, nextNodeId: 'followup' })),
      },
      { id: 'followup', kind: 'choice', prompt: mossproutFollowup('progress').prompt,
        options: mossproutFollowup('progress').options.map((option) => ({ id: `life:${option.id}`, label: option.label, reply: option.reply, nextNodeId: 'end' })) },
      { id: 'end', kind: 'end', message: MOSSPROUT_FTUE_COPY.seedOrigin },
    ],
  };
}

export function resolveMossproutFtueConversation(definition: ConversationDefinition, intent: string | null | undefined, savedVersion: number) {
  if (!definition.id.startsWith(MOSSPROUT_FTUE_CONVERSATION_PREFIX)) return definition;
  const followup = mossproutFollowup(intent);
  return { ...definition, nodes: definition.nodes.filter((node) => savedVersion >= 8 || node.id !== 'followup').map((node) => {
    if (node.id === 'hello' && node.kind === 'choice' && savedVersion < 8) return { ...node, options: node.options.map((option) => ({ ...option, nextNodeId: 'end' })) };
    if (node.id !== 'followup') return node;
    return { id: 'followup', kind: 'choice' as const, prompt: followup.prompt, options: followup.options.map((option) => ({ id: `life:${option.id}`, label: option.label, reply: option.reply, nextNodeId: 'end' })) };
  }) };
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
