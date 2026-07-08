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
    maxOptions: 8,
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
    maxOptions: 5,
    launchEnabled: true,
    options: [
      { id: 'just_me', label: 'Just me', emoji: 'Solo', icon: 'moon.stars.fill', semanticTags: ['people:solo'], scoreBias: { calm: 0.12, focus: 0.06 } },
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
        encounterSeedBias: [{ seedId: 'social_gathering', intensity: 0.4 }],
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
      { id: 'someone_new', label: 'Someone new', emoji: 'New', icon: 'sparkles', semanticTags: ['people:someone_new', 'novelty'], scoreBias: { social: 0.22, exploration: 0.1 } },
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
  energy: { id: 'energy', title: "What's the pace today?", categoryIcon: 'bolt.fill', dayparts: ['midday', 'evening'], maxOptions: 4, launchEnabled: false, options: [] },
  inner_weather: { id: 'inner_weather', title: "Today's inner weather?", categoryIcon: 'cloud.sun.fill', dayparts: ['midday', 'evening'], maxOptions: 6, launchEnabled: false, options: [] },
  highlight: { id: 'highlight', title: 'Best bit so far?', categoryIcon: 'star.fill', dayparts: ['evening'], maxOptions: 6, launchEnabled: false, options: [] },
  gratitude: { id: 'gratitude', title: 'One good thing today?', categoryIcon: 'heart.fill', dayparts: ['evening'], maxOptions: 4, launchEnabled: false, options: [] },
  body: { id: 'body', title: "How's the body?", categoryIcon: 'figure.walk', dayparts: ['midday', 'evening'], maxOptions: 4, launchEnabled: false, options: [] },
  for_who: { id: 'for_who', title: 'Who was today really about?', categoryIcon: 'person.2.fill', dayparts: ['evening'], maxOptions: 5, launchEnabled: false, options: [] },
};

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
  meaningful_photo: 'Photo',
  intention: 'Intention',
  energy: 'Energy',
  inner_weather: 'Inner weather',
  highlight: 'Highlight',
  gratitude: 'Gratitude',
  body: 'Body',
  for_who: 'For who',
};
