import type { ConversationDefinition, ConversationOption } from '@/types/companion-conversation';

export const FEASTLE_FIRST_MEETING_DEFINITION_ID = 'feastle:first-meeting';

export const feastleFirstMeetingConversationDefinition: ConversationDefinition = {
  id: FEASTLE_FIRST_MEETING_DEFINITION_ID,
  version: 1,
  familyId: 'feastle',
  title: 'A place at the table',
  trigger: 'evergreen',
  minimumBondLevel: 1,
  cooldownDays: 3650,
  contextualOnly: true,
  isOpener: true,
  format: 'opener',
  tags: ['story', 'first-meeting'],
  entryNodeId: 'table',
  nodes: [
    {
      id: 'table',
      kind: 'choice',
      phase: 'explore',
      prompt: 'I brought a basket and one runaway spoon. Before we set the table, what would make food feel a little kinder lately?',
      options: [
        { id: 'ease', label: 'Fewer decisions', reply: 'Then I’ll keep things simple. No menu maze, no perfect answer.', nextNodeId: 'pact' },
        { id: 'care', label: 'A little more care', reply: 'I can do care. The quiet, warm-soup kind—not the fussy kind.', nextNodeId: 'pact' },
        { id: 'connection', label: 'More shared moments', reply: 'Good. I’ll always leave room for one more plate.', nextNodeId: 'pact' },
        { id: 'curiosity', label: 'Something new sometimes', reply: 'A tiny adventure, then. Nothing that needs twelve mysterious jars.', nextNodeId: 'pact' },
      ],
    },
    {
      id: 'pact',
      kind: 'choice',
      phase: 'deepen',
      prompt: 'And when the day goes a bit sideways, how would you like me beside you?',
      options: [
        { id: 'gentle', label: 'Keep it gentle', reply: 'Always. Messy days still get a seat at our table.', nextNodeId: 'pantry' },
        { id: 'practical', label: 'Help me find one easy step', reply: 'One small step at a time. I’ll bring the basket; you pick what feels doable.', nextNodeId: 'pantry' },
        { id: 'patterns', label: 'Notice what works', reply: 'I’ll notice the helpful bits and never turn them into rules.', nextNodeId: 'pantry' },
        { id: 'on_demand', label: 'Give me space until I ask', reply: 'Of course. I’ll keep your place warm and wait for the signal.', nextNodeId: 'pantry' },
      ],
    },
    {
      id: 'pantry',
      kind: 'choice',
      phase: 'deepen',
      prompt: 'That feels like a good little pact. Shall we try it with one small snack?',
      options: [
        { id: 'open-pantry', label: 'Let’s make something', reply: 'Perfect. I packed the Pantry. You bring back whatever our first snack becomes.', nextNodeId: 'end' },
      ],
    },
    { id: 'end', kind: 'end', message: 'Basket packed. Spoon recovered. Mostly. Let’s go.' },
  ],
};

type FeastleBeat = {
  level: number;
  title: string;
  prompt: string;
  choices: readonly [string, string, string][];
  closing: string;
  memoryKey?: string;
  goal?: { typeId: string; title: string; quickGoalIds: readonly string[] };
};

