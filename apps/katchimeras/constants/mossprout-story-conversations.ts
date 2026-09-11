import type { ConversationDefinition, ConversationProfileQuestion, ConversationTraitTags } from '@/types/companion-conversation';
import type { KatchimeraSkinId } from '@/types/katchimera';
import { spokenAnswerText } from '@/utils/companion-conversation';

const MOSS_FORMS = [
  'petalimp', 'fernip', 'amberleaf', 'blossle',
  'drizzlet', 'driftkin', 'tempesto', 'mistle',
] as const satisfies readonly KatchimeraSkinId[];
const MOSSPROUT_DRY_POND_BEAT_IDS = ['dry-pond:day-1', 'dry-pond:day-2', 'dry-pond:day-3', 'dry-pond:day-4'] as const;

function journeyConversation(id: string, title: string, prompt: string, label: string, reply: string, ending: string): ConversationDefinition {
  return {
    id, version: 3, familyId: 'mossprout', title, trigger: 'evergreen', minimumBondLevel: 1,
    cooldownDays: 3650, contextualOnly: true, format: 'narrative', purpose: 'journey',
    returnTarget: 'character_home', repeatPolicy: 'once_ever', topicKey: id, tags: ['story', 'mossprout', 'dry-pond'], entryNodeId: 'opening',
    nodes: [
      { id: 'opening', kind: 'choice', phase: 'opening', prompt, options: [{ id: 'continue', label, reply, nextNodeId: 'end' }] },
      { id: 'end', kind: 'end', message: ending },
    ],
  };
}

function journeyInsightConversation(id: string, title: string, setting: string, insightKey: string): ConversationDefinition {
  const calm = `${insightKey}:calm`;
  const curious = `${insightKey}:curious`;
  const caring = `${insightKey}:caring`;
  return {
    id, version: 4, familyId: 'mossprout', title, trigger: 'evergreen', minimumBondLevel: 1,
    cooldownDays: 3650, contextualOnly: true, format: 'insight_game', purpose: 'journey',
    returnTarget: 'character_home', repeatPolicy: 'once_ever', topicKey: insightKey,
    tags: ['story', 'mossprout', 'dry-pond', 'insight'], entryNodeId: 'game', nodes: [
      { id: 'game', kind: 'insight_game', title, revealNodeId: 'reveal', questions: [
        { id: 'arrive', prompt: `${setting} What would you notice first?`, options: [
          { id: `${calm}:1`, label: 'How the place feels', reply: 'You listen to the atmosphere before asking it for anything.', nextNodeId: null },
          { id: `${curious}:1`, label: 'What has changed', reply: 'A familiar place is never quite finished.', nextNodeId: null },
          { id: `${caring}:1`, label: 'What might need care', reply: 'You notice the lives inside a place, not only the scenery.', nextNodeId: null },
        ] },
        { id: 'stay', prompt: 'What makes an outdoor moment worth staying for?', options: [
          { id: `${calm}:2`, label: 'A little quiet', reply: 'Quiet can make a small visit feel spacious.', nextNodeId: null },
          { id: `${curious}:2`, label: 'Something unexpected', reply: 'Curiosity has excellent roots.', nextNodeId: null },
          { id: `${caring}:2`, label: 'Feeling connected to it', reply: 'Attention is one way a place becomes shared.', nextNodeId: null },
        ] },
        { id: 'weather', prompt: 'The weather changes halfway through. What do you do?', options: [
          { id: `${calm}:3`, label: 'Find somewhere sheltered', reply: 'Still outside, just held a little more gently.', nextNodeId: null },
          { id: `${curious}:3`, label: 'See what it changes', reply: 'Rain and wind redraw a place very quickly.', nextNodeId: null },
          { id: `${caring}:3`, label: 'Check on the growing things', reply: 'You are already thinking like a garden neighbour.', nextNodeId: null },
        ] },
        { id: 'keep', prompt: 'What would you bring back from the visit?', options: [
          { id: `${calm}:4`, label: 'A steadier feeling', reply: 'Something quiet enough to carry home.', nextNodeId: null },
          { id: `${curious}:4`, label: 'One strange detail', reply: 'The best souvenirs sometimes fit in a sentence.', nextNodeId: null },
          { id: `${caring}:4`, label: 'A reason to return', reply: 'Returning turns noticing into a relationship.', nextNodeId: null },
        ] },
      ] },
      { id: 'reveal', kind: 'insight_reveal', title: 'What Mossprout noticed about you', insightKey, category: 'Nature', nextNodeId: 'end', results: [
        { id: 'quiet-root', title: 'A Quiet Root', reflection: 'You seem to meet nature as somewhere the volume can come down.', summary: 'Outdoor places give you room, atmosphere and a steadier feeling to carry back.', emblemId: 'mossprout-quiet-root', matchOptionIds: [`${calm}:1`, `${calm}:2`, `${calm}:3`, `${calm}:4`] },
        { id: 'wandering-eye', title: 'A Wandering Eye', reflection: 'You meet the outdoors with your attention awake.', summary: 'Change, odd details and small discoveries make a place feel alive to you.', emblemId: 'mossprout-wandering-eye', matchOptionIds: [`${curious}:1`, `${curious}:2`, `${curious}:3`, `${curious}:4`] },
        { id: 'garden-neighbour', title: 'A Garden Neighbour', reflection: 'You notice the other lives sharing an outdoor place.', summary: 'Nature becomes meaningful through attention, care and reasons to return.', emblemId: 'mossprout-garden-neighbour', matchOptionIds: [`${caring}:1`, `${caring}:2`, `${caring}:3`, `${caring}:4`] },
      ] },
      { id: 'end', kind: 'end', message: 'Mossprout tucks that thought beside the pond. Now, there is something here we can help with.' },
    ],
  };
}

function journeyGoalConversation(prefix: string, title: string): ConversationDefinition {
  return {
    id: `${prefix}:goal-plan`, version: 4, familyId: 'mossprout', title, trigger: 'evergreen', minimumBondLevel: 1,
    cooldownDays: 3650, contextualOnly: true, format: 'narrative', purpose: 'planning', returnTarget: 'character_home',
    repeatPolicy: 'once_ever', topicKey: `${prefix}:goal-plan`, tags: ['mossprout', 'goals', 'journey'], entryNodeId: 'time', nodes: [
      { id: 'time', kind: 'choice', phase: 'explore', prompt: 'How much room does real life have for nature right now?', options: [
        { id: 'minute', label: 'About one minute', reply: 'A minute is enough to notice that the world is alive.', nextNodeId: 'place' },
        { id: 'little', label: 'A small pocket of time', reply: 'Small pockets can hold surprisingly good things.', nextNodeId: 'place' },
        { id: 'outing', label: 'I could make an outing of it', reply: 'Then we can give curiosity slightly muddier shoes.', nextNodeId: 'place' },
      ] },
      { id: 'place', kind: 'choice', phase: 'deepen', prompt: 'Where would it fit most naturally?', options: [
        { id: 'home', label: 'At home', reply: 'Windowsills and doorsteps still count as habitat.', nextNodeId: 'mood' },
        { id: 'route', label: 'On a route I already take', reply: 'No extra expedition required.', nextNodeId: 'mood' },
        { id: 'green', label: 'Somewhere properly green', reply: 'A place with enough leaves to interrupt your thoughts.', nextNodeId: 'mood' },
      ] },
      { id: 'mood', kind: 'choice', phase: 'resolve', prompt: 'What would feel kind rather than demanding?', options: [
        { id: 'notice', label: 'Notice one living detail', reply: 'One detail. No report required.', nextNodeId: 'goals-notice' },
        { id: 'outside', label: 'Take a brief nature pause', reply: 'A pause is allowed to stay small.', nextNodeId: 'goals-outside' },
        { id: 'plant', label: 'Care for something growing', reply: 'A little tending makes attention visible.', nextNodeId: 'goals-plant' },
      ] },
      { id: 'goals-notice', kind: 'goal_proposal', prompt: 'Keep any of these gentle goals?', goalTypeId: 'mossprout:nature-connection', goalTitle: 'Spend a little time with the living world', summary: 'Choose none, one, or a few. These should fit your day—not take it over.', suggestedQuickGoalIds: ['mossprout:notice-living-thing', 'mossprout:step-outside', 'mossprout:care-for-plant'], nextNodeId: 'end' },
      { id: 'goals-outside', kind: 'goal_proposal', prompt: 'Keep any of these gentle goals?', goalTypeId: 'mossprout:nature-connection', goalTitle: 'Spend a little time with the living world', summary: 'Choose none, one, or a few. These should fit your day—not take it over.', suggestedQuickGoalIds: ['mossprout:step-outside', 'mossprout:notice-living-thing', 'mossprout:care-for-plant'], nextNodeId: 'end' },
      { id: 'goals-plant', kind: 'goal_proposal', prompt: 'Keep any of these gentle goals?', goalTypeId: 'mossprout:nature-connection', goalTitle: 'Spend a little time with the living world', summary: 'Choose none, one, or a few. These should fit your day—not take it over.', suggestedQuickGoalIds: ['mossprout:care-for-plant', 'mossprout:notice-living-thing', 'mossprout:step-outside'], nextNodeId: 'end' },
      { id: 'end', kind: 'end', message: 'Good. The garden likes plans that leave room for weather.' },
    ],
  };
}

function journeyPlayfulConversation(prefix: string, title: string, pollPrompt: string): ConversationDefinition {
  return {
    id: `${prefix}:playful`, version: 5, familyId: 'mossprout', title, trigger: 'poll', minimumBondLevel: 1,
    cooldownDays: 3650, contextualOnly: true, format: 'poll', purpose: 'get_to_know', returnTarget: 'character_home',
    repeatPolicy: 'once_ever', topicKey: `${prefix}:playful`, tags: ['mossprout', 'nature', 'playful'], entryNodeId: 'poll', nodes: [
      { id: 'poll', kind: 'poll', prompt: pollPrompt, helperText: 'The Haven is voting too.', options: [
        { id: 'forest', label: 'A hidden forest path', reply: 'The ferns have voted to adopt you.', nextNodeId: null, villageWeight: 44 },
        { id: 'garden', label: 'A slightly wild garden', reply: 'Useful, beautiful, and allowed to be messy.', nextNodeId: null, villageWeight: 34 },
        { id: 'coast', label: 'Windy water and open sky', reply: 'Your thoughts may need more horizon.', nextNodeId: null, villageWeight: 22 },
      ], nextNodeId: 'end' },
      { id: 'end', kind: 'end', message: '{{coStar}} demands a recount. Mossprout refuses.' },
    ],
  };
}

