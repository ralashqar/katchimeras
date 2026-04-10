export type DayInMotionTodayState = 'hidden' | 'question' | 'reveal';

export type DayInMotionJourneyEntry = {
  timeLabel: string;
  title: string;
  subtitle: string;
  location: string;
  iconOrTag: string;
  metrics: string;
};

export type DayInMotionScene = {
  id: string;
  dayLabel: string;
  focusedCreatureId: string;
  line: string;
  durationMs: number;
  todayState: DayInMotionTodayState;
  showJourneyEntry?: boolean;
};

export const dayInMotionScenes: readonly DayInMotionScene[] = [
  {
    id: 'intro-copy',
    dayLabel: 'Day 1',
    focusedCreatureId: 'coffee-hearthsip',
    line: "Your days don't disappear.",
    durationMs: 2200,
    todayState: 'hidden',
  },
  {
    id: 'day-1-visible',
    dayLabel: 'Day 1',
    focusedCreatureId: 'coffee-hearthsip',
    line: 'They become something.',
    durationMs: 1200,
    todayState: 'hidden',
    showJourneyEntry: true,
  },
  {
    id: 'day-2',
    dayLabel: 'Day 2',
    focusedCreatureId: 'run-voltstep',
    line: 'They become something.',
    durationMs: 1450,
    todayState: 'hidden',
    showJourneyEntry: true,
  },
  {
    id: 'day-3',
    dayLabel: 'Day 3',
    focusedCreatureId: 'museum-glimmuse',
    line: 'They become something.',
    durationMs: 1500,
    todayState: 'hidden',
    showJourneyEntry: true,
  },
  {
    id: 'day-4',
    dayLabel: 'Day 4',
    focusedCreatureId: 'landmark-skysette',
    line: 'They become something.',
    durationMs: 1650,
    todayState: 'hidden',
    showJourneyEntry: true,
  },
  {
    id: 'today-question',
    dayLabel: 'TODAY',
    focusedCreatureId: 'reveal-creamalume',
    line: 'This came from your day.',
    durationMs: 3400,
    todayState: 'question',
  },
  {
    id: 'today-reveal',
    dayLabel: 'TODAY',
    focusedCreatureId: 'reveal-creamalume',
    line: 'Your Katcher is forming.',
    durationMs: 2600,
    todayState: 'reveal',
    showJourneyEntry: true,
  },
  {
    id: 'today-finale',
    dayLabel: 'TODAY',
    focusedCreatureId: 'reveal-creamalume',
    line: 'See what your day became.',
    durationMs: 0,
    todayState: 'reveal',
    showJourneyEntry: true,
  },
] as const;

export const reducedMotionScenes: readonly DayInMotionScene[] = [
  {
    id: 'intro-copy',
    dayLabel: 'Day 1',
    focusedCreatureId: 'coffee-hearthsip',
    line: "Your days don't disappear.",
    durationMs: 480,
    todayState: 'hidden',
  },
  {
    id: 'day-1-visible',
    dayLabel: 'Day 1',
    focusedCreatureId: 'coffee-hearthsip',
    line: 'They become something.',
    durationMs: 180,
    todayState: 'hidden',
    showJourneyEntry: true,
  },
  {
    id: 'day-2',
    dayLabel: 'Day 2',
    focusedCreatureId: 'run-voltstep',
    line: 'They become something.',
    durationMs: 220,
    todayState: 'hidden',
    showJourneyEntry: true,
  },
  {
    id: 'day-3',
    dayLabel: 'Day 3',
    focusedCreatureId: 'museum-glimmuse',
    line: 'They become something.',
    durationMs: 220,
    todayState: 'hidden',
    showJourneyEntry: true,
  },
  {
    id: 'day-4',
    dayLabel: 'Day 4',
    focusedCreatureId: 'landmark-skysette',
    line: 'They become something.',
    durationMs: 240,
    todayState: 'hidden',
    showJourneyEntry: true,
  },
  {
    id: 'today-question',
    dayLabel: 'TODAY',
    focusedCreatureId: 'reveal-creamalume',
    line: 'This came from your day.',
    durationMs: 760,
    todayState: 'question',
  },
  {
    id: 'today-reveal',
    dayLabel: 'TODAY',
    focusedCreatureId: 'reveal-creamalume',
    line: 'Your Katcher is forming.',
    durationMs: 560,
    todayState: 'reveal',
    showJourneyEntry: true,
  },
  {
    id: 'today-finale',
    dayLabel: 'TODAY',
    focusedCreatureId: 'reveal-creamalume',
    line: 'See what your day became.',
    durationMs: 0,
    todayState: 'reveal',
    showJourneyEntry: true,
  },
] as const;

export const dayInMotionPalette = {
  accent: 'rgba(200,216,255,0.12)',
  colors: ['#06070C', '#0B1120', '#121A2E'] as const,
  meshColors: [
    'rgba(200,216,255,0.10)',
    'rgba(95,168,123,0.08)',
    'rgba(106,95,232,0.08)',
    'rgba(227,160,110,0.08)',
  ] as const,
} as const;
