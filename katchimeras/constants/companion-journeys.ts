import type { KatchimeraFamilyId } from '@/types/katchimera';

export type CompanionJourneyGoalStatus = 'active' | 'paused' | 'completed' | 'abandoned';

export type CompanionJourneyChoice = {
  id: string;
  label: string;
  goalTitle?: string;
  suggestedQuickGoalIds?: readonly string[];
  nextNodeId: string | null;
};

export type CompanionJourneyConversationNode = {
  id: string;
  kind: 'single_choice' | 'free_text';
  prompt: string;
  helperText: string;
  options?: readonly CompanionJourneyChoice[];
  allowCustomText?: boolean;
  nextNodeId?: string | null;
  createsGoalTypeId?: string;
  suggestedQuickGoalIds?: readonly string[];
};

export type CompanionJourneyStageDefinition = {
  id: string;
  title: string;
  description: string;
  requirement:
    | { kind: 'goal_created'; target: number }
    | { kind: 'quest_completions'; target: number }
    | { kind: 'reflections'; target: number }
    | { kind: 'goal_resolved'; target: number };
};

export type CompanionJourneyCheckInOption = {
  id: string;
  label: string;
};

export type CompanionJourneyDefinition = {
  id: string;
  version: number;
  familyId: KatchimeraFamilyId;
  title: string;
  introduction: string;
  conversationTitle: string;
  conversationStartLabel: string;
  startNodeId: string;
  nodes: readonly CompanionJourneyConversationNode[];
  goalTypes: Readonly<Record<string, { label: string; fallbackTitle: string }>>;
  checkIn: {
    prompt: string;
    options: readonly CompanionJourneyCheckInOption[];
  };
  stages: readonly CompanionJourneyStageDefinition[];
  reflectionPrompts: Readonly<Record<string, string>>;
};

type ThreeQuestionJourneyConfig = {
  id: string;
  familyId: KatchimeraFamilyId;
  title: string;
  introduction: string;
  conversationTitle: string;
  conversationStartLabel: string;
  first: {
    id: string;
    prompt: string;
    helperText: string;
    options: readonly { id: string; label: string }[];
  };
  second: {
    id: string;
    prompt: string;
    helperText: string;
    options: readonly { id: string; label: string }[];
  };
  goal: {
    id: string;
    typeId: string;
    typeLabel: string;
    fallbackTitle: string;
    prompt: string;
    helperText: string;
    options: readonly {
      id: string;
      label: string;
      goalTitle: string;
      suggestedQuickGoalIds: readonly string[];
    }[];
  };
  checkInPrompt: string;
  checkInOptions: readonly CompanionJourneyCheckInOption[];
  practiceTitle: string;
  practiceDescription: string;
  reflectionSubject: string;
};

function threeQuestionJourney(config: ThreeQuestionJourneyConfig): CompanionJourneyDefinition {
  return {
    id: config.id,
    version: 1,
    familyId: config.familyId,
    title: config.title,
    introduction: config.introduction,
    conversationTitle: config.conversationTitle,
    conversationStartLabel: config.conversationStartLabel,
    startNodeId: config.first.id,
    nodes: [
      {
        id: config.first.id,
        kind: 'single_choice',
        prompt: config.first.prompt,
        helperText: config.first.helperText,
        options: config.first.options.map((option) => ({ ...option, nextNodeId: config.second.id })),
      },
      {
        id: config.second.id,
        kind: 'single_choice',
        prompt: config.second.prompt,
        helperText: config.second.helperText,
        options: config.second.options.map((option) => ({ ...option, nextNodeId: config.goal.id })),
      },
      {
        id: config.goal.id,
        kind: 'single_choice',
        createsGoalTypeId: config.goal.typeId,
        prompt: config.goal.prompt,
        helperText: config.goal.helperText,
        options: config.goal.options.map((option) => ({ ...option, nextNodeId: null })),
        allowCustomText: true,
        nextNodeId: null,
      },
    ],
    goalTypes: {
      [config.goal.typeId]: {
        label: config.goal.typeLabel,
        fallbackTitle: config.goal.fallbackTitle,
      },
    },
    checkIn: {
      prompt: config.checkInPrompt,
      options: config.checkInOptions,
    },
    stages: [
      { id: 'choose', title: 'Choose a direction', description: `Name the ${config.reflectionSubject} you want to explore.`, requirement: { kind: 'goal_created', target: 1 } },
      { id: 'practice', title: config.practiceTitle, description: config.practiceDescription, requirement: { kind: 'quest_completions', target: 3 } },
      { id: 'review', title: 'Notice the pattern', description: `Reflect on what your ${config.reflectionSubject} moments are showing you.`, requirement: { kind: 'reflections', target: 1 } },
      { id: 'decide', title: 'Choose what continues', description: 'Keep, reshape, pause, or complete this Focus.', requirement: { kind: 'goal_resolved', target: 1 } },
    ],
    reflectionPrompts: {
      choose: `What would make this ${config.reflectionSubject} direction worth returning to?`,
      practice: `What happened today that supported “{goal}”, and what did you notice?`,
      review: `Across your recent ${config.reflectionSubject} moments, what is helping “{goal}” feel meaningful?`,
      decide: `What should happen next with “{goal}”: keep it, reshape it, pause it, or call it complete?`,
    },
  };
}

const coffeeRitual = threeQuestionJourney({
  id: 'coffee-ritual-intentional-pause',
  familyId: 'coffee-ritual',
  title: 'An intentional pause',
  introduction: 'Use a familiar drink to mark a beginning, break, comfort, or shared moment without turning the ritual into another task.',
  conversationTitle: 'Shape a small daily ritual',
  conversationStartLabel: 'Choose what the pause is for',
  first: {
    id: 'pause-gift',
    prompt: 'What do you most want this small ritual to give you?',
    helperText: 'The drink is only the cue. Choose the experience around it.',
    options: [
      { id: 'start', label: 'A clearer start' },
      { id: 'break', label: 'A real break' },
      { id: 'comfort', label: 'Comfort and familiarity' },
      { id: 'connection', label: 'A moment with someone' },
    ],
  },
  second: {
    id: 'pause-friction',
    prompt: 'What usually makes the ritual disappear?',
    helperText: 'Baristabbit will keep the Focus small enough to survive busy days.',
    options: [
      { id: 'rush', label: 'I rush straight through it' },
      { id: 'screen', label: 'Another screen takes over' },
      { id: 'automatic', label: 'It happens automatically' },
      { id: 'skip', label: 'I skip breaks when busy' },
    ],
  },
  goal: {
    id: 'pause-goal',
    typeId: 'ritual',
    typeLabel: 'Ritual',
    fallbackTitle: 'Make one daily pause intentional',
    prompt: 'What ritual direction would feel useful?',
    helperText: 'Choose one gentle cue, or write your own.',
    options: [
      { id: 'morning', label: 'Create a deliberate morning start', goalTitle: 'Use my first drink to begin the day deliberately', suggestedQuickGoalIds: ['coffee-ritual:make-pause', 'coffee-ritual:first-sip'] },
      { id: 'break', label: 'Protect a real workday break', goalTitle: 'Protect one small drink break in the day', suggestedQuickGoalIds: ['coffee-ritual:weekday-pause', 'coffee-ritual:choose-intention'] },
      { id: 'comfort', label: 'Make the ritual feel comforting', goalTitle: 'Make one familiar ritual feel genuinely comforting', suggestedQuickGoalIds: ['coffee-ritual:favourite-cup', 'coffee-ritual:notice-cue'] },
      { id: 'share', label: 'Share the pause more often', goalTitle: 'Create more shared drink-break moments', suggestedQuickGoalIds: ['coffee-ritual:share-drink', 'coffee-ritual:try-method'] },
    ],
  },
  checkInPrompt: 'What did the ritual change today?',
  checkInOptions: [
    { id: 'started', label: 'It helped me begin' },
    { id: 'paused', label: 'It became a real pause' },
    { id: 'comforted', label: 'The familiarity felt comforting' },
    { id: 'shared', label: 'I shared it with someone' },
    { id: 'other', label: 'Something else' },
  ],
  practiceTitle: 'Pause on purpose',
  practiceDescription: 'Share three real ritual moments.',
  reflectionSubject: 'daily ritual',
});