/** One answer: its id, label, Mossprout's reply, and what it quietly tags. */
type NatureAnswer = readonly [id: string, label: string, reply: string, traits?: ConversationTraitTags];
const NATURE_POLL_WEIGHTS: Readonly<Record<number, readonly number[]>> = { 2: [58, 42], 3: [42, 34, 24], 4: [36, 28, 21, 15], 5: [30, 24, 19, 15, 12] };
const natureOption = ([id, label, reply, traits]: NatureAnswer, nextNodeId: string | null) => {
  const spokenText = spokenAnswerText(label);
  return { id, label, reply, nextNodeId, ...(spokenText ? { spokenText } : {}), ...(traits ? { traits } : {}) };
};

function natureQuestionConversation(input: {
  id: string;
  title: string;
  actionTitle: string;
  outcome: 'poll' | 'archetype';
  resultTitles?: readonly [string, string, string];
  firstPrompt: string;
  first: readonly NatureAnswer[];
  secondPrompt: string;
  second: readonly NatureAnswer[];
  ending: string;
  bond?: 1 | 2 | 3 | 4;
}): ConversationDefinition {
  const archetype = input.outcome === 'archetype';
  return {
    id: `mossprout:conversation:nature-question:${input.id}`,
    version: 3,
    familyId: 'mossprout',
    title: input.title,
    actionTitle: input.actionTitle,
    trigger: 'evergreen',
    minimumBondLevel: input.bond ?? 1,
    cooldownDays: 1,
    format: archetype ? 'narrative' : 'poll',
    purpose: 'get_to_know',
    returnTarget: 'character_home',
    repeatPolicy: 'after_cooldown',
    topicKey: `nature-question:${input.id}`,
    tags: ['mossprout', 'nature', 'nature-question'],
    entryNodeId: 'first',
    nodes: archetype ? [
      {
        id: 'first', kind: 'choice', phase: 'explore', prompt: input.firstPrompt,
        options: input.first.map((answer) => natureOption(answer, 'second')),
      },
      {
        id: 'second', kind: 'choice', phase: 'resolve', prompt: input.secondPrompt,
        options: input.second.map((answer) => natureOption(answer, 'end')),
      },
      { id: 'end', kind: 'end', message: input.ending },
    ] : [
      {
        id: 'first', kind: 'poll', prompt: input.firstPrompt, helperText: 'The Haven is voting too.',
        options: input.first.map((answer, index) => ({ ...natureOption(answer, null), villageWeight: (NATURE_POLL_WEIGHTS[input.first.length] ?? NATURE_POLL_WEIGHTS[3]!)[index]! })),
        nextNodeId: 'end',
      },
      { id: 'end', kind: 'end', message: input.ending },
    ],
  };
}

const mossproutNatureQuestions: readonly ConversationDefinition[] = [
  // Eight daily questions, each a tiny scenario. The ids are save data and name
  // their card art; the scenarios are chosen to fit them. Nobody is asked how
  // organised they are: the answer tells Mossprout something on its own.
  natureQuestionConversation({
    id: 'suspicious-path',
    title: 'A path not on the map',
    actionTitle: 'A path that isn’t on the map',
    outcome: 'archetype',
    firstPrompt: 'A path disappears behind the ferns. It isn’t on any map. What do you do?',
    first: [
      ['follow', '👀 I’m already halfway down it', 'Of course you are. I’ll bring the snacks.', { spontaneity: 2, curiosity: 1 }],
      ['inspect', '🧭 Check where it goes first', 'A responsible amount of mystery.', { curiosity: 1, caution: 1 }],
      ['company', '👥 Only if someone comes with me', 'A path is braver with two. I’ll come.', { social: 2 }],
      ['stay', '🌳 The normal path exists for a reason', 'Sensible. The normal path has fewer nettles.', { caution: 2, routine: 1 }],
    ],
    secondPrompt: 'It ends at a very small door in a tree. Now what?',
    second: [
      ['knock', '✊ Knock immediately', 'Excellent forest manners, and no hesitation.', { spontaneity: 2 }],
      ['listen', '👂 Listen at the door first', 'Something inside is making tea, or plotting. Worth knowing which.', { caution: 1, curiosity: 1 }],
      ['leave-note', '📝 Leave a note, return with a friend', 'Diplomacy, but extremely small. And company for the return.', { social: 1, planning: 1 }],
    ],
    ending: 'Mossprout notes that you are the kind who finds doors.',
  }),
  natureQuestionConversation({
    id: 'weather-committee',
    title: 'Rained off',
    actionTitle: 'The day it rains on your plan',
    outcome: 'poll',
    firstPrompt: 'You planned a whole day outside and it is pouring. What’s most like you?',
    first: [
      ['other-way', '🔧 Find another way to spend it', 'Another way. The day is still yours.', { resilience: 2 }],
      ['annoyed', '😤 Be annoyed for a while, then recover', 'Annoyed, then fine. The garden does the same.', { resilience: 1, overthinking: 1 }],
      ['overthink', '🌀 Wonder what I did wrong', 'You didn’t do the weather. Be kind to yourself.', { overthinking: 2 }],
      ['shrug', '🌊 Shrug and see where the rain goes', 'Shrug. Rain has its own ideas. Some of them are good.', { spontaneity: 1, optimism: 1 }],
    ],
    secondPrompt: 'What should happen immediately afterwards?',
    second: [
      ['rainbow', '🌈 An unnecessary rainbow', 'Unnecessary rainbows are often the best kind.'],
      ['smell', '🌧️ That fresh-after-rain smell', 'The ground taking one enormous breath.'],
      ['light', '🌤️ Golden light through leaves', 'Very dramatic. Mossprout approves.'],
    ],
    ending: 'The weather committee accepts your answer with only minor leaf-shuffling.',
  }),
  natureQuestionConversation({
    id: 'garden-guests',
    title: 'A garden full of strangers',
    actionTitle: 'A party where you know nobody',
    outcome: 'archetype',
    firstPrompt: 'A garden party, and you barely know anyone. Where do you end up?',
    first: [
      ['nearest', '🗣️ Talking to whoever’s nearest', 'Whoever’s nearest. Brave.', { social: 2 }],
      ['known', '👯 Finding the one face I know', 'The one face you know. A safe harbour.', { social: 1, caution: 1 }],
      ['corner', '🐚 A quiet corner with two interesting guests', 'Two interesting guests and a quiet corner. The best gardens are small.', { solitude: 1, curiosity: 1 }],
      ['snacks', '🍕 Near the snacks until something happens', 'By the snacks. Things always happen near the snacks.', { rest: 1, solitude: 1 }],
    ],
    secondPrompt: 'The party is cancelled, and secretly you’re glad. What’s the feeling?',
    second: [
      ['freedom', '🎉 Freedom', 'Freedom. The evening is suddenly enormous.', { solitude: 2 }],
      ['relief', '😌 Relief', 'Relief. Feet up, or feet out.', { rest: 1, solitude: 1 }],
      ['disappointed', '😕 A bit disappointed anyway', 'Disappointed anyway. Part of you was ready.', { social: 1 }],
      ['who-else', '📱 Okay, who else is free?', 'Straight onto the next plan. Social to the last.', { social: 2 }],
    ],
    ending: 'Mossprout adds you to the guest list, with a note about which corner you like.',
  }),
  natureQuestionConversation({
    id: 'outdoor-luxury',
    title: 'A whole free day',
    actionTitle: 'A whole day with nothing planned',
    outcome: 'poll',
    firstPrompt: 'You unexpectedly get an entire day with nothing planned. What happens first?',
    first: [
      ['peace', '🌿 I disappear somewhere peaceful', 'Somewhere with leaves and no signal. A room made of shade.', { rest: 2 }],
      ['wander', '🗺️ I go somewhere without much of a plan', 'No plan is a fine plan. The path will think of something.', { spontaneity: 2, novelty: 1 }],
      ['make', '🎨 Finally do the thing I keep putting off', 'The thing you keep thinking about has been waiting for a free day. Good.', { making: 2 }],
      ['nothing', '🛋️ Absolutely nothing, and it’s glorious', 'Nothing, done properly, is an activity. Moss agrees.', { rest: 2 }],
    ],
    secondPrompt: 'What makes the moment officially complete?',
    second: [
      ['drink', '☕ A favourite drink', 'Hydration with emotional support.'],
      ['quiet', '🤫 Nobody needing anything', 'A rare and protected habitat.'],
      ['company', '👥 One good companion', 'Someone who knows when not to fill the quiet.'],
    ],
    ending: 'Mossprout files this under important luxuries that cost almost nothing.',
  }),
  natureQuestionConversation({
    id: 'tree-neighbour',
    title: 'A hollow of your own',
    actionTitle: 'Furnish a hollow in a tree',
    outcome: 'archetype',
    firstPrompt: 'A hollow in an old tree, empty and all yours. What do you put in first?',
    first: [
      ['alive', '🪴 Something alive', 'Something alive. A plant, or a neighbour.', { optimism: 1, curiosity: 1 }],
      ['comfort', '🛋️ Somewhere comfortable', 'Comfort first. A hollow is for sitting in.', { rest: 2 }],
      ['me', '🎨 Something that feels like me', 'Something that’s yours. Hollows should know who lives there.', { making: 2 }],
      ['useful', '📚 Something useful', 'Useful first. The rest can arrive later.', { planning: 2 }],
    ],
    secondPrompt: 'You may keep one thing in it permanently full. Which?',
    second: [
      ['energy', '🔋 My energy', 'Energy. Enough for one more climb.', { resilience: 1, ambition: 1 }],
      ['curiosity', '🧠 My curiosity', 'Curiosity. It never runs out anyway, but nice.', { curiosity: 2 }],
      ['confidence', '❤️ My confidence', 'Confidence. Roots down, no wobble.', { optimism: 2 }],
      ['free-time', '⏳ My free time', 'Free time. The rarest thing in any tree.', { rest: 2 }],
    ],
    ending: 'Mossprout approves your hollow, and has opinions about the cushions.',
  }),
  natureQuestionConversation({
    id: 'cloud-job',
    title: 'A lift on a cloud',
    actionTitle: 'A cloud offers you a lift',
    outcome: 'poll',
    firstPrompt: 'A cloud offers you a lift somewhere new. Which moment will you remember?',
    first: [
      ['view', '🌄 The view', 'The view. Worth the altitude.', { curiosity: 1 }],
      ['food', '🍜 Something I ate', 'Something you ate. Snacks are memories.', { rest: 1 }],
      ['ridiculous', '😂 Something ridiculous that happened', 'The ridiculous bit. Always the best story.', { spontaneity: 1, optimism: 1 }],
      ['someone', '💬 Someone I met', 'Someone you met. People are the map.', { social: 2 }],
      ['unfamiliar', '🗺️ The feeling of being somewhere unfamiliar', 'The unfamiliar feeling. That is why you go.', { novelty: 2 }],
    ],
    secondPrompt: 'How should the cloud finish its shift?',
    second: [
      ['cloud-gold', '🌇 Turn gold at sunset', 'A proper clocking-off ceremony.'],
      ['cloud-vanish', '💨 Vanish mysteriously', 'No paperwork, only atmosphere.'],
      ['cloud-rainbow', '🌈 Leave a tiny rainbow', 'A tasteful amount of spectacle.'],
    ],
    ending: 'The cloud notes your preference and requests flexible working weather.',
  }),
  natureQuestionConversation({
    id: 'pocket-expedition',
    title: 'A sealed box',
    actionTitle: 'A box marked OPEN WHEN READY',
    outcome: 'archetype',
    firstPrompt: 'A sealed box on the doorstep, marked OPEN WHEN READY. What do you do?',
    first: [
      ['open', '📦 Open it immediately', 'Open. Ready is a state of mind.', { spontaneity: 2 }],
      ['shake', '👀 Shake it first', 'Shake first. Science.', { curiosity: 2 }],
      ['save', '🕰️ Save it for the right moment', 'Saved for the right moment. You have patience moss would envy.', { planning: 1, rest: 1 }],
      ['who', '🤨 Who put this here?', 'Suspicious. Fair. Boxes don’t leave themselves.', { caution: 2 }],
    ],
    secondPrompt: 'Inside is a note: “You can’t.” What happens inside you?',
    second: [
      ['want-to', '🔥 Now I definitely want to', 'Now you want to. The note has made a mistake.', { ambition: 1, spontaneity: 1 }],
      ['point', '🤔 Maybe it has a point', 'Maybe it does. Listening is underrated.', { caution: 2 }],
      ['how', '🧠 I start figuring out how', 'Figuring out how. Already.', { ambition: 1, planning: 1 }],
      ['depends', '🍃 Depends whether I cared in the first place', 'Depends if you cared. Not every hill.', { rest: 1 }],
    ],
    ending: 'Mossprout puts the box on the shelf and watches you, interested.',
  }),
  natureQuestionConversation({
    id: 'garden-rule',
    title: 'If your head were a garden',
    actionTitle: 'Your head, as a garden today',
    outcome: 'poll',
    firstPrompt: 'If your head were a garden today, what would it look like?',
    first: [
      ['neat', '🧹 Neat and quiet', 'Neat and quiet. Rare. Enjoy it.', { rest: 2 }],
      ['rows', '📚 Busy, but in rows', 'Busy but in rows. A good working garden.', { planning: 2 }],
      ['overgrown', '🧦 Overgrown, but I know where everything is', 'Overgrown, all findable. My kind of garden.', { making: 1, spontaneity: 1 }],
      ['happened', '🌪️ Something definitely happened in here', 'Something happened. Weather, probably. It passes.', { overthinking: 1 }],
    ],
    secondPrompt: 'What does it need most this afternoon?',
    second: [
      ['water', '💧 Watering', 'A drink and a sit. Both count as watering.'],
      ['light', '☀️ More light', 'Light. A window, a walk, a door left open.'],
      ['leave', '🍃 Leaving alone', 'Leaving alone. Gardens grow when nobody is staring.'],
    ],
    ending: 'Gardens change. Mossprout will ask again tomorrow.',
  }),
];

