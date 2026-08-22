import type { ConversationDefinition, ConversationProfileQuestion } from '@/types/companion-conversation';
import type { KatchimeraSkinId } from '@/types/katchimera';

const MOSS_FORMS = [
  'mossprout', 'petalimp', 'fernip', 'amberleaf', 'blossle',
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
    id: `${prefix}:playful`, version: 4, familyId: 'mossprout', title, trigger: 'poll', minimumBondLevel: 1,
    cooldownDays: 3650, contextualOnly: true, format: 'poll', purpose: 'get_to_know', returnTarget: 'character_home',
    repeatPolicy: 'once_ever', topicKey: `${prefix}:playful`, tags: ['mossprout', 'nature', 'playful'], entryNodeId: 'one', nodes: [
      { id: 'one', kind: 'choice', prompt: 'A path disappears behind ferns. Your first thought?', options: [
        { id: 'follow', label: 'Obviously I follow it', reply: 'Correct. Suspicious paths hate being ignored.', nextNodeId: 'two' },
        { id: 'look', label: 'I inspect it first', reply: 'A sensible amount of mystery.', nextNodeId: 'two' },
        { id: 'snack', label: 'Do I have snacks?', reply: 'The most experienced woodland question.', nextNodeId: 'two' },
      ] },
      { id: 'two', kind: 'choice', prompt: 'Pick a tiny outdoor luxury.', options: [
        { id: 'shade', label: 'Perfect tree shade', reply: 'A room made entirely of leaves.', nextNodeId: 'poll' },
        { id: 'rain', label: 'Rain while safely sheltered', reply: 'Excellent weather, excellent roof.', nextNodeId: 'poll' },
        { id: 'sun', label: 'The first warm sun', reply: 'A solar-powered little victory.', nextNodeId: 'poll' },
      ] },
      { id: 'poll', kind: 'poll', prompt: pollPrompt, helperText: 'A fictional poll from visitors to the Haven.', options: [
        { id: 'forest', label: 'A hidden forest path', reply: 'The ferns have voted to adopt you.', nextNodeId: null, villageWeight: 44 },
        { id: 'garden', label: 'A slightly wild garden', reply: 'Useful, beautiful, and allowed to be messy.', nextNodeId: null, villageWeight: 34 },
        { id: 'coast', label: 'Windy water and open sky', reply: 'Your thoughts may need more horizon.', nextNodeId: null, villageWeight: 22 },
      ], nextNodeId: 'end' },
      { id: 'end', kind: 'end', message: 'Mossprout records the result with unnecessary seriousness.' },
    ],
  };
}

