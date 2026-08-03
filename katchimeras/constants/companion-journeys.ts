import type { KatchimeraFamilyId } from '@/types/katchimera';
import { SPECIALIST_COMPANION_SYSTEMS } from '@/constants/specialist-companion-catalogue';

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
  version?: number;
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
    version: config.version ?? 2,
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

function focusedPracticeJourney(config: {
  id: string;
  version?: number;
  familyId: KatchimeraFamilyId;
  title: string;
  introduction: string;
  subject: string;
  firstPrompt: string;
  firstHelperText?: string;
  firstOptions: readonly string[];
  secondPrompt: string;
  secondHelperText?: string;
  secondOptions: readonly string[];
  goalPrompt?: string;
  goalHelperText?: string;
  checkInOptions?: readonly CompanionJourneyCheckInOption[];
  directions: readonly { label: string; goalTitle: string; quickGoals: readonly string[] }[];
}): CompanionJourneyDefinition {
  const slug = config.familyId;
  return threeQuestionJourney({
    id: config.id,
    version: config.version,
    familyId: config.familyId,
    title: config.title,
    introduction: config.introduction,
    conversationTitle: `Choose your ${config.subject} direction`,
    conversationStartLabel: `Explore ${config.subject}`,
    first: {
      id: `${slug}-meaning`,
      prompt: config.firstPrompt,
      helperText: config.firstHelperText ?? 'Choose what feels most useful in your life now.',
      options: config.firstOptions.map((label, index) => ({ id: `meaning-${index + 1}`, label })),
    },
    second: {
      id: `${slug}-friction`,
      prompt: config.secondPrompt,
      helperText: config.secondHelperText ?? 'Choose the closest pattern, not a perfect description.',
      options: config.secondOptions.map((label, index) => ({ id: `friction-${index + 1}`, label })),
    },
    goal: {
      id: `${slug}-goal`,
      typeId: `${slug}-direction`,
      typeLabel: `${config.title} direction`,
      fallbackTitle: config.title,
      prompt: config.goalPrompt ?? `What ${config.subject} direction would you like to build?`,
      helperText: config.goalHelperText ?? 'Pick the closest low-friction direction.',
      options: config.directions.map((direction, index) => ({
        id: `direction-${index + 1}`,
        label: direction.label,
        goalTitle: direction.goalTitle,
        suggestedQuickGoalIds: direction.quickGoals,
      })),
    },
    checkInPrompt: `What happened with ${config.subject} today?`,
    checkInOptions: config.checkInOptions ?? [
      { id: 'showed-up', label: 'I showed up' },
      { id: 'noticed', label: 'I noticed a useful detail' },
      { id: 'adjusted', label: 'I made an adjustment' },
      { id: 'connected', label: 'The moment felt connecting' },
      { id: 'other', label: 'Something else' },
    ],
    practiceTitle: 'Build real moments',
    practiceDescription: `Share three real ${config.subject} moments.`,
    reflectionSubject: config.subject,
  });
}