/** One scenario, one tap, the village's answer: the shape most of Mossprout's questions take. */
function naturePoll(input: { id: string; title: string; actionTitle: string; prompt: string; answers: readonly NatureAnswer[]; ending: string; bond?: 1 | 2 | 3 | 4 }): ConversationDefinition {
  return natureQuestionConversation({ id: input.id, title: input.title, actionTitle: input.actionTitle, outcome: 'poll', firstPrompt: input.prompt, first: input.answers, secondPrompt: '', second: [], ending: input.ending, ...(input.bond ? { bond: input.bond } : {}) });
}

/**
 * Mossprout's wider pool: tiny scenarios about starting, keeping going, rest,
 * support and what a good day is. Each answer tags what it quietly measures.
 * Later, once enough are answered, Mossprout can put them together.
 */
const mossproutScenarioQuestions: readonly ConversationDefinition[] = [
  naturePoll({ id: 'week-garden', title: 'Your week, as a garden', actionTitle: 'Your week, as a garden', prompt: 'If your week were a garden right now, what would it look like?', answers: [
    ['starting', '🌱 A few things are starting to grow', 'Starting to grow. That is the hopeful stage.', { optimism: 1, making: 1 }],
    ['healthy', '🌿 Pretty healthy, actually', 'Healthy. Enjoy it. Gardens do not stay any one way for long.', { rest: 1, optimism: 1 }],
    ['surviving', '🪴 Somehow surviving', 'Surviving counts. Most gardens are mostly surviving.', { resilience: 1 }],
    ['wrecked', '🌪️ Someone has absolutely wrecked the flowerbeds', 'Wrecked flowerbeds. Weather, probably. We can replant.', { overthinking: 1, resilience: 1 }],
  ], ending: 'Mossprout notes the state of the beds and does not judge them.' }),
  naturePoll({ id: 'free-time', title: 'Unexpected free time', actionTitle: 'Unexpected free time', prompt: 'You wake up with unexpected free time. What gets it first?', answers: [
    ['nothing', '🛋️ Doing absolutely nothing', 'Nothing, done properly. Moss approves.', { rest: 2 }],
    ['somewhere', '🌳 Going somewhere nice', 'Somewhere nice. Take a leaf back for me.', { novelty: 1, curiosity: 1 }],
    ['put-off', '✅ Finally dealing with something I’ve put off', 'The put-off thing. It will be so relieved.', { planning: 1, resilience: 1 }],
    ['enjoy', '🎨 Something I actually enjoy', 'Something you enjoy. That counts as growing too.', { making: 2 }],
  ], ending: 'Free time is rare soil. Mossprout writes down what you would plant in it.' }),
  naturePoll({ id: 'most-trouble', title: 'The hard part', actionTitle: 'The part that gives you trouble', prompt: 'Which one causes you the most trouble?', answers: [
    ['starting', '🌱 Getting started', 'Starting. The seed stage is the hardest one.', { avoidance: 1 }],
    ['going', '🔁 Keeping going', 'Keeping going. Watering is boring, and it is everything.', { routine: 1 }],
    ['finishing', '🏁 Actually finishing', 'Finishing. Some plants never quite want to be done.', { overthinking: 1 }],
    ['stopping', '😅 Knowing when to stop', 'Knowing when to stop. You may be over-watering.', { ambition: 1 }],
  ], ending: 'Good to know. Mossprout will nudge at that stage, gently.' }),
  naturePoll({ id: 'make-easier', title: 'One thing, easier', actionTitle: 'Make one thing easier', prompt: 'If you could instantly make one thing easier, what would you pick?', answers: [
    ['energy', '🔋 Having more energy', 'Energy. Sunlight in a jar, if I could.', { rest: 1 }],
    ['quiet', '🧠 Quieting my brain', 'A quieter head. The garden is good for that.', { overthinking: 2 }],
    ['focus', '🎯 Staying focused', 'Focus. One bed at a time.', { planning: 1 }],
    ['care', '🌿 Taking better care of myself', 'Looking after yourself. You would do it for a plant.', { rest: 2 }],
  ], ending: 'Mossprout keeps that one. It is the kind of thing a friend should know.' }),
  naturePoll({ id: 'huge-thing', title: 'A huge thing to do', actionTitle: 'A huge thing to do', prompt: 'You have a huge thing to do. What happens first?', answers: [
    ['tiniest', '🌱 I find the tiniest possible starting point', 'The tiniest start. That is how forests begin.', { planning: 1, resilience: 1 }],
    ['plan', '📋 I make a plan', 'A plan. Beds in rows.', { planning: 2 }],
    ['jump', '⚡ I just jump in', 'Straight in. Mud on your hands before you have thought about it.', { spontaneity: 2 }],
    ['elsewhere', '🙈 I mysteriously become interested in everything else', 'Suddenly the whole garden needs weeding. I know.', { avoidance: 2 }],
  ], ending: 'Mossprout notes how you start, so he can help with the start.' }),
  naturePoll({ id: 'unkillable-plant', title: 'The unkillable plant', actionTitle: 'A plant that is impossible to kill', prompt: 'Someone gives you a plant and says it’s “almost impossible to kill.” How confident are we?', answers: [
    ['thrive', '🌳 It will thrive', 'It will thrive. I believe you. Mostly.', { optimism: 2 }],
    ['try', '🌱 I’ll try my best', 'Trying your best is most of gardening.', { resilience: 1 }],
    ['trust', '😬 That is an irresponsible amount of trust', 'An irresponsible amount of trust. Honest, at least.', { caution: 1, overthinking: 1 }],
    ['name', '🪦 Name it now, while we still can', 'Name it now. I will say a few words later.', { caution: 1 }],
  ], ending: 'Mossprout offers to check on it. Quietly. Weekly.' }),
  naturePoll({ id: 'best-progress', title: 'Progress that feels best', actionTitle: 'The progress that feels best', prompt: 'Which kind of progress feels best?', answers: [
    ['big', '🏆 Finishing something big', 'Finishing something big. The tree, not the seedling.', { ambition: 2 }],
    ['tiny', '🌱 Seeing tiny improvements add up', 'Tiny improvements adding up. The moss way.', { resilience: 1, routine: 1 }],
    ['burst', '⚡ Getting a sudden burst of momentum', 'A sudden burst. Spring, basically.', { spontaneity: 2 }],
    ['easier', '🌿 Realising something feels easier than it used to', 'Easier than it used to be. The quietest kind of growing.', { rest: 1, optimism: 1 }],
  ], ending: 'That is what growing feels like to you. Mossprout will look for it.' }),
  naturePoll({ id: 'rough-day-support', title: 'After a rough day', actionTitle: 'What you want after a rough day', prompt: 'When you’ve had a rough day, what do you actually want from someone?', answers: [
    ['talk', '💬 Let me talk', 'Talk. I have leaves and no schedule.', { support_listen: 2 }],
    ['solve', '🛠️ Help me solve it', 'Solve it. Practical love.', { support_fix: 2 }],
    ['distract', '😂 Distract me', 'Distraction. I know a frog with opinions.', { support_cheer: 2 }],
    ['nearby', '🍃 Stay nearby, don’t make it a thing', 'Nearby, no fuss. I can do that. I am mostly moss.', { support_stay: 2 }],
  ], ending: 'Mossprout will remember that for the next rough day.' }),
  naturePoll({ id: 'more-dangerous', title: 'The dangerous sentence', actionTitle: 'The sentence that is dangerous for you', prompt: 'What’s more dangerous for you?', answers: [
    ['tomorrow', '⏳ “I’ll do it tomorrow.”', 'Tomorrow. A very convincing word.', { avoidance: 2 }],
    ['perfect', '✨ “It needs to be perfect.”', 'Perfect. No garden has ever been perfect. They are still good.', { overthinking: 2 }],
    ['everything', '🔥 “I can do everything at once.”', 'Everything at once. Even the sun does one season at a time.', { ambition: 2 }],
    ['fine', '🙃 “It’s probably fine.”', 'Probably fine. Sometimes it is. Sometimes it is the roof.', { optimism: 1, avoidance: 1 }],
  ], ending: 'Knowing the sentence is half of ignoring it.', bond: 2 }),
  naturePoll({ id: 'tiny-weed', title: 'One tiny weed', actionTitle: 'One tiny weed in a perfect garden', prompt: 'There’s one tiny weed in an otherwise perfect garden. What happens?', answers: [
    ['notice', '👀 I immediately notice the weed', 'You see the weed first. Weeds count on that.', { overthinking: 2 }],
    ['garden', '🌸 I mostly see the nice garden', 'You see the garden. The weed is furious.', { optimism: 2 }],
    ['remove', '🧤 I remove it right now', 'Out it comes. Efficient.', { planning: 1, resilience: 1 }],
    ['later', '😌 Future-me can deal with it', 'Future-you. Give them gloves.', { avoidance: 1, rest: 1 }],
  ], ending: 'Mossprout pulls the weed himself, later, and says nothing.' }),
  naturePoll({ id: 'when-wrong', title: 'When something goes wrong', actionTitle: 'Your brain when something goes wrong', prompt: 'Which sentence sounds most like your brain when something goes wrong?', answers: [
    ['what-can-i-do', '🔧 “Okay, what can I do?”', 'What can I do. The gardener’s sentence.', { resilience: 2 }],
    ['why', '🤔 “Why did that happen?”', 'Why. Useful, as long as it ends.', { curiosity: 1, overthinking: 1 }],
    ['come-on', '😤 “Oh, come on.”', 'Oh, come on. Fair. Then what?', { resilience: 1 }],
    ['ruined', '🌀 “Well, now everything is ruined.”', 'Everything is ruined. It is not. It is one bed.', { overthinking: 2 }],
  ], ending: 'Mossprout knows your first sentence now. He will offer the second.' }),
  naturePoll({ id: 'bad-at-it', title: 'Bad at something new', actionTitle: 'Trying something you are bad at', prompt: 'You’re trying something new and you’re bad at it. How long do you last?', answers: [
    ['improve', '🌱 Long enough to improve', 'Long enough to improve. That is all it takes.', { resilience: 2 }],
    ['fun', '😂 As long as it’s still fun', 'As long as it is fun. Reasonable terms.', { making: 1, spontaneity: 1 }],
    ['beat', '🔥 Now I’m determined to beat it', 'Determined now. The thing has made an enemy.', { ambition: 2 }],
    ['calling', '🚪 I have discovered this is not my calling', 'Not your calling. Quick, at least. Saves soil.', { caution: 1, avoidance: 1 }],
  ], ending: 'Mossprout was bad at growing for a whole season. It passed.' }),
  naturePoll({ id: 'rather', title: 'Would you rather', actionTitle: 'Would you rather…', prompt: 'Would you rather…', answers: [
    ['improve', '🌿 Improve something you already have', 'Tend what you have. Cultivation. Very moss.', { routine: 2 }],
    ['start', '✨ Start something completely new', 'Start new. A bare bed and a packet of seeds.', { novelty: 2 }],
  ], ending: 'Mossprout leans the other way, which is why this works.' }),
  naturePoll({ id: 'secret-compliment', title: 'The secret compliment', actionTitle: 'The compliment that would mean most', prompt: 'Which compliment would secretly mean the most?', answers: [
    ['feel-good', '❤️ “You make people feel good.”', 'Making people feel good. You would like to be shade.', { support_cheer: 1, social: 1 }],
    ['capable', '🧠 “You’re really capable.”', 'Capable. You like the work to show.', { ambition: 2 }],
    ['grown', '🌱 “You’ve grown a lot.”', 'Grown a lot. My favourite compliment, obviously.', { resilience: 1, optimism: 1 }],
    ['unlike', '✨ “You’re unlike anyone else I know.”', 'Unlike anyone. A plant nobody can identify.', { novelty: 2 }],
  ], ending: 'Mossprout will find a moment to say it.' }),
  naturePoll({ id: 'little-door', title: 'A little door under a tree', actionTitle: 'A little door under a tree', prompt: 'You find a little door under a tree. There’s no sign. Obviously…', answers: [
    ['open', '🚪 Open it', 'Open it. Obviously.', { spontaneity: 2 }],
    ['inspect', '👀 Inspect it carefully', 'Inspect first. Doors have manners too.', { caution: 1, curiosity: 1 }],
    ['someone', '🗣️ Find someone else first', 'Fetch someone. Doors are better with witnesses.', { social: 2 }],
    ['leave', '🌳 Leave mysterious woodland doors alone, Mossprout', 'Leave it alone. I have been told. Twice.', { caution: 2 }],
  ], ending: 'There is, in fact, a door. Mossprout has not opened it either.' }),
  naturePoll({ id: 'disappears-first', title: 'What goes first', actionTitle: 'What disappears when life gets busy', prompt: 'What tends to disappear first when life gets busy?', answers: [
    ['sleep', '😴 Sleep', 'Sleep. The roots go first and nobody sees it.', { rest: 1 }],
    ['moving', '🚶 Moving around', 'Moving. The path grows over quickly.', { routine: 1 }],
    ['enjoy', '🎨 Things I enjoy', 'The things you enjoy. The flowers, not the vegetables.', { making: 1 }],
    ['myself', '🌿 Time for myself', 'Time for yourself. The quiet corner gets built on.', { solitude: 1, rest: 1 }],
  ], ending: 'Mossprout will watch for that one going, and say so.' }),
  naturePoll({ id: 'success', title: 'What success feels like', actionTitle: 'What feels like success', prompt: 'Which feels more like success?', answers: [
    ['impressive', '🏆 Doing something impressive', 'Impressive. A tree people point at.', { ambition: 2 }],
    ['feeling-good', '🌿 Feeling good while I’m doing it', 'Feeling good doing it. The garden agrees.', { rest: 2 }],
    ['lasting', '🧱 Building something that lasts', 'Something that lasts. Oak thinking.', { routine: 1, making: 1 }],
    ['time-for', '❤️ Having time for the people/things I care about', 'Time for what you care about. That is the whole garden.', { social: 1, rest: 1 }],
  ], ending: 'That is your kind of success. Mossprout will measure by it.' }),
  naturePoll({ id: 'avoiding', title: 'When you’re avoiding something', actionTitle: 'When you are avoiding something', prompt: 'If you’re avoiding something, what usually helps most?', answers: [
    ['small', '🌱 Making the first step ridiculously small', 'Ridiculously small. One seed.', { planning: 1, resilience: 1 }],
    ['deadline', '⏰ Giving myself a deadline', 'A deadline. Frost does the same for gardens.', { planning: 2 }],
    ['accountable', '👥 Someone else keeping me accountable', 'Someone watching. I can watch. I am very still.', { social: 2 }],
    ['panic', '⚡ Waiting until panic becomes a productivity tool', 'Panic as fuel. It works. It is not restful.', { avoidance: 1, spontaneity: 1 }],
  ], ending: 'Mossprout files this under how to help without nagging.' }),
  naturePoll({ id: 'unnoticed-progress', title: 'Progress nobody noticed', actionTitle: 'Progress nobody else noticed', prompt: 'You’ve made progress, but nobody else notices. Does it still count?', answers: [
    ['of-course', '🌱 Of course', 'Of course. Roots grow unseen.', { optimism: 2 }],
    ['mostly', '🤷 Mostly', 'Mostly. Honest.', { optimism: 1 }],
    ['noticed', '👀 I’d like someone to notice', 'You would like it noticed. I noticed.', { social: 2 }],
    ['visible', '🏆 I want results I can actually see', 'Visible results. Flowers, not roots. Fair.', { ambition: 2 }],
  ], ending: 'Mossprout notices. That is most of what he does.' }),
  naturePoll({ id: 'satisfying-day', title: 'A satisfying day', actionTitle: 'The most satisfying kind of day', prompt: 'Which kind of day feels most satisfying?', answers: [
    ['done', '✅ I got loads done', 'Loads done. A full basket.', { ambition: 2 }],
    ['calm', '🌿 I felt calm', 'Calm. A still pond.', { rest: 2 }],
    ['unexpected', '🗺️ Something unexpected happened', 'Unexpected. A bird you have never seen.', { novelty: 2 }],
    ['moment', '❤️ I had a really good moment with someone', 'A good moment with someone. That is the whole point of gates.', { social: 2 }],
    ['inspiring', '🎨 I made/found something inspiring', 'Something inspiring. A seed you did not plant.', { making: 2 }],
  ], ending: 'That is your good day. Mossprout will try to leave room for it.' }),
  naturePoll({ id: 'stop-one-thing', title: 'If Mossprout could stop one thing', actionTitle: 'One thing Mossprout could stop you doing', prompt: 'If Mossprout could stop you doing one thing, which would help most?', answers: [
    ['overthinking', '🌀 Overthinking', 'Overthinking. I would sit on your thoughts, gently.', { overthinking: 2 }],
    ['putting-off', '⏳ Putting things off', 'Putting things off. I would move the pot nearer the door.', { avoidance: 2 }],
    ['too-much', '🔥 Taking on too much', 'Too much. I would hide half the seed packets.', { ambition: 2 }],
    ['hard-on-self', '😬 Being too hard on myself', 'Being hard on yourself. I would speak to you the way you speak to plants.', { overthinking: 1, resilience: 1 }],
  ], ending: 'Mossprout cannot actually stop you. He can remind you.', bond: 2 }),
  naturePoll({ id: 'magic-plot', title: 'One magical plot', actionTitle: 'One magical garden plot', prompt: 'You get one magical garden plot. What do you grow there?', answers: [
    ['enormous', '🌳 Something that takes years but becomes enormous', 'Years, then enormous. Patient and slightly terrifying.', { ambition: 1, routine: 1 }],
    ['beautiful', '🌸 Something beautiful immediately', 'Beautiful now. Fair. Now is where we live.', { spontaneity: 1, optimism: 1 }],
    ['useful', '🍓 Something useful', 'Useful. Strawberries are also beautiful, for the record.', { planning: 2 }],
    ['strange', '🌱 Something strange I’ve never seen before', 'Something strange. My favourite answer. I will not say why.', { novelty: 2, curiosity: 1 }],
  ], ending: 'The plot is yours. Mossprout has already started digging.' }),
  naturePoll({ id: 'lose-motivation', title: 'Halfway and stuck', actionTitle: 'Halfway through, and the motivation goes', prompt: 'You’re halfway through something difficult and suddenly lose motivation. What usually happens?', answers: [
    ['push', '🔥 I push through', 'Push through. Sometimes right. Sometimes a wall.', { ambition: 1, resilience: 1 }],
    ['smaller', '🌱 I make the target smaller', 'A smaller target. Very sensible. Very moss.', { planning: 1, resilience: 1 }],
    ['break', '🍃 I take a break and come back', 'A break, then back. Gardens grow while you are away.', { rest: 2 }],
    ['never', '👻 This project may never see me again', 'Never seen again. A haunted flowerbed. We all have one.', { avoidance: 2 }],
  ], ending: 'Mossprout knows what halfway looks like for you now.' }),
  naturePoll({ id: 'scares-more', title: 'What scares you more', actionTitle: 'What scares you more', prompt: 'What scares you more?', answers: [
    ['missing', '🚪 Missing an opportunity', 'A missed opportunity. The door that closed.', { spontaneity: 1, ambition: 1 }],
    ['failing', '💥 Trying and failing', 'Trying and failing. Loud, and in front of people.', { caution: 2 }],
    ['wasting', '🕰️ Wasting time', 'Wasting time. Plants never worry about this, and they are fine.', { planning: 1, ambition: 1 }],
    ['control', '🌪️ Taking on something I can’t control', 'Something you cannot control. Weather, mostly.', { caution: 1, overthinking: 1 }],
  ], ending: 'Mossprout keeps this where the nightmares are, and does not poke it.', bond: 2 }),
  naturePoll({ id: 'today-needs', title: 'One thing for today', actionTitle: 'One thing today needs', prompt: 'If today needed one thing added to it, what would you choose?', answers: [
    ['energy', '🔋 Energy', 'Energy. Sun on the leaves.', { ambition: 1 }],
    ['calm', '🍃 Calm', 'Calm. A pond with nothing in it.', { rest: 2 }],
    ['fun', '✨ Something fun', 'Something fun. A frog with a hat.', { making: 1, spontaneity: 1 }],
    ['progress', '🌱 A sense of progress', 'Progress. One sprout, visibly taller.', { resilience: 1, planning: 1 }],
  ], ending: 'Mossprout will see what he can do about that today.' }),
  naturePoll({ id: 'good-day', title: 'How you know it was a good day', actionTitle: 'How you know a day was good', prompt: 'How do you know when you’ve had a good day?', answers: [
    ['did', '✅ I did what I wanted to do', 'You did what you meant to. A full row.', { ambition: 1, planning: 1 }],
    ['okay', '🌿 I felt okay in myself', 'You felt okay. That is a good day in any garden.', { rest: 2 }],
    ['meaningful', '❤️ Something meaningful happened', 'Something meaningful. You will remember that one.', { social: 1, optimism: 1 }],
    ['laughed', '😂 I laughed / enjoyed myself', 'You laughed. So did the frog.', { making: 1, spontaneity: 1 }],
    ['through', '🛋️ Honestly, sometimes just getting through it counts', 'Getting through it. That counts. It always has.', { resilience: 2 }],
  ], ending: 'That is how Mossprout will ask about your day from now on.' }),
];