const errandimp = threeQuestionJourney({
  id: 'errandimp-lighter-loops',
  familyId: 'errandimp',
  title: 'Lighter loose ends',
  introduction: 'Close practical loops in small passes so ordinary maintenance stops occupying more attention than it deserves.',
  conversationTitle: 'Lighten practical life',
  conversationStartLabel: 'Choose an admin direction',
  first: {
    id: 'admin-drag',
    prompt: 'Which practical tasks create the most drag?',
    helperText: 'Choose the area that most often stays open in your head.',
    options: [
      { id: 'forms', label: 'Appointments, forms, and messages' },
      { id: 'home', label: 'Household resets' },
      { id: 'outside', label: 'Shopping, returns, and errands' },
      { id: 'postponed', label: 'Small things I keep postponing' },
    ],
  },
  second: {
    id: 'admin-friction',
    prompt: 'Why do those loops tend to stay open?',
    helperText: 'Errandimp is looking for the smallest useful intervention.',
    options: [
      { id: 'unclear', label: 'I forget the next practical step' },
      { id: 'batch', label: 'There are too many little things' },
      { id: 'energy', label: 'They feel dull or draining' },
      { id: 'timing', label: 'They depend on the right time or place' },
    ],
  },
  goal: {
    id: 'admin-goal',
    typeId: 'life-admin',
    typeLabel: 'Life admin',
    fallbackTitle: 'Keep practical life lighter',
    prompt: 'What practical rhythm would make life feel lighter?',
    helperText: 'Choose a loop you control, or write your own.',
    options: [
      { id: 'one-daily', label: 'Close one small loop a day', goalTitle: 'Close one small practical loop at a time', suggestedQuickGoalIds: ['errandimp:one-errand', 'errandimp:close-loop'] },
      { id: 'reset', label: 'Keep one area reset', goalTitle: 'Build a five-minute household reset', suggestedQuickGoalIds: ['errandimp:five-minute-reset', 'errandimp:clear-surface'] },
      { id: 'admin', label: 'Stop postponing admin', goalTitle: 'Handle life admin before it becomes urgent', suggestedQuickGoalIds: ['errandimp:weekday-admin', 'errandimp:book-appointment'] },
      { id: 'prepare', label: 'Prepare practical needs earlier', goalTitle: 'Prepare tomorrow’s practical needs in advance', suggestedQuickGoalIds: ['errandimp:check-list', 'errandimp:return-item'] },
    ],
  },
  checkInPrompt: 'What became lighter today?',
  checkInOptions: [
    { id: 'closed', label: 'I closed a loose loop' },
    { id: 'reset', label: 'I reset a useful space' },
    { id: 'prepared', label: 'I prepared something early' },
    { id: 'deferred', label: 'I decided what can wait' },
    { id: 'other', label: 'Something else' },
  ],
  practiceTitle: 'Close small loops',
  practiceDescription: 'Share three real admin or maintenance moments.',
  reflectionSubject: 'practical',
});

const dawnle = threeQuestionJourney({
  id: 'dawnle-kinder-beginnings',
  familyId: 'dawnle',
  title: 'Kinder beginnings',
  introduction: 'Shape the first few minutes of the day with a repeatable cue that reduces rushing and supports the morning you actually live.',
  conversationTitle: 'Choose a morning beginning',
  conversationStartLabel: 'Shape the first part of the day',
  first: {
    id: 'morning-need',
    prompt: 'What would improve the beginning of your day most?',
    helperText: 'This is about the start, not waking at an impressive hour.',
    options: [
      { id: 'calm', label: 'Less rushing' },
      { id: 'light', label: 'More light and movement' },
      { id: 'clarity', label: 'A clearer first step' },
      { id: 'quiet', label: 'A calmer first few minutes' },
    ],
  },
  second: {
    id: 'morning-friction',
    prompt: 'What tends to take over first?',
    helperText: 'Dawnle will help change one cue rather than rebuild the whole morning.',
    options: [
      { id: 'phone', label: 'My phone' },
      { id: 'rushing', label: 'Immediate rushing' },
      { id: 'fog', label: 'I do not know where to begin' },
      { id: 'night', label: 'Nothing was prepared the night before' },
    ],
  },
  goal: {
    id: 'morning-goal',
    typeId: 'morning-start',
    typeLabel: 'Morning start',
    fallbackTitle: 'Build a kinder morning beginning',
    prompt: 'What beginning would you like to practise?',
    helperText: 'Choose one cue that can work on ordinary mornings.',
    options: [
      { id: 'light', label: 'Begin with light and water', goalTitle: 'Begin the day with light and water', suggestedQuickGoalIds: ['dawnle:open-curtains', 'dawnle:morning-water', 'dawnle:outside-light'] },
      { id: 'phone', label: 'Protect the first minutes from my phone', goalTitle: 'Keep the first few minutes of the day phone-free', suggestedQuickGoalIds: ['dawnle:no-phone-five', 'dawnle:choose-first'] },
      { id: 'simple', label: 'Follow a simple first sequence', goalTitle: 'Build a simple weekday starting sequence', suggestedQuickGoalIds: ['dawnle:weekday-start', 'dawnle:notice-energy'] },
      { id: 'prepare', label: 'Prepare the start the night before', goalTitle: 'Make tomorrow morning easier the night before', suggestedQuickGoalIds: ['dawnle:prepare-night', 'dawnle:choose-first'] },
    ],
  },
  checkInPrompt: 'What set the tone this morning?',
  checkInOptions: [
    { id: 'light', label: 'Light or movement helped' },
    { id: 'calm', label: 'The start felt calmer' },
    { id: 'clear', label: 'I knew the first step' },
    { id: 'rushed', label: 'I noticed what created the rush' },
    { id: 'other', label: 'Something else' },
  ],
  practiceTitle: 'Practise the beginning',
  practiceDescription: 'Share three real morning-start moments.',
  reflectionSubject: 'morning',
});

const mendle = threeQuestionJourney({
  id: 'mendle-gentle-repair',
  familyId: 'mendle',
  title: 'Gentle repair',
  introduction: 'Meet tender days honestly, lower unnecessary pressure, and discover which small acts help emotional recovery begin.',
  conversationTitle: 'Choose what support looks like',
  conversationStartLabel: 'Find a gentle recovery direction',
  first: {
    id: 'tender-need',
    prompt: 'What is hardest on a tender day?',
    helperText: 'Choose what needs kindness, not what you think should be fixed.',
    options: [
      { id: 'name', label: 'Naming what I feel' },
      { id: 'pressure', label: 'Lowering expectations' },
      { id: 'kindness', label: 'Being fair to myself' },
      { id: 'support', label: 'Letting someone know' },
    ],
  },
  second: {
    id: 'repair-friction',
    prompt: 'What tends to make recovery harder?',
    helperText: 'Mendle will never turn the answer into a performance target.',
    options: [
      { id: 'push', label: 'I keep pushing through' },
      { id: 'judge', label: 'I judge the feeling' },
      { id: 'isolate', label: 'I withdraw without asking for support' },
      { id: 'solve', label: 'I try to solve everything at once' },
    ],
  },
  goal: {
    id: 'repair-goal',
    typeId: 'emotional-recovery',
    typeLabel: 'Recovery',
    fallbackTitle: 'Practise gentler emotional recovery',
    prompt: 'What supportive direction feels possible?',
    helperText: 'Choose a small act of repair, or write your own.',
    options: [
      { id: 'notice', label: 'Notice feelings without fixing them', goalTitle: 'Make room for honest emotional check-ins', suggestedQuickGoalIds: ['mendle:name-feeling', 'mendle:weekday-checkin'] },
      { id: 'lower', label: 'Lower pressure on tender days', goalTitle: 'Lower unnecessary pressure on tender days', suggestedQuickGoalIds: ['mendle:soften-expectation', 'mendle:ask-need'] },
      { id: 'kind', label: 'Practise fairer self-talk', goalTitle: 'Replace harsh self-talk with something fairer', suggestedQuickGoalIds: ['mendle:release-blame', 'mendle:comfort-action'] },
      { id: 'support', label: 'Reach for support earlier', goalTitle: 'Let trusted people know when a day is tender', suggestedQuickGoalIds: ['mendle:reach-support', 'mendle:gentle-breath'] },
    ],
  },
  checkInPrompt: 'What helped repair begin today?',
  checkInOptions: [
    { id: 'named', label: 'I named the feeling honestly' },
    { id: 'softened', label: 'I softened an expectation' },
    { id: 'kind', label: 'I treated myself more fairly' },
    { id: 'supported', label: 'I reached for support' },
    { id: 'other', label: 'Something else' },
  ],
  practiceTitle: 'Practise gentle repair',
  practiceDescription: 'Share three real emotional-recovery moments.',
  reflectionSubject: 'recovery',
});

const quietome = threeQuestionJourney({
  id: 'quietome-chosen-solitude',
  familyId: 'quietome',
  title: 'Chosen solitude',
  introduction: 'Protect small spaces with less input so reflection can become perspective rather than another demand for answers.',
  conversationTitle: 'Choose a quiet direction',
  conversationStartLabel: 'Explore what solitude can give',
  first: {
    id: 'quiet-gift',
    prompt: 'What do you most need from time alone?',
    helperText: 'Choose the quality of solitude you want, not simply less contact.',
    options: [
      { id: 'perspective', label: 'Perspective' },
      { id: 'input', label: 'Less input' },
      { id: 'writing', label: 'Space to write' },
      { id: 'question', label: 'Time with an unanswered question' },
    ],
  },
  second: {
    id: 'quiet-friction',
    prompt: 'What tends to interrupt that space?',
    helperText: 'Quietome will keep the practice light and chosen.',
    options: [
      { id: 'phone', label: 'My phone fills every gap' },
      { id: 'late', label: 'I wait until I am depleted' },
      { id: 'solve', label: 'I pressure myself to find answers' },
      { id: 'avoid', label: 'Solitude turns into avoidance' },
    ],
  },
  goal: {
    id: 'quiet-goal',
    typeId: 'solitude',
    typeLabel: 'Solitude',
    fallbackTitle: 'Protect a small reflective pause',
    prompt: 'What kind of quiet would help you hear yourself?',
    helperText: 'Choose a small recurring practice, or write your own.',
    options: [
      { id: 'pause', label: 'Take a small quiet pause', goalTitle: 'Protect a small daily quiet pause', suggestedQuickGoalIds: ['quietome:two-quiet-minutes', 'quietome:phone-outside'] },
      { id: 'write', label: 'Write one honest line', goalTitle: 'Use one honest line to notice what is here', suggestedQuickGoalIds: ['quietome:write-one-line', 'quietome:notice-thought'] },
      { id: 'walk', label: 'Walk without more input', goalTitle: 'Make room for quiet walks without added input', suggestedQuickGoalIds: ['quietome:silent-walk', 'quietome:choose-solitude'] },
      { id: 'question', label: 'Return to one question slowly', goalTitle: 'Stay with one important question without forcing an answer', suggestedQuickGoalIds: ['quietome:sit-with-question', 'quietome:weekday-reflect'] },
    ],
  },
  checkInPrompt: 'What did quiet make visible today?',
  checkInOptions: [
    { id: 'clearer', label: 'Something became clearer' },
    { id: 'returned', label: 'A thought or question returned' },
    { id: 'rested', label: 'Less input felt restorative' },
    { id: 'chosen', label: 'Solitude felt chosen, not isolating' },
    { id: 'other', label: 'Something else' },
  ],
  practiceTitle: 'Protect the quiet',
  practiceDescription: 'Share three real solitude or reflection moments.',
  reflectionSubject: 'solitude',
});

