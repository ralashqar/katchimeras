import type { DayPromptEncounterBias, DayPromptKind, DayScores } from '@/types/home';

export type Daypart = 'morning' | 'midday' | 'evening';

export type DayPromptOption = {
  id: string;
  label: string;
  emoji: string;
  semanticTags: string[];
  scoreBias: Partial<DayScores>;
  encounterSeedBias?: DayPromptEncounterBias[];
};

export type DayPromptDefinition = {
  id: DayPromptKind;
  title: string;
  body?: string;
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
    dayparts: ['morning', 'midday', 'evening'],
    maxOptions: 8,
    launchEnabled: true,
    options: [
      { id: 'calm', label: 'Calm', emoji: 'Calm', semanticTags: ['feeling:calm'], scoreBias: { calm: 0.34 } },
      { id: 'good', label: 'Good', emoji: 'Good', semanticTags: ['feeling:good'], scoreBias: { calm: 0.12, energy: 0.08 } },
      { id: 'energized', label: 'Energized', emoji: 'Energy', semanticTags: ['feeling:energized'], scoreBias: { energy: 0.34 } },
      {
        id: 'loved',
        label: 'Loved',
        emoji: 'Loved',
        semanticTags: ['feeling:loved'],
        scoreBias: { social: 0.3, calm: 0.12 },
        encounterSeedBias: [{ seedId: 'social_gathering', intensity: 0.34 }],
      },
      { id: 'meh', label: 'Meh', emoji: 'Meh', semanticTags: ['feeling:meh'], scoreBias: { calm: 0.08 } },
      { id: 'drained', label: 'Drained', emoji: 'Drained', semanticTags: ['feeling:drained', 'body:tired'], scoreBias: { calm: 0.2 } },
      { id: 'low', label: 'Low', emoji: 'Low', semanticTags: ['feeling:low', 'tender_day'], scoreBias: { calm: 0.18 } },
      { id: 'stressed', label: 'Stressed', emoji: 'Stress', semanticTags: ['feeling:stressed', 'restless_day'], scoreBias: { focus: 0.12, energy: 0.08 } },
    ],
  },
  activity: {
    id: 'activity',
    title: 'What are you up to?',
    dayparts: ['midday', 'evening'],
    maxOptions: 8,
    launchEnabled: true,
    options: [
      {
        id: 'family',
        label: 'Family',
        emoji: 'Family',
        semanticTags: ['activity:family', 'people:family'],
        scoreBias: { social: 0.24, calm: 0.06 },
        encounterSeedBias: [{ seedId: 'social_gathering', intensity: 0.38 }],
      },
      {
        id: 'friends',
        label: 'Friends',
        emoji: 'Friends',
        semanticTags: ['activity:friends', 'people:friends'],
        scoreBias: { social: 0.26 },
        encounterSeedBias: [{ seedId: 'social_gathering', intensity: 0.4 }],
      },
      { id: 'work', label: 'Work', emoji: 'Work', semanticTags: ['activity:work'], scoreBias: { focus: 0.28 }, encounterSeedBias: [{ seedId: 'focus_day', intensity: 0.36 }] },
      { id: 'moving', label: 'Moving', emoji: 'Moving', semanticTags: ['activity:moving'], scoreBias: { energy: 0.28 }, encounterSeedBias: [{ seedId: 'high_steps_day', intensity: 0.34 }] },
      { id: 'food', label: 'Food', emoji: 'Food', semanticTags: ['activity:food'], scoreBias: { social: 0.08, calm: 0.08 }, encounterSeedBias: [{ seedId: 'feast', intensity: 0.32 }] },
      { id: 'outdoors', label: 'Outdoors', emoji: 'Outside', semanticTags: ['activity:outdoors'], scoreBias: { exploration: 0.2, calm: 0.08 }, encounterSeedBias: [{ seedId: 'park', intensity: 0.32 }] },
      { id: 'resting', label: 'Resting', emoji: 'Rest', semanticTags: ['activity:resting'], scoreBias: { calm: 0.24 }, encounterSeedBias: [{ seedId: 'home_evening', intensity: 0.34 }] },
      { id: 'new', label: 'Something new', emoji: 'New', semanticTags: ['activity:new', 'novelty'], scoreBias: { exploration: 0.28 } },
    ],
  },
  people: {
    id: 'people',
    title: "Who's here?",
    dayparts: ['midday', 'evening'],
    maxOptions: 5,
    launchEnabled: true,
    options: [
      { id: 'just_me', label: 'Just me', emoji: 'Solo', semanticTags: ['people:solo'], scoreBias: { calm: 0.12, focus: 0.06 } },
      {
        id: 'family',
        label: 'Family',
        emoji: 'Family',
        semanticTags: ['people:family'],
        scoreBias: { social: 0.26, calm: 0.08 },
        encounterSeedBias: [{ seedId: 'social_gathering', intensity: 0.42 }],
      },
      {
        id: 'partner',
        label: 'Partner',
        emoji: 'Partner',
        semanticTags: ['people:partner', 'feeling:loved'],
        scoreBias: { social: 0.24, calm: 0.1 },
        encounterSeedBias: [{ seedId: 'social_gathering', intensity: 0.4 }],
      },
      {
        id: 'friends',
        label: 'Friends',
        emoji: 'Friends',
        semanticTags: ['people:friends'],
        scoreBias: { social: 0.28 },
        encounterSeedBias: [{ seedId: 'social_gathering', intensity: 0.42 }],
      },
      { id: 'someone_new', label: 'Someone new', emoji: 'New', semanticTags: ['people:someone_new', 'novelty'], scoreBias: { social: 0.22, exploration: 0.1 } },
    ],
  },
  meaning: {
    id: 'meaning',
    title: 'What made this matter?',
    dayparts: ['evening'],
    maxOptions: 6,
    launchEnabled: true,
    options: [
      { id: 'time_together', label: 'Time together', emoji: 'Together', semanticTags: ['meaning:time_together'], scoreBias: { social: 0.22, calm: 0.08 }, encounterSeedBias: [{ seedId: 'social_gathering', intensity: 0.36 }] },
      { id: 'peaceful', label: 'Peaceful', emoji: 'Peace', semanticTags: ['meaning:peaceful'], scoreBias: { calm: 0.24 } },
      { id: 'celebration', label: 'Celebration', emoji: 'Celebrate', semanticTags: ['meaning:celebration'], scoreBias: { social: 0.18, energy: 0.08 }, encounterSeedBias: [{ seedId: 'celebration', intensity: 0.42 }] },
      { id: 'growth', label: 'Growth', emoji: 'Growth', semanticTags: ['meaning:growth'], scoreBias: { focus: 0.18, exploration: 0.08 } },
      { id: 'got_through_it', label: 'Got through it', emoji: 'Through', semanticTags: ['meaning:got_through_it', 'tender_day'], scoreBias: { calm: 0.16, focus: 0.1 } },
      { id: 'worth_keeping', label: 'Worth keeping', emoji: 'Keep', semanticTags: ['meaning:worth_keeping'], scoreBias: { calm: 0.12, focus: 0.08 } },
    ],
  },
  day_word: {
    id: 'day_word',
    title: 'Sum it up?',
    dayparts: ['evening'],
    maxOptions: 8,
    launchEnabled: true,
    options: [
      { id: 'cozy', label: 'Cozy', emoji: 'Cozy', semanticTags: ['word:cozy', 'feeling:calm'], scoreBias: { calm: 0.16 } },
      { id: 'productive', label: 'Productive', emoji: 'Done', semanticTags: ['word:productive'], scoreBias: { focus: 0.16 } },
      { id: 'hard', label: 'Hard', emoji: 'Hard', semanticTags: ['word:hard', 'tender_day'], scoreBias: { calm: 0.1 } },
      { id: 'lovely', label: 'Lovely', emoji: 'Lovely', semanticTags: ['word:lovely', 'feeling:loved'], scoreBias: { social: 0.12, calm: 0.08 } },
      { id: 'long', label: 'Long', emoji: 'Long', semanticTags: ['word:long', 'body:tired'], scoreBias: { calm: 0.08 } },
      { id: 'full', label: 'Full', emoji: 'Full', semanticTags: ['word:full'], scoreBias: { energy: 0.08, social: 0.08 } },
      { id: 'quiet', label: 'Quiet', emoji: 'Quiet', semanticTags: ['word:quiet'], scoreBias: { calm: 0.14 } },
      { id: 'big', label: 'Big', emoji: 'Big', semanticTags: ['word:big', 'novelty'], scoreBias: { exploration: 0.12, energy: 0.08 } },
    ],
  },
  meaningful_photo: {
    id: 'meaningful_photo',
    title: 'Was there a photo today that meant something?',
    body: 'Pick one to carry into the hatch.',
    dayparts: ['evening'],
    maxOptions: 0,
    launchEnabled: true,
    photoGated: true,
    minPhotoCandidates: 3,
    options: [],
  },
  intention: { id: 'intention', title: 'What do you want from today?', dayparts: ['morning'], maxOptions: 5, launchEnabled: false, options: [] },
  energy: { id: 'energy', title: "What's the pace today?", dayparts: ['midday', 'evening'], maxOptions: 4, launchEnabled: false, options: [] },
  inner_weather: { id: 'inner_weather', title: "Today's inner weather?", dayparts: ['midday', 'evening'], maxOptions: 6, launchEnabled: false, options: [] },
  highlight: { id: 'highlight', title: 'Best bit so far?', dayparts: ['evening'], maxOptions: 6, launchEnabled: false, options: [] },
  gratitude: { id: 'gratitude', title: 'One good thing today?', dayparts: ['evening'], maxOptions: 4, launchEnabled: false, options: [] },
  body: { id: 'body', title: "How's the body?", dayparts: ['midday', 'evening'], maxOptions: 4, launchEnabled: false, options: [] },
  for_who: { id: 'for_who', title: 'Who was today really about?', dayparts: ['evening'], maxOptions: 5, launchEnabled: false, options: [] },
};

export const launchedDayPrompts = Object.values(dayPromptRegistry).filter((prompt) => prompt.launchEnabled);