function natureJournalConversation(input: {
  id: string;
  actionTitle: string;
  title: string;
  prompts: readonly {
    id: string;
    prompt: string;
    options: readonly [id: string, label: string, reply: string][];
  }[];
  ending: string;
}): ConversationDefinition {
  const prompts = [input.prompts[0]!, input.prompts.at(-1)!];
  return {
    id: `mossprout:conversation:nature-journal:${input.id}`,
    version: 3,
    familyId: 'mossprout',
    actionTitle: input.actionTitle,
    title: input.title,
    trigger: 'evergreen',
    minimumBondLevel: 1,
    cooldownDays: 1,
    format: 'narrative',
    purpose: 'reflection',
    returnTarget: 'character_home',
    repeatPolicy: 'after_cooldown',
    topicKey: `nature-journal:${input.id}`,
    tags: ['mossprout', 'nature', 'nature-journal'],
    entryNodeId: prompts[0]!.id,
    nodes: [
      ...prompts.map((item, index) => ({
        id: item.id,
        kind: 'choice' as const,
        phase: index === input.prompts.length - 1 ? 'resolve' as const : 'explore' as const,
        prompt: item.prompt,
        options: item.options.map(([id, label, reply]) => ({
          id, label, reply, journalFragment: mossproutJournalFragment(input.id, item.id, id, label),
          nextNodeId: prompts[index + 1]?.id ?? 'save-note',
        })),
      })),
      {
        id: 'save-note', kind: 'journal_handoff', prompt: 'Keep this small nature moment?',
        title: input.title, body: 'Mossprout shaped your answers into a small field note. Edit anything, then keep it here in your journal together.',
        draftTemplate: MOSSPROUT_JOURNAL_DRAFT_TEMPLATES[input.id],
        flowId: 'went_somewhere', allowedChoiceIds: ['park', 'garden', 'forest', 'home', 'other_place'],
        saveLabel: 'Save field note', rewardGrowth: 20, nextNodeId: 'end',
      },
      { id: 'end', kind: 'end', message: input.ending },
    ],
  };
}

