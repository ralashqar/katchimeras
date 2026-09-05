import type { ConversationDefinition } from '@/types/companion-conversation';

type JourneyStoryConfig = {
  familyId: 'steppling' | 'voyagle' | 'flexel' | 'bedrotte';
  companionName: string;
  firstMeetingTitle: string;
  chapterTitle: string;
  chapterQuestion: string;
  openingOptions: Array<{ id: string; label: string; reply: string }>;
  midpointPrompt: string;
  midpointOptions: Array<{ id: string; label: string; reply: string; memory: string }>;
  journalTitle: string;
  journalBody: string;
  journalFlowId: 'movement' | 'went_somewhere' | 'general';
  journalChoiceIds: string[];
  insightTitle: string;
  insightCategory: string;
  insightAxes: Array<{ id: string; title: string; reflection: string; summary: string }>;
  questions: Array<{ id: string; prompt: string; labels: string[] }>;
  finaleOptions: Array<{ id: string; label: string; reply: string; memory: string }>;
  goalTypeId: string;
  goalTitle: string;
  goalSummary: string;
  quickGoalIds: string[];
};

function makeJourneyStory(config: JourneyStoryConfig): ConversationDefinition[] {
  const id = config.familyId;
  const firstMeetingId = `${id}:story:first-meeting`;
  return [
    {
      id: firstMeetingId, version: 1, familyId: id, title: config.firstMeetingTitle,
      trigger: 'evergreen', minimumBondLevel: 1, cooldownDays: 3650, contextualOnly: true,
      isOpener: true, format: 'opener', tags: ['story', 'first-meeting', 'journey'], entryNodeId: 'hello',
      nodes: [
        { id: 'hello', kind: 'choice', phase: 'explore', prompt: config.chapterQuestion, options: config.openingOptions.map((option) => ({ ...option, nextNodeId: 'pace' })) },
        { id: 'pace', kind: 'choice', phase: 'deepen', prompt: 'How should we approach this chapter together?', options: [
          { id: 'gentle', label: 'Keep it gentle', reply: 'We will treat capacity and access as part of the route.', nextNodeId: 'open' },
          { id: 'curious', label: 'Help me notice patterns', reply: 'We can collect clues without turning them into rules.', nextNodeId: 'open' },
          { id: 'practical', label: 'Offer small experiments', reply: 'Small enough to change, skip, or bring closer to home.', nextNodeId: 'open' },
          { id: 'spacious', label: 'Leave room for surprise', reply: 'Then the map will keep some honest blank spaces.', nextNodeId: 'open' },
        ] },
        { id: 'open', kind: 'choice', phase: 'resolve', prompt: 'Five village requests are waiting in the Journey Locker. Ready to begin?', options: [
          { id: 'yes', label: 'Open the Journey Locker', reply: 'Trail pieces and travel pieces share the same locker. We will need both.', nextNodeId: 'end' },
        ] },
        { id: 'end', kind: 'end', message: 'The first requests are ready. The route can begin close to home.' },
      ],
    },
    {
      id: `${id}:story:6`, version: 1, familyId: id, title: 'Two routes in', trigger: 'bond',
      triggerSourceIds: ['friendship-level:6'], minimumBondLevel: 1, minimumFriendshipLevel: 1,
      cooldownDays: 3650, contextualOnly: true, format: 'narrative', tags: ['story', 'journal', 'journey'], entryNodeId: 'notice',
      nodes: [
        { id: 'notice', kind: 'choice', phase: 'explore', prompt: config.midpointPrompt, options: [
          ...config.midpointOptions.map((option) => ({ id: option.id, label: option.label, reply: option.reply, nextNodeId: `remember-${option.id}` })),
          { id: 'journal', label: 'Put one moment in Today', reply: 'Keep only the detail that feels useful. The Egg does not need a travelogue.', nextNodeId: 'journal' },
        ] },
        ...config.midpointOptions.map((option) => ({
          id: `remember-${option.id}`, kind: 'memory_proposal' as const, prompt: 'Keep that as a clue for future journeys?',
          summary: option.memory, memoryKey: `${id}:journey-clue:${option.id}`, memoryKind: 'preference' as const,
          sensitivity: 'ordinary' as const, nextNodeId: 'end',
        })),
        { id: 'journal', kind: 'journal_handoff', prompt: 'Save one journey detail from today.', title: config.journalTitle,
          body: config.journalBody, flowId: config.journalFlowId, allowedChoiceIds: config.journalChoiceIds,
          saveLabel: 'Add to the Egg', rewardGrowth: 20, nextNodeId: 'end' },
        { id: 'end', kind: 'end', message: 'Three requests remain. We know a little more about what makes a route yours.' },
      ],
    },
    {
      id: `${id}:story:7`, version: 1, familyId: id, title: config.insightTitle, trigger: 'bond',
      triggerSourceIds: ['friendship-level:7'], minimumBondLevel: 1, minimumFriendshipLevel: 1,
      cooldownDays: 3650, contextualOnly: true, format: 'insight_game', tags: ['story', 'insight', 'journey'], entryNodeId: 'game',
      nodes: [
        { id: 'game', kind: 'insight_game', title: config.insightTitle, revealNodeId: 'reveal', questions: config.questions.map((question) => ({
          id: question.id, prompt: question.prompt, options: config.insightAxes.map((axis, index) => ({
            id: `${axis.id}-${question.id}`, label: question.labels[index], reply: axis.reflection, nextNodeId: null,
          })),
        })) },
        { id: 'reveal', kind: 'insight_reveal', title: `${config.companionName} noticed a pattern`, insightKey: `${id}-journey-pattern`, category: config.insightCategory, nextNodeId: 'end',
          results: config.insightAxes.map((axis) => ({ id: axis.id, title: axis.title, reflection: axis.reflection, summary: axis.summary,
            emblemId: `${id}-journey-${axis.id}`, matchOptionIds: config.questions.map((question) => `${axis.id}-${question.id}`) })) },
        { id: 'end', kind: 'end', message: `One last order remains: ${config.chapterTitle}.` },
      ],
    },
    {
      id: `${id}:story:8`, version: 1, familyId: id, title: config.chapterTitle, trigger: 'bond',
      triggerSourceIds: [`${id}-chapter-1`], minimumBondLevel: 1, minimumFriendshipLevel: 1,
      cooldownDays: 3650, contextualOnly: true, format: 'narrative', tags: ['story', 'chapter', 'memory'], entryNodeId: 'finale',
      nodes: [
        { id: 'finale', kind: 'choice', phase: 'resolve', prompt: `We finished ${config.chapterTitle}. What made this journey feel like yours?`, options: config.finaleOptions.map((option) => ({ ...option, nextNodeId: `remember-${option.id}` })) },
        ...config.finaleOptions.map((option) => ({ id: `remember-${option.id}`, kind: 'memory_proposal' as const,
          prompt: 'Keep this first chapter in our shared history?', summary: option.memory,
          memoryKey: `${id}:chapter-one:${option.id}`, memoryKind: 'milestone' as const, sensitivity: 'ordinary' as const, nextNodeId: 'goal' })),
        { id: 'goal', kind: 'goal_proposal', prompt: 'Would one small real-life version be useful?', goalTypeId: config.goalTypeId,
          goalTitle: config.goalTitle, summary: config.goalSummary, suggestedQuickGoalIds: config.quickGoalIds, nextNodeId: 'end' },
        { id: 'end', kind: 'end', message: `${config.chapterTitle} now lives in our shared history. The next route can wait.` },
      ],
    },
  ];
}

