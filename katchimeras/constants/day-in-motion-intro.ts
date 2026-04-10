import type { HeroOrbitAssetKey } from '@/constants/onboarding-hero';

export type DayInMotionTodayState = 'hidden' | 'question' | 'reveal' | 'card';

export type DayInMotionRailItem = {
  id: string;
  assetKey: HeroOrbitAssetKey;
  caption: string;
  accent: string;
  appearAtScene: number;
};

export type DayInMotionJourneyEntry = {
  timeLabel: string;
  title: string;
  subtitle: string;
  location: string;
  iconOrTag: string;
};

export type DayInMotionScene = {
  id: string;
  dayLabel: string;
  focusedCreatureId: DayInMotionRailItem['id'];
  line: string;
  durationMs: number;
  todayState: DayInMotionTodayState;
  showJourneyEntry?: boolean;
  showCard?: boolean;
};

export const dayInMotionRailItems: readonly DayInMotionRailItem[] = [
  {
    id: 'hayhorn',
    assetKey: 'hayhorn',
    caption: 'A calm day',
    accent: '#9ED8AE',
    appearAtScene: 0,
  },
  {
    id: 'mossprout',
    assetKey: 'mossprout',
    caption: 'A familiar place',
    accent: '#8FC8A0',
    appearAtScene: 2,
  },
  {
    id: 'sprintail',
    assetKey: 'sprintail',
    caption: 'A moment of movement',
    accent: '#93C7FF',
    appearAtScene: 3,
  },
  {
    id: 'lattelet',
    assetKey: 'lattelet',
    caption: 'A coffee day',
    accent: '#F3B788',
    appearAtScene: 4,
  },
] as const;

export const dayInMotionScenes: readonly DayInMotionScene[] = [
  {
    id: 'day-1',
    dayLabel: 'Day 1',
    focusedCreatureId: 'hayhorn',
    line: "Your days don't disappear.",
    durationMs: 2200,
    todayState: 'hidden',
  },
  {
    id: 'day-1-visible',
    dayLabel: 'Day 1',
    focusedCreatureId: 'hayhorn',
    line: 'They become something.',
    durationMs: 1200,
    todayState: 'hidden',
  },
  {
    id: 'day-2',
    dayLabel: 'Day 2',
    focusedCreatureId: 'mossprout',
    line: 'They become something.',
    durationMs: 1500,
    todayState: 'hidden',
  },
  {
    id: 'day-3',
    dayLabel: 'Day 3',
    focusedCreatureId: 'sprintail',
    line: 'They become something.',
    durationMs: 1600,
    todayState: 'hidden',
  },
  {
    id: 'today-question',
    dayLabel: 'TODAY',
    focusedCreatureId: 'lattelet',
    line: 'This came from your day.',
    durationMs: 3400,
    todayState: 'question',
  },
  {
    id: 'today-reveal',
    dayLabel: 'TODAY',
    focusedCreatureId: 'lattelet',
    line: 'Your Katcher is forming.',
    durationMs: 2600,
    todayState: 'reveal',
    showJourneyEntry: true,
  },
  {
    id: 'reveal-card',
    dayLabel: 'TODAY',
    focusedCreatureId: 'lattelet',
    line: 'See what your day became.',
    durationMs: 0,
    todayState: 'reveal',
    showJourneyEntry: true,
  },
] as const;

export const reducedMotionScenes: readonly DayInMotionScene[] = [
  {
    id: 'day-1',
    dayLabel: 'Day 1',
    focusedCreatureId: 'hayhorn',
    line: "Your days don't disappear.",
    durationMs: 480,
    todayState: 'hidden',
  },
  {
    id: 'day-1-visible',
    dayLabel: 'Day 1',
    focusedCreatureId: 'hayhorn',
    line: 'They become something.',
    durationMs: 180,
    todayState: 'hidden',
  },
  {
    id: 'day-2',
    dayLabel: 'Day 2',
    focusedCreatureId: 'mossprout',
    line: 'They become something.',
    durationMs: 220,
    todayState: 'hidden',
  },
  {
    id: 'day-3',
    dayLabel: 'Day 3',
    focusedCreatureId: 'sprintail',
    line: 'They become something.',
    durationMs: 240,
    todayState: 'hidden',
  },
  {
    id: 'today-question',
    dayLabel: 'TODAY',
    focusedCreatureId: 'lattelet',
    line: 'This came from your day.',
    durationMs: 760,
    todayState: 'question',
  },
  {
    id: 'today-reveal',
    dayLabel: 'TODAY',
    focusedCreatureId: 'lattelet',
    line: 'Your Katcher is forming.',
    durationMs: 560,
    todayState: 'reveal',
    showJourneyEntry: true,
  },
  {
    id: 'reveal-card',
    dayLabel: 'TODAY',
    focusedCreatureId: 'lattelet',
    line: 'See what your day became.',
    durationMs: 0,
    todayState: 'reveal',
    showJourneyEntry: true,
  },
] as const;

export const dayInMotionTodayEntry: DayInMotionJourneyEntry = {
  timeLabel: '8:12 AM',
  title: 'Coffee stop',
  subtitle: 'A soft-start ritual begins to shape the day.',
  location: 'Independent cafe',
  iconOrTag: 'Cafe',
};

export const dayInMotionCard = {
  location: 'Independent cafe',
  name: 'Lattelet',
  palette: ['#5A291F', '#F3B788'] as [string, string],
  rarity: 'Warm',
  trait: 'A coffee-day familiar built from soft starts, return visits, and the ritual that keeps finding you.',
} as const;

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