const MOSSPROUT_JOURNAL_DRAFT_TEMPLATES: Readonly<Record<string, string>> = {
  'three-detail-field-note': 'Nature found me {{where}}. I want to remember {{keep}}.',
  'weather-in-the-day': 'Today felt {{weather}}. I would caption it “{{line}}.”',
  'one-growing-thing': 'I noticed {{found}}. For now, I want to {{next}}.',
  'sound-map': 'Nearest to me was {{nearest}}. I would keep {{keep}}.',
  'light-on-the-place': 'The light was {{kind}}. My field note says: “{{line}}.”',
  'small-return': 'I am thinking of {{place}}. Returning could be easy if I {{when}}.',
};

const MOSSPROUT_JOURNAL_FRAGMENTS: Readonly<Record<string, string>> = {
  'three-detail-field-note:where:outside': 'somewhere outside',
  'three-detail-field-note:where:window': 'through a window',
  'three-detail-field-note:where:indoors': 'beside something growing indoors',
  'weather-in-the-day:weather:bright': 'bright and warm',
  'weather-in-the-day:weather:wet': 'rainy or damp',
  'weather-in-the-day:weather:wind': 'windy and changeable',
  'one-growing-thing:found:wild': 'something growing wild',
  'one-growing-thing:found:tended': 'something someone tends',
  'one-growing-thing:found:tiny': 'something very small',
  'one-growing-thing:next:remember': 'remember it',
  'one-growing-thing:next:return': 'look again another day',
  'one-growing-thing:next:care': 'give it a little care',
  'sound-map:nearest:bird': 'a bird or animal',
  'sound-map:nearest:weather': 'wind, rain, or leaves',
  'sound-map:nearest:people': 'people moving nearby',
  'light-on-the-place:kind:bright': 'clear and bright',
  'light-on-the-place:kind:gold': 'warm and golden',
  'light-on-the-place:kind:dim': 'soft, grey, or dim',
  'small-return:place:near': 'somewhere very nearby',
  'small-return:place:green': 'a properly green place',
  'small-return:place:edge': 'an overlooked edge or corner',
  'small-return:when:route': 'build it into a route',
  'small-return:when:weather': 'wait for different weather',
  'small-return:when:remember': 'simply remember it for now',
};

function mossproutJournalFragment(journalId: string, nodeId: string, optionId: string, label: string) {
  return MOSSPROUT_JOURNAL_FRAGMENTS[`${journalId}:${nodeId}:${optionId}`] ?? `${label[0]!.toLocaleLowerCase()}${label.slice(1)}`;
}