const flickerbun = threeQuestionJourney({
  id: 'flickerbun-intentional-watching',
  familyId: 'flickerbun',
  title: 'Intentional watching',
  introduction: 'Choose stories on purpose, notice what stays with you, and make watching feel more like an experience than a default.',
  conversationTitle: 'Shape your watching life',
  conversationStartLabel: 'Choose a screen-story direction',
  first: {
    id: 'story-gift',
    prompt: 'What do you most want a film or show to give you?',
    helperText: 'There is no superior kind of watching; choose what feels alive now.',
    options: [
      { id: 'escape', label: 'Rest and escape' },
      { id: 'feeling', label: 'A strong feeling' },
      { id: 'ideas', label: 'Ideas and perspective' },
      { id: 'together', label: 'Something to share with people' },
    ],
  },
  second: {
    id: 'watching-friction',
    prompt: 'What most often makes watching feel less satisfying?',
    helperText: 'Flickerbun will keep the Focus practical.',
    options: [
      { id: 'browsing', label: 'Too much browsing, not enough choosing' },
      { id: 'distraction', label: 'I watch while distracted' },
      { id: 'routine', label: 'I stay inside the same comfort zone' },
      { id: 'forgetting', label: 'Stories blur together afterward' },
    ],
  },
  goal: {
    id: 'watching-goal',
    typeId: 'watching',
    typeLabel: 'Watching',
    fallbackTitle: 'Make watching more intentional',
    prompt: 'What watching direction would feel worthwhile?',
    helperText: 'Choose one experiment, or write your own.',
    options: [
      { id: 'choose-first', label: 'Choose before I browse', goalTitle: 'Choose what I want to watch before browsing', suggestedQuickGoalIds: ['flickerbun:choose-watch', 'flickerbun:weekday-watchlist'] },
      { id: 'full-attention', label: 'Watch with full attention', goalTitle: 'Give chosen screen stories my full attention', suggestedQuickGoalIds: ['flickerbun:watch-one', 'flickerbun:phone-away'] },
      { id: 'broaden', label: 'Try stories outside my usual lane', goalTitle: 'Broaden the stories I watch', suggestedQuickGoalIds: ['flickerbun:try-genre', 'flickerbun:planned-screen'] },
      { id: 'keep', label: 'Keep and share what stays with me', goalTitle: 'Keep the screen stories that stay with me', suggestedQuickGoalIds: ['flickerbun:keep-scene', 'flickerbun:share-recommendation'] },
    ],
  },
  checkInPrompt: 'What happened in your watching life today?',
  checkInOptions: [
    { id: 'chosen', label: 'I chose what to watch deliberately' },
    { id: 'absorbed', label: 'A story held my attention' },
    { id: 'stayed', label: 'A scene or idea stayed with me' },
    { id: 'shared', label: 'I shared the experience with someone' },
    { id: 'other', label: 'Something else' },
  ],
  practiceTitle: 'Watch and notice',
  practiceDescription: 'Share three real screen-story moments.',
  reflectionSubject: 'watching',
});

const relicoon = threeQuestionJourney({
  id: 'relicoon-cultural-trail',
  familyId: 'relicoon',
  title: 'A cultural trail',
  introduction: 'Follow objects, places, and stories into the past, then keep the human details that make history feel present.',
  conversationTitle: 'Follow a thread through time',
  conversationStartLabel: 'Choose a cultural direction',
  first: {
    id: 'past-entry',
    prompt: 'What most often draws you into history or culture?',
    helperText: 'Choose the doorway that makes you want to look closer.',
    options: [
      { id: 'people', label: 'People and ordinary life' },
      { id: 'objects', label: 'Objects and design' },
      { id: 'places', label: 'Places and events' },
      { id: 'art', label: 'Art and meaning' },
    ],
  },
  second: {
    id: 'culture-setting',
    prompt: 'Where would you most enjoy following that curiosity?',
    helperText: 'Digital collections and nearby traces count as much as major museums.',
    options: [
      { id: 'museum', label: 'A museum or gallery' },
      { id: 'nearby', label: 'History near where I live' },
      { id: 'online', label: 'Archives and collections online' },
      { id: 'one-thread', label: 'One period, object, or question' },
    ],
  },
  goal: {
    id: 'culture-goal',
    typeId: 'cultural-trail',
    typeLabel: 'Cultural trail',
    fallbackTitle: 'Follow a cultural curiosity',
    prompt: 'What cultural direction should Relicoon remember?',
    helperText: 'Choose a trail you can follow in small pieces, or write your own.',
    options: [
      { id: 'visit', label: 'Plan a cultural visit', goalTitle: 'Make room for a museum or cultural visit', suggestedQuickGoalIds: ['relicoon:save-exhibit', 'relicoon:read-label'] },
      { id: 'nearby-history', label: 'Notice local history', goalTitle: 'Notice the history carried by nearby places', suggestedQuickGoalIds: ['relicoon:notice-history', 'relicoon:look-up-object'] },
      { id: 'question', label: 'Follow one historical question', goalTitle: 'Follow one historical question further', suggestedQuickGoalIds: ['relicoon:look-up-object', 'relicoon:weekday-curiosity'] },
      { id: 'keep-story', label: 'Keep the stories behind objects', goalTitle: 'Keep the human stories behind cultural objects', suggestedQuickGoalIds: ['relicoon:keep-detail', 'relicoon:share-story'] },
    ],
  },
  checkInPrompt: 'What did the past reveal today?',
  checkInOptions: [
    { id: 'object', label: 'An object made me curious' },
    { id: 'place', label: 'A place carried a story' },
    { id: 'person', label: 'I learned how someone lived' },
    { id: 'connection', label: 'I connected two ideas across time' },
    { id: 'other', label: 'Something else' },
  ],
  practiceTitle: 'Follow the trail',
  practiceDescription: 'Share three real cultural or historical moments.',
  reflectionSubject: 'cultural',
});

const encora = threeQuestionJourney({
  id: 'encora-active-music',
  familyId: 'encora',
  title: 'Active music',
  introduction: 'Bring music into the foreground through listening, discovery, practice, and sharing.',
  conversationTitle: 'Choose a musical direction',
  conversationStartLabel: 'Explore your music life',
  first: {
    id: 'music-role',
    prompt: 'What do you most want music to do in your life?',
    helperText: 'Choose the role you want to make more deliberate.',
    options: [
      { id: 'feel', label: 'Help me feel or shift mood' },
      { id: 'discover', label: 'Open new sounds and artists' },
      { id: 'make', label: 'Give me something to practise or make' },
      { id: 'connect', label: 'Connect me with people' },
    ],
  },
  second: {
    id: 'music-friction',
    prompt: 'What most often keeps music in the background?',
    helperText: 'Encora will favour a direction that fits your real attention.',
    options: [
      { id: 'habit', label: 'I repeat the same familiar music' },
      { id: 'background', label: 'I rarely listen closely' },
      { id: 'practice', label: 'Practice is hard to restart' },
      { id: 'sharing', label: 'I keep music to myself' },
    ],
  },
  goal: {
    id: 'music-goal',
    typeId: 'music',
    typeLabel: 'Music',
    fallbackTitle: 'Make music more active in my life',
    prompt: 'What musical direction feels right now?',
    helperText: 'Listening is a complete direction; performing is not required.',
    options: [
      { id: 'listen', label: 'Listen with full attention', goalTitle: 'Make space for active listening', suggestedQuickGoalIds: ['encora:listen-one-song', 'encora:no-shuffle'] },
      { id: 'discover', label: 'Discover unfamiliar music', goalTitle: 'Keep discovering music beyond my defaults', suggestedQuickGoalIds: ['encora:new-artist', 'encora:sound-break'] },
      { id: 'practice', label: 'Return to making or practising', goalTitle: 'Return gently to making or practising music', suggestedQuickGoalIds: ['encora:make-music', 'encora:weekday-practice'] },
      { id: 'share', label: 'Use music to connect', goalTitle: 'Share more music with people I care about', suggestedQuickGoalIds: ['encora:share-song', 'encora:play-favourite'] },
    ],
  },
  checkInPrompt: 'What did music do for you today?',
  checkInOptions: [
    { id: 'heard', label: 'I heard something differently' },
    { id: 'felt', label: 'A song met the mood' },
    { id: 'made', label: 'I made or practised music' },
    { id: 'shared', label: 'Music connected me with someone' },
    { id: 'other', label: 'Something else' },
  ],
  practiceTitle: 'Bring music forward',
  practiceDescription: 'Share three real listening, making, or sharing moments.',
  reflectionSubject: 'music',
});