const beats: readonly FeastleBeat[] = [
  { level: 5, title: 'One useful bite', prompt: 'Could one tiny food experiment make this week a little easier?', choices: [['prepare', 'Make one part easier', 'Good. One loose knot, not the whole tangled kitchen.'], ['notice', 'Notice what already works', 'Excellent. We inspect the victories already hiding in the cupboards.'], ['later', 'Not this week', 'Then the table stays clear. No guilt garnish.']], closing: 'Tiny and useful beats grand and impossible.', memoryKey: 'feastle:small-experiment', goal: { typeId: 'everyday-nourishment', title: 'Make one food moment easier this week', quickGoalIds: ['feastle:dependable-option', 'feastle:make-one-thing', 'feastle:reduce-one-decision'] } },
  { level: 6, title: 'Too many guests', prompt: 'I may have promised lunch to more villagers than there are chairs. What is the strategy?', choices: [['floor', 'Call the floor a picnic', 'A rug has been appointed head of hospitality.'], ['turns', 'Serve everyone in shifts', 'The spoons are drawing up a timetable.'], ['cancel', 'Admit the mistake', 'A terrifyingly sensible answer. I will practise saying it.']], closing: 'The third order space is open. Apparently that counts as another chair.', memoryKey: 'feastle:village-ledger:chairs' },
  { level: 7, title: 'A food memory', prompt: 'Which detail makes a food memory stay?', choices: [['person', 'Who was there', 'The food becomes a landmark for the people around it.'], ['place', 'Where it happened', 'A table, pavement, park, or kitchen can hold the whole scene.'], ['taste', 'One unmistakable taste', 'Sometimes memory keeps the smallest sensory detail.']], closing: 'Only keep the detail if it feels worth carrying.', memoryKey: 'feastle:food-memory-shape' },
  { level: 8, title: "Feastle's First Feast", prompt: 'The first feast is served. What made it feel like a feast rather than simply more food?', choices: [['care', 'The care behind it', 'The effort became part of what was served.'], ['company', 'The company', 'A table changes when people feel welcome at it.'], ['occasion', 'Marking the moment', 'Giving a moment a name can make it easier to remember.']], closing: 'I thought the feast would prove I could cook. It proved a table is something we make together.', memoryKey: 'feastle:first-feast' },
  { level: 9, title: 'How food fits', prompt: 'Which version of getting fed deserves more credit in your life?', choices: [['cook', 'Making something', 'Cooking can be creative, practical, or simply enough for tonight.'], ['easy', 'Choosing the easy option', 'Ease is a condition worth designing for, not a failure of effort.'], ['shared', 'Eating with someone', 'Company can be part of nourishment too.']], closing: 'I will not rank them. The useful answer changes with the day.', memoryKey: 'feastle:food-fit' },
  { level: 10, title: 'A place at the table', prompt: 'We know each other properly now. What should I protect when we talk about food?', choices: [['kind', 'Keep it kind', 'No moral scores, no perfect plates, and no pretending every day has the same capacity.'], ['practical', 'Keep it practical', 'We can look for one workable condition instead of a grand reinvention.'], ['curious', 'Keep it curious', 'We can notice patterns without turning them into laws.']], closing: 'That is the kind of companion I will try to be.', memoryKey: 'support-style:feastle' },
  { level: 11, title: 'The village taste poll', prompt: 'The village has split into three unreasonable camps. Choose a side.', choices: [['crunch', 'Crunch belongs in everything', 'A bold platform with several soup-related weaknesses.'], ['sauce', 'Sauce solves everything', 'The sauce party has already printed banners.'], ['plain', 'Leave good food alone', 'A quiet campaign with surprisingly fierce supporters.']], closing: 'The official result is disputed, which means the poll was a success.', memoryKey: 'feastle:village-ledger:taste-poll' },
  { level: 12, title: 'The Village Table', prompt: 'After serving everyone, what matters most when a meal includes other people?', choices: [['welcome', 'People feel welcome', 'Hospitality can be more about ease than performance.'], ['needs', 'Different needs have room', 'A shared table works better when nobody has to defend what works for them.'], ['talk', 'There is time to talk', 'The meal can give conversation somewhere to land.']], closing: 'A generous table makes room; it does not demand sameness.', memoryKey: 'feastle:shared-table' },
  { level: 13, title: 'Make the next meal lighter', prompt: 'Which tiny change would remove the most friction from one meal?', choices: [['decide', 'Decide earlier', 'One decision made at an easier time can help your future self.'], ['visible', 'Make an easy option visible', 'Access often matters more than motivation.'], ['share', 'Ask someone to share it', 'Help can be practical, social, or both.']], closing: 'Choose it only if it makes life lighter.', memoryKey: 'feastle:meal-friction', goal: { typeId: 'everyday-nourishment', title: 'Remove one point of friction from a meal', quickGoalIds: ['feastle:reduce-one-decision', 'feastle:easy-option-visible', 'feastle:share-food'] } },
  { level: 14, title: 'The missing recipe', prompt: 'The recipe is gone. We remember only the final instruction. What did it say?', choices: [['listen', 'Listen for the onions', 'They have notes, mostly about pan temperature.'], ['dance', 'Stir with conviction', 'Technique has been replaced by theatrical certainty.'], ['phone', 'Order something and recover', 'The wisest lost recipe may be a phone number.']], closing: 'We found the recipe under the empty jar. It only says: taste and adjust.', memoryKey: 'feastle:village-ledger:recipe' },
  { level: 15, title: 'What I have learned', prompt: 'Which thread should stay closest when I think about your food life?', choices: [['ease', 'What makes food easier', 'I will notice conditions and access before assuming effort is the answer.'], ['meaning', 'What meals mean', 'I will keep room for comfort, memory, culture, and company.'], ['curiosity', 'What keeps it interesting', 'I will remember that curiosity can be small and optional.']], closing: 'You can correct this memory whenever it stops fitting.', memoryKey: 'feastle:relationship-thread' },
  { level: 16, title: 'A Celebration Spread', prompt: 'This celebration did not need to be perfect. What made it worth marking?', choices: [['progress', 'Something changed', 'Progress becomes easier to recognise when it is allowed a moment.'], ['survived', 'We made it through', 'Endurance deserves a table too.'], ['together', 'We were together', 'Sometimes the gathering is the whole occasion.']], closing: 'I am learning that celebration is attention, not extravagance.', memoryKey: 'feastle:celebration-meaning' },
  { level: 17, title: 'A pattern, gently held', prompt: 'Which observation sounds fairest right now?', choices: [['capacity', 'My capacity changes', 'A flexible food life can respond to capacity instead of treating variation as inconsistency.'], ['ritual', 'Familiar options help', 'Dependability can create room for curiosity elsewhere.'], ['people', 'People change the meal', 'Company, care, and responsibility can all shape how food feels.']], closing: 'An observation is useful only while it helps you see clearly.', memoryKey: 'feastle:gentle-pattern' },
  { level: 18, title: 'Emergency banquet rules', prompt: 'A banquet begins in ten minutes. You may save one thing.', choices: [['bread', 'The bread', 'Reliable, shareable, and excellent at looking intentional in a basket.'], ['music', 'The music', 'Nobody notices the missing dessert if the chorus arrives at the right time.'], ['chairs', 'Enough chairs', 'Once again, practical furniture defeats culinary ambition.']], closing: 'You have been promoted to emergency banquet advisor.', memoryKey: 'feastle:village-ledger:banquet' },
  { level: 19, title: 'Choose the Grand Feast', prompt: 'What should the final feast stand for?', choices: [['comfort', 'Comfort we can return to', 'Then the feast should feel familiar enough to become a future refuge.'], ['curiosity', 'Curiosity still ahead', 'Then one place at the table stays open for something not yet tried.'], ['connection', 'The table we built together', 'Then every course should carry a piece of shared history.']], closing: 'The choice will shape the story, not the difficulty.', memoryKey: 'feastle:grand-feast-theme' },
  { level: 20, title: 'The Grand Feast', prompt: 'The table is full, the pantry is quiet, and Crumb has stolen a napkin. What do you want to carry forward?', choices: [['ease', 'Food can meet the life I have', 'That is a kinder and more durable measure than perfection.'], ['notice', 'Small meals still hold meaning', 'Attention can reveal value without demanding that every moment become profound.'], ['together', 'A table can be built again', 'Connection is something we can keep making in ordinary ways.']], closing: 'We finished a feast, not the friendship. I will keep your place at the table.', memoryKey: 'feastle:grand-feast' },
];