function natureQuestionConversation(input: {
  id: string;
  title: string;
  actionTitle: string;
  outcome: 'poll' | 'archetype';
  resultTitles?: readonly [string, string, string];
  firstPrompt: string;
  first: readonly [id: string, label: string, reply: string][];
  secondPrompt: string;
  second: readonly [id: string, label: string, reply: string][];
  ending: string;
}): ConversationDefinition {
  const archetype = input.outcome === 'archetype';
  return {
    id: `mossprout:conversation:nature-question:${input.id}`,
    version: 2,
    familyId: 'mossprout',
    title: input.title,
    actionTitle: input.actionTitle,
    trigger: 'evergreen',
    minimumBondLevel: 1,
    cooldownDays: 1,
    format: archetype ? 'insight_game' : 'poll',
    purpose: 'get_to_know',
    returnTarget: 'character_home',
    repeatPolicy: 'after_cooldown',
    topicKey: `nature-question:${input.id}`,
    tags: ['mossprout', 'nature', 'nature-question'],
    entryNodeId: archetype ? 'game' : 'first',
    nodes: archetype ? [
      {
        id: 'game', kind: 'insight_game', title: input.title, revealNodeId: 'reveal', questions: [
          { id: 'first', prompt: input.firstPrompt, options: input.first.map(([id, label, reply]) => ({ id, label, reply, nextNodeId: null })) },
          { id: 'second', prompt: input.secondPrompt, options: input.second.map(([id, label, reply]) => ({ id, label, reply, nextNodeId: null })) },
          { id: 'change', prompt: 'The Garden changes while you are looking. What do you do?', options: [
            { id: `${input.id}:change:0`, label: 'Follow the change', reply: 'Curiosity has quick little roots.', nextNodeId: null },
            { id: `${input.id}:change:1`, label: 'Stop and notice it', reply: 'A careful look keeps more than it takes.', nextNodeId: null },
            { id: `${input.id}:change:2`, label: 'Give it time', reply: 'Some answers prefer not to be hurried.', nextNodeId: null },
          ] },
          { id: 'keep', prompt: 'What should Mossprout keep from this extremely serious result?', options: [
            { id: `${input.id}:keep:0`, label: 'The adventure', reply: 'Filed under paths worth following.', nextNodeId: null },
            { id: `${input.id}:keep:1`, label: 'The small detail', reply: 'Filed under things most people miss.', nextNodeId: null },
            { id: `${input.id}:keep:2`, label: 'The gentle choice', reply: 'Filed under care without fuss.', nextNodeId: null },
          ] },
        ],
      },
      {
        id: 'reveal', kind: 'insight_reveal', title: 'Your nature-side result', insightKey: `nature-fun:${input.id}`,
        category: 'Nature', persistence: 'display_only', nextNodeId: 'end',
        results: [0, 1, 2].map((index) => ({
          id: `${input.id}:result:${index}`,
          title: input.resultTitles?.[index] ?? ['A Curious Sprout', 'A Careful Fern', 'A Ready Root'][index]!,
          reflection: input.ending,
          summary: `${input.ending} This is a playful result, not a permanent label.`,
          emblemId: `mossprout-fun-${index + 1}`,
          matchOptionIds: [input.first[index]![0], input.second[index]![0], `${input.id}:change:${index}`, `${input.id}:keep:${index}`],
        })),
      },
      { id: 'end', kind: 'end', message: input.ending },
    ] : [
      {
        id: 'first', kind: 'choice', phase: 'explore', prompt: input.firstPrompt,
        options: input.first.map(([id, label, reply]) => ({ id, label, reply, nextNodeId: 'second' })),
      },
      {
        id: 'second', kind: 'poll', prompt: input.secondPrompt, helperText: 'A fictional poll from visitors to the Haven.',
        options: input.second.map(([id, label, reply], index) => ({ id, label, reply, nextNodeId: null, villageWeight: [42, 34, 24][index]! })),
        nextNodeId: 'end',
      },
      { id: 'end', kind: 'end', message: input.ending },
    ],
  };
}