const gatherglow = threeQuestionJourney({
  id: 'gatherglow-tended-connection',
  familyId: 'gatherglow',
  title: 'Tended connection',
  introduction: 'Choose a relationship rhythm worth participating in, then notice what makes connection feel mutual and real.',
  conversationTitle: 'Tend a social rhythm',
  conversationStartLabel: 'Choose a connection direction',
  first: {
    id: 'connection-shape',
    prompt: 'What kind of connection feels most missing?',
    helperText: 'Choose the shape, not a person, for now.',
    options: [
      { id: 'regular', label: 'More regular contact' },
      { id: 'deeper', label: 'Deeper conversation' },
      { id: 'shared', label: 'More things done together' },
      { id: 'belonging', label: 'A stronger sense of belonging' },
    ],
  },
  second: {
    id: 'connection-friction',
    prompt: 'What most often gets in the way?',
    helperText: 'This is about your part of the pattern, not grading anyone else.',
    options: [
      { id: 'waiting', label: 'I wait for others to reach out' },
      { id: 'time', label: 'Plans never quite happen' },
      { id: 'surface', label: 'Conversation stays on the surface' },
      { id: 'energy', label: 'Social energy is limited' },
    ],
  },
  goal: {
    id: 'connection-goal',
    typeId: 'connection',
    typeLabel: 'Connection',
    fallbackTitle: 'Tend a meaningful connection',
    prompt: 'What connection direction would feel nourishing?',
    helperText: 'Choose an action you control, or write your own.',
    options: [
      { id: 'reach', label: 'Reach out more regularly', goalTitle: 'Reach out instead of always waiting', suggestedQuickGoalIds: ['gatherglow:send-message', 'gatherglow:weekday-reach-out'] },
      { id: 'plan', label: 'Make simple plans happen', goalTitle: 'Make room for simple shared plans', suggestedQuickGoalIds: ['gatherglow:make-plan', 'gatherglow:shared-moment'] },
      { id: 'deepen', label: 'Make conversation more genuine', goalTitle: 'Create space for more genuine conversation', suggestedQuickGoalIds: ['gatherglow:check-in', 'gatherglow:give-attention'] },
      { id: 'appreciate', label: 'Show people they matter', goalTitle: 'Express appreciation more openly', suggestedQuickGoalIds: ['gatherglow:say-thanks', 'gatherglow:reply-today'] },
    ],
  },
  checkInPrompt: 'What happened in connection today?',
  checkInOptions: [
    { id: 'reached', label: 'I reached out' },
    { id: 'shared', label: 'We shared real time or attention' },
    { id: 'deeper', label: 'A conversation went deeper' },
    { id: 'belonged', label: 'I felt part of something' },
    { id: 'other', label: 'Something else' },
  ],
  practiceTitle: 'Show up and notice',
  practiceDescription: 'Share three real moments of connection.',
  reflectionSubject: 'connection',
});

const cheerlet = threeQuestionJourney({
  id: 'cheerlet-visible-progress',
  familyId: 'cheerlet',
  title: 'Visible progress',
  introduction: 'Make progress and chapter changes visible enough to acknowledge, remember, and celebrate.',
  conversationTitle: 'Choose what deserves credit',
  conversationStartLabel: 'Mark a meaningful chapter',
  first: {
    id: 'overlooked-progress',
    prompt: 'What do you most often forget to acknowledge?',
    helperText: 'It does not need to be finished or impressive to count.',
    options: [
      { id: 'small', label: 'Small wins' },
      { id: 'distance', label: 'How far I have come' },
      { id: 'support', label: 'The people who helped' },
      { id: 'chapter', label: 'A beginning or ending' },
    ],
  },
  second: {
    id: 'celebration-friction',
    prompt: 'Why does acknowledgement tend to get skipped?',
    helperText: 'Cheerlet will keep celebration proportionate and genuine.',
    options: [
      { id: 'next', label: 'I move straight to the next thing' },
      { id: 'not-enough', label: 'Progress never feels big enough' },
      { id: 'awkward', label: 'Celebrating myself feels awkward' },
      { id: 'memory', label: 'The moment passes before I save it' },
    ],
  },
  goal: {
    id: 'celebration-goal',
    typeId: 'milestone',
    typeLabel: 'Milestone',
    fallbackTitle: 'Make meaningful progress visible',
    prompt: 'What would you like to acknowledge more deliberately?',
    helperText: 'Choose a direction, or write the chapter in your own words.',
    options: [
      { id: 'small-wins', label: 'Notice small wins', goalTitle: 'Give small wins the credit they deserve', suggestedQuickGoalIds: ['cheerlet:name-win', 'cheerlet:weekday-credit'] },
      { id: 'progress', label: 'Mark progress before the finish', goalTitle: 'Mark progress while it is still unfolding', suggestedQuickGoalIds: ['cheerlet:mark-progress', 'cheerlet:small-celebration'] },
      { id: 'chapter', label: 'Remember a chapter change', goalTitle: 'Remember this chapter as it changes', suggestedQuickGoalIds: ['cheerlet:save-memory', 'cheerlet:share-good-news'] },
      { id: 'support', label: 'Acknowledge other people', goalTitle: 'Acknowledge the people who helped me get here', suggestedQuickGoalIds: ['cheerlet:thank-helper', 'cheerlet:congratulate'] },
    ],
  },
  checkInPrompt: 'What deserved acknowledgement today?',
  checkInOptions: [
    { id: 'win', label: 'A small win' },
    { id: 'progress', label: 'Progress before the finish' },
    { id: 'chapter', label: 'A beginning or ending' },
    { id: 'support', label: 'Someone’s help or success' },
    { id: 'other', label: 'Something else' },
  ],
  practiceTitle: 'Mark what matters',
  practiceDescription: 'Share three real moments of progress or chapter change.',
  reflectionSubject: 'milestone',
});

const skylo = threeQuestionJourney({
  id: 'skylo-local-discovery',
  familyId: 'skylo',
  title: 'Local discovery',
  introduction: 'Turn the city around you into somewhere you actively notice, explore, and gradually know.',
  conversationTitle: 'Know your city differently',
  conversationStartLabel: 'Choose a local exploration',
  first: {
    id: 'city-interest',
    prompt: 'What makes a city interesting to you?',
    helperText: 'Choose what naturally pulls your attention.',
    options: [
      { id: 'hidden', label: 'Hidden and overlooked places' },
      { id: 'details', label: 'Architecture and small details' },
      { id: 'local-life', label: 'Food and everyday local life' },
      { id: 'areas', label: 'Different neighbourhoods' },
    ],
  },
  second: {
    id: 'city-friction',
    prompt: 'What keeps your surroundings feeling too familiar?',
    helperText: 'Exploration can begin with a five-minute detour.',
    options: [
      { id: 'routine', label: 'I repeat the same routes' },
      { id: 'passing', label: 'I pass places without stopping' },
      { id: 'planning', label: 'Ideas stay on a saved list' },
      { id: 'far', label: 'I assume exploration must be far away' },
    ],
  },
  goal: {
    id: 'city-goal',
    typeId: 'local-exploration',
    typeLabel: 'Local exploration',
    fallbackTitle: 'Explore my city with fresh attention',
    prompt: 'What local direction would make the city feel new?',
    helperText: 'Choose a practical experiment, or write your own.',
    options: [
      { id: 'detours', label: 'Take more small detours', goalTitle: 'Use small detours to see familiar streets differently', suggestedQuickGoalIds: ['skylo:new-street', 'skylo:weekday-detour'] },
      { id: 'stops', label: 'Actually visit saved places', goalTitle: 'Turn saved local places into real visits', suggestedQuickGoalIds: ['skylo:save-place', 'skylo:local-stop'] },
      { id: 'neighbourhood', label: 'Know one neighbourhood better', goalTitle: 'Get to know one neighbourhood beyond my usual route', suggestedQuickGoalIds: ['skylo:walk-neighbourhood', 'skylo:city-photo'] },
      { id: 'notice', label: 'Notice city details', goalTitle: 'Pay closer attention to the city around me', suggestedQuickGoalIds: ['skylo:look-up', 'skylo:share-place'] },
    ],
  },
  checkInPrompt: 'What did the city reveal today?',
  checkInOptions: [
    { id: 'new', label: 'I went somewhere new' },
    { id: 'stopped', label: 'I stopped somewhere I usually pass' },
    { id: 'detail', label: 'I noticed a city detail' },
    { id: 'familiar', label: 'A familiar area felt different' },
    { id: 'other', label: 'Something else' },
  ],
  practiceTitle: 'Explore and notice',
  practiceDescription: 'Share three real moments of local discovery.',
  reflectionSubject: 'local exploration',
});