const flexel = focusedPracticeJourney({
  id: 'flexel-stronger-rhythm', version: 3, familyId: 'flexel', title: 'A stronger rhythm',
  introduction: 'Build an adaptable strength, gym, or mobility practice around your body, access, recovery, and ordinary life—not comparison or pushing through symptoms.',
  subject: 'training', firstPrompt: 'What would you most like training to give you?',
  firstHelperText: 'Choose what matters to you. Appearance, heavier loads, and harder sessions are not assumed goals.',
  firstOptions: ['Useful strength', 'Enjoyable movement or energy', 'Confidence in my own practice', 'Mobility or everyday function', 'A supported way to begin'],
  secondPrompt: 'What most affects whether training fits?',
  secondHelperText: 'Pain, symptoms, access, uncertainty, and recovery needs are real constraints—not failures of motivation.',
  secondOptions: ['Finding time or access', 'Knowing what suits my body', 'Confidence or belonging', 'Pain, fatigue, or recovery', 'Equipment or support needs'],
  goalHelperText: 'Choose an adaptable direction. Reducing, changing, resting, or getting appropriate guidance can all belong in the Focus.',
  directions: [
    { label: 'Find a repeatable, flexible rhythm', goalTitle: 'Build a flexible training rhythm that suits my capacity', quickGoals: ['flexel:show-up', 'flexel:weekday-training'] },
    { label: 'Build useful strength gradually', goalTitle: 'Explore gradual strength progress without comparison', quickGoals: ['flexel:one-exercise', 'flexel:record-set'] },
    { label: 'Learn a safe-feeling adaptation or technique', goalTitle: 'Learn adaptations and technique that suit my body', quickGoals: ['flexel:warm-up', 'flexel:form-cue'] },
    { label: 'Protect mobility and recovery', goalTitle: 'Make mobility and recovery part of training', quickGoals: ['flexel:mobility-five', 'flexel:recovery-choice'] },
  ],
  checkInOptions: [
    { id: 'trained', label: 'I trained in a way that suited me' },
    { id: 'adapted', label: 'I adapted or reduced something' },
    { id: 'recovered', label: 'I chose recovery or rest' },
    { id: 'stopped', label: 'I stopped when needed' },
    { id: 'none', label: 'Training did not fit today' },
  ],
});
const sprintail = focusedPracticeJourney({
  id: 'sprintail-running-rhythm', version: 3, familyId: 'sprintail', title: 'A running rhythm',
  introduction: 'Explore running or run-walk practice through enjoyment, sustainable effort, routes, and recovery. Pace, distance, frequency, and running itself are always optional.',
  subject: 'running', firstPrompt: 'What would you most like running to give you?',
  firstHelperText: 'Choose your reason rather than an outside performance standard.',
  firstOptions: ['Headspace or enjoyment', 'Sustainable endurance', 'Learning about pace', 'A flexible rhythm', 'Connection to a route or people'],
  secondPrompt: 'What most affects whether running fits?',
  secondHelperText: 'Pain, symptoms, route safety, weather, access, and recovery are valid reasons to adapt or not run.',
  secondOptions: ['Starting or finding time', 'Pacing or expectations', 'Route, weather, or access', 'Pain, fatigue, or recovery', 'Running does not fit right now'],
  goalHelperText: 'Choose a low-pressure experiment. Walking intervals, stopping, recovery, and pausing the Focus are valid.',
  directions: [
    { label: 'Find a realistic running rhythm', goalTitle: 'Build a flexible running or run-walk rhythm', quickGoals: ['sprintail:shoes-on', 'sprintail:weekday-run'] },
    { label: 'Explore endurance gently', goalTitle: 'Explore sustainable endurance with permission to slow or stop', quickGoals: ['sprintail:ten-minute-run', 'sprintail:easy-pace'] },
    { label: 'Understand my pace', goalTitle: 'Learn what a sustainable pace feels like', quickGoals: ['sprintail:easy-pace', 'sprintail:finish-feeling'] },
    { label: 'Enjoy routes and recovery', goalTitle: 'Make running routes and recovery more supportive', quickGoals: ['sprintail:route-ready', 'sprintail:recovery'] },
  ],
  checkInOptions: [
    { id: 'ran', label: 'I ran or used run-walk intervals' },
    { id: 'adapted', label: 'I slowed, shortened, or changed it' },
    { id: 'enjoyed', label: 'Something felt enjoyable or connecting' },
    { id: 'recovered', label: 'I chose recovery or no run' },
    { id: 'stopped', label: 'I stopped when needed' },
  ],
});
const hooplet = focusedPracticeJourney({
  id: 'hooplet-court-rhythm', version: 3, familyId: 'hooplet', title: 'Court confidence',
  introduction: 'Explore basketball through skill, fun, accessible practice, and shared play. Competition, full-court movement, and public court time are optional.',
  subject: 'basketball', firstPrompt: 'What draws you onto the court?',
  firstHelperText: 'This can include solo, cooperative, wheelchair, adapted, recreational, or competitive basketball.',
  firstOptions: ['Learning a skill', 'Competition', 'Teamwork or belonging', 'Fun or expression', 'Adapted or solo play'],
  secondPrompt: 'What most affects whether basketball fits?',
  secondHelperText: 'Court access, body needs, equipment, people, and belonging all shape the opportunity to play.',
  secondOptions: ['Court, cost, or transport access', 'Pain, injury, fatigue, or mobility', 'People or a welcoming session', 'Confidence or performance pressure', 'Equipment or adaptation needs'],
  goalHelperText: 'Choose a direction you can adapt. Watching, learning, solo skill work, recovery, and no competition can all count.',
  directions: [
    { label: 'Build a flexible basketball rhythm', goalTitle: 'Build a basketball rhythm that fits my access and capacity', quickGoals: ['hooplet:touch-ball', 'hooplet:court-window'] },
    { label: 'Improve one skill', goalTitle: 'Develop one basketball skill deliberately', quickGoals: ['hooplet:ten-shots', 'hooplet:one-drill'] },
    { label: 'Adapt practice to suit me', goalTitle: 'Find basketball adaptations and practice forms that suit me', quickGoals: ['hooplet:weak-hand', 'hooplet:keep-play'] },
    { label: 'Connect through supportive team play', goalTitle: 'Explore supportive communication and shared basketball play', quickGoals: ['hooplet:team-voice', 'hooplet:defence'] },
  ],
  checkInOptions: [
    { id: 'played', label: 'I played or practised' },
    { id: 'learned', label: 'I watched or learned one detail' },
    { id: 'adapted', label: 'I adapted the setup or movement' },
    { id: 'connected', label: 'Shared play felt supportive' },
    { id: 'none', label: 'Basketball did not fit today' },
  ],
});
const serveling = focusedPracticeJourney({
  id: 'serveling-rally-rhythm', version: 3, familyId: 'serveling', title: 'A steadier rally',
  introduction: 'Explore tennis or racket sport through cooperative rallies, skill, adaptation, and composure. Scoring, competition, standing play, and conventional courts are optional.',
  subject: 'racket practice', firstPrompt: 'What do you enjoy most in racket sport?',
  firstHelperText: 'This can include solo, cooperative, seated, adapted, recreational, or competitive play.',
  firstOptions: ['Cooperative rallies', 'Technique or problem-solving', 'Competition', 'Movement or focus', 'Adapted or solo practice'],
  secondPrompt: 'What most affects whether racket sport fits?',
  secondHelperText: 'Access, body needs, equipment, partners, and performance pressure are all part of the practice context.',
  secondOptions: ['Court, cost, or transport access', 'Pain, injury, fatigue, or mobility', 'A suitable partner or group', 'Match or performance pressure', 'Equipment or adaptation needs'],
  goalHelperText: 'Choose a direction you can adapt. Cooperative hitting, solo practice, slower play, and no scoring are valid.',
  directions: [
    { label: 'Find a flexible practice rhythm', goalTitle: 'Build a racket-practice rhythm that fits my access and capacity', quickGoals: ['serveling:racket-five', 'serveling:court-window'] },
    { label: 'Build a stronger serve', goalTitle: 'Develop a more reliable serve', quickGoals: ['serveling:ten-serves', 'serveling:stroke-focus'] },
    { label: 'Explore cooperative or adapted rallies', goalTitle: 'Build satisfying rallies through adaptation and cooperation', quickGoals: ['serveling:one-rally', 'serveling:footwork'] },
    { label: 'Reset without judging the point', goalTitle: 'Use a steadier reset between points or attempts', quickGoals: ['serveling:between-points', 'serveling:keep-point'] },
  ],
  checkInOptions: [
    { id: 'played', label: 'I played or practised' },
    { id: 'learned', label: 'I noticed one useful detail' },
    { id: 'adapted', label: 'I adapted the setup or movement' },
    { id: 'connected', label: 'Cooperative play felt good' },
    { id: 'none', label: 'Racket sport did not fit today' },
  ],
});
const snuglet = focusedPracticeJourney({
  id: 'snuglet-everyday-care', version: 3, familyId: 'snuglet', title: 'Everyday care',
  introduction: 'Make human caregiving visible while respecting the cared-for person’s dignity and choices and the caregiver’s needs, limits, safety, and right to support.',
  subject: 'caregiving', firstPrompt: 'What part of caring needs more support?',
  firstHelperText: 'Choose the area that feels most pressing. This does not assume all care needs can be solved by you.',
  firstOptions: ['Daily routines', 'Connection or communication', 'Practical or service support', 'Sharing the load', 'My own capacity or safety'],
  secondPrompt: 'What makes care feel hardest right now?',
  secondHelperText: 'Name the constraint without blaming yourself or the person receiving care.',
  secondOptions: ['Too much to hold', 'Unpredictable or changing needs', 'My health, energy, or limits', 'Not enough practical support', 'Systems, cost, or service barriers'],
  goalHelperText: 'Choose what is within your control. Asking, delegating, setting limits, and leaving non-urgent tasks undone are valid.',
  directions: [
    { label: 'Make routines gentler', goalTitle: 'Create one gentler care routine', quickGoals: ['snuglet:prepare-routine', 'snuglet:tomorrow-easier'] },
    { label: 'Protect connection without forcing it', goalTitle: 'Make room for care that respects both people’s needs', quickGoals: ['snuglet:full-attention', 'snuglet:name-good'] },
    { label: 'Share the load', goalTitle: 'Ask for and accept more practical support', quickGoals: ['snuglet:ask-need', 'snuglet:share-load'] },
    { label: 'Protect caregiver capacity', goalTitle: 'Include my needs in the care rhythm', quickGoals: ['snuglet:small-pause', 'snuglet:gentle-boundary'] },
  ],
  checkInOptions: [
    { id: 'care', label: 'A care need was met' },
    { id: 'connected', label: 'There was a connecting moment' },
    { id: 'shared', label: 'I shared or asked for support' },
    { id: 'boundary', label: 'I held or noticed a limit' },
    { id: 'hard', label: 'Care felt hard or unsupported' },
  ],
});
const waglet = focusedPracticeJourney({
  id: 'waglet-shared-routine', version: 3, familyId: 'waglet', title: 'A shared dog rhythm',
  introduction: 'Notice the choice, activity, care, communication, and affection that shape life with a dog. The app can help you observe routines, but it cannot diagnose health or behaviour changes.',
  subject: 'dog companionship', firstPrompt: 'What matters most in life with your dog?',
  firstHelperText: 'Choose what matters in your shared life, including rest and the dog’s ability to opt out.',
  firstOptions: ['Walks or outdoor time', 'Play or enrichment', 'Communication or training', 'Quiet company', 'Care, comfort, or ageing needs'],
  secondPrompt: 'What most affects the shared routine?',
  secondHelperText: 'Health, stress, environment, access, and human capacity can matter more than consistency.',
  secondOptions: ['Time or human capacity', 'Weather, routes, or access', 'The dog’s health, age, or energy', 'Stress, fear, or overstimulation', 'Knowing when to get qualified help'],
  goalHelperText: 'Choose a kind, observable direction. Respect opting out and seek qualified support for concerning changes.',
  directions: [
    { label: 'Make walks or outdoor time suit us', goalTitle: 'Adapt dog walks or outdoor time to our shared needs', quickGoals: ['waglet:present-walk', 'waglet:fresh-route'] },
    { label: 'Offer choice in play and enrichment', goalTitle: 'Build a small dog-play rhythm led by choice', quickGoals: ['waglet:five-play', 'waglet:weekday-routine'] },
    { label: 'Communicate without force', goalTitle: 'Practise clear, reward-based communication', quickGoals: ['waglet:one-cue', 'waglet:notice-signal'] },
    { label: 'Support care and comfort', goalTitle: 'Notice routines and seek appropriate help when needed', quickGoals: ['waglet:care-check', 'waglet:quiet-company'] },
  ],
  checkInOptions: [
    { id: 'shared', label: 'We shared a suitable moment' },
    { id: 'choice', label: 'I followed the dog’s choice' },
    { id: 'adapted', label: 'I adapted the routine' },
    { id: 'space', label: 'The dog needed space or rest' },
    { id: 'help', label: 'A change may need qualified help' },
  ],
});
const whiskit = focusedPracticeJourney({
  id: 'whiskit-gentle-attention', version: 3, familyId: 'whiskit', title: 'Gentle attention',
  introduction: 'Notice the choice, play, preferences, behaviour, comfort, and care that shape life with a cat. The app can help you observe routines, but it cannot diagnose health or behaviour changes.',
  subject: 'cat companionship', firstPrompt: 'What would you like to notice more with your cat?',
  firstHelperText: 'Choose what matters in your shared life, including rest, hiding, and the cat’s ability to opt out.',
  firstOptions: ['Play or enrichment', 'Comfort or safe space', 'Preferences and communication', 'Quiet company', 'Care, health, or ageing needs'],
  secondPrompt: 'What most affects the shared routine?',
  secondHelperText: 'Health, stress, environment, resources, and human capacity can matter more than consistency.',
  secondOptions: ['Time or human capacity', 'Space, noise, or household change', 'The cat’s health, age, or energy', 'Stress, fear, or overstimulation', 'Knowing when to get qualified help'],
  goalHelperText: 'Choose a kind, observable direction. Respect disengagement and seek qualified support for concerning changes.',
  directions: [
    { label: 'Offer choice in play', goalTitle: 'Build a small cat-play rhythm led by choice', quickGoals: ['whiskit:five-play', 'whiskit:follow-curiosity'] },
    { label: 'Support enrichment and safe space', goalTitle: 'Offer enrichment and spaces that suit my cat', quickGoals: ['whiskit:enrichment', 'whiskit:refresh-space'] },
    { label: 'Observe without assuming', goalTitle: 'Notice my cat’s signals while leaving uncertainty open', quickGoals: ['whiskit:notice-preference', 'whiskit:quiet-company'] },
    { label: 'Support care and comfort', goalTitle: 'Keep a gentle routine and seek appropriate help when needed', quickGoals: ['whiskit:care-check', 'whiskit:weekday-routine'] },
  ],
  checkInOptions: [
    { id: 'shared', label: 'We shared a suitable moment' },
    { id: 'choice', label: 'I followed the cat’s choice' },
    { id: 'adapted', label: 'I adapted the routine or space' },
    { id: 'space', label: 'The cat needed space or rest' },
    { id: 'help', label: 'A change may need qualified help' },
  ],
});