function definitionForBeat(beat: FeastleBeat): ConversationDefinition {
  const isSignature = [4, 8, 12, 16, 20].includes(beat.level);
  const optionNext = beat.memoryKey ? undefined : beat.goal ? 'goal' : 'end';
  const options: ConversationOption[] = beat.choices.map(([id, label, reply]) => ({
    id,
    label,
    reply,
    nextNodeId: optionNext ?? `remember-${id}`,
  }));
  return {
    id: `feastle:friendship:${beat.level}`,
    version: 1,
    familyId: 'feastle',
    title: beat.title,
    trigger: 'bond',
    triggerSourceIds: [isSignature ? `feastle-chapter-${beat.level}` : `friendship-level:${beat.level}`],
    minimumBondLevel: 1,
    minimumFriendshipLevel: beat.level,
    cooldownDays: 3650,
    contextualOnly: true,
    format: 'narrative',
    tags: ['friendship', isSignature ? 'chapter' : 'story'],
    entryNodeId: 'opening',
    nodes: [
      { id: 'opening', kind: 'choice', phase: 'explore', prompt: beat.prompt, options },
      ...(beat.memoryKey ? beat.choices.map(([id, , reply]) => ({
        id: `remember-${id}`,
        kind: 'memory_proposal' as const,
        prompt: 'Would you like Feastle to keep that with your shared history?',
        summary: reply,
        memoryKey: beat.memoryKey!,
        sensitivity: 'ordinary' as const,
        nextNodeId: beat.goal ? 'goal' : 'end',
      })) : []),
      ...(beat.goal ? [{
        id: 'goal',
        kind: 'goal_proposal' as const,
        prompt: 'Add one small option only if it would genuinely help.',
        goalTypeId: beat.goal.typeId,
        goalTitle: beat.goal.title,
        suggestedQuickGoalIds: beat.goal.quickGoalIds,
        nextNodeId: 'end',
      }] : []),
      { id: 'end', kind: 'end', message: beat.closing },
    ],
  };
}

