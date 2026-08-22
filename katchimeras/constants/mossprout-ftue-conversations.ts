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
  version: 3,
  familyId: 'mossprout',
  title: 'A little place to begin',
  trigger: 'evergreen',
  minimumBondLevel: 1,
  cooldownDays: 3650,
  contextualOnly: true,
  isOpener: true,
  format: 'insight_game',
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
      options: [
        { id: 'looks-home', label: 'It looks at home.', reply: 'Our first little corner of the world.', nextNodeId: 'changed' },
        { id: 'made-together', label: 'We made it together.', reply: 'Then it has very good roots.', nextNodeId: 'changed' },
      ],
    },
    {
      id: 'changed', kind: 'choice', phase: 'resolve',
      prompt: 'The whole clearing felt that tiny bit of growth. Come and see what our day changed.',
      options: [{ id: 'see-garden', label: 'Show me the garden.', reply: 'First, I want to know what kind of place we are growing for you.', nextNodeId: 'insight' }],
    },
    {
      id: 'insight', kind: 'insight_game', title: 'What should our garden become?', revealNodeId: 'reveal', questions: [
        { id: 'welcome', prompt: 'When you step outside, what helps you arrive?', options: [
          { id: 'rest-welcome', label: 'A quiet patch', reply: 'Some places welcome you by asking for nothing.', nextNodeId: null },
          { id: 'wonder-welcome', label: 'Something unexpected', reply: 'A surprise gives your attention somewhere cheerful to land.', nextNodeId: null },
          { id: 'tend-welcome', label: 'Something living nearby', reply: 'You notice that a place is full of neighbours.', nextNodeId: null },
        ] },
        { id: 'weather', prompt: 'A little rain starts. What sounds best?', options: [
          { id: 'rest-weather', label: 'Listen from somewhere sheltered', reply: 'A roof, rain, and no need to hurry.', nextNodeId: null },
          { id: 'wonder-weather', label: 'See what the rain changes', reply: 'Every surface tells a different rain story.', nextNodeId: null },
          { id: 'tend-weather', label: 'Check which plants look happiest', reply: 'Very considerate. Also excellent plant gossip.', nextNodeId: null },
        ] },
        { id: 'return', prompt: 'What would make you come back tomorrow?', options: [
          { id: 'rest-return', label: 'Knowing I could slow down there', reply: 'Then the garden should always leave a little room.', nextNodeId: null },
          { id: 'wonder-return', label: 'Wondering what changed', reply: 'Gardens are extremely slow magicians.', nextNodeId: null },
          { id: 'tend-return', label: 'Having something to look after', reply: 'Care gives a visit roots.', nextNodeId: null },
        ] },
        { id: 'gift', prompt: 'Choose one thing for our first corner to give back.', options: [
          { id: 'rest-gift', label: 'A calmer feeling', reply: 'A soft place for the day to settle.', nextNodeId: null },
          { id: 'wonder-gift', label: 'A tiny discovery', reply: 'Something small enough to miss if you rush.', nextNodeId: null },
          { id: 'tend-gift', label: 'A reason to care', reply: 'Then growing the garden can mean something beyond making it pretty.', nextNodeId: null },
        ] },
      ],
    },
    {
      id: 'reveal', kind: 'insight_reveal', title: 'What Mossprout learned from your first garden', insightKey: 'first-garden-purpose', category: 'Nature', nextNodeId: 'end', results: [
        { id: 'quiet-clearing', title: 'A Quiet Clearing', reflection: 'You want outdoor places to make room rather than make demands.', summary: 'The garden can become somewhere the volume comes down and your day is allowed to settle.', emblemId: 'mossprout-first-quiet', matchOptionIds: ['rest-welcome', 'rest-weather', 'rest-return', 'rest-gift'] },
        { id: 'curious-grove', title: 'A Curious Grove', reflection: 'Small changes and discoveries are what pull your attention into a place.', summary: 'The garden can stay a little surprising—alive with details that reward another look.', emblemId: 'mossprout-first-wonder', matchOptionIds: ['wonder-welcome', 'wonder-weather', 'wonder-return', 'wonder-gift'] },
        { id: 'shared-patch', title: 'A Shared Patch', reflection: 'A place matters more when it contains something living to notice and care for.', summary: 'The garden can grow through relationship: returning, tending, and learning its small inhabitants.', emblemId: 'mossprout-first-care', matchOptionIds: ['tend-welcome', 'tend-weather', 'tend-return', 'tend-gift'] },
      ],
    },
    { id: 'end', kind: 'end', message: 'Your first Plant has somewhere to grow—and now Mossprout knows what kind of garden to grow around it.' },
  ],
};

export const mossproutFtueConversationDefinitions: readonly ConversationDefinition[] = [
  ...Object.entries(openingLines).map(([key, opening]) => definition(key, opening)),
  chapterZeroReturnDefinition,
];

export function mossproutFtueConversationDefinitionId(key: string) {
  return `${MOSSPROUT_FTUE_CONVERSATION_PREFIX}:${key in openingLines ? key : 'default'}`;
}