const mossproutNatureQuestions: readonly ConversationDefinition[] = [
  natureQuestionConversation({
    id: 'suspicious-path',
    title: 'A suspicious little path',
    actionTitle: 'Follow the suspicious path?',
    outcome: 'archetype',
    resultTitles: ['A Curious Trailblazer', 'A Careful Naturalist', 'A Prepared Wanderer'],
    firstPrompt: 'A path disappears behind a wall of ferns. What is the sensible response?',
    first: [
      ['follow', 'Follow it immediately', 'Correct. Suspicious paths hate being ignored.'],
      ['inspect', 'Inspect it first', 'A responsible amount of mystery.'],
      ['snacks', 'Check the snack situation', 'The most experienced woodland answer.'],
    ],
    secondPrompt: 'The path ends at a very small door in a tree. Now what?',
    second: [
      ['knock', 'Knock politely', 'Excellent forest manners.'],
      ['listen', 'Listen at the door', 'Something inside is making tea, or plotting.'],
      ['leave-note', 'Leave a tiny note', 'Diplomacy, but extremely small.'],
    ],
    ending: 'Mossprout marks you down as appropriately prepared for suspicious paths.',
  }),
  natureQuestionConversation({
    id: 'weather-committee',
    title: 'The weather committee',
    actionTitle: 'Choose the perfect weather',
    outcome: 'poll',
    firstPrompt: 'You may keep one kind of outdoor weather for an hour. Which one?',
    first: [
      ['sun', 'Warm sun with a breeze', 'A classic. Even the leaves look pleased.'],
      ['rain', 'Rain under a good shelter', 'Weather you can hear without having to wear.'],
      ['mist', 'A misty quiet morning', 'The world, briefly keeping a secret.'],
    ],
    secondPrompt: 'What should happen immediately afterwards?',
    second: [
      ['rainbow', 'An unnecessary rainbow', 'Unnecessary rainbows are often the best kind.'],
      ['smell', 'That fresh-after-rain smell', 'The ground taking one enormous breath.'],
      ['light', 'Golden light through leaves', 'Very dramatic. Mossprout approves.'],
    ],
    ending: 'The weather committee accepts your proposal with only minor leaf-shuffling.',
  }),
  natureQuestionConversation({
    id: 'garden-guests',
    title: 'The Garden guest list',
    actionTitle: 'Invite a tiny Garden guest',
    outcome: 'archetype',
    resultTitles: ['A Busy Garden Friend', 'A Quiet Pondkeeper', 'A Cheerful Birdwatcher'],
    firstPrompt: 'One tiny visitor may move into the Garden. Who gets the first invitation?',
    first: [
      ['bee', 'A very busy bee', 'It has already requested a clipboard.'],
      ['frog', 'A suspiciously calm frog', 'It brings no luggage and many opinions.'],
      ['bird', 'A round little bird', 'Mostly feathers. Some bird.'],
    ],
    secondPrompt: 'What job should this visitor absolutely not be trusted with?',
    second: [
      ['weather', 'Predicting the weather', 'They will simply announce whatever is already happening.'],
      ['seeds', 'Organising the Seeds', 'Every pile would become a snack or a nest.'],
      ['directions', 'Giving directions', 'All routes would somehow end at their favourite stone.'],
    ],
    ending: 'Mossprout adds the visitor to the list, with several sensible restrictions.',
  }),
  natureQuestionConversation({
    id: 'outdoor-luxury',
    title: 'A tiny outdoor luxury',
    actionTitle: 'Pick a tiny outdoor luxury',
    outcome: 'poll',
    firstPrompt: 'Choose one completely ordinary outdoor luxury.',
    first: [
      ['shade', 'Perfect tree shade', 'A room made entirely of leaves.'],
      ['sun', 'The first warm sun', 'A solar-powered little victory.'],
      ['petrichor', 'The smell after rain', 'The ground has excellent perfume.'],
    ],
    secondPrompt: 'What makes the moment officially complete?',
    second: [
      ['drink', 'A favourite drink', 'Hydration with emotional support.'],
      ['quiet', 'Nobody needing anything', 'A rare and protected habitat.'],
      ['company', 'One good companion', 'Someone who knows when not to fill the quiet.'],
    ],
    ending: 'Mossprout files this under important luxuries that cost almost nothing.',
  }),
  natureQuestionConversation({
    id: 'tree-neighbour', title: 'Choose a tree neighbour', actionTitle: 'Choose your tree neighbour', outcome: 'archetype',
    resultTitles: ['The Canopy Conversationalist', 'The Patient Tree Reader', 'The Rooted Neighbour'],
    firstPrompt: 'A tree may become your new neighbour. Which quality matters most?',
    first: [
      ['tree-wide', 'Excellent climbing branches', 'A tree with several possible plotlines.'],
      ['tree-old', 'Clearly very old', 'A neighbour with slow stories.'],
      ['tree-home', 'Full of tiny visitors', 'Already running a successful habitat.'],
    ],
    secondPrompt: 'What should happen beneath it?',
    second: [
      ['tree-picnic', 'An unnecessarily good picnic', 'Crumbs will be governed responsibly.'],
      ['tree-read', 'A quiet hour with a book', 'The leaves agree to handle the background noise.'],
      ['tree-watch', 'Watch who comes and goes', 'Neighbourhood research of the gentlest kind.'],
    ],
    ending: 'Mossprout approves your tree-neighbour application.',
  }),
  natureQuestionConversation({
    id: 'cloud-job', title: 'A job for one cloud', actionTitle: 'Give one cloud a job', outcome: 'poll',
    firstPrompt: 'You are in charge of one small cloud. What job does it get?',
    first: [
      ['cloud-shade', 'Follow me with shade', 'A highly personal weather service.'],
      ['cloud-rain', 'Water one thirsty garden', 'Efficient, local, and slightly dramatic.'],
      ['cloud-shape', 'Make suspicious shapes', 'The cloud has already become a duck-key.'],
    ],
    secondPrompt: 'How should the cloud finish its shift?',
    second: [
      ['cloud-gold', 'Turn gold at sunset', 'A proper clocking-off ceremony.'],
      ['cloud-vanish', 'Vanish mysteriously', 'No paperwork, only atmosphere.'],
      ['cloud-rainbow', 'Leave a tiny rainbow', 'A tasteful amount of spectacle.'],
    ],
    ending: 'The cloud accepts the role and requests flexible working weather.',
  }),
  natureQuestionConversation({
    id: 'pocket-expedition', title: 'The pocket-sized expedition', actionTitle: 'Take a pocket-sized expedition', outcome: 'archetype',
    resultTitles: ['The Bright Detour', 'The Detail Collector', 'The Gentle Pathfinder'],
    firstPrompt: 'A ten-minute expedition begins outside your door. What are you looking for?',
    first: [
      ['exp-route', 'A route I have not tried', 'Ten minutes is plenty for one useful detour.'],
      ['exp-detail', 'One thing I usually miss', 'A very small expedition with excellent eyesight.'],
      ['exp-place', 'A quiet place to pause', 'The destination is allowed to be stillness.'],
    ],
    secondPrompt: 'What belongs in the expedition report?',
    second: [
      ['exp-story', 'The best tiny story', 'All expeditions need one improbable sentence.'],
      ['exp-list', 'Three precise details', 'A report with dirt under its fingernails.'],
      ['exp-feel', 'How the place felt', 'Atmosphere is valid field evidence.'],
    ],
    ending: 'Mossprout stamps the expedition complete, despite its very reasonable size.',
  }),
  natureQuestionConversation({
    id: 'garden-rule', title: 'One new Garden rule', actionTitle: 'Make one new Garden rule', outcome: 'poll',
    firstPrompt: 'The Garden may adopt one official rule. Which rule passes?',
    first: [
      ['rule-wild', 'One corner stays completely wild', 'The corner immediately becomes important.'],
      ['rule-seat', 'Every path needs a resting place', 'A rule written by sensible knees.'],
      ['rule-snack', 'Garden meetings require snacks', 'Passed without debate.'],
    ],
    secondPrompt: 'Who is appointed to enforce it?',
    second: [
      ['rule-frog', 'The calm frog', 'Enforcement will involve prolonged staring.'],
      ['rule-bee', 'The clipboard bee', 'There will be forms. Many forms.'],
      ['rule-moss', 'A patch of moss', 'Soft power in its purest form.'],
    ],
    ending: 'The rule enters Garden law with immediate and leafy effect.',
  }),
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
  return {
    id: `mossprout:conversation:nature-journal:${input.id}`,
    version: 2,
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
    entryNodeId: input.prompts[0]!.id,
    nodes: [
      ...input.prompts.map((item, index) => ({
        id: item.id,
        kind: 'choice' as const,
        phase: index === input.prompts.length - 1 ? 'resolve' as const : 'explore' as const,
        prompt: item.prompt,
        options: item.options.map(([id, label, reply]) => ({
          id, label, reply, nextNodeId: input.prompts[index + 1]?.id ?? 'save-note',
        })),
      })),
      {
        id: 'save-note', kind: 'journal_handoff', prompt: 'Keep this small nature moment?',
        title: input.title, body: 'Mossprout shaped your answers into a small field note. Edit anything, then keep it here in your journal together.',
        flowId: 'went_somewhere', allowedChoiceIds: ['park', 'garden', 'forest', 'home', 'other_place'],
        saveLabel: 'Save field note', rewardGrowth: 20, nextNodeId: 'end',
      },
      { id: 'end', kind: 'end', message: input.ending },
    ],
  };
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
      { id: 'green', label: 'Leaves, gardens and growing things', reply: 'A green answer. Mossprout approves.', nextNodeId: null, nextQuestionId: 'green-form', affinity: { mossprout: 1, petalimp: 1, fernip: 1 } },
      { id: 'season', label: 'Colour, seasons and changing light', reply: 'You notice a place changing its coat.', nextNodeId: null, nextQuestionId: 'season-form', affinity: { amberleaf: 1, blossle: 1, mistle: 1 } },
      { id: 'weather', label: 'Rain, wind and open sky', reply: 'The weather gets to be part of the place.', nextNodeId: null, nextQuestionId: 'weather-form', affinity: { drizzlet: 1, driftkin: 1, tempesto: 1 } },
    ],
  },
  { id: 'green-form', prompt: 'What draws you closer?', options: [
    { id: 'moss', label: 'Soft, quiet green places', reply: 'Mossprout knows those well.', nextNodeId: null, nextQuestionId: 'finish', affinity: { mossprout: 5 } },
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
    { id: 'calm', label: 'A little calm', reply: 'Then we will leave room for quiet.', nextNodeId: null, nextQuestionId: null, affinity: { mossprout: 1, mistle: 1, drizzlet: 1 } },
    { id: 'wonder', label: 'Something to notice', reply: 'Curiosity has very good roots.', nextNodeId: null, nextQuestionId: null, affinity: { fernip: 1, blossle: 1, tempesto: 1 } },
    { id: 'care', label: 'Something to care for', reply: 'Care is one way a place becomes yours.', nextNodeId: null, nextQuestionId: null, affinity: { petalimp: 1, amberleaf: 1, driftkin: 1 } },
  ] },
];