const chapterOneDefinitions: readonly ConversationDefinition[] = [
  {
    id: 'feastle:friendship:2', version: 2, familyId: 'feastle',
    title: 'The first snack', trigger: 'bond', triggerSourceIds: ['friendship-level:2'],
    minimumBondLevel: 1, minimumFriendshipLevel: 2, cooldownDays: 3650,
    contextualOnly: true, format: 'narrative', tags: ['friendship', 'story'], entryNodeId: 'arrival',
    nodes: [
      { id: 'arrival', kind: 'choice', phase: 'explore', prompt: 'You made it! The first snack has officially survived the Pantry. What makes a bite like this feel good?', options: [
        { id: 'easy', label: 'It was easy to reach', reply: 'A snack that arrives before hunger gets dramatic. Excellent timing.', nextNodeId: 'today-table' },
        { id: 'comfort', label: 'It feels familiar', reply: 'Ah. The food version of a favourite blanket.', nextNodeId: 'today-table' },
        { id: 'company', label: 'It is better shared', reply: 'Then I shall prepare two plates—and, for reasons unknown, three forks.', nextNodeId: 'today-table' },
      ] },
      {
        id: 'today-table', kind: 'journal_handoff',
        prompt: 'I came from an Egg like that one. Once we arrive, we help care for the Eggs still forming. Could we give one a food moment from today?',
        title: 'Today’s table',
        body: 'Choose what found a place at your table. A meal, snack, drink, or something you made all count—and ordinary counts too.',
        flowId: 'food',
        allowedChoiceIds: ['meal', 'snack', 'dessert', 'coffee', 'tea', 'drink', 'cooking', 'other_food'],
        saveLabel: 'Add to the Egg', rewardGrowth: 20, rewardPantryCharges: 6,
        nextNodeId: 'busy-day',
      },
      { id: 'busy-day', kind: 'choice', phase: 'deepen', prompt: 'And when the day gets a bit wobbly, what helps food actually happen?', options: [
        { id: 'ready', label: 'Having something ready', reply: 'Ready beats heroic. Future-you deserves an easy win.', nextNodeId: 'remember-ready' },
        { id: 'simple', label: 'Only making one decision', reply: 'One decision. No menu maze. I like this plan already.', nextNodeId: 'remember-simple' },
        { id: 'pause', label: 'A little reminder to pause', reply: 'A gentle nudge, then. Never a dinner bell with opinions.', nextNodeId: 'remember-pause' },
      ] },
      { id: 'remember-ready', kind: 'memory_proposal', prompt: 'Shall I keep that tucked in our recipe book?', summary: 'Having something ready can make food easier on a wobbly day.', memoryKey: 'feastle:busy-day-help', sensitivity: 'ordinary', nextNodeId: 'end' },
      { id: 'remember-simple', kind: 'memory_proposal', prompt: 'Shall I keep that tucked in our recipe book?', summary: 'Fewer food decisions can make a busy day easier.', memoryKey: 'feastle:busy-day-help', sensitivity: 'ordinary', nextNodeId: 'end' },
      { id: 'remember-pause', kind: 'memory_proposal', prompt: 'Shall I keep that tucked in our recipe book?', summary: 'A gentle reminder to pause can help food happen on a busy day.', memoryKey: 'feastle:busy-day-help', sensitivity: 'ordinary', nextNodeId: 'end' },
      { id: 'end', kind: 'end', message: 'First snack served. First useful clue found. Not bad for one tiny plate.' },
    ],
  },
  {
    id: 'feastle:friendship:3', version: 2, familyId: 'feastle',
    title: 'The suspicious jar', trigger: 'bond', triggerSourceIds: ['friendship-level:3'],
    minimumBondLevel: 1, minimumFriendshipLevel: 3, cooldownDays: 3650,
    contextualOnly: true, format: 'narrative', tags: ['friendship', 'story'], entryNodeId: 'jar',
    nodes: [
      { id: 'jar', kind: 'choice', phase: 'explore', prompt: 'Small problem. A jar appeared in the Pantry with no label and far too much confidence. What is inside?', options: [
        { id: 'jam', label: 'Very dramatic jam', reply: 'I knew it. That jar is practically wearing a cape.', nextNodeId: 'plan' },
        { id: 'spice', label: 'A suspicious spice mix', reply: 'One sniff and the spoons have started gossiping.', nextNodeId: 'plan' },
        { id: 'empty', label: 'Absolutely nothing', reply: 'Of course. It has already promoted itself to Pantry Manager.', nextNodeId: 'plan' },
      ] },
      { id: 'plan', kind: 'poll', prompt: 'The jar rattles. Quickly—what is our official plan?', helperText: 'The village has opinions. None are especially sensible.', nextNodeId: 'end', options: [
        { id: 'taste', label: 'Taste it very carefully', reply: 'A brave plan. I will stand behind the largest spoon.', nextNodeId: 'end', villageWeight: 31 },
        { id: 'label', label: 'Give it a new label', reply: '“Probably Fine.” Clear, honest, and legally adventurous.', nextNodeId: 'end', villageWeight: 45 },
        { id: 'shelf', label: 'Put it on the highest shelf', reply: 'Excellent. A problem for taller Feastle.', nextNodeId: 'end', villageWeight: 24 },
      ] },
      { id: 'end', kind: 'end', message: 'Crisis contained. The village record will be extremely vague about this.' },
    ],
  },
  {
    id: 'feastle:friendship:4', version: 2, familyId: 'feastle',
    title: 'A place at the table', trigger: 'bond', triggerSourceIds: ['feastle-chapter-4'],
    minimumBondLevel: 1, minimumFriendshipLevel: 4, cooldownDays: 3650,
    contextualOnly: true, format: 'narrative', tags: ['friendship', 'chapter', 'story'], entryNodeId: 'dish',
    nodes: [
      { id: 'dish', kind: 'choice', phase: 'explore', prompt: 'Look at that dish! The table feels real now. On an ordinary day, what makes food feel manageable?', options: [
        { id: 'simple', label: 'Keeping it simple', reply: 'Simple is good food meeting the day exactly where it is.', nextNodeId: 'tomorrow' },
        { id: 'ready', label: 'Having something ready', reply: 'A little preparation can feel like a note from past-you: “I’ve got you.”', nextNodeId: 'tomorrow' },
        { id: 'shared', label: 'Sharing the work', reply: 'Yes. A lighter plate sometimes begins with lighter work.', nextNodeId: 'tomorrow' },
      ] },
      { id: 'tomorrow', kind: 'choice', phase: 'deepen', prompt: 'If tomorrow turns messy, what should I help you remember?', options: [
        { id: 'enough', label: 'Easy food still counts', reply: 'Absolutely. Fed is not a lesser ending.', nextNodeId: 'remember-enough' },
        { id: 'change', label: 'Plans are allowed to change', reply: 'We can redraw the menu without calling it a failure.', nextNodeId: 'remember-change' },
        { id: 'help', label: 'I do not have to do it alone', reply: 'There is always room at this table for help.', nextNodeId: 'remember-help' },
      ] },
      { id: 'remember-enough', kind: 'memory_proposal', prompt: 'May I keep that close for the messier days?', summary: 'Easy food still counts.', memoryKey: 'feastle:ordinary-day-reminder', sensitivity: 'ordinary', nextNodeId: 'goal-ease' },
      { id: 'remember-change', kind: 'memory_proposal', prompt: 'May I keep that close for the messier days?', summary: 'Food plans are allowed to change.', memoryKey: 'feastle:ordinary-day-reminder', sensitivity: 'ordinary', nextNodeId: 'goal-flexible' },
      { id: 'remember-help', kind: 'memory_proposal', prompt: 'May I keep that close for the messier days?', summary: 'Food does not always have to be managed alone.', memoryKey: 'feastle:ordinary-day-reminder', sensitivity: 'ordinary', nextNodeId: 'goal-shared' },
      { id: 'goal-ease', kind: 'goal_proposal', prompt: 'Add one small option only if it would genuinely help.', goalTypeId: 'everyday-nourishment', goalTitle: 'Make one food moment easier', summary: 'Keep an easy option close and remove one decision before the day gets busy.', suggestedQuickGoalIds: ['feastle:dependable-option', 'feastle:easy-option-visible', 'feastle:reduce-one-decision'], nextNodeId: 'end' },
      { id: 'goal-flexible', kind: 'goal_proposal', prompt: 'Add one small option only if it would genuinely help.', goalTypeId: 'everyday-nourishment', goalTitle: 'Keep tomorrow’s food plan flexible', summary: 'Choose a realistic option now, with full permission to change it later.', suggestedQuickGoalIds: ['feastle:reduce-one-decision', 'feastle:two-meal-list', 'feastle:plan-meal'], nextNodeId: 'end' },
      { id: 'goal-shared', kind: 'goal_proposal', prompt: 'Add one small option only if it would genuinely help.', goalTypeId: 'everyday-nourishment', goalTitle: 'Make room for help at the table', summary: 'Let one food moment include shared effort, company, or a simpler ask.', suggestedQuickGoalIds: ['feastle:share-food', 'feastle:make-one-thing', 'feastle:eat-without-rushing'], nextNodeId: 'end' },
      { id: 'end', kind: 'end', message: 'That is our first table set: useful, a little wonky, and ours.' },
    ],
  },
];

export const feastleFriendshipConversationDefinitions: readonly ConversationDefinition[] = [
  ...chapterOneDefinitions,
  ...beats.map(definitionForBeat),
];