const stepplingConfig: JourneyStoryConfig = {
  familyId: 'steppling', companionName: 'Steppling', firstMeetingTitle: 'The path outside', chapterTitle: 'The Path Outside',
  chapterQuestion: 'A path can be exercise, transport, headspace, company, or discovery. What would you most like walking to offer lately?',
  openingOptions: [
    { id: 'headspace', label: 'Headspace', reply: 'Then the route can hold thoughts without asking you to solve them.' },
    { id: 'energy', label: 'A little more energy', reply: 'We will look for a pace that gives more than it takes.' },
    { id: 'connection', label: 'Easy company', reply: 'Walking side by side can soften the pressure of conversation.' },
    { id: 'discovery', label: 'Nearby discovery', reply: 'A familiar place can still contain one turning you have not noticed.' },
    { id: 'useful', label: 'Simply getting somewhere', reply: 'Useful movement counts. A path does not need scenery to be real.' },
  ],
  midpointPrompt: 'Two routes served. What most affects whether stepping outside feels possible on a real day?',
  midpointOptions: [
    { id: 'cue', label: 'Having an easy cue', reply: 'Shoes, timing, or an existing errand can lower the threshold.', memory: 'An easy cue can make starting a walk more likely.' },
    { id: 'pace', label: 'Choosing my own pace', reply: 'The useful pace is the one your day and body can actually hold.', memory: 'Walking feels more supportive at a self-chosen, sustainable pace.' },
    { id: 'purpose', label: 'Having somewhere to go', reply: 'A destination can carry the beginning for you.', memory: 'Purposeful journeys can make movement easier to begin.' },
    { id: 'weather', label: 'Conditions and access', reply: 'Weather, safety, mobility, time, and energy belong in the route.', memory: 'Conditions and access meaningfully shape which walks fit.' },
  ],
  journalTitle: "Today's path", journalBody: 'Keep one movement moment: where you went, what helped you begin, or what the route gave you.',
  journalFlowId: 'movement', journalChoiceIds: ['walk'], insightTitle: 'What kind of path fits?', insightCategory: 'Movement & routes',
  insightAxes: [
    { id: 'familiar', title: 'The Familiar Pathfinder', reflection: 'A known route makes starting lighter.', summary: 'Familiar cues and routes help movement feel dependable and low-friction.' },
    { id: 'purposeful', title: 'The Purposeful Traveller', reflection: 'A destination gives movement a useful shape.', summary: 'Walking fits best when it carries you toward an everyday purpose.' },
    { id: 'curious', title: 'The Curious Detour', reflection: 'A little novelty brings the route alive.', summary: 'Choice, discovery, and small detours help movement stay interesting.' },
    { id: 'social', title: 'The Social Strider', reflection: 'Company makes the path easier to inhabit.', summary: 'Connection and shared pace are important ingredients in supportive movement.' },
  ],
  questions: [
    { id: 'start', prompt: 'What most helps you begin?', labels: ['A familiar cue', 'A useful destination', 'A route I have not tried', 'Someone joining me'] },
    { id: 'busy', prompt: 'On a busy day, which route survives?', labels: ['My usual short loop', 'An errand on foot', 'One new turning', 'A walking call'] },
    { id: 'reward', prompt: 'What makes the walk feel worthwhile?', labels: ['Settling into rhythm', 'Arriving somewhere', 'Noticing something new', 'Sharing the time'] },
    { id: 'barrier', prompt: 'What softens resistance?', labels: ['Everything ready', 'A concrete reason', 'Permission to explore', 'A shared plan'] },
    { id: 'tomorrow', prompt: 'What would you protect tomorrow?', labels: ['A repeatable path', 'One useful journey', 'A small detour', 'An invitation'] },
  ],
  finaleOptions: [
    { id: 'pace', label: 'It respected my pace', reply: 'Then the path supported you instead of testing you.', memory: 'Our first Path Outside respected a sustainable pace.' },
    { id: 'purpose', label: 'It went somewhere useful', reply: 'Ordinary destinations can make meaningful movement.', memory: 'Our first Path Outside connected movement with everyday purpose.' },
    { id: 'discovery', label: 'It left room to notice', reply: 'Attention can make a nearby route feel larger.', memory: 'Our first Path Outside left room for nearby discovery.' },
    { id: 'company', label: 'It made room for company', reply: 'A shared stride does not need constant conversation.', memory: 'Our first Path Outside made easy company possible.' },
  ],
  goalTypeId: 'walking-rhythm', goalTitle: 'Make room for one supportive walk',
  goalSummary: 'Choose one short walk, useful journey, or route for headspace that fits your actual capacity.',
  quickGoalIds: ['steppling:ten-minute-walk', 'steppling:walk-one-journey', 'steppling:notice-route'],
};