const mossproutFormDescriptions = Object.fromEntries(MOSS_FORMS.map((formId) => [
  formId,
  `${formId[0]!.toUpperCase()}${formId.slice(1)} reflects the way you like to meet nature right now. It is a collectible card, not a permanent label.`,
])) as Partial<Record<KatchimeraSkinId, string>>;

const mossproutFormFinder: ConversationDefinition = {
  id: 'mossprout:game:form-finder', version: 5, familyId: 'mossprout', title: 'Find your nature-side card',
  trigger: 'signature_game', minimumBondLevel: 1, cooldownDays: 3650, contextualOnly: true, format: 'profile_game',
  purpose: 'card_discovery', returnTarget: 'character_home', repeatPolicy: 'once_ever', topicKey: 'nature-card',
  tags: ['forms', 'mossprout'], entryNodeId: 'game', nodes: [
    { id: 'game', kind: 'profile_game', title: 'Find your nature-side card', entryQuestionId: 'nature-world', questions: mossproutProfileQuestions, revealNodeId: 'reveal' },
    { id: 'reveal', kind: 'form_reveal', title: 'Your first Mossprout card', descriptions: mossproutFormDescriptions, memoryKey: 'preference:mossprout:form-match', nextNodeId: 'end' },
    { id: 'end', kind: 'end', message: 'This one is yours. The other cards can be discovered later.' },
  ],
};