const coffeeRitual = threeQuestionJourney({
  id: 'coffee-ritual-intentional-pause',
  version: 3,
  familyId: 'coffee-ritual',
  title: 'An intentional pause',
  introduction: 'Use a familiar drink to mark a beginning, break, comfort, or shared moment without turning the ritual into another task.',
  conversationTitle: 'Shape a small daily ritual',
  conversationStartLabel: 'Choose what the pause is for',
  first: {
    id: 'pause-gift',
    prompt: 'What do you most want this small ritual to give you?',
    helperText: 'Coffee, tea, water, or another drink can be the cue. Choose the experience around it.',
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
    helperText: 'Choose the condition around the pause. Skipping a drink or changing the ritual is always allowed.',
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
    helperText: 'Choose the closest gentle cue.',
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
    { id: 'no-pause', label: 'There was no drink pause today' },
  ],
  practiceTitle: 'Pause on purpose',
  practiceDescription: 'Share three real ritual moments.',
  reflectionSubject: 'daily ritual',
});

const errandimp = threeQuestionJourney({
  id: 'errandimp-lighter-loops',
  version: 3,
  familyId: 'errandimp',
  title: 'Lighter loose ends',
  introduction: 'Choose one practical area to make lighter, while respecting the time, money, access, and energy available to you.',
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
    helperText: 'The constraint may be practical or outside your control. Choose what comes closest.',
    options: [
      { id: 'unclear', label: 'I forget the next practical step' },
      { id: 'batch', label: 'There are too many little things' },
      { id: 'energy', label: 'They feel dull or draining' },
      { id: 'timing', label: 'They depend on the right time or place' },
      { id: 'resources', label: 'Cost, access, or support' },
    ],
  },
  goal: {
    id: 'admin-goal',
    typeId: 'life-admin',
    typeLabel: 'Life admin',
    fallbackTitle: 'Keep practical life lighter',
    prompt: 'What practical rhythm would make life feel lighter?',
    helperText: 'Choose the closest loop you control.',
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
    { id: 'no-capacity', label: 'I had no capacity for practical tasks' },
  ],
  practiceTitle: 'Close small loops',
  practiceDescription: 'Share three real admin or maintenance moments.',
  reflectionSubject: 'practical',
});

const dawnle = threeQuestionJourney({
  id: 'dawnle-kinder-beginnings',
  version: 3,
  familyId: 'dawnle',
  title: 'Kinder beginnings',
  introduction: 'Explore what helps the beginning of your day feel kinder and clearer, whatever time your day starts and whatever responsibilities arrive first.',
  conversationTitle: 'Choose a morning beginning',
  conversationStartLabel: 'Shape the first part of the day',
  first: {
    id: 'morning-need',
    prompt: 'What would you most like from the beginning of your day?',
    helperText: 'This is about the start you actually live, not waking early or performing a perfect routine.',
    options: [
      { id: 'calm', label: 'A less rushed pace' },
      { id: 'light', label: 'Comfortable light or movement' },
      { id: 'clarity', label: 'A clearer first step' },
      { id: 'quiet', label: 'A moment of care or orientation' },
    ],
  },
  second: {
    id: 'morning-friction',
    prompt: 'What most often shapes the start before you can choose it?',
    helperText: 'Choose the closest condition. Some mornings cannot and do not need to be redesigned.',
    options: [
      { id: 'phone', label: 'Messages or my phone' },
      { id: 'rushing', label: 'Work, care, or immediate demands' },
      { id: 'fog', label: 'Fatigue, pain, or not knowing where to begin' },
      { id: 'timing', label: 'My day starts at a different or changing time' },
    ],
  },
  goal: {
    id: 'morning-goal',
    typeId: 'morning-start',
    typeLabel: 'Morning start',
    fallbackTitle: 'Build a kinder morning beginning',
    prompt: 'What beginning would you like to practise?',
    helperText: 'Choose one flexible cue. It can happen whenever your day begins, and you can skip it when capacity is low.',
    options: [
      { id: 'light', label: 'Begin with comfortable light or a drink', goalTitle: 'Begin my day with a comfortable orienting cue', suggestedQuickGoalIds: ['dawnle:open-curtains', 'dawnle:morning-water', 'dawnle:outside-light'] },
      { id: 'phone', label: 'Choose what gets my attention first', goalTitle: 'Choose what gets my attention at the start of the day', suggestedQuickGoalIds: ['dawnle:no-phone-five', 'dawnle:choose-first'] },
      { id: 'simple', label: 'Use one simple first step', goalTitle: 'Use one flexible first step when my day begins', suggestedQuickGoalIds: ['dawnle:weekday-start', 'dawnle:notice-energy'] },
      { id: 'prepare', label: 'Prepare the start the night before', goalTitle: 'Make tomorrow morning easier the night before', suggestedQuickGoalIds: ['dawnle:prepare-night', 'dawnle:choose-first'] },
    ],
  },
  checkInPrompt: 'What set the tone this morning?',
  checkInOptions: [
    { id: 'light', label: 'Light or movement helped' },
    { id: 'calm', label: 'The start felt calmer' },
    { id: 'clear', label: 'I knew the first step' },
    { id: 'adapted', label: 'I adapted the start to my capacity' },
    { id: 'rushed', label: 'Demands shaped the start' },
    { id: 'other', label: 'Something else' },
  ],
  practiceTitle: 'Practise the beginning',
  practiceDescription: 'Share three real morning-start moments.',
  reflectionSubject: 'morning',
});

const mendle = threeQuestionJourney({
  id: 'mendle-gentle-repair',
  version: 3,
  familyId: 'mendle',
  title: 'Gentle repair',
  introduction: 'Meet tender days honestly, lower unnecessary pressure, and notice which everyday supports fit. Mendle does not diagnose, provide crisis care, or replace trusted human or professional support.',
  conversationTitle: 'Choose what support looks like',
  conversationStartLabel: 'Find a gentle recovery direction',
  first: {
    id: 'tender-need',
    prompt: 'What is hardest on a tender day?',
    helperText: 'Choose what needs support, not what you think should be fixed or improved quickly.',
    options: [
      { id: 'name', label: 'Naming what I feel' },
      { id: 'pressure', label: 'Lowering expectations' },
      { id: 'kindness', label: 'Being fair to myself' },
      { id: 'support', label: 'Letting someone know' },
      { id: 'safe', label: 'Feeling safe or getting enough support' },
    ],
  },
  second: {
    id: 'repair-friction',
    prompt: 'What tends to make recovery harder?',
    helperText: 'Name the pressure without blame. If everyday tools are not enough, human or professional support belongs in the answer.',
    options: [
      { id: 'push', label: 'I keep pushing through' },
      { id: 'judge', label: 'I judge the feeling' },
      { id: 'isolate', label: 'I withdraw without asking for support' },
      { id: 'solve', label: 'I try to solve everything at once' },
      { id: 'access', label: 'Support is unavailable or hard to reach' },
    ],
  },
  goal: {
    id: 'repair-goal',
    typeId: 'emotional-recovery',
    typeLabel: 'Recovery',
    fallbackTitle: 'Practise gentler emotional recovery',
    prompt: 'What supportive direction feels possible?',
    helperText: 'Choose the closest supportive direction. No option promises to remove a feeling, and pausing self-guided work is valid.',
    options: [
      { id: 'notice', label: 'Notice feelings without fixing them', goalTitle: 'Make room for honest emotional check-ins', suggestedQuickGoalIds: ['mendle:name-feeling', 'mendle:weekday-checkin'] },
      { id: 'lower', label: 'Lower pressure on tender days', goalTitle: 'Lower unnecessary pressure on tender days', suggestedQuickGoalIds: ['mendle:soften-expectation', 'mendle:ask-need'] },
      { id: 'kind', label: 'Practise fairer self-talk', goalTitle: 'Replace harsh self-talk with something fairer', suggestedQuickGoalIds: ['mendle:release-blame', 'mendle:comfort-action'] },
      { id: 'support', label: 'Reach for trusted support earlier', goalTitle: 'Let a trusted person know when I need support', suggestedQuickGoalIds: ['mendle:reach-support', 'mendle:ask-need'] },
      { id: 'care', label: 'Keep a route to appropriate care', goalTitle: 'Keep a clear route to human or professional support', suggestedQuickGoalIds: ['mendle:reach-support', 'mendle:weekday-checkin'] },
    ],
  },
  checkInPrompt: 'What happened when you tried to support yourself today?',
  checkInOptions: [
    { id: 'named', label: 'I named the feeling honestly' },
    { id: 'softened', label: 'I softened an expectation' },
    { id: 'kind', label: 'I treated myself more fairly' },
    { id: 'supported', label: 'I reached for human support' },
    { id: 'unchanged', label: 'Nothing clearly shifted' },
    { id: 'more-support', label: 'I needed more or different support' },
  ],
  practiceTitle: 'Practise gentle repair',
  practiceDescription: 'Share three real emotional-recovery moments.',
  reflectionSubject: 'recovery',
});