const steppling: CompanionJourneyDefinition = {
  id: 'steppling-everyday-momentum',
  version: 1,
  familyId: 'steppling',
  title: 'Everyday momentum',
  introduction: 'Find where walking fits naturally, then build movement into ordinary days without turning it into a performance.',
  conversationTitle: 'Find your walking rhythm',
  conversationStartLabel: 'Choose a walking direction',
  startNodeId: 'walking-purpose',
  nodes: [
    {
      id: 'walking-purpose',
      kind: 'single_choice',
      prompt: 'What would you most like walking to give you?',
      helperText: 'Choose the benefit that would make walking worth returning to.',
      options: [
        { id: 'energy', label: 'More everyday energy', nextNodeId: 'walking-fit' },
        { id: 'headspace', label: 'Space to clear my head', nextNodeId: 'walking-fit' },
        { id: 'exploration', label: 'A way to explore', nextNodeId: 'walking-fit' },
        { id: 'consistency', label: 'A steadier movement habit', nextNodeId: 'walking-fit' },
      ],
    },
    {
      id: 'walking-fit',
      kind: 'single_choice',
      prompt: 'Where could walking fit most easily?',
      helperText: 'Start with the shape your real days already make possible.',
      options: [
        { id: 'journeys', label: 'Journeys I already make', nextNodeId: 'walking-goal' },
        { id: 'breaks', label: 'Short breaks', nextNodeId: 'walking-goal' },
        { id: 'meals', label: 'Before or after meals', nextNodeId: 'walking-goal' },
        { id: 'weekends', label: 'Longer weekend wanders', nextNodeId: 'walking-goal' },
      ],
    },
    {
      id: 'walking-goal',
      kind: 'single_choice',
      createsGoalTypeId: 'walking-rhythm',
      prompt: 'What walking direction feels useful now?',
      helperText: 'Pick a simple experiment, or write your own.',
      options: [
        { id: 'daily-ten', label: 'Walk for ten minutes most days', goalTitle: 'Make room for a ten-minute walk', suggestedQuickGoalIds: ['steppling:ten-minute-walk', 'steppling:fresh-air-break'], nextNodeId: null },
        { id: 'walk-journey', label: 'Walk more everyday journeys', goalTitle: 'Turn one everyday journey into a walk', suggestedQuickGoalIds: ['steppling:walk-one-journey', 'steppling:weekday-steps'], nextNodeId: null },
        { id: 'clear-head', label: 'Use walking to clear my head', goalTitle: 'Use a short walk to make headspace', suggestedQuickGoalIds: ['steppling:fresh-air-break', 'steppling:notice-route'], nextNodeId: null },
        { id: 'explore', label: 'Explore beyond my usual route', goalTitle: 'Explore one unfamiliar route at a time', suggestedQuickGoalIds: ['steppling:explore-turn', 'steppling:notice-route'], nextNodeId: null },
      ],
      allowCustomText: true,
      nextNodeId: null,
    },
  ],
  goalTypes: {
    'walking-rhythm': { label: 'Walking rhythm', fallbackTitle: 'Build everyday walking momentum' },
  },
  checkIn: {
    prompt: 'What did walking give you today?',
    options: [
      { id: 'moved', label: 'I made room to move' },
      { id: 'headspace', label: 'The walk gave me headspace' },
      { id: 'noticed', label: 'I noticed something along the way' },
      { id: 'friction', label: 'I noticed what made walking difficult' },
      { id: 'other', label: 'Something else' },
    ],
  },
  stages: [
    { id: 'choose', title: 'Choose a rhythm', description: 'Decide what walking should add to your days.', requirement: { kind: 'goal_created', target: 1 } },
    { id: 'walk', title: 'Build momentum', description: 'Share three real walking moments.', requirement: { kind: 'quest_completions', target: 3 } },
    { id: 'review', title: 'Notice what works', description: 'Reflect on when walking fits naturally.', requirement: { kind: 'reflections', target: 1 } },
    { id: 'decide', title: 'Choose what continues', description: 'Keep, reshape, pause, or complete this walking goal.', requirement: { kind: 'goal_resolved', target: 1 } },
  ],
  reflectionPrompts: {
    choose: 'What would walking add to your life if it felt easy to repeat?',
    walk: 'What helped “{goal}” fit into today, and what did the walk give you?',
    review: 'Across your recent walks, which times, places, or reasons made “{goal}” easiest to return to?',
    decide: 'What should happen next with “{goal}”: keep it, reshape it, pause it, or call it complete?',
  },
};

const feastle: CompanionJourneyDefinition = {
  id: 'feastle-meaningful-meals',
  version: 1,
  familyId: 'feastle',
  title: 'Meaningful meals',
  introduction: 'Notice what makes food feel nourishing, enjoyable, or connecting, then create more of those meals.',
  conversationTitle: 'Choose what food should bring',
  conversationStartLabel: 'Explore a food direction',
  startNodeId: 'meal-meaning',
  nodes: [
    {
      id: 'meal-meaning',
      kind: 'single_choice',
      prompt: 'What would you like more of around food?',
      helperText: 'This is about lived meals, not perfect nutrition.',
      options: [
        { id: 'ease', label: 'Meals that feel easier', nextNodeId: 'meal-friction' },
        { id: 'care', label: 'Food that feels caring', nextNodeId: 'meal-friction' },
        { id: 'connection', label: 'More shared meals', nextNodeId: 'meal-friction' },
        { id: 'curiosity', label: 'More variety and curiosity', nextNodeId: 'meal-friction' },
      ],
    },
    {
      id: 'meal-friction',
      kind: 'single_choice',
      prompt: 'What most often gets in the way?',
      helperText: 'Choose the closest pattern; Feastle will keep the next step small.',
      options: [
        { id: 'time', label: 'Time or planning', nextNodeId: 'meal-goal' },
        { id: 'energy', label: 'Energy to prepare food', nextNodeId: 'meal-goal' },
        { id: 'routine', label: 'I fall into the same routine', nextNodeId: 'meal-goal' },
        { id: 'rushing', label: 'Meals feel rushed or distracted', nextNodeId: 'meal-goal' },
      ],
    },
    {
      id: 'meal-goal',
      kind: 'single_choice',
      createsGoalTypeId: 'meal-rhythm',
      prompt: 'What food direction would feel good to practise?',
      helperText: 'Pick one small direction, or write your own.',
      options: [
        { id: 'simple-cooking', label: 'Cook something simple more often', goalTitle: 'Make simple cooking easier to return to', suggestedQuickGoalIds: ['feastle:make-one-thing', 'feastle:weekday-cook', 'feastle:plan-meal'], nextNodeId: null },
        { id: 'intentional-meal', label: 'Give one meal my full attention', goalTitle: 'Make one daily meal feel intentional', suggestedQuickGoalIds: ['feastle:eat-without-rushing', 'feastle:sit-for-meal'], nextNodeId: null },
        { id: 'shared-food', label: 'Share food more often', goalTitle: 'Create more moments around shared food', suggestedQuickGoalIds: ['feastle:share-food', 'feastle:plan-meal'], nextNodeId: null },
        { id: 'new-flavours', label: 'Try unfamiliar food', goalTitle: 'Make room for new flavours', suggestedQuickGoalIds: ['feastle:try-flavour', 'feastle:add-colour'], nextNodeId: null },
      ],
      allowCustomText: true,
      nextNodeId: null,
    },
  ],
  goalTypes: {
    'meal-rhythm': { label: 'Meal rhythm', fallbackTitle: 'Create more meaningful meals' },
  },
  checkIn: {
    prompt: 'What mattered about food today?',
    options: [
      { id: 'made', label: 'I made or prepared something' },
      { id: 'shared', label: 'I shared food with someone' },
      { id: 'noticed', label: 'I slowed down enough to notice the meal' },
      { id: 'new', label: 'I tried something different' },
      { id: 'other', label: 'Something else' },
    ],
  },
  stages: [
    { id: 'choose', title: 'Choose what matters', description: 'Decide what you want meals to bring into your life.', requirement: { kind: 'goal_created', target: 1 } },
    { id: 'taste', title: 'Gather meal moments', description: 'Share three real moments around food.', requirement: { kind: 'quest_completions', target: 3 } },
    { id: 'review', title: 'Read the pattern', description: 'Reflect on which meals felt most worthwhile.', requirement: { kind: 'reflections', target: 1 } },
    { id: 'decide', title: 'Choose what continues', description: 'Keep, reshape, pause, or complete this food goal.', requirement: { kind: 'goal_resolved', target: 1 } },
  ],
  reflectionPrompts: {
    choose: 'What would make food feel more supportive or meaningful right now?',
    taste: 'Did any meal today support “{goal}”? Notice what made that moment possible.',
    review: 'Across your recent meal moments, what made “{goal}” feel natural rather than forced?',
    decide: 'What should happen next with “{goal}”: keep it, simplify it, reshape it, or call it complete?',
  },
};