function bondConversation(level: 2 | 3 | 4, prompt: string, ending: string): ConversationDefinition {
  return {
    id: `mossprout:conversation:bond-${level}`, version: 3, familyId: 'mossprout', title: `A change Mossprout noticed`,
    trigger: 'bond', minimumBondLevel: level, cooldownDays: 3650, contextualOnly: true, format: 'narrative',
    purpose: 'bond_milestone', returnTarget: 'character_home', repeatPolicy: 'once_ever', topicKey: `bond-${level}`,
    tags: ['mossprout', 'bond'], entryNodeId: 'question', nodes: [
      { id: 'question', kind: 'choice', phase: 'explore', prompt, options: [
        { id: 'quiet', label: 'Keep noticing quietly', reply: 'Quiet attention grows deep roots.', nextNodeId: 'end' },
        { id: 'curious', label: 'Ask me curious things', reply: 'Good. I have a pocket full of questions.', nextNodeId: 'end' },
        { id: 'practical', label: 'Give me small ideas', reply: 'Small enough to fit into a real day.', nextNodeId: 'end' },
      ] },
      { id: 'end', kind: 'end', message: ending },
    ],
  };
}

const mossproutBondConversations = [
  bondConversation(2, 'We have spent enough time together that I am learning how you notice things. How should I help?', 'Mossprout remembers how to meet you here.'),
  bondConversation(3, 'The garden feels less like mine and more like ours. What should we grow more of between visits?', 'Another corner of the garden feels shared.'),
  bondConversation(4, 'You have changed this place without ever asking it to hurry. What should I keep reminding you?', 'The pond keeps the answer in its reflection.'),
] as const;