const voyagleConfig: JourneyStoryConfig = {
  familyId: 'voyagle', companionName: 'Voyagle', firstMeetingTitle: 'Blank spaces on the map', chapterTitle: 'The Map with Blank Spaces',
  chapterQuestion: 'Travel does not have to mean far away. What would you most like a journey to give you?',
  openingOptions: [
    { id: 'discovery', label: 'Discovery', reply: 'Then we will look for difference, not distance.' },
    { id: 'rest', label: 'A change of pace', reply: 'A journey can create room without filling every hour.' },
    { id: 'connection', label: 'Connection', reply: 'People can be part of the destination.' },
    { id: 'interest', label: 'A particular place', reply: 'A clear interest can make planning kinder and simpler.' },
    { id: 'memory', label: 'A story to keep', reply: 'Then we will notice one detail rather than collect everything.' },
  ],
  midpointPrompt: 'Two journeys served. When somewhere is unfamiliar, what helps you stay open without feeling unmoored?',
  midpointOptions: [
    { id: 'purpose', label: 'A clear purpose', reply: 'Knowing why you came can orient the rest.', memory: 'A clear purpose helps unfamiliar travel feel grounded.' },
    { id: 'plan', label: 'A light plan', reply: 'Enough structure to feel held, with room left over.', memory: 'A light, flexible plan supports exploration.' },
    { id: 'company', label: 'The right company', reply: 'Shared travel can distribute decisions and create meaning.', memory: 'Supportive company can make travel easier and richer.' },
    { id: 'flexibility', label: 'Permission to change plans', reply: 'A changed route is still a real journey.', memory: 'Flexibility and backup options make travel more supportive.' },
  ],
  journalTitle: 'One place-specific detail', journalBody: 'Keep one detail from a past, current, local, or hoped-for trip—and why it stayed with you.',
  journalFlowId: 'went_somewhere', journalChoiceIds: ['travel', 'city', 'other_place'], insightTitle: 'How do you meet a new place?', insightCategory: 'Travel & place',
  insightAxes: [
    { id: 'story', title: 'The Story Collector', reflection: 'One vivid detail can hold an entire journey.', summary: 'You travel through memorable details and the stories they carry home.' },
    { id: 'map', title: 'The Careful Cartographer', reflection: 'Good preparation creates room to be present.', summary: 'Reliable plans, access information, and orientation help you explore confidently.' },
    { id: 'open', title: 'The Open-Wandering Guest', reflection: 'Unplanned discoveries are part of the destination.', summary: 'Flexibility and curiosity help unfamiliar places reveal themselves.' },
    { id: 'shared', title: 'The Shared-Journey Keeper', reflection: 'The people beside you shape what a place means.', summary: 'Connection and shared experience are central to the journeys you value.' },
  ],
  questions: [
    { id: 'arrive', prompt: 'What do you notice first on arrival?', labels: ['One vivid detail', 'How the place fits together', 'What is unexpected', 'Who is beside me'] },
    { id: 'plan', prompt: 'What makes planning reassuring?', labels: ['Knowing what I want to remember', 'Reliable practical information', 'Leaving an open afternoon', 'Agreeing needs together'] },
    { id: 'change', prompt: 'When plans change, what helps?', labels: ['Finding the story in it', 'Using a backup route', 'Following the new possibility', 'Deciding together'] },
    { id: 'meaning', prompt: 'What gives a place meaning?', labels: ['A sensory memory', 'Understanding its context', 'An unexpected discovery', 'A shared moment'] },
    { id: 'return', prompt: 'What comes home with you?', labels: ['One story', 'A clearer mental map', 'A wish to keep exploring', 'A stronger connection'] },
  ],
  finaleOptions: [
    { id: 'detail', label: 'One detail stayed vivid', reply: 'A single detail can be a doorway back.', memory: 'Our first Map with Blank Spaces was held by one vivid place-specific detail.' },
    { id: 'prepared', label: 'We prepared what mattered', reply: 'Preparation created freedom rather than controlling the journey.', memory: 'Our first Map with Blank Spaces balanced reliable preparation with presence.' },
    { id: 'open', label: 'We left part unwritten', reply: 'The blank space gave discovery somewhere to happen.', memory: 'Our first Map with Blank Spaces deliberately left room for discovery.' },
    { id: 'shared', label: 'We shaped it together', reply: 'Then company became part of the place.', memory: 'Our first Map with Blank Spaces became meaningful through shared experience.' },
  ],
  goalTypeId: 'practice', goalTitle: 'Give one journey a clear purpose',
  goalSummary: 'Name what you want from one local or future trip, then check one real constraint or meaningful detail.',
  quickGoalIds: ['voyagle-travel-stories:name-purpose', 'voyagle-travel-stories:one-local-detail', 'voyagle-travel-stories:one-memory'],
};

