import { katchimeraFamilies, katchimeraSkinById } from '@/constants/katchimera-skins';
import { lifeAspectById } from '@/constants/life-aspects';
import type { KatchimeraFamilyId, LifeAspectId } from '@/types/katchimera';

export type KatchimeraActivityLane = 'real_life' | 'discovery' | 'mini_game';
export type KatchimeraBondLevel = 1 | 2 | 3 | 4;
export type KatchimeraRoleStatus = 'complete' | 'partial' | 'fallback' | 'planned';
export type DiscoveryPromptKind = 'single_choice' | 'free_text' | 'goal';

export type CompanionDiscoveryPromptDefinition = {
  id: string;
  familyId: KatchimeraFamilyId;
  minimumBondLevel: KatchimeraBondLevel;
  kind: DiscoveryPromptKind;
  question: string;
  helperText: string;
  options?: readonly string[];
};

export type KatchimeraRoleDefinition = {
  familyId: KatchimeraFamilyId;
  aspectId: LifeAspectId;
  displayName: string;
  role: string;
  boundary: string;
  hatchSignals: readonly string[];
  realLifeQuestIds: readonly string[];
  discoveryPrompts: readonly CompanionDiscoveryPromptDefinition[];
  miniGameQuestIds: readonly string[];
  plannedMiniGame: string | null;
  insightThemes: readonly string[];
  reflectionLenses: readonly string[];
  goalTypes: readonly string[];
  status: KatchimeraRoleStatus;
};

type AuthoredRole = Omit<KatchimeraRoleDefinition, 'familyId' | 'aspectId' | 'displayName'>;