function reflectionConversation(id: string, title: string, prompt: string, routeKeys: readonly string[]): ConversationDefinition {
  return {
    id: `mossprout:conversation:${id}`, version: 3, familyId: 'mossprout', title, trigger: 'journal',
    triggerRouteKeys: routeKeys, minimumBondLevel: 1, cooldownDays: 5, contextualOnly: true, format: 'narrative',
    purpose: 'reflection', returnTarget: 'character_home', repeatPolicy: 'after_cooldown', topicKey: id,
    tags: ['mossprout', 'reflection'], entryNodeId: 'question', nodes: [
      { id: 'question', kind: 'choice', phase: 'explore', prompt, options: [
        { id: 'detail', label: 'One small detail stayed with me', reply: 'Small details are excellent at carrying whole places.', nextNodeId: 'end' },
        { id: 'feeling', label: 'Mostly the feeling of it', reply: 'A feeling can be a kind of weather too.', nextNodeId: 'end' },
        { id: 'nothing', label: 'Nothing particular', reply: 'That is all right. A day does not need to become a lesson.', nextNodeId: 'end' },
      ] },
      { id: 'end', kind: 'end', message: 'Mossprout lets the moment settle without trying to improve it.' },
    ],
  };
}

const mossproutReflections = [
  reflectionConversation('outdoor-moment', 'Something from outside', 'Was there anything outdoors you would keep from today?', ['went_somewhere', 'outdoors', 'nature']),
  reflectionConversation('weather-moment', 'The weather came too', 'What did the weather add to your day?', ['weather', 'rain', 'sun']),
  reflectionConversation('growing-moment', 'A growing thing', 'Did any plant, tree or patch of green catch your attention?', ['plant', 'garden', 'forest']),
] as const;

const mossproutNatureInsight: ConversationDefinition = {
  id: 'mossprout:insight:nature-connection', version: 1, familyId: 'mossprout', title: 'What does nature give back to you?',
  trigger: 'signature_game', minimumBondLevel: 1, cooldownDays: 30, format: 'insight_game', purpose: 'learned_insight',
  returnTarget: 'character_home', repeatPolicy: 'after_cooldown', topicKey: 'nature-connection', tags: ['mossprout', 'insight', 'reflection'], entryNodeId: 'game',
  nodes: [
    {
      id: 'game', kind: 'insight_game', title: 'What does nature give back to you?', revealNodeId: 'reveal', questions: [
        { id: 'arrival', prompt: 'When you reach somewhere green, what changes first?', options: [
          { id: 'calm-arrival', label: 'My thoughts get quieter', reply: 'The place gives your thoughts more room.', nextNodeId: null },
          { id: 'curious-arrival', label: 'I start looking around', reply: 'Curiosity arrives before you have to invite it.', nextNodeId: null },
          { id: 'care-arrival', label: 'I notice what needs care', reply: 'You see the place as something alive, not scenery.', nextNodeId: null },
        ] },
        { id: 'detail', prompt: 'Which detail is most likely to stay with you?', options: [
          { id: 'calm-detail', label: 'The air or the quiet', reply: 'The atmosphere becomes the memory.', nextNodeId: null },
          { id: 'curious-detail', label: 'Something unexpected', reply: 'One odd detail can hold the whole visit.', nextNodeId: null },
          { id: 'care-detail', label: 'A plant or living visitor', reply: 'You remember the lives sharing the place.', nextNodeId: null },
        ] },
        { id: 'return', prompt: 'What makes you want to return?', options: [
          { id: 'calm-return', label: 'Knowing I can breathe there', reply: 'The place has become a soft landing.', nextNodeId: null },
          { id: 'curious-return', label: 'Knowing it will have changed', reply: 'The same path can still contain a new story.', nextNodeId: null },
          { id: 'care-return', label: 'Feeling connected to it', reply: 'Returning is part of the relationship.', nextNodeId: null },
        ] },
        { id: 'gift', prompt: 'If the garden could leave one thing with you, what would you choose?', options: [
          { id: 'calm-gift', label: 'A steadier feeling', reply: 'Something quiet enough to carry home.', nextNodeId: null },
          { id: 'curious-gift', label: 'A question or discovery', reply: 'A little wonder with muddy shoes.', nextNodeId: null },
          { id: 'care-gift', label: 'Something worth tending', reply: 'Care gives the visit somewhere to continue.', nextNodeId: null },
        ] },
      ],
    },
    {
      id: 'reveal', kind: 'insight_reveal', title: 'What Mossprout learned about you', insightKey: 'nature-connection', category: 'Nature', nextNodeId: 'end', results: [
        { id: 'quiet-refuge', title: 'Nature as a Quiet Refuge', reflection: 'You seem to meet nature as somewhere the volume can come down without demanding anything from you.', summary: 'Green spaces matter most when they offer room to breathe, quieter thoughts, and a steadier feeling to carry back into the day.', emblemId: 'mossprout-nature-calm', matchOptionIds: ['calm-arrival', 'calm-detail', 'calm-return', 'calm-gift'] },
        { id: 'living-mystery', title: 'Nature as a Living Mystery', reflection: 'You meet the outdoors with your attention awake. Change and small surprises make familiar places feel new.', summary: 'Nature connects with you through curiosity: unexpected details, changing paths, and discoveries that keep the world from feeling finished.', emblemId: 'mossprout-nature-curious', matchOptionIds: ['curious-arrival', 'curious-detail', 'curious-return', 'curious-gift'] },
        { id: 'shared-garden', title: 'Nature as a Shared Garden', reflection: 'You notice that outdoor places are full of other lives. Connection grows through attention and care.', summary: 'Nature feels meaningful when it becomes a relationship—something living to notice, revisit, protect, or gently tend.', emblemId: 'mossprout-nature-care', matchOptionIds: ['care-arrival', 'care-detail', 'care-return', 'care-gift'] },
      ],
    },
    { id: 'end', kind: 'end', message: 'Keep it if it feels true. We can learn something different later.' },
  ],
};