const pagelet: CompanionJourneyDefinition = {
  id: 'pagelet-living-curiosity',
  version: 1,
  familyId: 'pagelet',
  title: 'Living curiosity',
  introduction: 'Choose a curiosity worth returning to, then turn reading and learning into ideas you can keep.',
  conversationTitle: 'Follow a useful curiosity',
  conversationStartLabel: 'Choose a learning direction',
  startNodeId: 'learning-shape',
  nodes: [
    {
      id: 'learning-shape',
      kind: 'single_choice',
      prompt: 'What kind of learning do you want more of?',
      helperText: 'Choose the shape that sounds inviting now.',
      options: [
        { id: 'book', label: 'Finishing or enjoying a book', nextNodeId: 'learning-friction' },
        { id: 'subject', label: 'Understanding a subject', nextNodeId: 'learning-friction' },
        { id: 'skill', label: 'Learning a practical skill', nextNodeId: 'learning-friction' },
        { id: 'ideas', label: 'Keeping ideas that inspire me', nextNodeId: 'learning-friction' },
      ],
    },
    {
      id: 'learning-friction',
      kind: 'single_choice',
      prompt: 'What usually interrupts that curiosity?',
      helperText: 'Pagelet will favour a direction that works with your real attention.',
      options: [
        { id: 'time', label: 'Finding time', nextNodeId: 'learning-goal' },
        { id: 'attention', label: 'My attention gets pulled elsewhere', nextNodeId: 'learning-goal' },
        { id: 'choice', label: 'I do not know where to start', nextNodeId: 'learning-goal' },
        { id: 'retention', label: 'Ideas disappear after I read them', nextNodeId: 'learning-goal' },
      ],
    },
    {
      id: 'learning-goal',
      kind: 'single_choice',
      createsGoalTypeId: 'curiosity',
      prompt: 'What direction would you like Pagelet to remember?',
      helperText: 'Pick a low-friction experiment, or write your own.',
      options: [
        { id: 'reading-rhythm', label: 'Read a little most days', goalTitle: 'Build a small, steady reading rhythm', suggestedQuickGoalIds: ['pagelet:read-five-pages', 'pagelet:read-ten-minutes'], nextNodeId: null },
        { id: 'finish-book', label: 'Return to and finish a book', goalTitle: 'Return to the book I want to finish', suggestedQuickGoalIds: ['pagelet:return-to-book', 'pagelet:phone-for-book'], nextNodeId: null },
        { id: 'understand-topic', label: 'Understand one topic better', goalTitle: 'Follow one question until I understand it better', suggestedQuickGoalIds: ['pagelet:look-up-question', 'pagelet:weekday-learning'], nextNodeId: null },
        { id: 'keep-ideas', label: 'Keep and use what I learn', goalTitle: 'Keep the ideas that matter to me', suggestedQuickGoalIds: ['pagelet:keep-one-idea', 'pagelet:share-one-idea'], nextNodeId: null },
      ],
      allowCustomText: true,
      nextNodeId: null,
    },
  ],
  goalTypes: {
    curiosity: { label: 'Curiosity', fallbackTitle: 'Follow a useful curiosity' },
  },
  checkIn: {
    prompt: 'What happened with your curiosity today?',
    options: [
      { id: 'read', label: 'I spent time reading or learning' },
      { id: 'idea', label: 'I found an idea worth keeping' },
      { id: 'question', label: 'A new question appeared' },
      { id: 'shared', label: 'I shared or used something I learned' },
      { id: 'other', label: 'Something else' },
    ],
  },
  stages: [
    { id: 'choose', title: 'Choose a curiosity', description: 'Name what you want to understand or return to.', requirement: { kind: 'goal_created', target: 1 } },
    { id: 'learn', title: 'Follow the thread', description: 'Share three real reading or learning moments.', requirement: { kind: 'quest_completions', target: 3 } },
    { id: 'review', title: 'Keep what matters', description: 'Reflect on the ideas and questions that stayed.', requirement: { kind: 'reflections', target: 1 } },
    { id: 'decide', title: 'Choose what continues', description: 'Keep, reshape, pause, or complete this learning goal.', requirement: { kind: 'goal_resolved', target: 1 } },
  ],
  reflectionPrompts: {
    choose: 'What are you genuinely curious about, without needing it to be useful?',
    learn: 'What did you read, learn, or question today that supported “{goal}”?',
    review: 'Across your recent learning moments, which idea or question around “{goal}” is still alive?',
    decide: 'What should happen next with “{goal}”: go deeper, change direction, pause, or call this chapter complete?',
  },
};

const mossprout: CompanionJourneyDefinition = {
  id: 'mossprout-nearby-nature',
  version: 1,
  familyId: 'mossprout',
  title: 'Nearby nature',
  introduction: 'Build a relationship with ordinary green places and notice how returning outside changes the shape of a day.',
  conversationTitle: 'Grow an outdoor rhythm',
  conversationStartLabel: 'Choose a nature direction',
  startNodeId: 'nature-need',
  nodes: [
    {
      id: 'nature-need',
      kind: 'single_choice',
      prompt: 'What would you like nearby nature to give you?',
      helperText: 'A park, garden, tree-lined street, balcony, or patch of grass all count.',
      options: [
        { id: 'pause', label: 'A restorative pause', nextNodeId: 'nature-place' },
        { id: 'attention', label: 'More attention to the living world', nextNodeId: 'nature-place' },
        { id: 'routine', label: 'A reason to get outside', nextNodeId: 'nature-place' },
        { id: 'care', label: 'Something living to care for', nextNodeId: 'nature-place' },
      ],
    },
    {
      id: 'nature-place',
      kind: 'single_choice',
      prompt: 'Where is that most possible for you?',
      helperText: 'Choose the most accessible place, not the most impressive.',
      options: [
        { id: 'park', label: 'A nearby park or green', nextNodeId: 'nature-goal' },
        { id: 'street', label: 'My street or daily route', nextNodeId: 'nature-goal' },
        { id: 'garden', label: 'A garden, balcony, or windowsill', nextNodeId: 'nature-goal' },
        { id: 'varied', label: 'Different outdoor places', nextNodeId: 'nature-goal' },
      ],
    },
    {
      id: 'nature-goal',
      kind: 'single_choice',
      createsGoalTypeId: 'outdoor-rhythm',
      prompt: 'What outdoor direction feels realistic now?',
      helperText: 'Pick something that can survive an ordinary week, or write your own.',
      options: [
        { id: 'daily-outside', label: 'Step outside every day', goalTitle: 'Build a small daily outdoor pause', suggestedQuickGoalIds: ['mossprout:step-outside', 'mossprout:notice-living-thing'], nextNodeId: null },
        { id: 'green-place', label: 'Return to a nearby green place', goalTitle: 'Build a relationship with one nearby green place', suggestedQuickGoalIds: ['mossprout:visit-green', 'mossprout:same-place'], nextNodeId: null },
        { id: 'notice-season', label: 'Notice the season changing', goalTitle: 'Pay attention to small seasonal changes', suggestedQuickGoalIds: ['mossprout:season-change', 'mossprout:notice-living-thing'], nextNodeId: null },
        { id: 'care-plant', label: 'Care for something growing', goalTitle: 'Create a gentle plant-care rhythm', suggestedQuickGoalIds: ['mossprout:care-for-plant', 'mossprout:sit-outside'], nextNodeId: null },
      ],
      allowCustomText: true,
      nextNodeId: null,
    },
  ],
  goalTypes: {
    'outdoor-rhythm': { label: 'Outdoor rhythm', fallbackTitle: 'Grow a nearby nature rhythm' },
  },
  checkIn: {
    prompt: 'What did you notice outside today?',
    options: [
      { id: 'paused', label: 'Being outside changed my pace' },
      { id: 'living', label: 'I noticed something living' },
      { id: 'returned', label: 'I returned to a familiar place' },
      { id: 'cared', label: 'I cared for something growing' },
      { id: 'other', label: 'Something else' },
    ],
  },
  stages: [
    { id: 'choose', title: 'Choose a place', description: 'Decide what nearby nature could add to your days.', requirement: { kind: 'goal_created', target: 1 } },
    { id: 'return', title: 'Return outside', description: 'Share three real moments with nearby nature.', requirement: { kind: 'quest_completions', target: 3 } },
    { id: 'review', title: 'Notice the change', description: 'Reflect on places, attention, and seasonal change.', requirement: { kind: 'reflections', target: 1 } },
    { id: 'decide', title: 'Choose what continues', description: 'Keep, reshape, pause, or complete this nature goal.', requirement: { kind: 'goal_resolved', target: 1 } },
  ],
  reflectionPrompts: {
    choose: 'What could an ordinary nearby outdoor place give you right now?',
    return: 'What did you notice outside today that supported “{goal}”?',
    review: 'Across your recent outdoor moments, how did returning to “{goal}” affect your attention or mood?',
    decide: 'What should happen next with “{goal}”: keep returning, try a new place, pause, or call it complete?',
  },
};

