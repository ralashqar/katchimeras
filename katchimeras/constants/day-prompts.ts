import type { IconSymbolName } from '@/components/ui/icon-symbol';
import type { DayPromptEncounterBias, DayPromptKind, DayScores } from '@/types/home';

export type Daypart = 'morning' | 'midday' | 'evening';

export type DayPromptOption = {
  id: string;
  label: string;
  emoji: string;
  icon: IconSymbolName;
  semanticTags: string[];
  scoreBias: Partial<DayScores>;
  encounterSeedBias?: DayPromptEncounterBias[];
};

export type DayPromptDefinition = {
  id: DayPromptKind;
  title: string;
  body?: string;
  // The icon for this category in the "Add to today" grid.
  categoryIcon: IconSymbolName;
  dayparts: Daypart[];
  options: DayPromptOption[];
  maxOptions: number;
  launchEnabled: boolean;
  /** Eligible for the low-friction, rotating "About today" action card. */
  aboutTodayEnabled?: boolean;
  photoGated?: boolean;
  minPhotoCandidates?: number;
};

export const dayPromptRegistry: Record<DayPromptKind, DayPromptDefinition> = {
  feeling: {
    id: 'feeling',
    title: 'How are you feeling?',
    categoryIcon: 'face.smiling',
    dayparts: ['morning', 'midday', 'evening'],
    maxOptions: 8,
    // RETIRED as a strip prompt — the Mood sheet (mood-monument-sheet) owns
    // this question now and writes the same 'feeling' answer. Definition kept:
    // answers still resolve options/score bias through it.
    launchEnabled: false,
    options: [
      { id: 'calm', label: 'Calm', emoji: 'Calm', icon: 'face.happy', semanticTags: ['feeling:calm'], scoreBias: { calm: 0.34 } },
      { id: 'good', label: 'Good', emoji: 'Good', icon: 'face.happy', semanticTags: ['feeling:good'], scoreBias: { calm: 0.12, energy: 0.08 } },
      { id: 'energized', label: 'Energized', emoji: 'Energy', icon: 'face.very_happy', semanticTags: ['feeling:energized'], scoreBias: { energy: 0.34 } },
      {
        id: 'loved',
        label: 'Loved',
        emoji: 'Loved',
        icon: 'face.very_happy',
        semanticTags: ['feeling:loved'],
        scoreBias: { social: 0.3, calm: 0.12 },
        encounterSeedBias: [{ seedId: 'social_gathering', intensity: 0.34 }],
      },
      { id: 'meh', label: 'Meh', emoji: 'Meh', icon: 'face.neutral', semanticTags: ['feeling:meh'], scoreBias: { calm: 0.08 } },
      { id: 'drained', label: 'Drained', emoji: 'Drained', icon: 'face.sad', semanticTags: ['feeling:drained', 'body:tired'], scoreBias: { calm: 0.2 } },
      { id: 'low', label: 'Low', emoji: 'Low', icon: 'face.very_sad', semanticTags: ['feeling:low', 'tender_day'], scoreBias: { calm: 0.18 }, encounterSeedBias: [{ seedId: 'tender_day', intensity: 0.34 }] },
      { id: 'stressed', label: 'Stressed', emoji: 'Stress', icon: 'face.very_sad', semanticTags: ['feeling:stressed', 'restless_day'], scoreBias: { focus: 0.12, energy: 0.08 } },
    ],
  },
  sleep: {
    id: 'sleep',
    title: 'How did you sleep?',
    categoryIcon: 'bed.double.fill',
    dayparts: ['morning', 'midday'],
    maxOptions: 5,
    // RETIRED as a strip prompt — the Sleep sheet (sleep-sheet) owns this
    // question now (day.sleep). Definition kept for old stored answers.
    launchEnabled: false,
    options: [
      { id: 'great', label: 'Great', emoji: 'Great', icon: 'sun.max.fill', semanticTags: ['sleep:great'], scoreBias: { energy: 0.2, calm: 0.1 }, encounterSeedBias: [{ seedId: 'well_rested', intensity: 0.36 }] },
      { id: 'good', label: 'Good', emoji: 'Good', icon: 'moon.stars.fill', semanticTags: ['sleep:good'], scoreBias: { energy: 0.12, calm: 0.1 }, encounterSeedBias: [{ seedId: 'well_rested', intensity: 0.3 }] },
      { id: 'ok', label: 'OK', emoji: 'OK', icon: 'cloud.fill', semanticTags: ['sleep:ok'], scoreBias: { calm: 0.06 } },
      { id: 'poor', label: 'Poor', emoji: 'Poor', icon: 'cloud.rain.fill', semanticTags: ['sleep:poor', 'body:tired'], scoreBias: { calm: 0.16 }, encounterSeedBias: [{ seedId: 'tender_day', intensity: 0.28 }] },
      { id: 'barely', label: 'Barely', emoji: 'Barely', icon: 'cloud.fog.fill', semanticTags: ['sleep:barely', 'body:tired', 'tender_day'], scoreBias: { calm: 0.2 }, encounterSeedBias: [{ seedId: 'tender_day', intensity: 0.36 }] },
    ],
  },
  activity: {
    id: 'activity',
    title: 'What are you up to?',
    categoryIcon: 'figure.walk',
    dayparts: ['midday', 'evening'],
    maxOptions: 10,
    launchEnabled: true,
    options: [
      {
        id: 'family',
        label: 'Family',
        emoji: 'Family',
        icon: 'person.2.fill',
        semanticTags: ['activity:family', 'people:family'],
        scoreBias: { social: 0.24, calm: 0.06 },
        encounterSeedBias: [{ seedId: 'social_gathering', intensity: 0.38 }],
      },
      {
        id: 'friends',
        label: 'Friends',
        emoji: 'Friends',
        icon: 'bubble.left.and.bubble.right.fill',
        semanticTags: ['activity:friends', 'people:friends'],
        scoreBias: { social: 0.26 },
        encounterSeedBias: [{ seedId: 'social_gathering', intensity: 0.4 }],
      },
      { id: 'work', label: 'Work', emoji: 'Work', icon: 'briefcase.fill', semanticTags: ['activity:work'], scoreBias: { focus: 0.28 }, encounterSeedBias: [{ seedId: 'focus_day', intensity: 0.36 }] },
      { id: 'moving', label: 'Moving', emoji: 'Moving', icon: 'figure.walk', semanticTags: ['activity:moving'], scoreBias: { energy: 0.28 }, encounterSeedBias: [{ seedId: 'high_steps_day', intensity: 0.34 }] },
      { id: 'exercise', label: 'Exercise', emoji: 'Exercise', icon: 'dumbbell.fill', semanticTags: ['activity:exercise'], scoreBias: { energy: 0.3 }, encounterSeedBias: [{ seedId: 'gym_day', intensity: 0.4 }] },
      { id: 'errands', label: 'Errands', emoji: 'Errands', icon: 'cart.fill', semanticTags: ['activity:errands'], scoreBias: { energy: 0.12, focus: 0.08 }, encounterSeedBias: [{ seedId: 'errand_loop', intensity: 0.3 }] },
      { id: 'food', label: 'Food', emoji: 'Food', icon: 'fork.knife', semanticTags: ['activity:food'], scoreBias: { social: 0.08, calm: 0.08 }, encounterSeedBias: [{ seedId: 'feast', intensity: 0.32 }] },
      { id: 'outdoors', label: 'Outdoors', emoji: 'Outside', icon: 'leaf.fill', semanticTags: ['activity:outdoors'], scoreBias: { exploration: 0.2, calm: 0.08 }, encounterSeedBias: [{ seedId: 'park', intensity: 0.32 }] },
      { id: 'resting', label: 'Resting', emoji: 'Rest', icon: 'moon.stars.fill', semanticTags: ['activity:resting'], scoreBias: { calm: 0.24 }, encounterSeedBias: [{ seedId: 'home_evening', intensity: 0.34 }] },
      { id: 'new', label: 'Something new', emoji: 'New', icon: 'sparkles', semanticTags: ['activity:new', 'novelty'], scoreBias: { exploration: 0.28 } },
    ],
  },
  hobby: {
    id: 'hobby',
    title: 'Anything for you?',
    body: 'A hobby or thing you enjoyed.',
    categoryIcon: 'star.fill',
    dayparts: ['midday', 'evening'],
    maxOptions: 7,
    launchEnabled: true,
    options: [
      { id: 'movie', label: 'Movie / TV', emoji: 'Movie', icon: 'film.fill', semanticTags: ['hobby:movie'], scoreBias: { calm: 0.12, social: 0.06 }, encounterSeedBias: [{ seedId: 'cinema', intensity: 0.42 }] },
      { id: 'reading', label: 'Reading', emoji: 'Reading', icon: 'book.fill', semanticTags: ['hobby:reading'], scoreBias: { calm: 0.16, focus: 0.1 }, encounterSeedBias: [{ seedId: 'bookstore', intensity: 0.36 }] },
      { id: 'music', label: 'Music', emoji: 'Music', icon: 'music.note', semanticTags: ['hobby:music'], scoreBias: { calm: 0.12, energy: 0.06 }, encounterSeedBias: [{ seedId: 'live_music', intensity: 0.36 }] },
      { id: 'gaming', label: 'Gaming', emoji: 'Gaming', icon: 'gamecontroller.fill', semanticTags: ['hobby:gaming'], scoreBias: { focus: 0.12, energy: 0.06 }, encounterSeedBias: [{ seedId: 'gaming_session', intensity: 0.4 }] },
      { id: 'cooking', label: 'Cooking', emoji: 'Cooking', icon: 'fork.knife.circle.fill', semanticTags: ['hobby:cooking'], scoreBias: { calm: 0.12, focus: 0.08 }, encounterSeedBias: [{ seedId: 'feast', intensity: 0.3 }] },
      { id: 'creating', label: 'Creating', emoji: 'Creating', icon: 'paintbrush.fill', semanticTags: ['hobby:creating'], scoreBias: { focus: 0.14, exploration: 0.06 }, encounterSeedBias: [{ seedId: 'creative_day', intensity: 0.42 }] },
      { id: 'sport', label: 'Sport', emoji: 'Sport', icon: 'figure.run', semanticTags: ['hobby:sport'], scoreBias: { energy: 0.24 }, encounterSeedBias: [{ seedId: 'gym_day', intensity: 0.34 }] },
    ],
  },
  people: {
    id: 'people',
    title: "Who's here?",
    categoryIcon: 'person.2.fill',
    dayparts: ['midday', 'evening'],
    maxOptions: 6,
    launchEnabled: true,
    options: [
      { id: 'just_me', label: 'Just me', emoji: 'Solo', icon: 'moon.stars.fill', semanticTags: ['people:solo'], scoreBias: { calm: 0.12, focus: 0.06 } },
      {
        id: 'my_child',
        label: 'My child',
        emoji: 'My child',
        icon: 'heart.fill',
        semanticTags: ['people:my_child', 'relationship:my_child'],
        scoreBias: { social: 0.28, calm: 0.08 },
        encounterSeedBias: [{ seedId: 'parenting_care', intensity: 0.52 }],
      },
      {
        id: 'family',
        label: 'Family',
        emoji: 'Family',
        icon: 'person.2.fill',
        semanticTags: ['people:family'],
        scoreBias: { social: 0.26, calm: 0.08 },
        encounterSeedBias: [{ seedId: 'social_gathering', intensity: 0.42 }],
      },
      {
        id: 'partner',
        label: 'Partner',
        emoji: 'Partner',
        icon: 'heart.fill',
        semanticTags: ['people:partner', 'feeling:loved'],
        scoreBias: { social: 0.24, calm: 0.1 },
        encounterSeedBias: [{ seedId: 'close_relationship', intensity: 0.46 }],
      },
      {
        id: 'friends',
        label: 'Friends',
        emoji: 'Friends',
        icon: 'bubble.left.and.bubble.right.fill',
        semanticTags: ['people:friends'],
        scoreBias: { social: 0.28 },
        encounterSeedBias: [{ seedId: 'social_gathering', intensity: 0.42 }],
      },
      {
        id: 'community',
        label: 'Helping out',
        emoji: 'Helping',
        icon: 'hands.sparkles.fill',
        semanticTags: ['people:community', 'meaning:support'],
        scoreBias: { social: 0.2, focus: 0.08 },
        encounterSeedBias: [{ seedId: 'community_contribution', intensity: 0.46 }],
      },
    ],
  },
  meaning: {
    id: 'meaning',
    title: 'What made this matter?',
    categoryIcon: 'heart.fill',
    dayparts: ['evening'],
    maxOptions: 6,
    // The photo's meaning is now asked in-flow on the photo-essence screen
    // (select a photo → read its essence → "what did this mean?"), so the
    // standalone prompt no longer surfaces.
    launchEnabled: false,
    options: [
      { id: 'time_together', label: 'Time together', emoji: 'Together', icon: 'person.2.fill', semanticTags: ['meaning:time_together'], scoreBias: { social: 0.22, calm: 0.08 }, encounterSeedBias: [{ seedId: 'social_gathering', intensity: 0.36 }] },
      { id: 'peaceful', label: 'Peaceful', emoji: 'Peace', icon: 'moon.stars.fill', semanticTags: ['meaning:peaceful'], scoreBias: { calm: 0.24 } },
      { id: 'celebration', label: 'Celebration', emoji: 'Celebrate', icon: 'party.popper.fill', semanticTags: ['meaning:celebration'], scoreBias: { social: 0.18, energy: 0.08 }, encounterSeedBias: [{ seedId: 'celebration', intensity: 0.42 }] },
      { id: 'growth', label: 'Growth', emoji: 'Growth', icon: 'leaf.fill', semanticTags: ['meaning:growth'], scoreBias: { focus: 0.18, exploration: 0.08 } },
      { id: 'got_through_it', label: 'Got through it', emoji: 'Through', icon: 'bolt.fill', semanticTags: ['meaning:got_through_it', 'tender_day'], scoreBias: { calm: 0.16, focus: 0.1 }, encounterSeedBias: [{ seedId: 'tender_day', intensity: 0.36 }] },
      { id: 'worth_keeping', label: 'Worth keeping', emoji: 'Keep', icon: 'star.fill', semanticTags: ['meaning:worth_keeping'], scoreBias: { calm: 0.12, focus: 0.08 } },
    ],
  },
  day_word: {
    id: 'day_word',
    title: 'Sum it up?',
    categoryIcon: 'sparkles',
    dayparts: ['evening'],
    maxOptions: 8,
    launchEnabled: true,
    aboutTodayEnabled: true,
    options: [
      { id: 'cozy', label: 'Cozy', emoji: 'Cozy', icon: 'moon.stars.fill', semanticTags: ['word:cozy', 'feeling:calm'], scoreBias: { calm: 0.16 } },
      { id: 'productive', label: 'Productive', emoji: 'Done', icon: 'bolt.fill', semanticTags: ['word:productive'], scoreBias: { focus: 0.16 } },
      { id: 'hard', label: 'Hard', emoji: 'Hard', icon: 'cloud.rain.fill', semanticTags: ['word:hard', 'tender_day'], scoreBias: { calm: 0.1 }, encounterSeedBias: [{ seedId: 'tender_day', intensity: 0.3 }] },
      { id: 'lovely', label: 'Lovely', emoji: 'Lovely', icon: 'heart.fill', semanticTags: ['word:lovely', 'feeling:loved'], scoreBias: { social: 0.12, calm: 0.08 } },
      { id: 'long', label: 'Long', emoji: 'Long', icon: 'cloud.fog.fill', semanticTags: ['word:long', 'body:tired'], scoreBias: { calm: 0.08 } },
      { id: 'full', label: 'Full', emoji: 'Full', icon: 'sun.max.fill', semanticTags: ['word:full'], scoreBias: { energy: 0.08, social: 0.08 } },
      { id: 'quiet', label: 'Quiet', emoji: 'Quiet', icon: 'cloud.fill', semanticTags: ['word:quiet'], scoreBias: { calm: 0.14 } },
      { id: 'big', label: 'Big', emoji: 'Big', icon: 'sparkles', semanticTags: ['word:big', 'novelty'], scoreBias: { exploration: 0.12, energy: 0.08 } },
    ],
  },
  day_focus: {
    id: 'day_focus',
    title: 'What was today mostly about?',
    body: 'Choose the closest fit.',
    categoryIcon: 'sparkles',
    dayparts: ['midday', 'evening'],
    maxOptions: 6,
    launchEnabled: false,
    aboutTodayEnabled: true,
    options: [
      { id: 'people', label: 'People', emoji: 'People', icon: 'person.2.fill', semanticTags: ['day_focus:people'], scoreBias: { social: 0.26, calm: 0.06 }, encounterSeedBias: [{ seedId: 'social_gathering', intensity: 0.42 }] },
      { id: 'progress', label: 'Progress', emoji: 'Progress', icon: 'briefcase.fill', semanticTags: ['day_focus:progress'], scoreBias: { focus: 0.28 }, encounterSeedBias: [{ seedId: 'focus_day', intensity: 0.42 }] },
      { id: 'places', label: 'Places', emoji: 'Places', icon: 'mappin.and.ellipse', semanticTags: ['day_focus:places'], scoreBias: { exploration: 0.28, energy: 0.06 }, encounterSeedBias: [{ seedId: 'travel_day', intensity: 0.38 }] },
      { id: 'rest', label: 'Rest', emoji: 'Rest', icon: 'moon.stars.fill', semanticTags: ['day_focus:rest'], scoreBias: { calm: 0.28 }, encounterSeedBias: [{ seedId: 'home_evening', intensity: 0.4 }] },
      { id: 'fun', label: 'Fun', emoji: 'Fun', icon: 'party.popper.fill', semanticTags: ['day_focus:fun'], scoreBias: { social: 0.12, energy: 0.16 }, encounterSeedBias: [{ seedId: 'celebration', intensity: 0.38 }] },
      { id: 'getting_through', label: 'Getting through', emoji: 'Through', icon: 'cloud.rain.fill', semanticTags: ['day_focus:getting_through', 'tender_day'], scoreBias: { calm: 0.16, focus: 0.1 }, encounterSeedBias: [{ seedId: 'tender_day', intensity: 0.38 }] },
    ],
  },
  day_character: {
    id: 'day_character',
    title: 'What kind of day was it?',
    body: 'Choose the shape it took.',
    categoryIcon: 'sun.max.fill',
    dayparts: ['midday', 'evening'],
    maxOptions: 6,
    launchEnabled: false,
    aboutTodayEnabled: true,
    options: [
      { id: 'building', label: 'Building', emoji: 'Building', icon: 'briefcase.fill', semanticTags: ['day_character:building'], scoreBias: { focus: 0.24 }, encounterSeedBias: [{ seedId: 'focus_day', intensity: 0.38 }] },
      { id: 'connecting', label: 'Connecting', emoji: 'Connecting', icon: 'person.2.fill', semanticTags: ['day_character:connecting'], scoreBias: { social: 0.26 }, encounterSeedBias: [{ seedId: 'social_gathering', intensity: 0.42 }] },
      { id: 'exploring', label: 'Exploring', emoji: 'Exploring', icon: 'mappin.and.ellipse', semanticTags: ['day_character:exploring'], scoreBias: { exploration: 0.27 }, encounterSeedBias: [{ seedId: 'travel_day', intensity: 0.4 }] },
      { id: 'recovering', label: 'Recovering', emoji: 'Recovering', icon: 'moon.stars.fill', semanticTags: ['day_character:recovering'], scoreBias: { calm: 0.27 }, encounterSeedBias: [{ seedId: 'home_evening', intensity: 0.38 }] },
      { id: 'celebrating', label: 'Celebrating', emoji: 'Celebrating', icon: 'party.popper.fill', semanticTags: ['day_character:celebrating'], scoreBias: { social: 0.18, energy: 0.12 }, encounterSeedBias: [{ seedId: 'celebration', intensity: 0.42 }] },
      { id: 'enduring', label: 'Enduring', emoji: 'Enduring', icon: 'cloud.rain.fill', semanticTags: ['day_character:enduring', 'tender_day'], scoreBias: { calm: 0.14, focus: 0.12 }, encounterSeedBias: [{ seedId: 'tender_day', intensity: 0.38 }] },
    ],
  },
  day_outcome: {
    id: 'day_outcome',
    title: 'What did today give you?',
    body: 'Choose what you are taking from it.',
    categoryIcon: 'leaf.fill',
    dayparts: ['midday', 'evening'],
    maxOptions: 6,
    launchEnabled: false,
    aboutTodayEnabled: true,
    options: [
      { id: 'progress', label: 'Progress', emoji: 'Progress', icon: 'briefcase.fill', semanticTags: ['day_outcome:progress'], scoreBias: { focus: 0.22 }, encounterSeedBias: [{ seedId: 'focus_day', intensity: 0.34 }] },
      { id: 'connection', label: 'Connection', emoji: 'Connection', icon: 'heart.fill', semanticTags: ['day_outcome:connection'], scoreBias: { social: 0.24, calm: 0.06 }, encounterSeedBias: [{ seedId: 'social_gathering', intensity: 0.38 }] },
      { id: 'energy', label: 'Energy', emoji: 'Energy', icon: 'bolt.fill', semanticTags: ['day_outcome:energy'], scoreBias: { energy: 0.24 }, encounterSeedBias: [{ seedId: 'high_steps_day', intensity: 0.32 }] },
      { id: 'rest', label: 'Rest', emoji: 'Rest', icon: 'moon.stars.fill', semanticTags: ['day_outcome:rest'], scoreBias: { calm: 0.26 }, encounterSeedBias: [{ seedId: 'home_evening', intensity: 0.36 }] },
      { id: 'perspective', label: 'Perspective', emoji: 'Perspective', icon: 'sparkles', semanticTags: ['day_outcome:perspective'], scoreBias: { exploration: 0.12, focus: 0.14 }, encounterSeedBias: [{ seedId: 'creative_day', intensity: 0.28 }] },
      { id: 'a_memory', label: 'A memory', emoji: 'Memory', icon: 'star.fill', semanticTags: ['day_outcome:memory'], scoreBias: { calm: 0.1, social: 0.08, exploration: 0.08 }, encounterSeedBias: [{ seedId: 'golden_hour', intensity: 0.28 }] },
    ],
  },
  meaningful_photo: {
    id: 'meaningful_photo',
    title: 'Was there a photo today that meant something?',
    body: 'Pick one to carry into the hatch.',
    categoryIcon: 'camera.fill',
    dayparts: ['evening'],
    maxOptions: 0,
    launchEnabled: true,
    photoGated: true,
    // Even a single keeper photo from today is enough to offer the prompt, so
    // the app reacts to "you took a photo" rather than waiting for a photo-heavy
    // day. Curation already drops screenshots / blurry / duplicate frames.
    minPhotoCandidates: 1,
    options: [],
  },
  intention: { id: 'intention', title: 'What do you want from today?', categoryIcon: 'sparkles', dayparts: ['morning'], maxOptions: 5, launchEnabled: false, options: [] },
  energy: { id: 'energy', title: "What was today's pace?", categoryIcon: 'bolt.fill', dayparts: ['midday', 'evening'], maxOptions: 6, launchEnabled: false, aboutTodayEnabled: true, options: [
    { id: 'slow', label: 'Slow', emoji: 'Slow', icon: 'moon.stars.fill', semanticTags: ['pace:slow'], scoreBias: { calm: 0.22 }, encounterSeedBias: [{ seedId: 'home_evening', intensity: 0.3 }] },
    { id: 'steady', label: 'Steady', emoji: 'Steady', icon: 'figure.walk', semanticTags: ['pace:steady'], scoreBias: { focus: 0.16, calm: 0.08 } },
    { id: 'busy', label: 'Busy', emoji: 'Busy', icon: 'briefcase.fill', semanticTags: ['pace:busy'], scoreBias: { focus: 0.14, energy: 0.12 }, encounterSeedBias: [{ seedId: 'errand_loop', intensity: 0.3 }] },
    { id: 'intense', label: 'Intense', emoji: 'Intense', icon: 'bolt.fill', semanticTags: ['pace:intense'], scoreBias: { energy: 0.22, focus: 0.08 }, encounterSeedBias: [{ seedId: 'high_steps_day', intensity: 0.3 }] },
    { id: 'stop_start', label: 'Stop-start', emoji: 'Stop-start', icon: 'cloud.fog.fill', semanticTags: ['pace:stop_start'], scoreBias: { exploration: 0.1, calm: 0.06 } },
    { id: 'easy_going', label: 'Easy-going', emoji: 'Easy', icon: 'cloud.fill', semanticTags: ['pace:easy_going'], scoreBias: { calm: 0.24 }, encounterSeedBias: [{ seedId: 'home_evening', intensity: 0.3 }] },
  ] },
  inner_weather: { id: 'inner_weather', title: "Today's inner weather?", categoryIcon: 'cloud.sun.fill', dayparts: ['midday', 'evening'], maxOptions: 6, launchEnabled: false, options: [] },
  highlight: { id: 'highlight', title: 'Best bit so far?', categoryIcon: 'star.fill', dayparts: ['evening'], maxOptions: 6, launchEnabled: false, options: [] },
  gratitude: { id: 'gratitude', title: 'One good thing today?', categoryIcon: 'heart.fill', dayparts: ['evening'], maxOptions: 4, launchEnabled: false, options: [] },
  body: { id: 'body', title: "How's the body?", categoryIcon: 'figure.walk', dayparts: ['midday', 'evening'], maxOptions: 4, launchEnabled: false, options: [] },
  for_who: { id: 'for_who', title: 'Who was today really about?', categoryIcon: 'person.2.fill', dayparts: ['midday', 'evening'], maxOptions: 6, launchEnabled: false, aboutTodayEnabled: true, options: [
    { id: 'just_me', label: 'Just me', emoji: 'Me', icon: 'moon.stars.fill', semanticTags: ['for_who:self'], scoreBias: { calm: 0.14, focus: 0.06 } },
    { id: 'partner', label: 'My partner', emoji: 'Partner', icon: 'heart.fill', semanticTags: ['for_who:partner'], scoreBias: { social: 0.24, calm: 0.08 }, encounterSeedBias: [{ seedId: 'close_relationship', intensity: 0.42 }] },
    { id: 'family', label: 'Family', emoji: 'Family', icon: 'person.2.fill', semanticTags: ['for_who:family'], scoreBias: { social: 0.26, calm: 0.06 }, encounterSeedBias: [{ seedId: 'social_gathering', intensity: 0.38 }] },
    { id: 'friends', label: 'Friends', emoji: 'Friends', icon: 'bubble.left.and.bubble.right.fill', semanticTags: ['for_who:friends'], scoreBias: { social: 0.26 }, encounterSeedBias: [{ seedId: 'social_gathering', intensity: 0.4 }] },
    { id: 'work_community', label: 'Work / community', emoji: 'Community', icon: 'briefcase.fill', semanticTags: ['for_who:community'], scoreBias: { social: 0.14, focus: 0.14 }, encounterSeedBias: [{ seedId: 'community_contribution', intensity: 0.36 }] },
    { id: 'a_mix', label: 'A mix', emoji: 'Mix', icon: 'sparkles', semanticTags: ['for_who:mix'], scoreBias: { social: 0.14, exploration: 0.08 } },
  ] },
};