const FOUNDATION_ROLES: Record<string, AuthoredRole> = {
  steppling: {
    role: 'Turns everyday walking into visible momentum.',
    boundary: 'Walking and accumulated daily movement, not training, running, or competitive sport.',
    hatchSignals: ['high step count', 'a deliberately logged walk', 'sustained everyday movement'],
    realLifeQuestIds: [
      'quest-steppling-gentle-walk',
      'quest-steppling-walk-note',
      'quest-long-walk',
      'quest-steppling-weekly-review',
    ],
    discoveryPrompts: [
      prompt('steppling', 'walking-place', 1, 'single_choice', 'Where does walking fit most naturally into your life?', 'This helps Steppling suggest walks that feel realistic.', ['Daily journeys', 'Clearing my head', 'Exploring', 'Fitness']),
      prompt('steppling', 'walking-goal', 2, 'goal', 'What walking goal would feel worth building toward?', 'Keep it small enough to repeat.'),
    ],
    miniGameQuestIds: ['quest-steppling-stride', 'quest-step-sprint', 'quest-step-time-trial'],
    plannedMiniGame: null,
    insightThemes: ['walking consistency', 'active days', 'routes and step trends', 'momentum without perfection'],
    reflectionLenses: ['what made movement easy', 'how walking changed the day', 'routes worth repeating', 'progress over time'],
    goalTypes: ['daily steps', 'walk frequency', 'route exploration', 'walking streak'],
    status: 'complete',
  },
  'sleep-rest': {
    role: 'Protects deliberate rest, recovery, and a gentler end to the day.',
    boundary: 'Resting and winding down, not being awake late or tracking a night-owl identity.',
    hatchSignals: ['quiet home evening', 'low-movement recovery day', 'calm or resting moment', 'good sleep'],
    realLifeQuestIds: [
      'quest-bedrotte-rest-note',
      'quest-rest-wind-down',
      'quest-rest-boundary',
      'quest-rest-recovery-checkin',
      'quest-early-night',
      'quest-rest-weekly-review',
    ],
    discoveryPrompts: [
      prompt('sleep-rest', 'rest-style', 1, 'single_choice', 'What helps you feel genuinely rested?', 'There is no ideal answer—this is your version of rest.', ['Sleep', 'Quiet time', 'Doing less', 'A comforting routine']),
      prompt('sleep-rest', 'wind-down-goal', 2, 'goal', 'What would make your evenings feel a little gentler?', 'Choose one change Bedrotte can remember with you.'),
    ],
    miniGameQuestIds: ['quest-bedrotte-breathe'],
    plannedMiniGame: null,
    insightThemes: ['recovery patterns', 'quiet days', 'sleep quality', 'evening routines'],
    reflectionLenses: ['permission to rest', 'what restored energy', 'what made sleep easier', 'how the body asked to slow down'],
    goalTypes: ['sleep rhythm', 'wind-down routine', 'recovery', 'restorative downtime', 'rest boundary'],
    status: 'complete',
  },
  feastle: {
    role: 'Celebrates eating, cooking, and the meaning carried by shared food.',
    boundary: 'Meals and cooking as lived experiences, not one cuisine, venue, or treat type.',
    hatchSignals: ['food moment', 'cooking', 'meal photo', 'shared table'],
    realLifeQuestIds: [
      'quest-feastle-meal-photo',
      'quest-feastle-meal-note',
      'quest-feastle-new-flavour',
      'quest-feastle-weekly-review',
    ],
    discoveryPrompts: [
      prompt('feastle', 'food-meaning', 1, 'single_choice', 'What matters most to you about food?', 'Feastle will use this when reflecting on meals.', ['Comfort', 'Connection', 'Trying things', 'Making something']),
      prompt('feastle', 'food-goal', 2, 'goal', 'Is there a food or cooking goal you would enjoy?', 'It can be a dish, habit, place, or person to share with.'),
    ],
    miniGameQuestIds: ['quest-feastle-merge', 'quest-feastle-sort', 'quest-feastle-memory'],
    plannedMiniGame: null,
    insightThemes: ['meal variety', 'cooking versus eating out', 'shared meals', 'comfort foods'],
    reflectionLenses: ['what a meal meant', 'who shared the table', 'new tastes', 'care expressed through food'],
    goalTypes: ['cook a dish', 'shared meal', 'try a cuisine', 'meal rhythm'],
    status: 'complete',
  },
  tasklet: {
    role: 'Helps turn meaningful work into clear, finishable steps.',
    boundary: 'Focus, prioritisation, and progress—not errands, household maintenance, or passive screen time.',
    hatchSignals: ['focused work', 'goal progress', 'work or study note', 'desk or workspace'],
    realLifeQuestIds: [
      'quest-goal-note',
      'quest-tasklet-next-action',
      'quest-tasklet-clear-three',
      'quest-tasklet-focus',
      'quest-tasklet-tomorrow-first',
      'quest-tasklet-weekly-review',
    ],
    discoveryPrompts: [
      prompt('tasklet', 'focus-style', 1, 'single_choice', 'When does focused work feel best for you?', 'Tasklet will shape future prompts around your style.', ['A clear deadline', 'A quiet block', 'Working with others', 'A visible checklist']),
      prompt('tasklet', 'focus-goal', 2, 'goal', 'What project deserves your attention right now?', 'Name the outcome, not every step.'),
    ],
    miniGameQuestIds: ['quest-tasklet-desk-jam', 'quest-tasklet-sort'],
    plannedMiniGame: null,
    insightThemes: ['focus rhythm', 'goals moved forward', 'workload patterns', 'finished versus started'],
    reflectionLenses: ['what deserved attention', 'what created friction', 'one meaningful next step', 'progress that is easy to miss'],
    goalTypes: ['project milestone', 'focus block', 'priority', 'completion'],
    status: 'complete',
  },
  pagelet: {
    role: 'Nurtures reading, learning, and ideas that stay with you.',
    boundary: 'Books and intentional learning, not museums, film, gaming, or general creative practice.',
    hatchSignals: ['book or reading log', 'bookstore', 'library', 'learning note'],
    realLifeQuestIds: [
      'quest-read-book',
      'quest-pagelet-curiosity-note',
      'quest-pagelet-learning-note',
      'quest-pagelet-weekly-review',
    ],
    discoveryPrompts: [
      prompt('pagelet', 'reading-taste', 1, 'free_text', 'What do you most enjoy reading or learning about?', 'A genre, subject, author, or curiosity all count.'),
      prompt('pagelet', 'learning-goal', 2, 'goal', 'What would you like to understand better?', 'Pagelet can help you notice progress toward it.'),
    ],
    miniGameQuestIds: ['quest-pagelet-word-paths', 'quest-pagelet-lost-word', 'quest-book-trivia'],
    plannedMiniGame: null,
    insightThemes: ['reading rhythm', 'subjects revisited', 'ideas captured', 'learning streaks'],
    reflectionLenses: ['what changed your mind', 'an idea worth keeping', 'questions still open', 'where curiosity led'],
    goalTypes: ['reading goal', 'learning topic', 'course progress', 'idea capture'],
    status: 'complete',
  },
  mossprout: {
    role: 'Encourages restorative time in nearby green spaces.',
    boundary: 'Parks, gardens, and accessible greenery—not wilderness travel, mountains, water, or weather.',
    hatchSignals: ['park visit', 'garden', 'green-space photo', 'time outdoors'],
    realLifeQuestIds: [
      'quest-mossprout-green-photo',
      'quest-mossprout-nature-note',
      'quest-mossprout-return',
      'quest-mossprout-weekly-review',
    ],
    discoveryPrompts: [
      prompt('mossprout', 'nature-place', 1, 'free_text', 'Which nearby green place feels good to return to?', 'It can be a park, garden, tree-lined street, or patch of grass.'),
      prompt('mossprout', 'outside-goal', 2, 'goal', 'What small outdoor rhythm would you like to grow?', 'Choose something possible in ordinary weeks.'),
    ],
    miniGameQuestIds: ['quest-mossprout-tend', 'quest-mossprout-memory'],
    plannedMiniGame: null,
    insightThemes: ['green-space visits', 'time outdoors', 'places revisited', 'nature and mood'],
    reflectionLenses: ['what you noticed outside', 'a place becoming familiar', 'how nature shifted the day', 'seasonal change'],
    goalTypes: ['park visit', 'outdoor break', 'garden care', 'nature noticing'],
    status: 'complete',
  },
  'coffee-ritual': {
    role: 'Uses a familiar drink ritual to create an intentional pause and give the day a small point of rhythm.',
    boundary: 'The pause and ritual around a drink, not caffeine consumption, cafés as destinations, cooking, or meals generally.',
    hatchSignals: ['coffee shop visit', 'coffee or tea moment', 'morning drink ritual', 'shared drink break'],
    realLifeQuestIds: [
      'quest-coffee-ritual-pause',
      'quest-coffee-ritual-note',
      'quest-coffee-ritual-redesign',
      'quest-coffee-ritual-weekly-review',
    ],
    discoveryPrompts: [
      prompt('coffee-ritual', 'ritual-gift', 1, 'single_choice', 'What do you most want a small drink ritual to give you?', 'Baristabbit cares about the pause, not what is in the cup.', ['A clear start', 'A real break', 'Comfort', 'Connection']),
      prompt('coffee-ritual', 'ritual-goal', 2, 'goal', 'What small ritual would make the day feel more deliberate?', 'Keep it simple enough for an ordinary day.'),
    ],
    miniGameQuestIds: ['quest-coffee-ritual-brew-sequence'],
    plannedMiniGame: null,
    insightThemes: ['ritual consistency', 'intentional pauses', 'solo versus shared breaks', 'cues for slowing down'],
    reflectionLenses: ['what the pause changed', 'why a ritual felt comforting', 'when the day needed a boundary', 'who shared the moment'],
    goalTypes: ['morning ritual', 'workday pause', 'shared drink', 'mindful transition'],
    status: 'complete',
  },
  errandimp: {
    role: 'Makes errands, chores, maintenance, and practical loose ends small enough to close.',
    boundary: 'Life administration and household upkeep, not meaningful project work, ambition, caregiving, or deep focus.',
    hatchSignals: ['errand loop', 'completed household task', 'admin note', 'maintenance day'],
    realLifeQuestIds: [
      'quest-errandimp-close-loop',
      'quest-errandimp-reset-note',
      'quest-errandimp-maintenance',
      'quest-errandimp-weekly-review',
    ],
    discoveryPrompts: [
      prompt('errandimp', 'admin-friction', 1, 'single_choice', 'Which practical tasks create the most drag?', 'Errandimp helps close loops rather than build a perfect system.', ['Appointments and forms', 'Household resets', 'Shopping and returns', 'Things I keep postponing']),
      prompt('errandimp', 'admin-goal', 2, 'goal', 'What part of practical life would feel lighter if it stayed handled?', 'Choose a workable rhythm, not an endless list.'),
    ],
    miniGameQuestIds: ['quest-errandimp-sort'],
    plannedMiniGame: null,
    insightThemes: ['loose loops closed', 'maintenance rhythm', 'postponed tasks', 'friction reduced'],
    reflectionLenses: ['what became lighter', 'why a small task lingered', 'which reset was worth repeating', 'what can wait'],
    goalTypes: ['admin rhythm', 'household reset', 'errand list', 'maintenance'],
    status: 'complete',
  },
  dawnle: {
    role: 'Helps the player shape the first part of the day into a kind, workable beginning.',
    boundary: 'Morning light, first actions, and starting rhythm, not sleep quality, bedtime, productivity output, or being an early-riser identity.',
    hatchSignals: ['activity before 8am', 'dawn photo', 'morning routine note', 'first-light moment'],
    realLifeQuestIds: [
      'quest-dawnle-first-light-photo',
      'quest-dawnle-morning-note',
      'quest-dawnle-prepare-start',
      'quest-dawnle-weekly-review',
    ],
    discoveryPrompts: [
      prompt('dawnle', 'morning-need', 1, 'single_choice', 'What would make mornings feel kinder?', 'Dawnle focuses on the beginning you can shape, not the hour you wake.', ['Less rushing', 'More light and movement', 'A clearer first step', 'A calmer first few minutes']),
      prompt('dawnle', 'morning-goal', 2, 'goal', 'What beginning would you like to practise?', 'One repeatable cue is enough.'),
    ],
    miniGameQuestIds: ['quest-dawnle-first-light'],
    plannedMiniGame: null,
    insightThemes: ['morning cues', 'rushed versus deliberate starts', 'light and energy', 'preparation that helped'],
    reflectionLenses: ['what set the tone', 'which first action helped', 'how the morning felt in the body', 'what reduced friction'],
    goalTypes: ['morning start', 'first light', 'phone boundary', 'prepare tomorrow'],
    status: 'complete',
  },
  mendle: {
    role: 'Supports emotional recovery through honest noticing, self-kindness, lower pressure, and small acts of repair.',
    boundary: 'Everyday emotional recovery and self-compassion, not clinical treatment, crisis support, rest alone, or solitary contemplation.',
    hatchSignals: ['tender-day check-in', 'emotion note', 'self-kindness reflection', 'support reached'],
    realLifeQuestIds: [
      'quest-mendle-honest-checkin',
      'quest-mendle-kind-action',
      'quest-mendle-repair-note',
      'quest-mendle-weekly-review',
    ],
    discoveryPrompts: [
      prompt('mendle', 'recovery-need', 1, 'single_choice', 'What is hardest on a tender day?', 'Mendle will respond gently and never ask you to optimise a feeling.', ['Naming what I feel', 'Lowering expectations', 'Being kind to myself', 'Asking for support']),
      prompt('mendle', 'recovery-goal', 2, 'goal', 'What would emotional recovery look like in small actions?', 'Choose something supportive rather than demanding.'),
    ],
    miniGameQuestIds: ['quest-mendle-breathe'],
    plannedMiniGame: null,
    insightThemes: ['emotional check-ins', 'self-talk', 'support used', 'recovery without pressure'],
    reflectionLenses: ['what the feeling needed', 'where pressure softened', 'a fairer story about yourself', 'what helped repair begin'],
    goalTypes: ['honest check-in', 'self-kindness', 'lower pressure', 'reach for support'],
    status: 'complete',
  },
  quietome: {
    role: 'Protects chosen solitude and reflection so recurring thoughts can become perspective rather than noise.',
    boundary: 'Intentional time alone and contemplation, not loneliness, sleep, emotional first aid, reading, or avoidance of relationships.',
    hatchSignals: ['reflection note', 'quiet library moment', 'solo pause', 'contemplative walk'],
    realLifeQuestIds: [
      'quest-quietome-one-line',
      'quest-quietome-solo-pause',
      'quest-quietome-returning-question',
      'quest-quietome-weekly-review',
    ],
    discoveryPrompts: [
      prompt('quietome', 'solitude-gift', 1, 'single_choice', 'What do you most need from time alone?', 'Quietome distinguishes chosen solitude from simply being isolated.', ['Perspective', 'Less input', 'Space to write', 'Time with an unanswered question']),
      prompt('quietome', 'solitude-goal', 2, 'goal', 'What reflective rhythm would help you hear yourself more clearly?', 'Small, regular pauses count.'),
    ],
    miniGameQuestIds: ['quest-quietome-still-signals'],
    plannedMiniGame: null,
    insightThemes: ['chosen solitude', 'recurring questions', 'reflection rhythm', 'input and quiet'],
    reflectionLenses: ['what became clearer', 'which thought returned', 'how solitude differed from isolation', 'what does not need an answer yet'],
    goalTypes: ['quiet pause', 'reflection practice', 'solo walk', 'returning question'],
    status: 'complete',
  },
  flickerbun: {
    role: 'Turns watching film and television into intentional enjoyment, conversation, and ideas worth keeping.',
    boundary: 'Film and television as chosen experiences, not books, gaming, music, or accidental screen time.',
    hatchSignals: ['film or show log', 'cinema visit', 'watching note', 'screen story recommendation'],
    realLifeQuestIds: [
      'quest-flickerbun-watch',
      'quest-flickerbun-scene-note',
      'quest-flickerbun-new-perspective',
      'quest-flickerbun-weekly-review',
    ],
    discoveryPrompts: [
      prompt('flickerbun', 'watching-taste', 1, 'single_choice', 'What do you most want from a story on screen?', 'Flickerbun uses this to understand your watching life.', ['Escape', 'Emotion', 'Ideas', 'Shared conversation']),
      prompt('flickerbun', 'watching-goal', 2, 'goal', 'What would make watching feel more intentional?', 'Choose a small change you can notice.'),
    ],
    miniGameQuestIds: ['quest-film-trivia'],
    plannedMiniGame: null,
    insightThemes: ['intentional versus automatic watching', 'genres revisited', 'stories shared', 'ideas that linger'],
    reflectionLenses: ['what stayed after the credits', 'why a story mattered', 'how watching felt', 'who shared the experience'],
    goalTypes: ['intentional watching', 'watchlist', 'new genres', 'screen-story reflection'],
    status: 'complete',
  },
  relicoon: {
    role: 'Builds curiosity about history, museums, objects, and the cultural stories carried through time.',
    boundary: 'Material history and cultural places, not general reading, film, travel sightseeing, or creative practice.',
    hatchSignals: ['museum or gallery visit', 'historic place', 'exhibit photo', 'cultural history note'],
    realLifeQuestIds: [
      'quest-relicoon-object-note',
      'quest-relicoon-museum-visit',
      'quest-relicoon-context-note',
      'quest-relicoon-weekly-review',
    ],
    discoveryPrompts: [
      prompt('relicoon', 'culture-curiosity', 1, 'single_choice', 'What draws you into the past?', 'Relicoon will follow the kind of cultural curiosity that feels alive to you.', ['People and daily life', 'Objects and design', 'Places and events', 'Art and meaning']),
      prompt('relicoon', 'culture-goal', 2, 'goal', 'What cultural thread would you enjoy following?', 'A place, period, object, or question all count.'),
    ],
    miniGameQuestIds: ['quest-relicoon-match'],
    plannedMiniGame: null,
    insightThemes: ['museum visits', 'historical threads', 'objects revisited', 'cultural questions'],
    reflectionLenses: ['the human story behind an object', 'what changed your view of the past', 'details worth preserving', 'connections across time'],
    goalTypes: ['museum visit', 'historical question', 'cultural trail', 'object story'],
    status: 'complete',
  },
  encora: {
    role: 'Makes music an active source of attention, expression, practice, and connection.',
    boundary: 'Listening to, sharing, making, and practising music, not film, general creativity, or passive background audio.',
    hatchSignals: ['music log', 'instrument or performance', 'listening note', 'live music'],
    realLifeQuestIds: [
      'quest-encora-listening-note',
      'quest-encora-music-moment',
      'quest-encora-practice-note',
      'quest-encora-weekly-review',
    ],
    discoveryPrompts: [
      prompt('encora', 'music-role', 1, 'single_choice', 'What role does music play most often in your life?', 'Encora is listening for how music already belongs to you.', ['It changes my mood', 'It helps me feel understood', 'I make or practise it', 'It connects me with people']),
      prompt('encora', 'music-goal', 2, 'goal', 'What musical direction would you like to return to?', 'Listening counts just as much as performing.'),
    ],
    miniGameQuestIds: ['quest-encora-rhythm'],
    plannedMiniGame: null,
    insightThemes: ['active listening', 'music and mood', 'practice rhythm', 'songs shared'],
    reflectionLenses: ['what you heard differently', 'why a song fit the moment', 'progress in practice', 'music that connected people'],
    goalTypes: ['listening ritual', 'music discovery', 'practice', 'shared music'],
    status: 'complete',
  },
  gatherglow: {
    role: 'Helps friendships and everyday belonging grow through attention, reaching out, and time shared.',
    boundary: 'Reciprocal friendship and social connection, not caregiving, community service, milestones, or merely being around people.',
    hatchSignals: ['social gathering', 'shared photo', 'friendship note', 'time with people'],
    realLifeQuestIds: [
      'quest-gatherglow-reach-out',
      'quest-gatherglow-shared-moment',
      'quest-gatherglow-deeper-checkin',
      'quest-gatherglow-weekly-review',
    ],
    discoveryPrompts: [
      prompt('gatherglow', 'connection-need', 1, 'single_choice', 'What kind of connection would feel most nourishing?', 'Gatherglow focuses on the relationships you want to participate in.', ['More regular contact', 'Deeper conversation', 'Shared activities', 'Feeling part of a group']),
      prompt('gatherglow', 'connection-goal', 2, 'goal', 'Which relationship or social rhythm would you like to tend?', 'Keep it specific enough to act on, without turning people into tasks.'),
    ],
    miniGameQuestIds: ['quest-gatherglow-pattern'],
    plannedMiniGame: null,
    insightThemes: ['reaching out', 'time shared', 'reciprocity', 'belonging'],
    reflectionLenses: ['what made connection feel real', 'who you want to return to', 'how attention changed a conversation', 'when belonging appeared'],
    goalTypes: ['reach out', 'shared plan', 'deeper conversation', 'group rhythm'],
    status: 'complete',
  },
  cheerlet: {
    role: 'Makes progress, achievements, beginnings, and endings visible enough to acknowledge and celebrate.',
    boundary: 'Meaningful milestones and chapter changes, not everyday productivity, general gratitude, or socialising.',
    hatchSignals: ['celebration', 'achievement note', 'birthday or milestone', 'new chapter'],
    realLifeQuestIds: [
      'quest-cheerlet-name-progress',
      'quest-cheerlet-celebrate-note',
      'quest-cheerlet-mark-chapter',
      'quest-cheerlet-weekly-review',
    ],
    discoveryPrompts: [
      prompt('cheerlet', 'celebration-style', 1, 'single_choice', 'What is easiest for you to overlook?', 'Cheerlet helps make progress visible without demanding a grand occasion.', ['Small wins', 'How far I have come', 'Other people’s help', 'Beginnings and endings']),
      prompt('cheerlet', 'celebration-goal', 2, 'goal', 'What progress or chapter deserves acknowledgement?', 'It can be unfinished and still worth marking.'),
    ],
    miniGameQuestIds: ['quest-cheerlet-block-party'],
    plannedMiniGame: null,
    insightThemes: ['progress acknowledged', 'milestones marked', 'chapters beginning and ending', 'celebrations shared'],
    reflectionLenses: ['what deserves credit', 'how the chapter changed you', 'who helped', 'how you want to remember it'],
    goalTypes: ['mark progress', 'celebrate milestone', 'close a chapter', 'honour support'],
    status: 'complete',
  },
  skylo: {
    role: 'Turns the city around you into a place to notice, explore, and gradually know.',
    boundary: 'Local urban discovery and neighbourhood curiosity, not long-distance travel, commuting, history study, or wilderness.',
    hatchSignals: ['city photo', 'new local place', 'neighbourhood walk', 'urban landmark'],
    realLifeQuestIds: [
      'quest-skylo-city-photo',
      'quest-skylo-local-stop',
      'quest-skylo-neighbourhood-note',
      'quest-skylo-weekly-review',
    ],
    discoveryPrompts: [
      prompt('skylo', 'city-curiosity', 1, 'single_choice', 'What makes a city interesting to you?', 'Skylo will shape exploration around what you genuinely notice.', ['Hidden places', 'Architecture and details', 'Food and local life', 'Different neighbourhoods']),
      prompt('skylo', 'city-goal', 2, 'goal', 'What part of your city would you like to know better?', 'Nearby counts; exploration does not require a trip.'),
    ],
    miniGameQuestIds: ['quest-skylo-city-trivia'],
    plannedMiniGame: null,
    insightThemes: ['local places discovered', 'neighbourhoods revisited', 'city details', 'small detours'],
    reflectionLenses: ['what made a place feel distinct', 'how familiarity changed', 'details usually passed by', 'where curiosity led'],
    goalTypes: ['local exploration', 'neighbourhood trail', 'city noticing', 'place list'],
    status: 'complete',
  },
  vesperitt: {
    role: 'Helps the player understand and shape the life they live after dark.',
    boundary: 'Being awake and meaningfully active late at night—not sleep, winding down, or recovery.',
    hatchSignals: ['activity between midnight and 4am', 'a late-night photo or note', 'a recurring night-owl rhythm'],
    realLifeQuestIds: [
      'quest-late-capture',
      'quest-vesperitt-night-note',
      'quest-vesperitt-next-day-note',
      'quest-vesperitt-weekly-review',
    ],
    discoveryPrompts: [
      prompt(
        'vesperitt',
        'night-mode',
        1,
        'single_choice',
        'What usually keeps you awake after everyone else has gone quiet?',
        'Vesperitt wants to understand what the small hours mean in your life.',
        ['Making or learning', 'Time with people', 'Work', 'Entertainment', 'Quiet time alone']
      ),
      prompt(
        'vesperitt',
        'night-intention',
        2,
        'goal',
        'How would you like your late nights to feel?',
        'You can protect, structure, or gently reduce them—there is no “correct” night.',
      ),
      prompt(
        'vesperitt',
        'night-gift',
        3,
        'free_text',
        'What can the night give you that the daytime usually cannot?',
        'A feeling, activity, or kind of space all count.',
      ),
    ],
    miniGameQuestIds: ['quest-vesperitt-moon-signals'],
    plannedMiniGame: null,
    insightThemes: ['late-night frequency', 'what fills the small hours', 'intentional versus accidental late nights', 'next-day energy'],
    reflectionLenses: ['what made the night worth staying up for', 'whether the night felt chosen', 'what the quiet made possible', 'how the next day felt'],
    goalTypes: ['protect a creative night', 'give late work a boundary', 'replace accidental scrolling', 'shift bedtime gently'],
    status: 'complete',
  },
};