const quietome = threeQuestionJourney({
  id: 'quietome-chosen-solitude',
  version: 3,
  familyId: 'quietome',
  title: 'Chosen solitude',
  introduction: 'Explore small spaces for reflection, with quiet, grounding input, or trusted company as needed. The aim is perspective—not isolation or forced answers.',
  conversationTitle: 'Choose a quiet direction',
  conversationStartLabel: 'Explore what solitude can give',
  first: {
    id: 'quiet-gift',
    prompt: 'What would you most like a reflective pause to offer?',
    helperText: 'Reflection can be alone or supported. Choose the quality you want, not a rule about solitude.',
    options: [
      { id: 'perspective', label: 'Perspective' },
      { id: 'input', label: 'Less input' },
      { id: 'expression', label: 'Space to write, speak, or make sense' },
      { id: 'question', label: 'Time with an unanswered question' },
      { id: 'support', label: 'A clearer sense of when I need support' },
    ],
  },
  second: {
    id: 'quiet-friction',
    prompt: 'What can make reflection less helpful?',
    helperText: 'Quiet is not always the right support. Circling thoughts or feeling worse are reasons to stop or reach out.',
    options: [
      { id: 'input', label: 'There is too much input or interruption' },
      { id: 'late', label: 'I wait until I am depleted' },
      { id: 'solve', label: 'Thoughts circle or I force an answer' },
      { id: 'unsafe', label: 'Being alone does not feel supportive' },
    ],
  },
  goal: {
    id: 'quiet-goal',
    typeId: 'solitude',
    typeLabel: 'Solitude',
    fallbackTitle: 'Protect a small reflective pause',
    prompt: 'What kind of quiet would help you hear yourself?',
    helperText: 'Choose a small, optional practice. If quiet is unhelpful, supported reflection is a valid direction.',
    options: [
      { id: 'pause', label: 'Take a brief low-input pause', goalTitle: 'Protect a brief low-input pause when it helps', suggestedQuickGoalIds: ['quietome:two-quiet-minutes', 'quietome:phone-outside'] },
      { id: 'write', label: 'Write one honest line', goalTitle: 'Use one honest line to notice what is here', suggestedQuickGoalIds: ['quietome:write-one-line', 'quietome:notice-thought'] },
      { id: 'walk', label: 'Move or travel with less input', goalTitle: 'Make room for movement or travel with less input', suggestedQuickGoalIds: ['quietome:silent-walk', 'quietome:choose-solitude'] },
      { id: 'question', label: 'Return to one question slowly', goalTitle: 'Stay with one important question without forcing an answer', suggestedQuickGoalIds: ['quietome:sit-with-question', 'quietome:weekday-reflect'] },
      { id: 'supported', label: 'Reflect with someone or a grounding prompt', goalTitle: 'Use supported reflection when quiet is not enough', suggestedQuickGoalIds: ['quietome:write-one-line', 'quietome:notice-thought'] },
    ],
  },
  checkInPrompt: 'What did quiet make visible today?',
  checkInOptions: [
    { id: 'clearer', label: 'Something became clearer' },
    { id: 'returned', label: 'A thought or question returned' },
    { id: 'rested', label: 'Less input felt restful' },
    { id: 'chosen', label: 'Solitude felt chosen, not isolating' },
    { id: 'support', label: 'I noticed I needed support or input' },
    { id: 'other', label: 'Something else' },
  ],
  practiceTitle: 'Protect the quiet',
  practiceDescription: 'Share three real solitude or reflection moments.',
  reflectionSubject: 'solitude',
});