const mossproutPlanningConversations: readonly ConversationDefinition[] = [
  {
    id: 'mossprout:conversation:nature-goal-discovery', version: 1, familyId: 'mossprout', title: 'Find nature goals that fit',
    trigger: 'evergreen', minimumBondLevel: 1, cooldownDays: 1, format: 'narrative', purpose: 'planning',
    returnTarget: 'character_home', repeatPolicy: 'after_cooldown', topicKey: 'nature-goal-discovery', tags: ['mossprout', 'goals'], entryNodeId: 'time',
    nodes: [
      { id: 'time', kind: 'choice', phase: 'explore', prompt: 'How much room could nature realistically have in your day?', options: [
        { id: 'time-minute', label: 'About one minute', reply: 'A minute is enough for one real detail.', nextNodeId: 'place' },
        { id: 'time-short', label: 'Five or ten minutes', reply: 'A small pocket with room to breathe.', nextNodeId: 'place' },
        { id: 'time-outing', label: 'A proper little outing', reply: 'Then curiosity may wear its muddy shoes.', nextNodeId: 'place' },
        { id: 'time-variable', label: 'It changes day to day', reply: 'We can choose goals that bend instead of break.', nextNodeId: 'place' },
      ] },
      { id: 'place', kind: 'choice', phase: 'deepen', prompt: 'Where is a goal most likely to survive real life?', options: [
        { id: 'place-home', label: 'At home or by a window', reply: 'Home already contains small habitats.', nextNodeId: 'benefit' },
        { id: 'place-route', label: 'On a route I already take', reply: 'No extra expedition required.', nextNodeId: 'benefit' },
        { id: 'place-green', label: 'In a park or green place', reply: 'Somewhere leaves can interrupt the noise.', nextNodeId: 'benefit' },
        { id: 'place-anywhere', label: 'Wherever I happen to be', reply: 'Then the goal should travel lightly.', nextNodeId: 'benefit' },
      ] },
      { id: 'benefit', kind: 'choice', phase: 'deepen', prompt: 'What would you most like nature to give back?', options: [
        { id: 'benefit-calm', label: 'A quieter pace', reply: 'We will favour pauses over achievements.', nextNodeId: 'style' },
        { id: 'benefit-curious', label: 'Something interesting', reply: 'A goal can leave room for surprise.', nextNodeId: 'style' },
        { id: 'benefit-care', label: 'Something worth caring for', reply: 'Tending makes attention visible.', nextNodeId: 'style' },
        { id: 'benefit-return', label: 'A reason to go back', reply: 'Returning turns a place into a relationship.', nextNodeId: 'style' },
      ] },
      { id: 'style', kind: 'choice', phase: 'resolve', prompt: 'Which kind of action sounds kind rather than demanding?', options: [
        { id: 'style-notice', label: 'Notice one small detail', reply: 'One detail, no report required.', nextNodeId: 'goals-notice' },
        { id: 'style-pause', label: 'Pause outside briefly', reply: 'A pause is allowed to stay small.', nextNodeId: 'goals-pause' },
        { id: 'style-tend', label: 'Care for something growing', reply: 'A practical kind of attention.', nextNodeId: 'goals-tend' },
        { id: 'style-visit', label: 'Visit or revisit a place', reply: 'A place can become familiar one return at a time.', nextNodeId: 'goals-visit' },
      ] },
      { id: 'goals-notice', kind: 'goal_proposal', prompt: 'Which of these matched goals should join Today?', goalTypeId: 'mossprout:nature-connection', goalTitle: 'Goals for a noticing nature', summary: 'Your answers point toward small observations that can fit around real life.', suggestedQuickGoalIds: ['mossprout:notice-living-thing', 'mossprout:season-change', 'mossprout:window-view'], nextNodeId: 'end' },
      { id: 'goals-pause', kind: 'goal_proposal', prompt: 'Which of these matched goals should join Today?', goalTypeId: 'mossprout:nature-connection', goalTitle: 'Goals for a quieter nature pause', summary: 'Your answers favour a little breathing room without turning it into homework.', suggestedQuickGoalIds: ['mossprout:step-outside', 'mossprout:sit-outside', 'mossprout:window-view'], nextNodeId: 'end' },
      { id: 'goals-tend', kind: 'goal_proposal', prompt: 'Which of these matched goals should join Today?', goalTypeId: 'mossprout:nature-connection', goalTitle: 'Goals for gentle tending', summary: 'Your answers connect nature with attention, care, and visible follow-through.', suggestedQuickGoalIds: ['mossprout:care-for-plant', 'mossprout:notice-living-thing', 'mossprout:same-place'], nextNodeId: 'end' },
      { id: 'goals-visit', kind: 'goal_proposal', prompt: 'Which of these matched goals should join Today?', goalTypeId: 'mossprout:nature-connection', goalTitle: 'Goals for returning outdoors', summary: 'Your answers suggest making a little more room for place, change, and return.', suggestedQuickGoalIds: ['mossprout:visit-green', 'mossprout:same-place', 'mossprout:season-change'], nextNodeId: 'end' },
      { id: 'end', kind: 'end', message: 'The goals should fit your day. Your day does not have to fit the goals.' },
    ],
  },
  {
    id: 'mossprout:conversation:quest-handoff', version: 3, familyId: 'mossprout', title: 'Choose a nature invitation',
    trigger: 'evergreen', minimumBondLevel: 1, cooldownDays: 3, contextualOnly: true, format: 'narrative', purpose: 'planning',
    returnTarget: 'quest', repeatPolicy: 'after_cooldown', topicKey: 'quest-handoff', tags: ['mossprout', 'quest'], entryNodeId: 'quest',
    nodes: [
      { id: 'quest', kind: 'quest_handoff', prompt: 'Would one of these nature invitations fit?', suggestedQuestIds: ['quest-mossprout-green-photo', 'quest-mossprout-nature-note'], fallbackNodeId: 'fallback', nextNodeId: 'end' },
      { id: 'fallback', kind: 'choice', phase: 'resolve', prompt: 'Nothing needs to be forced today.', options: [{ id: 'later', label: 'Leave it for later', reply: 'The path will still be here.', nextNodeId: 'end' }] },
      { id: 'end', kind: 'end', message: 'Choose only what feels like an invitation.' },
    ],
  },
];

export const mossproutStoryConversationDefinitions: readonly ConversationDefinition[] = [
  ...dryPondJourneyConversations,
  ...mossproutJourneyActionConversations,
  mossproutFirstDayGoalConversation,
  mossproutFirstDayPlayfulConversation,
  mossproutFormFinder,
  mossproutNatureInsight,
  ...mossproutBondConversations,
  ...mossproutReflections,
  ...mossproutNatureQuestions,
  ...mossproutNatureJournals,
  ...mossproutPlanningConversations,
];