export const katchimeraRoles: readonly KatchimeraRoleDefinition[] = katchimeraFamilies.map((family) => {
  const authored = FOUNDATION_ROLES[family.id];
  if (authored) return { familyId: family.id, aspectId: family.aspectId, displayName: family.displayName, ...authored };

  const aspect = lifeAspectById.get(family.aspectId);
  const anchor = katchimeraSkinById.get(family.anchorSkinId);
  const planned = !anchor || anchor.status === 'planned';
  return {
    familyId: family.id,
    aspectId: family.aspectId,
    displayName: family.displayName,
    role: aspect?.description ?? `Helps the player notice ${family.displayName}'s part of life.`,
    boundary: 'Awaiting a dedicated role review; broad category fallbacks remain temporary.',
    hatchSignals: [],
    realLifeQuestIds: [],
    discoveryPrompts: [
      prompt(family.id, 'notice', 1, 'single_choice', `What would you like ${family.displayName} to help you notice?`, 'Your answer gives this companion a starting direction.', ['Consistency', 'Enjoyment', 'Growth']),
    ],
    miniGameQuestIds: [],
    plannedMiniGame: `Design a signature activity for ${family.displayName}'s final role.`,
    insightThemes: [aspect?.label ?? family.displayName],
    reflectionLenses: [aspect?.description ?? 'What this part of life meant today.'],
    goalTypes: [],
    status: planned ? 'planned' : 'fallback',
  };
});