const flexelConfig: JourneyStoryConfig = {
  familyId: 'flexel', companionName: 'Flexel', firstMeetingTitle: 'A rhythm that can bend', chapterTitle: 'The Rhythm That Holds',
  chapterQuestion: 'Movement can build capability, shift energy, create play, or offer company. What would make it worth returning to for you?',
  openingOptions: [
    { id: 'capability', label: 'Useful capability', reply: 'Then progress will mean having more choices, not proving more worth.' },
    { id: 'energy', label: 'A shift in energy', reply: 'We will notice what gives energy as carefully as what spends it.' },
    { id: 'play', label: 'Play and enjoyment', reply: 'Enjoyment is a complete reason to move.' },
    { id: 'confidence', label: 'Confidence in my practice', reply: 'A practice can belong to you without comparison.' },
    { id: 'support', label: 'A supported way to begin', reply: 'Preparation, adaptation, and company can all lower the threshold.' },
  ],
  midpointPrompt: 'Two sessions served. What most helps movement remain possible on an imperfect day?',
  midpointOptions: [
    { id: 'adaptation', label: 'Permission to adapt', reply: 'Changing the session is a skill, not a failed version of it.', memory: 'Permission to adapt helps movement remain sustainable.' },
    { id: 'recovery', label: 'Recovery planned in', reply: 'Recovery belongs inside the practice rather than after it goes wrong.', memory: 'Planning recovery helps movement feel returnable.' },
    { id: 'enjoyment', label: 'Something I enjoy', reply: 'Enjoyment can carry consistency more gently than discipline alone.', memory: 'Enjoyment is an important part of sustainable movement.' },
    { id: 'support', label: 'Clear support or guidance', reply: 'The right information or company can make experimentation feel safer.', memory: 'Support and clear guidance can make movement easier to explore.' },
  ],
  journalTitle: "Today's movement-and-recovery clue", journalBody: 'Keep one thing movement gave you, one adaptation you made, or one recovery need you noticed—without scoring the session.',
  journalFlowId: 'movement', journalChoiceIds: ['workout'], insightTitle: 'What keeps movement returnable?', insightCategory: 'Movement & recovery',
  insightAxes: [
    { id: 'builder', title: 'The Consistent Builder', reflection: 'A repeatable structure makes capability easier to grow.', summary: 'You thrive with manageable structure and progress you can revisit without urgency.' },
    { id: 'playful', title: 'The Playful Mover', reflection: 'Enjoyment and variety make movement feel alive.', summary: 'Play, curiosity, and enjoyable movement are central to what keeps you returning.' },
    { id: 'adaptive', title: 'The Adaptive Listener', reflection: 'Changing course helps the practice fit the real body and day.', summary: 'Body signals, adaptation, and recovery guide your most sustainable rhythm.' },
    { id: 'shared', title: 'The Shared-Momentum Teammate', reflection: 'Supportive company helps effort feel possible and meaningful.', summary: 'Encouragement, shared pace, and belonging strengthen your relationship with movement.' },
  ],
  questions: [
    { id: 'begin', prompt: 'What most helps a session begin?', labels: ['A familiar plan', 'Something fun to try', 'A body check and options', 'Someone expecting me kindly'] },
    { id: 'progress', prompt: 'What feels like useful progress?', labels: ['Returning consistently', 'Finding more enjoyment', 'Adapting well', 'Building together'] },
    { id: 'hard-day', prompt: 'On a difficult day, what protects the practice?', labels: ['A smaller version', 'A playful alternative', 'Recovery or stopping', 'Support without pressure'] },
    { id: 'attention', prompt: 'What do you naturally notice?', labels: ['Reps, rhythm, or skill', 'Interest and energy', 'Signals and recovery', 'Team atmosphere'] },
    { id: 'tomorrow', prompt: 'What would you carry forward?', labels: ['One repeatable step', 'One enjoyable option', 'One useful adaptation', 'One shared invitation'] },
  ],
  finaleOptions: [
    { id: 'repeatable', label: 'It felt repeatable', reply: 'The rhythm held because it left room for another day.', memory: 'Our first Rhythm That Holds prioritised repeatability over intensity.' },
    { id: 'enjoyable', label: 'It made room for enjoyment', reply: 'Then play became part of the structure.', memory: 'Our first Rhythm That Holds treated enjoyment as a valid purpose.' },
    { id: 'adaptive', label: 'It could change', reply: 'Flexibility made the rhythm stronger, not weaker.', memory: 'Our first Rhythm That Holds was designed to adapt to real capacity.' },
    { id: 'supported', label: 'It felt supported', reply: 'Shared momentum helped without turning into pressure.', memory: 'Our first Rhythm That Holds made supportive company part of movement.' },
  ],
  goalTypeId: 'practice', goalTitle: 'Try one returnable movement moment',
  goalSummary: 'Choose a manageable training, mobility, or recovery moment with explicit permission to adapt or stop.',
  quickGoalIds: ['flexel:show-up', 'flexel:mobility-five', 'flexel:recovery-choice'],
};