const sleepRest: CompanionJourneyDefinition = {
  id: 'sleep-rest-gentle-recovery',
  version: 1,
  familyId: 'sleep-rest',
  title: 'Gentle recovery',
  introduction: 'Learn what genuinely restores you, then build a kinder rhythm for stopping, sleeping, and recovering.',
  conversationTitle: 'Find the rest you need',
  conversationStartLabel: 'Choose a rest direction',
  startNodeId: 'rest-need',
  nodes: [
    {
      id: 'rest-need',
      kind: 'single_choice',
      prompt: 'What kind of rest feels most missing right now?',
      helperText: 'Rest is broader than sleep. Pick the kind that would make ordinary life feel more sustainable.',
      options: [
        { id: 'sleep', label: 'A steadier sleep rhythm', nextNodeId: 'sleep-goal' },
        { id: 'wind-down', label: 'A gentler wind-down', nextNodeId: 'wind-down-goal' },
        { id: 'recovery', label: 'Recovery after demanding days', nextNodeId: 'recovery-goal' },
        { id: 'downtime', label: 'Downtime that restores me', nextNodeId: 'downtime-goal' },
        { id: 'permission', label: 'Permission to stop', nextNodeId: 'boundary-goal' },
      ],
    },
    {
      id: 'sleep-goal',
      kind: 'free_text',
      createsGoalTypeId: 'sleep-rhythm',
      suggestedQuickGoalIds: ['sleep-rest:chosen-bedtime', 'sleep-rest:phone-away'],
      prompt: 'What would a kinder, more workable sleep rhythm look like?',
      helperText: 'Describe a direction you can notice without demanding perfect nights.',
      nextNodeId: 'rest-friction',
    },
    {
      id: 'wind-down-goal',
      kind: 'free_text',
      createsGoalTypeId: 'wind-down',
      suggestedQuickGoalIds: ['sleep-rest:phone-away', 'sleep-rest:gentler-night'],
      prompt: 'What would help your mind or body recognise that the day is ending?',
      helperText: 'Choose a small ritual or boundary you could repeat.',
      nextNodeId: 'rest-friction',
    },
    {
      id: 'recovery-goal',
      kind: 'free_text',
      createsGoalTypeId: 'recovery',
      suggestedQuickGoalIds: ['sleep-rest:ten-minute-rest', 'sleep-rest:recovery-break'],
      prompt: 'What would recovering well after a demanding day mean for you?',
      helperText: 'It can involve sleep, stillness, comfort, lower expectations, or asking for help.',
      nextNodeId: 'rest-friction',
    },
    {
      id: 'downtime-goal',
      kind: 'free_text',
      createsGoalTypeId: 'restorative-downtime',
      suggestedQuickGoalIds: ['sleep-rest:ten-minute-rest', 'sleep-rest:gentler-night'],
      prompt: 'What kind of downtime tends to leave you more restored?',
      helperText: 'Name what you want to make room for, not what rest is supposed to look like.',
      nextNodeId: 'rest-friction',
    },
    {
      id: 'boundary-goal',
      kind: 'free_text',
      createsGoalTypeId: 'rest-boundary',
      suggestedQuickGoalIds: ['sleep-rest:stop-work', 'sleep-rest:recovery-break'],
      prompt: 'What could you stop carrying into your rest time?',
      helperText: 'A boundary can be about work, chores, screens, availability, or your own expectations.',
      nextNodeId: 'rest-friction',
    },
    {
      id: 'rest-friction',
      kind: 'single_choice',
      prompt: 'What most often makes that difficult?',
      helperText: 'This helps shape the questions your rest companion asks later.',
      options: [
        { id: 'time', label: 'There never seems to be time', nextNodeId: null },
        { id: 'switching-off', label: 'I struggle to switch off', nextNodeId: null },
        { id: 'responsibility', label: 'Other people or responsibilities need me', nextNodeId: null },
        { id: 'screens', label: 'Screens keep pulling me back', nextNodeId: null },
        { id: 'guilt', label: 'Rest can feel undeserved', nextNodeId: null },
      ],
    },
  ],
  goalTypes: {
    'sleep-rhythm': { label: 'Sleep rhythm', fallbackTitle: 'Build a kinder sleep rhythm' },
    'wind-down': { label: 'Wind-down', fallbackTitle: 'Create a gentler end to the day' },
    'recovery': { label: 'Recovery', fallbackTitle: 'Recover after demanding days' },
    'restorative-downtime': { label: 'Downtime', fallbackTitle: 'Make room for restorative downtime' },
    'rest-boundary': { label: 'Boundary', fallbackTitle: 'Protect time to stop and rest' },
  },
  checkIn: {
    prompt: 'What did you notice about rest today?',
    options: [
      { id: 'restored', label: 'Something genuinely restored me' },
      { id: 'stopped', label: 'I stopped when I needed to' },
      { id: 'pushed-through', label: 'I pushed past my need for rest' },
      { id: 'boundary', label: 'A boundary helped or got tested' },
      { id: 'other', label: 'Something else' },
    ],
  },
  stages: [
    { id: 'choose', title: 'Choose what restores', description: 'Name the kind of rest you want to protect.', requirement: { kind: 'goal_created', target: 1 } },
    { id: 'practice', title: 'Practise gently', description: 'Share three real moments of rest or recovery.', requirement: { kind: 'quest_completions', target: 3 } },
    { id: 'review', title: 'Notice the pattern', description: 'Reflect on what actually helped you recover.', requirement: { kind: 'reflections', target: 1 } },
    { id: 'decide', title: 'Choose what continues', description: 'Keep, reshape, pause, or complete this rest goal.', requirement: { kind: 'goal_resolved', target: 1 } },
  ],
  reflectionPrompts: {
    choose: 'What would feeling genuinely restored look like in your life right now?',
    practice: 'Did anything today support “{goal}”? Notice what restored you without grading how well you rested.',
    review: 'Looking across the moments around “{goal}”, what actually helped—and what only looked like rest?',
    decide: 'What should happen next with “{goal}”: protect it, make it gentler, pause it, or call this chapter complete?',
  },
};

const tasklet: CompanionJourneyDefinition = {
  id: 'tasklet-focus-journey',
  version: 1,
  familyId: 'tasklet',
  title: 'Meaningful momentum',
  introduction: 'Turn something that matters into a direction you can revisit, move, and reshape over time.',
  conversationTitle: 'Choose what deserves attention',
  conversationStartLabel: 'Plan something with Tasklet',
  startNodeId: 'attention',
  nodes: [
    {
      id: 'attention',
      kind: 'single_choice',
      prompt: 'What deserves your attention right now?',
      helperText: 'Pick the closest shape. Tasklet will ask a more useful follow-up.',
      options: [
        { id: 'project', label: 'A project', nextNodeId: 'project-goal' },
        { id: 'routine', label: 'A recurring responsibility', nextNodeId: 'routine-goal' },
        { id: 'learning', label: 'Something I am learning', nextNodeId: 'learning-goal' },
        { id: 'reset', label: 'A pile of unfinished tasks', nextNodeId: 'reset-goal' },
        { id: 'clarity', label: 'I am not sure yet', nextNodeId: 'clarity-goal' },
      ],
    },
    {
      id: 'project-goal',
      kind: 'free_text',
      createsGoalTypeId: 'project',
      suggestedQuickGoalIds: ['tasklet:next-action', 'tasklet:ten-minutes', 'tasklet:focus-block'],
      prompt: 'What outcome would make this project feel meaningfully further along?',
      helperText: 'Name an outcome you can recognise, not every step required.',
      nextNodeId: 'friction',
    },
    {
      id: 'routine-goal',
      kind: 'free_text',
      createsGoalTypeId: 'routine',
      suggestedQuickGoalIds: ['tasklet:next-action', 'tasklet:clear-three', 'tasklet:tomorrow-first'],
      prompt: 'What would “handled consistently” look like for this responsibility?',
      helperText: 'A simple rhythm is enough; it does not need to be perfect.',
      nextNodeId: 'friction',
    },
    {
      id: 'learning-goal',
      kind: 'free_text',
      createsGoalTypeId: 'learning',
      suggestedQuickGoalIds: ['tasklet:next-action', 'tasklet:ten-minutes'],
      prompt: 'What would you like to be able to understand or do?',
      helperText: 'Choose a useful next capability rather than an endless subject.',
      nextNodeId: 'friction',
    },
    {
      id: 'reset-goal',
      kind: 'free_text',
      createsGoalTypeId: 'reset',
      suggestedQuickGoalIds: ['tasklet:clear-three', 'tasklet:small-task'],
      prompt: 'What would feel lighter if it were cleared or closed?',
      helperText: 'Name the area you want to bring back under control.',
      nextNodeId: 'friction',
    },
    {
      id: 'clarity-goal',
      kind: 'free_text',
      createsGoalTypeId: 'clarity',
      suggestedQuickGoalIds: ['tasklet:next-action', 'tasklet:ten-minutes'],
      prompt: 'What question would you like a little more clarity about?',
      helperText: 'Tasklet can help you investigate before asking you to commit.',
      nextNodeId: 'friction',
    },
    {
      id: 'friction',
      kind: 'single_choice',
      prompt: 'What is most likely to get in the way?',
      helperText: 'This answer can shape later reflections and quest recommendations.',
      options: [
        { id: 'unclear', label: 'The next step is unclear', nextNodeId: null },
        { id: 'time', label: 'Protecting time', nextNodeId: null },
        { id: 'energy', label: 'Energy or motivation', nextNodeId: null },
        { id: 'too-much', label: 'It feels too large', nextNodeId: null },
        { id: 'distraction', label: 'Distractions', nextNodeId: null },
      ],
    },
  ],
  goalTypes: {
    project: { label: 'Project', fallbackTitle: 'Move a meaningful project forward' },
    routine: { label: 'Responsibility', fallbackTitle: 'Build a workable rhythm' },
    learning: { label: 'Learning', fallbackTitle: 'Learn something useful' },
    reset: { label: 'Reset', fallbackTitle: 'Clear unfinished work' },
    clarity: { label: 'Clarity', fallbackTitle: 'Find the next direction' },
  },
  checkIn: {
    prompt: 'What happened with this direction today?',
    options: [
      { id: 'moved-forward', label: 'I moved it forward' },
      { id: 'next-step', label: 'I found the next step' },
      { id: 'blocked', label: 'I noticed what blocked me' },
      { id: 'changed-course', label: 'I changed the plan deliberately' },
      { id: 'other', label: 'Something else' },
    ],
  },
  stages: [
    { id: 'define', title: 'Define', description: 'Choose a direction worth remembering.', requirement: { kind: 'goal_created', target: 1 } },
    { id: 'momentum', title: 'Build momentum', description: 'Share three real moments of progress.', requirement: { kind: 'quest_completions', target: 3 } },
    { id: 'review', title: 'Review', description: 'Reflect on what is helping or blocking you.', requirement: { kind: 'reflections', target: 1 } },
    { id: 'decide', title: 'Decide', description: 'Complete, pause, or consciously leave the goal.', requirement: { kind: 'goal_resolved', target: 1 } },
  ],
  reflectionPrompts: {
    define: 'What currently deserves your attention, and why does it matter?',
    momentum: 'What moved “{goal}” forward today, however slightly—and what is the next visible step?',
    review: 'Looking across your recent work on “{goal}”, what is helping and what keeps creating friction?',
    decide: 'Does “{goal}” still deserve your attention in its current form? Keep it, reshape it, pause it, or call it complete.',
  },
};