export const katchimeraRoleByFamilyId = new Map(katchimeraRoles.map((role) => [role.familyId, role]));

export function discoveryPromptsForFamily(
  familyId: KatchimeraFamilyId,
  bondLevel: KatchimeraBondLevel
): readonly CompanionDiscoveryPromptDefinition[] {
  return (katchimeraRoleByFamilyId.get(familyId)?.discoveryPrompts ?? [])
    .filter((promptDefinition) => promptDefinition.minimumBondLevel <= bondLevel);
}

export function validateKatchimeraRoleCatalogue(): string[] {
  const issues: string[] = [];
  for (const family of katchimeraFamilies) {
    const role = katchimeraRoleByFamilyId.get(family.id);
    if (!role) {
      issues.push(`${family.id}: missing role definition`);
      continue;
    }
    if (!role.role.trim() || !role.boundary.trim()) issues.push(`${family.id}: role or boundary is empty`);
    if (!role.discoveryPrompts.length) issues.push(`${family.id}: discovery lane is empty`);
    if (role.status === 'complete') {
      if (role.realLifeQuestIds.length < 2) issues.push(`${family.id}: complete role needs two real-life quests`);
      if (role.discoveryPrompts.length < 2) issues.push(`${family.id}: complete role needs two discovery prompts`);
      if (!role.miniGameQuestIds.length) issues.push(`${family.id}: complete role needs a mini-game`);
      if (role.plannedMiniGame) issues.push(`${family.id}: complete role still has a planned mini-game`);
    }
  }
  return issues;
}

export function katchimeraRoleCoverage() {
  return {
    total: katchimeraRoles.length,
    playable: katchimeraFamilies.filter((family) => family.anchorVisualKey !== null).length,
    complete: katchimeraRoles.filter((role) => role.status === 'complete').length,
    partial: katchimeraRoles.filter((role) => role.status === 'partial').length,
    fallback: katchimeraRoles.filter((role) => role.status === 'fallback').length,
    planned: katchimeraRoles.filter((role) => role.status === 'planned').length,
  };
}

function prompt(
  familyId: KatchimeraFamilyId,
  suffix: string,
  minimumBondLevel: KatchimeraBondLevel,
  kind: DiscoveryPromptKind,
  question: string,
  helperText: string,
  options?: readonly string[]
): CompanionDiscoveryPromptDefinition {
  return {
    id: `${familyId}:${suffix}`,
    familyId,
    minimumBondLevel,
    kind,
    question,
    helperText,
    options,
  };
}
