import type { ConversationDefinition } from '@/types/companion-conversation';

export const BARISTABBIT_FIRST_MEETING_DEFINITION_ID = 'baristabbit:story:first-meeting';

export const baristabbitStoryConversationDefinitions: readonly ConversationDefinition[] = [
  {
    id: BARISTABBIT_FIRST_MEETING_DEFINITION_ID,
    version: 1,
    familyId: 'baristabbit',
    title: 'The counter is open',
    trigger: 'evergreen',
    minimumBondLevel: 1,
    cooldownDays: 3650,
    contextualOnly: true,
    isOpener: true,
    format: 'opener',
    tags: ['story', 'first-meeting', 'ritual'],
    entryNodeId: 'counter',
    nodes: [
      {
        id: 'counter', kind: 'choice', phase: 'explore',
        prompt: 'Welcome. The menu is imaginary, but the pause can be real. What would you most like a drink moment to give you lately?',
        options: [
          { id: 'energy', label: 'A clear beginning', reply: 'A threshold, then—not a demand to be productive.', nextNodeId: 'style' },
          { id: 'comfort', label: 'Comfort', reply: 'Something familiar can give the day a softer edge.', nextNodeId: 'style' },
          { id: 'refresh', label: 'A reset', reply: 'Warm, cold, caffeinated, or not—the useful part can simply be the pause.', nextNodeId: 'style' },
          { id: 'company', label: 'Easy company', reply: 'A cup gives conversation somewhere to put its hands.', nextNodeId: 'style' },
          { id: 'pause', label: 'Ten quiet minutes', reply: 'No improvement project. Just ten minutes that belong to you.', nextNodeId: 'style' },
        ],
      },
      {
        id: 'style', kind: 'choice', phase: 'deepen',
        prompt: 'One house rule before the order bell opens: how should I talk about your rituals?',
        options: [
          { id: 'gentle', label: 'Keep it gentle', reply: 'No streak anxiety and no judging what is in the cup.', nextNodeId: 'bell' },
          { id: 'curious', label: 'Help me notice patterns', reply: 'We can notice what helps without turning it into a rule.', nextNodeId: 'bell' },
          { id: 'practical', label: 'Give me one small experiment', reply: 'One contained experiment, with permission to abandon it.', nextNodeId: 'bell' },
          { id: 'space', label: 'Wait until I ask', reply: 'Of course. I can polish the imaginary cups quietly.', nextNodeId: 'bell' },
        ],
      },
      {
        id: 'bell', kind: 'choice', phase: 'resolve',
        prompt: 'Good. Five village requests have appeared. Shall we open the Ritual Bar?',
        options: [{ id: 'open', label: 'Open the counter', reply: 'I will keep three requests visible at a time. We serve them at our pace.', nextNodeId: 'end' }],
      },
      { id: 'end', kind: 'end', message: 'Counter open. Kettle listening. Absolutely nobody is timing the pause.' },
    ],
  },
  {
    id: 'baristabbit:story:6', version: 1, familyId: 'baristabbit', title: 'Two cups in',
    trigger: 'bond', triggerSourceIds: ['friendship-level:6'], minimumBondLevel: 1, minimumFriendshipLevel: 1,
    cooldownDays: 3650, contextualOnly: true, format: 'narrative', tags: ['story', 'journal', 'ritual'], entryNodeId: 'notice',
    nodes: [
      {
        id: 'notice', kind: 'choice', phase: 'explore',
        prompt: 'Two cups served. Thinking about your own day, what did a drink moment give you—if anything?',
        options: [
          { id: 'beginning', label: 'A clear beginning', reply: 'The ritual marked a threshold. That can be enough.', nextNodeId: 'remember-beginning' },
          { id: 'comfort', label: 'Comfort', reply: 'A familiar cup can be a small place to land.', nextNodeId: 'remember-comfort' },
          { id: 'reset', label: 'A reset', reply: 'Even a brief change of pace can separate one part of the day from another.', nextNodeId: 'remember-reset' },
          { id: 'company', label: 'Company', reply: 'Then the cup helped make room for someone else.', nextNodeId: 'remember-company' },
          { id: 'journal', label: 'Put the moment in Today', reply: 'Only the detail you want to keep. The Egg does not need a perfect entry.', nextNodeId: 'journal' },
        ],
      },
      { id: 'remember-beginning', kind: 'memory_proposal', prompt: 'Keep that as a clue about your rituals?', summary: 'A drink ritual can help mark a clear beginning.', memoryKey: 'baristabbit:ritual-purpose:beginning', memoryKind: 'preference', sensitivity: 'ordinary', nextNodeId: 'end' },
      { id: 'remember-comfort', kind: 'memory_proposal', prompt: 'Keep that as a clue about your rituals?', summary: 'A familiar drink can create comfort and a place to land.', memoryKey: 'baristabbit:ritual-purpose:comfort', memoryKind: 'preference', sensitivity: 'ordinary', nextNodeId: 'end' },
      { id: 'remember-reset', kind: 'memory_proposal', prompt: 'Keep that as a clue about your rituals?', summary: 'A drink pause can help reset or separate parts of the day.', memoryKey: 'baristabbit:ritual-purpose:reset', memoryKind: 'preference', sensitivity: 'ordinary', nextNodeId: 'end' },
      { id: 'remember-company', kind: 'memory_proposal', prompt: 'Keep that as a clue about your rituals?', summary: 'Shared drinks can make connection feel easier.', memoryKey: 'baristabbit:ritual-purpose:company', memoryKind: 'preference', sensitivity: 'ordinary', nextNodeId: 'end' },
      {
        id: 'journal', kind: 'journal_handoff', prompt: 'Save one drink pause from today.', title: "Today’s pause",
        body: 'Choose coffee, tea, or another drink, then keep only the detail that mattered. What was in the cup matters less than what the moment gave you.',
        flowId: 'food', allowedChoiceIds: ['coffee', 'tea', 'drink'], saveLabel: 'Add to the Egg',
        rewardGrowth: 20, nextNodeId: 'end',
      },
      { id: 'end', kind: 'end', message: 'Three requests remain. They are waiting politely and pretending not to read the menu upside down.' },
    ],
  },
  {
    id: 'baristabbit:story:7', version: 1, familyId: 'baristabbit', title: 'What makes a pause work?',
    trigger: 'bond', triggerSourceIds: ['friendship-level:7'], minimumBondLevel: 1, minimumFriendshipLevel: 1,
    cooldownDays: 3650, contextualOnly: true, format: 'insight_game', tags: ['story', 'insight', 'ritual'], entryNodeId: 'game',
    nodes: [
      {
        id: 'game', kind: 'insight_game', title: 'Your pause pattern', revealNodeId: 'reveal', questions: [
          { id: 'busy', prompt: 'On a busy day, which drink moment sounds most helpful?', options: [
            { id: 'anchor-busy', label: 'The same familiar ritual', reply: 'A known sequence can hold its shape when the day does not.', nextNodeId: null },
            { id: 'comfort-busy', label: 'The most comforting option', reply: 'Softness can be a real purpose.', nextNodeId: null },
            { id: 'reset-busy', label: 'Something cold or refreshing', reply: 'A sensory change can create a clean edge.', nextNodeId: null },
            { id: 'social-busy', label: 'A cup with someone', reply: 'Company can stop the pause becoming another task.', nextNodeId: null },
          ] },
          { id: 'setting', prompt: 'Where does a real pause happen most easily?', options: [
            { id: 'anchor-setting', label: 'In a familiar spot', reply: 'The place becomes part of the cue.', nextNodeId: null },
            { id: 'comfort-setting', label: 'Somewhere soft and quiet', reply: 'The environment helps your system settle.', nextNodeId: null },
            { id: 'reset-setting', label: 'By a window or outside', reply: 'A shift in light and air can help the reset land.', nextNodeId: null },
            { id: 'social-setting', label: 'At a shared table', reply: 'The ritual gets its shape from company.', nextNodeId: null },
          ] },
          { id: 'detail', prompt: 'Which detail brings you into the moment?', options: [
            { id: 'anchor-detail', label: 'Making it in a familiar order', reply: 'Sequence can be a gentle anchor.', nextNodeId: null },
            { id: 'comfort-detail', label: 'Warmth, aroma, or a favourite cup', reply: 'Comfort often arrives through the senses.', nextNodeId: null },
            { id: 'reset-detail', label: 'A bright flavour or temperature', reply: 'Contrast helps the moment feel distinct.', nextNodeId: null },
            { id: 'social-detail', label: 'The conversation around it', reply: 'The people become part of the ritual.', nextNodeId: null },
          ] },
          { id: 'purpose', prompt: 'How do you know the pause helped?', options: [
            { id: 'anchor-purpose', label: 'I know what comes next', reply: 'The ritual gave the day a little structure.', nextNodeId: null },
            { id: 'comfort-purpose', label: 'I feel more settled', reply: 'A softer landing is a complete outcome.', nextNodeId: null },
            { id: 'reset-purpose', label: 'My attention feels refreshed', reply: 'The pause changed the texture of attention.', nextNodeId: null },
            { id: 'social-purpose', label: 'I feel more connected', reply: 'The cup helped create contact.', nextNodeId: null },
          ] },
          { id: 'tomorrow', prompt: 'What would make tomorrow’s pause easier to protect?', options: [
            { id: 'anchor-tomorrow', label: 'Attach it to an existing cue', reply: 'The day already contains useful doorways.', nextNodeId: null },
            { id: 'comfort-tomorrow', label: 'Keep a favourite option close', reply: 'Access can protect comfort better than effort.', nextNodeId: null },
            { id: 'reset-tomorrow', label: 'Choose one screen-free sip', reply: 'One noticed sip is enough to test the idea.', nextNodeId: null },
            { id: 'social-tomorrow', label: 'Invite someone into it', reply: 'A shared pause can make its own boundary.', nextNodeId: null },
          ] },
        ],
      },
      { id: 'reveal', kind: 'insight_reveal', title: 'What Baristabbit noticed', insightKey: 'pause-pattern', category: 'Rituals & drinks', nextNodeId: 'end', results: [
        { id: 'anchor', title: 'The Ritual Anchor', reflection: 'A familiar sequence helps one part of the day become another.', summary: 'Your best drink pauses often work as gentle anchors: familiar cues, places, and sequences that give the day shape.', emblemId: 'baristabbit-pause-anchor', matchOptionIds: ['anchor-busy', 'anchor-setting', 'anchor-detail', 'anchor-purpose', 'anchor-tomorrow'] },
        { id: 'comfort', title: 'The Comfort Landing', reflection: 'Warmth, familiarity, and softness help the pause feel restorative.', summary: 'Comfort is not incidental to your ritual; it is often the reason the moment works.', emblemId: 'baristabbit-pause-comfort', matchOptionIds: ['comfort-busy', 'comfort-setting', 'comfort-detail', 'comfort-purpose', 'comfort-tomorrow'] },
        { id: 'reset', title: 'The Bright Reset', reflection: 'Contrast and sensory attention help refresh your focus.', summary: 'Your most useful pauses often create a distinct reset through flavour, temperature, light, or one consciously noticed sip.', emblemId: 'baristabbit-pause-reset', matchOptionIds: ['reset-busy', 'reset-setting', 'reset-detail', 'reset-purpose', 'reset-tomorrow'] },
        { id: 'social', title: 'The Shared Cup', reflection: 'A drink moment becomes restorative when it creates easy connection.', summary: 'Company and conversation are important ingredients in how a pause supports you.', emblemId: 'baristabbit-pause-social', matchOptionIds: ['social-busy', 'social-setting', 'social-detail', 'social-purpose', 'social-tomorrow'] },
      ] },
      { id: 'end', kind: 'end', message: 'I have one last order now: a table where every kind of pause has a place.' },
    ],
  },
  {
    id: 'baristabbit:story:8', version: 1, familyId: 'baristabbit', title: 'The Pause Table',
    trigger: 'bond', triggerSourceIds: ['baristabbit-chapter-1'], minimumBondLevel: 1, minimumFriendshipLevel: 1,
    cooldownDays: 3650, contextualOnly: true, format: 'narrative', tags: ['story', 'chapter', 'memory'], entryNodeId: 'table',
    nodes: [
      { id: 'table', kind: 'choice', phase: 'resolve', prompt: 'The Pause Table is served. What made it feel restorative rather than simply another order?', options: [
        { id: 'attention', label: 'We gave it attention', reply: 'The pause became real because we were actually in it.', nextNodeId: 'remember-attention' },
        { id: 'choice', label: 'Every cup had a choice', reply: 'Warm, cold, familiar, playful—no single ritual had to be correct.', nextNodeId: 'remember-choice' },
        { id: 'company', label: 'There was room for company', reply: 'The table made connection possible without demanding it.', nextNodeId: 'remember-company' },
        { id: 'permission', label: 'It did not need to achieve anything', reply: 'Yes. Restorative does not have to mean productive afterwards.', nextNodeId: 'remember-permission' },
      ] },
      { id: 'remember-attention', kind: 'memory_proposal', prompt: 'Keep this first table in our shared history?', summary: 'Our first Pause Table mattered because we gave the moment our attention.', memoryKey: 'baristabbit:pause-table:attention', memoryKind: 'milestone', sensitivity: 'ordinary', nextNodeId: 'goal' },
      { id: 'remember-choice', kind: 'memory_proposal', prompt: 'Keep this first table in our shared history?', summary: 'Our first Pause Table made room for different kinds of rituals without ranking them.', memoryKey: 'baristabbit:pause-table:choice', memoryKind: 'milestone', sensitivity: 'ordinary', nextNodeId: 'goal' },
      { id: 'remember-company', kind: 'memory_proposal', prompt: 'Keep this first table in our shared history?', summary: 'Our first Pause Table made easy company part of the ritual.', memoryKey: 'baristabbit:pause-table:company', memoryKind: 'milestone', sensitivity: 'ordinary', nextNodeId: 'goal' },
      { id: 'remember-permission', kind: 'memory_proposal', prompt: 'Keep this first table in our shared history?', summary: 'Our first Pause Table protected a pause that did not need to achieve anything.', memoryKey: 'baristabbit:pause-table:permission', memoryKind: 'milestone', sensitivity: 'ordinary', nextNodeId: 'goal' },
      { id: 'goal', kind: 'goal_proposal', prompt: 'Would one tiny real-life version be useful?', goalTypeId: 'ritual', goalTitle: 'Protect one restorative drink pause', summary: 'Choose one drink moment to notice without asking it to improve the rest of the day.', suggestedQuickGoalIds: ['coffee-ritual:make-pause', 'coffee-ritual:first-sip', 'coffee-ritual:choose-intention'], nextNodeId: 'end' },
      { id: 'end', kind: 'end', message: 'Counter closed for now. The Pause Table stays open in our shared history.' },
    ],
  },
];