const bedrotteConfig: JourneyStoryConfig = {
  familyId: 'bedrotte', companionName: 'Bedrotte', firstMeetingTitle: 'A room that asks nothing', chapterTitle: 'The Room That Asks Nothing',
  chapterQuestion: 'Rest can mean sleep, quiet, comfort, fewer demands, or gentle company. What would you most like it to offer lately?',
  openingOptions: [
    { id: 'sleep', label: 'Deeper sleep or wind-down', reply: 'Then we can prepare conditions without demanding a perfect night.' },
    { id: 'quiet', label: 'A real quiet break', reply: 'A pause can be complete even when nothing productive follows.' },
    { id: 'comfort', label: 'Comfort', reply: 'Warmth, texture, familiarity, and safety can be practical needs.' },
    { id: 'boundary', label: 'Permission to stop', reply: 'Then the doorway matters as much as the room.' },
    { id: 'company', label: 'Company without demands', reply: 'Rest can include someone nearby without requiring conversation.' },
  ],
  midpointPrompt: 'Two resting places served. What most affects whether rest actually feels available to you?',
  midpointOptions: [
    { id: 'permission', label: 'Feeling allowed to stop', reply: 'Guilt can keep the body working after the task has ended.', memory: 'Permission to stop is an important condition for restorative rest.' },
    { id: 'sensory', label: 'Light, sound, or physical comfort', reply: 'The nervous system notices the room before it hears an intention.', memory: 'Sensory conditions strongly shape whether rest feels restorative.' },
    { id: 'boundary', label: 'Protecting it from demands', reply: 'A pause needs an edge if everything else can enter it.', memory: 'Clear boundaries help protect restorative rest.' },
    { id: 'support', label: 'The right kind of support', reply: 'Care can stay close without fixing, advising, or measuring.', memory: 'Quiet, non-fixing support can make rest easier.' },
  ],
  journalTitle: "Today's rest clue", journalBody: 'Keep one signal that you needed rest, one condition that helped, or one demand you allowed to wait.',
  journalFlowId: 'general', journalChoiceIds: ['rest'], insightTitle: 'What lets rest land?', insightCategory: 'Rest & recovery',
  insightAxes: [
    { id: 'soft', title: 'The Soft Landing', reflection: 'Familiar comfort helps the system settle.', summary: 'Warmth, familiarity, and physical comfort help rest become believable.' },
    { id: 'sensory', title: 'The Sensory Settler', reflection: 'Light, sound, temperature, and texture shape the pause.', summary: 'Sensory conditions are central to how your body recognises restorative rest.' },
    { id: 'protected', title: 'The Protected Pause', reflection: 'A clear boundary keeps demands outside for a while.', summary: 'Rest works best when time, availability, and unfinished tasks have a visible edge.' },
    { id: 'supported', title: 'The Supported Restorer', reflection: 'Quiet care or company makes stopping feel safer.', summary: 'Non-demanding support and easy connection help you recover.' },
  ],
  questions: [
    { id: 'arrive', prompt: 'What helps you arrive in rest?', labels: ['A familiar comfort', 'A sensory shift', 'A clear stopping point', 'Someone supportive nearby'] },
    { id: 'friction', prompt: 'What most often blocks it?', labels: ['Nothing feels comforting', 'Too much input', 'Demands keep entering', 'I feel alone with everything'] },
    { id: 'short', prompt: 'What makes a short pause worthwhile?', labels: ['One soothing ritual', 'Fewer sensations', 'Knowing it is protected', 'Care without questions'] },
    { id: 'signal', prompt: 'How do you know rest is needed?', labels: ['I seek familiarity', 'Everything feels louder', 'I cannot keep being available', 'I need help carrying the day'] },
    { id: 'tomorrow', prompt: 'What would make tomorrow gentler?', labels: ['Keep comfort close', 'Soften one condition', 'Let one demand wait', 'Ask for quiet support'] },
  ],
  finaleOptions: [
    { id: 'comfort', label: 'It felt comforting', reply: 'Comfort was a need, not a prize.', memory: 'Our first Room That Asks Nothing treated comfort as something freely available.' },
    { id: 'sensory', label: 'The room itself helped', reply: 'The conditions told the body it could soften.', memory: 'Our first Room That Asks Nothing respected sensory needs.' },
    { id: 'boundary', label: 'Nothing could demand entry', reply: 'The boundary made the pause real.', memory: 'Our first Room That Asks Nothing protected rest from outside demands.' },
    { id: 'support', label: 'Care stayed nearby', reply: 'Support was present without asking you to perform recovery.', memory: 'Our first Room That Asks Nothing included quiet, non-fixing support.' },
  ],
  goalTypeId: 'recovery', goalTitle: 'Protect one restorative pause',
  goalSummary: 'Choose one brief rest, lower one demand, or prepare one condition that helps stopping feel possible.',
  quickGoalIds: ['sleep-rest:ten-minute-rest', 'sleep-rest:lower-demand', 'sleep-rest:notice-signal'],
};

export const STEPPLING_FIRST_MEETING_DEFINITION_ID = 'steppling:story:first-meeting';
export const VOYAGLE_FIRST_MEETING_DEFINITION_ID = 'voyagle:story:first-meeting';
export const FLEXEL_FIRST_MEETING_DEFINITION_ID = 'flexel:story:first-meeting';
export const BEDROTTE_FIRST_MEETING_DEFINITION_ID = 'bedrotte:story:first-meeting';
export const journeyCohortStoryConversationDefinitions: readonly ConversationDefinition[] = [
  ...makeJourneyStory(stepplingConfig),
  ...makeJourneyStory(voyagleConfig),
  ...makeJourneyStory(flexelConfig),
  ...makeJourneyStory(bedrotteConfig),
];