const mossproutNatureJournals: readonly ConversationDefinition[] = [
  natureJournalConversation({
    id: 'three-detail-field-note',
    actionTitle: 'Notice three nature details',
    title: 'A three-detail field note',
    prompts: [
      { id: 'where', prompt: 'Where did today\'s nearest bit of nature find you?', options: [
        ['outside', 'Somewhere outside', 'A proper meeting place.'], ['window', 'Through a window', 'Nature still knows how to visit.'], ['indoors', 'With something growing indoors', 'A small habitat counts.'],
      ] },
      { id: 'sense', prompt: 'Which detail arrived first?', options: [
        ['colour', 'A colour or shape', 'Your eyes kept the first note.'], ['sound', 'A sound or movement', 'Something made the world feel less still.'], ['air', 'Light, air or temperature', 'The atmosphere wrote itself into the moment.'],
      ] },
      { id: 'keep', prompt: 'What part is worth keeping?', options: [
        ['calm', 'How it changed my pace', 'A small shift can be the whole note.'], ['odd', 'One odd little detail', 'Excellent. Field notes need at least one peculiar thing.'], ['return', 'A reason to look again', 'Then this note has roots.'],
      ] },
    ],
    ending: 'Mossprout presses the three details into an imaginary field notebook.',
  }),
  natureJournalConversation({
    id: 'weather-in-the-day',
    actionTitle: 'Catch today\'s weather in a note',
    title: 'How the weather entered the day',
    prompts: [
      { id: 'weather', prompt: 'What kind of weather had the loudest voice today?', options: [
        ['bright', 'Bright or warm', 'The light made itself part of the plan.'], ['wet', 'Rainy or damp', 'Every surface got a different sound.'], ['wind', 'Windy or changing', 'The day refused to sit still.'],
      ] },
      { id: 'effect', prompt: 'What did it change most?', options: [
        ['plans', 'My plans', 'Weather is an uninvited co-author.'], ['mood', 'My mood or energy', 'The sky can be surprisingly persuasive.'], ['notice', 'What I noticed', 'Different weather reveals different worlds.'],
      ] },
      { id: 'line', prompt: 'Give the day a tiny weather caption.', options: [
        ['soft', 'Soft around the edges', 'A gentle caption.'], ['awake', 'Everything felt awake', 'Even the leaves get an exclamation mark.'], ['shelter', 'Good weather for shelter', 'Shelter is part of weather too.'],
      ] },
    ],
    ending: 'Mossprout files the forecast under feelings the weather accidentally caused.',
  }),
  natureJournalConversation({
    id: 'one-growing-thing',
    actionTitle: 'Remember one growing thing',
    title: 'One growing thing',
    prompts: [
      { id: 'found', prompt: 'What kind of growing thing caught your attention?', options: [
        ['wild', 'Something growing wild', 'It chose its own address.'], ['tended', 'Something someone tends', 'Care leaves visible fingerprints.'], ['tiny', 'Something very small', 'Tiny is excellent at being overlooked.'],
      ] },
      { id: 'why', prompt: 'Why that one?', options: [
        ['colour', 'Its colour or shape', 'A strong silhouette earns a second look.'], ['change', 'It had changed', 'Growing things are never quite finished.'], ['place', 'It belonged perfectly there', 'Place can be part of a living thing.'],
      ] },
      { id: 'next', prompt: 'What should happen next?', options: [
        ['remember', 'Just remember it', 'Attention is enough.'], ['return', 'Look again another day', 'A second look turns noticing into a relationship.'], ['care', 'Give it a little care', 'A practical ending with gentle roots.'],
      ] },
    ],
    ending: 'Mossprout keeps the growing thing exactly as you noticed it, without making it into homework.',
  }),
  natureJournalConversation({
    id: 'sound-map', actionTitle: 'Map the sounds around you', title: 'A tiny outdoor sound map',
    prompts: [
      { id: 'nearest', prompt: 'Which outdoor sound was nearest?', options: [
        ['bird', 'A bird or animal', 'A voice with its own destination.'], ['weather', 'Wind, rain or leaves', 'The weather playing the whole place.'], ['people', 'People moving nearby', 'Human habitat belongs on the map too.'],
      ] },
      { id: 'distance', prompt: 'What was happening farther away?', options: [
        ['traffic', 'A road or machine', 'The wider world humming at the edge.'], ['quiet', 'Mostly quiet', 'Quiet has layers when you listen long enough.'], ['water', 'Water or a repeating sound', 'A sound that keeps returning to itself.'],
      ] },
      { id: 'keep', prompt: 'Which sound would you keep?', options: [
        ['soft', 'The softest one', 'A small sound can hold a large pause.'], ['odd', 'The strangest one', 'Excellent field-note material.'], ['whole', 'The whole mixture', 'A place is often an accidental orchestra.'],
      ] },
    ], ending: 'Mossprout folds the sounds into a map with no straight roads.',
  }),
  natureJournalConversation({
    id: 'light-on-the-place', actionTitle: 'Notice how the light changed', title: 'How the light changed a place',
    prompts: [
      { id: 'kind', prompt: 'What kind of light found you?', options: [
        ['bright', 'Clear and bright', 'Everything acquired sharper edges.'], ['gold', 'Warm or golden', 'The ordinary briefly became theatrical.'], ['dim', 'Soft, grey or dim', 'A quieter kind of detail came forward.'],
      ] },
      { id: 'changed', prompt: 'What did it change most?', options: [
        ['colour', 'A colour', 'The place chose a stronger palette.'], ['shadow', 'A shape or shadow', 'Light drawing with whatever was nearby.'], ['mood', 'The feeling of the place', 'Atmosphere is one of light’s favourite jobs.'],
      ] },
      { id: 'line', prompt: 'What line belongs in the field note?', options: [
        ['awake', 'Everything looked awake', 'A bright little sentence.'], ['held', 'The place felt held', 'Soft light can make its own shelter.'], ['changed', 'It will not look the same later', 'A good reason to notice now.'],
      ] },
    ], ending: 'Mossprout keeps the light without asking it to stay.',
  }),
  natureJournalConversation({
    id: 'small-return', actionTitle: 'Keep a place worth returning to', title: 'A place worth returning to',
    prompts: [
      { id: 'place', prompt: 'What kind of place are you thinking of?', options: [
        ['near', 'Somewhere very nearby', 'Close enough to become familiar.'], ['green', 'A properly green place', 'Enough leaves to change the volume.'], ['edge', 'An overlooked edge or corner', 'Small places often reward a second look.'],
      ] },
      { id: 'reason', prompt: 'Why return?', options: [
        ['change', 'To see what changed', 'A place is never a finished picture.'], ['feeling', 'For how it made me feel', 'The atmosphere left a return address.'], ['care', 'Because I care what happens there', 'Attention growing roots.'],
      ] },
      { id: 'when', prompt: 'What would make returning easy?', options: [
        ['route', 'Build it into a route', 'No special expedition required.'], ['weather', 'Wait for different weather', 'The same place with a new voice.'], ['remember', 'Just remember it for now', 'A return does not need a deadline.'],
      ] },
    ], ending: 'Mossprout marks the place with a tiny imaginary leaf.',
  }),
];

const dryPondJourneyConversations: readonly ConversationDefinition[] = [
  journeyInsightConversation('mossprout:dry-pond:day-1:opening', 'Something beneath the pond', 'The pond made a strange sound last night—like water remembering where it used to go.', 'dry-pond-noticing-style'),
  journeyConversation('mossprout:dry-pond:day-1:resolution', 'A day of noticing', 'Maybe today was a water day. Maybe it was not.', 'I still looked.', 'That counts. Noticing does not need a perfect result.', 'The pond can wait with us.'),
  journeyInsightConversation('mossprout:dry-pond:day-2:opening', 'A place for rain', 'Mossprout found smooth Pebbles beside the dry bank and is deciding what this place could become.', 'dry-pond-restorative-place'),
  journeyConversation('mossprout:dry-pond:day-2:resolution', 'The first drop', 'The Shell is holding one bright drop without spilling it.', 'A tiny pond.', 'Exactly. Even the smallest place can hold a whole sky.', "Let's see what the bank needs tomorrow."),
  journeyInsightConversation('mossprout:dry-pond:day-3:opening', 'A bank that holds', 'Catching water is not enough. The pond needs roots, gentle edges, and time.', 'dry-pond-gentle-care'),
  journeyConversation('mossprout:dry-pond:day-3:resolution', 'Roots by the water', 'The roots are already leaning toward the Shell.', 'It looks like it belongs there.', 'That is what patient care can do. It gives a place somewhere to continue.', 'The bank is holding. Tomorrow, we can make it welcoming.'),
  journeyInsightConversation('mossprout:dry-pond:day-4:opening', 'The little rain garden', 'A Wisp followed Mossprout to the pond. The final patch could become somewhere welcoming.', 'dry-pond-belonging'),
  journeyConversation('mossprout:dry-pond:day-4:resolution', 'The pond remembers', 'It caught the rain. Every leaf is shining.', "It's ours.", 'Ours—and ready for whoever finds it next.', 'The Little Rain Garden is complete.'),
];

const extendedJourneyCopy = [
  ['memory-nursery:nursery-key', 'The Nursery Key', 'Behind the pond, an old greenhouse door has begun to glow.', 'The lock is listening.', 'Then let us bring it something living to remember.', 'The Memory Nursery is ready to open.'],
  ['memory-nursery:keepsake-root', 'A Keepsake Takes Root', 'A bare nursery bed is waiting for one remembered thing and one growing thing.', 'They belong together.', 'Memory needs roots if it is going to keep growing.', 'A new bed settles into the nursery.'],
  ['memory-nursery:garden-remembers', 'What the Garden Remembers', 'The nursery has begun arranging old moments into new patterns.', 'Show me what it kept.', 'Not every memory stays still. Some of them become habitat.', 'The nursery remembers in leaves and water.'],
  ['memory-nursery:lantern-bank', 'The Lantern Bank', 'One dark bank remains beside the nursery path.', 'It needs its own light.', 'A Memory Bloom can hold the kind of light that knows its way home.', 'The lantern bank glows, and the nursery is complete.'],
  ['heartwood:mirror-for-rain', 'A Mirror for Rain', 'Rain has revealed a path beyond the nursery, toward the oldest tree in the grove.', 'Let us follow it.', 'First we need a mirror that can carry the sky beneath the branches.', 'The ancient grove reflects a way forward.'],
  ['heartwood:rings-of-attention', 'Rings of Attention', 'The old tree has kept a record of every patient season.', 'What has it noticed?', 'Perhaps attention leaves rings too, even when nobody can see them.', 'A new ring brightens beneath the bark.'],
  ['heartwood:place-that-holds', 'A Place That Holds', 'The grove is alive, but it needs somewhere delicate things can remain.', 'We can make shelter.', 'Growth is not only reaching outward. Sometimes it is making room.', 'The grove now holds what matters without closing around it.'],
  ['heartwood:heartwood', 'Heartwood', 'At the centre of the grove, every path in the garden meets.', 'We made it here.', 'Slowly, together, and without asking the garden to become anything else.', 'Heartwood is complete. The whole garden carries our history.'],
] as const;