const flickerbun = threeQuestionJourney({
  id: 'flickerbun-intentional-watching',
  version: 3,
  familyId: 'flickerbun',
  title: 'Intentional watching',
  introduction: 'Choose screen stories with intention, without treating watching as a bad habit or finishing as an obligation.',
  conversationTitle: 'Shape your watching life',
  conversationStartLabel: 'Choose a screen-story direction',
  first: {
    id: 'story-gift',
    prompt: 'What do you most want a film or show to give you?',
    helperText: 'There is no superior kind of watching. Subtitles, audio description, breaks, and stopping all count.',
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
    helperText: 'Choose the closest experiment.',
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
  version: 3,
  familyId: 'relicoon',
  title: 'A cultural trail',
  introduction: 'Follow objects, places, sources, and people into the past while noticing context, uncertainty, and missing perspectives.',
  conversationTitle: 'Follow a thread through time',
  conversationStartLabel: 'Choose a cultural direction',
  first: {
    id: 'past-entry',
    prompt: 'What most often draws you into history or culture?',
    helperText: 'Choose the doorway that draws you in. No single source or institution holds the whole story.',
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
    helperText: 'Choose the closest trail you can follow in small pieces.',
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
  version: 3,
  familyId: 'encora',
  title: 'Active music',
  introduction: 'Bring music forward through listening, making, sharing, or choosing quiet in ways that suit your senses and interests.',
  conversationTitle: 'Choose a musical direction',
  conversationStartLabel: 'Explore your music life',
  first: {
    id: 'music-role',
    prompt: 'What do you most want music to do in your life?',
    helperText: 'Choose the role you want to make more deliberate. There is no better genre, skill level, or way to listen.',
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
  version: 3,
  familyId: 'gatherglow',
  title: 'Tended connection',
  introduction: 'Choose a kind of connection that fits your life, then notice what makes it feel mutual, safe, and real.',
  conversationTitle: 'Tend a social rhythm',
  conversationStartLabel: 'Choose a connection direction',
  first: {
    id: 'connection-shape',
    prompt: 'What kind of connection would support you right now?',
    helperText: 'Choose the shape, not a person. Wanting space is also a valid direction.',
    options: [
      { id: 'regular', label: 'More regular contact' },
      { id: 'deeper', label: 'Deeper conversation' },
      { id: 'shared', label: 'More things done together' },
      { id: 'belonging', label: 'A stronger sense of belonging' },
      { id: 'space', label: 'More space and clearer boundaries' },
    ],
  },
  second: {
    id: 'connection-friction',
    prompt: 'What most affects whether connection feels possible?',
    helperText: 'This can be about timing, energy, safety, or the other person’s response. It is not all yours to fix.',
    options: [
      { id: 'waiting', label: 'I wait for others to reach out' },
      { id: 'time', label: 'Plans never quite happen' },
      { id: 'surface', label: 'Conversation stays on the surface' },
      { id: 'energy', label: 'Social energy is limited' },
      { id: 'safety', label: 'The connection does not feel right or safe' },
    ],
  },
  goal: {
    id: 'connection-goal',
    typeId: 'connection',
    typeLabel: 'Connection',
    fallbackTitle: 'Tend a meaningful connection',
    prompt: 'What connection direction feels kind and realistic?',
    helperText: 'Choose an action or boundary you control. Another person’s response is not part of the goal.',
    options: [
      { id: 'reach', label: 'Reach out more regularly', goalTitle: 'Reach out instead of always waiting', suggestedQuickGoalIds: ['gatherglow:send-message', 'gatherglow:weekday-reach-out'] },
      { id: 'plan', label: 'Make simple plans happen', goalTitle: 'Make room for simple shared plans', suggestedQuickGoalIds: ['gatherglow:make-plan', 'gatherglow:give-attention'] },
      { id: 'deepen', label: 'Make conversation more genuine', goalTitle: 'Create space for more genuine conversation', suggestedQuickGoalIds: ['gatherglow:check-in', 'gatherglow:give-attention'] },
      { id: 'appreciate', label: 'Show people they matter', goalTitle: 'Express appreciation more openly', suggestedQuickGoalIds: ['gatherglow:say-thanks', 'gatherglow:reply-today'] },
      { id: 'protect-space', label: 'Protect my social energy', goalTitle: 'Use clearer boundaries around social energy', suggestedQuickGoalIds: ['gatherglow:protect-space', 'gatherglow:reply-today'] },
    ],
  },
  checkInPrompt: 'What happened in connection today?',
  checkInOptions: [
    { id: 'reached', label: 'I reached out' },
    { id: 'shared', label: 'We shared real time or attention' },
    { id: 'deeper', label: 'A conversation went deeper' },
    { id: 'belonged', label: 'I felt part of something' },
    { id: 'space', label: 'I protected needed space' },
    { id: 'no-contact', label: 'There was no contact today' },
  ],
  practiceTitle: 'Show up and notice',
  practiceDescription: 'Share three real moments of connection.',
  reflectionSubject: 'connection',
});

const cheerlet = threeQuestionJourney({
  id: 'cheerlet-visible-progress',
  version: 3,
  familyId: 'cheerlet',
  title: 'Visible progress',
  introduction: 'Make effort, progress, survival, and chapter changes visible enough to acknowledge—without requiring a win, public celebration, or uncomplicated happiness.',
  conversationTitle: 'Choose what deserves credit',
  conversationStartLabel: 'Mark a meaningful chapter',
  first: {
    id: 'overlooked-progress',
    prompt: 'What do you most often leave without fair acknowledgement?',
    helperText: 'It does not need to be finished or impressive to count.',
    options: [
      { id: 'small', label: 'Small wins' },
      { id: 'distance', label: 'How far I have come' },
      { id: 'support', label: 'The people who helped' },
      { id: 'chapter', label: 'A beginning or ending' },
      { id: 'survival', label: 'Getting through something hard' },
    ],
  },
  second: {
    id: 'celebration-friction',
    prompt: 'Why does acknowledgement tend to get skipped?',
    helperText: 'Acknowledgement can be private, small, and mixed. It does not have to look celebratory.',
    options: [
      { id: 'next', label: 'I move straight to the next thing' },
      { id: 'not-enough', label: 'Progress never feels big enough' },
      { id: 'awkward', label: 'Celebrating myself feels awkward' },
      { id: 'memory', label: 'The moment passes before I save it' },
      { id: 'mixed', label: 'The change brings mixed feelings' },
    ],
  },
  goal: {
    id: 'celebration-goal',
    typeId: 'milestone',
    typeLabel: 'Milestone',
    fallbackTitle: 'Make meaningful progress visible',
    prompt: 'What would you like to acknowledge more deliberately?',
    helperText: 'Choose a direction that feels genuine. Private credit and mixed feelings both count.',
    options: [
      { id: 'small-wins', label: 'Give effort fair credit', goalTitle: 'Give effort and small progress fair credit', suggestedQuickGoalIds: ['cheerlet:name-win', 'cheerlet:weekday-credit'] },
      { id: 'progress', label: 'Mark progress before the finish', goalTitle: 'Mark progress while it is still unfolding', suggestedQuickGoalIds: ['cheerlet:mark-progress', 'cheerlet:small-celebration'] },
      { id: 'chapter', label: 'Remember a chapter change', goalTitle: 'Remember this chapter as it changes', suggestedQuickGoalIds: ['cheerlet:save-memory', 'cheerlet:share-good-news'] },
      { id: 'support', label: 'Acknowledge support without creating debt', goalTitle: 'Recognise support that mattered to me', suggestedQuickGoalIds: ['cheerlet:thank-helper', 'cheerlet:congratulate'] },
      { id: 'survival', label: 'Recognise what it took to get through', goalTitle: 'Recognise the effort of getting through a hard chapter', suggestedQuickGoalIds: ['cheerlet:name-win', 'cheerlet:save-memory'] },
    ],
  },
  checkInPrompt: 'What deserved acknowledgement today?',
  checkInOptions: [
    { id: 'win', label: 'Effort or a small win' },
    { id: 'progress', label: 'Progress before the finish' },
    { id: 'chapter', label: 'A beginning or ending' },
    { id: 'support', label: 'Support that mattered' },
    { id: 'mixed', label: 'A change with mixed feelings' },
    { id: 'other', label: 'Something else' },
  ],
  practiceTitle: 'Mark what matters',
  practiceDescription: 'Share three real moments of progress or chapter change.',
  reflectionSubject: 'milestone',
});

const skylo = threeQuestionJourney({
  id: 'skylo-local-discovery',
  version: 3,
  familyId: 'skylo',
  title: 'Local discovery',
  introduction: 'Notice and gradually know the local world around you through safe, accessible, ordinary places and views.',
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
    prompt: 'What most affects local exploration for you?',
    helperText: 'Routine is only one factor. Safety, mobility, cost, and time matter too.',
    options: [
      { id: 'routine', label: 'I repeat the same routes' },
      { id: 'passing', label: 'I pass places without stopping' },
      { id: 'planning', label: 'Ideas stay on a saved list' },
      { id: 'far', label: 'I assume exploration must be far away' },
      { id: 'access', label: 'Safety, access, cost, or energy' },
    ],
  },
  goal: {
    id: 'city-goal',
    typeId: 'local-exploration',
    typeLabel: 'Local exploration',
    fallbackTitle: 'Explore my city with fresh attention',
    prompt: 'What local direction would make the city feel new?',
    helperText: 'Choose a safe, accessible experiment. A view, detail, or short stop can be enough.',
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
    { id: 'no-exploration', label: 'Exploration was not possible today' },
  ],
  practiceTitle: 'Explore and notice',
  practiceDescription: 'Share three real moments of local discovery.',
  reflectionSubject: 'local exploration',
});

const steppling: CompanionJourneyDefinition = {
  id: 'steppling-everyday-momentum',
  version: 3,
  familyId: 'steppling',
  title: 'Walking that fits',
  introduction: 'Find a kind of walking that fits your life. Start small, adjust as you go, and leave room for days when walking is not right for you.',
  conversationTitle: 'Find what works for you',
  conversationStartLabel: 'Choose a starting point',
  startNodeId: 'walking-purpose',
  nodes: [
    {
      id: 'walking-purpose',
      kind: 'single_choice',
      prompt: 'What would you most like from walking?',
      helperText: 'Choose what would make a walk feel worthwhile to you.',
      options: [
        { id: 'energy', label: 'A little more everyday energy', nextNodeId: 'walking-fit' },
        { id: 'headspace', label: 'Space to clear my head', nextNodeId: 'walking-fit' },
        { id: 'exploration', label: 'A way to explore', nextNodeId: 'walking-fit' },
        { id: 'consistency', label: 'A walking habit I can sustain', nextNodeId: 'walking-fit' },
      ],
    },
    {
      id: 'walking-fit',
      kind: 'single_choice',
      prompt: 'Where could a walk fit most easily?',
      helperText: 'Choose what seems realistic, not what you think you should do.',
      options: [
        { id: 'journeys', label: 'An everyday journey', nextNodeId: 'walking-goal' },
        { id: 'breaks', label: 'A short break', nextNodeId: 'walking-goal' },
        { id: 'meals', label: 'Before or after something I already do', nextNodeId: 'walking-goal' },
        { id: 'weekends', label: 'Time set aside to wander', nextNodeId: 'walking-goal' },
      ],
    },
    {
      id: 'walking-goal',
      kind: 'single_choice',
      createsGoalTypeId: 'walking-rhythm',
      prompt: 'What would you like to try first?',
      helperText: 'Pick one small experiment. You can change it later.',
      options: [
        { id: 'daily-ten', label: 'Take a short walk when it fits', goalTitle: 'Make room for short walks', suggestedQuickGoalIds: ['steppling:ten-minute-walk', 'steppling:fresh-air-break'], nextNodeId: null },
        { id: 'walk-journey', label: 'Walk part of an everyday journey', goalTitle: 'Use walking for more everyday journeys', suggestedQuickGoalIds: ['steppling:walk-one-journey', 'steppling:weekday-steps'], nextNodeId: null },
        { id: 'clear-head', label: 'Use a walk to make headspace', goalTitle: 'Use short walks to make headspace', suggestedQuickGoalIds: ['steppling:fresh-air-break', 'steppling:notice-route'], nextNodeId: null },
        { id: 'explore', label: 'Notice more along familiar routes', goalTitle: 'Use walks to notice and explore nearby', suggestedQuickGoalIds: ['steppling:explore-turn', 'steppling:notice-route'], nextNodeId: null },
      ],
      nextNodeId: null,
    },
  ],
  goalTypes: {
    'walking-rhythm': { label: 'Walking Focus', fallbackTitle: 'Find a kind of walking that fits' },
  },
  checkIn: {
    prompt: 'What was walking like for you today?',
    options: [
      { id: 'moved', label: 'I fitted in some walking' },
      { id: 'headspace', label: 'It gave me some headspace' },
      { id: 'noticed', label: 'I noticed something along the way' },
      { id: 'friction', label: 'It felt difficult or uncomfortable' },
      { id: 'no-walk', label: 'I did not walk today' },
    ],
  },
  stages: [
    { id: 'choose', title: 'Choose a starting point', description: 'Decide what you would like from walking now.', requirement: { kind: 'goal_created', target: 1 } },
    { id: 'walk', title: 'Try it in real life', description: 'Share three walking moments from different days.', requirement: { kind: 'quest_completions', target: 3 } },
    { id: 'review', title: 'Notice what fits', description: 'Look at what helped, what did not, and what you want to change.', requirement: { kind: 'reflections', target: 1 } },
    { id: 'decide', title: 'Choose what happens next', description: 'Continue, change, pause, or complete this walking Focus.', requirement: { kind: 'goal_resolved', target: 1 } },
  ],
  reflectionPrompts: {
    choose: 'What would make “{goal}” feel worthwhile and realistic?',
    walk: 'What helped “{goal}” fit today? What, if anything, did you notice afterwards?',
    review: 'Across your recent walks, which times, places, or reasons made “{goal}” easiest to return to?',
    decide: 'What would fit best now: continue “{goal}”, change it, pause it, or mark it complete?',
  },
};

const feastle: CompanionJourneyDefinition = {
  id: 'feastle-meaningful-meals',
  version: 3,
  familyId: 'feastle',
  title: 'Meaningful meals',
  introduction: 'Notice what makes food feel manageable, enjoyable, caring, or connecting without turning meals into a test.',
  conversationTitle: 'Choose what food should bring',
  conversationStartLabel: 'Explore a food direction',
  startNodeId: 'meal-meaning',
  nodes: [
    {
      id: 'meal-meaning',
      kind: 'single_choice',
      prompt: 'What would you like more of around food?',
      helperText: 'This is about lived meals, not perfect nutrition or “good” and “bad” food.',
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
      prompt: 'What most affects whether that is possible?',
      helperText: 'Time, energy, cost, access, appetite, and other people’s needs can all shape food.',
      options: [
        { id: 'time', label: 'Time or planning', nextNodeId: 'meal-goal' },
        { id: 'energy', label: 'Energy to prepare food', nextNodeId: 'meal-goal' },
        { id: 'routine', label: 'I fall into the same routine', nextNodeId: 'meal-goal' },
        { id: 'rushing', label: 'Meals feel rushed or distracted', nextNodeId: 'meal-goal' },
        { id: 'access', label: 'Cost, access, appetite, or sensory needs', nextNodeId: 'meal-goal' },
      ],
    },
    {
      id: 'meal-goal',
      kind: 'single_choice',
      createsGoalTypeId: 'meal-rhythm',
      prompt: 'What food direction would feel good to practise?',
      helperText: 'Choose a small direction that fits your time, budget, access, and energy.',
      options: [
        { id: 'simple-cooking', label: 'Cook something simple more often', goalTitle: 'Make simple cooking easier to return to', suggestedQuickGoalIds: ['feastle:make-one-thing', 'feastle:weekday-cook', 'feastle:plan-meal'], nextNodeId: null },
        { id: 'intentional-meal', label: 'Give one meal my full attention', goalTitle: 'Make one daily meal feel intentional', suggestedQuickGoalIds: ['feastle:eat-without-rushing', 'feastle:sit-for-meal'], nextNodeId: null },
        { id: 'shared-food', label: 'Share food more often', goalTitle: 'Create more moments around shared food', suggestedQuickGoalIds: ['feastle:share-food', 'feastle:plan-meal'], nextNodeId: null },
        { id: 'new-flavours', label: 'Try unfamiliar food', goalTitle: 'Make room for new flavours', suggestedQuickGoalIds: ['feastle:try-flavour', 'feastle:add-colour'], nextNodeId: null },
      ],
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
      { id: 'limited', label: 'My options were limited today' },
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
  version: 3,
  familyId: 'pagelet',
  title: 'Living curiosity',
  introduction: 'Follow a curiosity in a format and pace that suit you, without making speed or finishing the measure of learning.',
  conversationTitle: 'Follow a useful curiosity',
  conversationStartLabel: 'Choose a learning direction',
  startNodeId: 'learning-shape',
  nodes: [
    {
      id: 'learning-shape',
      kind: 'single_choice',
      prompt: 'What kind of learning do you want more of?',
      helperText: 'Books, articles, audio, read-aloud tools, courses, and practical learning all count.',
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
        { id: 'format', label: 'The format is not accessible or comfortable', nextNodeId: 'learning-goal' },
      ],
    },
    {
      id: 'learning-goal',
      kind: 'single_choice',
      createsGoalTypeId: 'curiosity',
      prompt: 'What direction would you like Pagelet to remember?',
      helperText: 'Pick the closest low-friction experiment.',
      options: [
        { id: 'reading-rhythm', label: 'Make room for small reading moments', goalTitle: 'Build a small, flexible reading rhythm', suggestedQuickGoalIds: ['pagelet:read-five-pages', 'pagelet:read-ten-minutes'], nextNodeId: null },
        { id: 'finish-book', label: 'Return to and finish a book', goalTitle: 'Return to the book I want to finish', suggestedQuickGoalIds: ['pagelet:return-to-book', 'pagelet:phone-for-book'], nextNodeId: null },
        { id: 'understand-topic', label: 'Understand one topic better', goalTitle: 'Follow one question until I understand it better', suggestedQuickGoalIds: ['pagelet:look-up-question', 'pagelet:weekday-learning'], nextNodeId: null },
        { id: 'keep-ideas', label: 'Keep and use what I learn', goalTitle: 'Keep the ideas that matter to me', suggestedQuickGoalIds: ['pagelet:keep-one-idea', 'pagelet:share-one-idea'], nextNodeId: null },
      ],
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
  version: 3,
  familyId: 'mossprout',
  title: 'Nearby nature',
  introduction: 'Build a relationship with nearby nature through ordinary places, window views, weather, or something growing.',
  conversationTitle: 'Grow a nearby-nature rhythm',
  conversationStartLabel: 'Choose a nature direction',
  startNodeId: 'nature-need',
  nodes: [
    {
      id: 'nature-need',
      kind: 'single_choice',
      prompt: 'What would you like to notice or experience through nearby nature?',
      helperText: 'A window view, houseplant, street tree, garden, or outdoor place can all count.',
      options: [
        { id: 'pause', label: 'A restorative pause', nextNodeId: 'nature-place' },
        { id: 'attention', label: 'More attention to the living world', nextNodeId: 'nature-place' },
        { id: 'routine', label: 'A small reason to pause and look', nextNodeId: 'nature-place' },
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
        { id: 'window', label: 'A view from indoors', nextNodeId: 'nature-goal' },
      ],
    },
    {
      id: 'nature-goal',
      kind: 'single_choice',
      createsGoalTypeId: 'outdoor-rhythm',
      prompt: 'What nearby-nature direction feels realistic now?',
      helperText: 'Choose something accessible in an ordinary week. It does not need to happen every day.',
      options: [
        { id: 'daily-outside', label: 'Make room for brief nature moments', goalTitle: 'Build a small nearby-nature pause', suggestedQuickGoalIds: ['mossprout:step-outside', 'mossprout:window-view'], nextNodeId: null },
        { id: 'green-place', label: 'Return to a nearby green place', goalTitle: 'Build a relationship with one nearby green place', suggestedQuickGoalIds: ['mossprout:visit-green', 'mossprout:same-place'], nextNodeId: null },
        { id: 'notice-season', label: 'Notice the season changing', goalTitle: 'Pay attention to small seasonal changes', suggestedQuickGoalIds: ['mossprout:season-change', 'mossprout:notice-living-thing'], nextNodeId: null },
        { id: 'care-plant', label: 'Care for something growing', goalTitle: 'Create a gentle plant-care rhythm', suggestedQuickGoalIds: ['mossprout:care-for-plant', 'mossprout:sit-outside'], nextNodeId: null },
      ],
      nextNodeId: null,
    },
  ],
  goalTypes: {
    'outdoor-rhythm': { label: 'Outdoor rhythm', fallbackTitle: 'Grow a nearby nature rhythm' },
  },
  checkIn: {
    prompt: 'What happened in nearby nature today?',
    options: [
      { id: 'paused', label: 'Being outside changed my pace' },
      { id: 'living', label: 'I noticed something living' },
      { id: 'returned', label: 'I returned to a familiar place' },
      { id: 'cared', label: 'I cared for something growing' },
      { id: 'indoors', label: 'I noticed nature from indoors' },
      { id: 'none', label: 'There was no nature moment today' },
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
  version: 3,
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
      helperText: 'Rest is broader than sleep. Choose the need that feels clearest, without turning it into a promise.',
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
      kind: 'single_choice',
      createsGoalTypeId: 'sleep-rhythm',
      suggestedQuickGoalIds: ['sleep-rest:chosen-bedtime', 'sleep-rest:phone-away'],
      prompt: 'What would a kinder, more workable sleep rhythm look like?',
      helperText: 'Choose the closest direction. It does not need to mean perfect nights.',
      options: [
        { id: 'steady-time', label: 'Aim for a steadier bedtime', goalTitle: 'Build a steadier bedtime rhythm', nextNodeId: 'rest-friction' },
        { id: 'earlier-some-nights', label: 'Get to bed earlier on some nights', goalTitle: 'Make earlier nights easier to choose', nextNodeId: 'rest-friction' },
        { id: 'consistent-wake', label: 'Keep mornings more consistent', goalTitle: 'Build a more consistent morning rhythm', nextNodeId: 'rest-friction' },
        { id: 'notice-needs', label: 'Notice how much sleep I actually need', goalTitle: 'Learn the sleep rhythm that restores me', nextNodeId: 'rest-friction' },
      ],
      nextNodeId: 'rest-friction',
    },
    {
      id: 'wind-down-goal',
      kind: 'single_choice',
      createsGoalTypeId: 'wind-down',
      suggestedQuickGoalIds: ['sleep-rest:phone-away', 'sleep-rest:gentler-night'],
      prompt: 'What would help your mind or body recognise that the day is ending?',
      helperText: 'Choose a small ritual or boundary you could repeat.',
      options: [
        { id: 'screens-away', label: 'Put screens away before bed', goalTitle: 'Create a screen-free wind-down', nextNodeId: 'rest-friction' },
        { id: 'quiet-ritual', label: 'Keep one quiet evening ritual', goalTitle: 'Build a quiet evening ritual', nextNodeId: 'rest-friction' },
        { id: 'prepare-room', label: 'Make the room feel ready for sleep', goalTitle: 'Prepare a calmer space for sleep', nextNodeId: 'rest-friction' },
        { id: 'clear-ending', label: 'Give work and chores a clear ending', goalTitle: 'Create a clearer ending to the day', nextNodeId: 'rest-friction' },
      ],
      nextNodeId: 'rest-friction',
    },
    {
      id: 'recovery-goal',
      kind: 'single_choice',
      createsGoalTypeId: 'recovery',
      suggestedQuickGoalIds: ['sleep-rest:ten-minute-rest', 'sleep-rest:recovery-break'],
      prompt: 'What would recovering well after a demanding day mean for you?',
      helperText: 'Choose what would make the biggest difference most often.',
      options: [
        { id: 'quiet-break', label: 'Take a real quiet break', goalTitle: 'Protect a quiet recovery break', nextNodeId: 'rest-friction' },
        { id: 'lower-expectations', label: 'Expect less from myself afterward', goalTitle: 'Lower expectations after demanding days', nextNodeId: 'rest-friction' },
        { id: 'comfort', label: 'Choose something genuinely comforting', goalTitle: 'Make room for genuine comfort after hard days', nextNodeId: 'rest-friction' },
        { id: 'ask-help', label: 'Ask for help or space sooner', goalTitle: 'Ask for recovery support sooner', nextNodeId: 'rest-friction' },
      ],
      nextNodeId: 'rest-friction',
    },
    {
      id: 'downtime-goal',
      kind: 'single_choice',
      createsGoalTypeId: 'restorative-downtime',
      suggestedQuickGoalIds: ['sleep-rest:ten-minute-rest', 'sleep-rest:gentler-night'],
      prompt: 'What kind of downtime tends to leave you more restored?',
      helperText: 'Choose what usually leaves you feeling more restored.',
      options: [
        { id: 'quiet-alone', label: 'Quiet time alone', goalTitle: 'Make room for restorative quiet time', nextNodeId: 'rest-friction' },
        { id: 'gentle-hobby', label: 'A gentle hobby or familiar activity', goalTitle: 'Return to downtime that feels restorative', nextNodeId: 'rest-friction' },
        { id: 'outside', label: 'Fresh air or time outside', goalTitle: 'Use time outside to recover', nextNodeId: 'rest-friction' },
        { id: 'connection', label: 'Relaxed time with someone I trust', goalTitle: 'Make room for restful connection', nextNodeId: 'rest-friction' },
      ],
      nextNodeId: 'rest-friction',
    },
    {
      id: 'boundary-goal',
      kind: 'single_choice',
      createsGoalTypeId: 'rest-boundary',
      suggestedQuickGoalIds: ['sleep-rest:stop-work', 'sleep-rest:recovery-break'],
      prompt: 'What could you stop carrying into your rest time?',
      helperText: 'Choose the boundary that would create the most room to stop.',
      options: [
        { id: 'work', label: 'Work after a chosen time', goalTitle: 'Give work a clear stopping point', nextNodeId: 'rest-friction' },
        { id: 'chores', label: 'The pressure to finish every chore', goalTitle: 'Let unfinished chores wait during rest time', nextNodeId: 'rest-friction' },
        { id: 'screens', label: 'Automatic scrolling or watching', goalTitle: 'Protect rest time from automatic screens', nextNodeId: 'rest-friction' },
        { id: 'availability', label: 'Always being available', goalTitle: 'Protect time when I am not available', nextNodeId: 'rest-friction' },
      ],
      nextNodeId: 'rest-friction',
    },
    {
      id: 'rest-friction',
      kind: 'single_choice',
      prompt: 'What most affects whether that rest is possible?',
      helperText: 'The answer can be practical, emotional, or simply unclear. It is not a test of discipline.',
      options: [
        { id: 'time', label: 'There never seems to be time', nextNodeId: null },
        { id: 'switching-off', label: 'I struggle to switch off', nextNodeId: null },
        { id: 'responsibility', label: 'Other people or responsibilities need me', nextNodeId: null },
        { id: 'screens', label: 'Screens keep pulling me back', nextNodeId: null },
        { id: 'guilt', label: 'Rest can feel undeserved', nextNodeId: null },
        { id: 'unclear', label: 'It changes or is not clear yet', nextNodeId: null },
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
      { id: 'not-possible', label: 'Rest was not really possible today' },
      { id: 'unclear', label: 'I am not sure what helped' },
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
  version: 3,
  familyId: 'tasklet',
  title: 'Meaningful momentum',
  introduction: 'Choose one useful outcome, then learn what helps it move—or when changing, sharing, or stopping is wiser.',
  conversationTitle: 'Choose what deserves attention',
  conversationStartLabel: 'Plan something with Tasklet',
  startNodeId: 'attention',
  nodes: [
    {
      id: 'attention',
      kind: 'single_choice',
      prompt: 'What would be useful to clarify or move right now?',
      helperText: 'Choose the closest shape. This is about useful attention, not proving productivity.',
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
      kind: 'single_choice',
      createsGoalTypeId: 'project',
      suggestedQuickGoalIds: ['tasklet:next-action', 'tasklet:ten-minutes', 'tasklet:focus-block'],
      prompt: 'What outcome would make this project feel meaningfully further along?',
      helperText: 'Choose the closest useful outcome.',
      options: [
        { id: 'next-milestone', label: 'Finish the next clear milestone', goalTitle: 'Finish the next meaningful project milestone', nextNodeId: 'friction' },
        { id: 'clear-plan', label: 'Turn it into a clear plan', goalTitle: 'Create a clear plan for this project', nextNodeId: 'friction' },
        { id: 'restart', label: 'Restart momentum after a pause', goalTitle: 'Restart momentum on this project', nextNodeId: 'friction' },
        { id: 'smaller-scope', label: 'Reduce it to something manageable', goalTitle: 'Reduce this project to a manageable scope', nextNodeId: 'friction' },
      ],
      nextNodeId: 'friction',
    },
    {
      id: 'routine-goal',
      kind: 'single_choice',
      createsGoalTypeId: 'routine',
      suggestedQuickGoalIds: ['tasklet:next-action', 'tasklet:clear-three', 'tasklet:tomorrow-first'],
      prompt: 'What would “handled consistently” look like for this responsibility?',
      helperText: 'A simple rhythm is enough; choose the closest one.',
      options: [
        { id: 'regular-time', label: 'Handle it at a regular time', goalTitle: 'Give this responsibility a regular time', nextNodeId: 'friction' },
        { id: 'less-buildup', label: 'Stop it building into a backlog', goalTitle: 'Keep this responsibility from building up', nextNodeId: 'friction' },
        { id: 'earlier', label: 'Deal with it earlier', goalTitle: 'Handle this responsibility earlier', nextNodeId: 'friction' },
        { id: 'simpler', label: 'Make the routine simpler', goalTitle: 'Simplify how I handle this responsibility', nextNodeId: 'friction' },
      ],
      nextNodeId: 'friction',
    },
    {
      id: 'learning-goal',
      kind: 'single_choice',
      createsGoalTypeId: 'learning',
      suggestedQuickGoalIds: ['tasklet:next-action', 'tasklet:ten-minutes'],
      prompt: 'What would you like to be able to understand or do?',
      helperText: 'Choose the closest useful next capability.',
      options: [
        { id: 'fundamentals', label: 'Understand the fundamentals', goalTitle: 'Understand the fundamentals of what I am learning', nextNodeId: 'friction' },
        { id: 'practise', label: 'Practise the skill more regularly', goalTitle: 'Build a regular practice rhythm', nextNodeId: 'friction' },
        { id: 'finish-resource', label: 'Finish one course, book, or resource', goalTitle: 'Finish one learning resource', nextNodeId: 'friction' },
        { id: 'use-it', label: 'Use what I have learned in real life', goalTitle: 'Put what I am learning into practice', nextNodeId: 'friction' },
      ],
      nextNodeId: 'friction',
    },
    {
      id: 'reset-goal',
      kind: 'single_choice',
      createsGoalTypeId: 'reset',
      suggestedQuickGoalIds: ['tasklet:clear-three', 'tasklet:small-task'],
      prompt: 'What would feel lighter if it were cleared or closed?',
      helperText: 'Choose the area that is taking up the most mental space.',
      options: [
        { id: 'messages-admin', label: 'Messages, email, or life admin', goalTitle: 'Clear a small life-admin backlog', nextNodeId: 'friction' },
        { id: 'space', label: 'A desk, room, or physical pile', goalTitle: 'Reset one cluttered space', nextNodeId: 'friction' },
        { id: 'small-tasks', label: 'Several loose small tasks', goalTitle: 'Close a handful of loose tasks', nextNodeId: 'friction' },
        { id: 'decision', label: 'A decision I keep postponing', goalTitle: 'Close one postponed decision', nextNodeId: 'friction' },
      ],
      nextNodeId: 'friction',
    },
    {
      id: 'clarity-goal',
      kind: 'single_choice',
      createsGoalTypeId: 'clarity',
      suggestedQuickGoalIds: ['tasklet:next-action', 'tasklet:ten-minutes'],
      prompt: 'What question would you like a little more clarity about?',
      helperText: 'Tasklet can help you investigate before asking you to commit.',
      options: [
        { id: 'priority', label: 'What deserves attention first', goalTitle: 'Choose what deserves attention first', nextNodeId: 'friction' },
        { id: 'options', label: 'Which option fits me best', goalTitle: 'Compare my options and choose a direction', nextNodeId: 'friction' },
        { id: 'next-step', label: 'What the next step should be', goalTitle: 'Find one clear next step', nextNodeId: 'friction' },
        { id: 'worth-doing', label: 'Whether this is worth doing at all', goalTitle: 'Decide whether this direction is worth continuing', nextNodeId: 'friction' },
      ],
      nextNodeId: 'friction',
    },
    {
      id: 'friction',
      kind: 'single_choice',
      prompt: 'What condition is most likely to affect this work?',
      helperText: 'A limit or changed priority is useful information, not resistance to overcome.',
      options: [
        { id: 'unclear', label: 'The next step is unclear', nextNodeId: null },
        { id: 'time', label: 'Protecting time', nextNodeId: null },
        { id: 'energy', label: 'Energy or motivation', nextNodeId: null },
        { id: 'too-much', label: 'It feels too large', nextNodeId: null },
        { id: 'distraction', label: 'Distractions', nextNodeId: null },
        { id: 'changed-priority', label: 'The priority may change', nextNodeId: null },
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
      { id: 'stopped', label: 'I stopped or let something go' },
      { id: 'no-movement', label: 'Nothing moved today' },
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
  version: 3,
  familyId: 'vesperitt',
  title: 'Intentional small hours',
  introduction: 'Understand what your life after dark contains, including chosen time, shift work, caring, stress, or wakefulness you did not choose. Protect what matters and change only what is yours to change.',
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
        { id: 'care', label: 'Caring, health, or practical needs', nextNodeId: 'intention' },
        { id: 'awake', label: 'I was awake without choosing it', nextNodeId: 'intention' },
      ],
    },
    {
      id: 'intention',
      kind: 'single_choice',
      prompt: 'How intentional do those nights usually feel?',
      helperText: 'Vesperitt is interested in choice and constraints, not in judging the hour or assuming everyone keeps the same schedule.',
      options: [
        { id: 'chosen', label: 'Mostly chosen', nextNodeId: 'protect-goal' },
        { id: 'mixed', label: 'A mixture', nextNodeId: 'understand-goal' },
        { id: 'accidental', label: 'Mostly accidental', nextNodeId: 'shift-goal' },
        { id: 'unavoidable', label: 'Mostly outside my control', nextNodeId: 'understand-goal' },
      ],
    },
    {
      id: 'protect-goal',
      kind: 'single_choice',
      createsGoalTypeId: 'protect',
      prompt: 'What would you like to protect or make room for after dark?',
      helperText: 'Choose the closest direction for now.',
      options: [
        { id: 'creative-time', label: 'Creative or learning time', goalTitle: 'Protect creative or learning time after dark', suggestedQuickGoalIds: ['vesperitt:choose-tonight', 'vesperitt:chosen-activity'], nextNodeId: null },
        { id: 'quiet-time', label: 'Quiet time alone', goalTitle: 'Make room for quiet time after dark', suggestedQuickGoalIds: ['vesperitt:choose-tonight', 'vesperitt:chosen-activity'], nextNodeId: null },
        { id: 'people-time', label: 'Time with people I care about', goalTitle: 'Protect time with people I care about', suggestedQuickGoalIds: ['vesperitt:choose-tonight', 'vesperitt:chosen-activity'], nextNodeId: null },
        { id: 'evening-ritual', label: 'A favourite evening ritual', goalTitle: 'Keep a favourite evening ritual', suggestedQuickGoalIds: ['vesperitt:choose-tonight', 'vesperitt:evening-ritual'], nextNodeId: null },
      ],
      nextNodeId: null,
    },
    {
      id: 'understand-goal',
      kind: 'single_choice',
      createsGoalTypeId: 'understand',
      prompt: 'What pattern would you like to understand or support more kindly?',
      helperText: 'Pick the closest question. Understanding a constraint is useful even when you cannot change it.',
      options: [
        { id: 'chosen-to-drift', label: 'When a chosen night turns into drift', goalTitle: 'Notice when and why a chosen night turns into drift', suggestedQuickGoalIds: ['vesperitt:choose-tonight', 'vesperitt:end-planned', 'vesperitt:next-morning'], nextNodeId: null },
        { id: 'late-work-effect', label: 'How late work affects the next day', goalTitle: 'Notice how late work affects the next day', suggestedQuickGoalIds: ['vesperitt:finish-late-work', 'vesperitt:next-morning'], nextNodeId: null },
        { id: 'stopping-cues', label: 'What helps me stop when I mean to', goalTitle: 'Learn what helps me stop when I mean to', suggestedQuickGoalIds: ['vesperitt:end-planned', 'vesperitt:next-morning'], nextNodeId: null },
        { id: 'worthwhile-nights', label: 'Which late nights are actually worth it', goalTitle: 'Notice which late nights feel worth it', suggestedQuickGoalIds: ['vesperitt:choose-tonight', 'vesperitt:chosen-activity', 'vesperitt:next-morning'], nextNodeId: null },
        { id: 'unavoidable-support', label: 'What helps after an unavoidable late night', goalTitle: 'Notice what supports me after unavoidable late nights', suggestedQuickGoalIds: ['vesperitt:next-morning', 'vesperitt:choose-tonight'], nextNodeId: null },
      ],
      nextNodeId: null,
    },
    {
      id: 'shift-goal',
      kind: 'single_choice',
      createsGoalTypeId: 'shift',
      prompt: 'What would you like to change gently about those nights?',
      helperText: 'Choose a small experiment that is within your control. A late schedule is not automatically a problem.',
      options: [
        { id: 'one-more-stop', label: 'Stop after one episode or game', suggestedQuickGoalIds: ['vesperitt:one-more-stop', 'vesperitt:choose-tonight'], nextNodeId: null },
        { id: 'phone-away', label: 'Put my phone away at a set time', suggestedQuickGoalIds: ['vesperitt:phone-away', 'vesperitt:choose-tonight'], nextNodeId: null },
        { id: 'work-earlier', label: 'Move late work a little earlier', suggestedQuickGoalIds: ['vesperitt:finish-late-work', 'vesperitt:next-morning'], nextNodeId: null },
        { id: 'calmer-replacement', label: 'Try another activity when scrolling stops feeling chosen', goalTitle: 'Try a different activity when late scrolling stops feeling chosen', suggestedQuickGoalIds: ['vesperitt:calmer-replacement', 'vesperitt:phone-away'], nextNodeId: null },
      ],
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
      { id: 'unavoidable', label: 'The late night was not really optional' },
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
  flexel,
  feastle,
  flickerbun,
  gatherglow,
  hooplet,
  mossprout,
  mendle,
  pagelet,
  quietome,
  relicoon,
  sleepRest,
  skylo,
  snuglet,
  sprintail,
  steppling,
  serveling,
  tasklet,
  vesperitt,
  waglet,
  whiskit,
  ...SPECIALIST_COMPANION_SYSTEMS.map((system) => system.journey),
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