const vesperitt: CompanionJourneyDefinition = {
  id: 'vesperitt-intentional-nights',
  version: 2,
  familyId: 'vesperitt',
  title: 'Intentional small hours',
  introduction: 'Understand what your late nights contain, then protect what matters or gently change what does not.',
  conversationTitle: 'Understand your nights',
  conversationStartLabel: 'Explore a night pattern',
  startNodeId: 'night-content',
  nodes: [
    {
      id: 'night-content',
      kind: 'single_choice',
      prompt: 'What usually fills your late nights?',
      helperText: 'There is no ideal answer. This is about recognising the pattern you actually live.',
      options: [
        { id: 'making', label: 'Making or learning', nextNodeId: 'intention' },
        { id: 'work', label: 'Work or study', nextNodeId: 'intention' },
        { id: 'social', label: 'Time with people', nextNodeId: 'intention' },
        { id: 'entertainment', label: 'Entertainment', nextNodeId: 'intention' },
        { id: 'scrolling', label: 'Accidental scrolling', nextNodeId: 'intention' },
        { id: 'quiet', label: 'Quiet time alone', nextNodeId: 'intention' },
      ],
    },
    {
      id: 'intention',
      kind: 'single_choice',
      prompt: 'How intentional do those nights usually feel?',
      helperText: 'Vesperitt is interested in choice, not in judging the hour.',
      options: [
        { id: 'chosen', label: 'Mostly chosen', nextNodeId: 'protect-goal' },
        { id: 'mixed', label: 'A mixture', nextNodeId: 'understand-goal' },
        { id: 'accidental', label: 'Mostly accidental', nextNodeId: 'shift-goal' },
      ],
    },
    {
      id: 'protect-goal',
      kind: 'single_choice',
      createsGoalTypeId: 'protect',
      prompt: 'What would you like to protect or make room for after dark?',
      helperText: 'Choose a direction now. You can write your own if none feels quite right.',
      options: [
        { id: 'creative-time', label: 'Creative or learning time', goalTitle: 'Protect creative or learning time after dark', suggestedQuickGoalIds: ['vesperitt:choose-tonight', 'vesperitt:chosen-activity'], nextNodeId: null },
        { id: 'quiet-time', label: 'Quiet time alone', goalTitle: 'Make room for quiet time after dark', suggestedQuickGoalIds: ['vesperitt:choose-tonight', 'vesperitt:chosen-activity'], nextNodeId: null },
        { id: 'people-time', label: 'Time with people I care about', goalTitle: 'Protect time with people I care about', suggestedQuickGoalIds: ['vesperitt:choose-tonight', 'vesperitt:chosen-activity'], nextNodeId: null },
        { id: 'evening-ritual', label: 'A favourite evening ritual', goalTitle: 'Keep a favourite evening ritual', suggestedQuickGoalIds: ['vesperitt:choose-tonight', 'vesperitt:evening-ritual'], nextNodeId: null },
      ],
      allowCustomText: true,
      nextNodeId: null,
    },
    {
      id: 'understand-goal',
      kind: 'single_choice',
      createsGoalTypeId: 'understand',
      prompt: 'What pattern would you like to understand or make more deliberate?',
      helperText: 'Pick the closest question. This can be an experiment rather than a promise.',
      options: [
        { id: 'chosen-to-drift', label: 'When a chosen night turns into drift', goalTitle: 'Notice when and why a chosen night turns into drift', suggestedQuickGoalIds: ['vesperitt:choose-tonight', 'vesperitt:end-planned', 'vesperitt:next-morning'], nextNodeId: null },
        { id: 'late-work-effect', label: 'How late work affects the next day', goalTitle: 'Notice how late work affects the next day', suggestedQuickGoalIds: ['vesperitt:finish-late-work', 'vesperitt:next-morning'], nextNodeId: null },
        { id: 'stopping-cues', label: 'What helps me stop when I mean to', goalTitle: 'Learn what helps me stop when I mean to', suggestedQuickGoalIds: ['vesperitt:end-planned', 'vesperitt:next-morning'], nextNodeId: null },
        { id: 'worthwhile-nights', label: 'Which late nights are actually worth it', goalTitle: 'Notice which late nights feel worth it', suggestedQuickGoalIds: ['vesperitt:choose-tonight', 'vesperitt:chosen-activity', 'vesperitt:next-morning'], nextNodeId: null },
      ],
      allowCustomText: true,
      nextNodeId: null,
    },
    {
      id: 'shift-goal',
      kind: 'single_choice',
      createsGoalTypeId: 'shift',
      prompt: 'What would you like to change gently about those nights?',
      helperText: 'Choose a small boundary or replacement, or write one that fits you better.',
      options: [
        { id: 'one-more-stop', label: 'Stop after one episode or game', suggestedQuickGoalIds: ['vesperitt:one-more-stop', 'vesperitt:choose-tonight'], nextNodeId: null },
        { id: 'phone-away', label: 'Put my phone away at a set time', suggestedQuickGoalIds: ['vesperitt:phone-away', 'vesperitt:choose-tonight'], nextNodeId: null },
        { id: 'work-earlier', label: 'Move late work a little earlier', suggestedQuickGoalIds: ['vesperitt:finish-late-work', 'vesperitt:next-morning'], nextNodeId: null },
        { id: 'calmer-replacement', label: 'Replace scrolling with something calming', suggestedQuickGoalIds: ['vesperitt:calmer-replacement', 'vesperitt:phone-away'], nextNodeId: null },
      ],
      allowCustomText: true,
      nextNodeId: null,
    },
  ],
  goalTypes: {
    protect: { label: 'Protect', fallbackTitle: 'Protect a meaningful late night' },
    understand: { label: 'Understand', fallbackTitle: 'Understand a late-night pattern' },
    shift: { label: 'Shift', fallbackTitle: 'Gently change a late-night pattern' },
    boundary: { label: 'Boundary', fallbackTitle: 'Give late work a boundary' },
    reduce: { label: 'Reduce', fallbackTitle: 'Replace accidental scrolling' },
  },
  checkIn: {
    prompt: 'What did you notice about tonight?',
    options: [
      { id: 'intentional', label: 'The night felt intentional' },
      { id: 'drifted', label: 'I drifted later than intended' },
      { id: 'stopped', label: 'I stopped when I meant to' },
      { id: 'next-day-effect', label: 'I noticed the next-day effect' },
      { id: 'other', label: 'Something else' },
    ],
  },
  stages: [
    { id: 'choose', title: 'Choose a direction', description: 'Decide what you want from the small hours.', requirement: { kind: 'goal_created', target: 1 } },
    { id: 'observe', title: 'Observe', description: 'Share three honest late-night moments.', requirement: { kind: 'quest_completions', target: 3 } },
    { id: 'review', title: 'Review', description: 'Notice intention, value, and next-day effects.', requirement: { kind: 'reflections', target: 1 } },
    { id: 'decide', title: 'Decide', description: 'Keep, reshape, pause, or complete the experiment.', requirement: { kind: 'goal_resolved', target: 1 } },
  ],
  reflectionPrompts: {
    choose: 'What would make a late night feel chosen rather than simply happened to you?',
    observe: 'Did tonight support “{goal}”? What did the night give you, and what might it cost tomorrow?',
    review: 'Across the late nights you noticed, when did “{goal}” feel intentional—and when did the pattern take over?',
    decide: 'What should happen next with “{goal}”: protect it, add a boundary, change it gently, or let it go?',
  },
};

export const companionJourneyDefinitions: readonly CompanionJourneyDefinition[] = [
  cheerlet,
  coffeeRitual,
  dawnle,
  encora,
  errandimp,
  feastle,
  flickerbun,
  gatherglow,
  mossprout,
  mendle,
  pagelet,
  quietome,
  relicoon,
  sleepRest,
  skylo,
  steppling,
  tasklet,
  vesperitt,
];

export const companionJourneyByFamilyId = new Map(
  companionJourneyDefinitions.map((definition) => [definition.familyId, definition])
);

export function companionJourneyNode(
  definition: CompanionJourneyDefinition,
  nodeId: string | null
): CompanionJourneyConversationNode | null {
  if (!nodeId) return null;
  return definition.nodes.find((node) => node.id === nodeId) ?? null;
}