const extendedJourneyConversations: readonly ConversationDefinition[] = extendedJourneyCopy.flatMap(([beatId, title, prompt, label, reply, ending]) => [
  beatId === 'memory-nursery:nursery-key' || beatId === 'heartwood:mirror-for-rain'
    ? journeyInsightConversation(`mossprout:${beatId}:opening`, title, prompt, `${beatId}:reflection`)
    : journeyConversation(`mossprout:${beatId}:opening`, title, prompt, label, reply, 'The Merge World is ready when you are.'),
  journeyConversation(`mossprout:${beatId}:resolution`, title, ending, 'Stay a moment.', 'Some changes deserve a quiet look.', ending),
]);

const extendedJourneyActionConversations: readonly ConversationDefinition[] = [
  journeyGoalConversation('mossprout:memory-nursery:keepsake-root', 'Keep one living memory'),
  journeyPlayfulConversation('mossprout:memory-nursery:garden-remembers', 'The nursery guessing game', 'Which tiny detail would the garden be most likely to remember?'),
  journeyGoalConversation('mossprout:heartwood:rings-of-attention', 'Return with attention'),
  journeyPlayfulConversation('mossprout:heartwood:place-that-holds', 'Official grove architecture', 'What should every truly excellent shelter include?'),
];

const mossproutJourneyActionConversations: readonly ConversationDefinition[] = MOSSPROUT_DRY_POND_BEAT_IDS.flatMap((beatId, index) => {
  const prefix = `mossprout:${beatId}`;
  return [
    journeyGoalConversation(prefix, ['A goal with small roots', 'Make room for rain', 'Care without hurry', 'A place worth returning to'][index]!),
    ...(beatId === 'dry-pond:day-2' ? [] : [journeyPlayfulConversation(prefix, ['Fern business', 'Rain personality', 'Garden diplomacy', 'The official pond survey'][index]!, 'Pick the outdoor place that feels most like yours.')]),
  ];
});

const mossproutFirstDayPlayfulConversation = journeyPlayfulConversation(
  'mossprout:quiet-patch:first-flower',
  'The official first-garden survey',
  'Which outdoor place should Mossprout investigate next?',
);

const mossproutFirstDayGoalConversation = journeyGoalConversation(
  'mossprout:quiet-patch:first-flower',
  'Find a focus with small roots',
);

const mossproutProfileQuestions: readonly ConversationProfileQuestion[] = [
  {
    id: 'nature-world', prompt: 'Which part of the outdoors feels most like your place?', options: [
      { id: 'green', label: 'Leaves, gardens and growing things', reply: 'A green answer. Mossprout approves.', nextNodeId: null, nextQuestionId: 'green-form', affinity: { petalimp: 1, fernip: 1, blossle: 1 } },
      { id: 'season', label: 'Colour, seasons and changing light', reply: 'You notice a place changing its coat.', nextNodeId: null, nextQuestionId: 'season-form', affinity: { amberleaf: 1, blossle: 1, mistle: 1 } },
      { id: 'weather', label: 'Rain, wind and open sky', reply: 'The weather gets to be part of the place.', nextNodeId: null, nextQuestionId: 'weather-form', affinity: { drizzlet: 1, driftkin: 1, tempesto: 1 } },
    ],
  },
  { id: 'green-form', prompt: 'What draws you closer?', options: [
    { id: 'moss', label: 'Soft, quiet green places', reply: 'Mossprout knows those well.', nextNodeId: null, nextQuestionId: 'finish', affinity: { fernip: 5 } },
    { id: 'flowers', label: 'Flowers and tended gardens', reply: 'A little care, made visible.', nextNodeId: null, nextQuestionId: 'finish', affinity: { petalimp: 5 } },
    { id: 'ferns', label: 'Woodland and hidden paths', reply: 'Some paths prefer not to announce themselves.', nextNodeId: null, nextQuestionId: 'finish', affinity: { fernip: 5 } },
  ] },
  { id: 'season-form', prompt: 'Which change would you keep?', options: [
    { id: 'autumn', label: 'Autumn colour', reply: 'A bright ending can still feel warm.', nextNodeId: null, nextQuestionId: 'finish', affinity: { amberleaf: 5 } },
    { id: 'spring', label: 'The first spring flowers', reply: 'Small proof that the ground remembered.', nextNodeId: null, nextQuestionId: 'finish', affinity: { blossle: 5 } },
    { id: 'mist', label: 'A misty morning', reply: 'A familiar place, keeping one secret.', nextNodeId: null, nextQuestionId: 'finish', affinity: { mistle: 5 } },
  ] },
  { id: 'weather-form', prompt: 'Which sky feels most alive?', options: [
    { id: 'rain', label: 'Soft rain', reply: 'Every leaf gets a voice.', nextNodeId: null, nextQuestionId: 'finish', affinity: { drizzlet: 5 } },
    { id: 'wind', label: 'A windy day', reply: 'Even old trees find something new to say.', nextNodeId: null, nextQuestionId: 'finish', affinity: { driftkin: 5 } },
    { id: 'storm', label: 'A distant storm', reply: 'Large weather, safely watched.', nextNodeId: null, nextQuestionId: 'finish', affinity: { tempesto: 5 } },
  ] },
  { id: 'finish', prompt: 'What should time in nature give back?', options: [
    { id: 'calm', label: 'A little calm', reply: 'Then we will leave room for quiet.', nextNodeId: null, nextQuestionId: null, affinity: { fernip: 1, mistle: 1, drizzlet: 1 } },
    { id: 'wonder', label: 'Something to notice', reply: 'Curiosity has very good roots.', nextNodeId: null, nextQuestionId: null, affinity: { fernip: 1, blossle: 1, tempesto: 1 } },
    { id: 'care', label: 'Something to care for', reply: 'Care is one way a place becomes yours.', nextNodeId: null, nextQuestionId: null, affinity: { petalimp: 1, amberleaf: 1, driftkin: 1 } },
  ] },
];

const mossproutFormDescriptions = Object.fromEntries(MOSS_FORMS.map((formId) => [
  formId,
  `${formId[0]!.toUpperCase()}${formId.slice(1)} reflects the way you like to meet nature right now. It is a collectible card, not a permanent label.`,
])) as Partial<Record<KatchimeraSkinId, string>>;

const mossproutFormFinder: ConversationDefinition = {
  id: 'mossprout:game:form-finder', version: 6, familyId: 'mossprout', title: 'Who is closest to your nature?',
  trigger: 'signature_game', minimumBondLevel: 1, cooldownDays: 3650, contextualOnly: true, format: 'profile_game',
  purpose: 'card_discovery', returnTarget: 'character_home', repeatPolicy: 'once_ever', topicKey: 'nature-card',
  tags: ['forms', 'mossprout'], entryNodeId: 'game', nodes: [
    { id: 'game', kind: 'profile_game', title: 'Who is closest to your nature?', entryQuestionId: 'nature-world', questions: mossproutProfileQuestions, revealNodeId: 'reveal' },
    { id: 'reveal', kind: 'form_reveal', title: 'Someone feels close', descriptions: mossproutFormDescriptions, memoryKey: 'preference:mossprout:form-match', nextNodeId: null },
  ],
};

function bondConversation(level: 2 | 3 | 4, prompt: string, ending: string): ConversationDefinition {
  return {
    id: `mossprout:conversation:bond-${level}`, version: 4, familyId: 'mossprout', title: 'Mossprout has a question',
    trigger: 'bond', minimumBondLevel: level, cooldownDays: 3650, contextualOnly: true, format: 'narrative',
    purpose: 'bond_milestone', returnTarget: 'character_home', repeatPolicy: 'once_ever', topicKey: `bond-${level}`,
    tags: ['mossprout', 'bond'], entryNodeId: 'question', nodes: [
      { id: 'question', kind: 'choice', phase: 'explore', prompt, options: [
        { id: 'quiet', label: 'Notice things with me', reply: 'Mossprout nods. “Quiet company, then.”', nextNodeId: 'end' },
        { id: 'curious', label: 'Ask me odd questions', reply: '“Excellent. I have several about worms.”', nextNodeId: 'end' },
        { id: 'practical', label: 'Give me tiny ideas', reply: '“Pocket-sized. No grand expeditions.”', nextNodeId: 'end' },
      ] },
      { id: 'end', kind: 'end', message: ending },
    ],
  };
}

const mossproutBondConversations = [
  bondConversation(2, '“I think I know how you like to wander,” Mossprout says. “But how should I join in?”', 'Mossprout tucks your answer under their hat for next time.'),
  bondConversation(3, 'Mossprout marks a new patch of the map OURS. “What should we grow between visits?”', '{{coStar}} adds a crooked star beside your answer.'),
  bondConversation(4, 'At {{place}}, Mossprout pauses. “What should I keep reminding you?”', 'The garden keeps your answer somewhere safe.'),
] as const;

function reflectionConversation(id: string, title: string, prompt: string, routeKeys: readonly string[]): ConversationDefinition {
  return {
    id: `mossprout:conversation:${id}`, version: 4, familyId: 'mossprout', title, trigger: 'journal',
    triggerRouteKeys: routeKeys, minimumBondLevel: 1, cooldownDays: 5, contextualOnly: true, format: 'narrative',
    purpose: 'reflection', returnTarget: 'character_home', repeatPolicy: 'after_cooldown', topicKey: id,
    tags: ['mossprout', 'reflection'], entryNodeId: 'question', nodes: [
      { id: 'question', kind: 'choice', phase: 'explore', prompt, options: [
        { id: 'detail', label: 'One small detail', reply: '“Those are good at carrying whole places.”', nextNodeId: 'end' },
        { id: 'feeling', label: 'Mostly the feeling', reply: '“A feeling can be weather too.”', nextNodeId: 'end' },
        { id: 'nothing', label: 'Nothing in particular', reply: '“Fair. Not every day needs a lesson.”', nextNodeId: 'end' },
      ] },
      { id: 'end', kind: 'end', message: 'Mossprout lets the moment be enough.' },
    ],
  };
}

