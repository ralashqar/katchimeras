import type { ConversationDefinition } from '@/types/companion-conversation';
import { MOSSPROUT_GREETING_OPTIONS, MOSSPROUT_FTUE_COPY } from '@/features/onboarding/mossprout-ftue-copy';
import { mossproutFollowup } from '@/constants/companion-life-content';

export const MOSSPROUT_FTUE_CONVERSATION_PREFIX = 'mossprout:ftue:first-meeting';
export const MOSSPROUT_CHAPTER_ZERO_RETURN_CONVERSATION_ID = 'mossprout:ftue:chapter-zero-return';
export const MOSSPROUT_FIRST_REST_CONVERSATION_ID = 'mossprout:ftue:first-rest';

/**
 * The meeting opens on what the Egg heard (the hatch profile's own replies to the two answers), so the first thing
 * Mossprout says is about the player. One key: the answers shape the line, never the graph.
 */
const openingLines: Record<string, string> = {
  default: 'Your answers found me in the Mist. That is how I knew where to hatch.',
};

/** Opening-only wording; IDs still select the same optional personal activities. */
function openingFollowup(intent: string | null | undefined) {
  const original = mossproutFollowup(intent);
  const words: Record<string, [string, string]> = {
    demands: ['🍃 A corner where nothing needs me', 'Then this Garden will have a quiet corner. No requests from the ferns. I’ll have a word with them.'],
    busy_thoughts: ['🌿 Something simple to look after', 'One leaf, one small beginning. Heartwood can wait while we find our footing.'],
    pause: ['☁️ Somewhere to catch my breath', 'We’ll leave room for that. A home should welcome tired travellers too.'],
    easy_start: ['🌱 One small thing I can start', 'Our seed is excellent at being small. We’ll wake the Garden one thing at a time.'],
    self_care: ['🍵 A place to look after myself', 'Then this is your stop along the road as well as mine. Adventures need somewhere to come back to.'],
    care: ['🌼 Something I can help grow', 'You and me, then. I know the roots. You can tell me when I’m fussing over them.'],
    peaceful: ['🍃 A quiet place between adventures', 'A quiet Garden beside a long road. That sounds like somewhere I’d come home to.'],
    curious: ['🔎 A new discovery every visit', 'I can offer one mysterious root immediately. I have been trying to identify it for years.'],
    company: ['💛 A friend to share it with', 'Well. Here I am. Slightly mossy, but very pleased to meet you.'],
  };
  return { prompt: 'As we help Heartwood wake, this Garden will be our home. What would make it feel like yours?',
    options: original.options.map(option => ({ ...option, label: words[option.id][0], reply: words[option.id][1] })) };
}

function definition(key: string, opening: string): ConversationDefinition {
  return {
    id: `${MOSSPROUT_FTUE_CONVERSATION_PREFIX}:${key}`,
    version: 12,
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
    // One question, and the answer's reply is the way out: the reply, the seed and the Seed card on one screen, one tap.
    nodes: [
      {
        id: 'hello', kind: 'choice', phase: 'opening', prompt: `${opening}\n\nI’m Mossprout. That tree is Heartwood. Every path used to meet beneath it.`,
        options: MOSSPROUT_GREETING_OPTIONS.map((option) => ({ id: option.id, label: option.label, reply: '', nextNodeId: `end:${option.id}` })),
      },
      ...MOSSPROUT_GREETING_OPTIONS.map((option) => ({ id: `end:${option.id}`, kind: 'end' as const, message: `${option.reply}\n\n${MOSSPROUT_FTUE_COPY.seedOrigin}` })),
    ],
  };
}

export function resolveMossproutFtueConversation(definition: ConversationDefinition, intent: string | null | undefined, savedVersion: number, hatchInsight?: string) {
  if (!definition.id.startsWith(MOSSPROUT_FTUE_CONVERSATION_PREFIX)) return definition;
  if (savedVersion >= 12) {
    return { ...definition, nodes: definition.nodes.map((node) => node.id === 'hello' && node.kind === 'choice' && hatchInsight
      ? { ...node, prompt: `${hatchInsight}\n\nI’m Mossprout. That tree is Heartwood. Every path used to meet beneath it.` }
      : node) };
  }
  const followup = savedVersion >= 11 ? openingFollowup(intent) : mossproutFollowup(intent);
  // New meetings connect the player’s intention to the Seed before planting.
  // Keep older sessions on their saved route, including the v8 follow-up.
  const hasFollowup = savedVersion === 8 || savedVersion >= 10;
  return { ...definition, nodes: [...definition.nodes.filter((node) => node.id !== 'followup'), ...(hasFollowup ? [{ id: 'followup', kind: 'choice' as const, prompt: followup.prompt, options: [] }] : [])].map((node) => {
    if (node.id === 'hello' && node.kind === 'choice') return { ...node, ...(hatchInsight ? { prompt: `${hatchInsight}\n\nI’m Mossprout. That great tree is Heartwood. Every path used to meet beneath it.` } : {}), options: node.options.map((option) => ({ ...option, nextNodeId: hasFollowup ? 'followup' : 'end' })) };
    if (node.id !== 'followup') return node;
    return { id: 'followup', kind: 'choice' as const, prompt: savedVersion >= 11 ? followup.prompt : `${hatchInsight && !intent ? 'We can grow a small beginning together.' : intent?.replace('desired-help:', '') === 'calm' ? 'You said a little calm would feel good.' : intent?.replace('desired-help:', '') === 'unsure' ? 'You said you weren’t sure what would feel good yet. That’s all right.' : 'You said a little progress would feel good.'}\n\n${followup.prompt}`, options: followup.options.map((option) => ({ id: `life:${option.id}`, label: option.label, reply: option.reply, nextNodeId: 'end' })) };
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
      prompt: 'You came back. The Mist hates that.',
      options: [{ id: 'see-change', label: 'See what changed', reply: 'Something from your world changed mine. Come and look.', nextNodeId: 'end' }],
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
      prompt: 'There. Now the garden remembers what we started.',
      options: [{ id: 'continue', label: 'Stay with Mossprout', reply: 'That was a lot of growing for one day. A lot of remembering, too.', nextNodeId: 'roots' }],
    },
    {
      id: 'roots', kind: 'choice', phase: 'deepen',
      prompt: 'I need to rest. Roots do, after they grow.',
      options: [{ id: 'rest', label: 'Rest, Mossprout', reply: 'When I wake, tell me what you’d like us to grow next. And keep looking. It’s what holds the Mist off.', nextNodeId: 'end' }],
    },
    { id: 'end', kind: 'end', message: 'I’ll keep your Memory close. It won’t be forgotten here.' },
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