export const ABOUT_TODAY_MAX_PER_DAY = 2;
export const aboutTodayPromptKinds = Object.values(dayPromptRegistry)
  .filter((prompt) => prompt.aboutTodayEnabled)
  .map((prompt) => prompt.id);
const ABOUT_TODAY_KIND_SET = new Set<DayPromptKind>(aboutTodayPromptKinds);
const REFLECTIVE_KIND_SET = new Set<DayPromptKind>([
  'feeling', 'inner_weather', 'meaning', 'gratitude', 'highlight', 'intention', ...aboutTodayPromptKinds,
]);

export function isAboutTodayPromptKind(kind: DayPromptKind): boolean {
  return ABOUT_TODAY_KIND_SET.has(kind);
}

export function isReflectiveDayPromptKind(kind: DayPromptKind): boolean {
  return REFLECTIVE_KIND_SET.has(kind);
}

export function isRewardedReflectionPromptKind(kind: DayPromptKind): boolean {
  return kind === 'meaning' || kind === 'highlight' || kind === 'gratitude' || isAboutTodayPromptKind(kind);
}

export const launchedDayPrompts = Object.values(dayPromptRegistry).filter((prompt) => prompt.launchEnabled);

// Short labels for the "Add to today" category buttons (the prompt titles are
// full questions — too long for a chip).
export const dayPromptMenuLabels: Record<DayPromptKind, string> = {
  feeling: 'Mood',
  sleep: 'Sleep',
  activity: 'Activity',
  hobby: 'Hobby',
  people: 'People',
  meaning: 'Photo meaning',
  day_word: 'A word',
  day_focus: 'Day focus',
  day_character: 'Day shape',
  day_outcome: 'Day gave me',
  meaningful_photo: 'Recent photo',
  intention: 'Intention',
  energy: 'Energy',
  inner_weather: 'Inner weather',
  highlight: 'Highlight',
  gratitude: 'Gratitude',
  body: 'Body',
  for_who: 'For who',
};