const mossproutReflections = [
  reflectionConversation('outdoor-moment', 'Something from outside', 'Was there anything outdoors you would keep from today?', ['went_somewhere', 'outdoors', 'nature']),
  reflectionConversation('weather-moment', 'The weather came too', 'What did the weather add to your day?', ['weather', 'rain', 'sun']),
  reflectionConversation('growing-moment', 'A growing thing', 'Did any plant, tree or patch of green catch your attention?', ['plant', 'garden', 'forest']),
] as const;

const mossproutNatureInsight: ConversationDefinition = {
  id: 'mossprout:insight:nature-connection', version: 2, familyId: 'mossprout', title: 'What do you look for outside?',
  trigger: 'signature_game', minimumBondLevel: 1, cooldownDays: 30, format: 'insight_game', purpose: 'learned_insight',
  returnTarget: 'character_home', repeatPolicy: 'after_cooldown', topicKey: 'nature-connection', tags: ['mossprout', 'insight', 'reflection', 'short-form'], entryNodeId: 'game',
  nodes: [
    {
      id: 'game', kind: 'insight_game', title: 'What do you look for outside?', revealNodeId: 'reveal', questions: [
        { id: 'arrival', prompt: 'A free afternoon and the door is open. Where do you end up?', options: [
          { id: 'calm-arrival', label: '🌿 Somewhere quiet with trees', spokenText: 'Somewhere quiet with trees', reply: 'The place gives your thoughts more room.', nextNodeId: null },
          { id: 'curious-arrival', label: '🗺️ Somewhere I haven’t been', spokenText: 'Somewhere I haven’t been', reply: 'Curiosity arrives before you have to invite it.', nextNodeId: null },
          { id: 'care-arrival', label: '🪴 Checking on something growing', spokenText: 'Checking on something growing', reply: 'You see the place as something alive, not scenery.', nextNodeId: null },
        ] },
        { id: 'return', prompt: 'A path you don’t know. What’s the pull?', options: [
          { id: 'calm-return', label: '🤫 The quiet at the end of it', spokenText: 'The quiet at the end of it', reply: 'The place has become a soft landing.', nextNodeId: null },
          { id: 'curious-return', label: '👀 Finding out where it goes', spokenText: 'Finding out where it goes', reply: 'The same path can still contain a new story.', nextNodeId: null },
          { id: 'care-return', label: '👥 Whoever lives along it', spokenText: 'Whoever lives along it', reply: 'Returning is part of the relationship.', nextNodeId: null },
        ] },
        { id: 'gift', prompt: 'You bring one thing home from outside. Which?', options: [
          { id: 'calm-gift', label: '🌿 A steadier feeling', spokenText: 'A steadier feeling', reply: 'Something quiet enough to carry home.', nextNodeId: null },
          { id: 'curious-gift', label: '🔎 One strange detail', spokenText: 'One strange detail', reply: 'A little wonder with muddy shoes.', nextNodeId: null },
          { id: 'care-gift', label: '🔁 A reason to go back', spokenText: 'A reason to go back', reply: 'Care gives the visit somewhere to continue.', nextNodeId: null },
        ] },
      ],
    },
    {
      id: 'reveal', kind: 'insight_reveal', title: 'Your outside instinct', insightKey: 'nature-connection', category: 'Nature', nextNodeId: 'end', results: [
        { id: 'quiet-refuge', title: 'For a quieter head', reflection: 'You look for somewhere the volume can drop.', summary: 'A little air, space, and stillness may be what matters most.', emblemId: 'mossprout-nature-calm', matchOptionIds: ['calm-arrival', 'calm-return', 'calm-gift'] },
        { id: 'living-mystery', title: 'For something to notice', reflection: 'You go outside with your attention awake.', summary: 'Change, odd details, and small discoveries keep a place alive.', emblemId: 'mossprout-nature-curious', matchOptionIds: ['curious-arrival', 'curious-return', 'curious-gift'] },
        { id: 'shared-garden', title: 'For something to care about', reflection: 'You notice the lives sharing a place with you.', summary: 'Returning and tending turn a patch of nature into a relationship.', emblemId: 'mossprout-nature-care', matchOptionIds: ['care-arrival', 'care-return', 'care-gift'] },
      ],
    },
    { id: 'end', kind: 'end', message: 'Keep it if it feels true. We can learn something different later.' },
  ],
};

const mossproutPlanningConversations: readonly ConversationDefinition[] = [
  {
    id: 'mossprout:conversation:nature-goal-discovery', version: 2, familyId: 'mossprout', title: 'Find a small nature rhythm',
    trigger: 'evergreen', minimumBondLevel: 1, cooldownDays: 1, contextualOnly: true, format: 'narrative', purpose: 'planning',
    returnTarget: 'character_home', repeatPolicy: 'after_cooldown', topicKey: 'nature-goal-discovery', tags: ['mossprout', 'goals'], entryNodeId: 'time',
    nodes: [
      { id: 'time', kind: 'choice', phase: 'explore', prompt: 'How much room is there on an ordinary day?', options: [
        { id: 'time-minute', label: 'About one minute', reply: 'A minute is enough for one real detail.', nextNodeId: 'place' },
        { id: 'time-short', label: 'Five or ten minutes', reply: 'A small pocket with room to breathe.', nextNodeId: 'place' },
        { id: 'time-outing', label: 'A proper little outing', reply: 'Then curiosity may wear its muddy shoes.', nextNodeId: 'place' },
        { id: 'time-variable', label: 'It changes day to day', reply: 'We can choose goals that bend instead of break.', nextNodeId: 'place' },
      ] },
      { id: 'place', kind: 'choice', phase: 'deepen', prompt: 'Where would it actually happen?', options: [
        { id: 'place-home', label: 'At home or by a window', reply: 'Home has habitats too.', nextNodeId: 'style' },
        { id: 'place-route', label: 'On a route I already take', reply: 'No extra expedition required.', nextNodeId: 'style' },
        { id: 'place-green', label: 'In a park or green place', reply: 'Somewhere leaves can interrupt.', nextNodeId: 'style' },
        { id: 'place-anywhere', label: 'Wherever I happen to be', reply: 'Then it should travel lightly.', nextNodeId: 'style' },
      ] },
      { id: 'style', kind: 'choice', phase: 'resolve', prompt: 'What would you actually do?', options: [
        { id: 'style-notice', label: 'Notice one small detail', reply: 'One detail, no report required.', nextNodeId: 'goals-notice' },
        { id: 'style-pause', label: 'Pause outside briefly', reply: 'A pause is allowed to stay small.', nextNodeId: 'goals-pause' },
        { id: 'style-tend', label: 'Care for something growing', reply: 'A practical kind of attention.', nextNodeId: 'goals-tend' },
        { id: 'style-visit', label: 'Visit or revisit a place', reply: 'A place can become familiar one return at a time.', nextNodeId: 'goals-visit' },
      ] },
      { id: 'goals-notice', kind: 'goal_proposal', prompt: 'These could fit. Keep any?', goalTypeId: 'mossprout:nature-connection', goalTitle: 'Notice a little more', summary: 'Small observations, fitted around real life.', suggestedQuickGoalIds: ['mossprout:notice-living-thing', 'mossprout:season-change', 'mossprout:window-view'], nextNodeId: 'end' },
      { id: 'goals-pause', kind: 'goal_proposal', prompt: 'These could fit. Keep any?', goalTypeId: 'mossprout:nature-connection', goalTitle: 'Make a little room', summary: 'A breath of outside, without the homework.', suggestedQuickGoalIds: ['mossprout:step-outside', 'mossprout:sit-outside', 'mossprout:window-view'], nextNodeId: 'end' },
      { id: 'goals-tend', kind: 'goal_proposal', prompt: 'These could fit. Keep any?', goalTypeId: 'mossprout:nature-connection', goalTitle: 'Tend something small', summary: 'Care you can see and do.', suggestedQuickGoalIds: ['mossprout:care-for-plant', 'mossprout:notice-living-thing', 'mossprout:same-place'], nextNodeId: 'end' },
      { id: 'goals-visit', kind: 'goal_proposal', prompt: 'These could fit. Keep any?', goalTypeId: 'mossprout:nature-connection', goalTitle: 'Go back and see', summary: 'A place becomes familiar one return at a time.', suggestedQuickGoalIds: ['mossprout:visit-green', 'mossprout:same-place', 'mossprout:season-change'], nextNodeId: 'end' },
      { id: 'end', kind: 'end', message: 'The goals should fit your day. Your day does not have to fit the goals.' },
    ],
  },
  {
    id: 'mossprout:conversation:quest-handoff', version: 4, familyId: 'mossprout', title: 'Take a small invitation',
    trigger: 'evergreen', minimumBondLevel: 1, cooldownDays: 3, contextualOnly: true, format: 'narrative', purpose: 'planning',
    returnTarget: 'quest', repeatPolicy: 'after_cooldown', topicKey: 'quest-handoff', tags: ['mossprout', 'quest'], entryNodeId: 'quest',
    nodes: [
      { id: 'quest', kind: 'quest_handoff', prompt: 'Want one small reason to look around?', suggestedQuestIds: ['quest-mossprout-green-photo', 'quest-mossprout-nature-note'], fallbackNodeId: 'fallback', nextNodeId: 'end' },
      { id: 'fallback', kind: 'choice', phase: 'resolve', prompt: 'Nothing needs to be forced today.', options: [{ id: 'later', label: 'Leave it for later', reply: 'The path will still be here.', nextNodeId: 'end' }] },
      { id: 'end', kind: 'end', message: 'Choose only what feels like an invitation.' },
    ],
  },
];

export const mossproutStoryConversationDefinitions: readonly ConversationDefinition[] = [
  mossproutFirstDayGoalConversation,
  mossproutFirstDayPlayfulConversation,
  mossproutFormFinder,
  mossproutNatureInsight,
  ...mossproutBondConversations,
  ...mossproutReflections,
  ...mossproutNatureQuestions,
  ...mossproutScenarioQuestions,
  ...mossproutNatureJournals,
  ...mossproutPlanningConversations,
];
